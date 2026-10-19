import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { test, type TestContext } from 'node:test';
import express from 'express';
import ts from 'typescript';
import { cached, invalidateCache } from '../utils/cache.js';

const firstId = '11111111-1111-4111-8111-111111111111';
const selectedId = '22222222-2222-4222-8222-222222222222';
const unknownId = '33333333-3333-4333-8333-333333333333';
type Job = { id: string; name: string; enabled?: unknown };

// Execute the actual route statements without importing config/runtime authority.
// Only filesystem and process data ports are substituted; Express and cache are real.
async function fixture(t: TestContext, jobs: unknown, refusal?: string) {
  invalidateCache('cron');
  const calls: [string, string[]][] = [];
  let invalidations = 0;
  let reads = 0;
  const source = readFileSync(new URL('./cron.ts', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('cron.ts', source, ts.ScriptTarget.Latest, true);
  const body = tree.statements.filter(node => !ts.isImportDeclaration(node) && !ts.isExportAssignment(node))
    .map(node => node.getText(tree)).join('\n');
  const js = ts.transpileModule(body, { compilerOptions: {
    module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
  } }).outputText.replace(/^export /gm, '');
  const router = new Function('Router', 'readFileSync', 'config', 'cached', 'invalidateCache', 'runCli', js
    + ';return createCronRouter({readJobs: () => JSON.parse(readFileSync()).jobs, runCli});')(
    express.Router,
    () => { reads++; return JSON.stringify({ jobs }); },
    { jobsJson: 'fixture-only' },
    cached,
    (key: string) => { invalidations++; invalidateCache(key); },
    async (command: string, args: string[]) => {
      calls.push([command, [...args]]);
      if (refusal) throw new Error(refusal);
      // Model the exact-ID CLI boundary: names do not identify jobs.
      const selected = Array.isArray(jobs) && jobs.find(job => job?.id === args[2]);
      if (selected) selected.enabled = args[1] === 'enable';
      return '';
    },
  );
  const app = express(); app.use('/api', router);
  const server = createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    invalidateCache('cron');
  });
  return {
    base: `http://127.0.0.1:${address.port}/api/cron`, calls,
    invalidations: () => invalidations, reads: () => reads,
  };
}

for (const enabled of [true, false]) {
  test(`duplicate names toggle only the selected ${enabled ? 'enabled' : 'disabled'} UUID and refresh cached GET`, async t => {
    const jobs: Job[] = [
      { id: firstId, name: 'test/agent', enabled },
      { id: selectedId, name: 'test/agent', enabled },
    ];
    const f = await fixture(t, jobs);
    assert.deepEqual(await (await fetch(f.base)).json(), jobs);
    assert.deepEqual(await (await fetch(f.base)).json(), jobs);
    assert.equal(f.reads(), 1, 'GET retains bounded caching');
    const response = await fetch(`${f.base}/${selectedId}/toggle`, { method: 'POST' });
    assert.equal(response.status, 200);
    assert.deepEqual(f.calls[0], ['openclaw', ['cron', enabled ? 'disable' : 'enable', selectedId]]);
    assert.equal(f.calls.length, 1);
    assert.deepEqual(await response.json(), { success: true, name: 'test/agent', enabled: !enabled });
    assert.equal(f.invalidations(), 1);
    const listed = await (await fetch(f.base)).json();
    assert.deepEqual(listed, [
      { id: firstId, name: 'test/agent', enabled },
      { id: selectedId, name: 'test/agent', enabled: !enabled },
    ]);
    assert.equal(f.reads(), 3, 'POST rereads authority and success invalidates cached GET');
  });
}

test('unknown UUID returns 404 with no CLI or cache mutation', async t => {
  const f = await fixture(t, [{ id: selectedId, name: 'test/agent', enabled: false }]);
  const response = await fetch(`${f.base}/${unknownId}/toggle`, { method: 'POST' });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Job not found' });
  assert.deepEqual(f.calls, []); assert.equal(f.invalidations(), 0);
});

for (const id of ['test/agent', '--help', '22222222-2222-4222-8222-222222222222 extra', 'x'.repeat(1000)]) {
  test(`invalid job ID is rejected before CLI effects (${id.length > 50 ? 'oversized' : id})`, async t => {
    const f = await fixture(t, [{ id, name: 'test/agent', enabled: false }]);
    const response = await fetch(`${f.base}/${encodeURIComponent(id)}/toggle`, { method: 'POST' });
    assert.equal(response.status, 400);
    assert.deepEqual(f.calls, []); assert.equal(f.invalidations(), 0);
  });
}

for (const enabled of [undefined, null, 'false', 0]) {
  test(`invalid current job enabled state refuses CLI (${String(enabled)})`, async t => {
    const f = await fixture(t, [{ id: selectedId, name: 'test/agent', enabled }]);
    const response = await fetch(`${f.base}/${selectedId}/toggle`, { method: 'POST' });
    assert.equal(response.status, 500);
    assert.deepEqual(f.calls, []); assert.equal(f.invalidations(), 0);
    assert.equal((await response.json()).success, undefined);
  });
}

test('malformed current job collection cannot toggle or claim success', async t => {
  const f = await fixture(t, { [selectedId]: { enabled: true } });
  const response = await fetch(`${f.base}/${selectedId}/toggle`, { method: 'POST' });
  assert.equal(response.status, 500);
  assert.deepEqual(f.calls, []); assert.equal(f.invalidations(), 0);
  assert.equal((await response.json()).success, undefined);
});

test('CLI refusal stays a failure and preserves displayed state and cache', async t => {
  const jobs = [{ id: selectedId, name: 'test/agent', enabled: true }];
  const f = await fixture(t, jobs, 'TASK6A_SELECTED_CLI_NO_SPAWN');
  assert.deepEqual(await (await fetch(f.base)).json(), jobs);
  const response = await fetch(`${f.base}/${selectedId}/toggle`, { method: 'POST' });
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'TASK6A_SELECTED_CLI_NO_SPAWN' });
  assert.deepEqual(f.calls, [['openclaw', ['cron', 'disable', selectedId]]]);
  assert.equal(f.invalidations(), 0);
  assert.deepEqual(await (await fetch(f.base)).json(), [{ id: selectedId, name: 'test/agent', enabled: true }]);
  assert.equal(f.reads(), 2);
});
