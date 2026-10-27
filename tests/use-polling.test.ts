import assert from 'node:assert/strict';
import test from 'node:test';
import { deferred, flush, pollingHarness } from './fixtures/files-selection-lifecycle';

test('old-key success cannot populate a replacement or finish its loading', async () => {
  const h = pollingHarness(), a = deferred(), b = deferred();
  h.render(() => a.promise, 30000, 'A'); h.render(() => b.promise, 30000, 'B');
  a.resolve('A'); await flush(); assert.equal(h.current().data, null); assert.equal(h.current().loading, true);
  b.resolve('B'); await flush(); assert.equal(h.current().data, 'B'); assert.equal(h.current().loading, false); h.unmount();
});
for (const stale of ['success', 'failure']) test(`old-key ${stale} after replacement settles cannot alter it`, async () => {
  const h = pollingHarness(), a = deferred(), b = deferred();
  h.render(() => a.promise, 30000, 'A'); h.render(() => b.promise, 30000, 'B'); b.resolve('B'); await flush();
  stale === 'success' ? a.resolve('A') : a.reject(new Error('old error')); await flush();
  assert.equal(h.current().data, 'B'); assert.equal(h.current().error, null); assert.equal(h.current().loading, false); h.unmount();
});
test('old-key rejection/finally while replacement pending is ignored and previous error resets', async () => {
  const h = pollingHarness(), bad = deferred(), a = deferred(), b = deferred();
  h.render(() => bad.promise, 30000, 'bad'); bad.reject(new Error('previous')); await flush(); assert.equal(h.current().error, 'previous');
  h.render(() => a.promise, 30000, 'A'); assert.equal(h.current().error, null);
  h.render(() => b.promise, 30000, 'B'); a.reject(new Error('stale')); await flush();
  assert.equal(h.current().error, null); assert.equal(h.current().loading, true); b.resolve('B'); await flush(); h.unmount();
});
test('manual and interval overlaps use newest request; same-key data survives refresh failure and success clears error', async () => {
  const h = pollingHarness(), requests: ReturnType<typeof deferred>[] = [];
  const fetcher = () => { const r = deferred(); requests.push(r); return r.promise; };
  const first = h.render(fetcher, 30000, 'A'); requests[0].resolve('initial'); await flush();
  assert.equal(h.current().data, 'initial'); const refresh = h.current().refresh; assert.equal(refresh, first.refresh);
  refresh(); h.tick(); requests[1].resolve('older manual'); await flush(); assert.equal(h.current().data, 'initial');
  requests[2].reject(new Error('current')); await flush(); assert.equal(h.current().data, 'initial'); assert.equal(h.current().error, 'current');
  refresh(); h.tick(); requests[4].resolve('latest'); await flush(); requests[3].reject(new Error('old manual')); await flush();
  assert.equal(h.current().data, 'latest'); assert.equal(h.current().error, null); assert.equal(requests.length, 5); h.unmount();
});
test('same-key fetcher update is used by stable refresh without starting another lifecycle', async () => {
  const h = pollingHarness(), a = deferred(), b = deferred(); let calls = 0;
  const refresh = h.render(() => a.promise, 30000, 'A').refresh; a.resolve('first'); await flush();
  assert.equal(h.render(() => { calls++; return b.promise; }, 30000, 'A').refresh, refresh); assert.equal(calls, 0);
  refresh(); assert.equal(calls, 1); b.resolve('second'); await flush(); assert.equal(h.current().data, 'second'); h.unmount();
});
test('interval replacement and unmount invalidate pending results, stale timers and manual refresh', async () => {
  const h = pollingHarness(), requests: ReturnType<typeof deferred>[] = [];
  const fetcher = () => { const r = deferred(); requests.push(r); return r.promise; };
  const refresh = h.render(fetcher, 30, 'A').refresh; const oldTimer = [...h.timers.values()][0];
  h.render(fetcher, 60, 'A'); requests[0].resolve('old interval'); await flush();
  assert.equal(h.current().data, null); assert.equal(h.current().loading, true); oldTimer(); assert.equal(requests.length, 2);
  h.unmount(); requests[1].reject(new Error('unmounted')); await flush(); refresh();
  assert.equal(h.postUnmountSetters(), 0); assert.equal(h.timers.size, 0); assert.equal(requests.length, 2);
});
