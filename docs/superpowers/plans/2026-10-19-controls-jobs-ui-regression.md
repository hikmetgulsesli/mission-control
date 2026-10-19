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
