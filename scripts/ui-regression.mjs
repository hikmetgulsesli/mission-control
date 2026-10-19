#!/usr/bin/env node
/** Fixed compiled UI worker. Standalone fixture audit has no broker or SF authority. */
import { constants, fstatSync, readSync, realpathSync, mkdirSync, mkdtempSync, statfsSync, readdirSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { UI_REGRESSION_FIXTURE_V1, createUiRegressionFixtureSessionV1, measureUiBuildV1 } from './ui-regression-fixtures.mjs';
import { uiBytesV1, uiCanonicalV1, uiHashV1, pinUiFileV1, pinUiDirectoryV1, createUiArtifactStoreV1, observeUiNodeOwnerV1, createUiNativeLifecycleV1 } from './ui-regression-lifecycle.mjs';
const fail = code => { throw Error(code); };
const ensure = (condition, code) => {
    if (!condition)
        fail(code);
};
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export function parseUiInvocationV1(argv) {
    if (argv.length === 2 && argv[0] === '--job-id' && UUID.test(argv[1]))
        return { mode: 'broker', jobId: argv[1] };
    const scenarios = { '--standalone': 'pass', '--standalone-assertion-failure': 'assertion_failure', '--standalone-owned-cancel': 'owned_cancel' };
    if (argv.length === 1 && Object.hasOwn(scenarios, argv[0]))
        return { mode: 'standalone', scenario: scenarios[argv[0]] };
    fail('UI_INVOCATION_INVALID');
}
export function assertUiCompiledSelfV1(url) {
    const file = fileURLToPath(url), root = path.dirname(path.dirname(path.dirname(file)));
    ensure(path.basename(file) === 'ui-regression.mjs' && path.relative(root, file) === 'dist-server/scripts/ui-regression.mjs' && realpathSync(file) === file, 'UI_COMPILED_SELF_REQUIRED');
    return { file, root };
}
/** Private source component seam only; production always uses the original process target. */
export function createUiWorkerChannelV1({ intent, intentHash, owner, channel, schemas, target = process }) {
    schemas.ControlPrivateIntentV1Schema.parse(intent);
    channel.ObservedControlWorkerOwnerV1Schema.parse(owner);
    let binding, nonce, brokerSequence = 0, workerSequence = 0, available = true, cancelled = false, boundary = false, cancelRequest = null, cancelRevisionFloor = 0, implicitCancelRevision = null, readyAccepted = false, finalAccepted = false, lastReceipt = intent.receipt, pending, queue = Promise.resolve(), readyResolve, readyReject;
    const readiness = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
    readiness.catch(() => { });
    const timeout = setTimeout(() => invalidate('CONTROL_CHANNEL_UNAVAILABLE'), 10000);
    timeout.unref?.();
    function invalidate(code) {
        available = false;
        cancelled = true;
        clearTimeout(timeout);
        readyReject(Error(code));
        if (pending) {
            clearTimeout(pending.timer);
            pending.reject(Error(code));
            pending = null;
        }
    }
    function receiptValid(receipt, sent) {
        schemas.ControlJobReceiptV1Schema.parse(receipt);
        for (const key of ['jobId', 'kind', 'selectionHash', 'sourceSha', 'mcSourceSha', 'mcBuildHash', 'suiteHash', 'requestedAt'])
            ensure(receipt[key] === intent.receipt[key], 'CONTROL_CHANNEL_INVALID');
        const time = value => {
            const parsed = Date.parse(value);
            ensure(Number.isFinite(parsed) && new Date(parsed).toISOString() === value, 'CONTROL_CHANNEL_INVALID');
            return parsed;
        };
        const requestedAt = time(receipt.requestedAt), updatedAt = time(receipt.updatedAt), previousUpdate = time(lastReceipt.updatedAt);
        // The unchanged broker defers its cancellation notice until after the first ready ACK.
        // Only that ACK can prove one cancellation revision not yet delivered as a notice.
        const implicitCancellation = !readyAccepted && sent.type === 'ui_ready' && !lastReceipt.cancelRequested && cancelRequest === null && receipt.cancelRequested && receipt.revision === lastReceipt.revision + 2;
        const cancelAccepted = lastReceipt.cancelRequested || cancelRequest !== null || implicitCancellation;
        ensure(!finalAccepted && receipt.revision === Math.max(lastReceipt.revision, cancelRevisionFloor) + (implicitCancellation ? 2 : 1) && receipt.cancelRequested === cancelAccepted && receipt.plannedCases === lastReceipt.plannedCases && receipt.completedCases >= lastReceipt.completedCases && receipt.currentCaseId === null && receipt.ownedRunId === null && updatedAt >= previousUpdate && updatedAt >= requestedAt, 'CONTROL_CHANNEL_INVALID');
        ensure(readyAccepted ? sent.type !== 'ui_ready' : sent.type === 'ui_ready', 'CONTROL_CHANNEL_INVALID');
        let expectedState, expectedPhase, expectedCode, expectedCount, beginsRunning = false;
        if (sent.type === 'ui_ready') {
            ensure(sent.plannedAssertions === receipt.plannedCases, 'CONTROL_CHANNEL_INVALID');
            expectedState = cancelAccepted ? 'cancelling' : 'starting';
            expectedPhase = 'starting';
            expectedCode = cancelAccepted ? 'CONTROL_CANCEL_REQUESTED' : lastReceipt.code;
            expectedCount = 0;
        }
        else if (sent.type === 'ui_progress') {
            ensure(sent.plannedAssertions === receipt.plannedCases, 'CONTROL_CHANNEL_INVALID');
            expectedState = cancelAccepted ? 'cancelling' : 'running';
            expectedPhase = sent.phase;
            expectedCode = sent.code;
            expectedCount = sent.completedAssertions;
            beginsRunning = sent.phase === 'running' && lastReceipt.startedAt === null;
        }
        else if (sent.type === 'ui_cancel_observed') {
            ensure(cancelRequest !== null && sent.requestId === cancelRequest, 'CONTROL_CHANNEL_INVALID');
            expectedState = 'cancelling';
            expectedPhase = lastReceipt.phase;
            expectedCode = sent.effective === 'after_boundary' ? 'CONTROL_CANCEL_TOO_LATE' : 'CONTROL_CANCEL_REQUESTED';
            expectedCount = lastReceipt.completedCases;
        }
        else {
            ensure(sent.type === 'ui_final' && sent.plannedAssertions === receipt.plannedCases, 'CONTROL_CHANNEL_INVALID');
            expectedState = sent.outcome;
            expectedPhase = 'closed';
            expectedCode = sent.code;
            expectedCount = sent.completedAssertions;
        }
        ensure(receipt.state === expectedState && receipt.phase === expectedPhase && receipt.code === expectedCode && receipt.completedCases === expectedCount, 'CONTROL_CHANNEL_INVALID');
        if (beginsRunning)
            ensure(receipt.startedAt !== null && time(receipt.startedAt) >= previousUpdate && time(receipt.startedAt) >= requestedAt && time(receipt.startedAt) <= updatedAt, 'CONTROL_CHANNEL_INVALID');
        else
            ensure(receipt.startedAt === lastReceipt.startedAt, 'CONTROL_CHANNEL_INVALID');
        if (sent.type === 'ui_final') {
            ensure(receipt.finishedAt !== null && time(receipt.finishedAt) >= previousUpdate && time(receipt.finishedAt) >= requestedAt && time(receipt.finishedAt) <= updatedAt && (receipt.startedAt === null || time(receipt.finishedAt) >= time(receipt.startedAt)) && Object.keys(receipt.reportRefs).length === 1 && receipt.reportRefs.uiReportHash === sent.uiReportHash, 'CONTROL_CHANNEL_INVALID');
        }
        else
            ensure(receipt.finishedAt === null && Object.keys(receipt.reportRefs).length === 0, 'CONTROL_CHANNEL_INVALID');
        return implicitCancellation ? receipt.revision - 1 : null;
    }
    function receive(raw) {
        if (!available)
            return;
        try {
            ensure(Buffer.byteLength(JSON.stringify(raw)) <= 16384, 'CONTROL_CHANNEL_INVALID');
            if (!binding) {
                const frame = channel.WorkerChannelEnvelopeV1Schema.parse(raw);
                ensure(frame.sequence === 1 && frame.body.type === 'custody' && frame.jobId === intent.receipt.jobId && frame.intentHash === intentHash, 'CONTROL_CHANNEL_INVALID');
                const custody = schemas.ControlWorkerCustodyV1Schema.parse(frame.body.custody);
                ensure(custody.jobId === intent.receipt.jobId && custody.selectionHash === intent.receipt.selectionHash && custody.sourceSha === intent.receipt.sourceSha && custody.mcBuildHash === intent.receipt.mcBuildHash && uiHashV1(custody.nonce) === intent.nonceDigest, 'CONTROL_BINDING_FAILED');
                binding = { jobId: frame.jobId, channelId: frame.channelId, intentHash, kind: 'ui_regression' };
                nonce = custody.nonce;
            }
            const frame = channel.verifyWorkerChannelFrameV1({ frame: raw, binding, direction: 'broker_to_worker', nonce });
            ensure(frame.sequence === brokerSequence + 1, 'CONTROL_CHANNEL_INVALID');
            brokerSequence = frame.sequence;
            const body = frame.body;
            if (body.type === 'custody') {
                ensure(brokerSequence === 1, 'CONTROL_CHANNEL_INVALID');
                clearTimeout(timeout);
                readyResolve();
                return;
            }
            if (body.type === 'cancel') {
                ensure(cancelRequest === null && body.acceptedReceiptRevision === (implicitCancelRevision ?? lastReceipt.revision + 1), 'CONTROL_CHANNEL_INVALID');
                cancelRequest = body.requestId;
                cancelRevisionFloor = body.acceptedReceiptRevision;
                implicitCancelRevision = null;
                if (!boundary)
                    cancelled = true;
                return;
            }
            ensure(implicitCancelRevision === null && body.type === 'ack' && pending && body.workerSequence === pending.frame.sequence && body.workerFrameHash === channel.hashWorkerChannelFrameV1(pending.frame) && body.receiptRevision === body.receipt.revision, 'CONTROL_CHANNEL_INVALID');
            const sent = pending.frame.body;
            const implicitRevision = receiptValid(body.receipt, sent);
            if (implicitRevision !== null) {
                implicitCancelRevision = implicitRevision;
                cancelRevisionFloor = implicitRevision;
                if (!boundary)
                    cancelled = true;
            }
            readyAccepted = true;
            if (sent.type === 'ui_final')
                finalAccepted = true;
            lastReceipt = body.receipt;
            clearTimeout(pending.timer);
            const done = pending.resolve;
            pending = null;
            done(lastReceipt);
        }
        catch {
            invalidate('CONTROL_CHANNEL_INVALID');
        }
    }
    const disconnect = () => invalidate('CONTROL_CHANNEL_UNAVAILABLE');
    target.on('message', receive);
    target.on('disconnect', disconnect);
    target.on('error', disconnect);
    function send(body) {
        const work = queue.then(async () => {
            await readiness;
            ensure(available && !finalAccepted && target.connected && typeof target.send === 'function', 'CONTROL_CHANNEL_UNAVAILABLE');
            const frame = channel.signWorkerChannelFrameV1({ binding, direction: 'worker_to_broker', sequence: ++workerSequence, body, nonce });
            return await new Promise((resolve, reject) => {
                pending = { frame, resolve, reject, timer: null };
                let attempts = 0;
                const transmit = () => {
                    if (!pending || !available)
                        return;
                    attempts++;
                    target.send(frame, error => {
                        if (error)
                            invalidate('CONTROL_CHANNEL_UNAVAILABLE');
                    });
                    if (pending)
                        pending.timer = setTimeout(() => {
                            if (attempts < 2)
                                transmit();
                            else
                                invalidate('CONTROL_CHANNEL_UNAVAILABLE');
                        }, 2000);
                };
                transmit();
            });
        });
        queue = work.catch(() => { });
        return work;
    }
    return Object.freeze({ ready: () => readiness, receive, send, cancellationRequested: () => cancelled, available: () => available,
        async acknowledgeCancellation() {
            if (cancelRequest && available) {
                const requestId = cancelRequest;
                await send({ type: 'ui_cancel_observed', requestId, effective: boundary ? 'after_boundary' : 'latched' });
            }
        },
        decideFinal() { boundary = true; return cancelled; },
        close() {
            clearTimeout(timeout);
            if (pending)
                invalidate('CONTROL_CHANNEL_UNAVAILABLE');
            target.off('message', receive);
            target.off('disconnect', disconnect);
            target.off('error', disconnect);
        },
    });
}
function readIntentDescriptor() {
    const before = fstatSync(4);
    ensure(before.isFile() && before.nlink === 1 && before.size > 0 && before.size <= 16384 && before.uid === process.getuid() && (before.mode & 0o777) === 0o600, 'UI_INTENT_DESCRIPTOR_INVALID');
    const bytes = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < bytes.length) {
        const read = readSync(4, bytes, offset, bytes.length - offset, offset);
        ensure(read > 0, 'UI_INTENT_DESCRIPTOR_INVALID');
        offset += read;
    }
    const after = fstatSync(4);
    ensure(before.dev === after.dev && before.ino === after.ino && before.size === after.size && before.mtimeMs === after.mtimeMs, 'UI_INTENT_DESCRIPTOR_INVALID');
    const raw = JSON.parse(bytes);
    ensure(bytes.equals(uiBytesV1(raw)), 'UI_INTENT_DESCRIPTOR_INVALID');
    ensure(typeof raw.releaseDir === 'string' && path.isAbsolute(raw.releaseDir) && path.normalize(raw.releaseDir) === raw.releaseDir && realpathSync(raw.releaseDir) === raw.releaseDir, 'UI_INTENT_DESCRIPTOR_INVALID');
    return { bytes, raw, stat: before };
}
async function main() {
    const invocation = parseUiInvocationV1(process.argv.slice(2)), self = assertUiCompiledSelfV1(import.meta.url);
    ensure(realpathSync(process.argv[1]) === self.file && process.execArgv.length === 0, 'UI_SELF_INVALID');
    ensure(!Object.keys(process.env).some(k => k === 'NODE_OPTIONS' || k === 'NODE_PATH' || k.startsWith('DYLD_') || k.startsWith('LD_')), 'UI_LOADER_ENVIRONMENT_INVALID');
    // Capture early original messages before asynchronous module loading; bounded and never reattached.
    const early = [];
    let earlyFailure = false;
    const collect = raw => {
        try {
            if (early.length >= 16 || Buffer.byteLength(JSON.stringify(raw)) > 16384)
                earlyFailure = true;
            else
                early.push(raw);
        }
        catch {
            earlyFailure = true;
        }
    };
    if (invocation.mode === 'broker') {
        ensure(process.connected && typeof process.send === 'function' && fstatSync(3).isSocket(), 'UI_ORIGINAL_CHANNEL_REQUIRED');
        process.on('message', collect);
    }
    const measured = measureUiBuildV1(self.root);
    for (const name of ['dist-server/scripts/ui-regression.mjs', 'dist-server/scripts/ui-regression-fixtures.mjs', 'dist-server/scripts/ui-regression-lifecycle.mjs', 'dist-server/services/control-ui-worker-protocol.js', 'dist-server/services/product-build-authority-v2-delivery-evidence-v1.js'])
        ensure(measured.entries.has(name), 'UI_MEASURED_MODULE_REQUIRED');
    const protocol = await import(pathToFileURL(path.join(self.root, 'dist-server/services/control-ui-worker-protocol.js')).href);
    const existing = await import(pathToFileURL(path.join(self.root, 'dist-server/services/product-build-authority-v2-delivery-evidence-v1.js')).href);
    const startup = existing.productBuildAuthorityV2LoadedBuildStartupStateV1();
    ensure(startup.status === 'available' && startup.response.loadedBuild.buildIdentity.sourceSha === measured.identity.sourceSha && startup.response.loadedBuild.buildIdentity.buildHash === measured.identity.buildHash, 'UI_BUILD_IDENTITY_INVALID');
    measured.check();
    const owner = await observeUiNodeOwnerV1(self.file, process.argv.slice(2));
    let jobId, intentHash, ownerHash, store, channel, intent, privatePins = [];
    if (invocation.mode === 'broker') {
        const descriptor = readIntentDescriptor();
        const moduleFiles = ['execution/schemas/manual-control-job-v1.js', 'execution/schemas/manual-control-worker-channel-v1.js', 'execution/v3-release-admission.js', 'product-compiler/canonical-json.js'];
        const pins = moduleFiles.map(relative => pinUiFileV1(path.join(descriptor.raw.releaseDir, 'dist', relative), 16777216));
        const schemas = await import(pathToFileURL(path.join(descriptor.raw.releaseDir, 'dist', moduleFiles[0])).href), wire = await import(pathToFileURL(path.join(descriptor.raw.releaseDir, 'dist', moduleFiles[1])).href);
        pins.forEach(pin => pin.check());
        privatePins.push(...pins.map(pin => pin.check));
        intent = schemas.ControlPrivateIntentV1Schema.parse(descriptor.raw);
        jobId = invocation.jobId;
        ensure(intent.receipt.jobId === jobId && intent.receipt.kind === 'ui_regression' && intent.receipt.mcSourceSha === measured.identity.sourceSha && intent.receipt.mcBuildHash === measured.identity.buildHash, 'UI_INTENT_BINDING_INVALID');
        const jobRoot = path.join(intent.installationDir, 'runtime', 'mission-control', 'controls', 'jobs', jobId), intentFile = path.join(jobRoot, 'intent.json');
        const jobPin = pinUiDirectoryV1(jobRoot), intentPin = pinUiFileV1(intentFile, 16384, true), fileStat = fstatSync(4);
        ensure(intentPin.bytes.equals(descriptor.bytes) && fileStat.dev === descriptor.stat.dev && fileStat.ino === descriptor.stat.ino, 'UI_INTENT_DESCRIPTOR_INVALID');
        const reopened = await import('node:fs');
        const pathStat = reopened.lstatSync(intentFile);
        ensure(pathStat.dev === fileStat.dev && pathStat.ino === fileStat.ino, 'UI_INTENT_DESCRIPTOR_INVALID');
        privatePins.push(jobPin, intentPin.check);
        intentHash = uiHashV1(descriptor.bytes);
        ownerHash = wire.hashObservedControlWorkerOwnerV1(owner);
        channel = createUiWorkerChannelV1({ intent, intentHash, owner, channel: wire, schemas });
        process.off('message', collect);
        ensure(!earlyFailure, 'UI_CHANNEL_OVERFLOW');
        for (const frame of early)
            channel.receive(frame);
        await channel.ready();
        const root = path.join(jobRoot, 'ui-worker');
        mkdirSync(root, { mode: 0o700 });
        store = createUiArtifactStoreV1(root);
    }
    else {
        jobId = randomUUID();
        ownerHash = uiHashV1(uiCanonicalV1(owner));
        const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'mc-ui-standalone-')));
        store = createUiArtifactStoreV1(root);
        intent = { schema: 'mission-control.ui-standalone-intent.v1', mode: 'standalone', scenario: invocation.scenario, jobId, ownerHash, mcSourceSha: measured.identity.sourceSha, mcBuildHash: measured.identity.buildHash, fixtureVersion: UI_REGRESSION_FIXTURE_V1.fixtureVersion, fixtureHash: UI_REGRESSION_FIXTURE_V1.fixtureHash, requestedAt: new Date().toISOString() };
        intent = protocol.UiStandaloneIntentV1Schema.parse(intent);
        intentHash = store.record('standalone-intent.json', intent);
    }
    store.record('owner.json', protocol.UiWorkerLifecycleRecordV1Schema.parse({ schema: 'mission-control.ui-worker-owner.v1', jobId, intentHash, ownerHash, mcSourceSha: measured.identity.sourceSha, mcBuildHash: measured.identity.buildHash, fixtureVersion: UI_REGRESSION_FIXTURE_V1.fixtureVersion, fixtureHash: UI_REGRESSION_FIXTURE_V1.fixtureHash }));
    let session, lifecycle, cancelled = false, result, engineStarted = false, resourceFailure = false, server = 'not_started', browserProof = { browser: 'not_started', children: [] }, acknowledgedCancel = false;
    const cancellationRequested = () => cancelled || (channel?.cancellationRequested() ?? false);
    const signal = () => { cancelled = true; };
    for (const name of ['SIGTERM', 'SIGINT', 'SIGHUP'])
        process.on(name, signal);
    const reportBase = () => ({ schema: 'mission-control.ui-regression.v1', mcSourceSha: measured.identity.sourceSha, mcBuildHash: measured.identity.buildHash, fixtureVersion: UI_REGRESSION_FIXTURE_V1.fixtureVersion, fixtureHash: UI_REGRESSION_FIXTURE_V1.fixtureHash, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), outcome: 'incomplete', assertions: [], screenshots: [] });
    const progress = async (phase) => {
        if (channel?.available())
            await channel.send({ type: 'ui_progress', phase, completedAssertions: result?.report.assertions.length ?? 0, plannedAssertions: UI_REGRESSION_FIXTURE_V1.assertionIds.length, code: null });
    };
    const checkPins = () => {
        measured.check();
        for (const check of privatePins)
            check();
        store.verify();
    };
    try {
        if (channel)
            await channel.send({ type: 'ui_ready', owner, fixtureVersion: UI_REGRESSION_FIXTURE_V1.fixtureVersion, fixtureHash: UI_REGRESSION_FIXTURE_V1.fixtureHash, plannedAssertions: UI_REGRESSION_FIXTURE_V1.assertionIds.length });
        checkPins();
        const space = statfsSync(store.root);
        ensure(space.bavail * space.bsize >= 8589934592, 'UI_RESOURCE_FLOOR');
        if (!cancellationRequested()) {
            const control = { cancellationRequested, onAssertionBoundary: async () => { checkPins(); await lifecycle.census(); }, onProgress: async (counts) => {
                    if (invocation.mode === 'standalone' && counts.completedAssertions === 1) {
                        if (invocation.scenario === 'assertion_failure')
                            throw Error('UI_QUALIFICATION_ASSERTION_FAILURE');
                        if (invocation.scenario === 'owned_cancel')
                            cancelled = true;
                    }
                    if (channel?.cancellationRequested() && !acknowledgedCancel) {
                        await channel.acknowledgeCancellation();
                        acknowledgedCancel = true;
                    }
                    if (channel?.available())
                        await channel.send({ type: 'ui_progress', phase: 'running', ...counts, code: null });
                } };
            session = await createUiRegressionFixtureSessionV1({ buildDir: self.root, tempRoot: store.root, control, schemas: protocol });
            server = 'closed';
            lifecycle = createUiNativeLifecycleV1({ store, jobId, intentHash, ownerHash, owner, cancellationRequested, recordSchema: protocol.UiWorkerLifecycleRecordV1Schema });
            const browser = await lifecycle.launch();
            if (browser && !cancellationRequested()) {
                engineStarted = true;
                result = await session.run(browser);
            }
        }
    }
    catch {
        resourceFailure = true;
    }
    finally {
        if (!result) {
            const report = protocol.UiRegressionReportV1Schema.parse(reportBase());
            result = { report, reportHash: store.json(report), ...(engineStarted ? { integrity: 'failed' } : {}) };
        }
        // Candidate exists before any cleanup. Unknown cleanup never removes it.
        try {
            await progress('cleanup');
        }
        catch {
            cancelled = true;
        }
        // Both original resource owners settle under the same 30-second window.
        const settlements = await Promise.allSettled([lifecycle ? lifecycle.close() : Promise.resolve(browserProof), session ? session.close() : Promise.resolve()]);
        if (settlements[0].status === 'fulfilled')
            browserProof = settlements[0].value;
        else {
            resourceFailure = true;
            browserProof = null;
        }
        if (settlements[1].status === 'rejected') {
            resourceFailure = true;
            server = null;
        }
        for (const name of ['SIGTERM', 'SIGINT', 'SIGHUP'])
            process.off(name, signal);
    }
    try {
        ensure(browserProof && server, 'UI_CLEANUP_UNKNOWN');
        ensure(!engineStarted || result.integrity === 'verified', 'UI_REPORT_INTEGRITY_FAILED');
        checkPins();
        const cancelledAtBoundary = cancellationRequested();
        channel?.decideFinal();
        if (cancelledAtBoundary && result.report.outcome !== 'incomplete') {
            const report = protocol.UiRegressionReportV1Schema.parse({ ...result.report, outcome: 'incomplete', finishedAt: new Date().toISOString() });
            result = { ...result, report, reportHash: store.json(report) };
        }
        store.record('final-decision.json', { schema: 'mission-control.ui-final-decision.v1', jobId, intentHash, decision: cancelledAtBoundary ? 'cancel' : 'continue', uiReportHash: result.reportHash });
        const cleanup = protocol.UiRegressionCleanupProofV1Schema.parse({ schema: 'mission-control.ui-regression-cleanup.v1', jobId, intentHash, ownerHash, mcSourceSha: measured.identity.sourceSha, mcBuildHash: measured.identity.buildHash, fixtureHash: UI_REGRESSION_FIXTURE_V1.fixtureHash, uiReportHash: result.reportHash, server, ...browserProof });
        const cleanupHash = store.json(cleanup);
        if (channel) {
            ensure(channel.available(), 'CONTROL_CHANNEL_UNAVAILABLE');
            await channel.send({ type: 'ui_final', uiReportHash: result.reportHash, cleanupHash, ownedCleanup: 'confirmed', outcome: cancelledAtBoundary ? 'cancelled' : resourceFailure ? 'blocked' : result.report.outcome === 'incomplete' ? 'failed' : 'completed', code: cancelledAtBoundary ? 'CONTROL_CANCEL_REQUESTED' : resourceFailure ? 'CONTROL_JOB_BLOCKED' : null, completedAssertions: result.report.assertions.length, plannedAssertions: UI_REGRESSION_FIXTURE_V1.assertionIds.length });
        }
        const free = statfsSync(store.root);
        const retainedArtifactBytes = readdirSync(path.join(store.root, 'artifacts')).reduce((sum, name) => sum + lstatSync(path.join(store.root, 'artifacts', name)).size, 0);
        process.stdout.write(JSON.stringify({ retainedArtifactBytes, diagnosticHashes: result.diagnosticHashes ?? [], mode: invocation.mode, scenario: invocation.scenario ?? null, jobId, reportHash: result.reportHash, cleanupHash, outcome: result.report.outcome, artifactRoot: store.root, freeBytes: free.bavail * free.bsize }) + '\n');
        process.exitCode = result.report.outcome === 'pass' ? 0 : 1;
    }
    catch {
        process.stderr.write(JSON.stringify({ code: 'UI_OWNERSHIP_UNKNOWN', mode: invocation.mode, jobId, artifactRoot: store.root, candidateReportHash: result?.reportHash ?? null }) + '\n');
        process.exitCode = 2;
    }
    finally {
        channel?.close();
        if (invocation.mode === 'broker' && process.connected)
            process.disconnect();
    }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
    void main().catch(() => {
        process.stderr.write('UI_BOOTSTRAP_REFUSED\n');
        process.exitCode = 2;
        if (process.connected)
            process.disconnect();
    });
