import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseControlEvidenceEnvelopeV1, parseControlJobReceiptV1, readPendingControlLaunchV1, writePendingControlLaunchV1 } from '../src/lib/control-evidence';

const hash = 'a'.repeat(64), source = 'b'.repeat(40);
const unavailable = { availability: { state: 'unconfigured', code: 'REPORT_UNCONFIGURED' }, report: null };
const envelope = { schema: 'mission-control.controls-evidence-envelope.v1', selectionHash: hash, evidence: { activation: unavailable, evaluation: unavailable, ui: unavailable }, history: [] };
const receipt = { schema: 'mission-control.control-job.v1', jobId: '00000000-0000-4000-8000-000000000001', kind: 'activation_preflight', revision: 0, selectionHash: hash, sourceSha: source, mcSourceSha: source, mcBuildHash: hash, suiteHash: null, state: 'accepted', requestedAt: '2026-10-19T00:00:00.000Z', startedAt: null, updatedAt: '2026-10-19T00:00:00.000Z', finishedAt: null, phase: 'starting', code: null, currentCaseId: null, ownedRunId: null, completedCases: 0, plannedCases: 0, reportRefs: {}, cancelRequested: false };

test('strict evidence envelope refuses extra keys and fabricated available reports', () => {
  assert.equal(parseControlEvidenceEnvelopeV1(envelope).selectionHash, hash);
  assert.throws(() => parseControlEvidenceEnvelopeV1({ ...envelope, privatePath: '/tmp/secret' }));
  assert.throws(() => parseControlEvidenceEnvelopeV1({ ...envelope, evidence: { ...envelope.evidence, activation: { availability: { state: 'available', code: null }, report: null } } }));
  assert.throws(() => parseControlEvidenceEnvelopeV1({ ...envelope, selectionHash: 'not-a-hash' }));
});

test('receipt parser refuses extra authority fields and invalid progress', () => {
  assert.equal(parseControlJobReceiptV1(receipt).jobId, receipt.jobId);
  assert.throws(() => parseControlJobReceiptV1({ ...receipt, installationDir: '/private' }));
  assert.throws(() => parseControlJobReceiptV1({ ...receipt, completedCases: 2, plannedCases: 1 }));
});

test('pending launch persists exact kind, selection and key, refusing malformed storage', () => {
  let value: string | null = null;
  const storage = { getItem: () => value, setItem: (_key: string, next: string) => { value = next; }, removeItem: () => { value = null; } };
  const pending = { kind: 'activation_preflight' as const, expectedSelectionHash: hash, idempotencyKey: '00000000-0000-4000-8000-000000000002' };
  writePendingControlLaunchV1(storage, pending);
  assert.deepEqual(readPendingControlLaunchV1(storage), pending);
  value = JSON.stringify({ ...pending, installationDir: '/private' });
  assert.equal(readPendingControlLaunchV1(storage), null);
});

test('control API uses auth and no-store, serializes only fixed launch and cancel bodies', async () => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const previousFetch = globalThis.fetch;
  const seen: { url: string; init: RequestInit }[] = [];
  try {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { querySelector: () => ({ content: 'test-token' }) } });
    globalThis.fetch = async (url, init) => {
      seen.push({ url: String(url), init: init || {} });
      const body = String(url).endsWith('/evidence') ? envelope : String(url).endsWith('/jobs') && init?.method === 'POST' ? { receipt, replay: false } : String(url).endsWith('/cancel') ? { receipt, replay: false } : String(url).endsWith('/jobs') ? { jobs: [receipt] } : { receipt };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const { controlsApi } = await import('../src/lib/api');
    await controlsApi.evidence();
    await controlsApi.jobs();
    await controlsApi.job(receipt.jobId);
    const originalLaunch = controlsApi.launch, originalCancel = controlsApi.cancel;
    let mutations = 0;
    try {
      controlsApi.launch = async () => { mutations++; throw new Error('UNEXPECTED_LAUNCH'); };
      controlsApi.cancel = async () => { mutations++; throw new Error('UNEXPECTED_CANCEL'); };
      assert.deepEqual(await controlsApi.jobEvidence(receipt.jobId), envelope);
      assert.equal(mutations, 0);
    } finally { controlsApi.launch = originalLaunch; controlsApi.cancel = originalCancel; }
    await controlsApi.launch({ kind: 'activation_preflight', expectedSelectionHash: hash, idempotencyKey: '00000000-0000-4000-8000-000000000002' });
    await controlsApi.cancel(receipt.jobId, { idempotencyKey: '00000000-0000-4000-8000-000000000003', expectedRevision: 0 });
    assert.equal(seen.length, 6);
    assert.ok(seen.every(({ init }) => init.cache === 'no-store' && new Headers(init.headers).get('X-MC-Token') === 'test-token'));
    assert.deepEqual(JSON.parse(String(seen[4]!.init.body)), { kind: 'activation_preflight', idempotencyKey: '00000000-0000-4000-8000-000000000002', expectedSelectionHash: hash });
    assert.deepEqual(Object.keys(JSON.parse(String(seen[4]!.init.body))).sort(), ['expectedSelectionHash', 'idempotencyKey', 'kind']);
    assert.deepEqual(JSON.parse(String(seen[5]!.init.body)), { idempotencyKey: '00000000-0000-4000-8000-000000000003', expectedRevision: 0 });
    assert.deepEqual(Object.keys(JSON.parse(String(seen[5]!.init.body))).sort(), ['expectedRevision', 'idempotencyKey']);
    assert.equal(seen[2]!.url, `/api/controls/jobs/${receipt.jobId}`);
    assert.equal(seen[3]!.url, `/api/controls/jobs/${receipt.jobId}/evidence`);
    assert.equal(seen[3]!.init.method, 'GET');
    assert.equal(Object.hasOwn(seen[3]!.init, 'body'), false);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('job evidence validates ID before fetch and preserves bounded refusal codes and strict envelopes', async () => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  let body = JSON.stringify(envelope), status = 200;
  try {
    globalThis.fetch = async () => { calls++; return new Response(body, { status }); };
    const { controlsApi } = await import('../src/lib/api');
    for (const id of ['', '../evidence', `${receipt.jobId}/cancel`, receipt.jobId.toUpperCase().replace('0000', 'ZZZZ')]) {
      await assert.rejects(controlsApi.jobEvidence(id), /^Error: CONTROL_JOB_ID_INVALID$/);
    }
    assert.equal(calls, 0);
    for (const [httpStatus, response, code] of [
      [404, { error: 'CONTROL_JOB_NOT_FOUND' }, 'CONTROL_JOB_NOT_FOUND'],
      [503, { error: 'CONTROL_EVIDENCE_UNAVAILABLE' }, 'CONTROL_EVIDENCE_UNAVAILABLE'],
      [503, { error: '/private/path' }, 'CONTROL_HTTP_503'],
    ] as const) {
      status = httpStatus; body = JSON.stringify(response);
      await assert.rejects(controlsApi.jobEvidence(receipt.jobId), new RegExp(`^Error: ${code}$`));
    }
    status = 200;
    for (const response of [
      '{', JSON.stringify({ envelope }), JSON.stringify({ ...envelope, receipt }),
      JSON.stringify({ ...envelope, evidence: { ...envelope.evidence, activation: { availability: { state: 'available', code: null }, report: null } } }),
    ]) {
      body = response;
      await assert.rejects(controlsApi.jobEvidence(receipt.jobId), /^Error: CONTROL_RESPONSE_INVALID$/);
    }
  } finally { globalThis.fetch = previousFetch; }
});
