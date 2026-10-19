import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'vite';
import type { SystemMetrics } from '../src/lib/types.js';
import react from '@vitejs/plugin-react';
import { createServer as createNetServer } from 'node:net';
import { chromium, type Page } from 'playwright';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const capture = resolve('.superpowers/sdd/2026-10-19-operator-navigation-presentation/task-3-captures', process.env.DATA_SYNC_CAPTURE_PHASE || 'browser');
const overview = { gateway: { status: 'online' }, agentCount: 0, activeRunCount: 0, cronCount: 0, costToday: 0, costAllTime: 0, agents: [], sessions: [], crons: [], alerts: [], openPRs: [], recentDeploys: [], agentSummary: [] };
const system: SystemMetrics = {
    ram: { used: 2, total: 8, percent: 25, source: 'node:os', semantics: 'total-os.freemem', status: 'available', observedAt: '2026-10-19T00:00:00Z' },
    cpu: { percent: 0, source: 'node:os', status: 'available', observedAt: '2026-10-19T00:00:00Z' },
    disk: { total: 100, used: 10, percent: 10, path: '/fixture', mount: '/fixture', totalBytes: 100 * 1073741824, usedBytes: 10 * 1073741824, freeBytes: 90 * 1073741824, source: 'df', status: 'available', observedAt: '2026-10-19T00:00:00Z' },
    load: 0,
};
const responses: Record<string, unknown> = {
    '/api/overview': overview, '/api/system': system, '/api/setfarm/pipeline': [], '/api/agents': [], '/api/sessions': [], '/api/setfarm/activity?limit=50': [], '/api/setfarm/agents': [], '/api/setfarm/alerts': { counts: { failed: 0, timeout: 0, abandoned: 0 }, recent: [] }, '/api/workflows': [], '/api/runs': [],
    '/api/kimi-quota': { snapshot: { available: false, fetchedAt: 'fixture' }, severity: 'unknown', reason: 'fixture' }, '/api/model-limits': [], '/api/quota': {}, '/api/setfarm/agent-feed?limit=100': [],
    '/api/office/status': { agents: [{ id: 'koda', status: 'working', activity: 'Fixture task' }], timestamp: 1792368000000 },
};
async function harness(name: string, body: (p: Page, h: any) => Promise<void>) {
    await mkdir(capture, { recursive: true });
    const cache = await mkdtemp(join(tmpdir(), 'mc-data-sync-vite-'));
    const probe = createNetServer();
    await new Promise<void>((resolve, reject) => { probe.once('error', reject); probe.listen({ host: '127.0.0.1', port: 0 }, () => resolve()); });
    const port = (probe.address() as any).port;
    await new Promise<void>(resolve => probe.close(() => resolve()));
    const server = await createServer({ configFile: false, envFile: false, root: process.cwd(), cacheDir: cache, plugins: [react()], server: { host: '127.0.0.1', port, strictPort: true, hmr: false, proxy: {} }, logLevel: 'error' });
    // No application server is mounted; even an interception mistake is denied locally.
    server.middlewares.use((req, res, next) => { if (req.url?.startsWith('/api/') || req.url?.startsWith('/ws')) {
        res.statusCode = 403;
        res.end('TEST_NETWORK_DENIED');
    }
    else
        next(); });
    let browser: any, context: any, page: Page | undefined;
    const requests: string[] = [];
    const denied: string[] = [];
    const errors: string[] = [];
    const fail = new Set<string>(name === 'office-initial-failure' ? ['/api/office/status'] : []);
    const payloads = { ...responses };
    let ws: any;
    let wsCount = 0;
    let origin = '';
    try {
        await server.listen();
        const address = server.httpServer!.address() as any;
        assert.equal(address.address, '127.0.0.1');
        assert.ok(![3080, 3333, 18789, 13081, 13082].includes(address.port));
        origin = `http://127.0.0.1:${address.port}`;
        browser = await chromium.launch({ headless: true });
        context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
        await context.route('**/*', async (route: any) => {
            const url = new URL(route.request().url());
            const path = url.pathname + url.search;
            if (url.origin !== origin) {
                denied.push(url.href);
                return route.abort();
            }
            if (url.pathname.startsWith('/api/')) {
                requests.push(path);
                if (route.request().method() !== 'GET' || !(path in payloads)) {
                    denied.push(path);
                    return route.abort();
                }
                if (fail.has(path))
                    return route.fulfill({ status: 503, json: { error: 'FIXTURE_FAILURE' } });
                return route.fulfill({ json: payloads[path] });
            }
            if (url.pathname === '/tests/fixtures/data-sync-browser.html' || url.pathname === '/server/shared/agents.ts' || /^\/(src\/|tests\/fixtures\/|node_modules\/|@vite\/|@react-refresh|@fs\/)/.test(url.pathname))
                return route.continue();
            denied.push(path);
            return route.abort();
        });
        await context.routeWebSocket('**/*', (socket: any) => { const url = new URL(socket.url()); if (url.origin === origin.replace('http', 'ws') && url.pathname === '/' && url.searchParams.has('token')) {
            socket.send(JSON.stringify({ type: 'connected' }));
            return;
        } if (socket.url() !== origin.replace('http', 'ws') + '/ws') {
            denied.push(socket.url());
            socket.close();
            return;
        } wsCount++; ws = socket; });
        page = await context.newPage();
        page.on('pageerror', e => errors.push(String(e)));
        page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('status of 503'))
            errors.push(msg.text()); });
        await page.clock.install();
        await page.goto(origin + '/tests/fixtures/data-sync-browser.html' + (name.startsWith('office-') ? '?initial=/office' : name === 'initial-hidden' ? '?hidden=1' : ''));
        await page.waitForFunction(() => !!(window as any).fixture);
        const h = { requests, fail, denied, errors, setResponse: (path: string, value: unknown) => { assert.ok(path in payloads); payloads[path] = value; }, ws: () => ws, wsCount: () => wsCount, count: (path: string) => requests.filter(p => p === path).length, nav: async (path: string) => { await page!.evaluate(p => (window as any).fixture.navigate(p), path); await page!.waitForTimeout(100); }, visibility: async (visible: boolean) => { await page!.evaluate(v => (window as any).fixture.visibility(v), visible); await page!.waitForTimeout(100); }, shot: async (suffix: string) => page!.screenshot({ path: join(capture, name + '-' + suffix + '.png'), fullPage: true }) };
        await body(page, h);
        assert.deepEqual(denied, [], 'no unknown/external requests permitted');
        assert.deepEqual(errors, [], 'no application console errors');
    }
    finally {
        if (page) {
            await page.screenshot({ path: join(capture, name + '-final.png'), fullPage: true }).catch(() => { });
            await page.evaluate(() => (window as any).fixture?.unmount()).catch(() => { });
        }
        await context?.close();
        await browser?.close();
        await server.close();
        assert.equal(server.httpServer?.listening, false);
        await rm(cache, { recursive: true, force: true });
        await writeFile(join(capture, name + '-capture.json'), JSON.stringify({ ownerPid: process.pid, origin, requests, denied, errors, wsCount, cleanup: { browserClosed: !browser?.isConnected(), serverListening: server.httpServer?.listening, cacheRemoved: true } }, null, 2));
    }
}
test('actual Layout hook scopes requests and retained Office has one visible RAF chain with WS continuity', { timeout: 90000 }, async () => harness('lifecycle', async (p, h) => {
    await p.waitForFunction(() => !!(window as any).fixture.state().overview);
    assert.equal(h.count('/api/agents'), 0, 'Home must not poll Work collections');
    await h.nav('/setfarm');
    await p.waitForFunction(() => (window as any).fixture.state().activity !== null);
    assert.equal(h.count('/api/workflows'), 1);
    await h.nav('/workflows');
    await p.waitForFunction(() => (window as any).fixture.state().runs !== null);
    assert.equal(h.count('/api/workflows'), 1, 'shared Workflows ownership must not duplicate');
    await h.nav('/office');
    await p.waitForFunction(() => document.querySelector('.office-info')?.textContent?.includes('Fixture task'));
    await p.evaluate(() => { (window as any).retainedCanvas = document.querySelector('canvas'); });
    assert.equal(await p.evaluate(() => (window as any).rafFixture.pending.size), 1, 'exactly one RAF chain');
    const count = h.count('/api/office/status');
    await h.visibility(false);
    const owned = h.requests.filter((s: string) => s !== '/api/kimi-quota').length;
    assert.equal(await p.evaluate(() => (window as any).rafFixture.pending.size), 0);
    await p.clock.runFor(31000);
    assert.equal(h.count('/api/office/status'), count);
    assert.equal(h.requests.filter((s: string) => s !== '/api/kimi-quota').length, owned);
    h.ws().send(JSON.stringify({ event: 'chat', payload: { state: 'final', sessionKey: 'agent:koda:fixture', message: { role: 'assistant', content: [{ text: 'Retained hidden WS fixture event' }] } } }));
    await p.waitForTimeout(100);
    await h.visibility(true);
    await p.waitForFunction(() => document.querySelector('.office-info')?.textContent?.includes('Retained hidden WS fixture event'));
    assert.equal(h.count('/api/office/status'), count + 1);
    assert.equal(await p.evaluate(() => (window as any).rafFixture.pending.size), 1);
    await h.shot('resumed');
    await h.nav('/chat');
    const after = h.count('/api/office/status');
    await p.clock.runFor(15000);
    assert.equal(h.count('/api/office/status'), after);
    assert.equal(await p.evaluate(() => (window as any).rafFixture.pending.size), 0);
    await h.nav('/office/');
    await p.clock.runFor(5000);
    assert.equal(h.count('/api/office/status'), after, 'existing Office slash distinction retained');
    await h.nav('/office');
    assert.equal(await p.evaluate(() => document.querySelector('canvas') === (window as any).retainedCanvas), true);
    assert.equal(h.wsCount(), 1);
    assert.match(await p.locator('.office-info').innerText(), /Retained hidden WS/);
    h.fail.add('/api/office/status');
    await p.clock.runFor(5000);
    await p.waitForTimeout(100);
    assert.match(await p.locator('.pixel-office').innerText(), /Office: Stale/i);
    assert.match(await p.locator('.office-info').innerText(), /Fixture task/);
    await h.shot('office-stale');
    h.fail.clear();
    h.setResponse('/api/office/status', { malformed: true });
    await p.clock.runFor(5000);
    await p.waitForTimeout(100);
    assert.match(await p.locator('.pixel-office__error').innerText(), /FETCH_FAILED/);
    assert.match(await p.locator('.office-info').innerText(), /Fixture task/);
    h.setResponse('/api/office/status', responses['/api/office/status']);
    await p.clock.runFor(5000);
    await p.waitForTimeout(100);
    assert.equal(await p.locator('.pixel-office__error').count(), 0);
}));
test('real consumers distinguish first/partial failure, retained stale values and recovery', { timeout: 90000 }, async () => harness('consumers', async (p, h) => {
    await p.waitForFunction(() => !!(window as any).fixture.state().overview);
    h.fail.add('/api/overview');
    await h.visibility(false);
    await h.visibility(true);
    await p.waitForTimeout(100);
    assert.match(await p.locator('.overview').innerText(), /stale/i, 'retained overview must be labeled');
    assert.match(await p.locator('.status-bar').innerText(), /stale/i);
    await h.shot('retained');
    h.fail.add('/api/setfarm/alerts');
    h.fail.add('/api/setfarm/activity?limit=50');
    h.fail.add('/api/workflows');
    h.fail.add('/api/runs');
    await h.nav('/setfarm');
    await p.waitForTimeout(200);
    assert.match(await p.locator('.af-page').innerText(), /Alerts.*unavailable/i);
    assert.equal(await p.locator('.csb__pill--ok').count(), 0, 'unknown alerts must never claim OK');
    assert.match(await p.locator('.af-page').innerText(), /Activity.*unavailable/i);
    await h.shot('partial');
    await h.nav('/workflows');
    await p.waitForTimeout(200);
    assert.match(await p.locator('.workflows-page').innerText(), /unavailable/i);
    assert.equal(await p.locator('.kanban').count(), 0);
    h.fail.clear();
    await h.visibility(false);
    await h.visibility(true);
    await p.waitForFunction(() => (window as any).fixture.state().runs !== null);
    assert.doesNotMatch(await p.locator('.workflows-page').innerText(), /unavailable/i);
    await h.shot('recovered');
    // New mount proves first failure doesn't remain on the old global loading screen.
    h.fail.add('/api/overview');
    await p.reload();
    await p.waitForFunction(() => !!(window as any).fixture);
    await p.waitForTimeout(100);
    assert.match(await p.locator('.page-loading').innerText(), /Overview: Unavailable/i);
    assert.match(await p.locator('.status-bar').innerText(), /GATEWAY unknown/i);
    await h.shot('first-overview-failure');
}));
test('direct Office mount starts one chain and document hiding stops its actual status and animation', { timeout: 90000 }, async () => harness('office-direct', async (p, h) => {
    await p.waitForFunction(() => document.querySelector('.office-info')?.textContent?.includes('Fixture task'));
    assert.equal(await p.evaluate(() => (window as any).rafFixture.pending.size), 1, 'direct Office must start once');
    const before = h.count('/api/office/status');
    assert.equal(await p.evaluate(() => { (window as any).fixture.visibility(false); return (window as any).rafFixture.pending.size; }), 0, 'visibility event immediately cancels Office animation before React commits');
    await h.visibility(false);
    await p.clock.runFor(11000);
    assert.equal(h.count('/api/office/status'), before, 'hidden document cannot poll Office');
    assert.equal(await p.evaluate(() => (window as any).rafFixture.pending.size), 0);
}));
test('actual hidden Layout mount makes zero owned HTTP calls and unmount releases listeners/timers', { timeout: 90000 }, async () => harness('initial-hidden', async (p, h) => {
    const owned = ['/api/overview', '/api/system', '/api/setfarm/pipeline', '/api/agents', '/api/workflows', '/api/runs', '/api/office/status'];
    await p.clock.runFor(31000);
    assert.equal(h.requests.filter((path: string) => owned.includes(path)).length, 0);
    assert.equal(h.wsCount(), 1, 'Office WS continuity is explicitly retained');
    await h.visibility(true);
    await p.waitForFunction(() => !!(window as any).fixture.state().overview);
    assert.equal(h.count('/api/overview'), 1);
    assert.equal(h.count('/api/system'), 1);
    assert.equal(h.count('/api/setfarm/pipeline'), 1);
    assert.equal(h.count('/api/office/status'), 0);
    await p.evaluate(() => (window as any).fixture.unmount());
    const before = h.requests.length;
    await h.visibility(false);
    await h.visibility(true);
    await p.clock.runFor(60000);
    assert.equal(h.requests.length, before);
    assert.equal(await p.evaluate(() => (window as any).rafFixture.pending.size), 0);
}));
test('first Office failure displays unknown rather than invented all-idle state and later recovers', { timeout: 90000 }, async () => harness('office-initial-failure', async (p, h) => {
    await p.waitForFunction(() => document.querySelector('.pixel-office__error') !== null);
    const text = await p.locator('.office-info').innerText();
    assert.match(text, /unknown/i);
    assert.doesNotMatch(text, /All idle/i);
    await h.shot('unknown');
    h.fail.clear();
    await p.clock.runFor(5000);
    await p.waitForFunction(() => document.querySelector('.office-info')?.textContent?.includes('Fixture task'));
    assert.equal(await p.locator('.pixel-office__error').count(), 0);
}));
