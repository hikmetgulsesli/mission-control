import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Exact Source components with DATA HTTP/lookup ports only. No application
// import, real fetch, SQL, provider, process or workflow acceptance is admitted.
const root = new URL('../', import.meta.url);
const source = (name: string) => readFileSync(new URL(name, root), 'utf8');
function declaration(file: string, name: string): string {
  const text = source(file), tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const matches = tree.statements.filter(node => (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node))
    && node.name?.text === name);
  assert.equal(matches.length, 1, `one exact top-level declaration: ${name}`);
  return matches[0]!.getText(tree);
}
const compile = (body: string) => ts.transpileModule(body, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace(/^export /gm, '');
type Reply = { status: number; body: unknown };
type StartError = Error & { acceptance: string; runId: string | null; repoPath: string | null };
const runId = '12345678-1234-4123-8123-123456789abc';
const unknownMessage = 'Run acceptance could not be confirmed. Do not start another run until this attempt is checked.';

function browser(reply: Reply, failure?: 'network' | 'json') {
  let calls = 0;
  const fetchPort = async (url: string, init: RequestInit) => {
    calls++;
    assert.equal(url, '/api/prd/start-run');
    assert.equal(init.method, 'POST');
    assert.equal(new Headers(init.headers).get('x-mc-token'), 'component-token');
    if (failure === 'network') throw Error('component transport loss');
    return { status: reply.status, ok: reply.status >= 200 && reply.status < 300,
      async json() { if (failure === 'json') throw Error('component JSON loss'); return reply.body; } };
  };
  const body = declaration('src/lib/api.ts', 'PrdWorkflowStartError') + '\n'
    + declaration('src/lib/api.ts', 'fetchPrdWorkflowStart');
  const port = new Function('fetch', 'BASE', 'CT_JSON', 'AUTH_TOKEN', compile(body)
    + ';return {invoke:fetchPrdWorkflowStart,ErrorType:PrdWorkflowStartError};')(
    fetchPort, '', { 'Content-Type': 'application/json' }, 'component-token',
  ) as { invoke(input: unknown): Promise<unknown>; ErrorType: typeof Error };
  return { ...port, calls: () => calls };
}
function recorder() {
  return { statusCode: 200, body: undefined as unknown,
    status(value: number) { this.statusCode = value; return this; },
    json(value: unknown) { this.body = value; return this; } };
}
async function legacyRefusal(input: unknown, prd: unknown): Promise<Reply> {
  const file = 'server/routes/prd-generator.ts', text = source(file);
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const calls = tree.statements.filter(ts.isExpressionStatement).map(node => node.expression)
    .filter(ts.isCallExpression).filter(node => ts.isPropertyAccessExpression(node.expression)
      && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'router'
      && node.expression.name.text === 'post' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])
      && node.arguments[0].text === '/prd/start-run');
  assert.equal(calls.length, 1, 'one exact start-run callback');
  const callback = calls[0]!.arguments[1]!;
  assert.ok(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback));
  let reads = 0;
  const invoke = new Function('freshMissionControlSelectedV1', 'getPrd', compile('const route = '
    + callback.getText(tree) + ';') + ';return route;')(
    () => false, async (id: string) => { reads++; assert.equal(id, 'component-prd'); return prd; },
  ) as (request: unknown, response: ReturnType<typeof recorder>) => Promise<void>;
  const response = recorder();
  await invoke({ body: input }, response);
  assert.equal(reads, (input as { prdId?: string }).prdId ? 1 : 0);
  return { status: response.statusCode, body: response.body };
}
function authRefusal(): Reply {
  let nextCalls = 0;
  const response = recorder();
  const invoke = new Function('config', compile(declaration('server/middleware/auth.ts', 'authMiddleware'))
    + ';return authMiddleware;')({ authToken: 'configured-component-token' }) as
    (request: unknown, response: ReturnType<typeof recorder>, next: () => void) => void;
  invoke({ path: '/api/prd/start-run', headers: {}, query: {} }, response, () => { nextCalls++; });
  assert.equal(nextCalls, 0, 'the actual auth rejection never reaches the route');
  return { status: response.statusCode, body: response.body };
}
async function expectError(port: ReturnType<typeof browser>, input: unknown,
  expected: { message: string; acceptance: string; runId: string | null; repoPath: string | null }) {
  await assert.rejects(port.invoke(input), (error: unknown) => {
    assert.ok(error instanceof port.ErrorType);
    const value = error as StartError;
    assert.equal(value.message, expected.message);
    assert.equal(value.acceptance, expected.acceptance);
    assert.equal(value.runId, expected.runId);
    assert.equal(value.repoPath, expected.repoPath);
    return true;
  });
  assert.equal(port.calls(), 1, 'no automatic retry after any outcome');
}

for (const scenario of ['missing-id', 'missing-prd', 'unauthorized'] as const) {
  test(`browser preserves actual prelaunch ${scenario} refusal as actionable not-started`, async () => {
    const input = scenario === 'missing-id' ? {} : { prdId: 'component-prd' };
    const reply = scenario === 'unauthorized' ? authRefusal() : await legacyRefusal(input, null);
    const expectedStatus = scenario === 'missing-id' ? 400 : scenario === 'missing-prd' ? 404 : 401;
    const expectedMessage = scenario === 'missing-id' ? 'prdId required'
      : scenario === 'missing-prd' ? 'PRD not found or empty' : 'Unauthorized';
    assert.equal(reply.status, expectedStatus);
    assert.deepEqual(reply.body, { error: expectedMessage });
    await expectError(browser(reply), input, { message: expectedMessage,
      acceptance: 'not-started', runId: null, repoPath: null });
  });
}

test('unrecognized statuses, near-miss messages and extra fields remain unknown rather than blanket-safe4xx', async () => {
  for (const reply of [
    { status: 400, body: { error: 'Invalid workflow' } },
    { status: 404, body: { error: 'PRD not found' } },
    { status: 401, body: { error: 'Unauthorized', runId } },
    { status: 400, body: { error: 'prdId required', runId } },
    { status: 400, body: { error: 'prdId required', acceptance: 'accepted' } },
    { status: 404, body: { error: 'PRD not found or empty', retrySafe: true } },
    { status: 500, body: { error: 'prdId required' } },
    { status: 503, body: { error: 'Unauthorized' } },
    { status: 422, body: { error: 'prdId required' } },
    { status: 200, body: { error: 'Unauthorized' } },
    { status: 400, body: null }, { status: 401, body: ['Unauthorized'] },
    { status: 404, body: 'PRD not found or empty' },
  ]) {
    await expectError(browser(reply), { prdId: 'component-prd' }, { message: unknownMessage,
      acceptance: 'unknown', runId: null, repoPath: null });
  }
});

test('network and JSON loss remain unknown without retries even beside a prelaunch-looking status', async () => {
  for (const failure of ['network', 'json'] as const) {
    await expectError(browser({ status: 401, body: { error: 'Unauthorized' } }, failure),
      { prdId: 'component-prd' }, { message: unknownMessage, acceptance: 'unknown', runId: null, repoPath: null });
  }
});

test('known selected error envelopes retain not-started, unknown or accepted identity and message', async () => {
  for (const acceptance of ['not-started', 'unknown', 'accepted'] as const) {
    const body = { schema: 'mission-control.workflow-start-result.v1', success: false, acceptance,
      runId: acceptance === 'accepted' ? runId : null, repoPath: '/component/project',
      error: 'Unauthorized', retrySafe: false };
    await expectError(browser({ status: 401, body }), { prdId: 'component-prd' }, {
      message: body.error, acceptance, runId: body.runId, repoPath: body.repoPath });
  }
  const invalid = { schema: 'mission-control.workflow-start-result.v1', success: false, acceptance: 'accepted',
    runId: null, repoPath: '/component/project', error: 'component acceptance identity missing', retrySafe: false };
  await expectError(browser({ status: 503, body: invalid }), { prdId: 'component-prd' }, {
    message: unknownMessage, acceptance: 'unknown', runId: null, repoPath: null });
});

test('valid selected and legacy success data remain intact; malformed success stays unknown', async () => {
  const selected = { success: true, accepted: true, runId, repoPath: '/component/project', acceptance: {
    schema: 'setfarm.workflow-run-accepted.v1', accepted: true, runId, runNumber: 1,
    workflowId: 'feature-dev', protocol: 'v3', protocolVersion: 1, status: 'running', compilerReleaseSha: 'a'.repeat(40),
  } };
  const legacy = { success: true, runId: 'legacy-component-id', output: 'Pipeline started', repoPath: '/component/legacy' };
  for (const body of [selected, legacy]) {
    const port = browser({ status: 200, body });
    assert.equal(await port.invoke({ prdId: 'component-prd' }), body);
    assert.equal(port.calls(), 1);
  }
  for (const body of [{ success: true, runId: null }, { ...selected, acceptance: { ...selected.acceptance, runId: 'crossed' } }]) {
    await expectError(browser({ status: 200, body }), { prdId: 'component-prd' }, {
      message: unknownMessage, acceptance: 'unknown', runId: null, repoPath: null });
  }
});
