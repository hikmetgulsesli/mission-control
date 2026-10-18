import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const entry = pathToFileURL(path.join(root,'server','index.ts')).href;
const service = pathToFileURL(path.join(root,'server','services','fresh-installation-runtime.ts')).href;
function cleanEnvironment(): NodeJS.ProcessEnv {
  const environment = {...process.env};
  for (const key of Object.keys(environment)) if (key.startsWith('SETFARM_') || key.startsWith('MC_TASK6A_')
    || ['DATABASE_URL','PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE'].includes(key)) delete environment[key];
  return environment;
}
for (const [name,values] of [
  ['relative locator',{SETFARM_INSTALLATION_DIR:'relative',SETFARM_REPO_DIR:'/unresolved-reviewed-release'}],
  ['missing explicit release',{SETFARM_INSTALLATION_DIR:'/unresolved-owned-installation'}],
  ['unresolved release',{SETFARM_INSTALLATION_DIR:'/unresolved-owned-installation',SETFARM_REPO_DIR:'/unresolved-reviewed-release'}],
  ['legacy rehearsal mixed with selection',{SETFARM_INSTALLATION_DIR:'/unresolved-owned-installation',SETFARM_REPO_DIR:'/unresolved-reviewed-release',MC_TASK6A_RESTRICTED_TASKS_VERIFY_V1:'1'}],
] as const) test(`selected MC ${name} refuses before the ordinary import graph`, () => {
  const script = `import assert from 'node:assert/strict';
    import {registerHooks} from 'node:module';
    const forbidden=[];
    const hook=registerHooks({resolve(specifier,context,next){
      if(specifier==='postgres'||specifier==='express'||specifier==='./app.js'||specifier.includes('/routes/')){
        forbidden.push(specifier);throw new Error('ORDINARY_GRAPH_REACHED');
      }return next(specifier,context);
    }});
    process.once('exit',code=>{
      assert.equal(code,1);assert.deepEqual(forbidden,[]);hook.deregister();
      console.log('MC_FRESH_PREIMPORT_REFUSAL_CHECKED');
    });
    await import(${JSON.stringify(entry)});`;
  const result = spawnSync(process.execPath,['--import',import.meta.resolve('tsx'),'--input-type=module','-e',script],{
    cwd:root,env:{...cleanEnvironment(),...values},encoding:'utf8',timeout:10_000,maxBuffer:16_384,
  });
  assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.status,1);
  assert.equal(result.stdout,'MC_FRESH_PREIMPORT_REFUSAL_CHECKED\n');
  assert.equal(result.stderr,'MC_STARTUP_UNAVAILABLE\n');
});

test('unselected MC gate imports no Setfarm module and remains a no-op', () => {
  const script = `import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
    const hook=registerHooks({resolve(specifier,context,next){
      if(specifier.includes('/dist/db-pg.js')||specifier.includes('fresh-installation-entry-v1.js'))throw Error('SETFARM_IMPORT_REACHED');
      return next(specifier,context);
    }});
    const api=await import(${JSON.stringify(service)});
    await api.prepareFreshMissionControlRuntimeV1();assert.equal(api.freshMissionControlSelectedV1(),false);
    assert.equal(api.freshMissionControlPathsV1(),null);assert.equal(api.freshMissionControlSqlV1(),null);
    assert.equal(api.freshSetfarmCliInvocationV1('setfarm',[],{}),null);hook.deregister();
    console.log('MC_LEGACY_GATE_NOOP_CHECKED');`;
  const result=spawnSync(process.execPath,['--import',import.meta.resolve('tsx'),'--input-type=module','-e',script],{
    cwd:root,env:cleanEnvironment(),encoding:'utf8',timeout:10_000,maxBuffer:16_384,
  });
  assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.status,0,result.stderr);
  assert.equal(result.stdout,'MC_LEGACY_GATE_NOOP_CHECKED\n');
});

test('late selection refusal remains sticky after restoring the original environment', () => {
  const script = `import assert from 'node:assert/strict';
    const api=await import(${JSON.stringify(service)});
    await api.prepareFreshMissionControlRuntimeV1();
    process.env.SETFARM_INSTALLATION_DIR='/late-unadmitted-selection';
    assert.throws(()=>api.assertFreshMissionControlRuntimeV1(),/MC_FRESH_INSTALLATION_RUNTIME_UNAVAILABLE/);
    delete process.env.SETFARM_INSTALLATION_DIR;
    assert.throws(()=>api.assertFreshMissionControlRuntimeV1(),/MC_FRESH_INSTALLATION_RUNTIME_UNAVAILABLE/);
    assert.throws(()=>api.freshMissionControlSqlV1(),/MC_FRESH_INSTALLATION_RUNTIME_UNAVAILABLE/);
    console.log('MC_LATE_SELECTION_STICKY_REFUSAL_CHECKED');`;
  const result=spawnSync(process.execPath,['--import',import.meta.resolve('tsx'),'--input-type=module','-e',script],{
    cwd:root,env:cleanEnvironment(),encoding:'utf8',timeout:10_000,maxBuffer:16_384,
  });
  assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.status,0,result.stderr);
  assert.equal(result.stdout,'MC_LATE_SELECTION_STICKY_REFUSAL_CHECKED\n');
});

test('selected close before preparation refuses later work without loading a pool', () => {
  const script = `import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
    const hook=registerHooks({resolve(specifier,context,next){
      if(specifier==='postgres'||specifier.includes('/dist/db-pg.js')||specifier.includes('fresh-installation-entry-v1.js'))throw Error('POOL_IMPORT_REACHED');
      return next(specifier,context);
    }});
    const api=await import(${JSON.stringify(service)});
    await api.closeFreshMissionControlRuntimeV1();await api.closeFreshMissionControlRuntimeV1();
    await assert.rejects(api.prepareFreshMissionControlRuntimeV1(),/MC_FRESH_INSTALLATION_RUNTIME_UNAVAILABLE/);
    assert.throws(()=>api.freshMissionControlSqlV1(),/MC_FRESH_INSTALLATION_RUNTIME_UNAVAILABLE/);
    hook.deregister();console.log('MC_CLOSE_BEFORE_PREPARE_CHECKED');`;
  const result=spawnSync(process.execPath,['--import',import.meta.resolve('tsx'),'--input-type=module','-e',script],{
    cwd:root,env:{...cleanEnvironment(),SETFARM_INSTALLATION_DIR:'/unresolved-owned-installation',SETFARM_REPO_DIR:'/unresolved-reviewed-release'},
    encoding:'utf8',timeout:10_000,maxBuffer:16_384,
  });
  assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.status,0,result.stderr);
  assert.equal(result.stdout,'MC_CLOSE_BEFORE_PREPARE_CHECKED\n');
});

// Negative source-wiring/lifecycle components only; no positive authority fixture.
function sourceDeclaration(relative: string, name: string): string {
  const source=readFileSync(path.join(root,relative),'utf8');
  const tree=ts.createSourceFile(relative,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  const rows=tree.statements.filter((node):node is ts.FunctionDeclaration=>ts.isFunctionDeclaration(node)&&node.name?.text===name);
  assert.equal(rows.length,1,'fixed function missing or ambiguous: '+name);return rows[0]!.getText(tree);
}
function compileComponent(source: string): string {
  return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/^export /gm,'');
}
test('selected legacy diagnosis refuses before SQL, logs or session effects',async()=>{
  const body=sourceDeclaration('server/utils/setfarm-db.ts','diagnoseStuckStep');let touched=0;
  const fail=()=>{touched++;throw Error('DIAGNOSTIC_EFFECT_REACHED');};
  const diagnose=new Function('freshMissionControlSelectedV1','validateId','sql','readFile','execFileAsync',compileComponent(body)+';return diagnoseStuckStep;')(()=>true,fail,fail,fail,fail) as (run:string,step?:string)=>Promise<unknown>;
  await assert.rejects(diagnose('component-run','component-step'),/MC_FRESH_INSTALLATION_DIAGNOSE_NOT_WIRED/);assert.equal(touched,0);
});
test('selected PRD start-run delegates only to the guarded acceptance composer without legacy effects',async()=>{
  const relative='server/routes/prd-generator.ts',source=readFileSync(path.join(root,relative),'utf8');
  const tree=ts.createSourceFile(relative,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);const rows:ts.ArrowFunction[]=[];
  const visit=(node:ts.Node):void=>{
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&ts.isIdentifier(node.expression.expression)
      &&node.expression.expression.text==='router'&&node.expression.name.text==='post'&&node.arguments.length===2){
      const route=node.arguments[0],callback=node.arguments[1];
      if(route&&ts.isStringLiteral(route)&&route.text==='/prd/start-run'&&callback&&ts.isArrowFunction(callback))rows.push(callback);
    }ts.forEachChild(node,visit);
  };visit(tree);assert.equal(rows.length,1,'fixed start-run callback missing or ambiguous');
  const input={},refused=Error('ACTUAL_ACCEPTANCE_COMPOSER_REFUSED');let called=0,status=0,payload:unknown;
  const run=new Function('freshMissionControlSelectedV1','startFreshPrdWorkflowV1','freshPrdStartFailureV1',
    compileComponent('const callback='+rows[0]!.getText(tree)+';')+';return callback;')(
      ()=>true,async(value:unknown)=>{assert.equal(value,input);called++;throw refused;},
      (error:unknown)=>{assert.equal(error,refused);return {error:'COMPONENT_COMPOSER_REFUSAL'};}) as (req:unknown,res:unknown)=>Promise<unknown>;
  const response={status(value:number){status=value;return this;},json(value:unknown){payload=value;return this;}};
  await run({body:input},response);assert.equal(called,1);assert.equal(status,503);assert.deepEqual(payload,{error:'COMPONENT_COMPOSER_REFUSAL'});
});
test('startup import failure redacts and terminates despite an owned module timer',()=>{
  const script=`import {registerHooks} from 'node:module';const index=${JSON.stringify(entry)};
    registerHooks({resolve(specifier,context,next){
      if(specifier==='./app.js'&&context.parentURL===index){
        const body="setInterval(()=>{},1000);console.log('MC_APP_TIMER_CREATED');throw Error('SENSITIVE_APP_IMPORT_FAILURE');";
        return {url:'data:text/javascript,'+encodeURIComponent(body),shortCircuit:true};
      }
      if(specifier==='express'||specifier==='postgres'||specifier.includes('/routes/'))throw Error('BASELINE_ORDINARY_GRAPH_BLOCKED');
      return next(specifier,context);
    }});await import(index);`;
  const result=spawnSync(process.execPath,['--import',import.meta.resolve('tsx'),'--input-type=module','-e',script],{cwd:root,env:cleanEnvironment(),encoding:'utf8',timeout:10_000,maxBuffer:16_384});
  assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.status,1);
  assert.equal(result.stdout,'MC_APP_TIMER_CREATED\n');assert.equal(result.stderr,'MC_STARTUP_UNAVAILABLE\n');
});
