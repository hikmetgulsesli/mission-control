# Passive View Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task. Root alone stages/commits/delivers after independent task review.

**Goal:** Separate passive UI reads from provider retrieval and unrelated activity/lifecycle effects while preserving all operator tools.

**Architecture:** Keep ordinary read projections and intentional synchronization. Move Design artifact retrieval to an explicit POST and independent client lifecycle; remove only false task timestamps and V3-to-legacy trigger coupling.

**Tech Stack:** Existing TypeScript, Express5, React19, Node test/tsx, source-component port fixtures; no new dependency.

**Spec:** docs/superpowers/specs/2026-10-28-passive-view-effects-design.md

## Global Constraints

- All technical tools remain available; preserve Design, Overview access, tokens, screenshots, HTML links and every existing plan tab.
- No new dependency or broad refactor.
- No live DB/provider/browser/worker/service calls in implementation or tests; actual source at modeled ports only.
- Preserve selected-runtime, project/screen-ID, path, symlink, metadata and restricted-store guards.
- V3 scheduling/transfers and explicit legacy synchronization remain intact.
- Existing live services and all private runtime/qualification artifacts stay untouched; no generated runtime edits, secret/log/evidence commit, cleanup or guard bypass.
- Existing Node engine contract: ^22.18.0 || >=24.3.0.
- Root alone creates the branch and stages/commits/pushes/PRs/merges/rolls out. Implementers edit/test/report only and never spawn agents.
- Reuse the linked sole MC writer. No install or unchanged baseline-suite replay. No full225/21/private qualification replay.

## Task 1: Preserve task-specific activity timestamps

**Files:** Modify server/routes/tasks.ts; create tests/tasks-sync-activity.test.ts.

**Interfaces:** Existing GET /api/tasks and syncTasksWithStories remain; existing SQL/store/clock ports are modeled. No public interface change. Task2 does not consume this code.

- [ ] Write an actual-source sync/GET fixture using TypeScript AST extraction or the existing mocked-module pattern. Stub SQL as a data port that records statements and applies their row-level meaning to owned rows. No live route/server import side effects.
- [ ] Causal test: active run r1 has US-001 done; tasks include title Project Setup/status todo/old timestamp, unrelated in_progress/old timestamp and already matched in_progress without a status transition. After the real sync settles, only an actual status transition changes its own timestamp; unrelated/unchanged rows retain the old time.

```ts
assert.equal(rows.find(r => r.id === 'setup').status, 'done');
assert.notEqual(rows.find(r => r.id === 'setup').updated_at, oldTime);
assert.equal(rows.find(r => r.id === 'unrelated').updated_at, oldTime);
assert.equal(rows.find(r => r.id === 'unchanged').updated_at, oldTime);
```

- [ ] Check no active run/no stories,60s throttle, selected preprovision assertion/no CREATE, restricted GET skipping sync, and legacy schema behavior at actual source boundaries. The ordinary GET sync is background work: drain controlled promises before inspecting effects; do not require a newly synchronized row in the same concurrent GET response.
- [ ] Run `node --import tsx --test tests/tasks-sync-activity.test.ts`; record original semantic RED on the blanket timestamp behavior.
- [ ] Remove only `UPDATE public.tasks SET updated_at = now() WHERE status = 'in_progress'`. Keep actual status updates, story mapping and all existing store behavior.

```ts
// Retain the task-specific transition inside the existing loop.
if (newStatus) {
  await sql`UPDATE public.tasks SET status = ${newStatus}, updated_at = now() WHERE id = ${task.id}`;
}
// No unconditional timestamp UPDATE follows this loop.
```
- [ ] Run the same focused test; report exact command/results and diff hashes to task-1-report.md. Root creates the review packet and independently reviews spec/quality before committing.

## Task 2: Isolate V3 transitions from legacy lifecycle triggers

**Files:** Modify server/routes/setfarm-activity.ts; create tests/pipeline-transition-effects.test.ts.

**Interfaces:** Existing GET /api/setfarm/pipeline callback, cache key af-pipeline/TTL10000, seen-ID sets, saveSyncState, syncProjectsFromRuns({excludeV3:true}), createBuildingProject and isV3RunProtocol. No response/API change. Task3 shares this source file and runs only after Task2 review/commit.

- [ ] Build an actual GET/cache callback fixture with controlled previous/next run inventories, clock, cache and deferred effects. Stub SQL/FS/registry/deploy/DNS/transfer ports; no real child/network/source initialization. Keep actual trigger code.
- [ ] Causal cases: V3-only completion does zero legacy sync; V3-only start does zero legacy create. Legacy completion/start retain their original trigger; mixed changes trigger only eligible legacy work, once. First observation still honors existing seen-set initialization policy.

```ts
await observe(initialLegacyAndV3);
await expireCacheAndObserve(v3OnlyFinished);
assert.equal(legacySyncCalls, 0);
await expireCacheAndObserve(legacyAlsoFinished);
assert.equal(legacySyncCalls, 1);
```

- [ ] Cover cache hit, unchanged inventory, stale response/background refresh and sync-state writes without asserting all GET paths pure. Explicit POST sync and V3 scheduler/transfer boundaries must remain unchanged.
- [ ] Run `node --import tsx --test tests/pipeline-transition-effects.test.ts`; record semantic RED for V3-to-legacy trigger coupling.
- [ ] Gate legacy auto-sync/create detection to eligible non-V3 run transitions using the existing protocol classifier. Preserve UI collections/counts, all seen-set/cache persistence and intentional legacy behavior.

```ts
// Keep finishedIds/runningIds and their persisted seen-set meaning unchanged.
const newlyFinished = allRuns
  .filter((r: any) => finishedIds.has(r.id) && !isV3RunProtocol(r) && !lastSeenFinishedIds.has(r.id))
  .map((r: any) => r.id);
const newlyStarted = running.filter((r: any) => !isV3RunProtocol(r) && !lastSeenRunningIds.has(r.id));
```
- [ ] Re-run focused cases; report command/result/diff for independent task review. Root commits only after review.

## Task 3: Make Design GET local and retrieval explicit

**Files:** Modify server/routes/setfarm-activity.ts, tests/fresh-design-path-component-support.ts, tests/fresh-selected-design-cache-writers.test.ts; create tests/design-read-retrieve.test.ts if needed for focused contracts.

**Interfaces:** Keep GET /api/setfarm/runs/:id/design response compatibility for recorded design/local screens/tokens/URLs. Add POST /api/setfarm/runs/:id/design/retrieve returning that same response shape after existing guarded retrieval. Extend existing test activity fixture with designRetrieve while preserving design/create/sync and other existing fields. Task4 consumes these two endpoints.

- [ ] Actual route tests: GET for completed Design output with missing local cache invokes zero provider commands and creates/copies/writes no files; existing saved artifacts still resolve with guarded URLs. Test unusable/incomplete Design output without provider work.
- [ ] Test explicit POST performs existing population/list/download work at modeled provider/owned FS ports and returns local artifacts. Retain traversal, selected-root replacement/refusal and source/repository/metadata rechecks. Move the old GET-population expectation to POST; do not delete the safety cases.

```ts
await invoke(getDesign, completedRunWithMissingCache);
assert.deepEqual(providerCommands, []);
assert.deepEqual(cacheWrites, []);
await invoke(postRetrieveDesign, sameRun);
assert.ok(providerCommands.length > 0);
assert.ok(result.screens.every(hasGuardedLocalUrls));
```

- [ ] Run explicit changed test files with `node --import tsx --test tests/design-read-retrieve.test.ts tests/fresh-selected-design-cache-writers.test.ts` (omit a new file only if all contracts are in the existing file and record this File Map refinement before review). Record RED before source change.
- [ ] Split existing effectful retrieval from local projection with the smallest targeted helper extraction; no duplicated retrieval implementation or broad route-module rewrite. GET must never call provider/cache writers; POST alone owns those existing guarded effects. Keep errors explicit; no credential or access policy changes.
- [ ] Re-run focused route/path tests, report originals and exact changed interfaces for Task4. Root task review/commit precedes client work.

## Task 4: Separate Design client lifecycle and explicit action

**Files:** Modify src/components/pipeline/InlinePlanView.tsx, src/lib/api.ts, scripts/ui-regression-fixtures.mjs; create tests/inline-plan-design-lifecycle.test.ts.

**Interfaces:** Existing api.runDesign(runId) remains GET/local. Add api.retrieveRunDesign(runId) using POST /setfarm/runs/:id/design/retrieve and the existing authenticated API wrapper; resolve to the same response shape. No provider model generation or new credential flow. Preserve all existing InlinePlanView props/other API methods.

- [ ] Actual component lifecycle tests with repository-style React/API/timer boundary harness, not SSR alone: Contract mount and multiple3s ticks call neither Design endpoint; slow/rejected Design cannot block Contract rendering. Explicit Design selection starts local GET. The tab and Overview entry remain reachable before any screens exist; do not label an unknown count0.
- [ ] Also cover missing/rejected plan/contract data: early loading/story-fallback returns must not hide Design access. Keep story fallback content and all existing tabs available; selecting Design owns its independent read state.
- [ ] Add explicit retrieval tests: one user click→one POST; double click/pending/periodic ticks never duplicate POST. Read-error Retry is GET-only. Current run replacement and unmount fence late GET/POST and prevent old-run UI commits; shared fetch cleanup also invalidates its request sequence.

```ts
mountContract('run-a'); await tickSeveralIntervals();
assert.equal(designReads.length, 0); assert.equal(designRetrievals.length, 0);
selectDesign(); await settleLocalRead(); assert.equal(designReads.length, 1);
clickRetrieveTwice(); assert.equal(designRetrievals.length, 1);
replaceRun('run-b'); resolveOldRunRequests(); assert.ok(!renderedText().includes('old-screen'));
```

- [ ] Verify saved screens/tokens/HTML links, local empty, loading, read error, pending/retrieval error and recovery. Preserve technical tabs/Overview. Use existing button/layout styles; no new dependency or visual redesign. Fake API/timers/owned fixture files only, no provider or operational browser invocation.
- [ ] Run `node --import tsx --test tests/inline-plan-design-lifecycle.test.ts` and record causal REDs before implementing the action/lifecycle split.
- [ ] Remove Design from shared Promise.all; add its separately owned selected-tab read lifecycle, explicit busy/deduplicated retrieve handler and always reachable view. Keep accepted data truthfully scoped to the run; clear errors on valid recovery.
- [ ] Update api method and UI fixture to the actual local Design response shape. Re-run focused lifecycle plus related existing polling/component/path suites selected by changed imports. Report exact test scope/limits and file hashes for review; Root commits after independent review.

## Task 5: Validate and deliver the complete source change

**Files:** Update CHANGELOG.md Unreleased entry if this repository's current format requires it; no version/dependency/runtime changes. Private reports/ledger live only under this plan workspace and are never staged.

- [ ] Run combined new/affected focused tests once after integration, plus frontend TypeScript and `npm run build` at a clean Root commit. Preserve actual output/exit and build identity; no broad private worker campaign or live provider test.
- [ ] Whole-branch independent review from original base370376 to final HEAD, including all task reports, spec, ledger rulings and exact original results. Review must cover spec compliance and quality; fix only evidenced findings and recheck affected scope.
- [ ] Root push scoped branch, create/update reviewed PR, inspect GitHub comments/checks, merge only the exact reviewed head under existing bounded authority. Sync clean canonical main and sole writer without overwriting private files.
- [ ] Source delivery does not claim live deployment. Any future current29181→new-build transition needs a separate concrete Root-owned guarded plan/current gates; preserve original startup refusals and existing live qualification artifacts. Never infer full8/annual/overall completion.
