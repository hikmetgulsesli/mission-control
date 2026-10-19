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
export type UiNativeBrowserOwnerV1 = Readonly<{
    kind: 'native_browser';
    pid: number;
    processStartedAt: string;
    processGroupId: number;
    source: 'observed_os';
    executable: string;
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
        owner: UiNativeBrowserOwnerV1 | null;
        state: 'not_started' | 'closed';
    }[];
}>;
function fail(): never { throw new Error('CONTROL_UI_ARTIFACT_INVALID'); }
function obj(v: unknown, keys: readonly string[]): Record<string, unknown> {
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).sort().join('|') !== [...keys].sort().join('|'))
        fail();
    return v as Record<string, unknown>;
}
function str(v: unknown, pattern: RegExp, max = 200): asserts v is string {
    if (typeof v !== 'string' || v.length > max || !pattern.test(v))
        fail();
}
const hash = (v: unknown) => str(v, /^[a-f0-9]{64}$/), source = (v: unknown) => str(v, /^[a-f0-9]{40}$/);
const id = (v: unknown) => str(v, /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const uuid = (v: unknown) => str(v, /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
function time(v: unknown) {
    if (typeof v !== 'string' || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString() !== v)
        fail();
}
function count(v: unknown, max: number) {
    if (!Number.isSafeInteger(v) || Number(v) < 0 || Number(v) > max)
        fail();
}
function one(v: unknown, values: readonly unknown[]) {
    if (!values.includes(v))
        fail();
}
function rows(v: unknown, max: number): unknown[] {
    if (!Array.isArray(v) || v.length > max)
        fail();
    return v;
}
function unique(values: unknown[]) {
    if (new Set(values).size !== values.length)
        fail();
}
function bounded(v: unknown) {
    if (new TextEncoder().encode(JSON.stringify(v)).length > UI_ARTIFACT_MAX_BYTES_V1)
        fail();
}
function owner(v: unknown) {
    const o = obj(v, ['kind', 'pid', 'processStartedAt', 'processGroupId', 'source', 'executable', 'commandHash']);
    one(o.kind, ['native_browser']);
    count(o.pid, Number.MAX_SAFE_INTEGER);
    count(o.processGroupId, Number.MAX_SAFE_INTEGER);
    if (!o.pid || !o.processGroupId)
        fail();
    time(o.processStartedAt);
    one(o.source, ['observed_os']);
    hash(o.commandHash);
    for (const k of ['executable']) {
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
        const closed = children.filter(c => (c as {
            state: string;
        }).state === 'closed');
        if (v.browser === 'closed' && v.server !== 'closed')
            fail();
        if (children.length > 1 || (v.browser === 'closed' ? closed.length !== 1 : closed.length !== 0))
            fail();
        for (const c of closed) {
            const native = (c as {
                owner: UiNativeBrowserOwnerV1;
            }).owner;
            if (native.pid !== native.processGroupId)
                fail();
        }
        unique(children.map(c => (c as {
            spawnId: string;
        }).spawnId));
        return structuredClone(value) as UiRegressionCleanupProofV1;
    } });
/** Strict private audit records; validation alone is never an OS observation or custody grant. */
export const UiNativeBrowserOwnerV1Schema = Object.freeze({ parse(value: unknown): UiNativeBrowserOwnerV1 { owner(value); return structuredClone(value) as UiNativeBrowserOwnerV1; } });
export const UiWorkerLifecycleRecordV1Schema = Object.freeze({ parse(value: unknown): Readonly<Record<string, unknown>> {
        bounded(value);
        if (!value || typeof value !== 'object' || Array.isArray(value))
            fail();
        const schema = (value as Record<string, unknown>).schema;
        const base = ['schema', 'jobId', 'intentHash'];
        const keys: Record<string, string[]> = {
            'mission-control.ui-worker-owner.v1': ['ownerHash', 'mcSourceSha', 'mcBuildHash', 'fixtureVersion', 'fixtureHash'],
            'mission-control.ui-worker-child-intent.v1': ['ownerHash', 'spawnId', 'kind', 'family', 'expectedExecutable', 'executableHash', 'playwrightVersion', 'browsersJsonHash', 'launchArgsHash'],
            'mission-control.ui-worker-child-observed.v1': ['spawnId', 'launchIntentHash', 'owner', 'parentPid'],
            'mission-control.ui-worker-child-settled.v1': ['spawnId', 'observedHash', 'method', 'rootExit', 'rootExitObserved', 'rootCloseObserved', 'transport', 'cohort', 'emptyCensuses'],
            'mission-control.ui-worker-child-closed.v1': ['spawnId', 'observedHash', 'settlementHash', 'close'],
            'mission-control.ui-worker-child-not-started.v1': ['spawnId', 'launchIntentHash', 'disposition'],
        };
        if (typeof schema !== 'string' || !Object.hasOwn(keys, schema))
            fail();
        if (!schema.endsWith('settled.v1') && new TextEncoder().encode(JSON.stringify(value)).length > 16384)
            fail();
        const v = obj(value, [...base, ...keys[schema]]);
        uuid(v.jobId);
        hash(v.intentHash);
        for (const key of ['ownerHash', 'mcBuildHash', 'fixtureHash', 'executableHash', 'browsersJsonHash', 'launchArgsHash', 'launchIntentHash', 'observedHash', 'settlementHash'])
            if (key in v)
                hash(v[key]);
        if ('spawnId' in v)
            uuid(v.spawnId);
        if (schema === 'mission-control.ui-worker-owner.v1') {
            source(v.mcSourceSha);
            id(v.fixtureVersion);
        }
        if (schema === 'mission-control.ui-worker-child-intent.v1') {
            one(v.kind, ['chromium']);
            one(v.family, ['chromium-headless-shell']);
            one(v.playwrightVersion, ['1.60.0']);
            str(v.expectedExecutable, /^\/[^\u0000-\u001f\u007f]+$/, 4096);
            if (path.normalize(String(v.expectedExecutable)) !== v.expectedExecutable)
                fail();
        }
        if (schema === 'mission-control.ui-worker-child-observed.v1') {
            owner(v.owner);
            count(v.parentPid, Number.MAX_SAFE_INTEGER);
            const o = v.owner as UiNativeBrowserOwnerV1;
            if (!v.parentPid || o.pid !== o.processGroupId || o.pid === v.parentPid)
                fail();
        }
        if (schema === 'mission-control.ui-worker-child-not-started.v1')
            one(v.disposition, ['never_invoked']);
        if (schema === 'mission-control.ui-worker-child-closed.v1')
            one(v.close, ['confirmed']);
        if (schema === 'mission-control.ui-worker-child-settled.v1') {
            one(v.method, ['owned-child-process-group-v1']);
            one(v.rootExitObserved, [true]);
            one(v.rootCloseObserved, [true]);
            one(v.transport, ['closed']);
            const exit = obj(v.rootExit, ['code', 'signal']);
            if (exit.code !== null) {
                if (!Number.isSafeInteger(exit.code))
                    fail();
            }
            one(exit.signal, [null, 'SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT', 'SIGBUS', 'SIGFPE', 'SIGKILL', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGPIPE', 'SIGALRM', 'SIGTERM', 'SIGCHLD', 'SIGCONT', 'SIGSTOP', 'SIGTSTP', 'SIGTTIN', 'SIGTTOU', 'SIGURG', 'SIGXCPU', 'SIGXFSZ', 'SIGVTALRM', 'SIGPROF', 'SIGWINCH', 'SIGIO', 'SIGSYS']);
            if (exit.code === null && exit.signal === null)
                fail();
            const cohort = rows(v.cohort, 256);
            if (!cohort.length)
                fail();
            let previous: UiNativeBrowserOwnerV1 | undefined;
            const ids: number[] = [];
            for (const row of cohort) {
                const c = obj(row, ['owner', 'parentPidAtFirstObservation', 'finalState']);
                owner(c.owner);
                const o = c.owner as UiNativeBrowserOwnerV1;
                count(c.parentPidAtFirstObservation, Number.MAX_SAFE_INTEGER);
                one(c.finalState, ['absent_after_owned_close']);
                ids.push(o.pid);
                if (previous && (previous.pid > o.pid || previous.pid === o.pid && (previous.processStartedAt > o.processStartedAt || previous.processStartedAt === o.processStartedAt && previous.commandHash >= o.commandHash)))
                    fail();
                previous = o;
            }
            unique(ids);
            const owners = cohort.map(c => (c as {
                owner: UiNativeBrowserOwnerV1;
            }).owner);
            if (owners.filter(o => o.pid === o.processGroupId).length !== 1 || new Set(owners.map(o => o.processGroupId)).size !== 1)
                fail();
            const censuses = rows(v.emptyCensuses, 2);
            if (censuses.length !== 2)
                fail();
            for (const row of censuses) {
                const c = obj(row, ['capturedAt', 'metadataHash', 'groupMemberCount', 'retainedOwnerCount']);
                time(c.capturedAt);
                hash(c.metadataHash);
                one(c.groupMemberCount, [0]);
                one(c.retainedOwnerCount, [0]);
            }
            if (Date.parse(String((censuses[1] as Record<string, unknown>).capturedAt)) - Date.parse(String((censuses[0] as Record<string, unknown>).capturedAt)) < 100)
                fail();
        }
        return structuredClone(value) as Readonly<Record<string, unknown>>;
    } });
export const UiStandaloneIntentV1Schema = Object.freeze({ parse(value: unknown): Readonly<Record<string, unknown>> {
        const v = obj(value, ['schema', 'mode', 'scenario', 'jobId', 'ownerHash', 'mcSourceSha', 'mcBuildHash', 'fixtureVersion', 'fixtureHash', 'requestedAt']);
        if (new TextEncoder().encode(JSON.stringify(value)).length > 16384)
            fail();
        one(v.schema, ['mission-control.ui-standalone-intent.v1']);
        one(v.mode, ['standalone']);
        one(v.scenario, ['pass', 'assertion_failure', 'owned_cancel']);
        uuid(v.jobId);
        hash(v.ownerHash);
        source(v.mcSourceSha);
        hash(v.mcBuildHash);
        id(v.fixtureVersion);
        hash(v.fixtureHash);
        time(v.requestedAt);
        return structuredClone(value) as Readonly<Record<string, unknown>>;
    } });
