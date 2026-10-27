# Files Selection Races Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent stale directory/file responses and mutation readbacks from being displayed or edited under a newer Files selection.

**Architecture:** Keep usePolling's public return shape. Track lifecycle and latest-request ownership; apply equivalent selection ownership to all viewer continuations. Use accepted content directly for explicit edit intent rather than setTimeout closures.

**Tech Stack:** TypeScript, React, existing node:test and TypeScript source-transpilation fixtures; no new packages.

**Spec:** docs/superpowers/specs/2026-10-27-files-selection-races-design.md, subordinate to the approved docs/superpowers/specs/2026-10-19-operator-workspace-design.md.

## Global Constraints

- Root alone stages, commits, pushes and delivers. One implementation worker in the existing linked Mission Control writer.
- English product copy and existing runtime/test guards remain. Preserve records, prior evidence and all technical destinations.
- No new dependencies, live API mutations, credentials, service changes, extra isolation work or unrelated Setfarm edits.
- Actual source behavior must be exercised; AST extraction may only expose actual declarations, not substitute mirrored implementation. React/transport/timers are synthetic; no mounted/browser qualification is claimed.
- Keep source/test edits inside the File Map. If another source file is necessary, report its causal need to Root before editing it.

## File Map

- Modify src/hooks/usePolling.ts: existing generic keyed polling, public {data,error,loading,refresh} unchanged.
- Modify src/pages/Files.tsx: selection/read/edit ownership and existing viewer mutation continuations.
- Create tests/use-polling.test.ts: listener-free actual hook lifecycle with deferred promises.
- Create tests/files-selection.test.ts: listener-free actual Files component callbacks and state with deferred API promises. Share a test-only fixture under tests/fixtures/files-selection-lifecycle.ts only if needed to avoid duplicate lifecycle code.
- The design and this plan document the causal fix; no unrelated source changes.

### Task 1: Guard polling and Files selection responses

**Files:** All File Map paths. Read the design, writer AGENTS and source before editing.

**Interfaces:** Preserve usePolling<T>(fetcher: () => Promise<T>, intervalMs?: number, key?: string) and its existing return fields. Keep Files' existing API method contracts, action handlers and UI destinations. Actual delayed transport is simulated; no sockets/processes/browser launches or real file calls in tests.

- [ ] **Step 1: Write failing behavior tests before product edits.** Use TypeScript transpilation of the actual source and a small React slot/effect harness, as tests/use-websocket.test.ts demonstrates. Capture deferred API requests and resolve/reject in explicit order. A representative assertion sequence is:

```ts
const a = deferred();
const b = deferred();
const first = h.render(() => a.promise, 30000, 'A');
h.render(() => b.promise, 30000, 'B');
b.resolve('B'); await flush();
assert.equal(h.current().data, 'B');
a.resolve('A'); await flush();
assert.equal(h.current().data, 'B');
```

Cover polling: old-key success/failure/finally while replacement pending and after it settles; old error reset on key change; same-key overlapping manual/interval requests newest-request wins; fetcher updated without key change; interval change/unmount rejects pending result; no post-unmount setters or active timer. Data remains during same-key refresh/failure and current valid success clears error.

Cover Files with actual callbacks: A then B, B resolves then A; A rejection cannot clear B content/error/loading; navigation while a read is pending; A → B → A cannot accept first A; clearing old content before new selection; unmount; unsaved confirmation accept/cancel retains intended action; context-menu Edit and new-file edit initialize from accepted content without stale timeout; save readback for A cannot replace B or end B's draft; rename/delete completions cannot retarget/clear a replacement; new-file completion cannot steal a newer selection. Preserve successful current-owner save/rename/delete/create flows. Validate absence of unexpected writes/retries using fake API call counts and captured paths; no actual filesystem mutations.

- [ ] **Step 2: Run causal RED.** Run `node --import tsx --test tests/use-polling.test.ts tests/files-selection.test.ts` with output redirected to this task's private workspace. Inspect failures: a stale response must change actual source state incorrectly; missing test fixture/helper or syntax failures are not causal RED. Preserve the original failing capture.

- [ ] **Step 3: Apply minimal generations.** Keep request/selection refs; at request creation capture lifecycle and monotonic request/selection identity. Only an active exact owner may commit success/error/finally. Increment/invalidate on replacement/cleanup synchronously with the relevant UI action. For polling retain current fetcher behavior and stable refresh; ensure a replaced lifecycle cannot borrow the next lifecycle. For Files cover every setFileData/selectedFile/edit continuation after an await, not only handleSelectFile. Clear obsolete data on new selection. Replace context/new-file delayed edit with an explicit edit intent initialized from the accepted read. Preserve already submitted writes against captured paths, no retries and all existing confirmations/tools. If a small helper is needed, prefer local code in the mapped page rather than exporting implementation for tests.

- [ ] **Step 4: Verify GREEN and build.** Run the same focused command, then `node --import tsx --test tests/use-websocket.test.ts tests/agent-model-save.test.ts` as the two adjacent lifecycle/save regressions. Run `npx tsc --noEmit` and `npm run build`. Redirect complete bounded command logs to the private task workspace and retain exit codes; inspect all original results. Do not run npm test, native/OS/browser suites, provider calls or live actions. Required TypeScript build is in the writer, never the live checkout.

- [ ] **Step 5: Self-review and report; Root delivery.** Review the complete diff against every requirement. Write the task report with exact source file hashes, RED/GREEN/build commands and exit codes, test counts, preserved behavior and limits. Do not stage/commit/push/merge or launch any subagents. Root will inspect original logs, commit scoped changes and dispatch independent task and final reviews. Do not claim live rollout or full system completion.

## Root execution and delivery

Read-only preflight: reconcile current handoff and sole writer, existing services and source status. BASE is 56a90b529330d2022cd8a523ce9d77dc1e1c34c8; new branch fix/files-selection-races-20261027. One task combines the two causal selection layers so no intermediate hook-only delivery is misrepresented as the Files fix. Root preserves all canceled private workspace/evidence. After actual focused/build results and reviews, use scoped PR delivery and only separately qualified ordinary rollout; source delivery alone is not live activation. Update canonical handoff at verified boundary.
