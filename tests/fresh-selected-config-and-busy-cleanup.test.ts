import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {test} from 'node:test';
import ts from 'typescript';
const root=new URL('../',import.meta.url);
const source=(name:string)=>fs.readFileSync(new URL(name,root),'utf8');
const compile=(text:string)=>ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/^export /gm,'');

// This is actual config syntax with only its import boundary and import.meta
// directory supplied as component DATA. No selected DB/entry is fabricated.
function configComponent(selected:boolean,files:Record<string,string>,inherited:Record<string,string>={}){
 const text=source('server/config.ts'),tree=ts.createSourceFile('config.ts',text,ts.ScriptTarget.Latest,true);
 const body=tree.statements.filter(node=>!ts.isImportDeclaration(node)).map(node=>node.getText(tree)).join('\n')
  .replace(/import\.meta\.dirname/g,JSON.stringify('/component/server'));
 const paths=Object.fromEntries(['setfarmDir','setfarmRepoDir','setfarmDb','projectsDir','projectsJson','deletedProjectsJson','uploadsDir',
  'dataJson','avatarsDir','mobileDir','eventsJsonl','sessionsDir','transcriptsDir','scriptsDir','agentsDir','portRegistry','cliPath'].map(key=>[key,'/selected/'+key]));
 const environment={...inherited};
 const invoke=new Function('freshMissionControlPathsV1','readFileSync','resolve','join','homedir','process',
  compile(body)+';return {config,PATHS,environment:process.env};');
 return invoke(()=>selected?paths:null,(file:string)=>{const value=files[path.basename(file)];if(value===undefined)throw Error('component missing');return value;},
  path.resolve,path.join,()=>'/component-home',{env:environment});
}
test('selected config loads auth, listener, write token and actual provider settings with existing file/process precedence',()=>{
 const result=configComponent(true,{'.env':[
  'AUTH_TOKEN=file-auth','MC_HOST=127.0.0.1','MC_PORT=3081','SETFARM_OPERATIONAL_WRITE_TOKEN=file-write',
  'MINIMAX_API_KEY=minimax','LLM_API_KEY=llm','GEMINI_API_KEY=gemini','KIMI_API_KEY=kimi','KIMI_QUOTA_TTL_MS=5000',
  'TELEGRAM_BOT_TOKEN=telegram','TELEGRAM_CHAT_ID=chat','DISCORD_CH_ALERTS=alerts','GATEWAY_TOKEN=gateway',
  'MC_PUBLIC_ORIGIN=https://example.invalid','SETFARM_URL=http://127.0.0.1:3333','PROMETHEUS_URL=http://127.0.0.1:9091',
 ].join('\n'),'.env.local':'AUTH_TOKEN=local-auth\nMC_HOST=localhost\nMINIMAX_API_KEY=local-minimax\nMC_PORT=3082'},
 {AUTH_TOKEN:'process-auth',SETFARM_OPERATIONAL_WRITE_TOKEN:'process-write',MC_PORT:'3083'});
 assert.equal(result.config.authToken,'process-auth');assert.equal(result.config.setfarmOperationalWriteToken,'process-write');
 assert.equal(result.config.port,3083);assert.equal(result.config.host,'localhost');assert.equal(result.environment.MINIMAX_API_KEY,'local-minimax');
 for(const [key,value] of Object.entries({LLM_API_KEY:'llm',GEMINI_API_KEY:'gemini',KIMI_API_KEY:'kimi',KIMI_QUOTA_TTL_MS:'5000',
  TELEGRAM_BOT_TOKEN:'telegram',TELEGRAM_CHAT_ID:'chat',DISCORD_CH_ALERTS:'alerts'}))assert.equal(result.environment[key],value);
 assert.equal(result.config.gatewayToken,'gateway');assert.equal(result.config.projectsJson,'/selected/projectsJson');
 assert.equal(Object.isFrozen(result.config),true);assert.equal(Object.isFrozen(result.PATHS),true);
});
test('selected dotenv cannot introduce or override captured runtime/path/DB/process/protected mode inputs',()=>{
 const protectedKeys=['SETFARM_INSTALLATION_DIR','SETFARM_REPO_DIR','SETFARM_PG_URL','DATABASE_URL','DB_BACKEND',
  'SETFARM_DIR','SETFARM_ENV_DIR','SETFARM_DB_PATH','PROJECTS_DIR','SCRIPTS_DIR','CLI_PATH','SETFARM_PROJECTS_ROOT',
  'SETFARM_WORKSPACE_PROJECTS_ROOT','OPENCLAW_PROJECTS_ROOT','PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE',
  'PGOPTIONS','PGSERVICE','SETFARM_PLATFORM_ROOT','SETFARM_PRODUCT_ARTIFACT_DIR','SETFARM_CONVERGENCE_RESULT_DIR',
  'SETFARM_ARTIFACT_MAX_PAYLOAD_BYTES','SETFARM_ARTIFACT_ROOT_QUOTA_BYTES','SETFARM_ARTIFACT_MIN_FREE_BYTES',
  'SETFARM_ARTIFACT_STORE_AUTHORITY_V1','OPENCLAW_STATE_DIR','OPENCLAW_CONFIG_PATH','PROJECTS_JSON','DATA_JSON',
  'AVATARS_DIR','MOBILE_DIR','EVENTS_JSONL','SETFARM_EVENTS_JSONL','SESSIONS_DIR','TRANSCRIPTS_DIR','AGENTS_DIR',
  'PORT_REGISTRY','SETFARM_PROJECTS_DIR','OPENCLAW_PROJECTS_DIR','SETFARM_INTERNAL_PRODUCTION_COLD_CHILD',
  'SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY','MC_TASK6A_SELECTED_CLI_NO_SPAWN_V1','SETFARM_SKIP_RUNTIME_INTEGRITY',
  'SETFARM_FUTURE_RUNTIME_MODE','NODE_OPTIONS','NODE_PATH','GIT_CONFIG_COUNT','DYLD_INSERT_LIBRARIES','LD_PRELOAD',
  'PATH','HOME','TMPDIR','JOBS_JSON','CLAWTABS_CONFIG','SERVE_BIN','MC_REPO_DIR'];
 const inherited={SETFARM_INSTALLATION_DIR:'/selected',SETFARM_REPO_DIR:'/release',PATH:'/safe'};
 const result=configComponent(true,{'.env':protectedKeys.map(key=>key+'=/foreign').join('\n'),'.env.local':'AUTH_TOKEN=auth'},inherited);
 for(const key of protectedKeys)assert.equal(result.environment[key],(inherited as Record<string,string>)[key],key);
 assert.equal(result.config.authToken,'auth');
});
test('legacy dotenv semantics retain runtime keys, quoted values and exact file/process precedence',()=>{
 const result=configComponent(false,{'.env':'AUTH_TOKEN=first\nSETFARM_REPO_DIR=/legacy\nexport MC_HOST="first host"\nMC_PORT=3081',
  '.env.local':"AUTH_TOKEN='second'\nMC_HOST=second-host\nMC_PORT=3082"},{AUTH_TOKEN:'',MC_PORT:'3084'});
 assert.equal(result.config.authToken,'');assert.equal(result.config.port,3084);assert.equal(result.config.host,'second-host');
 assert.equal(result.environment.SETFARM_REPO_DIR,'/legacy');assert.equal(result.PATHS.setfarmRepoDir,'/legacy');
});

function component(ports:Record<string,unknown>={}){
 const text=source('server/services/fresh-prd-workflow-run.ts'),tree=ts.createSourceFile('service.ts',text,ts.ScriptTarget.Latest,true);
 const names=['privateDirectory','cleanupOwnedTaskV1','sameOwnedIdentityV1','readOwnedRegularFileV1','captureOwnedProjectV1',
  'cleanupBusyOwnedArtifactsV1','validateFreshPrdScreensV1','startFreshPrdWorkflowV1','freshPrdStartFailureV1'];
 const statements=tree.statements.filter(node=>(ts.isFunctionDeclaration(node)&&!!node.name&&names.includes(node.name.text))
  ||(ts.isClassDeclaration(node)&&node.name?.text==='FreshPrdStartErrorV1')
  ||(ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>ts.isIdentifier(d.name)
   &&['IDENTITY_KEYS','OWNED_PROJECT_LIMITS_V1','WORKFLOW'].includes(d.name.text)))).map(node=>node.getText(tree));
 const cliText=source('server/utils/cli.ts'),cliTree=ts.createSourceFile('cli.ts',cliText,ts.ScriptTarget.Latest,true);
 const busy=cliTree.statements.filter(node=>ts.isClassDeclaration(node)&&node.name?.text==='FreshWorkflowCliBusyErrorV1');assert.equal(busy.length,1);
 const inputs={fs,path,createHash,randomUUID,...ports};
 return new Function(...Object.keys(inputs),compile(busy[0]!.getText(cliTree)+'\n'+statements.join('\n'))+`;return {
  capture:typeof captureOwnedProjectV1==='undefined'?undefined:captureOwnedProjectV1,
  read:typeof readOwnedRegularFileV1==='undefined'?undefined:readOwnedRegularFileV1,
  cleanup:typeof cleanupBusyOwnedArtifactsV1==='undefined'?undefined:cleanupBusyOwnedArtifactsV1,
  start:startFreshPrdWorkflowV1,failure:freshPrdStartFailureV1,Busy:FreshWorkflowCliBusyErrorV1};`)(...Object.values(inputs));
}
function fixture(){
 const directory=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'mc-pr35-owned-')));fs.chmodSync(directory,0o700);
 const repository=path.join(directory,'project'),taskFile=path.join(directory,'task.txt');fs.mkdirSync(repository,0o700);
 fs.mkdirSync(path.join(repository,'.git'),0o700);fs.writeFileSync(path.join(repository,'.git','config'),'component git data',{mode:0o600});
 fs.mkdirSync(path.join(repository,'assets'),0o700);fs.writeFileSync(path.join(repository,'assets','screen.html'),'component asset',{mode:0o600});
 fs.writeFileSync(taskFile,'component private PRD',{mode:0o600});
 return {directory,repository,taskFile,identity:fs.lstatSync(repository,{bigint:true}),dispose(){fs.rmSync(directory,{recursive:true,force:true});}};
}
test('actual bounded snapshot/hash cleanup removes only unchanged exclusively new project and task',()=>{
 const f=fixture();try{const c=component();assert.equal(typeof c.capture,'function');
  const project=c.capture(f.repository,f.identity),task=c.read(f.taskFile,{bytes:0});
  assert.equal(task.sha256,createHash('sha256').update('component private PRD').digest('hex'));
  c.cleanup(project,f.taskFile,task);assert.equal(fs.existsSync(f.repository),false);assert.equal(fs.existsSync(f.taskFile),false);
 }finally{f.dispose();}
});
test('changed file/task, added foreign entry, symlink and replacement root all refuse before any cleanup leaf',()=>{
 for(const change of ['file','task','foreign','symlink','root'] as const){
  const f=fixture();try{const c=component();assert.equal(typeof c.capture,'function');
   const project=c.capture(f.repository,f.identity),task=c.read(f.taskFile,{bytes:0});
   if(change==='file')fs.writeFileSync(path.join(f.repository,'assets','screen.html'),'changed asset');
   if(change==='task')fs.writeFileSync(f.taskFile,'changed private PRD');
   if(change==='foreign')fs.writeFileSync(path.join(f.repository,'foreign.txt'),'foreign',{mode:0o600});
   if(change==='symlink')fs.symlinkSync(f.taskFile,path.join(f.repository,'foreign-link'));
   if(change==='root'){fs.renameSync(f.repository,f.repository+'-old');fs.mkdirSync(f.repository,0o700);}
   assert.throws(()=>c.cleanup(project,f.taskFile,task));assert.equal(fs.existsSync(f.taskFile),true,change);
   const original=change==='root'?f.repository+'-old':f.repository;
   assert.equal(fs.readFileSync(path.join(original,'.git','config'),'utf8'),'component git data',change);
   if(change==='foreign')assert.equal(fs.readFileSync(path.join(f.repository,'foreign.txt'),'utf8'),'foreign');
  }finally{f.dispose();}
 }
});
test('owned graph reader rejects symlinks, oversized files and non-private write permissions without reading payloads',()=>{
 for(const change of ['symlink','large','permissions'] as const){const f=fixture();try{
  const c=component();assert.equal(typeof c.capture,'function');const file=path.join(f.repository,'invalid');
  if(change==='symlink')fs.symlinkSync(f.taskFile,file);
  if(change==='large'){const fd=fs.openSync(file,'wx',0o600);try{fs.ftruncateSync(fd,8*1024*1024+1);}finally{fs.closeSync(fd);}}
  if(change==='permissions'){fs.writeFileSync(file,'foreign writable',{mode:0o600});fs.chmodSync(file,0o666);}
  assert.throws(()=>c.capture(f.repository,f.identity));assert.equal(fs.existsSync(f.taskFile),true);
 }finally{f.dispose();}}
});

test('actual service busy path is not-started, cleans unchanged owned names and permits the same-name retry; unknown retains both',async()=>{
 for(const mode of ['busy','unknown','changed-busy'] as const){
  const directory=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'mc-pr35-composer-')));fs.chmodSync(directory,0o700);
  const projectsDir=path.join(directory,'projects'),setfarmDir=path.join(directory,'state');fs.mkdirSync(projectsDir,0o700);fs.mkdirSync(setfarmDir,0o700);
  const repository=path.join(projectsDir,'repeat-project');let calls=0,c:any;
  try{
   c=component({assertFreshMissionControlRuntimeV1:()=>{},assertFreshMissionControlWorkflowAssetsV1:async()=>{},
    freshMissionControlPathsV1:()=>({projectsDir,setfarmDir}),freshMissionControlSourceShaV1:()=>'a'.repeat(40),
    freshMissionControlSqlV1:()=>({begin(){throw Error('NO_SQL_ON_PRELAUNCH_REFUSAL');}}),
    getPrd:async()=>({id:'component',title:'Repeat Project',platform:'web',prd_content:'Component PRD',prd_version:1,mockup_screens:null,run_id:null}),
    projectGitV1:async(repo:string)=>{fs.mkdirSync(path.join(repo,'.git'),0o700);fs.writeFileSync(path.join(repo,'.git','config'),'component',{mode:0o600});},
    runCliRaw:async()=>{calls++;if(mode==='changed-busy')fs.writeFileSync(path.join(repository,'foreign.txt'),'foreign',{mode:0o600});
     if(mode!=='unknown')throw new c.Busy();throw Error('COMPONENT_TERMINAL_ACK_LOSS');}});
   async function attempt(){let caught:unknown;try{await c.start({prdId:'component'});}catch(error){caught=error;}
    assert.ok(caught);return c.failure(caught);}
   const result=await attempt();assert.equal(result.acceptance,mode==='unknown'?'unknown':'not-started');assert.equal(calls,1);
   if(mode==='busy'){
    assert.equal(result.repoPath,null);assert.equal(fs.existsSync(repository),false);assert.deepEqual(fs.readdirSync(setfarmDir),[]);
    const retry=await attempt();assert.equal(retry.acceptance,'not-started');assert.equal(calls,2);assert.equal(fs.existsSync(repository),false);
   }else{
    assert.equal(fs.existsSync(repository),true);assert.equal(fs.readdirSync(setfarmDir).filter(name=>name.startsWith('.prd-task-')).length,1);
    if(mode==='changed-busy')assert.equal(fs.readFileSync(path.join(repository,'foreign.txt'),'utf8'),'foreign');
   }
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
 }
});
