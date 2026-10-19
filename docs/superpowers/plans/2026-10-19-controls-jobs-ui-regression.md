# Controls Mission Control Consumer and UI Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Root is the sole delivery owner; execute at most one implementation worker per repository at a time and return reviewed diffs to root without staging, committing, pushing, or deploying from a worker.

**Goal:** Give the local operator working Controls launch, durable progress/reconnect/cancel, safe real evidence, and an isolated all-page UI regression runner with retained screenshots.

**Architecture:** Mission Control composes only fixed trusted compiled Setfarm control schemas/reader and worker path from its selected release. A small durable broker owns private intents, idempotency and child custody; strict loopback browser mutations call it through existing auth. Controls renders validated receipts/reports, while a separate built-client fixture runner exercises every page on port 13082 without touching the 13081 smoke contract.

**Tech Stack:** Express/TypeScript, React, Node fs/child process, existing Playwright browser tooling, Zod via fixed selected Setfarm module, node:test.

**Spec:** `docs/superpowers/specs/2026-10-19-controls-manual-tests-design.md`; settled source architecture `/Users/setrox/ai/setrox/logs/2026-10-19-ui-implementation/controls-runner-architecture.md` including addendum sections 1–5; paired producer plan `/Users/setrox/ai/setrox/.worktrees/setfarm-dashboard-cutover-controller-20261007-v1/docs/superpowers/plans/2026-10-19-controls-producer.md`.

## Global Constraints

- Existing English source/UI language remains binding; Turkish conceptual design labels use clear English product equivalents. Do not change or evade the source-language guard.

- Only `activation_preflight`, `convergence_full8`, `ui_regression` exist. Launch body is exactly `{kind,idempotencyKey,expectedSelectionHash}`; cancel body is exactly `{idempotencyKey,expectedRevision}` for validated opaque `jobId`. No path/argv/model/env/token/suite/budget inputs or query credentials.
- Existing MC authentication remains. Every Controls mutation additionally checks actual listening `Server.address()` is IPv4 `127.0.0.1:3080`, exact peer/local loopback socket, single exact Host `127.0.0.1:3080`, single exact Origin `http://127.0.0.1:3080`, JSON content type, bounded strict body and current selection identity. Normalize only `::ffff:127.0.0.1` for socket peer/local; reject absent/foreign Origin, forwarded-header impostors, wildcard listener, cross-site Sec-Fetch-Site, GET/OPTIONS dispatch. Do not change listener, credentials or global auth.
- Actual activation has six unique IDs `migration_shape`, `migration_attestation`, `database`, `artifact_capacity`, `activity`, `protocol_activation`. Convergence's eight preflight checks are separate from the eight product cases. Full8 uses selected `evals/suites/product-convergence-codex-v1.json`, v3, one repetition, root limit 3, `runMs=21600000`, `pollMs=15000`; show 48-hour maximum planned case budget plus collection overhead, not a completion promise.
- Public receipt and evidence projection are the paired plan's exact versioned DTOs. Null **fields** mean unknown; `availability.state` distinguishes unavailable/unconfigured/missing/invalid/unsafe reports. `completed` is worker completion, never proof of passing report or GO. Retain failed/quarantined/historical, partial and unqualified evidence and all eight catalog case rows with explicit `not_started` where no stored run exists.
- Explicit POST alone may create the selected private `runtime/mission-control/controls` child. GET never mkdir, spawn, repair, register historical reports, publish or scan latest. Mandatory global source-integrity middleware's existing git probes remain, and new handler-specific zero-spawn tests must account for that exception.
- No new token or broader listener. Server operational credential, private nonce, selectors, PG URL, physical paths and raw output never reach browser responses. No `runCli` for long jobs; no HTTP or 25-second job timeout.
- UI regression uses checked `127.0.0.1:13082`, isolated temp data and built client. Preserve existing `npm run render:smoke` at 13081 and its ordered six-route inventory. Fixture refuses occupied/unknown port, external HTTP/WS/service workers/provider/live mutation, and captures only owned child PIDs.
- Root serializes MC writer changes and the approved navigation plan before this task. Controls consumes the navigation plan's `src/lib/navigation.ts` registry entry for `/controls`; it does not add a second nav system or edit `Layout.tsx` keyboard handling. Root separately owns reviews, clean builds, delivery, rollout and real provider/full8 verification.

## File Map and shared interfaces

All paths below are relative to `/Users/setrox/ai/setrox/.worktrees/mission-control-operator-workspace-20261019-v1`.

| File | Responsibility |
|---|---|
| `server/services/control-ui-worker-protocol.ts` (new), `server/services/control-ui-worker-protocol.test.ts` (new) | Pure strict UI report/cleanup validators and private artifact bounds; no runtime/SQL import. |
| `server/services/control-jobs.ts` (new) | Durable 0700/0600 intent/receipt/idempotency store, monotonic CAS, one active job, exact fixed child spawn and custody handshake, retained unknown ownership on restart. |
| `server/services/controls-local-request.ts` (new) | Pure strict actual listener/socket/raw-header/Origin/body policy for POST/cancel. |
| `server/services/control-evidence.ts` (new) | Fixed compiled Setfarm reader composition and source/build-compatible safe DTO; MC fixture report/screenshot manifest reader, bounded nonmutating reads. |
| `server/services/fresh-installation-runtime.ts` | Extend captured selected composition with fixed compiled Setfarm schema/reader and exact worker executable path; no caller-selected import path. Reuse the existing loaded MC build startup identity rather than hashing current checkout HEAD. |
| `server/routes/controls.ts` (new), `server/app.ts` | GET evidence/jobs/exact job/optional screenshot; POST launch/cancel under existing auth/source middleware and local mutation policy; capture actual listener capability. |
| `src/lib/control-evidence.ts` (new), `src/lib/api.ts` | Typed safe DTO/client and fixed JSON methods; no private inputs. |
| `src/pages/Controls.tsx` (new), `src/components/controls/HealthChecks.tsx`, `TestEvidence.tsx`, `ManualTestRequirements.tsx` (new) | Canonical waiting reason, refresh, six checks, real report compatibility, job confirmation/progress/cancel/reconnect and historical evidence. |
| `src/App.tsx`, approved `src/lib/navigation.ts`, `src/components/TabNav.tsx` | Mount Controls route only when the approved navigation plan's registry entry for `/controls` is present; consume that `NAVIGATION_ITEMS`/`NAVIGATION_GROUPS` entry without duplicating the nav or shortcut logic. Preserve `Layout.tsx` keyboard and input focus behavior. |
| `scripts/ui-regression.mjs`, `scripts/ui-regression-fixtures.mjs` (new), `package.json` | `test:ui` source-owned fixture runner and exact 13082 browser/network/child ownership; screenshots/report retained on pass and failure. |
| `server/services/control-jobs.test.ts`, `controls-local-request.test.ts`, `control-evidence.test.ts`; `server/routes/controls.test.ts`; `tests/controls-render.test.tsx`, `tests/ui-regression-contract.test.ts` (new) | Fake effects/temp files/ephemeral HTTP, `node:test` + `react-dom/server` panel rendering, and Playwright fixture interactions. Explicitly run TSX tests because current `npm test` glob omits `.tsx`. |

Derive `selectionHash` only with the fixed SF pure `ControlSelectionIdentityV1Schema`/`hashControlSelectionIdentityV1` and the spec Shared selected identity hash mapping; no duplicate preimage or HTTP paths.

Use the paired SF plan's exact `ControlJobKindV1`, `ControlJobReceiptV1`, `ControlPrivateIntentV1`, `ControlWorkerCustodyV1`, `ControlEvidenceExpectedV1`, `ControlEvidenceAvailabilityV1`, `ControlEvidenceProjectionV1` names/properties. Their Zod schemas and reader are authoritative in fixed selected compiled Setfarm modules. MC may define a local TypeScript view for bundling, checked against version/hash at composition; do not copy the gate validator or vendor an incomplete schema. The projection returns `activation.availability/report` and `evaluation.availability/report`; an available evaluation report has source `executionMode`, `resultStatus`, `gateDecision`, eight exact `preflightChecks`, eight ordered catalog `cases` (actual stored rows marked `recorded`, others `not_started` with null evidence), `completedCases`, `plannedCases:8`, `qualification`, and `blockerCodes`. `uiReportHash` is MC's own report; Setfarm reader ignores it. Internal MC interface:

```ts
import type { Browser } from 'playwright';
export type SelectedControlRuntimeV1 = Readonly<{
  installationDir:string; releaseDir:string; selectionHash:string;
  sourceSha:string; releaseSha:string; suiteHash:string;
  caseIds:readonly string[]; // captured ordered eight-case catalog, never HTTP input
  mcSourceSha:string; mcBuildHash:string;
  workerPath:string; controlsRoot:string;
}>;
export type UiRegressionReportV1 = Readonly<{
  schema:'mission-control.ui-regression.v1';
  mcSourceSha:string; mcBuildHash:string; fixtureVersion:string; fixtureHash:string;
  startedAt:string; finishedAt:string | null; outcome:'pass' | 'fail' | 'incomplete';
  assertions:readonly {id:string;status:'pass' | 'fail';code:string | null}[];
  screenshots:readonly {captureId:string;route:string;
    viewport:{width:number;height:number};sha256:string}[];
}>;
export type ControlEvidenceResponseV1 = ControlEvidenceProjectionV1 & Readonly<{
  ui: {availability: ControlEvidenceAvailabilityV1; report: null | {
    hash: string; mcSourceSha: string; mcBuildHash: string;
    compatibility: 'current' | 'historical';
    fixtureVersion: string; fixtureHash: string;
    startedAt: string; finishedAt: string | null;
    outcome: 'pass' | 'fail' | 'incomplete';
    assertions: readonly {id:string; status:'pass' | 'fail'; code:string | null}[];
    screenshots: readonly {captureId:string; route:string;
      viewport:{width:number;height:number}; sha256:string}[];
  }};
}>;
export type ControlEvidenceEnvelopeV1 = Readonly<{
  schema:'mission-control.controls-evidence-envelope.v1'; selectionHash:string|null;
  evidence:ControlEvidenceResponseV1;
  history:readonly Readonly<{id:string;sourceSha:string;evidence:ControlEvidenceProjectionV1}>[];
}>;
type ManualWorkerEventsV1 = Readonly<{
  onFrame(frame:unknown):Promise<void>;
  onUnavailable(reason:'disconnect'|'exit'|'error'|'overflow'):Promise<void>;
}>;
type OriginalManualWorkerSessionV1 = Readonly<{
  binding:WorkerChannelBindingV1;
  originalChild:ObservedControlWorkerOwnerV1;
  executableHash:string;
  beginDelivery(events:ManualWorkerEventsV1):void;
  send(frame:WorkerChannelEnvelopeV1):Promise<void>;
}>;
interface ManualWorkerPortV1 {
  startFixed(input:Readonly<{
    intent:ControlPrivateIntentV1;
    custody:ControlWorkerCustodyV1;
    binding:WorkerChannelBindingV1;
  }>):Promise<OriginalManualWorkerSessionV1>;
}
export interface ControlJobsV1 {
  create(input: {kind: ControlJobKindV1; idempotencyKey: string;
    expectedSelectionHash: string}): Promise<{receipt: ControlJobReceiptV1; replay: boolean}>;
  cancel(jobId: string, input: {idempotencyKey: string;
    expectedRevision: number}): Promise<{receipt: ControlJobReceiptV1; replay: boolean}>;
  get(jobId: string): Promise<ControlJobReceiptV1 | null>;
  list(limit: number): Promise<readonly ControlJobReceiptV1[]>;
}
export function createControlJobsV1(input: {
  root: string; selected: SelectedControlRuntimeV1; worker: ManualWorkerPortV1;
}): ControlJobsV1;
export function validateControlsLocalMutationV1(input: {
  actualAddress: {address:string; family:string; port:number} | null;
  peerAddress: string | undefined; localAddress: string | undefined;
  rawHeaders: readonly string[]; method: string;
  secFetchSite: string | undefined; query: string; contentLength: number | null;
}): boolean;
export function runUiRegressionV1(input: {
  buildDir: string; tempRoot: string; browser: Browser;
}): Promise<{report: UiRegressionReportV1}>;
```

`SelectedControlRuntimeV1` is the internally captured selected installation/release/source/build/worker composition, not a request body. Its MC source/build values come from `productBuildAuthorityV2LoadedBuildStartupStateV1()`'s validated `response.loadedBuild.buildIdentity.sourceSha` and `.buildHash` (or refuse when unavailable), not current checkout HEAD. The fixture runner uses Playwright's `Browser` interface and test fakes implement the exercised methods. `UiRegressionReportV1` is the stored versioned report in Task 3. `ControlEvidenceResponseV1.ui.report` is its bounded allowlisted projection, with explicit availability for absent, unsafe or invalid report files and historical source/build mismatch.

The production `ManualWorkerPortV1` executes only the captured exact compiled SF worker for the first two kinds, and the fixed MC fixture worker for `ui_regression`; no shell, `runCli`, request-derived command, or child linked to an HTTP response. Browser request methods are `getControlsEvidence()`, `listControlJobs()`, `getControlJob(jobId)`, `createControlJob(kind,idempotencyKey,expectedSelectionHash)`, and `cancelControlJob(jobId,idempotencyKey,expectedRevision)`.

### Task 1: Durable broker, fixed composition and strict HTTP boundary

**Files:** Create `server/services/control-jobs.ts`, `controls-local-request.ts`, `control-evidence.ts`, `control-ui-worker-protocol.ts`, `server/routes/controls.ts`; modify `server/services/fresh-installation-runtime.ts`, `server/app.ts`; test matching `server/services/*.test.ts`, exact new `server/services/fresh-installation-runtime.test.ts` and `server/routes/controls.test.ts`.

**Interfaces:** Consume paired SF fixed schemas, `readSelectedControlEvidenceV1(input)` and exact compiled worker `dist/cli/control-test-worker-v1.js`. Produce `ControlJobsV1` and GET/POST routes described above. The listener capability must be captured after `server.listen` by reading actual `server.address()`, not inferred from config or `req.socket.localAddress` alone. A production child receives nonce only over inherited IPC/descriptor and starts after durable intent and idempotency receipt publication. The private intent path is exactly selected `runtime/mission-control/controls/jobs/<jobId>/intent.json`, matching the SF spec registration reader; no caller path is accepted.

- [ ] **Step 1: Write RED broker tests** using a temp selected directory and a fake `ManualWorkerPortV1` that counts effects. Core assertions:

```ts
const request = {kind:'activation_preflight' as const,
  idempotencyKey:'launch-018d819f-0a78-7d38-bb1f-0195b029ddaf',
  expectedSelectionHash: selectionHash};
const [a,b] = await Promise.all([jobs.create(request), jobs.create(request)]);
assert.equal(a.receipt.jobId, b.receipt.jobId);
assert.equal(a.replay || b.replay, true);
assert.equal(fakeWorker.starts.length, 1);
const reopened = createControlJobsV1({root, selected, worker:fakeWorker});
assert.equal((await reopened.create(request)).receipt.jobId, a.receipt.jobId);
assert.equal(fakeWorker.starts.length, 1);
await assert.rejects(() => reopened.create({...request,kind:'convergence_full8'}),
  /CONTROL_IDEMPOTENCY_CONFLICT/);
```

Test crash after intent fsync/before spawn, after child starts/before ack, restart with unfinished reservation, wrong PID/start identity/nonce, selector drift, missing/unsafe/symlink root, log token redaction, concurrent different keys, cancel replay/CAS stale revision and exact one request. A missing heartbeat or exited PID remains `ownership_unknown` until exact evidence settles; no startup rerun/adoption/kill. Receipt history and idempotency key digest stay durable. Refused GET leaves a missing controls root missing and unchanged. The MC UI report reader distinguishes unconfigured/missing/unsafe/invalid, verifies each screenshot manifest hash, and marks source/build mismatch historical without silently replacing the report.
- [ ] **Step 2: Write RED local HTTP tests** against an ephemeral server using the real route and global auth test wrapper, with fake broker and actual socket/raw headers. Assert exact local browser request accepted with empty `AUTH_TOKEN`; configured token absent/wrong rejected and correct header accepted. Every denial yields zero `starts`/`cancels`. Cases: wildcard/foreign/unknown actual listener, remote socket, forged `X-Forwarded-*`, duplicate/wrong Host, absent/null/foreign Origin, cross-site Sec-Fetch-Site, text/form content, oversized/extra-field body, query token, stale selection, GET/OPTIONS launch, missing/foreign job and unknown owner. Raw header duplicates must be checked before Express normalization. Use `server.address()` result injected as a capability getter in tests; do not trust `req.ip`.

```ts
assert.equal(validateControlsLocalMutationV1({
  actualAddress: {address:'127.0.0.1',family:'IPv4',port:3080},
  peerAddress:'127.0.0.1', localAddress:'127.0.0.1',
  rawHeaders:['Host','127.0.0.1:3080','Origin','http://127.0.0.1:3080',
    'Content-Type','application/json'],
  method:'POST', secFetchSite:'same-origin', query:'', contentLength:96,
}), true);
assert.equal(validateControlsLocalMutationV1({
  actualAddress: {address:'0.0.0.0',family:'IPv4',port:3080},
  peerAddress:'127.0.0.1', localAddress:'127.0.0.1',
  rawHeaders:['Host','127.0.0.1:3080','Origin','http://127.0.0.1:3080',
    'Content-Type','application/json'],
  method:'POST', secFetchSite:'same-origin', query:'', contentLength:96,
}), false);
```

- [ ] **Step 3: Run RED:** `node --import tsx --test server/services/control-jobs.test.ts server/services/controls-local-request.test.ts server/services/control-evidence.test.ts server/routes/controls.test.ts` must fail for missing functions/behavior.
- [ ] **Step 4: Implement broker and routes.** On explicit POST, pin existing selected `runtime/mission-control` parent, create only the `controls` child with 0700 and files 0600, no link adoption. Use exclusive file creation, fsync, atomic CAS replacement and monotonic revision. Persist immutable intent with nonce digest plus key digest before spawn, then authenticated start receipt, bounded private output and capture of worker PID/start identity. Exact replay yields 200 and same job; new accepted job yields 202; active/busy or stale identity 409; unknown authority/activity 503. Cancel 202 means requested until SF/fixture owner settles; exact replay returns same receipt. GET returns no-store, list max 50, exact receipt, `ControlEvidenceResponseV1` with source-compatible SF and UI reports, manifest-bound PNG by opaque IDs; no paths/raw logs. No readdir latest. Compose fixed selected SF schema/reader at prepared startup; derive selected source/suite/release/build, never from request. Keep existing auth and global source middleware intact; mount Controls under `/api` with the additional local policy for mutations only. Sanitize public errors to stable codes.
- [ ] **Step 4a: Preserve existing historical failures.** Provide a private, explicit `registerHistoricalControlEvidenceV1(input: {selectionHash:string; sourceSha:string; refs:ControlReportRefsV1}): Promise<void>` path for root to bind already-known hashes after the SF reader validates them. It writes an immutable indexed history record with a stable ID, never starts a worker, never scans latest, and is not exposed as an unguarded GET side effect. Test a failed/quarantined and an incompatible-source report remain listed after restart; an unknown hash is refused. Root supplies exact known refs before invoking it operationally.
- [ ] **Step 5: Run GREEN** focused tests and production-route integration. Check no handler or reader-specific spawn/mkdir on GET while retaining the existing global middleware git integrity probes. Run `npm run build` after Root reconciles the combined reviewed MC source. Return diff/evidence to root for review.

### Task 2: Controls page with real evidence, progress and reconnect

**Files:** Create `src/lib/control-evidence.ts`, `src/pages/Controls.tsx`, `src/components/controls/HealthChecks.tsx`, `TestEvidence.tsx`, `ManualTestRequirements.tsx`, `src/components/controls/controls.css`; modify `src/lib/api.ts`, `src/App.tsx`; consume the approved navigation plan's `src/lib/navigation.ts` via `src/components/TabNav.tsx` without a separate menu edit; test `tests/controls-render.test.tsx`, `tests/control-evidence-client.test.ts`, `tests/navigation.test.ts`, `tests/navigation-render.test.tsx`. Touch `src/components/Layout.tsx` only if actual shortcut regression evidence requires it.

**Interfaces:** Consume Task 1 fixed API methods and paired safe receipt/projection. Export `HealthChecks({activation}: {activation:ControlEvidenceProjectionV1['activation']})`, `TestEvidence({evaluation,ui,receipt}: {evaluation:ControlEvidenceProjectionV1['evaluation'];ui:ControlEvidenceResponseV1['ui'];receipt:ControlJobReceiptV1 | null})`, and `ManualTestRequirements({kind}: {kind:ControlJobKindV1})` as actual page-used panels. Controls route `/controls` is a fixed route, not a dynamic resource path. Pass only kind/idempotency/expected selection to launch; store the idempotency key through a lost HTTP response and reuse it on retry. Poll exact job ID at a bounded interval while mounted; navigation/reload fetches recent receipts and exact job and never causes a new launch.

- [ ] **Step 1: Write RED panel render tests** with the repository's installed `node:test`, `node:assert/strict`, and `react-dom/server`; no DOM test library is needed. These panels are imported and rendered by the actual Controls page. Core assertion code:

```tsx
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { HealthChecks } from '../src/components/controls/HealthChecks';
import { TestEvidence } from '../src/components/controls/TestEvidence';
import { ManualTestRequirements } from '../src/components/controls/ManualTestRequirements';
const ids = ['utility-status-baseline','utility-preference-compositional',
  'operations-work-baseline','operations-queue-paraphrase','game-start-baseline',
  'game-restart-compositional','negative-ambiguous-product',
  'negative-unsupported-kernel'] as const;
test('partial full8 shows actual rows and unstarted cases', () => {
  const evaluation = {availability:{state:'available',code:null},report:{
    resultHash:'a'.repeat(64),gateHash:null,compatibility:'current',
    executionMode:'execute',resultStatus:'blocked',gateDecision:null,
    qualification:'unqualified',
    preflightChecks:['release_identity','release_cleanliness','migration_attestation',
      'database_ownership','setfarm_health','mission_control_health',
      'execution_profile','result_store'].map(id => ({id,status:'pass' as const,code:'CHECK_PASS'})),
    cases:ids.map((caseId,index) => ({caseId,repetition:1 as const,
      evidenceState:index < 2 ? ('recorded' as const) : ('not_started' as const),
      disposition:index < 2 ? ('failed' as const) : null,passed:index < 2 ? false : null,
      runId:index < 2 ? `run-${index}` : null,
      resultHash:index < 2 ? String(index).repeat(64) : null})),
    completedCases:2,plannedCases:8,blockerCodes:['EVAL_CANCEL_REQUESTED'],
  }} as const;
  const ui = {availability:{state:'unconfigured',code:'UI_REPORT_UNCONFIGURED'},report:null} as const;
  const html = renderToStaticMarkup(<TestEvidence evaluation={evaluation} ui={ui} receipt={null}/>);
  assert.equal((html.match(/data-testid="control-case-row"/g) ?? []).length,8);
  assert.equal((html.match(/Not started/g) ?? []).length,6);
  assert.match(html,/Unqualified|Not qualified/);
  assert.match(renderToStaticMarkup(<ManualTestRequirements kind="convergence_full8"/>),/48 hours/);
});
test('six activation checks and unavailable reason remain visible', () => {
  const activation = {availability:{state:'available',code:null},report:{
    hash:'b'.repeat(64),status:'fail',protocol:'v3',compatibility:'current',
    observedAt:null,checks:['migration_shape','migration_attestation','database',
      'artifact_capacity','activity','protocol_activation'].map(id =>
      ({id,status:'fail' as const,blocking:true,code:'CHECK_FAILED'})),
  }} as const;
  assert.equal((renderToStaticMarkup(<HealthChecks activation={activation}/>).match(/data-testid="activation-check-row"/g) ?? []).length,6);
  const missing = {availability:{state:'missing',code:'ACTIVATION_REPORT_MISSING'},report:null} as const;
  assert.match(renderToStaticMarkup(<HealthChecks activation={missing}/>),/ACTIVATION_REPORT_MISSING/);
});
```

Add SSR cases for canonical “Why is it waiting?” from codes; advisory/fail/blocking checks; distinct eight convergence preflight vs eight case labels; current case and owned run IDs; completed/planned counts; completed with missing gate unqualified; planned/partial/no-go/historical incompatible reports; each `availability.state` `unconfigured`/`missing`/`invalid`/`unsafe` reason; null unknown metric distinct from real zero; cancelling shown as requested until terminal. Task 3's real Playwright fixture proves refresh, confirmation, lost POST response with same idempotency key, reload/reconnect and cancel through the actual page. Do not render selectors, private paths, raw logs or tokens.
- [ ] **Step 2: Run RED:** `node --import tsx --test tests/controls-render.test.tsx` must fail for absent page/API methods. Current `npm test` glob does not include `.tsx`; invoke this file explicitly.
- [ ] **Step 3: Implement safe typed client and page.** Parse versioned DTO, use current auth header plumbing, set `Cache-Control:no-store` on server responses and client fetch cache mode; confirm selected kind and visible budget before POST. Render evidence/qualification from source DTO, not counts; show `failed`, `blocked`, `cancellation requested`, `ownership unknown` accurately. Keep last selected job key until terminal or explicit new action. Mount `/controls` in `src/App.tsx` and consume the approved `NAVIGATION_ITEMS` `/controls` entry in `src/lib/navigation.ts` through the existing grouped `TabNav`; preserve all existing routes and mobile focus. Refresh only reads; no refresh-side start.
- [ ] **Step 4: Run GREEN** TSX test and existing navigation/route tests, then `npm run build` on the reviewed combined MC branch. Root compares selected source/build values shown by UI to actual loaded service, not checkout HEAD.

### Task 3: Isolated source-owned all-page UI regression and retained screenshots

**Files:** Create `scripts/ui-regression.mjs`, `scripts/ui-regression-fixtures.mjs`; modify `package.json` with `test:ui`; test `tests/ui-regression-contract.test.ts`. Preserve existing render smoke six ordered routes/13081 and strict V3 gate; its owned-isolation setup belongs only to Task4 below.

**Interfaces:** The broker launches only built `dist-server/scripts/ui-regression.mjs --job-id <uuid>` for `ui_regression` with pinned private intent fd4 and authenticated original fd3 custody, as the paired spec. Stock build copies the two source .mjs files under dist-server/scripts before existing content hashing; test:ui uses this built entry. No identity-validator bypass. This separate UI worker never calls SF reservation/closure; the accepted exact UI frame/report/owned-cleanup contract is binding. The worker emits a versioned `mission-control.ui-regression.v1` report containing `mcSourceSha`, loaded `mcBuildHash`, fixture version/hash, start/finish time, actual named assertion outcomes and screenshot manifest `{captureId,route,viewport,sha256}`. `control-evidence.ts` reads only a manifest-bound PNG by capture ID and verifies byte SHA; it never accepts a browser path.

- [ ] **Step 1: Write RED fixture contract tests** for occupied port, environment stripping, network denial, owned child cleanup and report retention:

```ts
const occupied = await listenFixturePort(13082);
await assert.rejects(() => runUiRegressionV1({buildDir, tempRoot, browser:fakeBrowser}),
  /UI_FIXTURE_PORT_OCCUPIED/);
assert.equal(occupied.listening, true);
await occupied.close();
const result = await runUiRegressionV1({buildDir,tempRoot,browser:fakeBrowser});
assert.equal(result.report.schema,'mission-control.ui-regression.v1');
assert.equal(result.report.screenshots.every(s => /^[a-f0-9]{64}$/.test(s.sha256)),true);
assert.equal(fakeBrowser.unexpectedRequests.length,0);
```

Inject a fixture browser that raises an assertion failure mid-run and assert report plus completed screenshots persist, with `fail` outcome. Assert child cleanup targets only captured PIDs, never arbitrary owner of 13082. Assert child environment omits operational token, PG URLs, installation selectors, `NODE_OPTIONS`, `NODE_PATH`, `DYLD_*`, `LD_*`; unexpected HTTP, websocket, service worker, provider and mutation requests fail the report. The fixture API is isolated and fake, so it may emulate launch/reload/idempotency/cancel without contacting production 3080.
- [ ] **Step 2: Run RED:** `node --import tsx --test tests/ui-regression-contract.test.ts` must fail for absent runner. Do not point it at live services.
- [ ] **Step 3: Implement fixed fixture runner.** Require the actual already-built `dist` client and loaded MC source/build identity. Bind only checked `127.0.0.1:13082`; refuse occupied/unknown listener. Serve built static assets plus fixed API fixtures from isolated temp data; deny all unknown HTTP/WS/service worker/provider/mutation requests. Sanitize child env and track exact server/browser child lifecycle. Capture screenshot/report even when assertions fail; fsync bounded files and immutable manifest/hash index. Never call live 3080/3333/18789, real provider or DB. Keep port 13081 smoke unchanged.
- [ ] **Step 4: Run actual browser assertions at 390, 768 and 1440 widths** on `/`, `/office`, `/setfarm`, `/setfarm/active`, both fixed legacy/v3 `/setfarm/runs/:id` fixtures, `/agents`, `/chat`, `/ops`, `/costs`, `/performance`, `/projects`, `/files`, `/scrape`, `/rules`, `/live`, `/workflows`, `/tasks`, `/prd`, and `/controls`. Assert `/office` stays at `/office` with the mounted PixelOffice visible and its state preserved; only `/perf` redirects to `/performance`. On RunDetail exercise all eight actual tabs: Execution, Pipeline, Run Contract, Supervisor, Telemetry, Agent Chat, Files and Stories. Exercise A101 Clone This and delayed history, stale/late history and new/reset/navigation races, D/P/input/select/contenteditable/IME/modifier guards, search/favorites/mobile focus, 14-agent grid/panel, Rules 503 draft/confirmation retention, real zero vs unknown metrics, planned/historical/unqualified Controls reports, and fixture launch/reload/idempotency/cancel. In Controls, click real fixture launch/confirmation, simulate lost POST response, reload, retry the same idempotency key, verify one fixture job and persisted progress, then request cancel and verify `cancelling` until owned settlement. Assert no console error, unexpected network, horizontal overflow or unreadable ordinary computed fonts. Record one named assertion per behavior and a screenshot manifest for each page/viewport; failure retains evidence.
- [ ] **Step 5: Run GREEN:** `node --import tsx --test tests/ui-regression-contract.test.ts`, `npm run build`, `npm run render:smoke`, `npm run test:ui`. Inspect actual `test:ui` report and screenshots, including failed evidence. Return reviewable artifacts/diff to root; root alone performs reviewed rollout and later CUA read-only live product verification without provider/mutation clicks.

The two plans meet only through the fixed selected SF compiled schemas/reader/worker and versioned DTO. Neither source tests nor fixture screenshots qualify a Setfarm release. Root must prove the actual selected preflight/full8 separately after current material and owner gates allow it.

## Paired private custody closure contract

Follow the spec Private SF custody closure section. Publish exact immutable intent under canonical UUID job directory before one fixed spawn; retain current private sibling storage as MC-owned safe data (SF interprets only required intent leaf). Authenticate final SF custody closure acknowledgement through the existing private channel before terminal receipt; receipt state/exit alone never closes SF ownership. A blocked worker with proven never-reserved closure can finish while unrelated owners remain blocking. Crash before registration/closure remains unknown; GET/restart never publishes/adopts/deletes markers or respawns. Public receipt/request schemas and tokens are unchanged. Cover these exact broker cases in the mapped Task1 tests.

## Accepted original-session private protocol

Root private UI fixture composition: the measured built `dist-server/scripts/ui-regression-fixtures.mjs` exports `UI_REGRESSION_FIXTURE_V1` with exactly fixtureVersion, fixtureHash and an ordered unique nonempty assertionIds catalog (max2048). Missing/unsafe/unmeasured assets refuse UI launch. Task3 owns its deterministic data/catalog hash and stock build copies; Task1 only captures the trusted module and validates final reports against every catalog ID, not a screenshot/count shortcut.

Root HTTP fixture limit: a real ephemeral listener must fail the exact production3080 policy. Positive actual route/auth/socket/raw-header behavior may use immutable injected capability facts matching3080 as explicit component data, paired with real server.address() ephemeral denial and pure exact3080 positive. This is not real3080 listener evidence and creates no production test-port exception, request capability or broader listener. The production getter remains actual server.address(); live acceptance supplies the later real positive.


Follow the paired spec Accepted private worker channel/journal and exact paired exports/UI lifecycle sections. Independent frame/journal/receipt counters, durable original-channel ACK mapping and cancellation latch, no restart adoption, UI vs SF final dispatch and fixed pure exports supersede earlier metadata-only port wording. MC alone writes receipts. Provisional reportRefs remains empty until definite SF release/closure final_closed or validated UI final report+owned-cleanup. Source-only fake effects do not qualify selected compiled execution. Root serializes paired ABI changes; MC never edits SF schema/guard sources.

### Task 4: Owned isolation for existing built-server render smoke

**Cause:** Source inspection in logs/2026-10-19-ui-implementation/render-smoke-owned-isolation-recipe-v1.md found inherited credentials/DB/default live upstreams, startup effects, missing actual private DB rows and upstream sealed-V3 fixture, plus missing outbound/CLI fencing. This root test setup fix is required for the existing UI acceptance gate, not a new product feature.

**Files:** Modify `scripts/render-smoke.mjs` and `tests/render-smoke-response.test.ts`; create `scripts/render-smoke-owned-fixture.mjs`, `tests/render-smoke-owned-fixture.test.ts`, `tests/fixtures/render-smoke-product-authority.mjs`. Any production source/config/guard or other fixture change requires a concrete Root FileMap ruling before editing.

- [ ] Read the exact owned-isolation recipe and current source, then write meaningful RED for inherited secret/selection/loader refusal, owned port/database/mock/CLI/network lifecycle and failure cleanup. Reuse/extract source-owned canonical sealed packet factory, do not fabricate production evidence.
- [ ] Implement an explicit allowlist child environment and exclusive owned HOME/data/PG/mock/egress/CLI fixtures using existing supported setup. Never default to live5432/3080/3333/18789 or ambient credentials/selected installation. Refuse occupied resources, record exact owned lifecycle, retain failures and clean only positively owned test resources. Root supplies current protected owned-test input if needed. No helper/profile/role/runtime guard bypass.
- [ ] Preserve exact ordered six routes and13081, compiled parser and actual MC-proxied sealed V3 packet for exact fixed run. Seed actual private run rows and source-valid200 snapshots; if exact404 behavior must be fixed, report evidence and Root expands Map before edit. Do not broaden expected failures silently or substitute13082 fake API results.
- [ ] Run focused tests, Root stock build, then actual existing `npm run render:smoke` within proven owned isolation. Capture source/build/HTTP/DB/network/child/screenshot results and failure cleanup. This is built-server integration evidence, not live or selected runtime qualification. Independent review before delivery.

Root evidence-envelope ruling: GET evidence and getControlsEvidence() return strict ControlEvidenceEnvelopeV1, not an expanded ControlEvidenceResponseV1. Selection metadata comes from captured unchanged composition, history max50 explicit validated SF index records, jobs separate. Preserve frozen receipt/mutation/SF DTOs; null selection refuses launch. This fixes a concrete initial-launch/history integration gap within existing mapped files before page implementation.

Root private qualification composition: add/pin fixed selected `dist/evals/control-evidence-admission-reader-v1.js` export `readSelectedControlEvidenceWithAdmissionV1(expected,captured.owner)` in mapped fresh-installation-runtime.ts, preserving original FS module pin. Keep private selected.readEvidence(input) signature, guard captured selection/module/owner before and after await. Adapter owns FS+fixed read-only query; MC never guesses SQL/qualification. Missing module refuses Controls until supported built release. Add captured-owner/drift/HTTP injection tests in mapped Controls composition tests; any other test path requires Root Map ruling. No public DTO/worker change.

Root exact captured-composition test Map: add `server/services/fresh-installation-runtime.test.ts` for fixed compiled module/refusal, captured selected SQL owner and post-await drift. Test-only subprocess hooks/pure Source schema fixtures establish component behavior only; no new runtime/DB authority. Future unlisted files need Root ruling before edit. Actual owned-child RED/GREEN also validates refined ps full-executable observation with exact canonical argv/parent; never infer terminal completion from exit.

## Root Task2 implementation scope refinement

The scoped responsive Controls stylesheet and strict browser-client request/response tests are mapped explicitly before Task2 starts: `src/components/controls/controls.css` and `tests/control-evidence-client.test.ts`. They serve the already-approved page and evidence/idempotency behavior; no global CSS override, new package or second navigation owner. CSS is checked by the actual later three-width browser journey, not implementation-mirroring style tests. Browser uses the existing exact strict Controls envelope and route wrappers, nullable captured selection and current auth/no-store plumbing. Initialization/refresh/reconnect are reads; no inferred passing evidence, fabricated source/build, request paths or new automatic launch.

Task1 Source review accepted through `5288175a4ae857a53abd7810ce9f83311f00bfad` after meaningful post-rename publication failure RED/GREEN, 44 focused passes and clean stock build. Uncertain reopened publication exposes neither terminal time nor report refs; independently valid history and definitely committed final receipts remain retained. This is Source acceptance, not selected compiled/runtime/3080/UI/full8 qualification. Vite's existing chunk warning remains recorded for final whole review without threshold suppression.


## Root Task2 Source acceptance and Task3 native fixture refinement

Task2 Source accepted through `3ed843e1e718649c48a9116ac11db0662e688ae1` after original5 fixes plus scoped N1 request-mapping/unmount fix2. Root verified12Source+28capture hashes, retained RED4pass/2fail (one absent-method, one behavioral), GREEN28focused and6session passes, nonemit/English/path/diff0 and stockbuild5PASS3.12s with286content files independently verified. Scoped fix2 review found no newC/I. Browser cross-mount race/three widths/loaded service still pending. No live/full8 credit.

Task3 additionally reads binding `docs/superpowers/specs/2026-10-19-ui-regression-owned-lifecycle.md` before Source work. Exact Source FileMap: new `scripts/ui-regression.mjs`, `scripts/ui-regression-fixtures.mjs`, `scripts/ui-regression-lifecycle.mjs`, `tests/ui-regression-contract.test.ts`, `tests/ui-regression-lifecycle.test.ts`; modify `server/services/control-ui-worker-protocol.ts`, `server/services/control-ui-worker-protocol.test.ts`, `server/services/control-jobs.test.ts` (UI fixture owner rows only) and `package.json`. Copy all three fixed .mjs files before existing unchanged stock content hashing. `test:ui` uses fixed built `--standalone`; broker exact `--job-id`/fd3/fd4 stays unchanged. No extra production paths, public DTO/SF contract, source fallback, generic process supervisor, release/binary download or guard bypass. Root-owned documents describe accepted implementation hypothesis, not runtime proof.

One native shell launch per attempt, exact pinned installed Playwright1.60.0/headless-shell1223/darwin-arm64, direct captured detached child plus publicCDP, private fixed lifecycle and original-owner proof. Browser shutdown requires exit+close/transport/context/server settlement and two complete bounded OS censuses, with explicit trusted-group assumption and unknown on detected escape/ambiguity. Real allpages×390/768/1440 screenshot/catalog, deliberate failure, owned cancellation and actual cross-mount delayed-response race remain mandatory after Root clean build. Static/fake tests do not qualify runtime. Root alone executes or explicitly delegates bounded actual-browser qualification after Source freeze/build; implementer initially runs only focused Source tests/nonemit/contracts. Existing13081render smoke is Task4, not a Task3 command.


## Root private component seams and pure bootstrap dependency

Source component tests may supply lifecycle effects `{spawn,ps,connectOverCDP,clock,sleep}` and an EventEmitter transport to private `createUiWorkerChannelV1({intent,owner,channel,schemas,target})` in the mapped entry. Production fixed entry omits injected effects and uses only original process, independently observed owner and measured fd4-bound pure SF modules. No argv/env/HTTP callback/owner/target or caller Boolean supplies authority. Real strict parsing, HMAC, sequencing, immutable filesystem publication and binding remain active in component tests; fake effects never qualify actual cleanup/custody.

Root found existing loaded-build capture imports canonical hashing through setfarm-operational-snapshot.ts, whose config import reads env/token files and selected composition. Pure UI bootstrap cannot import that graph. Exact causal additional FileMap: new `server/services/setfarm-canonical-json-v1.ts`; modify `server/services/setfarm-operational-snapshot.ts` and `server/services/product-build-authority-v2-delivery-evidence-v1.ts`; existing `server/services/product-build-authority-v2-delivery-evidence-v1.test.ts` may update only its private fixture dependency copies. Move existing SnapshotValidationError, canonicalJsonStringify and hashCanonicalJson verbatim to the new crypto-only pure module; preserve snapshot hash re-export/class behavior and change delivery module's hash import only. No build/content hash algorithm, validator/capture, receipt, role or guard change. Existing snapshot and loaded-build regressions plus emitted import-graph denial and golden canonical vectors verify equivalence. This is the smallest root fix needed to reuse the existing identity validator without reading operational configuration. Cost if wrong: fail bootstrap/qualification, retain evidence and fix reviewed source; no identity exemption.

Standalone original-owner observation accepts exactly the canonical Root vector `[canonicalNode,canonicalBuiltScript,exactMode]` or unchanged npm vector `['node','dist-server/scripts/ui-regression.mjs',exactMode]`. The latter additionally requires exact canonical MC-root cwd and process.argv0==='node'. Both require the full independently observed canonical comm/pinned execPath, self/build checks, no execArgv/loader input, strict argument count and unchanged raw args commandHash. No arbitrary argv0/path alias or normalized observed command is accepted. Broker canonical invocation remains unchanged. Actual unexpected OS spelling is a refusal requiring new evidence, not automatic fallback.


## Root default external-font dependency correction

Exact additional Task3 Source path `index.html`: remove only the two Google-font preconnect links and remote JetBrains Mono stylesheet. Existing local/system font fallback stacks remain; no new font assets/packages, global CSS, CSP/identity/runtime guard changes or network-error suppression. This smallest product root fix removes unnecessary default external connections and permits the approved isolated dashboard to render reliably. Actual built three-width readability/screenshots and network observations still verify the result. Exact known external icon assets may be deterministic local fixture responses; unexpected requests remain failures. Total mapped Source/test paths14 after prior pure-dependency refinement.


## Root scoped fixture coverage refinement before actual build

Replace the single invented convergence preflight row with all eight actual Source IDs, and supply six genuine activation projection rows. In existing fixtures module and contract test only, add the named mounted Controls row-separation assertion: six current activation checks, eight convergence preflight checks and eight catalog cases. Preserve planned/historical/unqualified reports and fixture-only provenance. Rich V3 positive payload coverage remains Task4 actual compiled proxy/sealed200 gate; unavailable-tab checks never claim that coverage. The original315catalog and Source49/23/1 results are retained as historical Source evidence. New measured catalog/count/hash and focused RED/GREEN must be reported before Rootbuild. No productionpanel/publicDTO/entry/lifecycle path changes.
