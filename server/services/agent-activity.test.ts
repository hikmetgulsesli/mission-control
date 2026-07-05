import assert from "node:assert/strict";
import test from "node:test";
import {
  extractBootstrapContext,
  normalizeTranscriptTrace,
  sanitizeTranscriptForDisplay,
  sortRuntimeCandidatesForClaim,
} from "./agent-activity.js";

test("extractBootstrapContext parses retry category, scope, snapshot, and memory signals", () => {
  const raw = [
    "FAILURE_CATEGORY=QUALITY_RETRY_FEEDBACK",
    "RETRY_MODE=fix",
    "RETRY_BLOCKER_PREVIEW=Failure category: QUALITY_RETRY_FEEDBACK Suggested response: Apply exact findings",
    "SCOPE_FILES=index.html, insights-signal-cards-canary.html",
    "RETRY_SOURCE_SNAPSHOT=present 64176 bytes",
    "SUPERVISOR_MEMORY=present 6000 chars",
    "PR_REVIEW_ACTIONABLE_THREADS=3",
  ].join("\n");

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
  ].join("\n");

  const trace = normalizeTranscriptTrace(raw);
  const kinds = trace.map((entry) => entry.kind);

  assert.ok(kinds.includes("input_received"));
  assert.ok(kinds.includes("claim_summary_read"));
  assert.ok(kinds.includes("file_read"));
  assert.ok(kinds.includes("edit_applied"));
  assert.ok(kinds.includes("checks_run"));
  assert.ok(kinds.includes("completed"));
});

test("sanitizeTranscriptForDisplay redacts model reasoning fields", () => {
  const raw = '{"role":"assistant","content":[{"type":"think","think":"hidden reasoning","encrypted":"secret"}]}';
  const sanitized = sanitizeTranscriptForDisplay(raw);

  assert.match(sanitized, /reasoning redacted/);
  assert.doesNotMatch(sanitized, /hidden reasoning/);
  assert.doesNotMatch(sanitized, /secret/);
});

test("sortRuntimeCandidatesForClaim prefers sessions updated after the claim", () => {
  const claimedAt = "2026-07-05T13:01:44.785Z";
  const claimedMs = new Date(claimedAt).getTime();
  const candidates = [
    { path: "old-abandoned.jsonl", mtime: claimedMs - 5_000 },
    { path: "current-running.jsonl", mtime: claimedMs + 30_000 },
    { path: "future-other.jsonl", mtime: claimedMs + 120_000 },
  ];

  const sorted = sortRuntimeCandidatesForClaim(candidates, claimedAt);

  assert.equal(sorted[0].path, "current-running.jsonl");
});
