import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import express from 'express';
import ts from 'typescript';
import { cached, invalidateCache } from '../utils/cache.js';
import { STEP_MAPPING } from '../shared/agents.js';

// Execute the actual producer and route. Replace only upstream/runtime data ports;
// no config, database, CLI or real session directory is imported or touched.
async function fixture(t: TestContext) {
  invalidateCache('office-status');
  let runs: unknown = [], refusal = false, reads = 0, sessionReads = 0;
  const source = readFileSync(new URL('./office.ts', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('office.ts', source, ts.ScriptTarget.Latest, true);
  const body = tree.statements.filter(node => !ts.isImportDeclaration(node) && !ts.isExportAssignment(node))
    .map(node => node.getText(tree)).join('\n');
  const js = ts.transpileModule(body, { compilerOptions: {
    module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
  } }).outputText.replace(/^export /gm, '');
  const router = new Function('Router', 'cached', 'getRuns', 'STEP_MAPPING', 'PATHS',
    'existsSync', 'readdirSync', 'statSync', 'join', js + ';return router;')(
    express.Router, cached,
    async () => { reads++; if (refusal) throw new Error('private fixture detail'); return runs; },
    STEP_MAPPING, { agentsDir: '/fixture' },
    () => { sessionReads++; return true; }, () => ['recent.jsonl'],
    () => ({ mtimeMs: Date.now() }), join,
  );
  const app = express(); app.use('/api', router);
  const server = createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    invalidateCache('office-status');
    assert.equal(server.listening, false);
  });
  return {
    setRuns: (value: unknown) => { runs = value; },
    setRefusal: (value: boolean) => { refusal = value; },
    read: () => fetch(`http://127.0.0.1:${address.port}/api/office/status`),
    reads: () => reads, sessionReads: () => sessionReads,
  };
}

const roleIds = ['main', 'koda', 'flux', 'atlas', 'iris', 'sentinel', 'cipher', 'lux', 'nexus', 'prism'];
const running = (steps: unknown, workflow_id = 'feature-dev') => [{ workflow_id, status: 'running', steps }];
async function assertObservation(f: Awaited<ReturnType<typeof fixture>>, mapped: string[]) {
  const response = await f.read();
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data.agents.map((a: any) => a.id), roleIds);
  assert.deepEqual(data.agents.filter((a: any) => a.status === 'working').map((a: any) => a.id), mapped);
  assert.ok(data.agents.every((a: any) => a.status === 'working' || (a.status === 'idle' && a.activity === '')));
  assert.equal(typeof data.timestamp, 'number');
  assert.equal(f.sessionReads(), 0, 'session mtimes cannot invent workflow mappings');
  return data;
}

test('empty returned runs preserve ten unmapped roles despite fresh synthetic session mtimes', async t => {
  await assertObservation(await fixture(t), []);
});

test('running plan and implement map seven distinct visible roles and exclude pool roles', async t => {
  const f = await fixture(t);
  f.setRuns(running([{ step_id: 'plan', status: 'running' }, { step_id: 'implement', status: 'running' }]));
  const data = await assertObservation(f, ['main', 'koda', 'flux', 'cipher', 'lux', 'nexus', 'prism']);
  assert.equal(data.agents[0].activity, 'Mapped running step: plan (feature-dev)');
});

test('alternate workflow and step field names map only the investigator', async t => {
  const f = await fixture(t);
  f.setRuns([{ workflow: 'bug-fix', status: 'running', steps: [{ id: 'investigate', status: 'running' }] }]);
  await assertObservation(f, ['koda']);
});

for (const [name, value] of [
  ['unknown step', running([{ step_id: 'unknown', status: 'running' }])],
  ['unknown workflow', running([{ step_id: 'plan', status: 'running' }], 'unknown')],
  ['daily standup', running([{ step_id: 'plan', status: 'running' }], 'daily-standup')],
  ['absent steps', [{ workflow_id: 'feature-dev', status: 'running' }]],
  ...['pending', 'completed', 'failed', 'cancelled', 'resuming', 'cancelling', 'failing'].map(status => [
    `nonrunning run ${status}`, [{ workflow_id: 'feature-dev', status, steps: [{ step_id: 'plan', status: 'running' }] }],
  ]),
  ...['pending', 'done', 'completed', 'failed'].map(status => [
    `nonrunning step ${status}`, running([{ step_id: 'plan', status }]),
  ]),
] as [string, unknown][]) {
  test(`${name} is a valid observation with no returned mapping`, async t => {
    const f = await fixture(t); f.setRuns(value); await assertObservation(f, []);
  });
}

test('duplicate running steps and runs count a visible role once', async t => {
  const f = await fixture(t);
  const run = running([{ step_id: 'plan', status: 'running' }, { step_id: 'plan', status: 'running' }])[0];
  f.setRuns([run, run]); await assertObservation(f, ['main']);
});

for (const [name, value] of [
  ['null runs', null], ['object runs', {}], ['null run', [null]],
  ['object steps', running({})], ['null steps', running(null)], ['null step', running([null])],
] as [string, unknown][]) {
  test(`${name} refuses an empty success and returns only the fixed public error`, async t => {
    const f = await fixture(t); f.setRuns(value);
    const response = await f.read(); assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'OFFICE_STATUS_UNAVAILABLE' });
    assert.equal(f.sessionReads(), 0);
  });
}

test('first upstream refusal is unavailable and the next empty observation recovers', async t => {
  const f = await fixture(t); f.setRefusal(true);
  const response = await f.read(); assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'OFFICE_STATUS_UNAVAILABLE' });
  f.setRefusal(false); await assertObservation(f, []); assert.equal(f.reads(), 2);
});

test('a new upstream refusal cannot be hidden behind the preceding cached success', async t => {
  const f = await fixture(t);
  assert.equal((await f.read()).status, 200);
  f.setRefusal(true);
  const response = await f.read(); assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'OFFICE_STATUS_UNAVAILABLE' });
  assert.equal(f.reads(), 2); assert.equal(f.sessionReads(), 0);
});
