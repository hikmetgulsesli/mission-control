import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseControlEvidenceEnvelopeV1, parseControlJobReceiptV1 } from '../src/lib/control-evidence';
import type { ControlEvidenceEnvelopeV1, ControlJobReceiptV1 } from '../src/lib/control-evidence';
import type { SelectedControlEvidenceDepsV1, SelectedControlEvidenceStateV1 } from '../src/lib/control-selected-evidence';

const A = '00000000-0000-4000-8000-000000000001', B = '00000000-0000-4000-8000-000000000002';
const H = 'a'.repeat(64), R = 'b'.repeat(64), G = 'c'.repeat(64), U = 'd'.repeat(64);
const T = '2026-10-19T00:00:00.000Z';
const unavailable = { availability: { state: 'unconfigured', code: 'REPORT_UNCONFIGURED' }, report: null };
function receipt(jobId = A, revision = 5, patch: Partial<ControlJobReceiptV1> = {}): ControlJobReceiptV1 {
  return parseControlJobReceiptV1({ schema: 'mission-control.control-job.v1', jobId, kind: 'activation_preflight', revision,
    selectionHash: H, sourceSha: 'b'.repeat(40), mcSourceSha: 'c'.repeat(40), mcBuildHash: H, suiteHash: null,
    state: 'running', requestedAt: T, startedAt: T, updatedAt: T, finishedAt: null, phase: 'checking', code: null,
    currentCaseId: null, ownedRunId: null, completedCases: 0, plannedCases: 0, reportRefs: {}, cancelRequested: false, ...patch });
}
function evidence(patch: Partial<ControlEvidenceEnvelopeV1['evidence']> = {}): ControlEvidenceEnvelopeV1 {
  return parseControlEvidenceEnvelopeV1({ schema: 'mission-control.controls-evidence-envelope.v1', selectionHash: 'e'.repeat(64),
    evidence: { activation: unavailable, evaluation: unavailable, ui: unavailable, ...patch }, history: [] });
}
function activation(hash = H) {
  return { availability: { state: 'available' as const, code: null }, report: { hash, status: 'pass' as const,
    protocol: 'v3' as const, compatibility: 'historical' as const, observedAt: T,
    checks: [{ id: 'selected-check', status: 'pass' as const, blocking: true, code: 'SELECTED_PASS' }] } };
}
function evaluation(gateHash: string | null = G) {
  return { availability: { state: 'available' as const, code: null }, report: { resultHash: R, gateHash,
    compatibility: 'historical' as const, executionMode: 'execute' as const, resultStatus: 'pass' as const,
    gateDecision: 'go' as const, qualification: 'historical' as const, preflightChecks: [], cases: [],
    completedCases: 8, plannedCases: 8 as const, blockerCodes: [] } };
}
function ui() {
  return { availability: { state: 'available' as const, code: null }, report: { hash: U, compatibility: 'historical' as const,
    mcSourceSha: 'c'.repeat(40), mcBuildHash: H, fixtureVersion: 'selected-v1', fixtureHash: R,
    startedAt: T, finishedAt: T, outcome: 'pass' as const, assertions: [{ id: 'ui-check', status: 'pass' as const, code: null }],
    screenshots: [{ captureId: 'ui-capture', route: '/controls', viewport: { width: 800, height: 600 }, sha256: G }] } };
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
// Drain only deterministic promise continuations; no timer, HTTP, browser or runtime dependency.
async function drain() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
async function harness() {
  const { ControlSelectedEvidenceV1 } = await import('../src/lib/control-selected-evidence');
  const receipts: { args: string[]; wait: ReturnType<typeof deferred<ControlJobReceiptV1>> }[] = [];
  const reports: { args: string[]; wait: ReturnType<typeof deferred<ControlEvidenceEnvelopeV1>> }[] = [];
  const states: SelectedControlEvidenceStateV1[] = [], accepted: ControlJobReceiptV1[] = [];
  const deps: SelectedControlEvidenceDepsV1 = {
    readReceipt: (...args: [string]) => { const wait = deferred<ControlJobReceiptV1>(); receipts.push({ args, wait }); return wait.promise; },
    readEvidence: (...args: [string]) => { const wait = deferred<ControlEvidenceEnvelopeV1>(); reports.push({ args, wait }); return wait.promise; },
    publish: state => { states.push(state); }, acceptedReceipt: value => { accepted.push(value); },
  };
  const dependencyReads: PropertyKey[] = [];
  const owner = new ControlSelectedEvidenceV1(new Proxy(deps, {
    get: (target, key, receiver) => { dependencyReads.push(key); return Reflect.get(target, key, receiver); },
  }));
  return { owner, receipts, reports, states, accepted, dependencyReads, dependencyKeys: Object.keys(deps), state: () => states.at(-1)! };
}

test('construction, activation and null scope are inert and dependencies have no mutation authority', async () => {
  const h = await harness();
  assert.equal(h.receipts.length + h.reports.length, 0);
  h.owner.activate(); h.owner.select(null); await h.owner.refresh(); await h.owner.refreshReceipt();
  assert.equal(h.receipts.length + h.reports.length, 0);
  assert.deepEqual(h.state(), { boundJobId: null, status: 'idle', receipt: null, envelope: null, error: null });
  h.owner.select(A);
  assert.deepEqual(h.receipts.map(x => x.args), [[A]]);
  h.receipts[0]!.wait.resolve(receipt()); await drain();
  assert.deepEqual(h.reports.map(x => x.args), [[A]]);
  assert.deepEqual(h.accepted, [receipt()]);
  // Exact capability and argument spies establish the owner boundary; page/session behavior has separate coverage.
  assert.deepEqual(h.dependencyKeys.sort(), ['acceptedReceipt', 'publish', 'readEvidence', 'readReceipt']);
  assert.deepEqual([...new Set(h.dependencyReads)].sort(), ['acceptedReceipt', 'publish', 'readEvidence', 'readReceipt']);
  assert.equal('launch' in h.owner || 'cancel' in h.owner || 'setSelection' in h.owner || 'prepareNew' in h.owner, false);
});

for (const reject of [false, true]) {
  test(`A evidence is detached across B and A reconnect after late ${reject ? 'error' : 'success'}`, async () => {
    const h = await harness(); h.owner.activate(); h.owner.select(A, receipt());
    h.owner.select(B, receipt(B));
    assert.deepEqual(h.state(), { boundJobId: B, status: 'loading', receipt: receipt(B), envelope: null, error: null });
    h.reports[1]!.wait.resolve(evidence()); await drain(); assert.equal(h.state().status, 'ready');
    h.owner.select(A, receipt(A, 6)); h.reports[2]!.wait.resolve(evidence()); await drain(); const ready = h.state();
    if (reject) h.reports[0]!.wait.reject(new Error('OLD_A_EVIDENCE')); else h.reports[0]!.wait.resolve(evidence({ activation: activation() }));
    await drain(); assert.strictEqual(h.state(), ready); assert.equal(h.receipts.length, 0);
  });
  test(`A held receipt cannot overwrite B ready after late ${reject ? 'error' : 'success'}`, async () => {
    const h = await harness(); h.owner.activate(); h.owner.select(A); h.owner.select(B);
    h.receipts[1]!.wait.resolve(receipt(B)); await drain(); h.reports[0]!.wait.resolve(evidence()); await drain();
    const ready = h.state(); assert.equal(ready.boundJobId, B); assert.equal(ready.status, 'ready');
    if (reject) h.receipts[0]!.wait.reject(new Error('OLD_A')); else h.receipts[0]!.wait.resolve(receipt(A, 99));
    await drain(); assert.strictEqual(h.state(), ready); assert.equal(h.accepted.length, 1);
  });
  test(`A1 held receipt cannot overwrite A2 after A-B-A late ${reject ? 'error' : 'success'}`, async () => {
    const h = await harness(); h.owner.activate(); h.owner.select(A); h.owner.select(B); h.owner.select(A);
    h.receipts[2]!.wait.resolve(receipt(A, 6)); await drain(); h.reports[0]!.wait.resolve(evidence()); await drain();
    const ready = h.state();
    if (reject) h.receipts[0]!.wait.reject(new Error('OLD_A1')); else h.receipts[0]!.wait.resolve(receipt(A, 99));
    h.receipts[1]!.wait.reject(new Error('OLD_B')); await drain();
    assert.strictEqual(h.state(), ready); assert.equal(h.accepted.length, 1);
  });
  test(`dispose and reactivate invalidate held receipt and evidence ${reject ? 'errors' : 'successes'}`, async () => {
    const h = await harness(); h.owner.activate(); h.owner.select(A, receipt());
    const oldReceipt = h.owner.refreshReceipt();
    h.owner.dispose(); h.owner.activate(); h.owner.select(A, receipt(A, 6));
    h.reports[1]!.wait.resolve(evidence()); await drain(); const ready = h.state();
    if (reject) { h.receipts[0]!.wait.reject(new Error('OLD_RECEIPT')); h.reports[0]!.wait.reject(new Error('OLD_EVIDENCE')); }
    else { h.receipts[0]!.wait.resolve(receipt(A, 99)); h.reports[0]!.wait.resolve(evidence()); }
    await oldReceipt; await drain(); assert.strictEqual(h.state(), ready);
  });
  test(`terminal receipt stamp invalidates revision-5 empty-ref evidence late ${reject ? 'error' : 'unconfigured'}`, async () => {
    const h = await harness(); h.owner.activate(); h.owner.select(A, receipt());
    h.owner.acceptReceipt(receipt(A, 6, { state: 'completed', finishedAt: T, reportRefs: { activationHash: H } }));
    h.reports[1]!.wait.resolve(evidence({ activation: activation() })); await drain(); const ready = h.state();
    assert.equal(ready.envelope?.evidence.activation.report?.hash, H);
    if (reject) h.reports[0]!.wait.reject(new Error('OLD_E1')); else h.reports[0]!.wait.resolve(evidence());
    await drain(); assert.strictEqual(h.state(), ready); assert.equal(h.receipts.length, 0);
  });
}

test('receipt polling settles while evidence is held and equal stamps do not refetch', async () => {
  const h = await harness(); h.owner.activate(); h.owner.select(A);
  const poll = h.owner.refreshReceipt(); h.receipts[1]!.wait.resolve(receipt()); await poll;
  assert.equal(h.reports.length, 1); assert.equal(h.state().status, 'loading');
  const again = h.owner.refreshReceipt(); h.receipts[2]!.wait.resolve(receipt()); await again;
  assert.equal(h.reports.length, 1);
  h.receipts[0]!.wait.resolve(receipt(A, 4)); await drain(); assert.equal(h.state().receipt?.revision, 5);
});

test('receipt revision and definitive terminal monotonicity reject stale progress but accept same-revision ref safety changes', async () => {
  const h = await harness(); h.owner.activate(); h.owner.select(A, receipt(A, 6, { state: 'completed', finishedAt: T, reportRefs: { activationHash: H } }));
  h.reports[0]!.wait.resolve(evidence({ activation: activation() })); await drain(); const ready = h.state();
  h.owner.acceptReceipt(receipt(A, 5)); h.owner.acceptReceipt(receipt(A, 6)); h.owner.acceptReceipt(receipt(B, 99));
  assert.strictEqual(h.state(), ready); assert.equal(h.accepted.length, 1);
  h.owner.acceptReceipt(receipt(A, 6, { state: 'completed', finishedAt: T, reportRefs: { activationHash: R } }));
  assert.equal(h.state().envelope, null); assert.equal(h.reports.length, 2);
  h.reports[1]!.wait.resolve(evidence({ activation: activation(R) })); await drain();
  assert.equal(h.state().envelope?.evidence.activation.report?.hash, R);
});

test('same-revision state, finishedAt and each ordered ref change invalidate evidence; ref insertion order does not', async () => {
  const h = await harness(); h.owner.activate(); let current = receipt(); h.owner.select(A, current);
  const patches: Partial<ControlJobReceiptV1>[] = [
    { state: 'cancelling' }, { state: 'completed', finishedAt: T },
    { reportRefs: { activationHash: H } }, { reportRefs: { activationHash: H, resultHash: R } },
    { reportRefs: { activationHash: H, resultHash: R, gateHash: G } },
    { reportRefs: { activationHash: H, resultHash: R, gateHash: G, uiReportHash: U } },
  ];
  for (const patch of patches) { current = { ...current, ...patch }; h.owner.acceptReceipt(current); }
  assert.equal(h.reports.length, 7);
  h.owner.acceptReceipt({ ...current, reportRefs: { uiReportHash: U, gateHash: G, resultHash: R, activationHash: H } });
  assert.equal(h.reports.length, 7);
});

test('older sequence errors and equal revisions cannot replace newer selected read outcome', async () => {
  const h = await harness(); h.owner.activate(); h.owner.select(A);
  const first = h.owner.refreshReceipt(), latest = h.owner.refreshReceipt();
  h.receipts[2]!.wait.resolve(receipt(A, 6)); await latest; h.reports[0]!.wait.resolve(evidence()); await drain();
  const ready = h.state(); h.receipts[1]!.wait.reject(new Error('LATE_OLD_ERROR')); await first;
  h.receipts[0]!.wait.resolve(receipt(A, 6, { state: 'cancelling' })); await drain();
  assert.strictEqual(h.state(), ready);
});

test('an older receipt request may advance a strictly newer revision while newer request remains pending', async () => {
  const h = await harness(); h.owner.activate(); h.owner.select(A, receipt());
  const older = h.owner.refreshReceipt(), newer = h.owner.refreshReceipt();
  h.receipts[0]!.wait.resolve(receipt(A, 6)); await older;
  assert.equal(h.state().receipt?.revision, 6); assert.equal(h.reports.length, 2);
  h.receipts[1]!.wait.resolve(receipt(A, 5)); await newer; assert.equal(h.state().receipt?.revision, 6);
});

for (const reject of [false, true]) {
  test(`older higher revision cannot overwrite a settled newer receipt ${reject ? 'error' : 'success'}`, async () => {
    const h = await harness(); h.owner.activate(); h.owner.select(A, receipt());
    const older = h.owner.refreshReceipt(), newer = h.owner.refreshReceipt();
    if (reject) h.receipts[1]!.wait.reject(new Error('CONTROL_HTTP_503'));
    else h.receipts[1]!.wait.resolve(receipt(A, 6));
    await newer; const settled = h.state();
    h.receipts[0]!.wait.resolve(receipt(A, 99)); await older;
    assert.strictEqual(h.state(), settled);
  });
}

test('newest manual refresh evidence wins and stale failures cannot detach it', async () => {
  const h = await harness(); h.owner.activate(); h.owner.select(A, receipt());
  const one = h.owner.refresh();
  h.receipts[0]!.wait.resolve(receipt()); await drain();
  const two = h.owner.refresh();
  h.receipts[1]!.wait.resolve(receipt()); await drain();
  assert.equal(h.reports.length, 3);
  h.reports[2]!.wait.resolve(evidence()); await two; const ready = h.state();
  h.reports[1]!.wait.reject(new Error('OLD_REFRESH')); await one;
  h.reports[0]!.wait.reject(new Error('OLD_INITIAL')); await drain();
  assert.strictEqual(h.state(), ready);
});

test('selected receipt and evidence errors expose their bounded code and detach unverified reports', async () => {
  const h = await harness(); h.owner.activate(); h.owner.select(A);
  h.receipts[0]!.wait.reject(new Error('CONTROL_JOB_NOT_FOUND')); await drain();
  assert.equal(h.state().error, 'CONTROL_JOB_NOT_FOUND'); assert.equal(h.state().boundJobId, A);
  h.owner.acceptReceipt(receipt()); h.reports[0]!.wait.reject(new Error('/private/secret')); await drain();
  assert.equal(h.state().error, 'CONTROL_RESPONSE_INVALID'); assert.equal(h.state().envelope, null);
});

test('evidence ahead of receipt gets one bounded reconciliation and a matching follow-up evidence read', async () => {
  const h = await harness(); h.owner.activate(); h.owner.select(A, receipt());
  h.reports[0]!.wait.resolve(evidence({ activation: activation() })); await drain();
  assert.equal(h.receipts.length, 1); assert.equal(h.state().envelope, null);
  h.receipts[0]!.wait.resolve(receipt(A, 6, { state: 'completed', finishedAt: T, reportRefs: { activationHash: H } })); await drain();
  assert.equal(h.reports.length, 2);
  h.reports[1]!.wait.resolve(evidence({ activation: activation() })); await drain();
  assert.equal(h.state().status, 'ready'); assert.equal(h.state().receipt?.revision, 6);
});

test('persistent mismatch gets exactly one receipt and follow-up evidence then stays out of sync until actual advance', async () => {
  const h = await harness(); h.owner.activate(); h.owner.select(A, receipt());
  h.reports[0]!.wait.resolve(evidence({ activation: activation() })); await drain();
  h.receipts[0]!.wait.resolve(receipt()); await drain(); assert.equal(h.reports.length, 2);
  h.reports[1]!.wait.resolve(evidence({ activation: activation() })); await drain();
  assert.equal(h.state().status, 'error'); assert.equal(h.state().error, 'CONTROL_SELECTED_EVIDENCE_OUT_OF_SYNC');
  assert.equal(h.state().envelope, null); assert.equal(h.receipts.length, 1); assert.equal(h.reports.length, 2);
  h.owner.acceptReceipt(receipt(A, 6, { reportRefs: { activationHash: H } }));
  h.reports[2]!.wait.resolve(evidence({ activation: activation() })); await drain(); assert.equal(h.state().status, 'ready');
});

test('a settled same-stamp poll cannot leave superseded reconciliation stuck loading', async () => {
  const h = await harness(); h.owner.activate(); h.owner.select(A, receipt());
  h.reports[0]!.wait.resolve(evidence({ activation: activation() })); await drain();
  const poll = h.owner.refreshReceipt(); h.receipts[1]!.wait.resolve(receipt()); await poll;
  h.receipts[0]!.wait.resolve(receipt(A, 6, { reportRefs: { activationHash: H } })); await drain();
  assert.equal(h.state().status, 'error'); assert.equal(h.state().error, 'CONTROL_SELECTED_EVIDENCE_OUT_OF_SYNC');
  assert.equal(h.state().receipt?.revision, 5); assert.equal(h.state().envelope, null);
  assert.equal(h.receipts.length, 2); assert.equal(h.reports.length, 1);
});

test('manual refresh supersedes a held reconciliation without an extra evidence read', async () => {
  const h = await harness(); h.owner.activate(); h.owner.select(A, receipt());
  h.reports[0]!.wait.resolve(evidence({ activation: activation() })); await drain();
  const refresh = h.owner.refresh();
  h.receipts[1]!.wait.resolve(receipt(A, 6, { reportRefs: { activationHash: H } })); await drain();
  h.reports[1]!.wait.resolve(evidence({ activation: activation() })); await refresh; const ready = h.state();
  h.receipts[0]!.wait.resolve(receipt(A, 99, { reportRefs: { activationHash: R } })); await drain();
  assert.strictEqual(h.state(), ready); assert.equal(h.reports.length, 2);
});

test('null selection invalidates held evidence and clears all local provenance', async () => {
  const h = await harness(); h.owner.activate(); h.owner.select(A, receipt()); h.owner.select(null);
  const idle = h.state(); h.reports[0]!.wait.resolve(evidence({ activation: activation() })); await drain();
  assert.deepEqual(idle, { boundJobId: null, status: 'idle', receipt: null, envelope: null, error: null });
  assert.strictEqual(h.state(), idle); assert.equal(h.receipts.length, 0);
});

test('reconciliation receipt errors remain bounded and never start a follow-up evidence read', async () => {
  const h = await harness(); h.owner.activate(); h.owner.select(A, receipt());
  h.reports[0]!.wait.resolve(evidence({ activation: activation() })); await drain();
  h.receipts[0]!.wait.reject(new Error('CONTROL_HTTP_503')); await drain();
  assert.equal(h.state().status, 'error'); assert.equal(h.state().error, 'CONTROL_HTTP_503');
  assert.equal(h.state().envelope, null); assert.equal(h.reports.length, 1);
});

test('all three hash families bind and historical DTO content is preserved exactly', async () => {
  const h = await harness(); h.owner.activate();
  h.owner.select(A, receipt(A, 6, { state: 'completed', finishedAt: T,
    reportRefs: { activationHash: H, resultHash: R, gateHash: G, uiReportHash: U } }));
  const dto = evidence({ activation: activation(), evaluation: evaluation(), ui: ui() });
  h.reports[0]!.wait.resolve(dto); await drain(); assert.strictEqual(h.state().envelope, dto);
  assert.equal(h.state().envelope?.evidence.evaluation.report?.qualification, 'historical');
  assert.equal(h.state().envelope?.selectionHash, 'e'.repeat(64));
});

for (const [family, refs, report] of [
  ['activation', { activationHash: R }, { activation: activation() }],
  ['evaluation result', { resultHash: H, gateHash: G }, { evaluation: evaluation() }],
  ['evaluation gate', { resultHash: R, gateHash: H }, { evaluation: evaluation() }],
  ['evaluation absent gate', { resultHash: R }, { evaluation: evaluation() }],
  ['ui', { uiReportHash: H }, { ui: ui() }],
] as const) {
  test(`mismatched ${family} cannot display a qualified report`, async () => {
    const h = await harness(); h.owner.activate(); const current = receipt(A, 6, { reportRefs: refs }); h.owner.select(A, current);
    h.reports[0]!.wait.resolve(evidence(report)); await drain(); h.receipts[0]!.wait.resolve(current); await drain();
    h.reports[1]!.wait.resolve(evidence(report)); await drain();
    assert.equal(h.state().error, 'CONTROL_SELECTED_EVIDENCE_OUT_OF_SYNC'); assert.equal(h.state().envelope, null);
  });
}

test('absent receipt gate binds a null report gate', async () => {
  const h = await harness(); h.owner.activate(); h.owner.select(A, receipt(A, 6, { reportRefs: { resultHash: R } }));
  h.reports[0]!.wait.resolve(evidence({ evaluation: evaluation(null) })); await drain(); assert.equal(h.state().status, 'ready');
});

for (const state of ['missing', 'invalid', 'unsafe', 'unconfigured'] as const) {
  test(`terminal ${state} projection remains unavailable with its server code`, async () => {
    const h = await harness(); h.owner.activate(); h.owner.select(A, receipt(A, 6, { state: 'completed', finishedAt: T,
      reportRefs: { activationHash: H, resultHash: R, gateHash: G, uiReportHash: U } }));
    const absent = { availability: { state, code: `REPORT_${state.toUpperCase()}` }, report: null };
    const dto = evidence({ activation: absent, evaluation: absent, ui: absent }); h.reports[0]!.wait.resolve(dto); await drain();
    assert.strictEqual(h.state().envelope, dto); assert.equal(h.state().status, 'ready'); assert.equal(h.receipts.length, 0);
  });
}
