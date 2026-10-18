import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';

// Native HTTP captures exercise the production client helper, including its
// request method/body and real Response status parsing, without a live service.
async function api() { return import('../src/lib/rules-api.js'); }
async function fixture(t: { after(fn: () => Promise<void>): void }, status: number, body: string) {
  const seen: { method?: string; body: string }[] = [];
  const server = createServer(async (req, res) => {
    let value = ''; for await (const chunk of req) value += chunk;
    seen.push({ method: req.method, body: value }); res.writeHead(status); res.end(body);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); const address = server.address(); assert.ok(address && typeof address !== 'string');
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  return { url: `http://127.0.0.1:${address.port}/api/rules`, seen };
}

test('client rejects real 503 with service message/status instead of treating draft save as success', async t => {
  const { rulesRequest, RulesApiError, rulesErrorMessage } = await api(); const { url, seen } = await fixture(t, 503, '{"error":"FRESH_RULES_NOT_WIRED","code":"NOT_WIRED"}');
  await assert.rejects(rulesRequest(url, { method: 'POST', body: '{"title":"Keep draft"}' }), error => {
    assert.ok(error instanceof RulesApiError); assert.equal(error.status, 503); assert.equal(error.message, 'FRESH_RULES_NOT_WIRED'); assert.equal(error.code, 'NOT_WIRED'); assert.equal(rulesErrorMessage(error), 'HTTP 503: FRESH_RULES_NOT_WIRED'); return true;
  });
  assert.deepEqual(seen, [{ method: 'POST', body: '{"title":"Keep draft"}' }]);
});

test('client handles non-JSON failure with bounded generic HTTP error', async t => {
  const { rulesRequest, RulesApiError } = await api(); const { url } = await fixture(t, 502, '<html>private diagnostics</html>');
  await assert.rejects(rulesRequest(url), error => {
    assert.ok(error instanceof RulesApiError); assert.equal(error.status, 502); assert.equal(error.message, 'Rules request failed (HTTP 502)'); return true;
  });
});

test('load accepts actual array and rejects error-object or malformed success instead of empty rules', async t => {
  const { loadRules } = await api();
  const good = await fixture(t, 200, '[{"id":"rule-1"}]'); assert.deepEqual(await loadRules(good.url), [{ id: 'rule-1' }]);
  for (const body of ['{"error":"bad"}', '{broken']) {
    const bad = await fixture(t, 200, body); await assert.rejects(loadRules(bad.url), /invalid response/i);
  }
});

test('successful mutation returns parsed result for the caller success branch', async t => {
  const { rulesRequest } = await api(); const { url } = await fixture(t, 201, '{"id":"new-rule"}');
  assert.deepEqual(await rulesRequest(url, { method: 'POST' }), { id: 'new-rule' });
});


for (const [method, suffix] of [['PUT', '/fixture'], ['DELETE', '/fixture'], ['POST', '/import'], ['PUT', '/fixture/toggle']]) {
  test(`client ${method} ${suffix} refuses real 503 without success branch`, async t => {
    const { rulesRequest, RulesApiError } = await api(); const { url, seen } = await fixture(t, 503, '{"error":"FRESH_RULES_NOT_WIRED"}');
    await assert.rejects(rulesRequest(url + suffix, { method }), error => {
      assert.ok(error instanceof RulesApiError); assert.equal(error.status, 503); return true;
    });
    assert.deepEqual(seen, [{ method, body: '' }]);
  });
}
