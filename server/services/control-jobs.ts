import { constants, openSync, closeSync, fsyncSync, writeFileSync, renameSync, unlinkSync, mkdirSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { controlHashV1, controlBytesV1, controlCanonicalV1, parseControlEvidenceEnvelopeV1, pinControlDirectoryV1, readControlPrivateFileV1, readUiControlEvidenceV1, readUiControlScreenshotV1 } from './control-evidence.js';
import { UiRegressionCleanupProofV1Schema, type UiObservedOwnerV1 } from './control-ui-worker-protocol.js';
import { createControlWorkerSettlementV1 } from './control-worker-settlement.js';
/** Bundling views only: selected SF parsers remain authoritative. */
export type ControlJobKindV1 = 'activation_preflight' | 'convergence_full8' | 'ui_regression';
export type ControlReportRefsV1 = Readonly<{
    activationHash?: string;
    resultHash?: string;
    gateHash?: string;
    uiReportHash?: string;
}>;
export type ControlJobReceiptV1 = Readonly<{
    schema: 'mission-control.control-job.v1';
    jobId: string;
    kind: ControlJobKindV1;
    revision: number;
    selectionHash: string;
    sourceSha: string;
    mcSourceSha: string;
    mcBuildHash: string;
    suiteHash: string | null;
    state: 'accepted' | 'starting' | 'running' | 'cancelling' | 'completed' | 'failed' | 'blocked' | 'cancelled' | 'ownership_unknown';
    requestedAt: string;
    startedAt: string | null;
    updatedAt: string;
    finishedAt: string | null;
    phase: string;
    code: string | null;
    currentCaseId: string | null;
    ownedRunId: string | null;
    completedCases: number;
    plannedCases: number;
    reportRefs: ControlReportRefsV1;
    cancelRequested: boolean;
}>;
export type ControlPrivateIntentV1 = Readonly<{
    schema: 'mission-control.control-intent.v1';
    receipt: ControlJobReceiptV1;
    installationDir: string;
    releaseDir: string;
    nonceDigest: string;
    fixedSuiteRelativePath: 'evals/suites/product-convergence-codex-v1.json' | null;
}>;
export type ControlWorkerCustodyV1 = Readonly<{
    schema: 'mission-control.control-custody.v1';
    jobId: string;
    selectionHash: string;
    sourceSha: string;
    mcBuildHash: string;
    nonce: string;
}>;
export type WorkerChannelBindingV1 = Readonly<{
    jobId: string;
    channelId: string;
    intentHash: string;
    kind: ControlJobKindV1;
}>;
export type WorkerChannelEnvelopeV1 = Readonly<{
    schema: 'setfarm.manual-control-worker-channel.v1';
    jobId: string;
    channelId: string;
    intentHash: string;
    direction: 'broker_to_worker' | 'worker_to_broker';
    sequence: number;
    body: Readonly<Record<string, unknown>>;
    mac: string;
}>;
export type ControlParserV1<T> = {
    parse(input: unknown): T;
};
export type ControlSchemasV1 = {
    ControlJobReceiptV1Schema: ControlParserV1<ControlJobReceiptV1>;
    ControlPrivateIntentV1Schema: ControlParserV1<ControlPrivateIntentV1>;
    ControlWorkerCustodyV1Schema: ControlParserV1<ControlWorkerCustodyV1>;
    ControlEvidenceProjectionV1Schema: ControlParserV1<ControlEvidenceProjectionV1>;
    ControlReportRefsV1Schema: ControlParserV1<ControlReportRefsV1>;
    ControlSelectionIdentityV1Schema: ControlParserV1<unknown>;
    hashControlSelectionIdentityV1(input: unknown): string;
};
export type ControlEvidenceProjectionV1 = {
    activation: {
        availability: {
            state: string;
            code: string | null;
        };
        report: Record<string, unknown> | null;
    };
    evaluation: {
        availability: {
            state: string;
            code: string | null;
        };
        report: Record<string, unknown> | null;
    };
};
export type ControlEvidenceExpectedV1 = {
    selectionHash: string;
    sourceSha: string;
    releaseSha: string;
    suiteHash: string | null;
    refs: ControlReportRefsV1;
};
export type ControlChannelV1 = {
    signWorkerChannelFrameV1(input: {
        binding: WorkerChannelBindingV1;
        direction: 'broker_to_worker' | 'worker_to_broker';
        sequence: number;
        body: Readonly<Record<string, unknown>>;
        nonce: string;
    }): WorkerChannelEnvelopeV1;
    verifyWorkerChannelFrameV1(input: {
        frame: unknown;
        binding: WorkerChannelBindingV1;
        direction: 'broker_to_worker' | 'worker_to_broker';
        nonce: string;
    }): WorkerChannelEnvelopeV1;
    hashWorkerChannelFrameV1(frame: WorkerChannelEnvelopeV1): string;
    hashObservedControlWorkerOwnerV1(owner: UiObservedOwnerV1): string;
    ObservedControlWorkerOwnerV1Schema: ControlParserV1<UiObservedOwnerV1>;
};
export type SelectedControlRuntimeV1 = Readonly<{
    installationDir: string;
    releaseDir: string;
    selectionHash: string;
    sourceSha: string;
    releaseSha: string;
    suiteHash: string;
    caseIds: readonly string[];
    mcSourceSha: string;
    mcBuildHash: string;
    workerPath: string;
    controlsRoot: string;
    schemas: ControlSchemasV1;
    channel: ControlChannelV1;
    assertUnchanged(): void | Promise<void>;
    readEvidence(input: ControlEvidenceExpectedV1): Promise<ControlEvidenceProjectionV1>;
    ui?: Readonly<{
        workerPath: string;
        fixtureVersion: string;
        fixtureHash: string;
        assertionIds: readonly string[];
    }>;
}>;
export type ManualWorkerEventsV1 = Readonly<{
    onFrame(frame: unknown): Promise<void>;
    onUnavailable(reason: 'disconnect' | 'exit' | 'error' | 'overflow'): Promise<void>;
}>;
export type OriginalManualWorkerSessionV1 = Readonly<{
    binding: WorkerChannelBindingV1;
    originalChild: UiObservedOwnerV1;
    executableHash: string;
    beginDelivery(events: ManualWorkerEventsV1): void;
    send(frame: WorkerChannelEnvelopeV1): Promise<void>;
}>;
export interface ManualWorkerPortV1 {
    startFixed(input: Readonly<{
        intent: ControlPrivateIntentV1;
        custody: ControlWorkerCustodyV1;
        binding: WorkerChannelBindingV1;
    }>): Promise<OriginalManualWorkerSessionV1>;
}
export interface ControlJobsV1 {
    create(input: {
        kind: ControlJobKindV1;
        idempotencyKey: string;
        expectedSelectionHash: string;
    }): Promise<{
        receipt: ControlJobReceiptV1;
        replay: boolean;
    }>;
    cancel(jobId: string, input: {
        idempotencyKey: string;
        expectedRevision: number;
    }): Promise<{
        receipt: ControlJobReceiptV1;
        replay: boolean;
    }>;
    get(jobId: string): Promise<ControlJobReceiptV1 | null>;
    list(limit: number): Promise<readonly ControlJobReceiptV1[]>;
    evidence(jobId?: string): Promise<unknown>;
    screenshot(jobId: string, captureId: string): Promise<Buffer>;
    registerHistoricalControlEvidenceV1(input: {
        selectionHash: string;
        sourceSha: string;
        refs: ControlReportRefsV1;
    }): Promise<void>;
}
const terminal = (r: ControlJobReceiptV1) => ['completed', 'failed', 'blocked', 'cancelled'].includes(r.state) && r.finishedAt !== null;
const uuid = (v: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const hash = (v: string) => /^[a-f0-9]{64}$/.test(v);
function fail(code: string): never { throw new Error(code); }
function strict(value: unknown, keys: string[]): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== keys.sort().join('|'))
    fail('CONTROL_REQUEST_INVALID'); return value as Record<string, unknown>; }
function keyHash(value: unknown): string { if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{15,199}$/.test(value))
    fail('CONTROL_REQUEST_INVALID'); return controlHashV1(value); }
function syncDirectory(directory: string) { const fd = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW); try {
    fsyncSync(fd);
}
finally {
    closeSync(fd);
} }
function exclusive(file: string, value: unknown) {
    const pin = pinControlDirectoryV1(path.dirname(file));
    const fd = openSync(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try {
        writeFileSync(fd, controlBytesV1(value));
        fsyncSync(fd);
    }
    finally {
        closeSync(fd);
    }
    pin();
    syncDirectory(path.dirname(file));
}
function child(parent: string, name: string) { const pin = pinControlDirectoryV1(parent); const target = path.join(parent, name); mkdirSync(target, { mode: 0o700 }); pin(); pinControlDirectoryV1(target)(); syncDirectory(parent); return target; }
function absent(file: string) { try {
    lstatSync(file);
    return false;
}
catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT')
        return true;
    throw e;
} }
type Mapping = {
    sequence: number;
    hash: string;
    ack: WorkerChannelEnvelopeV1;
};
type Entry = {
    keyHash: string;
    intentHash: string;
    published: boolean;
    receipt: ControlJobReceiptV1;
    frames: Mapping[];
    cancel: {
        keyHash: string;
        requestId: string;
        receipt: ControlJobReceiptV1;
        aliases: {
            keyHash: string;
            expectedRevision: number;
        }[];
    } | null;
};
type Historical = {
    id: string;
    selectionHash: string;
    sourceSha: string;
    refs: ControlReportRefsV1;
};
type Index = {
    schema: 'mission-control.control-index.v1';
    revision: number;
    jobs: Entry[];
    history: Historical[];
};
type Live = {
    session: OriginalManualWorkerSessionV1;
    binding: WorkerChannelBindingV1;
    nonce: string;
    brokerSequence: number;
    workerSequence: number;
    ready: boolean;
    unknown: boolean;
    timer: NodeJS.Timeout;
    cancelSent: boolean;
};
/** No I/O at construction. GETs inspect existing pinned data only. */
export function createControlJobsV1({ root, selected, worker }: {
    root: string;
    selected: SelectedControlRuntimeV1;
    worker: ManualWorkerPortV1;
}): ControlJobsV1 {
    if (root !== selected.controlsRoot || root !== path.join(selected.installationDir, 'runtime', 'mission-control', 'controls'))
        fail('CONTROL_SELECTION_UNAVAILABLE');
    let queue: Promise<unknown> = Promise.resolve();
    let poisoned = false;
    let ownsMutation = false;
    const live = new Map<string, Live>();
    let parentPin: (() => void) | undefined, rootPin: (() => void) | undefined;
    const parent = path.dirname(root), indexFile = path.join(root, 'index.json');
    const guard = async () => { await selected.assertUnchanged(); if (poisoned)
        fail('CONTROL_STORE_UNCERTAIN'); };
    function pins() { (parentPin ??= pinControlDirectoryV1(parent))(); if (!absent(root))
        (rootPin ??= pinControlDirectoryV1(root))(); }
    function read(): {
        index: Index;
        hash: string | null;
    } {
        pins();
        if (absent(root))
            return { index: { schema: 'mission-control.control-index.v1', revision: 0, jobs: [], history: [] }, hash: null };
        const bytes = readControlPrivateFileV1(indexFile, 8 * 1024 * 1024);
        const raw = JSON.parse(bytes.toString('utf8'));
        strict(raw, ['schema', 'revision', 'jobs', 'history']);
        if (raw.schema !== 'mission-control.control-index.v1' || !Number.isSafeInteger(raw.revision) || raw.revision < 1 || !Array.isArray(raw.jobs) || !Array.isArray(raw.history) || raw.jobs.length > 10000)
            fail('CONTROL_STORE_UNSAFE');
        for (const e of raw.jobs) {
            strict(e, ['keyHash', 'intentHash', 'published', 'receipt', 'frames', 'cancel']);
            if (!hash(e.keyHash) || !hash(e.intentHash) || typeof e.published !== 'boolean' || !Array.isArray(e.frames) || e.frames.length > 64)
                fail('CONTROL_STORE_UNSAFE');
            e.receipt = selected.schemas.ControlJobReceiptV1Schema.parse(e.receipt);
            for (const m of e.frames) {
                strict(m, ['sequence', 'hash', 'ack']);
                if (!Number.isSafeInteger(m.sequence) || m.sequence < 1 || !hash(m.hash))
                    fail('CONTROL_STORE_UNSAFE');
            }
            if (e.cancel) {
                strict(e.cancel, ['keyHash', 'requestId', 'receipt', 'aliases']);
                if (!hash(e.cancel.keyHash) || !uuid(e.cancel.requestId) || !Array.isArray(e.cancel.aliases) || e.cancel.aliases.length > 32 || e.cancel.aliases.some((a: {
                    keyHash: string;
                    expectedRevision: number;
                }) => !hash(a.keyHash) || !Number.isSafeInteger(a.expectedRevision) || a.expectedRevision < 1))
                    fail('CONTROL_STORE_UNSAFE');
                e.cancel.receipt = selected.schemas.ControlJobReceiptV1Schema.parse(e.cancel.receipt);
            }
        }
        if (new Set(raw.jobs.map((e: Entry) => e.receipt.jobId)).size !== raw.jobs.length || new Set(raw.jobs.map((e: Entry) => e.keyHash)).size !== raw.jobs.length)
            fail('CONTROL_STORE_UNSAFE');
        for (const h of raw.history) {
            strict(h, ['id', 'selectionHash', 'sourceSha', 'refs']);
            if (!hash(h.id) || !hash(h.selectionHash) || !/^[a-f0-9]{40}$/.test(h.sourceSha))
                fail('CONTROL_STORE_UNSAFE');
            h.refs = selected.schemas.ControlReportRefsV1Schema.parse(h.refs);
        }
        return { index: raw as Index, hash: controlHashV1(bytes) };
    }
    function initialize() { pins(); if (absent(root)) {
        child(parent, 'controls');
        rootPin = pinControlDirectoryV1(root);
        child(root, 'jobs');
        child(root, 'history');
        exclusive(indexFile, { schema: 'mission-control.control-index.v1', revision: 1, jobs: [], history: [] });
    } pins(); }
    function commit(index: Index, oldHash: string | null) {
        pins();
        if (oldHash === null || controlHashV1(readControlPrivateFileV1(indexFile, 8 * 1024 * 1024)) !== oldHash)
            fail('CONTROL_CAS_CONFLICT');
        const next = { ...index, revision: index.revision + 1 };
        if (controlBytesV1(next).length > 8 * 1024 * 1024)
            fail('CONTROL_STORE_LIMIT');
        const temporary = path.join(root, 'index.next.json');
        exclusive(temporary, next);
        pins();
        if (controlHashV1(readControlPrivateFileV1(indexFile, 8 * 1024 * 1024)) !== oldHash)
            fail('CONTROL_CAS_CONFLICT');
        renameSync(temporary, indexFile);
        syncDirectory(root);
        pins();
        if (controlHashV1(readControlPrivateFileV1(indexFile, 8 * 1024 * 1024)) !== controlHashV1(controlBytesV1(next)))
            fail('CONTROL_STORE_UNCERTAIN');
    }
    function serialize<T>(operation: () => Promise<T>): Promise<T> { const result = queue.then(operation); queue = result.catch(() => { }); return result; }
    function mutation<T>(operation: () => Promise<T>, afterCommit?: (result: T) => Promise<void>): Promise<T> {
        return serialize(async () => {
            await guard();
            initialize();
            const lock = path.join(root, 'mutation.lock');
            let acquired = false;
            let result: T;
            try {
                const snapshot = read().index.jobs.map(e => ({ jobId: e.receipt.jobId, revision: e.receipt.revision }));
                exclusive(lock, { schema: 'mission-control.control-lock.v1', snapshot });
                acquired = true;
                ownsMutation = true;
                result = await operation();
            }
            finally {
                if (acquired) {
                    ownsMutation = false;
                    if (!poisoned) {
                        try {
                            unlinkSync(lock);
                            syncDirectory(root);
                        }
                        catch {
                            poisoned = true;
                            throw new Error('CONTROL_STORE_UNCERTAIN');
                        }
                    }
                }
            }
            if (afterCommit)
                await afterCommit(result!);
            return result!;
        });
    }
    function unresolvedPublication(e: Entry): boolean {
        const file = path.join(root, 'mutation.lock');
        if (ownsMutation || absent(file))
            return false;
        const lock = JSON.parse(readControlPrivateFileV1(file, 1048576).toString('utf8'));
        strict(lock, ['schema', 'snapshot']);
        if (lock.schema !== 'mission-control.control-lock.v1' || !Array.isArray(lock.snapshot))
            fail('CONTROL_STORE_UNSAFE');
        return !lock.snapshot.some((x: {
            jobId: string;
            revision: number;
        }) => x.jobId === e.receipt.jobId && x.revision === e.receipt.revision);
    }
    function projection(e: Entry): ControlJobReceiptV1 {
        const r = e.receipt, s = live.get(r.jobId);
        const uncertain = unresolvedPublication(e);
        if (uncertain || (!terminal(r) && (!e.published || !s || s.unknown)))
            return { ...r, state: 'ownership_unknown', phase: 'ownership_unknown',
                code: uncertain || s ? 'CONTROL_CUSTODY_UNCERTAIN' : 'CONTROL_CHANNEL_UNAVAILABLE',
                finishedAt: null, reportRefs: {} };
        return structuredClone(r);
    }
    function revise(e: Entry, patch: Partial<ControlJobReceiptV1>) { e.receipt = selected.schemas.ControlJobReceiptV1Schema.parse({ ...e.receipt, ...patch, revision: e.receipt.revision + 1, updatedAt: new Date().toISOString() }); }
    function record(e: Entry) { const dir = path.join(root, 'jobs', e.receipt.jobId); exclusive(path.join(dir, 'receipt-' + String(e.receipt.revision).padStart(20, '0') + '.json'), { receipt: e.receipt, mapping: e.frames.at(-1) ?? null }); }
    function sign(s: Live, body: Readonly<Record<string, unknown>>) { return selected.channel.signWorkerChannelFrameV1({ binding: s.binding, direction: 'broker_to_worker', sequence: ++s.brokerSequence, body, nonce: s.nonce }); }
    async function sendCancel(s: Live, e: Entry) { if (s.ready && !s.cancelSent && e.cancel) {
        s.cancelSent = true;
        await s.session.send(sign(s, { type: 'cancel', requestId: e.cancel.requestId, acceptedReceiptRevision: e.cancel.receipt.revision }));
    } }
    async function unavailable(jobId: string) { const s = live.get(jobId); if (s) {
        s.unknown = true;
        clearTimeout(s.timer);
    } }
    function validateUiFinal(e: Entry, s: Live, b: Readonly<Record<string, unknown>>) {
        const ui = selected.ui;
        if (!ui || b.ownedCleanup !== 'confirmed' || !hash(String(b.cleanupHash)) || !hash(String(b.uiReportHash)))
            fail('CONTROL_UI_FINAL_INVALID');
        const artifacts = path.join(root, 'jobs', e.receipt.jobId, 'ui-worker', 'artifacts');
        const r = readUiControlEvidenceV1({ artifacts, hash: String(b.uiReportHash), mcSourceSha: selected.mcSourceSha, mcBuildHash: selected.mcBuildHash });
        if (r.availability.state !== 'available' || !r.report || r.report.compatibility !== 'current' || r.report.finishedAt === null || r.report.fixtureVersion !== ui.fixtureVersion || r.report.fixtureHash !== ui.fixtureHash
            || b.plannedAssertions !== ui.assertionIds.length || b.completedAssertions !== r.report.assertions.length || r.report.assertions.some(a => !ui.assertionIds.includes(a.id)))
            fail('CONTROL_UI_FINAL_INVALID');
        if (r.report.assertions.some((a, i) => i > 0 && ui.assertionIds.indexOf(a.id) <= ui.assertionIds.indexOf(r.report!.assertions[i - 1].id)))
            fail('CONTROL_UI_FINAL_INVALID');
        if (r.report.outcome === 'pass' && (r.report.assertions.length !== ui.assertionIds.length || r.report.assertions.some(a => a.status !== 'pass')))
            fail('CONTROL_UI_FINAL_INVALID');
        const bytes = readControlPrivateFileV1(path.join(artifacts, String(b.cleanupHash) + '.json'), 1048576);
        if (controlHashV1(bytes) !== b.cleanupHash)
            fail('CONTROL_UI_FINAL_INVALID');
        const proof = UiRegressionCleanupProofV1Schema.parse(JSON.parse(bytes.toString('utf8')));
        if (!bytes.equals(controlBytesV1(proof)))
            fail('CONTROL_UI_FINAL_INVALID');
        if (proof.jobId !== e.receipt.jobId || proof.intentHash !== e.intentHash || proof.ownerHash !== selected.channel.hashObservedControlWorkerOwnerV1(s.session.originalChild)
            || proof.mcSourceSha !== selected.mcSourceSha || proof.mcBuildHash !== selected.mcBuildHash || proof.fixtureHash !== ui.fixtureHash || proof.uiReportHash !== b.uiReportHash)
            fail('CONTROL_UI_FINAL_INVALID');
        // The authenticated fixed worker establishes actual owned-handle settlement;
        // its strict proof binds all resource dispositions to this exact original child.
        return { uiReportHash: String(b.uiReportHash) };
    }
    async function onFrame(jobId: string, raw: unknown): Promise<void> {
        let delivery: (() => Promise<void>) | undefined;
        await mutation(async () => {
            const s = live.get(jobId);
            if (!s || s.unknown)
                return;
            try {
                const frame = selected.channel.verifyWorkerChannelFrameV1({ frame: raw, binding: s.binding, direction: 'worker_to_broker', nonce: s.nonce });
                const frameHash = selected.channel.hashWorkerChannelFrameV1(frame);
                const { index, hash: oldHash } = read();
                const e = index.jobs.find(x => x.receipt.jobId === jobId);
                if (!e)
                    fail('CONTROL_CHANNEL_INVALID');
                const duplicate = e.frames.find(m => m.sequence === frame.sequence);
                if (duplicate) {
                    if (duplicate.hash !== frameHash)
                        fail('CONTROL_CHANNEL_INVALID');
                    delivery = () => s.session.send(duplicate.ack);
                    return;
                }
                if (frame.sequence !== s.workerSequence + 1 || terminal(e.receipt))
                    fail('CONTROL_CHANNEL_INVALID');
                const b = frame.body;
                const ui = e.receipt.kind === 'ui_regression';
                if (!s.ready) {
                    if (b.type !== (ui ? 'ui_ready' : 'ready') || controlCanonicalV1(b.owner) !== controlCanonicalV1(s.session.originalChild))
                        fail('CONTROL_CHANNEL_INVALID');
                    if (ui && (!selected.ui || b.fixtureVersion !== selected.ui.fixtureVersion || b.fixtureHash !== selected.ui.fixtureHash || b.plannedAssertions !== selected.ui.assertionIds.length))
                        fail('CONTROL_CHANNEL_INVALID');
                    exclusive(path.join(root, 'jobs', jobId, 'channel.json'), { schema: 'mission-control.control-channel.v1', jobId, intentHash: e.intentHash, channelId: s.binding.channelId, originalChild: s.session.originalChild, readyFrameHash: frameHash });
                    revise(e, { state: e.receipt.cancelRequested ? 'cancelling' : 'starting', phase: 'starting', plannedCases: ui ? selected.ui!.assertionIds.length : e.receipt.plannedCases });
                }
                else if (b.type === 'progress' || b.type === 'ui_progress') {
                    if (ui !== (b.type === 'ui_progress'))
                        fail('CONTROL_CHANNEL_INVALID');
                    if (!ui && ((b.currentCaseId !== null && !selected.caseIds.includes(String(b.currentCaseId))) || (e.receipt.kind === 'activation_preflight' && (b.currentCaseId !== null || b.ownedRunId !== null || b.completedCases !== 0)) || (b.ownedRunId !== null && b.currentCaseId === null)))
                        fail('CONTROL_CHANNEL_INVALID');
                    const completed = Number(ui ? b.completedAssertions : b.completedCases);
                    if (!Number.isSafeInteger(completed) || completed < e.receipt.completedCases || completed > e.receipt.plannedCases || (ui && b.plannedAssertions !== e.receipt.plannedCases))
                        fail('CONTROL_CHANNEL_INVALID');
                    const acquired = ui ? b.phase === 'running' : b.phase === 'acquired';
                    revise(e, { state: e.receipt.cancelRequested ? 'cancelling' : 'running', phase: String(b.phase), code: b.code as string | null,
                        completedCases: completed, currentCaseId: ui ? null : b.currentCaseId as string | null, ownedRunId: ui ? null : b.ownedRunId as string | null,
                        startedAt: e.receipt.startedAt ?? (acquired ? new Date().toISOString() : null), reportRefs: {} });
                }
                else if (b.type === 'cancel_observed' || b.type === 'ui_cancel_observed') {
                    if (ui !== (b.type === 'ui_cancel_observed') || !e.cancel || b.requestId !== e.cancel.requestId)
                        fail('CONTROL_CHANNEL_INVALID');
                    revise(e, { code: b.effective === 'after_boundary' ? 'CONTROL_CANCEL_TOO_LATE' : 'CONTROL_CANCEL_REQUESTED' });
                }
                else if (b.type === 'fault') {
                    revise(e, { state: 'ownership_unknown', phase: 'ownership_unknown', code: b.code as string, reportRefs: {} });
                }
                else if (b.type === 'final_closed' || b.type === 'ui_final') {
                    if (ui !== (b.type === 'ui_final'))
                        fail('CONTROL_CHANNEL_INVALID');
                    const completed = Number(ui ? b.completedAssertions : b.completedCases);
                    if (!Number.isSafeInteger(completed) || completed < e.receipt.completedCases || completed > e.receipt.plannedCases)
                        fail('CONTROL_CHANNEL_INVALID');
                    const refs = ui ? validateUiFinal(e, s, b) : selected.schemas.ControlReportRefsV1Schema.parse(b.reportRefs);
                    revise(e, { state: b.outcome as ControlJobReceiptV1['state'], phase: 'closed', code: b.code as string | null, finishedAt: new Date().toISOString(), completedCases: completed, reportRefs: refs, currentCaseId: null, ownedRunId: null });
                }
                else
                    fail('CONTROL_CHANNEL_INVALID');
                const ack = sign(s, { type: 'ack', workerSequence: frame.sequence, workerFrameHash: frameHash, receiptRevision: e.receipt.revision, receipt: e.receipt });
                e.frames.push({ sequence: frame.sequence, hash: frameHash, ack });
                e.frames = e.frames.slice(-64);
                try {
                    record(e);
                    commit(index, oldHash);
                }
                catch {
                    poisoned = true;
                    throw new Error('CONTROL_STORE_UNCERTAIN');
                }
                s.workerSequence = frame.sequence;
                s.ready = true;
                clearTimeout(s.timer);
                if (b.type === 'fault')
                    s.unknown = true;
                delivery = async () => { await s.session.send(ack); await sendCancel(s, e); };
            }
            catch {
                await unavailable(jobId);
            }
        }, async () => { if (delivery) {
            try {
                await delivery();
            }
            catch {
                await unavailable(jobId);
            }
        } }).catch(async () => { poisoned = true; await unavailable(jobId); });
    }
    const jobs: ControlJobsV1 = {
        async create(input) {
            strict(input, ['kind', 'idempotencyKey', 'expectedSelectionHash']);
            const digest = keyHash(input.idempotencyKey);
            if (!['activation_preflight', 'convergence_full8', 'ui_regression'].includes(input.kind))
                fail('CONTROL_REQUEST_INVALID');
            if (input.expectedSelectionHash !== selected.selectionHash)
                fail('CONTROL_SELECTION_STALE');
            await guard();
            const replay = read().index.jobs.find(e => e.keyHash === digest);
            if (replay) {
                if (replay.receipt.kind !== input.kind || replay.receipt.selectionHash !== selected.selectionHash)
                    fail('CONTROL_IDEMPOTENCY_CONFLICT');
                return { receipt: projection(replay), replay: true };
            }
            return mutation(async () => {
                let { index, hash: oldHash } = read();
                const existing = index.jobs.find(e => e.keyHash === digest);
                if (existing) {
                    if (existing.receipt.kind !== input.kind || existing.receipt.selectionHash !== selected.selectionHash)
                        fail('CONTROL_IDEMPOTENCY_CONFLICT');
                    return { receipt: projection(existing), replay: true };
                }
                if (index.jobs.some(e => !terminal(e.receipt)))
                    fail(index.jobs.some(e => projection(e).state === 'ownership_unknown') ? 'CONTROL_OWNERSHIP_UNKNOWN' : 'CONTROL_BUSY');
                if (input.kind === 'ui_regression' && !selected.ui)
                    fail('CONTROL_UI_UNAVAILABLE');
                const now = new Date().toISOString(), jobId = randomUUID(), nonce = randomBytes(32).toString('base64url');
                const receipt = selected.schemas.ControlJobReceiptV1Schema.parse({ schema: 'mission-control.control-job.v1', jobId, kind: input.kind, revision: 1,
                    selectionHash: selected.selectionHash, sourceSha: selected.sourceSha, mcSourceSha: selected.mcSourceSha, mcBuildHash: selected.mcBuildHash, suiteHash: input.kind === 'convergence_full8' ? selected.suiteHash : null,
                    state: 'accepted', requestedAt: now, startedAt: null, updatedAt: now, finishedAt: null, phase: 'starting', code: null, currentCaseId: null, ownedRunId: null, completedCases: 0, plannedCases: input.kind === 'convergence_full8' ? 8 : input.kind === 'ui_regression' ? selected.ui!.assertionIds.length : 0, reportRefs: {}, cancelRequested: false });
                const intent = selected.schemas.ControlPrivateIntentV1Schema.parse({ schema: 'mission-control.control-intent.v1', receipt, installationDir: selected.installationDir, releaseDir: selected.releaseDir, nonceDigest: controlHashV1(nonce), fixedSuiteRelativePath: input.kind === 'convergence_full8' ? 'evals/suites/product-convergence-codex-v1.json' : null });
                const entry: Entry = { keyHash: digest, intentHash: controlHashV1(controlBytesV1(intent)), published: false, receipt, frames: [], cancel: null };
                index.jobs.push(entry);
                commit(index, oldHash);
                try {
                    const dir = child(path.join(root, 'jobs'), jobId);
                    exclusive(path.join(dir, 'intent.json'), intent);
                    record(entry);
                    ({ index, hash: oldHash } = read());
                    const e = index.jobs.find(x => x.receipt.jobId === jobId)!;
                    e.published = true;
                    commit(index, oldHash);
                    await guard();
                    const custody = selected.schemas.ControlWorkerCustodyV1Schema.parse({ schema: 'mission-control.control-custody.v1', jobId, selectionHash: selected.selectionHash, sourceSha: selected.sourceSha, mcBuildHash: selected.mcBuildHash, nonce });
                    const binding = { jobId, channelId: randomUUID(), intentHash: entry.intentHash, kind: input.kind };
                    const spawnRequestedAt = Date.now();
                    const session = await worker.startFixed({ intent, custody, binding });
                    const handshakeRemaining = 10_000 - (Date.now() - spawnRequestedAt);
                    if (handshakeRemaining <= 0) fail('CONTROL_CHANNEL_UNAVAILABLE');
                    if (controlCanonicalV1(session.binding) !== controlCanonicalV1(binding) || !hash(session.executableHash))
                        fail('CONTROL_CHANNEL_INVALID');
                    selected.channel.ObservedControlWorkerOwnerV1Schema.parse(session.originalChild);
                    const timer = setTimeout(() => { void unavailable(jobId); }, handshakeRemaining);
                    timer.unref();
                    const s: Live = { session, binding, nonce, brokerSequence: 0, workerSequence: 0, ready: false, unknown: false, timer, cancelSent: false };
                    live.set(jobId, s);
                    session.beginDelivery({ onFrame: raw => onFrame(jobId, raw), onUnavailable: () => unavailable(jobId) });
                    await session.send(sign(s, { type: 'custody', custody }));
                    return { receipt: projection(e), replay: false };
                }
                catch {
                    await unavailable(jobId);
                    return { receipt: { ...receipt, state: 'ownership_unknown', phase: 'ownership_unknown', code: 'CONTROL_CUSTODY_UNCERTAIN' }, replay: false };
                }
            });
        },
        async cancel(jobId, input) {
            if (!uuid(jobId))
                fail('CONTROL_JOB_NOT_FOUND');
            strict(input, ['idempotencyKey', 'expectedRevision']);
            const digest = keyHash(input.idempotencyKey);
            if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1)
                fail('CONTROL_REQUEST_INVALID');
            return mutation(async () => {
                const { index, hash: oldHash } = read();
                const e = index.jobs.find(x => x.receipt.jobId === jobId);
                if (!e)
                    fail('CONTROL_JOB_NOT_FOUND');
                if (e.cancel) {
                    const replay = e.cancel.aliases.find(a => a.keyHash === digest);
                    if (replay) {
                        if (replay.expectedRevision !== input.expectedRevision)
                            fail('CONTROL_IDEMPOTENCY_CONFLICT');
                        return { receipt: structuredClone(e.cancel.receipt), replay: true };
                    }
                }
                if (e.receipt.revision !== input.expectedRevision)
                    fail('CONTROL_REVISION_CONFLICT');
                const s = live.get(jobId);
                if (!s || s.unknown)
                    fail('CONTROL_OWNERSHIP_UNKNOWN');
                if (terminal(e.receipt))
                    fail('CONTROL_JOB_FINISHED');
                if (e.cancel) {
                    if (e.cancel.aliases.length >= 32)
                        fail('CONTROL_REQUEST_INVALID');
                    const alias = { keyHash: digest, expectedRevision: input.expectedRevision };
                    exclusive(path.join(root, 'jobs', jobId, 'cancel-replay-' + digest + '.json'), { ...alias, requestId: e.cancel.requestId, receipt: e.cancel.receipt });
                    e.cancel.aliases.push(alias);
                    try {
                        commit(index, oldHash);
                    }
                    catch {
                        poisoned = true;
                        s.unknown = true;
                        fail('CONTROL_STORE_UNCERTAIN');
                    }
                    return { receipt: structuredClone(e.cancel.receipt), replay: true };
                }
                const requestId = randomUUID();
                revise(e, { state: 'cancelling', cancelRequested: true, code: 'CONTROL_CANCEL_REQUESTED' });
                exclusive(path.join(root, 'jobs', jobId, 'cancel.json'), { schema: 'mission-control.control-cancel.v1', jobId, intentHash: e.intentHash, channelId: s.binding.channelId, requestId, idempotencyKeyHash: digest, acceptedReceiptRevision: e.receipt.revision, requestedAt: e.receipt.updatedAt });
                e.cancel = { keyHash: digest, requestId, receipt: e.receipt, aliases: [{ keyHash: digest, expectedRevision: input.expectedRevision }] };
                try {
                    record(e);
                    commit(index, oldHash);
                }
                catch {
                    poisoned = true;
                    s.unknown = true;
                    fail('CONTROL_STORE_UNCERTAIN');
                }
                try {
                    await sendCancel(s, e);
                }
                catch {
                    await unavailable(jobId);
                }
                return { receipt: structuredClone(e.cancel.receipt), replay: false };
            });
        },
        async get(jobId) { if (!uuid(jobId))
            return null; await guard(); const e = read().index.jobs.find(x => x.receipt.jobId === jobId); return e ? projection(e) : null; },
        async list(limit) { await guard(); if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50)
            fail('CONTROL_REQUEST_INVALID'); return read().index.jobs.slice(-limit).reverse().map(projection); },
        async evidence(jobId) {
            await guard();
            const { index } = read();
            const entry = jobId ? index.jobs.find(x => x.receipt.jobId === jobId) : index.jobs.at(-1);
            if (jobId && !entry)
                fail('CONTROL_JOB_NOT_FOUND');
            const refs = entry ? projection(entry).reportRefs : {};
            const expected = { selectionHash: entry?.receipt.selectionHash ?? selected.selectionHash, sourceSha: entry?.receipt.sourceSha ?? selected.sourceSha, releaseSha: entry?.receipt.sourceSha ?? selected.releaseSha, suiteHash: entry?.receipt.suiteHash ?? selected.suiteHash, refs };
            const evidence = selected.schemas.ControlEvidenceProjectionV1Schema.parse(await selected.readEvidence(expected));
            await guard();
            const ui = readUiControlEvidenceV1({ artifacts: entry ? path.join(root, 'jobs', entry.receipt.jobId, 'ui-worker', 'artifacts') : '', hash: refs.uiReportHash ?? null, mcSourceSha: selected.mcSourceSha, mcBuildHash: selected.mcBuildHash });
            const history = [];
            for (const h of index.history.slice(-50)) {
                const p = selected.schemas.ControlEvidenceProjectionV1Schema.parse(await selected.readEvidence({ ...expected, selectionHash: h.selectionHash, sourceSha: h.sourceSha, releaseSha: h.sourceSha, refs: h.refs }));
                history.push({ id: h.id, sourceSha: h.sourceSha, evidence: p });
            }
            return parseControlEvidenceEnvelopeV1({ schema: 'mission-control.controls-evidence-envelope.v1', selectionHash: selected.selectionHash, evidence: { ...evidence, ui }, history }, value => selected.schemas.ControlEvidenceProjectionV1Schema.parse(value));
        },
        async screenshot(jobId, captureId) { const r = await jobs.get(jobId); if (!r?.reportRefs.uiReportHash)
            fail('CONTROL_SCREENSHOT_NOT_FOUND'); return readUiControlScreenshotV1({ artifacts: path.join(root, 'jobs', jobId, 'ui-worker', 'artifacts'), hash: r.reportRefs.uiReportHash, mcSourceSha: selected.mcSourceSha, mcBuildHash: selected.mcBuildHash, captureId }); },
        async registerHistoricalControlEvidenceV1(input) {
            strict(input, ['selectionHash', 'sourceSha', 'refs']);
            if (!hash(input.selectionHash) || !/^[a-f0-9]{40}$/.test(input.sourceSha))
                fail('CONTROL_REQUEST_INVALID');
            const refs = selected.schemas.ControlReportRefsV1Schema.parse(input.refs);
            if (refs.uiReportHash || Object.keys(refs).length === 0)
                fail('CONTROL_HISTORY_INVALID');
            await guard();
            const evidence = selected.schemas.ControlEvidenceProjectionV1Schema.parse(await selected.readEvidence({ selectionHash: input.selectionHash, sourceSha: input.sourceSha, releaseSha: input.sourceSha, suiteHash: selected.suiteHash, refs }));
            if ((refs.activationHash && (evidence.activation.availability.state !== 'available' || evidence.activation.report?.hash !== refs.activationHash))
                || ((refs.resultHash || refs.gateHash) && (evidence.evaluation.availability.state !== 'available' || evidence.evaluation.report?.resultHash !== refs.resultHash || evidence.evaluation.report?.gateHash !== (refs.gateHash ?? null))))
                fail('CONTROL_HISTORY_INVALID');
            await mutation(async () => { const { index, hash: oldHash } = read(); const h = { ...input, refs, id: controlHashV1(controlBytesV1(input)) }; if (index.history.some(x => x.id === h.id))
                return; exclusive(path.join(root, 'history', h.id + '.json'), h); index.history.push(h); commit(index, oldHash); });
        }
    };
    return Object.freeze(jobs);
}
/** Fixed original child transport. It owns no receipt, completion or reconnect authority. */
export function createFixedManualWorkerPortV1(selected: SelectedControlRuntimeV1): ManualWorkerPortV1 {
    const executable = realpathSync(process.execPath);
    const psOptions = { encoding: 'utf8' as const, timeout: 2000, maxBuffer: 64 * 1024, env: { PATH: '/usr/bin:/bin:/usr/sbin:/sbin', LANG: 'C', LC_ALL: 'C', TZ: 'UTC' } };
    function ps(args: string[], deadline: number): string {
        const remaining = deadline - Date.now();
        if (remaining <= 0) fail('CONTROL_CUSTODY_UNCERTAIN');
        const result = spawnSync('/bin/ps', args, { ...psOptions, timeout: Math.min(2000, remaining), shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
        if (result.error || result.signal || result.status !== 0 || result.stderr !== '')
            fail('CONTROL_CUSTODY_UNCERTAIN');
        return result.stdout;
    }
    function observe(pid: number, script: string, jobId: string, deadline: number): UiObservedOwnerV1 {
        const args = ['-ww', '-p', String(pid), '-o', 'lstart=', '-o', 'pgid=', '-o', 'args='];
        const before = ps(args, deadline), comm = ps(['-ww', '-p', String(pid), '-o', 'comm='], deadline), after = ps(args, deadline);
        const match = /^\s*(\w{3} \w{3} +\d{1,2} \d{2}:\d{2}:\d{2} \d{4})\s+(\d+)\s+([^\r\n]+)\n?$/.exec(before);
        const executableRow = /^([^\r\n]+)\n?$/.exec(comm);
        if (before !== after || !match || !executableRow || realpathSync(executableRow[1]) !== executable || match[3] !== `${executable} ${script} --job-id ${jobId}`)
            fail('CONTROL_CUSTODY_UNCERTAIN');
        return selected.channel.ObservedControlWorkerOwnerV1Schema.parse({ pid, processStartedAt: new Date(`${match[1]} UTC`).toISOString(), processGroupId: Number(match[2]), source: 'observed_os', executable, script, commandHash: controlHashV1(match[3]) });
    }
    return Object.freeze({ async startFixed({ intent, custody, binding }: Parameters<ManualWorkerPortV1['startFixed']>[0]) {
            const deadline = Date.now() + 10_000;
            await selected.assertUnchanged();
            selected.schemas.ControlPrivateIntentV1Schema.parse(intent);
            selected.schemas.ControlWorkerCustodyV1Schema.parse(custody);
            const jobId = intent.receipt.jobId, ui = intent.receipt.kind === 'ui_regression';
            if (!uuid(jobId) || binding.jobId !== jobId || binding.kind !== intent.receipt.kind || !uuid(binding.channelId)
                || custody.jobId !== jobId || custody.selectionHash !== selected.selectionHash || intent.receipt.selectionHash !== selected.selectionHash || custody.nonce.length < 32
                || controlHashV1(custody.nonce) !== intent.nonceDigest || intent.installationDir !== selected.installationDir || intent.releaseDir !== selected.releaseDir
                || intent.receipt.sourceSha !== selected.sourceSha || intent.receipt.mcSourceSha !== selected.mcSourceSha || intent.receipt.mcBuildHash !== selected.mcBuildHash
                || custody.sourceSha !== selected.sourceSha || custody.mcBuildHash !== selected.mcBuildHash || intent.receipt.suiteHash !== (intent.receipt.kind === 'convergence_full8' ? selected.suiteHash : null))
                fail('CONTROL_CUSTODY_UNCERTAIN');
            const script = ui ? selected.ui?.workerPath : selected.workerPath;
            if (!script || realpathSync(script) !== script)
                fail('CONTROL_WORKER_UNAVAILABLE');
            const dir = path.join(selected.controlsRoot, 'jobs', jobId), intentFile = path.join(dir, 'intent.json');
            const intentBytes = readControlPrivateFileV1(intentFile, 16 * 1024);
            if (!intentBytes.equals(controlBytesV1(intent)) || controlHashV1(intentBytes) !== binding.intentHash)
                fail('CONTROL_CUSTODY_UNCERTAIN');
            const executableHash = controlHashV1(readFileSync(executable));
            // Load the existing MC config only for full8, before the last
            // selection await. UI and activation workers need no MC auth.
            const mcConfig = intent.receipt.kind === 'convergence_full8' ? (await import('../config.js')).config : undefined;
            const intentFd = ui ? openSync(intentFile, constants.O_RDONLY | constants.O_NOFOLLOW) : null;
            let childProcess: ReturnType<typeof spawn>;
            try {
                await selected.assertUnchanged();
                // Read current inputs and spawn synchronously after the final
                // await; never inherit ambient loader, database or provider keys.
                const env: NodeJS.ProcessEnv = { PATH: '/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin', LANG: 'C', LC_ALL: 'C', TZ: 'UTC' };
                for (const key of ['HOME', 'TMPDIR', 'USER'])
                    if (process.env[key])
                        env[key] = process.env[key];
                if (!ui) {
                    const runtimeDir = path.join(selected.installationDir, 'runtime');
                    const configuredRuntimeDir = process.env.SETFARM_ENV_DIR, activation = process.env.SETFARM_V3_ACTIVATION;
                    if ((configuredRuntimeDir !== undefined && configuredRuntimeDir !== runtimeDir)
                        || (activation !== undefined && activation !== 'enabled' && activation !== 'disabled'))
                        fail('CONTROL_WORKER_UNAVAILABLE');
                    env.SETFARM_INSTALLATION_DIR = selected.installationDir;
                    env.SETFARM_REPO_DIR = selected.releaseDir;
                    env.SETFARM_ENV_DIR = runtimeDir;
                    if (activation !== undefined)
                        env.SETFARM_V3_ACTIVATION = activation;
                    if (mcConfig) {
                        const runtime = process.env.SETFARM_AGENT_RUNTIME, model = process.env.SETFARM_CODEX_MODEL;
                        const mcUrl = process.env.MC_INTERNAL_URL ?? 'http://127.0.0.1:3080';
                        const dashboardUrl = process.env.SETFARM_DASHBOARD_URL ?? 'http://127.0.0.1:3333';
                        if (runtime !== 'codex' || typeof model !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,193}$/.test(model)
                            || mcUrl !== 'http://127.0.0.1:3080' || dashboardUrl !== 'http://127.0.0.1:3333')
                            fail('CONTROL_WORKER_UNAVAILABLE');
                        env.SETFARM_AGENT_RUNTIME = runtime;
                        env.SETFARM_CODEX_MODEL = model;
                        env.MC_INTERNAL_URL = mcUrl;
                        env.SETFARM_DASHBOARD_URL = dashboardUrl;
                        const token = mcConfig.authToken;
                        if (token)
                            env.MC_AUTH_TOKEN = token;
                    }
                }
                childProcess = spawn(executable, [script, '--job-id', jobId], { cwd: selected.releaseDir, env, shell: false, serialization: 'json', stdio: ui ? ['ignore', 'pipe', 'pipe', 'ipc', intentFd!] : ['ignore', 'pipe', 'pipe', 'ipc'] });
            }
            finally {
                if (intentFd !== null)
                    closeSync(intentFd);
            }
            const childHandle = childProcess!;
            let events: ManualWorkerEventsV1 | undefined, started = false, failed = false, delivering = false;
            const pending: ({
                frame: unknown;
            } | {
                reason: 'disconnect' | 'exit' | 'error' | 'overflow';
            })[] = [];
            async function drain() { if (delivering || !events)
                return; delivering = true; try {
                while (pending.length) {
                    const item = pending.shift()!;
                    if ('frame' in item)
                        await events.onFrame(item.frame);
                    else
                        await events.onUnavailable(item.reason);
                }
            }
            catch {
                failed = true;
                await events.onUnavailable('error').catch(() => { });
            }
            finally {
                delivering = false;
            } }
            function enqueue(item: typeof pending[number]) {
                if (failed)
                    return;
                if ('frame' in item) {
                    let size = Infinity;
                    try {
                        size = Buffer.byteLength(JSON.stringify(item.frame));
                    }
                    catch { }
                    if (size > 16384 || pending.length >= 16) {
                        failed = true;
                        pending.length = 0;
                        pending.push({ reason: 'overflow' });
                        void drain();
                        return;
                    }
                }
                pending.push(item);
                if (started)
                    queueMicrotask(() => { void drain(); });
            }
            const settlementFile = path.join(dir, 'original-worker-settlement.json');
            const settlement = createControlWorkerSettlementV1({
                child: childHandle, binding, executable, executableHash,
                selectionHash: selected.selectionHash, sourceSha: selected.sourceSha,
                mcSourceSha: selected.mcSourceSha, mcBuildHash: selected.mcBuildHash,
                hashOwner: selected.channel.hashObservedControlWorkerOwnerV1,
                publish(record) {
                    const bytes = controlBytesV1(record);
                    exclusive(settlementFile, record);
                    if (!readControlPrivateFileV1(settlementFile, 16384).equals(bytes))
                        fail('CONTROL_STORE_UNCERTAIN');
                },
                onFault() { enqueue({ reason: 'error' }); },
            });
            childHandle.on('message', frame => enqueue({ frame }));
            childHandle.once('disconnect', () => enqueue({ reason: 'disconnect' }));
            childHandle.once('exit', () => enqueue({ reason: 'exit' }));
            childHandle.once('error', () => enqueue({ reason: 'error' }));
            // Private output is deliberately content-elided before disk: arbitrary child
            // errors can contain credentials split across chunks. Count bounded bytes only.
            for (const [name, stream] of [['stdout', childHandle.stdout], ['stderr', childHandle.stderr]] as const) {
                const logError = name === 'stdout' ? 'STDOUT_LOG_ERROR' : 'STDERR_LOG_ERROR';
                let fd: number;
                try {
                    fd = openSync(path.join(dir, name + '.log'), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
                } catch (error) {
                    settlement.noteError(logError);
                    enqueue({ reason: 'error' });
                    throw error;
                }
                let written = 0, closed = false;
                stream?.on('data', (chunk: Buffer) => { if (written >= 65536 || closed)
                    return; const line = Buffer.from(`[private output omitted: ${chunk.length} bytes]\n`); try {
                    const retained = line.subarray(0, 65536 - written);
                    writeFileSync(fd, retained);
                    written += retained.length;
                }
                catch {
                    settlement.noteError(logError);
                    enqueue({ reason: 'error' });
                } });
                const close = () => { if (closed) return; closed = true; try { try { fsyncSync(fd); } finally { closeSync(fd); } } catch { settlement.noteError(logError); enqueue({ reason: 'error' }); } };
                stream?.prependOnceListener('close', close);
                childHandle.once('error', close);
            }
            await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('CONTROL_WORKER_UNAVAILABLE')), Math.max(1, deadline - Date.now()));
                timer.unref();
                childHandle.once('spawn', () => { clearTimeout(timer); resolve(); });
                childHandle.once('error', () => { clearTimeout(timer); reject(new Error('CONTROL_WORKER_UNAVAILABLE')); });
            });
            const pid = childHandle.pid;
            if (!pid)
                fail('CONTROL_CUSTODY_UNCERTAIN');
            const originalChild = observe(pid, script, jobId, deadline);
            const parent = ps(['-p', String(pid), '-o', 'ppid='], deadline).trim();
            if (Number(parent) !== process.pid || controlCanonicalV1(observe(pid, script, jobId, deadline)) !== controlCanonicalV1(originalChild))
                fail('CONTROL_CUSTODY_UNCERTAIN');
            await selected.assertUnchanged();
            settlement.bindOwner(originalChild);
            return Object.freeze({ binding, originalChild, executableHash,
                beginDelivery(value: ManualWorkerEventsV1) { if (started)
                    fail('CONTROL_CHANNEL_INVALID'); events = value; started = true; queueMicrotask(() => { void drain(); }); },
                send(frame: WorkerChannelEnvelopeV1) {
                    return new Promise<void>((resolve, reject) => {
                        if (failed || !childHandle.connected || Buffer.byteLength(JSON.stringify(frame)) > 16384)
                            return reject(new Error('CONTROL_CHANNEL_UNAVAILABLE'));
                        const timer = setTimeout(() => reject(new Error('CONTROL_CHANNEL_UNAVAILABLE')), 30000);
                        timer.unref();
                        childHandle.send(frame, error => { clearTimeout(timer); if (error)
                            reject(new Error('CONTROL_CHANNEL_UNAVAILABLE'));
                        else
                            resolve(); });
                    });
                },
            });
        } });
}
