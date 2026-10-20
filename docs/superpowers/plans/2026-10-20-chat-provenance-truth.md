# Chat provenance truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Root adopted this plan from preserved ignored candidate e75c3952; Root selected `fix/chat-provenance-truth-20261020` at `0f475206bb305524c2094b7592a53db70352eac4`; Root alone owns delivery/build/rollout; its task brief is the implementation dispatch.

**Goal:** Preserve Chat's targets and controls while accurately distinguishing local socket connectivity, catalog metadata, saved history, local submissions, received events, unknown times and unavailable reads.

**Architecture:** Correct presentation and read-state handling at existing React boundaries. A small pure helper provides identical identity and timestamp resolution to the page/sidebar/panel; existing API, WebSocket, gateway, sending and progress contracts remain intact. One task covers the inseparable identity/read-state/provenance correction and its component and maintained fixture contracts.

**Tech Stack:** Existing React 19, TypeScript, date-fns, marked/DOMPurify, node:test/tsx, existing maintained Playwright fixture; no dependency changes.

**Spec:** `docs/superpowers/specs/2026-10-19-operator-workspace-design.md`, approved outcomes 1 (truth and shared identities), 2 (retain technical destinations), 3 (readability) and 5 (source-owned regression). Prior bounded analysis: `.superpowers/sdd/2026-10-20-live-page-adjacent/chat-provenance-readonly-proposal-v1.md`, SHA256 `08c459133fcea81a4633f1742bfa21f762fa2c64161ead3bba04f41401653659`. Paths below are relative to sole writer `/Users/setrox/ai/setrox/.worktrees/mission-control-operator-workspace-20261019-v1`.

## Global Constraints

Copied verbatim from the approved design:

- Root alone stages, commits, pushes and delivers. Only one implementation worker per repository at a time; disjoint repository work may proceed in parallel with frozen shared contracts and Root-serialized delivery. Writers are the selected linked worktrees. Do not build/edit the current live MC checkout during implementation.
- Live ports remain 3080/3333/18789. No provider calls, live state mutation or service restart for unit/UI fixtures. No new external dependency unless a concrete source need is established.
- Preserve failed/cancelled records, all runtime/secret/admission guards and current DB authority. No generic shell runner or guard bypass. No published migration changes. ACL/credential effects require their own bounded authority audit.
- The existing English source contract and English product copy remain. Turkish design terms are semantic labels, implemented with English equivalents; compiler prompts remain English. Secret values, private absolute paths and raw logs never enter client bundles/evidence responses.
- Unknown is explicit, not numeric zero. HTTP health, six preflight passes and partial tests never mean full8 GO. Model schema evidence is dated, not a pricing/quality promise.
- Preserve existing scratch/evidence/worktrees; no broad cleanup. Three test/agent crons require source-backed purpose confirmation before any reversible disable.

Additional execution constraints:

- Use physical provisioned Node `/opt/homebrew/Cellar/node@22/22.23.1/bin/node` and prepend its directory to PATH for child commands; no ambient Node substitution or install.
- Preserve the 8,589,934,592-byte free-space floor before native/heavy work, existing admission checks, original process ownership/exit/close/stdout EOF/stderr EOF and native fixture cleanup. Point samples do not prove continuous compliance.
- Root releases only this isolated MC Source implementation task; live services and SF Source remain frozen. Verification is local component/contract/type checking, with no live effects. Builds/native/runtime effects require separate current owner/resource gates.
- Retain all 317 assertion IDs/order, 20 routes, three widths (390/768/1440), 48 RunDetail tab assertions, 29 behavior IDs and all current geometry/font/console/network thresholds. Preserve six-route render smoke. No swallowed failures or new skips.
- Unit component execution below simulates React lifecycle/ports; it is not mounted React, browser, gateway/provider, delivery or live qualification. Native qualification uses the existing maintained owned runner only; no ad hoc browser lifecycle.
- User approval for the bounded operator audit/fixes and standing authorization apply to this causal correction. Do not create another approval menu. Separate bridge-readiness/delivery protocol changes remain outside this task.

## Evidence, assumptions and approach decision

Initial writer inspection found clean Office HEAD `bb03f60788a37b66e00102c78905729ed717f6e9`. During preparation Root verified PR39 merged on GitHub, synchronized main and selected clean `fix/chat-provenance-truth-20261020`. Final read-only inspection confirms HEAD/local origin/main `0f475206bb305524c2094b7592a53db70352eac4`, tree `1e3daa1b80cea48fddf1844dee0c46d1313e8d07`, equal to the prior Office tree, and clean tracked status. All pinned Source files remain unchanged. This preparation did not fetch; remote verification is Root evidence. Root handoff `updatedAtUTC=2026-10-20T00:08:47.283422+00:00` is older than these supplied writer facts; it is not used to override current owner evidence.

The prior retained UI observation reported Arya ONLINE with GATEWAY UNKNOWN, without sending a message. Current Source establishes that `useWebSocket.connected` becomes true on browser `/ws` open; upstream connection/authentication is separately handled inside `server/ws-proxy.ts`. `StatusBar` uses a dashboard HTTP projection. Neither zero Setfarm runs nor UNKNOWN establishes agent/gateway outage. No actual failed delivery is claimed.

Actual Source also establishes: Chat already resolves identityName/name/catalog/id for its progress panel, but sidebar/panel/history use inconsistent subsets; roster polling error is discarded; history errors are swallowed; both sidebar and panel fabricate history timestamps; WS timestamps may fall back to the time of a rerender. The history API reads up to three local JSONL files and returns a bounded message slice. A successful empty response establishes only that the response returned no saved messages, not that no conversation ever existed. API model provenance establishes model evidence only, not roster membership, role ownership or availability.

| Approach | Decision and consequence |
|---|---|
| Existing-data presentation and read-state truth | Recommended. No new server contracts; all targets remain; errors and unknown data become explicit. Does not repair or prove delivery. |
| Bridge readiness, correlation and acknowledgements | Defer. Requires proxy/hook protocol, upstream auth/send gating, receipt/error semantics and separate tests; unnecessary for the approved presentation correction. |
| Hide catalog defaults or force OFFLINE from UNKNOWN/zero runs | Reject. Loses technical targets and invents outage evidence. |

Assumptions: history response `messages` must be an array to establish an observed result; a malformed successful payload is unavailable. Existing server role interpretation, text extraction, session selection, truncation and event routing are unchanged. Local submission time is a valid browser observation; saved/event timestamps are unknown unless present and valid. Catalog roles remain catalog metadata. No per-row observed/configured/catalog badges are inferred from modelIdentity or the existing row source string.

## File Map

| Action | Exact path | Responsibility |
|---|---|---|
| Create | `src/lib/chat-presentation.ts` | Pure common target display and timestamp/order helpers; no IO. |
| Modify | `src/pages/Chat.tsx` | Pass roster error and selected target identity; persistent catalog caveat; preserve query target/progress. |
| Modify | `src/components/ChatSidebar.tsx` | Consistent identity; accurate main action; observed empty vs partial/total unavailable history; unknown preview times. |
| Modify | `src/components/ChatPanel.tsx` | Local socket wording; keyed history read state; explicit row origins/times; preserve composer/events/local scrolling. |
| Modify | `src/index.css` | Only Chat wrapping/notes/provenance styles required by longer truthful copy; maintain readable 14px text and composer containment. This is the stylesheet imported by main.tsx. |
| Create | `tests/chat-provenance.test.ts` | Actual Source component callbacks/state with generic lifecycle ports; no copied product logic or network. `.test.ts` is selected by existing npm test glob. |
| Modify | `scripts/ui-regression-fixtures.mjs` | Existing Chat loaded-copy/status expectations; preserve catalog and acceptance thresholds. |
| Modify | `tests/ui-regression-contract.test.ts` | Normal matching doubles, actual loaded callback negative cases, actual Chat scroll test dependency/state wiring. |

No changes to `api.ts`, shared Agent/model types, `useWebSocket.ts`, `usePolling.ts`, `server/ws-proxy.ts`, agent/history producers, StatusBar, services, packages, fixture data or runtime guards. Root later adopts this candidate as a tracked plan. No duplicate legacy `src/styles/*` edits: actual main imports `src/index.css`.

### Task 1: Make Chat's displayed evidence truthful

**Files:** All eight File Map paths, plus Root's tracked adopted plan.

**Interfaces — existing inputs retained:**

- `api.agents(): Promise<Agent[]>`, `usePolling(api.agents, 60000)` returns `{data, error, loading, refresh}`. Use retained data plus error; no new polling or API request.
- `api.agentHistory(id: string, limit?: number): Promise<{messages: any[]}>`; panel limit 40, sidebar limit 1 remain.
- `useWebSocket()` returns `{messages, connected, send, clearMessages}`; `connected` remains local socket only. Keep default enabled and existing send object `{type:'message', to:selectedAgent, content:text}`.
- Query `?agent=...`, `onSelect(id)`, progress toggle and `LiveProgressPanel` keep their current behavior. Main selection is `onSelect('main')`, without clearing messages or creating a session.

**Interfaces — local additions:**

```ts
// src/lib/chat-presentation.ts
import { AGENT_MAP } from './constants';
export interface ChatTarget {
  id: string;
  identityName?: string;
  name?: string;
  identityEmoji?: string;
}
export function chatTargetDisplay(id: string, target?: ChatTarget) {
  const meta = AGENT_MAP[id];
  return {
    name: target?.identityName || target?.name || meta?.name || id,
    emoji: target?.identityEmoji || meta?.emoji || '?',
  };
}
export function chatTimestamp(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const ms = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(ms) && Number.isFinite(new Date(ms).getTime()) ? ms : null;
}
export function newestKnownChatTime(a: {ts: number | null}, b: {ts: number | null}): number {
  if (a.ts === null) return b.ts === null ? 0 : 1;
  if (b.ts === null) return -1;
  return b.ts - a.ts;
}
```

- Sidebar props become `agents: ChatTarget[]`, existing selected/onSelect/loading, and optional `error?: string | null`. Do not display raw error text.
- Panel adds optional `selectedAgentData?: ChatTarget`. It uses the common helper so fallback still works when the selected query ID is absent from the roster. Page passes the found target. Progress uses the same display result.
- Panel `ChatMessage.ts: number | null`, `origin: 'saved'|'local'|'socket'`, optional `sessionId?: string`. Existing role/tool/done/responseMs fields remain. Session ID can be retained in state without exposing a path or claiming current session identity.
- Panel uses one keyed history snapshot `{agentId:string, status:'loading'|'ready'|'unavailable', messages:ChatMessage[]}`. Derive the visible snapshot only when `snapshot.agentId === selectedAgent`; otherwise show loading, never the old target's history. Preserve effect cancellation on response and failure. Local/WS messages stay visible when history is unavailable.
- Sidebar history observation holds `{previews:HistoryPreview[], failed:number, attempted:number, status:'loading'|'ready'}`. Each preview has nullable `lastTimestamp`. Keep cancellation for agent list/view changes; ignore old settled batches.

**Exact presentation requirements:**

| Surface | Required English copy / behavior |
|---|---|
| Status | `MC SOCKET CONNECTED` / `MC SOCKET NOT CONNECTED`; never agent ONLINE/OFFLINE/READY. |
| Local connection note | `Browser-to-Mission-Control connection only; gateway and target availability are unverified.` Visible, not only a tooltip. |
| Page catalog note | `Targets include catalog defaults and recorded agents. Catalog roles describe defaults; availability is unverified.` Persistent above the layout at every width. |
| Main button | `Select main target`; same onSelect('main'), no reset/create/send. Keep selector class for CSS compatibility. |
| Role | Existing text prefixed `Catalog role: ` where currently displayed. Do not replace roles with model provenance. |
| Roster failure, no data | `Agent list unavailable.` No successful-empty statement. |
| Roster failure, retained data | `Agent list unavailable; showing last loaded targets.` Keep every retained target. |
| Successful roster empty | `No targets in the last roster response.` Only when !loading && !error && agents.length === 0. |
| Panel loading | `Loading saved history...` |
| Panel read error | `Saved history unavailable.` Visible even if local or socket messages exist. No private error details. |
| Panel observed empty | `No saved messages returned for {name}.` and `Local submissions and received events appear here.` Only if history is ready and combined selected messages are empty. |
| History tab explanation | `Saved local history for listed targets.` No live-session claim. |
| Sidebar partial failure | `Saved history unavailable for {failed} of {attempted} targets.` Show successful previews alongside it. |
| Sidebar successful empty | `No saved messages returned for listed targets.` Only after all attempted reads succeeded and at least one target was attempted. With zero roster targets use roster state, not this message. |
| Row provenance | saved: `Saved local history`; local: `Local submission — delivery unconfirmed`; socket: `Received via MC socket`. No ACK/delivered/online claim. |
| Time | Missing/invalid saved/event timestamps: `Time unknown`. Valid timestamps use an ISO `<time dateTime=...>` with visible localized value. Local row uses actual submit time, labeled `Local time`. Unknown history preview uses `Time unknown`; valid preview retains date-fns relative time. |
| Existing response duration | Retain responseMs behavior if displayed but qualify as `Local elapsed estimate: {formatted}`; it is not a gateway/server latency or correlated ACK. |

Do not infer source event time from receipt or rerender time. Preserve known-time newest-first sort and local `scrollTo({top:0,behavior:'smooth'})`; put unknown-time rows after known-time rows with stable input order. Their relative chronology is unverified. Existing event agent/run matching, final/delta coalescing and markdown sanitization remain unchanged. Do not deduplicate local/socket/history messages into a delivery claim.

- [ ] **Step 1: Add an actual Source component harness and failing cases.**

Create `tests/chat-provenance.test.ts`. Follow the existing actual Source closure tests, but use a generic slot/effect harness rather than hardcoded product state indices. Transpile the entire current component module as CommonJS and inject only imported ports; never copy the component function into the test or implement a second version of history/identity/provenance logic. Use real React element creation, real JSX runtime and actual shared constants. A module loader for the future pure helper reads its actual Source once it exists; baseline components do not import it. Product execution errors are failures, not skipped tests.

The following is the concrete harness contract and implementation core:

```ts
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
  let resolve!: (value:T)=>void, reject!: (reason:Error)=>void;
  const promise = new Promise<T>((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
function nodes(node:any): any[] {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node,...nodes(node.props?.children)];
}
function textOf(node:any): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  return textOf(node.props?.children);
}
function classNodes(tree:any, name:string) {
  return nodes(tree).filter(n=>String(n.props?.className || '').split(' ').includes(name));
}
function only(tree:any, className:string) {
  const found=classNodes(tree,className); assert.equal(found.length,1,className); return found[0];
}
function harness(file:string, exported:string, ports:Record<string,any>) {
  const slots:any[]=[]; const effects = new Map<number, {deps:any[],cleanup?:()=>void}>();
  let cursor=0, dirty=false, pending:{index:number,run:()=>any,deps:any[]}[]=[];
  let props:any, output:any; const scrolls:any[]=[];
  const changed=(a:any[]|undefined,b:any[])=>!a || a.length!==b.length || b.some((v,i)=>!Object.is(v,a[i]));
  const hooks={...React,
    useState(initial:any){const i=cursor++;if(!(i in slots)) slots[i]=typeof initial==='function'?initial():initial;
      return [slots[i],(next:any)=>{const v=typeof next==='function'?next(slots[i]):next;if(!Object.is(v,slots[i])) {slots[i]=v;dirty=true;}}];},
    useRef(initial:any){const i=cursor++;return slots[i]??={current:initial};},
    useMemo(fn:()=>any,deps:any[]){const i=cursor++;if(changed(slots[i]?.deps,deps))slots[i]={deps:[...deps],value:fn()};return slots[i].value;},
    useEffect(run:()=>any,deps:any[]){const i=cursor++;if(changed(effects.get(i)?.deps,deps))pending.push({index:i,run,deps:[...deps]});},
  };
  function load(path:string):any {
    const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{
      compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},
    }).outputText;
    const mod={exports:{} as any};
    const read=(id:string):any=>{
      if (id==='react') return hooks;
      if (id in ports) return ports[id];
      if (id==='../lib/constants' || id==='./constants') return {AGENT_MAP,AGENTS};
      if (id==='../lib/chat-presentation') return load('../src/lib/chat-presentation.ts');
      if (id==='react/jsx-runtime' || id==='date-fns' || id==='marked') return require(id);
      if (id==='dompurify') return {sanitize:(s:string)=>s}; // not a sanitizer qualification
      throw Error('Unbound component import: '+id);
    };
    new Function('require','module','exports',code)(read,mod,mod.exports);
    return mod.exports;
  }
  const Component=load(file)[exported];
  function render(next=props) {
    props=next;
    for(let pass=0;pass<20;pass++) {
      dirty=false;cursor=0;pending=[];output=Component(props);
      for(const node of nodes(output)) if(node.props?.ref && typeof node.props.ref==='object')
        node.props.ref.current={scrollTo:(v:any)=>scrolls.push(v),scrollIntoView:()=>assert.fail('ancestor scroll')};
      for(const e of pending){effects.get(e.index)?.cleanup?.();const cleanup=e.run();effects.set(e.index,{deps:e.deps,cleanup:typeof cleanup==='function'?cleanup:undefined});}
      if(!dirty)return output;
    }
    throw Error('Component did not settle');
  }
  return {render,scrolls,async settle(){await tick();return render();},
    unmount(){for(const e of effects.values())e.cleanup?.();effects.clear();}};
}
```

Test ports for panel: `{'../lib/api':{api:{agentHistory:read}}}`. Sidebar uses the same. Page uses fake imported ChatSidebar/ChatPanel/LiveProgressPanel/GlitchText functions as identity markers (the page must really execute and its emitted child props are asserted), plus `usePolling`, `useWebSocket` and `useSearchParams` ports; no live sockets/router timers. Each harness unmounts in `finally`. Real marked can run; fake sanitize only isolates DOM-dependent behavior and cannot qualify XSS sanitization. Existing sanitizer implementation remains.

Write these concrete test cases, each with its own harness and settled promise boundaries:

```ts
const panelProps={events:[],onSend:()=>{},connected:true,selectedAgent:'main',
  selectedAgentData:{id:'main',name:'Configured name',identityName:'Rune',identityEmoji:'R'}};

test('local socket and API identity do not imply agent availability',async()=>{
  const h=harness('../src/components/ChatPanel.tsx','ChatPanel',{'../lib/api':{api:{agentHistory:async()=>({messages:[]})}}});
  try {
    h.render(panelProps);let tree=await h.settle();
    assert.equal(textOf(only(tree,'chat-panel__status')),'MC SOCKET CONNECTED');
    assert.equal(textOf(only(tree,'chat-panel__agent-name')),'Rune');
    assert.match(textOf(tree),/gateway and target availability are unverified/);
    assert.doesNotMatch(textOf(only(tree,'chat-panel__status')),/ONLINE|OFFLINE|READY/);
    tree=h.render({...panelProps,connected:false});
    assert.equal(textOf(only(tree,'chat-panel__status')),'MC SOCKET NOT CONNECTED');
    assert.equal(nodes(tree).find(n=>n.type==='input').props.disabled,true);
  } finally {h.unmount();}
});

test('failed history differs from successful empty and does not expose error details',async()=>{
  const request=deferred<any>();
  const h=harness('../src/components/ChatPanel.tsx','ChatPanel',{'../lib/api':{api:{agentHistory:()=>request.promise}}});
  try {h.render(panelProps);request.reject(Error('/private/fixture SECRET'));
    const tree=await h.settle();assert.match(textOf(tree),/Saved history unavailable\./);
    assert.equal(classNodes(tree,'chat-panel__empty').length,0);assert.doesNotMatch(textOf(tree),/SECRET|\/private/);
  } finally {h.unmount();}
});

test('saved local and socket rows retain separate origins and unknown time',async()=>{
  const sent:any[]=[];
  const h=harness('../src/components/ChatPanel.tsx','ChatPanel',{'../lib/api':{api:{agentHistory:async()=>({messages:[{role:'user',text:'Saved text',sessionId:'fixture-session'}]})}}});
  const props={...panelProps,onSend:(v:any)=>sent.push(v)};
  try {
    h.render(props);let tree=await h.settle();
    assert.match(textOf(tree),/Saved local history/);assert.match(textOf(tree),/Time unknown/);
    nodes(tree).find(n=>n.type==='input').props.onChange({target:{value:' Local text '}});
    tree=h.render();nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
    assert.deepEqual(sent,[{type:'message',to:'main',content:'Local text'}]);
    tree=h.render({...props,events:[{event:'chat',payload:{sessionKey:'agent:main:main',runId:'fixture-run',state:'final',message:{role:'assistant',content:[{text:'Socket text'}]}}}]});
    assert.match(textOf(tree),/Local submission — delivery unconfirmed/);
    assert.match(textOf(tree),/Received via MC socket/);
    assert.equal(classNodes(tree,'chat-msg').length,3);
    assert.ok(h.scrolls.every(v=>v.top===0 && v.behavior==='smooth'));
  } finally {h.unmount();}
});
```

Add the following precise cases using the same harness mechanics (assertions are part of the task, not optional):

1. Successful `{messages:[]}` produces exact new empty guidance; unresolved request shows loading but no empty; `{}` and `{messages:null}` produce unavailable. Missing, invalid (`'not-a-date'`) and out-of-range numeric timestamps produce `Time unknown`; timestamp `0` remains a valid known time. On a saved message with valid time plus unknown saved rows, assert known-time row first and stable unknown input order. Updating unrelated props must not create a new timestamp.
2. Sidebar agents use all 14 AGENTS IDs plus `visitor` and `named`, with API main identityName Rune, named.name Named Target and visitor raw ID fallback. Assert 16 target buttons and selected-first sort; for sidebar and history preview assert Rune/Named Target/raw ID consistently. Main button callback is exactly `['main']`, with no submit or history clearing. Catalog roles and persistent page note are present; no per-row badges are created from fabricated `modelIdentity.provenance` input.
3. Sidebar switch via actual HISTORY button callback, then resolve main preview with missing timestamp, named preview with invalid timestamp, and reject visitor. Assert both previews remain, both unknown times, exact failed/attempted count, no successful-empty claim. Separately all-success-empty gives exact empty; all failure gives unavailable; zero agents + roster error gives unavailable without successful-empty. Resolved known preview sorts before unknown ones.
4. Roster error with retained agents keeps all buttons and displays retained-data warning; initial error has no false empty; page usePolling error is passed into sidebar. Page selectedAgentData is passed to panel and identical resolved display name to progress. Fire actual Show Progress callback and render to prove progress remains; query `?agent=visitor` selects visitor after effect commit without forcing main.
5. Panel target A request pending, select B, settle B success then A success: only B's saved text appears; repeat with late A rejection and ensure B never becomes unavailable. Assert immediately after selecting B no A history text is rendered. Sidebar old batch delayed, change agents/view, settle newest batch then oldest: newest previews/failure count remain. Always settle original deferred promises then unmount.
6. Preserve send disabled while socket false and empty trimmed input; enabled submit still emits exactly one unchanged send object and clears input. A history failure after local/socket rows exist must keep those rows. WS event for another explicit agent remains filtered; delta/final updates of same run remain one row with socket origin. Local history roles/toolName and markdown structure remain.

For table-driven cases, use `await t.test(name, async () => {...})` sequentially; no process/browser/network spawning. Actual component HTML/element output and emitted callbacks are assertions; helpers are tested through their actual consumers. A test that only searches Source text for strings does not qualify.

- [ ] **Step 2: Run causal RED on unchanged product Source; retain original result.**

Run only after Root releases the freeze and dispatches the selected Chat branch:

```bash
PATH=/opt/homebrew/Cellar/node@22/22.23.1/bin:$PATH /opt/homebrew/Cellar/node@22/22.23.1/bin/node --import tsx --test tests/chat-provenance.test.ts
```

Expected behavioral failures include ONLINE versus MC SOCKET CONNECTED, Arya versus Rune, swallowed read error, absent origin labels and unknown-time handling. Require actual component execution before assertions; dependency/import/harness failures are not causal RED. Fix only the harness until the intended failures execute. Root retains complete stdout/stderr, original exit code and process settlement in a fresh capture phase; no test run occurred while writing this plan.

- [ ] **Step 3: Implement shared display and page/sidebar read truth.**

Add the helper exactly as specified above. Page obtains `error: agentsError`, resolves `chatTargetDisplay(selectedAgent, selectedAgentData)`, supplies sidebar error/panel selectedAgentData/progress name, and mounts the page caveat above `.chat-page__layout` without changing its direct Show Progress button selector.

Sidebar uses `chatTargetDisplay` in both sorting and every agents/history row. Keep the IDs supplied by the API intact. Replace label only on the main-selection button. Replace synthetic Date.now and subtraction with nullable parsed time. Render warning strings from state rather than raw errors. A concrete load-body pattern is:

```ts
const results = await Promise.allSettled(agents.map(async agent => {
  const data = await api.agentHistory(agent.id, 1);
  if (!Array.isArray(data?.messages)) throw new Error('CHAT_HISTORY_UNAVAILABLE');
  return {agent, messages:data.messages};
}));
if (cancelled) return;
const previews: HistoryPreview[] = [];
let failed = 0;
for (const result of results) {
  if (result.status === 'rejected') {failed++; continue;}
  const {agent,messages}=result.value;
  const last=messages.at(-1);
  if (!last) continue;
  previews.push({agentId:agent.id,lastMessage:typeof last.text==='string'?last.text.slice(0,80):'',
    lastTimestamp:chatTimestamp(last.timestamp)});
}
previews.sort((a,b)=>newestKnownChatTime({ts:a.lastTimestamp},{ts:b.lastTimestamp}));
setHistoryObservation({status:'ready',previews,failed,attempted:agents.length});
```

Remove the presently unused HistoryPreview.messageCount field; a one-message preview is not whole-history size. Do not claim the API limit-1 slice is the chronologically latest global session; call it a preview of returned saved history. Loading state replaces previous previews while a new batch is in flight, with stale batch cancellation preserved. Render `formatDistanceToNow` only for a finite parsed time; unknown time never reaches date-fns. Retain existing tab/selection semantics.

- [ ] **Step 4: Implement panel keyed read state and message provenance.**

Initialize a history snapshot for selectedAgent/loading; in the selectedAgent effect reset to loading, validate `data.messages`, map saved rows, and set ready/unavailable only when not cancelled. Use `historyState.agentId === selectedAgent` in render and merge so old rows cannot appear under a new target before the effect commits. The core mapping is:

```ts
const saved:ChatMessage[]=data.messages.map((m:HistoryMessage,i:number)=>({
  id:`hist-${i}`,role:m.role==='user'?'user':m.role==='toolResult'?'toolResult':'assistant',
  agent:selectedAgent,text:m.text,done:true,ts:chatTimestamp(m.timestamp),
  toolName:m.toolName,origin:'saved',sessionId:m.sessionId,
}));
```

On local submit take one `const submittedAt=Date.now()` for that actual event and use it for lastUserSendTs/id/ts, adding origin local. Keep optimistic display and explicitly unconfirmed delivery. WS mapping adds origin socket and uses `existing?.ts ?? chatTimestamp(ev.payload.message.timestamp)`; never Date.now as event timestamp. Keep responseMs as existing local elapsed estimate, with the required qualifier. Both per-run and merged arrays sort with newestKnownChatTime; preserve the memo/effect dependency relationship and local scroll. Roles and all existing markdown/tool/thinking branches remain.

Render one provenance span on every actual row and a separate time element. The JSX mapping is:

```tsx
<span className="chat-msg__provenance">{msg.origin === 'saved' ? 'Saved local history'
  : msg.origin === 'local' ? 'Local submission — delivery unconfirmed' : 'Received via MC socket'}</span>
{msg.ts === null ? <span className="chat-msg__timestamp">Time unknown</span>
  : <time className="chat-msg__timestamp" dateTime={new Date(msg.ts).toISOString()}>
      {msg.origin === 'local' ? 'Local time: ' : ''}{new Date(msg.ts).toLocaleString()}
    </time>}
```

Socket status and local-only note are visible in the header. No changing composer enablement based on HTTP gateway status, roster error or history failure. Retain disabled when local socket false. Empty guidance requires ready history and no combined messages. Unavailable notice is independent of the nonempty message list.

- [ ] **Step 5: Add only necessary Chat wrapping styles and update maintained fixture contracts.**

In `src/index.css`, make `.chat-panel__header` wrap with a small gap; `.chat-panel__agent-info` and name use min-width:0/overflow-wrap:anywhere; status max-width:100%/overflow-wrap:anywhere. Add `.chat-panel__connection-note` as a full-width header child, `.chat-page__notice` outside the layout, `.chat-msg__provenance`, `.chat-msg__timestamp`, and shared scoped Chat read-warning styles. Font size remains 14px; semantic dim text uses existing readable color, no opacity reduction or blanket important rules. Make `.chat-msg__header` wrap so provenance/time cannot escape horizontally. The required rule core is:

```css
.chat-panel__header { flex-wrap: wrap; gap: 6px 12px; }
.chat-panel__agent-info { min-width: 0; }
.chat-panel__agent-name, .chat-panel__status { max-width: 100%; overflow-wrap: anywhere; }
.chat-panel__connection-note { flex-basis: 100%; margin: 0; }
.chat-page__notice, .chat-panel__connection-note,
.chat-msg__provenance, .chat-msg__timestamp,
.chat-sidebar__notice, .chat-panel__notice {
  font-size: 14px; color: var(--text-dim); overflow-wrap: anywhere;
}
.chat-page__notice { flex-shrink: 0; margin: 0 0 8px; }
.chat-msg__header { flex-wrap: wrap; }
```

Use the existing constrained flex page/layout/pane/messages/composer sizes. Do not move scrolling to the outer page. Current mobile CSS already hides sidebar history tabs/sessions; this task must not further hide or remove controls and does not claim to repair that separate pre-existing mobile presentation. The persistent catalog note stays outside that hidden region. Root's three-width verification decides if further strictly scoped wrapping is needed; no font threshold reduction.

In `scripts/ui-regression-fixtures.mjs`, change only Chat `loaded` callback required empty strings and accepted statuses:

```js
empty[0].textContent.includes('No saved messages returned for Arya.')
  && empty[0].textContent.includes('Local submissions and received events appear here.');
/^(MC SOCKET CONNECTED|MC SOCKET NOT CONNECTED)$/.test(element.textContent.trim())
```

Extend its expected visible geometry entries with `.chat-panel__connection-note` containing the exact local-only sentence and `.chat-page__notice` containing the exact catalog sentence; keep the existing six controls and all geometry/visibility/uniqueness checks. Actual old ONLINE/OFFLINE must now fail the status contract. Keep the mounted history readiness gate and composer bottom bounds.

In `tests/ui-regression-contract.test.ts`, update withChatWorkflowsLoadedDom and Chat/Workflows loaded callback synthetic DOM to the new exact strings and add visible note nodes. Retain every prior negative case. Add old ONLINE and old OFFLINE cases that must fail, missing/hidden connection-note cases that fail, and keep both exact local statuses passing. Existing malformed READY remains failing. Update the actual Source Chat scroll fixture for the keyed history snapshot, selected target prop and actual helper imports while retaining its mount/history/message phases, sorted message IDs and zero ancestor-scroll assertions. It must execute the real scroll callback; no canned replacement.

The fixture hash is computed from DATA/routes/viewports/tabs/assertionIds, not callback Source. Since this task changes none of those inputs, expected fixtureHash `a4cabf5f40111a12145171e23a06b96cea0f048d94c77d91496553b594ee35b3`, IDs hash `201a110075b92305395b7fadd550f39cf8c9356cda8f9c28dee4a9be05b61fe8`, first316 hash `4ded731c52c60105daa60639aa64683b68d1d3f22e9c3e685bb794b67e8ba88d` and count317 remain unchanged. Do not blindly regenerate constants. A different hash requires inspecting actual inputs and a separate justified plan-map correction, never weakening identity checks. Build/source hashes naturally change and must be freshly measured by Root.

- [ ] **Step 6: Run focused GREEN and type verification; give Root the original results.**

```bash
PATH=/opt/homebrew/Cellar/node@22/22.23.1/bin:$PATH /opt/homebrew/Cellar/node@22/22.23.1/bin/node --import tsx --test tests/chat-provenance.test.ts tests/ui-regression-contract.test.ts tests/use-websocket.test.ts tests/fresh-websocket-runtime-boundaries.test.ts
PATH=/opt/homebrew/Cellar/node@22/22.23.1/bin:$PATH /opt/homebrew/Cellar/node@22/22.23.1/bin/node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
PATH=/opt/homebrew/Cellar/node@22/22.23.1/bin:$PATH /opt/homebrew/Cellar/node@22/22.23.1/bin/node node_modules/typescript/bin/tsc --noEmit -p tsconfig.server.json
git diff --check
```

Run sequentially under the maintained capture process; retain original command/Source pins, complete output and exit/close/EOF settlement. Expected: focused tests pass, type checks exit0 and diff check clean. If source has changed after RED, verify only the exact resulting candidate; no promotion of old captures. Do not run broad npm test where prohibited adjacent owner-sensitive fixtures would be selected. The readonly scope does not require provider sends, fixture data mutation or changes to runtime boundaries. Review every new assertion failure causally; no mirrored implementation assertions.

- [ ] **Step 7: Root review, commit, stock build and maintained native qualification.**

The implementation worker stops with a diff and original verification receipts. Root performs independent task review and branch review, stages the eight scoped paths plus adopted plan, and makes one conventional commit (suggested subject `fix: clarify chat evidence provenance`). Only Root runs the stock build after reviews/clean source and the current runtime/admission gates. With explicit Node PATH the build command is:

```bash
PATH=/opt/homebrew/Cellar/node@22/22.23.1/bin:$PATH /opt/homebrew/Cellar/node@22/22.23.1/bin/node /opt/homebrew/Cellar/node@22/22.23.1/lib/node_modules/npm/bin/npm-cli.js run build
```

The provisioned Node22 npm symlink points to `../lib/node_modules/npm/bin/npm-cli.js`; recheck that existing installation before execution and record its exact physical path. No npm install. Build only in the sole writer/selected clean build context, never the live MC checkout during implementation.

Root then uses the current maintained owned UI regression and six-route smoke admission path, immutable selected build identity and fresh captures. The maintained runner remains responsible for original browser child ownership, native close, original exit/close and pipe EOF, zero-owner closure, fixture servers/sockets, console/network diagnostics and evidence hashes. Do not substitute a bare chromium.launch/close test for its qualification or invent a pass from component simulations. All 317 assertions must retain current meanings; the changed loaded gate proves the new status/notes are visible and the composer is contained at 390/768/1440. If full native qualification is not admitted, record it unrun and continue safe review work; do not claim delivered qualification.

Root alone handles PR delivery, merge/synchronization and guarded rollout after actual prerequisites. After rollout use CUA read-only `/chat` checks: default and a different existing target, consistent displayed names, persistent caveat and local socket badge, History selection and progress toggle, readable composer at three widths. Do not submit a message to a provider to validate this correction. Runtime gateway readiness/delivery and full8 remain separate qualifications.

## Risk and validation ledger

- Long truthful status/notes can crowd mobile Chat. Existing native loaded/overflow checks must remain strict; correct scoped wrapping, never reduce typography or geometry thresholds.
- Unknown timestamps no longer look recent; unknown rows move below known rows. This is intentional and visibly labeled, not a history deletion. Stable ordering preserves source order among unknown entries.
- Agent switching and refreshed roster arrays can race pending reads. Keyed visible history plus cancellation and delayed-response component cases prevent stale target attribution.
- Model provenance cannot establish row availability. No row availability badges are added; catalog note scopes static roles. Static default names remain fallbacks only.
- Optimistic local submit can still be silently dropped by existing bridge behavior. This task explicitly labels it unconfirmed and makes no delivery claim; proxy behavior is not altered.
- The successful API response itself is best-effort bounded history. Copy says returned saved messages, never total conversation or current session. No new API completeness claim.
- Synthetic lifecycle component checks qualify actual callback/read-state behavior, not real React scheduling, visual geometry or network delivery. Root's maintained native and read-only live checks are distinct evidence.
- Existing mobile sidebar hides HISTORY. Preserve current functionality; this unrelated pre-existing responsive issue is reported to Root, not silently solved by a broader redesign or counted as resolved here.

## Preparation self-review and limit

- Spec coverage: truth/identities → task steps3–4; retained targets/history/composer/progress/query → steps1/3/4 tests; English/readability → exact copy/step5; source-owned regression/three widths → steps5–7. Other approved operator outcomes are already separate work, not missing Chat tasks.
- Single-task rationale: identity, history read semantics and message provenance share the same rendered component contract and fixture loaded state; splitting produces transient inconsistent claims. No independently deliverable server/protocol subsystem is included.
- Types: ChatTarget is structural and accepts current Agent; helper returns name/emoji; ts is nullable consistently in message/preview sorting; existing API/wire schemas remain unchanged. New props are declared here and passed/tested atomically.
- Causal tests execute actual component Source; the harness only simulates lifecycle/imported ports. Expected RED cases exercise baseline defects; original source mirrors and static-only string tests cannot qualify.
- Fixture normal maintenance preserves data/317 IDs/hashes/thresholds and every prior negative case. Source/build changes are measured separately. Current fixtureHash does not hash callbacks; no gratuitous fixture identity change is planned.
- All execution checkboxes are pending. No tests, Source edits, Git mutation, fetch, live HTTP/browser/provider calls, process/service/credential effects or builds were performed in preparation. Only this ignored candidate file was written; source pins below were computed read-only. Root owns adoption and delivery; no further user approval is needed for this bounded correction.

## Source pins (whole-file bytes, SHA256)

| Path | Bytes | SHA256 |
|---|---:|---|
| `AGENTS.md` | 5011 | `cfea23240f4a02a212e593fa08c4595c8b1fa5c4d07d24a491cc89716efb752c` |
| `docs/superpowers/specs/2026-10-19-operator-workspace-design.md` | 5303 | `f3971e52b5ed391d1dde8c84a6abafafe49aed0af465208cdf9af8da3ad7263c` |
| `.superpowers/sdd/2026-10-20-live-page-adjacent/chat-provenance-readonly-proposal-v1.md` | 10930 | `08c459133fcea81a4633f1742bfa21f762fa2c64161ead3bba04f41401653659` |
| `src/pages/Chat.tsx` | 2307 | `b19db5ef1ccb71eb3d32d292ef7e2a238163c4e6c438f5eb6e2cdf5f0d957582` |
| `src/components/ChatSidebar.tsx` | 5702 | `4e0e43885c03a05a492de97d3eeefacecf7f1d97e8e5d1e4a865b3f17757f4eb` |
| `src/components/ChatPanel.tsx` | 8265 | `09cd022f41f948dd21cc2bd5b112c50f348c5448c848ac78a9328c86e7b6726f` |
| `src/hooks/usePolling.ts` | 909 | `ae6d53233c857df66b14f2edf1ef8ea796f2c732e5bb211caa6a9d846ed43d7e` |
| `src/hooks/useWebSocket.ts` | 2542 | `7f6f0680e2b5a8df8435339cc36fecf3c92b876a4f1a9b8c63f9db1d2a2a6c4c` |
| `src/lib/api.ts` | 30349 | `d7b5320ae16fdd0bea2125be5c58e8d88537822e15df7262078bc7f0a9f33cb5` |
| `src/lib/types.ts` | 7596 | `270662652bcef0a5509d055a2fc9e748403cd48ddcc78548bcb1782e4a2b623a` |
| `src/lib/constants.ts` | 1180 | `1d2c02bdd316654d442737ffc03a5b602373c0ef5c5095af6b42af350a0d6974` |
| `src/main.tsx` | 359 | `b82605d17157dc93bba61772172c3876da715bad02d66303761dd0cfc8f6e726` |
| `src/index.css` | 244790 | `c898cb7d658eae02912af2dcef2856438a430b6c631d61a346dbcedd188c42a7` |
| `server/routes/agents.ts` | 20411 | `a9de70960b6d761a9b56a41bdd5440801200c2b01d7ab532b20b22807a19e14b` |
| `server/services/agent-identity.ts` | 3367 | `a596fcf2218864048ac240185fc5c78c081407cb89cfc8619b32ebe921b39c26` |
| `server/ws-proxy.ts` | 7476 | `1bc48eeb7c5472cd30f0180f633f1b9aeeb56dde32de1ca6a8087a1eeb061627` |
| `scripts/ui-regression-fixtures.mjs` | 92129 | `53e86ced4932be2fec6799681ebc78a345a3a861f4166799031b586a8b636a4e` |
| `scripts/ui-regression-lifecycle.mjs` | 38287 | `b3eb1ab0bd8ffed848c378a943d6ef4429d6f521509d2fbc61db6afb43a3bdad` |
| `tests/ui-regression-contract.test.ts` | 152592 | `e2a944320ffe690ce2957c43c9ff5b2e7cc754bda38f6fa3f1deb3bb5a8a515c` |
| `tests/use-websocket.test.ts` | 7109 | `1af0f02e480c2ba00f32d603118f283ff4ecb7a39ff7bfebc64557d4e137a7bc` |
| `package.json` | 6069 | `952347df3f872475f4b957c04c9e8d308306efc268c22d9f965c1c8a3010e8b9` |
