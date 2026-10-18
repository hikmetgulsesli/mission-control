import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import ts from 'typescript';
const root=new URL('../',import.meta.url);
const source=(name:string)=>readFileSync(new URL(name,root),'utf8');
const name='server/services/fresh-prd-workflow-run.ts',text=source(name),tree=ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true);
function declaration(name:string):ts.FunctionDeclaration{
 const rows=tree.statements.filter((n):n is ts.FunctionDeclaration=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert.equal(rows.length,1);return rows[0]!;
}
const compile=(s:string)=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/^export /gm,'');
const constants=tree.statements.filter(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&['UUID','WORKFLOW','SOURCE','RECEIPT_KEYS'].includes(d.name.text))).map(n=>n.getText(tree)).join('\n');
const parse=new Function(compile(constants+'\n'+declaration('parseFreshWorkflowRunAcceptanceV1').getText(tree))+';return parseFreshWorkflowRunAcceptanceV1;')() as (raw:string,wf:string,sha:string)=>Readonly<Record<string,unknown>>;
const sha='a'.repeat(40),uuid='12345678-1234-4123-8123-123456789abc';
const receipt={schema:'setfarm.workflow-run-accepted.v1',accepted:true,runId:uuid,runNumber:1,workflowId:'feature-dev',protocol:'v3',protocolVersion:1,status:'running',compilerReleaseSha:sha};
const encode=(value:unknown)=>JSON.stringify(value)+'\n';
test('strict nine-key receipt parser returns detached frozen DATA, never actual acceptance authority',()=>{
 const result=parse(encode(receipt),'feature-dev',sha);assert.deepEqual(result,receipt);assert.equal(Object.isFrozen(result),true);
});
test('receipt parser rejects missing/extra/duplicate keys and wrong scalar domains or provenance',()=>{
 const variants:Record<string,unknown>[]=[{...receipt,extra:true},{...receipt,accepted:1},{...receipt,runId:'legacy-id'},
  {...receipt,runNumber:0},{...receipt,runNumber:Number.MAX_SAFE_INTEGER+1},{...receipt,protocol:'other'},
  {...receipt,protocolVersion:2},{...receipt,status:'completed'},{...receipt,workflowId:'other'},
  {...receipt,compilerReleaseSha:'b'.repeat(40)}];
 for(const key of Object.keys(receipt)){const value={...receipt} as Record<string,unknown>;delete value[key];variants.push(value);}
 for(const value of variants)assert.throws(()=>parse(encode(value),'feature-dev',sha));
 for(const raw of [JSON.stringify(receipt),encode(receipt)+'\n','log\n'+encode(receipt),' '+encode(receipt),
   encode(receipt).replace('"accepted":true','"accepted":true,"accepted":true'),'x'.repeat(8193)])assert.throws(()=>parse(raw,'feature-dev',sha));
});
test('actual row DATA join requires exact ID/task/workflow/protocol/version/release, allows advanced current status',()=>{
 const check=new Function(compile(declaration('assertFreshAcceptedRunRowV1').getText(tree))+';return assertFreshAcceptedRunRowV1;')() as (rows:unknown[],receipt:unknown,task:string)=>void;
 const row={id:uuid,run_number:'1',workflow_id:'feature-dev',task:'exact task',protocol:'v3',protocol_version:1,compiler_release_sha:sha,status:'completed'};
 assert.doesNotThrow(()=>check([row],receipt,'exact task'));
 for(const key of ['id','run_number','workflow_id','task','protocol','protocol_version','compiler_release_sha'])assert.throws(()=>check([{...row,[key]:key==='protocol_version'?2:'crossed'}],receipt,'exact task'));
 assert.throws(()=>check([],receipt,'exact task'));assert.throws(()=>check([row,row],receipt,'exact task'));
});
test('actual composer refuses before request/property/effect access when fixed entry refuses',async()=>{
 let reads=0;const input=new Proxy({}, {get(){reads++;throw Error('INPUT_OR_EFFECT_REACHED');}});
 const refused=Error('ACTUAL_ENTRY_REFUSAL');class ComponentStartError extends Error {constructor(readonly acceptance:string,readonly runId:unknown){super('component refusal');}}
 const start=new Function('assertFreshMissionControlRuntimeV1','FreshPrdStartErrorV1',compile(declaration('startFreshPrdWorkflowV1').getText(tree))+';return startFreshPrdWorkflowV1;')(()=>{throw refused;},ComponentStartError) as (input:unknown)=>Promise<unknown>;
 await assert.rejects(start(input),(error:unknown)=>error instanceof ComponentStartError&&error.acceptance==='not-started');assert.equal(reads,0);
});
test('actual service source uses real bounded CLI acknowledgement and exact selected row/CAS instead of detached or latest lookup',()=>{
 const body=declaration('startFreshPrdWorkflowV1').getText(tree),gate=body.indexOf('await assertFreshMissionControlWorkflowAssetsV1');
 assert.ok(gate>=0&&gate<body.indexOf('fs.mkdirSync')&&gate<body.indexOf('fs.writeFileSync'));
 assert.ok(body.indexOf('await runCliRaw')<body.indexOf('FROM public.runs WHERE id=$1 LIMIT 2'));
 assert.match(body,/'--json'/);assert.match(body,/prd_content=\$3 AND prd_version=\$4 AND run_id IS NOT DISTINCT FROM \$5/);
 assert.match(body,/flag:'wx',mode:0o600/);assert.doesNotMatch(body,/getRuns\(|spawn\(|detached:|matching\[0\]|runId.*\|\| null/);
 assert.ok(body.indexOf('cleanupOwnedTaskV1')>body.indexOf('await sql.begin'));
 const cli=source('server/utils/cli.ts');assert.match(cli,/export async function runCliRaw/);assert.match(cli,/timeout: commandTimeoutMsV1\(selected!==null,cmd,args\)/);assert.match(cli,/maxBuffer: 1024 \* 1024/);
 assert.match(cli,/return \(await runCliRaw\(cmd,args\)\)\.trim\(\)/);
});

test('selected design cache IDs are validated before project effects',()=>{
 const validate=new Function(compile(declaration('validateFreshPrdScreensV1').getText(tree))+';return validateFreshPrdScreensV1;')() as (value:unknown)=>{projectId:string;screens:unknown[]};
 assert.deepEqual(validate(null),{projectId:'',screens:[]});
 assert.equal(validate([{id:'a1',projectId:'1234',name:'Home',status:'done'}]).screens.length,1);
 for(const value of [[{id:'../foreign',projectId:'1234'}],[{id:'a1',projectId:'../foreign'}],
   [{id:'a1',projectId:'1234'},{id:'a2',projectId:'5678'}]])assert.throws(()=>validate(value));
 const main=declaration('startFreshPrdWorkflowV1').getText(tree);
 assert.ok(main.indexOf('validateFreshPrdScreensV1')<main.indexOf('fs.mkdirSync'));
});
test('browser transport JSON and invalid success losses remain unknown without retries; known acceptance keeps ID',async()=>{
 const sourceText=source('src/lib/api.ts'),apiTree=ts.createSourceFile('api.ts',sourceText,ts.ScriptTarget.Latest,true);
 const functions=apiTree.statements.filter((node):node is ts.FunctionDeclaration=>ts.isFunctionDeclaration(node)&&node.name?.text==='fetchPrdWorkflowStart');assert.equal(functions.length,1);
 class ComponentError extends Error{constructor(message:string,readonly acceptance:string,readonly runId:unknown,readonly repoPath:unknown){super(message);}}
 for(const mode of ['network','json','null-success','known-accepted'] as const){
  let calls=0;const fetchPort=async()=>{calls++;if(mode==='network')throw Error('component network');
   return {ok:mode!=='known-accepted',status:503,async json(){if(mode==='json')throw Error('component JSON');
    return mode==='null-success'?{success:true,runId:null}:{schema:'mission-control.workflow-start-result.v1',success:false,acceptance:'accepted',runId:uuid,repoPath:'/component/project',error:'component confirmed run; link unknown',retrySafe:false};}};};
  const invoke=new Function('fetch','BASE','CT_JSON','AUTH_TOKEN','PrdWorkflowStartError',compile(functions[0]!.getText(apiTree))+';return fetchPrdWorkflowStart;')(fetchPort,'',{},'',ComponentError) as (input:unknown)=>Promise<unknown>;
  await assert.rejects(invoke({prdId:'component'}),(error:unknown)=>error instanceof ComponentError&&error.acceptance===(mode==='known-accepted'?'accepted':'unknown')&&error.runId===(mode==='known-accepted'?uuid:null));
  assert.equal(calls,1,'no automatic HTTP retry');
 }
});
test('actual CLI body uses fixed selected workflow budget, preserves default commands and refuses saturated launch',async()=>{
 const cliText=source('server/utils/cli.ts'),cliTree=ts.createSourceFile('cli.ts',cliText,ts.ScriptTarget.Latest,true);
 const fn=(name:string)=>{const rows=cliTree.statements.filter((n):n is ts.FunctionDeclaration=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert.equal(rows.length,1);return rows[0]!.getText(cliTree);};
 const classes=cliTree.statements.filter((n):n is ts.ClassDeclaration=>ts.isClassDeclaration(n)&&n.name?.text==='FreshWorkflowCliBusyErrorV1');assert.equal(classes.length,1);
 const budgetDeclarations=cliTree.statements.filter(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&['CLI_TIMEOUT_MS','FRESH_WORKFLOW_RUN_TIMEOUT_MS'].includes(d.name.text))).map(n=>n.getText(cliTree)).join('\n');
 for(const [selected,command,args,capacity,expected] of [[true,'setfarm',['workflow','run','feature-dev'],0,120000],
   [false,'setfarm',['workflow','run','feature-dev'],0,25000],[true,'setfarm',['workflow','status'],0,25000],
   [true,'openclaw',['workflow','run'],0,25000],[true,'setfarm',['workflow','run','feature-dev'],3,0]] as const){
  let acquired=0,spawned=0,released=0,timeout=0;
  const ports={task6aSelectedCliNoSpawn:false,TASK6A_SELECTED_CLI_NO_SPAWN:'component',inflight:new Map(),active:capacity,MAX_CONCURRENT:3,
   freshMissionControlSelectedV1:()=>selected,acquire:async()=>{acquired++;},release:()=>{released++;},
   freshSetfarmCliInvocationV1:()=>selected&&command==='setfarm'?{file:'/component/node',args:[],env:{}}:null,
   execFileAsync:async(_file:string,_args:unknown,options:{timeout:number})=>{spawned++;timeout=options.timeout;return {stdout:'component DATA only\n'};},env:{},console:{error(){}}};
  const implementation=compile(budgetDeclarations+'\n'+classes[0]!.getText(cliTree)+'\n'+fn('commandTimeoutMsV1')+'\n'+fn('runCliRaw'));
  const invoke=new Function(...Object.keys(ports),implementation+';return runCliRaw;')(...Object.values(ports)) as (command:string,args:string[])=>Promise<string>;
  if(capacity===3){await assert.rejects(invoke(command,[...args]),/MC_FRESH_WORKFLOW_CLI_BUSY/);assert.equal(acquired,0);assert.equal(spawned,0);assert.equal(released,0);}
  else{assert.equal(await invoke(command,[...args]),'component DATA only\n');assert.equal(timeout,expected);assert.equal(acquired,1);assert.equal(spawned,1);assert.equal(released,1);}
 }
});
