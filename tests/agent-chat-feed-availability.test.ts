import assert from 'node:assert/strict';
import test from 'node:test';
import { agentFeedHarness, feedEntry, flush } from './fixtures/agent-chat-feed-availability-lifecycle';

test('initial pending feed stays loading without an accepted empty message or extra rerender reads', t => {
  const h = agentFeedHarness(); t.after(() => h.unmount());
  assert.match(h.html(), /Loading feed/); assert.doesNotMatch(h.html(), /No agent output yet|Agent output unavailable/);
  h.render(); h.render(); assert.equal(h.calls.length, 1); assert.equal(h.calls[0].limit, 100);
  assert.deepEqual(h.intervals, [10000]); assert.equal(h.timers.size, 1);
});

test('initial rejected feed is unavailable rather than empty and Retry recovers without exposing the error', async t => {
  const h = agentFeedHarness(); t.after(() => h.unmount());
  h.request().reject(new Error('private upstream response body')); await flush();
  assert.match(h.html(), /Agent output unavailable/);
  assert.doesNotMatch(h.html(), /No agent output yet|private upstream response body/);
  const refresh = h.retryCallback(); h.render(); assert.equal(h.retryCallback(), refresh);
  const retried = h.retry(); assert.match(h.html(), /Agent output unavailable/);
  h.request(1).resolve([]); await retried; await flush();
  assert.match(h.html(), /No agent output yet/); assert.doesNotMatch(h.html(), /unavailable|outdated/);
  assert.equal(h.retryCallback(), undefined); assert.deepEqual(h.calls.map(call => call.limit), [100, 100]);
});

test('accepted empty feed retains the successful empty state without an error or Retry', async t => {
  const h = agentFeedHarness(); t.after(() => h.unmount()); h.request().resolve([]); await flush();
  assert.match(h.html(), /No agent output yet/); assert.doesNotMatch(h.html(), /unavailable|outdated|Loading feed/);
  assert.equal(h.messages().length, 0); assert.equal(h.retryCallback(), undefined);
});

test('accepted rows preserve actual known and unknown agent identity and message rendering', async t => {
  const h = agentFeedHarness(); t.after(() => h.unmount());
  h.request().resolve([feedEntry(), feedEntry(2, { agent_id: 'external', agent_name: 'External agent', message: 'Second safe message' })]); await flush();
  assert.match(h.html(), /Arya/); assert.match(h.html(), /External agent/);
  assert.match(h.html(), /First safe message/); assert.match(h.html(), /Second safe message/);
  assert.deepEqual(h.messages().map(node => node.key), ['1', '2']);
  assert.doesNotMatch(h.html(), /No agent output yet|unavailable|outdated/);
});

for (const accepted of [[], [feedEntry()]]) {
  test(`failed refresh keeps accepted ${accepted.length ? 'messages' : 'empty data'} visibly retained until Retry success`, async t => {
    const h = agentFeedHarness(); t.after(() => h.unmount()); h.request().resolve(accepted); await flush();
    h.tick(); h.request(1).reject(new Error('private refresh error')); await flush();
    assert.match(h.html(), /last loaded data may be outdated/i); assert.doesNotMatch(h.html(), /private refresh error|Agent output unavailable/);
    assert.equal(h.messages().length, accepted.length);
    assert.match(h.html(), accepted.length ? /First safe message/ : /No agent output yet/);
    const refresh = h.retryCallback(); h.render(); assert.equal(h.retryCallback(), refresh);
    const retried = h.retry(); assert.match(h.html(), /last loaded data may be outdated/i);
    h.request(2).resolve([feedEntry(3, { message: 'Recovered safe message' })]); await retried; await flush();
    assert.match(h.html(), /Recovered safe message/); assert.doesNotMatch(h.html(), /First safe message|outdated|unavailable/);
    assert.deepEqual(h.messages().map(node => node.key), ['3']); assert.deepEqual(h.intervals, [10000]);
  });
}

for (const [label, payload] of [['null', null], ['object', {}], ['string', 'not a feed']] as const) {
  test(`nonarray ${label} response rejects before acceptance and cannot replace retained messages`, async t => {
    const h = agentFeedHarness(); t.after(() => h.unmount()); h.request().resolve(payload); await flush();
    let html = '';
    assert.doesNotThrow(() => { html = h.html(); }, 'invalid feed must reject before rendering');
    assert.match(html, /Agent output unavailable/); assert.equal(h.messages().length, 0);
    h.retry(); h.request(1).resolve([feedEntry()]); await flush();
    h.tick(); h.request(2).resolve(payload); await flush();
    assert.match(h.html(), /First safe message/); assert.match(h.html(), /last loaded data may be outdated/i);
    assert.deepEqual(h.messages().map(node => node.key), ['1']);
    h.retry(); h.request(3).resolve([]); await flush();
    assert.match(h.html(), /No agent output yet/); assert.doesNotMatch(h.html(), /outdated|unavailable/);
  });
}

for (const outcome of ['success', 'failure']) {
  test(`newest timer success wins over older Retry ${outcome}`, async t => {
    const h = agentFeedHarness(); t.after(() => h.unmount()); h.request().resolve([feedEntry()]); await flush();
    h.tick(); h.request(1).reject(new Error('current refresh failed')); await flush();
    h.retry(); h.tick(); h.request(3).resolve([feedEntry(3, { message: 'Newest safe message' })]); await flush();
    if (outcome === 'success') h.request(2).resolve([feedEntry(2, { message: 'Obsolete safe message' })]);
    else h.request(2).reject(new Error('obsolete private error'));
    await flush(); assert.match(h.html(), /Newest safe message/);
    assert.doesNotMatch(h.html(), /Obsolete safe message|outdated|obsolete private error/);
  });
}

test('newest failed refresh retains messages and warning when an older Retry succeeds', async t => {
  const h = agentFeedHarness(); t.after(() => h.unmount()); h.request().resolve([feedEntry()]); await flush();
  h.tick(); h.request(1).reject(new Error('refresh failed')); await flush();
  h.retry(); h.tick(); h.request(3).reject(new Error('newest failed')); await flush();
  h.request(2).resolve([feedEntry(2, { message: 'Obsolete safe message' })]); await flush();
  assert.match(h.html(), /First safe message/); assert.match(h.html(), /last loaded data may be outdated/i);
  assert.doesNotMatch(h.html(), /Obsolete safe message|newest failed/);
});

for (const outcome of ['success', 'failure']) {
  test(`unmount fences pending feed ${outcome} and leaves old Retry/timer inert`, async () => {
    const h = agentFeedHarness(); h.request().reject(new Error('initial failed')); await flush();
    const refresh = h.retryCallback(); assert.equal(typeof refresh, 'function');
    const oldTimer = [...h.timers.values()][0]; h.retry(); h.unmount();
    if (outcome === 'success') h.request(1).resolve([feedEntry()]);
    else h.request(1).reject(new Error('late failed'));
    await flush(); refresh(); oldTimer();
    assert.equal(h.postUnmountSetters(), 0); assert.equal(h.timers.size, 0); assert.equal(h.calls.length, 2);
  });
}
