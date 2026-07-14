# Agent Activity Drawer Design

## Goal

Mission Control should make active Setfarm agents inspectable from the run pipeline itself. When a user clicks a pipeline step card such as Plan, Implement, Verify, or Security Gate, they should see what agent is active for that step, what context it received, what files or artifacts it touched, what checks it ran, and whether it completed, retried, failed, or is still working.

The feature must not expose raw model hidden reasoning. It should surface observable behavior only: claims, events, summaries, transcript paths, file actions, checks, diagnostics, and bounded agent self-reports already present in public transcripts or Setfarm records.

## UX

Pipeline step cards become detail launchers. Clicking a card opens a right-side drawer titled with the step id and current status.

The drawer contains four sections:

1. Active Claim
   - agent id, story id, claim id, outcome, started time, duration
   - status label derived from claim and step state: running, completed, retry, failed, waiting, no claim
   - transcript path and claim summary path when known

2. Agent Received
   - failure category or retry category
   - short retry/actionable feedback preview
   - scope file list
   - source snapshot and supervisor memory presence/size
   - PR review thread count when present

3. Live Trace
   - normalized timeline entries such as input received, claim summary read, files read, edits applied, checks run, guard fired, completed, retried, failed
   - newest events first by default, with a compact density matching the existing Run Contract surface

4. Raw
   - output/diagnostic preview
   - transcript file path
   - claim summary file path
   - a small raw transcript excerpt when available, capped and sanitized

The existing Agent Chat tab remains a conversational surface. The existing Events list remains system-level history. The drawer is the primary debug surface for step-specific agent behavior.

## Data Model

Add a read-only API endpoint:

`GET /api/setfarm/runs/:runId/steps/:stepId/agent-activity`

Response shape:

```json
{
  "runId": "uuid",
  "stepId": "implement",
  "step": {
    "status": "running",
    "agentId": "feature-dev_developer",
    "outputPreview": "STATUS: done..."
  },
  "claims": [
    {
      "id": 3887,
      "storyId": "US-003",
      "agentId": "feature-dev_developer",
      "outcome": "completed",
      "claimedAt": "2026-06-22T05:23:20.712Z",
      "durationMs": 157423,
      "diagnosticPreview": "",
      "transcriptPath": "/Users/.../feature-dev_developer-....log",
      "claimSummaryPath": "/tmp/claim-summary-feature-dev_developer-....json"
    }
  ],
  "received": {
    "failureCategory": "QUALITY_RETRY_FEEDBACK",
    "retryMode": "fix",
    "feedbackPreview": "Missing required View All Logs...",
    "scopeFiles": ["index.html", "insights-signal-cards-canary.html"],
    "sourceSnapshotBytes": 64176,
    "supervisorMemoryChars": 6000,
    "actionableThreadCount": 0
  },
  "trace": [
    {
      "ts": "2026-06-22T05:23:20.925Z",
      "kind": "input_received",
      "label": "QUALITY_RETRY_FEEDBACK",
      "detail": "3 findings, 64KB source snapshot, 6KB supervisor memory"
    }
  ],
  "raw": {
    "outputPreview": "STATUS: done...",
    "diagnosticPreview": "",
    "transcriptPreview": "[spawner] ...",
    "claimSummaryPath": "/tmp/claim-summary-..."
  }
}
```

The endpoint should derive data from existing sources first:

- `steps` for current step status and output
- `claim_log` for active and historical claims
- Setfarm event stream for lifecycle events
- transcript files under the configured transcript directory
- `/tmp/claim-summary-*.json` files when a path can be inferred from transcript bootstrap output

If transcript or claim summary files are missing, the API returns the DB-derived sections and marks file-backed fields as unavailable.

## Trace Normalization

The first version uses deterministic parsing. It does not ask another model to summarize behavior.

Trace entries are produced from:

- claim lifecycle: claimed, completed, retry, failed, abandoned
- bootstrap transcript output: claim summary loaded, retry category, scope files, snapshot/memory presence
- tool call names in transcript: read file, edit file, shell/check command
- Setfarm runtime guard events: scope write, git discipline, claim parse loop, stall, generated screen read
- final output: done, retry findings, fail diagnostic

Each trace entry stores a short label and a bounded detail string. Raw transcript text is capped to avoid a noisy drawer.

## Frontend Components

Add a focused component group:

- `AgentActivityDrawer`
- `AgentActivityTimeline`
- `AgentReceivedPanel`
- `AgentClaimSummary`

`InlinePlanView` step cards receive an `onStepClick` handler and open the drawer for the clicked run/step. The drawer should not replace the existing expanded Run Contract content; it overlays as a right panel so users keep run context.

The visual style should match Mission Control: compact rows, monospace ids, terminal-like section labels, green/yellow/red status badges, and dense but readable content. No large marketing panels, no chat bubbles for debug trace.

## Error Handling

- Missing claim: show "No claim recorded for this step yet."
- Missing transcript: show DB data and mark transcript unavailable.
- Missing claim summary: show retry/output preview from DB and mark received context partial.
- API failure: drawer remains open with an error row and a retry button.
- Long fields: truncate in list view and provide expandable previews.

## Testing

Add focused tests for:

- API response includes latest claim data for a step.
- API handles missing transcript and claim summary files without failing.
- Trace normalization maps transcript bootstrap/tool-call lines into stable trace kinds.
- UI opens drawer when clicking a pipeline step and renders claim, received, trace, and raw sections.

Run the existing Mission Control build checks after implementation:

`npm run build`

When practical, run the render smoke route for `/setfarm/active` after build.

## Out Of Scope

- Displaying raw hidden model chain-of-thought.
- Adding user commands or intervention controls inside the drawer.
- Replacing Agent Chat.
- Persisting new long-form transcript copies in the database.
- Building a full log search product.
