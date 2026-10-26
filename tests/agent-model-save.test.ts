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
 runCli:async(cmd:string,args:string[])=>{assert.equal(cmd,'openclaw');calls.push(args);if(kind==='fence'||kind==='get'&&args[1]==='get'||kind==='set'&&args[1]==='set')throw Error(kind==='fence'?'MC_TASK6A_SELECTED_CLI_NO_SPAWN':'SENTINEL_NOT_FOR_CLIENT');if(args[1]==='get')return kind==='parse'?'{' :kind==='shape'?'{}':kind==='index'?'[]':'[{"id":"main"}]';return '';},
 setCache:(key:string)=>cache.push(key),console:{log(){},error(){}}};
 new Function(...Object.keys(ports),compile(code))(...Object.values(ports));assert.equal(typeof patch,'function');
 const r=res();await patch({params:{id},body:{name:'New',role:'Dev',model,description:'Fixture'}},r);
 return {r,reads,writes,calls,cache};
}
test('fresh selected save refuses before all legacy effects',async()=>{const f=await route('ok',true);assert.equal(f.r.statusCode,409);assert.deepEqual(f.r.body,{success:false,error:'AGENT_SETTINGS_UNSUPPORTED'});assert.equal(f.reads,0);assert.equal(f.writes,0);assert.deepEqual(f.calls,[]);assert.deepEqual(f.cache,[]);});
for(const kind of ['get','parse','shape','index','set','fence'])test('model failure '+kind,async()=>{const f=await route(kind);assert.equal(f.r.statusCode,502);assert.deepEqual(f.r.body,{success:false,error:'AGENT_MODEL_SAVE_FAILED',profileUpdate:'may_have_saved',modelUpdate:'unconfirmed'});assert.equal(f.writes,1);assert.deepEqual(f.cache,['profiles','agents']);assert.doesNotMatch(JSON.stringify(f.r.body),/SENTINEL|kimi|MC_TASK6A/);assert.equal(f.calls.length,kind==='set'?2:1);});
test('profile failure is sanitized and prevents CLI',async()=>{const f=await route('profile');assert.equal(f.r.statusCode,500);assert.deepEqual(f.r.body,{success:false,error:'AGENT_PROFILE_SAVE_FAILED',profileUpdate:'unconfirmed',modelUpdate:'not_attempted'});assert.deepEqual(f.calls,[]);assert.deepEqual(f.cache,['profiles','agents']);});
for(const [input,full] of [['kimi-k2p5','kimi-coding/k2p5'],['minimax-m2.7','minimax/MiniMax-M2.7'],['sonnet-4.5','anthropic/claude-sonnet-4-5'],['opus-4.6','anthropic/claude-opus-4-6'],['glm-4.7','zai/glm-4.7'],['deepseek-chat','deepseek/deepseek-chat'],['deepseek-reasoner','deepseek/deepseek-reasoner'],['grok-3','xai/grok-3'],['custom/exact-v9','custom/exact-v9']])test('preserve '+input,async()=>{const f=await route('ok',false,input);assert.deepEqual(f.r.body,{success:true,id:'main'});assert.deepEqual(f.calls,[['config','get','agents.list'],['config','set',`agents.list[0].model.primary`,full]]);assert.deepEqual(f.cache,['profiles','agents']);});
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
