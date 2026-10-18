# Operator functional correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct confirmed operator defects without changing workflow authority.

**Architecture:** Narrow behavioral boundaries reuse existing canonical contracts. Tests invoke actual exported behavior, Express routes or React components; no regex substitutes for behavior. Root serializes source writes and owns delivery.

**Tech Stack:** Existing TypeScript, node:test/tsx, Express, React/Zustand; physical Node 26.4.0.

**Spec:** `docs/superpowers/specs/2026-10-19-operator-workspace-design.md`

## Global Constraints

- Root alone stages, commits, pushes and delivers. Only one implementation worker at a time.
- No provider calls, live state mutation or service restart for unit/UI fixtures.
- Preserve failed/cancelled records, all runtime/secret/admission guards and current DB authority.
- Unknown is explicit, not numeric zero. HTTP health, six preflight passes and partial tests never mean full8 GO.
- Read the spec and the matching A/B section of `/Users/setrox/ai/setrox/logs/2026-10-19-ui-implementation/mc-upgrade-plan-input.md` before implementation.
- Run source checks/build in the isolated writer only; Root checkpoints and independently reviews each task before the next.

---

### Task 1: Supported Stitch caller

**Files:** Modify `server/services/stitch-integration.ts`; create `server/services/stitch-integration-model.test.ts` (or behavioral extension to `tests/fresh-stitch-provider-screen-id.test.ts`).

**Interfaces:** Consumes actual `generateScreen(projectId,prompt,title,device='DESKTOP')`; produces identical API with exact `GEMINI_3_8_FLASH` argv model. Other tasks do not consume a new function.

- [ ] Add a failing captured-exec behavioral test of the actual callable. Use existing AST-isolated fixture only if importing safely is impossible. Assert command, exact model and returned accepted screen ID; rejection must remain failure.

```ts
assert.equal(argv[argv.indexOf('generate-screen-safe') + 5], 'GEMINI_3_8_FLASH');
assert.equal(result.screenId, acceptedProviderScreenId);
```

- [ ] Run `node --import tsx --test server/services/stitch-integration-model.test.ts` (use actual selected test path). Capture retired-model RED.
- [ ] Replace only obsolete MC pin with `GEMINI_3_8_FLASH`; preserve selected fresh fences, device, IDs, rejection semantics and credentials. This matches the dated live schema in `logs/2026-10-18-fresh-install-headless-review-v1/stitch-live-metadata-readonly-v1-summary.original.json` under workspace root.
- [ ] Run focused test plus `node --import tsx --test tests/fresh-stitch-provider-screen-id.test.ts`; report exact commands/output. Root commits `fix(stitch): use supported generation model`.

### Task 2: Explicit PRD initialization and active restore

**Files:** Create `src/lib/prd-initialization.ts`, `tests/prd-initialization.test.ts`; modify `src/pages/PrdGenerator.tsx`, `src/store/prdStore.ts`, and `src/pages/Scrape.tsx` only if needed.

**Interfaces:** Consumes `api.prdHistory()`, array-returning `api.setfarmPipeline()`, canonical `isOperationalActiveRunStatusV1` predicate (use its actual exported name), and existing store reset/setState. Produces `parsePrdCloneIntent(search: string): {title:string;description:string}|null` and `findSavedActivePrdRun(rows:unknown, savedRunId:string): string|null`; page owns one-time intent and asynchronous-generation guard.

- [ ] Write parser/real store behavior tests: clone with empty/encoded/text content, exact saved active run, unrelated/terminal/malformed rows; capture RED. Include asynchronous arbitration through an exported small initializer controller if needed, never an unused mirror helper.

```ts
assert.deepEqual(parsePrdCloneIntent('?title=A101&description=clone'), {title:'A101', description:'clone'});
assert.equal(findSavedActivePrdRun([{id:'other',status:'running'}], 'saved'), null);
```

- [ ] Run `node --import tsx --test tests/prd-initialization.test.ts` and preserve RED.
- [ ] Adopt explicit query once on navigation; reset stale ID/content/run/screens, then set title/description. Explicit clone wins skip-autoload and late history. Guard history/restore against edits, resets, new navigation and unmount. Plain `/prd` history still loads. Use exact saved row and authoritative active predicate; no latest unrelated run.
- [ ] Run focused and `tests/active-run-selection.test.ts`. Add browser assertions to the later fixture plan for actual A101 click, delayed history and edit retention. Root commits `fix(prd): preserve explicit clone and run intent`.

### Task 3: Truthful Rules capabilities and HTTP failures

**Files:** Modify `server/routes/rules.ts`, `src/pages/Rules.tsx`; create `src/lib/rules-api.ts`, `server/routes/rules.test.ts`, `tests/rules-api.test.ts`.

**Interfaces:** Preserve existing `/api/rules*` paths and array GET. Add GET `/api/rules/capabilities` returning spec `RuleCapabilities`. Export a route factory with injected upstream fetch/capability selection for actual ephemeral HTTP tests if needed; default export preserves application mount.

- [ ] Write actual fake-upstream HTTP tests for JSON503, bounded non-JSON response, timeout and successful GET; fresh unsupported writes must return503 with zero upstream-write calls. Client helper tests prove non-2xx rejects with real status/message.

```ts
assert.equal(response.status, 503);
assert.equal(upstreamWrites, 0); // selected fresh unsupported capability
```

- [ ] Run `node --import tsx --test server/routes/rules.test.ts tests/rules-api.test.ts` and record failures.
- [ ] Preserve upstream status, safe bounded errors, successful exports and existing query filters. Keep USE_PG=false; no enabling legacy writes. UI distinguishes GET failure/empty, respects capabilities, keeps draft/confirmation on failed save/delete/import/toggle, closes/refetches only on success.
- [ ] Run focused tests. Later browser fixture proves503 retains filled form and cancellation. Root commits `fix(rules): preserve capability and error truth`.

### Task 4: Working-volume metrics and loaded identity

**Files:** Modify `server/utils/{disk-health,prometheus}.ts`, `server/routes/{system,changelog,changelog-page}.ts`, health in `server/app.ts`, `src/lib/types.ts`, `src/components/{StatusBar,SystemMetrics}.tsx`; create `server/services/mission-control-identity.ts` and matching tests; extend `server/utils/disk-health.test.ts`; create `server/utils/prometheus.test.ts`, `server/routes/system.test.ts`, `server/routes/changelog.test.ts`, `tests/system-status-render.test.tsx`. The standalone changelog page repeats the same ambient-project fallback and labels checkout identity as build, so it shares this root fix. Consumer census found only StatusBar/SystemMetricsPanel do metric arithmetic; Ops/api/store carry the type without arithmetic.

**Interfaces:** `readWorkingVolumeObservation(): Promise<WorkingVolume>` (spec shape); existing `readWorkingVolumeDiskHealth()` derives from it and shares only pending observation. Preserve nullable legacy system fields and add provenance. `readMissionControlIdentity` resolves MC package relative to source module and separates loaded build from checkout; use existing internal build-identity reader for loaded authority.

- [ ] Write actual probe tests: df root5/data95 -> health and system95; parse/fetch failnull; valid measured0 preserved; concurrent pending shares then refreshes. Temp identity roots prove MC/SF separate and missing/checkout-ahead explicit. Actual SSR renders unknown and RAM semantics.

```ts
assert.equal(observation.percent, 95);
assert.equal(unknown.diskPercent, null);
assert.match(html, /kullanılan|used/i); // total minus os.freemem, not pressure
```

- [ ] Run explicit focused `.test.ts` and `.tsx` paths, record RED.
- [ ] Implement structured df observation using actual service cwd and df capacity field; unknown on malformed/missing. Prometheus empty is unknown; local CPU requires valid sampled delta or unknown. RAM source/node:os is labelled allocated-used, not macOS pressure. Update all nullable consumers atomically. Changelog actual MC root for source and dist-server; explicit permitted override only, no loaded identity invention.
- [ ] Run covering tests and `npm run build` only in isolated writer after Root clean commit if build identity requires it. Root commits `fix(system): show observed metrics and identity`.

### Task 5: Shared agent identity and honest empty usage

**Files:** Modify `server/shared/agents.ts`, `src/lib/constants.ts`, `server/routes/{agents,performance}.ts`, `src/pages/{Agents,Chat,Costs,Performance}.tsx`, `src/components/AgentCard.tsx`; create `server/services/agent-identity.ts`, its tests and `tests/performance-empty-render.test.tsx`.

**Interfaces:** Existing safe static roster is shared/re-exported, all14agents retained. `resolveAgentModelIdentity` returns spec `ModelIdentity` with raw IDs and provenance; agents/performance consume the same resolver. Preserve existing arrays/fields compatibly; add source/status metadata rather than converting missing costs to real0.

- [ ] Write tests for all14ids/labels, observed vs configured vs static vs unknown, unknown session agent discoverability and selected fresh no ambient homedir reads. Actual Performance SSR empty trend and unavailable costs must be explicit.

```ts
assert.equal(resolveAgentModelIdentity({observedModel:'provider/model'}).rawModelId, 'provider/model');
assert.equal(resolveAgentModelIdentity({}).provenance, 'unknown');
assert.match(rendered, /Henüz veri yok/);
```

- [ ] Run actual selected tests and capture RED.
- [ ] Share metadata without client secret/config imports. Distinguish configured from observed models. Remove placeholder weekly trend promises/fake series. Preserve editing/chat/activity/live actions and true measured zero.
- [ ] Run focused tests and build/type checks. Root commits `fix(agents): expose shared identity provenance` and obtains whole-plan review before integration.

### Task 6: Exact cron identity for reversible toggles

**Files:** Modify `server/routes/cron.ts`; create `server/routes/cron.test.ts`. Preserve current Ops error/toast behavior unless an actual regression requires its narrow change.

**Interfaces:** Existing GET `/api/cron` and POST `/api/cron/:id/toggle` retained. Route passes the validated selected job UUID to the existing bounded CLI adapter; job names remain display text. A small injected route factory permits actual Express tests without gateway/config/CLI side effects.

**Causal evidence:** During approved cleanup Root independently verified three actual jobs with the same `test/agent` name and distinct UUIDs; `openclaw cron disable --help` requires `<id>`, while current route sends `job.name`. These are literal old test fixtures matching Setfarm `tests/gateway-api-model.test.ts`. Root disabled exactly those three through their IDs and preserved all records/other five jobs, receipt `/Users/setrox/ai/setrox/logs/2026-10-19-ui-implementation/gateway-cron-disable-receipt.original.json`. Do not repeat live cleanup or create a job in this task.

- [ ] Add actual HTTP/fake CLI tests: duplicate names with distinct IDs, enabled and disabled cases, unknown/invalid ID, CLI refusal. Capture RED where selected job name is sent instead of its ID.

```ts
assert.deepEqual(calls[0], ['openclaw', ['cron', 'disable', selectedId]]);
assert.equal(calls.length, 1);
assert.equal(unknownResponse.status, 404);
```

- [ ] Run `node --import tsx --test server/routes/cron.test.ts`; preserve RED.
- [ ] Pass only the matched job ID to enable/disable. Validate current job record and safe bounded input, preserve existing selected CLI/runtime fence and cache invalidation; CLI failure cannot return success or flip displayed state. Never toggle all same-name jobs, write jobs.json directly or enable a missing job.
- [ ] Run focused test, include failure/success in later browser fixture, and Root commits `fix(cron): toggle the exact selected job` before final whole-plan review.
