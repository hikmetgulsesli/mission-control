# Controls selected-job reports implementation plan

Spec: docs/superpowers/specs/2026-10-20-controls-selected-evidence-design.md.
Use subagent-driven-development; each new task has a fresh non-delivery worker. Root alone owns Git/native/build/delivery/live work. Task0 contract/FileMap preflight is Root-complete; follow Tasks1–4 below. Design is binding if draft wording conflicts. The proposed exact method/owner interface and file names are now accepted, subject to Root recorded causal refinements. Product code remains unchanged until Root qualifies genuine Task1 causal RED. Inert injected tests are builder-authorized; actual browser execution is Root-only. No build in writer or live release.

Shared interface preflight: client strict DTO -> selected owner; receipt/ref fingerprint -> evidence response; owner lifetime -> React mount/selection/poll/launch reveal; global frame -> session selection/confirmation/history; canonical exact fixture route -> strict same envelope. All boundaries use the existing DTO with no fabricated jobId/revision or backend/schema expansion. File Map is in spec; unmapped changes require Root ruling before edits.

## Tests and sequence

### Task 1: Freeze contract, prepare actual-page causal test, qualify RED

**Consumes:** Recorded actual selected activation/global full8 mismatch and source positions above.

**Produces:** Accepted design/File Map plus real pre-implementation page RED. Owner unit failures for missing exports do not substitute for this causal evidence.

- [ ] Root freezes Option A and the selected/global ownership contract in the sole writer's spec/plan. Keep Task 1 cron source result/build/delivery independently recorded.
- [ ] Test author adds the new focused source fixture and gated browser test, with no production implementation. Default test invocation skips before cache/listener/native creation. Builder may author inert test code but Root alone admits and executes browser/native effects.
- [ ] Root reviews the entire source manifest and focused native fixture owner, admits resource/native custody separately, and runs the single causal browser case against current source. No writer build or modification of retained dist artifacts.
- [ ] Fixture global/latest B is running with empty refs and `GLOBAL_ACTIVATION_UNCONFIGURED`; older A is revision 6, completed, final activation hash H, and six strict checks with code `SELECTED_A_PASS`. A and B have distinct IDs; top-level global selection hash S differs from the job's historical selection in the historical variant only. Do not initially select A from storage for the primary regression: click its real Recent jobs row.
- [ ] Positive setup must first show global unavailable code and both recent rows. Then click A, wait for Owned progress to contain A, and assert top-level Activation health contains six exact A checks. On current code this fails because there are zero A checks and no exact evidence request; preserve actual failed DOM, request ledger, source pins, and cleanup. A failed browser acquisition, malformed fixture, unavailable source server, or unsettled cleanup is UNKNOWN/setup failure, never causal RED.

Exact central assertion to implement in the focused browser case (the page/fixture setup is defined above):

```ts
const recent = page.getByRole('region', { name: 'Recent jobs', exact: true });
await recent.getByRole('button').filter({ hasText: JOB_A }).click();
await page.getByRole('region', { name: 'Owned progress', exact: true })
  .getByText(JOB_A, { exact: true }).waitFor();
const activation = page.locator('main.controls > .controls__top')
  .getByRole('region', { name: 'Activation health', exact: true });
await page.waitForFunction(() => document.querySelectorAll(
  'main.controls > .controls__top [aria-label="Activation health"] [data-testid="activation-check-row"]'
).length === 6);
assert.deepEqual(await activation.locator('[data-testid="activation-check-row"] code').allTextContents(),
  Array(6).fill('SELECTED_A_PASS'));
```

`JOB_A` is the fixed fixture UUID declared by the new focused test; it must not equal any real job or bind to a live service. The recorder asserts every network API target is the private fixture origin, all methods are GET, and the exact A evidence path was requested. Global S remains visible and no pending keys change. The selected report cannot come from a local test-only state injection into the component.

### Task 2: Typed client and selected owner, inert RED/GREEN

**Consumes:** Accepted DTOs and injected interface above.

**Produces:** Exact job GET method and proven actual production owner state transitions.

- [ ] Extend the mocked-fetch test for exact `/api/controls/jobs/<uuid>/evidence`, GET/no body, no-store, auth header, strict parsed envelope. Add malformed ID refused before fetch; 404/503 public code; malformed JSON; wrong/extra wrapper and available-with-null report refusal. Keep launch/cancel expected keysets explicit after adding the sixth request (do not accidentally shift their indexes without fixing assertions).
- [ ] Add deterministic owner tests using deferred promises, without timers/fetch/native/browser/HTTP imports. Test construction/activation/null scope make no calls. Before implementation, retain their expected failures but label missing-method/export failures as unit RED only.
- [ ] Implement exact client and owner contract, then run the inert focused tests. Prefer explicit refs in a fixed order over generic JSON key-order dependence.
- [ ] Required promise schedules: A held → B ready → A old success/error; A1 held → B → A2 ready → A1 late success/error; dispose/reactivate same instance → old success/error; lower receipt revision; equal/lower preterminal receipt after final; receipt 5 empty refs held E1 → receipt 6 terminal final refs E2 ready → E1 empty/error; evidence-ahead-of-receipt bounded reconcile; mismatch after reconcile stays unavailable/error; newest manual-refresh evidence wins; terminal missing/invalid/unsafe/unconfigured remains unavailable; historical DTO preserved; all three report hash families bound correctly.
- [ ] Use spies proving neither the owner nor client jobEvidence method receives/calls a launch/cancel callback, storage object, or session setter. For page/session behavior use the actual session tests and browser ledger; a helper-only spy cannot establish page safety.

### Task 3: Integrate actual page and canonical route compatibility

**Consumes:** Actual owner/client and Task 1 causal failure.

**Produces:** Reports, progress, refresh and reconnect bound to the selected job with preserved mutations/global authority.

- [ ] Integrate page exactly as the contract's four integration paths specify. Use one selected-state value, keeping bound job ID visible even during error. Do not preserve old shared ID-only receipt success/error handlers alongside the owner.
- [ ] Add exact per-job evidence routing to canonical fixture before its prefix receipt route. Inert fixture tests must evaluate the actual existing `fixtureResponse` body via AST/VM, not a reimplemented router: pass a minimal fixed `FIXED_GETS` and per-job/global state into the actual function. Returning `CONTROL_JOB_NOT_FOUND` uses the existing `__fixtureStatus: 404` mechanism.
- [ ] Preserve the 317 assertion list. Measure `UI_REGRESSION_FIXTURE_V1` by inert module import only if needed, compare its actual catalog/hash with the existing golden (`tests/ui-regression-contract.test.ts:519–521`), and record whether data/catalog changed. Adding dynamic route handling alone does not require invented assertion counts. Any deliberate data hash change needs matching reviewed golden updates; never weaken expected-count/hash checks.
- [ ] Run client/owner/session/panel/inert fixture tests as one explicit set. No generic `npm test`, entire UI contract suite, or all `tests/*.test.ts` glob.
- [ ] Root reruns the same actual page causal test GREEN, then the focused page race case. Positive acceptance includes selecting A without Refresh, manual Refresh, reload restored A, a late global refresh, A→B→A evidence success/error, unmount/remount held evidence, final receipt/ref update without clicking Refresh, terminal evidence failure, historical report view, and zero mutation requests. Hold/release exact numbered requests; use positive DOM/request transitions rather than arbitrary sleeps.
- [ ] Seed an unrelated exact pending launch A-request in a page scenario, choose completed B, perform selected/global reads, release a late A GET, and prove pending launch and pending-job raw values remain byte-identical. Do not call `prepareNew` for this scenario. In the separate existing terminal pending-owner behavior, preserve legitimate same-request clearing after its own final receipt; the new report refresh must not add clearing.
- [ ] Root freezes the diff for an independent reviewer. Review must cover actual page call sites, not just helper tests: mount, manual refresh, polling, choose, launch reveal/non-reveal, and cancel response all use the correct owner.

### Task 4: Nonlive build and separately admitted delivery/acceptance

**Consumes:** Reviewed source, focused GREEN and retained causal RED, current Root resource/runtime evidence.

**Produces:** Required stock build and normal reviewed source delivery; later live UI acceptance is separately proven.

- [ ] Root runs stock `npm run build` only in an admitted nonlive physical clone/worktree at the reviewed commit. Writer `dist`/`dist-server` are referenced by retained unrelated fixtures and must stay untouched. Retain command, Node version, source/tree/build identity, natural exit and build output.
- [ ] Root decides whether canonical built 317 regression is required/admitted after the compatibility route change. It is a distinct qualification with current build/fixture/native ownership; old 317 PASS is not evidence of the new selected behavior. Do not run `npm run test:ui`, `npm run test:render`, `npm test`, or build scripts on the sole writer.
- [ ] Only Root performs standing-authority delivery with review/branch requirements. Active original full8 stays unchanged. No service restart, rollout or live control action while the current run is active. After original run settlement and separate rollout admission, verify selected job A and running/latest B scopes through actual UI/read-only HTTP as appropriate; do not claim workflow qualification from activation/report selection.

## Exact proposed commands and effect classification

These commands are recommendations to Root/executor, not commands run by this draft. Run from the sole MC writer unless a command says nonlive build context. The currently inspected helper pins physical Node22 `/opt/homebrew/Cellar/node@22/22.23.1/bin/node`; Root must establish that executable still exists/current before use, without substituting an unreviewed runtime.

Builder-authorized inert focused set after the files exist:

```bash
/opt/homebrew/Cellar/node@22/22.23.1/bin/node --import tsx --test tests/control-evidence-client.test.ts tests/control-selected-evidence.test.ts tests/control-job-session.test.ts tests/controls-render.test.tsx tests/controls-selected-evidence-fixture.test.ts
```

No real fetch: the client replaces `globalThis.fetch` and restores it; all new selected tests inject deferred functions. The new fixture test must not call `createUiRegressionFixtureSessionV1`/`runUiRegressionV1` or create an HTTP server. Existing SSR/session files are inert for this scope. Do not include browser test in builder's command even if default-gated.

Root-only causal actual-page RED/GREEN (new proposed test name):

```bash
MC_CONTROLS_SELECTED_EVIDENCE_QUALIFICATION=1 /opt/homebrew/Cellar/node@22/22.23.1/bin/node --import tsx --test --test-concurrency=1 --test-name-pattern='^Controls selected job reports use exact evidence$' tests/controls-selected-evidence-browser.test.ts
```

Root-only actual-page integration races (new proposed test name):

```bash
MC_CONTROLS_SELECTED_EVIDENCE_QUALIFICATION=1 /opt/homebrew/Cellar/node@22/22.23.1/bin/node --import tsx --test --test-concurrency=1 --test-name-pattern='^Controls selected evidence survives races and terminal refs$' tests/controls-selected-evidence-browser.test.ts
```

The qualification gate must be evaluated before fixture setup. Non-enabled tests report SKIP, never native PASS. The focused owner retains input/source/fixture hashes, original owner and native process evidence, held-request and network ledgers, DOM and screenshots, original failure, and independently settled browser/server cleanup. Source Vite uses `configFile: false`, `envFile: false`, no application backend/proxy, fresh private `cacheDir` outside writer, strict loopback ephemeral port excluding 3080/3333/18789/13081/13082, API deny middleware, GET-only exact intercepted fixtures, no service workers/outbound WS. Unknown acquisition or cleanup cannot qualify either RED or GREEN. Preserve unknown artifacts rather than cleaning unrelated resources.

Root-only required stock build, from a separately admitted nonlive clone at the reviewed commit:

```bash
npm run build
```

Stock build deletes local dist outputs; that is the reason its context must not be the sole writer or current release. Do not run a partial alternate Vite build and label it stock build. Existing task1 cron GREEN/C0, selected activation 6/6 and canonical 317/317 report, actual full8 run, this task's causal RED/GREEN, stock source build, source delivery, and live acceptance are separate evidence claims.


Ruling: exact selected report view is part of already approved operator UI completion. Global launch authority remains independent, all old failed/historical evidence remains visible. Task1 causal RED is mandatory, and Task2 cannot infer correctness from owner-only unit tests. No user reconfirmation is needed for this reversible in-scope source work. Cost if wrong: withheld delivery and rework. Generic skill commit/full-suite/delete-workspace instructions are superseded by Root-only delivery and protected-record/protected-PM requirements.
