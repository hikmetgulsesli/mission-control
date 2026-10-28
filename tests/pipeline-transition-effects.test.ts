import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import ts from 'typescript';

// Execute actual source declarations/route registrations without importing the
// operational route, SQL client, scheduler constructors, config or child tools.
function extract(file: string, functions: string[], variables: string[], routes: string[] = []) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const foundRoutes: string[] = [];
  const nodes = tree.statements.filter(node => {
    if (ts.isFunctionDeclaration(node) && node.name && functions.includes(node.name.text)) return true;
    if (ts.isVariableStatement(node)) return node.declarationList.declarations.some(declaration =>
      ts.isIdentifier(declaration.name) && variables.includes(declaration.name.text));
    if (!ts.isExpressionStatement(node) || !ts.isCallExpression(node.expression)) return false;
    const call = node.expression;
    if (!ts.isPropertyAccessExpression(call.expression) || call.expression.expression.getText(tree) !== 'router'
      || !ts.isStringLiteral(call.arguments[0]!)) return false;
    const key = `${call.expression.name.text} ${call.arguments[0].text}`;
    if (!routes.includes(key)) return false;
    foundRoutes.push(key); return true;
  });
  assert.deepEqual(foundRoutes.sort(), [...routes].sort(), 'extract actual route registrations');
  return nodes.map(node => node.getText(tree).replace(/^export /, '')).join('\n');
}
const compiled = ts.transpileModule([
  extract('../server/utils/cache.ts', ['getCached', 'setCache', 'isStale', 'cached'], ['store', 'refreshing']),
  extract('../server/services/v3-project-transfer.ts', ['isV3RunProtocol'], []),
  extract('../server/routes/setfarm-activity.ts', ['loadSyncState', 'saveSyncState'],
    ['syncInProgress', 'MC_SYNC_STATE_PATH', '_initialState', 'lastSeenFinishedIds', 'lastSeenRunningIds'],
    ['get /setfarm/pipeline', 'post /setfarm/sync-projects']),
].join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;

type Run = { id: string; status: string; protocol?: string; context?: unknown; workflow_id: string;
  task: string; updated_at: string; created_at: string; steps: unknown[] };
const run = (id: string, status: string, protocol = 'legacy'): Run => ({ id, status, protocol,
  workflow_id: 'feature-dev', task: `Build ${id}`, updated_at: '2026-10-28T12:00:00Z',
  created_at: '2026-10-27T12:00:00Z', steps: [] });

function fixture(initialState?: { finishedIds: string[]; runningIds: string[] }) {
  let now = Date.parse('2026-10-28T12:00:00Z'), inventory: Run[] = [], reads = 0;
  const routes = new Map<string, (req: any, res: any) => Promise<void>>();
  const pending: (() => void)[] = [], errors: Error[] = [];
  const syncCalls: unknown[] = [], creates: string[] = [], transferCalls: string[] = [];
  const files = new Map<string, string>();
  const writes: { path: string; data: string }[] = [], renames: string[][] = [];
  const syncPath = '/modeled/setfarm/mc-sync-state.json';
  if (initialState) files.set(syncPath, JSON.stringify(initialState));
  const defer = <T>(value: T): Promise<T> => new Promise(resolve => pending.push(() => resolve(value)));
  class Clock extends Date {
    constructor(value?: string | number) { super(value === undefined ? now : value); }
    static now() { return now; }
  }
  const forbidden = (name: string) => () => {
    const error = new Error(`Unexpected ${name} port`); errors.push(error); throw error;
  };
  const ports = {
    Date: Clock, PATHS: { setfarmDir: '/modeled/setfarm' }, join: (...parts: string[]) => parts.join('/'),
    readSync: (path: string) => { if (!files.has(path)) throw Error('ENOENT'); return files.get(path); },
    writeSync: (path: string, data: string) => { writes.push({ path, data }); files.set(path, data); },
    renameSync: (from: string, to: string) => { assert.ok(files.has(from)); renames.push([from, to]);
      files.set(to, files.get(from)!); files.delete(from); },
    router: {
      get: (path: string, callback: any) => routes.set(`get ${path}`, callback),
      post: (path: string, callback: any) => routes.set(`post ${path}`, callback),
    },
    getRuns: () => { reads++; return defer(structuredClone(inventory)); },
    getBatchStoryProgress: (ids: string[]) => {
      assert.deepEqual([...ids].sort(), inventory.filter(r => r.workflow_id !== 'daily-standup' || r.status === 'running')
        .map(r => r.id).sort());
      return defer({});
    },
    getMissionControlOperationalModel: () => defer(null),
    deriveSetfarmPipelineFailureProjection: () => ({ hasFailures: false, blockerStepId: null, blockerSummary: null }),
    // Lifecycle ports record dispatch, not their implementation. This detects a
    // V3 trigger even when the legacy callee would later filter V3 out itself.
    syncProjectsFromRuns: (options: unknown) => { syncCalls.push(options); return defer({ synced: ['legacy'], skipped: [] }); },
    createBuildingProject: (r: Run) => { creates.push(r.id); return defer(undefined); },
    syncIncrementalV3ProjectTransfers: () => { transferCalls.push('incremental'); return defer({ synced: ['canonicalV3'], skipped: [] }); },
    v3TransferCandidateSource: { findByRunId: (id: string) => { transferCalls.push(`find:${id}`);
      return defer({ id, status: 'completed', runNumber: 9 }); } },
    transferSelectedV3Run: (selected: any) => { assert.deepEqual(selected, { id: 'v3-selected', status: 'completed', protocol: 'v3', runNumber: 9 });
      transferCalls.push('selected'); return defer({ status: 'synchronized', persistence: { status: 'created', project: 'canonicalV3' } }); },
    sql: forbidden('SQL'), execSync: forbidden('child'), fetch: forbidden('network'),
    createProjectProgrammatic: forbidden('registry'), autoDeployProject: forbidden('deploy'),
    updatePortRegistry: forbidden('DNS/port registry'), coordinateV3ProjectTransfer: forbidden('transfer coordinator'),
    console: { error: (...args: unknown[]) => errors.push(Error(args.join(' '))) },
  };
  new Function(...Object.keys(ports), compiled)(...Object.values(ports));
  async function drain() {
    do {
      while (pending.length) { pending.shift()!(); await Promise.resolve(); }
      await setImmediate();
    } while (pending.length);
    assert.deepEqual(errors, [], 'no swallowed external-port or persistence failures');
  }
  function request(key: string, query = {}) {
    let status = 200, body: any;
    const response = { status(code: number) { status = code; return response; }, json(value: any) { body = value; return response; } };
    const work = routes.get(key)!({ query }, response);
    return { work, response: () => ({ status, body }) };
  }
  return {
    syncCalls, creates, writes, renames, transferCalls, drain,
    get reads() { return reads; },
    state: () => JSON.parse(files.get(syncPath)!),
    advance: (ms: number) => { now += ms; },
    inventory: (runs: Run[]) => { inventory = runs; },
    async observe(runs: Run[], expire = false) {
      inventory = runs; if (expire) now += 50_001;
      const req = request('get /setfarm/pipeline'); await drain(); await req.work;
      assert.equal(req.response().status, 200); return req.response().body;
    },
    // Stale GET must settle before the deferred refresh inventory resolves.
    async staleRead() {
      const req = request('get /setfarm/pipeline'); await req.work; return req.response();
    },
    async manualSync(query = {}) {
      const req = request('post /setfarm/sync-projects', query); await drain(); await req.work;
      assert.equal(req.response().status, 200); return req.response().body;
    },
  };
}

// Removing either non-V3 eligibility guard must dispatch a legacy lifecycle call.
test('V3-only completion does not sync legacy projects; legacy completion still syncs once', async () => {
  const f = fixture();
  await f.observe([run('old', 'completed'), run('legacy', 'running'), run('v3', 'running', 'v3')]);
  const next = [run('old', 'completed'), run('legacy', 'running'), run('v3', 'completed', 'v3')];
  const body = await f.observe(next, true);
  assert.deepEqual(body.map((r: any) => r.id).sort(), ['legacy', 'old', 'v3']);
  assert.equal(f.syncCalls.length, 0);
  assert.deepEqual(f.state().finishedIds, ['old', 'v3']);
  assert.deepEqual(f.state().runningIds, ['legacy']);
  await f.observe([run('old', 'completed'), run('legacy', 'failed'), run('v3', 'completed', 'v3')], true);
  assert.deepEqual(f.syncCalls, [{ excludeV3: true }]);
  await f.observe([run('old', 'completed'), run('legacy', 'failed'), run('v3', 'completed', 'v3')], true);
  assert.equal(f.syncCalls.length, 1);
});

test('V3-only start does not invoke legacy create; mixed starts create only eligible legacy runs', async () => {
  const f = fixture(); await f.observe([run('seed', 'running')]);
  const v3 = { ...run('v3', 'running'), protocol: undefined, context: JSON.stringify({ product_compiler_mode: 'v3' }) };
  await f.observe([run('seed', 'running'), v3], true);
  assert.deepEqual(f.creates, []);
  await f.observe([run('seed', 'running'), v3, run('legacy', 'running'), run('v3-2', 'running', 'v3')], true);
  assert.deepEqual(f.creates, ['legacy']);
  assert.deepEqual(f.state().runningIds, ['seed', 'v3', 'legacy', 'v3-2']);
});

test('mixed terminal transitions cause one legacy sync and no canonical transfer', async () => {
  const f = fixture(); await f.observe([run('seed', 'completed'), run('a', 'running'), run('b', 'running')]);
  await f.observe([run('seed', 'completed'), run('a', 'cancelled'), run('b', 'completed'), run('v3', 'failed', 'v3')], true);
  assert.deepEqual(f.syncCalls, [{ excludeV3: true }]);
  assert.deepEqual(f.transferCalls, []);
});

test('first observation initializes all seen sets without lifecycle dispatch and persists atomically', async () => {
  const f = fixture(); await f.observe([run('legacy', 'completed'), run('v3', 'completed', 'v3'),
    run('active', 'running'), run('v3-active', 'running', 'v3'), run('queued', 'pending')]);
  assert.deepEqual(f.syncCalls, []); assert.deepEqual(f.creates, []);
  assert.deepEqual(f.state(), { finishedIds: ['legacy', 'v3'], runningIds: ['active', 'v3-active'], savedAt: '2026-10-28T12:00:00.000Z' });
  assert.equal(f.writes.length, 1);
  assert.deepEqual(f.renames, [['/modeled/setfarm/mc-sync-state.json.tmp', '/modeled/setfarm/mc-sync-state.json']]);
});

test('persisted seen state allows eligible transitions on the first GET', async () => {
  const f = fixture({ finishedIds: ['old'], runningIds: ['active'] });
  await f.observe([run('old', 'completed'), run('new', 'completed'), run('active', 'running'), run('start', 'running')]);
  assert.deepEqual(f.syncCalls, [{ excludeV3: true }]); assert.deepEqual(f.creates, ['start']);
});

test('cache hit skips inventory and writes; stale GET serves old data while one refresh persists new state', async () => {
  const f = fixture(); const first = await f.observe([run('seed', 'completed'), run('active', 'running')]);
  f.advance(10_000); assert.deepEqual(await f.observe([]), first);
  assert.equal(f.reads, 1); assert.equal(f.writes.length, 1);
  f.advance(1); f.inventory([run('seed', 'completed'), run('active', 'completed')]);
  assert.deepEqual((await f.staleRead()).body, first);
  assert.deepEqual((await f.staleRead()).body, first);
  assert.equal(f.reads, 2); assert.equal(f.writes.length, 1);
  await f.drain();
  assert.deepEqual(f.syncCalls, [{ excludeV3: true }]);
  assert.equal(f.writes.length, 2); assert.deepEqual(f.state().runningIds, []);
  const refreshed = await f.staleRead(); assert.equal(refreshed.body.find((r: any) => r.id === 'active').status, 'completed');
});

test('explicit POST sync preserves legacy and canonicalV3 transfer paths', async () => {
  const f = fixture();
  assert.deepEqual(await f.manualSync(), { synced: ['legacy', 'canonicalV3'], skipped: [] });
  assert.deepEqual(f.syncCalls, [{ excludeV3: true }]); assert.deepEqual(f.transferCalls, ['incremental']);
  assert.deepEqual(await f.manualSync({ runId: ' v3-selected ' }), { synced: ['canonicalV3'], skipped: [] });
  assert.deepEqual(f.transferCalls, ['incremental', 'find:v3-selected', 'selected']);
  assert.equal(f.syncCalls.length, 1);
});
