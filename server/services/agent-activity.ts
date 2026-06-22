import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { PATHS } from "../config.js";
import { sql } from "../utils/pg.js";

const PREVIEW_LIMIT = 1600;
const RAW_TRANSCRIPT_LIMIT = 6000;

export interface AgentTraceEntry {
  ts?: string;
  kind:
    | "input_received"
    | "claim_summary_read"
    | "file_read"
    | "edit_applied"
    | "checks_run"
    | "guard_fired"
    | "completed"
    | "retried"
    | "failed"
    | "claim_lifecycle";
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

function compactDetail(value: string, max = 260): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function scrubReasoning(value: any): any {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item && typeof item === "object" && item.type === "think") {
        return { type: "reasoning", text: "[reasoning redacted]" };
      }
      return scrubReasoning(item);
    });
  }
  if (!value || typeof value !== "object") return value;
  const out: Record<string, any> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "think" || key === "encrypted") {
      out[key] = "[reasoning redacted]";
    } else {
      out[key] = scrubReasoning(child);
    }
  }
  return out;
}

export function sanitizeTranscriptForDisplay(raw: string): string {
  return raw.split(/\r?\n/).map((line) => {
    try {
      return JSON.stringify(scrubReasoning(JSON.parse(line)));
    } catch {
      return line
        .replace(/"think"\s*:\s*"([^"\\]|\\.)*"/g, '"think":"[reasoning redacted]"')
        .replace(/\\"think\\"\s*:\s*\\"([^"\\]|\\.)*\\"/g, '\\"think\\":\\"[reasoning redacted]\\"');
    }
  }).join("\n");
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

function extractJsonArgument(line: string, key: string): string {
  const escapedPattern = new RegExp(`\\\\?"${key}\\\\?"\\s*:\\s*\\\\?"([^"\\\\]+)`);
  return line.match(escapedPattern)?.[1] || "";
}

function toolPath(line: string): string {
  return extractJsonArgument(line, "path");
}

function shellCommand(line: string): string {
  return extractJsonArgument(line, "command");
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
        // Ignore unreadable files; DB-backed data still renders.
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
      transcriptPreview: sanitizeTranscriptForDisplay(transcriptRaw).slice(0, RAW_TRANSCRIPT_LIMIT),
      transcriptPath,
      claimSummaryPath,
    },
  };
}
