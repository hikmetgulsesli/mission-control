# Agent Activity Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only Agent Activity Drawer in Mission Control so clicking a Setfarm pipeline step shows the active claim, received context, behavior trace, and raw debug references for that step.

**Architecture:** Add a backend activity service that composes `steps`, `claim_log`, Setfarm events, transcript snippets, and inferred claim summary data into one bounded JSON response. Add a typed client API and a right-side React drawer launched from `InlinePlanView` phase cards. Keep trace generation deterministic and avoid exposing raw hidden model reasoning.

**Tech Stack:** TypeScript, Express, postgres tagged SQL, React 19, Vite, existing Mission Control CSS.

## Global Constraints

- Do not expose raw hidden model chain-of-thought.
- Surface observable behavior only: claims, events, summaries, transcript paths, file actions, checks, diagnostics, and bounded agent self-reports already present in public transcripts or Setfarm records.
- Drawer is read-only; no user commands or intervention controls.
- Existing Agent Chat remains conversational; existing Events remain system-level history.
- Long fields must be bounded and expandable in the UI.
- Missing transcript or claim summary files must not fail the API.
- Run `npm run build` after implementation.

---

## File Structure

- Create `server/services/agent-activity.ts`
  - Owns DB queries, transcript/claim-summary inference, trace normalization, and response shaping.
- Modify `server/routes/setfarm-activity.ts`
  - Adds `GET /api/setfarm/runs/:id/steps/:stepId/agent-activity`.
- Modify `src/lib/api.ts`
  - Adds `runAgentActivity(runId, stepId)`.
- Create `src/components/pipeline/AgentActivityDrawer.tsx`
  - Owns drawer UI, loading/error states, and section rendering.
- Modify `src/components/pipeline/InlinePlanView.tsx`
  - Tracks selected step and opens drawer from Live Operations phase cards.
- Modify `src/index.css`
  - Adds drawer and timeline styles matching Mission Control density.
- Create `server/services/agent-activity.test.ts`
  - Unit tests deterministic transcript parsing and response fallbacks.

---

### Task 1: Backend Agent Activity Service

**Files:**
- Create: `server/services/agent-activity.ts`
- Test: `server/services/agent-activity.test.ts`

**Interfaces:**
- Produces: `getAgentActivity(runId: string, stepId: string): Promise<AgentActivityResponse>`
- Produces: `normalizeTranscriptTrace(raw: string): AgentTraceEntry[]`
- Produces: `extractBootstrapContext(raw: string): AgentReceivedContext`
- Consumes: `sql` from `server/utils/pg.ts`
- Consumes: `PATHS.transcriptsDir` from `server/config.ts`

- [ ] **Step 1: Write unit tests for deterministic parsing**

Create `server/services/agent-activity.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { extractBootstrapContext, normalizeTranscriptTrace } from "./agent-activity.js";

test("extractBootstrapContext parses retry category, scope, snapshot, and memory signals", () => {
  const raw = [
    "FAILURE_CATEGORY=QUALITY_RETRY_FEEDBACK",
    "RETRY_MODE=fix",
    "RETRY_BLOCKER_PREVIEW=Failure category: QUALITY_RETRY_FEEDBACK Suggested response: Apply exact findings",
    "SCOPE_FILES=index.html, insights-signal-cards-canary.html",
    "RETRY_SOURCE_SNAPSHOT=present 64176 bytes",
    "SUPERVISOR_MEMORY=present 6000 chars",
    "PR_REVIEW_ACTIONABLE_THREADS=3",
  ].join("\\n");

  const ctx = extractBootstrapContext(raw);

  assert.equal(ctx.failureCategory, "QUALITY_RETRY_FEEDBACK");
  assert.equal(ctx.retryMode, "fix");
  assert.deepEqual(ctx.scopeFiles, ["index.html", "insights-signal-cards-canary.html"]);
  assert.equal(ctx.sourceSnapshotBytes, 64176);
  assert.equal(ctx.supervisorMemoryChars, 6000);
  assert.equal(ctx.actionableThreadCount, 3);
  assert.match(ctx.feedbackPreview || "", /Apply exact findings/);
});

test("normalizeTranscriptTrace maps bootstrap, read, edit, shell, and completion lines", () => {
  const raw = [
    "[spawner] 2026-06-22T05:23:20.925Z feature-dev/developer agent=feature-dev_developer",
    "CLAIM_SUMMARY_FILE=/tmp/claim-summary-feature-dev_developer-spawner.json",
    "FAILURE_CATEGORY=QUALITY_RETRY_FEEDBACK",
    '{"function":{"name":"ReadFile","arguments":"{\\"path\\":\\"/repo/index.html\\"}"}}',
    '{"function":{"name":"StrReplaceFile","arguments":"{\\"path\\":\\"/repo/index.html\\"}"}}',
    '{"function":{"name":"Shell","arguments":"{\\"command\\":\\"npm run build\\"}"}}',
    "--- FINISHED 2026-06-22T05:25:59.170Z ---",
  ].join("\\n");

  const trace = normalizeTranscriptTrace(raw);
  const kinds = trace.map((entry) => entry.kind);

  assert.ok(kinds.includes("input_received"));
  assert.ok(kinds.includes("claim_summary_read"));
  assert.ok(kinds.includes("file_read"));
  assert.ok(kinds.includes("edit_applied"));
  assert.ok(kinds.includes("checks_run"));
  assert.ok(kinds.includes("completed"));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --import tsx --test server/services/agent-activity.test.ts
```

Expected: fail because `server/services/agent-activity.ts` does not exist.

- [ ] **Step 3: Implement the service**

Create `server/services/agent-activity.ts`:

```ts
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { PATHS } from "../config.js";
import { sql } from "../utils/pg.js";

const PREVIEW_LIMIT = 1600;
const RAW_TRANSCRIPT_LIMIT = 6000;

export interface AgentTraceEntry {
  ts?: string;
  kind: "input_received" | "claim_summary_read" | "file_read" | "edit_applied" | "checks_run" | "guard_fired" | "completed" | "retried" | "failed" | "claim_lifecycle";
  label: string;
  detail?: string;
}

export interface AgentReceivedContext {
  failureCategory?: string | null;
  retryMode?: string | null;
  feedbackPreview?: string | null;
  scopeFiles: string[];
  sourceSnapshotBytes?: number | null;
  supervisorMemoryChars?: number | null;
  actionableThreadCount?: number | null;
}

export interface AgentActivityResponse {
  runId: string;
  stepId: string;
  step: {
    status: string;
    agentId: string | null;
    outputPreview: string;
  } | null;
  claims: Array<{
    id: number;
    storyId: string | null;
    agentId: string | null;
    outcome: string | null;
    claimedAt: string | null;
    abandonedAt: string | null;
    durationMs: number | null;
    diagnosticPreview: string;
    transcriptPath: string | null;
    claimSummaryPath: string | null;
  }>;
  received: AgentReceivedContext;
  trace: AgentTraceEntry[];
  raw: {
    outputPreview: string;
    diagnosticPreview: string;
    transcriptPreview: string;
    transcriptPath: string | null;
    claimSummaryPath: string | null;
  };
}

function preview(value: unknown, max = PREVIEW_LIMIT): string {
  return String(value || "").replace(/\s+\n/g, "\n").trim().slice(0, max);
}

function parseNumberMatch(raw: string, pattern: RegExp): number | null {
  const match = raw.match(pattern);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function parseLineValue(raw: string, key: string): string | null {
  const match = raw.match(new RegExp(`(?:^|\\n)${key}=([^\\n]*)`));
  return match ? match[1].trim() : null;
}

function compactDetail(value: string, max = 240): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function extractBootstrapContext(raw: string): AgentReceivedContext {
  const scope = parseLineValue(raw, "SCOPE_FILES");
  return {
    failureCategory: parseLineValue(raw, "FAILURE_CATEGORY"),
    retryMode: parseLineValue(raw, "RETRY_MODE"),
    feedbackPreview: parseLineValue(raw, "RETRY_BLOCKER_PREVIEW") || parseLineValue(raw, "PREVIOUS_FAILURE"),
    scopeFiles: scope ? scope.split(",").map((item) => item.trim()).filter(Boolean) : [],
    sourceSnapshotBytes: parseNumberMatch(raw, /RETRY_SOURCE_SNAPSHOT=present\s+(\d+)\s+bytes/i),
    supervisorMemoryChars: parseNumberMatch(raw, /SUPERVISOR_MEMORY=present\s+(\d+)\s+chars/i),
    actionableThreadCount: parseNumberMatch(raw, /PR_REVIEW_ACTIONABLE_THREADS=(\d+)/i),
  };
}

function traceTsFromLine(line: string): string | undefined {
  return line.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/)?.[0];
}

function toolPath(line: string): string {
  return line.match(/\\?"path\\?"\s*:\s*\\?"([^"\\]+)\\?"/)?.[1] || "";
}

function shellCommand(line: string): string {
  return line.match(/\\?"command\\?"\s*:\s*\\?"([^"\\]+)\\?"/)?.[1] || "";
}

export function normalizeTranscriptTrace(raw: string): AgentTraceEntry[] {
  const out: AgentTraceEntry[] = [];
  const lines = raw.split(/\r?\n/);
  const seen = new Set<string>();
  const push = (entry: AgentTraceEntry) => {
    const key = `${entry.kind}:${entry.label}:${entry.detail || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(entry);
  };

  for (const line of lines) {
    const ts = traceTsFromLine(line);
    if (line.includes("FAILURE_CATEGORY=")) {
      push({ ts, kind: "input_received", label: parseLineValue(`\n${line}`, "FAILURE_CATEGORY") || "input received", detail: compactDetail(line) });
    } else if (line.includes("CLAIM_SUMMARY_FILE=")) {
      push({ ts, kind: "claim_summary_read", label: "Claim summary available", detail: compactDetail(line) });
    } else if (line.includes('"name":"ReadFile"') || line.includes('"name":"Read"')) {
      push({ ts, kind: "file_read", label: "File read", detail: toolPath(line) || compactDetail(line) });
    } else if (line.includes('"name":"StrReplaceFile"') || line.includes('"name":"WriteFile"')) {
      push({ ts, kind: "edit_applied", label: "Edit applied", detail: toolPath(line) || compactDetail(line) });
    } else if (line.includes('"name":"Shell"')) {
      const command = shellCommand(line);
      const checkLike = /\b(npm run|node --check|pytest|vitest|tsx --test|true|build|test|lint)\b/i.test(command);
      push({ ts, kind: checkLike ? "checks_run" : "claim_lifecycle", label: checkLike ? "Command/check run" : "Shell command", detail: compactDetail(command || line) });
    } else if (/GUARD|VIOLATION|STALL|TIMEOUT/.test(line)) {
      push({ ts, kind: "guard_fired", label: "Runtime guard", detail: compactDetail(line) });
    } else if (line.includes("--- FINISHED")) {
      push({ ts, kind: "completed", label: "Transcript finished", detail: compactDetail(line) });
    }
  }

  return out.slice(-120);
}

function transcriptCandidates(agentId: string | null, claimedAt: string | null): Array<{ path: string; mtime: number }> {
  if (!agentId || !existsSync(PATHS.transcriptsDir)) return [];
  const files: Array<{ path: string; mtime: number }> = [];
  const needle = agentId.split("/").pop() || agentId;
  for (const workflow of readdirSync(PATHS.transcriptsDir)) {
    const dir = join(PATHS.transcriptsDir, workflow);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.includes(needle) || !file.endsWith(".log")) continue;
      const full = join(dir, file);
      try {
        const stat = statSync(full);
        files.push({ path: full, mtime: stat.mtimeMs });
      } catch {
        // ignore unreadable file
      }
    }
  }
  const claimedMs = claimedAt ? new Date(claimedAt).getTime() : 0;
  return files.sort((a, b) => {
    if (claimedMs) return Math.abs(a.mtime - claimedMs) - Math.abs(b.mtime - claimedMs);
    return b.mtime - a.mtime;
  });
}

function inferClaimSummaryPath(raw: string): string | null {
  const direct = parseLineValue(raw, "CLAIM_SUMMARY_FILE");
  if (direct && existsSync(direct)) return direct;
  const match = raw.match(/\/tmp\/claim-summary-[^\s"']+\.json/);
  return match && existsSync(match[0]) ? match[0] : null;
}

function readClaimSummary(path: string | null): AgentReceivedContext {
  if (!path || !existsSync(path)) return { scopeFiles: [] };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    const retry = parsed?.retryFeedback || {};
    return {
      failureCategory: retry.category || parsed.failureCategory || null,
      retryMode: retry.mode || null,
      feedbackPreview: preview(retry.details || parsed.previousFailure || "", 900),
      scopeFiles: Array.isArray(parsed.scopeFiles) ? parsed.scopeFiles.map(String) : [],
      sourceSnapshotBytes: retry.sourceSnapshot?.section ? String(retry.sourceSnapshot.section).length : null,
      supervisorMemoryChars: parsed.supervisorMemory ? String(parsed.supervisorMemory).length : null,
      actionableThreadCount: Array.isArray(retry.actionableReviewThreads) ? retry.actionableReviewThreads.length : null,
    };
  } catch {
    return { scopeFiles: [] };
  }
}

function mergeReceived(a: AgentReceivedContext, b: AgentReceivedContext): AgentReceivedContext {
  return {
    failureCategory: a.failureCategory || b.failureCategory || null,
    retryMode: a.retryMode || b.retryMode || null,
    feedbackPreview: a.feedbackPreview || b.feedbackPreview || null,
    scopeFiles: a.scopeFiles.length ? a.scopeFiles : b.scopeFiles,
    sourceSnapshotBytes: a.sourceSnapshotBytes ?? b.sourceSnapshotBytes ?? null,
    supervisorMemoryChars: a.supervisorMemoryChars ?? b.supervisorMemoryChars ?? null,
    actionableThreadCount: a.actionableThreadCount ?? b.actionableThreadCount ?? null,
  };
}

export async function getAgentActivity(runId: string, stepId: string): Promise<AgentActivityResponse> {
  const [step] = await sql`
    SELECT step_id, status, agent_id, output
    FROM steps
    WHERE run_id = ${runId} AND step_id = ${stepId}
    LIMIT 1
  `;
  const claims = await sql`
    SELECT id, story_id, step_id, agent_id, outcome, claimed_at, abandoned_at, duration_ms, diagnostic
    FROM claim_log
    WHERE run_id = ${runId} AND step_id = ${stepId}
    ORDER BY claimed_at DESC NULLS LAST, id DESC
    LIMIT 8
  `;

  const primaryClaim = claims[0] || null;
  const transcriptPath = transcriptCandidates(primaryClaim?.agent_id || step?.agent_id || null, primaryClaim?.claimed_at || null)[0]?.path || null;
  const transcriptRaw = transcriptPath && existsSync(transcriptPath) ? readFileSync(transcriptPath, "utf-8") : "";
  const claimSummaryPath = inferClaimSummaryPath(transcriptRaw);
  const received = mergeReceived(extractBootstrapContext(transcriptRaw), readClaimSummary(claimSummaryPath));
  const trace = [
    ...claims.slice().reverse().map((claim: any) => ({
      ts: claim.claimed_at || undefined,
      kind: "claim_lifecycle" as const,
      label: claim.outcome ? `Claim ${claim.outcome}` : "Claim running",
      detail: `${claim.agent_id || "agent"} ${claim.story_id || stepId}`,
    })),
    ...normalizeTranscriptTrace(transcriptRaw),
  ].slice(-160);

  return {
    runId,
    stepId,
    step: step ? {
      status: String(step.status || ""),
      agentId: step.agent_id || null,
      outputPreview: preview(step.output),
    } : null,
    claims: claims.map((claim: any) => ({
      id: Number(claim.id),
      storyId: claim.story_id || null,
      agentId: claim.agent_id || null,
      outcome: claim.outcome || null,
      claimedAt: claim.claimed_at || null,
      abandonedAt: claim.abandoned_at || null,
      durationMs: claim.duration_ms == null ? null : Number(claim.duration_ms),
      diagnosticPreview: preview(claim.diagnostic),
      transcriptPath: claim.id === primaryClaim?.id ? transcriptPath : null,
      claimSummaryPath: claim.id === primaryClaim?.id ? claimSummaryPath : null,
    })),
    received,
    trace,
    raw: {
      outputPreview: preview(step?.output),
      diagnosticPreview: preview(primaryClaim?.diagnostic),
      transcriptPreview: transcriptRaw.slice(0, RAW_TRANSCRIPT_LIMIT),
      transcriptPath,
      claimSummaryPath,
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
node --import tsx --test server/services/agent-activity.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add server/services/agent-activity.ts server/services/agent-activity.test.ts
git commit -m "feat: add setfarm agent activity service"
```

---

### Task 2: API Route And Client Method

**Files:**
- Modify: `server/routes/setfarm-activity.ts`
- Modify: `src/lib/api.ts`

**Interfaces:**
- Consumes: `getAgentActivity(runId: string, stepId: string)`
- Produces: `GET /api/setfarm/runs/:id/steps/:stepId/agent-activity`
- Produces: `api.runAgentActivity(runId: string, stepId: string): Promise<any>`

- [ ] **Step 1: Add route import**

Modify the imports in `server/routes/setfarm-activity.ts`:

```ts
import { getAgentActivity } from '../services/agent-activity.js';
```

- [ ] **Step 2: Add Express route near other run-specific Setfarm routes**

Insert after the `/setfarm/runs/:id/operational-model` route:

```ts
// GET /setfarm/runs/:id/steps/:stepId/agent-activity — Step-specific agent behavior trace.
router.get('/setfarm/runs/:id/steps/:stepId/agent-activity', async (req, res) => {
  noStore(res);
  try {
    const data = await getAgentActivity(req.params.id, req.params.stepId);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Agent activity fetch failed' });
  }
});
```

- [ ] **Step 3: Add client API method**

Modify `src/lib/api.ts` near existing run methods:

```ts
  runAgentActivity: (id: string, stepId: string) =>
    fetchApi<any>(`/api/setfarm/runs/${id}/steps/${encodeURIComponent(stepId)}/agent-activity`),
```

- [ ] **Step 4: Run focused checks**

Run:

```bash
npm run build
```

Expected: TypeScript server/client build passes.

- [ ] **Step 5: Commit**

```bash
git add server/routes/setfarm-activity.ts src/lib/api.ts
git commit -m "feat: expose setfarm step agent activity api"
```

---

### Task 3: Agent Activity Drawer UI

**Files:**
- Create: `src/components/pipeline/AgentActivityDrawer.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `api.runAgentActivity(runId, stepId)`
- Produces: `AgentActivityDrawer({ runId, stepId, label, open, onClose })`

- [ ] **Step 1: Create drawer component**

Create `src/components/pipeline/AgentActivityDrawer.tsx`:

```tsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";

interface AgentActivityDrawerProps {
  runId: string;
  stepId: string | null;
  label?: string;
  open: boolean;
  onClose: () => void;
}

function compact(value: unknown, fallback = "-"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function formatMs(value: unknown): string {
  const ms = Number(value || 0);
  if (!Number.isFinite(ms) || ms <= 0) return "-";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  return `${min}m ${sec % 60}s`;
}

function formatTime(value: unknown): string {
  if (!value) return "-";
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return "-";
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="af-agent-activity__section">
      <div className="af-agent-activity__section-title">{title}</div>
      {children}
    </section>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="af-agent-activity__kv">
      <span>{label}</span>
      <code>{value}</code>
    </div>
  );
}

export function AgentActivityDrawer({ runId, stepId, label, open, onClose }: AgentActivityDrawerProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !stepId) return;
    let cancelled = false;
    const load = () => {
      setLoading(true);
      setError("");
      api.runAgentActivity(runId, stepId)
        .then((next) => {
          if (cancelled) return;
          setData(next);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err?.message || "Agent activity failed");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    const id = window.setInterval(load, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [open, runId, stepId]);

  const latestClaim = data?.claims?.[0] || null;
  const received = data?.received || {};
  const trace = Array.isArray(data?.trace) ? data.trace : [];
  const scopeFiles = Array.isArray(received.scopeFiles) ? received.scopeFiles : [];
  const title = label || stepId || "Agent Activity";

  const status = useMemo(() => {
    if (latestClaim?.outcome) return latestClaim.outcome;
    if (data?.step?.status) return data.step.status;
    return stepId ? "pending" : "no step";
  }, [latestClaim, data, stepId]);

  if (!open) return null;

  return (
    <div className="af-agent-activity" role="dialog" aria-modal="true" aria-label="Agent activity">
      <div className="af-agent-activity__backdrop" onClick={onClose} />
      <aside className="af-agent-activity__panel">
        <header className="af-agent-activity__header">
          <div>
            <span className="af-contract__kicker">AGENT ACTIVITY</span>
            <strong>{compact(title).toUpperCase()}</strong>
            <em>{compact(status)}</em>
          </div>
          <button className="af-agent-activity__close" type="button" onClick={onClose} aria-label="Close agent activity">×</button>
        </header>

        {loading && !data && <div className="af-agent-activity__empty">Loading agent activity...</div>}
        {error && <div className="af-agent-activity__error">{error}</div>}
        {!loading && !error && !data && <div className="af-agent-activity__empty">No activity loaded.</div>}

        {data && (
          <div className="af-agent-activity__body">
            <Section title="Active Claim">
              <div className="af-agent-activity__grid">
                <KV label="agent" value={compact(latestClaim?.agentId || data.step?.agentId)} />
                <KV label="story" value={compact(latestClaim?.storyId)} />
                <KV label="claim" value={compact(latestClaim?.id)} />
                <KV label="duration" value={formatMs(latestClaim?.durationMs)} />
                <KV label="started" value={formatTime(latestClaim?.claimedAt)} />
                <KV label="outcome" value={compact(latestClaim?.outcome || data.step?.status)} />
              </div>
            </Section>

            <Section title="Agent Received">
              <div className="af-agent-activity__grid">
                <KV label="failure" value={compact(received.failureCategory)} />
                <KV label="mode" value={compact(received.retryMode)} />
                <KV label="snapshot" value={received.sourceSnapshotBytes ? `${received.sourceSnapshotBytes} bytes` : "-"} />
                <KV label="memory" value={received.supervisorMemoryChars ? `${received.supervisorMemoryChars} chars` : "-"} />
                <KV label="threads" value={compact(received.actionableThreadCount, "0")} />
              </div>
              {received.feedbackPreview && <pre className="af-agent-activity__preview">{received.feedbackPreview}</pre>}
              {scopeFiles.length > 0 && (
                <div className="af-agent-activity__chips">
                  {scopeFiles.slice(0, 16).map((file: string) => <span key={file}>{file}</span>)}
                  {scopeFiles.length > 16 && <span>+{scopeFiles.length - 16}</span>}
                </div>
              )}
            </Section>

            <Section title="Live Trace">
              {trace.length === 0 ? (
                <div className="af-agent-activity__empty-line">No trace entries yet.</div>
              ) : (
                <div className="af-agent-activity__trace">
                  {trace.slice().reverse().map((entry: any, index: number) => (
                    <div key={`${entry.kind}-${index}`} className={`af-agent-activity__trace-row af-agent-activity__trace-row--${entry.kind}`}>
                      <span>{formatTime(entry.ts)}</span>
                      <b>{compact(entry.kind).replace(/_/g, " ")}</b>
                      <strong>{compact(entry.label)}</strong>
                      {entry.detail && <em title={entry.detail}>{entry.detail}</em>}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Raw">
              <div className="af-agent-activity__grid">
                <KV label="transcript" value={compact(data.raw?.transcriptPath)} />
                <KV label="claim summary" value={compact(data.raw?.claimSummaryPath)} />
              </div>
              {data.raw?.diagnosticPreview && <pre className="af-agent-activity__preview">{data.raw.diagnosticPreview}</pre>}
              {data.raw?.transcriptPreview && (
                <details className="af-agent-activity__details">
                  <summary>Transcript excerpt</summary>
                  <pre>{data.raw.transcriptPreview}</pre>
                </details>
              )}
            </Section>
          </div>
        )}
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Add CSS**

Append to `src/index.css`:

```css
.af-agent-activity { position: fixed; inset: 0; z-index: 1200; pointer-events: auto; }
.af-agent-activity__backdrop { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.42); }
.af-agent-activity__panel {
  position: absolute; top: 0; right: 0; bottom: 0; width: min(680px, 96vw);
  background: var(--bg-panel); border-left: 1px solid var(--border);
  box-shadow: -18px 0 40px rgba(0, 0, 0, 0.35); display: flex; flex-direction: column;
}
.af-agent-activity__header {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  padding: 18px 20px; border-bottom: 1px solid var(--border); background: rgba(0, 255, 255, 0.03);
}
.af-agent-activity__header strong { display: block; margin-top: 4px; color: var(--text-primary); font-size: 15px; letter-spacing: 0.02em; }
.af-agent-activity__header em { display: block; margin-top: 4px; color: var(--text-secondary); font-style: normal; font-size: 12px; }
.af-agent-activity__close {
  width: 32px; height: 32px; border: 1px solid var(--border); background: var(--bg-card);
  color: var(--text-primary); cursor: pointer; font-size: 20px; line-height: 1;
}
.af-agent-activity__body { overflow-y: auto; padding: 16px 20px 28px; display: flex; flex-direction: column; gap: 16px; }
.af-agent-activity__section { border: 1px solid var(--border); background: rgba(255, 255, 255, 0.02); padding: 14px; }
.af-agent-activity__section-title { color: var(--accent-cyan); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 10px; }
.af-agent-activity__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.af-agent-activity__kv { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.af-agent-activity__kv span { color: var(--text-tertiary); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
.af-agent-activity__kv code {
  color: var(--text-primary); font-family: var(--font-mono); font-size: 11px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.af-agent-activity__preview, .af-agent-activity__details pre {
  margin-top: 10px; max-height: 180px; overflow: auto; padding: 10px;
  background: var(--bg-code); border: 1px solid var(--border); color: var(--text-secondary);
  font-family: var(--font-mono); font-size: 11px; white-space: pre-wrap; word-break: break-word;
}
.af-agent-activity__chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.af-agent-activity__chips span {
  border: 1px solid var(--border); color: var(--text-secondary); padding: 3px 6px;
  font-family: var(--font-mono); font-size: 10px; background: rgba(255,255,255,0.03);
}
.af-agent-activity__trace { display: flex; flex-direction: column; gap: 6px; }
.af-agent-activity__trace-row {
  display: grid; grid-template-columns: 48px 110px minmax(110px, 1fr); gap: 8px; align-items: start;
  padding: 7px 0; border-bottom: 1px solid var(--border-light); font-size: 11px;
}
.af-agent-activity__trace-row span { color: var(--text-tertiary); font-family: var(--font-mono); }
.af-agent-activity__trace-row b { color: var(--accent-cyan); font-weight: 600; text-transform: uppercase; }
.af-agent-activity__trace-row strong { color: var(--text-primary); font-weight: 600; }
.af-agent-activity__trace-row em {
  grid-column: 3; color: var(--text-secondary); font-style: normal; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.af-agent-activity__details { margin-top: 10px; }
.af-agent-activity__details summary { color: var(--accent-cyan); cursor: pointer; font-size: 12px; }
.af-agent-activity__empty, .af-agent-activity__error, .af-agent-activity__empty-line {
  color: var(--text-secondary); font-size: 12px; padding: 12px; border: 1px dashed var(--border);
}
.af-agent-activity__error { color: var(--accent-red); border-color: rgba(255, 0, 64, 0.35); }
```

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 4: Commit**

```bash
git add src/components/pipeline/AgentActivityDrawer.tsx src/index.css
git commit -m "feat: add agent activity drawer ui"
```

---

### Task 4: Step Card Integration

**Files:**
- Modify: `src/components/pipeline/InlinePlanView.tsx`

**Interfaces:**
- Consumes: `AgentActivityDrawer`
- Produces: clickable live operations phase cards that open the drawer.

- [ ] **Step 1: Import drawer and add state**

At the top of `src/components/pipeline/InlinePlanView.tsx`, add:

```tsx
import { AgentActivityDrawer } from "./AgentActivityDrawer";
```

Inside `InlinePlanView`, add state after existing `useState` declarations:

```tsx
  const [activityStep, setActivityStep] = useState<{ stepId: string; label: string } | null>(null);
```

- [ ] **Step 2: Pass click handler into LiveOperationsBoard**

Change the `LiveOperationsBoard` signature:

```tsx
function LiveOperationsBoard({
  data,
  onStepClick,
}: {
  data: OperationsData | null;
  onStepClick?: (stepId: string, label: string) => void;
}) {
```

In the phase card map, change the card root:

```tsx
            <button
              key={phase.id}
              type="button"
              className={`af-live-ops__phase af-live-ops__phase--${status} af-live-ops__phase--button`}
              onClick={() => onStepClick?.(String(phase.id), formatContractValue(phase.label || phase.id))}
            >
```

And change the closing `</div>` for that phase card to `</button>`.

- [ ] **Step 3: Wire drawer from contract tab**

Update the `LiveOperationsBoard` usage:

```tsx
              <LiveOperationsBoard
                data={operationsData}
                onStepClick={(stepId, label) => setActivityStep({ stepId, label })}
              />
```

Render the drawer near the end of `InlinePlanView` return tree, outside tab content but inside the top-level `.af-inline-plan`:

```tsx
      <AgentActivityDrawer
        runId={runId}
        stepId={activityStep?.stepId || null}
        label={activityStep?.label}
        open={Boolean(activityStep)}
        onClose={() => setActivityStep(null)}
      />
```

- [ ] **Step 4: Add clickable card CSS**

Append to `src/index.css`:

```css
.af-live-ops__phase--button {
  text-align: left;
  font: inherit;
  cursor: pointer;
}
.af-live-ops__phase--button:hover {
  border-color: rgba(0, 255, 255, 0.38);
  box-shadow: 0 0 0 1px rgba(0, 255, 255, 0.08), var(--glow-cyan);
}
.af-live-ops__phase--button:focus-visible {
  outline: 2px solid var(--accent-cyan);
  outline-offset: 2px;
}
```

- [ ] **Step 5: Run build and smoke**

Run:

```bash
npm run build
MC_RENDER_ROUTES=/setfarm/active npm run render:smoke
```

Expected: build passes and render smoke for `/setfarm/active` completes without blank page or render error.

- [ ] **Step 6: Commit**

```bash
git add src/components/pipeline/InlinePlanView.tsx src/index.css
git commit -m "feat: open agent activity from pipeline steps"
```

---

### Task 5: Manual Verification And Final Polish

**Files:**
- Modify only files touched in earlier tasks if verification finds issues.

**Interfaces:**
- Consumes: running Mission Control on port 3080 or a local dev server.
- Produces: verified drawer behavior.

- [ ] **Step 1: Start or reuse Mission Control**

If no dev server is running:

```bash
npm run dev
```

If port 3080 is already served by the packaged process, use that and skip starting a second server.

- [ ] **Step 2: Verify route manually**

Open:

```text
http://127.0.0.1:3080/setfarm/active
```

Click the `Run Contract` tab, then click a phase card such as `Implement`.

Expected:

- Right-side Agent Activity drawer opens.
- Active Claim section shows agent/story/claim/duration.
- Agent Received section shows category/scope/snapshot/memory when available.
- Live Trace has deterministic timeline entries.
- Raw section shows transcript/claim paths or unavailable state.
- Escape/click close works.

- [ ] **Step 3: Final build**

Run:

```bash
npm run build
```

Expected: pass.

- [ ] **Step 4: Commit final polish if needed**

If any polish changes were made:

```bash
git add <changed-files>
git commit -m "fix: polish agent activity drawer"
```

If no changes were needed, do not create an empty commit.

---

## Self-Review

- Spec coverage: API, drawer UI, step-card launch, deterministic trace, missing-file handling, no raw hidden reasoning, and testing are covered.
- Placeholder scan: no TBD/TODO/fill-in steps are present.
- Type consistency: `AgentActivityResponse`, `AgentReceivedContext`, `AgentTraceEntry`, `getAgentActivity`, `normalizeTranscriptTrace`, and `extractBootstrapContext` names are consistent across tasks.
- Scope: one backend service, one API route, one client method, one drawer component, and one existing pipeline component integration.
