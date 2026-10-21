import React from 'react';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { HealthChecks } from '../src/components/controls/HealthChecks';
import { TestEvidence } from '../src/components/controls/TestEvidence';
import { ManualTestRequirements } from '../src/components/controls/ManualTestRequirements';
import { Controls, EvidenceHistory } from '../src/pages/Controls';

const ids = ['utility-status-baseline','utility-preference-compositional','operations-work-baseline','operations-queue-paraphrase','game-start-baseline','game-restart-compositional','negative-ambiguous-product','negative-unsupported-kernel'];
const availability = { state: 'available' as const, code: null };
const missing = (state: 'unconfigured' | 'missing' | 'invalid' | 'unsafe') => ({ availability: { state, code: `REPORT_${state.toUpperCase()}` }, report: null });
const activation = { availability, report: { hash: 'b'.repeat(64), status: 'fail' as const, protocol: 'v3' as const, compatibility: 'current' as const, observedAt: null, checks: ['migration_shape','migration_attestation','database','artifact_capacity','activity','protocol_activation'].map((id, index) => ({ id, status: index === 1 ? 'advisory' as const : 'fail' as const, blocking: index !== 1, code: 'CHECK_FAILED' })) } };
const evaluation = { availability, report: { resultHash: 'a'.repeat(64), gateHash: null, compatibility: 'current' as const, executionMode: 'execute' as const, resultStatus: 'blocked' as const, gateDecision: null, qualification: 'unqualified' as const, preflightChecks: ['release_identity','release_cleanliness','migration_attestation','database_ownership','setfarm_health','mission_control_health','execution_profile','result_store'].map(id => ({ id, status: 'pass' as const, code: 'CHECK_PASS' })), cases: ids.map((caseId,index) => ({ caseId,repetition: 1 as const,evidenceState: index < 2 ? 'recorded' as const : 'not_started' as const,disposition: index < 2 ? 'failed' as const : null,passed: index < 2 ? false : null,runId: index < 2 ? `run-${index}` : null,resultHash: index < 2 ? String(index).repeat(64) : null })), completedCases: 2, plannedCases: 8 as const, blockerCodes: ['EVAL_CANCEL_REQUESTED'] } };
const ui = missing('unconfigured');

test('partial full8 renders distinct preflight and case rows, unstarted cases and source qualification', () => {
  const html = renderToStaticMarkup(<TestEvidence evaluation={evaluation} ui={ui} receipt={null} />);
  assert.equal((html.match(/data-testid="control-case-row"/g) ?? []).length, 8);
  assert.equal((html.match(/data-testid="control-preflight-row"/g) ?? []).length, 8);
  assert.equal((html.match(/Not started/g) ?? []).length, 6);
  assert.match(html, /Unqualified|Not qualified/);
  assert.match(html, /2 of 8/);
  assert.match(html, /run-0/);
  assert.match(html, /EVAL_CANCEL_REQUESTED/);
});

test('activation checks retain fail, advisory, blocking and unavailable reason', () => {
  const html = renderToStaticMarkup(<HealthChecks activation={activation} />);
  assert.equal((html.match(/data-testid="activation-check-row"/g) ?? []).length, 6);
  assert.match(html, /Advisory/);
  assert.match(html, /Blocking/);
  assert.match(renderToStaticMarkup(<HealthChecks activation={missing('missing')} />), /REPORT_MISSING/);
});

test('all unavailable states are explicit and planned, historical and no-go are not qualified', () => {
  for (const state of ['unconfigured','missing','invalid','unsafe'] as const) {
    assert.match(renderToStaticMarkup(<TestEvidence evaluation={missing(state)} ui={missing(state)} receipt={null} />), new RegExp(`REPORT_${state.toUpperCase()}`));
  }
  for (const patch of [{ resultStatus: 'planned' as const }, { compatibility: 'historical' as const, qualification: 'historical' as const }, { gateDecision: 'no_go' as const }]) {
    const html = renderToStaticMarkup(<TestEvidence evaluation={{ ...evaluation, report: { ...evaluation.report, ...patch } }} ui={ui} receipt={null} />);
    assert.doesNotMatch(html, /Qualified release/);
  }
});

test('owned progress shows current case, unknown metric and cancellation as request', () => {
  const receipt = { schema: 'mission-control.control-job.v1' as const, jobId: '00000000-0000-4000-8000-000000000001', kind: 'convergence_full8' as const, revision: 2, selectionHash: 'c'.repeat(64), sourceSha: 'd'.repeat(40), mcSourceSha: 'e'.repeat(40), mcBuildHash: 'f'.repeat(64), suiteHash: 'a'.repeat(64), state: 'cancelling' as const, requestedAt: '2026-10-19T00:00:00.000Z', startedAt: null, updatedAt: '2026-10-19T00:00:01.000Z', finishedAt: null, phase: 'case_running', code: null, currentCaseId: ids[0], ownedRunId: 'run-0', completedCases: 0, plannedCases: 8, reportRefs: {}, cancelRequested: true };
  const html = renderToStaticMarkup(<TestEvidence evaluation={missing('unconfigured')} ui={ui} receipt={receipt} />);
  assert.match(html, /Cancellation requested/);
  assert.match(html, /utility-status-baseline/);
  assert.match(html, /run-0/);
  assert.match(html, /0 of 8/);
  assert.match(renderToStaticMarkup(<TestEvidence evaluation={missing('unconfigured')} ui={ui} receipt={null} />), /Unknown|Not available/);
});

test('manual requirements and page render the actual panels', () => {
  assert.match(renderToStaticMarkup(<ManualTestRequirements kind="convergence_full8" />), /48 hours/);
  const html = renderToStaticMarkup(<Controls />);
  assert.match(html, /Controls/);
  assert.match(html, /Activation health/);
  assert.match(html, /Evaluation evidence/);
  assert.match(html, /Manual check/);
});

test('a remembered selected job offers an explicit return to current evidence', () => {
  const selectedKey = 'mission-control.controls.selected-job.v1';
  const rememberedJob = '00000000-0000-4000-8000-000000000001';
  const values = new Map([[selectedKey, rememberedJob]]);
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    },
  } });
  try {
    const html = renderToStaticMarkup(<Controls />);
    assert.match(html, new RegExp(`Reports for selected job.*${rememberedJob}`));
    assert.match(html, /<button[^>]*>Show current evidence<\/button>/);
    assert.equal(values.get(selectedKey), rememberedJob, 'rendering does not silently discard the historical choice');
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('the default current evidence view needs no return action', () => {
  const html = renderToStaticMarkup(<Controls />);
  assert.match(html, /Reports for latest job/);
  assert.doesNotMatch(html, /Show current evidence/);
});

test('receipt and UI report expose safe public source and build identities with provenance', () => {
  const receipt = { schema: 'mission-control.control-job.v1' as const, jobId: '00000000-0000-4000-8000-000000000001', kind: 'activation_preflight' as const, revision: 1, selectionHash: 'c'.repeat(64), sourceSha: 'd'.repeat(40), mcSourceSha: 'e'.repeat(40), mcBuildHash: 'f'.repeat(64), suiteHash: null, state: 'completed' as const, requestedAt: '2026-10-19T00:00:00.000Z', startedAt: null, updatedAt: '2026-10-19T00:00:01.000Z', finishedAt: '2026-10-19T00:00:01.000Z', phase: 'closed', code: null, currentCaseId: null, ownedRunId: null, completedCases: 0, plannedCases: 0, reportRefs: {}, cancelRequested: false };
  const uiReport = { availability, report: { hash:'1'.repeat(64),compatibility:'historical' as const,mcSourceSha:'2'.repeat(40),mcBuildHash:'3'.repeat(64),fixtureVersion:'fixture.v1',fixtureHash:'4'.repeat(64),startedAt:'2026-10-19T00:00:00.000Z',finishedAt:'2026-10-19T00:00:01.000Z',outcome:'fail' as const,assertions:[],screenshots:[] } };
  const html = renderToStaticMarkup(<TestEvidence evaluation={evaluation} ui={uiReport} receipt={receipt}/>);
  for (const value of [receipt.selectionHash,receipt.sourceSha,receipt.mcSourceSha,receipt.mcBuildHash,uiReport.report.mcSourceSha,uiReport.report.mcBuildHash]) assert.match(html,new RegExp(value));
  assert.match(html,/Job source|Receipt source/);
  assert.match(html,/UI report source/);
  assert.match(renderToStaticMarkup(<Controls/>),/Current source.*Unknown|Current selection.*Unknown/s);
});

test('historical projection expands through the real panels with blockers and all eight cases', () => {
  const html=renderToStaticMarkup(<EvidenceHistory history={[{id:'7'.repeat(64),sourceSha:'8'.repeat(40),evidence:{activation,evaluation}}]}/>);
  assert.match(html,/Historical evidence/);
  assert.match(html,/8{40}/);
  assert.equal((html.match(/data-testid="control-case-row"/g)??[]).length,8);
  assert.match(html,/EVAL_CANCEL_REQUESTED/);
  assert.match(html,/run-0/);
});
