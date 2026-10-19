import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import fs from 'node:fs';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, realpathSync, mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync, chmodSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash, createHmac } from 'node:crypto';
import { createControlJobsV1, createFixedManualWorkerPortV1, type SelectedControlRuntimeV1, type ManualWorkerEventsV1, type ManualWorkerPortV1 } from './control-jobs.js';
import { controlBytesV1, controlHashV1, controlCanonicalV1 } from './control-evidence.js';
// Explicit paired source-only schema fixture. Production has no source fallback.
const sf = new URL('../../../setfarm-dashboard-cutover-controller-20261007-v1/src/', import.meta.url);
const schemas = await import(new URL('execution/schemas/manual-control-job-v1.ts', sf).href);
const channel = await import(new URL('execution/schemas/manual-control-worker-channel-v1.ts', sf).href);
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
function fixture(options: {
    ui?: boolean;
    failStart?: boolean;
    failTerminalAck?: boolean;
} = {}) {
    const installationDir = realpathSync(mkdtempSync(path.join(tmpdir(), 'mc-controls-')));
    const parent = path.join(installationDir, 'runtime', 'mission-control');
    mkdirSync(parent, { recursive: true, mode: 0o700 });
    const root = path.join(parent, 'controls');
    let drift = false;
    let events: ManualWorkerEventsV1 | undefined;
    let startInput: any;
    const outgoing: any[] = [];
    let starts = 0;
    const owner = { pid: 12345, processStartedAt: '2026-10-19T10:00:00.000Z', processGroupId: 12345, source: 'observed_os' as const, executable: '/node', script: options.ui ? '/mc/dist-server/scripts/ui-regression.mjs' : '/release/dist/cli/control-test-worker-v1.js', commandHash: sha('node worker') };
    const selected: SelectedControlRuntimeV1 = { installationDir, releaseDir: '/release', selectionHash: 'a'.repeat(64), sourceSha: 'b'.repeat(40), releaseSha: 'b'.repeat(40), suiteHash: 'c'.repeat(64), caseIds: ['utility-status-baseline', 'utility-preference-compositional', 'operations-work-baseline', 'operations-queue-paraphrase', 'game-start-baseline', 'game-restart-compositional', 'negative-ambiguous-product', 'negative-unsupported-kernel'], mcSourceSha: 'd'.repeat(40), mcBuildHash: 'e'.repeat(64), workerPath: owner.script, controlsRoot: root, schemas, channel,
        ...(options.ui ? { ui: { workerPath: owner.script, fixtureVersion: 'v1', fixtureHash: '6'.repeat(64), assertionIds: ['home.loaded', 'controls.replay'] } } : {}),
        assertUnchanged() { if (drift)
            throw new Error('drift'); }, readEvidence: async () => ({ activation: { availability: { state: 'unconfigured', code: null }, report: null }, evaluation: { availability: { state: 'unconfigured', code: null }, report: null } }) };
    const worker: ManualWorkerPortV1 = { async startFixed(input) {
            starts++;
            startInput = input;
            if (options.failStart)
                throw new Error('simulated startup loss');
            assert.ok(existsSync(path.join(root, 'jobs', input.intent.receipt.jobId, 'intent.json')));
            return { binding: input.binding, originalChild: owner, executableHash: 'f'.repeat(64), beginDelivery(e) { events = e; }, async send(frame) { outgoing.push(frame); if (options.failTerminalAck && frame.body.type === 'ack' && (frame.body.receipt as any)?.finishedAt)
                    throw new Error('lost final ACK'); } };
        } };
    const jobs = createControlJobsV1({ root, selected, worker });
    const request = { kind: (options.ui ? 'ui_regression' : 'activation_preflight') as 'ui_regression' | 'activation_preflight', idempotencyKey: 'launch-018d819f-0a78-7d38-bb1f-0195b029ddaf', expectedSelectionHash: selected.selectionHash };
    async function frame(sequence: number, body: any) { const f = channel.signWorkerChannelFrameV1({ binding: startInput.binding, direction: 'worker_to_broker', sequence, body, nonce: startInput.custody.nonce }); await events!.onFrame(f); return f; }
    async function rawFrame(sequence: number, body: any) { const { kind: _, ...binding } = startInput.binding; const payload = { schema: 'setfarm.manual-control-worker-channel.v1', ...binding, direction: 'worker_to_broker', sequence, body }; await events!.onFrame({ ...payload, mac: createHmac('sha256', startInput.custody.nonce).update(controlCanonicalV1(payload)).digest('hex') }); }
    return { root, selected, worker, jobs, request, owner, outgoing, frame, rawFrame, get starts() { return starts; }, get events() { return events!; }, drift() { drift = true; } };
}
test('durable launch replay survives restart and never respawns; different kind conflicts', async () => {
    const f = fixture();
    const [a, b] = await Promise.all([f.jobs.create(f.request), f.jobs.create(f.request)]);
    assert.equal(a.receipt.jobId, b.receipt.jobId);
    assert.equal(a.replay || b.replay, true);
    assert.equal(f.starts, 1);
    const reopened = createControlJobsV1({ root: f.root, selected: f.selected, worker: f.worker });
    const r = await reopened.create(f.request);
    assert.equal(r.receipt.jobId, a.receipt.jobId);
    assert.equal(r.receipt.state, 'ownership_unknown');
    assert.equal(r.receipt.code, 'CONTROL_CHANNEL_UNAVAILABLE');
    assert.equal(r.receipt.revision, a.receipt.revision);
    assert.equal(f.starts, 1);
    await assert.rejects(() => reopened.create({ ...f.request, kind: 'convergence_full8' }), /CONTROL_IDEMPOTENCY_CONFLICT/);
    assert.ok(!readFileSync(path.join(f.root, 'index.json'), 'utf8').includes(f.request.idempotencyKey));
});
test('ready ACK follows durable receipt; exact replay has no revision and changed sequence fences', async () => {
    const f = fixture();
    const a = await f.jobs.create(f.request);
    const ready = await f.frame(1, { type: 'ready', owner: f.owner, journal: null });
    const r = await f.jobs.get(a.receipt.jobId);
    assert.equal(r!.state, 'starting');
    assert.equal(r!.revision, 2);
    assert.equal(f.outgoing.at(-1).body.receiptRevision, 2);
    await f.events.onFrame(ready);
    assert.equal((await f.jobs.get(a.receipt.jobId))!.revision, 2);
    await f.frame(1, { type: 'fault', code: 'CONTROL_CUSTODY_UNCERTAIN', phase: 'starting', journal: null });
    assert.equal((await f.jobs.get(a.receipt.jobId))!.state, 'ownership_unknown');
});
test('progress keeps refs provisional; final closure alone commits terminal evidence', async () => {
    const f = fixture();
    const a = await f.jobs.create(f.request);
    await f.frame(1, { type: 'ready', owner: f.owner, journal: null });
    await f.frame(2, { type: 'progress', journal: { revision: 1, hash: '1'.repeat(64) }, phase: 'acquired', currentCaseId: null, ownedRunId: null, completedCases: 0, code: null });
    assert.deepEqual((await f.jobs.get(a.receipt.jobId))!.reportRefs, {});
    await f.frame(3, { type: 'final_closed', journal: { revision: 2, hash: '2'.repeat(64) }, closureHash: '3'.repeat(64), outcome: 'completed', code: null, completedCases: 0, reportRefs: { activationHash: '4'.repeat(64) }, finalization: 'no_promotion' });
    const r = await f.jobs.get(a.receipt.jobId);
    assert.equal(r!.state, 'completed');
    assert.deepEqual(r!.reportRefs, { activationHash: '4'.repeat(64) });
    assert.equal((await createControlJobsV1({ root: f.root, selected: f.selected, worker: f.worker }).get(a.receipt.jobId))!.state, 'completed');
});
test('cancel is durable once, replay ignores stale revision, and exits never settle', async () => {
    const f = fixture();
    const a = await f.jobs.create(f.request);
    await f.frame(1, { type: 'ready', owner: f.owner, journal: null });
    const input = { idempotencyKey: 'cancel-key-1234567890123456', expectedRevision: 2 };
    const c = await f.jobs.cancel(a.receipt.jobId, input);
    assert.equal(c.receipt.state, 'cancelling');
    assert.equal(c.receipt.cancelRequested, true);
    assert.equal((await f.jobs.cancel(a.receipt.jobId, input)).receipt.revision, c.receipt.revision);
    assert.equal(f.outgoing.filter(x => x.body.type === 'cancel').length, 1);
    await assert.rejects(() => f.jobs.cancel(a.receipt.jobId, { ...input, idempotencyKey: 'other-cancel-key-1234567890', expectedRevision: 1 }), /CONTROL_REVISION_CONFLICT/);
    await f.events.onUnavailable('exit');
    assert.equal((await f.jobs.get(a.receipt.jobId))!.state, 'ownership_unknown');
    assert.equal(JSON.parse(readFileSync(path.join(f.root, 'jobs', a.receipt.jobId, 'cancel.json'), 'utf8')).acceptedReceiptRevision, c.receipt.revision);
});
test('missing GET does not create controls; unsafe parent, drift and concurrent distinct keys never start extra child', async () => {
    const f = fixture();
    assert.deepEqual(await f.jobs.list(50), []);
    assert.equal(existsSync(f.root), false);
    const [a, b] = await Promise.allSettled([f.jobs.create(f.request), f.jobs.create({ ...f.request, idempotencyKey: 'other-launch-key-1234567890' })]);
    assert.equal([a, b].filter(x => x.status === 'fulfilled').length, 1);
    assert.equal(f.starts, 1);
    f.drift();
    await assert.rejects(() => f.jobs.create({ ...f.request, idempotencyKey: 'third-launch-key-1234567890' }));
    assert.equal(f.starts, 1);
    const unsafe = fixture();
    chmodSync(path.dirname(unsafe.root), 0o755);
    await assert.rejects(() => unsafe.jobs.create(unsafe.request));
    assert.equal(unsafe.starts, 0);
    const linked = fixture();
    symlinkSync(path.dirname(linked.root), linked.root);
    await assert.rejects(() => linked.jobs.list(50));
    assert.equal(linked.starts, 0);
});
test('wrong independently observed identity or MAC leaves ownership unknown', async () => {
    for (const defect of ['pid', 'mac']) {
        const f = fixture();
        const a = await f.jobs.create(f.request);
        if (defect === 'pid')
            await f.frame(1, { type: 'ready', owner: { ...f.owner, pid: 12346 }, journal: null });
        else
            await f.events.onFrame({ schema: 'setfarm.manual-control-worker-channel.v1', mac: '0'.repeat(64) });
        assert.equal((await f.jobs.get(a.receipt.jobId))!.state, 'ownership_unknown');
        assert.equal(f.outgoing.filter(x => x.body.type === 'ack').length, 0);
    }
});
test('startup loss leaves immutable intent and replay unknown without another spawn', async () => {
    const f = fixture({ failStart: true });
    const a = await f.jobs.create(f.request);
    assert.equal(a.receipt.state, 'ownership_unknown');
    const intent = JSON.parse(readFileSync(path.join(f.root, 'jobs', a.receipt.jobId, 'intent.json'), 'utf8'));
    assert.equal(intent.receipt.jobId, a.receipt.jobId);
    assert.equal((await createControlJobsV1({ root: f.root, selected: f.selected, worker: f.worker }).create(f.request)).receipt.revision, 1);
    assert.equal(f.starts, 1);
});
test('unfinished index and cancellation publication cannot send a successful ACK or repair on restart', async () => {
    const f = fixture();
    const a = await f.jobs.create(f.request);
    await f.frame(1, { type: 'ready', owner: f.owner, journal: null });
    writeFileSync(path.join(f.root, 'index.next.json'), 'retained partial write', { mode: 0o600 });
    await assert.rejects(() => f.jobs.cancel(a.receipt.jobId, { idempotencyKey: 'cancel-partial-1234567890', expectedRevision: 2 }), /CONTROL_STORE_UNCERTAIN/);
    assert.equal(f.outgoing.filter(x => x.body.type === 'cancel').length, 0);
    const reopened = createControlJobsV1({ root: f.root, selected: f.selected, worker: f.worker });
    const r = await reopened.get(a.receipt.jobId);
    assert.equal(r!.revision, 2);
    assert.equal(r!.state, 'ownership_unknown');
    assert.equal(readFileSync(path.join(f.root, 'index.next.json'), 'utf8'), 'retained partial write');
});
test('UI report plus exact cleanup final is required; an exited or mismatched fixture remains unknown', async () => {
    for (const defect of ['none', 'cleanup', 'build', 'catalog', 'exit'] as const) {
        const f = fixture({ ui: true });
        const a = await f.jobs.create(f.request);
        const intentBytes = readFileSync(path.join(f.root, 'jobs', a.receipt.jobId, 'intent.json'));
        await f.frame(1, { type: 'ui_ready', owner: f.owner, fixtureVersion: 'v1', fixtureHash: '6'.repeat(64), plannedAssertions: 2 });
        if (defect === 'exit') {
            await f.events.onUnavailable('exit');
            assert.equal((await f.jobs.get(a.receipt.jobId))!.state, 'ownership_unknown');
            continue;
        }
        const artifacts = path.join(f.root, 'jobs', a.receipt.jobId, 'ui-worker', 'artifacts');
        mkdirSync(artifacts, { recursive: true, mode: 0o700 });
        const report = { schema: 'mission-control.ui-regression.v1', mcSourceSha: f.selected.mcSourceSha, mcBuildHash: defect === 'build' ? '7'.repeat(64) : f.selected.mcBuildHash, fixtureVersion: 'v1', fixtureHash: '6'.repeat(64), startedAt: '2026-10-19T10:00:00.000Z', finishedAt: '2026-10-19T10:00:01.000Z', outcome: 'pass', assertions: [{ id: 'home.loaded', status: 'pass', code: null }, { id: defect === 'catalog' ? 'unmeasured.check' : 'controls.replay', status: 'pass', code: null }], screenshots: [] };
        const reportBytes = controlBytesV1(report), uiReportHash = controlHashV1(reportBytes);
        writeFileSync(path.join(artifacts, uiReportHash + '.json'), reportBytes, { mode: 0o600 });
        const proof = { schema: 'mission-control.ui-regression-cleanup.v1', jobId: a.receipt.jobId, intentHash: controlHashV1(intentBytes), ownerHash: channel.hashObservedControlWorkerOwnerV1(f.owner), mcSourceSha: f.selected.mcSourceSha, mcBuildHash: f.selected.mcBuildHash, fixtureHash: '6'.repeat(64), uiReportHash, server: defect === 'cleanup' ? 'unknown' : 'closed', browser: 'closed', children: [{ spawnId: '018d819f-0a78-7d38-bb1f-0195b029ddae', owner: { kind: 'native_browser', pid: 23456, processStartedAt: '2026-10-19T10:00:00.000Z', processGroupId: 23456, source: 'observed_os', executable: '/fixture/chrome-headless-shell', commandHash: 'a'.repeat(64) }, state: 'closed' }] };
        const proofBytes = controlBytesV1(proof), cleanupHash = controlHashV1(proofBytes);
        writeFileSync(path.join(artifacts, cleanupHash + '.json'), proofBytes, { mode: 0o600 });
        await f.frame(2, { type: 'ui_final', uiReportHash, cleanupHash, ownedCleanup: 'confirmed', outcome: 'completed', code: null, completedAssertions: 2, plannedAssertions: 2 });
        const r = await f.jobs.get(a.receipt.jobId);
        assert.equal(r!.state, defect === 'none' ? 'completed' : 'ownership_unknown');
        assert.deepEqual(r!.reportRefs, defect === 'none' ? { uiReportHash } : {});
    }
});
test('explicit failed and incompatible history is retained on restart; unknown hash refused', async () => {
    const f = fixture();
    const selected = { ...f.selected, readEvidence: async (input: any) => ({ activation: { availability: { state: input.refs.activationHash === '1'.repeat(64) ? 'available' : 'missing', code: null }, report: input.refs.activationHash === '1'.repeat(64) ? { hash: input.refs.activationHash, status: 'fail', protocol: 'v3', compatibility: input.sourceSha === f.selected.sourceSha ? 'current' : 'historical', observedAt: null, checks: [] } : null }, evaluation: { availability: { state: 'unconfigured', code: null }, report: null } }) };
    const jobs = createControlJobsV1({ root: f.root, selected, worker: f.worker });
    for (const sourceSha of [selected.sourceSha, '8'.repeat(40)])
        await jobs.registerHistoricalControlEvidenceV1({ selectionHash: selected.selectionHash, sourceSha, refs: { activationHash: '1'.repeat(64) } });
    const restarted = createControlJobsV1({ root: f.root, selected, worker: f.worker });
    const evidence = await restarted.evidence() as any;
    assert.equal(evidence.history.length, 2);
    assert.deepEqual(evidence.history.map((e: any) => e.evidence.activation.report.compatibility), ['current', 'historical']);
    await assert.rejects(() => restarted.registerHistoricalControlEvidenceV1({ selectionHash: selected.selectionHash, sourceSha: selected.sourceSha, refs: { activationHash: '2'.repeat(64) } }), /CONTROL_HISTORY_INVALID/);
    assert.equal(f.starts, 0);
});
test('UI completed count cannot substitute for the ordered measured assertion catalog', async () => {
    const f = fixture({ ui: true });
    const a = await f.jobs.create(f.request);
    await f.frame(1, { type: 'ui_ready', owner: f.owner, fixtureVersion: 'v1', fixtureHash: '6'.repeat(64), plannedAssertions: 2 });
    const artifacts = path.join(f.root, 'jobs', a.receipt.jobId, 'ui-worker', 'artifacts');
    mkdirSync(artifacts, { recursive: true, mode: 0o700 });
    const report = { schema: 'mission-control.ui-regression.v1', mcSourceSha: f.selected.mcSourceSha, mcBuildHash: f.selected.mcBuildHash, fixtureVersion: 'v1', fixtureHash: '6'.repeat(64), startedAt: '2026-10-19T10:00:00.000Z', finishedAt: '2026-10-19T10:00:01.000Z', outcome: 'pass', assertions: [{ id: 'controls.replay', status: 'pass', code: null }, { id: 'home.loaded', status: 'pass', code: null }], screenshots: [] };
    const reportBytes = controlBytesV1(report), uiReportHash = controlHashV1(reportBytes);
    writeFileSync(path.join(artifacts, uiReportHash + '.json'), reportBytes, { mode: 0o600 });
    const proof = { schema: 'mission-control.ui-regression-cleanup.v1', jobId: a.receipt.jobId, intentHash: controlHashV1(readFileSync(path.join(f.root, 'jobs', a.receipt.jobId, 'intent.json'))), ownerHash: channel.hashObservedControlWorkerOwnerV1(f.owner), mcSourceSha: f.selected.mcSourceSha, mcBuildHash: f.selected.mcBuildHash, fixtureHash: '6'.repeat(64), uiReportHash, server: 'closed', browser: 'closed', children: [{ spawnId: '018d819f-0a78-7d38-bb1f-0195b029ddae', owner: { kind: 'native_browser', pid: 23456, processStartedAt: '2026-10-19T10:00:00.000Z', processGroupId: 23456, source: 'observed_os', executable: '/fixture/chrome-headless-shell', commandHash: 'a'.repeat(64) }, state: 'closed' }] };
    const pb = controlBytesV1(proof), cleanupHash = controlHashV1(pb);
    writeFileSync(path.join(artifacts, cleanupHash + '.json'), pb, { mode: 0o600 });
    await f.frame(2, { type: 'ui_final', uiReportHash, cleanupHash, ownedCleanup: 'confirmed', outcome: 'completed', code: null, completedAssertions: 2, plannedAssertions: 2 });
    assert.equal((await f.jobs.get(a.receipt.jobId))!.state, 'ownership_unknown');
});
test('fixed real child buffers early frames until beginDelivery and elides secret output before private disk', async () => {
    const f = fixture();
    const release = path.join(f.selected.installationDir, 'release'), workerPath = path.join(release, 'dist', 'cli', 'control-test-worker-v1.js');
    mkdirSync(path.dirname(workerPath), { recursive: true, mode: 0o700 });
    writeFileSync(workerPath, "setTimeout(()=>process.exit(0),1000); process.send({early:true}); process.stdout.write('token=very-secret-value'); process.on('message',()=>{process.send({after:true}); setTimeout(()=>process.exit(0),30);});\n", { mode: 0o600 });
    const selected = { ...f.selected, releaseDir: release, workerPath };
    // The real broker publishes intent/custody before invoking this fixed transport.
    const port = createFixedManualWorkerPortV1(selected);
    let session: any;
    const observed: unknown[] = [];
    let closedResolve: () => void = () => { };
    const closed = new Promise<void>(r => closedResolve = r);
    const wrapper: ManualWorkerPortV1 = { async startFixed(input) { session = await port.startFixed(input); return { ...session, beginDelivery(events: ManualWorkerEventsV1) { session.beginDelivery({ async onFrame(frame: unknown) { observed.push(frame); await events.onFrame(frame); }, async onUnavailable(reason: any) { await events.onUnavailable(reason); closedResolve(); } }); } }; } };
    const jobs = createControlJobsV1({ root: f.root, selected, worker: wrapper });
    const a = await jobs.create(f.request);
    await Promise.race([closed, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('child did not exit')), 3000).unref())]);
    assert.ok(observed.some((x: any) => x.early === true));
    assert.equal(session.originalChild.pid > 0, true);
    assert.equal(session.originalChild.script, workerPath);
    assert.equal((await jobs.get(a.receipt.jobId))!.state, 'ownership_unknown');
    const log = readFileSync(path.join(f.root, 'jobs', a.receipt.jobId, 'stdout.log'), 'utf8');
    assert.match(log, /private output omitted/);
    assert.equal(log.includes('very-secret'), false);
    assert.throws(() => session.beginDelivery({ onFrame: async () => { }, onUnavailable: async () => { } }), /CONTROL_CHANNEL_INVALID/);
});

// Observe the existing original spawn, without replacing the transport, broker,
// intent publication, process observation or IPC with a fake worker port.
async function probeWorkerEnvironment(options: {
    kind?: 'activation_preflight' | 'convergence_full8' | 'ui_regression';
    env?: Record<string, string | undefined>;
    token?: string;
    duringFinalSelection?: () => void;
} = {}) {
    const kind = options.kind ?? 'activation_preflight', f = fixture({ ui: kind === 'ui_regression' });
    const release = path.join(f.selected.installationDir, 'release');
    const workerPath = path.join(release, 'dist', 'cli', 'control-test-worker-v1.js');
    mkdirSync(path.dirname(workerPath), { recursive: true, mode: 0o700 });
    const forbidden = ['AUTH_TOKEN', 'SETFARM_PG_URL', 'DATABASE_URL', 'PGPASSWORD', 'SETFARM_TEST_PG_ADMIN_URL', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'STITCH_API_KEY', 'SETFARM_OPERATIONAL_WRITE_TOKEN', 'NODE_OPTIONS', 'NODE_PATH', 'LD_PRELOAD', 'DYLD_INSERT_LIBRARIES', 'SETFARM_INTERNAL_PRODUCTION_CONTEXT', 'SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY', 'ARBITRARY_SECRET', 'CODEX_CLI', 'SETFARM_PROTOCOL'];
    const added = ['SETFARM_INSTALLATION_DIR', 'SETFARM_REPO_DIR', 'SETFARM_ENV_DIR', 'SETFARM_V3_ACTIVATION', 'SETFARM_AGENT_RUNTIME', 'SETFARM_CODEX_MODEL', 'MC_INTERNAL_URL', 'SETFARM_DASHBOARD_URL', 'MC_AUTH_TOKEN'];
    // The probe emits predicates only, never values or token hashes.
    writeFileSync(workerPath, `
const env = process.env;
const absent = keys => keys.every(key => env[key] === undefined);
process.send({ probe: {
    activationEnabled: env.SETFARM_V3_ACTIVATION === 'enabled',
    activationDisabled: env.SETFARM_V3_ACTIVATION === 'disabled',
    activationAbsent: env.SETFARM_V3_ACTIVATION === undefined,
    installationMatches: env.SETFARM_INSTALLATION_DIR === ${JSON.stringify(f.selected.installationDir)},
    releaseMatches: env.SETFARM_REPO_DIR === ${JSON.stringify(release)},
    runtimeDirectoryMatches: env.SETFARM_ENV_DIR === ${JSON.stringify(path.join(f.selected.installationDir, 'runtime'))},
    runtimeMatches: env.SETFARM_AGENT_RUNTIME === 'codex',
    modelMatches: env.SETFARM_CODEX_MODEL === 'gpt-6.1-sol',
    mcEndpointMatches: env.MC_INTERNAL_URL === 'http://127.0.0.1:3080',
    sfEndpointMatches: env.SETFARM_DASHBOARD_URL === 'http://127.0.0.1:3333',
    tokenMatches: env.MC_AUTH_TOKEN === ${JSON.stringify(options.token)},
    forbiddenAbsent: absent(${JSON.stringify(forbidden)}),
    uiStripped: absent(${JSON.stringify(added)}),
    full8OnlyAbsent: absent(['SETFARM_AGENT_RUNTIME','SETFARM_CODEX_MODEL','MC_INTERNAL_URL','SETFARM_DASHBOARD_URL','MC_AUTH_TOKEN']),
    commonMatches: env.PATH === '/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin' && env.LANG === 'C' && env.LC_ALL === 'C' && env.TZ === 'UTC'
} });
// Wait for broker custody before natural exit; retain a natural timeout for
// startup failures so tests never need kill/adoption cleanup.
const deadline = setTimeout(() => process.exit(0), 1500);
process.once('message', () => { clearTimeout(deadline); setTimeout(() => process.exit(0), 25); });
`, { mode: 0o600 });
    const environment: Record<string, string | undefined> = {
        SETFARM_INSTALLATION_DIR: '/dummy/foreign-installation', SETFARM_REPO_DIR: '/dummy/foreign-release',
        SETFARM_ENV_DIR: undefined, SETFARM_V3_ACTIVATION: 'enabled',
        SETFARM_AGENT_RUNTIME: 'codex', SETFARM_CODEX_MODEL: 'gpt-6.1-sol',
        MC_INTERNAL_URL: undefined, SETFARM_DASHBOARD_URL: undefined, MC_AUTH_TOKEN: 'dummy-ambient-token',
        ...Object.fromEntries(forbidden.map(key => [key, 'dummy-excluded-value'])),
        // Presence (even an empty value) must be excluded. Keep loader sentinels
        // inert for the test runner's own tsx/esbuild subprocesses.
        NODE_OPTIONS: '', NODE_PATH: '', LD_PRELOAD: '', DYLD_INSERT_LIBRARIES: '', ...options.env,
    };
    const previous = new Map(Object.keys(environment).map(key => [key, process.env[key]]));
    const originalSpawn = childProcess.spawn;
    const children: { child: ReturnType<typeof childProcess.spawn>; exit: Promise<unknown>; close: Promise<unknown> }[] = [];
    const spawnObserver = mock.method(childProcess, 'spawn', (...args: Parameters<typeof childProcess.spawn>) => {
        const child = originalSpawn(...args);
        children.push({ child,
            exit: new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal }))),
            close: new Promise(resolve => child.once('close', (code, signal) => resolve({ code, signal }))),
        });
        return child;
    });
    syncBuiltinESMExports();
    let transportChecks = 0, inTransport = false, finalSelectionRan = false, session: any;
    const selected = { ...f.selected, releaseDir: release, workerPath,
        ...(kind === 'ui_regression' ? { ui: { ...f.selected.ui!, workerPath } } : {}),
        async assertUnchanged() {
            // Exercise the transport's real second await, immediately before
            // spawn; broker checks and later owner observation stay intact.
            if (inTransport && ++transportChecks === 2) {
                await Promise.resolve(); finalSelectionRan = true; options.duringFinalSelection?.();
            }
        },
    };
    const frames: any[] = [], startErrors: string[] = [];
    const port = createFixedManualWorkerPortV1(selected);
    const worker: ManualWorkerPortV1 = { async startFixed(input) {
        try {
            inTransport = true;
            session = await port.startFixed(input);
            return { ...session, beginDelivery(events: ManualWorkerEventsV1) {
                session.beginDelivery({ async onFrame(frame: unknown) { frames.push(frame); await events.onFrame(frame); }, onUnavailable: events.onUnavailable });
            } };
        } catch (error) { startErrors.push((error as Error).message); throw error; }
    } };
    const jobs = createControlJobsV1({ root: f.root, selected, worker });
    let result: Awaited<ReturnType<typeof jobs.create>> | undefined;
    try {
        for (const [key, value] of Object.entries(environment)) {
            if (value === undefined) delete process.env[key]; else process.env[key] = value;
        }
        result = await jobs.create({ ...f.request, kind });
    } finally {
        // Settle the actual originals before restoring environment or mocks.
        try { await Promise.all(children.flatMap(child => [child.exit, child.close])); }
        finally {
            spawnObserver.mock.restore(); syncBuiltinESMExports();
            for (const [key, value] of previous) {
                if (value === undefined) delete process.env[key]; else process.env[key] = value;
            }
        }
    }
    const settlement = await Promise.all(children.map(async child => ({
        pid: child.child.pid, exit: await child.exit, close: await child.close,
    })));
    const dir = path.join(f.root, 'jobs', result!.receipt.jobId);
    const receipt = (await jobs.get(result!.receipt.jobId))!;
    const projection = JSON.stringify(receipt);
    const logs = ['stdout.log', 'stderr.log'].map(name => existsSync(path.join(dir, name)) ? readFileSync(path.join(dir, name), 'utf8') : '').join('');
    assert.equal(logs.includes('dummy-'), false);
    assert.equal(projection.includes('dummy-'), false);
    if (options.token) { assert.equal(logs.includes(options.token), false); assert.equal(projection.includes(options.token), false); }
    assert.equal(JSON.stringify(frames).includes('dummy-'), false);
    return { probe: frames.find(frame => frame.probe)?.probe, settlement, startErrors, owner: session?.originalChild, receipt, finalSelectionRan };
}
function assertProbeSettled(result: Awaited<ReturnType<typeof probeWorkerEnvironment>>) {
    assert.equal(result.settlement.length, 1);
    assert.equal(result.settlement[0].pid, result.owner.pid);
    assert.deepEqual(result.settlement[0].exit, { code: 0, signal: null });
    assert.deepEqual(result.settlement[0].close, { code: 0, signal: null });
    assert.equal(result.receipt.state, 'ownership_unknown');
    assert.deepEqual(result.receipt.reportRefs, {});
    assert.deepEqual(result.startErrors, []);
    assert.equal(result.finalSelectionRan, true);
}
test('fixed real activation child preserves enabled, disabled and absent activation without full8 inputs', async t => {
    // Removing activation, ENV_DIR or selected locator assignments breaks the
    // actual child predicates; forwarding ambient secrets breaks exclusion.
    for (const activation of ['enabled', 'disabled', undefined]) {
        await t.test(activation ?? 'absent', async t => {
            const result = await probeWorkerEnvironment({ env: { SETFARM_V3_ACTIVATION: activation } });
            assertProbeSettled(result);
            t.diagnostic(JSON.stringify({ settlement: result.settlement, probe: result.probe }));
            assert.equal(result.probe.activationEnabled, activation === 'enabled');
            assert.equal(result.probe.activationDisabled, activation === 'disabled');
            assert.equal(result.probe.activationAbsent, activation === undefined);
            assert.equal(result.probe.installationMatches, true);
            assert.equal(result.probe.releaseMatches, true);
            assert.equal(result.probe.runtimeDirectoryMatches, true);
            assert.equal(result.probe.full8OnlyAbsent, true);
            assert.equal(result.probe.forbiddenAbsent, true);
            assert.equal(result.probe.commonMatches, true);
        });
    }
});
test('fixed worker reads activation after the final selection await and refuses invalid SF environment before spawn', async t => {
    // Building env before the final await would use stale enabled activation.
    await t.test('valid activation drift is read at original spawn', async t => {
        const result = await probeWorkerEnvironment({ duringFinalSelection() { process.env.SETFARM_V3_ACTIVATION = 'disabled'; } });
        assertProbeSettled(result);
        t.diagnostic(JSON.stringify({ settlement: result.settlement, probe: result.probe }));
        assert.equal(result.probe.activationDisabled, true);
        assert.equal(result.probe.activationEnabled, false);
    });
    for (const [name, env] of [
        ['conflicting runtime directory', { SETFARM_ENV_DIR: '/dummy/foreign-runtime' }],
        ['invalid activation', { SETFARM_V3_ACTIVATION: 'ENABLED' }],
        ['empty activation', { SETFARM_V3_ACTIVATION: '' }],
    ] as const) {
        await t.test(name, async () => {
            const result = await probeWorkerEnvironment({ env });
            assert.deepEqual(result.settlement, []);
            assert.deepEqual(result.startErrors, ['CONTROL_WORKER_UNAVAILABLE']);
            assert.equal(result.probe, undefined);
            assert.equal(result.receipt.state, 'ownership_unknown');
        });
    }
    await t.test('invalid activation drift refuses original spawn', async () => {
        const result = await probeWorkerEnvironment({ duringFinalSelection() { process.env.SETFARM_V3_ACTIVATION = 'invalid'; } });
        assert.equal(result.finalSelectionRan, true);
        assert.deepEqual(result.settlement, []);
        assert.deepEqual(result.startErrors, ['CONTROL_WORKER_UNAVAILABLE']);
    });
});
test('fixed real UI child retains stripped selection profile and auth environment', async t => {
    // Applying the SF builder to UI would leak these inputs or refuse startup.
    const result = await probeWorkerEnvironment({ kind: 'ui_regression', env: {
        SETFARM_ENV_DIR: '/dummy/foreign-runtime', SETFARM_V3_ACTIVATION: 'invalid',
        SETFARM_AGENT_RUNTIME: 'invalid', SETFARM_CODEX_MODEL: 'invalid model',
        MC_INTERNAL_URL: 'https://foreign.invalid', SETFARM_DASHBOARD_URL: 'https://foreign.invalid',
    } });
    assertProbeSettled(result);
    t.diagnostic(JSON.stringify({ settlement: result.settlement, probe: result.probe }));
    assert.equal(result.probe.uiStripped, true);
    assert.equal(result.probe.forbiddenAbsent, true);
    assert.equal(result.probe.commonMatches, true);
});
test('full8 fixed real child environment boundaries', async t => {
    if (!process.execArgv.includes('--experimental-test-module-mocks')) {
        // Isolate the unavoidable config double from ordinary test invocation.
        // No real config import (dotenv/gateway credential reads) is allowed.
        const child = childProcess.spawn(process.execPath, ['--experimental-test-module-mocks', '--import', 'tsx', '--test', '--test-name-pattern', '^full8 fixed real child environment boundaries$', fileURLToPath(import.meta.url)], {
            env: { PATH: '/opt/homebrew/bin:/usr/bin:/bin', HOME: tmpdir(), TMPDIR: tmpdir(), USER: 'controls-test' }, stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '', stderr = '';
        child.stdout!.on('data', chunk => stdout += chunk); child.stderr!.on('data', chunk => stderr += chunk);
        const exit = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
        const close = new Promise(resolve => child.once('close', (code, signal) => resolve({ code, signal })));
        const settled = await Promise.all([exit, close]);
        t.diagnostic(stdout); t.diagnostic(stderr); t.diagnostic(JSON.stringify({ harnessSettlement: settled }));
        assert.deepEqual(settled, [{ code: 0, signal: null }, { code: 0, signal: null }]);
        return;
    }
    const config = { authToken: 'dummy-loaded-mc-token' };
    const configMock = (mock as any).module(new URL('../config.ts', import.meta.url), { exports: { config } });
    try {
        await t.test('selected profile and fixed local endpoints reach the original full8 child', async t => {
            // Removing runtime/model/ENV_DIR/endpoints/MC_AUTH_TOKEN assignments
            // breaks these actual child predicates. Generic AUTH_TOKEN cannot pass.
            const result = await probeWorkerEnvironment({ kind: 'convergence_full8', token: config.authToken });
            assertProbeSettled(result);
            t.diagnostic(JSON.stringify({ settlement: result.settlement, probe: result.probe }));
            for (const key of ['runtimeMatches', 'modelMatches', 'runtimeDirectoryMatches', 'activationEnabled', 'installationMatches', 'releaseMatches', 'mcEndpointMatches', 'sfEndpointMatches', 'tokenMatches', 'forbiddenAbsent', 'commonMatches'])
                assert.equal(result.probe[key], true, key);
        });
        await t.test('empty loaded auth does not borrow ambient AUTH_TOKEN or MC_AUTH_TOKEN', async () => {
            config.authToken = '';
            try {
                const result = await probeWorkerEnvironment({ kind: 'convergence_full8' });
                assertProbeSettled(result);
                assert.equal(result.probe.tokenMatches, true);
                assert.equal(result.probe.forbiddenAbsent, true);
            } finally { config.authToken = 'dummy-loaded-mc-token'; }
        });
        await t.test('profile endpoints and loaded token changed during final await refuse before original spawn', async () => {
            // Capturing/validating any input before that await would leak stale
            // values to a child (including auth to an untrusted endpoint).
            const result = await probeWorkerEnvironment({ kind: 'convergence_full8', token: config.authToken,
                duringFinalSelection() {
                    process.env.SETFARM_CODEX_MODEL = 'invalid model';
                    process.env.MC_INTERNAL_URL = 'https://foreign.invalid';
                    config.authToken = 'dummy-changed-token';
                },
            });
            try {
                assert.equal(result.finalSelectionRan, true);
                assert.deepEqual(result.settlement, []);
                assert.deepEqual(result.startErrors, ['CONTROL_WORKER_UNAVAILABLE']);
            } finally { config.authToken = 'dummy-loaded-mc-token'; }
        });
        await t.test('current loaded auth is read after the final await', async () => {
            try {
                const result = await probeWorkerEnvironment({ kind: 'convergence_full8', token: 'dummy-changed-token',
                    duringFinalSelection() { config.authToken = 'dummy-changed-token'; },
                });
                assertProbeSettled(result);
                assert.equal(result.probe.tokenMatches, true);
            } finally { config.authToken = 'dummy-loaded-mc-token'; }
        });
        // Removing profile/path/endpoint validation must create a real child,
        // causing these assertions on original process settlement to fail.
        for (const [name, env] of [
            ['missing runtime', { SETFARM_AGENT_RUNTIME: undefined }],
            ['foreign runtime', { SETFARM_AGENT_RUNTIME: 'other' }],
            ['missing model', { SETFARM_CODEX_MODEL: undefined }],
            ['empty model', { SETFARM_CODEX_MODEL: '' }],
            ['invalid model', { SETFARM_CODEX_MODEL: 'model with spaces' }],
            ['overlong model', { SETFARM_CODEX_MODEL: 'a'.repeat(195) }],
            ['foreign runtime directory', { SETFARM_ENV_DIR: '/dummy/foreign-runtime' }],
            ['foreign MC host', { MC_INTERNAL_URL: 'https://foreign.invalid' }],
            ['foreign MC port', { MC_INTERNAL_URL: 'http://127.0.0.1:3081' }],
            ['MC userinfo', { MC_INTERNAL_URL: 'http://dummy@127.0.0.1:3080' }],
            ['MC query', { MC_INTERNAL_URL: 'http://127.0.0.1:3080?dummy' }],
            ['MC fragment', { MC_INTERNAL_URL: 'http://127.0.0.1:3080#dummy' }],
            ['foreign dashboard', { SETFARM_DASHBOARD_URL: 'https://foreign.invalid' }],
            ['dashboard suffix', { SETFARM_DASHBOARD_URL: 'http://127.0.0.1:3333/' }],
        ] as const) {
            await t.test(name, async () => {
                const result = await probeWorkerEnvironment({ kind: 'convergence_full8', env, token: config.authToken });
                assert.deepEqual(result.settlement, []);
                assert.deepEqual(result.startErrors, ['CONTROL_WORKER_UNAVAILABLE']);
                assert.equal(result.probe, undefined);
                assert.equal(result.receipt.state, 'ownership_unknown');
            });
        }
    } finally { configMock.restore(); }
});
test('older terminal receipts remain readable after selection changes without authorizing old idempotency keys', async () => {
    const f = fixture();
    const a = await f.jobs.create(f.request);
    await f.frame(1, { type: 'ready', owner: f.owner, journal: null });
    await f.frame(2, { type: 'final_closed', journal: null, closureHash: '3'.repeat(64), outcome: 'blocked', code: 'CONTROL_JOB_BLOCKED', completedCases: 0, reportRefs: {}, finalization: 'never_reserved' });
    const selected = { ...f.selected, selectionHash: '9'.repeat(64), sourceSha: '9'.repeat(40) };
    const reopened = createControlJobsV1({ root: f.root, selected, worker: f.worker });
    assert.equal((await reopened.get(a.receipt.jobId))!.state, 'blocked');
    assert.equal((await reopened.list(50))[0].sourceSha, f.selected.sourceSha);
    await assert.rejects(() => reopened.create({ ...f.request, expectedSelectionHash: selected.selectionHash }), /CONTROL_IDEMPOTENCY_CONFLICT/);
    assert.equal(f.starts, 1);
});
test('foreign full8 case IDs are fenced even with a valid original-channel MAC', async () => {
    const f = fixture();
    const a = await f.jobs.create({ ...f.request, kind: 'convergence_full8' });
    await f.frame(1, { type: 'ready', owner: f.owner, journal: null });
    await f.rawFrame(2, { type: 'progress', journal: { revision: 1, hash: '1'.repeat(64) }, phase: 'case_running', currentCaseId: 'foreign-case', ownedRunId: 'run-1', completedCases: 0, code: null });
    assert.equal((await f.jobs.get(a.receipt.jobId))!.state, 'ownership_unknown');
});
test('lost final ACK after durable commit retains terminal receipt across broker restart', async () => {
    for (const completed of [false, true]) {
        const f = fixture({ failTerminalAck: true });
        const a = await f.jobs.create(f.request);
        await f.frame(1, { type: 'ready', owner: f.owner, journal: null });
        const reportRefs = completed ? { activationHash: '4'.repeat(64) } : {};
        await f.frame(2, { type: 'final_closed', journal: completed ? { revision: 1, hash: '2'.repeat(64) } : null, closureHash: '3'.repeat(64), outcome: completed ? 'completed' : 'blocked', code: completed ? null : 'CONTROL_JOB_BLOCKED', completedCases: 0, reportRefs, finalization: completed ? 'no_promotion' : 'never_reserved' });
        const receipt = await f.jobs.get(a.receipt.jobId);
        assert.equal(receipt!.state, completed ? 'completed' : 'blocked');
        assert.ok(receipt!.finishedAt);
        assert.deepEqual(receipt!.reportRefs, reportRefs);
        assert.equal(existsSync(path.join(f.root, 'mutation.lock')), false);
        assert.deepEqual(await createControlJobsV1({ root: f.root, selected: f.selected, worker: f.worker }).get(a.receipt.jobId), receipt);
    }
});
test('cancel before ready queues exactly once and original never-reserved final settles it', async () => {
    const f = fixture();
    const a = await f.jobs.create(f.request);
    await f.jobs.cancel(a.receipt.jobId, { idempotencyKey: 'early-cancel-12345678901234', expectedRevision: 1 });
    assert.equal(f.outgoing.filter(x => x.body.type === 'cancel').length, 0);
    await f.frame(1, { type: 'ready', owner: f.owner, journal: null });
    assert.equal(f.outgoing.filter(x => x.body.type === 'cancel').length, 1);
    assert.equal(f.outgoing.at(-2).body.type, 'ack');
    await f.frame(2, { type: 'final_closed', journal: null, closureHash: '4'.repeat(64), outcome: 'cancelled', code: 'CONTROL_CANCEL_REQUESTED', completedCases: 0, reportRefs: {}, finalization: 'never_reserved' });
    const r = await f.jobs.get(a.receipt.jobId);
    assert.equal(r!.state, 'cancelled');
    assert.equal(r!.cancelRequested, true);
});
test('valid MAC wrong-kind final cannot publish either SF or UI evidence', async () => {
    for (const ui of [false, true]) {
        const f = fixture({ ui });
        const a = await f.jobs.create(f.request);
        await f.frame(1, ui ? { type: 'ui_ready', owner: f.owner, fixtureVersion: 'v1', fixtureHash: '6'.repeat(64), plannedAssertions: 2 } : { type: 'ready', owner: f.owner, journal: null });
        await f.rawFrame(2, ui ? { type: 'final_closed', journal: null, closureHash: '4'.repeat(64), outcome: 'blocked', code: null, completedCases: 0, reportRefs: {}, finalization: 'never_reserved' } : { type: 'ui_final', uiReportHash: '1'.repeat(64), cleanupHash: '2'.repeat(64), ownedCleanup: 'confirmed', outcome: 'completed', code: null, completedAssertions: 2, plannedAssertions: 2 });
        const r = await f.jobs.get(a.receipt.jobId);
        assert.equal(r!.state, 'ownership_unknown');
        assert.deepEqual(r!.reportRefs, {});
    }
});
test('different cancel keys bind exact retry bodies durably without a second cancellation frame', async () => {
    const f = fixture();
    const a = await f.jobs.create(f.request);
    await f.frame(1, { type: 'ready', owner: f.owner, journal: null });
    const first = { idempotencyKey: 'first-cancel-1234567890123', expectedRevision: 2 };
    await f.jobs.cancel(a.receipt.jobId, first);
    await assert.rejects(() => f.jobs.cancel(a.receipt.jobId, { ...first, expectedRevision: 3 }), /CONTROL_IDEMPOTENCY_CONFLICT/);
    const second = { idempotencyKey: 'second-cancel-123456789012', expectedRevision: 3 };
    const receipt = await f.jobs.cancel(a.receipt.jobId, second);
    await f.frame(2, { type: 'progress', journal: { revision: 1, hash: '2'.repeat(64) }, phase: 'settling', currentCaseId: null, ownedRunId: null, completedCases: 0, code: null });
    assert.deepEqual((await f.jobs.cancel(a.receipt.jobId, second)).receipt, receipt.receipt);
    assert.deepEqual((await createControlJobsV1({ root: f.root, selected: f.selected, worker: f.worker }).cancel(a.receipt.jobId, second)).receipt, receipt.receipt);
    assert.equal(f.outgoing.filter(x => x.body.type === 'cancel').length, 1);
});

// Fail the actual directory fsync only after the real index rename has exposed
// the terminal candidate. No production fault hook or synthetic lock is used.
async function failTerminalPublication(root: string, publish: () => Promise<unknown>) {
    const original = fs.fsyncSync;
    let injected = false;
    const fault = mock.method(fs, 'fsyncSync', (fd: number) => {
        if (!injected && fs.fstatSync(fd).isDirectory()
            && JSON.parse(readFileSync(path.join(root, 'index.json'), 'utf8')).jobs.at(-1)?.receipt.finishedAt) {
            injected = true;
            throw new Error('injected directory fsync failure after terminal index rename');
        }
        return original(fd);
    });
    syncBuiltinESMExports();
    try { await publish(); }
    finally { fault.mock.restore(); syncBuiltinESMExports(); }
    assert.equal(injected, true);
    assert.equal(existsSync(path.join(root, 'mutation.lock')), true);
}
for (const ui of [false, true]) {
    test(`post-rename terminal fsync failure hides ${ui ? 'UI screenshots' : 'SF evidence'} on reopen and retains independent history`, async t => {
        const f = fixture({ ui });
        const historyHash = '1'.repeat(64), finalHash = '4'.repeat(64);
        const reads: any[] = [];
        const selected = { ...f.selected, readEvidence: async (input: any) => {
            reads.push(input);
            const h = input.refs.activationHash;
            return { activation: { availability: { state: h ? 'available' : 'unconfigured', code: null }, report: h ? { hash: h, status: 'pass', protocol: 'v3', compatibility: 'current', observedAt: null, checks: [] } : null }, evaluation: { availability: { state: 'unconfigured', code: null }, report: null } };
        } };
        const jobs = createControlJobsV1({ root: f.root, selected, worker: f.worker });
        await jobs.registerHistoricalControlEvidenceV1({ selectionHash: selected.selectionHash, sourceSha: selected.sourceSha, refs: { activationHash: historyHash } });
        const a = await jobs.create(f.request);
        await f.frame(1, ui ? { type: 'ui_ready', owner: f.owner, fixtureVersion: 'v1', fixtureHash: '6'.repeat(64), plannedAssertions: 2 } : { type: 'ready', owner: f.owner, journal: null });
        const retained = new Map<string, Buffer>();
        let body: any = { type: 'final_closed', journal: { revision: 1, hash: '2'.repeat(64) }, closureHash: '3'.repeat(64), outcome: 'completed', code: null, completedCases: 0, reportRefs: { activationHash: finalHash }, finalization: 'no_promotion' };
        if (ui) {
            const artifacts = path.join(f.root, 'jobs', a.receipt.jobId, 'ui-worker', 'artifacts');
            mkdirSync(artifacts, { recursive: true, mode: 0o700 });
            const retain = (name: string, bytes: Buffer) => { const file = path.join(artifacts, name); writeFileSync(file, bytes, { mode: 0o600 }); retained.set(file, bytes); };
            const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]), screenshotHash = controlHashV1(png);
            retain(screenshotHash + '.png', png);
            const report = { schema: 'mission-control.ui-regression.v1', mcSourceSha: selected.mcSourceSha, mcBuildHash: selected.mcBuildHash, fixtureVersion: 'v1', fixtureHash: '6'.repeat(64), startedAt: '2026-10-19T10:00:00.000Z', finishedAt: '2026-10-19T10:00:01.000Z', outcome: 'pass', assertions: [{ id: 'home.loaded', status: 'pass', code: null }, { id: 'controls.replay', status: 'pass', code: null }], screenshots: [{ captureId: 'home-390', route: '/', viewport: { width: 390, height: 800 }, sha256: screenshotHash }] };
            const reportBytes = controlBytesV1(report), uiReportHash = controlHashV1(reportBytes);
            retain(uiReportHash + '.json', reportBytes);
            const proof = { schema: 'mission-control.ui-regression-cleanup.v1', jobId: a.receipt.jobId, intentHash: controlHashV1(readFileSync(path.join(f.root, 'jobs', a.receipt.jobId, 'intent.json'))), ownerHash: channel.hashObservedControlWorkerOwnerV1(f.owner), mcSourceSha: selected.mcSourceSha, mcBuildHash: selected.mcBuildHash, fixtureHash: '6'.repeat(64), uiReportHash, server: 'closed', browser: 'closed', children: [{ spawnId: '018d819f-0a78-7d38-bb1f-0195b029ddae', owner: { kind: 'native_browser', pid: 23456, processStartedAt: '2026-10-19T10:00:00.000Z', processGroupId: 23456, source: 'observed_os', executable: '/fixture/chrome-headless-shell', commandHash: 'a'.repeat(64) }, state: 'closed' }] };
            const proofBytes = controlBytesV1(proof), cleanupHash = controlHashV1(proofBytes);
            retain(cleanupHash + '.json', proofBytes);
            body = { type: 'ui_final', uiReportHash, cleanupHash, ownedCleanup: 'confirmed', outcome: 'completed', code: null, completedAssertions: 2, plannedAssertions: 2 };
        }
        await failTerminalPublication(f.root, () => f.frame(2, body));
        assert.equal(f.outgoing.filter(x => x.body.type === 'ack' && x.body.receipt.finishedAt).length, 0);
        await assert.rejects(() => jobs.get(a.receipt.jobId), /CONTROL_STORE_UNCERTAIN/);
        const indexFile = path.join(f.root, 'index.json');
        const indexBytes = readFileSync(indexFile);
        const candidate = JSON.parse(indexBytes.toString()).jobs.at(-1).receipt;
        assert.equal(candidate.state, 'completed');
        assert.ok(candidate.finishedAt);
        assert.equal(Object.keys(candidate.reportRefs).length, 1);
        const reopened = createControlJobsV1({ root: f.root, selected, worker: f.worker });
        await t.test('receipt, list and idempotent replay hide terminal fields at the existing revision', async () => {
            const replay = await reopened.create(f.request);
            for (const receipt of [await reopened.get(a.receipt.jobId), (await reopened.list(50))[0], replay.receipt]) {
                assert.equal(receipt!.state, 'ownership_unknown');
                assert.equal(receipt!.code, 'CONTROL_CUSTODY_UNCERTAIN');
                assert.equal(receipt!.revision, candidate.revision);
                assert.equal(receipt!.finishedAt, null);
                assert.deepEqual(receipt!.reportRefs, {});
            }
            assert.equal(replay.replay, true);
            assert.equal(f.starts, 1);
        });
        await t.test('job-specific and latest evidence withhold final refs but preserve validated history', async () => {
            reads.length = 0;
            for (const jobId of [a.receipt.jobId, undefined]) {
                const envelope = await reopened.evidence(jobId) as any;
                assert.equal(envelope.evidence.activation.report, null);
                assert.equal(envelope.evidence.ui.report, null);
                assert.equal(envelope.evidence.ui.availability.state, 'unconfigured');
                assert.equal(envelope.history.length, 1);
                assert.equal(envelope.history[0].evidence.activation.report.hash, historyHash);
            }
            assert.deepEqual(reads.map(x => x.refs), [{}, { activationHash: historyHash }, {}, { activationHash: historyHash }]);
        });
        if (ui)
            await t.test('retained screenshot is unavailable until definite publication', async () => {
                await assert.rejects(() => reopened.screenshot(a.receipt.jobId, 'home-390'), /CONTROL_SCREENSHOT_NOT_FOUND/);
            });
        assert.deepEqual(readFileSync(indexFile), indexBytes);
        assert.equal(existsSync(path.join(f.root, 'mutation.lock')), true);
        for (const [file, bytes] of retained)
            assert.deepEqual(readFileSync(file), bytes);
    });
}
