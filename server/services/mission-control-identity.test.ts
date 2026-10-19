import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test } from 'node:test';
import ts from 'typescript';

const execFileAsync=promisify(execFile);
export function identityService(state: unknown={status:'unavailable',code:'fixture-unavailable'}) {
  const file=new URL('./mission-control-identity.ts',import.meta.url);
  assert.ok(existsSync(file),'production MC identity reader must exist');
  const source=readFileSync(file,'utf8'); const tree=ts.createSourceFile('identity.ts',source,ts.ScriptTarget.Latest,true);
  const body=tree.statements.filter(node=>!ts.isImportDeclaration(node)).map(node=>node.getText(tree)).join('\n');
  const js=ts.transpileModule(body,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/^export /gm,'').replaceAll('import.meta.url',JSON.stringify(file.href));
  return new Function('path','fileURLToPath','readFile','execFile','promisify','productBuildAuthorityV2LoadedBuildStartupStateV1',js+';return {readMissionControlIdentity,resolveMissionControlRoot};')(
    path,fileURLToPath,async (name:string,encoding:string)=> (await import('node:fs/promises')).readFile(name,encoding as 'utf8'),execFile,promisify,()=>state);
}

test('module-relative source and dist roots agree; explicit permitted override wins without project fallback',()=>{
  const service=identityService();
  assert.equal(service.resolveMissionControlRoot('file:///fixture/mc/server/services/mission-control-identity.ts',undefined),'/fixture/mc');
  assert.equal(service.resolveMissionControlRoot('file:///fixture/mc/dist-server/services/mission-control-identity.js',undefined),'/fixture/mc');
  assert.equal(service.resolveMissionControlRoot('file:///fixture/mc/server/services/mission-control-identity.ts','/explicit/mc'),'/explicit/mc');
});

test('actual temp MC checkout identity never claims checkout-ahead bytes are loaded',async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'mc-identity-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(path.join(root,'server/services'),{recursive:true});
  await writeFile(path.join(root,'package.json'),'{"name":"mission-control","version":"7.8.9"}');
  const git=async(...args:string[])=>(await execFileAsync('/usr/bin/git',['-C',root,...args],{env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'}})).stdout.trim();
  await git('init','-q'); await git('add','package.json'); await git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','first'); const loadedSha=await git('rev-parse','HEAD');
  await writeFile(path.join(root,'CHANGELOG.md'),'Checkout ahead');await git('add','CHANGELOG.md');await git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','second');const checkoutSha=await git('rev-parse','HEAD');
  const state={status:'available',response:{loadedBuild:{buildIdentity:{sourceSha:loadedSha,buildHash:'a'.repeat(64)}},loadedBuildHash:'b'.repeat(64)}};
  const identity=await identityService(state).readMissionControlIdentity({moduleUrl:pathToFileURL(path.join(root,'server/services/mission-control-identity.ts')).href});
  assert.equal(identity.version,'7.8.9');assert.equal(identity.checkout.commit,checkoutSha);assert.equal(identity.checkout.status,'available');
  assert.equal(identity.loadedBuild.sourceSha,loadedSha);assert.equal(identity.loadedBuild.status,'available');assert.equal(identity.checkoutMatchesLoaded,false);
  assert.equal(identity.builtAt,null,'read time is not build time');
});

test('missing package or git reports unavailable explicitly without fake commit/build time',async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'mc-identity-missing-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const service=identityService();const options={moduleUrl:pathToFileURL(path.join(root,'server/services/mission-control-identity.ts')).href};
  const missing=await service.readMissionControlIdentity(options);assert.equal(missing.version,null);assert.equal(missing.checkout.status,'unavailable');assert.equal(missing.checkout.commit,null);assert.equal(missing.loadedBuild.status,'unavailable');assert.equal(missing.builtAt,null);
  await writeFile(path.join(root,'package.json'),'{"name":"mission-control","version":"1.2.3"}');
  const noGit=await service.readMissionControlIdentity(options);assert.equal(noGit.version,'1.2.3');assert.equal(noGit.checkout.status,'unavailable');
});

test('a package nested under an unrelated git checkout does not borrow the parent SHA',async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'mc-identity-parent-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const git=async(...args:string[])=>(await execFileAsync('/usr/bin/git',['-C',root,...args],{env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'}})).stdout.trim();
  await writeFile(path.join(root,'parent.txt'),'parent');await git('init','-q');await git('add','.');await git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','parent');
  const nested=path.join(root,'missing-checkout');await mkdir(nested);await writeFile(path.join(nested,'package.json'),'{"name":"mission-control","version":"1.2.3"}');
  const value=await identityService().readMissionControlIdentity({repoDir:nested});
  assert.equal(value.checkout.status,'unavailable');assert.equal(value.checkout.commit,null);
});
