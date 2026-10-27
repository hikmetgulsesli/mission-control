import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

export function deferred<T = any>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
export async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

// Actual source declarations execute with synthetic React slots/effects and timers.
// No DOM, sockets, process launch, transport or filesystem mutation is simulated as success.
export function lifecycle() {
  const slots: any[] = [], effects = new Map<number, { deps: any[]; cleanup?: () => void }>();
  const pending = new Map<number, { fn: () => any; deps: any[] }>();
  const timers = new Map<number, () => void>();
  let cursor = 0, nextTimer = 0, mounted = true, dirty = false, postUnmountSetters = 0;
  const same = (a?: any[], b?: any[]) => !!a && !!b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const useState = (initial: any) => {
    const i = cursor++;
    if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
    return [slots[i], (value: any) => {
      if (!mounted) postUnmountSetters++;
      const next = typeof value === 'function' ? value(slots[i]) : value;
      if (!Object.is(slots[i], next)) { slots[i] = next; dirty = true; }
    }];
  };
  const useRef = (initial: any) => { const i = cursor++; return slots[i] ??= { current: initial }; };
  const useCallback = (fn: any, deps: any[]) => { const i = cursor++; if (!same(slots[i]?.deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; };
  const useEffect = (fn: any, deps: any[]) => { const i = cursor++; if (!same(effects.get(i)?.deps, deps)) pending.set(i, { fn, deps }); };
  const setTimer = (fn: () => void) => { timers.set(++nextTimer, fn); return nextTimer; };
  const clearTimer = (id: number) => { timers.delete(id); };
  return {
    bindings: { useState, useRef, useEffect, useCallback, setInterval: setTimer, clearInterval: clearTimer, setTimeout: setTimer, clearTimeout: clearTimer },
    timers,
    render<T>(fn: () => T): T {
      let result!: T, passes = 0;
      do {
        assert.ok(passes++ < 20, 'render must settle'); dirty = false; cursor = 0; result = fn();
        for (const [i, e] of pending) { effects.get(i)?.cleanup?.(); effects.set(i, { deps: [...e.deps], cleanup: e.fn() || undefined }); }
        pending.clear();
      } while (dirty);
      return result;
    },
    tick() { [...timers.values()].forEach(fn => fn()); },
    unmount() { for (const e of effects.values()) e.cleanup?.(); mounted = false; },
    postUnmountSetters: () => postUnmountSetters,
  };
}

export function actualFunction(relative: string, name: string, bindings: Record<string, any>, jsx = false) {
  const text = readFileSync(new URL(relative, import.meta.url), 'utf8');
  const tree = ts.createSourceFile(jsx ? 'source.tsx' : 'source.ts', text, ts.ScriptTarget.Latest, true, jsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const declarations = tree.statements.filter(ts.isFunctionDeclaration).filter(n => n.name?.text === name);
  assert.equal(declarations.length, 1);
  const code = ts.transpileModule(declarations[0].getText(tree).replace(/^export /, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
  return new Function(...Object.keys(bindings), code + `\nreturn ${name};`)(...Object.values(bindings));
}

export function pollingHarness() {
  const life = lifecycle();
  const hook = actualFunction('../../src/hooks/usePolling.ts', 'usePolling', life.bindings);
  let args: [() => Promise<any>, number, string?];
  const current = () => life.render(() => hook(...args));
  return { ...life, current, render(fetcher: () => Promise<any>, interval = 30000, key?: string) { args = [fetcher, interval, key]; return current(); } };
}

type Element = { type: any; props: Record<string, any> };
export function filesHarness() {
  const life = lifecycle();
  const calls: { method: string; args: any[]; result: ReturnType<typeof deferred> }[] = [];
  const api = Object.fromEntries(['filesRead', 'filesWrite', 'filesDelete', 'filesRename', 'filesMkdir', 'filesUpload'].map(method => [method, (...args: any[]) => {
    const result = deferred(); calls.push({ method, args, result }); return result.promise;
  }]));
  let refreshes = 0;
  const toasts: any[][] = [], downloads: any[][] = [];
  const React = { createElement(type: any, props: any, ...children: any[]) { return { type, props: { ...props, children } }; }, Fragment: 'Fragment' };
  const page = actualFunction('../../src/pages/Files.tsx', 'Files', {
    ...life.bindings, React, api, useToast: () => ({ toast: (...args: any[]) => toasts.push(args) }),
    usePolling: () => ({ data: { path: '/root/', entries: [] }, error: null, loading: false, refresh: () => { refreshes++; } }),
    GlitchText: 'GlitchText', FileTree: 'FileTree', FileViewer: 'FileViewer', ContextMenu: 'ContextMenu', ConfirmDialog: 'ConfirmDialog',
    window: { open: (...args: any[]) => downloads.push(args) },
  }, true);
  let tree: Element;
  const render = () => { tree = life.render(() => page()); return tree; };
  const nodes = () => {
    render(); const all: Element[] = [];
    const walk = (node: any) => { if (Array.isArray(node)) node.forEach(walk); else if (node && typeof node === 'object' && 'type' in node) { all.push(node); walk(node.props.children); } };
    walk(tree); return all;
  };
  const props = (type: string) => { const found = nodes().find(n => n.type === type); assert.ok(found, `${type} exists`); return found.props; };
  const text = (n: any): string => Array.isArray(n) ? n.map(text).join('') : n && typeof n === 'object' ? text(n.props.children) : String(n ?? '');
  render();
  return {
    ...life, calls, toasts, downloads, props, render, refreshes: () => refreshes,
    viewer: () => props('FileViewer'), tree: () => props('FileTree'), confirm: () => props('ConfirmDialog'),
    request(method: string, path: string, index = 0) { const call = calls.filter(c => c.method === method && c.args[0] === path)[index]; assert.ok(call, `${method} ${path} #${index}`); return call.result; },
    context(path: string, label: string, isDir = false) {
      props('FileTree').onContextMenu(0, 0, { path, name: path.split('/').at(-1), isDir });
      const action = props('ContextMenu').items.find((i: any) => i.label === label); assert.ok(action, label); return action.action();
    },
    input(value: string) { const input = nodes().find(n => n.type === 'input' && n.props.className === 'file-dialog__input'); assert.ok(input); input.props.onChange({ target: { value } }); },
    button(label: string) { const button = nodes().find(n => n.type === 'button' && text(n) === label); assert.ok(button, `button ${label}`); return button.props.onClick(); },
  };
}
export function file(path: string, content = path) { return { path, name: path.split('/').at(-1), dir: path.substring(0, path.lastIndexOf('/')), size: content.length, mtime: '2026-10-27T00:00:00.000Z', lines: content.split('\n').length, content }; }
export async function select(h: ReturnType<typeof filesHarness>, path: string, content = path) {
  h.tree().onSelectFile(path); h.request('filesRead', path).resolve(file(path, content)); await flush();
}
