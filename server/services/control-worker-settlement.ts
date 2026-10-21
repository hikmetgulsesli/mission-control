import type { ChildProcess } from 'node:child_process';
import type { WorkerChannelBindingV1 } from './control-jobs.js';
import type { UiObservedOwnerV1 } from './control-ui-worker-protocol.js';

export type ControlWorkerSettlementErrorV1 = 'CHILD_ERROR' | 'STDOUT_ERROR'
    | 'STDERR_ERROR' | 'STDOUT_LOG_ERROR' | 'STDERR_LOG_ERROR' | 'OWNER_BINDING_ERROR';
type ExitTupleV1 = Readonly<{ code: number | null; signal: string | null }>;
type StreamFactsV1 = Readonly<{ endObserved: boolean; closeObserved: boolean }>;
export type ControlOriginalWorkerSettlementV1 = Readonly<{
    schema: 'mission-control.control-original-worker-settlement.v1';
    subject: 'original_fixed_node_worker';
    jobId: string; kind: WorkerChannelBindingV1['kind']; channelId: string;
    intentHash: string; selectionHash: string; sourceSha: string;
    mcSourceSha: string; mcBuildHash: string; executableHash: string;
    brokerPid: number; originalChild: UiObservedOwnerV1 | null; ownerHash: string | null;
    exit: ExitTupleV1 | null; processClose: ExitTupleV1 | null;
    stdout: StreamFactsV1; stderr: StreamFactsV1;
    errors: readonly ControlWorkerSettlementErrorV1[];
    observedFactsComplete: boolean; recordedAtUTC: string;
}>;
export type ControlWorkerSettlementInputV1 = Readonly<{
    child: ChildProcess; binding: WorkerChannelBindingV1; executable: string;
    executableHash: string; selectionHash: string; sourceSha: string;
    mcSourceSha: string; mcBuildHash: string;
    hashOwner(owner: UiObservedOwnerV1): string;
    publish(record: ControlOriginalWorkerSettlementV1): void;
    onFault(): void;
}>;

const ERROR_CODES: readonly ControlWorkerSettlementErrorV1[] = Object.freeze([
    'CHILD_ERROR', 'STDOUT_ERROR', 'STDERR_ERROR', 'STDOUT_LOG_ERROR',
    'STDERR_LOG_ERROR', 'OWNER_BINDING_ERROR',
]);

/** Observes only the original handle; completeness never implies a successful exit. */
export function createControlWorkerSettlementV1(input: ControlWorkerSettlementInputV1): Readonly<{
    bindOwner(owner: UiObservedOwnerV1): void;
    noteError(code: ControlWorkerSettlementErrorV1): void;
}> {
    const { child, executable, hashOwner, publish, onFault } = input;
    const originalPid = child.pid;
    const context = Object.freeze({
        jobId: input.binding.jobId, kind: input.binding.kind, channelId: input.binding.channelId,
        intentHash: input.binding.intentHash, selectionHash: input.selectionHash, sourceSha: input.sourceSha,
        mcSourceSha: input.mcSourceSha, mcBuildHash: input.mcBuildHash, executableHash: input.executableHash,
        brokerPid: process.pid,
    });
    let originalChild: UiObservedOwnerV1 | null = null, ownerHash: string | null = null;
    let exit: ExitTupleV1 | null = null, processClose: ExitTupleV1 | null = null;
    let ownerBindingAttempted = false, settled = false, faultNotified = false;
    const stdout = { endObserved: false, closeObserved: false };
    const stderr = { endObserved: false, closeObserved: false };
    const errors = new Set<ControlWorkerSettlementErrorV1>();

    function fault() {
        if (faultNotified) return;
        faultNotified = true;
        try { onFault(); } catch { /* A fault callback must not escape an original event listener. */ }
    }
    function noteError(code: ControlWorkerSettlementErrorV1) {
        if (settled) return;
        errors.add(ERROR_CODES.includes(code) ? code : 'CHILD_ERROR');
    }
    function tuple(code: number | null, signal: string | null): ExitTupleV1 | null {
        if (!(code === null || Number.isInteger(code))
            || !(signal === null || (typeof signal === 'string' && signal.length > 0))
            || (code === null) === (signal === null)) {
            noteError('CHILD_ERROR');
            return null;
        }
        return Object.freeze({ code, signal });
    }
    function bindOwner(owner: UiObservedOwnerV1) {
        if (settled || ownerBindingAttempted) {
            noteError('OWNER_BINDING_ERROR'); fault();
            throw new Error('OWNER_BINDING_ERROR');
        }
        ownerBindingAttempted = true;
        try {
            if (!Number.isInteger(originalPid) || !originalPid || owner.pid !== originalPid
                || owner.executable !== executable || owner.source !== 'observed_os')
                throw new Error('OWNER_BINDING_ERROR');
            const observed = Object.freeze({
                pid: owner.pid, processStartedAt: owner.processStartedAt, processGroupId: owner.processGroupId,
                source: owner.source, executable: owner.executable, script: owner.script, commandHash: owner.commandHash,
            });
            const hash = hashOwner(observed);
            originalChild = observed;
            ownerHash = hash;
        } catch {
            noteError('OWNER_BINDING_ERROR'); fault();
            throw new Error('OWNER_BINDING_ERROR');
        }
    }

    child.once('exit', (code, signal) => { if (!settled) exit = tuple(code, signal); });
    child.on('error', () => { if (!settled) { noteError('CHILD_ERROR'); fault(); } });
    for (const [stream, facts, code] of [
        [child.stdout, stdout, 'STDOUT_ERROR'], [child.stderr, stderr, 'STDERR_ERROR'],
    ] as const) {
        if (!stream) { noteError(code); fault(); continue; }
        stream.once('end', () => { if (!settled) facts.endObserved = true; });
        stream.prependOnceListener('close', () => { if (!settled) facts.closeObserved = true; });
        stream.on('error', () => { if (!settled) { noteError(code); fault(); } });
    }
    child.once('close', (code, signal) => {
        if (settled) return;
        processClose = tuple(code, signal);
        if (originalChild === null) noteError('OWNER_BINDING_ERROR');
        const observedFactsComplete = originalChild !== null && ownerHash !== null
            && exit !== null && processClose !== null
            && exit.code === processClose.code && exit.signal === processClose.signal
            && stdout.endObserved && stdout.closeObserved && stderr.endObserved && stderr.closeObserved
            && errors.size === 0;
        // No late binding, event or publication failure can alter or republish this snapshot.
        settled = true;
        try {
            const record: ControlOriginalWorkerSettlementV1 = Object.freeze({
                schema: 'mission-control.control-original-worker-settlement.v1',
                subject: 'original_fixed_node_worker', ...context, originalChild, ownerHash, exit, processClose,
                stdout: Object.freeze({ ...stdout }), stderr: Object.freeze({ ...stderr }),
                errors: Object.freeze(ERROR_CODES.filter(error => errors.has(error))),
                observedFactsComplete, recordedAtUTC: new Date().toISOString(),
            });
            publish(record);
        } catch { fault(); }
        if (!observedFactsComplete) fault();
    });
    return Object.freeze({ bindOwner, noteError });
}
