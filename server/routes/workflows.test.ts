import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as workflows from './workflows.js';
import { cached, getCached, invalidateCache, setCache } from '../utils/cache.js';
async function invoke(load: () => Promise<unknown>) {
    const factory = (workflows as any).createWorkflowsHandler;
    assert.equal(typeof factory, 'function', 'actual Workflows handler must expose injected load/cache ports');
    let status = 200, body: unknown;
    const calls: any[] = [];
    const cache = async (key: string, ttl: number, loader: () => Promise<unknown>) => { calls.push([key, ttl]); return loader(); };
    const res = { status: (code: number) => { status = code; return res; }, json: (data: unknown) => { body = data; } };
    await factory(load, cache)({}, res);
    return { status, body, calls };
}
test('actual Workflows route preserves valid collections including empty arrays', async () => {
    for (const list of [[{ id: 'workflow', name: 'Fixture' }], []]) {
        const result = await invoke(async () => list);
        assert.equal(result.status, 200);
        assert.equal(result.body, list);
        assert.deepEqual(result.calls, [['workflows', 30000]]);
    }
});
test('cold load rejection and malformed payload return bounded 503 instead of invented empty success', async () => {
    for (const load of [async () => { throw new Error('private path/provider secret'); }, async () => ({ workflows: [] }), async () => null]) {
        const result = await invoke(load);
        assert.equal(result.status, 503);
        assert.deepEqual(result.body, { error: 'WORKFLOWS_UNAVAILABLE' });
    }
});
test('generic 30s SWR contract retains last good data and cold/hard-expired failures reject', async () => {
    const key = 'task3-workflows-isolated';
    const originalNow = Date.now;
    let now = 1000;
    Date.now = () => now;
    try {
        const list = [{ id: 'retained' }];
        setCache(key, list, 30000);
        now += 30001;
        assert.equal(await cached(key, 30000, async () => { throw new Error('background'); }), list);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(getCached(key), list);
        now += 120001;
        await assert.rejects(cached(key, 30000, async () => { throw new Error('hard-expired'); }), /hard-expired/);
        assert.equal(getCached(key), null);
        invalidateCache(key);
        await assert.rejects(cached(key, 30000, async () => { throw new Error('cold'); }), /cold/);
    }
    finally {
        Date.now = originalNow;
        invalidateCache(key);
    }
});
