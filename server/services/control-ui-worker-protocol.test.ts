import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UiRegressionReportV1Schema, UiRegressionCleanupProofV1Schema } from './control-ui-worker-protocol.js';
const report = { schema: 'mission-control.ui-regression.v1', mcSourceSha: 'a'.repeat(40), mcBuildHash: 'b'.repeat(64),
    fixtureVersion: 'v1', fixtureHash: 'c'.repeat(64), startedAt: '2026-10-19T10:00:00.000Z', finishedAt: null, outcome: 'incomplete',
    assertions: [{ id: 'home.loaded', status: 'pass', code: null }], screenshots: [] };
test('pure report validator rejects extra fields, duplicate IDs and unsafe screenshot paths', () => {
    assert.deepEqual(UiRegressionReportV1Schema.parse(report), report);
    for (const value of [{ ...report, token: 'secret' }, { ...report, assertions: [...report.assertions, ...report.assertions] },
        { ...report, screenshots: [{ captureId: '../secret', route: '/', viewport: { width: 390, height: 800 }, sha256: 'd'.repeat(64) }] }])
        assert.throws(() => UiRegressionReportV1Schema.parse(value));
});
test('cleanup schema refuses unconfirmed children and foreign fields', () => {
    const proof = { schema: 'mission-control.ui-regression-cleanup.v1', jobId: '018d819f-0a78-7d38-bb1f-0195b029ddaf',
        intentHash: 'a'.repeat(64), ownerHash: 'b'.repeat(64), mcSourceSha: 'c'.repeat(40), mcBuildHash: 'd'.repeat(64), fixtureHash: 'e'.repeat(64),
        uiReportHash: 'f'.repeat(64), server: 'not_started', browser: 'not_started', children: [] };
    assert.deepEqual(UiRegressionCleanupProofV1Schema.parse(proof), proof);
    assert.throws(() => UiRegressionCleanupProofV1Schema.parse({ ...proof, server: 'unknown' }));
    assert.throws(() => UiRegressionCleanupProofV1Schema.parse({ ...proof, children: [{ spawnId: proof.jobId, owner: null, state: 'closed' }] }));
});
