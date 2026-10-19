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
