import assert from 'node:assert/strict';
import { test } from 'node:test';
const modulePath = '../src/lib/data-sync.js';
async function production() {
    const mod = await import(modulePath).catch(() => ({}));
    assert.equal(typeof mod.createDataSync, 'function', 'production scheduler must own polling');
    return mod;
}
const keys = ['overview', 'system', 'agents', 'pipeline', 'activity', 'wfAgents', 'alerts', 'workflows', 'runs', 'sessions'];
const flush = async () => { for (let i = 0; i < 6; i++)
    await Promise.resolve(); };
function deferred() { let resolve!: (v: any) => void; let reject!: (e: any) => void; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
async function setup() {
    const { createDataSync } = await production();
    let now = 100;
    let tick: () => void = () => { };
    let cleared = false;
    const state: any = {};
    const calls: string[] = [];
    const loaders: Record<string, () => Promise<any>> = {};
    const fetchers = Object.fromEntries(keys.map(k => [k, () => { calls.push(k); return loaders[k]?.() ?? Promise.resolve([k]); }]));
    const owner = createDataSync({ fetchers, onUpdate: (patch: any) => Object.assign(state, patch), now: () => now, setInterval: (fn: () => void, ms: number) => { assert.equal(ms, 15000); tick = fn; return 7; }, clearInterval: (id: number) => { assert.equal(id, 7); cleared = true; } });
    return { owner, state, calls, loaders, advance: async (ms = 15000) => { now += ms; tick(); await flush(); }, time: (n: number) => { now = n; }, cleared: () => cleared };
}
test('hidden initial mount and repeated resume issue only eligible requests, with disposal', async () => {
    const x = await setup();
    x.owner.setContext('/setfarm', false);
    await x.advance(60000);
    assert.deepEqual(x.calls, []);
    x.owner.setContext('/workflows/', true);
    x.owner.setContext('/workflows/', true);
    await flush();
    assert.deepEqual(x.calls.sort(), ['overview', 'pipeline', 'runs', 'system', 'workflows']);
    assert.equal(x.state.sync.agents.ownership, 'unselected');
    assert.equal(x.state.sync.runs.stale, false);
    x.owner.setContext('/workflows', false);
    assert.equal(x.state.sync.runs.ownership, 'paused');
    assert.equal(x.state.sync.runs.stale, true);
    const count = x.calls.length;
    await x.advance();
    assert.equal(x.calls.length, count);
    x.owner.setContext('/workflows', true);
    await flush();
    assert.equal(x.calls.length, count + 5);
    x.owner.dispose();
    assert.equal(x.cleared(), true);
    await x.advance();
    assert.equal(x.calls.length, count + 5);
});
test('route groups are exact, query/hash independent, slash aware and shared cadence survives switches', async () => {
    const { dataSyncKeysForPath } = await production();
    const shared = ['overview', 'system', 'pipeline'];
    for (const route of ['/', '/setfarm/active', '/setfarm/runs/id', '/setfarm-other', '/workflows/child', '/perf', '/unknown', '/office/'])
        assert.deepEqual(dataSyncKeysForPath(route), shared, route);
    assert.deepEqual(dataSyncKeysForPath('/setfarm/?x=1#tab'), ['overview', 'system', 'pipeline', 'agents', 'activity', 'wfAgents', 'alerts', 'workflows', 'sessions']);
    assert.deepEqual(dataSyncKeysForPath('/workflows/'), ['overview', 'system', 'pipeline', 'workflows', 'runs']);
    const x = await setup();
    x.owner.setContext('/setfarm', true);
    await flush();
    assert.equal(x.calls.length, 9);
    x.calls.length = 0;
    x.owner.setContext('/workflows', true);
    await flush();
    assert.deepEqual(x.calls, ['runs']);
    await x.advance();
    assert.equal(x.calls.length, 6);
    assert.equal(x.state.sync.agents.stale, true);
    x.owner.dispose();
});
test('independent settlement retains good data, reports bounded errors and recovers genuine empty/null', async () => {
    const x = await setup();
    const hanging = deferred();
    x.loaders.pipeline = () => hanging.promise;
    x.owner.setContext('/', true);
    await flush();
    assert.deepEqual(x.state.overview, ['overview']);
    assert.equal(x.state.initialLoading, false);
    assert.equal(x.state.pipeline, undefined);
    const previous = x.state.overview;
    const observed = x.state.sync.overview.observedAt;
    x.loaders.overview = () => Promise.reject(new Error('secret raw HTTP body'));
    await x.advance();
    assert.equal(x.state.overview, previous);
    assert.equal(x.state.sync.overview.observedAt, observed);
    assert.equal(x.state.sync.overview.stale, true);
    assert.equal(x.state.sync.overview.errorCode, 'FETCH_FAILED');
    assert.equal(x.state.sync.overview.errorAt, 15100);
    assert.equal(x.calls.filter(k => k === 'pipeline').length, 1);
    x.loaders.overview = () => Promise.resolve(null);
    await x.advance();
    assert.equal(x.state.overview, null);
    assert.equal(x.state.sync.overview.stale, false);
    assert.equal(x.state.sync.overview.errorCode, null);
    x.owner.accept('pipeline', []);
    assert.deepEqual(x.state.pipeline, []);
    hanging.resolve(['obsolete']);
    await flush();
    assert.deepEqual(x.state.pipeline, []);
    x.owner.dispose();
});
test('aged active receipts become stale while an endpoint hangs and resume stays stale until success', async () => {
    const x = await setup();
    x.owner.setContext('/', true);
    await flush();
    const slow = deferred();
    x.loaders.overview = () => slow.promise;
    await x.advance();
    assert.equal(x.state.sync.overview.stale, false);
    await x.advance();
    assert.equal(x.state.sync.overview.stale, true);
    x.owner.setContext('/', false);
    const current = deferred();
    x.loaders.overview = () => current.promise;
    x.owner.setContext('/', true);
    assert.equal(x.state.sync.overview.stale, true);
    slow.resolve(['old']);
    await flush();
    assert.deepEqual(x.state.overview, ['overview']);
    current.resolve(['current']);
    await flush();
    assert.deepEqual(x.state.overview, ['current']);
    assert.equal(x.state.sync.overview.stale, false);
    x.owner.dispose();
});
test('route removal fences old success/error and allows current route fetch without a hanging predecessor', async () => {
    const x = await setup();
    const first = deferred();
    x.loaders.activity = () => first.promise;
    x.owner.setContext('/setfarm', true);
    await flush();
    x.owner.setContext('/workflows', true);
    const next = deferred();
    x.loaders.activity = () => next.promise;
    x.owner.setContext('/setfarm', true);
    next.resolve(['new']);
    await flush();
    const meta = x.state.sync.activity;
    first.reject(new Error('old error'));
    await flush();
    assert.deepEqual(x.state.activity, ['new']);
    assert.equal(x.state.sync.activity, meta);
    x.owner.dispose();
});
test('acknowledged activity clear and post-start pipeline/runs refresh fence preceding polls', async () => {
    for (const key of ['activity', 'pipeline', 'runs']) {
        const x = await setup();
        const first = deferred();
        x.loaders[key] = () => first.promise;
        x.owner.setContext(key === 'runs' ? '/workflows' : '/setfarm', true);
        await flush();
        if (key === 'activity')
            x.owner.accept(key, []);
        else {
            x.loaders[key] = () => Promise.resolve(['post-start']);
            await x.owner.refresh(key);
        }
        const meta = x.state.sync[key];
        first.resolve(['old']);
        await flush();
        assert.deepEqual(x.state[key], key === 'activity' ? [] : ['post-start']);
        assert.equal(x.state.sync[key], meta);
        x.owner.dispose();
    }
});
test('receipt expiry uses its own exact age even between shared polling ticks', async () => {
    const { createDataSync } = await production();
    let now = 100;
    const expiries = new Map<number, {
        fn: () => void;
        ms: number;
    }>();
    let serial = 0;
    let state: any = {};
    const owner = createDataSync({ fetchers: Object.fromEntries(keys.map(key => [key, () => Promise.resolve([])])), now: () => now, onUpdate: (patch: any) => { state = { ...state, ...patch }; }, setInterval: () => 1, clearInterval: () => { }, setTimeout: (fn: () => void, ms: number) => { const id = ++serial; expiries.set(id, { fn, ms }); return id; }, clearTimeout: (id: number) => { expiries.delete(id); } });
    owner.setContext('/', true);
    await flush();
    assert.equal(expiries.size, 3, 'each active receipt needs an expiry independent of the next poll');
    assert.deepEqual([...expiries.values()].map(v => v.ms), [30000, 30000, 30000]);
    now = 30100;
    for (const { fn } of [...expiries.values()])
        fn();
    assert.equal(state.sync.overview.stale, true);
    assert.equal(state.sync.system.stale, true);
    owner.dispose();
    assert.equal(expiries.size, 0);
});
test('disposed generations cannot commit and retained receipt metadata survives a new owner', async () => {
    const { createDataSync } = await production();
    const x = await setup();
    const pending = deferred();
    x.loaders.overview = () => pending.promise;
    x.owner.setContext('/', true);
    await flush();
    x.owner.dispose();
    const last = x.state.sync;
    pending.resolve(['obsolete']);
    await flush();
    assert.equal(x.state.sync, last);
    assert.equal(x.state.overview, undefined);
    let state: any = {};
    const initialSync = structuredClone(last);
    initialSync.overview.observedAt = 50;
    const owner = createDataSync({ fetchers: Object.fromEntries(keys.map(key => [key, () => new Promise(() => { })])), initialSync, now: () => 100, onUpdate: (patch: any) => Object.assign(state, patch), setInterval: () => 1, clearInterval: () => { } });
    owner.setContext('/', true);
    assert.equal(state.sync.overview.observedAt, 50);
    assert.equal(state.sync.overview.stale, true);
    owner.dispose();
});
