import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, realpathSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readUiControlEvidenceV1, readUiControlScreenshotV1, controlBytesV1 } from './control-evidence.js';
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const bytes = controlBytesV1;
test('UI evidence distinguishes missing, unsafe, invalid and historical and checks every manifest hash', () => {
    const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'mc-ui-evidence-')));
    const artifacts = path.join(root, 'artifacts');
    mkdirSync(artifacts, { mode: 0o700 });
    const expected = { mcSourceSha: 'a'.repeat(40), mcBuildHash: 'b'.repeat(64) };
    assert.equal(readUiControlEvidenceV1({ artifacts, hash: null, ...expected }).availability.state, 'unconfigured');
    assert.equal(readUiControlEvidenceV1({ artifacts, hash: 'c'.repeat(64), ...expected }).availability.state, 'missing');
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
    const screenshotHash = sha(png);
    writeFileSync(path.join(artifacts, screenshotHash + '.png'), png, { mode: 0o600 });
    const report = { schema: 'mission-control.ui-regression.v1', ...expected, mcBuildHash: 'd'.repeat(64), fixtureVersion: 'v1', fixtureHash: 'e'.repeat(64), startedAt: '2026-10-19T10:00:00.000Z', finishedAt: '2026-10-19T10:00:01.000Z', outcome: 'fail', assertions: [{ id: 'home.loaded', status: 'fail', code: 'ASSERT_FAILED' }], screenshots: [{ captureId: 'home-390', route: '/', viewport: { width: 390, height: 800 }, sha256: screenshotHash }] };
    const b = bytes(report), hash = sha(b);
    writeFileSync(path.join(artifacts, hash + '.json'), b, { mode: 0o600 });
    const input = { artifacts, hash, ...expected };
    assert.equal(readUiControlEvidenceV1(input).report!.compatibility, 'historical');
    assert.deepEqual(readUiControlScreenshotV1({ ...input, captureId: 'home-390' }), png);
    assert.throws(() => readUiControlScreenshotV1({ ...input, captureId: '../secret' }));
    writeFileSync(path.join(artifacts, screenshotHash + '.png'), Buffer.from('bad'));
    assert.equal(readUiControlEvidenceV1(input).availability.state, 'invalid');
    chmodSync(path.join(artifacts, hash + '.json'), 0o644);
    assert.equal(readUiControlEvidenceV1(input).availability.state, 'unsafe');
});
test('canonical UI report bytes are required even when a noncanonical blob has a matching hash', () => {
    const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'mc-ui-evidence-')));
    const report = { schema: 'mission-control.ui-regression.v1', mcSourceSha: 'a'.repeat(40), mcBuildHash: 'b'.repeat(64), fixtureVersion: 'v1', fixtureHash: 'c'.repeat(64), startedAt: '2026-10-19T10:00:00.000Z', finishedAt: null, outcome: 'incomplete', assertions: [], screenshots: [] };
    const b = Buffer.from(JSON.stringify(report, null, 2) + '\n'), hash = sha(b);
    writeFileSync(path.join(root, hash + '.json'), b, { mode: 0o600 });
    assert.equal(readUiControlEvidenceV1({ artifacts: root, hash, mcSourceSha: report.mcSourceSha, mcBuildHash: report.mcBuildHash }).availability.state, 'invalid');
});
test('HTTP evidence wrapper preserves strict projection and rejects extra fields and invalid selection metadata', async () => {
    const { parseControlEvidenceEnvelopeV1, unavailableControlEvidenceEnvelopeV1 } = await import('./control-evidence.js');
    const schemas = await import(new URL('../../../setfarm-dashboard-cutover-controller-20261007-v1/src/execution/schemas/manual-control-job-v1.ts', import.meta.url).href);
    const parse = (value: unknown) => parseControlEvidenceEnvelopeV1(value, (p: unknown) => schemas.ControlEvidenceProjectionV1Schema.parse(p));
    const envelope = unavailableControlEvidenceEnvelopeV1();
    assert.equal(parse(envelope).selectionHash, null);
    for (const invalid of [{ ...envelope, sql: {} }, { ...envelope, selectionHash: '/secret' }, { ...envelope, history: [{ id: 'a'.repeat(64), sourceSha: 'b'.repeat(40), evidence: { activation: {}, evaluation: {} } }] },
        { ...envelope, evidence: { ...envelope.evidence, rawLog: 'secret' } },
    ])
        assert.throws(() => parse(invalid));
});
