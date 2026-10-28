import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import ts from 'typescript';

const oldTime = '2026-01-01T00:00:00.000Z';
const changedTime = '2026-10-28T12:00:00.000Z';
type Task = { id: string; title: string; status: string; updated_at: string; images: string };
type Story = { story_id: string; status: string };
const task = (id: string, title: string, status: string): Task =>
  ({ id, title, status, updated_at: oldTime, images: '[]' });

// Extract actual declarations and the GET registration, never importing the
// operational route, config, SQL client or selected-runtime initialization.
const source = readFileSync(new URL('../server/routes/tasks.ts', import.meta.url), 'utf8');
const tree = ts.createSourceFile('tasks.ts', source, ts.ScriptTarget.Latest, true);
const functions = new Set(['safeImages', 'mapTaskRow', 'verifyRestrictedTasksTable',
  'ensureTasksTable', 'syncTasksWithStories', 'proxy']);
const variables = new Set(['USE_PG', 'restrictedTasksMode', 'restrictedTasks', 'nonordinaryTasks',
  'tasksTableReady', 'TASK_STORY_MAP', 'lastSyncTime', 'SYNC_INTERVAL']);
const declarations = tree.statements.filter(node =>
  (ts.isFunctionDeclaration(node) && node.name && functions.has(node.name.text)) ||
  (ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration =>
    ts.isIdentifier(declaration.name) && variables.has(declaration.name.text))));
const getRoutes = tree.statements.filter(node => {
  if (!ts.isExpressionStatement(node) || !ts.isCallExpression(node.expression)) return false;
  const call = node.expression;
  return ts.isPropertyAccessExpression(call.expression) && call.expression.expression.getText(tree) === 'router'
    && call.expression.name.text === 'get' && ts.isStringLiteral(call.arguments[0]!)
    && call.arguments[0].text === '/tasks';
});
assert.equal(getRoutes.length, 1, 'extract the actual Tasks GET');
const compiled = ts.transpileModule([...declarations, ...getRoutes].map(node => node.getText(tree)).join('\n'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;

function fixture(options: { rows?: Task[]; runs?: { id: string; status: string }[];
  stories?: Story[]; selected?: boolean; restrictedMode?: string; preprovisionError?: boolean } = {}) {
  const rows = structuredClone(options.rows ?? []);
  const runs = options.runs ?? [{ id: 'r1', status: 'running' }];
  const stories = options.stories ?? [{ story_id: 'US-001', status: 'done' }];
  const statements: { text: string; values: unknown[] }[] = [];
  const pending: (() => void)[] = [];
  const portErrors: Error[] = [];
  let now = 1_000_000, assertions = 0;
  let get: (_req: unknown, res: unknown) => Promise<unknown>;
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?').replace(/\s+/g, ' ').trim();
    statements.push({ text, values });
    return new Promise((resolve, reject) => pending.push(() => {
      try {
        if (text.startsWith('CREATE TABLE IF NOT EXISTS public.tasks')) return resolve([]);
        if (text.startsWith('SELECT id, status FROM runs')) return resolve(structuredClone(runs));
        if (text.startsWith('SELECT story_id, status FROM stories WHERE run_id = ?')) {
          assert.equal(values[0], 'r1'); return resolve(structuredClone(stories));
        }
        if (text === "SELECT * FROM public.tasks WHERE status != 'done'") {
          return resolve(structuredClone(rows.filter(row => row.status !== 'done')));
        }
        if (text.startsWith('SELECT * FROM public.tasks ORDER BY')) return resolve(structuredClone(rows));
        if (text === 'UPDATE public.tasks SET status = ?, updated_at = now() WHERE id = ?') {
          const row = rows.find(row => row.id === values[1]);
          assert.ok(row, 'status transition addresses an owned row');
          row.status = String(values[0]); row.updated_at = changedTime; return resolve([]);
        }
        if (text === "UPDATE public.tasks SET updated_at = now() WHERE status = 'in_progress'") {
          for (const row of rows) if (row.status === 'in_progress') row.updated_at = changedTime;
          return resolve([]);
        }
        throw new Error(`Unmodeled SQL: ${text}`);
      } catch (error) { portErrors.push(error as Error); reject(error); }
    }));
  };
  const ports = {
    sql, Date: { now: () => now },
    process: { env: { MC_TASK6A_RESTRICTED_TASKS_VERIFY_V1: options.restrictedMode } },
    freshMissionControlSelectedV1: () => options.selected ?? true,
    assertPreprovisionedFreshMissionControlStoreV1: () => {
      assertions++; if (options.preprovisionError) throw Error('PREPROVISION_REQUIRED');
    },
    router: { get: (_path: string, callback: typeof get) => { get = callback; } },
    config: {}, fetch: () => { throw Error('NO_HTTP_PORT'); },
  };
  const sync: () => Promise<void> = new Function(...Object.keys(ports), compiled + '\nreturn syncTasksWithStories;')(...Object.values(ports));
  async function settle(work: Promise<unknown>) {
    // GET deliberately does not await sync. Resolve every controlled SQL promise
    // and allow its continuations to enqueue more work before inspecting effects.
    do {
      while (pending.length) { pending.shift()!(); await Promise.resolve(); }
      await setImmediate();
    } while (pending.length);
    const result = await work;
    assert.deepEqual(portErrors, [], 'no swallowed unmodeled SQL failures');
    return result;
  }
  return {
    rows, statements, sync, settle, advance: (milliseconds: number) => { now += milliseconds; },
    get assertions() { return assertions; },
    async read() {
      let status = 200, body: any;
      const response = { status(code: number) { status = code; return response; }, json(value: unknown) { body = value; return response; } };
      await settle(get!(undefined, response));
      return { status, body };
    },
  };
}

// Reintroducing a blanket touch must fail even though matched transitions work.
test('ordinary GET sync changes only the transitioning task activity timestamp', async () => {
  const f = fixture({ rows: [task('setup', 'Project Setup', 'todo'),
    task('unrelated', 'Independent work', 'in_progress'), task('unchanged', 'WebSocket API', 'in_progress')],
  stories: [{ story_id: 'US-001', status: 'done' }, { story_id: 'US-002', status: 'in_progress' }] });
  const response = await f.read();
  assert.equal(response.status, 200);
  assert.equal(response.body.length, 3);
  assert.deepEqual(response.body[0].images, []);
  assert.equal(f.rows.find(row => row.id === 'setup')!.status, 'done');
  assert.notEqual(f.rows.find(row => row.id === 'setup')!.updated_at, oldTime);
  assert.equal(f.rows.find(row => row.id === 'unrelated')!.updated_at, oldTime);
  assert.equal(f.rows.find(row => row.id === 'unchanged')!.updated_at, oldTime);
});

test('matched todo task still starts and updates its own activity', async () => {
  const f = fixture({ rows: [task('start', 'Project Setup', 'todo')], stories: [{ story_id: 'US-001', status: 'pending' }] });
  await f.settle(f.sync());
  assert.equal(f.rows[0].status, 'in_progress');
  assert.equal(f.rows[0].updated_at, changedTime);
});

for (const absence of ['run', 'stories']) {
  test(`sync without ${absence} leaves owned tasks untouched`, async () => {
    const f = fixture({ rows: [task('setup', 'Project Setup', 'todo'), task('other', 'Other', 'in_progress')],
      ...(absence === 'run' ? { runs: [] } : { stories: [] }) });
    const before = structuredClone(f.rows);
    await f.settle(f.sync());
    assert.deepEqual(f.rows, before);
    assert.equal(f.statements.some(query => query.text.startsWith('UPDATE')), false);
    if (absence === 'run') assert.equal(f.statements.some(query => query.text.includes('FROM stories')), false);
  });
}

test('sync throttles through 59999ms and resumes at 60000ms', async () => {
  const f = fixture();
  await f.settle(f.sync());
  const count = f.statements.length;
  f.advance(59_999); await f.settle(f.sync());
  assert.equal(f.statements.length, count);
  f.advance(1); await f.settle(f.sync());
  assert.equal(f.statements.filter(query => query.text.includes('FROM runs')).length, 2);
});

test('selected store asserts preprovisioning for GET and sync without schema creation', async () => {
  const f = fixture(); await f.read();
  assert.equal(f.assertions, 2);
  assert.equal(f.statements.some(query => query.text.startsWith('CREATE')), false);
  const refused = fixture({ preprovisionError: true });
  const response = await refused.read();
  assert.equal(response.status, 502);
  assert.deepEqual(response.body, { error: 'PREPROVISION_REQUIRED' });
  assert.deepEqual(refused.statements, []);
});

test('restricted GET reads tasks without story synchronization', async () => {
  const f = fixture({ restrictedMode: '1', rows: [task('setup', 'Project Setup', 'todo')] });
  const response = await f.read();
  assert.equal(response.status, 200);
  assert.equal(f.assertions, 1);
  assert.equal(f.statements.length, 1);
  assert.match(f.statements[0].text, /^SELECT \* FROM public.tasks ORDER BY/);
  assert.equal(f.rows[0].status, 'todo');
  assert.equal(f.rows[0].updated_at, oldTime);
});

test('legacy ordinary schema initialization is shared once between sync and repeated GETs', async () => {
  const f = fixture({ selected: false, rows: [task('setup', 'Project Setup', 'todo')] });
  await f.read(); await f.read();
  assert.equal(f.assertions, 0);
  assert.equal(f.statements.filter(query => query.text.startsWith('CREATE TABLE IF NOT EXISTS public.tasks')).length, 1);
  assert.equal(f.rows[0].status, 'done');
  assert.equal(f.rows[0].updated_at, changedTime);
});
