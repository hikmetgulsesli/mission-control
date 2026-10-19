import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, statSync, realpathSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
const load = () => import('../scripts/ui-regression-lifecycle.mjs');
test('native environment is constructed from private directories, never inherited credentials or loaders', async () => {
    const { cleanUiChildEnvironmentV1 } = await load();
    const old = process.env.NODE_OPTIONS;
    process.env.NODE_OPTIONS = '--inspect';
    try {
        const env = cleanUiChildEnvironmentV1({ home: '/private/home', tmp: '/private/tmp' });
        assert.deepEqual(env, { HOME: '/private/home', TMPDIR: '/private/tmp', PATH: '/usr/bin:/bin:/usr/sbin:/sbin', LANG: 'C', LC_ALL: 'C', TZ: 'UTC' });
    }
    finally {
        if (old === undefined)
            delete process.env.NODE_OPTIONS;
        else
            process.env.NODE_OPTIONS = old;
    }
});
test('immutable lifecycle publication retains canonical bytes and refuses overwrite, symlinks and unsafe parent modes', async () => {
    const { createUiArtifactStoreV1 } = await load();
    const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'ui-lifecycle-contract-')));
    try {
        const store = createUiArtifactStoreV1(root);
        const hash = store.json({ z: 1, a: 'one' });
        const expected = Buffer.from('{"a":"one","z":1}\n');
        assert.equal(hash, createHash('sha256').update(expected).digest('hex'));
        assert.deepEqual(readFileSync(path.join(root, 'artifacts', hash + '.json')), expected);
        assert.equal(statSync(path.join(root, 'artifacts', hash + '.json')).mode & 0o777, 0o600);
        assert.equal(store.json({ a: 'one', z: 1 }), hash);
        store.record('owner.json', { a: 1 });
        assert.throws(() => store.record('owner.json', { a: 2 }));
        assert.throws(() => store.record('../escape', { a: 3 }));
        mkdirSync(path.join(root, 'unsafe'), { mode: 0o755 });
        assert.throws(() => createUiArtifactStoreV1(path.join(root, 'unsafe')));
        symlinkSync(root, path.join(root, 'alias'));
        assert.throws(() => createUiArtifactStoreV1(path.join(root, 'alias')));
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
});
test('complete OS census parser rejects partial, malformed, duplicate and over-limit observations', async () => {
    const { parseUiMetadataSnapshotV1 } = await load();
    const line = '  42  1  42  501 Mon Oct 19 10:00:00 2026\n';
    assert.deepEqual(parseUiMetadataSnapshotV1(line), [{ pid: 42, ppid: 1, pgid: 42, uid: 501, startedAt: '2026-10-19T10:00:00.000Z' }]);
    for (const bad of ['', line.trimEnd(), line + line, line + 'garbage\n', line.replace('Mon Oct 19', 'Mon Xxx 19'), ' '.repeat(4194305)])
        assert.throws(() => parseUiMetadataSnapshotV1(bad), /UI_OS_OBSERVATION_INVALID/);
});
test('simulated process observation refuses a noncanonical raw comm alias', async () => {
    const { observeUiProcessV1 } = await load();
    const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'ui-comm-alias-')));
    const executable = realpathSync(process.execPath), alias = path.join(root, 'node-alias');
    symlinkSync(executable, alias);
    const metadata = ` 23456 1 ${process.getuid!()} Mon Oct 19 10:00:00 2026 23456 ${executable} fixed-argument\n`;
    try {
        const observed = await observeUiProcessV1(23456, async (args: string[]) => args.at(-1) === 'comm=' ? executable + '\n' : metadata);
        assert.equal(observed.executable, executable);
        await assert.rejects(observeUiProcessV1(23456, async (args: string[]) => args.at(-1) === 'comm=' ? alias + '\n' : metadata), /UI_OS_OBSERVATION_INVALID/);
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
});
test('CDP endpoint parser accepts only one exact captured loopback browser endpoint', async () => {
    const { parseUiCdpEndpointV1 } = await load();
    assert.equal(parseUiCdpEndpointV1('\nDevTools listening on ws://127.0.0.1:49152/devtools/browser/abcd-1234\n'), 'ws://127.0.0.1:49152/devtools/browser/abcd-1234');
    for (const bad of ['ws://localhost:49152/devtools/browser/a', 'DevTools listening on ws://localhost:49152/devtools/browser/a\n', 'DevTools listening on ws://127.0.0.1:3080/devtools/browser/a\n', 'DevTools listening on ws://127.0.0.1:49152/devtools/page/a\n', 'DevTools listening on ws://127.0.0.1:49152/devtools/browser/a\nDevTools listening on ws://127.0.0.1:49153/devtools/browser/b\n'])
        assert.throws(() => parseUiCdpEndpointV1(bad));
});
test('simulated native effects require actual handle close and complete global observations before closed publication', async () => {
    const { EventEmitter } = await import('node:events');
    const { PassThrough } = await import('node:stream');
    const { createUiNativeLifecycleV1, createUiArtifactStoreV1 } = await load();
    const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'ui-native-component-')));
    const calls: string[] = [];
    let alive = false, now = 1792404000000, nativeArgs: string[] = [], child: any;
    const executable = realpathSync(process.execPath), nativePid = 23456;
    const meta = () => ` ${process.pid} 1 100 ${process.getuid!()} Mon Oct 19 10:00:00 2026\n` + (alive ? ` ${nativePid} ${process.pid} ${nativePid} ${process.getuid!()} Mon Oct 19 10:00:00 2026\n` : '');
    const ps = async (args: string[]) => {
        calls.push(args.includes('-A') ? 'census' : 'identity');
        if (args.includes('-A'))
            return meta();
        if (args.at(-1) === 'comm=')
            return executable + '\n';
        return ` ${nativePid} ${process.pid} ${process.getuid!()} Mon Oct 19 10:00:00 2026 ${nativePid} ${executable} ${nativeArgs.join(' ')}\n`;
    };
    const defaultContext = { close: async () => { throw Error('CDP default context close would disconnect before native Browser.close'); } };
    const createdContexts: any[] = [];
    const browser = new EventEmitter() as any;
    browser.contexts = () => [defaultContext, ...createdContexts];
    browser.isConnected = () => alive;
    browser.newBrowserCDPSession = async () => ({ send: async (method: string) => { assert.equal(method, 'Browser.close'); calls.push('Browser.close'); alive = false; child.emit('exit', 0, null); queueMicrotask(() => { calls.push('native-close'); child.emit('close', 0, null); browser.emit('disconnected'); }); } });
    browser.close = async () => { calls.push('client-close'); };
    try {
        const store = createUiArtifactStoreV1(root), owner = { pid: process.pid, processGroupId: 100 };
        const lifecycle = createUiNativeLifecycleV1({ store, jobId: '018d819f-0a78-7d38-bb1f-0195b029ddaf', intentHash: 'a'.repeat(64), ownerHash: 'b'.repeat(64), owner, cancellationRequested: () => false,
            descriptor: { executable, executableHash: 'c'.repeat(64), playwrightVersion: '1.60.0', browsersJsonHash: 'd'.repeat(64), family: 'chromium-headless-shell', check() { } } }, {
            ps, clock: () => now, sleep: async (ms: number) => { now += ms; }, connectOverCDP: async () => browser,
            spawn: (file: string, args: string[], options: any) => { calls.push('spawn'); assert.equal(file, executable); assert.equal(options.detached, true); assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']); assert.equal(options.env.NODE_OPTIONS, undefined); assert.equal(options.env.SETFARM_INSTALLATION_DIR, undefined); assert.ok(!args.includes('--no-sandbox')); nativeArgs = args; alive = true; child = new EventEmitter(); child.pid = nativePid; child.stdout = new PassThrough(); child.stderr = new PassThrough(); queueMicrotask(() => child.stderr.write('DevTools listening on ws://127.0.0.1:49152/devtools/browser/abc-123\n')); return child; }
        });
        assert.equal(await lifecycle.launch(), browser);
        await lifecycle.census();
        createdContexts.push({ close: async () => { calls.push('created-context-close'); } });
        const disposition = await lifecycle.close();
        assert.equal(disposition.browser, 'closed');
        assert.equal(disposition.children[0].owner.pid, nativePid);
        assert.ok(calls.indexOf('census') < calls.indexOf('spawn'));
        assert.ok(calls.indexOf('created-context-close') < calls.indexOf('Browser.close'));
        assert.ok(calls.indexOf('native-close') < calls.lastIndexOf('census'));
        assert.equal(readFileSync(path.join(root, 'children', disposition.children[0].spawnId + '.closed.json'), 'utf8').includes('"close":"confirmed"'), true);
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
});
test('simulated native cleanup never publishes closed for reused PID, escaped cohort, missing close, partial census or failed settlement publication', async () => {
    const { EventEmitter } = await import('node:events');
    const { PassThrough } = await import('node:stream');
    const { createUiNativeLifecycleV1, createUiArtifactStoreV1 } = await load();
    const { UiWorkerLifecycleRecordV1Schema } = await import('../server/services/control-ui-worker-protocol.js');
    for (const defect of ['reused_pid', 'escaped_group', 'missing_close', 'partial_census', 'publication']) {
        const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'ui-native-unknown-')));
        let alive = false, closing = false, now = 1792404000000, args: string[] = [], child: any, killCalls = 0;
        const executable = realpathSync(process.execPath), pid = 23456, group = () => defect === 'escaped_group' && closing ? 777 : pid;
        const started = () => defect === 'reused_pid' && closing ? 'Mon Oct 19 10:00:01 2026' : 'Mon Oct 19 10:00:00 2026';
        const ps = async (command: string[]) => {
            if (command.includes('-A')) {
                if (closing && defect === 'partial_census')
                    return 'partial output\n';
                return ` ${process.pid} 1 100 ${process.getuid!()} Mon Oct 19 10:00:00 2026\n` + ((alive || closing && ['reused_pid', 'escaped_group'].includes(defect)) ? ` ${pid} ${process.pid} ${group()} ${process.getuid!()} ${started()}\n` : '');
            }
            if (command.at(-1) === 'comm=')
                return executable + '\n';
            return ` ${pid} ${process.pid} ${process.getuid!()} ${started()} ${group()} ${executable} ${args.join(' ')}\n`;
        };
        const browser = new EventEmitter() as any;
        browser.contexts = () => [];
        browser.isConnected = () => alive;
        browser.newBrowserCDPSession = async () => ({ send: async () => {
                closing = true;
                alive = false;
                child.emit('exit', 0, null);
                if (defect !== 'missing_close')
                    child.emit('close', 0, null);
                browser.emit('disconnected');
            } });
        browser.close = async () => {
            if (defect === 'missing_close')
                now += 30001;
        };
        try {
            const store = createUiArtifactStoreV1(root), wrapped = { ...store, record(name: string, value: any) {
                    if (defect === 'publication' && name.endsWith('.settled.json'))
                        throw Error('simulated fsync publication failure');
                    return store.record(name, value);
                } };
            const lifecycle = createUiNativeLifecycleV1({ store: wrapped, jobId: '018d819f-0a78-7d38-bb1f-0195b029ddaf', intentHash: 'a'.repeat(64), ownerHash: 'b'.repeat(64), owner: { pid: process.pid, processGroupId: 100 }, cancellationRequested: () => false, recordSchema: UiWorkerLifecycleRecordV1Schema, descriptor: { executable, executableHash: 'c'.repeat(64), playwrightVersion: '1.60.0', browsersJsonHash: 'd'.repeat(64), family: 'chromium-headless-shell', check() { } } }, { ps, clock: () => now, sleep: async (ms: number) => { now += ms; }, connectOverCDP: async () => browser, spawn: (_file: string, argv: string[]) => { args = argv; alive = true; child = new EventEmitter(); child.pid = pid; child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => { killCalls++; }; queueMicrotask(() => child.stderr.write('DevTools listening on ws://127.0.0.1:49152/devtools/browser/abc-123\n')); return child; } });
            await lifecycle.launch();
            await assert.rejects(lifecycle.close(), undefined, defect);
            assert.equal(killCalls, 0);
            const { readdirSync } = await import('node:fs');
            const names = readdirSync(path.join(root, 'children'));
            assert.ok(names.some(x => x.endsWith('.observed.json')));
            assert.ok(!names.some(x => x.endsWith('.closed.json')), defect);
        }
        finally {
            rmSync(root, { recursive: true, force: true });
        }
    }
});
