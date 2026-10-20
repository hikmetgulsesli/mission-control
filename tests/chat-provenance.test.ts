// Actual component modules run with imported I/O ports and a simulated hook lifecycle.
// These checks do not qualify mounted React scheduling, layout, sanitization or delivery.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as React from 'react';
import { AGENT_MAP, AGENTS } from '../src/lib/constants.ts';
const require = createRequire(import.meta.url);
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred<T>() {
    let resolve!: (value: T) => void, reject!: (reason: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
function nodes(node: any): any[] {
    if (!node || typeof node !== 'object')
        return [];
    if (Array.isArray(node))
        return node.flatMap(nodes);
    return [node, ...nodes(node.props?.children)];
}
function textOf(node: any): string {
    if (node == null || typeof node === 'boolean')
        return '';
    if (typeof node === 'string' || typeof node === 'number')
        return String(node);
    if (Array.isArray(node))
        return node.map(textOf).join(' ');
    return textOf(node.props?.children);
}
function classNodes(tree: any, name: string) {
    return nodes(tree).filter(n => String(n.props?.className || '').split(' ').includes(name));
}
function only(tree: any, className: string) {
    const found = classNodes(tree, className);
    assert.equal(found.length, 1, className);
    return found[0];
}
function harness(file: string, exported: string, ports: Record<string, any>) {
    const slots: any[] = [];
    const effects = new Map<number, {
        deps: any[];
        cleanup?: () => void;
    }>();
    let cursor = 0, dirty = false, pending: {
        index: number;
        run: () => any;
        deps: any[];
    }[] = [];
    let props: any, output: any;
    const scrolls: any[] = [];
    const changed = (a: any[] | undefined, b: any[]) => !a || a.length !== b.length || b.some((v, i) => !Object.is(v, a[i]));
    const hooks = { ...React,
        useState(initial: any) {
            const i = cursor++;
            if (!(i in slots))
                slots[i] = typeof initial === 'function' ? initial() : initial;
            return [slots[i], (next: any) => { const v = typeof next === 'function' ? next(slots[i]) : next; if (!Object.is(v, slots[i])) {
                    slots[i] = v;
                    dirty = true;
                } }];
        },
        useRef(initial: any) { const i = cursor++; return slots[i] ??= { current: initial }; },
        useMemo(fn: () => any, deps: any[]) { const i = cursor++; if (changed(slots[i]?.deps, deps))
            slots[i] = { deps: [...deps], value: fn() }; return slots[i].value; },
        useEffect(run: () => any, deps: any[]) { const i = cursor++; if (changed(effects.get(i)?.deps, deps))
            pending.push({ index: i, run, deps: [...deps] }); },
    };
    function load(path: string): any {
        const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
            compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
        }).outputText;
        const mod = { exports: {} as any };
        const read = (id: string): any => {
            if (id === 'react')
                return hooks;
            if (id in ports)
                return ports[id];
            if (id === '../lib/constants' || id === './constants')
                return { AGENT_MAP, AGENTS };
            if (id === '../lib/chat-presentation')
                return load('../src/lib/chat-presentation.ts');
            if (id === 'react/jsx-runtime' || id === 'date-fns' || id === 'marked')
                return require(id);
            if (id === 'dompurify')
                return { sanitize: (s: string) => s }; // not a sanitizer qualification
            throw Error('Unbound component import: ' + id);
        };
        new Function('require', 'module', 'exports', code)(read, mod, mod.exports);
        return mod.exports;
    }
    const Component = load(file)[exported];
    function render(next = props, commit = true) {
        props = next;
        for (let pass = 0; pass < 20; pass++) {
            dirty = false;
            cursor = 0;
            pending = [];
            output = Component(props);
            for (const node of nodes(output))
                if (node.props?.ref && typeof node.props.ref === 'object')
                    node.props.ref.current = { scrollTo: (v: any) => scrolls.push(v), scrollIntoView: () => assert.fail('ancestor scroll') };
            if (!commit)
                return output;
            for (const e of pending) {
                effects.get(e.index)?.cleanup?.();
                const cleanup = e.run();
                effects.set(e.index, { deps: e.deps, cleanup: typeof cleanup === 'function' ? cleanup : undefined });
            }
            if (!dirty)
                return output;
        }
        throw Error('Component did not settle');
    }
    return { render, renderBeforeEffects: (next: any) => render(next, false), scrolls, async settle() { await tick(); return render(); },
        unmount() { for (const e of effects.values())
            e.cleanup?.(); effects.clear(); } };
}
const panelProps = {
    events: [], onSend: (_v: any) => { }, connected: true, selectedAgent: 'main',
    selectedAgentData: { id: 'main', name: 'Configured name', identityName: 'Rune', identityEmoji: 'R' },
};
const panel = (read: (...args: any[]) => Promise<any>) => harness('../src/components/ChatPanel.tsx', 'ChatPanel', { '../lib/api': { api: { agentHistory: read } } });
const sidebar = (read: (...args: any[]) => Promise<any>) => harness('../src/components/ChatSidebar.tsx', 'ChatSidebar', { '../lib/api': { api: { agentHistory: read } } });
const roster = [...AGENTS.map(a => ({ id: a.id, ...(a.id === 'main' ? panelProps.selectedAgentData : {}) })), { id: 'visitor' }, { id: 'named', name: 'Named Target' }];
function click(tree: any, label: string) { const n = nodes(tree).find(n => n.type === 'button' && textOf(n).includes(label)); assert.ok(n, label); n.props.onClick(); }
function typeInput(h: ReturnType<typeof harness>, value: string) { const tree = h.render(); nodes(tree).find(n => n.type === 'input').props.onChange({ target: { value } }); return h.render(); }
function submit(tree: any) { nodes(tree).find(n => n.type === 'form').props.onSubmit({ preventDefault() { } }); }
function socket(runId: string, text: string, extra: any = {}) { return { type: 'event', event: 'chat', payload: { sessionKey: 'agent:main:main', runId, state: 'final', message: { role: 'assistant', content: [{ text }] }, ...extra } }; }
function onlyTime(tree: any) { const times = nodes(tree).filter(n => n.type === 'time'); assert.equal(times.length, 1, 'one known event time'); return times[0]; }
function rowText(row: any) { const b = nodes(row).find(n => String(n.props?.className).split(' ').includes('chat-msg__bubble')); return b?.props.dangerouslySetInnerHTML?.__html || textOf(b); }
test('local socket status scopes connectivity and API identity names the selected target', async () => {
    const h = panel(async () => ({ messages: [] }));
    try {
        h.render(panelProps);
        let tree = await h.settle();
        assert.equal(textOf(only(tree, 'chat-panel__status')), 'MC SOCKET CONNECTED');
        assert.equal(textOf(only(tree, 'chat-panel__agent-name')), 'Rune');
        assert.equal(textOf(only(tree, 'chat-panel__connection-note')), 'Browser-to-Mission-Control connection only; gateway and target availability are unverified.');
        assert.doesNotMatch(textOf(only(tree, 'chat-panel__status')), /ONLINE|OFFLINE|READY/);
        tree = h.render({ ...panelProps, connected: false });
        assert.equal(textOf(only(tree, 'chat-panel__status')), 'MC SOCKET NOT CONNECTED');
        assert.equal(nodes(tree).find(n => n.type === 'input').props.disabled, true);
    }
    finally {
        h.unmount();
    }
});
test('history loading, unavailable, malformed and observed empty are distinct', async (t) => {
    for (const scenario of ['pending', 'rejected', 'missing', 'null', 'empty'])
        await t.test(scenario, async () => {
            const request = deferred<any>();
            const calls: any[] = [];
            const h = panel((...args) => { calls.push(args); return request.promise; });
            try {
                let tree = h.render(panelProps);
                assert.deepEqual(calls, [['main', 40]]);
                if (scenario === 'pending')
                    assert.equal(textOf(only(tree, 'chat-panel__loading')), 'Loading saved history...');
                assert.equal(classNodes(tree, 'chat-panel__empty').length, 0);
                if (scenario === 'pending') {
                    request.resolve({ messages: [] });
                    await h.settle();
                    return;
                }
                if (scenario === 'rejected')
                    request.reject(Error('/private/fixture SECRET'));
                else
                    request.resolve(scenario === 'missing' ? {} : scenario === 'null' ? { messages: null } : { messages: [] });
                tree = await h.settle();
                if (scenario === 'empty') {
                    const empty = textOf(only(tree, 'chat-panel__empty'));
                    assert.ok(empty.includes('No saved messages returned for Rune.'));
                    assert.ok(empty.includes('Local submissions and received events appear here.'));
                }
                else {
                    assert.match(textOf(tree), /Saved history unavailable\./);
                    assert.equal(classNodes(tree, 'chat-panel__empty').length, 0);
                }
                assert.doesNotMatch(textOf(tree), /SECRET|\/private/);
            }
            finally {
                request.resolve({ messages: [] });
                try {
                    await h.settle();
                }
                finally {
                    h.unmount();
                }
            }
        });
});
test('saved times preserve zero and known-first stable order without invented timestamps', async () => {
    const messages = [{ role: 'user', text: 'missing' }, { role: 'user', text: 'invalid', timestamp: 'not-a-date' }, { role: 'user', text: 'range', timestamp: 9e30 }, { role: 'user', text: 'zero', timestamp: 0 }, { role: 'user', text: 'known', timestamp: '2026-10-01T12:00:00.000Z' }];
    const h = panel(async () => ({ messages }));
    try {
        h.render(panelProps);
        let tree = await h.settle();
        const rows = classNodes(tree, 'chat-msg');
        assert.deepEqual(rows.map(rowText), ['known', 'zero', 'missing', 'invalid', 'range']);
        assert.equal(classNodes(tree, 'chat-msg__timestamp').filter(n => textOf(n) === 'Time unknown').length, 3);
        assert.deepEqual(nodes(tree).filter(n => n.type === 'time').map(n => n.props.dateTime), ['2026-10-01T12:00:00.000Z', '1970-01-01T00:00:00.000Z']);
        const before = classNodes(tree, 'chat-msg__timestamp').map(textOf);
        tree = h.render({ ...panelProps, connected: false });
        assert.deepEqual(classNodes(tree, 'chat-msg__timestamp').map(textOf), before);
    }
    finally {
        h.unmount();
    }
});
test('saved local and socket rows retain separate origins, actual submit time and unknown event time', async () => {
    const sent: any[] = [];
    const h = panel(async () => ({ messages: [{ role: 'user', text: 'Saved text', sessionId: 'fixture-session' }] }));
    const props = { ...panelProps, onSend: (v: any) => sent.push(v) };
    try {
        h.render(props);
        let tree = await h.settle();
        assert.match(textOf(tree), /Saved local history/);
        assert.match(textOf(tree), /Time unknown/);
        tree = typeInput(h, ' Local text ');
        const start = Date.now();
        submit(tree);
        const end = Date.now();
        await new Promise(resolve => setTimeout(resolve, 2));
        tree = h.render({ ...props, events: [socket('fixture-run', 'Socket text')] });
        assert.deepEqual(sent, [{ type: 'message', to: 'main', content: 'Local text' }]);
        assert.equal(nodes(tree).find(n => n.type === 'input').props.value, '');
        assert.deepEqual(classNodes(tree, 'chat-msg__provenance').map(textOf), ['Local submission — delivery unconfirmed', 'Saved local history', 'Received via MC socket']);
        assert.equal(classNodes(tree, 'chat-msg').length, 3);
        const localTime = nodes(tree).find(n => n.type === 'time');
        assert.ok(localTime);
        assert.match(textOf(localTime), /^Local time: /);
        assert.ok(Date.parse(localTime.props.dateTime) >= start && Date.parse(localTime.props.dateTime) <= end);
        assert.equal(classNodes(tree, 'chat-msg__timestamp').filter(n => textOf(n) === 'Time unknown').length, 2);
        assert.match(textOf(tree), /Local elapsed estimate:/);
        assert.ok(h.scrolls.length > 0);
        assert.ok(h.scrolls.every(v => v.top === 0 && v.behavior === 'smooth'));
        assert.doesNotMatch(textOf(tree), /fixture-session/);
    }
    finally {
        h.unmount();
    }
});
test('sidebar retains every ID, resolves all display fallbacks and selects main without creating a session', async () => {
    const selected: any[] = [];
    let reads = 0;
    const h = sidebar(async () => { reads++; return { messages: [] }; });
    try {
        let tree = h.render({ agents: roster, selected: 'visitor', onSelect: (id: any) => selected.push(id) });
        const buttons = classNodes(tree, 'chat-sidebar__agent');
        assert.equal(buttons.length, 16);
        assert.equal(buttons[0].key, 'visitor');
        for (const name of ['Rune', 'Named Target', 'visitor'])
            assert.ok(buttons.some(n => textOf(n).includes(name)), name);
        assert.ok(classNodes(tree, 'chat-sidebar__role').every(n => textOf(n).startsWith('Catalog role: ')));
        click(tree, 'Select main target');
        assert.deepEqual(selected, ['main']);
        assert.equal(reads, 0);
        tree = h.render({ agents: [{ id: 'named', name: 'Named Target', modelIdentity: { provenance: 'observed_session' } }], selected: 'named', onSelect() { } });
        assert.equal(classNodes(tree, 'chat-sidebar__agent').length, 1);
        assert.doesNotMatch(textOf(tree), /observed_session|ONLINE|READY/);
    }
    finally {
        h.unmount();
    }
});
test('sidebar history preserves successful previews, identities, unknown times and failure counts', async () => {
    const requests = new Map(['main', 'named', 'visitor', 'koda'].map(id => [id, deferred<any>()]));
    const calls: any[] = [];
    const h = sidebar((id, limit) => { calls.push([id, limit]); return requests.get(id)!.promise; });
    try {
        let tree = h.render({ agents: [roster[0], { id: 'named', name: 'Named Target' }, { id: 'visitor' }, { id: 'koda' }], selected: 'main', onSelect() { } });
        click(tree, 'HISTORY');
        h.render();
        requests.get('main')!.resolve({ messages: [{ text: 'main missing' }] });
        requests.get('named')!.resolve({ messages: [{ text: 'named invalid', timestamp: 'not-a-date' }] });
        requests.get('visitor')!.reject(Error('SECRET'));
        requests.get('koda')!.resolve({ messages: [{ text: 'known', timestamp: 0 }] });
        tree = await h.settle();
        assert.deepEqual(calls, [['main', 1], ['named', 1], ['visitor', 1], ['koda', 1]]);
        assert.match(textOf(tree), /Saved local history for listed targets\./);
        assert.match(textOf(tree), /Saved history unavailable for 1 of 4 targets\./);
        assert.deepEqual(classNodes(tree, 'chat-sidebar__session-title').map(textOf), ['Koda', 'Rune', 'Named Target']);
        assert.equal(classNodes(tree, 'chat-sidebar__session-meta').filter(n => textOf(n) === 'Time unknown').length, 2);
        assert.doesNotMatch(textOf(tree), /No saved messages returned|SECRET/);
    }
    finally {
        for (const r of requests.values())
            r.resolve({ messages: [] });
        try {
            await h.settle();
        }
        finally {
            h.unmount();
        }
    }
});
test('sidebar history distinguishes all-empty, all-failed, malformed and zero-roster outcomes', async (t) => {
    for (const scenario of ['empty', 'failed', 'malformed', 'zero'])
        await t.test(scenario, async () => {
            const h = sidebar(async () => { if (scenario === 'failed')
                throw Error('SECRET'); return scenario === 'malformed' ? { messages: null } : { messages: [] }; });
            try {
                let tree = h.render({ agents: scenario === 'zero' ? [] : [{ id: 'visitor' }], error: scenario === 'zero' ? 'SECRET' : null, selected: 'main', onSelect() { }, loading: false });
                click(tree, 'HISTORY');
                h.render();
                tree = await h.settle();
                if (scenario === 'empty')
                    assert.match(textOf(tree), /No saved messages returned for listed targets\./);
                else {
                    assert.match(textOf(tree), scenario === 'zero' ? /Agent list unavailable\./ : /Saved history unavailable for 1 of 1 targets\./);
                    assert.doesNotMatch(textOf(tree), /No saved messages returned/);
                }
                assert.doesNotMatch(textOf(tree), /SECRET/);
            }
            finally {
                h.unmount();
            }
        });
});
test('roster errors retain targets and never masquerade as a successful empty list', async (t) => {
    for (const scenario of ['retained', 'initial', 'empty', 'loading'])
        await t.test(scenario, async () => {
            const h = sidebar(async () => ({ messages: [] }));
            try {
                const tree = h.render({ agents: scenario === 'retained' ? roster : [], selected: 'main', onSelect() { }, error: ['retained', 'initial'].includes(scenario) ? 'SECRET' : null, loading: scenario === 'loading' });
                if (scenario === 'retained') {
                    assert.equal(classNodes(tree, 'chat-sidebar__agent').length, 16);
                    assert.match(textOf(tree), /Agent list unavailable; showing last loaded targets\./);
                }
                if (scenario === 'initial')
                    assert.match(textOf(tree), /Agent list unavailable\./);
                if (scenario === 'empty')
                    assert.match(textOf(tree), /No targets in the last roster response\./);
                else
                    assert.doesNotMatch(textOf(tree), /No targets in the last roster response/);
                assert.doesNotMatch(textOf(tree), /SECRET/);
            }
            finally {
                h.unmount();
            }
        });
});
test('page shares roster identity and error, preserves query selection and progress callback', async () => {
    const ChatSidebar = () => null, ChatPanel = () => null, LiveProgressPanel = () => null, GlitchText = () => null;
    const query = new URLSearchParams('agent=visitor');
    let polling: any = { data: roster, error: 'SECRET', loading: false };
    let pollingCalls = 0, wsCalls = 0;
    const agents = () => Promise.resolve(roster);
    const send = () => { };
    const events: any[] = [];
    const h = harness('../src/pages/Chat.tsx', 'Chat', {
        '../lib/api': { api: { agents } }, '../hooks/usePolling': { usePolling: (fn: any, ms: number) => { assert.equal(fn, agents); assert.equal(ms, 60000); pollingCalls++; return polling; } },
        '../hooks/useWebSocket': { useWebSocket: (...args: any[]) => { assert.deepEqual(args, []); wsCalls++; return { messages: events, connected: true, send }; } },
        'react-router-dom': { useSearchParams: () => [query] }, '../components/ChatSidebar': { ChatSidebar }, '../components/ChatPanel': { ChatPanel }, '../components/LiveProgressPanel': { LiveProgressPanel }, '../components/GlitchText': { GlitchText },
    });
    const child = (tree: any, type: any) => nodes(tree).find(n => n.type === type);
    try {
        let tree = h.render();
        assert.equal(child(tree, ChatPanel).props.selectedAgent, 'visitor');
        assert.equal(child(tree, ChatSidebar).props.error, 'SECRET');
        assert.equal(child(tree, ChatPanel).props.selectedAgentData.id, 'visitor');
        assert.equal(child(tree, ChatPanel).props.onSend, send);
        assert.equal(child(tree, ChatPanel).props.events, events);
        const notice = only(tree, 'chat-page__notice');
        assert.equal(textOf(notice), 'Targets include catalog defaults and recorded agents. Catalog roles describe defaults; availability is unverified.');
        assert.ok(!nodes(only(tree, 'chat-page__layout')).includes(notice));
        child(tree, ChatSidebar).props.onSelect('main');
        tree = h.render();
        click(tree, 'Show Progress');
        tree = h.render();
        assert.equal(child(tree, LiveProgressPanel).props.agentName, 'Rune');
        assert.equal(child(tree, ChatPanel).props.selectedAgentData.identityName, 'Rune');
        child(tree, ChatSidebar).props.onSelect('named');
        tree = h.render();
        assert.equal(child(tree, LiveProgressPanel).props.agentName, 'Named Target');
        child(tree, ChatSidebar).props.onSelect('absent');
        tree = h.render();
        assert.equal(child(tree, LiveProgressPanel).props.agentName, 'absent');
        assert.equal(child(tree, ChatPanel).props.selectedAgentData, undefined);
        assert.ok(pollingCalls > 0 && wsCalls > 0);
        child(tree, LiveProgressPanel).props.onClose();
        tree = h.render();
        assert.equal(child(tree, LiveProgressPanel), undefined);
        polling = { data: null, error: 'SECRET', loading: false };
        tree = h.render();
        assert.deepEqual(child(tree, ChatSidebar).props.agents, []);
        assert.equal(child(tree, ChatSidebar).props.error, 'SECRET');
    }
    finally {
        h.unmount();
    }
});
test('target switching cancels old saved-history success and failure without transient attribution', async (t) => {
    for (const outcome of ['success', 'failure', 'previously-ready'])
        await t.test(outcome, async () => {
            const a = deferred<any>(), b = deferred<any>();
            const h = panel(id => id === 'main' ? a.promise : b.promise);
            try {
                h.render(panelProps);
                if (outcome === 'previously-ready') {
                    a.resolve({ messages: [{ role: 'user', text: 'A saved' }] });
                    assert.match(textOf(await h.settle()), /A saved/);
                }
                const next = { ...panelProps, selectedAgent: 'visitor', selectedAgentData: { id: 'visitor' } };
                let tree = h.renderBeforeEffects(next);
                assert.doesNotMatch(textOf(tree), /A saved/);
                tree = h.render(next);
                assert.doesNotMatch(textOf(tree), /A saved/);
                assert.equal(classNodes(tree, 'chat-panel__empty').length, 0);
                b.resolve({ messages: [{ role: 'user', text: 'B saved' }] });
                tree = await h.settle();
                assert.match(textOf(tree), /B saved/);
                if (outcome === 'failure')
                    a.reject(Error('SECRET'));
                else
                    a.resolve({ messages: [{ role: 'user', text: 'A saved' }] });
                tree = await h.settle();
                assert.match(textOf(tree), /B saved/);
                assert.doesNotMatch(textOf(tree), /A saved|Saved history unavailable|SECRET/);
            }
            finally {
                a.resolve({ messages: [] });
                b.resolve({ messages: [] });
                try {
                    await h.settle();
                }
                finally {
                    h.unmount();
                }
            }
        });
});
test('sidebar discards old batches after roster or view changes', async (t) => {
    for (const change of ['roster', 'view'])
        await t.test(change, async () => {
            const old = deferred<any>(), fresh = deferred<any>();
            let calls = 0;
            const h = sidebar(() => ++calls === 1 ? old.promise : fresh.promise);
            const props = { agents: [{ id: 'main', identityName: 'Rune' }], selected: 'main', onSelect() { } };
            try {
                let tree = h.render(props);
                click(tree, 'HISTORY');
                tree = h.render();
                if (change === 'view') {
                    click(tree, 'AGENTS');
                    tree = h.render();
                    click(tree, 'HISTORY');
                    tree = h.render();
                }
                else
                    tree = h.render({ ...props, agents: [{ id: 'named', name: 'Named Target' }] });
                assert.equal(classNodes(tree, 'chat-sidebar__session').length, 0);
                fresh.resolve({ messages: [{ text: 'Fresh preview' }] });
                tree = await h.settle();
                assert.match(textOf(tree), /Fresh preview/);
                old.reject(Error('SECRET'));
                tree = await h.settle();
                assert.match(textOf(tree), /Fresh preview/);
                assert.doesNotMatch(textOf(tree), /Saved history unavailable|SECRET/);
            }
            finally {
                old.resolve({ messages: [] });
                fresh.resolve({ messages: [] });
                try {
                    await h.settle();
                }
                finally {
                    h.unmount();
                }
            }
        });
});
test('composer gates socket and trimmed input; failed reads preserve selected local/socket rows', async () => {
    const request = deferred<any>(), sent: any[] = [];
    const h = panel(() => request.promise);
    const props = { ...panelProps, onSend: (v: any) => sent.push(v) };
    try {
        h.render({ ...props, connected: false });
        let tree = typeInput(h, ' blocked ');
        submit(tree);
        assert.deepEqual(sent, []);
        tree = h.render(props);
        tree = typeInput(h, '   ');
        assert.equal(nodes(tree).find(n => n.type === 'button').props.disabled, true);
        submit(tree);
        assert.deepEqual(sent, []);
        tree = typeInput(h, '**local**');
        assert.equal(nodes(tree).find(n => n.type === 'button').props.disabled, false);
        submit(tree);
        tree = h.render({ ...props, events: [socket('run', '**stream**', { state: 'delta' }), socket('other', 'Wrong target', { sessionKey: 'agent:visitor:main' }), socket('run', '**final**')] });
        request.reject(Error('SECRET'));
        tree = await h.settle();
        assert.match(textOf(tree), /Saved history unavailable\./);
        assert.deepEqual(sent, [{ type: 'message', to: 'main', content: '**local**' }]);
        assert.equal(classNodes(tree, 'chat-msg').length, 2);
        assert.doesNotMatch(textOf(tree), /Wrong target|SECRET/);
        const socketRows = classNodes(tree, 'chat-msg').filter(n => textOf(n).includes('Received via MC socket'));
        assert.equal(socketRows.length, 1);
        assert.match(rowText(socketRows[0]), /<strong>final<\/strong>/);
        assert.ok(classNodes(tree, 'chat-msg').some(n => rowText(n) === '**local**'));
        tree = h.renderBeforeEffects({ ...props, selectedAgent: 'visitor', selectedAgentData: { id: 'visitor' }, events: [socket('run', '**final**')] });
        assert.doesNotMatch(textOf(tree), /\*\*local\*\*|Received via MC socket/);
    }
    finally {
        request.resolve({ messages: [] });
        try {
            await h.settle();
        }
        finally {
            h.unmount();
        }
    }
});
test('saved tool and assistant roles retain tools and rendered markdown', async () => {
    const h = panel(async () => ({ messages: [{ role: 'toolResult', text: '**tool result**', toolName: 'Read' }, { role: 'assistant', text: '**answer**' }] }));
    try {
        h.render(panelProps);
        const tree = await h.settle();
        assert.equal(classNodes(tree, 'chat-msg--toolResult').length, 1);
        assert.equal(classNodes(tree, 'chat-msg--assistant').length, 1);
        assert.equal(textOf(only(tree, 'chat-msg__tool')), 'Read');
        assert.deepEqual(classNodes(tree, 'chat-msg').map(rowText), ['<p><strong>tool result</strong></p>\n', '<p><strong>answer</strong></p>\n']);
    }
    finally {
        h.unmount();
    }
});
test('panel name fallback agrees with roster precedence even when the query ID is absent', async (t) => {
    for (const [id, target, want] of [
        ['main', { id: 'main', identityName: 'Rune', name: 'Configured' }, 'Rune'],
        ['main', { id: 'main', name: 'Configured' }, 'Configured'], ['main', undefined, 'Arya'], ['visitor', undefined, 'visitor'],
    ] as const)
        await t.test(want, async () => {
            const h = panel(async () => ({ messages: [] }));
            try {
                h.render({ ...panelProps, selectedAgent: id, selectedAgentData: target });
                const tree = await h.settle();
                assert.equal(textOf(only(tree, 'chat-panel__agent-name')), want);
            }
            finally {
                h.unmount();
            }
        });
});
test('socket time zero remains known while invalid and absent event times remain unknown across rerenders', async () => {
    const h = panel(async () => ({ messages: [] }));
    const props = { ...panelProps, events: [socket('zero', 'zero', { message: { role: 'assistant', timestamp: 0, content: [{ text: 'zero' }] } }), socket('missing', 'missing'), socket('invalid', 'invalid', { message: { role: 'assistant', timestamp: 'not-a-date', content: [{ text: 'invalid' }] } })] };
    try {
        h.render(props);
        let tree = await h.settle();
        assert.deepEqual(classNodes(tree, 'chat-msg').map(rowText), ['<p>zero</p>\n', '<p>missing</p>\n', '<p>invalid</p>\n']);
        assert.equal(onlyTime(tree).props.dateTime, '1970-01-01T00:00:00.000Z');
        assert.equal(classNodes(tree, 'chat-msg__timestamp').filter(n => textOf(n) === 'Time unknown').length, 2);
        const before = classNodes(tree, 'chat-msg__timestamp').map(textOf);
        tree = h.render({ ...props, connected: false });
        assert.deepEqual(classNodes(tree, 'chat-msg__timestamp').map(textOf), before);
    }
    finally {
        h.unmount();
    }
});
test('history previews keep every listed target and their selection callback', async () => {
    const selected: string[] = [];
    const h = sidebar(async (id) => ({ messages: [{ text: 'Returned preview for ' + id }] }));
    try {
        let tree = h.render({ agents: roster, selected: 'main', onSelect: (id: string) => selected.push(id) });
        click(tree, 'HISTORY');
        h.render();
        tree = await h.settle();
        assert.equal(classNodes(tree, 'chat-sidebar__session').length, 16);
        const titles = classNodes(tree, 'chat-sidebar__session-title').map(textOf);
        for (const want of ['Rune', 'Named Target', 'visitor'])
            assert.ok(titles.includes(want), want);
        const visitor = classNodes(tree, 'chat-sidebar__session').find(row => textOf(row).includes('Returned preview for visitor'));
        assert.ok(visitor);
        visitor.props.onClick();
        tree = h.render();
        assert.deepEqual(selected, ['visitor']);
        assert.equal(classNodes(tree, 'chat-sidebar__agent').length, 16);
        assert.equal(classNodes(tree, 'chat-sidebar__sessions').length, 0);
    }
    finally {
        h.unmount();
    }
});
