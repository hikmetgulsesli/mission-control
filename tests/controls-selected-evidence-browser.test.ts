import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { isAbsolute, join, normalize, relative, sep } from 'node:path';
import type { Socket } from 'node:net';
import type { Server as HttpServer } from 'node:http';
import type { Page, Request, Route } from 'playwright';
import type { ViteDevServer } from 'vite';
import type { ControlEvidenceEnvelopeV1, ControlJobReceiptV1 } from '../src/lib/control-evidence';
import type { OwnedProfile } from './fixtures/controls-selected-evidence-owned';

// No runtime fixture/native/Vite import or acquisition before the test gate.
const enabled = process.env.MC_CONTROLS_SELECTED_EVIDENCE_QUALIFICATION === '1';
const options = { timeout: 180_000, skip: enabled ? false : 'Root qualification requires MC_CONTROLS_SELECTED_EVIDENCE_QUALIFICATION=1; SKIP is never native PASS' };
const SOURCE_ROOT = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const JOB_A = 'a1111111-1111-4111-8111-111111111111';
const JOB_B = 'b2222222-2222-4222-8222-222222222222';
const S = 'c'.repeat(64), H = 'a'.repeat(64), T = 'd'.repeat(64);
const AT = '2026-10-20T00:00:00.000Z';
const PENDING = 'mission-control.controls.pending-launch.v1';
const PENDING_JOB = 'mission-control.controls.pending-job.v1';
const SELECTED = 'mission-control.controls.selected-job.v1';
const EVIDENCE = '/api/controls/evidence', JOBS = '/api/controls/jobs';
const OBSERVATION_HEADER = 'x-mc-controls-fixture-request-id';
// Self-contained browser JavaScript text: tsx/esbuild must never serialize a
// callback containing keepNames helpers into the page. No helper polyfill.
const CONTROLS_READ_OBSERVER_INIT_SCRIPT = String.raw`(() => {
  const header = 'x-mc-controls-fixture-request-id', cap = 512;
  // Passive observation only. Return each ORIGINAL fetch/json promise and
  // leave its Response, fulfillment value, and rejection reason untouched.
  const records = [], faults = [], responses = new WeakMap();
  const note = (code) => { if (faults.length < 32) faults.push(code); };
  const originalFetch = window.fetch, originalJson = Response.prototype.json;
  let nextFetchId = 0;
  window.fetch = function(...args) {
    const promise = Reflect.apply(originalFetch, this, args);
    /** @type {any} */
    let record;
    try {
      const input = args[0], init = args[1];
      const url = new URL(input instanceof Request ? input.url : String(input), location.href);
      if (!url.pathname.startsWith('/api/controls/')) return promise;
      if (records.length >= cap) { note('READ_OBSERVER_BOUND'); return promise; }
      record = { fetchId: ++nextFetchId, requestLedgerId: null, url: url.href,
        method: init?.method ?? (input instanceof Request ? input.method : 'GET'),
        fetchState: 'pending', jsonCalls: 0, jsonState: 'not_called' };
      records.push(record);
    } catch { note('READ_OBSERVER_REQUEST_UNKNOWN'); return promise; }
    void promise.then(response => {
      try {
        record.fetchState = 'fulfilled'; record.status = response.status; record.responseUrl = response.url;
        record.requestLedgerId = response.headers.get(header);
        if (!/^[1-9][0-9]{0,2}$/.test(record.requestLedgerId ?? '')) note('READ_OBSERVER_HEADER_UNKNOWN');
        responses.set(response, record);
      } catch { note('READ_OBSERVER_RESPONSE_UNKNOWN'); }
    }, () => { record.fetchState = 'rejected'; note('READ_OBSERVER_FETCH_REJECTED'); });
    return promise;
  };
  Response.prototype.json = function(...args) {
    const promise = Reflect.apply(originalJson, this, args), record = responses.get(this);
    if (record) {
      record.jsonCalls++;
      if (record.jsonCalls !== 1) note('READ_OBSERVER_JSON_AMBIGUOUS');
      record.jsonState = 'pending';
      void promise.then(value => {
        try {
          record.jsonState = 'fulfilled';
          const serialized = JSON.stringify(value), bytes = new TextEncoder().encode(serialized);
          record.jsonBytes = bytes.byteLength;
          if (bytes.byteLength > 262144) { note('READ_OBSERVER_BODY_BOUND'); return; }
          void crypto.subtle.digest('SHA-256', bytes).then(digest => {
            record.jsonBodyHash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2,'0')).join('');
          }, () => note('READ_OBSERVER_BODY_HASH_UNKNOWN'));
        } catch { note('READ_OBSERVER_JSON_VALUE_UNKNOWN'); }
      }, () => { record.jsonState = 'rejected'; note('READ_OBSERVER_JSON_REJECTED'); });
    }
    return promise;
  };
  Object.defineProperty(window, 'controlsReadObserver', { value: Object.freeze({
    snapshot: () => ({ records: records.map(record => ({ ...record })), errors: [...faults] }),
  }) });
})();`;
const receiptPath = (id: string) => `${JOBS}/${id}`;
const evidencePath = (id: string) => `${receiptPath(id)}/evidence`;
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const unavailable = (code: string, state: 'unconfigured' | 'missing' = 'unconfigured') => ({ availability: { state, code }, report: null });
function envelope(code: string, selectionHash = S): ControlEvidenceEnvelopeV1 {
  return { schema: 'mission-control.controls-evidence-envelope.v1', selectionHash,
    evidence: { activation: unavailable(code), evaluation: unavailable(`${code}_EVAL`), ui: unavailable(`${code}_UI`) }, history: [] };
}
function receipt(id: string, terminal: boolean): ControlJobReceiptV1 {
  return { schema: 'mission-control.control-job.v1', jobId: id,
    kind: id === JOB_B ? 'convergence_full8' : 'activation_preflight', revision: terminal ? 6 : 5,
    selectionHash: S, sourceSha: 'e'.repeat(40), mcSourceSha: 'f'.repeat(40), mcBuildHash: 'b'.repeat(64),
    suiteHash: id === JOB_B ? '8'.repeat(64) : null, state: terminal ? 'completed' : 'running',
    requestedAt: AT, startedAt: AT, updatedAt: terminal ? '2026-10-20T00:00:06.000Z' : '2026-10-20T00:00:05.000Z',
    finishedAt: terminal ? '2026-10-20T00:00:06.000Z' : null, phase: terminal ? 'closed' : 'running', code: null,
    currentCaseId: null, ownedRunId: null, completedCases: 0, plannedCases: id === JOB_B ? 8 : 0,
    reportRefs: terminal && id === JOB_A ? { activationHash: H } : {}, cancelRequested: false };
}
function selected(code = 'SELECTED_A_PASS', historical = false): ControlEvidenceEnvelopeV1 {
  // Exact-job envelopes retain the backend's currently captured selection S;
  // historical ownership is the receipt's T plus report compatibility.
  const e = envelope('SELECTED_A_UNCONFIGURED', S);
  e.evidence.activation = { availability: { state: 'available', code: null }, report: {
    hash: H, status: 'pass', protocol: 'v3', compatibility: historical ? 'historical' : 'current', observedAt: AT,
    checks: ['migration_shape','migration_attestation','database','artifact_capacity','activity','protocol_activation']
      .map(id => ({ id, status: 'pass' as const, blocking: true, code })),
  } };
  // A selected envelope's history must never replace the global History view.
  e.history = [{ id: '7'.repeat(64), sourceSha: '7'.repeat(40), evidence: {
    activation: unavailable('SELECTED_HISTORY_ONLY'), evaluation: unavailable('SELECTED_HISTORY_ONLY_EVAL'),
  } }];
  return e;
}
function model() {
  const global = envelope('GLOBAL_ACTIVATION_UNCONFIGURED');
  global.history = [{ id: '9'.repeat(64), sourceSha: '9'.repeat(40), evidence: {
    activation: unavailable('GLOBAL_HISTORY_ONLY'), evaluation: unavailable('GLOBAL_HISTORY_ONLY_EVAL'),
  } }];
  return { global, receipts: new Map([[JOB_A, receipt(JOB_A, true)], [JOB_B, receipt(JOB_B, false)]]),
    evidence: new Map([[JOB_A, selected()], [JOB_B, envelope('SELECTED_B_UNCONFIGURED')]]) };
}
type Model = ReturnType<typeof model>;
type FetchObservation = { fetchId: number; requestLedgerId: string | null; url: string; method: string;
  fetchState: string; responseUrl?: string; status?: number; jsonCalls: number; jsonState: string;
  jsonBodyHash?: string; jsonBytes?: number; error?: string };
type NetworkRow = { number: number; path: string; origin: string; method: string; held: boolean;
  status?: number; responseHash?: string; completed?: boolean; browserConsumed?: FetchObservation };
type SocketProof = { number: number; peerEnded: boolean; closed: boolean; hadError: boolean;
  connectionOrder: number; endOrder: number | null; closeOrder: number | null; closeHadError: boolean | null;
  errorEvents: { order: number; code: string | null }[]; closePromise: Promise<void> };
type Reply = { body: unknown; status?: number };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
async function bounded<T>(promise: Promise<T>, label: string, ms = 10_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(label)), ms); })]); }
  finally { clearTimeout(timer); }
}
const activation = (p: Page) => p.locator('main.controls > .controls__top').getByRole('region', { name: 'Activation health', exact: true });
const progress = (p: Page) => p.getByRole('region', { name: 'Owned progress', exact: true });
async function clickJob(p: Page, id: string) {
  await p.getByRole('region', { name: 'Recent jobs', exact: true }).getByRole('button').filter({ hasText: id }).click();
  await progress(p).getByText(id, { exact: true }).waitFor();
}
async function expectSix(p: Page, code = 'SELECTED_A_PASS') {
  await p.waitForFunction(() => document.querySelectorAll('main.controls > .controls__top [aria-label="Activation health"] [data-testid="activation-check-row"]').length === 6, undefined, { timeout: 2500 });
  assert.deepEqual(await activation(p).locator('[data-testid="activation-check-row"] code').allTextContents(), Array(6).fill(code));
}
async function frameFence(p: Page) {
  // Rendering only: each held response must first pass the separate exact
  // Playwright response + actual browser fetch/Response.json consumption barrier.
  await p.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
async function pendingBytes(p: Page) {
  return p.evaluate(([a,b]) => [localStorage.getItem(a), localStorage.getItem(b)], [PENDING, PENDING_JOB]);
}

type Harness = {
  data: Model; ledger: NetworkRow[]; capture(label: string, extra?: unknown): Promise<void>;
  hold(path: string, reply?: Reply): { arrived(): Promise<NetworkRow>; release(reply?: Reply): Promise<void> };
  checkpoint(label: string): Promise<void>; causalAssertion(): void;
};
async function harness(name: 'causal' | 'races', body: (p: Page, h: Harness) => Promise<void>) {
  assert.equal(enabled, true, 'Root qualification gate required before imports or acquisition');
  const { createControlsSelectedEvidenceOwnedProfileV1, CONTROLS_SELECTED_SOURCE_PATHS } = await import('./fixtures/controls-selected-evidence-owned.js');
  const { createServer } = await import('vite');
  const { default: react } = await import('@vitejs/plugin-react');
  const { parseControlEvidenceEnvelopeV1, parseControlJobReceiptV1 } = await import('../src/lib/control-evidence.js');
  const data = model();
  parseControlEvidenceEnvelopeV1(data.global);
  for (const r of data.receipts.values()) parseControlJobReceiptV1(r);
  for (const e of data.evidence.values()) parseControlEvidenceEnvelopeV1(e);
  const paths = [...CONTROLS_SELECTED_SOURCE_PATHS];
  if (existsSync(join(SOURCE_ROOT, 'src/lib/control-selected-evidence.ts'))) paths.push('src/lib/control-selected-evidence.ts');
  const owned: OwnedProfile = await createControlsSelectedEvidenceOwnedProfileV1({ sourceRoot: SOURCE_ROOT, sourcePaths: paths.sort(),
    profileData: { name, jobA: JOB_A, jobB: JOB_B, globalSelection: S, historicalSelection: T, data: { global: data.global,
      receipts: [...data.receipts], evidence: [...data.evidence] }, readObserverScriptHash: hash(CONTROLS_READ_OBSERVER_INIT_SCRIPT), scenarios: ['row-selection','refresh','reload','late-global','a-b-a-success-error','remount-success-error','terminal-refs-success-error','terminal-missing','historical','pending-byte-stability'] } });
  let cache: string | null = null, cacheIdentity: ReturnType<typeof lstatSync> | null = null;
  let server: ViteDevServer | null = null, http: HttpServer | null = null;
  let page: Page | undefined, origin = '', listener: unknown = null;
  let listeningObserved = false, httpClosed = false, serverClosed = false;
  const sockets = new Set<Socket>(), websockets = new Set<any>();
  const socketProofs: SocketProof[] = [], originalSockets = new Map<Socket, SocketProof>(), originalHttpClose = deferred<void>();
  const socketObservationHashes: string[] = [];
  let socketEventOrder = 0, viteCloseInvoked = false, preWrapperPeerProof: unknown = null;
  const ledger: NetworkRow[] = [], denied: string[] = [], errors: string[] = [], expectedHttpConsole: string[] = [];
  type HoldPlan = { arrived: ReturnType<typeof deferred<NetworkRow>>; released: ReturnType<typeof deferred<Reply | undefined>>;
    done: ReturnType<typeof deferred<void>>; reply?: Reply; used: boolean; request: Request | null; row: NetworkRow | null };
  const plans = new Map<string, HoldPlan[]>(), allPlans: HoldPlan[] = [];
  const observationFaults: string[] = [];
  let stage = 'acquisition', setupReady = false, causal = false, original: unknown = null, bodyPassed = false;
  let wsHeartbeats = 0, wsClosed = 0;
  const defaultReply = (path: string): Reply | null => {
    if (path === EVIDENCE) return { body: structuredClone(data.global) };
    if (path === JOBS) return { body: { jobs: [...data.receipts.values()].map(r => structuredClone(r)) } };
    for (const id of [JOB_A, JOB_B]) {
      if (path === receiptPath(id)) return { body: { receipt: structuredClone(data.receipts.get(id)) } };
      if (path === evidencePath(id)) return { body: structuredClone(data.evidence.get(id)) };
    }
    return null;
  };
  const observeConsumption = async (plan: HoldPlan) => {
    assert.ok(page && plan.request && plan.row, 'HELD_BROWSER_OBSERVATION_UNKNOWN: missing exact request');
    const request = plan.request, row = plan.row;
    // Request object identity is retained at interception. Correlation is carried
    // only by this synthetic RESPONSE header; the outgoing request is unchanged.
    const response = await bounded(request.response(), 'HELD_RESPONSE_OBJECT_UNKNOWN');
    assert.ok(response && response.request() === request, 'HELD_RESPONSE_IDENTITY_UNKNOWN');
    assert.equal(await response.headerValue(OBSERVATION_HEADER), String(row.number), 'HELD_RESPONSE_HEADER_UNKNOWN');
    assert.equal(await bounded(response.finished(), 'HELD_RESPONSE_BODY_END_UNKNOWN'), null);
    const observation = await bounded(page.waitForFunction(id => {
      const snapshot = (window as any).controlsReadObserver?.snapshot();
      if (!snapshot || snapshot.errors.length) throw new Error('BROWSER_READ_OBSERVER_UNKNOWN');
      const rows = snapshot.records.filter((r: any) => r.requestLedgerId === String(id));
      if (rows.length > 1) throw new Error('BROWSER_READ_OBSERVER_AMBIGUOUS');
      const row = rows[0];
      return row && row.fetchState === 'fulfilled' && row.jsonState === 'fulfilled' && row.jsonBodyHash ? row : false;
    }, row.number, { timeout: 8000 }), 'HELD_BROWSER_CONSUMPTION_UNKNOWN');
    const consumed = await observation.jsonValue() as FetchObservation;
    await observation.dispose();
    assert.equal(consumed.requestLedgerId, String(row.number));
    assert.equal(consumed.url, origin + row.path);
    assert.equal(consumed.responseUrl, origin + row.path);
    assert.equal(consumed.method, row.method);
    assert.equal(consumed.status, row.status);
    assert.equal(consumed.jsonCalls, 1, 'BROWSER_READ_OBSERVER_AMBIGUOUS_JSON');
    assert.equal(consumed.jsonBodyHash, row.responseHash, 'BROWSER_READ_BODY_BINDING_UNKNOWN');
    assert.ok(consumed.jsonBytes! <= 262144);
    row.browserConsumed = consumed;
  };
  const hold: Harness['hold'] = (path, reply) => {
    assert.ok(defaultReply(path), 'only exact reviewed fixture routes can be held');
    const arrived = deferred<NetworkRow>(), released = deferred<Reply | undefined>(), done = deferred<void>();
    const plan: HoldPlan = { arrived, released, done, reply, used: false, request: null, row: null };
    plans.set(path, [...(plans.get(path) ?? []), plan]); allPlans.push(plan);
    return { arrived: () => bounded(arrived.promise, `HELD_REQUEST_NOT_OBSERVED:${path}`),
      async release(value) {
        released.resolve(value);
        try {
          if (!plan.used) throw new Error('HELD_BROWSER_OBSERVATION_UNKNOWN: release before exact request');
          await bounded(done.promise, `HELD_RESPONSE_NOT_SETTLED:${path}`);
          await observeConsumption(plan);
        } catch (error) { observationFaults.push(String(error).slice(0,1500)); throw error; }
      } };
  };
  const browserReadSnapshot = async () => {
    const reads = await page!.evaluate(() => (window as any).controlsReadObserver?.snapshot() ?? null);
    if ((!reads || reads.errors.length) && observationFaults.length < 32)
      observationFaults.push('BROWSER_READ_OBSERVER_UNKNOWN:' + JSON.stringify(reads?.errors ?? null));
    return reads;
  };
  const capture: Harness['capture'] = async (label, extra) => {
    assert.match(label, /^[a-z0-9-]+$/);
    assert.ok(page);
    const dom = await page.locator('body').innerHTML();
    assert.ok(Buffer.byteLength(dom) <= 262144, 'bounded fixture DOM');
    const domHash = owned.store.json({ schema: 'mission-control.controls-selected-evidence-dom.v1', name, label, dom });
    const shotHash = await owned.shot(page, label);
    owned.store.json({ schema: 'mission-control.controls-selected-evidence-observation.v1', name, label, domHash, shotHash,
      pending: await pendingBytes(page), ledger: structuredClone(ledger),
      browserReads: await browserReadSnapshot(), extra: extra ?? null });
  };
  const checkpoint: Harness['checkpoint'] = async label => {
    assert.deepEqual(denied, [], 'all network traffic belongs to the private fixture origin and reviewed graph');
    assert.deepEqual(errors, [], 'no page/console error may qualify selected behavior');
    await browserReadSnapshot();
    assert.deepEqual(observationFaults, [], 'missing or ambiguous client consumption is UNKNOWN');
    assert.ok(ledger.every(r => r.origin === origin && r.method === 'GET'), 'API traffic is exact-origin GET-only');
    assert.equal(await page!.getByRole('region', { name: 'Selected readiness', exact: true }).getByText(S, { exact: true }).count(), 1);
    assert.equal(await page!.getByRole('region', { name: 'Historical evidence', exact: true }).getByText('9'.repeat(40), { exact: true }).count(), 1);
    assert.equal(await page!.getByText('7'.repeat(40), { exact: true }).count(), 0, 'selected history cannot replace global history');
    await owned.boundary();
    await capture(label);
  };
  try {
    cache = realpathSync(await mkdtemp(join(tmpdir(), 'mc-controls-selected-vite-')));
    cacheIdentity = lstatSync(cache);
    assert.equal(cacheIdentity.mode & 0o777, 0o700);
    server = await createServer({ configFile: false, envFile: false, root: SOURCE_ROOT, cacheDir: cache,
      plugins: [react()], publicDir: false, css: { postcss: { plugins: [] } }, clearScreen: false, logLevel: 'error',
      server: { host: '127.0.0.1', port: 0, strictPort: true, hmr: false, proxy: {}, fs: { strict: true, allow: [SOURCE_ROOT, cache] } } });
    const privateHttp = server.httpServer;
    assert.ok(privateHttp, 'retain the actual private HTTP object');
    assert.ok('keepAliveTimeout' in privateHttp, 'the private fixture requires its original HTTP/1 server');
    http = privateHttp;
    // Keep the private fixture's idle timer from locally destroying historical
    // sockets. Every original peer-end/close/zero gate below still applies.
    http.keepAliveTimeout = 0;
    http.on('connection', socket => {
      sockets.add(socket);
      const close = deferred<void>();
      const proof: SocketProof = { number: socketProofs.length + 1, peerEnded: false, closed: false,
        hadError: false, connectionOrder: ++socketEventOrder, endOrder: null, closeOrder: null, closeHadError: null,
        errorEvents: [], closePromise: close.promise };
      socketProofs.push(proof); originalSockets.set(socket, proof);
      if (socketProofs.length > 1024) errors.push('ORIGINAL_SOCKET_PROOF_BOUND');
      socket.once('end', () => { proof.peerEnded = true; proof.endOrder = ++socketEventOrder; });
      socket.on('error', error => {
        proof.hadError = true;
        const code = (error as NodeJS.ErrnoException).code;
        proof.errorEvents.push({ order: ++socketEventOrder, code: typeof code === 'string' ? code : null });
      });
      socket.once('close', (hadError: boolean) => {
        proof.closed = true; proof.closeHadError = hadError; proof.hadError ||= hadError; proof.closeOrder = ++socketEventOrder;
        sockets.delete(socket); close.resolve();
      });
    });
    http.once('listening', () => { listeningObserved = true; });
    http.once('close', () => { httpClosed = true; originalHttpClose.resolve(); });
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/api/') || req.url?.startsWith('/ws')) { res.statusCode = 403; res.end('TEST_NETWORK_DENIED'); }
      else next();
    });
    // Installed Vite startServer treats zero as falsy and falls back to 5173,
    // even for server.listen(0). Its original HTTP object's public listen is
    // wrapped separately to run initServer(true), then forwards zero unchanged.
    const originalHttp = http;
    await bounded(new Promise<void>((resolve, reject) => {
      const onListening = () => { originalHttp.off('error', onError); resolve(); };
      const onError = (error: Error) => { originalHttp.off('listening', onListening); reject(error); };
      originalHttp.once('listening', onListening);
      originalHttp.once('error', onError);
      // Observe the installed async wrapper's rejection as well as the actual
      // original HTTP events. No extra listener or port-availability probe.
      void Promise.resolve(originalHttp.listen(0, '127.0.0.1')).catch(onError);
    }), 'SELECTED_EPHEMERAL_LISTEN_UNKNOWN');
    assert.equal(server.httpServer, originalHttp, 'original HTTP identity required');
    const address = http.address();
    assert.ok(address && typeof address !== 'string');
    assert.equal(address.address, '127.0.0.1');
    assert.ok(Number.isInteger(address.port) && address.port > 0 && address.port <= 65535, 'actual assigned ephemeral port required');
    assert.ok(![3080,3333,18789,13081,13082].includes(address.port));
    origin = `http://127.0.0.1:${address.port}`;
    listener = { host: address.address, port: address.port, family: address.family };
    owned.store.json({ schema: 'mission-control.controls-selected-evidence-listener.v1', origin, listener, requestedPort: 0,
      listenApi: 'original_vite_http_server', keepAliveTimeout: http.keepAliveTimeout, timeout: http.timeout,
      readObserverScriptHash: hash(CONTROLS_READ_OBSERVER_INIT_SCRIPT), cacheRoot: cache });
    assert.equal(http.keepAliveTimeout, 0, 'private fixture idle timeout policy required before native acquisition');
    stage = 'native-acquisition';
    const browser = await owned.launch();
    assert.ok(browser, 'native refusal is setup UNKNOWN, never causal RED');
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
    await context.addInitScript({ content: CONTROLS_READ_OBSERVER_INIT_SCRIPT });
    await context.route('**/*', async (route: Route) => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname + url.search;
      if (url.origin !== origin || request.method() !== 'GET') { denied.push(`${request.method()}:${url.href}`); return route.abort(); }
      if (url.pathname.startsWith('/api/')) {
        if (ledger.length >= 512) { denied.push('LEDGER_BOUND'); return route.abort(); }
        const reply = defaultReply(path), plan = plans.get(path)?.shift();
        const row: NetworkRow = { number: ledger.length + 1, path, origin: url.origin, method: request.method(), held: !!plan };
        ledger.push(row);
        if (!reply) { denied.push(path); return route.abort(); }
        if (plan) { plan.used = true; plan.request = request; plan.row = row; plan.arrived.resolve(row); }
        try {
          const response: Reply = plan ? (await plan.released.promise) ?? plan.reply ?? reply : reply;
          row.status = response.status ?? 200;
          row.responseHash = hash(JSON.stringify(response.body));
          await route.fulfill({ status: row.status, headers: { [OBSERVATION_HEADER]: String(row.number) }, json: response.body });
          row.completed = true;
        } catch (error) { errors.push(`ROUTE:${String(error).slice(0,1000)}`); }
        finally { plan?.done.resolve(); }
        return;
      }
      if (/^\/(?:src|server|tests)\//.test(url.pathname) && !paths.includes(decodeURIComponent(url.pathname.slice(1)))) {
        denied.push(path); return route.abort();
      }
      if (url.pathname.startsWith('/@fs/')) {
        const physical = decodeURIComponent(url.pathname.slice('/@fs'.length));
        const within = (root: string) => {
          try {
            if (!isAbsolute(physical) || normalize(physical) !== physical || physical.includes('\0')) return false;
            const child = relative(root, physical);
            if (!child || child === '..' || child.startsWith('..' + sep) || isAbsolute(child)) return false;
            if (realpathSync(root) !== root || realpathSync(physical) !== physical) return false;
            if (root === join(cache!, 'deps')) {
              const now = lstatSync(cache!);
              if (now.dev !== cacheIdentity!.dev || now.ino !== cacheIdentity!.ino || now.uid !== process.getuid!() || (now.mode & 0o777) !== 0o700) return false;
            }
            const file = lstatSync(physical);
            return file.isFile() && !file.isSymbolicLink() && file.uid === process.getuid!();
          } catch { return false; }
        };
        if (!within(join(SOURCE_ROOT, 'node_modules'))) {
          const depsRoot = join(cache!, 'deps'), child = relative(depsRoot, physical);
          if (!isAbsolute(physical) || normalize(physical) !== physical || physical.includes('\0') || !child || child === '..' || child.startsWith('..' + sep) || isAbsolute(child)) {
            denied.push(path); return route.abort();
          }
          const info = server!.environments.client.depsOptimizer?.metadata.depInfoList.find(dep => dep.file === physical);
          if (!info) { denied.push(path); return route.abort(); }
          try { await bounded(info.processing ?? Promise.resolve(), 'SELECTED_OPTIMIZER_PUBLICATION_UNKNOWN'); }
          catch { denied.push('OPTIMIZER_PUBLICATION_UNKNOWN:' + path); return route.abort(); }
          if (!within(depsRoot)) { denied.push(path); return route.abort(); }
        }
      }
      if (paths.includes(url.pathname.slice(1)) || /^\/(?:node_modules\/|@vite\/|@react-refresh(?:$|\?)|@fs\/)/.test(url.pathname)) return route.continue();
      denied.push(path); return route.abort();
    });
    await context.routeWebSocket('**/*', socket => {
      const url = new URL(socket.url()), query = [...url.searchParams];
      // Vite's exact private heartbeat is consumed locally; never connectToServer.
      if (url.origin !== origin.replace('http','ws') || url.pathname !== '/' || url.username || url.password
          || query.length !== 1 || query[0][0] !== 'token' || query[0][1] !== server!.config.webSocketToken) {
        denied.push('WS:' + socket.url()); socket.close(); return;
      }
      websockets.add(socket);
      socket.onClose(() => { if (websockets.delete(socket)) wsClosed++; });
      socket.onMessage(message => {
        if (message === '{"type":"ping"}') wsHeartbeats++;
        else { denied.push('WS_OUTBOUND:VITE'); socket.close(); }
      });
      socket.send(JSON.stringify({ type: 'connected' }));
    });
    page = await context.newPage();
    page.setDefaultTimeout(3500);
    page.on('pageerror', error => errors.push(error.message.slice(0,1500)));
    page.on('console', message => {
      if (message.type() !== 'error') return;
      const location = message.location().url;
      const expected = ledger.some(r => r.held && r.status === 503 && origin + r.path === location)
        && /^Failed to load resource: the server responded with a status of 503 \(Service Unavailable\)$/.test(message.text());
      if (expected) expectedHttpConsole.push(location);
      else errors.push(message.text().slice(0,1500));
    });
    stage = 'positive-setup';
    await page.goto(`${origin}/tests/fixtures/controls-selected-evidence.html`);
    await activation(page).getByText('GLOBAL_ACTIVATION_UNCONFIGURED', { exact: true }).waitFor();
    const recent = page.getByRole('region', { name: 'Recent jobs', exact: true });
    await recent.getByRole('button').filter({ hasText: JOB_A }).waitFor();
    await recent.getByRole('button').filter({ hasText: JOB_B }).waitFor();
    assert.deepEqual(await pendingBytes(page), [null,null]);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), SELECTED), null, 'primary setup has no restored selection');
    await checkpoint('global-ready');
    setupReady = true;
    stage = 'body';
    await body(page, { data, ledger, capture, hold, checkpoint, causalAssertion: () => { stage = 'causal-assertion'; } });
    await checkpoint('body-complete');
    bodyPassed = true;
  } catch (error) {
    original = { name: error instanceof Error ? error.name : typeof error, message: String(error).slice(0,2000), stage };
    // Only this exact observed page mismatch can qualify preimplementation RED.
    // Setup, import, navigation, interaction and unknown cleanup failures cannot.
    if (name === 'causal' && stage === 'causal-assertion' && setupReady && page && !denied.length && !errors.length) {
      causal = await activation(page).locator('[data-testid="activation-check-row"]').count() === 0
        && await activation(page).getByText('GLOBAL_ACTIVATION_UNCONFIGURED', { exact: true }).count() === 1
        && await progress(page).getByText(JOB_A, { exact: true }).count() === 1
        && !ledger.some(r => r.path === evidencePath(JOB_A));
    }
    owned.store.json({ schema: 'mission-control.controls-selected-evidence-original-failure.v1', original, setupReady, causalCandidate: causal });
    throw error;
  } finally {
    // Release every used/unconsumed numbered hold before independent cleanup.
    const cleanupErrors: string[] = [];
    for (const plan of allPlans) plan.released.resolve(undefined);
    try { await bounded(Promise.all(allPlans.filter(plan => plan.used).map(plan => plan.done.promise)), 'SELECTED_HELD_CLEANUP_UNKNOWN'); }
    catch (error) { cleanupErrors.push('held:' + String(error)); }
    if (page) for (const plan of allPlans.filter(plan => plan.used && !plan.row?.browserConsumed)) {
      try { await observeConsumption(plan); }
      catch (error) { observationFaults.push(String(error).slice(0,1500)); }
    }
    if (page) {
      try { await capture('final', { original, causalCandidate: causal }); } catch (error) { cleanupErrors.push('capture:' + String(error)); }
      try { await page.evaluate(() => (window as any).controlsFixture.unmount()); } catch (error) { cleanupErrors.push('unmount:' + String(error)); }
    }
    let native: unknown = null;
    try { native = await owned.close(); } catch (error) { cleanupErrors.push('native:' + String(error)); }
    let admittedSocketCount: number | null = null, connectionCount: number | null = null, connectionCountError: string | null = null;
    const recordSocketObservation = (phase: 'before_assertions' | 'before_peer_assertions' | 'server_error' | 'unknown') => {
      socketObservationHashes.push(owned.store.json({ schema: 'mission-control.controls-selected-evidence-socket-observation.v1',
        phase, listener, observationOrder: ++socketEventOrder, admittedSocketCount, connectionCount, connectionCountError,
        originalHttpPresent: http !== null, listening: http?.listening ?? false, address: http?.address() ?? null,
        keepAliveTimeout: http?.keepAliveTimeout ?? null, timeout: http?.timeout ?? null, httpClosed, serverClosed,
        viteCloseInvoked, retainedOriginalSockets: originalSockets.size, socketCount: socketProofs.length,
        activeOriginalSockets: sockets.size, activeWebsockets: websockets.size,
        sockets: socketProofs.map(({ closePromise: _promise, ...proof }) => proof) }));
    };
    // Vite's installed wrapper destroys remaining sockets. Admit that wrapper
    // ONLY after every retained original socket has independently peer-ended and
    // closed and the original HTTP object reports zero connections. If unknown,
    // leave the original server/resources retained; never force a cleanup proof.
    if (server) {
      try {
        admittedSocketCount = socketProofs.length;
        recordSocketObservation('before_assertions');
        assert.ok(http);
        assert.equal(originalSockets.size, admittedSocketCount, 'ORIGINAL_SOCKET_IDENTITY_UNKNOWN');
        await bounded(Promise.all(socketProofs.map(proof => proof.closePromise)), 'SELECTED_NATURAL_PEER_CLOSURE_UNKNOWN');
        try {
          connectionCount = await bounded(new Promise<number>((resolve, reject) => {
            http!.getConnections((error, count) => error ? reject(error) : resolve(count));
          }), 'SELECTED_ORIGINAL_CONNECTION_COUNT_UNKNOWN');
        } catch (error) { connectionCountError = String(error).slice(0,1000); throw error; }
        // Preserve all historical rows and the original count before a failed
        // peer/error/order assertion can withhold the qualified wrapper proof.
        recordSocketObservation('before_peer_assertions');
        assert.equal(sockets.size, 0);
        assert.equal(websockets.size, 0);
        for (const proof of socketProofs) {
          assert.ok(proof.peerEnded && proof.closed && !proof.hadError, 'SELECTED_PEER_END_CLOSE_UNKNOWN');
          assert.ok(proof.endOrder !== null && proof.closeOrder !== null && proof.endOrder < proof.closeOrder);
        }
        assert.equal(connectionCount, 0);
        assert.equal(socketProofs.length, admittedSocketCount, 'NEW_CONNECTION_DURING_PEER_PROOF_UNKNOWN');
        assert.equal(sockets.size, 0);
        const countBeforeWrapper = socketProofs.length;
        preWrapperPeerProof = { connectionCount, socketCount: countBeforeWrapper, activeOriginalSockets: sockets.size,
          eventOrder: ++socketEventOrder, observedBeforeViteClose: !viteCloseInvoked,
          sockets: socketProofs.map(({ closePromise: _promise, ...proof }) => proof) };
        owned.store.json({ schema: 'mission-control.controls-selected-evidence-pre-vite-peer-closure.v1', listener,
          proof: preWrapperPeerProof });
        // No await or new listener probe between the zero proof and invocation.
        viteCloseInvoked = true;
        const closing = server.close();
        await bounded(Promise.all([closing, listeningObserved ? originalHttpClose.promise : Promise.resolve()]), 'SELECTED_SERVER_CLOSURE_UNKNOWN');
        assert.equal(socketProofs.length, countBeforeWrapper, 'NEW_CONNECTION_AFTER_PEER_PROOF_UNKNOWN');
        assert.equal(http.listening, false);
        assert.equal(http.address(), null);
        if (listeningObserved) assert.equal(httpClosed, true);
        assert.equal(sockets.size, 0);
        assert.equal(websockets.size, 0);
        serverClosed = true;
      } catch (error) {
        cleanupErrors.push('server:' + String(error));
        try { recordSocketObservation('server_error'); }
        catch (auditError) { cleanupErrors.push('socket-observation:' + String(auditError)); }
      }
    }
    // Root ruling I2: retain this exact private cache for EVERY outcome. No
    // deletion is attempted, even after successful publication/verification.
    let cacheRetained: boolean | null = cache ? null : false;
    if (cache && cacheIdentity) {
      try {
        const now = lstatSync(cache);
        assert.equal(realpathSync(cache), cache);
        assert.equal(now.dev, cacheIdentity.dev); assert.equal(now.ino, cacheIdentity.ino);
        assert.equal(now.uid, process.getuid!()); assert.equal(now.mode & 0o777, 0o700);
        cacheRetained = true;
      } catch (error) { cleanupErrors.push('cache-custody:' + String(error)); }
    }
    const settled = setupReady && cleanupErrors.length === 0 && denied.length === 0 && errors.length === 0
      && observationFaults.length === 0 && serverClosed;
    const ledgerHash = owned.store.json({ schema: 'mission-control.controls-selected-evidence-network-ledger.v1', origin, ledger, denied, errors, expectedHttpConsole, observationFaults, wsHeartbeats, wsClosed });
    const outcome = settled && !cleanupErrors.length
      ? bodyPassed ? 'GREEN' : causal ? 'CAUSAL_RED' : name === 'races' && stage === 'body' ? 'BEHAVIOR_FAIL' : 'UNKNOWN'
      : 'UNKNOWN';
    if (outcome === 'UNKNOWN') {
      try { recordSocketObservation('unknown'); }
      catch (error) { cleanupErrors.push('socket-observation:' + String(error)); }
    }
    owned.store.json({ schema: 'mission-control.controls-selected-evidence-final-outcome.v1', name, outcome, original, setupReady,
      native, listener, listeningObserved, httpClosed, serverClosed, originalListenerAbsent: http?.address() === null,
      sockets: sockets.size, websockets: websockets.size, socketObservationHashes, preWrapperPeerProof, viteCloseInvoked, ledgerHash, cache,
      cacheRetained, cacheRemovalAttempted: false, cachePolicy: 'retain_all_outcomes', cleanupErrors });
    owned.store.verify();
    console.log(JSON.stringify({ code: 'CONTROLS_SELECTED_EVIDENCE_OUTCOME', name, outcome, artifactRoot: owned.store.root }));
    if (outcome === 'UNKNOWN') throw new Error('CONTROLS_SELECTED_EVIDENCE_QUALIFICATION_UNKNOWN; original failure retained in artifact store');
  }
}

test('Controls selected job reports use exact evidence', options, async () => {
  await harness('causal', async (page, h) => {
    const before = await pendingBytes(page);
    const recent = page.getByRole('region', { name: 'Recent jobs', exact: true });
    await recent.getByRole('button').filter({ hasText: JOB_A }).click();
    await progress(page).getByText(JOB_A, { exact: true }).waitFor();
    h.causalAssertion();
    const panel = activation(page);
    // Required central actual-page assertion. The current page never requests
    // A evidence and keeps global Unconfigured despite A's completed receipt.
    await page.waitForFunction(() => document.querySelectorAll(
      'main.controls > .controls__top [aria-label="Activation health"] [data-testid="activation-check-row"]'
    ).length === 6, undefined, { timeout: 2500 });
    assert.deepEqual(await panel.locator('[data-testid="activation-check-row"] code').allTextContents(), Array(6).fill('SELECTED_A_PASS'));
    assert.ok(h.ledger.some(r => r.path === evidencePath(JOB_A) && r.completed), 'actual page requested and received exact A evidence');
    await page.getByText(`Reports for selected job ${JOB_A}`, { exact: true }).waitFor();
    assert.deepEqual(await pendingBytes(page), before);
    await h.checkpoint('selected-a-six-checks');
  });
});

test('Controls selected evidence survives races and terminal refs', options, async () => {
  await harness('races', async (page, h) => {
    await page.getByRole('checkbox').check();
    await clickJob(page, JOB_A); await expectSix(page);
    assert.equal(await page.getByRole('checkbox').isChecked(), true, 'selected GET cannot invalidate current global confirmation');
    const manual = h.hold(evidencePath(JOB_A));
    await page.getByRole('button', { name: 'Refresh evidence', exact: true }).click();
    await manual.arrived(); await manual.release(); await frameFence(page); await expectSix(page);
    await page.reload();
    await progress(page).getByText(JOB_A, { exact: true }).waitFor(); await expectSix(page);
    await h.checkpoint('reload-restores-exact-a');

    const lateGlobal = h.hold(EVIDENCE);
    await page.getByRole('button', { name: 'Refresh evidence', exact: true }).click();
    await lateGlobal.arrived();
    await clickJob(page, JOB_B);
    await activation(page).getByText('SELECTED_B_UNCONFIGURED', { exact: true }).waitFor();
    await clickJob(page, JOB_A); await expectSix(page);
    await lateGlobal.release(); await frameFence(page); await expectSix(page);
    await h.checkpoint('late-global-keeps-selected-a');

    for (const reject of [false,true]) {
      await clickJob(page, JOB_B);
      await activation(page).getByText('SELECTED_B_UNCONFIGURED', { exact: true }).waitFor();
      const old = h.hold(evidencePath(JOB_A), reject ? { status: 503, body: { error: 'OLD_A_READ_FAILED' } } : { body: selected('OLD_A_PASS') });
      await clickJob(page, JOB_A); await old.arrived();
      assert.equal(await activation(page).locator('[data-testid="activation-check-row"]').count(), 0, 'held selected read has no old/global report fallback');
      await page.locator('main.controls').getByRole('status').filter({hasText:JOB_A}).filter({hasText:/loading/i}).first().waitFor({state:'visible'});
      await clickJob(page, JOB_B);
      await activation(page).getByText('SELECTED_B_UNCONFIGURED', { exact: true }).waitFor();
      await clickJob(page, JOB_A); await expectSix(page);
      await old.release(); await frameFence(page); await expectSix(page);
      assert.equal(await page.getByRole('alert').filter({ hasText: 'OLD_A_READ_FAILED' }).count(), 0);
      await h.checkpoint(reject ? 'a-b-a-late-error' : 'a-b-a-late-success');
    }
    for (const reject of [false,true]) {
      await clickJob(page, JOB_B);
      const old = h.hold(receiptPath(JOB_A), reject ? { status:503,body:{ error:'OLD_A_RECEIPT_FAILED' } } : { body:{ receipt:{ ...receipt(JOB_A,true),revision:5,state:'running',finishedAt:null,reportRefs:{} } } });
      await page.getByRole('region',{name:'Recent jobs',exact:true}).getByRole('button').filter({hasText:JOB_A}).click();
      await old.arrived();
      await clickJob(page, JOB_B); await clickJob(page, JOB_A); await expectSix(page);
      await old.release(); await frameFence(page); await expectSix(page);
      await progress(page).getByText('Completed · Closed',{exact:true}).waitFor();
      assert.equal(await page.getByRole('alert').filter({hasText:'OLD_A_RECEIPT_FAILED'}).count(),0);
      await h.checkpoint(reject ? 'a-b-a-late-receipt-error' : 'a-b-a-late-receipt-success');
    }
    const olderManual = h.hold(evidencePath(JOB_A),{body:selected('OLDER_MANUAL_PASS')});
    await page.getByRole('button',{name:'Refresh evidence',exact:true}).click(); await olderManual.arrived();
    const newerManual = h.hold(evidencePath(JOB_A));
    await page.getByRole('button',{name:'Refresh evidence',exact:true}).click(); await newerManual.arrived();
    await newerManual.release(); await frameFence(page); await expectSix(page);
    await olderManual.release(); await frameFence(page); await expectSix(page);
    await h.checkpoint('newest-manual-evidence-wins');
    for (const reject of [false,true]) {
      const old = h.hold(evidencePath(JOB_A), reject ? { status:503,body:{ error:'OLD_LIFETIME_FAILED' } } : { body:selected('OLD_LIFETIME_PASS') });
      await page.getByRole('button', { name: 'Refresh evidence', exact: true }).click(); await old.arrived();
      await page.evaluate(() => (window as any).controlsFixture.remount());
      await progress(page).getByText(JOB_A, { exact:true }).waitFor(); await expectSix(page);
      await old.release(); await frameFence(page); await expectSix(page);
      assert.equal(await page.getByRole('alert').filter({ hasText:'OLD_LIFETIME_FAILED' }).count(),0);
      await h.checkpoint(reject ? 'remount-late-error' : 'remount-late-success');
    }
    for (const reject of [false,true]) {
      await clickJob(page, JOB_B);
      h.data.receipts.set(JOB_A, receipt(JOB_A,false));
      h.data.evidence.set(JOB_A, envelope('A_REV5_UNCONFIGURED'));
      const old = h.hold(evidencePath(JOB_A), reject ? { status:503,body:{ error:'OLD_REV5_FAILED' } } : { body:envelope('A_REV5_UNCONFIGURED') });
      await clickJob(page, JOB_A); await old.arrived();
      const terminalPoll = h.hold(receiptPath(JOB_A), { body:{ receipt:receipt(JOB_A,true) } });
      h.data.receipts.set(JOB_A,receipt(JOB_A,true)); h.data.evidence.set(JOB_A,selected());
      await terminalPoll.arrived(); await terminalPoll.release();
      // E2 must start without waiting for the held E1 and without Refresh.
      await expectSix(page);
      await old.release(); await frameFence(page); await expectSix(page);
      assert.equal(await page.getByRole('alert').filter({ hasText:'OLD_REV5_FAILED' }).count(),0);
      await h.checkpoint(reject ? 'terminal-ref-late-error' : 'terminal-ref-late-empty');
    }
    const failed = h.hold(evidencePath(JOB_A),{status:503,body:{error:'CONTROL_SELECTED_REPORT_FAILED'}});
    await clickJob(page,JOB_A); await failed.arrived(); await failed.release();
    await page.locator('main.controls').getByRole('alert').filter({hasText:'CONTROL_SELECTED_REPORT_FAILED'}).filter({hasText:JOB_A}).first().waitFor({state:'visible'});
    assert.equal(await activation(page).locator('[data-testid="activation-check-row"]').count(),0);
    await h.checkpoint('terminal-get-failure-detaches-pass');

    h.data.evidence.set(JOB_A, { ...selected(), evidence: { ...selected().evidence, activation:unavailable('SELECTED_A_REPORT_MISSING','missing') } });
    await clickJob(page,JOB_A);
    await activation(page).getByText('SELECTED_A_REPORT_MISSING',{exact:true}).waitFor();
    assert.equal(await activation(page).locator('[data-testid="activation-check-row"]').count(),0);
    await h.checkpoint('terminal-missing-stays-unavailable');

    h.data.receipts.set(JOB_A,{ ...receipt(JOB_A,true),selectionHash:T }); h.data.evidence.set(JOB_A,selected('SELECTED_A_PASS',true));
    await page.getByRole('checkbox').check();
    await clickJob(page,JOB_A); await expectSix(page);
    await activation(page).getByText(/Historical report/).waitFor();
    await page.getByText('This job belongs to a different selection. Its progress remains historical.',{exact:true}).waitFor();
    assert.equal(await page.getByRole('checkbox').isChecked(),true);
    assert.equal(await page.getByText('Qualified release',{exact:true}).count(),0);
    await h.checkpoint('historical-selected-does-not-change-launch-authority');

    // Seed an unrelated persisted pending A request before a fresh real mount.
    // Select completed B while A's receipt GET is held; its late terminal receipt
    // must not clear A's raw pending mapping or leak a report into B's view.
    h.data.receipts.set(JOB_A,receipt(JOB_A,true)); h.data.evidence.set(JOB_A,selected());
    h.data.receipts.set(JOB_B,receipt(JOB_B,true));
    const pending = '{ "kind": "activation_preflight", "expectedSelectionHash": "'+S+'", "idempotencyKey": "c3333333-3333-4333-8333-333333333333" }';
    const mapping = '{ "jobId": "'+JOB_A+'", "kind": "activation_preflight", "expectedSelectionHash": "'+S+'", "idempotencyKey": "c3333333-3333-4333-8333-333333333333" }';
    const lateA = h.hold(receiptPath(JOB_A));
    await page.evaluate(({ pending,mapping,keys,job }) => {
      localStorage.setItem(keys[0],pending); localStorage.setItem(keys[1],mapping); localStorage.setItem(keys[2],job);
      (window as any).controlsFixture.remount();
    },{pending,mapping,keys:[PENDING,PENDING_JOB,SELECTED],job:JOB_A});
    await lateA.arrived();
    await clickJob(page,JOB_B);
    await activation(page).getByText('SELECTED_B_UNCONFIGURED',{exact:true}).waitFor();
    const before = await pendingBytes(page); assert.deepEqual(before,[pending,mapping]);
    await page.getByRole('button',{name:'Refresh evidence',exact:true}).click();
    await lateA.release(); await frameFence(page);
    await activation(page).getByText('SELECTED_B_UNCONFIGURED',{exact:true}).waitFor();
    assert.deepEqual(await pendingBytes(page),before,'selected/global GETs and late unrelated A GET preserve exact pending bytes');
    await progress(page).getByText(JOB_B,{exact:true}).waitFor();
    await h.checkpoint('unrelated-pending-byte-identical');
  });
});
