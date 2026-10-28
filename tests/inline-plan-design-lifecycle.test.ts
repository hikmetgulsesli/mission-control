// Full production modules at modeled React/API/timer ports; no DOM, network or server.
// Synthetic scheduling covers effects/callbacks and cleanup, not mounted React/layout.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as status from '../src/lib/status.ts';
import { actualFunction, deferred, flush } from './fixtures/files-selection-lifecycle.ts';

const empty = { screens: [], projectId: null, designSystem: null };
const saved = (name: string) => ({ screens: [{ screenId: 'screen-1', name, type: 'desktop', screenshotUrl: '/api/saved.png?token=fixture', htmlUrl: '/api/saved.html?token=fixture', width: 800, height: 600 }], projectId: 'project-1', designSystem: { accent: '#123456' }, designNotes: 'Saved notes' });
const plan = { prd: 'Fixture PRD', stories: [], rawOutput: 'Fixture raw', projectMemory: 'Fixture memory' };
const contract = { project: { displayName: 'Independent Contract' }, phases: [], stories: [], progress: { total: 1, pass: 1 } };
function nodes(node: any): any[] { return Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : []; }
function text(node: any): string { return Array.isArray(node) ? node.map(text).join(' ') : node && typeof node === 'object' ? text(node.props?.children) : typeof node === 'boolean' ? '' : String(node ?? ''); }
function button(tree: any, label: string) { const found = nodes(tree).find(n => n.type === 'button' && text(n).trim().startsWith(label)); assert.ok(found, `reachable ${label} button`); return found; }
function loadModule(path: string, ports: Record<string, any>, globals: Record<string, any> = {}) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const mod = { exports: {} as any };
  const read = (id: string) => { assert.ok(id in ports, `bound import ${id}`); return ports[id]; };
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(read, mod, mod.exports, ...Object.values(globals));
  return mod.exports;
}
function harness(options: { initialTab?: string; plan?: () => Promise<any>; contract?: () => Promise<any> } = {}) {
  const slots: any[] = [], effects = new Map<number, { deps: any[]; run: () => any; cleanup?: () => void }>();
  let cursor = 0, dirty = false, mounted = true, postUnmountSetters = 0, pending: any[] = [], tree: any;
  let props = { runId: 'run-a', initialTab: options.initialTab || 'contract' };
  const timers = new Map<number, () => void>(); let nextTimer = 0;
  const same = (a: any[] | undefined, b: any[]) => !!a && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const hooks = {
    memo: (fn: any) => fn,
    createElement: (type: any, p: any, ...children: any[]) => ({ type, props: { ...p, children } }),
    useState(initial: any) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], (next: any) => { if (!mounted) postUnmountSetters++; const value = typeof next === 'function' ? next(slots[i]) : next; if (!Object.is(value, slots[i])) { slots[i] = value; dirty = true; } }]; },
    useRef(initial: any) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback(fn: any, deps: any[]) { const i = cursor++; if (!same(slots[i]?.deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; },
    useEffect(run: any, deps: any[]) { const i = cursor++; if (!same(effects.get(i)?.deps, deps)) pending.push({ i, run, deps }); },
  };
  const calls: { method: string; id: string; result: ReturnType<typeof deferred> }[] = [];
  const api: any = {
    runPlan: options.plan || (async () => plan), runContract: options.contract || (async () => contract),
    runStories: async () => [], runOperations: async () => null,
    ...Object.fromEntries(['runDesign', 'retrieveRunDesign'].map(method => [method, (id: string) => { const result = deferred(); calls.push({ method, id, result }); return result.promise; }])),
  };
  const { InlinePlanView } = loadModule('../src/components/pipeline/InlinePlanView.tsx', {
    react: hooks, '../../lib/api': { api }, '../../lib/status': status,
    '../StoryChecklist': { StoryChecklist: 'StoryChecklist' }, './AgentActivityDrawer': { AgentActivityDrawer: 'AgentActivityDrawer' },
  }, { setInterval: (fn: () => void, ms: number) => { assert.equal(ms, 3000); timers.set(++nextTimer, fn); return nextTimer; }, clearInterval: (id: number) => timers.delete(id) });
  function render(next = props, commit = true) {
    props = next;
    for (let pass = 0; pass < 30; pass++) {
      cursor = 0; dirty = false; pending = []; tree = InlinePlanView(props);
      if (!commit) return tree;
      for (const e of pending) effects.get(e.i)?.cleanup?.();
      for (const e of pending) effects.set(e.i, { ...e, deps: [...e.deps], cleanup: e.run() || undefined });
      if (!dirty) return tree;
    }
    assert.fail('component must settle');
  }
  return {
    calls, render, text: () => text(render()), beforeEffects: (next: typeof props) => render(next, false),
    async settle() { await flush(); return render(); },
    click(label: string) { button(render(), label).props.onClick(); return render(); },
    tick() { [...timers.values()].forEach(fn => fn()); return render(); },
    replayEffects() { for (const e of effects.values()) e.cleanup?.(); for (const e of effects.values()) e.cleanup = e.run() || undefined; return render(); },
    unmount() { for (const e of effects.values()) e.cleanup?.(); mounted = false; },
    postUnmountSetters: () => postUnmountSetters,
  };
}
const reads = (h: ReturnType<typeof harness>) => h.calls.filter(c => c.method === 'runDesign');
const retrievals = (h: ReturnType<typeof harness>) => h.calls.filter(c => c.method === 'retrieveRunDesign');
async function openDesign(h: ReturnType<typeof harness>, data = empty) { h.click('DESIGN'); assert.equal(reads(h).length, 1); reads(h)[0].result.resolve(data); return h.settle(); }
function assertScreens(tree: any, name: string) {
  assert.match(text(tree), new RegExp(name));
  assert.ok(nodes(tree).some(n => n.type === 'img' && n.props.src === '/api/saved.png?token=fixture'));
  assert.ok(nodes(tree).some(n => n.type === 'a' && n.props.href === '/api/saved.html?token=fixture' && n.props.rel === 'noopener noreferrer'));
  assert.match(text(tree), /#123456/);
  assert.match(text(tree), /Saved notes/);
}

test('Contract mount and repeated polling never read or retrieve Design; slow Design cannot delay Contract', async () => {
  const h = harness();
  try {
    h.render(); await h.settle();
    for (let i = 0; i < 4; i++) { h.tick(); await h.settle(); }
    assert.equal(reads(h).length, 0); assert.equal(retrievals(h).length, 0);
    assert.match(h.text(), /Independent Contract/);
    h.click('DESIGN'); assert.equal(reads(h).length, 1);
    h.click('CONTRACT'); h.tick(); await h.settle();
    assert.match(h.text(), /Independent Contract/);
    reads(h)[0].result.reject(Error('/internal/private token=SECRET'));
    await h.settle(); assert.match(h.text(), /Independent Contract/);
    assert.equal(retrievals(h).length, 0);
  } finally { h.unmount(); }
});

test('Design and Overview route stay reachable before plan completion and after missing/rejected data', async t => {
  for (const outcome of ['pending', 'missing', 'rejected', 'contract-rejected']) await t.test(outcome, async () => {
    const pending = deferred();
    const h = harness({ plan: () => outcome === 'pending' ? pending.promise : ['missing', 'contract-rejected'].includes(outcome) ? Promise.resolve(null) : Promise.reject(Error('SECRET')), contract: async () => { if (outcome === 'contract-rejected') throw Error('SECRET'); return null; } });
    try {
      let tree = h.render(); if (outcome !== 'pending') tree = await h.settle();
      for (const label of ['OVERVIEW', 'CONTRACT', 'PRD', 'DESIGN', 'STORIES', 'RAW', 'MEMORY']) button(tree, label);
      assert.equal(text(button(tree, 'DESIGN')).trim(), 'DESIGN', 'unknown count is omitted');
      tree = h.click('OVERVIEW');
      if (outcome !== 'pending') assert.ok(nodes(tree).some(n => n.type === 'StoryChecklist'), 'story fallback stays within the navigable shell');
      h.click('View Screens');
      assert.equal(reads(h).length, 1); reads(h)[0].result.resolve(empty);
      tree = await h.settle(); assert.match(text(tree), /No local design screens/);
      h.click('STORIES'); assert.ok(nodes(h.render()).some(n => n.type === 'StoryChecklist'));
      assert.equal(retrievals(h).length, 0);
    } finally { h.unmount(); pending.resolve(null); await flush(); }
  });
});

test('selected Design owns loading/local empty and preserves every technical tab', async () => {
  const h = harness();
  try {
    h.render(); await h.settle(); h.click('DESIGN');
    assert.match(h.text(), /Loading local design/); assert.equal(retrievals(h).length, 0);
    reads(h)[0].result.resolve(empty); let tree = await h.settle();
    assert.match(text(tree), /No local design screens/); assert.match(text(button(tree, 'DESIGN')), /\(0\)/);
    for (const label of ['CONTRACT', 'PRD', 'STORIES', 'RAW', 'MEMORY']) button(tree, label);
    h.click('PRD'); assert.match(h.text(), /Fixture PRD/);
    h.click('RAW'); assert.match(h.text(), /Fixture raw/);
    h.click('MEMORY'); assert.match(h.text(), /Fixture memory/);
    assert.equal(retrievals(h).length, 0);
  } finally { h.unmount(); }
});

test('accepted local Design retains tokens, guarded screenshot and HTML URLs', async () => {
  const h = harness(); try { h.render(); await h.settle(); const tree = await openDesign(h, saved('local-screen') as any); assertScreens(tree, 'local-screen'); h.click('OVERVIEW'); assert.match(h.text(), /#123456/); } finally { h.unmount(); }
});

test('local read error is safe and its Retry performs GET only then recovers', async () => {
  const h = harness(); try {
    h.render(); await h.settle(); h.click('DESIGN'); reads(h)[0].result.reject(Error('/private/cache SECRET credential'));
    let tree = await h.settle(); assert.match(text(tree), /Local design unavailable/); assert.doesNotMatch(text(tree), /SECRET|private|credential/);
    assert.equal(text(button(tree, 'DESIGN')).trim(), 'DESIGN');
    h.click('Retry'); assert.equal(reads(h).length, 2); assert.equal(retrievals(h).length, 0);
    reads(h)[1].result.resolve(saved('recovered-screen')); tree = await h.settle(); assertScreens(tree, 'recovered-screen'); assert.doesNotMatch(text(tree), /Local design unavailable/);
  } finally { h.unmount(); }
});

test('explicit retrieve synchronously deduplicates double clicks and polling while pending', async () => {
  const h = harness(); try {
    h.render(); await h.settle(); await openDesign(h);
    const retrieve = button(h.render(), 'Retrieve design'); retrieve.props.onClick(); retrieve.props.onClick();
    assert.equal(retrievals(h).length, 1); assert.equal(retrievals(h)[0].id, 'run-a');
    let tree = h.render(); assert.equal(button(tree, 'Retrieving design').props.disabled, true);
    for (let i = 0; i < 3; i++) { h.tick(); await h.settle(); }
    retrieve.props.onClick();
    assert.equal(retrievals(h).length, 1); assert.equal(reads(h).length, 1);
    retrievals(h)[0].result.resolve(saved('retrieved-screen')); tree = await h.settle(); assertScreens(tree, 'retrieved-screen');
    assert.equal(button(tree, 'Retrieve design').props.disabled, false);
  } finally { h.unmount(); }
});

test('failed retrieval retains accepted local artifacts, safe error and explicit recovery', async () => {
  const h = harness(); try {
    h.render(); await h.settle(); await openDesign(h, saved('retained-screen') as any);
    h.click('Retrieve design'); retrievals(h)[0].result.reject(Error('/private/provider SECRET'));
    let tree = await h.settle(); assertScreens(tree, 'retained-screen'); assert.match(text(tree), /Design retrieval failed/); assert.doesNotMatch(text(tree), /SECRET|private|No local design screens/);
    h.click('Retrieve design'); assert.equal(retrievals(h).length, 2); retrievals(h)[1].result.resolve(saved('recovered-retrieval'));
    tree = await h.settle(); assertScreens(tree, 'recovered-retrieval'); assert.doesNotMatch(text(tree), /Design retrieval failed/);
  } finally { h.unmount(); }
});

test('late local GET cannot overwrite accepted explicit retrieval', async () => {
  const h = harness(); try {
    h.render(); await h.settle(); h.click('DESIGN'); h.click('Retrieve design');
    retrievals(h)[0].result.resolve(saved('retrieval-wins')); await h.settle();
    reads(h)[0].result.resolve(saved('stale-read')); const tree = await h.settle(); assertScreens(tree, 'retrieval-wins'); assert.doesNotMatch(text(tree), /stale-read/);
  } finally { h.unmount(); }
});

test('run replacement fences accepted data and late GET/POST before and after effects', async t => {
  for (const kind of ['get', 'get-error', 'post', 'post-error', 'accepted']) await t.test(kind, async () => {
    const h = harness(); try {
      h.render(); await h.settle(); h.click('DESIGN');
      if (!kind.startsWith('get')) { reads(h)[0].result.resolve(saved('old-screen')); await h.settle(); }
      if (kind.startsWith('post')) h.click('Retrieve design');
      const next = { runId: 'run-b', initialTab: 'design' };
      assert.doesNotMatch(text(h.beforeEffects(next)), /old-screen/);
      h.render(next); assert.equal(reads(h).at(-1)!.id, 'run-b');
      reads(h).at(-1)!.result.resolve(saved('new-screen')); await h.settle();
      if (kind === 'get') reads(h)[0].result.resolve(saved('old-screen'));
      if (kind === 'get-error') reads(h)[0].result.reject(Error('SECRET old-read'));
      if (kind === 'post') retrievals(h)[0].result.resolve(saved('old-screen'));
      if (kind === 'post-error') retrievals(h)[0].result.reject(Error('SECRET old-retrieval'));
      const tree = await h.settle(); assertScreens(tree, 'new-screen'); assert.doesNotMatch(text(tree), /old-screen|SECRET|Local design unavailable|Design retrieval failed/);
    } finally { h.unmount(); }
  });
});

test('unmount invalidates Design GET/POST and the shared fetch sequence', async t => {
  for (const kind of ['get', 'get-error', 'post', 'post-error', 'shared', 'shared-error']) await t.test(kind, async () => {
    const pendingPlan = deferred(); const h = harness(kind.startsWith('shared') ? { plan: () => pendingPlan.promise } : {});
    h.render(); if (!kind.startsWith('shared')) { await h.settle(); h.click('DESIGN'); if (kind.startsWith('post')) h.click('Retrieve design'); }
    h.unmount();
    if (kind === 'shared-error') pendingPlan.reject(Error('SECRET shared')); else pendingPlan.resolve(plan);
    for (const call of h.calls) { if (kind.endsWith('error')) call.result.reject(Error('SECRET late')); else call.result.resolve(saved('late-screen')); }
    await flush(); assert.equal(h.postUnmountSetters(), 0);
  });
});

test('effect setup/cleanup replay never implies provider retrieval and stale reads are fenced', async () => {
  const h = harness({ initialTab: 'design' }); try {
    h.render(); h.replayEffects(); assert.equal(retrievals(h).length, 0); assert.equal(reads(h).length, 2);
    reads(h)[1].result.resolve(saved('fresh-screen')); await h.settle(); reads(h)[0].result.resolve(saved('stale-screen'));
    const tree = await h.settle(); assertScreens(tree, 'fresh-screen'); assert.doesNotMatch(text(tree), /stale-screen/);
  } finally { h.unmount(); }
});

test('actual API wrapper keeps GET local and retrieval explicit authenticated POST without body', async () => {
  const calls: any[] = [];
  const { api } = loadModule('../src/lib/api.ts', { './operational-snapshot': {}, './product-build-authority': {}, './control-evidence': {} }, {
    document: { querySelector: () => ({ content: 'fixture-token' }) },
    fetch: async (path: string, init: any) => { calls.push({ path, init }); return { ok: true, json: async () => empty }; },
  });
  assert.deepEqual(await api.runDesign('run-a'), empty);
  assert.equal(typeof api.retrieveRunDesign, 'function'); assert.deepEqual(await api.retrieveRunDesign('run-a'), empty);
  assert.deepEqual(calls.map(c => [c.path, c.init.method || 'GET', c.init.body, c.init.headers['X-MC-Token']]), [
    ['/api/setfarm/runs/run-a/design', 'GET', undefined, 'fixture-token'],
    ['/api/setfarm/runs/run-a/design/retrieve', 'POST', undefined, 'fixture-token'],
  ]);
});

test('owned UI fixture returns the local Design shape at its modeled request boundary', async () => {
  const response = actualFunction('../../scripts/ui-regression-fixtures.mjs', 'fixtureResponse', { FIXED_GETS: [], LEGACY: 'run-a', V3: 'run-b' });
  const state = { requests: [], unexpected: [] };
  assert.deepEqual(await response(state, 'GET', new URL('http://fixture/api/setfarm/runs/run-a/design'), undefined, ''), empty);
});
