import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
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
