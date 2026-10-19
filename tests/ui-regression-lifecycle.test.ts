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
test('review I1 exact retained macOS date padding is accepted without accepting tabs or trailing tokens', async () => {
    const { parseUiMetadataSnapshotV1 } = await load();
    const raw = '    1     0     1     0 Mon Sep 21 09:35:56 2026    \n';
    assert.deepEqual(parseUiMetadataSnapshotV1(raw), [{ pid: 1, ppid: 0, pgid: 1, uid: 0, startedAt: '2026-09-21T09:35:56.000Z' }]);
    for (const bad of [raw.replace('2026    ', '2026\t'), raw.replace('2026    ', '2026 x'), raw.slice(0, -1), raw + raw])
        assert.throws(() => parseUiMetadataSnapshotV1(bad), /UI_OS_OBSERVATION_INVALID/);
});
async function simulatedReviewNative(options: {
    publication?: string;
    cancelAfterIntent?: boolean;
    descriptorDrift?: boolean;
    chunks?: string[];
    declarationDuringClose?: string;
    nativeUid?: string;
    foreignMetadataRow?: string;
    closeFailure?: string;
    diagnosticPublicationFailure?: boolean;
} = {}) {
    const { EventEmitter } = await import('node:events');
    const { PassThrough } = await import('node:stream');
    const { createUiNativeLifecycleV1, createUiArtifactStoreV1 } = await load();
    const { UiWorkerLifecycleRecordV1Schema } = await import('../server/services/control-ui-worker-protocol.js');
    const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'ui-review-native-')));
    const store = createUiArtifactStoreV1(root), calls: string[] = [], executable = realpathSync(process.execPath), pid = 23456;
    let now = 1792404000000, alive = false, cancelled = false, child: any, argv: string[] = [];
    const endpoint = 'ws://127.0.0.1:49152/devtools/browser/abc-123';
    const chunks = [...(options.chunks ?? ['DevTools listening on ' + endpoint + '\n'])];
    let closeArmed = false;
    const closeError = new Error(options.closeFailure === 'pre_close_census' ? 'UI_OS_OBSERVATION_INVALID' : 'private endpoint/environment must not be retained');
    const failAt = (phase: string) => { calls.push(phase); if (closeArmed && options.closeFailure === phase) throw closeError; };
    const browser = new EventEmitter() as any;
    browser.contexts = () => closeArmed ? [{ close: async () => { failAt('context_close'); } }] : [];
    browser.isConnected = () => alive;
    browser.newBrowserCDPSession = async () => { failAt('cdp_session'); return { send: async () => { failAt('native_close'); calls.push('Browser.close'); if (options.declarationDuringClose)
            child.stderr.write(options.declarationDuringClose); alive = false; child.emit('exit', 0, null); if (options.closeFailure !== 'original_exit_close') child.emit('close', 0, null); browser.emit('disconnected'); } }; };
    browser.close = async () => { failAt('client_close'); calls.push('client.close'); if (options.closeFailure === 'original_exit_close') { await Promise.resolve(); now += 30001; } };
    const lifecycle = createUiNativeLifecycleV1({ store: { ...store, json(value: any) { if (options.diagnosticPublicationFailure) throw Error('diagnostic publication failed'); return store.json(value); }, record(name: string, value: any) {
                if (name.endsWith('.settled.json')) failAt('settlement_publish');
                if (name.endsWith('.closed.json')) failAt('closed_publish');
                calls.push(name.split('/').at(-1)!.slice(37));
                const leaf = name.endsWith('.intent.json') ? 'intent' : name.endsWith('.not-started.json') ? 'not-started' : 'other';
                if (options.publication === leaf + '-before')
                    throw Error('simulated before write failure');
                const hash = store.record(name, value);
                if (options.publication === leaf + '-after')
                    throw Error('simulated uncertain fsync acknowledgement');
                if (leaf === 'intent' && options.cancelAfterIntent)
                    cancelled = true;
                return hash;
            } }, jobId: '018d819f-0a78-7d38-bb1f-0195b029ddaf', intentHash: 'a'.repeat(64), ownerHash: 'b'.repeat(64), owner: { pid: process.pid, processGroupId: 100 }, cancellationRequested: () => cancelled, recordSchema: UiWorkerLifecycleRecordV1Schema,
        descriptor: { executable, executableHash: 'c'.repeat(64), playwrightVersion: '1.60.0', browsersJsonHash: 'd'.repeat(64), family: 'chromium-headless-shell', check() { if (options.descriptorDrift)
                throw Error('simulated descriptor drift'); } } }, {
        clock: () => now, sleep: async (ms: number) => { now += ms; if (chunks.length && child)
            child.stderr.write(chunks.shift()); },
        ps: async (args: string[]) => {
            if (args.includes('-A') && closeArmed) failAt(alive ? 'pre_close_census' : 'post_close_census');
            if (!args.includes('-A') && closeArmed) failAt('pre_close_observe');
            if (args.includes('-A'))
                return ` ${process.pid} 1 100 ${process.getuid!()} Mon Oct 19 10:00:00 2026    \n` + (options.foreignMetadataRow ?? '') + (alive ? ` ${pid} ${process.pid} ${pid} ${options.nativeUid ?? process.getuid!()} Mon Oct 19 10:00:00 2026    \n` : '');
            if (args.at(-1) === 'comm=')
                return executable + '\n';
            return ` ${pid} ${process.pid} ${options.nativeUid ?? process.getuid!()} Mon Oct 19 10:00:00 2026 ${pid} ${executable} ${argv.join(' ')}\n`;
        },
        spawn: (_file: string, args: string[]) => { calls.push('spawn'); argv = args; alive = true; child = new EventEmitter(); child.pid = pid; child.stdout = new PassThrough(); child.stderr = new PassThrough(); queueMicrotask(() => { if (chunks.length)
            child.stderr.write(chunks.shift()); }); return child; },
        connectOverCDP: async (url: string) => { assert.equal(url, endpoint); assert.equal(chunks.length, 0, 'connect only after complete endpoint newline'); calls.push('connect'); return browser; },
    });
    return { lifecycle, root, calls, closeError, armClose() { closeArmed = true; }, stderr: (value: string) => child.stderr.write(value), dispose() { rmSync(root, { recursive: true, force: true }); } };
}
test('review I2 publication uncertainty cannot produce definite never-invoked cleanup', async (t) => {
    for (const publication of ['intent-before', 'intent-after', 'not-started-before', 'not-started-after'])
        await t.test(publication, async () => {
            const h = await simulatedReviewNative({ publication, cancelAfterIntent: true });
            try {
                await assert.rejects(h.lifecycle.launch());
                await assert.rejects(h.lifecycle.close(), /UI_CLEANUP_UNKNOWN/);
                assert.ok(!h.calls.includes('spawn'));
                const { readdirSync } = await import('node:fs');
                const leaves = readdirSync(path.join(h.root, 'children'));
                if (publication !== 'intent-before')
                    assert.ok(leaves.some(name => name.endsWith('.intent.json')));
                assert.ok(!leaves.some(name => name.endsWith('.closed.json')));
            }
            finally {
                h.dispose();
            }
        });
    await t.test('descriptor refusal after committed intent publishes original never-invoked disposition', async () => {
        const h = await simulatedReviewNative({ descriptorDrift: true });
        try {
            await assert.rejects(h.lifecycle.launch(), /descriptor drift/);
            const cleanup = await h.lifecycle.close();
            assert.equal(cleanup.browser, 'not_started');
            assert.equal(cleanup.children.length, 1);
            const leaf = JSON.parse(readFileSync(path.join(h.root, 'children', cleanup.children[0].spawnId + '.not-started.json'), 'utf8'));
            assert.equal(leaf.disposition, 'never_invoked');
            assert.ok(!h.calls.includes('spawn'));
        }
        finally {
            h.dispose();
        }
    });
});
test('review I5 fragmented original stderr waits through prefix URL and newline before connecting', async () => {
    const h = await simulatedReviewNative({ chunks: ['DevTools listening', ' on ws://127.0.0.1:', '49152/devtools/browser/abc-123', '\n'] });
    try {
        await h.lifecycle.launch();
        assert.equal(h.calls.filter(call => call === 'connect').length, 1);
        const cleanup = await h.lifecycle.close();
        assert.equal(cleanup.browser, 'closed');
        const settled = JSON.parse(readFileSync(path.join(h.root, 'children', cleanup.children[0].spawnId + '.settled.json'), 'utf8'));
        const exactPaddedMetadata = ` ${process.pid} 1 100 ${process.getuid!()} Mon Oct 19 10:00:00 2026    \n`;
        assert.ok(settled.emptyCensuses.every((row: any) => row.metadataHash === createHash('sha256').update(exactPaddedMetadata).digest('hex')));
    }
    finally {
        h.dispose();
    }
});
test('review I5 later duplicate or foreign endpoint declaration prevents definite settlement', async (t) => {
    for (const line of ['DevTools listening on ws://127.0.0.1:49152/devtools/browser/abc-123\n', 'DevTools listening on ws://localhost:49153/devtools/browser/other\n'])
        await t.test(line.trim(), async () => {
            const h = await simulatedReviewNative();
            try {
                await h.lifecycle.launch();
                h.stderr(line);
                await assert.rejects(h.lifecycle.census());
                await assert.rejects(h.lifecycle.close(), /UI_CLEANUP_UNKNOWN/);
                const { readdirSync } = await import('node:fs');
                assert.ok(!readdirSync(path.join(h.root, 'children')).some(name => name.endsWith('.closed.json')));
            }
            finally {
                h.dispose();
            }
        });
});
test('review I5 endpoint violation during original shutdown cannot publish settlement', async () => {
    const h = await simulatedReviewNative({ declarationDuringClose: 'DevTools listening on ws://localhost:49153/devtools/browser/late\n' });
    try {
        await h.lifecycle.launch();
        await assert.rejects(h.lifecycle.close(), /UI_CLEANUP_UNKNOWN/);
        const { readdirSync } = await import('node:fs');
        assert.ok(!readdirSync(path.join(h.root, 'children')).some(name => /\.(settled|closed)\.json$/.test(name)));
        assert.ok(h.calls.includes('Browser.close'));
    }
    finally {
        h.dispose();
    }
});

test('review fix2 exact macOS nobody UID row is retained with canonical unsigned32 UID', async () => {
    const { parseUiMetadataSnapshotV1 } = await load();
    const raw = '  335     1   335    -2 Mon Sep 21 09:36:04 2026    \n';
    assert.deepEqual(parseUiMetadataSnapshotV1(raw), [{ pid: 335, ppid: 1, pgid: 335, uid: 4294967294, startedAt: '2026-09-21T09:36:04.000Z' }]);
    const other = '    1     0     1     0 Mon Sep 21 09:35:56 2026    \n';
    assert.deepEqual(parseUiMetadataSnapshotV1(other + raw).map(row => [row.pid, row.uid]), [[1, 0], [335, 4294967294]]);
});
test('review fix2 UID normalization accepts only canonical signed32 or unsigned32 presentations', async () => {
    const { parseUiMetadataSnapshotV1 } = await load();
    const row = (value: string) => ` 335 1 335 ${value} Mon Sep 21 09:36:04 2026    \n`;
    for (const [raw, expected] of [['0', 0], ['2147483647', 2147483647], ['2147483648', 2147483648], ['4294967295', 4294967295], ['-1', 4294967295], ['-2147483648', 2147483648]] as const)
        assert.equal(parseUiMetadataSnapshotV1(row(raw))[0].uid, expected);
    for (const invalid of ['4294967296', '-2147483649', '-4294966795', '9007199254740992', '-9007199254740992', '+501', '+0', '-0', '00', '0501', '-01', '--2', '-+2', '1e3', '0x1f5', 'nobody', '- 2', ''])
        assert.throws(() => parseUiMetadataSnapshotV1(row(invalid)), /UI_OS_OBSERVATION_INVALID/, invalid);
});
test('review fix2 foreign UID remains in complete census and cannot become the original native owner', async (t) => {
    const foreignMetadataRow = '  335     1   335    -2 Mon Sep 21 09:36:04 2026    \n';
    await t.test('unrelated foreign row stays in raw census hash through positive simulated closure', async () => {
        const h = await simulatedReviewNative({ foreignMetadataRow });
        try {
            await h.lifecycle.launch();
            const cleanup = await h.lifecycle.close();
            assert.equal(cleanup.browser, 'closed');
            const settled = JSON.parse(readFileSync(path.join(h.root, 'children', cleanup.children[0].spawnId + '.settled.json'), 'utf8'));
            const raw = ` ${process.pid} 1 100 ${process.getuid!()} Mon Oct 19 10:00:00 2026    \n` + foreignMetadataRow;
            assert.ok(settled.emptyCensuses.every((census: any) => census.metadataHash === createHash('sha256').update(raw).digest('hex')));
            assert.ok(settled.cohort.every((member: any) => member.owner.pid !== 335));
        } finally { h.dispose(); }
    });
    for (const nativeUid of ['4294967294', '-2']) await t.test('foreign native UID ' + nativeUid + ' refuses custody', async () => {
        const h = await simulatedReviewNative({ nativeUid });
        try {
            await assert.rejects(h.lifecycle.launch(), /UI_CUSTODY_UNKNOWN|UI_OS_OBSERVATION_INVALID/);
            await assert.rejects(h.lifecycle.close(), /UI_CLEANUP_UNKNOWN/);
            assert.ok(!h.calls.includes('connect'));
            const { readdirSync } = await import('node:fs');
            assert.ok(!readdirSync(path.join(h.root, 'children')).some(name => /\.(observed|settled|closed)\.json$/.test(name)));
        } finally { h.dispose(); }
    });
});


// Simulated OS/native effects; strict ownership parsers and real immutable publication remain active.
test('native close failure retains its fixed phase without changing refusal or masking original error', async (t) => {
    const { readdirSync } = await import('node:fs');
    for (const phase of ['pre_close_census', 'pre_close_observe', 'context_close', 'cdp_session', 'native_close', 'client_close', 'original_exit_close', 'post_close_census', 'settlement_publish', 'closed_publish']) await t.test(phase, async () => {
        const h = await simulatedReviewNative({ closeFailure: phase });
        const lines: string[] = [];
        const stderr = t.mock.method(process.stderr, 'write', (bytes: any) => { lines.push(String(bytes)); return true; });
        try {
            await h.lifecycle.launch(); h.armClose();
            let caught: any;
            try { await h.lifecycle.close(); } catch (error) { caught = error; }
            assert.ok(caught);
            if (phase !== 'original_exit_close') assert.equal(caught, h.closeError, 'same original exception must survive diagnostics');
            const files = readdirSync(path.join(h.root, 'artifacts'));
            assert.equal(files.length, 1, 'failure must be retained as an immutable diagnostic');
            const bytes = readFileSync(path.join(h.root, 'artifacts', files[0]));
            assert.equal(files[0], createHash('sha256').update(bytes).digest('hex') + '.json');
            assert.equal(statSync(path.join(h.root, 'artifacts', files[0])).mode & 0o777, 0o600);
            const diagnostic = JSON.parse(bytes.toString());
            assert.equal(diagnostic.schema, 'mission-control.ui-native-close-diagnostic.v1');
            assert.equal(diagnostic.phase, phase === 'pre_close_observe' ? 'pre_close_census' : phase);
            assert.deepEqual(diagnostic.observation, ['pre_close_census', 'post_close_census', 'settlement_publish', 'closed_publish'].includes(phase) ? { operation: 'snapshot', pid: null } : { operation: 'observe', pid: 23456 });
            assert.equal(diagnostic.errorCode, phase === 'pre_close_census' ? 'UI_OS_OBSERVATION_INVALID' : phase === 'original_exit_close' ? 'UI_CLEANUP_UNKNOWN' : 'UI_NATIVE_OPERATION_FAILED');
            assert.equal(diagnostic.unknown, true); assert.equal(diagnostic.cohortCount, 1);
            assert.equal(diagnostic.rootOwner.pid, 23456);
            assert.match(diagnostic.lastSuccessfulCensus.metadataHash, /^[a-f0-9]{64}$/);
            assert.equal(diagnostic.lastSuccessfulCensus.rowCount, ['settlement_publish', 'closed_publish'].includes(phase) ? 1 : 2);
            assert.equal(diagnostic.publicationUncertain, ['settlement_publish', 'closed_publish'].includes(phase));
            assert.equal(diagnostic.rootCloseObserved, !['pre_close_census', 'pre_close_observe', 'context_close', 'cdp_session', 'native_close', 'original_exit_close'].includes(phase));
            assert.ok(bytes.length < 4096); assert.ok(!bytes.includes(Buffer.from('private endpoint/environment')));
            assert.ok(!bytes.includes(Buffer.from('ws://'))); assert.ok(!bytes.includes(Buffer.from('--headless')));
            assert.deepEqual(lines.map(line => JSON.parse(line)), [{ code: 'UI_NATIVE_CLOSE_FAILED', diagnosticHash: files[0].slice(0, -5) }]);
            const leaves = readdirSync(path.join(h.root, 'children'));
            assert.ok(!leaves.some(name => name.endsWith('.closed.json')));
            assert.equal(leaves.some(name => name.endsWith('.settled.json')), phase === 'closed_publish');
            if (['pre_close_census', 'pre_close_observe', 'context_close', 'cdp_session', 'native_close'].includes(phase)) assert.ok(!h.calls.includes('Browser.close'));
            if (phase === 'pre_close_census') assert.ok(!h.calls.includes('context_close'));
            if (phase === 'context_close') assert.ok(!h.calls.includes('cdp_session'));
        } finally { stderr.mock.restore(); h.dispose(); }
    });
    await t.test('diagnostic publication failure preserves original refusal and emits no invented hash', async () => {
        const h = await simulatedReviewNative({ closeFailure: 'native_close', diagnosticPublicationFailure: true });
        const lines: string[] = [], stderr = t.mock.method(process.stderr, 'write', (bytes: any) => { lines.push(String(bytes)); return true; });
        try {
            await h.lifecycle.launch(); h.armClose();
            await assert.rejects(h.lifecycle.close(), error => error === h.closeError);
            assert.deepEqual(readdirSync(path.join(h.root, 'artifacts')), []);
            assert.deepEqual(lines.map(line => JSON.parse(line)), [{ code: 'UI_NATIVE_CLOSE_DIAGNOSTIC_PUBLICATION_FAILED' }]);
            assert.ok(!readdirSync(path.join(h.root, 'children')).some(name => /\.(settled|closed)\.json$/.test(name)));
        } finally { stderr.mock.restore(); h.dispose(); }
    });
    await t.test('successful original close retains existing ledger and no failure diagnostic', async () => {
        const h = await simulatedReviewNative();
        try {
            await h.lifecycle.launch(); h.armClose();
            assert.equal((await h.lifecycle.close()).browser, 'closed');
            assert.deepEqual(readdirSync(path.join(h.root, 'artifacts')), []);
        } finally { h.dispose(); }
    });
});
