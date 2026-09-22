# Idle V3 Transfer State Implementation Plan

> **For agentic workers:** Root is the sole writer; reviewers are read-only. Execute this plan task-by-task with a RED/GREEN cycle.

**Goal:** Stop Mission Control's empty scheduler tick from invalidating Setfarm's held host-absence proof while preserving all transfer recovery writes.

**Architecture:** Keep the existing two DB pages and cursor-wrap logic. At the single scheduler persistence boundary, omit `save` only for loaded `null`/`null` cursors and two empty pages; all non-idle branches retain save-before-effects. No File store, Setfarm observer, or runtime guard changes.

**Tech Stack:** TypeScript, `node:test`, Mission Control Express service, PostgreSQL-backed candidate source.

**Spec:** `docs/superpowers/specs/2026-09-22-idle-v3-transfer-state-design.md`

## Global Constraints

- Keep Mission Control on `127.0.0.1:3080`; do not restart until reviewed clean-main build.
- Never suppress a cursor reset, ACK audit page, or selected-work persistence.
- Keep Setfarm's same-inode/sibling/ABA absence guard intact.
- Use an isolated branch and PR; root is the sole writer.

## Causal scope and file map

The clean Setfarm cutover host observation refused twice at postqualification because the MC scheduler rewrote its empty state under the pinned `.openclaw/setfarm` parent during the hold. This is a systemic root cause for the same cutover objective, not a new feature.

- Modify `server/services/v3-project-transfer-scheduler.ts`: exact no-op branch around `stateStore.save`.
- Modify `server/services/v3-project-transfer-scheduler.test.ts`: observable save/query/effect behavior with real scheduler function and in-memory state store.
- No changes to `server/index.ts`, state-file format, Setfarm, or runtime configuration.

### Task 1: Preserve the empty state without writing

**Files:** Modify the two scheduler files above.

**Interfaces:** `runIncrementalV3ProjectTransfers(input)` keeps its existing input and result types. `V3ProjectTransferSchedulerStateStore.save(state)` remains unchanged.

- [x] Write a RED test with loaded `null`/`null` cursors and empty pending/audit sources. A recording state store must observe zero saves across two ticks, both sources must each be queried twice, and no run may be processed. The current unconditional save failed the zero-save assertion (`2 !== 0`).
- [x] Run `node --import tsx --test server/services/v3-project-transfer-scheduler.test.ts` and confirm the new test fails for the expected save count, not setup.
- [x] Implement only an exact guard: `const idle = state.pendingCursor === null && state.acknowledgedAuditCursor === null && pendingPage.rows.length === 0 && auditPage.rows.length === 0; if (!idle) input.stateStore.save({...});`. Leave `await mapBounded(...)` after it.
- [x] Rerun the target test and confirm GREEN.
- [x] Add boundary tests using the same real scheduler: a later pending row after an idle tick saves before `processRun`; a non-null exhausted cursor saves its reset to `null`; an ACK page with an exact project still saves despite zero reconciliation; a throwing `save` prevents `processRun`. Each mutation (dropping the save, broadening the no-op, or moving save after effects) is covered by an observable assertion.
- [x] Run the target tests (8/8), `npm test` (225 pass, 5 skip), `npm run build` (exit 0), `git diff --check`, and inspect the exact diff.
- [ ] Request independent read-only review, then conventional commit, push, PR, exact-head checks/review, and SHA-conditioned merge.
- [ ] Build clean `main`, restart MC LaunchAgent only after build, verify 3080 health and a stable empty scheduler-state parent across at least two 30-second ticks. Attempt Setfarm held host observation separately and report any refusal exactly.
