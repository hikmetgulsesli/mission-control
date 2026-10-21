# Controls current-evidence Implementation Plan

> **For agentic workers:** One coherent task with serialized source edits. Root executes the TDD cycle and actual commands; independent agents review the task. No parallel production writers.

**Goal:** Let an operator explicitly return from a remembered historical/missing job to current evidence.

**Architecture:** Reuse the page's existing selection handler and selected-read owner with a null ID. Widen the session browsing-choice type; preserve its existing version fence, pending request identity and launch/cancel contracts.

**Tech Stack:** React, TypeScript, Node test runner and tsx; stock Node22 build, Node26 live runtime.

**Spec:** `docs/superpowers/specs/2026-10-21-controls-current-evidence-design.md`

## Global Constraints

- One sole MC writer; existing isolated worktree, PR branch `fix/controls-current-evidence-20261021`, base d5f58ace.
- Preserve all backend/credential/runtime/native/browser guards and every technical tool.
- No automatic selected/global fallback, pending clear, new request key, POST or cancellation on view change.
- No build in a live release or the old fixture worktree. No wildcard tests.
- Final selected 317, activation preflight and full8 remain separate unrun gates.

## Task 1: Explicit current view and fenced browsing selection

**Files:** The two production files, three focused tests and spec listed in the File Map.

**Interface:** `ControlJobSessionV1.chooseJob(jobId: string | null): void`; page-local `chooseJob(id: string | null)` continues to set the epoch/ref/read owner/persisted browsing choice. `ControlSelectedEvidenceV1.select(null)` remains unchanged.

- [x] Run the unchanged focused baseline using physical Node26, `--import tsx --test tests/control-job-session.test.ts tests/control-selected-evidence.test.ts tests/controls-render.test.tsx`.
- [x] Add actual-page SSR coverage using a temporary `window.localStorage` containing `mission-control.controls.selected-job.v1` and an old valid UUID. Restore the original window descriptor in `finally`. Assert the real button text in the selected view and absence in the default view. No fetch, effect or browser claim.
- [x] Add a deferred session case for explicit null choice, late POST, exact pending identity and zero extra requests. Reuse the existing selected-owner null/late-read/error cases and keep historical/ref/epoch tests intact; do not duplicate unchanged owner logic.
- [x] Run the exact focused command before production edits. Require the selected-view action assertion to fail for missing UI; preserve other passes and the actual exit. A loader/setup failure is not RED.
- [x] Widen the session and page handler types to `string | null`. Add a conditional `type="button"` action calling `chooseJob(null)` beside Refresh, using the existing `controls__actions` and `controls__secondary` classes. No new callback/helper, data fetch, storage scope or mutation API is needed.
- [x] Run the focused command on physical Node26 and Node22; require all assertions pass.
- [ ] Review full diff against the spec and run stock `npm run build` using Node22 in a nonlive admitted build location.
- [ ] Obtain independent specification/quality review, fix concrete findings, and reverify only changed concerns. Root stages/commits/pushes the scoped branch, delivers through reviewed normal PR/main, and qualifies the immutable main stock build before any current-state rollout.
- [ ] Root admits the smallest MC-only rollout from actual current state; never reuse old nomination/PIDs or bypass original/material/native guards. After actual original closure, use the browser to click the new action, reload and confirm current scope, truthful availability and unchanged job count. Then continue remaining UI audit and final selected test gates.

## Root rulings and self-review

The session signature is deliberately added to the old selected-evidence File Map: it is causally necessary to expose the existing null-view fence through typed UI code. This is a scope refinement under the user-approved UI correction objective; no launch authority changes. The single task owns all shared interfaces, so no independent implementation sequence can race it. No task contradicts the spec's GET-only view transition or pending identity constraints. The plan has no missing API, placeholder or dependency.

Root test refinement: existing `tests/control-selected-evidence.test.ts` already covers null invalidation, delayed reads, missing/invalid bounded errors and inert construction. Keep it unchanged and run it as regression coverage. The new session case and real-page SSR action assertions cover the added integration; no duplicated owner test or new test harness is required.

## Review fix round 1: preserve shared errors

- [x] Add the actual-page error-preservation case to the existing gated source-browser file, using exact held503 global response consumption, the real return button and real React state. Extend only its scenario name/profile and narrow causal RED predicate for an observed missing shared alert; all uncertainty/cleanup guards stay intact.
- [x] Root freezes/reviews the complete existing19-file source graph and unchanged owned profile/lifecycle/protocol pins, admits one private native/browser test under its original Node22 handle, and records the genuine missing-alert RED with fully settled cleanup. No real3080/provider/job request is permitted.
- [x] Change the page handler's shared clear to `if (id !== null) setError(null)`. This keeps unrelated global/launch/cancel errors truthful on return; selected owner null reset already handles its own error.
- [x] Run the same exact native case to GREEN, then rerun the54 inert regressions on Node26/22. Preserve every RED/UNKNOWN/cache/artifact; no weakening, retry loop or deletion.
- [ ] Obtain scoped independent re-review before delivery.

## Verified source-test checkpoint (2026-10-21 UTC)

- Initial focused baseline: 51 pass. The actual-page SSR return-action assertion then failed as expected; the initial implementation passed all54 focused tests on both runtimes.
- Review I1 browser attempt v2 stopped before native acquisition because its relative script argv did not match the existing exact original-command guard. Preserve it as setup failure, never causal RED. Capture v3 changes only the unique output namespace and absolute test argument; independent static review C0/I0/M0.
- Genuine I1 RED: direct physical Node22 PID5264 exited1 with the expected missing shared-error alert. The private browser5294 exited0 without signal, both empty native censuses and all3 original socket peer-end/error-free closures qualified before Vite close.
- I1 GREEN after the single conditional shared-error clear: direct Node22 PID6599 exited0; one test pass, no skip. Private browser6606 exited0, both empty censuses and both original socket peer-end/error-free closures qualified. The exact held503 body was consumed; current view cleared the browsing key while preserving pending bytes and creating no API request.
- Post-fix focused regressions: Node26 PID6945 and Node22 PID6944 each exited0,54 pass/0 fail/0 skipped. Every Root capture observed actual original stdout/stderr EOF without signals or forced timeout.

Original captures, source freezes, native artifacts and Root qualifications are retained under the parent workspace `logs/2026-10-21-controls-current-evidence-v1/` and the exact private artifact roots named there. No test cache or prior record was deleted. This checkpoint does not claim a stock build, reviewed PR, rollout, live button QA, final selected317, activation preflight, full8 or overall GO.
