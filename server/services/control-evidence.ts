import { constants, openSync, closeSync, fstatSync, lstatSync, readSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { UiRegressionReportV1Schema, UI_ARTIFACT_MAX_BYTES_V1, UI_SCREENSHOT_MAX_BYTES_V1, type UiRegressionReportV1 } from './control-ui-worker-protocol.js';
export const controlHashV1 = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
export function controlCanonicalV1(value: unknown): string {
    if (Array.isArray(value))
        return '[' + value.map(controlCanonicalV1).join(',') + ']';
    if (value && typeof value === 'object')
        return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + controlCanonicalV1((value as Record<string, unknown>)[k])).join(',') + '}';
    return JSON.stringify(value);
}
export function controlBytesV1(value: unknown): Buffer { return Buffer.from(controlCanonicalV1(value) + '\n'); }
export function pinControlDirectoryV1(directory: string): () => void {
    const before = lstatSync(directory, { bigint: true });
    const check = () => {
        const now = lstatSync(directory, { bigint: true });
        if (!now.isDirectory() || now.isSymbolicLink() || now.uid !== BigInt(process.getuid!()) || (now.mode & 4095n) !== 448n
            || realpathSync(directory) !== directory || now.dev !== before.dev || now.ino !== before.ino || now.uid !== before.uid || now.mode !== before.mode)
            throw new Error('CONTROL_STORE_UNSAFE');
    };
    check();
    return check;
}
export function readControlPrivateFileV1(file: string, max: number): Buffer {
    const parent = pinControlDirectoryV1(path.dirname(file));
    const before = lstatSync(file, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || before.uid !== BigInt(process.getuid!())
        || (before.mode & 4095n) !== 384n || before.size > BigInt(max) || realpathSync(file) !== file)
        throw new Error('CONTROL_STORE_UNSAFE');
    const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const pinned = fstatSync(fd, { bigint: true });
        const buffer = Buffer.alloc(Number(before.size) + 1);
        let length = 0;
        while (length < buffer.length) {
            const count = readSync(fd, buffer, length, buffer.length - length, length);
            if (count === 0)
                break;
            length += count;
        }
        const bytes = buffer.subarray(0, length), after = lstatSync(file, { bigint: true });
        for (const key of ['dev', 'ino', 'mode', 'nlink', 'uid', 'gid', 'size', 'mtimeNs', 'ctimeNs'] as const)
            if (pinned[key] !== before[key] || after[key] !== before[key])
                throw new Error('CONTROL_STORE_UNSAFE');
        if (bytes.length !== Number(before.size))
            throw new Error('CONTROL_STORE_UNSAFE');
        parent();
        return bytes;
    }
    finally {
        closeSync(fd);
    }
}
export type ControlAvailabilityV1 = {
    state: 'available' | 'unconfigured' | 'missing' | 'invalid' | 'unsafe';
    code: string | null;
};
export type UiControlEvidenceV1 = {
    availability: ControlAvailabilityV1;
    report: (Omit<UiRegressionReportV1, 'schema'> & {
        hash: string;
        compatibility: 'current' | 'historical';
    }) | null;
};
type UiInput = {
    artifacts: string;
    hash: string | null;
    mcSourceSha: string;
    mcBuildHash: string;
};
function readReport(input: UiInput): UiRegressionReportV1 {
    if (!input.hash || !/^[a-f0-9]{64}$/.test(input.hash))
        throw new Error('CONTROL_UI_ARTIFACT_INVALID');
    const bytes = readControlPrivateFileV1(path.join(input.artifacts, input.hash + '.json'), UI_ARTIFACT_MAX_BYTES_V1);
    if (controlHashV1(bytes) !== input.hash)
        throw new Error('CONTROL_UI_ARTIFACT_INVALID');
    const report = UiRegressionReportV1Schema.parse(JSON.parse(bytes.toString('utf8')));
    if (!bytes.equals(controlBytesV1(report)))
        throw new Error('CONTROL_UI_ARTIFACT_INVALID');
    for (const s of report.screenshots)
        readPng(input.artifacts, s.sha256);
    return report;
}
function readPng(artifacts: string, hash: string): Buffer {
    const bytes = readControlPrivateFileV1(path.join(artifacts, hash + '.png'), UI_SCREENSHOT_MAX_BYTES_V1);
    if (controlHashV1(bytes) !== hash || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
        throw new Error('CONTROL_UI_ARTIFACT_INVALID');
    return bytes;
}
export function readUiControlEvidenceV1(input: UiInput): UiControlEvidenceV1 {
    if (input.hash === null)
        return { availability: { state: 'unconfigured', code: 'UI_REPORT_UNCONFIGURED' }, report: null };
    try {
        const { schema: _, ...report } = readReport(input);
        return { availability: { state: 'available', code: null }, report: { ...report, hash: input.hash!,
                compatibility: report.mcSourceSha === input.mcSourceSha && report.mcBuildHash === input.mcBuildHash ? 'current' : 'historical' } };
    }
    catch (error) {
        const e = error as NodeJS.ErrnoException;
        const state = e.code === 'ENOENT' ? 'missing' : e.message === 'CONTROL_STORE_UNSAFE' ? 'unsafe' : 'invalid';
        return { availability: { state, code: 'UI_REPORT_' + state.toUpperCase() }, report: null };
    }
}
export function readUiControlScreenshotV1(input: UiInput & {
    captureId: string;
}): Buffer {
    const report = readReport(input);
    const capture = report.screenshots.find(s => s.captureId === input.captureId);
    if (!capture)
        throw new Error('CONTROL_SCREENSHOT_NOT_FOUND');
    return readPng(input.artifacts, capture.sha256);
}
export type ControlEvidenceEnvelopeV1<T> = {
    schema: 'mission-control.controls-evidence-envelope.v1';
    selectionHash: string | null;
    evidence: T & {
        ui: UiControlEvidenceV1;
    };
    history: readonly {
        id: string;
        sourceSha: string;
        evidence: T;
    }[];
};
/** New MC HTTP wrapper; the selected SF projection parser owns every SF field. */
export function parseControlEvidenceEnvelopeV1<T>(value: unknown, parseProjection: (value: unknown) => T): ControlEvidenceEnvelopeV1<T> {
    const exact = (v: unknown, keys: string[]) => { if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).sort().join('|') !== keys.sort().join('|'))
        throw new Error('CONTROL_EVIDENCE_INVALID'); return v as Record<string, unknown>; };
    const v = exact(value, ['schema', 'selectionHash', 'evidence', 'history']);
    if (v.schema !== 'mission-control.controls-evidence-envelope.v1' || (v.selectionHash !== null && (typeof v.selectionHash !== 'string' || !/^[a-f0-9]{64}$/.test(v.selectionHash))) || !Array.isArray(v.history) || v.history.length > 50)
        throw new Error('CONTROL_EVIDENCE_INVALID');
    const e = exact(v.evidence, ['activation', 'evaluation', 'ui']);
    const projection = parseProjection({ activation: e.activation, evaluation: e.evaluation });
    const ui = exact(e.ui, ['availability', 'report']), a = exact(ui.availability, ['state', 'code']);
    if (!['available', 'unconfigured', 'missing', 'invalid', 'unsafe'].includes(String(a.state)) || (a.code !== null && (typeof a.code !== 'string' || !/^[A-Za-z0-9_.:-]{1,200}$/.test(a.code))))
        throw new Error('CONTROL_EVIDENCE_INVALID');
    if (ui.report !== null) {
        const r = exact(ui.report, ['mcSourceSha', 'mcBuildHash', 'fixtureVersion', 'fixtureHash', 'startedAt', 'finishedAt', 'outcome', 'assertions', 'screenshots', 'hash', 'compatibility']);
        const { hash, compatibility, ...stored } = r;
        if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash) || !['current', 'historical'].includes(String(compatibility)))
            throw new Error('CONTROL_EVIDENCE_INVALID');
        UiRegressionReportV1Schema.parse({ schema: 'mission-control.ui-regression.v1', ...stored });
    }
    if ((a.state === 'available') !== (ui.report !== null))
        throw new Error('CONTROL_EVIDENCE_INVALID');
    const history = v.history.map(h => { const x = exact(h, ['id', 'sourceSha', 'evidence']); if (typeof x.id !== 'string' || !/^[a-f0-9]{64}$/.test(x.id) || typeof x.sourceSha !== 'string' || !/^[a-f0-9]{40}$/.test(x.sourceSha))
        throw new Error('CONTROL_EVIDENCE_INVALID'); return { id: x.id, sourceSha: x.sourceSha, evidence: parseProjection(x.evidence) }; });
    if (new Set(history.map(h => h.id)).size !== history.length)
        throw new Error('CONTROL_EVIDENCE_INVALID');
    return { schema: 'mission-control.controls-evidence-envelope.v1', selectionHash: v.selectionHash as string | null, evidence: { ...projection, ui: structuredClone(ui) as UiControlEvidenceV1 }, history };
}
export function unavailableControlEvidenceEnvelopeV1() { const missing = { availability: { state: 'unconfigured', code: 'CONTROL_UNAVAILABLE' }, report: null }; return { schema: 'mission-control.controls-evidence-envelope.v1', selectionHash: null, evidence: { activation: missing, evaluation: missing, ui: missing }, history: [] }; }
