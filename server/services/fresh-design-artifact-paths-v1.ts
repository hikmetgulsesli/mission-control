/** Fixed selected design paths; no entry, SQL or provider authority is created. */
import { lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { freshMissionControlPathsV1, type FreshMissionControlPathsV1 } from './fresh-installation-runtime.js';

function refuse(): never { throw Error('MC_FRESH_DESIGN_INPUT_INVALID'); }
function identifier(value: unknown): asserts value is string {
  if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(value))refuse();
}
function filename(value: unknown): asserts value is string {
  if(typeof value!=='string'||!value||value==='.'||value==='..'||value!==path.basename(value)
    ||/[\\\x00-\x1f\x7f]/.test(value)||Buffer.byteLength(value)>255)refuse();
}
function child(root:string,target:string):string {
  const relative=path.relative(root,target);
  if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))refuse();
  return relative;
}
/** Missing descendants may be omitted/created; existing aliases never qualify. */
function owned(root:string,target:string,kind:'directory'|'file'):boolean {
  const relative=target===root?'':child(root,target),parts=relative?relative.split(path.sep):[];
  const names=[root,...parts.map((_part,index)=>path.join(root,...parts.slice(0,index+1)))];
  for(let index=0;index<names.length;index++){
    const name=names[index]!,last=index===names.length-1;
    let stat;
    try{stat=lstatSync(name);}catch(error){if(index>0&&(error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error;}
    if(stat.isSymbolicLink()||stat.uid!==process.getuid!()||(stat.mode&0o022)!==0)refuse();
    if(last&&kind==='file'){
      if(!stat.isFile()||stat.nlink!==1)refuse();
    }else if(!stat.isDirectory()||realpathSync(name)!==name)refuse();
  }
  return true;
}
function cacheRoot(selected:FreshMissionControlPathsV1):string {
  const root=path.join(selected.setfarmDir,'stitch-cache');owned(selected.setfarmDir,root,'directory');return root;
}
function cacheDirectory(selected:FreshMissionControlPathsV1,projectId:unknown):string {
  identifier(projectId);const root=cacheRoot(selected),directory=path.join(root,projectId);
  owned(selected.setfarmDir,directory,'directory');return directory;
}
function repository(selected:FreshMissionControlPathsV1,value:unknown):string|null {
  if(value===undefined||value===null||value==='')return null;
  if(typeof value!=='string'||!path.isAbsolute(value)||path.normalize(value)!==value||path.resolve(value)!==value||/[\x00-\x1f\x7f]/.test(value))refuse();
  child(selected.projectsDir,value); // Foreign/root/alias syntax refuses even when absent.
  return owned(selected.projectsDir,value,'directory')?value:null;
}
export function assertSelectedDesignIdsV1(projectId:unknown,screenIds:readonly unknown[]=[]):void {
  if(!freshMissionControlPathsV1())return;
  identifier(projectId);for(const screenId of screenIds)identifier(screenId);
}
export function selectedDesignCacheRootV1():string|null {
  const selected=freshMissionControlPathsV1();return selected?cacheRoot(selected):null;
}
export function selectedDesignCacheDirectoryV1(projectId:unknown):string|null {
  const selected=freshMissionControlPathsV1();return selected?cacheDirectory(selected,projectId):null;
}
export function selectedDesignRepositoryV1(value:unknown):string|null {
  const selected=freshMissionControlPathsV1();return selected?repository(selected,value):null;
}
export function selectedDesignRepositoryPathV1(value:unknown,relative:string):string|null {
  const selected=freshMissionControlPathsV1();if(!selected)return null;
  const repo=repository(selected,value);if(!repo)refuse();
  if(relative!=='.stitch'&&relative!=='stitch'&&relative!=='.setfarm/RUN_CONTRACT.json'
    &&relative!=='dist/index.html'&&!relative.startsWith('stitch/'))refuse();
  const leaf=relative.startsWith('stitch/')?relative.slice(7):relative;
  if(relative.startsWith('stitch/'))filename(leaf);
  const target=path.join(repo,relative);
  owned(selected.projectsDir,target,relative==='stitch'?'directory':'file');return target;
}
export function selectedDesignArtifactFileV1(directory:string,value:unknown):string|null {
  const selected=freshMissionControlPathsV1();if(!selected)return null;
  filename(value);
  const cache=path.join(selected.setfarmDir,'stitch-cache'),fromCache=path.relative(cache,directory);
  if(fromCache&&!fromCache.includes(path.sep)&&fromCache!=='..'&&!path.isAbsolute(fromCache)){
    identifier(fromCache);cacheDirectory(selected,fromCache);
    const target=path.join(directory,value);owned(selected.setfarmDir,target,'file');return target;
  }
  if(path.basename(directory)!=='stitch')refuse();
  const repo=repository(selected,path.dirname(directory));if(!repo)refuse();
  const target=path.join(directory,value);owned(selected.projectsDir,target,'file');return target;
}
