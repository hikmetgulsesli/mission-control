import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer, type ViteDevServer } from 'vite';
import type { SystemMetrics } from '../src/lib/types.js';
import react from '@vitejs/plugin-react';
import { createServer as createNetServer } from 'node:net';
import { chromium, type Page, type Locator } from 'playwright';
import { readFileSync, readdirSync, realpathSync, lstatSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Socket } from 'node:net';
import { AGENTS_ARRAY as AGENTS } from '../server/shared/agents.js';
import { createResponsiveToolsOwnedProfileV1, type OwnedProfile } from './fixtures/responsive-tools-owned.js';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, isAbsolute, normalize, relative, sep } from 'node:path';
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
type ResponsiveOptions = { owned: OwnedProfile; responses: Record<string, unknown>; icon: { pathname: '/fixture-responsive-icon.svg'; body: string } };
async function harness(name: string, body: (p: Page, h: any) => Promise<void>, responsive?: ResponsiveOptions) {
    if (!responsive) await mkdir(capture, { recursive: true });
    const cache = realpathSync(await mkdtemp(join(tmpdir(), 'mc-data-sync-vite-')));
    const cacheIdentity = lstatSync(cache);
    const probe = createNetServer();
    await new Promise<void>((resolve, reject) => { probe.once('error', reject); probe.listen({ host: '127.0.0.1', port: 0 }, () => resolve()); });
    const port = (probe.address() as any).port;
    await new Promise<void>(resolve => probe.close(() => resolve()));
    let browser: any, context: any, page: Page | undefined;
    const requests: string[] = [];
    const denied: string[] = [];
    const errors: string[] = [];
    const fail = new Set<string>(name === 'office-initial-failure' ? ['/api/office/status'] : []);
    const payloads = { ...responses, ...responsive?.responses };
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
    let http: ViteDevServer['httpServer'] = null;
    let httpWasListening = false;
    let listenAttempted = false;
    let setupReady = false;
    let profileUnknown = false;
    const fixtureSockets = new Set<Socket>();
    let httpClosed = false;
    let listener: unknown = null;
    const { schema: _bindingSchema, ...binding } = responsive ? JSON.parse(readFileSync(join(responsive.owned.store.root, 'owner.json'), 'utf8')) : {};
    if (responsive) assert.equal(_bindingSchema, 'mission-control.responsive-tools-source-binding.v1');
    const server = await createServer({ configFile: false, envFile: false, root: process.cwd(), cacheDir: cache, plugins: [react()], server: { host: '127.0.0.1', port, strictPort: true, hmr: false, proxy: {} }, logLevel: 'error' });
    // Successful acquisition establishes cleanup before middleware, HTTP checks or listen.
    try {
        http = server.httpServer;
        if (responsive) {
            assert.ok(http, 'retain original Vite HTTP server before listen');
            http.on('connection', socket => { fixtureSockets.add(socket); socket.once('close', () => fixtureSockets.delete(socket)); });
            http.once('listening', () => { httpWasListening = true; });
            http.once('close', () => { httpClosed = true; });
        }
        // No application server is mounted; even an interception mistake is denied locally.
        server.middlewares.use((req, res, next) => { if (req.url?.startsWith('/api/') || req.url?.startsWith('/ws')) {
            res.statusCode = 403;
            res.end('TEST_NETWORK_DENIED');
        }
        else
            next(); });
        listenAttempted = true;
        await server.listen();
        const address = server.httpServer!.address() as any;
        assert.equal(address.address, '127.0.0.1');
        assert.ok(![3080, 3333, 18789, 13081, 13082].includes(address.port));
        origin = `http://127.0.0.1:${address.port}`;
        listener = { host: address.address, port: address.port, family: address.family };
        if (responsive) responsive.owned.store.json({ schema: 'mission-control.responsive-tools-server-listener.v1', ...binding, origin, listener, cacheRoot: cache, optimizedDepsRoot: join(cache, 'deps') });
        browser = responsive ? await responsive.owned.launch() : await chromium.launch({ headless: true });
        assert.ok(browser, 'native lifecycle refused launch; setup UNKNOWN, never causal RED');
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
            if (responsive && route.request().method() !== 'GET') {
                denied.push(path + ':' + route.request().method());
                return route.abort();
            }
            if (responsive && path === responsive.icon.pathname)
                return route.fulfill({ contentType: 'image/svg+xml', body: responsive.icon.body });
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
            if (responsive && /^\/(?:src|server|tests)\//.test(url.pathname)) {
                const sourcePath = decodeURIComponent(url.pathname.slice(1));
                if (!responsiveSourcePaths.includes(sourcePath)) { denied.push(path); return route.abort(); }
            }
            if (responsive && url.pathname.startsWith('/@fs/')) {
                const physical = decodeURIComponent(url.pathname.slice('/@fs/'.length));
                const within = (root: string) => {
                    try {
                        if (!isAbsolute(physical) || normalize(physical) !== physical || physical.includes('\0')) return false;
                        const child = relative(root, physical);
                        if (!child || child === '..' || child.startsWith('..' + sep) || isAbsolute(child)) return false;
                        if (root === join(cache, 'deps')) {
                            const now = lstatSync(cache);
                            if (realpathSync(cache) !== cache || now.isSymbolicLink() || !now.isDirectory()
                                || now.dev !== cacheIdentity.dev || now.ino !== cacheIdentity.ino
                                || now.uid !== process.getuid!() || (now.mode & 0o777) !== 0o700) return false;
                        }
                        // realpath equality rejects symlinks in every component, including deps.
                        if (realpathSync(root) !== root || realpathSync(physical) !== physical) return false;
                        const file = lstatSync(physical);
                        return file.isFile() && !file.isSymbolicLink() && file.uid === process.getuid!();
                    } catch { return false; }
                };
                if (!within(join(responsiveSourceRoot, 'node_modules'))) {
                    const depsRoot = join(cache, 'deps');
                    const child = relative(depsRoot, physical);
                    if (!isAbsolute(physical) || normalize(physical) !== physical || physical.includes('\0')
                        || !child || child === '..' || child.startsWith('..' + sep) || isAbsolute(child)) {
                        denied.push(path); return route.abort();
                    }
                    // The owned client optimizer registers final filenames before cold output is committed.
                    // Await only this exact registered dependency's real processing Promise, then apply
                    // the same canonical-file/cache-identity/symlink checks; never admit a missing file.
                    const info = server.environments.client.depsOptimizer?.metadata.depInfoList.find(dep => dep.file === physical);
                    if (!info) { denied.push(path); return route.abort(); }
                    let timer: ReturnType<typeof setTimeout> | undefined;
                    try {
                        await Promise.race([info.processing ?? Promise.resolve(), new Promise((_, reject) => {
                            timer = setTimeout(() => reject(new Error('RESPONSIVE_OPTIMIZER_PUBLICATION_UNKNOWN')), 10000);
                        })]);
                    } catch {
                        denied.push('OPTIMIZER_PUBLICATION_UNKNOWN:' + path); return route.abort();
                    } finally { clearTimeout(timer); }
                    if (!within(depsRoot)) { denied.push(path); return route.abort(); }
                }
            }
            if (url.pathname === '/tests/fixtures/data-sync-browser.html' || url.pathname === '/server/shared/agents.ts' || /^\/(src\/|tests\/fixtures\/|node_modules\/|@vite\/|@react-refresh|@fs\/)/.test(url.pathname))
                return route.continue();
            denied.push(path);
            return route.abort();
        });
        await context.routeWebSocket('**/*', (socket: any) => { const url = new URL(socket.url()); if (url.origin === origin.replace('http', 'ws') && url.pathname === '/' && url.searchParams.has('token')) {
            if (responsive) {
                activeSockets.add(socket);
                socket.onClose(() => { if (activeSockets.delete(socket)) wsClosed++; });
                socket.onMessage(() => { denied.push('WS_OUTBOUND:VITE'); socket.close(); });
            }
            socket.send(JSON.stringify({ type: 'connected' }));
            return;
        } if (socket.url() !== origin.replace('http', 'ws') + '/ws') {
            denied.push(socket.url());
            socket.close();
            return;
        } wsCount++; ws = socket; activeSockets.add(socket);
            if (responsive) socket.onMessage(() => { denied.push('WS_OUTBOUND:/ws'); socket.close(); });
            socket.onClose(() => { if (activeSockets.delete(socket)) wsClosed++; });
        });
        page = await context.newPage() as Page;
        page.on('pageerror', e => errors.push(String(e)));
        page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('status of 503'))
            errors.push(msg.text()); });
        await page.clock.install();
        await page.goto(origin + '/tests/fixtures/data-sync-browser.html' + (responsive ? '?profile=responsive-tools-v1' : name.startsWith('office-') ? '?initial=/office' : name === 'initial-hidden' ? '?hidden=1' : ''));
        await page.waitForFunction(() => !!(window as any).fixture);
        const h = { requests, fail, denied, errors, hold, release, outstanding: (path: string) => outstanding.get(path) || 0, setResponse: (path: string, value: unknown) => { assert.ok(path in payloads); payloads[path] = value; }, ws: () => ws, wsCount: () => wsCount, activeWs: () => activeSockets.size, wsClosed: () => wsClosed, count: (path: string) => requests.filter(p => p === path).length, nav: async (path: string) => { await page!.evaluate(p => (window as any).fixture.navigate(p), path); await page!.waitForTimeout(100); }, visibility: async (visible: boolean) => { await page!.evaluate(v => (window as any).fixture.visibility(v), visible); await page!.waitForTimeout(100); }, shot: async (suffix: string) => responsive ? responsive.owned.shot(page!, suffix) : page!.screenshot({ path: join(capture, name + '-' + suffix + '.png'), fullPage: true }), boundary: async () => responsive?.owned.boundary(), receipt: (value: unknown) => { assert.ok(responsive); return responsive.owned.store.json({ schema: 'mission-control.responsive-tools-observation.v1', ...binding, value }); } };
        setupReady = true;
        await body(page, h);
        assert.deepEqual(denied, [], 'no unknown/external requests permitted');
        assert.deepEqual(errors, [], 'no application console errors');
    } catch (error) {
        if (responsive && !(error instanceof assert.AssertionError)) profileUnknown = true;
        throw error;
    } finally {
        for (const path of held.keys()) release(path);
        if (responsive) {
            const cleanupErrors: unknown[] = [];
            let native: unknown = null;
            if (page) {
                try { await responsive.owned.shot(page, 'final'); } catch (error) { cleanupErrors.push(error); }
                try { await page.evaluate(() => (window as any).fixture?.unmount()); } catch (error) { cleanupErrors.push(error); }
            }
            // The maintained lifecycle owns all new contexts and native close. Never close CDP's default context.
            try { native = await responsive.owned.close(); } catch (error) { cleanupErrors.push(error); }
            // Always settle the fixture server independently, including after native refusal.
            let serverSettled = false;
            let viteCloseResolved = false;
            try {
                // An acquired but never-listening Vite server still owns watcher/WS resources.
                // Await Vite.close in both cases; require original HTTP close only after actual listening.
                const closed = !http || !httpWasListening || httpClosed ? Promise.resolve() : new Promise<void>(resolve => http!.once('close', resolve));
                let timer: ReturnType<typeof setTimeout> | undefined;
                try {
                    await Promise.race([Promise.all([server.close().then(() => { viteCloseResolved = true; }), closed]), new Promise((_, reject) => {
                        timer = setTimeout(() => reject(new Error('RESPONSIVE_SERVER_CLOSURE_UNKNOWN')), 10000);
                    })]);
                } finally { clearTimeout(timer); }
                assert.ok(http, 'original HTTP object retained; Vite.close already attempted independently');
                assert.equal(http.listening, false);
                assert.equal(http.address(), null, 'original fixture listener absent');
                if (httpWasListening) assert.equal(httpClosed, true);
                assert.equal(fixtureSockets.size, 0, 'all original fixture sockets closed');
                assert.equal(activeSockets.size, 0, 'all intercepted WS closed');
                serverSettled = true;
            } catch (error) { cleanupErrors.push(error); }
            const outcome = cleanupErrors.length || !setupReady || profileUnknown || denied.length || errors.length ? 'UNKNOWN' : 'settled';
            const cacheRemovable = outcome === 'settled';
            responsive.owned.store.json({ schema: 'mission-control.responsive-tools-server-outcome.v1', ...binding,
                origin, listener, outcome: serverSettled ? 'settled' : 'UNKNOWN', listenAttempted, httpWasListening,
                listenerDisposition: !http ? 'UNKNOWN' : !httpWasListening ? 'not_started' : serverSettled ? 'closed' : 'UNKNOWN',
                viteCloseResolved, httpClosed, listening: http?.listening ?? null,
                originalListenerAbsent: http?.address() === null, trackedSockets: fixtureSockets.size, interceptedWs: activeSockets.size });
            const ledgerHash = responsive.owned.store.json({ schema: 'mission-control.responsive-tools-network-ledger.v1', ...binding,
                origin, requests, denied, errors, wsCount, wsClosed });
            if (cacheRemovable) await rm(cache, { recursive: true, force: true });
            responsive.owned.store.json({ schema: 'mission-control.responsive-tools-final-outcome.v1', ...binding,
                outcome, native, ledgerHash, setupReady, profileUnknown, cacheRoot: cache, cacheRemoved: cacheRemovable, errors: cleanupErrors.map(error => String(error)) });
            assert.deepEqual(cleanupErrors, [], 'unknown custody/server cleanup cannot qualify RED or GREEN');
            if (outcome === 'UNKNOWN') throw new Error('RESPONSIVE_FINAL_QUALIFICATION_UNKNOWN');
        } else {
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

// Supplemental populated Source fixture. Canonical DATA/AGENTS/FIXED_GETS are unchanged.
const responsiveSourceRoot = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
let responsiveSourcePaths: string[] = [];
function responsiveReviewedPaths(): string[] {
    const tree = (directory: string): string[] => readdirSync(join(responsiveSourceRoot, directory), { withFileTypes: true }).flatMap(entry => {
        const path = `${directory}/${entry.name}`;
        assert.equal(entry.isSymbolicLink(), false, 'no symlinked Source entries');
        return entry.isDirectory() ? tree(path) : entry.isFile() ? [path] : assert.fail('unsupported Source entry');
    });
    return [...tree('src'), ...tree('server/shared'), 'tests/data-sync-browser.test.ts',
        'tests/fixtures/data-sync-browser.tsx', 'tests/fixtures/data-sync-browser.html', 'tests/fixtures/responsive-tools-owned.ts',
        'package.json', 'package-lock.json', 'scripts/ui-regression-lifecycle.mjs', 'server/services/control-ui-worker-protocol.ts'].sort();
}

// Range fragments expose ellipsis/overflow that matching CSS declarations cannot prove.
async function responsiveGeometry(locator: Locator) {
    return locator.evaluate(element => {
        const box = (r: DOMRect) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
        const style = getComputedStyle(element);
        const range = document.createRange(); range.selectNodeContents(element);
        const fragments = Array.from(range.getClientRects()).filter(r => r.width > 0 && r.height > 0).map(box);
        const clips: { tag: string; x: boolean; y: boolean; rect: ReturnType<typeof box>; scrollTop: number; scrollLeft: number }[] = [];
        for (let node: Element | null = element; node; node = node.parentElement) {
            const s = getComputedStyle(node), rect = node.getBoundingClientRect();
            const x = /hidden|clip|auto|scroll/.test(s.overflowX), y = /hidden|clip|auto|scroll/.test(s.overflowY);
            if (x || y) clips.push({ tag: `${node.tagName}.${node.className}`, x, y,
                rect: { left: rect.left + node.clientLeft, top: rect.top + node.clientTop,
                    right: rect.left + node.clientLeft + node.clientWidth, bottom: rect.top + node.clientTop + node.clientHeight,
                    width: node.clientWidth, height: node.clientHeight }, scrollTop: node.scrollTop, scrollLeft: node.scrollLeft });
        }
        const rect = box(element.getBoundingClientRect());
        const card = element.closest('.scrape-inspiration__card');
        const cardRect = card ? box(card.getBoundingClientRect()) : null;
        const inBox = (r: typeof rect, b: typeof rect) => r.left >= b.left - 1 && r.right <= b.right + 1 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1;
        return { text: element.textContent || '', rect, fragments, cardRect, clips,
            font: { size: parseFloat(style.fontSize), family: style.fontFamily, lineHeight: style.lineHeight, weight: style.fontWeight },
            scroll: { width: element.scrollWidth, clientWidth: element.clientWidth, height: element.scrollHeight, clientHeight: element.clientHeight, top: element.scrollTop, left: element.scrollLeft },
            visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
            insideCard: !cardRect || fragments.every(r => inBox(r, cardRect)),
            unclipped: fragments.every(r => clips.every(c => (!c.x || r.left >= c.rect.left - 1 && r.right <= c.rect.right + 1) && (!c.y || r.top >= c.rect.top - 1 && r.bottom <= c.rect.bottom + 1))),
            viewport: { width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth },
        };
    });
}

// Catches hidden History controls, clipped populated app/identity text, missing
// native keyboard semantics, ancestor scroll coupling and a collapsed message area.
test('responsive tools readability', { timeout: 240000 }, async () => {
    const at = '2026-10-20T00:00:00.000Z';
    const targets = AGENTS.map((agent, i) => ({
        id: agent.id,
        identityName: i === 0 ? 'Responsive main' : i === 13 ? 'LongResponsiveTargetIdentityWithoutSpaces0123456789' : `Responsive target ${i}`,
        identityEmoji: '🤖', model: 'fixture-local', workspace: '/fixture', bindings: 0, isDefault: i === 0,
    }));
    assert.equal(targets.length, 14);
    assert.equal(targets[0].id, 'main');
    const apps = Array.from({ length: 25 }, (_, i) => ({
        name: i === 0 ? 'Everyday notes and personal project planning' : i === 24 ? 'UnbrokenApplicationName0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ' : `Representative application ${i + 1}`,
        developer: i === 0 ? 'Example collaborative software development studio' : i === 24 ? 'UnbrokenDeveloperName0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ' : `Representative developer ${i + 1}`,
        icon: '/fixture-responsive-icon.svg', rating: 4.5, category: 'Productivity and personal planning',
        url: `https://example.invalid/application/${i + 1}`, description: `Fixed description ${i + 1}`,
    }));
    const history = (id: string) => Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 ? 'assistant' : 'user', text: `Saved ${id} message ${i + 1}: fixed readable history content.`,
        timestamp: Date.parse(at) + i * 1000, sessionId: `responsive-session-${id}`,
    }));
    const profileResponses = {
        '/api/agents': targets, '/api/scrape/trending?platform=ios&limit=25': apps, '/api/scrape/history': [],
        ...Object.fromEntries(targets.flatMap(t => [
            [`/api/agents/${t.id}/history?limit=1`, { messages: history(t.id).slice(-1) }],
            [`/api/agents/${t.id}/history?limit=40`, { messages: history(t.id) }],
        ])),
    };
    const icon = { pathname: '/fixture-responsive-icon.svg' as const,
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#70d3df"/></svg>' };
    const quotaWarning = { snapshot: { available: false, fetchedAt: at, error: { code: 'NO_TOKEN', detail: 'Fixed local warning fixture' } },
        severity: 'unknown', reason: 'Kimi quota is unavailable. No local authentication token is configured; provider availability has not been verified.' };
    const profileData = { responses: { ...responses, ...profileResponses, '/api/kimi-quota': quotaWarning }, icon,
        viewports: [[390, 900], [768, 900], [1440, 900], [1900, 900], [390, 844]] };
    responsiveSourcePaths = responsiveReviewedPaths();
    const owned = await createResponsiveToolsOwnedProfileV1({ sourceRoot: realpathSync(responsiveSourceRoot), sourcePaths: responsiveSourcePaths, profileData });
    try {
        await harness('responsive-tools', async (p, h) => {
            p.setDefaultTimeout(2000);
            await p.clock.setFixedTime(new Date(at));
            const checks: { name: string; status: 'pass' | 'fail' | 'unrun'; error?: string; evidenceHash?: string }[] = [];
            const captures: { label: string; pngHash: string }[] = [];
            const setupFailures: { viewport: number[]; error: string }[] = [];
            const check = async (name: string, body: () => Promise<unknown>) => {
                try { const value = await body(); checks.push({ name, status: 'pass', evidenceHash: h.receipt({ name, value: value ?? null }) }); return true; }
                catch (error) {
                    if (!(error instanceof assert.AssertionError)) throw error;
                    checks.push({ name, status: 'fail', error: String(error), evidenceHash: h.receipt({ name, error: String(error) }) }); return false;
                }
            };
            const unrun = (name: string, reason: string) => checks.push({ name, status: 'unrun', error: reason });
            const shot = async (label: string) => { captures.push({ label, pngHash: await h.shot(label) }); };
            const text = async (name: string, locator: Locator, expected?: string, minFont = 14) => check(name, async () => {
                // Hidden controls are measured without an interaction timeout.
                if (await locator.isVisible()) await locator.scrollIntoViewIfNeeded();
                const geometry = await responsiveGeometry(locator);
                const evidenceHash = h.receipt({ name, geometry });
                assert.equal(geometry.visible, true, `${name}: visible; geometry ${evidenceHash}`);
                if (expected !== undefined) assert.equal(geometry.text, expected, `${name}: exact text`);
                assert.ok(geometry.font.size >= minFont, `${name}: readable ${minFont}px minimum; geometry ${evidenceHash}`);
                assert.ok(geometry.scroll.width <= geometry.scroll.clientWidth + 1, `${name}: no horizontal text escape; geometry ${evidenceHash}`);
                assert.ok(geometry.insideCard && geometry.unclipped && geometry.fragments.length > 0, `${name}: all Range fragments inside card/ancestor clips; geometry ${evidenceHash}`);
                return { evidenceHash };
            });
            const visibleHeight = (g: Awaited<ReturnType<typeof responsiveGeometry>>) => Math.max(0,
                Math.min(g.rect.bottom, g.viewport.height, ...g.clips.filter(c => c.y).map(c => c.rect.bottom))
                - Math.max(g.rect.top, 0, ...g.clips.filter(c => c.y).map(c => c.rect.top)));
            const rootGuard = (prefix: string) => check(`${prefix}-root-width`, async () => {
                const geometry = await p.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth }));
                h.receipt({ prefix, geometry });
                assert.ok(geometry.scrollWidth <= geometry.innerWidth + 1);
                return geometry;
            });
            const ancestorScroll = () => p.locator('.chat-page__layout').evaluate(element => {
                const values = [];
                for (let node: Element | null = element; node; node = node.parentElement)
                    values.push({ tag: `${node.tagName}.${node.className}`, top: node.scrollTop, left: node.scrollLeft });
                return values;
            });
            const panelReady = async (id: string, name: string) => {
                await p.waitForFunction(({ id, name }) => {
                    // Marked appends CR/LF at paragraph boundaries; preserve all interior text/spacing.
                    const bubbles = Array.from(document.querySelectorAll('.chat-msg__bubble')).map(e => (e.textContent || '').replace(/^[\r\n]+|[\r\n]+$/g, ''));
                    return document.querySelector('.chat-panel__agent-name')?.textContent === name
                        && document.querySelectorAll('.chat-msg').length === 30
                        && bubbles.includes(`Saved ${id} message 30: fixed readable history content.`)
                        && bubbles.includes(`Saved ${id} message 29: fixed readable history content.`);
                }, { id, name });
                await check(`panel-identity-${id}-${p.viewportSize()!.width}-${p.viewportSize()!.height}`, async () => {
                    assert.equal(await p.locator('.chat-panel__agent-name').innerText(), name);
                    const bubbles = (await p.locator('.chat-msg__bubble').allTextContents()).map(text => text.replace(/^[\r\n]+|[\r\n]+$/g, ''));
                    assert.ok(bubbles.includes(`Saved ${id} message 30: fixed readable history content.`));
                    assert.ok(bubbles.includes(`Saved ${id} message 29: fixed readable history content.`));
                    assert.equal(await p.locator('.chat-msg--user').count(), 15);
                    assert.equal(await p.locator('.chat-msg--assistant').count(), 15);
                });
            };
            const last = targets[13];
            for (const [width, height] of profileData.viewports) {
                const prefix = `${width}-${height}`;
                try {
                    await p.setViewportSize({ width, height });
                    await h.boundary();
                    if (height === 900) {
                        await h.nav('/scrape');
                        await p.waitForFunction(() => document.querySelectorAll('.scrape-inspiration__card').length === 25);
                        await check(`scrape-${prefix}-25-names-developers-actions`, async () => {
                            assert.deepEqual(await p.locator('.scrape-inspiration__name').allTextContents(), apps.map(app => app.name));
                            assert.deepEqual(await p.locator('.scrape-inspiration__developer').allTextContents(), apps.map(app => app.developer));
                            assert.deepEqual(await p.locator('.scrape-inspiration__clone-btn').allTextContents(), Array(25).fill('Clone This'));
                        });
                        await check(`scrape-${prefix}-grid-300`, async () => {
                            const g = await responsiveGeometry(p.locator('.scrape-inspiration__grid')); h.receipt({ prefix, grid: g });
                            assert.ok(g.rect.height > 0 && g.rect.height <= 301);
                            assert.ok(g.scroll.height > g.scroll.clientHeight + 1, 'populated grid really scrolls');
                            return g;
                        });
                        await shot(`scrape-${prefix}-top`);
                        for (let i = 0; i < 25; i++) {
                            const card = p.locator('.scrape-inspiration__card').nth(i);
                            await text(`scrape-${prefix}-${i}-name`, card.locator('.scrape-inspiration__name'), apps[i].name);
                            await text(`scrape-${prefix}-${i}-developer`, card.locator('.scrape-inspiration__developer'), apps[i].developer);
                            await text(`scrape-${prefix}-${i}-category`, card.locator('.scrape-inspiration__category'), apps[i].category);
                            await text(`scrape-${prefix}-${i}-action`, card.locator('.scrape-inspiration__clone-btn'), 'Clone This');
                            await check(`scrape-${prefix}-${i}-action-focus`, async () => {
                                const action = card.locator('.scrape-inspiration__clone-btn');
                                await action.focus(); assert.equal(await action.evaluate(e => e === document.activeElement), true);
                            });
                            await check(`scrape-${prefix}-${i}-icon`, async () => {
                                const icon = card.locator('img'); await icon.scrollIntoViewIfNeeded();
                                const g = await responsiveGeometry(icon); h.receipt({ prefix, index: i, icon: g });
                                assert.ok(Math.abs(g.rect.width - 48) <= 1 && Math.abs(g.rect.height - 48) <= 1);
                                assert.equal(await icon.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth === 48), true);
                            });
                        }
                        await shot(`scrape-${prefix}-bottom`);
                        await check(`scrape-${prefix}-scroll-last-first`, async () => {
                            const grid = p.locator('.scrape-inspiration__grid');
                            const bottom = await grid.evaluate(e => e.scrollTop);
                            await p.locator('.scrape-inspiration__clone-btn').first().scrollIntoViewIfNeeded();
                            const top = await grid.evaluate(e => e.scrollTop);
                            assert.ok(bottom > top + 1, 'all 25 controls traversed then returned to first');
                            return { bottom, top };
                        });
                        await rootGuard(`scrape-${prefix}`);
                        await check(`scrape-${prefix}-control-availability`, async () => {
                            assert.equal(await p.getByRole('button', { name: 'Scrape', exact: true }).count(), 1);
                            const input = p.getByRole('textbox', { name: 'URL to scrape' });
                            await input.fill('https://example.invalid/fixed-unscraped');
                            const action = p.getByRole('button', { name: 'Scrape', exact: true });
                            assert.equal(await action.isEnabled(), true); await action.focus();
                            assert.equal(await action.evaluate(e => e === document.activeElement), true);
                            await input.fill('');
                        });
                    }
                    if (width === 1900) { await h.boundary(); continue; }
                    await h.nav('/chat');
                    await p.waitForFunction(() => document.querySelectorAll('.chat-sidebar__agent').length === 14);
                    await panelReady('main', targets[0].identityName);
                    await shot(`chat-${prefix}-agents-top`);
                    for (const [label, selector] of [
                        ['title', '.chat-page h2'], ['notice', '.chat-page__notice'], ['socket-status', '.chat-panel__status'],
                        ['connection-note', '.chat-panel__connection-note'], ['agents-tab', '.chat-sidebar__tab:first-child'],
                        ['history-tab', '.chat-sidebar__tab:last-child'], ['main-selector', '.chat-sidebar__new-chat'],
                        ['panel-name', '.chat-panel__agent-name'],
                    ]) await text(`chat-${prefix}-${label}`, p.locator(selector));
                    await check(`chat-${prefix}-progress-and-composer`, async () => {
                        const progress = p.getByRole('button', { name: /Show Progress/ });
                        assert.equal(await progress.isVisible(), true); await progress.focus();
                        assert.equal(await progress.evaluate(e => e === document.activeElement), true);
                        const composer = await responsiveGeometry(p.locator('.chat-panel__input'));
                        const panel = await responsiveGeometry(p.locator('.chat-panel')); h.receipt({ prefix, composer, panel });
                        assert.ok(panel.rect.top >= -1 && panel.rect.bottom <= height + 1 && panel.rect.left >= -1 && panel.rect.right <= width + 1);
                        assert.ok(composer.visible && composer.rect.top >= -1 && composer.rect.bottom <= height + 1);
                        assert.equal(await p.locator('.chat-panel__input input').isVisible(), true);
                        assert.equal(await p.getByRole('button', { name: 'SEND', exact: true }).isVisible(), true);
                        const input = p.locator('.chat-panel__input input');
                        await input.fill('Fixed unsent local text');
                        const send = p.getByRole('button', { name: 'SEND', exact: true });
                        assert.equal(await send.isEnabled(), true); await send.focus();
                        assert.equal(await send.evaluate(e => e === document.activeElement), true);
                        await input.fill('');
                        return composer;
                    });
                    const beforeAgents = await ancestorScroll();
                    for (const target of targets) {
                        const row = p.locator('.chat-sidebar__agent').filter({ has: p.locator('span').filter({ hasText: new RegExp(`^${target.identityName}$`) }) });
                        await text(`chat-${prefix}-${target.id}-identity`, row.locator('span').nth(1), target.identityName);
                        await text(`chat-${prefix}-${target.id}-role`, row.locator('.chat-sidebar__role'), `Catalog role: ${AGENTS.find(a => a.id === target.id)!.role}`);
                    }
                    await check(`chat-${prefix}-agent-scroll-independent`, async () => assert.deepEqual(await ancestorScroll(), beforeAgents));
                    await shot(`chat-${prefix}-agents-bottom`);
                    await check(`chat-${prefix}-select-last-and-main`, async () => {
                        await p.getByRole('button', { name: new RegExp(last.identityName) }).click();
                        await panelReady(last.id, last.identityName);
                        await text(`chat-${prefix}-long-panel-name`, p.locator('.chat-panel__agent-name'), last.identityName);
                        await shot(`chat-${prefix}-selected-long`);
                        await p.getByRole('button', { name: 'Select main target', exact: true }).click();
                        await panelReady('main', targets[0].identityName);
                    });
                    await check(`chat-${prefix}-long-panel-scroll`, async () => {
                        const messages = p.locator('.chat-panel__messages');
                        const g = await responsiveGeometry(messages); h.receipt({ prefix, messages: g });
                        assert.ok(visibleHeight(g) >= 48, 'fixed minimum 48px visible message area');
                        assert.ok(g.scroll.height > g.scroll.clientHeight + 1);
                        const ancestor = await ancestorScroll();
                        const sidebar = await p.locator('.chat-sidebar').evaluate(e => ({ top: e.scrollTop, left: e.scrollLeft }));
                        await messages.evaluate(e => { e.scrollTop = e.scrollHeight; });
                        assert.ok(await messages.evaluate(e => e.scrollTop > 0));
                        assert.deepEqual(await ancestorScroll(), ancestor);
                        assert.deepEqual(await p.locator('.chat-sidebar').evaluate(e => ({ top: e.scrollTop, left: e.scrollLeft })), sidebar);
                        const composer = await responsiveGeometry(p.locator('.chat-panel__input'));
                        assert.ok(composer.rect.bottom <= height + 1 && composer.rect.top >= -1);
                        return { messages: g, composer, ancestor, sidebar };
                    });
                    await shot(`chat-${prefix}-messages-bottom`);
                    const historyTab = p.getByRole('button', { name: 'HISTORY', exact: true });
                    const canUseHistory = await check(`history-${prefix}-available`, async () => {
                        assert.equal(await historyTab.isVisible(), true);
                        const g = await responsiveGeometry(historyTab); h.receipt({ prefix, historyTab: g });
                        assert.ok(g.visible && g.unclipped && g.fragments.length > 0);
                    });
                    if (canUseHistory) {
                        // Visibility is an intended presentation assertion; click/readiness faults are UNKNOWN.
                        await historyTab.click();
                        await p.waitForFunction(() => document.querySelectorAll('.chat-sidebar__session').length === 14 && !document.querySelector('.chat-sidebar__loading'));
                        await shot(`history-${prefix}-top`);
                        await text(`history-${prefix}-note`, p.locator('.chat-sidebar__sessions > .chat-sidebar__notice'), 'Saved local history for listed targets.');
                        const ancestor = await ancestorScroll();
                        for (let i = 0; i < 14; i++) {
                            const row = p.locator('.chat-sidebar__session').nth(i);
                            await text(`history-${prefix}-${targets[i].id}-title`, row.locator('.chat-sidebar__session-title'), targets[i].identityName);
                            await text(`history-${prefix}-${targets[i].id}-time`, row.locator('.chat-sidebar__session-meta'), 'in less than a minute');
                            await text(`history-${prefix}-${targets[i].id}-preview`, row.locator('.chat-sidebar__session-preview'), history(targets[i].id)[29].text);
                        }
                        await check(`history-${prefix}-independent-scroll`, async () => assert.deepEqual(await ancestorScroll(), ancestor));
                        await shot(`history-${prefix}-bottom`);
                        for (const key of ['Enter', 'Space']) {
                            await check(`history-${prefix}-${key.toLowerCase()}-activation-focus`, async () => {
                                const row = p.locator('.chat-sidebar__session').last();
                                await row.scrollIntoViewIfNeeded();
                                await historyTab.focus();
                                // Main selector then fourteen native History controls, using actual keyboard traversal.
                                for (let i = 0; i < 15; i++) await p.keyboard.press('Tab');
                                const focus = await row.evaluate(e => {
                                    const s = getComputedStyle(e);
                                    return { focused: e === document.activeElement, visible: e.matches(':focus-visible'), outline: s.outlineStyle, width: parseFloat(s.outlineWidth), color: s.outlineColor };
                                });
                                h.receipt({ prefix, key, focus });
                                assert.ok(focus.focused && focus.visible && focus.outline !== 'none' && focus.width >= 1 && focus.color !== 'rgba(0, 0, 0, 0)');
                                await shot(`history-${prefix}-${key.toLowerCase()}-focus`);
                                await p.keyboard.press(key);
                                await p.waitForFunction(() => document.querySelectorAll('.chat-sidebar__agent').length === 14);
                                await panelReady(last.id, last.identityName);
                                await shot(`history-${prefix}-${key.toLowerCase()}-selected`);
                            });
                            // Pointer selection is independently checked even when native keyboard semantics fail.
                            if (await p.locator('.chat-sidebar__session').count()) {
                                await p.locator('.chat-sidebar__session').last().click();
                                await panelReady(last.id, last.identityName);
                            }
                            await p.getByRole('button', { name: 'Select main target', exact: true }).click();
                            await panelReady('main', targets[0].identityName);
                            await historyTab.click();
                            await p.waitForFunction(() => document.querySelectorAll('.chat-sidebar__session').length === 14 && !document.querySelector('.chat-sidebar__loading'));
                        }
                        await check(`history-${prefix}-main-row-selection`, async () => {
                            await p.locator('.chat-sidebar__session').first().click();
                            await panelReady('main', targets[0].identityName);
                            assert.equal(await p.locator('.chat-sidebar__agent').count(), 14);
                        });
                        const path = `/api/agents/${last.id}/history?limit=1`;
                        h.hold(path);
                        await historyTab.click();
                        await p.waitForFunction(() => document.querySelector('.chat-sidebar__loading')?.textContent === 'Loading history...');
                        await text(`history-${prefix}-loading`, p.locator('.chat-sidebar__loading'), 'Loading history...');
                        await text(`history-${prefix}-loading-tabs`, historyTab, 'HISTORY');
                        await shot(`history-${prefix}-loading`);
                        h.release(path);
                        await p.waitForFunction(() => document.querySelectorAll('.chat-sidebar__session').length === 14 && !document.querySelector('.chat-sidebar__loading'));
                        await p.getByRole('button', { name: 'AGENTS', exact: true }).click();
                        h.fail.add(path);
                        await historyTab.click();
                        await p.waitForFunction(() => document.querySelectorAll('.chat-sidebar__session').length === 13 && !document.querySelector('.chat-sidebar__loading'));
                        await text(`history-${prefix}-unavailable`, p.locator('.chat-sidebar__notice').filter({ hasText: /^Saved history unavailable/ }), 'Saved history unavailable for 1 of 14 targets.');
                        await text(`history-${prefix}-unavailable-tabs`, historyTab, 'HISTORY');
                        await shot(`history-${prefix}-unavailable`);
                        h.fail.delete(path);
                        await p.getByRole('button', { name: 'AGENTS', exact: true }).click();
                    } else {
                        for (const phase of ['previews', 'scroll', 'selection', 'enter', 'space', 'loading', 'unavailable'])
                            unrun(`history-${prefix}-${phase}`, 'History unavailable; dependent interaction not executed');
                        await shot(`history-${prefix}-unavailable-control`);
                    }
                    if (height === 844) {
                        await check(`warning-${prefix}-actual-banner-and-budget`, async () => {
                            const banner = p.getByRole('button').filter({ hasText: quotaWarning.reason });
                            const g = await responsiveGeometry(banner); h.receipt({ prefix, warning: g });
                            assert.ok(g.visible && g.rect.height > 0);
                            const geometry = await Promise.all(['.chat-page__notice', '.chat-sidebar', '.chat-panel__header', '.chat-panel__messages', '.chat-panel__input'].map(selector => responsiveGeometry(p.locator(selector))));
                            h.receipt({ prefix, banner: g, geometry });
                            assert.ok(geometry.every(item => item.visible));
                            assert.ok(visibleHeight(geometry[3]) >= 48);
                            return { banner: g, geometry };
                        });
                        await shot(`warning-${prefix}-budget`);
                    }
                    await rootGuard(`chat-${prefix}`);
                    await h.boundary();
                } catch (error) {
                    setupFailures.push({ viewport: [width, height], error: String(error) });
                    h.receipt({ phase: 'setup-or-interaction-UNKNOWN', viewport: [width, height], error: String(error) });
                    // Keep independent widths observable, while refusing a causal RED classification.
                    for (const path of targets.map(t => `/api/agents/${t.id}/history?limit=1`)) h.release(path);
                    h.fail.clear();
                    await shot(`unknown-${prefix}`);
                    await h.boundary();
                }
            }
            const candidateOutcome = setupFailures.length || h.denied.length || h.errors.length ? 'UNKNOWN'
                : checks.every(check => check.status === 'pass') ? 'pass' : 'fail';
            const candidateHash = h.receipt({ profile: 'responsive-tools-v1', checks, captures, setupFailures,
                networkDenied: h.denied, applicationErrors: h.errors, outcome: candidateOutcome });
            console.log(JSON.stringify({ code: 'RESPONSIVE_TOOLS_VISUAL_CANDIDATE', candidateHash,
                outcome: candidateOutcome, setupFailures, networkDenied: h.denied, applicationErrors: h.errors, failed: checks.filter(check => check.status === 'fail').map(check => check.name), unrun: checks.filter(check => check.status === 'unrun').map(check => check.name), captures }));
            if (candidateOutcome === 'UNKNOWN') throw new Error(`RESPONSIVE_FIXTURE_QUALIFICATION_UNKNOWN: ${candidateHash}`);
            assert.deepEqual(setupFailures, [], 'setup/interaction errors are UNKNOWN, never causal RED');
            assert.deepEqual(h.denied, [], 'supplemental profile has no unknown/external/outbound operations');
            assert.deepEqual(h.errors, [], 'supplemental profile has no unexpected application errors');
            assert.deepEqual(checks.filter(check => check.status !== 'pass').map(check => `${check.status}: ${check.name}`), [], `visual candidate ${candidateHash}`);
        }, { owned, responses: profileData.responses, icon });
    } finally {
        // Covers pre-listen/import/setup refusal too. The adapter memoizes its single close.
        await owned.close();
    }
});
