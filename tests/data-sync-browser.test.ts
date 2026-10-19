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
    const held = new Map<string, { promise: Promise<void>; release: () => void }>();
    const outstanding = new Map<string, number>();
    const hold = (path: string) => {
        assert.ok(path in payloads);
        if (!held.has(path)) {
            let release!: () => void;
            const promise = new Promise<void>(resolve => { release = resolve; });
            held.set(path, { promise, release });
        }
    };
    const release = (path: string) => { held.get(path)?.release(); held.delete(path); };
    if (name === 'office-loading') hold('/api/office/status');
    let ws: any;
    let wsCount = 0;
    const activeSockets = new Set<any>();
    let wsClosed = 0;
    let origin = '';
    try {
        await server.listen();
        const address = server.httpServer!.address() as any;
        assert.equal(address.address, '127.0.0.1');
        assert.ok(![3080, 3333, 18789, 13081, 13082].includes(address.port));
        origin = `http://127.0.0.1:${address.port}`;
        browser = await chromium.launch({ headless: true });
        context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
        // Capture the real engine's draw calls, keeping only bounded latest coordinates.
        await context.addInitScript(() => {
            const original = CanvasRenderingContext2D.prototype.fillText;
            const latest = new Map<string, string>();
            const bounds = new Map<string, { text: string; left: number; right: number; y: number }>();
            Object.assign(window, { officeDraws: latest, officeDrawBounds: bounds });
            CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
                if (this.canvas.classList.contains('pixel-office__canvas')) {
                    const key = `${x},${y}`;
                    latest.set(key, String(text));
                    const width = this.measureText(String(text)).width;
                    const left = this.textAlign === 'center' ? x - width / 2 : this.textAlign === 'right' ? x - width : x;
                    bounds.set(key, { text: String(text), left, right: left + width, y });
                    if (latest.size > 512) latest.delete(latest.keys().next().value!);
                    if (bounds.size > 512) bounds.delete(bounds.keys().next().value!);
                }
                return maxWidth === undefined ? original.call(this, text, x, y)
                    : original.call(this, text, x, y, maxWidth);
            };
        });
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
                outstanding.set(path, (outstanding.get(path) || 0) + 1);
                try {
                    await held.get(path)?.promise;
                    if (fail.has(path))
                        return await route.fulfill({ status: 503, json: { error: 'FIXTURE_FAILURE' } });
                    return await route.fulfill({ json: payloads[path] });
                } finally {
                    outstanding.set(path, outstanding.get(path)! - 1);
                }
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
        } wsCount++; ws = socket; activeSockets.add(socket);
            socket.onClose(() => { if (activeSockets.delete(socket)) wsClosed++; });
        });
        page = await context.newPage();
        page.on('pageerror', e => errors.push(String(e)));
        page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('status of 503'))
            errors.push(msg.text()); });
        await page.clock.install();
        await page.goto(origin + '/tests/fixtures/data-sync-browser.html' + (name.startsWith('office-') ? '?initial=/office' : name === 'initial-hidden' ? '?hidden=1' : ''));
        await page.waitForFunction(() => !!(window as any).fixture);
        const h = { requests, fail, denied, errors, hold, release, outstanding: (path: string) => outstanding.get(path) || 0, setResponse: (path: string, value: unknown) => { assert.ok(path in payloads); payloads[path] = value; }, ws: () => ws, wsCount: () => wsCount, activeWs: () => activeSockets.size, wsClosed: () => wsClosed, count: (path: string) => requests.filter(p => p === path).length, nav: async (path: string) => { await page!.evaluate(p => (window as any).fixture.navigate(p), path); await page!.waitForTimeout(100); }, visibility: async (visible: boolean) => { await page!.evaluate(v => (window as any).fixture.visibility(v), visible); await page!.waitForTimeout(100); }, shot: async (suffix: string) => page!.screenshot({ path: join(capture, name + '-' + suffix + '.png'), fullPage: true }) };
        await body(page, h);
        assert.deepEqual(denied, [], 'no unknown/external requests permitted');
        assert.deepEqual(errors, [], 'no application console errors');
    }
    finally {
        for (const path of held.keys()) release(path);
        if (page) {
            await page.screenshot({ path: join(capture, name + '-final.png'), fullPage: true }).catch(() => { });
            await page.evaluate(() => (window as any).fixture?.unmount()).catch(() => { });
        }
        await context?.close();
        await browser?.close();
        await server.close();
        assert.equal(server.httpServer?.listening, false);
        await rm(cache, { recursive: true, force: true });
        await writeFile(join(capture, name + '-capture.json'), JSON.stringify({ ownerPid: process.pid, origin, requests, denied, errors, wsCount, wsClosed, cleanup: { browserClosed: !browser?.isConnected(), serverListening: server.httpServer?.listening, cacheRemoved: true } }, null, 2));
    }
}
test('actual Layout hook scopes requests and retained Office has one visible RAF chain with scoped WS ownership', { timeout: 90000 }, async () => harness('lifecycle', async (p, h) => {
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
    assert.equal(h.wsCount(), 1);
    assert.equal(h.activeWs(), 1);
    h.ws().send(JSON.stringify({ event: 'chat', payload: { state: 'final', sessionKey: 'agent:koda:fixture', message: { role: 'assistant', content: [{ text: 'Retained visible WS fixture event' }] } } }));
    await p.waitForFunction(() => document.querySelector('.office-info')?.textContent?.includes('Retained visible WS fixture event'));
    const count = h.count('/api/office/status');
    await h.visibility(false);
    assert.equal(h.activeWs(), 0, 'hidden Office closes its owned socket');
    assert.equal(h.wsClosed(), 1);
    const owned = h.requests.filter((s: string) => s !== '/api/kimi-quota').length;
    assert.equal(await p.evaluate(() => (window as any).rafFixture.pending.size), 0);
    await p.clock.runFor(31000);
    assert.equal(h.count('/api/office/status'), count);
    assert.equal(h.requests.filter((s: string) => s !== '/api/kimi-quota').length, owned);
    assert.equal(h.activeWs(), 0, 'hidden Office creates no replacement socket');
    assert.equal(h.wsCount(), 1);
    await h.visibility(true);
    assert.match(await p.locator('.office-info').innerText(), /Retained visible WS fixture event/);
    assert.equal(h.activeWs(), 1, 'resume creates exactly one current owned socket');
    assert.equal(h.wsCount(), 2);
    assert.equal(h.count('/api/office/status'), count + 1);
    assert.equal(await p.evaluate(() => (window as any).rafFixture.pending.size), 1);
    await h.shot('resumed');
    await h.nav('/chat');
    assert.equal(h.activeWs(), 0, 'unselected Office releases its socket');
    const after = h.count('/api/office/status');
    await p.clock.runFor(15000);
    assert.equal(h.count('/api/office/status'), after);
    assert.equal(await p.evaluate(() => (window as any).rafFixture.pending.size), 0);
    await h.nav('/office/');
    await p.clock.runFor(5000);
    assert.equal(h.count('/api/office/status'), after, 'existing Office slash distinction retained');
    await h.nav('/office');
    assert.equal(await p.evaluate(() => document.querySelector('canvas') === (window as any).retainedCanvas), true);
    assert.equal(h.wsCount(), 3, 'returning to Office creates only one new socket');
    assert.equal(h.activeWs(), 1);
    assert.match(await p.locator('.office-info').innerText(), /Retained visible WS/);
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
    const compactCards = p.locator('.af-agent-card');
    assert.equal(await compactCards.count(), 14, 'all catalog defaults remain visible without runtime agents');
    assert.equal(await compactCards.locator('.af-agent-card__provenance').filter({ hasText: /^Static default$/ }).count(), 14);
    assert.equal(await compactCards.locator('.af-agent-card__provider').filter({ hasText: /^Provider: unknown$/ }).count(), 14, 'catalog model prefixes cannot invent a provider');
    for (const card of await compactCards.all()) {
        assert.equal(await card.evaluate(element => {
            let opacity = 1;
            for (let node: Element | null = element; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
            return opacity;
        }), 1, 'never-used cards retain full computed opacity through their ancestors');
        for (const selector of ['.af-agent-card__name', '.af-agent-card__model', '.af-agent-card__badge', '.af-agent-card__provenance']) {
            const label = card.locator(selector);
            assert.equal(await label.isVisible(), true);
            assert.equal(await label.evaluate(element => element.scrollWidth <= element.clientWidth), true, `${selector} must fit or wrap`);
        }
        assert.match(await card.locator('.af-agent-card__model').evaluate(element => getComputedStyle(element).fontFamily), /mono/i);
        assert.doesNotMatch(await card.locator('.af-agent-card__provenance').evaluate(element => getComputedStyle(element).fontFamily), /mono/i);
    }
    assert.match(await p.locator('.af-page').innerText(), /Last received/);
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
    assert.equal(h.wsCount(), 0, 'initially hidden Office never creates a socket');
    assert.equal(h.activeWs(), 0);
    await h.visibility(true);
    await p.waitForFunction(() => !!(window as any).fixture.state().overview);
    assert.equal(h.count('/api/overview'), 1);
    assert.equal(h.count('/api/system'), 1);
    assert.equal(h.count('/api/setfarm/pipeline'), 1);
    assert.equal(h.count('/api/office/status'), 0);
    assert.equal(h.wsCount(), 0, 'Home visibility does not activate the unselected Office socket');
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
    assert.match(await officeHud(p), /ROLES 10 · MAPPING UNAVAILABLE/);
    await h.shot('unknown');
    h.fail.clear();
    await p.clock.runFor(5000);
    await p.waitForFunction(() => document.querySelector('.office-info')?.textContent?.includes('Fixture task'));
    assert.equal(await p.locator('.pixel-office__error').count(), 0);
}));

const officePath = '/api/office/status';
const zeroOffice = { agents: ['main', 'koda', 'flux', 'atlas', 'iris', 'sentinel', 'cipher', 'lux', 'nexus', 'prism'].map(id => ({ id, status: 'idle', activity: '' })), timestamp: 1792368000000 };
async function officeHud(p: Page) {
    await p.clock.runFor(20);
    return p.evaluate(() => Array.from((window as any).officeDraws.values()).join('\n'));
}
async function nextOffice(p: Page) {
    await p.clock.runFor(5000);
    await p.waitForTimeout(100);
}

// A numeric zero before receipt, an animation census, or promoting retained data
// to fresh would break these assertions on the actual mounted DOM and canvas.
test('held first Office receipt is unknown, then observed zero and catalog copy remain readable at three widths', { timeout: 90000 }, async () => harness('office-loading', async (p, h) => {
    await p.waitForFunction(() => document.querySelector('.office-info') !== null);
    const text = await p.locator('.office-info').innerText();
    assert.match(text, /Mapped workflow roles \(unknown\)/i);
    assert.match(text, /No observed workflow mapping \(unknown\)/i);
    const unknownHud = await officeHud(p);
    assert.match(unknownHud, /ROLES 10 · MAPPING UNKNOWN/);
    assert.doesNotMatch(unknownHud, /MAPPED 0|ACTIVE|WORKING/);
    h.setResponse(officePath, zeroOffice); h.release(officePath);
    await p.waitForFunction(() => document.querySelector('.office-info')?.textContent?.includes('roles (0)'));
    assert.match(await p.locator('.office-info').innerText(), /No observed workflow mapping \(10\)/i);
    assert.match(await p.locator('.office-info').innerText(), /No observed workflow mappings in returned runs/);
    assert.doesNotMatch(await p.locator('.office-info').innerText(), /All idle|WORKING|ACTIVE/);
    const zeroHud = await officeHud(p);
    assert.match(zeroHud, /ROLES 10 · MAPPED 0/);
    assert.doesNotMatch(zeroHud, /STALE|UNAVAILABLE|ACTIVE|WORKING/);
    assert.match(await p.locator('.pixel-office').innerText(), /Static role catalog.*animations are illustrative/);
    assert.match(await p.locator('.pixel-office').innerText(), /not worker ownership.*Receipt time does not verify upstream freshness/);
    for (const width of [390, 768, 1440]) {
        await p.setViewportSize({ width, height: 1000 });
        await officeHud(p);
        const dimensions = await p.locator('.pixel-office__canvas').evaluate((canvas: HTMLCanvasElement) => ({ width: canvas.width, height: canvas.height }));
        assert.deepEqual(dimensions, { width: 1100, height: 720 }, 'retain logical art dimensions and intentional canvas scrolling');
        const hudBounds = await p.evaluate(() => Array.from((window as any).officeDrawBounds.values()).filter((b: any) => b.text.startsWith('ROLES ') || b.text.startsWith('STATIC ROLE CATALOG')) as { left: number; right: number; y: number }[]);
        assert.equal(hudBounds.length, 2);
        assert.ok(hudBounds.every(b => b.left >= 0 && b.right <= 1100 && b.y > 690 && b.y <= 720), 'actual HUD text stays inside the logical canvas');
        for (const selector of ['.pixel-office > p', '.office-info__title']) {
            for (const element of await p.locator(selector).all()) {
                assert.equal(await element.evaluate(e => {
                    const rect = e.getBoundingClientRect();
                    return rect.left >= 0 && rect.right <= innerWidth && e.scrollWidth <= e.clientWidth + 1;
                }), true, `${selector} fits the viewport at ${width}`);
            }
        }
        await h.shot(`observed-zero-${width}`);
    }
}));

test('Office HUD reports returned mappings, retained refusal and hung-receipt staleness, then recovers without new RAF owners', { timeout: 90000 }, async () => harness('office-truth', async (p, h) => {
    await p.waitForFunction(() => document.querySelector('.office-info')?.textContent?.includes('Fixture task'));
    assert.match(await officeHud(p), /ROLES 10 · MAPPED 1/);
    assert.match(await p.locator('.office-info').innerText(), /Mapped workflow roles \(1\)/i);
    assert.equal(await p.evaluate(() => (window as any).rafFixture.pending.size), 1);
    h.fail.add(officePath); await nextOffice(p);
    assert.match(await p.locator('.office-info').innerText(), /Mapped workflow roles \(stale: 1\)/i);
    assert.match(await p.locator('.office-info').innerText(), /Fixture task/);
    assert.match(await officeHud(p), /ROLES 10 · MAPPED 1 · STALE/);
    assert.match(await p.locator('.pixel-office__error').innerText(), /FETCH_FAILED/);
    h.fail.clear();
    for (const agents of [{}, [null], [{ id: 'koda', status: 'busy', activity: 'Bad' }], [{ id: 'koda', status: 'working', activity: null }], [{ id: 'koda', status: 'working', activity: 'Duplicate' }, { id: 'koda', status: 'idle', activity: '' }]]) {
        h.setResponse(officePath, { agents }); await nextOffice(p);
        assert.match(await p.locator('.pixel-office__error').innerText(), /FETCH_FAILED/);
        assert.match(await p.locator('.office-info').innerText(), /Fixture task/);
        assert.doesNotMatch(await p.locator('.office-info').innerText(), /Bad|Duplicate/);
        assert.match(await officeHud(p), /ROLES 10 · MAPPED 1 · STALE/);
    }
    h.setResponse(officePath, responses[officePath]); await nextOffice(p);
    assert.equal(await p.locator('.pixel-office__error').count(), 0);
    assert.doesNotMatch(await officeHud(p), /STALE|UNAVAILABLE/);
    h.hold(officePath); const before = h.count(officePath);
    await nextOffice(p); await p.clock.runFor(11000); await p.waitForTimeout(100);
    assert.equal(h.count(officePath), before + 1, 'a hanging receipt cannot create overlapping status requests');
    assert.equal(h.outstanding(officePath), 1);
    assert.match(await p.locator('.pixel-office').innerText(), /Office: Stale/);
    assert.match(await p.locator('.office-info').innerText(), /Mapped workflow roles \(stale: 1\)/i);
    assert.match(await officeHud(p), /ROLES 10 · MAPPED 1 · STALE/);
    await h.shot('hung-stale');
    h.setResponse(officePath, zeroOffice); h.release(officePath);
    await p.waitForFunction(() => document.querySelector('.office-info')?.textContent?.includes('roles (0)'));
    assert.doesNotMatch(await p.locator('.office-info').innerText(), /Fixture task/);
    assert.equal(await p.locator('.pixel-office__error').count(), 0);
    assert.match(await officeHud(p), /ROLES 10 · MAPPED 0/);
    assert.doesNotMatch(await officeHud(p), /STALE|UNAVAILABLE/);
    // The older script fixture's unknown IDs and omitted timestamp are compatible,
    // but cannot inflate this scene's ten-role mapping counts.
    h.setResponse(officePath, { agents: Array.from({ length: 14 }, (_, i) => ({ id: `fixture-${i}`, status: 'working', activity: 'Outside scene' })) });
    await nextOffice(p);
    assert.equal(await p.locator('.pixel-office__error').count(), 0);
    assert.match(await p.locator('.office-info').innerText(), /Mapped workflow roles \(0\)/i);
    assert.doesNotMatch(await p.locator('.office-info').innerText(), /Outside scene/);
    h.setResponse(officePath, responses[officePath]); await nextOffice(p);
    assert.match(await p.locator('.office-info').innerText(), /Mapped workflow roles \(1\)/i);
    assert.doesNotMatch(await officeHud(p), /STALE|UNAVAILABLE/);
    assert.equal(await p.evaluate(() => (window as any).rafFixture.pending.size), 1);
    const message = 'Final koda chat fixture retained';
    h.ws().send(JSON.stringify({ event: 'chat', payload: { state: 'final', sessionKey: 'agent:koda:fixture', message: { role: 'assistant', content: [{ text: message }] } } }));
    await p.waitForFunction(() => document.querySelector('.office-info')?.textContent?.includes('Final koda chat fixture retained'));
    await officeHud(p);
    const bubble = await p.evaluate(message => Array.from((window as any).officeDrawBounds.values()).find((b: any) => b.text === message) as { left: number; right: number; y: number } | undefined, message);
    assert.ok(bubble, 'actual final chat text must be drawn by retained engine');
    const canvas = p.locator('.pixel-office__canvas');
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox(); assert.ok(box);
    await p.mouse.click(box.x + ((bubble.left + bubble.right) / 2) / 1100 * box.width, box.y + (bubble.y - 3) / 720 * box.height);
    assert.match(await p.getByRole('dialog').innerText(), /Final koda chat fixture retained/);
    await p.locator('.pixel-office__chat-overlay-close').click();
    assert.equal(await p.getByRole('dialog').count(), 0);
    assert.match(await p.locator('.office-info').innerText(), /Final koda chat fixture retained/);
    await h.shot('mapped-chat-retained');
}));
