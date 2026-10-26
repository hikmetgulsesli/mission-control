# Agent Model Save Failure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refuse unsupported selected-installation saves and report ordinary model-save failure truthfully without false UI success.

**Architecture:** Keep the existing route and ordering; add an early selected boundary, sanitized failure receipts and cache invalidation after possible profile effects. Reuse authenticated fetchApi for one save client and require a valid receipt before UI success.

**Tech Stack:** Existing TypeScript, Express5, React19, node:test, TypeScript transpile fixtures; no new dependency.

**Spec:** docs/superpowers/specs/2026-10-26-agent-model-save-failure-design.md

## Global Constraints

Source-only delivery; no service activation, live PATCH, OpenClaw execution, provider call, credential change, or runtime-guard bypass.
Fresh-selected PATCH returns 409 before any profile read/write, CLI call, or cache invalidation.
Preserve existing nonfresh model aliases and exact custom model IDs.
No provider/model catalog refresh, new setting, dependency, or mutable selected-installation support.
All failure responses are non2xx, sanitized, and contain no requested model or raw error.
Profile and model writes are not atomic; partial or unknown persistence must stay visible.

---

Private execution proposal only. Root is primary owner; this document does not dispatch agents or authorize effects beyond current authority. Existing sole writer M=/Users/setrox/ai/setrox/.worktrees/mission-control-auth-order-test-20261021-v1. Reconcile handoff/current source before execution. SourceM b422 and live4a remain separate. Do not switch/clean a dirty writer. Root verified clean b422 and created the sole writer branch fix/agent-model-save-errors-20261026; Root alone handles delivery.

## File Map

Modify `server/routes/agents.ts:120-184`: selected refusal, sanitized ordinary failure, finally cache invalidation, no success-model echo.
Modify `src/lib/api.ts:190-203` and api object near301: optional scoped error mapper, AgentSaveError/agentSaveFailure/fetchAgentSave, updateAgent entry.
Modify `src/pages/Agents.tsx:58-69`: await api.updateAgent before refresh.
Create `tests/agent-model-save.test.ts`: synthetic actual-source route/client/page/modal callback regressions.
Read only `src/components/AgentEditModal.tsx:58-69`, `server/utils/cli.ts:59-95`, `server/shared/agents.ts`, existing fixture patterns and applicable AGENTS. Do not modify these or model lists.

### Task 1: Truthful guarded save from route through modal

**Interfaces:** consumes existing freshMissionControlSelectedV1():boolean, runCli(cmd,args):Promise<string>, loadProfiles/saveProfiles and setCache. Produces exact PATCH receipts from spec, fetchAgentSave(id:string,changes:{name?:string;role?:string;model?:string;description?:string}):Promise<void>, api.updateAgent and a resolving UI save only after receipt validation. AgentSaveError is a private Error subclass; agentSaveFailure(status:number,text:string):Error is the scoped mapper. fetchApi gains optional third `(status:number,text:string)=>Error`; other callers are unchanged.

- [ ] **Step 1: Create failing actual-source regressions.** Put this complete fixture/test content in tests/agent-model-save.test.ts. No application module imports or real profile/CLI/HTTP ports.

```ts
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import ts from 'typescript';
const root=new URL('../',import.meta.url);
const source=(f:string)=>readFileSync(new URL(f,root),'utf8');
const tree=(f:string)=>ts.createSourceFile(f,source(f),ts.ScriptTarget.Latest,true);
const compile=(s:string)=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^export /gm,'');
function decl(f:string,n:string){const t=tree(f);const a=t.statements.filter(x=>(ts.isFunctionDeclaration(x)||ts.isClassDeclaration(x))&&x.name?.text===n);assert.equal(a.length,1,n);return a[0]!.getText(t);}
function callback(f:string,owner:string){const t=tree(f);const a=t.statements.find(x=>ts.isFunctionDeclaration(x)&&x.name?.text===owner);assert.ok(a);let out='';function visit(n:ts.Node){if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.name.text==='handleSave'){assert.equal(out,'');out=n.initializer!.getText(t);}ts.forEachChild(n,visit);}visit(a);assert.ok(out);return compile('const invoke='+out+';')+';return invoke;';}
const res=()=>({statusCode:200,body:undefined as any,status(n:number){this.statusCode=n;return this;},json(b:any){this.body=b;return this;}});
async function route(kind='ok',selected=false,model='kimi-k2p5',id='main'){
 let patch:any,reads=0,writes=0;const calls:string[][]=[],cache:string[]=[];
 const t=tree('server/routes/agents.ts');
 const code=t.statements.filter(x=>!ts.isImportDeclaration(x)&&!ts.isExportAssignment(x)).map(x=>x.getText(t)).join('\n');
 const ports={Router:()=>({get(){},patch(_p:string,fn:any){patch=fn;}}),REAL_AGENT_IDS:['main'],freshMissionControlSelectedV1:()=>selected,
 config:{clawtabsConfig:'/synthetic/profiles.json'},
 readFileSync:()=>{reads++;return JSON.stringify({gateways:[{id:'main-gw',profile:{name:'Old'}}]});},
 writeFileSync:()=>{writes++;if(kind==='profile')throw Error('SENTINEL_NOT_FOR_CLIENT');},
 runCli:async(cmd:string,args:string[])=>{assert.equal(cmd,'openclaw');calls.push(args);if(kind==='fence'||kind==='get'&&args[1]==='get'||kind==='set'&&args[1]==='set')throw Error(kind==='fence'?'MC_TASK6A_SELECTED_CLI_NO_SPAWN':'SENTINEL_NOT_FOR_CLIENT');if(args[1]==='get')return kind==='parse'?'{':kind==='shape'?'{}':kind==='index'?'[]':'[{"id":"main"}]';return '';},
 setCache:(key:string)=>cache.push(key),console:{log(){},error(){}}};
 new Function(...Object.keys(ports),compile(code))(...Object.values(ports));assert.equal(typeof patch,'function');
 const r=res();await patch({params:{id},body:{name:'New',role:'Dev',model,description:'Fixture'}},r);
 return {r,reads,writes,calls,cache};
}
test('fresh selected save refuses before all legacy effects',async()=>{const f=await route('ok',true);assert.equal(f.r.statusCode,409);assert.deepEqual(f.r.body,{success:false,error:'AGENT_SETTINGS_UNSUPPORTED'});assert.equal(f.reads,0);assert.equal(f.writes,0);assert.deepEqual(f.calls,[]);assert.deepEqual(f.cache,[]);});
for(const kind of ['get','parse','shape','index','set','fence'])test('model failure '+kind,async()=>{const f=await route(kind);assert.equal(f.r.statusCode,502);assert.deepEqual(f.r.body,{success:false,error:'AGENT_MODEL_SAVE_FAILED',profileUpdate:'may_have_saved',modelUpdate:'unconfirmed'});assert.equal(f.writes,1);assert.deepEqual(f.cache,['profiles','agents']);assert.doesNotMatch(JSON.stringify(f.r.body),/SENTINEL|kimi|MC_TASK6A/);assert.equal(f.calls.length,kind==='set'?2:1);});
test('profile failure is sanitized and prevents CLI',async()=>{const f=await route('profile');assert.equal(f.r.statusCode,500);assert.deepEqual(f.r.body,{success:false,error:'AGENT_PROFILE_SAVE_FAILED',profileUpdate:'unconfirmed',modelUpdate:'not_attempted'});assert.deepEqual(f.calls,[]);assert.deepEqual(f.cache,['profiles','agents']);});
for(const [input,full] of [['kimi-k2p5','kimi-coding/k2p5'],['minimax-m2.7','minimax/MiniMax-M2.7'],['sonnet-4.5','anthropic/claude-sonnet-4-5'],['opus-4.6','anthropic/claude-opus-4-6'],['glm-4.7','zai/glm-4.7'],['deepseek-chat','deepseek/deepseek-chat'],['deepseek-reasoner','deepseek/deepseek-reasoner'],['grok-3','xai/grok-3'],['custom/exact-v9','custom/exact-v9']])test('preserve '+input,async()=>{const f=await route('ok',false,input);assert.deepEqual(f.r.body,{success:true,id:'main'});assert.deepEqual(f.calls,[['config','get','agents.list'],['config','set','agents.list[0].model.primary',full]]);assert.deepEqual(f.cache,['profiles','agents']);});
test('ordinary profile-only save skips CLI',async()=>{const f=await route('ok',false,'');assert.deepEqual(f.r.body,{success:true,id:'main'});assert.deepEqual(f.calls,[]);assert.deepEqual(f.cache,['profiles','agents']);});
test('unknown agent causes no effects',async()=>{const f=await route('ok',false,'x','visitor');assert.equal(f.r.statusCode,404);assert.equal(f.reads+f.writes+f.calls.length+f.cache.length,0);});
function client(status:number,body:any,network=false){let count=0;const fetch=async(url:string,init:RequestInit)=>{count++;assert.equal(url,'/api/agents/main');assert.equal(init.method,'PATCH');assert.equal(new Headers(init.headers).get('X-MC-Token'),'fixture-token');assert.equal(new Headers(init.headers).get('Content-Type'),'application/json');if(network)throw Error('SENTINEL_NOT_FOR_CLIENT');return {status,ok:status>=200&&status<300,text:async()=>JSON.stringify(body),json:async()=>{if(body==='malformed-json')throw Error('SENTINEL_NOT_FOR_CLIENT');return body;}};};
 const code=['AgentSaveError','agentSaveFailure','fetchApi','fetchAgentSave'].map(n=>decl('src/lib/api.ts',n)).join('\n');
 const invoke=new Function('fetch','BASE','AUTH_TOKEN','CT_JSON',compile(code)+';return fetchAgentSave;')(fetch,'','fixture-token',{'Content-Type':'application/json'});
 return {invoke,count:()=>count};
}
const unknown='Save could not be confirmed. Profile changes may already be saved. Reload before retrying.';
const modelError='Model update could not be confirmed. Profile changes may already be saved. Reload before retrying.';
for(const [status,body,message] of [[409,{error:'AGENT_SETTINGS_UNSUPPORTED'},'Agent settings cannot be changed in this installation.'],[502,{error:'AGENT_MODEL_SAVE_FAILED'},modelError],[500,{error:'AGENT_PROFILE_SAVE_FAILED'},'Profile update could not be confirmed. The model update was not attempted. Reload before retrying.'],[500,{error:'SENTINEL_NOT_FOR_CLIENT'},unknown],[200,{success:false,id:'main'},unknown],[200,{success:true,id:'other'},unknown],[200,null,unknown],[200,'malformed-json',unknown]] as const)test('client failure '+status+JSON.stringify(body),async()=>{const c=client(status,body);await assert.rejects(c.invoke('main',{model:'custom/exact-v9'}),{message});assert.equal(c.count(),1);});
test('network uncertainty has safe copy and no retry',async()=>{const c=client(200,{},true);await assert.rejects(c.invoke('main',{}),{message:unknown});assert.equal(c.count(),1);});
for(const ok of [false,true])test('actual page and modal save callbacks '+ok,async()=>{
 const c=client(ok?200:502,ok?{success:true,id:'main'}:{error:'AGENT_MODEL_SAVE_FAILED'});let refresh=0,close=0;const state:any={};const timers:Function[]=[];
 const page=new Function('api','refresh',callback('src/pages/Agents.tsx','Agents'))({updateAgent:c.invoke},()=>{refresh++;});
 const ports={agent:{id:'main'},name:'New',role:'Dev',model:'custom/exact-v9',description:'Fixture',onSave:page,onClose:()=>{close++;},setSaving:(v:any)=>{state.saving=v;},setError:(v:any)=>{state.error=v;},setSuccess:(v:any)=>{state.success=v;},setTimeout:(fn:Function,ms:number)=>{assert.equal(ms,800);timers.push(fn);}};
 const save=new Function(...Object.keys(ports),callback('src/components/AgentEditModal.tsx','AgentEditModal'))(...Object.values(ports));await save();assert.equal(state.saving,false);assert.equal(refresh,ok?1:0);assert.equal(state.success,ok?'Saved!':'');assert.equal(state.error,ok?'':modelError);assert.equal(timers.length,ok?1:0);assert.equal(close,0);for(const fn of timers)fn();assert.equal(close,ok?1:0);
});
```

- [ ] **Step 2: Run the red fixture.**

```bash
node --import tsx --test tests/agent-model-save.test.ts
```

Expected current-source failures: selected path accesses profiles, model failures return200, success echoes changes, new client declarations absent. A fixture compilation/import error alone is not a valid behavioral red; fix fixture binding mistakes before implementation.

- [ ] **Step 3: Replace only the existing PATCH handler.** Keep loadProfiles/saveProfiles helpers unchanged.

```ts
router.patch('/agents/:id', async (req, res) => {
  let profileWriteAttempted = false;
  try {
    const { id } = req.params;
    if (!REAL_AGENTS.includes(id)) {
      res.status(404).json({ error: 'Agent not found' }); return;
    }
    if (freshMissionControlSelectedV1()) {
      res.status(409).json({ success: false, error: 'AGENT_SETTINGS_UNSUPPORTED' }); return;
    }
    const { name, role, model, description } = req.body;
    const profiles = loadProfiles();
    if (!profiles[id]) profiles[id] = {};
    if (name) profiles[id].name = name;
    if (role) profiles[id].role = role;
    if (description !== undefined) profiles[id].description = description;
    profileWriteAttempted = true;
    saveProfiles(profiles);
    if (model) {
      try {
        const MODEL_MAP: Record<string,string> = {
          'kimi-k2p5':'kimi-coding/k2p5', 'sonnet-4.5':'anthropic/claude-sonnet-4-5',
          'opus-4.6':'anthropic/claude-opus-4-6', 'glm-4.7':'zai/glm-4.7',
          'minimax-m2.7':'minimax/MiniMax-M2.7', 'deepseek-chat':'deepseek/deepseek-chat',
          'deepseek-reasoner':'deepseek/deepseek-reasoner', 'grok-3':'xai/grok-3',
        };
        const agentsList = JSON.parse((await runCli('openclaw', ['config','get','agents.list'])).trim());
        const agentIndex = agentsList.findIndex((a:any) => a.id === id);
        if (agentIndex === -1) throw new Error('AGENT_CONFIG_INDEX_MISSING');
        await runCli('openclaw', ['config','set',`agents.list[${agentIndex}].model.primary`,MODEL_MAP[model] || model]);
      } catch {
        res.status(502).json({ success:false,error:'AGENT_MODEL_SAVE_FAILED',profileUpdate:'may_have_saved',modelUpdate:'unconfirmed' }); return;
      }
    }
    res.json({ success:true,id });
  } catch {
    res.status(500).json({ success:false,error:'AGENT_PROFILE_SAVE_FAILED',profileUpdate:'unconfirmed',modelUpdate:'not_attempted' });
  } finally {
    if (profileWriteAttempted) {
      setCache('profiles', null as any, 0);
      setCache('agents', null as any, 0);
    }
  }
});
```

- [ ] **Step 4: Add scoped authenticated client and page wiring.** Change fetchApi signature and its existing non-ok throw only:

```ts
async function fetchApi<T>(path:string,opts?:RequestInit,errorFromResponse?:(status:number,text:string)=>Error):Promise<T>
// In the existing !res.ok block, after reading text:
throw errorFromResponse ? errorFromResponse(res.status,text) : new Error(`API ${res.status}: ${text}`);
```

Keep existing fetchApi body/auth/cache/JSON behavior. The existing Agent type lacks role/description; the inline optional save-field shape avoids changing that unrelated roster type. Add before api object:

```ts
class AgentSaveError extends Error {}
function agentSaveFailure(status:number,text:string):Error {
  let code:unknown;
  try { code=JSON.parse(text)?.error; } catch {}
  const message=status===409&&code==='AGENT_SETTINGS_UNSUPPORTED'
    ? 'Agent settings cannot be changed in this installation.'
    : status===502&&code==='AGENT_MODEL_SAVE_FAILED'
    ? 'Model update could not be confirmed. Profile changes may already be saved. Reload before retrying.'
    : status===500&&code==='AGENT_PROFILE_SAVE_FAILED'
    ? 'Profile update could not be confirmed. The model update was not attempted. Reload before retrying.'
    : 'Save could not be confirmed. Profile changes may already be saved. Reload before retrying.';
  return new AgentSaveError(message);
}
async function fetchAgentSave(id:string,changes:{name?:string;role?:string;model?:string;description?:string}):Promise<void> {
  try {
    const receipt=await fetchApi<{success?:unknown;id?:unknown}>(`/api/agents/${encodeURIComponent(id)}`,{
      method:'PATCH',headers:CT_JSON,body:JSON.stringify(changes),
    },agentSaveFailure);
    if(receipt?.success!==true||receipt.id!==id)throw agentSaveFailure(0,'');
  } catch(error) {
    if(error instanceof AgentSaveError)throw error;
    throw agentSaveFailure(0,'');
  }
}
// Inside existing exported api object:
updateAgent: fetchAgentSave,
```

Replace Agents handleSave body with:

```ts
await api.updateAgent(agentId, changes);
refresh();
```

Keep AgentEditModal's callback/error/success code unchanged. Avoid requested-model echo, retry, new model options, global generic error sanitization changes or changed refresh guarantees.

- [ ] **Step 5: Run bounded verification and inspect exact diff.** From M, one command at a time:

```bash
node --import tsx --test tests/agent-model-save.test.ts
npx tsc --noEmit -p tsconfig.json
npm run build
git diff --check
git diff --stat
```

Expected focused tests pass, TypeScript/build exit0, diff check clean; preserve preexisting build warning. Browser configuration was read: tsconfig.json includes src and references tsconfig.server.json. Do not run the server, live PATCH, provider smoke or OpenClaw. Focused fixtures must remain listener/subprocess-free. Preserve original failure captures if a harness/tool stream fails; inspect actual process result before rerunning.

- [ ] **Step 6: Review and scoped commit by Root only.** Confirm file map matches, selected case has zero reads/writes/CLI/cache effects, and no raw response text reaches this UI. Update Root's plan/handoff at the verified boundary. With existing source-delivery authority and actual review/check evidence, stage only these four paths and commit:

```bash
git add server/routes/agents.ts src/lib/api.ts src/pages/Agents.tsx tests/agent-model-save.test.ts
git commit -m "fix: report agent model save failures"
```

Root handles PR/review/merge later under the bounded authorization; this plan schedules no rollout. Self-review: every spec outcome maps to Task1; selected guard, partial caches, custom IDs, auth, safe receipt and modal gate have literal fixtures; no new dependency or runtime setting.

## Primary-owner execution ruling

The author runs focused listener-free fixture tests, browser noEmit and whitespace checks only. Root alone commits, pushes, opens/merges PRs and runs the required stock build after independent reviews on a clean committed source revision. Never run a dirty build, the full test wildcard, OpenClaw, a live PATCH or a service restart for this task. Retain all new evidence and this plan workspace under the user instruction protecting recent records.
