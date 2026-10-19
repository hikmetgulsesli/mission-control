import path from 'node:path';
/** Pure MC-owned data validators. No selected runtime, SQL, process or filesystem imports. */
export const UI_ARTIFACT_MAX_BYTES_V1 = 1048576;
export const UI_SCREENSHOT_MAX_BYTES_V1 = 16777216;
export type UiRegressionReportV1 = Readonly<{
    schema: 'mission-control.ui-regression.v1';
    mcSourceSha: string;
    mcBuildHash: string;
    fixtureVersion: string;
    fixtureHash: string;
    startedAt: string;
    finishedAt: string | null;
    outcome: 'pass' | 'fail' | 'incomplete';
    assertions: readonly {
        id: string;
        status: 'pass' | 'fail';
        code: string | null;
    }[];
    screenshots: readonly {
        captureId: string;
        route: string;
        viewport: {
            width: number;
            height: number;
        };
        sha256: string;
    }[];
}>;
export type UiObservedOwnerV1 = Readonly<{
    pid: number;
    processStartedAt: string;
    processGroupId: number;
    source: 'observed_os';
    executable: string;
    script: string;
    commandHash: string;
}>;
export type UiRegressionCleanupProofV1 = Readonly<{
    schema: 'mission-control.ui-regression-cleanup.v1';
    jobId: string;
    intentHash: string;
    ownerHash: string;
    mcSourceSha: string;
    mcBuildHash: string;
    fixtureHash: string;
    uiReportHash: string;
    server: 'not_started' | 'closed';
    browser: 'not_started' | 'closed';
    children: readonly {
        spawnId: string;
        owner: UiObservedOwnerV1 | null;
        state: 'not_started' | 'closed';
    }[];
}>;
function fail(): never { throw new Error('CONTROL_UI_ARTIFACT_INVALID'); }
function obj(v: unknown, keys: readonly string[]): Record<string, unknown> {
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).sort().join('|') !== [...keys].sort().join('|'))
        fail();
    return v as Record<string, unknown>;
}
function str(v: unknown, pattern: RegExp, max = 200): asserts v is string { if (typeof v !== 'string' || v.length > max || !pattern.test(v))
    fail(); }
const hash = (v: unknown) => str(v, /^[a-f0-9]{64}$/), source = (v: unknown) => str(v, /^[a-f0-9]{40}$/);
const id = (v: unknown) => str(v, /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const uuid = (v: unknown) => str(v, /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
function time(v: unknown) { if (typeof v !== 'string' || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString() !== v)
    fail(); }
function count(v: unknown, max: number) { if (!Number.isSafeInteger(v) || Number(v) < 0 || Number(v) > max)
    fail(); }
function one(v: unknown, values: readonly unknown[]) { if (!values.includes(v))
    fail(); }
function rows(v: unknown, max: number): unknown[] { if (!Array.isArray(v) || v.length > max)
    fail(); return v; }
function unique(values: unknown[]) { if (new Set(values).size !== values.length)
    fail(); }
function bounded(v: unknown) { if (new TextEncoder().encode(JSON.stringify(v)).length > UI_ARTIFACT_MAX_BYTES_V1)
    fail(); }
function owner(v: unknown) {
    const o = obj(v, ['pid', 'processStartedAt', 'processGroupId', 'source', 'executable', 'script', 'commandHash']);
    count(o.pid, Number.MAX_SAFE_INTEGER);
    count(o.processGroupId, Number.MAX_SAFE_INTEGER);
    if (!o.pid || !o.processGroupId)
        fail();
    time(o.processStartedAt);
    one(o.source, ['observed_os']);
    hash(o.commandHash);
    for (const k of ['executable', 'script']) {
        str(o[k], /^\/[^\u0000-\u001f\u007f]+$/, 4096);
        if (path.normalize(o[k] as string) !== o[k])
            fail();
    }
}
export const UiRegressionReportV1Schema = Object.freeze({ parse(value: unknown): UiRegressionReportV1 {
        bounded(value);
        const v = obj(value, ['schema', 'mcSourceSha', 'mcBuildHash', 'fixtureVersion', 'fixtureHash', 'startedAt', 'finishedAt', 'outcome', 'assertions', 'screenshots']);
        one(v.schema, ['mission-control.ui-regression.v1']);
        source(v.mcSourceSha);
        hash(v.mcBuildHash);
        id(v.fixtureVersion);
        hash(v.fixtureHash);
        time(v.startedAt);
        if (v.finishedAt !== null) {
            time(v.finishedAt);
            if (String(v.finishedAt) < String(v.startedAt))
                fail();
        }
        one(v.outcome, ['pass', 'fail', 'incomplete']);
        const assertions = rows(v.assertions, 2048);
        for (const a of assertions) {
            const x = obj(a, ['id', 'status', 'code']);
            id(x.id);
            one(x.status, ['pass', 'fail']);
            if (x.code !== null)
                id(x.code);
        }
        unique(assertions.map(a => (a as {
            id: string;
        }).id));
        if (v.outcome === 'pass' && (v.finishedAt === null || assertions.length === 0 || assertions.some(a => (a as {
            status: string;
        }).status !== 'pass')))
            fail();
        const screenshots = rows(v.screenshots, 512);
        for (const s of screenshots) {
            const x = obj(s, ['captureId', 'route', 'viewport', 'sha256']);
            id(x.captureId);
            hash(x.sha256);
            str(x.route, /^\/(?!\/)[A-Za-z0-9_/-]*$/, 512);
            const p = obj(x.viewport, ['width', 'height']);
            count(p.width, 10000);
            count(p.height, 10000);
            if (!p.width || !p.height)
                fail();
        }
        unique(screenshots.map(s => (s as {
            captureId: string;
        }).captureId));
        return structuredClone(value) as UiRegressionReportV1;
    } });
export const UiRegressionCleanupProofV1Schema = Object.freeze({ parse(value: unknown): UiRegressionCleanupProofV1 {
        bounded(value);
        const v = obj(value, ['schema', 'jobId', 'intentHash', 'ownerHash', 'mcSourceSha', 'mcBuildHash', 'fixtureHash', 'uiReportHash', 'server', 'browser', 'children']);
        one(v.schema, ['mission-control.ui-regression-cleanup.v1']);
        uuid(v.jobId);
        source(v.mcSourceSha);
        for (const k of ['intentHash', 'ownerHash', 'mcBuildHash', 'fixtureHash', 'uiReportHash'])
            hash(v[k]);
        one(v.server, ['not_started', 'closed']);
        one(v.browser, ['not_started', 'closed']);
        const children = rows(v.children, 256);
        for (const c of children) {
            const x = obj(c, ['spawnId', 'owner', 'state']);
            uuid(x.spawnId);
            one(x.state, ['not_started', 'closed']);
            if (x.state === 'not_started') {
                if (x.owner !== null)
                    fail();
            }
            else
                owner(x.owner);
        }
        unique(children.map(c => (c as {
            spawnId: string;
        }).spawnId));
        return structuredClone(value) as UiRegressionCleanupProofV1;
    } });
