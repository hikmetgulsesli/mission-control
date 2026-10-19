/** Private UI fixture ownership. This module never imports SF runtime or SQL. */
import { constants, openSync, closeSync, readFileSync, writeFileSync, fsyncSync, fstatSync, lstatSync, realpathSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { userInfo } from 'node:os';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
export const uiHashV1 = bytes => createHash('sha256').update(bytes).digest('hex');
export function uiCanonicalV1(value) {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return '[' + value.map(uiCanonicalV1).join(',') + ']';
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + uiCanonicalV1(value[key])).join(',') + '}';
}
export const uiBytesV1 = value => Buffer.from(uiCanonicalV1(value) + '\n');
const fail = (code = 'UI_CUSTODY_UNKNOWN') => { throw new Error(code); };
const uid = () => process.getuid();
const stamp = stat => [stat.dev, stat.ino, stat.uid, stat.mode, stat.nlink, stat.size, stat.mtimeMs, stat.ctimeMs].join(':');
export function pinUiDirectoryV1(directory) {
    if (!path.isAbsolute(directory) || path.normalize(directory) !== directory || realpathSync(directory) !== directory)
        fail('UI_PRIVATE_PATH_UNSAFE');
    const initial = lstatSync(directory);
    if (!initial.isDirectory() || initial.isSymbolicLink() || initial.uid !== uid() || (initial.mode & 0o777) !== 0o700)
        fail('UI_PRIVATE_PATH_UNSAFE');
    return () => {
        const now = lstatSync(directory);
        if (!now.isDirectory() || now.isSymbolicLink() || now.dev !== initial.dev || now.ino !== initial.ino || now.uid !== initial.uid || now.mode !== initial.mode || realpathSync(directory) !== directory)
            fail('UI_PRIVATE_PATH_CHANGED');
    };
}
export function pinUiFileV1(file, max = 16777216, privateFile = false) {
    if (realpathSync(file) !== file)
        fail('UI_FILE_UNSAFE');
    const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const before = fstatSync(fd);
        if (!before.isFile() || before.nlink !== 1 || before.size > max || before.uid !== uid() || (before.mode & 0o022) !== 0 || (privateFile && (before.mode & 0o777) !== 0o600))
            fail('UI_FILE_UNSAFE');
        const bytes = readFileSync(fd);
        if (stamp(fstatSync(fd)) !== stamp(before) || stamp(lstatSync(file)) !== stamp(before))
            fail('UI_FILE_CHANGED');
        return Object.freeze({ bytes, hash: uiHashV1(bytes), check() {
                if (realpathSync(file) !== file || stamp(lstatSync(file)) !== stamp(before))
                    fail('UI_FILE_CHANGED');
            } });
    }
    finally {
        closeSync(fd);
    }
}
function syncDir(directory) {
    const fd = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try {
        fsyncSync(fd);
    }
    finally {
        closeSync(fd);
    }
}
export function createUiArtifactStoreV1(root) {
    const rootPin = pinUiDirectoryV1(root);
    const sub = name => {
        const target = path.join(root, name);
        rootPin();
        try {
            mkdirSync(target, { mode: 0o700 });
            syncDir(root);
        }
        catch (error) {
            if (error.code !== 'EEXIST')
                throw error;
        }
        const check = pinUiDirectoryV1(target);
        return { target, check };
    };
    const artifacts = sub('artifacts'), children = sub('children');
    const publish = (file, bytes, cap, repeat = false) => {
        rootPin();
        artifacts.check();
        children.check();
        if (!Buffer.isBuffer(bytes) || bytes.length > cap)
            fail('UI_ARTIFACT_OVERFLOW');
        let fd;
        try {
            fd = openSync(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        }
        catch (error) {
            if (!repeat || error.code !== 'EEXIST')
                throw error;
            const old = pinUiFileV1(file, cap, true);
            if (!old.bytes.equals(bytes))
                fail('UI_ARTIFACT_CONFLICT');
            return uiHashV1(bytes);
        }
        try {
            writeFileSync(fd, bytes);
            fsyncSync(fd);
            if (fstatSync(fd).nlink !== 1)
                fail('UI_ARTIFACT_UNSAFE');
        }
        finally {
            closeSync(fd);
        }
        syncDir(path.dirname(file));
        rootPin();
        artifacts.check();
        children.check();
        return uiHashV1(bytes);
    };
    return Object.freeze({ root,
        json(value) { const bytes = uiBytesV1(value); return publish(path.join(artifacts.target, uiHashV1(bytes) + '.json'), bytes, 1048576, true); },
        png(bytes) {
            if (!Buffer.isBuffer(bytes) || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
                fail('UI_SCREENSHOT_INVALID');
            return publish(path.join(artifacts.target, uiHashV1(bytes) + '.png'), bytes, 16777216, true);
        },
        record(name, value) {
            if (!/^(?:owner\.json|standalone-intent\.json|final-decision\.json|children\/[a-f0-9-]{36}\.(?:intent|observed|settled|closed|not-started)\.json)$/.test(name))
                fail('UI_RECORD_NAME_INVALID');
            return publish(path.join(root, name), uiBytesV1(value), name.endsWith('.settled.json') ? 1048576 : 16384);
        },
        verify() { rootPin(); artifacts.check(); children.check(); },
    });
}
export function cleanUiChildEnvironmentV1({ home, tmp }) {
    if (![home, tmp].every(p => typeof p === 'string' && path.isAbsolute(p) && path.normalize(p) === p && !/[\x00-\x1f]/.test(p)))
        fail('UI_ENV_INVALID');
    return Object.freeze({ HOME: home, TMPDIR: tmp, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', LANG: 'C', LC_ALL: 'C', TZ: 'UTC' });
}
const PS_ENV = Object.freeze({ PATH: '/usr/bin:/bin:/usr/sbin:/sbin', LANG: 'C', LC_ALL: 'C', TZ: 'UTC' });
const DATE = '(\\w{3} \\w{3} +\\d{1,2} \\d{2}:\\d{2}:\\d{2} \\d{4})';
function parseTime(raw) {
    const value = new Date(raw + ' UTC');
    if (!Number.isFinite(value.getTime()))
        fail('UI_OS_OBSERVATION_INVALID');
    return value.toISOString();
}
export function parseUiMetadataSnapshotV1(raw) {
    if (typeof raw !== 'string' || !raw.endsWith('\n') || Buffer.byteLength(raw) > 4194304)
        fail('UI_OS_OBSERVATION_INVALID');
    const lines = raw.slice(0, -1).split('\n');
    if (!lines.length || lines.length > 32768)
        fail('UI_OS_OBSERVATION_INVALID');
    const seen = new Set(), rx = new RegExp('^\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(0|[1-9]\\d*|-[1-9]\\d*)\\s+' + DATE + ' *$');
    return lines.map(line => {
        const m = rx.exec(line);
        if (!m)
            fail('UI_OS_OBSERVATION_INVALID');
        const [pid, ppid, pgid, presentedUid] = m.slice(1, 5).map(Number);
        if (![pid, ppid, pgid, presentedUid].every(Number.isSafeInteger) || presentedUid < -2147483648 || presentedUid > 4294967295 || seen.has(pid))
            fail('UI_OS_OBSERVATION_INVALID');
        const uid = presentedUid < 0 ? presentedUid + 4294967296 : presentedUid;
        seen.add(pid);
        return { pid, ppid, pgid, uid, startedAt: parseTime(m[5]) };
    });
}
export function parseUiCdpEndpointV1(stderr) {
    if (typeof stderr !== 'string' || Buffer.byteLength(stderr) > 1048576 || stderr.split('\n').length > 8192)
        fail('UI_CDP_INVALID');
    const lines = stderr.split('\n').filter(line => line.includes('DevTools listening'));
    if (lines.length !== 1)
        fail('UI_CDP_INVALID');
    const m = /^DevTools listening on (ws:\/\/127\.0\.0\.1:(\d{1,5})\/devtools\/browser\/[a-zA-Z0-9-]{1,128})$/.exec(lines[0]);
    if (!m || Number(m[2]) < 1024 || Number(m[2]) > 65535 || [3080, 3333, 18789, 13081, 13082].includes(Number(m[2])))
        fail('UI_CDP_INVALID');
    return m[1];
}
/** Every observation helper captures its original handle and awaits close; no shell or inherited fd. */
async function ps(args) {
    const child = spawn('/bin/ps', args, { shell: false, env: PS_ENV, stdio: ['ignore', 'pipe', 'pipe'] });
    return await new Promise((resolve, reject) => {
        let stdout = '', stderr = '', fault, exit = false, timer;
        child.on('error', error => { fault = error; });
        child.stdout.on('data', chunk => {
            if (Buffer.byteLength(stdout) + chunk.length > 4194304)
                fault = new Error('UI_OS_OBSERVATION_INVALID');
            else
                stdout += chunk;
        });
        child.stderr.on('data', chunk => {
            if (stderr.length < 4096)
                stderr += chunk;
            fault = new Error('UI_OS_OBSERVATION_INVALID');
        });
        child.once('exit', (code, signal) => { exit = code === 0 && signal === null; });
        child.once('close', () => {
            clearTimeout(timer);
            if (fault || !exit || stderr)
                reject(new Error('UI_OS_OBSERVATION_INVALID'));
            else
                resolve(stdout);
        });
        timer = setTimeout(() => { fault = new Error('UI_OS_OBSERVATION_INVALID'); child.kill('SIGKILL'); }, 2000);
    });
}
export async function observeUiProcessV1(pid, readPs = ps) {
    const args = ['-ww', '-p', String(pid), '-o', 'pid=', '-o', 'ppid=', '-o', 'uid=', '-o', 'lstart=', '-o', 'pgid=', '-o', 'args='];
    const before = await readPs(args), comm = await readPs(['-ww', '-p', String(pid), '-o', 'comm=']), after = await readPs(args);
    const rx = new RegExp('^\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+' + DATE + '\\s+(\\d+)\\s+([^\\r\\n]+)\\n$');
    const match = rx.exec(before), exe = /^([^\r\n]+)\n$/.exec(comm);
    if (before !== after || !match || !exe || Number(match[1]) !== pid || !path.isAbsolute(exe[1]) || realpathSync(exe[1]) !== exe[1])
        fail('UI_OS_OBSERVATION_INVALID');
    return { pid, ppid: Number(match[2]), uid: Number(match[3]), startedAt: parseTime(match[4]), pgid: Number(match[5]), executable: exe[1], rawArgs: match[6] };
}
export async function observeUiNodeOwnerV1(script, argv) {
    const observed = await observeUiProcessV1(process.pid);
    const executable = realpathSync(process.execPath);
    const canonicalCommand = [executable, script, ...argv].join(' ');
    const root = path.dirname(path.dirname(path.dirname(script)));
    const standalone = argv.length === 1 && ['--standalone', '--standalone-assertion-failure', '--standalone-owned-cancel'].includes(argv[0]);
    const npmCommand = standalone && process.argv0 === 'node' && process.cwd() === root && path.relative(root, script) === 'dist-server/scripts/ui-regression.mjs' && observed.rawArgs === ['node', 'dist-server/scripts/ui-regression.mjs', argv[0]].join(' ');
    if (observed.executable !== executable || observed.uid !== uid() || !(observed.rawArgs === canonicalCommand || npmCommand))
        fail('UI_SELF_INVALID');
    return Object.freeze({ pid: process.pid, processStartedAt: observed.startedAt, processGroupId: observed.pgid, source: 'observed_os', executable, script, commandHash: uiHashV1(observed.rawArgs) });
}
export const UI_NATIVE_DESCRIPTOR_V1 = Object.freeze({ playwrightVersion: '1.60.0', family: 'chromium-headless-shell', revision: '1223', browserVersion: '148.0.7778.96', platform: 'darwin', architecture: 'arm64', cacheRelative: 'chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell' });
export function resolveUiNativeDescriptorV1() {
    if (process.platform !== 'darwin' || process.arch !== 'arm64')
        fail('UI_BROWSER_UNAVAILABLE');
    const require = createRequire(import.meta.url), packagePath = realpathSync(require.resolve('playwright-core/package.json'));
    const packagePin = pinUiFileV1(packagePath), packageData = JSON.parse(packagePin.bytes), browsersPin = pinUiFileV1(path.join(path.dirname(packagePath), 'browsers.json'));
    const browser = JSON.parse(browsersPin.bytes).browsers.find(b => b.name === UI_NATIVE_DESCRIPTOR_V1.family);
    if (packageData.version !== '1.60.0' || browser?.revision !== '1223' || browser?.browserVersion !== '148.0.7778.96')
        fail('UI_BROWSER_UNAVAILABLE');
    const cache = path.join(userInfo().homedir, 'Library', 'Caches', 'ms-playwright');
    const executable = path.join(cache, UI_NATIVE_DESCRIPTOR_V1.cacheRelative), bundle = path.dirname(executable), pins = [];
    if (realpathSync(bundle) !== bundle)
        fail('UI_BROWSER_UNAVAILABLE');
    const visit = directory => {
        for (const item of readdirSync(directory, { withFileTypes: true })) {
            const file = path.join(directory, item.name);
            if (item.isDirectory()) {
                if (realpathSync(file) !== file || (lstatSync(file).mode & 0o022))
                    fail('UI_BROWSER_UNAVAILABLE');
                visit(file);
            }
            else if (item.isFile())
                pins.push(pinUiFileV1(file, 536870912));
            else
                fail('UI_BROWSER_UNAVAILABLE');
        }
    };
    visit(bundle);
    const executablePin = pinUiFileV1(executable, 536870912);
    if (!(lstatSync(executable).mode & 0o100))
        fail('UI_BROWSER_UNAVAILABLE');
    return Object.freeze({ ...UI_NATIVE_DESCRIPTOR_V1, executable, executableHash: executablePin.hash, browsersJsonHash: browsersPin.hash,
        check() { packagePin.check(); browsersPin.check(); executablePin.check(); pins.forEach(pin => pin.check()); } });
}
/** Effects are private component seams. The fixed built entry always uses real defaults. */
export function createUiNativeLifecycleV1(input, effects = {}) {
    const { store, jobId, intentHash, ownerHash, owner, cancellationRequested } = input;
    const clock = effects.clock ?? Date.now, sleep = effects.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
    const readPs = effects.ps ?? ps, launchProcess = effects.spawn ?? spawn;
    const connect = effects.connectOverCDP ?? (async (url) => { const { chromium } = await import('playwright-core'); return chromium.connectOverCDP(url, { timeout: 10000 }); });
    const descriptor = input.descriptor ?? resolveUiNativeDescriptorV1();
    let attempted = false, invoked = false, durableIntent = false, durableNeverInvoked = false, publicationUncertain = false, child, browser, spawnId, launchIntentHash, observedHash, rootOwner;
    let endpoint = null, endpointFault = false, stderrOffset = 0;
    let rootExit, exitObserved = false, closeObserved = false, streamFault = false, stdout = '', stderr = '', unknown = false, transportClosed = false;
    let resolveExit, resolveClose;
    const exitPromise = new Promise(resolve => { resolveExit = resolve; }), closePromise = new Promise(resolve => { resolveClose = resolve; });
    const cohort = new Map();
    let initialContexts = new Set(), lastSuccessfulCensus = null, observation = null;
    const base = { jobId, intentHash };
    const record = (name, value) => {
        try {
            const parsed = input.recordSchema ? input.recordSchema.parse(value) : value;
            return store.record(name, parsed);
        }
        catch (error) {
            publicationUncertain = true;
            unknown = true;
            throw error;
        }
    };
    const neverInvoked = () => {
        if (invoked || !durableIntent || publicationUncertain || durableNeverInvoked)
            fail('UI_CLEANUP_UNKNOWN');
        record(`children/${spawnId}.not-started.json`, { schema: 'mission-control.ui-worker-child-not-started.v1', ...base, spawnId, launchIntentHash, disposition: 'never_invoked' });
        durableNeverInvoked = true;
    };
    const inspectEndpointLines = () => {
        let end;
        while ((end = stderr.indexOf('\n', stderrOffset)) !== -1) {
            const line = stderr.slice(stderrOffset, end);
            stderrOffset = end + 1;
            if (!line.includes('DevTools listening'))
                continue;
            try {
                const observed = parseUiCdpEndpointV1(line + '\n');
                if (endpoint !== null)
                    fail('UI_CDP_INVALID');
                endpoint = observed;
            }
            catch {
                endpointFault = true;
                unknown = true;
            }
        }
    };
    const snapshot = async () => {
        observation = { operation: 'snapshot', pid: null };
        const raw = await readPs(['-ww', '-A', '-o', 'pid=', '-o', 'ppid=', '-o', 'pgid=', '-o', 'uid=', '-o', 'lstart=']);
        const result = { rows: parseUiMetadataSnapshotV1(raw), capturedAt: new Date(clock()).toISOString(), metadataHash: uiHashV1(raw) };
        lastSuccessfulCensus = { capturedAt: result.capturedAt, metadataHash: result.metadataHash, rowCount: result.rows.length };
        return result;
    };
    const native = p => ({ kind: 'native_browser', pid: p.pid, processStartedAt: p.startedAt, processGroupId: p.pgid, source: 'observed_os', executable: p.executable, commandHash: uiHashV1(p.rawArgs) });
    const observe = async (pid) => { observation = { operation: 'observe', pid }; return observeUiProcessV1(pid, readPs); };
    const retain = p => {
        if (p.uid !== uid() || p.executable !== descriptor.executable || p.pgid !== rootOwner.processGroupId)
            fail('UI_COHORT_UNKNOWN');
        const existing = cohort.get(p.pid), next = native(p);
        if (existing && uiCanonicalV1(existing.owner) !== uiCanonicalV1(next))
            fail('UI_COHORT_IDENTITY_CHANGED');
        if (!existing)
            cohort.set(p.pid, { owner: next, parentPidAtFirstObservation: p.ppid, finalState: 'absent_after_owned_close' });
        if (cohort.size > 256)
            fail('UI_COHORT_OVERFLOW');
    };
    const inspect = async () => {
        const census = await snapshot();
        if (!rootOwner)
            return census;
        const candidates = new Set([...cohort.keys(), rootOwner.pid]);
        for (let changed = true; changed;) {
            changed = false;
            for (const row of census.rows)
                if (row.pgid === rootOwner.processGroupId || candidates.has(row.ppid)) {
                    if (!candidates.has(row.pid)) {
                        candidates.add(row.pid);
                        changed = true;
                    }
                }
        }
        for (const row of census.rows)
            if (candidates.has(row.pid)) {
                const p = await observe(row.pid);
                if (p.startedAt !== row.startedAt || p.pgid !== row.pgid || p.uid !== row.uid)
                    fail('UI_COHORT_UNKNOWN');
                retain(p);
            }
        return census;
    };
    const bounded = async (operation, deadline) => {
        const ms = deadline - clock();
        if (ms <= 0)
            fail('UI_CLEANUP_UNKNOWN');
        let timer;
        try {
            return await Promise.race([operation, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('UI_CLEANUP_UNKNOWN')), ms); })]);
        }
        finally {
            clearTimeout(timer);
        }
    };
    return Object.freeze({
        async launch() {
            if (attempted)
                fail('UI_LAUNCH_ALREADY_ATTEMPTED');
            attempted = true;
            if (cancellationRequested())
                return null;
            const pre = await snapshot();
            const directories = {};
            for (const name of ['home', 'profile', 'tmp']) {
                const directory = path.join(store.root, name);
                mkdirSync(directory, { mode: 0o700 });
                pinUiDirectoryV1(directory)();
                directories[name] = directory;
            }
            const argv = Object.freeze(['--headless', '--user-data-dir=' + directories.profile, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-extensions', '--disable-component-update', '--disable-sync', '--metrics-recording-only', '--disable-default-apps', '--disable-features=MediaRouter,OptimizationHints,Translate', '--use-mock-keychain', '--password-store=basic', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', 'about:blank']);
            spawnId = randomUUID();
            try {
                launchIntentHash = record(`children/${spawnId}.intent.json`, { schema: 'mission-control.ui-worker-child-intent.v1', ...base, ownerHash, spawnId, kind: 'chromium', family: 'chromium-headless-shell', expectedExecutable: descriptor.executable, executableHash: descriptor.executableHash, playwrightVersion: descriptor.playwrightVersion, browsersJsonHash: descriptor.browsersJsonHash, launchArgsHash: uiHashV1(uiCanonicalV1(argv)) });
                durableIntent = true;
                if (cancellationRequested()) {
                    neverInvoked();
                    return null;
                }
                descriptor.check();
            }
            catch (error) {
                if (durableIntent && !publicationUncertain && !durableNeverInvoked)
                    neverInvoked();
                throw error;
            }
            invoked = true;
            try {
                child = launchProcess(descriptor.executable, argv, { detached: true, shell: false, cwd: directories.home, env: cleanUiChildEnvironmentV1({ home: directories.home, tmp: directories.tmp }), stdio: ['ignore', 'pipe', 'pipe'] });
                child.on('error', () => { unknown = true; });
                child.once('exit', (code, signal) => { rootExit = { code, signal }; exitObserved = true; resolveExit(); });
                child.once('close', () => { closeObserved = true; resolveClose(); });
                const capture = stream => chunk => {
                    if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) + chunk.length > 1048576 || stderr.split('\n').length > 8192) {
                        streamFault = true;
                        return;
                    }
                    if (stream === 'out')
                        stdout += chunk;
                    else {
                        stderr += chunk;
                        if (stderr.split('\n').length > 8192)
                            streamFault = true;
                        inspectEndpointLines();
                    }
                };
                child.stdout.on('data', capture('out'));
                child.stderr.on('data', capture('err'));
                if (!Number.isSafeInteger(child.pid) || child.pid <= 0)
                    fail('UI_CUSTODY_UNKNOWN');
                const p = await observe(child.pid);
                if (p.ppid !== owner.pid || p.uid !== uid() || p.pgid !== p.pid || p.pgid === owner.processGroupId || pre.rows.some(row => row.pgid === p.pgid) || p.executable !== descriptor.executable || p.rawArgs !== [descriptor.executable, ...argv].join(' '))
                    fail('UI_CUSTODY_UNKNOWN');
                rootOwner = native(p);
                retain(p);
                observedHash = record(`children/${spawnId}.observed.json`, { schema: 'mission-control.ui-worker-child-observed.v1', ...base, spawnId, launchIntentHash, owner: rootOwner, parentPid: p.ppid });
                await inspect();
                const deadline = clock() + 10000;
                while (endpoint === null && clock() < deadline && !exitObserved && !streamFault && !endpointFault)
                    await sleep(10);
                if (streamFault || endpointFault || exitObserved || endpoint === null)
                    fail('UI_CDP_INVALID');
                browser = await connect(endpoint);
                initialContexts = new Set(browser.contexts());
                browser.once('disconnected', () => { transportClosed = true; });
                descriptor.check();
                return browser;
            }
            catch (error) {
                unknown = true;
                throw error;
            }
        },
        async census() {
            try {
                if (streamFault)
                    fail('UI_BROWSER_OUTPUT_OVERFLOW');
                if (endpointFault)
                    fail('UI_CDP_INVALID');
                return await inspect();
            }
            catch (error) {
                unknown = true;
                throw error;
            }
        },
        async close() {
            if (!invoked) {
                if (publicationUncertain || (spawnId && (!durableIntent || !durableNeverInvoked)))
                    fail('UI_CLEANUP_UNKNOWN');
                return { browser: 'not_started', children: spawnId ? [{ spawnId, owner: null, state: 'not_started' }] : [] };
            }
            const deadline = clock() + 30000;
            let phase = 'ownership_precondition';
            try {
                if (!child || !rootOwner || !observedHash || !browser)
                    fail('UI_CLEANUP_UNKNOWN');
                phase = 'pre_close_census';
                await bounded(inspect(), deadline);
                phase = 'context_close';
                for (const context of browser.contexts())
                    if (!initialContexts.has(context))
                        await bounded(context.close(), deadline);
                phase = 'cdp_session';
                const session = await bounded(browser.newBrowserCDPSession(), deadline);
                try {
                    phase = 'native_close';
                    await bounded(session.send('Browser.close'), deadline);
                }
                catch (error) {
                    if (!/Target page, context or browser has been closed|Target closed|Browser closed|Connection closed/i.test(String(error?.message)))
                        throw error;
                }
                phase = 'client_close';
                await bounded(browser.close(), deadline);
                phase = 'original_exit_close';
                await bounded(Promise.all([exitPromise, closePromise]), deadline);
                phase = 'settlement_guards';
                if (!browser.isConnected())
                    transportClosed = true;
                if (!exitObserved || !closeObserved || !transportClosed || streamFault || endpointFault || stderr.slice(stderrOffset).includes('DevTools listening') || unknown)
                    fail('UI_CLEANUP_UNKNOWN');
                const empty = [];
                phase = 'post_close_census';
                while (empty.length < 2) {
                    if (clock() >= deadline)
                        fail('UI_CLEANUP_UNKNOWN');
                    const snap = await bounded(inspect(), deadline);
                    const groups = snap.rows.filter(row => row.pgid === rootOwner.processGroupId), retained = snap.rows.filter(row => cohort.has(row.pid));
                    if (groups.length || retained.length) {
                        empty.length = 0;
                        await sleep(100);
                        continue;
                    }
                    empty.push({ capturedAt: snap.capturedAt, metadataHash: snap.metadataHash, groupMemberCount: 0, retainedOwnerCount: 0 });
                    if (empty.length === 1)
                        await sleep(100);
                }
                phase = 'settlement_guards';
                if (streamFault || endpointFault || publicationUncertain || unknown)
                    fail('UI_CLEANUP_UNKNOWN');
                phase = 'settlement_publish';
                const settlementHash = record(`children/${spawnId}.settled.json`, { schema: 'mission-control.ui-worker-child-settled.v1', ...base, spawnId, observedHash, method: 'owned-child-process-group-v1', rootExit, rootExitObserved: true, rootCloseObserved: true, transport: 'closed', cohort: [...cohort.values()].sort((a, b) => a.owner.pid - b.owner.pid || a.owner.processStartedAt.localeCompare(b.owner.processStartedAt) || a.owner.commandHash.localeCompare(b.owner.commandHash)), emptyCensuses: empty });
                phase = 'closed_publish';
                record(`children/${spawnId}.closed.json`, { schema: 'mission-control.ui-worker-child-closed.v1', ...base, spawnId, observedHash, settlementHash, close: 'confirmed' });
                return { browser: 'closed', children: [{ spawnId, owner: rootOwner, state: 'closed' }] };
            }
            catch (error) {
                unknown = true;
                // Diagnostic only: no new observation, close attempt, or settlement authority.
                let line;
                try {
                    const knownCodes = ['UI_OS_OBSERVATION_INVALID', 'UI_COHORT_UNKNOWN', 'UI_COHORT_IDENTITY_CHANGED', 'UI_COHORT_OVERFLOW', 'UI_CLEANUP_UNKNOWN', 'UI_PRIVATE_PATH_UNSAFE', 'UI_PRIVATE_PATH_CHANGED', 'UI_FILE_UNSAFE', 'UI_FILE_CHANGED', 'UI_ARTIFACT_OVERFLOW', 'UI_ARTIFACT_CONFLICT', 'UI_ARTIFACT_UNSAFE', 'UI_RECORD_NAME_INVALID'];
                    const at = clock();
                    const diagnosticHash = store.json({ schema: 'mission-control.ui-native-close-diagnostic.v1', ...base, ownerHash, spawnId: spawnId ?? null, launchIntentHash: launchIntentHash ?? null, observedHash: observedHash ?? null,
                        phase, errorCode: knownCodes.includes(error?.message) ? error.message : 'UI_NATIVE_OPERATION_FAILED', capturedAt: new Date(at).toISOString(), deadline, elapsedMs: at - (deadline - 30000),
                        rootOwner: rootOwner ?? null, cohortCount: cohort.size, rootExitObserved: exitObserved, rootCloseObserved: closeObserved, transportClosed, streamFault, endpointFault, publicationUncertain, unknown, observation, lastSuccessfulCensus });
                    line = { code: 'UI_NATIVE_CLOSE_FAILED', diagnosticHash };
                }
                catch {
                    line = { code: 'UI_NATIVE_CLOSE_DIAGNOSTIC_PUBLICATION_FAILED' };
                }
                try { process.stderr.write(JSON.stringify(line) + '\n'); } catch { /* The original refusal remains authoritative. */ }
                throw error;
            }
        },
    });
}
