import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
const load = () => import('../scripts/ui-regression-fixtures.mjs');
function workspace() {
    const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'ui-fixture-contract-')));
    const build = path.join(root, 'build');
    mkdirSync(build);
    mkdirSync(path.join(build, 'dist'));
    mkdirSync(path.join(build, 'dist-server'));
    writeFileSync(path.join(build, 'dist', 'index.html'), '<html><body><div id="root">Source component fixture</div></body></html>');
    const h = createHash('sha256').update('mission-control.internal-production-build-content.v1\0');
    for (const f of ['dist/index.html']) {
        const b = readFileSync(path.join(build, f));
        h.update(f + '\0' + b.length + '\0').update(b).update('\0');
    }
    writeFileSync(path.join(build, 'dist-server', 'internal-production-build-identity.v1.json'), JSON.stringify({ schema: 'mission-control.internal-production-build-identity.v1', sourceSha: 'a'.repeat(40), treeHash: 'b'.repeat(40), buildHash: h.digest('hex') }));
    const temp = path.join(root, 'private');
    mkdirSync(temp, { mode: 0o700 });
    return { root, buildDir: build, tempRoot: temp };
}
test('occupied fixture port refuses before browser effects and leaves unrelated listener owned by test intact', async () => {
    const f = workspace();
    const occupied = createServer((_, res) => res.end('owner'));
    await new Promise<void>((resolve, reject) => { occupied.once('error', reject); occupied.listen(13082, '127.0.0.1', resolve); });
    try {
        const { runUiRegressionV1 } = await load();
        await assert.rejects(runUiRegressionV1({ ...f, browser: { newContext() { throw Error('browser must not run'); } } }), /UI_FIXTURE_PORT_OCCUPIED/);
        assert.equal(occupied.listening, true);
        assert.equal(await (await fetch('http://127.0.0.1:13082/')).text(), 'owner');
    }
    finally {
        await new Promise<void>((resolve, reject) => occupied.close(e => e ? reject(e) : resolve()));
        rmSync(f.root, { recursive: true, force: true });
    }
});
test('fixture server exposes fixed data only, rejects unknown GET and provider mutations, and awaits exact owned close', async () => {
    const f = workspace();
    const { createUiRegressionFixtureSessionV1 } = await load();
    let session;
    try {
        session = await createUiRegressionFixtureSessionV1(f);
        assert.equal((await (await fetch('http://127.0.0.1:13082/api/agents')).json()).length, 14);
        assert.equal((await fetch('http://127.0.0.1:13082/api/not-reviewed')).status, 403);
        assert.equal((await fetch('http://127.0.0.1:13082/api/prd/generate', { method: 'POST' })).status, 403);
        assert.equal(session.unexpectedRequests.length, 2);
    }
    finally {
        if (session)
            await session.close();
        rmSync(f.root, { recursive: true, force: true });
    }
});
test('a failing injected browser retains actual failed assertion report and completed PNG before owned server closure', async () => {
    const f = workspace();
    const { runUiRegressionV1 } = await load();
    let closed = false;
    const page = { on() { }, setDefaultTimeout() { }, goto: async () => { throw Error('fixture navigation failure'); }, screenshot: async () => Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]), url: () => 'http://127.0.0.1:13082/', close: async () => { } };
    const browser = { newContext: async () => ({ route: async () => { }, routeWebSocket: async () => { }, addInitScript: async () => { }, on() { }, newPage: async () => page, close: async () => { closed = true; } }) };
    try {
        const result = await runUiRegressionV1({ ...f, browser });
        assert.equal(result.report.outcome, 'fail');
        assert.equal(result.report.assertions[0].status, 'fail');
        assert.equal(result.report.screenshots.length, 1);
        assert.ok(closed);
        const report = JSON.parse(readFileSync(path.join(f.tempRoot, 'artifacts', result.reportHash + '.json'), 'utf8'));
        assert.equal(report.outcome, 'fail');
        assert.ok(readdirSync(path.join(f.tempRoot, 'artifacts')).some(x => x.endsWith('.png')));
    }
    finally {
        rmSync(f.root, { recursive: true, force: true });
    }
});
test('tampered built static assets refuse before taking fixture listener ownership', async () => {
    const f = workspace();
    try {
        const { createUiRegressionFixtureSessionV1 } = await load();
        writeFileSync(path.join(f.buildDir, 'dist', 'index.html'), 'changed');
        await assert.rejects(createUiRegressionFixtureSessionV1(f), /UI_BUILD_IDENTITY_INVALID/);
    }
    finally {
        rmSync(f.root, { recursive: true, force: true });
    }
});
test('fixed entry refuses alternate argv and source bootstrap before any fixture effect', async () => {
    const { parseUiInvocationV1, assertUiCompiledSelfV1 } = await import('../scripts/ui-regression.mjs');
    assert.deepEqual(parseUiInvocationV1(['--standalone']), { mode: 'standalone', scenario: 'pass' });
    assert.deepEqual(parseUiInvocationV1(['--standalone-owned-cancel']), { mode: 'standalone', scenario: 'owned_cancel' });
    for (const argv of [[], ['--standalone', '/tmp'], ['--job-id', 'bad'], ['--standalone-assertion-failure', '--job-id', '018d819f-0a78-7d38-bb1f-0195b029ddaf'], ['--browser', 'chrome']])
        assert.throws(() => parseUiInvocationV1(argv));
    assert.throws(() => assertUiCompiledSelfV1(new URL('../scripts/ui-regression.mjs', import.meta.url).href), /UI_COMPILED_SELF_REQUIRED/);
});
test('simulated original UI channel latches cancellation while ACK is outstanding and rejects changed binding ACK', async () => {
    const { EventEmitter } = await import('node:events');
    const { createUiWorkerChannelV1 } = await import('../scripts/ui-regression.mjs');
    const sf = new URL('../../setfarm-dashboard-cutover-controller-20261007-v1/src/', import.meta.url);
    const channel = await import(new URL('execution/schemas/manual-control-worker-channel-v1.ts', sf).href);
    const schemas = await import(new URL('execution/schemas/manual-control-job-v1.ts', sf).href);
    const jobId = '018d819f-0a78-7d38-bb1f-0195b029ddaf', nonce = 'n'.repeat(64), hash = (s: string) => createHash('sha256').update(s).digest('hex');
    const owner = { pid: 42, processStartedAt: '2026-10-19T10:00:00.000Z', processGroupId: 42, source: 'observed_os', executable: '/node', script: '/mc/dist-server/scripts/ui-regression.mjs', commandHash: '1'.repeat(64) };
    const receipt = { schema: 'mission-control.control-job.v1', jobId, kind: 'ui_regression', revision: 1, selectionHash: 'a'.repeat(64), sourceSha: 'b'.repeat(40), mcSourceSha: 'c'.repeat(40), mcBuildHash: 'd'.repeat(64), suiteHash: null, state: 'accepted', requestedAt: '2026-10-19T10:00:00.000Z', startedAt: null, updatedAt: '2026-10-19T10:00:00.000Z', finishedAt: null, phase: 'starting', code: null, currentCaseId: null, ownedRunId: null, completedCases: 0, plannedCases: 313, reportRefs: {}, cancelRequested: false };
    const intent = { schema: 'mission-control.control-intent.v1', receipt, installationDir: '/installation', releaseDir: '/release', nonceDigest: hash(nonce), fixedSuiteRelativePath: null };
    const target = new EventEmitter() as any;
    target.connected = true;
    const sent: any[] = [];
    target.send = (frame: any, callback: Function) => { sent.push(frame); callback(); };
    const intentHash = 'e'.repeat(64), binding = { jobId, channelId: '018d819f-0a78-7d38-bb1f-0195b029ddae', intentHash, kind: 'ui_regression' };
    const worker = createUiWorkerChannelV1({ intent, intentHash, owner, channel, schemas, target });
    const sign = (sequence: number, body: any) => channel.signWorkerChannelFrameV1({ binding, direction: 'broker_to_worker', sequence, body, nonce });
    target.emit('message', sign(1, { type: 'custody', custody: { schema: 'mission-control.control-custody.v1', jobId, selectionHash: receipt.selectionHash, sourceSha: receipt.sourceSha, mcBuildHash: receipt.mcBuildHash, nonce } }));
    await worker.ready();
    const pending = worker.send({ type: 'ui_ready', owner, fixtureVersion: 'v1', fixtureHash: 'f'.repeat(64), plannedAssertions: 313 });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(sent.length, 1);
    target.emit('message', sign(2, { type: 'cancel', requestId: jobId, acceptedReceiptRevision: 2 }));
    assert.equal(worker.cancellationRequested(), true);
    target.emit('message', sign(3, { type: 'ack', workerSequence: 1, workerFrameHash: channel.hashWorkerChannelFrameV1(sent[0]), receiptRevision: 3, receipt: { ...receipt, revision: 3, state: 'cancelling', cancelRequested: true, selectionHash: '9'.repeat(64) } }));
    await assert.rejects(pending, /CONTROL_CHANNEL_INVALID/);
    assert.equal(worker.available(), false);
    worker.close();
});
test('fixture cancellation stops future assertion scheduling and retains an incomplete immutable report', async () => {
    const f = workspace();
    try {
        const { runUiRegressionV1 } = await load();
        const result = await runUiRegressionV1({ ...f, browser: { newContext() { throw Error('must not create context after cancel'); } }, control: { cancellationRequested: () => true } });
        assert.equal(result.report.outcome, 'incomplete');
        assert.equal(result.report.assertions.length, 0);
        assert.ok(result.report.finishedAt);
        assert.equal(JSON.parse(readFileSync(path.join(f.tempRoot, 'artifacts', result.reportHash + '.json'), 'utf8')).outcome, 'incomplete');
    }
    finally {
        rmSync(f.root, { recursive: true, force: true });
    }
});
test('private API launches replay the original accepted fixture job and cancellation stays nonterminal until owned settlement', async () => {
    const f = workspace();
    const { createUiRegressionFixtureSessionV1 } = await load();
    let session;
    try {
        session = await createUiRegressionFixtureSessionV1(f);
        const body = { kind: 'ui_regression', idempotencyKey: '018d819f-0a78-7d38-bb1f-0195b029ddad', expectedSelectionHash: 'c'.repeat(64) };
        const post = () => fetch('http://127.0.0.1:13082/api/controls/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
        const a = await post(), b = await post();
        assert.equal(a.replay, false);
        assert.equal(b.replay, true);
        assert.equal(a.receipt.jobId, b.receipt.jobId);
        assert.equal((await (await fetch('http://127.0.0.1:13082/api/controls/jobs')).json()).jobs.length, 1);
        const c = await (await fetch('http://127.0.0.1:13082/api/controls/jobs/' + a.receipt.jobId + '/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idempotencyKey: '018d819f-0a78-7d38-bb1f-0195b029ddac', expectedRevision: 1 }) })).json();
        assert.equal(c.receipt.state, 'cancelling');
        assert.equal(c.receipt.finishedAt, null);
    }
    finally {
        if (session)
            await session.close();
        rmSync(f.root, { recursive: true, force: true });
    }
});
test('loaded build capture imports without credential config, selected runtime or database graph', async () => {
    const { spawnSync } = await import('node:child_process');
    const moduleUrl = new URL('../server/services/product-build-authority-v2-delivery-evidence-v1.ts', import.meta.url).href;
    const script = `import {registerHooks} from 'node:module';registerHooks({resolve(specifier,context,next){const r=next(specifier,context);if(/\\/(config|fresh-installation-runtime)\\.(?:js|ts)$/.test(r.url)||/\\/postgres\\//.test(r.url))throw Error('UI_BOOTSTRAP_EFFECTFUL_IMPORT');return r;}});const m=await import(${JSON.stringify(moduleUrl)});if(typeof m.productBuildAuthorityV2LoadedBuildStartupStateV1!=='function')throw Error('missing capture');`;
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { encoding: 'utf8', timeout: 10000, env: { PATH: '/opt/homebrew/bin:/usr/bin:/bin', TSX_DISABLE_CACHE: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.signal, null);
});
test('extracted canonical JSON preserves key order, Unicode, negative zero and rejection semantics', async () => {
    const { canonicalJsonStringify, hashCanonicalJson, SnapshotValidationError } = await import('../server/services/setfarm-canonical-json-v1.js');
    assert.equal(canonicalJsonStringify({ z: -0, a: ['é', true, null, { b: 1, a: 2 }] }), '{"a":["é",true,null,{"a":2,"b":1}],"z":0}');
    assert.equal(hashCanonicalJson({ b: 2, a: 1 }), '43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777');
    for (const value of [undefined, NaN, Infinity, () => { }, 1n])
        assert.throws(() => canonicalJsonStringify(value), SnapshotValidationError);
});
test('intentional fixture diagnostics pair one exact named request and reject mismatches or extra errors', async () => {
    const { reconcileUiFixtureDiagnosticsV1 } = await load();
    const identity = { assertionId: 'controls.lost-response-reload-idempotency', requestIdentity: 'request-42', method: 'POST', url: 'http://127.0.0.1:13082/api/controls/jobs', bodyHash: 'a'.repeat(64) };
    const fault = { ...identity, kind: 'lost_response', idempotencyKey: '018d819f-0a78-7d38-bb1f-0195b029ddad', acceptedJobId: '018d819f-0a78-7d38-bb1f-0195b029ddaf' };
    const error = { kind: 'console', text: 'Failed to load resource: net::ERR_EMPTY_RESPONSE', url: identity.url, assertionId: identity.assertionId };
    const event = { ...identity, kind: 'requestfailed', errorText: 'net::ERR_EMPTY_RESPONSE' };
    const input = { assertionId: identity.assertionId, errors: [error], requestFailures: [event], faults: [fault] };
    assert.equal(reconcileUiFixtureDiagnosticsV1(input).length, 1);
    for (const changes of [
        { errors: [error, error] }, { requestFailures: [event, event] }, { faults: [] }, { errors: [] }, { requestFailures: [] },
        { assertionId: 'controls.unknown-retention' },
        { errors: [{ ...error, kind: 'pageerror' }] }, { errors: [{ ...error, text: 'Failed to load resource: net::ERR_FAILED' }] },
        { errors: [{ ...error, url: identity.url + '/other' }] },
        { requestFailures: [{ ...event, requestIdentity: 'request-43' }] },
        { requestFailures: [{ ...event, bodyHash: 'b'.repeat(64) }] },
        { requestFailures: [{ ...event, method: 'GET' }] },
        { requestFailures: [{ ...event, errorText: 'net::ERR_ABORTED' }] },
        { faults: [{ ...fault, acceptedJobId: null }] },
    ])
        assert.throws(() => reconcileUiFixtureDiagnosticsV1({ ...input, ...changes }), /UI_BROWSER_ERRORS/);
    const rules = { assertionId: 'rules.draft-503', requestIdentity: 'request-43', method: 'POST', url: 'http://127.0.0.1:13082/api/rules', bodyHash: 'c'.repeat(64), kind: 'rules_503' };
    const ruleInput = { assertionId: rules.assertionId, faults: [rules], errors: [{ kind: 'console', text: 'Failed to load resource: the server responded with a status of 503 (Service Unavailable)', url: rules.url, assertionId: rules.assertionId }], requestFailures: [{ ...rules, kind: 'response', status: 503 }] };
    assert.equal(reconcileUiFixtureDiagnosticsV1(ruleInput).length, 1);
    assert.throws(() => reconcileUiFixtureDiagnosticsV1({ ...ruleInput, requestFailures: [{ ...rules, kind: 'response', status: 500 }] }), /UI_BROWSER_ERRORS/);
    assert.throws(() => reconcileUiFixtureDiagnosticsV1({ ...ruleInput, faults: [rules, rules] }), /UI_BROWSER_ERRORS/);
});
test('Controls HTTP fixture carries six activation and eight convergence preflight checks as distinct strict projections', async (t) => {
    const f = workspace();
    const { createUiRegressionFixtureSessionV1, UI_REGRESSION_FIXTURE_V1 } = await load();
    assert.equal(UI_REGRESSION_FIXTURE_V1.assertionIds.length, 316);
    assert.equal(UI_REGRESSION_FIXTURE_V1.assertionIds.filter(id => id === 'controls.distinct-check-groups').length, 1);
    const { parseControlEvidenceEnvelopeV1 } = await import('../src/lib/control-evidence.ts');
    const sf = new URL('../../setfarm-dashboard-cutover-controller-20261007-v1/src/', import.meta.url);
    const { ControlEvidenceProjectionV1Schema } = await import(new URL('execution/schemas/manual-control-job-v1.ts', sf).href);
    const { PreflightCheckV1Schema } = await import(new URL('execution/schemas/activation-preflight-report-v1.ts', sf).href);
    const { ConvergencePreflightCheckIdV1Schema } = await import(new URL('evals/result-schema.ts', sf).href);
    let session;
    try {
        session = await createUiRegressionFixtureSessionV1(f);
        // This server has a new original owner; do not reuse another test's pooled socket.
        const { get } = await import('node:http');
        const raw: any = await new Promise((resolve, reject) => {
            const request = get('http://127.0.0.1:13082/api/controls/evidence', { agent: false }, response => {
                const parts: Buffer[] = [];
                response.on('data', part => parts.push(part));
                response.once('error', reject);
                response.once('end', () => {
                    try {
                        assert.equal(response.statusCode, 200);
                        resolve(JSON.parse(Buffer.concat(parts).toString('utf8')));
                    }
                    catch (error) {
                        reject(error);
                    }
                });
            });
            request.once('error', reject);
        });
        const parsed = parseControlEvidenceEnvelopeV1(raw);
        ControlEvidenceProjectionV1Schema.parse({ activation: raw.evidence.activation, evaluation: raw.evidence.evaluation });
        ControlEvidenceProjectionV1Schema.parse(raw.history[0].evidence);
        await t.test('convergence has exactly its eight Source IDs separate from planned case rows', () => {
            const report = parsed.evidence.evaluation.report!;
            assert.deepEqual(report.preflightChecks.map(row => row.id), ConvergencePreflightCheckIdV1Schema.options);
            assert.equal(new Set(report.preflightChecks.map(row => row.id)).size, 8);
            assert.equal(report.cases.length, 8);
            assert.equal(new Set(report.cases.map(row => row.caseId)).size, 8);
            assert.ok(report.cases.every(row => row.evidenceState === 'not_started' && row.runId === null && row.resultHash === null && row.passed === null && row.disposition === null));
            assert.ok(report.preflightChecks.every(row => row.status === 'pass' && row.code.startsWith('EVAL_') && !report.cases.some(c => c.caseId === row.id)));
            assert.equal(report.executionMode, 'preflight');
            assert.equal(report.resultStatus, 'planned');
            assert.equal(report.qualification, 'unqualified');
            assert.equal(report.completedCases, 0);
        });
        await t.test('activation has exactly its six Source checks with strict current and historical shape', () => {
            const activation = parsed.evidence.activation.report;
            assert.ok(activation);
            assert.deepEqual(activation.checks.map(row => row.id), PreflightCheckV1Schema.shape.id.options);
            for (const row of activation.checks) {
                PreflightCheckV1Schema.parse(row);
                assert.equal(row.blocking, row.status === 'fail');
                assert.equal(row.status, 'pass');
            }
            assert.equal(activation.compatibility, 'current');
            assert.equal(activation.protocol, 'shadow');
            assert.equal(parsed.history[0].evidence.activation.report?.compatibility, 'historical');
            assert.deepEqual(parsed.history[0].evidence.activation.report?.checks, activation.checks);
            const foreign = structuredClone(raw);
            foreign.evidence.activation.report.checks[0].authority = 'invented';
            assert.throws(() => parseControlEvidenceEnvelopeV1(foreign), /CONTROL_RESPONSE_INVALID/);
            assert.throws(() => ControlEvidenceProjectionV1Schema.parse({ activation: foreign.evidence.activation, evaluation: foreign.evidence.evaluation }));
        });
    }
    finally {
        if (session)
            await session.close();
        rmSync(f.root, { recursive: true, force: true });
    }
});
async function simulatedReviewChannel() {
    const { EventEmitter } = await import('node:events');
    const { createUiWorkerChannelV1 } = await import('../scripts/ui-regression.mjs');
    const sf = new URL('../../setfarm-dashboard-cutover-controller-20261007-v1/src/', import.meta.url);
    const channel = await import(new URL('execution/schemas/manual-control-worker-channel-v1.ts', sf).href);
    const schemas = await import(new URL('execution/schemas/manual-control-job-v1.ts', sf).href);
    const jobId = '018d819f-0a78-7d38-bb1f-0195b029ddaf', nonce = 'n'.repeat(64), at = '2026-10-19T10:00:00.000Z';
    const owner = { pid: 42, processStartedAt: at, processGroupId: 42, source: 'observed_os', executable: '/node', script: '/mc/dist-server/scripts/ui-regression.mjs', commandHash: '1'.repeat(64) };
    let receipt: any = { schema: 'mission-control.control-job.v1', jobId, kind: 'ui_regression', revision: 1, selectionHash: 'a'.repeat(64), sourceSha: 'b'.repeat(40), mcSourceSha: 'c'.repeat(40), mcBuildHash: 'd'.repeat(64), suiteHash: null, state: 'accepted', requestedAt: at, startedAt: null, updatedAt: at, finishedAt: null, phase: 'starting', code: null, currentCaseId: null, ownedRunId: null, completedCases: 0, plannedCases: 316, reportRefs: {}, cancelRequested: false };
    const intent = { schema: 'mission-control.control-intent.v1', receipt, installationDir: '/installation', releaseDir: '/release', nonceDigest: createHash('sha256').update(nonce).digest('hex'), fixedSuiteRelativePath: null };
    const target = new EventEmitter() as any, frames: any[] = [];
    target.connected = true;
    target.send = (frame: any, done: Function) => { frames.push(frame); done(); };
    const binding = { jobId, channelId: '018d819f-0a78-7d38-bb1f-0195b029ddae', intentHash: 'e'.repeat(64), kind: 'ui_regression' };
    const worker = createUiWorkerChannelV1({ intent, intentHash: binding.intentHash, owner, channel, schemas, target });
    let brokerSequence = 0;
    const deliver = (body: any) => target.emit('message', channel.signWorkerChannelFrameV1({ binding, direction: 'broker_to_worker', sequence: ++brokerSequence, body, nonce }));
    deliver({ type: 'custody', custody: { schema: 'mission-control.control-custody.v1', jobId, selectionHash: receipt.selectionHash, sourceSha: receipt.sourceSha, mcBuildHash: receipt.mcBuildHash, nonce } });
    await worker.ready();
    async function begin(body: any) { const promise = worker.send(body); promise.catch(() => { }); await new Promise(resolve => setImmediate(resolve)); return { promise, frame: frames.at(-1) }; }
    function ack(frame: any, patch: any = {}) {
        const sent = frame.body;
        let change: any = {};
        if (sent.type === 'ui_ready')
            change = { state: receipt.cancelRequested ? 'cancelling' : 'starting', phase: 'starting', plannedCases: sent.plannedAssertions };
        if (sent.type === 'ui_progress')
            change = { state: receipt.cancelRequested ? 'cancelling' : 'running', phase: sent.phase, code: sent.code, completedCases: sent.completedAssertions, startedAt: receipt.startedAt ?? (sent.phase === 'running' ? at : null), reportRefs: {} };
        if (sent.type === 'ui_cancel_observed')
            change = { code: sent.effective === 'after_boundary' ? 'CONTROL_CANCEL_TOO_LATE' : 'CONTROL_CANCEL_REQUESTED' };
        if (sent.type === 'ui_final')
            change = { state: sent.outcome, phase: 'closed', code: sent.code, completedCases: sent.completedAssertions, finishedAt: at, reportRefs: { uiReportHash: sent.uiReportHash }, currentCaseId: null, ownedRunId: null };
        receipt = { ...receipt, ...change, revision: receipt.revision + 1, updatedAt: at, ...patch };
        deliver({ type: 'ack', workerSequence: frame.sequence, workerFrameHash: channel.hashWorkerChannelFrameV1(frame), receiptRevision: receipt.revision, receipt });
        return receipt;
    }
    function cancel(revision = receipt.revision + 1) { receipt = { ...receipt, revision, state: 'cancelling', cancelRequested: true, code: 'CONTROL_CANCEL_REQUESTED' }; deliver({ type: 'cancel', requestId: jobId, acceptedReceiptRevision: revision }); }
    const ready = () => begin({ type: 'ui_ready', owner, fixtureVersion: 'ui-regression-owned-v1', fixtureHash: 'f'.repeat(64), plannedAssertions: 316 });
    const progress = () => begin({ type: 'ui_progress', phase: 'running', completedAssertions: 1, plannedAssertions: 316, code: null });
    const final = () => begin({ type: 'ui_final', uiReportHash: '2'.repeat(64), cleanupHash: '3'.repeat(64), ownedCleanup: 'confirmed', outcome: 'completed', code: null, completedAssertions: 1, plannedAssertions: 316 });
    return { worker, begin, ack, cancel, cancelNotice: (acceptedReceiptRevision: number) => deliver({ type: 'cancel', requestId: jobId, acceptedReceiptRevision }), ready, progress, final, receipt: () => receipt };
}
test('review I3 valid-MAC ACKs must match exact UI event receipt semantics and ordered time facts', async (t) => {
    const cases: [
        string,
        string,
        any
    ][] = [
        ['ready-state', 'ready', { state: 'running' }], ['ready-count', 'ready', { completedCases: 1 }], ['ready-code', 'ready', { code: 'WRONG_CODE' }], ['ready-start', 'ready', { startedAt: '2026-10-19T10:00:00.000Z' }],
        ['progress-phase', 'progress', { phase: 'cleanup' }], ['progress-code', 'progress', { code: 'WRONG_CODE' }], ['progress-count', 'progress', { completedCases: 2 }], ['progress-state', 'progress', { state: 'ownership_unknown' }],
        ['progress-missing-start', 'progress', { startedAt: null }], ['progress-case', 'progress', { currentCaseId: 'foreign-case' }], ['progress-run', 'progress', { ownedRunId: 'foreign-run' }],
        ['revision-jump', 'progress', { revision: 9 }], ['updated-before-request', 'progress', { updatedAt: '2026-10-19T09:00:00.000Z' }], ['start-after-update', 'progress', { startedAt: '2026-10-19T11:00:00.000Z' }],
        ['final-phase', 'final', { phase: 'running' }], ['final-code', 'final', { code: 'WRONG_CODE' }], ['final-extra-ref', 'final', { reportRefs: { uiReportHash: '2'.repeat(64), resultHash: '4'.repeat(64) } }], ['final-time', 'final', { finishedAt: '2026-10-19T09:00:00.000Z' }], ['final-changed-start', 'final', { startedAt: null }],
        ['cancel-count', 'cancel', { completedCases: 2 }], ['cancel-phase', 'cancel', { phase: 'cleanup' }], ['cancel-code', 'cancel', { code: null }], ['cancel-state', 'cancel', { state: 'running' }],
    ];
    for (const [name, stage, patch] of cases)
        await t.test(name, async () => {
            const h = await simulatedReviewChannel();
            try {
                let p = await h.ready();
                if (stage === 'ready') {
                    h.ack(p.frame, patch);
                    await assert.rejects(p.promise, /CONTROL_CHANNEL_INVALID/);
                    return;
                }
                h.ack(p.frame);
                await p.promise;
                p = await h.progress();
                if (stage === 'progress') {
                    h.ack(p.frame, patch);
                    await assert.rejects(p.promise, /CONTROL_CHANNEL_INVALID/);
                    return;
                }
                h.ack(p.frame);
                await p.promise;
                if (stage === 'final')
                    p = await h.final();
                else {
                    h.cancel();
                    p = await h.begin({ type: 'ui_cancel_observed', requestId: h.receipt().jobId, effective: 'latched' });
                }
                h.ack(p.frame, patch);
                await assert.rejects(p.promise, /CONTROL_CHANNEL_INVALID/);
                assert.equal(h.worker.available(), false);
            }
            finally {
                h.worker.close();
            }
        });
});
test('review I3 cancellation floor rejects stale receipts while valid outstanding ACK and late-boundary mapping settle', async (t) => {
    await t.test('accepted cancellation revision must advance prior receipt', async () => {
        const h = await simulatedReviewChannel();
        try {
            const p = await h.ready();
            h.cancel(1);
            await assert.rejects(p.promise, /CONTROL_CHANNEL_INVALID/);
        }
        finally {
            h.worker.close();
        }
    });
    await t.test('next ACK must advance accepted cancellation floor', async () => {
        const h = await simulatedReviewChannel();
        try {
            let p = await h.ready();
            h.ack(p.frame);
            await p.promise;
            assert.equal(h.receipt().revision, 2);
            h.cancel(3);
            assert.equal(h.worker.available(), true, 'valid cancellation must leave the channel available');
            p = await h.begin({ type: 'ui_cancel_observed', requestId: h.receipt().jobId, effective: 'latched' });
            let settled = false;
            void p.promise.then(() => { settled = true; }, () => { settled = true; });
            await new Promise(resolve => setImmediate(resolve));
            assert.equal(settled, false);
            assert.equal(h.worker.available(), true, 'valid cancellation must leave the ACK pending');
            h.ack(p.frame, { revision: 3 });
            await assert.rejects(p.promise, /CONTROL_CHANNEL_INVALID/);
            assert.equal(h.worker.available(), false);
        }
        finally {
            h.worker.close();
        }
    });
    for (const late of [false, true])
        await t.test(late ? 'late boundary preserves completion decision' : 'cancel while running ACK outstanding is latched', async () => {
            const h = await simulatedReviewChannel();
            try {
                let p = await h.ready();
                h.ack(p.frame);
                await p.promise;
                p = await h.progress();
                if (late)
                    assert.equal(h.worker.decideFinal(), false);
                h.cancel();
                h.ack(p.frame);
                await p.promise;
                assert.equal(h.worker.cancellationRequested(), !late);
                p = await h.begin({ type: 'ui_cancel_observed', requestId: h.receipt().jobId, effective: late ? 'after_boundary' : 'latched' });
                h.ack(p.frame);
                await p.promise;
                assert.equal(h.receipt().code, late ? 'CONTROL_CANCEL_TOO_LATE' : 'CONTROL_CANCEL_REQUESTED');
                if (late) {
                    p = await h.final();
                    h.ack(p.frame);
                    await p.promise;
                    assert.equal(h.receipt().state, 'completed');
                }
            }
            finally {
                h.worker.close();
            }
        });
});
test('review I4 late build drift retains strict accumulated candidate and PNG manifest before owned context closure', async () => {
    const f = workspace();
    const { runUiRegressionV1 } = await load();
    const schemas = await import('../server/services/control-ui-worker-protocol.js');
    let stop = false, contextCloseAttempted = false, candidateSeenAtClose = false;
    const page = { on() { }, setDefaultTimeout() { }, goto: async () => { }, url: () => 'http://127.0.0.1:13082/', locator: () => ({ waitFor: async () => { }, innerText: async () => 'A complete first fixture page with enough visible content for the actual loaded assertion.' }), screenshot: async () => Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]) };
    const browser = { newContext: async () => ({ route: async () => { }, routeWebSocket: async () => { }, addInitScript: async () => { }, on() { }, newPage: async () => page, close: async () => {
                contextCloseAttempted = true;
                const reports = readdirSync(path.join(f.tempRoot, 'artifacts')).filter(name => name.endsWith('.json')).map(name => JSON.parse(readFileSync(path.join(f.tempRoot, 'artifacts', name), 'utf8'))).filter(value => value.schema === 'mission-control.ui-regression.v1');
                candidateSeenAtClose = reports.some(report => report.assertions.length === 1 && report.screenshots.length === 1);
            } }) };
    try {
        const result = await runUiRegressionV1({ ...f, browser, schemas, control: { cancellationRequested: () => stop, onProgress: async () => { writeFileSync(path.join(f.buildDir, 'dist/index.html'), 'late measured content drift'); stop = true; } } });
        assert.equal(contextCloseAttempted, true);
        assert.equal(candidateSeenAtClose, true);
        assert.equal(result.integrity, 'failed');
        assert.equal(result.report.outcome, 'incomplete');
        assert.deepEqual(result.report.assertions, [{ id: 'page.home.390.loaded', status: 'pass', code: null }]);
        assert.equal(result.report.screenshots.length, 1);
        const stored = schemas.UiRegressionReportV1Schema.parse(JSON.parse(readFileSync(path.join(f.tempRoot, 'artifacts', result.reportHash + '.json'), 'utf8')));
        assert.deepEqual(stored, result.report);
        assert.equal(createHash('sha256').update(readFileSync(path.join(f.tempRoot, 'artifacts', stored.screenshots[0].sha256 + '.png'))).digest('hex'), stored.screenshots[0].sha256);
        assert.ok(result.diagnosticHashes.length);
        const diagnostic = JSON.parse(readFileSync(path.join(f.tempRoot, 'artifacts', result.diagnosticHashes[0] + '.json'), 'utf8'));
        assert.equal(diagnostic.code, 'UI_REPORT_INTEGRITY_FAILED');
        const originalCandidate = schemas.UiRegressionReportV1Schema.parse(JSON.parse(readFileSync(path.join(f.tempRoot, 'artifacts', diagnostic.candidateReportHash + '.json'), 'utf8')));
        assert.deepEqual(originalCandidate.assertions, result.report.assertions);
        assert.deepEqual(originalCandidate.screenshots, result.report.screenshots);
    }
    finally {
        rmSync(f.root, { recursive: true, force: true });
    }
});
test('review I3 actual broker pre-ready cancellation ACK precedes its matching older cancellation notice', async (t) => {
    await t.test('ready ACK revision3 latches cancellation before accepted revision2 notice, then exact cancel ACK4', async () => {
        const h = await simulatedReviewChannel();
        try {
            const ready = await h.ready();
            // control-jobs.ts: cancel stores rev2 while !s.ready; ready commits rev3, sends ACK, then sends cancel rev2.
            h.ack(ready.frame, { revision: 3, cancelRequested: true, state: 'cancelling', code: 'CONTROL_CANCEL_REQUESTED' });
            await ready.promise;
            assert.equal(h.worker.cancellationRequested(), true);
            assert.equal(h.worker.available(), true);
            h.cancelNotice(2);
            assert.equal(h.worker.available(), true);
            const observed = await h.begin({ type: 'ui_cancel_observed', requestId: h.receipt().jobId, effective: 'latched' });
            h.ack(observed.frame);
            await observed.promise;
            assert.equal(h.receipt().revision, 4);
            assert.equal(h.receipt().completedCases, 0);
            assert.equal(h.receipt().startedAt, null);
        }
        finally {
            h.worker.close();
        }
    });
    for (const defect of ['notice-wrong-revision', 'ready-extra-gap', 'ready-wrong-code', 'ack-before-required-notice', 'duplicate-notice'])
        await t.test(defect, async () => {
            const h = await simulatedReviewChannel();
            try {
                const ready = await h.ready();
                h.ack(ready.frame, { revision: defect === 'ready-extra-gap' ? 4 : 3, cancelRequested: true, state: 'cancelling', code: defect === 'ready-wrong-code' ? null : 'CONTROL_CANCEL_REQUESTED' });
                if (defect.startsWith('ready-')) {
                    await assert.rejects(ready.promise, /CONTROL_CHANNEL_INVALID/);
                    return;
                }
                await ready.promise;
                if (defect === 'ack-before-required-notice') {
                    const progress = await h.progress();
                    h.ack(progress.frame);
                    await assert.rejects(progress.promise, /CONTROL_CHANNEL_INVALID/);
                }
                else {
                    h.cancelNotice(defect === 'notice-wrong-revision' ? 1 : 2);
                    if (defect === 'duplicate-notice')
                        h.cancelNotice(2);
                    assert.equal(h.worker.available(), false);
                }
            }
            finally {
                h.worker.close();
            }
        });
});

test('review fix3 fourteen deterministic avatar assets are served only at exact GET targets', async (t) => {
    const f = workspace();
    const { createUiRegressionFixtureSessionV1, UI_REGRESSION_FIXTURE_V1 } = await load();
    assert.equal(UI_REGRESSION_FIXTURE_V1.fixtureVersion, 'ui-regression-owned-v1');
    assert.equal(UI_REGRESSION_FIXTURE_V1.fixtureHash, 'b662bf27e6ab9479a47986c4cc35c5cd9a23e301f695f5cb142c0e15712e3aa4');
    assert.equal(UI_REGRESSION_FIXTURE_V1.assertionIds.length, 316);
    assert.equal(createHash('sha256').update(JSON.stringify(UI_REGRESSION_FIXTURE_V1.assertionIds)).digest('hex'), '4ded731c52c60105daa60639aa64683b68d1d3f22e9c3e685bb794b67e8ba88d');
    const { request } = await import('node:http');
    const get = (target: string, method = 'GET') => new Promise<{ status: number; type: string; body: Buffer }>((resolve, reject) => {
        const req = request({ host: '127.0.0.1', port: 13082, path: target, method, agent: false }, res => {
            const parts: Buffer[] = [];
            res.on('data', part => parts.push(part));
            res.once('error', reject);
            res.once('end', () => resolve({ status: res.statusCode!, type: String(res.headers['content-type']), body: Buffer.concat(parts) }));
        });
        req.once('error', reject);
        req.end();
    });
    let session;
    try {
        session = await createUiRegressionFixtureSessionV1(f);
        const agents = JSON.parse((await get('/api/agents')).body.toString());
        assert.equal(agents.length, 14);
        await t.test('all fourteen exact paths return repeatable SVG bytes and MIME', async () => {
            const goldenHashes = [
                'e8ddf590349ca041078f5d1c7ed625faad25127ec8a1eab1b8888b3ad7110ff8',
                '022d1b3fdbc4a8c5210840409f4a36b68b028a4e1d9e057553907d0392455ea4',
                'bc11d4e196692d3cb0870c3eca4fbdf6a81128e80d5b7f03b918cc8a5cd4ac48',
                '55b56f44964b7c48cd5e1f478073ef3d6516138f3d0f93e9d5df6ae68c90091c',
                'bd31a4ff9fc54c033ee67cb495c8f94b82affb8757254fc1d9cc6455bc912872',
                '77fc7526e6dd1d1b540d6faa1859abde1abedb1c494aa0b7342419785dcd9425',
                '0977904256d89747e6f5b56e4b9bdde229ef0067c67fac5a7fb5a00b1ca25e35',
                '9be4cdb4d6bf7cd4fab7768d9cb13059c8caaa93ee4ba3dc6f803040d0d41b3a',
                'bb9c539c2d89b1a41b53673a5a282b0437b0857b4a16d8f00c6ac1d1cecf7e41',
                '0da9b1093bf8b034e473b76e4fc8240ee49c40a9873e5b3c275247fb4a3ffbd3',
                'eaa3cf3cab3866e670369c698cd4ed17100d51602760beedca67d22f83f49a6b',
                'f49df130ac69d101c3579e087d0431abdcce3e31fd863066adcc992caae7dce8',
                'a57f92344309271a11c799b3f1729dbd332d77ae060e6ac5ea82d44325ec4c33',
                '61515fef01e45f8d54952170b57bfa15819680ca40258d44907850a82ea40ad6',
            ];
            for (const agent of agents) {
                const target = '/avatars/' + agent.id + '.svg';
                const first = await get(target), second = await get(target);
                assert.equal(first.status, 200, target);
                assert.equal(first.type, 'image/svg+xml');
                assert.deepEqual(second, first);
                assert.match(first.body.toString(), /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
                assert.ok(first.body.includes(Buffer.from('<title>' + agent.name + '</title>')));
                assert.doesNotMatch(first.body.toString(), /<(?:script|image|foreignObject)\b|href=|url\(/);
                assert.equal(createHash('sha256').update(first.body).digest('hex'), goldenHashes[agents.indexOf(agent)]);
                assert.equal(first.body.length, 371 + String(agents.indexOf(agent) + 1).length);
            }
        });
        await t.test('unknown mutations traversal aliases and foreign origins remain visible refusals', async () => {
            const before = session.unexpectedRequests.length;
            const bad: [string, string][] = [
                ['/avatars/fixture-agent-15.svg', 'GET'], ['/avatars/fixture-agent-1.svg', 'POST'],
                ['/avatars/x/../fixture-agent-1.svg', 'GET'], ['/avatars/%2e/fixture-agent-1.svg', 'GET'],
                ['/avatars/fixture-agent-1.svg?extra=1', 'GET'], ['http://foreign.invalid/avatars/fixture-agent-1.svg', 'GET'],
            ];
            for (const [target, method] of bad) assert.equal((await get(target, method)).status, 403, target);
            assert.equal(session.unexpectedRequests.length - before, bad.length);
        });
    } finally {
        if (session) await session.close();
        rmSync(f.root, { recursive: true, force: true });
    }
});
test('review fix3 installed browser fence permits exactly fourteen GET avatars and retains denied requests', async () => {
    const f = workspace();
    const { runUiRegressionV1 } = await load();
    let fence: any;
    const cases: [string, string, string][] = Array.from({ length: 14 }, (_, i) => ['http://127.0.0.1:13082/avatars/fixture-agent-' + (i + 1) + '.svg', 'GET', 'continue']);
    cases.push(['http://127.0.0.1:13082/avatars/fixture-agent-15.svg', 'GET', 'abort'], ['http://127.0.0.1:13082/avatars/fixture-agent-1.svg', 'POST', 'abort'], ['http://127.0.0.1:13082/avatars/x/../fixture-agent-1.svg', 'GET', 'abort'], ['http://127.0.0.1:13082/avatars/fixture-agent-1.svg?extra=1', 'GET', 'abort'], ['http://foreign.invalid/avatars/fixture-agent-1.svg', 'GET', 'abort']);
    const actual: string[] = [];
    const page = { on() { }, setDefaultTimeout() { }, goto: async () => {
        for (const [url, method] of cases) await fence({ request: () => ({ url: () => url, method: () => method }), continue: async () => { actual.push('continue'); }, abort: async () => { actual.push('abort'); } });
        throw Error('intentional component stop after route probes');
    }, screenshot: async () => Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]), url: () => 'http://127.0.0.1:13082/', close: async () => { } };
    const browser = { newContext: async () => ({ route: async (_pattern: string, callback: any) => { fence = callback; }, routeWebSocket: async () => { }, addInitScript: async () => { }, on() { }, newPage: async () => page, close: async () => { } }) };
    try {
        const result = await runUiRegressionV1({ ...f, browser });
        assert.equal(result.report.outcome, 'fail');
        assert.deepEqual(actual, cases.map(row => row[2]));
        const diagnostics = result.diagnosticHashes.map(hash => JSON.parse(readFileSync(path.join(f.tempRoot, 'artifacts', hash + '.json'), 'utf8')));
        assert.deepEqual(diagnostics[0].requests, cases.filter(row => row[2] === 'abort').map(row => ({ method: row[1], path: 'denied-origin-or-route' })));
    } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('review fix4 real fixture responses satisfy mounted pipeline and exact read contracts', async (t) => {
    const f = workspace();
    const { createUiRegressionFixtureSessionV1 } = await load();
    const { request } = await import('node:http');
    const read = (target: string, method = 'GET') => new Promise<{ status: number; body: any }>((resolve, reject) => {
        const req = request({ host: '127.0.0.1', port: 13082, path: target, method, agent: false }, res => {
            const parts: Buffer[] = [];
            res.on('data', part => parts.push(part));
            res.once('error', reject);
            res.once('end', () => {
                try { const text = Buffer.concat(parts).toString(); resolve({ status: res.statusCode!, body: text ? JSON.parse(text) : null }); }
                catch (error) { reject(error); }
            });
        });
        req.once('error', reject);
        req.end();
    });
    let session;
    try {
        session = await createUiRegressionFixtureSessionV1(f);
        await t.test('actual PipelineView renders both HTTP rows and their coherent eight story buckets', async () => {
            const { createElement } = await import('react');
            const { renderToStaticMarkup } = await import('react-dom/server');
            const { MemoryRouter } = await import('react-router-dom');
            const { PipelineView } = await import('../src/components/PipelineView.tsx');
            const response = await read('/api/setfarm/pipeline');
            assert.equal(response.status, 200);
            const html = renderToStaticMarkup(createElement(MemoryRouter, {}, createElement(PipelineView, { runs: response.body })));
            assert.match(html, /Legacy fixture/);
            assert.match(html, /V3 fixture/);
            assert.equal(response.body.length, 2);
            const summaries = (await read('/api/runs')).body;
            for (const run of response.body) {
                const summary = summaries.find((row: any) => row.id === run.id);
                assert.deepEqual(run.storyProgress, { completed: 1, total: 1, verified: 1, skipped: 0, running: 0, pending: 0, done: 0, failed: 0 });
                assert.equal(run.storyProgress.total, summary.storyCount);
                assert.equal(run.storyProgress.completed, summary.storiesDone);
                assert.equal(run.operational, null);
                assert.equal((await read('/api/setfarm/runs/' + run.id + '/operational-snapshot')).body.status, 'unavailable');
            }
            assert.match(html, /UNKNOWN/);
        });
        await t.test('alerts uses its actual consumed counts and recent envelope', async () => {
            assert.deepEqual(await read('/api/setfarm/alerts'), { status: 200, body: { counts: { abandoned: 0, timeout: 0, failed: 0 }, recent: [] } });
        });
        await t.test('quota is an empty provider-keyed map', async () => {
            assert.deepEqual(await read('/api/quota'), { status: 200, body: {} });
        });
        for (const [target, body] of [['/api/agents/main/history?limit=40', { messages: [] }], ['/api/live-feed/projects?format=rich', []], ['/api/live-feed/history?limit=300', []]] as const)
            await t.test('exact deterministic GET ' + target, async () => {
                assert.deepEqual(await read(target), { status: 200, body });
                assert.deepEqual(await read(target), { status: 200, body });
            });
        await t.test('unknown siblings alternate queries traversal mutation and foreign origins stay denied', async () => {
            const before = session.unexpectedRequests.length;
            const invalid: [string, string][] = [
                ['/api/agents/main/history', 'GET'], ['/api/agents/main/history?limit=41', 'GET'],
                ['/api/agents/main/history?limit=40&extra=1', 'GET'], ['/api/agents/other/history?limit=40', 'GET'],
                ['/api/live-feed/projects', 'GET'], ['/api/live-feed/projects?format=plain', 'GET'],
                ['/api/live-feed/history', 'GET'], ['/api/live-feed/history?limit=301', 'GET'],
                ['/api/live-feed/history?limit=300&agent=all', 'GET'], ['/api/live-feed/unknown?limit=300', 'GET'],
                ['/api/live-feed/x/../history?limit=300', 'GET'], ['/api/live-feed/%2e/history?limit=300', 'GET'],
                ['/api/agents/main/history?limit=40', 'POST'], ['/api/live-feed/projects?format=rich', 'POST'], ['/api/live-feed/history?limit=300', 'POST'],
                ['http://foreign.invalid/api/live-feed/history?limit=300', 'GET'],
            ];
            for (const [target, method] of invalid) assert.equal((await read(target, method)).status, 403, target);
            assert.equal(session.unexpectedRequests.length - before, invalid.length);
        });
    } finally {
        if (session) await session.close();
        rmSync(f.root, { recursive: true, force: true });
    }
});

// Simulated DOM geometry only. The engine's actual page.evaluate callback makes the decision.
function responsiveGeometry(scenario: string) {
    const nodes: any[] = [];
    function element(tag: string, className: string, left: number, width: number, parent: any = null, style: any = {}) {
        const e: any = { tagName: tag.toUpperCase(), className, parentElement: parent, children: [], clientLeft: 0, clientWidth: width, scrollWidth: width,
            style: { display: 'block', visibility: 'visible', overflowX: 'visible', ...style },
            getBoundingClientRect: () => ({ left, right: left + width, width, top: 0, bottom: 30, height: 30 }),
            getAttribute: (name: string) => name === 'class' ? className : null,
            matches: (selector: string) => selector.split(',').some(part => { const s = part.trim(); return s.startsWith('.') ? className.split(' ').includes(s.slice(1)) : s.toUpperCase() === e.tagName; }),
            contains: (other: any) => { for (let n = other; n; n = n.parentElement) if (n === e) return true; return false; },
            querySelectorAll: (selector: string) => nodes.filter(n => n !== e && e.contains(n) && n.matches(selector)),
        };
        nodes.push(e); parent?.children.push(e); return e;
    }
    const root = element('html', '', 0, 390), main = element('main', 'layout__content', 0, 390, root, { overflowX: 'auto' });
    const page = element('div', 'projects-page', 8, 374, main);
    if (scenario === 'document-overflow') root.scrollWidth = 500;
    if (scenario === 'main-overflow') main.scrollWidth = 600;
    if (scenario === 'tab-content-overflow') { main.scrollWidth = 600; page.scrollWidth = 592; }
    if (scenario === 'hidden-header') {
        const header = element('div', 'af-page__header', 8, 374, page, { overflowX: 'hidden' }); header.scrollWidth = 650;
    }
    if (scenario === 'offscreen-control') element('button', 'action', 360, 100, page);
    if (scenario === 'clipped-ancestor') {
        const clip = element('div', 'panel', 8, 100, page, { overflowX: 'hidden' }); element('button', 'action', 80, 100, clip);
    }
    if (['bounded-table', 'bounded-tabs', 'bounded-inline-tabs', 'overwide-wrapper', 'arbitrary-auto', 'hidden-scroller'].includes(scenario)) {
        const name = scenario === 'arbitrary-auto' ? 'not-reviewed' : scenario === 'bounded-tabs' ? 'rd-tabs' : scenario === 'bounded-inline-tabs' ? 'af-inline-plan__tabs' : 'cron-table';
        const wrapper = element('div', name, 8, scenario === 'overwide-wrapper' ? 500 : 374, page, { overflowX: scenario === 'hidden-scroller' ? 'hidden' : 'auto' });
        wrapper.scrollWidth = 900;
        element('button', 'internal-control', 600, 100, wrapper);
    }
    if (scenario === 'wrapped-fit') {
        const header = element('div', 'projects-page__header', 8, 374, page);
        element('button', 'action', 8, 160, header); element('button', 'action', 190, 160, header);
    }
    if (scenario === 'bounded-diagnostics') for (let i = 0; i < 20; i++) element('button', 'x'.repeat(160), 400 + i, 30, page);
    return { window: { innerWidth: 390 }, document: { documentElement: root, querySelector: (selector: string) => scenario === 'missing-main' ? null : nodes.find(n => n.matches(selector)) ?? null }, getComputedStyle: (e: any) => e.style };
}
test('responsive overflow assertion checks real evaluator against simulated main clipping and bounded internal scroll geometry', async (t) => {
    const { runInNewContext } = await import('node:vm');
    const cases: [string, 'pass' | 'fail'][] = [
        ['document-overflow', 'fail'], ['main-overflow', 'fail'], ['hidden-header', 'fail'], ['offscreen-control', 'fail'],
        ['clipped-ancestor', 'fail'], ['wrapped-fit', 'pass'], ['bounded-table', 'pass'], ['bounded-tabs', 'pass'],
        ['overwide-wrapper', 'fail'], ['arbitrary-auto', 'fail'], ['hidden-scroller', 'fail'], ['missing-main', 'fail'], ['bounded-diagnostics', 'fail'],
    ];
    for (const [scenario, expected] of cases) await t.test(scenario, async () => {
        const f = workspace();
        const { runUiRegressionV1 } = await load();
        let stop = false, closed = false, evaluations = 0;
        const geometry = responsiveGeometry(scenario);
        const page = { on() { }, setDefaultTimeout() { }, goto: async () => {},
            locator: () => ({ waitFor: async () => {}, innerText: async () => 'Fixture content sufficiently long to finish the existing loaded assertion.' }),
            evaluate: async (callback: Function) => { evaluations++; return runInNewContext('(' + callback.toString() + ')()', geometry); },
            screenshot: async () => Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]), url: () => 'http://127.0.0.1:13082/', close: async () => {},
        };
        const browser = { newContext: async () => ({ route: async () => {}, routeWebSocket: async () => {}, addInitScript: async () => {}, on() {}, newPage: async () => page, close: async () => { closed = true; } }) };
        try {
            const result = await runUiRegressionV1({ ...f, browser, control: { cancellationRequested: () => stop, onAssertionBoundary: async ({ id, edge }: any) => { if (id === 'page.home.390.overflow' && edge === 'after') stop = true; } } });
            assert.equal(evaluations, 1);
            assert.equal(result.report.assertions.length, 2);
            assert.equal(result.report.assertions[0].status, 'pass');
            assert.equal(result.report.assertions[1].id, 'page.home.390.overflow');
            assert.equal(result.report.assertions[1].status, expected);
            assert.equal(closed, true);
            if (expected === 'fail') {
                const diagnostic = JSON.parse(readFileSync(path.join(f.tempRoot, 'artifacts', result.diagnosticHashes[0] + '.json'), 'utf8'));
                assert.match(diagnostic.message, /^UI_HORIZONTAL_OVERFLOW /);
                const details = JSON.parse(diagnostic.message.slice('UI_HORIZONTAL_OVERFLOW '.length));
                assert.ok(details.count > 0);
                assert.ok(details.samples.length > 0 && details.samples.length <= 8);
                for (const sample of details.samples) {
                    assert.ok(sample.tag.length <= 20 && sample.className.length <= 80);
                    assert.deepEqual(Object.keys(sample).sort(), ['className', 'clientWidth', 'kind', 'left', 'right', 'scrollWidth', 'tag']);
                    for (const key of ['left', 'right', 'clientWidth', 'scrollWidth']) assert.equal(typeof sample[key], 'number');
                }
                if (scenario === 'bounded-diagnostics') {
                    assert.equal(details.samples.length, 8);
                    assert.ok(details.count >= 20);
                    assert.ok(diagnostic.message.length < 4096);
                }
            }
        } finally { rmSync(f.root, { recursive: true, force: true }); }
    });
});

// Simulated page/locator effects, not native tab or page qualification. The real engine
// executes its tab assertion; unrelated page gates use a bounded synthetic DOM.
test('run tab assertion binds the exact selected button despite uppercase rendered text', async (t) => {
    const { runInNewContext } = await import('node:vm');
    const cases: [string, 'pass' | 'fail', number][] = [
        ['uppercase', 'pass', 1], ['badge-count', 'pass', 1], ['wrong-active', 'fail', 1],
        ['duplicate-active', 'fail', 1], ['ambiguous-selection', 'fail', 0], ['missing-selection', 'fail', 0],
        ['prefix-label', 'fail', 0], ['not-actionable', 'fail', 1],
        ['tab-content-overflow', 'fail', 1], ['bounded-inline-tabs', 'pass', 1],
    ];
    for (const [scenario, expected, expectedClicks] of cases) await t.test(scenario, async () => {
        const f = workspace();
        const { runUiRegressionV1 } = await load();
        let stop = false, clicks = 0, currentUrl = '', contexts = 0, closed = 0;
        const targetId = 'run.ac8cea43-7686-4d27-8092-1e3dd9207ca4.390.execution';
        const node = (text: string, active: boolean) => ({ textContent: text, innerText: text.toUpperCase(), classList: { contains: (name: string) => name === 'rd-tab--active' && active } });
        const selected = node(scenario === 'badge-count' ? 'Execution12' : scenario === 'prefix-label' ? 'Execution extra' : 'Execution', scenario !== 'wrong-active');
        const nodes = scenario === 'missing-selection' ? [node('Stories', true)] : [selected, node('Stories', ['wrong-active', 'duplicate-active'].includes(scenario))];
        if (scenario === 'ambiguous-selection') nodes.push(node('Execution', false));
        const locator = (items: typeof nodes): any => ({
            filter: ({ hasText }: { hasText: RegExp }) => locator(items.filter(n => hasText.test(n.textContent))),
            count: async () => items.length,
            click: async () => { assert.equal(items.length, 1, 'simulated strict locator cardinality'); clicks++; if (scenario === 'not-actionable') throw Error('simulated button not actionable'); },
            innerText: async () => { assert.equal(items.length, 1, 'simulated strict locator cardinality'); return items[0].innerText; },
            evaluate: async (callback: Function) => { assert.equal(items.length, 1, 'simulated strict locator cardinality'); return callback(items[0]); },
        });
        const geometry: any = responsiveGeometry('wrapped-fit');
        geometry.document.querySelectorAll = () => [];
        const tabGeometry: any = responsiveGeometry(['tab-content-overflow', 'bounded-inline-tabs'].includes(scenario) ? scenario : 'wrapped-fit');
        tabGeometry.document.querySelectorAll = () => [];
        let tabMainQueries = 0;
        const originalQuery = tabGeometry.document.querySelector;
        tabGeometry.document.querySelector = (selector: string) => { if (selector === '.layout__content') tabMainQueries++; return originalQuery(selector); };
        const page = { on() {}, setDefaultTimeout() {}, goto: async (url: string) => { currentUrl = url; },
            locator: (selector: string) => selector === '.rd-tab' ? locator(nodes) : selector === '.rd-tab--active' ? locator(nodes.filter(n => n.classList.contains('rd-tab--active'))) : { waitFor: async () => {}, innerText: async () => 'Simulated page body for reaching the real tab assertion in the Source engine.' },
            evaluate: async (callback: Function) => runInNewContext('(' + callback.toString() + ')()', clicks ? tabGeometry : geometry),
            screenshot: async () => Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]), url: () => currentUrl,
        };
        const browser = { newContext: async () => { contexts++; return { route: async () => {}, routeWebSocket: async () => {}, addInitScript: async () => {}, on() {}, newPage: async () => page, close: async () => { closed++; } }; } };
        try {
            const result = await runUiRegressionV1({ ...f, browser, control: { cancellationRequested: () => stop, onAssertionBoundary: async ({ id, edge }: any) => { if (id === targetId && edge === 'after') stop = true; } } });
            assert.equal(result.report.assertions.length, 241);
            assert.equal(result.report.assertions.at(-1).id, targetId);
            assert.equal(result.report.assertions.at(-1).status, expected);
            assert.equal(clicks, expectedClicks);
            if (['tab-content-overflow', 'bounded-inline-tabs'].includes(scenario)) assert.equal(tabMainQueries, 1, 'tab content must run the actual shared geometry callback');
            if (scenario === 'tab-content-overflow') {
                const diagnostic = JSON.parse(readFileSync(path.join(f.tempRoot, 'artifacts', result.diagnosticHashes[0] + '.json'), 'utf8'));
                assert.match(diagnostic.message, /^UI_HORIZONTAL_OVERFLOW /);
                const details = JSON.parse(diagnostic.message.slice('UI_HORIZONTAL_OVERFLOW '.length));
                assert.ok(details.samples.some((sample: any) => sample.kind === 'main-content'));
                assert.ok(details.samples.some((sample: any) => sample.kind === 'page-content'));
            }
            assert.equal(closed, contexts);
            assert.equal(result.report.screenshots.length, 61);
            assert.equal(result.report.outcome, 'incomplete'); // fixed boundary cancellation prevents full-run authority
        } finally { rmSync(f.root, { recursive: true, force: true }); }
    });
});

test('PRD history HTTP fixture preserves explicit unscored producer nulls', async () => {
    const f = workspace();
    const { createUiRegressionFixtureSessionV1 } = await load();
    let session;
    try {
        session = await createUiRegressionFixtureSessionV1(f);
        const response = await fetch('http://127.0.0.1:13082/api/prd/history');
        assert.equal(response.status, 200);
        const rows = await response.json();
        assert.equal(rows.length, 1);
        assert.equal(rows[0].id, 'fixture-prd');
        for (const field of ['score', 'score_details', 'cost_estimate']) {
            assert.equal(Object.hasOwn(rows[0], field), true, 'producer field must not be omitted: ' + field);
            assert.equal(rows[0][field], null, 'unscored producer value: ' + field);
        }
        assert.equal(rows[0].score !== null, false, 'actual PRD footer guard must not mount an unscored ring');
        assert.equal(session.unexpectedRequests.length, 0);
    } finally {
        if (session) await session.close();
        rmSync(f.root, { recursive: true, force: true });
    }
});

// Source-function component test: DOM focus and Playwright effects are simulated;
// the private behavior body and its page.evaluate callback execute unchanged in VM.
test('navigation shortcut setup blurs focused elements without clicking provider refresh', async (t) => {
    const ts = await import('typescript');
    const { runInNewContext } = await import('node:vm');
    const source = readFileSync(new URL('../scripts/ui-regression-fixtures.mjs', import.meta.url), 'utf8');
    const parsed = ts.createSourceFile('ui-regression-fixtures.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const declarations = parsed.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'behavior');
    assert.equal(declarations.length, 1);
    const behavior = runInNewContext('(' + declarations[0].getText(parsed) + ')', { assert, ORIGIN: 'http://127.0.0.1:13082' });
    for (const scenario of ['focused-button', 'already-body', 'refused-blur', 'non-html-focus']) await t.test(scenario, async () => {
        const events: string[] = [], posts: string[] = [];
        let clicks = 0, blurs = 0;
        const document: any = {};
        class HTMLElement {
            blur() { blurs++; events.push('blur'); if (scenario !== 'refused-blur') document.activeElement = document.body; }
        }
        document.body = new HTMLElement();
        document.activeElement = scenario === 'already-body' ? document.body : scenario === 'non-html-focus' ? {} : new HTMLElement();
        const page = {
            locator: (selector: string) => ({ click: async () => { assert.equal(selector, 'body'); clicks++; posts.push('/api/kimi-quota/refresh'); document.activeElement = document.body; } }),
            evaluate: async (callback: Function) => runInNewContext('(' + callback.toString() + ')()', { document, HTMLElement }),
            keyboard: { press: async (key: string) => { assert.equal(document.activeElement, document.body, 'keys require observed body focus'); events.push('key:' + key); } },
            waitForURL: async (url: string) => { events.push('url:' + new URL(url).pathname); },
        };
        const run = () => behavior('navigation.d-p', { page, loaded: async (route: string) => { events.push('loaded:' + route); } });
        if (['refused-blur', 'non-html-focus'].includes(scenario)) {
            await assert.rejects(run(), /UI_NAVIGATION_FOCUS_NOT_BODY/);
            assert.deepEqual(events.filter(e => e.startsWith('key:') || e.startsWith('url:')), []);
        } else {
            await run();
            assert.deepEqual(events, ['loaded:/', 'blur', 'key:d', 'url:/setfarm/active', 'key:p', 'url:/prd']);
        }
        assert.equal(blurs, scenario === 'non-html-focus' ? 0 : 1);
        assert.equal(clicks, 0);
        assert.deepEqual(posts, []);
    });
});

test('planning fixture HTTP responses match fixed pure production story and contract normalization', async (t) => {
    const ts = await import('typescript');
    const { request } = await import('node:http');
    const { runInNewContext } = await import('node:vm');
    const contractSource = readFileSync(new URL('../server/routes/setfarm-activity.ts', import.meta.url), 'utf8');
    const contractAst = ts.createSourceFile('setfarm-activity.ts', contractSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const contractDeclarations = ['safeJson', 'compactDisplay', 'formatListEntry', 'parseList', 'contractStatus', 'normalizeVisibleStatus', 'normalizeRunContract'].map(name => {
        const matches = contractAst.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
        assert.equal(matches.length, 1, name);
        return matches[0].getText(contractAst);
    }).join('\n');
    assert.doesNotMatch(contractDeclarations, /\b(import|require|process|fetch|readRepoContract|buildFallbackContract)\b/);
    const normalizeContract = runInNewContext(ts.transpileModule('(function(){' + contractDeclarations + ';return normalizeRunContract;})()', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {});
    const storySource = readFileSync(new URL('../server/utils/setfarm-db.ts', import.meta.url), 'utf8');
    const storyAst = ts.createSourceFile('setfarm-db.ts', storySource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const storyDeclarations = ['safeJson', 'parseJsonList', 'normalizeStoryRow'].map(name => {
        const matches = storyAst.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
        assert.equal(matches.length, 1, name);
        return matches[0].getText(storyAst);
    }).join('\n');
    assert.doesNotMatch(storyDeclarations, /\b(import|require|process|fetch)\b/);
    const normalizeStory = runInNewContext(ts.transpileModule('(function(){' + storyDeclarations + ';return normalizeStoryRow;})()', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {});
    const json = (value: any) => JSON.parse(JSON.stringify(value));
    const f = workspace();
    const { createUiRegressionFixtureSessionV1 } = await load();
    let session;
    try {
        session = await createUiRegressionFixtureSessionV1(f);
        const ids = ['ac8cea43-7686-4d27-8092-1e3dd9207ca4', 'ad47fe65-4ec4-4fb5-89da-fff71eb4e79a'];
        for (const [index, id] of ids.entries()) {
            // Each request belongs to this fixture lifetime, never a global fetch socket pool.
            const readWire = (tail: string) => new Promise<{ status: number; body: string }>((resolve, reject) => {
                const req = request({ host: '127.0.0.1', port: 13082, path: '/api/setfarm/runs/' + id + '/' + tail, method: 'GET', agent: false }, res => {
                    const chunks: Buffer[] = [];
                    res.on('data', chunk => chunks.push(chunk));
                    res.once('error', reject);
                    res.once('end', () => resolve({ status: res.statusCode!, body: Buffer.concat(chunks).toString('utf8') }));
                });
                req.once('error', reject);
                req.end();
            });
            const read = async (tail: string) => { const response = await readWire(tail); assert.equal(response.status, 200); return JSON.parse(response.body); };
            const [detail, stories, plan, contract] = await Promise.all(['detail', 'stories', 'plan', 'contract'].map(read));
            // These retained unavailable wire bodies must not acquire planning authority.
            for (const [tail, expectedBody] of [
                ['operational-snapshot', { status: 'unavailable', code: 'SETFARM_OPERATIONAL_SNAPSHOT_NOT_FOUND', reason: 'not_found' }],
                ['product-build-authority', { status: 'unavailable', code: 'SETFARM_PRODUCT_BUILD_AUTHORITY_NOT_READY', reason: 'not_ready', upstreamStatus: 409, upstreamCode: index === 0 ? 'RUNTIME_PACKET_RUN_NOT_V3' : 'RUNTIME_PACKET_NOT_READY' }],
            ] as const) {
                const response = await readWire(tail);
                assert.equal(response.status, 200);
                assert.equal(response.body, JSON.stringify(expectedBody));
            }
            const row = { id: 'fixture-story-' + (index + 1), run_id: id, story_index: 0, story_id: 'story-1', title: 'Fixture story', description: 'Retained fixture story', acceptance_criteria: '["Fixture acceptance"]', status: 'verified', output: null, retry_count: 0, max_retries: 2, depends_on: '[]', shared_files: '[]', story_screens: '[]', scope_files: '["README.md"]', pr_url: null, merge_status: null };
            const rawRun = { id, run_number: index + 1, workflow_id: index === 0 ? 'fixture-legacy' : 'fixture-v3', status: 'completed', task: index === 0 ? 'Legacy fixture' : 'V3 fixture', steps: [{ step_id: 'fixture-step', status: 'done' }] };
            const seed = {
                schema: 'setfarm.run-contract.v1', version: 1, runId: id, runNumber: index + 1, workflowId: rawRun.workflow_id, status: 'completed', task: rawRun.task, updatedAt: '2026-10-19T10:00:00.000Z', reason: 'fixture-simulated-planning-only',
                project: { repo: '', branch: '', displayName: 'Fixture planning only', techStack: 'fixture-local', uiLanguage: 'English' },
                stackPack: { id: 'fixture-local', label: 'Fixture local', confidence: 'low', evidence: ['Simulated fixture only; no operational authority'] },
                phases: [{ id: 'fixture-step', label: 'Fixture planning evidence', items: [{ id: 'fixture-step.evidence', label: 'Simulated planning record', owner: 'fixture-agent-1', stepId: 'fixture-step', storyId: 'story-1', status: 'pass', evidence: 'Simulated fixture only; no operational authority', blocker: '' }] }],
                stories: [{ storyId: 'story-1', title: 'Fixture story', status: 'verified', ownsScreens: [], scopeFiles: ['README.md'], sharedFiles: [], dependsOn: [], deferred: false }], blockers: [],
            };
            await t.test(id + ' raw stories retain row/run/local identity and detail uses actual conversion', () => {
                assert.deepEqual(stories, [row]);
                assert.deepEqual(detail.stories, json(stories.map(normalizeStory)));
                assert.equal(detail.stories[0].id, row.id);
                assert.equal(detail.stories[0].storyId, 'story-1');
                assert.equal(detail.storyCount, 1); assert.equal(detail.storiesDone, 1);
                assert.deepEqual(detail.fullSteps.map((step: any) => ({ step_id: step.id, status: step.status })), rawRun.steps);
            });
            await t.test(id + ' empty plan is the exact no-plan-output producer branch', () => {
                assert.deepEqual(plan, { prd: '', stories: [], rawOutput: '' });
            });
            await t.test(id + ' direct contract equals production normalization with coherent one-item progress', () => {
                assert.equal(Object.hasOwn(contract, 'available'), false); assert.equal(Object.hasOwn(contract, 'contract'), false);
                assert.deepEqual(contract, json(normalizeContract(seed, [row], rawRun)));
                assert.equal(contract.schema, 'setfarm.run-contract.v1'); assert.equal(contract.runId, id);
                assert.equal(contract.stories.length, 1); assert.equal(contract.stories[0].storyId, row.story_id);
                assert.equal(contract.phases[0].items[0].stepId, detail.fullSteps[0].id);
                assert.deepEqual(contract.progress, { total: 1, pass: 1, fail: 0, pending: 0, deferred: 0, na: 0 });
                assert.equal(contract.progress.total, contract.phases.flatMap((phase: any) => phase.items).length);
            });
            await t.test(id + ' running step probe activates real closure status normalization', () => {
                const running = json(normalizeContract(seed, [row], { ...rawRun, steps: [{ step_id: 'fixture-step', status: 'running' }] }));
                assert.equal(running.phases[0].items[0].status, 'pending');
                assert.equal(running.phases[0].status, 'pending');
                assert.deepEqual(running.progress, { total: 1, pass: 0, fail: 0, pending: 1, deferred: 0, na: 0 });
            });
        }
        assert.equal(session.unexpectedRequests.length, 0);
    } finally {
        if (session) await session.close();
        rmSync(f.root, { recursive: true, force: true });
    }
});

// Simulated asynchronous mount; actual readiness and geometry callbacks execute in VM.
test('Run Contract waits for successful fixture content before checking loaded tab geometry', async (t) => {
    const { runInNewContext } = await import('node:vm');
    for (const scenario of ['loaded-overflow', 'loaded-bounded', 'unavailable', 'wrong-title']) await t.test(scenario, async () => {
        const f = workspace();
        const { runUiRegressionV1 } = await load();
        let phase = 'loading', activeTab = '', currentUrl = '', stop = false, contexts = 0, closed = 0;
        let geometryWhileLoading = 0, geometryAfterLoaded = 0;
        let arrived!: () => void, release!: () => void;
        const waitArrived = new Promise<void>(resolve => { arrived = resolve; });
        const mountReleased = new Promise<void>(resolve => { release = resolve; });
        function mountedNodes() {
            const nodes: any[] = [];
            const element = (tag: string, className: string, text: string, parent: any = null) => {
                const node: any = { tagName: tag.toUpperCase(), className, textContent: text, parentElement: parent,
                    style: { visibility: 'visible', display: 'block' }, getBoundingClientRect: () => ({ width: 300, height: 30 }),
                    matches: (selector: string): boolean => {
                        const parts = selector.split('>').map(p => p.trim());
                        if (parts.length === 2) return node.matches(parts[1]) && !!parent?.matches(parts[0]);
                        return selector.startsWith('.') ? className.split(' ').includes(selector.slice(1)) : tag === selector;
                    },
                    querySelectorAll: (selector: string) => nodes.filter(candidate => { for (let p = candidate.parentElement; p; p = p.parentElement) if (p === node) return candidate.matches(selector); return false; }),
                };
                nodes.push(node); return node;
            };
            const wrapper = element('div', 'rd-contract-wrap', '');
            if (phase === 'loading') element('div', 'af-inline-plan__loading', 'Loading plan data...', wrapper);
            else if (scenario === 'unavailable') element('div', 'story-checklist__empty', 'No stories found', wrapper);
            else {
                const contract = element('div', 'af-contract', '', wrapper);
                const summary = element('div', 'af-contract__summary-main', '', contract);
                element('strong', '', scenario === 'wrong-title' ? 'Wrong planning content' : 'Fixture planning only', summary);
                const item = element('div', 'af-contract__item', '', contract);
                element('span', 'af-contract__item-label', 'Simulated planning record', item);
                element('span', 'af-contract__item-evidence', 'Simulated fixture only; no operational authority', item);
                const story = element('div', 'af-contract__story', '', contract);
                element('span', 'af-contract__story-id', 'story-1', story);
                element('span', 'af-contract__story-title', 'Fixture story', story);
            }
            return nodes;
        }
        const evaluate = (callback: Function) => {
            const loadedContract = activeTab === 'Run Contract' && phase === 'loaded';
            const geometry: any = responsiveGeometry(loadedContract && scenario === 'loaded-overflow' ? 'tab-content-overflow' : 'bounded-inline-tabs');
            const originalQuery = geometry.document.querySelector;
            geometry.document.querySelector = (selector: string) => {
                if (activeTab === 'Run Contract' && selector === '.layout__content') phase === 'loading' ? geometryWhileLoading++ : geometryAfterLoaded++;
                return originalQuery(selector);
            };
            geometry.document.querySelectorAll = (selector: string) => mountedNodes().filter(node => node.matches(selector));
            return runInNewContext('(' + callback.toString() + ')()', geometry);
        };
        const tabs = ['Execution', 'Pipeline', 'Run Contract'].map(text => ({ textContent: text, classList: { contains: (name: string) => name === 'rd-tab--active' && text === activeTab } }));
        const locator = (items: typeof tabs): any => ({
            filter: ({ hasText }: { hasText: RegExp }) => locator(items.filter(node => hasText.test(node.textContent))),
            count: async () => items.length,
            click: async () => { assert.equal(items.length, 1); activeTab = items[0].textContent; },
            evaluate: async (callback: Function) => { assert.equal(items.length, 1); return callback(items[0]); },
        });
        const page = { on() {}, setDefaultTimeout() {}, goto: async (url: string) => { currentUrl = url; },
            locator: (selector: string) => selector === '.rd-tab' ? locator(tabs) : selector === '.rd-tab--active' ? locator(tabs.filter(node => node.classList.contains('rd-tab--active'))) : { waitFor: async () => {}, innerText: async () => 'Simulated body text for reaching the actual asynchronous Run Contract tab assertion.' },
            evaluate: async (callback: Function) => evaluate(callback),
            waitForFunction: async (callback: Function) => { assert.equal(evaluate(callback), false, 'loading placeholder cannot satisfy readiness'); arrived(); await mountReleased; if (!evaluate(callback)) throw Error('simulated readiness timeout'); },
            screenshot: async () => Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]), url: () => currentUrl,
        };
        const browser = { newContext: async () => { contexts++; return { route: async () => {}, routeWebSocket: async () => {}, addInitScript: async () => {}, on() {}, newPage: async () => page, close: async () => { closed++; } }; } };
        const targetId = 'run.ac8cea43-7686-4d27-8092-1e3dd9207ca4.390.run-contract';
        const running = runUiRegressionV1({ ...f, browser, control: { cancellationRequested: () => stop, onAssertionBoundary: async ({ id, edge }: any) => { if (id === targetId && edge === 'after') stop = true; } } });
        try {
            const waited = await Promise.race([waitArrived.then(() => true), running.then(() => false)]);
            const queriesBeforeRelease = geometryWhileLoading;
            phase = 'loaded'; release();
            const result = await running;
            assert.equal(result.report.assertions.at(-1).id, targetId);
            assert.equal(result.report.assertions.at(-1).status, scenario === 'loaded-bounded' ? 'pass' : 'fail');
            assert.equal(waited, true, 'tab must await real content readiness');
            assert.equal(queriesBeforeRelease, 0, 'no geometry while only loading placeholder is mounted');
            assert.equal(geometryAfterLoaded, ['loaded-overflow', 'loaded-bounded'].includes(scenario) ? 1 : 0);
            assert.equal(result.report.assertions.length, 243);
            assert.equal(result.report.screenshots.length, 63);
            assert.equal(result.report.outcome, 'incomplete');
            assert.equal(closed, contexts);
            if (scenario === 'loaded-overflow') {
                const diagnostic = JSON.parse(readFileSync(path.join(f.tempRoot, 'artifacts', result.diagnosticHashes[0] + '.json'), 'utf8'));
                assert.match(diagnostic.message, /^UI_HORIZONTAL_OVERFLOW /);
            }
        } finally { release(); await running; rmSync(f.root, { recursive: true, force: true }); }
    });
});
