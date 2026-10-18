/** Selected PRD start composition. Receipt DATA alone is never run authority. */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getPrd } from './prd-db.js';
import { prepareDesignFilesForRepo, type StitchScreen } from './stitch-integration.js';
import { runCliRaw, FreshWorkflowCliBusyErrorV1 } from '../utils/cli.js';
import { assertFreshMissionControlRuntimeV1, assertFreshMissionControlWorkflowAssetsV1,
  freshMissionControlPathsV1, freshMissionControlSourceShaV1, freshMissionControlSqlV1 } from './fresh-installation-runtime.js';

type Protocol = 'legacy' | 'shadow' | 'v3';
export type FreshWorkflowRunAcceptanceV1 = Readonly<{
  schema:'setfarm.workflow-run-accepted.v1'; accepted:true; runId:string; runNumber:number;
  workflowId:string; protocol:Protocol; protocolVersion:1; status:'running'; compilerReleaseSha:string;
}>;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const WORKFLOW = /^[a-z][a-z0-9-]{0,79}$/;
const SOURCE = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const RECEIPT_KEYS = ['accepted','compilerReleaseSha','protocol','protocolVersion','runId','runNumber','schema','status','workflowId'];
/** Strict wire parser only; the service still joins the actual selected DB row. */
export function parseFreshWorkflowRunAcceptanceV1(raw:string,workflowId:string,sourceSha:string):FreshWorkflowRunAcceptanceV1 {
  if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>8192||!raw.endsWith('\n')||raw.indexOf('\n')!==raw.length-1)throw Error('MC_FRESH_WORKFLOW_RECEIPT_INVALID');
  const text=raw.slice(0,-1),value:unknown=JSON.parse(text);
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('MC_FRESH_WORKFLOW_RECEIPT_INVALID');
  const r=value as Record<string,unknown>;
  if(Object.keys(r).sort().join(',')!==RECEIPT_KEYS.join(',')||JSON.stringify(value)!==text
    ||r.schema!=='setfarm.workflow-run-accepted.v1'||r.accepted!==true
    ||typeof r.runId!=='string'||!UUID.test(r.runId)||!Number.isSafeInteger(r.runNumber)||(r.runNumber as number)<1
    ||typeof r.workflowId!=='string'||!WORKFLOW.test(r.workflowId)||r.workflowId!==workflowId
    ||!['legacy','shadow','v3'].includes(r.protocol as string)||r.protocolVersion!==1||r.status!=='running'
    ||typeof r.compilerReleaseSha!=='string'||!SOURCE.test(r.compilerReleaseSha)||r.compilerReleaseSha!==sourceSha)throw Error('MC_FRESH_WORKFLOW_RECEIPT_INVALID');
  return Object.freeze({...r}) as FreshWorkflowRunAcceptanceV1;
}

/** Only IDs passed to the existing cache-copy helper can become cache paths. */
function validateFreshPrdScreensV1(value:unknown):Readonly<{projectId:string;screens:StitchScreen[]}> {
  if(value===null||value===undefined)return {projectId:'',screens:[]};
  if(!Array.isArray(value)||value.length>200)throw Error('MC_FRESH_DESIGN_INPUT_INVALID');
  if(value.length===0)return {projectId:'',screens:[]};
  const first=value[0] as Record<string,unknown>|null;
  if(!first||typeof first!=='object')throw Error('MC_FRESH_DESIGN_INPUT_INVALID');
  if(first.projectId===undefined||first.projectId===null||first.projectId==='')return {projectId:'',screens:[]};
  const projectId=first.projectId;
  if(typeof projectId!=='string'||!/^[a-f0-9-]{1,128}$/i.test(projectId))throw Error('MC_FRESH_DESIGN_INPUT_INVALID');
  const screens=value.map((raw:unknown):StitchScreen=>{
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('MC_FRESH_DESIGN_INPUT_INVALID');
    const s=raw as Record<string,unknown>;
    if(typeof s.id!=='string'||!/^[a-f0-9-]{1,128}$/i.test(s.id)
      ||(s.projectId!==undefined&&s.projectId!==projectId))throw Error('MC_FRESH_DESIGN_INPUT_INVALID');
    const title=typeof s.name==='string'?s.name:s.id;
    if(title.length>200)throw Error('MC_FRESH_DESIGN_INPUT_INVALID');
    return {screenId:s.id,title,htmlUrl:typeof s.htmlUrl==='string'?s.htmlUrl:null,
      screenshotUrl:typeof s.screenshotUrl==='string'?s.screenshotUrl:null,localHtml:typeof s.localHtml==='string'?s.localHtml:null,
      width:typeof s.width==='number'?s.width:undefined,height:typeof s.height==='number'?s.height:undefined,
      status:typeof s.status==='string'?s.status:'done'};
  });
  return {projectId,screens};
}

type RunRow = { id:string; run_number:string; workflow_id:string; task:string; protocol:string; protocol_version:number; compiler_release_sha:string; status:string };
function assertFreshAcceptedRunRowV1(rows:readonly RunRow[],receipt:FreshWorkflowRunAcceptanceV1,task:string):void {
  const r=rows[0];
  if(rows.length!==1||!r||r.id!==receipt.runId||r.run_number!==String(receipt.runNumber)||r.workflow_id!==receipt.workflowId
    ||r.task!==task||r.protocol!==receipt.protocol||r.protocol_version!==receipt.protocolVersion
    ||r.compiler_release_sha!==receipt.compilerReleaseSha||typeof r.status!=='string'||!r.status)throw Error('MC_FRESH_WORKFLOW_ROW_MISMATCH');
  // Current status may already have advanced since the committed CLI snapshot.
}
class FreshPrdStartErrorV1 extends Error {
  constructor(readonly acceptance:'not-started'|'unknown'|'accepted',readonly runId:string|null,readonly repoPath:string|null){
    super(acceptance==='accepted'?'Run accepted, but its PRD link or final cleanup was not confirmed. Do not start another run.'
      :acceptance==='unknown'?'Run acceptance could not be confirmed. Do not start another run until this attempt is checked.'
      :'The workflow was not started. Check the selected installation and project inputs.');
  }
}
export function freshPrdStartFailureV1(error:unknown){
  const actual=error instanceof FreshPrdStartErrorV1?error:new FreshPrdStartErrorV1('not-started',null,null);
  return {schema:'mission-control.workflow-start-result.v1',success:false as const,acceptance:actual.acceptance,
    runId:actual.runId,repoPath:actual.repoPath,error:actual.message,retrySafe:false as const};
}
function privateDirectory(directory:string):fs.BigIntStats {
  const s=fs.lstatSync(directory,{bigint:true});
  if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==BigInt(process.getuid!())||(s.mode&0o7777n)!==0o700n||fs.realpathSync(directory)!==directory)throw Error('MC_FRESH_PROJECT_DIRECTORY_INVALID');
  return s;
}
const IDENTITY_KEYS=['dev','ino','mode','nlink','uid','gid','size','mtimeNs','ctimeNs'] as const;
function cleanupOwnedTaskV1(file:string,before:fs.BigIntStats):void {
  const now=fs.lstatSync(file,{bigint:true});
  if(!now.isFile()||IDENTITY_KEYS.some(key=>now[key]!==before[key]))throw Error('MC_FRESH_TASK_FILE_CHANGED');
  fs.unlinkSync(file); // Checked same-owner name, not an atomic unlink claim.
}
const gitAsync=promisify(execFile);
function gitEnvironmentV1():NodeJS.ProcessEnv {
  const environment:NodeJS.ProcessEnv={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'};
  for(const key of Object.keys(environment))if(key.startsWith('GIT_')&&!['GIT_CONFIG_NOSYSTEM','GIT_CONFIG_GLOBAL'].includes(key))delete environment[key];
  return environment;
}
async function projectGitV1(repository:string,args:readonly string[]):Promise<void>{
  await gitAsync('/usr/bin/git',['-c','core.hooksPath=/dev/null','-c','user.name=Setfarm','-c','user.email=setfarm@localhost',...args],
    {cwd:repository,env:gitEnvironmentV1(),timeout:30_000,maxBuffer:65_536});
}

/** Fixed actual gates/client/CLI only; no observer callback, SQL or receipt port. */
export async function startFreshPrdWorkflowV1(params:{prdId?:unknown;projectName?:unknown;workflow?:unknown}){
  let attempted=false,reportedRunId:string|null=null,confirmed:FreshWorkflowRunAcceptanceV1|undefined,repoPath:string|null=null;
  try{
    assertFreshMissionControlRuntimeV1();
    const workflowId=params.workflow===undefined?'feature-dev':params.workflow;
    if(typeof params.prdId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(params.prdId)
      ||typeof workflowId!=='string'||!WORKFLOW.test(workflowId))throw Error('MC_FRESH_WORKFLOW_INPUT_INVALID');
    await assertFreshMissionControlWorkflowAssetsV1(workflowId);
    assertFreshMissionControlRuntimeV1();
    const paths=freshMissionControlPathsV1(),sourceSha=freshMissionControlSourceShaV1(),sql=freshMissionControlSqlV1();
    if(!paths||!sql)throw Error('MC_FRESH_SELECTED_RUNTIME_REQUIRED');
    const prd=await getPrd(params.prdId);
    assertFreshMissionControlRuntimeV1();
    if(!prd||typeof prd.prd_content!=='string'||!prd.prd_content.trim()||(!Number.isSafeInteger(prd.prd_version)||prd.prd_version<1))throw Error('MC_FRESH_PRD_UNAVAILABLE');
    const name=params.projectName===undefined?prd.title:params.projectName;
    if(typeof name!=='string'||!name.trim()||name.length>200)throw Error('MC_FRESH_PROJECT_NAME_INVALID');
    const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug))throw Error('MC_FRESH_PROJECT_NAME_INVALID');
    const designInput=validateFreshPrdScreensV1(prd.mockup_screens); // Before any new project/file effect.
    privateDirectory(paths.projectsDir);
    repoPath=path.join(paths.projectsDir,slug);
    // A new request never adopts/repairs a previous project, alias or unknown run.
    fs.mkdirSync(repoPath,{mode:0o700});
    const repoIdentity=privateDirectory(repoPath);
    const check=():void=>{
      assertFreshMissionControlRuntimeV1();const now=privateDirectory(repoPath!);
      if(now.dev!==repoIdentity.dev||now.ino!==repoIdentity.ino)throw Error('MC_FRESH_PROJECT_DIRECTORY_CHANGED');
    };
    await projectGitV1(repoPath,['init','--initial-branch=main','--template=','.']);check();
    const stitchProjectId=designInput.projectId;let screenMapStr='';
    if(stitchProjectId){
      const design=await prepareDesignFilesForRepo(stitchProjectId,designInput.screens,repoPath);check();
      screenMapStr=JSON.stringify(design.screenMap);
      await projectGitV1(repoPath,['add','--','stitch/','.stitch']);check();
      await projectGitV1(repoPath,['commit','-m','design: add Stitch mockup screens']);check();
    }
    let task=`Project: ${name}\nPlatform: ${prd.platform}\nRepo: ${repoPath}`;
    if(stitchProjectId)task+=`\nSTITCH_PROJECT_ID: ${stitchProjectId}`;
    if(screenMapStr)task+=`\nSCREEN_MAP: ${screenMapStr}`;
    task+=`\n\n${prd.prd_content}`;task=task.trim();
    if(Buffer.byteLength(task,'utf8')>2*1024*1024)throw Error('MC_FRESH_TASK_TOO_LARGE');
    check();privateDirectory(paths.setfarmDir);
    const taskFile=path.join(paths.setfarmDir,'.prd-task-'+randomUUID()+'.txt');
    fs.writeFileSync(taskFile,task,{flag:'wx',mode:0o600});
    const taskIdentity=fs.lstatSync(taskFile,{bigint:true});
    if(!taskIdentity.isFile()||taskIdentity.nlink!==1n||taskIdentity.uid!==BigInt(process.getuid!())||(taskIdentity.mode&0o7777n)!==0o600n
      ||taskIdentity.size!==BigInt(Buffer.byteLength(task,'utf8'))||fs.realpathSync(taskFile)!==taskFile)throw Error('MC_FRESH_TASK_FILE_INVALID');
    check();attempted=true;
    // This promise settles on the actual execFile child callback/terminal path.
    // Fixed selected workflow120s/1MiB capture; other CLI commands keep25s.
    // Capacity refusal is proved before launch; all other errors may follow COMMIT.
    let output:string;
    try{output=await runCliRaw('setfarm',['workflow','run',workflowId,'@'+taskFile,'--json']);}
    catch(error){if(error instanceof FreshWorkflowCliBusyErrorV1)attempted=false;throw error;}
    const receipt=parseFreshWorkflowRunAcceptanceV1(output,workflowId,sourceSha);reportedRunId=receipt.runId;check();
    await sql.begin(async tx=>{
      await tx.unsafe("SELECT set_config('lock_timeout','1000ms',true),set_config('statement_timeout','5000ms',true),set_config('search_path','public',true)");
      const rows=await tx.unsafe<RunRow[]>(`SELECT id,run_number::text AS run_number,workflow_id,task,protocol,protocol_version,compiler_release_sha,status
        FROM public.runs WHERE id=$1 LIMIT 2`,[receipt.runId]);
      assertFreshAcceptedRunRowV1(rows,receipt,task);confirmed=receipt;
      const linked=await tx.unsafe<Array<{run_id:string}>>(`UPDATE public.prds SET run_id=$1,updated_at=NOW()
        WHERE id=$2 AND prd_content=$3 AND prd_version=$4 AND run_id IS NOT DISTINCT FROM $5 RETURNING run_id`,
        [receipt.runId,prd.id,prd.prd_content,prd.prd_version,prd.run_id]);
      if(linked.length!==1||linked[0]?.run_id!==receipt.runId)throw Error('MC_FRESH_PRD_LINK_CHANGED');
    });
    check();cleanupOwnedTaskV1(taskFile,taskIdentity);
    return {success:true as const,accepted:true as const,runId:receipt.runId,repoPath,acceptance:receipt,output:'Run accepted'};
  }catch{
    // Task/new-project evidence is preserved on unknown acceptance. No retry,
    // latest-row lookup or manual acknowledgement deletion is performed.
    throw new FreshPrdStartErrorV1(confirmed?'accepted':attempted?'unknown':'not-started',confirmed?.runId??reportedRunId,repoPath);
  }
}
