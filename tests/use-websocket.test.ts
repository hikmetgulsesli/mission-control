import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// Actual Source hook closures; React lifecycle slots, transport and timers are simulated.
// This component test confers no mounted React/browser/network qualification.
function hookComponent() {
  const text = readFileSync(new URL('../src/hooks/useWebSocket.ts', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('hook.ts', text, ts.ScriptTarget.Latest, true);
  const fn = tree.statements.filter(ts.isFunctionDeclaration).filter(n => n.name?.text === 'useWebSocket');
  const constant = tree.statements.filter(ts.isVariableStatement).filter(n => n.declarationList.declarations.some(d => ts.isIdentifier(d.name) && d.name.text === 'MAX_MESSAGES'));
  assert.equal(fn.length, 1); assert.equal(constant.length, 1);
  const source = ts.transpileModule([...constant, ...fn].map(n => n.getText(tree)).join('\n').replace('export function', 'function'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const slots: any[] = [], timers = new Map<number, () => void>(), sockets: Socket[] = [];
  let cursor = 0, timerId = 0, effect: (() => void | (() => void)) | null = null, cleanup: (() => void) | undefined, dependencies: any[] | undefined;
  const useState = (initial: any) => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], (next: any) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; };
  const useRef = (initial: any) => { const i = cursor++; return slots[i] ??= { current: initial }; };
  const useEffect = (next: any, deps: any[]) => { if (!dependencies || deps.some((v, i) => !Object.is(v, dependencies![i])) || deps.length !== dependencies.length) { dependencies = [...deps]; effect = next; } };
  class Socket {
    static OPEN = 1; readyState = 0; closed = 0; sent: string[] = [];
    onopen: any = null; onmessage: any = null; onclose: any = null; onerror: any = null;
    constructor(readonly url: string) { sockets.push(this); }
    close() { this.closed++; this.readyState = 3; }
    send(value: string) { this.sent.push(value); }
    open() { this.readyState = 1; this.onopen?.({}); }
  }
  const hook = new Function('useState', 'useEffect', 'useCallback', 'useRef', 'WebSocket', 'window', 'document', 'setTimeout', 'clearTimeout', source + '\nreturn useWebSocket;')(
    useState, useEffect, (f: any) => f, useRef, Socket, { location: { protocol: 'http:', host: '127.0.0.1:9999' } }, { querySelector: () => null },
    (fn: () => void, ms: number) => { assert.equal(ms, 3000); timers.set(++timerId, fn); return timerId; }, (id: number) => timers.delete(id));
  function render(enabled?: boolean) { cursor = 0; const result = hook(enabled); if (effect) { cleanup?.(); const next = effect; effect = null; cleanup = next() || undefined; } return result; }
  return { render, sockets, timers, unmount() { cleanup?.(); cleanup = undefined; }, tick() { const queued = [...timers.values()]; timers.clear(); queued.forEach(fn => fn()); } };
}

test('disabled hook never constructs sockets or reconnects; default Chat remains enabled', () => {
  const x = hookComponent(); x.render(false); assert.equal(x.sockets.length, 0); assert.equal(x.timers.size, 0);
  assert.equal(x.render(false).connected, false); x.unmount();
  const chat = hookComponent(); chat.render(); assert.equal(chat.sockets.length, 1); assert.equal(chat.sockets[0].url, 'ws://127.0.0.1:9999/ws'); chat.unmount(); assert.equal(chat.sockets[0].closed, 1);
});
test('disable clears owned reconnect and closes current socket while retaining messages', () => {
  const x = hookComponent(); x.render(true); const socket = x.sockets[0]; socket.open(); socket.onmessage({ data: '{"type":"hello"}' });
  assert.equal(x.render(true).connected, true); assert.equal(x.sockets.length, 1);
  x.render(true).send({ type: 'message' }); assert.equal(socket.sent.length, 1);
  socket.onclose(); assert.equal(x.timers.size, 1); x.render(false); assert.equal(x.timers.size, 0); assert.equal(socket.closed, 1);
  const paused = x.render(false); assert.equal(paused.connected, false); assert.deepEqual(paused.messages, [{ type: 'hello' }]); paused.send({ type: 'forbidden' }); assert.equal(socket.sent.length, 1);
  x.tick(); assert.equal(x.sockets.length, 1); x.render(true); assert.equal(x.sockets.length, 2); x.unmount();
});
test('rapid disable-enable rejects late old socket callbacks and old timer without touching replacement', () => {
  const x = hookComponent(); x.render(true); const old = x.sockets[0]; old.open();
  const callbacks = { open: old.onopen, message: old.onmessage, close: old.onclose, error: old.onerror };
  old.onclose(); const timer = [...x.timers.values()][0]; x.render(false); x.render(true); const current = x.sockets[1];
  assert.ok(current); callbacks.open(); callbacks.message({ data: '{"type":"stale"}' }); callbacks.close(); callbacks.error(); timer();
  assert.equal(x.sockets.length, 2); assert.equal(x.timers.size, 0); assert.equal(current.closed, 0); assert.equal(x.render(true).connected, false); assert.deepEqual(x.render(true).messages, []);
  current.open(); assert.equal(x.render(true).connected, true); x.unmount(); assert.equal(current.closed, 1); callbacks.close(); assert.equal(x.timers.size, 0);
});
test('only the currently owned connection can reconnect and bounded messages survive pause', () => {
  const x = hookComponent(); x.render(true); const first = x.sockets[0]; first.open(); first.onclose(); x.tick(); assert.equal(x.sockets.length, 2);
  const second = x.sockets[1]; second.open(); for (let i = 0; i < 205; i++) second.onmessage({ data: JSON.stringify({ type: String(i) }) });
  assert.equal(x.render(true).messages.length, 201); x.render(false); assert.equal(x.render(false).messages[0].type, '4'); x.unmount();
});
test('Office passes actual visibility and document visibility into the actual hook call', () => {
  const text = readFileSync(new URL('../src/pages/PixelOffice.tsx', import.meta.url), 'utf8'), tree = ts.createSourceFile('office.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const active: ts.VariableDeclaration[] = [], calls: ts.CallExpression[] = [];
  const visit = (n: ts.Node) => { if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'active') active.push(n); if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'useWebSocket') calls.push(n); ts.forEachChild(n, visit); }; visit(tree);
  assert.equal(active.length, 1); assert.equal(calls.length, 1);
  const invoke = new Function('visible', 'documentVisible', 'useWebSocket', 'const active=' + active[0].initializer!.getText(tree) + ';return ' + calls[0].getText(tree));
  for (const [visible, documentVisible, expected] of [[false, false, false], [false, true, false], [true, false, false], [true, true, true]]) {
    let observed: unknown = 'missing'; invoke(visible, documentVisible, (value: unknown) => { observed = value; }); assert.equal(observed, expected);
  }
});
