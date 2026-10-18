import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import express from 'express';
import { marked } from 'marked';
import ts from 'typescript';

function js(file: string) {
  const source=readFileSync(new URL(file,import.meta.url),'utf8'); const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
  const body=tree.statements.filter(node=>!ts.isImportDeclaration(node)&&!ts.isExportAssignment(node)).map(node=>node.getText(tree)).join('\n');
  return ts.transpileModule(body,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/^export /gm,'').replaceAll('import.meta.url',JSON.stringify(new URL(file,import.meta.url).href));
}
async function fixture(t: {after(fn:()=>Promise<void>):void}, page=false) {
  const root=await mkdtemp(path.join(tmpdir(),'mc-changelog-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const mc=path.join(root,'actual-mc'),sf=path.join(root,'sf'),projects=path.join(root,'projects');
  const git=async(dir:string,...args:string[])=>(await promisify(execFile)('/usr/bin/git',['-C',dir,...args],{env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'}})).stdout.trim();
  const shas: Record<string,string>={};
  for(const [name,dir] of [['mc',mc],['setfarm',sf],['decoy',path.join(projects,'mission-control')]]){
    await mkdir(dir,{recursive:true}); await writeFile(path.join(dir,'package.json'),JSON.stringify({name:name==='mc'?'mission-control':name,version:name==='mc'?'7.8.9':'0.0.0'}));
    await writeFile(path.join(dir,'CHANGELOG.md'),`# ${name} release notes`);
    await git(dir,'init','-q');await git(dir,'add','.');await git(dir,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm',name+' fixture commit');shas[name]=await git(dir,'rev-parse','HEAD');
  }
  await mkdir(path.join(sf,'dist')); await writeFile(path.join(sf,'dist/BUILD_INFO.json'),JSON.stringify({sha:shas.setfarm,branch:'fixture',builtAt:'2026-10-01T00:00:00Z'}));
  const identityBody=js('../services/mission-control-identity.ts');
  const service=new Function('path','fileURLToPath','readFile','execFile','promisify','productBuildAuthorityV2LoadedBuildStartupStateV1',identityBody+';return {readMissionControlIdentity,resolveMissionControlRoot};')(
    path,fileURLToPath,readFile,execFile,promisify,()=>({status:'unavailable',code:'fixture-unavailable'}));
  // The package locator is the only substituted identity input. The real reader
  // still obtains package/git and unavailable loaded authority independently.
  const readIdentity=()=>service.readMissionControlIdentity({repoDir:mc});
  const router=new Function('Router','exec','promisify','path','PATHS','readFile','marked','resolveMissionControlRoot','readMissionControlIdentity',js(page?'./changelog-page.ts':'./changelog.ts')+';return router;')(
    express.Router,exec,promisify,path,{setfarmRepoDir:sf,projectsDir:projects},readFile,marked,()=>mc,readIdentity);
  const app=express();app.use(page?'/':'/api',router);const server=createServer(app);server.listen(0,'127.0.0.1');await once(server,'listening');
  const address=server.address();assert.ok(address&&typeof address!=='string');t.after(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});
  return {base:`http://127.0.0.1:${address.port}`,shas};
}

test('actual changelog API keeps MC/SF roots distinct and never calls checkout SHA a loaded build',async t=>{
  const {base,shas}=await fixture(t);const response=await fetch(base+'/api/changelog');assert.equal(response.status,200);const value=await response.json();
  assert.equal(value.mc.version,'7.8.9');assert.equal(value.mc.checkout.commit,shas.mc);assert.equal(value.mc.commit,null);
  assert.equal(value.mc.loadedBuild.status,'unavailable');assert.equal(value.mc.builtAt,null);
  assert.equal(value.setfarm.commit,shas.setfarm);assert.equal(value.setfarm.builtAt,'2026-10-01T00:00:00Z');
  assert.match(value.mcChangelog,/mc release notes/);assert.doesNotMatch(value.mcChangelog,/decoy/);
  assert.ok(value.commits.some((c:any)=>c.repo==='mc'&&c.hash===shas.mc.slice(0,8)));
  assert.ok(value.commits.some((c:any)=>c.repo==='setfarm'&&c.hash===shas.setfarm.slice(0,8)));
  assert.ok(!value.commits.some((c:any)=>c.subject.includes('decoy')));
});

test('public changelog HTML labels loaded build unavailable separately from current checkout',async t=>{
  const {base,shas}=await fixture(t,true);const response=await fetch(base+'/changelog');assert.equal(response.status,200);const html=await response.text();
  assert.match(html,/7\.8\.9/);assert.match(html,new RegExp(shas.mc.slice(0,8)));assert.match(html,/checkout/i);
  assert.match(html,/loaded build.*unavailable/i);assert.doesNotMatch(html,/decoy release notes|decoy fixture commit/);
});
