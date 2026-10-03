import assert from 'node:assert/strict';
import test from 'node:test';
import { availableFixtureV1, runTelemetryConsumerV1 } from '../server/routes/telemetry.test.ts';

test('actual result consumer renders unavailable without a healthy empty-data fallback', async () => {
  const observed = await runTelemetryConsumerV1({ renderResult: {
    status: 'unavailable', runId: 'run-contract', reason: 'sql',
  } });
  assert.equal(observed.hasResultExport, true);
  assert.match(observed.markup, /Telemetry unavailable/);
  assert.doesNotMatch(observed.markup, /No telemetry data/);
});

test('actual flagged human step labels never select inherited Object properties', async () => {
  const body = availableFixtureV1();
  body.steps = ['constructor', 'toString', '__proto__'].map(step_id => ({ ...body.steps[0], step_id, isBottleneck: true }));
  const observed = await runTelemetryConsumerV1({ renderResult: body });
  assert.match(observed.markup, /CONSTRUCTOR \(250ms\), TOSTRING \(250ms\), __PROTO__ \(250ms\)/);
  assert.doesNotMatch(observed.markup, /function|native code|object Object/);
});

test('actual zero-duration result remains completed with the history notice', async () => {
  const body = availableFixtureV1(); body.steps[0].duration_ms = 0;
  const observed = await runTelemetryConsumerV1({ renderResult: body });
  assert.match(observed.markup, /Precise transition history unavailable/);
  assert.match(observed.markup, /Total: 0ms/);
  assert.doesNotMatch(observed.markup, /No completed steps/);
});

test('actual no-duration result still shows limited-history notice', async () => {
  const body: any = availableFixtureV1(); body.steps[0].duration_ms = null; body.steps[0].status = 'unknown';
  const observed = await runTelemetryConsumerV1({ renderResult: body });
  assert.match(observed.markup, /Precise transition history unavailable/);
  assert.match(observed.markup, /No completed steps yet/);
});

test('actual empty result keeps the precise-history limitation visible', async () => {
  const observed = await runTelemetryConsumerV1({ renderResult: {
    schema: 'mission-control.pipeline-telemetry.v1', status: 'available_limited', runId: 'run-contract',
    history: { state: 'unavailable', reasonCode: 'PRECISE_TRANSITION_HISTORY_UNAVAILABLE' },
    analysis: { coverage: ['historical_execution_duration'] }, steps: [], transitions: [], bottlenecks: [],
  } });
  assert.match(observed.markup, /Precise transition history unavailable/);
  assert.match(observed.markup, /No telemetry data/);
});

test('coherent raw UI zero-filter mutant fails actual completed-result assertion', async () => {
  const body = availableFixtureV1(); body.steps[0].duration_ms = 0;
  const observed = await runTelemetryConsumerV1({ renderResult: body,
    replacements: { 'src/components/run-detail/TelemetryChart.tsx': { from: '.filter(s => s.duration_ms !== null)', to: '.filter(s => Boolean(s.duration_ms))' } } });
  assert.throws(() => assert.match(observed.markup, /Total: 0ms/), assert.AssertionError);
  assert.match(observed.markup, /No completed steps yet/);
});

test('coherent raw UI missing-notice mutant fails the actual empty consumer', async () => {
  const body = availableFixtureV1(); body.steps = [];
  const observed = await runTelemetryConsumerV1({ renderResult: body,
    replacements: { 'src/components/run-detail/TelemetryChart.tsx': { from: 'if (steps.length === 0) return <div style={{ padding: 16 }}>{notice}', to: 'if (steps.length === 0) return <div style={{ padding: 16 }}>' } } });
  assert.throws(() => assert.match(observed.markup, /Precise transition history unavailable/), assert.AssertionError);
  assert.match(observed.markup, /No telemetry data/);
});

test('coherent raw UI export-removal mutant fails the actual result-export consumer', async () => {
  const observed = await runTelemetryConsumerV1({ renderResult: availableFixtureV1(),
    replacements: { 'src/components/run-detail/TelemetryChart.tsx': { from: 'export function TelemetryResult(', to: 'function TelemetryResult(' } } });
  assert.throws(() => assert.equal(observed.hasResultExport, true), assert.AssertionError);
  assert.equal(observed.hasResultExport, false);
  assert.match(observed.markup, /Loading telemetry/);
});

test('coherent raw UI wrong-branch mutant fails the actual completed-data consumer', async () => {
  const observed = await runTelemetryConsumerV1({ renderResult: availableFixtureV1(),
    replacements: { 'src/components/run-detail/TelemetryChart.tsx': { from: 'if (steps.length === 0)', to: 'if (steps.length !== 0)' } } });
  assert.throws(() => assert.match(observed.markup, /Total: 250ms/), assert.AssertionError);
  assert.match(observed.markup, /No telemetry data/);
});

test('actual rendered overflow is unavailable, never an infinite healthy total', async () => {
  const body = availableFixtureV1(); body.steps = [{ ...body.steps[0], duration_ms: 1e308 }, { ...body.steps[0], duration_ms: 1e308 }];
  const observed = await runTelemetryConsumerV1({ renderResult: body });
  assert.match(observed.markup, /Telemetry unavailable \(invalid_response\)/);
  assert.doesNotMatch(observed.markup, /Total:|Infinity|NaN/);
});

test('coherent raw UI overflow mutant fails the actual finite-total consumer', async () => {
  const body = availableFixtureV1(); body.steps = [{ ...body.steps[0], duration_ms: 1e308 }, { ...body.steps[0], duration_ms: 1e308 }];
  const observed = await runTelemetryConsumerV1({ renderResult: body,
    replacements: { 'src/components/run-detail/TelemetryChart.tsx': { from: 'if (!Number.isFinite(totalMs))', to: 'if (false)' } } });
  assert.throws(() => assert.match(observed.markup, /Telemetry unavailable/), assert.AssertionError);
  assert.match(observed.markup, /Total:.*Infinity/);
});
