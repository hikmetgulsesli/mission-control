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
const nativeOwner = { kind: 'native_browser', pid: 23456, processStartedAt: '2026-10-19T10:00:00.000Z', processGroupId: 23456, source: 'observed_os', executable: '/private/chrome-headless-shell', commandHash: 'a'.repeat(64) };
const closedProof = { schema: 'mission-control.ui-regression-cleanup.v1', jobId: '018d819f-0a78-7d38-bb1f-0195b029ddaf', intentHash: 'a'.repeat(64), ownerHash: 'b'.repeat(64), mcSourceSha: 'c'.repeat(40), mcBuildHash: 'd'.repeat(64), fixtureHash: 'e'.repeat(64), uiReportHash: 'f'.repeat(64), server: 'closed', browser: 'closed', children: [{ spawnId: '018d819f-0a78-7d38-bb1f-0195b029ddaf', owner: nativeOwner, state: 'closed' }] };
test('browser closed requires exactly its observed native child and refuses legacy Node or contradictory dispositions', () => {
    assert.deepEqual(UiRegressionCleanupProofV1Schema.parse(closedProof), closedProof);
    for (const bad of [{ ...closedProof, children: [] }, { ...closedProof, browser: 'not_started' },
        { ...closedProof, children: [{ ...closedProof.children[0], owner: { ...nativeOwner, script: '/node-script' } }] },
        { ...closedProof, children: [{ ...closedProof.children[0], state: 'not_started' }] },
        { ...closedProof, children: [{ ...closedProof.children[0], owner: { ...nativeOwner, processGroupId: 100 } }] }])
        assert.throws(() => UiRegressionCleanupProofV1Schema.parse(bad));
});
test('native settlement requires both original terminal events, two separated complete empty censuses and a unique sorted cohort', async () => {
    const { UiWorkerLifecycleRecordV1Schema } = await import('./control-ui-worker-protocol.js');
    const record = { schema: 'mission-control.ui-worker-child-settled.v1', jobId: closedProof.jobId, intentHash: 'a'.repeat(64), spawnId: closedProof.jobId, observedHash: 'b'.repeat(64), method: 'owned-child-process-group-v1', rootExit: { code: 0, signal: null }, rootExitObserved: true, rootCloseObserved: true, transport: 'closed', cohort: [{ owner: nativeOwner, parentPidAtFirstObservation: 12, finalState: 'absent_after_owned_close' }], emptyCensuses: [{ capturedAt: '2026-10-19T10:00:01.000Z', metadataHash: 'c'.repeat(64), groupMemberCount: 0, retainedOwnerCount: 0 }, { capturedAt: '2026-10-19T10:00:01.100Z', metadataHash: 'd'.repeat(64), groupMemberCount: 0, retainedOwnerCount: 0 }] };
    assert.deepEqual(UiWorkerLifecycleRecordV1Schema.parse(record), record);
    for (const bad of [{ ...record, rootExitObserved: false }, { ...record, rootCloseObserved: false }, { ...record, rootExit: { code: null, signal: null } }, { ...record, cohort: [] }, { ...record, cohort: [...record.cohort, ...record.cohort] }, { ...record, emptyCensuses: [record.emptyCensuses[0], { ...record.emptyCensuses[1], capturedAt: '2026-10-19T10:00:01.099Z' }] }, { ...record, emptyCensuses: [record.emptyCensuses[0], { ...record.emptyCensuses[1], retainedOwnerCount: 1 }] }])
        assert.throws(() => UiWorkerLifecycleRecordV1Schema.parse(bad));
});
test('cleanup refuses browser without captured fixture server and settled cohort missing its one group leader', async () => {
    assert.throws(() => UiRegressionCleanupProofV1Schema.parse({ ...closedProof, server: 'not_started' }));
    const { UiWorkerLifecycleRecordV1Schema } = await import('./control-ui-worker-protocol.js');
    const record = { schema: 'mission-control.ui-worker-child-settled.v1', jobId: closedProof.jobId, intentHash: 'a'.repeat(64), spawnId: closedProof.jobId, observedHash: 'b'.repeat(64), method: 'owned-child-process-group-v1', rootExit: { code: 0, signal: null }, rootExitObserved: true, rootCloseObserved: true, transport: 'closed', cohort: [{ owner: { ...nativeOwner, pid: 23457 }, parentPidAtFirstObservation: 23456, finalState: 'absent_after_owned_close' }], emptyCensuses: [{ capturedAt: '2026-10-19T10:00:01.000Z', metadataHash: 'c'.repeat(64), groupMemberCount: 0, retainedOwnerCount: 0 }, { capturedAt: '2026-10-19T10:00:01.100Z', metadataHash: 'd'.repeat(64), groupMemberCount: 0, retainedOwnerCount: 0 }] };
    assert.throws(() => UiWorkerLifecycleRecordV1Schema.parse(record));
});
test('standalone intent is strict audit provenance and cannot contain broker, SF selection or nonce authority', async () => {
    const { UiStandaloneIntentV1Schema } = await import('./control-ui-worker-protocol.js');
    const intent = { schema: 'mission-control.ui-standalone-intent.v1', mode: 'standalone', scenario: 'owned_cancel', jobId: closedProof.jobId, ownerHash: 'a'.repeat(64), mcSourceSha: 'b'.repeat(40), mcBuildHash: 'c'.repeat(64), fixtureVersion: 'v1', fixtureHash: 'd'.repeat(64), requestedAt: '2026-10-19T10:00:00.000Z' };
    assert.deepEqual(UiStandaloneIntentV1Schema.parse(intent), intent);
    for (const extra of [{ nonce: 'secret' }, { installationDir: '/installation' }, { selectionHash: 'e'.repeat(64) }, { channelId: closedProof.jobId }, { scenario: 'arbitrary' }])
        assert.throws(() => UiStandaloneIntentV1Schema.parse({ ...intent, ...extra }));
});
