# Canonical quarantine stop implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development for this single task. Root owns Git delivery and runtime effects.

**Goal:** Make MC honor the existing canonical, snapshot-fenced quarantine stop.

**Architecture:** Thread the requested action into fresh snapshot validation and
use a small pure helper shared by the UI action evaluator to make its invariant check action-specific only for the exact existing canonical
quarantine-recovery stop. Keep remaining validation and CLI dispatch unchanged.

**Tech Stack:** TypeScript ESM and Node test runner; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-13-canonical-quarantine-stop-design.md`.

## Global Constraints

- Existing sole MC writer only; source base70b8a72d722008fff9a131ef313ed5281d34f2e8.
- Root alone delivers or changes services. Workers do not stage/commit or spawn.
- Hash, freshness, complete projection/capabilities and all unrelated invariant checks remain enforced; no success/resume/repair authority is added.
- No generated-project edit, Q row mutation, guard/cap/timer relaxation or secrets.
- Preserve all evidence and npm cache; never delete this workspace.

## Task 1: Honor canonical quarantine-recovery stop

**Files:** modify `server/services/run-operational-authority.ts` and
`server/services/run-operational-authority.test.ts`, `src/lib/operational-snapshot.ts`,
`tests/operational-snapshot-authority.test.ts`; create only
`server/shared/canonical-quarantine-stop.ts`.

- [ ] Read both existing server/UI evaluators, their fixtures and source Setfarm stop invariant
  policy. Keep the public evaluator API unchanged. The private validation input
  may receive the requested action.
- [ ] Add `allows canonical quarantine-recovery stop` with a complete fresh v3
  snapshot and exact hash. Add the two real quarantine invariant classes, error
  severities, count2 and lifecycle inconsistent; project stop allowed with exact
  reason `RUN_CAN_BE_STOPPED_WITH_QUARANTINE_RECOVERY`. Assert authorized.
- [ ] Add the corresponding real UI evaluator regression using its existing fixture,
  proving that canonical Stop becomes enabled and retains its snapshot hash.
- [ ] Run targeted RED before any production edit:
  `node --import tsx --test --test-name-pattern='allows canonical quarantine-recovery stop' server/services/run-operational-authority.test.ts`.
  Also run the UI regression by its targeted test name. Expected actual failure is blocked `OPERATIONAL_INVARIANT_VIOLATION` versus
  authorized, not setup/import failure.
- [ ] Add focused controls using existing fixture/helpers: same quarantine
  snapshot resume remains blocked; extra unrelated invariant remains blocked;
  quarantine with ordinary stop reason remains blocked; projected stop denied
  remains blocked; stale/hash-changed/partial versions of the permitted Q case
  retain their existing failure codes. Require nonempty recognized invariants
  for the special allowance. Keep existing invariant-free stop behavior intact.
- [ ] Implement one pure structural helper in `server/shared` (existing frontend
  import convention), used by both evaluators, with no new dependency or config.
  The condition is: only action stop, canonical allowed
  flag true, exact quarantine-recovery reason, nonempty invariants exclusively
  from the two existing classes may pass this invariant precheck. Do not skip
  any earlier hash/time/run/projection guard or change CLI arguments.
- [ ] Run GREEN for the server and UI authority test files and any existing focused
  operational-action CLI-argument test file (locate with rg). No full suite.
- [ ] Self-review, freeze exact changed source/test hashes and original command,
  PID, exit and log hashes; write task report. Root makes the required clean
  stock build after reviewed merge, so do not repeat a worktree build.

## Root follow-up

Independent task and whole-branch reviews, scoped PR and normal merge; one clean
stock build and maintained MC-only rollout. Preserve the original definite409
receipt; prepare/review a new one-POST actor only after the changed source is
actually loaded. Then continue normal source1f rollout and one clean real run.
