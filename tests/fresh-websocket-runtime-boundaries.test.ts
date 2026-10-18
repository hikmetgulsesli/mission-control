import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Exact Source body + transport/event and fixed-boundary DATA ports only.
// No application import, real WebSocket/listener/provider/SQL or actual selected
// operational positive is represented by this component.
function component() {
  const sourceFile = new URL('../server/ws-proxy.ts', import.meta.url);
  assert.ok(statSync(sourceFile).size <= 16384);
  const text = readFileSync(sourceFile, 'utf8');
  const tree = ts.createSourceFile('ws-proxy.ts', text, ts.ScriptTarget.Latest, true);
  const functions = tree.statements.filter(ts.isFunctionDeclaration)
    .filter(node => node.name && ['setupWsProxy', 'logGatewayUnavailable'].includes(node.name.text));
  assert.equal(functions.length, 2, 'two exact top-level Source functions');
  const constant = tree.statements.filter(ts.isVariableStatement).filter(node => node.declarationList.declarations
    .some(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === 'lastGatewayUnavailableLogAt'));
  assert.equal(constant.length, 1);
  const body = [...constant, ...functions].map(node => node.getText(tree)).join('\n').replace(/\bexport\s+(?=function\b)/g, '');
  const js = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const state = { refused: false, guardCalls: 0, authReads: 0, serverConstructions: 0 };
  const gateways: Socket[] = [], timers = new Map<number, () => void>(), deferred: (() => void)[] = [];
  let timerSequence = 0;
  class Socket extends EventEmitter {
    static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
    readyState = Socket.OPEN;
    sent: string[] = []; pings = 0; terminations = 0; terminateCalls = 0; terminateFailures = 0; closes: { code?: number; reason?: string }[] = [];
    constructor(readonly url?: string, readonly options?: unknown) {
      super();
      if (url !== undefined) { this.readyState = Socket.CONNECTING; gateways.push(this); }
    }
    send(value: string) { this.sent.push(value); }
    ping() { this.pings++; }
    finishClose(code = 1000, reason = '') {
      if (this.readyState === Socket.CLOSED) return;
      this.readyState = Socket.CLOSED; this.emit('close', code, Buffer.from(reason));
    }
    close(code?: number, reason?: string) {
      this.closes.push({ code, reason }); this.finishClose(code, reason);
    }
    terminate() {
      this.terminateCalls++;
      if (this.terminateFailures > 0) { this.terminateFailures--; throw Error('owned terminate failure DATA'); }
      if (this.readyState === Socket.CLOSED || this.readyState === Socket.CLOSING) return;
      this.terminations++;
      const connecting = this.readyState === Socket.CONNECTING;
      this.readyState = Socket.CLOSING;
      // Installed ws abortHandshake queues error+close on nextTick for a
      // CONNECTING client. Explicit deferred transport events expose a missing
      // error listener without creating any real network/timer effect.
      deferred.push(() => { if (connecting) this.emit('error', Error('connection aborted DATA')); this.finishClose(); });
    }
    open() { this.readyState = Socket.OPEN; this.emit('open'); }
  }
  class ProxyServer extends EventEmitter {
    clients = new Set<Socket>();
    constructor(readonly options: any) { super(); state.serverConstructions++; }
    upgrade(token = 'mc-token-DATA', afterVerification?: () => void) {
      let accepted = true, code = 101, verified = false;
      const req = { url: '/ws?token=' + encodeURIComponent(token), socket: { remoteAddress: '127.0.0.1' } };
      if (this.options.verifyClient) {
        this.options.verifyClient({ req }, (value: boolean, status?: number) => {
          verified = true; accepted = value; code = status ?? (value ? 101 : 401);
        });
        assert.equal(verified, true, 'verification settles synchronously');
      }
      // Old Source has no hook: the transport does not invent a missing guard.
      if (!accepted) return { accepted, code, client: null };
      const client = new Socket(); this.clients.add(client);
      client.once('close', () => this.clients.delete(client));
      afterVerification?.(); this.emit('connection', client, req);
      return { accepted, code, client };
    }
  }
  const config = { get authToken() { state.authReads++; return 'mc-token-DATA'; }, gatewayWs: 'ws://gateway-DATA.invalid',
    wsOrigin: 'http://mc-DATA.invalid', publicOrigin: 'unused', internalUrl: 'unused', gatewayToken: 'gateway-token-DATA' };
  const setup = new Function('WebSocketServer', 'WebSocket', 'config', 'assertFreshMissionControlRuntimeV1',
    'setInterval', 'clearInterval', 'console', js + '\nreturn setupWsProxy;')(
    ProxyServer, Socket, config,
    () => { state.guardCalls++; if (state.refused) throw Error('fixed selected boundary DATA refusal'); },
    (fn: () => void, milliseconds: number) => { assert.equal(milliseconds, 20000); const id = ++timerSequence; timers.set(id, fn); return id; },
    (id: number | undefined) => { if (id !== undefined) timers.delete(id); },
    { log() {}, warn() {}, error() {} },
  ) as (server: unknown) => ProxyServer;
  return { state, setup: () => setup({}), gateways, timers, deferred, Socket,
    flush: () => { while (deferred.length) deferred.shift()!(); } };
}
function connected(c: ReturnType<typeof component>, wss: ReturnType<ReturnType<typeof component>['setup']>, open = true) {
  const result = wss.upgrade(); assert.ok(result.client); assert.equal(result.accepted, true);
  const gateway = c.gateways.at(-1)!; assert.ok(gateway);
  if (open) gateway.open();
  return { client: result.client, gateway };
}
const chat = () => Buffer.from(JSON.stringify({ type: 'message', to: 'agent', content: 'DATA message' }));
const challenge = () => Buffer.from(JSON.stringify({ type: 'event', event: 'connect.challenge' }));
const gatewayChat = () => Buffer.from(JSON.stringify({ type: 'event', event: 'chat', payload: { text: 'DATA response' } }));

test('setup refuses before installing any WebSocket server on a refused runtime', () => {
  const c = component(); c.state.refused = true;
  assert.throws(() => c.setup(), /fixed selected boundary DATA refusal/);
  assert.equal(c.state.serverConstructions, 0); assert.equal(c.gateways.length, 0);
});

test('upgrade refusal precedes auth/new gateway effects and disposes this proxy existing pair', () => {
  const c = component(), wss = c.setup(), pair = connected(c, wss), authReads = c.state.authReads;
  c.state.refused = true;
  const rejected = wss.upgrade();
  assert.equal(rejected.accepted, false); assert.equal(rejected.code, 503);
  assert.equal(c.state.authReads, authReads); assert.equal(c.gateways.length, 1);
  assert.equal(pair.client.terminations, 1); assert.equal(pair.gateway.terminations, 1); assert.equal(c.timers.size, 0);
});

test('verify-to-connection drift refuses before connection auth or opening gateway', () => {
  const c = component(), wss = c.setup();
  const result = wss.upgrade('mc-token-DATA', () => { c.state.refused = true; });
  assert.equal(result.accepted, true, 'upgrade verification completed before the DATA drift');
  assert.ok(result.client); assert.equal(result.client.terminations, 1);
  assert.equal(c.state.authReads, 0); assert.equal(c.gateways.length, 0); assert.equal(c.timers.size, 0);
});

for (const event of ['client-message', 'gateway-chat', 'gateway-challenge', 'gateway-open', 'ping'] as const) {
  test(`actual ${event} boundary stops existing traffic and closes owned sockets after refusal`, () => {
    const c = component(), wss = c.setup(), pair = connected(c, wss, event !== 'gateway-open');
    const tick = [...c.timers.values()][0]!; c.state.refused = true;
    if (event === 'client-message') pair.client.emit('message', chat());
    else if (event === 'gateway-chat') pair.gateway.emit('message', gatewayChat());
    else if (event === 'gateway-challenge') pair.gateway.emit('message', challenge());
    else if (event === 'gateway-open') pair.gateway.open();
    else tick();
    assert.equal(pair.client.terminations, 1); assert.equal(pair.gateway.terminations, 1);
    assert.deepEqual(pair.client.sent, []); assert.deepEqual(pair.gateway.sent, []); assert.equal(pair.client.pings, 0);
    assert.equal(c.timers.size, 0); assert.doesNotThrow(() => c.flush());
    assert.equal(pair.client.readyState, c.Socket.CLOSED); assert.equal(pair.gateway.readyState, c.Socket.CLOSED);
  });
}

test('CONNECTING refusal has registered error cleanup and remains inert on queued later callbacks', () => {
  const c = component(), wss = c.setup(), pair = connected(c, wss, false), tick = [...c.timers.values()][0]!;
  assert.equal(pair.gateway.readyState, c.Socket.CONNECTING);
  c.state.refused = true; pair.client.emit('message', chat());
  assert.equal(pair.client.terminations, 1); assert.equal(pair.gateway.terminations, 1);
  assert.equal(c.deferred.length, 2, 'both owned aborts settle later; CONNECTING includes error/close');
  assert.ok(pair.gateway.listenerCount('error') > 0);
  assert.doesNotThrow(() => c.flush()); assert.equal(pair.gateway.readyState, c.Socket.CLOSED);
  pair.gateway.emit('message', challenge()); pair.gateway.emit('message', gatewayChat());
  pair.client.emit('message', chat()); pair.gateway.emit('open'); tick(); wss.upgrade();
  assert.deepEqual(pair.gateway.sent, []); assert.deepEqual(pair.client.sent, []); assert.equal(pair.client.pings, 0);
  assert.equal(pair.client.terminations, 1); assert.equal(pair.gateway.terminations, 1); assert.equal(c.timers.size, 0);
});

test('refusal disposes all captured pairs including pending gateway, without touching unrelated socket', () => {
  const c = component(), wss = c.setup(), a = connected(c, wss), b = connected(c, wss, false), unrelated = new c.Socket();
  c.state.refused = true; a.client.emit('message', chat());
  for (const socket of [a.client, a.gateway, b.client, b.gateway]) assert.equal(socket.terminations, 1);
  assert.equal(unrelated.terminations, 0); assert.equal(unrelated.readyState, c.Socket.OPEN);
  assert.doesNotThrow(() => c.flush()); assert.equal(c.timers.size, 0);
});

test('normal client close does not untrack a still-owned CONNECTING gateway before refusal', () => {
  const c = component(), wss = c.setup(), pair = connected(c, wss, false);
  pair.client.close(); assert.equal(c.timers.size, 0); assert.equal(pair.gateway.readyState, c.Socket.CONNECTING);
  c.state.refused = true; assert.equal(wss.upgrade().accepted, false);
  assert.equal(pair.gateway.terminations, 1); assert.doesNotThrow(() => c.flush());
});

test('ordinary absent-mode DATA preserves auth, Origin, handshake and exact forwarding filters', () => {
  const c = component(), wss = c.setup();
  assert.equal(wss.options.path, '/ws');
  const bad = wss.upgrade('wrong'); assert.ok(bad.client); assert.deepEqual(bad.client.closes, [{ code: 1008, reason: 'Unauthorized' }]);
  assert.equal(c.gateways.length, 0);
  const pair = connected(c, wss);
  assert.equal(pair.gateway.url, 'ws://gateway-DATA.invalid');
  assert.deepEqual(pair.gateway.options, { headers: { Origin: 'http://mc-DATA.invalid' } });
  pair.gateway.emit('message', challenge());
  const handshake = JSON.parse(pair.gateway.sent[0]!);
  assert.equal(handshake.method, 'connect'); assert.equal(handshake.id, '1');
  assert.equal(handshake.params.minProtocol, 4); assert.equal(handshake.params.maxProtocol, 4);
  assert.equal(handshake.params.role, 'operator'); assert.deepEqual(handshake.params.scopes, ['operator.read', 'operator.write']);
  assert.deepEqual(handshake.params.auth, { token: 'gateway-token-DATA' });
  pair.client.emit('message', chat());
  const sent = JSON.parse(pair.gateway.sent[1]!);
  assert.equal(sent.method, 'chat.send'); assert.equal(sent.id, '2');
  assert.equal(sent.params.sessionKey, 'agent:agent:main'); assert.equal(sent.params.message, 'DATA message');
  pair.gateway.emit('message', Buffer.from('{invalid'));
  pair.gateway.emit('message', Buffer.from(JSON.stringify({ type: 'res', ok: true })));
  pair.gateway.emit('message', Buffer.from(JSON.stringify({ type: 'event', event: 'cron' })));
  pair.gateway.emit('message', Buffer.from(JSON.stringify({ type: 'event', event: 'agent', payload: { stream: 'other' } })));
  assert.deepEqual(pair.client.sent, []);
  pair.gateway.emit('message', gatewayChat());
  const lifecycle = JSON.stringify({ type: 'event', event: 'agent', payload: { stream: 'lifecycle' } });
  pair.gateway.emit('message', Buffer.from(lifecycle));
  assert.deepEqual(pair.client.sent, [gatewayChat().toString(), lifecycle]);
  [...c.timers.values()][0]!(); assert.equal(pair.client.pings, 1);
  pair.client.close(); assert.equal(c.timers.size, 0); assert.equal(pair.gateway.closes.length, 1);
  assert.equal(pair.client.terminations, 0); assert.equal(pair.gateway.terminations, 0);
});


test('terminate failure attempts the other socket and retains pending ownership for the next refusal', () => {
  const c = component(), wss = c.setup(), pair = connected(c, wss, false);
  pair.client.terminateFailures = 1;
  c.state.refused = true; pair.client.emit('message', chat());
  assert.equal(pair.client.terminateCalls, 1); assert.equal(pair.client.readyState, c.Socket.OPEN);
  assert.equal(pair.gateway.terminations, 1, 'one throwing close never skips the other captured socket');
  assert.equal(pair.gateway.readyState, c.Socket.CLOSING); assert.equal(c.timers.size, 0);
  pair.gateway.emit('message', challenge());
  assert.equal(pair.client.terminateCalls, 2); assert.equal(pair.client.terminations, 1);
  assert.equal(pair.gateway.terminations, 1, 'pending abort is idempotent');
  assert.doesNotThrow(() => c.flush());
  assert.equal(pair.client.readyState, c.Socket.CLOSED); assert.equal(pair.gateway.readyState, c.Socket.CLOSED);
  const counts = [pair.client.terminateCalls, pair.gateway.terminateCalls];
  wss.upgrade();
  assert.deepEqual([pair.client.terminateCalls, pair.gateway.terminateCalls], counts, 'closed pair is released');
  assert.deepEqual(pair.client.sent, []); assert.deepEqual(pair.gateway.sent, []);
});
