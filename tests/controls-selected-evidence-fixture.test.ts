import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { compileFunction } from 'node:vm';
import ts from 'typescript';
import { parseControlEvidenceEnvelopeV1 } from '../src/lib/control-evidence';

const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const absent = { availability: { state: 'unconfigured', code: 'FIXTURE_UNCONFIGURED' }, report: null };
const globalEnvelope = { schema: 'mission-control.controls-evidence-envelope.v1', selectionHash: 'a'.repeat(64),
  evidence: { activation: absent, evaluation: absent, ui: absent }, history: [] };
const selectedEnvelope = { ...globalEnvelope, selectionHash: 'b'.repeat(64) };

// Execute the actual router without importing its server/browser lifecycle or making a listener.
function router() {
  const source = readFileSync(new URL('../scripts/ui-regression-fixtures.mjs', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('ui-regression-fixtures.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const nodes = ast.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === 'fixtureResponse');
  assert.equal(nodes.length, 1);
  return compileFunction(nodes[0].getText(ast) + '\nreturn fixtureResponse;', ['FIXED_GETS'])([
    { target: '/fixed', body: { fixed: true } },
  ]);
}
function state(refs: Record<string, string> = {}) {
  return { requests: [], unexpected: [], evidence: globalEnvelope,
    jobs: new Map([[A, { jobId: A, selectionHash: 'b'.repeat(64), reportRefs: refs }]]),
    jobEvidence: new Map<string, unknown>() };
}
const get = (route: ReturnType<typeof router>, current: ReturnType<typeof state>, target: string) =>
  route(current, 'GET', new URL(target, 'http://fixture.invalid'), null, target);

test('exact job evidence uses its configured map rather than the receipt prefix or global envelope', async () => {
  const current = state({ activationHash: 'c'.repeat(64) });
  current.jobEvidence.set(A, selectedEnvelope);
  const value = await get(router(), current, `/api/controls/jobs/${A}/evidence`);
  assert.deepEqual(parseControlEvidenceEnvelopeV1(value), selectedEnvelope);
  assert.notEqual(value, globalEnvelope);
  assert.deepEqual(current.requests, [{ method: 'GET', path: `/api/controls/jobs/${A}/evidence` }]);
});

test('known job without final refs has strict unavailable projections and no global alias', async () => {
  const value = await get(router(), state(), `/api/controls/jobs/${A}/evidence`);
  assert.deepEqual(parseControlEvidenceEnvelopeV1(value), selectedEnvelope);
  assert.equal(value.history.length, 0);
  for (const report of Object.values(value.evidence) as any[]) {
    assert.equal(report.availability.state, 'unconfigured');
    assert.equal(report.report, null);
  }
});

test('unknown job evidence is 404 even when the evidence map contains an orphan', async () => {
  const current = state();
  current.jobEvidence.set(B, selectedEnvelope);
  assert.deepEqual(await get(router(), current, `/api/controls/jobs/${B}/evidence`),
    { __fixtureStatus: 404, error: 'CONTROL_JOB_NOT_FOUND' });
});

test('a referenced report without configured job evidence fails explicitly rather than borrowing global data', async () => {
  for (const key of ['activationHash', 'resultHash', 'gateHash', 'uiReportHash']) {
    const value = await get(router(), state({ [key]: 'c'.repeat(64) }), `/api/controls/jobs/${A}/evidence`);
    assert.deepEqual(value, { __fixtureStatus: 500, error: 'UI_FIXTURE_JOB_EVIDENCE_UNCONFIGURED' });
  }
});

test('global, receipt and fixed GET routes preserve their existing response contracts', async () => {
  const route = router(), current = state();
  assert.equal(await get(route, current, '/api/controls/evidence'), globalEnvelope);
  assert.deepEqual(await get(route, current, `/api/controls/jobs/${A}`), { receipt: current.jobs.get(A) });
  assert.deepEqual(await get(route, current, '/api/controls/jobs'), { jobs: [...current.jobs.values()] });
  assert.deepEqual(await get(route, current, '/fixed'), { fixed: true });
  assert.deepEqual(current.unexpected, []);
});
