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

## Root Task3 review fix 1 and actual prelaunch failure

Source candidate `0d5151365c7c7c5a70435bc99481a3369cf7e83d` has52 focused,23 snapshot and1 loaded-build component passes plus Root stockbuild-v6 PASS and291 independently hashed built files. These do not establish actual browser acceptance. Root fixed built `native-pass-v1` returned incomplete/exit1 before browser spawn, with zero assertions/screenshots and retained original report/cleanup. A separate raw macOS metadata capture proves trailing ASCII spaces after ps lstart's year are rejected by the strict row parser. Preserve all original captures/manifests and the failed native attempt.

Independent Task3 review `task-3-source-review.md` found C0/I5/M0. One original-writer scoped fix covers: I1 exact trailing ASCII-space metadata padding; I2 durable intent/never-invoked publication certainty before definite not-started cleanup; I3 exact existing broker UI ACK receipt/event/time/count/cancel-revision mapping; I4 immutable accumulated candidate report/manifest before final validation/context cleanup with retained evidence and no qualified final after integrity failure; I5 bounded complete-line CDP discovery and one immutable endpoint through original shutdown, including later duplicate/malformed declaration refusal. Exact fix FileMap is only `scripts/ui-regression.mjs`, `scripts/ui-regression-lifecycle.mjs`, `scripts/ui-regression-fixtures.mjs`, `tests/ui-regression-contract.test.ts`, and `tests/ui-regression-lifecycle.test.ts`. Any additional Source path requires an evidenced Root ruling before editing.

Use meaningful original RED/GREEN and private existing component seams. Padding accepts only ASCII spaces after the fixed date, preserving raw bytes/hash, strict newline/caps/duplicate/partial checks. Publication attempts and durable intent/never-invoked facts are separate; failure or uncertain write/fsync never yields definite cleanup. Safely committed intent refused before actual spawn may publish the strict never-invoked leaf from uninterrupted original knowledge; missing records/restart do not establish it. ACK validation follows the current unchanged `control-jobs.ts` reducer, including null case/run, exact reportRefs, immutable/ordered timestamps, first-running startedAt and accepted cancellation floor; authentication alone is insufficient. Retain candidate hashes/assertions/PNG manifest before late pin/context failure, attempt owned cleanup, and retain unknown authority on failed integrity. Stream fragmentation is ordinary input: wait for a complete exact endpoint line within current bounds and latch subsequent declaration violation through settlement. No reconnect, alternate discovery, fallback/download, kill, new public/SF/broker schema, runtime guard exception, fixture skip or fake actual qualification.

Root alone commits/builds and executes fresh actual fixed pass/failure/cancel after freeze; one scoped independent re-review verifies all five repairs. All316 actual outcomes, screenshots at390/768/1440, native ownership/environment/fd/network/cleanup, Task4 owned13081, selected broker/runtime/full8 and live rollout gates remain open. This is a causally required harness repair for the approved UI acceptance objective, not an unrelated feature.

### Root exact pre-ready cancellation ordering correction

The unchanged broker defers sendCancel while not ready. Cancellation before ui_ready commits receipt revision2 without sending a notice; the ready event commits revision3 and sends its cancelled ready ACK before the notice carrying acceptedReceiptRevision2. Root's Source trace found the initial94-pass repair wrongly rejected this legitimate sequence. The original writer retained that report/manifest and authored causal RED/GREEN. Worker acceptance is limited to the first exact ready ACK with the single cancellation revision gap, matching cancelling/starting/count0/code/null fields and valid immutable/ordered facts. It latches cancellation from that authenticated ACK, remembers the exact implicit cancellation revision and requires the next broker frame to be its matching first notice. Arbitrary gaps, unrelated/stale/duplicate notices or another ACK before that notice refuse. Fresh cancellation and subsequent ACKs retain exact revision/floor progression. This supersedes a blanket requirement that every notice advance an already-cancelled ready ACK; no parent/public/SF protocol change.

Final fix1 Source has101focused passes, unchanged316catalog/hash, script syntax and diff checks; Root independently verified13current Source hashes,51commands/204original capture leaves and linked reports/manifests/actual prelaunch-failure captures. Original94and first actual failed attempt remain historical. The private engine result integrity field is Source-produced only; failed late integrity retains accumulated candidate/PNG manifest and cannot publish final authority. Clean stock build, scoped review and real browser/broker/Task4/live/full8 gates are still required.

### Root Task3 fix2: complete macOS UID input and precise ACK-floor test

Root build-v7 at2ca034 passed, but actual native-pass-v2 again failed before browser launch. Replaying the entire original583-row ps capture identified its remaining valid UID-2 row; local id-u reports nobody UID4294967294. Apple's ps keyword.c defines Darwin UIDFMT d for the unsigned UID field. Exact fix2 Map: only lifecycle.mjs metadata UID parsing, lifecycle tests, and the existing contract test's M1 ACK-floor arrangement. Accept canonical signed32-negative or unsigned32 UID text within bounds, normalize a negative by adding2^32 after range validation, preserve every row/raw hash and all PID/PPID/PGID/newline/padding/cap/duplicate/own-UID/executable/parent/group checks. Reject noncanonical forms and wrap-to-own overflow; independent owner observer stays unchanged. No user/process exclusion or role/guard change.

M1 now accepts readyACK2 then validcancel3, proves availability and a pending cancel-observed ACK, and rejects semantically matching staleACK3 instead of expected4. Final107focused passes and all583 original Source rows replayed; Root verified13current Source hashes and57commands/228original capture leaves. All prior reports/captures/native failures remain immutable. Root must perform fresh clean build-v8, full compiled historical/current metadata replay, scoped confirmation and real native316/pass/failure/cancel/screenshots/cleanup; none is supplied by Source tests. This refinement completes the same acceptance harness objective and grants no selected/live/full8 authority.


### Root Task3 fix3: exact local fixture avatars

Actual native-pass-v3 at5118351/build-v8 reached the real browser: home390 loaded/overflow/fonts passed, then console-network failed on14missing synthetic avatar assets. Its original failing report, screenshot, diagnostic and closed original-child/server lifecycle are retained. The Source remedy is causally required test-fixture completion, not a production AgentCard change. Exact File Map: scripts/ui-regression-fixtures.mjs and tests/ui-regression-contract.test.ts only. A private14record AVATARS array contains exact fixed paths, SVG MIME and deterministic local UTF-8 bodies. HTTP and browser permissions allow only exact fixed GET targets; unknown IDs, mutations, traversal/query aliases and foreign origins still refuse visibly. No broad prefix permission, network suppression, external download or extra public interface. DATA includes all asset path/MIME/body bytes in the fixture hash.

Root verified13current Source hashes,64commands/256original leaves and27linked immutable records in manifest1ab2db8a6c9dbb749e803807a7f4c2d6cdbb181a4a3fd102293291db5512a720. Causal avatar RED retained; final111/111 focused passes. FixtureHash is now2027075249626adb6f803b9d2a3139500fb262de446f002bd82ca98598aa1c1d, version unchanged,316ordered assertion IDs unchanged (catalog hash4ded731c52c60105daa60639aa64683b68d1d3f22e9c3e685bb794b67e8ba88d). No lifecycle/entry/protocol/package or production component change. Prior Source acceptance remains, subject to one scoped fixture confirmation. Root clean build-v9 and real native-pass-v4, full316 mounted assertions/screenshots, deliberate failure/cancel, broker/Task4/selected/live/full8 gates remain open. Earlier failed native attempts are not upgraded by component passes.


### Root Task3 fix4: response contracts proven by actual page failure

At0916b6f3/build9 actual native-pass-v4 passed11 assertions then failed setfarm390 console-network with PipelineView.storyProgress.total TypeError. Root inspected all3 retained screenshots, including the ErrorBoundary, and verified original native exit0 AND close, transportclosed,5retained identities absent, two empty censuses113ms apart and exact lifecycle hash links. Earlier nativev3 links also verified; raw global census bytes are not retained in those leaves, so no independent raw census replay is asserted.

Root read the bounded consumer census before authorizing this exact same two-file fixture repair: separate PIPELINE rows with actual eight story buckets consistent with fixed completed summaries; correct alerts counts/recent and empty provider-keyed quota map; exact GET targets for main history limit40 and live-feed projects formatrich/history limit300. All payloads/targets belong in DATA for an honest new fixtureHash. Unknown siblings, methods, traversal/query aliases and foreign origins refuse; no blanket successful response, production fallback, console suppression or assertion skip. This is necessary fixture contract repair for the approved acceptance objective. No new public seam, lifecycle/entry/protocol/package or product component path.

Root verified13currentSourcefiles,70commands/280originalleaves and37linkedrecords against manifestac55324e13a73171828b7387716148267961a3a390be7b2f5c5742d768d5c902. Real ownedHTTP→actualPipelineViewSSR causal RED is retained (including the earlier faulty403-helper capture, corrected before production edits). Final119/119 focused pass. FixtureHash285bad0531b64ac7f8f070b60cfca73dead8f03d90d69341fe9097a6ed0642e4;316orderedIDs/version unchanged. Root cleanbuild10/native5 and scoped fixture confirmation remain required; actual full-catalog/failure/cancel, broker/Task4/selected/live/full8 gates remain open. Prior failed attempts remain failures.


### Root actual mobile visual audit: typography and responsive root fixes

Root actualnativev5 at7144e61/build10 visited all20mobile routes,78assertions passed and Controls fonts failed (79th);237of316 assertions were not executed. Root viewed all20 original390x900PNGs individually and retained a hash-verified gallery at workspace logs/2026-10-19-ui-audit-native-v5/index.html. These are fixed-data screenshots, not live/rich/populated functionality acceptance. Root readback verified original browser exit0 AND close, closed transport/server,5retained identities absent, two empty censuses113ms apart and exact lifecycle/PNG/report/diagnostic hashes; no independent raw census replay is claimed.

Root approved fix5 exact FileMap src/components/controls/controls.css: only eyebrow/badge/facts-label14px and code13px, consistent with15px body and prior readability direction. Actual font failure is RED; no static CSS mirror test is needed. No font threshold/selector change.

Root visual review also proved Setfarm header receipts, Projects actions/filters, Rules filters and full operational reason codes clipped despite the document-width check passing. Before implementation Root read censuscaa4e6179f9a1813c0a9c6e794eace6666d6b692b7ece02574588f5e51d440d8 and mapped only src/index.css, src/pages/Rules.tsx, scripts/ui-regression-fixtures.mjs and tests/ui-regression-contract.test.ts. Targeted flex wrapping/min-width/max-width and reason overflow-wrap repair the product. Stable Rules classes/local width adjustment add no feature or function removal. No blanket overflowhidden, truncation or hidden action.

The same existing overflow assertions retain document check/1px tolerance and additionally check main/content/critical-container/control horizontal bounds and clipping ancestors. Only Source-listed bounded computed auto/scroll inner table/tab/stage wrappers permit scrollable children; arbitrary auto/hidden ancestors never qualify. Geometry-only diagnostic retains at most8samples with bounded tag/class and numbers, no text/HTML/user payload or public schema change. Actual Source page.evaluate callback runs against controlled raw geometry for causal RED/GREEN; simulation is not browser layout proof.

Root verified16current Source files,77commands/308original leaves and68linked records against manifeste7e389586e98fe47f7e4770ddf80167edd00fe6265d2af952d198109f5357a31. Final133/133focused, frontend noEmit, syntax/catalog and diff pass; old captures/failures remain. Fix5CSS matches9e75d61416642ca4d381d6f5a31526373323806e42246b4de92a58d76007f585. Fixture payload hash285bad0531b64ac7f8f070b60cfca73dead8f03d90d69341fe9097a6ed0642e4 and316orderedIDs/version remain unchanged. Combined5Sourcepaths now require one scoped independent review and Root stockbuild11/native6 actual computed/layout GREEN. Further concrete failures remain visible; no gate is waived. Full catalog/failure/cancel, broker, Task4 current-schema/compiled13081, selected/live/full8 gates remain open.


### Root actual native6 table-wrapper correction

At a67462c/build11 actual native6 failed Ops390 overflow after33passes. Root verified9PNG hashes and complete retained original-child lifecycle/hash links: browser/serverclosed, originalexit0ANDclose,5retained identities absent, two empty censuses113ms apart. Bounded diagnostic proves main client390/scroll508, ops page client374/scroll500 and cron wrapper right508/client500. The stronger assertion correctly detects actual whole-main scrolling, not a console/provider fault.

Root independently located the later mobile rule src/index.css:7279 applying min-width500px to the cron wrapper rather than its inner table. Exact approved correction changes only that selector to .cron-table table, preserving wrapper overflow:auto and the500px readable inner minimum. No speculative token-wrapper edit, assertion allowance, threshold, hidden overflow or functionality change. Root read/reviewed the one-line diff and verified16Source files,79commands/316original leaves against manifest96cf7aa9b5e50ec0a7b7e6cfd31c9244a97e33237426300a761c973aae988246. PostCSS parse/style census and diff pass; prior133focused results remain historical, no repeated cosmetic mirror tests. CSS hashf051f0a785bd472eeb914990ee2442dc3aac0af3805ad60418f48f8977dc3347. Root stockbuild12/native7 must prove actual geometry. Previous scopedSourceacceptance C0/I0/M0 stands at a67462c only, with this tiny delta subject to final scoped confirmation; all full-catalog/broker/Task4/selected/live gates remain open.


### Root actual native7 PRD footer wrapping

At8417f69/build12 actual native7 passed73assertions, including corrected Ops/table and prior responsive pages, then failed PRD390 overflow. Root verified19PNG hashes and original native exit0ANDclose/transport/serverclosure,5retained identities absent, two empty censuses113ms apart and exact lifecycle links. Diagnostic measured main client384/scroll535, PRD page client368/scroll527 and footer buttons extending to534.81px. These are real offscreen controls.

Root independently read classed PrdGenerator footer and index.css8668–8701: action/launch/input flex rows lacked wrapping and shrink bounds. Approved only src/index.css to wrap/bound existing .prd-actions/.prd-launch/.prd-launch__inputs and scoped children with useful input bases. Preserve every action/select, no evaluator or vertical-layout/fixture change. Root reviewed the six-selector CSS diff and verified16Sourcefiles/81commands324originalleaves against manifestb7d65023a39c2eb93380ed666b5965e7ccf4ed312a81b9cf6b7f62f647909edc. PostCSS/style census and diff passed; no mirror tests or repeated unchanged133suite. CSS hashe356658106765fd15f4b021206b11a4a710fd5efe82628c0684771f6ce6261e4. Root build13/native8 actual layout remains required. Fixturehash285bad.../316IDs unchanged; full-catalog/failure/cancel/broker/Task4/selected/live gates open. Final scoped confirmation includes the two tiny CSS follow-ups after accepted a67462c; no previous failure is upgraded.


### Root actual native8 compact agent header correction

At e5f14814/build13 native8 passed all80 mobile390 checks, then home768 overflow failed after81passes. Root verified21PNG hashes and retained original exit0ANDclose/closed transport/server,6retained identities absent and two empty censuses113ms apart. Diagnostic records main client762/scroll818 and overview client738/scroll806. Screenshot shows fitting upper cards and only agent-card top edges; exact lower descendant attribution remains inferred. No console/network failure.

Root independently read Overview compact AgentCard and stylesheet: tablet auto-fill/minmax100px yields six roughly116px tracks, while compact header was nowrap and its nested text div retained automatic min-content. Approved only src/index.css: compact-top flex-wrap:wrap, compact-left max-width100%, its direct text div min-width0. Existing ellipsis, density, avatars, status/actions and evaluator/fixture bytes remain unchanged. This is a causal minimum-size hypothesis for the approved layout objective; actual native9 must prove geometry, no blanket overflow-hidden or assertion exemption.

Root read census33b89ae5598189fd7d633e7765b7fa7a0cfcad349e89cbf44ea21a8897c19860, reviewed the complete diff/report and verified16currentSourcefiles/83commands332originalleaves/170linkedrecords in manifest405f5cd52ea1c7627b4904112d4d456eadf8b8e82dd7f324f0de4cfbb33f8d9a. New diff/PostCSS captures pass; prior133suite remains historical and unchanged. CSS SHA67c1854bc11978975225b5368d6f0167f7e5395fb308195c4f20e8262227f8d2. Root stockbuild14/native9 and final scoped confirmation of CSS follow-ups remain required. All full-catalog/failure/cancel/broker/Task4/selected/live gates stay open; prior failures are preserved.


### Root actual native9 bounded Run Detail tab scrolling

At2266b7be/build14 actualnative9 passed97checks, including corrected home768, then legacy RunDetail768 overflow failed. Root verified25PNGs/diagnostic and original browserexit0ANDclose/closed transport/server,6retained identities absent and two emptycensuses113ms apart. Diagnostic proves main client768/scroll879, page744/867 and rightmost rd-tab768.63..878.95. Root viewed the actual screenshot with its rightmost tab outside the frame.

Root independently read RunDetail.tsx261–274 and base/media CSS: existing local overflow-x:auto on .rd-tabs applied only below480, leaving tablet visible overflow. Exact FileMap only src/index.css; move that existing property to base so the same bounded local tab scrolling applies whenever needed. Preserve every tab/action, font/padding/wrapping, evaluator/allowlist/fixture. No blanket clipping, density change or new allowance.

Root reviewed complete two-line move/report and verified16currentSourcefiles/85commands340originalleaves/213links in manifest5e3008e4a1f7336ba9dbc7a91b7db9f4691f282cfe265abc7f3cb0e26d3460e1. Diff/PostCSSpass, CSS0f62c7fa22f9969bf18768bd1ccef43240fdba0a31a6c2aa38a2996be36ad9ff; prior133suite stayshistorical. Root cleanbuild15/native10 must prove actual geometry and reachable tabs, plus final scoped confirmation of accumulated CSS micros. Full316/failure/cancel/compiledbroker/Task4/selected/live/full8 remainopen.


### Root actual native10 full AgentCard header correction

Atbee1b35/build15 native10 passed105assertions including both RunDetail768 routes, then agents768 overflow failed. Root verified27PNGs,diagnostic/lifecyclehashes and originalexit0ANDclose/transport/serverclosed,6retained identities absent/two emptycensuses113msapart. Mainclient762/scroll859, agents738/847, four Activitybuttons end852.48..858.94. Root viewed actualPNG725378f1ae486b4f3849fe9308de1256a7efc5ca749514d02df2c52a2db45012:threecolumncardsfit but fullheaderbuttons lie outside.

Root read AgentCard128–155/baseCSS333 and approvedonly src/index.css: fullheader flex-wrap:wrap; directtextdiv min-width0/max-width100%. Preserve avatars/status/actions/grid/fonts and existingellipsis; no evaluator/fixture/globaloverflow change. The actual failing geometry and Source intrinsicminimum chain make this a required root fix for the approved responsive objective. Root verified complete diff/report plus16Sourcefiles/87commands348originalleaves/258links in manifest27f4bcfcdf0dbefb2c7a37b34613793051b8676f016b7f30ee1778357574c50a. Newdiff/PostCSSpass; unchanged133suitehistorical. CSS3d35d1e2d27c4d705ab4f3ef83bea99923916f319f30d732ceee5f1871f93d13.

Four earlier CSSmicrofixes independently acceptedC0/I0/M0 throughbee1b35 in task-3-css-micros-review.md, preserving priorSourceacceptance. This finalheaderdelta requires scopedconfirmation and Rootstockbuild16/native11actualgeometry. Full316/failure/cancel/compiledbroker/Task4/selected/live/full8 remainopen; priorfailed attempts remain failures.


### Root actual native11 readable Chat and task controls

Atfa6a/build16 native11 passed190assertions includingall160mobile/tabletchecks andcorrectedfullAgentCardbuttons, then Chat1440 fonts failed. Root verified48PNGs/diagnostic andoriginalexit0ANDclose/closedtransport/server,7retainedidentities absent/twoemptycensuses112msapart. Root viewedChatPNG1ead0b7ef544b64c196a12c272ce38c333d98b4455f89ce8b2f9880b10376a7d:AGENTS/HISTORY buttons small. SourceChatSidebar74/80 andchat-sidebar__tab0.7rem at15pxroot prove10.5px; hidden<=768 explainsdesktop-onlyfailure. ExactSourceMaponlysrc/index.css to14px, preservingpadding/sidebargeometry/actions/fontassertionthreshold.

ReadonlyremainingdesktopSourcecensus additionally foundactualTaskBoard125/134 movebuttons .task-card__arrow10px. Root independently read20×20/padding0control andapprovedonlythatfontto14px underexistingcontrolreadabilityobjective. This is Source-proven coveragegap, NOTthenative11failure orruntimeGREEN; currenttasksfixtureempty so populatedtaskarrow runtime remainsunqualified. No span/divstyling/newfixture/catalogchange.

Root reviewedcompletetwo-declarationdiff/report andverified16Sourcefiles/91commands364originalleaves/328links in combinedmanifest ae4d5c0fd9da87e0c3130551b06b47854494794048c040d66cbc6bf27618c668. CSS5712c106b6141b6097b7b98a8cb242b155f4c8b352712cf254751fd028cc0e97. Newdiff/PostCSSpass; firstChat-onlyrecords preserved; unchanged133suitehistorical/no mirrorrepeat. Rootcleanbuild17/native12mustproveChatcomputedGREEN, full316/failurecancel/visualreview plusfinalscopedSourceconfirmation required. Full8/broker/Task4/selected/live remainopen.


### Root actual native12 tab semantics and independent visual corrections

At1c359/build17 actualnative12 passedall240pagechecks (20pages×3widths×4), thenfirstlegacy390Executiontab failedUI_RUN_TAB_NOT_ACTIVE;61PNGsretained. Root verifiedeveryPNG/diagnostic/report/lifecyclehash, originalexit0ANDclose/closedtransport/server,8retainedidentities absent/twoemptycensuses113msapart. Root viewedthetabPNG:Executionisactive. Existingassertion comparedCSSuppercaseinnerText withTitleCasestartsWith. ExactadditionalMapexistingfixturemoduleandcontracttest: retainanchoredlabel/optionalbadge locator, requireexactone match/actionableclick/exactoneactive andselectedelementactiveclass, retainnoErrors/capture/all48IDs. No skippedtab/retry/presentationprefix/publicinterface. ComponentrealSourceengine withsimulatedrawlocators meaningfullycoversuppercase/count/wrongactive/duplicate/missing/ambiguous/prefix/unclickable; correctedRED6pass3fail→GREEN9/9, originalincorrectcancel-outcomeRED0/9preservedandcorrectedbeforeimplementation. Syntheticfirst240checks/fakePNGneveractualqualification; reportincompleteatfixedcancellationboundary.

Independentvisualauditviewedall48native11images plus14native12images withhashinventory. ItfoundactualfullAgentCardnamescollapsedtoslivers768 (alsoindistinguishable1440) despitepageoverflow/fontPASS. Rootviewednative11PNG7fb7c304e51a31dd4c9849d0ba370d3e7dbb18cada156303e0f7bbae22d82c2f andapprovedonlytheexistingdirecttextdivmin-width0→min(160px,100%) inindex.css, keepingmax100/wrap andallactions/density/fonts. Inlineflex1zero-basisneedsusefulidentityminimum; this is necessaryvisualrootfix. Actualreadablenamesmustbemanuallyverified; automatedpagePASSaloneinsufficient.

Auditnative12PRD1440blankscore-ring isfixturefidelitygap, notprovenlivebug. RootreadactualnullablePrdscore/listrowproducer andconsumerundefinedload. ExactfixtureMapaddsONLYscore:null/score_details:null/cost_estimate:null toHISTORY, noinventedscore/prodfallback. RealownedHTTPREDmissingfield→GREENexplicitnulls, sessionclosedfinally. ActualnewfixtureHash318f49b3b977335e95cb4c7b716324950787ce30bbbfb332cb21e2a487ff828b;316orderedIDs/version/cataloghashunchanged. Old285bad capturesremainhistorical.

Rootreadcompletethree-filediff/bothreportsandverified16currentSourcefiles/107commands428originalleaves/411linkedrecords inmanifest02282dafcbe862762122b2218f0cd6971f67bb0c290b90e018929cd385edfaf6. Final143/143focusedPASS5.049s onallfinalbytes; firstaggregate140/141old-descriptorgoldenfailurepreservedthenexactmeasuredgoldenupdated. Syntax/PostCSS/diffpass. FinalCSS45de054c94cc78fec35378fd32c45ab7dcaa350a3c6255bca3f7154129b5de1d; fixtureebb46bd9f868dc8d7dfa548bc4d992c7dceb895db97497a1640d071aa080fdfb. PriorSourceacceptancethrough1c359 preserved; thisscoped3filedelta needsindependentconfirmation. Rootstockbuild18/native13mustproveactualtabs/namewidth/unscoredringabsence, thenfull316/failure/cancel/screenshots/cleanup. No compiledbroker/Task4/selected/full8/livequalificationinferred; populatedtaskarrowruntimeunqualified.


### Root actual native13 shortcut focus and visual readback

Atf8c278/build18 native13 passed240pagechecks+all48tabs+officepersist/perfredirect, thennavigation.d-pfailedafter290passes. Root verified110PNGrefs/109uniquefiles, report/diagnostic/lifecyclelinks, originalexit0ANDclose/closedtransport/server,11retainedidentities absent/twoemptycensuses113msapart. Root viewedagents768namesnowreadable andPRD1440blankringabsent. Independent49newtab/desktoprosterimageauditconfirmsdesktopnamesunique; its nestedmobileplan-taboverflowandfixturecontract/storyfidelityfindings areseparatenewRootmappedrepairs. Galleryworkspace logs/2026-10-19-ui-audit-native-v13/index.html copies110unchangedPNGrefs/hashmanifest andtruthfullymarks290PASS1FAIL/25unexecuted.

Native13diagnostic showsunexpectedPOSTkimi-quota/refresh403. Root independentlyreadnavbehaviorcoordinatebodyclick5,5 andactualtopbannerhandleClick→load(true)POST; ordinarypollisload(false)GET. This is accidentaltestaction, notmissingpermission. ExactFileMap existingfixtures.mjs+contracttest: nonmutatingactiveHTMLElement.blur andobservedactiveElement===body beforeunchangedrealkeyboardd/p/exactURLwaits. Refusedfocuscannotdispatchkeys. No banner/product/APIchange, providerPOSTallowance, syntheticshortcut, timeout, coordinatefallback orerrorsuppression.

Root readcompletereport/diff andverified16Sourcefiles/112commands448originalleaves/543links inmanifest1d3b9753ce902eb2dcf07df39677ba05b5e0fae4a2d3e6f4127bf4d6d3e8bf69. ActualprivatebehaviorAST/DOMcallbackcomponentRED0/5→GREEN5/5 coversbutton/body/refusedblur/nonHTMLElement; ordering/zeroclicks/zeroPOST/zero keyswhenrefused. Aggregate148/148PASS5.140s, syntax/descriptor/diff0. SimulatedDOMnotactualfocusqualification. FixtureHash318f49/version316orderedIDs unchanged. Rootcleanbuild19/native14stillrequired afterpendingnestedtab/fixturefidelityrepairs; actualfull316/failurecancel/broker/Task4/selected/full8/livegatesremainopen. PriorSourceacceptanceC0I0M0throughf8c278preserved; thisnarrowfocusdeltaawaitsscopeconfirmation.


### Root native13 nested tab geometry, planning fidelity and loaded-state correction

Actual native13 mobile Contract screenshots reveal nested Raw/Memory navigation beyond the bounded page despite old tab-active/no-error passes. Exact existing File Map scripts/ui-regression-fixtures.mjs/tests/ui-regression-contract.test.ts/src/index.css: add only overflow-x:auto to existing .af-inline-plan__tabs; move the complete existing page geometry body verbatim (dedentedSHA9b15c28a87f8f7e36859361b8f12b4df72d0de91104e534033d8e578aae47071) into private assertOverflow and call after every48tabclick. Existing page checks, 1px tolerance, Source-listed computed scrollers, wrapper/control/ancestor bounds and bounded diagnostics unchanged. Causal simulated tab RED8/11→25/25; actual mounted geometry still required.

Same fixed fixture repairs actual producer DTO fidelity: per-run distinct raw verified story row/run/local identities, actual camelCase detail conversion, exact no-plan-output DTO, and direct normalized one-phase/one-item/one-story planning contract. Fixed title/evidence visibly say fixture planning/simulated only. No generated PRD/repository/operational authority. New raw/derived bodies included in DATA/hash; authority unavailable responses remain exact unchanged bytes. AST-selected fixed7contract+3story pure actualproducer closures, real ownedHTTP bothIDs and running-step probes establish component fidelity. Planning RED2/9→9/9. Initialaggregate150/151ECONNRESET retained; onlynewtestclient changed to node:http agent:false perownedfixture lifetime, no retry/suppression. Final159/1594.513s. Root read complete report/diff and verified16Source/124commands496leaves/1060linkedrecords inmanifestf8edcbef9820cbd4eaf725d286726ad7fe40e68505c46251cf289f96f2bd1b51.

Independent combined review accepted focus5334/payload/CSS/evaluator but correctly found I1: active class can precede async InlinePlan Promise.all and geometry could measure loading. Root exact additional two-path ruling before implementation: only Run Contract standard bounded waitForFunction under unique .rd-contract-wrap; require no visible loading and unique visible exact successful fixture title, one item/evidence and story ID/title before unchanged geometry. Existing8000ms default unchanged, no sleep/customretry/errorallowance/injectedDOM/authority change. Deferred actualSource-engine component RED0/5→GREEN5/5 proves zero placeholder geometry then loadedoverflow refusal, bounded success and unavailable/wrongtitle refusal; final164/1644.480s logSHAbf568fdcdfe28dfd96a1b91a0155f1bd5c8ba125adecc08173e005f858fbc2ef. Root read full delta/report and verified16currentSource/129commands516leaves/1085linkedrecords in supplementalmanifest198d032e688dee31386eb5d3eb29c4d3e7a78c95abea1c8672053d46e9811335. AllcausalREDs/transportfailure/prior159 preserved.

Final Source fixtureb34f513c9f49908fde654596728836aa81e4ab4f919de1938040d493870e35d5, test6dbcd8b3a32e18ffe972d6afab3a3966a8f06428a1d3ca3ff5b802d276d9b2be, CSS3052dc2016301ac49688ade98783b6dfeb26fc4cbbb14eb0027c447f64c0d1bf. FixtureHashb662bf27e6ab9479a47986c4cc35c5cd9a23e301f695f5cb142c0e15712e3aa4; version/316orderedIDs/catalog unchanged. Independent readiness review C0/I0/M0, SHAaa9a5f4d6b233174f8e4dd14dbbbee547cec49fc58b534fc9ccddd51c4e3eab8, preserves other combined accepted portions and prior Source acceptance. No repeatwholebranchreview.

Root cleanbuild19/native14 now must establish actual all316, real focus shortcut, loaded contract title/one-story/readable simulated evidence and bounded nested navigation across390/768/1440. SimulatedDOM/fakePNGs do not qualify runtime. Deliberate native failure/cancel cleanup, selected broker, Task4 current-schema/sealed200, populated task arrows, compiled17/currentmaterial/full8/guardedlive gates remain open.


### Root actual native14 loaded Contract mobile layout

Atc2c0f08/build19 actualnative14 completes243checks242PASS1FAIL54.720s, log463BSHA6ba50eeaada311fe009fee1d47f71d5ce8ec381785f4bdbcd34db757cd732e0b. All240pages plusExecution/Pipeline passed; loadedlegacy390RunContract correctlyfailsUI_HORIZONTAL_OVERFLOW main384/471/page368/463. Rootverified63PNG/diagnostic/report/lifecyclehashes, originalnativeexit0ANDclose/closedtransport/server,8retainedidentities absent/twoempty113ms. Rootviewed7f30d31cdcaa0f2897e1fddc6c4ccc2556dfebc2a178bb65bbcc698f777b0052: loadingresolved, localnestednavscrollpresent, mainbarandtitletruncationvisible. Storyfixed5columnminimum452px isSourceevidencebelowviewport, notclaimedvisiblePNGdetail.

ExactRootapprovedexistingFileMapONLYsrc/index.css: summaryflexwrap,mainbasis160/metrics180/max100,titlewrapanywherewithoutellipsis; <=768storytwo minmax0columns retainingfivefieldsDOMorder; mobilelabel/evidence/title/metawrapwithoutellipsis. Owner/status/item/grid/section sizing/fonts/actions unchanged. ActualnativeRED+sourceminimumsuffice; noCSSmirrortest/no164suite repeat. FullPostCSS/diffchecksPASS; Rootreadfulldiff/report andverified16Source/131captures524leaves/1112linkedrecords inmanifestccb3dc10c6be9a35ec43699e2a89c4a3e0d8dee02e2507bcc9c90df12bf1d0b8. FinalCSS73cc87a89b84739689241f8b20b2692d6592e4ce898ed380ec968b90326ea061, exactinversehashverified. ScopedindependentC0/I0/M0 receiptSHA61d50a0c3f23ea12e43fbafef5d68a87a99dd114f4b2ca67b2e7c7b4a9111a3f; prioracceptancespreserved.

Rootcleanbuild20/native15 mustprovecomputedGREEN, loadedtitle/readableitem/story/nestedscrollacross3widths andall316behaviors, thenactualfixedfailure/cancelcleanup. FixtureHashb662bf27/catalog316/authorityunavailable/evaluatorbyteunchanged; no richauthority/populatedtask/broker/Task4/selected/full8/livecredit.


### Root actual native15 Agent readiness and Contract bottom framing

At7db7162/build20 actualnative15 completes300assertions299PASS1FAIL71.619s, logSHA73a7c91f2b2511b2b19149eb3dcbff320a909c66eea8a2faab9b9fc3db5d976c. All240pages/48tabs+fixedshortcut/input/IME/modifier/search/mobilefocuspassed. Firstnewbehavioragents.grid-panelfailsimmediateidleinnerTextwithnogenericerrors;119PNGhashes/diagnostic/lifecycleallverifiedbyRoot, originalnativeexit0ANDclose/server/transportclosed,11cohortabsent/twoempty113ms. RootviewedContract3908cf411398781803d2ca75df6e743b0e7a024c5a06b1949db5c8e0fc2930f7f40 titlefull/mainbarabsent and14405ebe44204b1201f7bf20e9aa115cb913109270c5c526a77ea61330dc036f412c readableitem/evidence/story; belowfoldmobilewasnotvisible andnotcredited.

RootreadAgentLivePanel45–78 asyncdata=null/fetch andexistingbehavior849–857 immediatepanelvisible→innerText includesidle. Exactapproved2pathMapfixtures.mjs+contracttest: standardexisting8000mswaitforuniquevisiblepanel/no loading-or-error/uniqueheader rawidle+idleclass/visibleemptyoutput beforeunchangedcapture→realEscape→hidden. No sleep/retry/POST/response/productchange. Actualprivatebehavior/assertclosureASTVMdeferredtestsprovezerocapture/Escapewhileloading andrefuseerror-withidle/fallback/wrongstatus; rawlowercaseidleworkswithuppercaseinnerText. FirstREDmixedprivateassertclosureissuepreserved; correctedRED2/11 thenGREEN11/11. Affectedcompletecontract114/1142.499s logSHAa9e45e0b07e21c9e1b02cb9e6cc5b301aeac99b83b2c49996d9ab7bbc3ff0cb2. Unchangedlifecycle/broker164aggregatehistorical, notfreshall-suiteclaim.

ExistingfullPage:truedoesnotexposeinternalscrollingmain. Same6Contractcapturesnowstrictactualstory.scrollIntoViewIfNeeded AFTERpositivecontentreadiness andBEFOREunchangedgeometry/noErrors/capture. NoaddedIDs/screenshots/viewport/DOM/stylechanges. Componentproveszeroscrollloading/refusal,onescrollsuccess→geometry→capture; loadedoverflowstillrefuses. Prior6native15topPNGsretainedfortitlecomparisonwithnextactualbottomframes, sameCSSbuttimingdiffexplicit.

Rootreadcompletetwo-pathdiff/reportandverified16Source/137captures548leaves/1161linkedrecordsmanifest9fd6afd62b004f99a7fc2a7fbd4d33e84f84e29081c858dd0e6a4e598e8d68c5; syntax/catalog/diff0. FinalfixtureSourcea0af8fb69d8fd6bb451c892859817f808f71fd1d1a735c73af24164c6646baf6,testccf486af5ab216f6ebac78fc7cc8ceb7702ce81da79068bc5dd06ccb12c28c81. CSS73cc/payloadb662/version316IDs/evaluator/capsunchanged. ScopedindependentreviewC0/I0/M0 SHA684a88f2c75f9e05caef706bcbf9358d46223e38e8ff16066a33c69ee88e1b96, prioracceptancepreserved. Rootbuild21/native16stillrequired forall316/panelEscape/6bottomframevisuals, thenfixedfailure/cancelcleanup; broker/Task4/compiledselected/full8/live gatesopen.


### Root actual native16 metric semantics and complete owner text

Actual native16 at fca923c/build21 completes308 assertions307PASS1FAIL metrics.zero-unknown,78.508s; eight remaining behaviors unexecuted. All240 page checks/48tabs and preceding Agent/PRD/Rules behaviors passed. Root verified127PNG refs/3 diagnostics/report/lifecycle links, original native exit0 AND close, closed transport/server,11 retained cohort members absent and two empty observations113ms apart. Native16 remains failed, report066ab4adab2eaca14fdfefbb2f42586ae9fd31724cd45cbdc21ec54d3969e55a. Root viewed actual Ops/performance images: correct CPU Unknown, known zero values and Performance today Unavailable. Old global body Unknown/$0 assertion is the harness cause, not a product metrics bug.

Exact approved existing File Map: scripts/ui-regression-fixtures.mjs, tests/ui-regression-contract.test.ts, src/index.css. Metrics keeps routes and standard visible wait; actual scoped DOM evaluator requires one visible page-owned scope, four direct rows/cards with unique direct labels/values, exact expected label/value bijection. Raw text preserves zero versus unknown/unavailable, unrelated header decoys cannot pass. Actual private behavior/assert AST/VM causal RED0/9 to GREEN9/9 and affected contract123/123 PASS2.524s, original log3bc6b50933af2ad56cb225bb761e1cb5ab5f1f647664c3128924b3d81b460a3d. No unchanged lifecycle/broker aggregate repeated.

Independent visual audit examined20 refs/18 unique native15-top/native16-bottom images with separate-run attribution. Contract owner fixture-agent-1 was ellipsized without expansion at390/768/1440; Root viewed mobile bottom frames. Only owner override adds min-width0, normal whitespace, anywhere wrap, visible overflow and text-overflow clip. Existing82px column/grid/status/fonts preserved. Actual visual RED plus Source cause establishes need; no CSS mirror test. PostCSS/diff checks pass, actual readable owner still awaits native17.

Root read full final three-path diff/report/review and independently verified manifest586c4956441c76f47ff233fb1fb652f707618c96abcd2c41bf46a7d63ad1676b:16 Source files,143 original commands/572 capture leaves and1244 total recursively linked hash/byte records. Independent scoped acceptance C0/I0/M0 receipt8ddf8cb1f14e3af3cbb2210aa1d94b1983b8f0cb1c3962a43e8dafe8ac902d20 preserves prior Source acceptance. Final fixture Sourcef40d6ff5295590e5ad0b8fa55694f4b9e4fe64479bc0ad29854c30c67e1807f9/testa14883313b9161f0aafbe914608357d57f63bc4d31e3f7201bf07aa9fefe1eec/CSS8cf138875aa2484a9ce0668dac8be01d776976143a1ebca9a36395c98383c111. Payloadb662bf27/version/316 ordered IDs/catalog4ded731c unchanged. Root clean build22/native17 must establish actual scoped metric GREEN/full owner at all widths/all316, followed by deliberate failure/cancel cleanup. No broker/Task4/compiled17/selected/full8/live/cutover credit.


### Root native17 accepted-POST transport and bounded failure diagnostics

Actual native17 at145d1acc/build22 produced313assertions312PASS1FAIL controls.lost-response-reload-idempotency (alert8s timeout),3unexecuted/132PNGrefs. Metrics and preceding4Controls behaviors passed. Root verified allcandidate/PNG/childleaf hashes and personally viewed6Contractrefs/4unique images: full owner fixture-agent-1 now readable at390/768/1440, mobile evidence/story readable. Gallery logs/2026-10-19-ui-audit-native-v17/index.html truthfully records failed candidate/UNKNOWNcleanup. Native17 finalstderr declared UI_OWNERSHIP_UNKNOWN; onlyintent/observednativeleaves exist, original Node20893/browser20907 remainedretained. Nooriginalterminal/settlement/cleanupcredit, noexactclosecause proven. Root retained readonly4membernativeidentity metadata; no signal/adoption/CDPreconnection. Quarantine archives374Source+291buildcontent+identity666files8182092B, manifest4041aaf03953dff52bee7a6daf45f23dc153cccc8f4348d8034723a48bf2f04f. Source release ffba00df ruling preserveshistoricalUNKNOWN and explicitly makesnoongoingSource-stabilityclaimafteredits; lateroriginalterminalmustrecordanyintentionaldrift.

Exact causallynecessary FileMap: scripts/ui-regression-fixtures.mjs, tests/ui-regression-contract.test.ts, scripts/ui-regression-lifecycle.mjs, tests/ui-regression-lifecycle.test.ts. Source provesno productautomaticretry/pollPOST. Old server res.destroy beforeheaders recordsfaultintent but diagnosticzero browserfailureevents cannotdistinguishtransportreplay/pending. FixedacceptedPOST sendsHTTP200 JSON/Content-Length2/Connectionclose/onebyte{ thenowned socketendafterwritecallback; no completefirstreceipt. ActualownedHTTPcomponentRED0/2→GREEN2/2 provesprefix/incompleteness thenexplicit samekey/body/samejob replay. Originalalert/reload/manualconfirmation/retry/onejob/reconnected assertions unchanged. Strictonefaultbudget nowrequiresintendedexactERR_CONTENT_LENGTH_MISMATCH pairedbrowserrequestfailed+consoleidentity; actualChromiumspelling remainsunqualified. No permission/endpoint/allowance/data/catalog/CSS/productchange.

Newboundedlostresponsefailureevidence retainsmaximum4launchhash/key/jobbindings/4matchedresponses/4failures and classifiedbusy/alert/notice/jobstate; noarbitraryDOM/UItext/fullbody. Nativeclosecatch addsfixedphase/errorcode, existingidentity/hash/count/flags, lastsnapshot-or-observePID andlastsuccessfulmetadatahash/count; nonewobservation/action/guard/timing/ordering/cleanupauthority. Sameoriginalexception survivesdiagnosticpublicationfailure; settledleafretainedifclosedpublicationfails, no closedproof. Existingnever-invokedbranchunchanged. Nohistoricalcauseinference.

IndependentreviewcorrectlyfoundI1 optionalfailurepage.evaluate unboundedbydefaulttimeout. Same2fixturepaths addonlyfixed1000msrace/finallycleartimer, timed_out versusunavailable, preservingoriginalfailure/cleanupcontinuation. ActualprivatecallbackRED1/7 includesnever-resolvingobservationstalledat1600mswatchdog; GREEN7/7 proves~1000mscompletion/timercleanup/immutablefailureunchangedafterlatereply. Initial174/174/pre-I1report733ebe/manifest505b preserved; final175/175PASS4.450s original1b0269374865288d756c45e5af06762c5be8d75663e0a5871345b4a270506df3, nofail/skip/cancel/forcedtimeout. Syntax/catalog/diff0, unchangedbrokerunrepeated.

Root readcomplete4pathdiff/reports/causal+finaloriginals andverifiedfinalmanifest57e26cd7db317906b0d7ac89c8d96234c386da2ee50d7c003b6a7f98deed661b:16namedSource+322fullhelperSourcehashes,160commands640leaves,1324recursivelinkedhash/byteentries. ScopedindependentSourceSpec/QualityAPPROVED C0/I0/newM0, I1resolved, receipt1b957da4816c7d8e5d97c4a29babee3d1f1b06113c2dfcb78576004f700efe3f. Finalfixture6dbcb7ceaa3388ad2c79e137755e289f7f663fe108f924dc7abbf7e1d903860d; contract4985a9ff5d4aae717ff42aa57adb3f9030cb1e5574e20de431fc41d9b24067e3; lifecycled8c0944a61419c27db2f045dbd6163d8861d359c3d3fa3eed32afc64dcaa94a9; lifetest e0f3d96ab2db9810aaa56c2e08737d1f96c16fe11aba91c4807d79095151f3a2. Payloadb662bf27/version/316IDs/catalog4ded731c/evaluator/ownershiplimitsunchanged.

Rootcleanbuild23 and freshguard/resourceassessment precedeneworiginalnative18. Onlythatnewexecutioncanqualifyitself; historicalnative17UNKNOWNneverupgraded. Actualall316/strictfaultclassification/remainingControls andnativeoriginalexit+close/server/cohort/twoemptyproofs, deliberatefailure/cancel, selectedbroker/Task4current-schemaPGsealed200/compiled17/currentmaterial/full8/live/cutover remainopen. Currentlive3080/3333/18789HTTP200 at10:35UTC, disk11.22GB>8GiBfloor; actualmemory_pressurequery52%free (health98%usedisnotpressureproof). No servicecutover/data deletion performed.


Task4 Source coordination continues under Root settlement9c53a607 and logger/private-parent-proof rulingf88b310f190b802119beff07b3fe0bc0259e95294cf006ae555b8291e42dff0e. The existing2SF/5MCMap and launch/setup/ready wires are unchanged. Fixed parent-result/runner-result private outputs preserve originalhandle proof ownership; restricted-role-only statement/error logging follows credential creation, global statement/error-statement capture excludes setup credentials, parameters remain suppressed. Exact33SQLinventory/6SourcepinsRootreadback7e7d6f25a65d431b8192fac5f08f0c92ab8f7f13e55ae691f10325f45985e989 is a finite implementation aid, not actualSQL/runtime evidence. SFwriter continues pure/componentintegrationSource; MCfivepathTask4Source waitsfornativequalificationboundary. NoactualTask4PGstarted.


### Root native18 retained-child observation reconciliation

Actual native18 at5664c3ed/build23 passed all316 ordered assertions and retained136 PNG references, including the exact intended lost-response request/console pair. Cleanup remained UNKNOWN at pre_close_census while observingPID89981. No original terminal or settled/closed leaf exists. The failed ps substep and89981 retained eligibility are unproven. Root archived all374 Source files and291 build-content files plus identity (666 files; manifest5daff85ec81c141ae851b7458c6588c29e98a04df9f9d47cc7fb07edf774de39); original native17/18 handles remain untouched. Source release supplies historical inputs, with no continuing Source-stability or retrospective cleanup claim.

Root material2dc11e6a3341a7312036744f397aa411b91b0351a9caa0612de6d4df42cd8eee proves only that an original naturally exited controlled Node child yields fixed single-PID ps exit1/close1 with exactly empty output. The causally necessary File Map is only scripts/ui-regression-lifecycle.mjs and tests/ui-regression-lifecycle.test.ts. Ruling81959cb3a416cf5295e502ea9e0f7e69085e24f5550e329af3997be8f4357fb7 permits a narrow first-pre-close reconciliation for a previously fully retained non-root identity. It requires original fixed-helper exit AND close, exact empty absence classification bound through private WeakMaps, validated successful metadata/command/executable prefixes, matching UID/start/group, a fresh complete global census absent everywhere, durable private hash-addressed witness, and full candidate rescan. Reappearance, new/root/foreign/reused/escaped owner, partial or ambiguous helper/census, publication fault and every unknown state still refuse. Original cohort, public proof shapes, close ordering,256-owner cap and one shared30s deadline remain; each added await/rescan is guarded. Production uses the default original spawn; the private test factory exposes no fixed-entry selector.

Original behavioral RED fails all three before/comm/after disappearance cases with UI_OS_OBSERVATION_INVALID, followed by4/4 GREEN. Precision matrix45/45 covers42 refusals plus running-census refusal and newly discovered member validation. Final affected lifecycle+contract aggregate225/225 PASS7.212s, original log b9a47a53f82c02600bddb18f36f811f06e6ae5bb819d51da05f111b28e0a3e6c, no skipped/cancelled/forced timeout; syntax/diff checks pass. These are component tests with simulated original handles, not native qualification.

Root read the full two-path diff, report and causal/final originals, and independently verified1372 linked hash/byte records plus322 current Source hashes in manifest8d617190ad27ad5691a3a43b5cafe8097fdbd6f62d9b251bbfc4a3c080d2c506 (Root receipt2bb6e35388b5483c22946fbda87ddb3388bc02fff3b78c6db825e033b950cb0b). Independent scoped Source Spec/Safety/Quality review c3199f4ce0e6e4143ce92db22d2e4107a5e7e12e8bc042e3a7f35ef436bec13f approves C0/I0/newM0 and preserves prior accepted scope. Final lifecycle b3eb1ab0bd8ffed848c378a943d6ef4429d6f521509d2fbc61db6afb43a3bdad; tests443c964ad2feec2e1abf811d9162d51f9835bfa1274024f043e48552243c7a48. Fixture DATA b662bf27/version/catalog316/evaluator/CSS unchanged.

Root next: clean stock build24, fresh resource/current guards, actual fixed assertion-failure and owned-cancel profiles first. Then only existing fixture+contract paths may be refined to frame the last four Controls Owned progress captures, followed by fresh full316 native qualification and visual readback. No historical UNKNOWN upgrade. SF Task4 two-file Source continues; paired current-schema PG/sealed200 render, selected broker, immutable reviewed SF build, compiled17/current material/full8/guarded live gates remain open. Read-only11:13UTC HTTP3080/3333/18789 all200, health/database/gateway up,11.33GB free and memory_pressure49% free; health percentage warnings alone are not pressure proof. No live cutover or deletion performed.


### Root build24 and actual negative lifecycle profiles

Clean stock build24 passed3.185s atf6ded0d4556297af47a400bc2a6719998d0a511c, tree4f46b91fa3bf1a122017fc1f1b63f09dd7df542b, build5ce0df33f7360fa3644fda8cfad040ef81b8591c2c538b314d98a54ad43dcd5b. Root independently reproduced all291 content hashes; original3908-byte build log7b1d8ef9afccca715294efc87b185e0ef3d26e84c6f2f49696563ba8d1a4ee6c. No dirty-build or forced timeout. Prelaunch13082 listener absent,11.33GB free above8GiB floor, memory_pressure49% free.

Actual fixed assertion-failure profile completed1.586s with original entry exit1, exact sole page.home.390.loaded FAIL/UI_PROGRESS_FAILED, one home-390 PNG and decision continue. Actual owned-cancel profile completed1.569s with original entry exit1, exact sole loaded assertion PASS/code:null, one home-390 PNG, incomplete report and decision cancel. Both used unchanged Source/build and real default ps/native helpers. Root verified every report/PNG/intent/owner/cleanup/final-decision/native-leaf hash; both native roots exited0 without signal with original exit AND close, transport and fixture server closed, five retained cohort identities absent and two empty census records113ms apart. Raw census bytes are not retained, so no independent raw replay is claimed. Original logs98f5c0386dae05011b9d9ce7c8a0b9582d812667d8ee20924aeca921fb242c82 and4d090b5c9b850584b879685744f6920fd8bff830dc0a7224fe3da997ca206ab5 remain. Root first readback assumptions used a wrong capture prefix and omitted passing code:null; corrected from the existing Source without rerunning a project test. Neither negative profile qualifies the full316 or historical17/18 UNKNOWN.

The remaining native18 visual gap is framing: last three Controls frames show the page top, hiding Owned progress, and lost-response only partly frames it. Exact next File Map is existing scripts/ui-regression-fixtures.mjs and tests/ui-regression-contract.test.ts. Only after each unchanged final positive assertion in the four existing last Controls behaviors, scroll the unique Owned progress region into view before the unchanged existing capture. Keep route/catalog/order316, fixture DATA/hash, all assertions and thresholds, capture IDs/count, viewport, noErrors and cancellation behavior unchanged. No new synthetic state, product/CSS change, retry, sleep or error allowance. Causal actual-private-behavior component coverage must prove the scroll occurs after final state evidence, and refusal cannot fall through to successful capture. Native18 originals stay untouched; only a fresh full run can provide the new bottom frames and current native closure proof.


Root read the full final framing diff/report and original causal/failure/GREEN/final contract captures. RED4/21 proves old unframed capture; first GREEN-named19/26 caught an early misplaced Source insertion, retained unchanged; final corrected26/26 and contract158/158 PASS4.345s, original97fb18a434f439353850b7f6c6bd70d712d1a6bbc271db484567742618d00a40. Syntax/descriptor/diff pass; unchanged lifecycle suite not repeated. Root independently verified1402 linked records and322 current Source pins in manifesteb0186d1c5a6534be6db5cc90ba5f398a194cf95590b8aff82bc7eabc01e12e0 (receiptde7199ef500094c3de0e44e4a8edc8ec1cad5d3aeb616be1e29905f2e28c395c), and removing exactly four inserted lines reproduces prior frozen fixture6dbcb7ce bytes. Final fixture e820a2e17f03cc17988328f250d61a63612846e2f35b71f9416d8563a1727728; tests a98e9c324e58eec4087579e93030281f9ad384969129552401ab5cf0366353ad. Independent exact-scope review bd7650a61b1d18863e5ed84e8685d4510e4077c9396ecbefa6183f53e1a956cf approves C0/I0/newM0. Prior Source acceptance and unchanged DATA/catalog/evaluator/lifecycle retained. Root cleanbuild25/newnative19 must still prove actual framing/all316/closure; current Task4/selected/full8/live gates remain open.


### Root Task3 native19 verified boundary and Task4 Source freeze

Task3 fixed-fixture qualification is now complete at MC0b9e7add4ab3a3d71f826be8e721ffd1f009b55d and clean stock build25, content hash0fcf6c92d112432797780e34fb81d146d11227f49a46e28417a67bfa6ffd72e1. Actual native-pass-v19 exited0 in85.937s without forced timeout; all316 ordered assertions passed, with136 screenshot references/128 unique PNGs. Root verified the original log0946859c708c99b38ba9f94e76ac68917b81657796ed230bc0c603cadb6a5831, reports, screenshot hashes, actual native exit AND close, closed transport/server,11 retained cohort absences and two empty censuses114ms apart. Root viewed the four newly framed Controls panels; the independent prior136-frame visual review retains its product-UI scope. Workspace gallery: logs/2026-10-19-ui-audit-native-v19/index.html. Historical native17/18 remain UNKNOWN and untouched; native19 does not explain or upgrade them. This is fixed-fixture UI/native evidence, not private-PG, selected controls, provider, full8 or live rollout qualification.

Task4 retains exactly its existing five-file MC File Map above. Paired SF Source is separately reviewed/committed at02ca06f373fe7159d56063ef2cf23d72a361c8fe, draftPR298; its three mapped paths include the causally required test-only initialization-retention helper. Root accepted workspace logs/2026-10-19-ui-implementation/accepted-task4-{private-wire-proposal,dataset-observation-addendum-proposal,inner-settlement-interface,inner-settlement-ledger-addendum}-v1.md and the private-driver/settlement/logger/policy/publication rulings. No product feature, public schema, source authority or runtime guard is expanded.

Required causal corrections within the existing MC Map: consume the private fd4 frame before bootstrap; restrict fixed pre-bootstrap self-refusal to that lexical resource-free boundary; defer configured product parser imports until authenticated private HOME/environment; retain exact strict six-key V3-200 validation while accepting canonical key order; keep both operational snapshots Source-valid200 and the single exact legacy409 exception; retain original mock custody even if publication fails; retain partial render/PNG facts before cleanup; keep raw lsof originals outside the consumed artifact graph; publish only graph-consumed listener leaves; expose fixed final evidence only after complete fsynced pending bytes and exclusive hard link, retaining original inode/uid/exact0600 through final single-link readback; enforce the unchanged live-read deadline before work and positive return. Actual owned policy uses accepted localhost:exact-port SBPL grammar, since the retained original numeric-host capability failed parsing. Fixed original probe output remains byte-exact after canonical record parsing. No wildcard endpoint, broad error allowance, forced cleanup, adoption or caller-supplied success callback is introduced.

The completed Source path now composes private original initdb/postmaster/P3, original fd4 delivery and ancestry, restricted observer, fixed mock and sandboxed compiled MC server, actual strict proxy preflight, unchanged default native lifecycle, six mounted routes, parent-owned canary/probe, closed artifacts/results, independent DB/role/projection absence and outer settlement. Root read the complete original integrated-components-v2 log:236/236 PASS, no skipped tests, exit0/5.463s, unchanged Source during its own capture and no forced timeout; SHA2560ec997ee6688dfe5c0bb697c296e8c2d0adacbcb0600ddabd28453e71134ba02. All earlier failures remain retained. Component seams are not actual PG/server/browser proof. Final frozen Source/pairing review, Root clean commit/build, and actual positive/assertion-failure/owned-cancel with original SQL/network/FS/native/cleanup readback remain required; no Task4 actual success is claimed here. Root owns Git/build/effects/delivery. Docs-only annotation needs no repeat of unaffected236 or316 checks.

For later compiled17, Root read the exact incorporated requirements and the finite audit compiled17-observation-requirement-audit-v1.md (SHA25674ab6365504a2e119ff65674019c7b2e652ecaba849dc046a2e84817a268c7d9). Authentic acknowledged A/B, original children/refusal stages, real filesystem inventories, isolated PG connection/query audit/state and truthful external coverage remain mandatory. Complete host-global/own-UID tracing is not an accepted execution prerequisite; no global zero-attempt claim follows from Source ordering, unchanged rows or absent credentials. New reviewed merged immutable release, selected production broker, actual unchanged full8 and guarded rollout remain independent open gates.
