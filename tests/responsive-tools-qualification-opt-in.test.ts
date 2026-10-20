import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
const responsiveEntry = fileURLToPath(new URL('./data-sync-browser.test.ts', import.meta.url));
const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
const supportedNonNativeNode = nodeMajor > 24 || (nodeMajor === 24 && nodeMinor >= 3);

// Before the opt-in gate exists, Node24+ reaches the unchanged physical-Node22
// refusal before any owned store or native acquisition. Skip this regression on
// Node22 so proving RED cannot accidentally execute the actual native profile.
test('default responsive tools entry skips native qualification without opt-in', {
    timeout: 20000,
    skip: supportedNonNativeNode ? false : 'requires supported Node24+; no native qualification credit',
}, () => {
    const child = spawnSync(process.execPath, [
        '--import', 'tsx',
        '--test',
        '--test-reporter=tap',
        '--test-name-pattern=^responsive tools readability$',
        responsiveEntry,
    ], {
        cwd: sourceRoot,
        // Deliberately omit the qualification flag and ambient Node preload/test
        // options. The selected child exercises the real unrequested entry.
        env: {
            HOME: process.env.HOME,
            PATH: '/usr/bin:/bin',
            LANG: 'C',
            LC_ALL: 'C',
            TZ: 'UTC',
        },
        encoding: 'utf8',
        timeout: 15000,
        maxBuffer: 65536,
        killSignal: 'SIGKILL',
    });

    assert.equal(child.error, undefined, child.error?.message);
    assert.equal(child.signal, null, 'selected child must exit normally');
    assert.equal(child.status, 0, child.stdout + child.stderr);
    assert.equal(child.stderr, '');
    assert.match(child.stdout, /^TAP version 13$/m);
    assert.match(child.stdout, /^1\.\.1$/m);
    assert.equal((child.stdout.match(/^ok 1 - responsive tools readability # SKIP \S.*$/gm) || []).length, 1,
        'the exact native qualification must be intentionally skipped with a reason');
    assert.match(child.stdout, /^# tests 1$/m);
    assert.match(child.stdout, /^# pass 0$/m, 'SKIP must not count as native PASS');
    assert.match(child.stdout, /^# fail 0$/m);
    assert.match(child.stdout, /^# cancelled 0$/m);
    assert.match(child.stdout, /^# skipped 1$/m);
    assert.match(child.stdout, /^# todo 0$/m);
    assert.doesNotMatch(child.stdout + child.stderr,
        /RESPONSIVE_TOOLS_(?:STORE_CREATED|OWNED_ARTIFACTS|VISUAL_CANDIDATE)/,
        'an unrequested entry must not produce an owned store or native artifact marker');
});
