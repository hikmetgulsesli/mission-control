/** Supplemental Source fixture custody; no effects until the factory is called. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, realpathSync, statfsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'playwright';
import type { UiObservedOwnerV1, UiNativeBrowserOwnerV1 } from '../../server/services/control-ui-worker-protocol.js';
import { UiWorkerLifecycleRecordV1Schema } from '../../server/services/control-ui-worker-protocol.js';
import {
    createUiArtifactStoreV1, createUiNativeLifecycleV1, observeUiProcessV1,
    pinUiFileV1, uiHashV1, uiCanonicalV1,
} from '../../scripts/ui-regression-lifecycle.mjs';

export type Store = {
    root: string;
    json(value: unknown): string;
    png(bytes: Buffer): string;
    record(name: string, value: unknown): string;
    verify(): void;
};
export type NativeProof = {
    browser: 'not_started' | 'closed';
    children: Array<{ spawnId: string; owner: UiNativeBrowserOwnerV1 | null; state: 'not_started' | 'closed' }>;
};
export type OwnedProfile = {
    store: Store;
    launch(): Promise<Browser | null>;
    boundary(): Promise<void>;
    shot(page: Page, label: string): Promise<string>;
    close(): Promise<NativeProof>;
};
const node22 = '/opt/homebrew/Cellar/node@22/22.23.1/bin/node';
const fixedFiles = new Set([
    'tests/data-sync-browser.test.ts', 'tests/fixtures/data-sync-browser.tsx',
    'tests/fixtures/data-sync-browser.html', 'tests/fixtures/responsive-tools-owned.ts',
    'package.json', 'package-lock.json', 'scripts/ui-regression-lifecycle.mjs',
    'server/services/control-ui-worker-protocol.ts',
]);
const canonicalPins = {
    'server/services/control-ui-worker-protocol.ts': ['c86151b828b64f0d8a3c6a539f122a83a1cc31ef698f2fbfef9b934c7717d734', 14648],
    'src/components/KimiQuotaBanner.tsx': ['53f7c71ac8ba162d245560e5e19bacc916b62fcb34530abfe14fc771f1ca99a7', 5647],
    'src/lib/api.ts': ['d7b5320ae16fdd0bea2125be5c58e8d88537822e15df7262078bc7f0a9f33cb5', 30349],
    'scripts/ui-regression-lifecycle.mjs': ['b3eb1ab0bd8ffed848c378a943d6ef4429d6f521509d2fbc61db6afb43a3bdad', 38287],
} as const;

export async function createResponsiveToolsOwnedProfileV1(input: Readonly<{
    sourceRoot: string; sourcePaths: readonly string[]; profileData: unknown;
}>): Promise<OwnedProfile> {
    const sourceRoot = realpathSync(input.sourceRoot);
    assert.equal(sourceRoot, input.sourceRoot, 'physical Source root required');
    assert.equal(sourceRoot, realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '../..')));
    assert.equal(realpathSync(process.execPath), node22, 'pinned physical Node22 required');
    assert.equal(process.versions.node, '22.23.1');
    const paths = [...input.sourcePaths];
    assert.deepEqual(paths, [...new Set(paths)].sort(), 'reviewed manifest must be unique and ordered');
    for (const required of fixedFiles) assert.ok(paths.includes(required), `missing reviewed Source: ${required}`);
    for (const required of Object.keys(canonicalPins)) assert.ok(paths.includes(required));
    const pins = paths.map(path => {
        assert.ok(fixedFiles.has(path) || /^(?:src|server\/shared)\/[A-Za-z0-9_./-]+$/.test(path), 'unreviewed Source tree');
        assert.ok(!path.split('/').some(part => part === '.' || part === '..' || part.startsWith('.')));
        const pin = pinUiFileV1(join(sourceRoot, path));
        const expected = canonicalPins[path as keyof typeof canonicalPins];
        if (expected) {
            assert.equal(pin.hash, expected[0], `canonical Source changed: ${path}`);
            assert.equal(pin.bytes.length, expected[1]);
        }
        return { path, pin };
    });
    const manifest = pins.map(({ path, pin }) => ({ path, sha256: pin.hash, bytes: pin.bytes.length }));
    const sourcePinHash = uiHashV1(uiCanonicalV1(manifest));
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'mc-responsive-owned-')));
    const store: Store = createUiArtifactStoreV1(root);
    console.log(JSON.stringify({ code: 'RESPONSIVE_TOOLS_STORE_CREATED', root, sourcePinHash }));
    // Disk admission supplements Root's current resource admission; it cannot replace it.
    const checkFloor = () => {
        const fs = statfsSync(root, { bigint: true });
        assert.ok(fs.bavail * fs.bsize >= 8589934592n, 'responsive fixture requires the fixed 8GiB floor');
    };
    checkFloor();
    const observed = await observeUiProcessV1(process.pid);
    const executable = realpathSync(process.execPath);
    const script = realpathSync(process.argv[1]);
    const expectedCommand = [executable, ...process.execArgv, ...process.argv.slice(1)].join(' ');
    assert.equal(observed.pid, process.pid);
    assert.equal(observed.executable, executable);
    assert.equal(observed.uid, process.getuid!());
    assert.equal(observed.rawArgs, expectedCommand, 'exact original Node child argv required');
    const owner: UiObservedOwnerV1 = Object.freeze({
        pid: observed.pid, processStartedAt: observed.startedAt, processGroupId: observed.pgid,
        source: 'observed_os', executable, script, commandHash: uiHashV1(observed.rawArgs),
    });
    const ownerHash = uiHashV1(uiCanonicalV1(owner));
    const jobId = randomUUID();
    const fixtureDataHash = uiHashV1(uiCanonicalV1(input.profileData));
    const ownerArtifactHash = store.json({ schema: 'mission-control.responsive-tools-source-owner.v1', owner, ownerHash });
    const manifestArtifactHash = store.json({ schema: 'mission-control.responsive-tools-source-manifest.v1', sourcePinHash, manifest });
    const intent = { schema: 'mission-control.responsive-tools-source-intent.v1', jobId, ownerHash,
        sourcePinHash, fixtureDataHash, profile: 'responsive-tools-v1', requestedAt: new Date().toISOString() };
    const intentHash = uiHashV1(uiCanonicalV1(intent));
    const intentArtifactHash = store.json(intent);
    const binding = { jobId, ownerHash,
        sourcePinHash, fixtureDataHash, intentHash, intentArtifactHash, ownerArtifactHash, manifestArtifactHash };
    // Supplemental binding only: never a fabricated worker-owner/build receipt.
    store.record('owner.json', { schema: 'mission-control.responsive-tools-source-binding.v1', ...binding });
    let cancelled = false;
    const cancel = () => { cancelled = true; };
    const lifecycle = createUiNativeLifecycleV1({ store, jobId, intentHash, ownerHash, owner,
        cancellationRequested: () => cancelled, recordSchema: UiWorkerLifecycleRecordV1Schema });
    process.on('SIGINT', cancel);
    process.on('SIGTERM', cancel);
    const verify = () => {
        for (const { pin } of pins) pin.check();
        store.verify();
        checkFloor();
        assert.equal(cancelled, false, 'responsive fixture cancelled');
    };
    let closePromise: Promise<NativeProof> | undefined;
    let launched = false;
    console.log(JSON.stringify({ code: 'RESPONSIVE_TOOLS_OWNED_ARTIFACTS', root, ...binding }));
    return Object.freeze({ store,
        async launch() {
            assert.equal(launched, false, 'one owned launch only');
            launched = true;
            verify();
            return await lifecycle.launch();
        },
        async boundary() {
            verify();
            const census = await lifecycle.census();
            store.json({ schema: 'mission-control.responsive-tools-boundary.v1', ...binding, census });
        },
        async shot(page: Page, label: string) {
            assert.match(label, /^[a-z0-9-]+$/);
            verify();
            const bytes = await page.screenshot({ fullPage: true });
            const pngHash = store.png(bytes);
            const dimensions = { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
            store.json({ schema: 'mission-control.responsive-tools-shot.v1', ...binding, label,
                viewport: page.viewportSize(), pngHash, dimensions });
            return pngHash;
        },
        close() {
            closePromise ??= (async () => {
                try {
                    const proof = await lifecycle.close() as NativeProof;
                    verify();
                    store.json({ schema: 'mission-control.responsive-tools-native-outcome.v1', ...binding,
                        outcome: 'settled', proof, sourceAfter: manifest });
                    return proof;
                } catch (error) {
                    store.json({ schema: 'mission-control.responsive-tools-native-outcome.v1', ...binding,
                        outcome: 'UNKNOWN', errorCode: error instanceof Error ? error.message : 'UNKNOWN' });
                    throw error;
                } finally {
                    process.removeListener('SIGINT', cancel);
                    process.removeListener('SIGTERM', cancel);
                }
            })();
            return closePromise!;
        },
    });
}
