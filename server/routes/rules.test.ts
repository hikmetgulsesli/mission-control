import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import { createServer, type Server, type RequestListener } from 'node:http';
import { test } from 'node:test';
import express from 'express';
import ts from 'typescript';

// Execute the actual router with data ports only. Importing config/PG/runtime
// would read private env/gateway files or initialize runtime/database authority.
function route(url: string, selected: boolean | (() => boolean) = false, timeoutMs = 200) {
  const source = readFileSync(new URL('./rules.ts', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('rules.ts', source, ts.ScriptTarget.Latest, true);
  const body = tree.statements.filter(node => !ts.isImportDeclaration(node) && !ts.isExportAssignment(node))
    .map(node => node.getText(tree)).join('\n');
  const js = ts.transpileModule(body, { compilerOptions: { module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022 } }).outputText.replace(/^export /gm, '');
  return new Function('Router', 'config', 'sql', 'randomUUID', 'freshMissionControlPathsV1', 'fetch', js
    + ';return typeof createRulesRouter === "function" ? createRulesRouter({setfarmUrl:config.setfarmUrl, selectedFresh:()=>freshMissionControlPathsV1() !== null, fetch, timeoutMs:' + timeoutMs + '}) : router;')(
    express.Router, { setfarmUrl: url }, () => { throw Error('SQL forbidden'); },
    () => { throw Error('UUID forbidden'); }, () => (typeof selected === 'function' ? selected() : selected) ? {} : null, fetch,
  );
}
async function listen(server: Server) {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}
async function fixture(t: { after(fn: () => Promise<void>): void }, handler: RequestListener, selected: boolean | (() => boolean) = false) {
  const upstream = createServer(handler);
  const url = await listen(upstream);
  const app = express(); app.use(express.json()); app.use('/api', route(url, selected));
  const proxy = createServer(app); const base = await listen(proxy);
  t.after(async () => { for (const server of [proxy, upstream]) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } });
  return base;
}

test('GET preserves successful array and all existing query filters; export stays downloadable', async t => {
  const seen: string[] = [];
  const base = await fixture(t, (req, res) => { seen.push(req.url!); res.setHeader('Content-Type', 'application/json'); res.end('[{"id":"rule-1","title":"Fixture"}]'); });
  const response = await fetch(base + '/api/rules?category=lint&project_type=react&stack_pack_id=vite-react-web-app&source=fragment&search=a%20b');
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), [{ id: 'rule-1', title: 'Fixture' }]);
  assert.deepEqual(seen, ['/api/rules?category=lint&project_type=react&stack_pack_id=vite-react-web-app&source=fragment&search=a+b']);
  const exported = await fetch(base + '/api/rules/export');
  assert.equal(exported.status, 200); assert.match(exported.headers.get('content-disposition')!, /setfarm-rules.json/);
  assert.deepEqual(await exported.json(), [{ id: 'rule-1', title: 'Fixture' }]);
});

for (const [method, path] of [['GET', ''], ['POST', ''], ['PUT', '/a'], ['DELETE', '/a'], ['POST', '/import'], ['PUT', '/a/toggle'], ['GET', '/export']]) {
  test(`${method} ${path || '/'} preserves upstream JSON 503 without pretending success`, async t => {
    const base = await fixture(t, (_req, res) => { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end('{"error":"FRESH_RULES_NOT_WIRED","code":"NOT_WIRED"}'); });
    const response = await fetch(base + '/api/rules' + path, { method });
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'FRESH_RULES_NOT_WIRED', code: 'NOT_WIRED' });
    assert.equal(response.headers.get('content-disposition'), null);
  });
}

for (const [status, body] of [[502, '<html>' + 'private diagnostic '.repeat(1000)], [503, 'not-json'], [200, '{bad-json'] ] as const) {
  test(`invalid upstream JSON is bounded and never leaks body (${status})`, async t => {
    const base = await fixture(t, (_req, res) => { res.writeHead(status); res.end(body); });
    const response = await fetch(base + '/api/rules'); const value = await response.json();
    assert.equal(response.status, status >= 400 ? status : 502); assert.deepEqual(value, { error: 'Rules service returned an invalid response', code: 'RULES_INVALID_RESPONSE' });
  });
}

test('upstream timeout returns safe 504', async t => {
  const base = await fixture(t, () => {}); const response = await fetch(base + '/api/rules');
  assert.equal(response.status, 504); assert.deepEqual(await response.json(), { error: 'Rules service timed out', code: 'RULES_UPSTREAM_TIMEOUT' });
});

test('selected fresh capabilities refuse every unsupported mutation before upstream calls', async t => {
  let writes = 0; let reads = 0;
  const base = await fixture(t, (req, res) => { req.method === 'GET' ? reads++ : writes++; res.end('[]'); }, true);
  const capabilities = await fetch(base + '/api/rules/capabilities');
  assert.equal(capabilities.status, 200);
  assert.deepEqual(await capabilities.json(), { create: false, update: false, delete: false, import: false, toggle: false, reason: 'FRESH_RULES_NOT_WIRED' });
  for (const [method, path] of [['POST', ''], ['PUT', '/a'], ['DELETE', '/a'], ['POST', '/import'], ['PUT', '/a/toggle']]) {
    const response = await fetch(base + '/api/rules' + path, { method });
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'FRESH_RULES_NOT_WIRED', code: 'NOT_WIRED' });
  }
  assert.equal(writes, 0); assert.equal(reads, 0);
  const response = await fetch(base + '/api/rules'); assert.deepEqual(await response.json(), []); assert.equal(reads, 1);
});


test('JSON diagnostics never expose arbitrary fields, private paths or credentials', async t => {
  const base = await fixture(t, (_req, res) => { res.writeHead(500); res.end(JSON.stringify({
    error: 'Cannot read /etc/config.json', code: 'invalid private code', stack: 'private stack', token: 'fixture-secret',
  })); });
  const response = await fetch(base + '/api/rules');
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Rules service request failed (HTTP 500)', code: 'RULES_UPSTREAM_ERROR' });
});

test('upstream connection loss returns generic 502 without transport diagnostics', async t => {
  const base = await fixture(t, (req) => { req.socket.destroy(); });
  const response = await fetch(base + '/api/rules'); assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: 'Rules service unavailable', code: 'RULES_UPSTREAM_UNAVAILABLE' });
});

test('successful create preserves upstream 201 status and payload', async t => {
  const base = await fixture(t, (_req, res) => { res.writeHead(201); res.end('{"id":"created"}'); });
  const response = await fetch(base + '/api/rules', { method: 'POST' });
  assert.equal(response.status, 201); assert.deepEqual(await response.json(), { id: 'created' });
});

test('safe JSON errors retain at most 300 message characters', async t => {
  const base = await fixture(t, (_req, res) => { res.writeHead(409); res.end(JSON.stringify({ error: 'a'.repeat(1000) })); });
  const response = await fetch(base + '/api/rules'); assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'a'.repeat(300), code: 'RULES_UPSTREAM_ERROR' });
});


test('ordinary proxy capabilities are explicit and do not make upstream requests', async t => {
  let calls = 0;
  const base = await fixture(t, (_req, res) => { calls++; res.end('[]'); });
  const response = await fetch(base + '/api/rules/capabilities'); assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { create: true, update: true, delete: true, import: true, toggle: true, reason: null });
  assert.equal(calls, 0);
});

test('capability-selection failure refuses writes without exposing guard diagnostics', async t => {
  let calls = 0;
  const base = await fixture(t, (_req, res) => { calls++; res.end('[]'); }, () => { throw Error('private runtime guard diagnostic'); });
  for (const [path, method] of [['/capabilities', 'GET'], ['', 'POST']]) {
    const response = await fetch(base + '/api/rules' + path, { method });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'Rules capabilities unavailable', code: 'RULES_CAPABILITIES_UNAVAILABLE' });
  }
  assert.equal(calls, 0);
});

for (const error of ['EACCES:/opt/runtime/config.json', 'Upstream https://user:credential@example.invalid failed', 'token=fixture-secret', 'line one\nprivate stack']) {
  test(`unsafe JSON message is replaced by a bounded public error (${error.split(':')[0].split('=')[0].split('\n')[0]})`, async t => {
    const base = await fixture(t, (_req, res) => { res.writeHead(503); res.end(JSON.stringify({ error })); });
    const response = await fetch(base + '/api/rules'); assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'Rules service request failed (HTTP 503)', code: 'RULES_UPSTREAM_ERROR' });
  });
}
