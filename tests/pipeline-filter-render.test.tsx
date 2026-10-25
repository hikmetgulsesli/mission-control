import React from 'react';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

Object.defineProperty(globalThis, 'document', { configurable: true, value: { querySelector: () => null } });
const { PipelineView } = await import('../src/components/PipelineView.js');
const run = {
  id: 'synthetic-search-run', runNumber: 12, workflow: 'bug-fix',
  task: 'Searchable task title', status: 'failed', updatedAt: '2026-10-25T00:00:00.000Z',
  steps: [{ stepId: 'fix', agent: 'fixer', status: 'failed', retryCount: 0, type: 'step', abandonedCount: 0 }],
  storyProgress: { completed: 0, total: 1 },
};
const render = (searchQuery = '', statusFilter = 'all', runs = [run]) => renderToStaticMarkup(
  <MemoryRouter><PipelineView runs={runs} searchQuery={searchQuery} statusFilter={statusFilter} /></MemoryRouter>,
);

// Removing the query predicate must expose the otherwise hidden real run card.
test('nonmatching query hides the real run card', () => {
  const html = render('does-not-match-any-run');
  assert.match(html, /No runs found/);
  assert.doesNotMatch(html, /Searchable task title/);
});
for (const query of ['  SEARCHABLE TASK  ', 'SYNTHETIC-SEARCH', ' BUG-FIX ', '#12', '12']) {
  test(`query ${JSON.stringify(query)} finds task, id, workflow or displayed run number`, () => {
    assert.match(render(query), /Searchable task title/);
  });
}
// Falling back to legacy failed, or ignoring controlled status, must fail this.
test('failed filter excludes an unknown snapshot even when legacy status is failed', () => {
  const html = render('searchable', 'failed');
  assert.match(html, /No runs found/);
  assert.doesNotMatch(html, /Searchable task title/);
});
test('all retains unknown rows without claiming canonical failure', () => {
  const html = render();
  assert.match(html, /Searchable task title/);
  assert.match(html, />UNKNOWN</);
  assert.doesNotMatch(html, /af-pipeline__run--failed/);
});
test('filtering preserves input collection and descending order while excluding daily standup', () => {
  const runs = [run, { ...run, id: 'newer', runNumber: 13, task: 'Newer task' },
    { ...run, id: 'standup', workflow: 'daily-standup', task: 'Hidden standup' }];
  const before = structuredClone(runs);
  const html = render('', 'all', runs);
  assert.deepEqual(runs, before);
  assert.ok(html.indexOf('Newer task') < html.indexOf('Searchable task title'));
  assert.doesNotMatch(html, /Hidden standup/);
});
