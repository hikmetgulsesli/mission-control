# Controls Worker Runtime Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make actual selected manual checks receive their configured runtime inputs, so an enabled live installation does not produce a false `V3_PROTOCOL_DISABLED` report.

**Architecture:** Keep the fixed broker, original child, selected Source, IPC and custody admission unchanged. Construct a closed SF-worker environment immediately after the final awaited selection check and immediately before spawn; UI workers retain their stripped environment. Full8 may receive the already loaded MC authentication token only under the explicit evaluator name and fixed local MC endpoint.

**Tech Stack:** TypeScript ESM, Node test runner, existing real broker/owned child tests.

**Spec:** Existing `docs/superpowers/specs/2026-10-19-controls-manual-tests-design.md`; actual causal proposal `/Users/setrox/ai/setrox/.worktrees/setfarm-dashboard-cutover-controller-20261007-v1/.superpowers/sdd/2026-10-19-controls-producer/i4-controls-worker-environment-causal-proposal-v1.md` (SHA256 `162aaacb75f7e233171f7e58523688213e8abff3cfdb2f06b7339c48db070b4a`).

## Global Constraints

- Only the existing MC writer changes Source. Root alone commits, pushes, merges and performs runtime effects.
- Keep SF Source `83ccbbb819134408fed4f24849440b3a43c6654a` and installation `4a8468f9-a2d3-4036-b06c-b61c1d319ca7` unchanged.
- No public schema, worker argv, IPC, intent, custody, Source admission, SQL permission, timeout, cleanup or retry changes.
- No spread of `process.env`, PG/admin/provider secrets, loader/internal-production variables or generic `AUTH_TOKEN` into a worker.
- Preserve absent/disabled activation; never synthesize `enabled`.
- Fixed local endpoints remain `http://127.0.0.1:3080` and `http://127.0.0.1:3333`; never send MC auth to a caller-supplied endpoint.
- UI worker selection/profile/auth environment stays stripped.
- No real providers, live SQL, live service actions or private credential payload reads in tests.
- Preserve the historical failed activation report. A closed job does not establish a passing report.

## File Map

- Modify `server/services/control-jobs.ts`: closed worker environment at the existing fixed transport spawn.
- Modify `server/services/control-jobs.test.ts`: actual broker/owned-child regression and exclusion tests.
- This plan records the causal scope and delivery limits. No unrelated UI or SF changes.

### Task 1: Preserve the configured SF worker profile

**Interfaces:** Existing `createFixedManualWorkerPortV1(selected, executable?)` and all public types remain unchanged. Any builder stays private to this module. Tests use the existing real transport seam, not a replacement worker port.

- [x] **Step 1: RED against actual child behavior.** Extend the existing real-child test seam near line212. A temporary owned child reports bounded dummy predicates over IPC, then exits normally. Assert `process.env.SETFARM_V3_ACTIVATION === 'enabled'` in an activation child and exact codex/model/selected-runtime-directory predicates in a full8 child. Assert actual original exit and close, restoring env/module mocks only after settlement. Name each removed production assignment that would break its assertion.
- [x] **Step 2: Retain original failing capture.** Run `node --import tsx --test server/services/control-jobs.test.ts`; failure must be the actual missing runtime value, not a setup exception. Do not implement until that failure is observed. No broad protected SF test suites.
- [x] **Step 3: Minimal GREEN.** Preserve common fixed environment and HOME/TMPDIR/USER behavior. For SF workers derive installation/repository and `SETFARM_ENV_DIR = path.join(selected.installationDir, 'runtime')`; reject a conflicting explicit ENV_DIR. Carry only explicit absent/enabled/disabled activation. Full8 also requires codex and the same bounded model grammar as SF's existing selected profile, plus the two fixed local endpoint values. Reject invalid values without logging them. No speculative CODEX_CLI or SETFARM_PROTOCOL forwarding: those are owned elsewhere or already explicit in invocation.

  For full8 only, obtain the existing loaded MC config through the fixed lazy `import('../config.js')` before the final selection await; read `config.authToken` synchronously when building the final environment. Put a nonempty existing token only into `MC_AUTH_TOKEN`; never copy generic `AUTH_TOKEN`. Use only dummy config in tests. If module mocking requires a Node test-only flag, document the exact invocation; never add a production override.

  Avoid a capture/recheck framework: after all asynchronous operations, build and validate the final environment and call the original spawn synchronously. This removes the extra configuration-await window rather than adding a new public protocol or timing hook.

- [x] **Step 4: Verify boundaries.** Test enabled, absent and disabled activation; full8 profile/endpoints/auth predicates; mismatched selected path and foreign endpoint refusal; prohibited dummy PG/provider/loader/internal/arbitrary-secret exclusion; UI branch exclusion. Actual drift during the final await must use the current valid inputs or reject invalid inputs before spawn. Tokens must never appear in stdout, stderr or recorded projections.
- [ ] **Step 5: Focused verification and report.** Run the whole changed test file and adjacent existing Controls tests; run server TypeScript checking and `git diff --check`. Report exact original commands, exit codes/counts, source hashes and remaining limits. Root reviews the diff, commits on the scoped branch, builds clean Source, obtains independent review, and delivers through a PR.

## Delivery and actual verification

Root performs a new stock MC build and guarded MC-only transition while retaining the acknowledged SF83/I4 installation and its approved private Stitch binding. Then create a new actual activation job and inspect its stored report as well as original worker settlement. Continue actual live-page screenshots and unchanged full8 only after current profile/provider/resource admission. Existing unchanged SF17, owned Task4 and UI checks retain their precise historical scope; do not call them rerun on the new MC build.

## Progress / decisions

- Ruling: This is a causally required MC root fix for the approved technical-controls objective, not a new SF installation or unrelated feature. Cost if wrong: revert the scoped MC change and retain the actual failed report.
- Ruling: The explicit MC-token handoff stays within the existing local broker/evaluator and the same MC endpoint; it creates no persistent credential or new account/destination. Current live MC general authentication is unconfigured, so no authenticated-API success is inferred. Cost if wrong: full8 refuses; no alternate endpoint or credential fallback is permitted.
- Ruling: Parent inputs are read after the last await, synchronously before original spawn. No additional configuration snapshot framework is needed. Cost if wrong: focused transport tests and independent review must expose the gap before delivery.

- Task 1: implementation and independent task review complete, C0/I0/M1. Root original PID7038 exit0 in5.104s,37 outer tests plus19 isolated full8 checks; exact source pins unchanged.
- Task 1: minor (deferred): documented Node test-only ExperimentalWarning retained. It is not a failed assertion or production warning; suppression is unnecessary. Final whole-branch review must triage it.
- Task 1: clean stock build, whole-branch review, PR delivery and live report verification remain pending.
