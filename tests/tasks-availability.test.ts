import assert from 'node:assert/strict';
import test from 'node:test';
import { flush, task, tasksHarness } from './fixtures/tasks-availability-lifecycle';

test('initial pending does not present unknown tasks as zero or render a board', t => {
  const h = tasksHarness(); t.after(() => h.unmount());
  assert.match(h.html(), /Loading tasks/); assert.doesNotMatch(h.html(), /0 total|0 active/);
  assert.equal(h.board(), undefined); assert.deepEqual(h.intervals, [10000]);
});

test('initial rejection shows fixed unavailable copy and retains New Task/modal access through retry', async t => {
  const h = tasksHarness(); t.after(() => h.unmount());
  h.request('tasks').reject(new Error('private response body')); await flush();
  assert.match(h.html(), /Tasks unavailable/); assert.doesNotMatch(h.html(), /0 total|0 active|private response body/);
  assert.equal(h.board(), undefined); h.button('+ NEW TASK');
  assert.equal(h.modal().task, null); const refresh = h.modal().onSaved;
  h.button('Retry'); assert.equal(h.modal().onSaved, refresh); assert.match(h.html(), /Tasks unavailable/);
  h.request('tasks', 1).resolve([task()]); await flush();
  assert.match(h.html(), /1 total/); assert.doesNotMatch(h.html(), /Tasks unavailable/);
  assert.equal(h.modal().task, null); assert.equal(h.modal().onSaved, refresh);
});

test('accepted empty tasks show real zero counts independently of agent-list failure', async t => {
  const h = tasksHarness(); t.after(() => h.unmount());
  h.request('agents').reject(new Error('agents unavailable'));
  h.request('tasks').resolve([]); await flush();
  assert.match(h.html(), /0 total/); assert.match(h.html(), /0 active/);
  assert.doesNotMatch(h.html(), /Tasks unavailable|outdated/); assert.deepEqual(h.board().tasks, []);
  h.button('+ NEW TASK'); assert.deepEqual(h.modal().agents, []);
});

test('accepted rows normalize image arrays, encoded arrays and nullish values before board/modal consumption', async t => {
  const h = tasksHarness(); t.after(() => h.unmount());
  h.request('tasks').resolve([
    task('array', { images: ['array.png'] }), task('encoded', { images: '["encoded.png"]', status: 'todo' }),
    task('null', { images: null }), task('missing', { images: undefined }),
  ]); await flush();
  const board = h.board();
  assert.deepEqual(board.tasks.map((row: any) => row.images), [['array.png'], ['encoded.png'], [], []]);
  assert.match(h.html(), /4 total/); assert.match(h.html(), /3 active/);
  board.onSelect(board.tasks[1]); assert.deepEqual(h.modal().task.images, ['encoded.png']);
});

for (const retained of [[], [task()]]) {
  test(`failed refresh retains ${retained.length ? 'rows and selected modal' : 'accepted empty data'} with warning until accepted recovery`, async t => {
    const h = tasksHarness(); t.after(() => h.unmount());
    h.request('tasks').resolve(retained); await flush();
    const board = h.board();
    if (retained.length) board.onSelect(board.tasks[0]);
    const selected = h.modal()?.task;
    board.onRefresh(); h.request('tasks', 1).reject(new Error('private refresh body')); await flush();
    assert.match(h.html(), /last loaded data may be outdated/i); assert.doesNotMatch(h.html(), /private refresh body|Tasks unavailable/);
    assert.deepEqual(h.board().tasks, retained); assert.match(h.html(), new RegExp(`${retained.length} total`));
    if (retained.length) assert.equal(h.modal().task, selected);
    h.button('Retry'); assert.match(h.html(), /last loaded data may be outdated/i);
    h.request('tasks', 2).resolve([task('recovered', { status: 'done' })]); await flush();
    assert.equal(h.board().tasks[0].id, 'recovered'); assert.match(h.html(), /1 total/); assert.match(h.html(), /0 active/);
    assert.doesNotMatch(h.html(), /outdated|Tasks unavailable/);
    if (retained.length) assert.equal(h.modal().task, selected);
  });
}

const malformed: [string, unknown][] = [
  ['nonarray response', {}], ['null response', null], ['null record', [null]], ['nonrecord row', ['row']],
  ['array record', [[]]], ['malformed image JSON', [task('bad', { images: '{' })]],
  ['decoded nonarray images', [task('bad', { images: '{}' })]],
  ['nonarray images', [task('bad', { images: 3 })]],
  ['nonstring images', [task('bad', { images: ['ok.png', null] })]],
  ['encoded nonstring images', [task('bad', { images: '["ok.png",5]' })]],
];
for (const [name, value] of malformed) {
  test(`${name} is unavailable initially and cannot replace accepted rows on refresh`, async t => {
    const h = tasksHarness(); t.after(() => h.unmount());
    h.request('tasks').resolve(value); await flush();
    assert.match(h.html(), /Tasks unavailable/); assert.equal(h.board(), undefined);
    h.button('Retry'); h.request('tasks', 1).resolve([task()]); await flush();
    const previous = h.board().tasks;
    h.board().onRefresh(); h.request('tasks', 2).resolve(value); await flush();
    assert.equal(h.board().tasks, previous); assert.match(h.html(), /last loaded data may be outdated/i);
    h.button('Retry'); h.request('tasks', 3).resolve([]); await flush();
    assert.deepEqual(h.board().tasks, []); assert.doesNotMatch(h.html(), /outdated|Tasks unavailable/);
  });
}

test('newest timer success wins over older manual success or rejection in the actual Tasks integration', async t => {
  const h = tasksHarness(); t.after(() => h.unmount());
  h.request('tasks').resolve([task()]); await flush();
  for (const outcome of ['success', 'failure']) {
    const index = h.calls.filter(call => call.method === 'tasks').length;
    h.board().onRefresh(); h.tick();
    h.request('tasks', index + 1).resolve([task('latest', { title: 'Latest task' })]); await flush();
    if (outcome === 'success') h.request('tasks', index).resolve([task('obsolete')]);
    else h.request('tasks', index).reject(new Error('obsolete private error'));
    await flush();
    assert.equal(h.board().tasks[0].id, 'latest'); assert.doesNotMatch(h.html(), /outdated|obsolete private error/);
  }
});

test('newest failed refresh keeps retained rows and warning when an older success arrives', async t => {
  const h = tasksHarness(); t.after(() => h.unmount());
  h.request('tasks').resolve([task()]); await flush();
  h.board().onRefresh(); h.tick(); h.request('tasks', 2).reject(new Error('newest failed')); await flush();
  h.request('tasks', 1).resolve([task('obsolete')]); await flush();
  assert.equal(h.board().tasks[0].id, 'task-1'); assert.match(h.html(), /last loaded data may be outdated/i);
});

test('board and modal callbacks keep the same refresh and each requests current task data', async t => {
  const h = tasksHarness(); t.after(() => h.unmount());
  h.request('tasks').resolve([task()]); h.request('agents').resolve([{ id: 'agent', name: 'Agent', identityEmoji: 'A' }]); await flush();
  const refresh = h.board().onRefresh; h.board().onSelect(h.board().tasks[0]);
  assert.equal(h.modal().onSaved, refresh); assert.equal(h.modal().agents[0].id, 'agent');
  h.modal().onSaved(); h.request('tasks', 1).resolve([]); await flush();
  assert.equal(h.board().onRefresh, refresh); assert.equal(h.modal().onSaved, refresh);
  h.board().onRefresh(); assert.equal(h.calls.filter(call => call.method === 'tasks').length, 3);
  assert.deepEqual(h.intervals, [10000]); h.request('tasks', 2).resolve([]); await flush();
  h.modal().onClose(); assert.equal(h.modal(), undefined);
});

for (const outcome of ['success', 'failure']) {
  test(`unmount fences pending task/agent ${outcome} and makes old timer/refresh inert`, async () => {
    const h = tasksHarness(); h.request('tasks').resolve([]); await flush();
    const refresh = h.board().onRefresh; const oldTimer = [...h.timers.values()][0];
    refresh(); h.unmount();
    if (outcome === 'success') { h.request('tasks', 1).resolve([task()]); h.request('agents').resolve([]); }
    else { h.request('tasks', 1).reject(new Error('late tasks')); h.request('agents').reject(new Error('late agents')); }
    await flush(); refresh(); oldTimer();
    assert.equal(h.postUnmountSetters(), 0); assert.equal(h.timers.size, 0);
    assert.equal(h.calls.filter(call => call.method === 'tasks').length, 2);
    assert.equal(h.calls.filter(call => call.method === 'agents').length, 1);
  });
}
