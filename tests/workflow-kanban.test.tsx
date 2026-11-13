import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkflowKanban } from '../src/components/WorkflowKanban';
import type { Run, RunStep, Workflow } from '../src/lib/types';

type ApiRunStep = RunStep & { step_id?: string; stepId?: string };

const workflows: Workflow[] = [{
  id: 'feature-dev',
  name: 'Feature',
  steps: [
    { id: 'implement', agent: 'developer' },
    { id: 'verify', agent: 'reviewer' },
    { id: 'deploy', agent: 'deployer' },
  ],
}];

function render(steps: ApiRunStep[], runs?: Run[]): string {
  return renderToStaticMarkup(<WorkflowKanban workflows={workflows} runs={runs ?? [{
    id: 'run-one', workflow: 'feature-dev', status: 'running', steps,
  }]} />);
}

function stageClasses(html: string, stage: string): string[] {
  const match = html.match(new RegExp(`<div class="([^"]*)" title="${stage} \\(`));
  assert.ok(match, `stage ${stage} must be rendered`);
  return match[1].trim().split(/\s+/);
}

test('API UUID rows display semantic step_id status and completed output affordance', () => {
  const html = render([
    { id: 'db-uuid', step_id: 'implement', agent: 'developer', status: 'running' },
    { id: 'other-uuid', step_id: 'verify', agent: 'reviewer', status: 'done', output: 'verified' },
  ]);

  assert.deepEqual(stageClasses(html, 'implement'), ['af-step', 'af-step--running']);
  assert.deepEqual(stageClasses(html, 'verify'), ['af-step', 'af-step--done', 'af-step--clickable']);
  assert.deepEqual(stageClasses(html, 'deploy'), ['af-step', 'af-step--pending']);
});

test('step_id takes precedence over both camelCase and record id collisions', () => {
  const html = render([
    { id: 'deploy', step_id: 'implement', stepId: 'verify', agent: 'developer', status: 'done' },
  ]);

  assert.deepEqual(stageClasses(html, 'implement'), ['af-step', 'af-step--done', 'af-step--clickable']);
  assert.deepEqual(stageClasses(html, 'verify'), ['af-step', 'af-step--pending']);
  assert.deepEqual(stageClasses(html, 'deploy'), ['af-step', 'af-step--pending']);
});

test('camelCase semantic ids display failed stages and leave legacy ids available', () => {
  const html = render([
    { id: 'implement', stepId: 'verify', agent: 'reviewer', status: 'failed', output: 'failure details' },
    { id: 'deploy', agent: 'deployer', status: 'done', output: 'deployed' },
  ]);

  assert.deepEqual(stageClasses(html, 'implement'), ['af-step', 'af-step--pending']);
  assert.deepEqual(stageClasses(html, 'verify'), ['af-step', 'af-step--failed', 'af-step--clickable']);
  assert.deepEqual(stageClasses(html, 'deploy'), ['af-step', 'af-step--done', 'af-step--clickable']);
});

test('legacy unknown status and absent rows remain pending without output affordances', () => {
  const html = render([
    { id: 'implement', agent: 'developer', status: 'queued', output: 'not complete' },
  ]);

  for (const stage of ['implement', 'verify', 'deploy']) {
    assert.deepEqual(stageClasses(html, stage), ['af-step', 'af-step--pending']);
  }
});

test('only the selected active run of the matching workflow supplies stage state', () => {
  const html = render([], [
    { id: 'unrelated', workflow: 'other-workflow', status: 'running', steps: [
      { id: 'implement', agent: 'developer', status: 'done' },
    ] },
    { id: 'historical', workflow: 'feature-dev', status: 'failed', steps: [
      { id: 'implement', agent: 'developer', status: 'failed' },
    ] },
    { id: 'selected', workflow: 'feature-dev', status: 'running', steps: [
      { id: 'verify', agent: 'reviewer', status: 'running' },
    ] },
    { id: 'other-active', workflow: 'feature-dev', status: 'running', steps: [
      { id: 'deploy', agent: 'deployer', status: 'done' },
    ] },
  ]);

  assert.deepEqual(stageClasses(html, 'implement'), ['af-step', 'af-step--pending']);
  assert.deepEqual(stageClasses(html, 'verify'), ['af-step', 'af-step--running']);
  assert.deepEqual(stageClasses(html, 'deploy'), ['af-step', 'af-step--pending']);
});

test('completed runs do not populate an idle workflow with stale stage success', () => {
  const html = render([], [{
    id: 'completed', workflow: 'feature-dev', status: 'done', steps: [
      { id: 'implement', agent: 'developer', status: 'done' },
    ],
  }]);

  assert.match(html, /af-pipeline__run--idle/);
  assert.deepEqual(stageClasses(html, 'implement'), ['af-step', 'af-step--pending']);
});
