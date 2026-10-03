import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants, closeSync, fstatSync, lstatSync, openSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const SOURCE_FILES = ['server/routes/telemetry.ts', 'src/lib/api.ts',
  'src/components/run-detail/TelemetryChart.tsx', 'src/lib/operational-snapshot.ts',
  'src/lib/product-build-authority.ts'];
const FORBIDDEN_PACKAGES = new Set(['typescript', 'tsx', 'esbuild', 'vite',
  'rolldown', 'playwright', 'postgres', 'fsevents', 'lightningcss']);
// Independently reviewed steps-only SELECT allowlist, not derived from route code.
export const TELEMETRY_SQL_V1 = [
  `
      SELECT s.step_id, s.agent_id, s.status,
             CASE WHEN s.started_at IS NOT NULL AND isfinite(s.started_at)
                  THEN to_char(s.started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" AD')
                  ELSE NULL END AS started_at,
             CASE WHEN s.updated_at IS NOT NULL AND isfinite(s.updated_at)
                  THEN to_char(s.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" AD')
                  ELSE NULL END AS updated_at,
             CASE WHEN s.started_at IS NOT NULL AND s.updated_at IS NOT NULL
                        AND isfinite(s.started_at) AND isfinite(s.updated_at)
                        AND s.status IN ('done', 'failed') AND s.updated_at > s.started_at
                  THEN ((((s.updated_at AT TIME ZONE 'UTC')::date - (s.started_at AT TIME ZONE 'UTC')::date)::numeric * 86400000)
                        + (EXTRACT(EPOCH FROM (s.updated_at AT TIME ZONE 'UTC')::time)
                           - EXTRACT(EPOCH FROM (s.started_at AT TIME ZONE 'UTC')::time)) * 1000)::double precision
                  ELSE NULL END AS duration_ms
      FROM steps s WHERE s.run_id = $1 ORDER BY s.step_index`,
  `
      SELECT s.step_id,
             AVG(CASE WHEN s.started_at IS NOT NULL AND s.updated_at IS NOT NULL
                           AND isfinite(s.started_at) AND isfinite(s.updated_at)
                           AND s.status IN ('done', 'failed') AND s.updated_at > s.started_at
                      THEN ((s.updated_at AT TIME ZONE 'UTC')::date - (s.started_at AT TIME ZONE 'UTC')::date)::numeric * 86400000
                           + (EXTRACT(EPOCH FROM (s.updated_at AT TIME ZONE 'UTC')::time)
                              - EXTRACT(EPOCH FROM (s.started_at AT TIME ZONE 'UTC')::time)) * 1000
                      ELSE NULL END)::double precision AS avg_ms
      FROM steps s
      WHERE s.step_id IN (SELECT current_step.step_id FROM steps current_step WHERE current_step.run_id = $1)
      GROUP BY s.step_id`,
] as const;

// Fixed independently nominated mutation of the reviewed query, never an
// arbitrary SQL override or a value derived from captured route execution.
const EXCLUDE_CURRENT_V1 = { from: 'GROUP BY s.step_id',
  to: "AND s.run_id <> 'run-contract'\n      GROUP BY s.step_id" } as const;
const TELEMETRY_EXCLUDE_CURRENT_SQL_V1 = [TELEMETRY_SQL_V1[0],
  TELEMETRY_SQL_V1[1].replace(EXCLUDE_CURRENT_V1.from, EXCLUDE_CURRENT_V1.to)];

function heldBytes(file: string) {
  const before = lstatSync(file, { bigint: true });
  assert.ok(before.isFile() && !before.isSymbolicLink());
  assert.equal(before.uid, 501n); assert.equal(before.gid, 20n);
  assert.equal(before.nlink, 1n);
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const bytes = readFileSync(fd), held = fstatSync(fd, { bigint: true });
    const after = lstatSync(file, { bigint: true });
    for (const key of ['dev', 'ino', 'uid', 'gid', 'mode', 'nlink', 'size', 'mtimeNs', 'ctimeNs'] as const) {
      assert.equal(held[key], before[key], `held ${file}:${key}`);
      assert.equal(after[key], before[key], `path ${file}:${key}`);
    }
    assert.equal(BigInt(bytes.length), before.size);
    return { bytes, pin: { dev: String(before.dev), ino: String(before.ino),
      uid: Number(before.uid), gid: Number(before.gid), mode: Number(before.mode),
      nlink: Number(before.nlink), size: bytes.length,
      mtimeNs: String(before.mtimeNs), ctimeNs: String(before.ctimeNs), sha256: digest(bytes) } };
  } finally { closeSync(fd); }
}

/** Initial post-ci admission. Never represents a pre-install byte baseline. */
function dependencyAdmission() {
  const packages = new Map<string, { root: string; json: Record<string, any> }>();
  function add(name: string, owner: string) {
    assert.ok(!FORBIDDEN_PACKAGES.has(name), `forbidden package ${name}`);
    let at = owner, candidate = '';
    for (;;) {
      const probe = path.join(at, 'node_modules', name, 'package.json');
      try { if (lstatSync(probe).isFile()) { candidate = probe; break; } } catch {}
      if (at === ROOT || !at.startsWith(ROOT + path.sep)) break;
      at = path.dirname(at);
    }
    assert.ok(candidate, `missing dependency ${name}`);
    const directory = path.dirname(candidate);
    if (packages.has(directory)) return;
    const json = JSON.parse(heldBytes(candidate).bytes.toString('utf8'));
    packages.set(directory, { root: directory, json });
    for (const dependency of Object.keys(json.dependencies || {})) add(dependency, directory);
    for (const dependency of Object.keys(json.peerDependencies || {})) {
      if (!json.peerDependenciesMeta?.[dependency]?.optional) add(dependency, directory);
    }
  }
  // debug's reviewed literal optional require is not a declared dependency.
  for (const name of ['express', 'react', 'react-dom', 'recharts', 'supports-color']) add(name, ROOT);
  const files: Record<string, ReturnType<typeof heldBytes>['pin']> = {};
  const directories = new Set<string>();
  const edges: Record<string, string[]> = {};
  for (const { root } of packages.values()) {
    function visit(directory: string) {
      directories.add(directory);
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.name === 'node_modules') continue;
        if (entry.isDirectory()) { visit(file); continue; }
        assert.ok(entry.isFile(), `nonregular approved dependency ${file}`);
        const { bytes, pin } = heldBytes(file); files[file] = pin;
        if (!/\.(?:cjs|mjs|js)$/.test(file)) continue;
        const tree = ts.createSourceFile(file, bytes.toString('utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
        const imports = new Set<string>();
        function scan(node: ts.Node) {
          if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
              && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) imports.add(node.moduleSpecifier.text);
          if (ts.isCallExpression(node) && node.arguments.length) {
            const callee = node.expression;
            const literal = node.arguments[0];
            if (ts.isStringLiteralLike(literal) && (callee.kind === ts.SyntaxKind.ImportKeyword
                || ts.isIdentifier(callee) && callee.text === 'require'
                || ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)
                  && callee.expression.text === 'require' && callee.name.text === 'resolve')) imports.add(literal.text);
          }
          ts.forEachChild(node, scan);
        }
        scan(tree); edges[pathToFileURL(file).href] = [...imports].sort();
        // Reviewed lodash aliases, not blanket arbitrary-object require permission.
        if (root.endsWith('/lodash') && ['_nodeUtil.js', 'lodash.js'].includes(entry.name)) {
          edges[pathToFileURL(file).href] = [...new Set([...imports, 'util'])].sort();
        }
      }
    }
    visit(root);
  }
  return { files, directories: [...directories], edges,
    packages: [...packages.values()].map(p => ({ name: p.json.name, version: p.json.version })) };
}

export interface ConsumerOptionsV1 {
  sqlMutation?: 'exclude-current';
  request?: string;
  requestMethod?: 'GET' | 'HEAD';
  clientRunId?: string;
  renderResult?: unknown;
  sqlFailure?: boolean;
  sqlRows?: unknown[];
  sqlAverages?: unknown[];
  readerFaults?: Array<'read' | 'cancel' | 'release'>;
  cleanupFaults?: Array<'idle' | 'server' | 'hook' | 'restore'>;
  primaryFault?: boolean;
  reply?: { status: number; body?: unknown; text?: string; bytes?: readonly number[]; contentType?: string };
  safety?: 'read-sync' | 'read-async' | 'open-async' | 'write-open' | 'write-readFile' | 'write-stream' | 'pg-miss' | 'config-miss';
  expectHarnessFault?: boolean;
  replacements?: Record<string, { from: string; to: string }>;
}

export function availableFixtureV1() {
  return { schema: 'mission-control.pipeline-telemetry.v1', status: 'available_limited', runId: 'run-contract',
    history: { state: 'unavailable', reasonCode: 'PRECISE_TRANSITION_HISTORY_UNAVAILABLE' },
    analysis: { coverage: ['historical_execution_duration'] }, transitions: [], bottlenecks: [],
    steps: [{ step_id: 'plan', agent_id: null, status: 'done',
      started_at: '2024-01-01T00:00:00.000000Z AD', updated_at: '2024-01-01T00:00:00.250000Z AD',
      duration_ms: 250, isBottleneck: false }] };
}

const CHILD = String.raw`
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { registerHooks, syncBuiltinESMExports, isBuiltin } from 'node:module';
import { createServer } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
const inputChunks=[];let inputBytes=0;for await(const chunk of process.stdin){inputBytes+=chunk.length;if(inputBytes>16777216)throw Error('HARNESS_FAULT:input-overflow');inputChunks.push(chunk);}
const cfg=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(inputChunks,inputBytes))), options=cfg.options, state={fault:null,exec:[],sql:[],loads:{},clientUrl:null,deniedRead:null,readerActions:[],readerEffects:[],readerNominations:[],cleanupAttempts:[]};
const fail=reason=>{if(state.fault===null)state.faultStack=new Error('HARNESS_FAULT:'+reason).stack;state.fault??='HARNESS_FAULT:'+reason;throw Error(state.fault);};
const saved=[],sockets=new Set(),socketCloses=[],cleanupCauses=[];let hook=null,server=null,primary=null,cleanup=null;
const builtinAllowed=new Set(['assert','assert/strict','async_hooks','buffer','crypto','events','fs','fs/promises','http','https','net','os','path','process','querystring','stream','stream/promises','string_decoder','timers','tty','url','util','zlib']);
const forbidden=/^(?:typescript|tsx|esbuild|vite|rolldown|playwright|postgres|fsevents|lightningcss)(?:\/|$)/;
const entryURL=import.meta.url;
const sourceURLs=Object.keys(cfg.sources),files=cfg.admission.files;
const directories=new Set(cfg.admission.directories);
const roots=new Set(['express','react','react-dom/server','recharts']);
const original={dlopen:process.dlopen,open:fs.openSync,close:fs.closeSync,read:fs.readSync,lstat:fs.lstatSync,fstat:fs.fstatSync};
const restore=()=>{for(const [object,key,value]of saved.reverse())object[key]=value;process.dlopen=original.dlopen;syncBuiltinESMExports();};
function verifyPin(file){
 const pin=files[file];if(!pin)return fail('missing-file-pin');
 const before=original.lstat(file,{bigint:true});let fd,pinPrimary;
 try{fd=original.open(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);const held=original.fstat(fd,{bigint:true});
  for(const stat of [before,held]){if(!stat.isFile())fail('file-kind');for(const key of ['dev','ino','uid','gid','mode','nlink','size','mtimeNs','ctimeNs'])if(String(stat[key])!==String(pin[key]))fail('file-generation');}
  const bytes=Buffer.alloc(pin.size);for(let at=0;at<bytes.length;){const n=original.read(fd,bytes,at,Math.min(65536,bytes.length-at),at);if(!n)fail('file-truncated');at+=n;}
  if(crypto.createHash('sha256').update(bytes).digest('hex')!==pin.sha256)fail('file-bytes');
  const after=original.lstat(file,{bigint:true});for(const key of ['dev','ino','uid','gid','mode','nlink','size','mtimeNs','ctimeNs'])if(String(after[key])!==String(pin[key]))fail('file-path-drift');
 }catch(error){pinPrimary=error;throw error;}finally{if(fd!==undefined)try{original.close(fd);}catch(error){cleanupCauses.push('pin-close:'+String(error.message));if(!pinPrimary)fail('pin-close');}}
}
function allowedRead(value,site){
 let file;if(value instanceof URL)file=fileURLToPath(value);else if(typeof value==='string'||Buffer.isBuffer(value))file=path.resolve(String(value));else return fail('unowned-read-handle');
 if(/(?:^|\/)\.env(?:[./]|$)/.test(file)||file.endsWith('/server/config.ts')||file.includes('/.openclaw/')){state.deniedRead={site,reason:'secret-read'};return fail('secret-read');}
 if(!files[file]&&!directories.has(file))return fail('unadmitted-read');if(files[file])verifyPin(file);return file;
}
function patch(object,key,make){if(typeof object[key]==='function'){const fn=object[key];saved.push([object,key,fn]);const wrapped=make(fn);if(fn.native)wrapped.native=make(fn.native);object[key]=wrapped;}}
const readFlag=flag=>flag===undefined||flag==='r'||flag===0||flag===fs.constants.O_NOFOLLOW;
let synchronousReadScope=null;
for(const object of [fs,fsp])for(const key of ['readFileSync','readFile','openSync','open','createReadStream','statSync','stat','lstatSync','lstat','realpathSync','realpath','accessSync','access','readdirSync','readdir'])patch(object,key,fn=>function(value,...args){
 if((key==='open'||key==='openSync')&&!readFlag(args[0])){state.deniedRead={site:key,reason:'write-open'};return fail('write-open');}
 if(['readFileSync','readFile','createReadStream'].includes(key)&&args[0]&&typeof args[0]==='object'){
  const flag=key==='createReadStream'?args[0].flags:args[0].flag;
  if(args[0].fd!==undefined||flag!==undefined&&!readFlag(flag)){state.deniedRead={site:key,reason:'write-read-options'};return fail('write-read-options');}
 }
 const file=allowedRead(value,key);
 if(key==='readFileSync'){
  const previous=synchronousReadScope;synchronousReadScope=files[file]??null;
  try{return fn.call(this,value,...args);}finally{synchronousReadScope=previous;}
 }
 return fn.call(this,value,...args);
});
patch(fs,'readSync',fn=>function(fd,...args){
 if(!synchronousReadScope||!Number.isInteger(fd)||fd<0)return fail('unowned-read-handle');
 const stat=original.fstat(fd,{bigint:true});if(!stat.isFile())return fail('read-handle-kind');
 for(const key of ['dev','ino','uid','gid','mode','nlink','size','mtimeNs','ctimeNs'])if(String(stat[key])!==String(synchronousReadScope[key]))return fail('read-handle-generation');
 return fn.call(this,fd,...args);
});
for(const object of [fs,fsp])for(const key of ['read','readv','readvSync'])patch(object,key,()=>()=>fail('unowned-read-handle'));
for(const object of [fs,fsp])for(const key of ['write','writeSync','writev','writevSync','writeFileSync','writeFile','createWriteStream','appendFileSync','appendFile','copyFileSync','copyFile','cpSync','cp','truncateSync','truncate','ftruncateSync','ftruncate','chmodSync','chmod','fchmodSync','fchmod','chownSync','chown','fchownSync','fchown','utimesSync','utimes','futimesSync','futimes','lutimesSync','lutimes','mkdirSync','mkdir','rmSync','rm','unlinkSync','unlink','renameSync','rename','symlinkSync','symlink','linkSync','link'])patch(object,key,()=>()=>fail('filesystem-write'));
process.dlopen=()=>fail('native-addon');syncBuiltinESMExports();
const route=cfg.urls.route,api=cfg.urls.api,chart=cfg.urls.chart;
const ports={pg:new URL('./.telemetry-test-ports/pg.mjs',route).href,config:new URL('./.telemetry-test-ports/config.mjs',route).href,exec:new URL('./.telemetry-test-ports/exec.mjs',route).href,probe:new URL('./.telemetry-test-ports/probe.mjs',route).href};
const local=new Map([
 [route,new Map([['express','express'],['../utils/pg.js',ports.pg],['../config.js',ports.config],['node:child_process',ports.exec],['node:path','node:path']])],
 [api,new Map([['./operational-snapshot',cfg.urls.operational],['./product-build-authority',cfg.urls.product]])],
 [chart,new Map([['react','react'],['react/jsx-runtime','react/jsx-runtime'],['recharts','recharts'],['../../lib/api',api]])],
 [cfg.urls.operational,new Map()], [cfg.urls.product,new Map()],
 [ports.probe,new Map([['../config.js',ports.config]])]
]);
const normalized=s=>s.replace(/\s+/g,' ').trim();
const legacySteps='SELECT step_id, agent_id, status, started_at, updated_at, CASE WHEN started_at IS NOT NULL AND status IN (\'done\',\'failed\') THEN EXTRACT(EPOCH FROM updated_at::timestamptz - started_at::timestamptz) * 1000 ELSE NULL END as duration_ms FROM steps WHERE run_id = $1 ORDER BY step_index';
const legacyHistory='SELECT step_id, from_status, to_status, agent_id, created_at FROM step_transitions WHERE run_id = $1 ORDER BY created_at';
const legacyAverage='SELECT s.step_id, AVG(EXTRACT(EPOCH FROM s.updated_at::timestamptz - s.started_at::timestamptz) * 1000) as avg_ms FROM steps s WHERE s.started_at IS NOT NULL AND s.status IN (\'done\',\'failed\') GROUP BY s.step_id';
globalThis.__telemetryTest={
 sql:async(strings,...values)=>{const rawSql=strings.join('$1'),sql=normalized(rawSql);state.sql.push({rawSql,sql,values});
  const selected=cfg.approvedSql.map(normalized).indexOf(sql);
  if(selected!==-1){if(values.length!==1||typeof values[0]!=='string')return fail('supported-sql-args');
   if(options.sqlFailure)throw Error('NOMINATED_SQL_READ_FAILED_DO_NOT_LEAK');
   return selected===0?(options.sqlRows??[{step_id:'plan',agent_id:'fixture/agent',status:'done',started_at:'2024-01-01T00:00:00.000000Z AD',updated_at:'2024-01-01T00:00:00.250000Z AD',duration_ms:250}]):(options.sqlAverages??[{step_id:'plan',avg_ms:150}]);}
  if(sql===legacySteps){if(values.length!==1||typeof values[0]!=='string')return fail('sql-args');if(options.sqlFailure)throw Error('NOMINATED_SQL_READ_FAILED_DO_NOT_LEAK');return [{step_id:'plan',agent_id:'fixture/agent',status:'done',started_at:'2024-01-01T00:00:00.000000Z AD',updated_at:'2024-01-01T00:00:00.250000Z AD',duration_ms:250}];}
  if(sql===legacyHistory){if(values.length!==1)return fail('history-args');throw Error('NOMINATED_HISTORY_UNAVAILABLE');}
  if(sql===legacyAverage){if(values.length)return fail('average-args');return [{step_id:'plan',avg_ms:100}];}
  return fail('unknown-sql');},
 exec:(command,args,config)=>{state.exec.push({command,args,config});
  const script='import("/inert/setfarm/dist/installer/bottleneck.js").then(m => m.detectBottlenecks("run-contract")).then(r => console.log(JSON.stringify(r))).catch(() => console.log("[]"))';
  if(command!=='node'||args.length!==2||args[0]!=='-e'||normalized(args[1])!==script||Object.keys(config).length!==3||config.encoding!=='utf-8'||config.timeout!==10000||JSON.stringify(config.stdio)!=='["pipe","pipe","pipe"]')return fail('unknown-exec');throw Error('NOMINATED_EXEC_DENIED_WITHOUT_LAUNCH');},
 paths:{setfarmRepoDir:'/inert/setfarm'}
};
hook=registerHooks({
 resolve(specifier,context,next){const parent=context.parentURL;
  if(forbidden.test(specifier)||/\.node$/.test(specifier)||specifier==='node:worker_threads'||specifier==='worker_threads')return fail('forbidden-origin');
  if(local.has(parent)){
   const edge=local.get(parent);if(!edge.has(specifier))return fail('source-edge');
   const target=edge.get(specifier);
   if(options.safety==='pg-miss'&&target===ports.pg)return fail('pg-port-miss');
   if(options.safety==='config-miss'&&target===ports.config)return fail('config-port-miss');
   if(target.startsWith('file:'))return {url:target,shortCircuit:true};
  }else if(parent===entryURL){if(sourceURLs.includes(specifier)||specifier===ports.probe)return {url:specifier,shortCircuit:true};if(!roots.has(specifier))return fail('entry-edge');}
  else if(!cfg.admission.edges[parent]?.includes(specifier))return fail('dependency-edge');
  if(isBuiltin(specifier)){const name=specifier.replace(/^node:/,'');if(!builtinAllowed.has(name))return fail('builtin-edge');return next(specifier,context);}
  const resolved=next(specifier,context);if(sourceURLs.includes(resolved.url))return resolved;
  if(!resolved.url.startsWith('file:')||!files[fileURLToPath(resolved.url)]||/\.node$/.test(resolved.url))return fail('resolved-origin');return resolved;
 },
 load(url,context,next){
  if(cfg.sources[url]){state.loads[url]=(state.loads[url]||0)+1;return {format:'module',source:cfg.sources[url],shortCircuit:true};}
  if(url===ports.pg)return {format:'module',source:'export const sql=globalThis.__telemetryTest.sql;export default sql;',shortCircuit:true};
  if(url===ports.config)return {format:'module',source:'export const PATHS=globalThis.__telemetryTest.paths;',shortCircuit:true};
  if(url===ports.exec)return {format:'module',source:'export const execFileSync=globalThis.__telemetryTest.exec;',shortCircuit:true};
  if(url===ports.probe)return {format:'module',source:'import {PATHS} from "../config.js";export default PATHS;',shortCircuit:true};
  if(url.startsWith('node:'))return next(url,context);
  if(!url.startsWith('file:')||!files[fileURLToPath(url)]||context.format==='addon'||/\.node$/.test(url))return fail('load-origin');
  const file=fileURLToPath(url);verifyPin(file);const loaded=next(url,context);
  if(loaded.source===null||loaded.source===undefined||crypto.createHash('sha256').update(typeof loaded.source==='string'?Buffer.from(loaded.source):Buffer.from(loaded.source)).digest('hex')!==files[file].sha256)return fail('loaded-source-bytes');
  return loaded;
 }
});
try{
 globalThis.document={querySelector:()=>null};
 const express=(await import('express')).default;
 const React=await import('react'),SSR=await import('react-dom/server');
 const routeModule=await import(route),apiModule=await import(api),chartModule=await import(chart);
 if(typeof routeModule.default!=='function'||typeof apiModule.api?.telemetry!=='function'||typeof chartModule.TelemetryChart!=='function')fail('exports-parity');
 if(Object.values(state.loads).some(n=>n!==1)||sourceURLs.some(url=>state.loads[url]!==1))fail('evaluation-parity');
 if(options.safety==='config-miss')await import(ports.probe);
 if(options.safety==='read-sync')fs.readFileSync(cfg.root+'/.env');
 if(options.safety==='read-async')await fsp.readFile(cfg.root+'/.env');
 if(options.safety==='open-async')await fsp.open(cfg.root+'/.env');
 if(options.safety==='write-open')await fsp.open(Object.keys(files)[0],'w');
 if(options.safety==='write-readFile')fs.readFileSync(Object.keys(files)[0],{flag:'w+'});
 if(options.safety==='write-stream')fs.createWriteStream(Object.keys(files)[0],{fd:1});
 const app=express();
 if(options.reply)app.use('/api/telemetry',(req,res)=>{const r=options.reply;res.status(r.status);if(r.contentType!==undefined)res.setHeader('Content-Type',r.contentType);res.end(r.bytes?Buffer.from(r.bytes):r.text!==undefined?r.text:JSON.stringify(r.body));});
 app.use('/api',routeModule.default);server=createServer(app);
 server.on('connection',socket=>{sockets.add(socket);socketCloses.push(new Promise(resolve=>socket.once('close',()=>{sockets.delete(socket);resolve();})));});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const origin='http://127.0.0.1:'+server.address().port,realFetch=globalThis.fetch;
 if(options.request){const url=new URL(options.request,origin);if(url.origin!==origin||!url.pathname.toLowerCase().startsWith('/api/telemetry'))fail('request-origin');const response=await realFetch(url,{method:options.requestMethod??'GET'});state.httpStatus=response.status;const text=await response.text();state.body=(()=>{try{return JSON.parse(text);}catch{return text;}})();}
 if(Object.hasOwn(options,'clientRunId')){
  globalThis.fetch=async(input,init)=>{state.clientUrl=String(input);const url=new URL(String(input),origin+'/');if(url.origin!==origin||!url.pathname.startsWith('/api/telemetry'))return fail('fetch-origin');const response=await realFetch(url,init);
   if(!options.readerFaults?.length)return response;
   const body=response.body;return {status:response.status,headers:response.headers,body:body&&{cancel:()=>body.cancel(),getReader:()=>{const reader=body.getReader();return {
    read:async()=>{state.readerActions.push('read');let result;try{result=await reader.read();}catch{fail('reader-read-underlying');}state.readerEffects.push('read');if(options.readerFaults.includes('read')){state.readerNominations.push('read');throw Error('NOMINATED_READER_READ_AFTER_EFFECT');}return result;},
    cancel:async()=>{state.readerActions.push('cancel');try{await reader.cancel();}catch{fail('reader-cancel-underlying');}state.readerEffects.push('cancel');if(options.readerFaults.includes('cancel')){state.readerNominations.push('cancel');throw Error('NOMINATED_READER_CANCEL_AFTER_EFFECT');}},
    releaseLock:()=>{state.readerActions.push('release');try{reader.releaseLock();}catch{fail('reader-release-underlying');}state.readerEffects.push('release');if(options.readerFaults.includes('release')){state.readerNominations.push('release');throw Error('NOMINATED_READER_RELEASE_AFTER_EFFECT');}}
   };}}};};
  try{state.clientResult=await apiModule.api.telemetry(options.clientRunId);}catch(error){state.clientError=String(error.message);}finally{globalThis.fetch=realFetch;}
 }
 if(Object.hasOwn(options,'renderResult')){
  state.hasResultExport=typeof chartModule.TelemetryResult==='function';
  state.markup=SSR.renderToStaticMarkup(React.createElement(state.hasResultExport?chartModule.TelemetryResult:chartModule.TelemetryChart,state.hasResultExport?{result:options.renderResult}:{runId:'run-contract'}));
 }
 if(options.primaryFault)throw Error('NOMINATED_PRIMARY_AFTER_CONSUMER');
}catch(error){primary=String(error.message);}
finally{
 const cleanupFault=site=>{if(options.cleanupFaults?.includes(site))throw Error('NOMINATED_CLEANUP_'+site);};
 try{if(server){state.cleanupAttempts.push('idle');server.closeIdleConnections();cleanupFault('idle');}}catch(error){cleanupCauses.push(String(error.message));}
 try{if(server){state.cleanupAttempts.push('server');await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));cleanupFault('server');}}catch(error){cleanupCauses.push(String(error.message));}
 try{if(server){state.cleanupAttempts.push('sockets');await Promise.all(socketCloses);if(sockets.size)fail('socket-not-settled');}}catch(error){cleanupCauses.push(String(error.message));}
 try{state.cleanupAttempts.push('hook');hook?.deregister();cleanupFault('hook');}catch(error){cleanupCauses.push(String(error.message));}
 try{state.cleanupAttempts.push('restore');restore();cleanupFault('restore');}catch(error){cleanupCauses.push(String(error.message));}
 cleanup=cleanupCauses[0]??null;
}
process.stdout.write(JSON.stringify({...state,primary,cleanup,cleanupCauses,settled:cleanup===null}));
`;

/** Actual sources, ordinary compiler, owned HTTP/SSR; never exports a fake handler. */
export async function runTelemetryConsumerV1(options: ConsumerOptionsV1 = {}): Promise<any> {
  assert.ok(options.sqlMutation === undefined || options.sqlMutation === 'exclude-current');
  if (options.sqlMutation) assert.equal(options.replacements, undefined);
  const admission = dependencyAdmission();
  const sources: Record<string, string> = {}, original: Record<string, ReturnType<typeof heldBytes>['pin']> = {};
  for (const relative of SOURCE_FILES) {
    const file = path.join(ROOT, relative), { bytes, pin } = heldBytes(file);
    original[file] = pin; let raw = bytes.toString('utf8');
    const replacement = options.sqlMutation && relative === SOURCE_FILES[0]
      ? EXCLUDE_CURRENT_V1 : options.replacements?.[relative];
    if (replacement) {
      assert.equal(raw.split(replacement.from).length - 1, 1, 'one coherent mutation');
      raw = raw.replace(replacement.from, replacement.to);
    }
    const result = ts.transpileModule(raw, { fileName: file, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true } });
    assert.equal(result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
    sources[pathToFileURL(file).href] = result.outputText;
  }
  const input = JSON.stringify({ root: ROOT, options, admission, sources,
    approvedSql: options.sqlMutation ? TELEMETRY_EXCLUDE_CURRENT_SQL_V1 : TELEMETRY_SQL_V1, urls: {
    route: pathToFileURL(path.join(ROOT, SOURCE_FILES[0])).href,
    api: pathToFileURL(path.join(ROOT, SOURCE_FILES[1])).href,
    chart: pathToFileURL(path.join(ROOT, SOURCE_FILES[2])).href,
    operational: pathToFileURL(path.join(ROOT, SOURCE_FILES[3])).href,
    product: pathToFileURL(path.join(ROOT, SOURCE_FILES[4])).href,
  } });
  assert.ok(Buffer.byteLength(input) <= 16 * 1024 * 1024, 'complete bounded child input');
  const child = spawn(process.execPath, ['--input-type=module', '--eval', CHILD], {
    cwd: ROOT, env: { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', NODE_ENV: 'test' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const outputChunks: Buffer[] = [], errorChunks: Buffer[] = [];
  let outputBytes = 0, errorBytes = 0, stdoutEnd = false, stderrEnd = false, parentFault: string | null = null;
  let forcedClose: ReturnType<typeof setTimeout> | undefined, terminationStarted = false;
  function terminate(reason: string) {
    parentFault ??= 'HARNESS_FAULT:' + reason;
    if (terminationStarted) return;
    terminationStarted = true; child.kill('SIGTERM');
    forcedClose = setTimeout(() => child.kill('SIGKILL'), 5000);
  }
  let exit: [number | null, NodeJS.Signals | null] | undefined, childError: Error | undefined;
  const closed = new Promise<void>((resolve, reject) => {
    child.once('error', error => { childError = error; });
    child.once('exit', (code, signal) => { exit = [code, signal]; });
    child.once('close', (code, signal) => {
      try { assert.deepEqual(exit, [0, null]); assert.equal(code, 0); assert.equal(signal, null);
        assert.ok(stdoutEnd && stderrEnd); assert.equal(childError, undefined); resolve(); } catch (error) { reject(error); }
    });
  });
  child.stdout.on('data', (bytes: Buffer) => { outputBytes += bytes.length; if (outputBytes > 1048576) terminate('stdout-overflow'); else outputChunks.push(bytes); });
  child.stderr.on('data', (bytes: Buffer) => { errorBytes += bytes.length; if (errorBytes > 1048576) terminate('stderr-overflow'); else errorChunks.push(bytes); });
  child.stdout.once('end', () => { stdoutEnd = true; }); child.stderr.once('end', () => { stderrEnd = true; });
  child.stdin.on('error', () => { parentFault ??= 'HARNESS_FAULT:stdin-error'; }); child.stdin.end(input);
  const timeout = setTimeout(() => terminate('child-timeout'), 30000);
  let closureError: unknown;
  try { await closed; } catch (error) { closureError = error; }
  finally { clearTimeout(timeout); if (forcedClose) clearTimeout(forcedClose); }
  for (const [file, pin] of Object.entries(original)) assert.deepEqual(heldBytes(file).pin, pin);
  for (const [file, pin] of Object.entries(admission.files)) assert.deepEqual(heldBytes(file).pin, pin);
  assert.equal(parentFault, null);
  if (closureError) throw closureError;
  const output = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(outputChunks, outputBytes));
  const stderr = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(errorChunks, errorBytes));
  assert.equal(stderr, '', stderr); const observed = JSON.parse(output);
  const expectedCleanup = (['idle', 'server', 'hook', 'restore'] as const).filter(site => options.cleanupFaults?.includes(site)).map(site => 'NOMINATED_CLEANUP_' + site);
  assert.equal(observed.cleanup, expectedCleanup[0] ?? null); assert.deepEqual(observed.cleanupCauses, expectedCleanup);
  assert.equal(observed.settled, expectedCleanup.length === 0);
  if (options.expectHarnessFault) assert.match(observed.fault, /^HARNESS_FAULT:/);
  else { assert.equal(observed.fault, null, observed.faultStack || observed.primary); assert.equal(observed.primary, options.primaryFault ? 'NOMINATED_PRIMARY_AFTER_CONSUMER' : null); }
  return observed;
}

/** Hand-frozen SQL inputs and independent expected scalars; never query-derived. */
export function telemetrySqlFixtureV1() {
  type Input = [string, string, string | null, string | null, string | null, string | null];
  const start = '2024-01-01 00:00:00+00';
  const inputs: Input[] = [
    ['run-contract', 'below', 'agent/A', 'done', start, '2024-01-01 00:00:00.250000+00'],
    ['history-1', 'below', null, 'done', start, '2024-01-01 00:00:00.100000+00'],
    ['history-2', 'below', null, 'done', start, '2024-01-01 00:00:00.100000+00'],
    ['run-contract', 'equal', '', 'done', start, '2024-01-01 00:00:00.400000+00'],
    ['history-1', 'equal', null, 'done', start, '2024-01-01 00:00:00.100000+00'],
    ['history-2', 'equal', null, 'done', start, '2024-01-01 00:00:00.100000+00'],
    ['run-contract', 'above', 'agent/B', 'failed', start, '2024-01-01 00:00:00.450000+00'],
    ['history-1', 'above', null, 'done', start, '2024-01-01 00:00:00.100000+00'],
    ['history-2', 'above', null, 'done', start, '2024-01-01 00:00:00.100000+00'],
    ['run-contract', 'subms', null, 'done', start, '2024-01-01 00:00:00.000009+00'],
    ['history-1', 'subms', null, 'done', start, '2024-01-01 00:00:00.000001+00'],
    ['history-2', 'subms', null, 'done', start, '2024-01-01 00:00:00.000001+00'],
    ['run-contract', 'duplicate', 'agent/A', 'done', start, '2024-01-01 00:00:00.450000+00'],
    ['run-contract', 'duplicate', null, 'done', start, '2024-01-01 00:00:00.010000+00'],
    ['run-contract', 'duplicate', null, 'done', start, '2024-01-01 00:00:00.010000+00'],
    ['history-1', 'duplicate', null, 'done', start, '2024-01-01 00:00:00.100000+00'],
    ['history-2', 'duplicate', null, 'done', start, '2024-01-01 00:00:00.100000+00'],
    ['run-contract', 'excluded', 'agent/X', 'done', null, '2024-01-01 00:00:00.100000+00'],
    ['run-contract', 'excluded', 'agent/X', 'done', start, null],
    ['run-contract', 'excluded', 'agent/X', 'done', start, start],
    ['run-contract', 'excluded', 'agent/X', 'done', '2024-01-01 00:00:00.100000+00', start],
    ['run-contract', 'excluded', 'agent/X', 'done', '-infinity', start],
    ['run-contract', 'excluded', 'agent/X', 'done', start, 'infinity'],
    ['run-contract', 'excluded', 'agent/X', 'running', start, '2024-01-01 00:00:00.100000+00'],
    ['run-contract', 'excluded', 'agent/X', 'pending', start, '2024-01-01 00:00:00.100000+00'],
    ['run-contract', 'excluded', 'agent/X', 'unknown', start, '2024-01-01 00:00:00.100000+00'],
    ['run-contract', 'excluded', 'agent/X', null, start, '2024-01-01 00:00:00.100000+00'],
    ['run-contract', 'utc', 'agent/é', 'done', '2024-01-01 03:00:00+03', '2023-12-31 19:00:00.250000-05'],
    ['run-contract', 'bc-leap', 'agent/BC', 'done', '0001-02-29 00:00:00.000001+00 BC', '0001-02-29 00:00:00.000002+00 BC'],
    ['run-contract', 'bc-ad', 'agent/BC', 'failed', '0001-12-31 23:59:59.999999+00 BC', '0001-01-01 00:00:00+00 AD'],
    ['run-contract', 'wide', 'agent/W', 'done', '12345-01-01 00:00:00.000001+00', '12345-01-01 00:00:00.000002+00'],
    ['run-contract', 'minimum', null, 'done', '4714-11-24 00:00:00+00 BC', '4714-11-24 00:00:00.000001+00 BC'],
    ['run-contract', 'maximum', null, 'done', '294276-12-31 23:59:59.999998+00', '294276-12-31 23:59:59.999999+00'],
    ['run-contract', 'full-range', null, 'done', '4714-11-24 00:00:00+00 BC', '294276-12-31 23:59:59.999999+00'],
    ['history-invalid', 'below', null, 'running', start, '2024-01-01 00:00:10+00'],
    ['history-unselected', 'unselected', null, 'done', start, '2024-01-02 00:00:00+00'],
  ];
  const types = ['text', 'text', 'text', 'text', 'timestamptz', 'timestamptz'];
  const values = inputs.map((row, index) => '(' + row.map((value, at) =>
    (value === null ? 'NULL' : "'" + value.replaceAll("'", "''") + "'") + '::' + types[at]).join(',') + ',' + (index + 1) + '::integer)').join(',\n');
  const prefix = 'WITH steps(run_id, step_id, agent_id, status, started_at, updated_at, step_index) AS (\nVALUES\n' + values + '\n)\nSELECT * FROM (';
  const zero = '2024-01-01T00:00:00.000000Z AD', hundred = '2024-01-01T00:00:00.100000Z AD';
  const expected = (step_id: string, agent_id: string | null, status: string | null,
    started_at: string | null, updated_at: string | null, duration_ms: number | null) =>
    ({ step_id, agent_id, status, started_at, updated_at, duration_ms });
  // Explicit expected UTC text and raw duration values, not computed from inputs.
  const expectedSteps = [
    expected('below', 'agent/A', 'done', zero, '2024-01-01T00:00:00.250000Z AD', 250),
    expected('equal', '', 'done', zero, '2024-01-01T00:00:00.400000Z AD', 400),
    expected('above', 'agent/B', 'failed', zero, '2024-01-01T00:00:00.450000Z AD', 450),
    expected('subms', null, 'done', zero, '2024-01-01T00:00:00.000009Z AD', 0.009),
    expected('duplicate', 'agent/A', 'done', zero, '2024-01-01T00:00:00.450000Z AD', 450),
    expected('duplicate', null, 'done', zero, '2024-01-01T00:00:00.010000Z AD', 10),
    expected('duplicate', null, 'done', zero, '2024-01-01T00:00:00.010000Z AD', 10),
    expected('excluded', 'agent/X', 'done', null, hundred, null),
    expected('excluded', 'agent/X', 'done', zero, null, null),
    expected('excluded', 'agent/X', 'done', zero, zero, null),
    expected('excluded', 'agent/X', 'done', hundred, zero, null),
    expected('excluded', 'agent/X', 'done', null, zero, null),
    expected('excluded', 'agent/X', 'done', zero, null, null),
    expected('excluded', 'agent/X', 'running', zero, hundred, null),
    expected('excluded', 'agent/X', 'pending', zero, hundred, null),
    expected('excluded', 'agent/X', 'unknown', zero, hundred, null),
    expected('excluded', 'agent/X', null, zero, hundred, null),
    expected('utc', 'agent/é', 'done', zero, '2024-01-01T00:00:00.250000Z AD', 250),
    expected('bc-leap', 'agent/BC', 'done', '0001-02-29T00:00:00.000001Z BC', '0001-02-29T00:00:00.000002Z BC', 0.001),
    expected('bc-ad', 'agent/BC', 'failed', '0001-12-31T23:59:59.999999Z BC', '0001-01-01T00:00:00.000000Z AD', 0.001),
    expected('wide', 'agent/W', 'done', '12345-01-01T00:00:00.000001Z AD', '12345-01-01T00:00:00.000002Z AD', 0.001),
    expected('minimum', null, 'done', '4714-11-24T00:00:00.000000Z BC', '4714-11-24T00:00:00.000001Z BC', 0.001),
    expected('maximum', null, 'done', '294276-12-31T23:59:59.999998Z AD', '294276-12-31T23:59:59.999999Z AD', 0.001),
    expected('full-range', null, 'done', '4714-11-24T00:00:00.000000Z BC', '294276-12-31T23:59:59.999999Z AD', 9435184819200000),
  ];
  const expectedAverages = [
    { step_id: 'below', avg_ms: 150 }, { step_id: 'equal', avg_ms: 200 },
    { step_id: 'above', avg_ms: 216.66666666666666 }, { step_id: 'subms', avg_ms: 0.0036666666666666666 },
    { step_id: 'duplicate', avg_ms: 134 }, { step_id: 'excluded', avg_ms: null },
    { step_id: 'utc', avg_ms: 250 }, { step_id: 'bc-leap', avg_ms: 0.001 },
    { step_id: 'bc-ad', avg_ms: 0.001 }, { step_id: 'wide', avg_ms: 0.001 },
    { step_id: 'minimum', avg_ms: 0.001 }, { step_id: 'maximum', avg_ms: 0.001 },
    { step_id: 'full-range', avg_ms: 9435184819200000 },
  ];
  return { prefix, inputRows: inputs.length, expectedSteps, expectedAverages };
}

const SQL_ADMISSION_CHILD = String.raw`
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';
import path from 'node:path';
import {registerHooks,syncBuiltinESMExports,isBuiltin} from 'node:module';
import {fileURLToPath} from 'node:url';
const chunks=[];let size=0;for await(const b of process.stdin){size+=b.length;if(size>1048576)throw Error('HARNESS_FAULT:sql-input-cap');chunks.push(b);}
const cfg=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,size)));
const state={driverVersion:cfg.version,socketAllocations:0,socketFactoryCalls:0,connectAttempts:0,listenAttempts:0,connectCalls:0,rawSocketClosed:false,fault:null,primary:null,cleanupCauses:[],cleanupAttempts:[],sqlTrace:[],results:[],loads:{}};
const fail=reason=>{state.fault??='HARNESS_FAULT:'+reason;throw Error(state.fault);};
const saved=[],entryURL=import.meta.url,OriginalSocket=net.Socket,OriginalServer=net.Server;let hook,client,rawSocket,rawClose,session,transactionStarted=false;
async function bounded(operation,ms,reason){let timer;try{return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(reason)),ms);})]);}finally{clearTimeout(timer);}}
const original={open:fs.openSync,close:fs.closeSync,lstat:fs.lstatSync,fstat:fs.fstatSync,read:fs.readSync};
const keys=['dev','ino','uid','gid','mode','nlink','size','mtimeNs','ctimeNs'];
function verify(file){const pin=cfg.files[file];if(!pin)return fail('sql-unadmitted-read');let fd,primary;
 try{const before=original.lstat(file,{bigint:true});fd=original.open(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);const held=original.fstat(fd,{bigint:true});
  for(const s of [before,held]){if(!s.isFile())fail('sql-file-kind');for(const k of keys)if(String(s[k])!==String(pin[k]))fail('sql-file-generation');}
  const bytes=Buffer.alloc(pin.size);for(let at=0;at<bytes.length;){const n=original.read(fd,bytes,at,Math.min(65536,bytes.length-at),at);if(!n)fail('sql-file-truncated');at+=n;}
  if(crypto.createHash('sha256').update(bytes).digest('hex')!==pin.sha256)fail('sql-file-bytes');
  const after=original.lstat(file,{bigint:true});for(const k of keys)if(String(after[k])!==String(pin[k]))fail('sql-file-path-drift');return pin;
 }catch(e){primary=e;throw e;}finally{if(fd!==undefined)try{original.close(fd);}catch(e){state.cleanupCauses.push('sql-pin-close:'+String(e.message));if(!primary)fail('sql-pin-close');}}
}
function patch(object,key,make){if(typeof object[key]==='function'){const fn=object[key];saved.push([object,key,fn]);const wrapped=make(fn);if(fn.native)wrapped.native=make(fn.native);object[key]=wrapped;}}
let readScope=null;
const readFlag=flag=>flag===undefined||flag==='r'||flag===0||flag===fs.constants.O_NOFOLLOW;
function admitted(value){if(typeof value!=='string'&&!(value instanceof URL)&&!Buffer.isBuffer(value))return fail('sql-unowned-read-handle');const file=value instanceof URL?fileURLToPath(value):path.resolve(String(value));if(/(?:^|\/)\.env(?:[./]|$)/.test(file))return fail('sql-secret-read');return {file,pin:verify(file)};}
for(const object of [fs,fsp])for(const key of ['readFileSync','readFile','openSync','open','createReadStream','statSync','stat','lstatSync','lstat','realpathSync','realpath','accessSync','access','readdirSync','readdir'])patch(object,key,fn=>function(value,...args){
 if(['open','openSync'].includes(key)&&!readFlag(args[0]))return fail('sql-write-open');
 if(['readFile','readFileSync','createReadStream'].includes(key)&&args[0]&&typeof args[0]==='object'&&(args[0].fd!==undefined||!readFlag(key==='createReadStream'?args[0].flags:args[0].flag)))return fail('sql-write-read-options');
 const {pin}=admitted(value);if(key==='readFileSync'){const prior=readScope;readScope=pin;try{return fn.call(this,value,...args);}finally{readScope=prior;}}return fn.call(this,value,...args);
});
patch(fs,'readSync',fn=>function(fd,...args){if(!readScope)return fail('sql-unowned-read-handle');const s=original.fstat(fd,{bigint:true});if(!s.isFile())return fail('sql-read-kind');for(const k of keys)if(String(s[k])!==String(readScope[k]))return fail('sql-read-generation');return fn.call(this,fd,...args);});
for(const object of [fs,fsp])for(const key of ['read','readv','readvSync','write','writeSync','writev','writevSync','writeFileSync','writeFile','createWriteStream','appendFileSync','appendFile','copyFileSync','copyFile','cpSync','cp','truncateSync','truncate','ftruncateSync','ftruncate','chmodSync','chmod','fchmodSync','fchmod','chownSync','chown','fchownSync','fchown','utimesSync','utimes','futimesSync','futimes','lutimesSync','lutimes','mkdirSync','mkdir','rmSync','rm','unlinkSync','unlink','renameSync','rename','symlinkSync','symlink','linkSync','link'])patch(object,key,()=>()=>fail('sql-filesystem-effect'));
patch(OriginalSocket.prototype,'connect',fn=>function(...args){state.connectAttempts++;
 if(cfg.mode!=='real'||this!==rawSocket||state.socketFactoryCalls!==1||state.connectAttempts!==1||args.length!==2||args[0]!==5432||args[1]!=='127.0.0.1')return fail('sql-connect-refused');
 state.connectCalls++;return fn.apply(this,args);
});
patch(OriginalServer.prototype,'listen',()=>function(){state.listenAttempts++;return fail('sql-listen-refused');});
for(const [object,key] of [[net,'Socket'],[net,'Server'],[net,'connect'],[net,'createConnection'],[net,'createServer'],[tls,'connect'],[tls,'createServer'],[tls,'TLSSocket'],[tls,'Server'],[process,'dlopen']])patch(object,key,()=>function(){return fail('sql-network-or-native-effect');});
syncBuiltinESMExports();
const builtins=new Set(['os','fs','net','tls','crypto','stream','perf_hooks']);
hook=registerHooks({resolve(specifier,context,next){if(context.parentURL===entryURL){if(specifier!==cfg.entry)return fail('sql-entry-edge');return {url:cfg.entry,shortCircuit:true};}
 if(!cfg.edges[context.parentURL]?.includes(specifier))return fail('sql-module-edge');
 if(isBuiltin(specifier)){if(!builtins.has(specifier.replace(/^node:/,'')))return fail('sql-builtin-edge');return next(specifier,context);}
 const r=next(specifier,context);if(!r.url.startsWith('file:')||!cfg.files[fileURLToPath(r.url)]||!r.url.endsWith('.js'))return fail('sql-resolved-origin');return r;
},load(url,context,next){if(url.startsWith('node:'))return next(url,context);if(!url.startsWith('file:')||!url.endsWith('.js'))return fail('sql-load-origin');const file=fileURLToPath(url),pin=verify(file);const r=next(url,context);if(r.source===null||r.source===undefined||crypto.createHash('sha256').update(typeof r.source==='string'?Buffer.from(r.source):Buffer.from(r.source)).digest('hex')!==pin.sha256)return fail('sql-loaded-source-bytes');state.loads[url]=(state.loads[url]??0)+1;return r;}});
try{
 const postgres=(await import(cfg.entry)).default;if(typeof postgres!=='function')fail('sql-driver-export');
 client=postgres({host:'127.0.0.1',port:5432,user:'setrox',database:'setfarm',password:'',max:1,prepare:false,fetch_types:false,ssl:false,connect_timeout:5,idle_timeout:0,max_lifetime:null,max_pipeline:1,backoff:false,keep_alive:0,debug:false,
  connection:{application_name:'mc-telemetry-cte-v1',default_transaction_read_only:'on',statement_timeout:'5000',TimeZone:'UTC',search_path:'pg_catalog,public'},
  socket:async()=>{state.socketFactoryCalls++;if(cfg.mode==='admission')return fail('sql-admission-no-connection');
   if(state.socketFactoryCalls!==1)return fail('sql-second-socket');
   rawSocket=new OriginalSocket();state.socketAllocations++;
   rawClose=new Promise(resolve=>rawSocket.once('close',()=>{state.rawSocketClosed=true;resolve();}));
   rawSocket.on('error',()=>{state.fault??='HARNESS_FAULT:sql-raw-socket-error';});
   if(cfg.mode==='socket'){
    // Unconnected controlled factory witness, not graceful real SQL cleanup.
    rawSocket.destroy();await rawClose;return rawSocket;
   }
   if(cfg.mode!=='real')return fail('sql-factory-mode');
   try{await bounded(new Promise((resolve,reject)=>{rawSocket.once('error',reject);rawSocket.once('connect',resolve);rawSocket.connect(5432,'127.0.0.1');}),5000,'SQL_FACTORY_CONNECT_TIMEOUT');}
   catch(e){rawSocket.destroy();await rawClose;throw e;}
   if(rawSocket.remoteAddress!=='127.0.0.1'||rawSocket.remotePort!==5432||rawSocket.localAddress!=='127.0.0.1'||rawSocket.connecting)return fail('sql-socket-binding');
   return rawSocket;
  },onnotice:()=>fail('sql-notice')});
 // Constructing the driver also constructs an inert Subscribe companion. It
 // allocates no raw socket; top-level no_subscribe is not a parsed option.
 if(cfg.mode==='socket'){await client.options.socket(client.options);await client.options.socket(client.options);}
 if(cfg.probe==='network')await client.options.socket(client.options);
 if(cfg.probe==='secret')fs.readFileSync(cfg.root+'/.env');
 if(cfg.probe==='native-secret')fs.realpathSync.native(cfg.root+'/.env');
 if(cfg.probe==='write')fs.writeFileSync(Object.keys(cfg.files)[0],'NEVER_WRITE');
 if(cfg.probe==='write-stream')fs.createWriteStream(Object.keys(cfg.files)[0],{fd:1});
 if(cfg.probe==='socket-connect')OriginalSocket.prototype.connect.call({},5432,'127.0.0.1');
 if(cfg.probe==='server-listen')OriginalServer.prototype.listen.call({},5432,'127.0.0.1');
 if(cfg.probe==='edge')await import('node:child_process');
 if(Object.keys(state.loads).length!==10||Object.values(state.loads).some(n=>n!==1))fail('sql-evaluation-parity');
 if(cfg.mode==='real'){
  const o=client.options;
  if(JSON.stringify(o.host)!=='["127.0.0.1"]'||JSON.stringify(o.port)!=='[5432]'||o.user!=='setrox'||o.database!=='setfarm'||o.pass!==''||o.max!==1||o.prepare!==false||o.fetch_types!==false||o.ssl!==false||o.connect_timeout!==5||o.idle_timeout!==0||o.max_lifetime!==null||o.max_pipeline!==1||o.backoff!==false||o.keep_alive!==0||o.debug!==false||o.path||o.target_session_attrs!==undefined)fail('sql-startup-options');
  const expectedConnection={application_name:'mc-telemetry-cte-v1',default_transaction_read_only:'on',statement_timeout:'5000',TimeZone:'UTC',search_path:'pg_catalog,public'};
  if(JSON.stringify(o.connection)!==JSON.stringify(expectedConnection))fail('sql-startup-connection-options');
  const query=async(statement,parameters=[],executor=session)=>{
   const index=cfg.statements.findIndex(row=>row.sql===statement&&JSON.stringify(row.parameters)===JSON.stringify(parameters));
   if(index===-1)return fail('sql-statement-whitelist');state.sqlTrace.push(index);
   return await executor.unsafe(statement,parameters);
  };
  // fetch_types:false can strand the initial reserve path. Explicitly open
  // this same connection with a whitelisted read-only query, never catalogs.
  const startup=await bounded(query(cfg.statements[0].sql,[],client),6000,'SQL_STARTUP_TIMEOUT');
  if(startup.length!==1||JSON.stringify(Object.keys(startup[0]))!=='["connection_admitted"]'||startup[0].connection_admitted!==1)fail('sql-startup-result');
  session=await bounded(client.reserve(),10000,'SQL_RESERVE_TIMEOUT');
  transactionStarted=true;await query(cfg.statements[1].sql);
  const identity=await query(cfg.statements[2].sql);if(identity.length!==1)fail('sql-backend-count');
  const i=identity[0];state.identity=i;
  if(!Number.isInteger(i.backend_pid)||i.backend_pid<=0||i.database_name!=='setfarm'||i.session_user_name!=='setrox'||i.current_user_name!=='setrox'||i.server_address!=='127.0.0.1'||i.server_port!==5432||i.server_version!==170010||i.data_directory!=='/opt/homebrew/var/postgresql@17'||i.read_only!=='on'||i.time_zone!=='UTC'||i.search_path!=='pg_catalog,public'||i.application_name!=='mc-telemetry-cte-v1'||i.statement_timeout!=='5s'||i.in_recovery!==false)fail('sql-backend-identity');
  const journal=await query(cfg.statements[3].sql);state.journalCount=journal.length;
  if(journal.length!==31||journal.some((r,n)=>r.version!==n+1||!['applied','adopted'].includes(r.state)))fail('sql-journal-head');
  const last=journal[30];if(last.name!=='031_operational_failure_cause_authority_v3'||last.checksum!=='7fba6cf62e2201dc12e64175611e3a77fe780bc5af98a62f5f353281e075ab8f')fail('sql-journal-31');
  state.journal31={version:last.version,name:last.name,checksum:last.checksum,state:last.state};
  for(const index of [4,5]){const rows=await query(cfg.statements[index].sql,cfg.statements[index].parameters);state.results.push(Array.from(rows,r=>({...r})));}
 }
}catch(e){state.primary=String(e.message);}
finally{
 try{if(session&&transactionStarted){state.cleanupAttempts.push('rollback');state.sqlTrace.push(6);await bounded(session.unsafe(cfg.statements[6].sql,[]),6000,'SQL_ROLLBACK_TIMEOUT');}}catch(e){state.cleanupCauses.push('sql-rollback:'+String(e.message));}
 try{if(session){state.cleanupAttempts.push('release');session.release();}}catch(e){state.cleanupCauses.push('sql-release:'+String(e.message));}
 try{if(client){state.cleanupAttempts.push('end');await bounded(client.end(),6000,'SQL_END_TIMEOUT');}}catch(e){state.cleanupCauses.push('sql-end:'+String(e.message));}
 try{if(rawClose){state.cleanupAttempts.push('raw-close');
  try{await bounded(rawClose,5000,'SQL_RAW_CLOSE_TIMEOUT');}
  catch(e){state.cleanupCauses.push('sql-raw-close:'+String(e.message));if(!state.rawSocketClosed){state.cleanupCauses.push('sql-forced-raw-destruction');rawSocket.destroy();await bounded(rawClose,5000,'SQL_CONTAINMENT_CLOSE_TIMEOUT');}}
 }}catch(e){state.cleanupCauses.push('sql-containment-close:'+String(e.message));}
 try{hook?.deregister();}catch(e){state.cleanupCauses.push('sql-hook:'+String(e.message));}
 for(const [object,key,value] of saved.reverse())try{object[key]=value;}catch(e){state.cleanupCauses.push('sql-restore:'+String(e.message));}
 try{syncBuiltinESMExports();}catch(e){state.cleanupCauses.push('sql-builtin-restore:'+String(e.message));}
}
process.stdout.write(JSON.stringify(state));
`;

/** Preserve the original refusal before every independently attempted cleanup failure. */
export function telemetrySqlFailureV1(observed: {
  primary: string | null; fault: string | null; cleanupCauses: string[];
}): AggregateError | undefined {
  const errors: Error[] = [];
  if (observed.primary !== null) errors.push(new Error('primary: ' + observed.primary));
  if (observed.fault !== null && observed.fault !== observed.primary) errors.push(new Error('guard: ' + observed.fault));
  for (const cause of observed.cleanupCauses) errors.push(new Error('cleanup: ' + cause));
  return errors.length ? new AggregateError(errors, 'SQL_WITNESS_REFUSED', { cause: errors[0] }) : undefined;
}

/** Real mode is separately gated; ordinary modes never reserve/connect/query. */
export async function runTelemetrySqlWitnessV1(mode: 'admission' | 'socket' | 'real', probe?: 'network' | 'secret' | 'native-secret' | 'write' | 'write-stream' | 'socket-connect' | 'server-listen' | 'edge', sqlMutation?: 'exclude-current'): Promise<any> {
  if (mode === 'real' && process.env.MC_TELEMETRY_REAL_SQL_V1 !== '1') throw Error('REAL_SQL_OPT_IN_REQUIRED');
  assert.ok(mode === 'admission' || mode === 'socket' || mode === 'real');
  assert.ok(sqlMutation === undefined || sqlMutation === 'exclude-current');
  if (sqlMutation) assert.equal(mode, 'real');
  if (mode !== 'admission') assert.equal(probe, undefined);
  if (probe) assert.ok(['network', 'secret', 'native-secret', 'write', 'write-stream', 'socket-connect', 'server-listen', 'edge'].includes(probe));
  const driverRoot = path.join(ROOT, 'node_modules/postgres');
  const files: Record<string, ReturnType<typeof heldBytes>['pin']> = {};
  const pkg = heldBytes(path.join(driverRoot, 'package.json'));
  const json = JSON.parse(pkg.bytes.toString('utf8'));
  assert.equal(json.name, 'postgres'); assert.equal(json.version, '3.4.8'); assert.equal(json.exports.import, './src/index.js');
  files[path.join(driverRoot, 'package.json')] = pkg.pin;
  const edges: Record<string, string[]> = {};
  const names = ['bytes', 'connection', 'errors', 'index', 'large', 'query', 'queue', 'result', 'subscribe', 'types'];
  for (const name of names) {
    const file = path.join(driverRoot, 'src', name + '.js'), held = heldBytes(file); files[file] = held.pin;
    const tree = ts.createSourceFile(file, held.bytes.toString('utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const imports: string[] = [];
    for (const statement of tree.statements) if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) imports.push(statement.moduleSpecifier.text);
    edges[pathToFileURL(file).href] = imports;
  }
  const ownTest = heldBytes(fileURLToPath(import.meta.url));
  const sourcePins: Record<string, ReturnType<typeof heldBytes>['pin']> = {};
  const statements: Array<{ sql: string; parameters: string[] }> = [];
  const fixture = telemetrySqlFixtureV1();
  if (mode === 'real') {
    for (const relative of SOURCE_FILES) { const file = path.join(ROOT, relative); sourcePins[file] = heldBytes(file).pin; }
    const capture = await runTelemetryConsumerV1({ request: '/api/telemetry?runId=run-contract', sqlMutation });
    assert.equal(capture.httpStatus, 200); assert.equal(capture.exec.length, 0);
    const approvedSql = sqlMutation ? TELEMETRY_EXCLUDE_CURRENT_SQL_V1 : TELEMETRY_SQL_V1;
    assert.deepEqual(capture.sql.map((row: any) => [row.rawSql, row.values]), approvedSql.map(sql => [sql, ['run-contract']]));
    statements.push({ sql: 'SELECT 1::integer AS connection_admitted', parameters: [] },
    { sql: 'BEGIN READ ONLY', parameters: [] }, { sql: `SELECT pg_backend_pid() AS backend_pid,
      current_database()::text AS database_name, session_user::text AS session_user_name, current_user::text AS current_user_name,
      host(inet_server_addr())::text AS server_address, inet_server_port() AS server_port,
      current_setting('server_version_num')::integer AS server_version, current_setting('data_directory')::text AS data_directory,
      current_setting('transaction_read_only')::text AS read_only, current_setting('TimeZone')::text AS time_zone,
      current_setting('search_path')::text AS search_path, current_setting('application_name')::text AS application_name,
      current_setting('statement_timeout')::text AS statement_timeout, pg_is_in_recovery() AS in_recovery`, parameters: [] },
    { sql: 'SELECT version, name, checksum, state FROM public.setfarm_schema_migrations ORDER BY version LIMIT 32', parameters: [] });
    for (const row of capture.sql) statements.push({ sql: fixture.prefix + row.rawSql + '\n) AS fixture_result', parameters: [...row.values] });
    statements.push({ sql: 'ROLLBACK', parameters: [] });
  }
  const input = JSON.stringify({ root: ROOT, version: json.version, files, edges, probe, mode, statements,
    entry: pathToFileURL(path.join(driverRoot, 'src/index.js')).href });
  assert.ok(Buffer.byteLength(input) <= 1048576);
  const child = spawn(process.execPath, ['--input-type=module', '--eval', SQL_ADMISSION_CHILD], {
    cwd: ROOT, env: { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C' }, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const out: Buffer[] = [], err: Buffer[] = []; let outBytes = 0, errBytes = 0, outEnd = false, errEnd = false;
  let exit: [number | null, NodeJS.Signals | null] | undefined, childError: Error | undefined, fault: string | undefined;
  let terminating = false, killDeadline: ReturnType<typeof setTimeout> | undefined;
  const contain = (reason: string) => { fault ??= reason; if (terminating) return; terminating = true;
    child.kill('SIGTERM'); killDeadline = setTimeout(() => child.kill('SIGKILL'), 5000); };
  child.stdout.on('data', (b: Buffer) => { outBytes += b.length; if (outBytes > 65536) contain('stdout-cap'); else out.push(b); });
  child.stderr.on('data', (b: Buffer) => { errBytes += b.length; if (errBytes > 65536) contain('stderr-cap'); else err.push(b); });
  child.stdout.once('end', () => { outEnd = true; }); child.stderr.once('end', () => { errEnd = true; });
  child.once('exit', (code, signal) => { exit = [code, signal]; });
  const closed = new Promise<void>((resolve, reject) => { child.once('error', error => { childError = error; }); child.once('close', (code, signal) => {
    try { assert.deepEqual(exit, [0, null]); assert.equal(code, 0); assert.equal(signal, null); assert.ok(outEnd && errEnd); assert.equal(childError, undefined); resolve(); } catch (error) { reject(error); }
  }); });
  child.stdin.on('error', () => { fault ??= 'stdin-error'; }); child.stdin.end(input);
  const deadline = setTimeout(() => contain('deadline'), mode === 'real' ? 30000 : 10000); let closureError: unknown;
  try { await closed; } catch (error) { closureError = error; }
  finally { clearTimeout(deadline); if (killDeadline) clearTimeout(killDeadline); }
  for (const [file, pin] of Object.entries(files)) assert.deepEqual(heldBytes(file).pin, pin);
  for (const [file, pin] of Object.entries(sourcePins)) assert.deepEqual(heldBytes(file).pin, pin);
  assert.deepEqual(heldBytes(fileURLToPath(import.meta.url)).pin, ownTest.pin);
  assert.equal(fault, undefined);
  const stderr = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(err, errBytes));
  if (closureError) throw new Error('SQL_WITNESS_CHILD_CLOSURE: ' + stderr, { cause: closureError });
  assert.equal(stderr, '');
  const observed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(out, outBytes)));
  const refusal = telemetrySqlFailureV1(observed);
  // Controlled refusal nominations are never real-SQL qualification. Cleanup is
  // strict in every mode, and its diagnostics must not obscure the primary.
  if (refusal && (observed.cleanupCauses.length || mode === 'real' || mode === 'admission' && !probe)) throw refusal;
  assert.deepEqual(observed.cleanupCauses, []);
  if (!probe && mode === 'admission') { assert.equal(observed.fault, null); assert.equal(observed.primary, null); }
  if (mode === 'socket') { assert.equal(observed.fault, 'HARNESS_FAULT:sql-second-socket'); assert.equal(observed.primary, observed.fault); }
  if (mode === 'real') {
    assert.equal(observed.fault, null); assert.equal(observed.primary, null);
    assert.equal(observed.socketFactoryCalls, 1); assert.equal(observed.socketAllocations, 1);
    assert.equal(observed.connectAttempts, 1); assert.equal(observed.connectCalls, 1); assert.equal(observed.rawSocketClosed, true);
    assert.deepEqual(observed.cleanupAttempts, ['rollback', 'release', 'end', 'raw-close']);
    assert.deepEqual(observed.sqlTrace, [0, 1, 2, 3, 4, 5, 6]);
    const multiset = (rows: Record<string, unknown>[]) => rows.map(row => {
      assert.equal(Object.getPrototypeOf(row), Object.prototype);
      assert.ok(Object.values(row).every(v => v === null || typeof v === 'string' || typeof v === 'number' && Number.isFinite(v)));
      return JSON.stringify(Object.keys(row).sort().map(key => [key, row[key]]));
    }).sort();
    assert.deepEqual(multiset(observed.results[0]), multiset(fixture.expectedSteps));
    if (sqlMutation) {
      assert.throws(() => assert.deepEqual(multiset(observed.results[1]), multiset(fixture.expectedAverages)), assert.AssertionError);
      assert.deepEqual(multiset(observed.results[1]), multiset([
        { step_id: 'below', avg_ms: 100 }, { step_id: 'equal', avg_ms: 100 },
        { step_id: 'above', avg_ms: 100 }, { step_id: 'subms', avg_ms: 0.001 },
        { step_id: 'duplicate', avg_ms: 100 },
      ]));
      observed.currentInclusionMutationDetected = true;
    } else assert.deepEqual(multiset(observed.results[1]), multiset(fixture.expectedAverages));
  }
  return observed;
}

const DIRECT_ENTRY = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (DIRECT_ENTRY) {
  test('SQL failure projection preserves primary first and every ordered cleanup cause', async () => {
    const helpers = await import(import.meta.url);
    assert.equal(typeof helpers.telemetrySqlFailureV1, 'function');
    const failure = helpers.telemetrySqlFailureV1({ primary: 'FIRST_PRIMARY', fault: 'SECOND_GUARD',
      cleanupCauses: ['ROLLBACK_FAILURE', 'END_FAILURE', 'RAW_CLOSE_FAILURE'] });
    assert.ok(failure instanceof AggregateError);
    assert.deepEqual(failure.errors.map((e: Error) => e.message),
      ['primary: FIRST_PRIMARY', 'guard: SECOND_GUARD', 'cleanup: ROLLBACK_FAILURE', 'cleanup: END_FAILURE', 'cleanup: RAW_CLOSE_FAILURE']);
    assert.equal(failure.cause, failure.errors[0]);
    assert.equal(helpers.telemetrySqlFailureV1({ primary: null, fault: null, cleanupCauses: [] }), undefined);
  });
  test('real read-only SQL proves frozen telemetry arithmetic/calendar and definite closure', {
    skip: process.env.MC_TELEMETRY_REAL_SQL_V1 !== '1' ? 'REAL_SQL_NOT_SELECTED_UNQUALIFIED' : false,
  }, async () => {
    const observed = await runTelemetrySqlWitnessV1('real');
    console.log('MC_TELEMETRY_REAL_SQL_V1 ' + JSON.stringify({ identity: observed.identity, journal31: observed.journal31,
      socketFactoryCalls: observed.socketFactoryCalls, rawSocketClosed: observed.rawSocketClosed,
      cleanupAttempts: observed.cleanupAttempts, results: observed.results }));
    // Sequential fresh closed children under the sole opt-in test owner. The
    // killed mutation is a control, never qualification of the positive SQL.
    const mutant = await runTelemetrySqlWitnessV1('real', undefined, 'exclude-current');
    assert.equal(mutant.currentInclusionMutationDetected, true);
    console.log('MC_TELEMETRY_SQL_MUTATION_CONTROL_V1 ' + JSON.stringify({ identity: mutant.identity,
      rawSocketClosed: mutant.rawSocketClosed, cleanupAttempts: mutant.cleanupAttempts,
      averages: mutant.results[1], currentInclusionMutationDetected: true }));
  });
  test('frozen SQL fixture preserves typed inputs and expected result multiplicity', async () => {
    const helpers = await import(import.meta.url), fixture = helpers.telemetrySqlFixtureV1();
    assert.equal(fixture.inputRows, 36); assert.equal(fixture.expectedSteps.length, 24);
    assert.equal(fixture.expectedAverages.length, 13);
    assert.equal(fixture.expectedSteps.filter((r: any) => r.step_id === 'duplicate' && r.duration_ms === 10).length, 2);
    assert.match(fixture.prefix, /^WITH steps\(run_id, step_id, agent_id, status, started_at, updated_at, step_index\) AS/);
    assert.ok(!fixture.prefix.includes('$1'));
  });
  test('real SQL mode refuses missing opt-in before driver or socket admission', { skip: process.env.MC_TELEMETRY_REAL_SQL_V1 === '1' }, async () => {
    const helpers = await import(import.meta.url);
    await assert.rejects(() => helpers.runTelemetrySqlWitnessV1('real'), /REAL_SQL_OPT_IN_REQUIRED/);
  });
  test('SQL mutation admission refuses arbitrary variants before owned effects', async () => {
    await assert.rejects(() => runTelemetryConsumerV1({ sqlMutation: 'arbitrary' as any }), assert.AssertionError);
    await assert.rejects(() => runTelemetrySqlWitnessV1('admission', undefined, 'arbitrary' as any), assert.AssertionError);
    await assert.rejects(() => runTelemetrySqlWitnessV1('admission', undefined, 'exclude-current'), assert.AssertionError);
  });
  test('fixed current-exclusion mutation reaches actual captured query bytes without unknown-SQL credit', async () => {
    const observed = await runTelemetryConsumerV1({ request: '/api/telemetry?runId=run-contract', sqlMutation: 'exclude-current' });
    assert.equal(observed.httpStatus, 200); assert.equal(observed.exec.length, 0);
    assert.deepEqual(observed.sql.map((row: any) => [row.rawSql, row.values]),
      TELEMETRY_EXCLUDE_CURRENT_SQL_V1.map(sql => [sql, ['run-contract']]));
    assert.match(observed.sql[1].rawSql, /AND s\.run_id <> 'run-contract'/);
  });
  test('separate socket factory owns one unconnected socket and refuses second allocation', async () => {
    const helpers = await import(import.meta.url);
    const observed = await helpers.runTelemetrySqlWitnessV1('socket');
    assert.equal(observed.socketAllocations, 1); assert.equal(observed.socketFactoryCalls, 2);
    assert.equal(observed.rawSocketClosed, true); assert.equal(observed.connectCalls, 0);
    assert.equal(observed.fault, 'HARNESS_FAULT:sql-second-socket');
    assert.deepEqual(observed.cleanupCauses, []);
  });
  test('separate SQL admission evaluates the actual pinned driver without a connection', async () => {
    const helpers = await import(import.meta.url);
    assert.equal(typeof helpers.runTelemetrySqlWitnessV1, 'function');
    const observed = await helpers.runTelemetrySqlWitnessV1('admission');
    assert.equal(observed.driverVersion, '3.4.8');
    assert.equal(observed.socketAllocations, 0); assert.equal(observed.socketFactoryCalls, 0);
    assert.equal(observed.primary, null); assert.equal(observed.fault, null);
    assert.deepEqual(observed.cleanupCauses, []);
  });
  for (const [probe, reason] of [['network', 'sql-admission-no-connection'],
    ['secret', 'sql-secret-read'], ['native-secret', 'sql-secret-read'], ['write', 'sql-filesystem-effect'], ['write-stream', 'sql-filesystem-effect'],
    ['socket-connect', 'sql-connect-refused'], ['server-listen', 'sql-listen-refused'], ['edge', 'sql-entry-edge']] as const) {
    test(`separate SQL admission denies ${probe} before delegation`, async () => {
      const observed = await runTelemetrySqlWitnessV1('admission', probe);
      assert.equal(observed.fault, 'HARNESS_FAULT:' + reason);
      assert.equal(observed.primary, observed.fault);
      assert.equal(observed.socketAllocations, 0);
      assert.equal(observed.socketFactoryCalls, probe === 'network' ? 1 : 0);
      assert.equal(observed.connectAttempts, probe === 'socket-connect' ? 1 : 0);
      assert.equal(observed.listenAttempts, probe === 'server-listen' ? 1 : 0);
      assert.equal(observed.connectCalls, 0);
      assert.deepEqual(observed.cleanupCauses, []);
    });
  }
  test('shared harness import-only mode never registers route tests or selects SQL', async () => {
    const child = spawn(process.execPath, ['--input-type=module', '--eval',
      `const module=await import(${JSON.stringify(import.meta.url)});console.log(JSON.stringify({helper:typeof module.runTelemetryConsumerV1}));`],
    { cwd: ROOT, env: { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C' }, stdio: ['ignore', 'pipe', 'pipe'] });
    const out: Buffer[] = [], err: Buffer[] = []; let outBytes = 0, errBytes = 0, outEnd = false, errEnd = false;
    let exit: [number | null, NodeJS.Signals | null] | undefined, spawnError: Error | undefined;
    let containment = false, killDeadline: ReturnType<typeof setTimeout> | undefined;
    const contain = () => { if (containment) return; containment = true; child.kill('SIGTERM'); killDeadline = setTimeout(() => child.kill('SIGKILL'), 5000); };
    child.stdout.on('data', (b: Buffer) => { outBytes += b.length; if (outBytes > 65536) contain(); else out.push(b); });
    child.stderr.on('data', (b: Buffer) => { errBytes += b.length; if (errBytes > 65536) contain(); else err.push(b); });
    child.stdout.once('end', () => { outEnd = true; }); child.stderr.once('end', () => { errEnd = true; });
    child.once('exit', (code, signal) => { exit = [code, signal]; });
    const deadline = setTimeout(contain, 10000);
    try { await new Promise<void>((resolve, reject) => { child.once('error', error => { spawnError = error; }); child.once('close', (code, signal) => {
      try { assert.equal(code, 0); assert.equal(signal, null); assert.deepEqual(exit, [0, null]);
        assert.ok(outEnd && errEnd); assert.equal(spawnError, undefined); resolve(); } catch (error) { reject(error); }
    }); }); } finally { clearTimeout(deadline); if (killDeadline) clearTimeout(killDeadline); }
    assert.equal(containment, false);
    assert.ok(outBytes <= 65536 && errBytes <= 65536);
    const stdout = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(out, outBytes));
    const stderr = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(err, errBytes));
    assert.equal(stderr, ''); assert.deepEqual(JSON.parse(stdout), { helper: 'function' });
  });
  test('owned loader reaches actual mounted route without config, driver or subprocess', async () => {
    const observed = await runTelemetryConsumerV1({ request: '/api/telemetry/run-contract' });
    assert.equal(observed.httpStatus, 200); assert.equal(observed.body.steps[0].duration_ms, 250);
    assert.equal(observed.exec.length, 0); assert.equal(observed.sql.length, 2);
    assert.deepEqual(observed.sql.map((row: any) => row.rawSql), [...TELEMETRY_SQL_V1]);
  });
  for (const [safety, reason, site] of [
    ['read-sync', 'secret-read', 'readFileSync'], ['read-async', 'secret-read', 'readFile'],
    ['open-async', 'secret-read', 'open'], ['write-open', 'write-open', 'open'],
    ['write-readFile', 'write-read-options', 'readFileSync'],
    ['write-stream', 'filesystem-write', null],
    ['pg-miss', 'pg-port-miss', null], ['config-miss', 'config-port-miss', null],
  ] as const) {
    test(`owned harness refuses ${safety} before secret or driver delegation`, async () => {
      const observed = await runTelemetryConsumerV1({ safety, expectHarnessFault: true });
      assert.equal(observed.fault, 'HARNESS_FAULT:' + reason);
      assert.deepEqual(observed.deniedRead, site === null ? null : { site, reason });
      assert.equal(observed.sql.length, 0); assert.equal(observed.exec.length, 0);
    });
  }
  test('legacy actual HTTP consumer is explicitly limited, not an unversioned healthy response', async () => {
    const observed = await runTelemetryConsumerV1({ request: '/api/telemetry/run-contract' });
    assert.equal(observed.httpStatus, 200);
    assert.equal(observed.body.status, 'available_limited');
    assert.equal(observed.body.history.reasonCode, 'PRECISE_TRANSITION_HISTORY_UNAVAILABLE');
  });
  test('query transport reaches actual router for opaque run identifiers', async () => {
    const observed = await runTelemetryConsumerV1({ request: '/api/telemetry?runId=run-contract' });
    assert.equal(observed.httpStatus, 200); assert.equal(observed.body.runId, 'run-contract');
  });
  test('actual API uses query transport and delegates to real mounted HTTP', async () => {
    const observed = await runTelemetryConsumerV1({ clientRunId: 'run-contract' });
    assert.equal(observed.clientUrl, '/api/telemetry?runId=run-contract');
    assert.equal(observed.clientResult.status, 'available_limited');
  });
  for (const request of ['/api/telemetry?runId=', '/api/telemetry?runId=a&runId=b',
    '/api/telemetry?runId=a&extra=b', '/api/telemetry?runId=%C3%28']) {
    test(`invalid query ${request} refuses before SQL`, async () => {
      const observed = await runTelemetryConsumerV1({ request });
      assert.equal(observed.httpStatus, 400);
      assert.deepEqual(observed.body, { schema: 'mission-control.pipeline-telemetry.v1',
        status: 'unavailable', runId: null, code: 'TELEMETRY_RUN_ID_INVALID', reason: 'invalid_run_id' });
      assert.equal(observed.sql.length, 0); assert.equal(observed.exec.length, 0);
    });
  }
  test('actual route normalizes SQL failure without exposing raw error', async () => {
    const observed = await runTelemetryConsumerV1({ request: '/api/telemetry/run-contract', sqlFailure: true });
    assert.equal(observed.httpStatus, 503);
    assert.deepEqual(observed.body, { schema: 'mission-control.pipeline-telemetry.v1',
      status: 'unavailable', runId: 'run-contract', code: 'TELEMETRY_READ_FAILED', reason: 'sql' });
  });
  for (const body of [{ steps: [], transitions: [] }, { schema: 'unknown', status: 'available_limited', runId: 'run-contract' }]) {
    test('actual API refuses malformed successful wire instead of returning healthy data', async () => {
      const observed = await runTelemetryConsumerV1({ clientRunId: 'run-contract',
        reply: { status: 200, body, contentType: 'application/json; charset=utf-8' } });
      assert.deepEqual(observed.clientResult, { status: 'unavailable', runId: 'run-contract', reason: 'invalid_response' });
    });
  }
  for (const started_at of ['2024-02-30T00:00:00.000000Z AD', '0000-01-01T00:00:00.000000Z AD',
    '012345-01-01T00:00:00.000000Z AD', '0002-02-29T00:00:00.000000Z BC',
    '4714-11-23T23:59:59.999999Z BC', '294277-01-01T00:00:00.000000Z AD']) {
    test(`actual API rejects noncanonical/out-of-range calendar ${started_at}`, async () => {
      const body = availableFixtureV1(); body.steps[0].started_at = started_at;
      const observed = await runTelemetryConsumerV1({ clientRunId: 'run-contract',
        reply: { status: 200, body, contentType: 'application/json' } });
      assert.deepEqual(observed.clientResult, { status: 'unavailable', runId: 'run-contract', reason: 'invalid_response' });
    });
  }
  for (const [name, alter] of [
    ['unknown schema', (body: any) => { body.schema = 'unknown'; }],
    ['unknown status', (body: any) => { body.status = 'unknown'; }],
    ['nested extra key', (body: any) => { body.history.extra = true; }],
    ['nested missing key', (body: any) => { delete body.analysis.coverage; }],
    ['nested wrong scalar', (body: any) => { body.steps[0].isBottleneck = 'false'; }],
    ['duration numeric string', (body: any) => { body.steps[0].duration_ms = '250'; }],
    ['threshold numeric string', (body: any) => { body.bottlenecks = [{ type: 'execution_bottleneck', stepId: 'plan', message: 'fixture', value: 250, threshold: '100' }]; }],
  ] as const) {
    test(`actual API rejects exact wire violation: ${name}`, async () => {
      const body = availableFixtureV1(); alter(body);
      const observed = await runTelemetryConsumerV1({ clientRunId: 'run-contract', reply: { status: 200, body, contentType: 'application/json' } });
      assert.deepEqual(observed.clientResult, { status: 'unavailable', runId: 'run-contract', reason: 'invalid_response' });
    });
  }
  test('actual API refuses a nonfinite parsed scalar without JSON stringify masking', async () => {
    const text = JSON.stringify(availableFixtureV1()).replace('"duration_ms":250', '"duration_ms":1e309');
    assert.match(text, /"duration_ms":1e309/);
    assert.equal(JSON.parse(text).steps[0].duration_ms, Infinity);
    const observed = await runTelemetryConsumerV1({ clientRunId: 'run-contract', reply: { status: 200, text, contentType: 'application/json' } });
    assert.deepEqual(observed.clientResult, { status: 'unavailable', runId: 'run-contract', reason: 'invalid_response' });
  });
  test('actual API refuses a missing Content-Type on an otherwise valid wire', async () => {
    const observed = await runTelemetryConsumerV1({ clientRunId: 'run-contract', reply: { status: 200, body: availableFixtureV1() } });
    assert.deepEqual(observed.clientResult, { status: 'unavailable', runId: 'run-contract', reason: 'invalid_response' });
  });
  test('actual API rejects ordered finite durations whose sum overflows', async () => {
    const body = availableFixtureV1(); body.steps = [{ ...body.steps[0], duration_ms: 1e308 }, { ...body.steps[0], duration_ms: 1e308 }];
    const observed = await runTelemetryConsumerV1({ clientRunId: 'run-contract', reply: { status: 200, body, contentType: 'application/json' } });
    assert.deepEqual(observed.clientResult, { status: 'unavailable', runId: 'run-contract', reason: 'invalid_response' });
  });
  for (const runId of ['', '\u0000', '\ud800', '😀'.repeat(65)]) {
    test('actual API rejects invalid local ID before fetch', async () => {
      const observed = await runTelemetryConsumerV1({ clientRunId: runId,
        reply: { status: 200, body: availableFixtureV1(), contentType: 'application/json' } });
      assert.equal(observed.clientUrl, null);
      assert.deepEqual(observed.clientResult, { status: 'unavailable', runId: null, reason: 'invalid_run_id' });
    });
  }
  for (const [reply, reason] of [
    [{ status: 200, text: ' '.repeat(1048577) + '{}', contentType: 'application/json' }, 'invalid_response'],
    [{ status: 200, bytes: [0xc3, 0x28], contentType: 'application/json' }, 'invalid_response'],
    [{ status: 200, text: '{', contentType: 'application/json' }, 'invalid_json'],
    [{ status: 200, body: availableFixtureV1(), contentType: 'text/plain' }, 'invalid_response'],
    [{ status: 418, text: '{', contentType: 'text/plain' }, 'http'],
  ] as const) {
    test(`actual API normalizes body/HTTP boundary ${reason}`, async () => {
      const observed = await runTelemetryConsumerV1({ clientRunId: 'run-contract', reply: { ...reply, ...('bytes' in reply ? { bytes: [...reply.bytes] } : {}) } });
      assert.deepEqual(observed.clientResult, { status: 'unavailable', runId: 'run-contract', reason });
    });
  }
  for (const runId of ['a"b\'c', '%2F/%25', '.', '..', 'a/b?#&=+', ' T\u00fcrk\u00e7e😀 ', '😀'.repeat(64)]) {
    test(`opaque UTF8 runId round-trips once to both actual bound queries: ${JSON.stringify(runId.slice(0, 32))}`, async () => {
      const observed = await runTelemetryConsumerV1({ clientRunId: runId });
      assert.equal(observed.clientUrl, '/api/telemetry?runId=' + encodeURIComponent(runId));
      assert.equal(observed.clientResult.status, 'available_limited');
      assert.equal(observed.clientResult.runId, runId);
      assert.equal(observed.sql.length, 2);
      assert.deepEqual(observed.sql.map((row: any) => row.values), [[runId], [runId]]);
      assert.equal(observed.exec.length, 0);
    });
  }
  for (const request of ['/api/telemetry?runId=%00', '/api/telemetry?runId=%ED%A0%80',
    '/api/telemetry?runId[]=a', '/api/telemetry?runId=a&', '/api/telemetry/%C3%28',
    '/api/telemetry/a?runId=b', '/api/telemetry?runId=' + 'x'.repeat(257)]) {
    test(`actual route rejects invalid raw input before either query: ${request.slice(0, 80)}`, async () => {
      const observed = await runTelemetryConsumerV1({ request });
      assert.equal(observed.httpStatus, 400); assert.equal(observed.body.reason, 'invalid_run_id');
      assert.equal(observed.sql.length, 0); assert.equal(observed.exec.length, 0);
    });
  }
  for (const [request, requestMethod] of [
    ['/api/TeLeMeTrY/run-contract', 'GET'], ['/api/telemetry/run-contract/', 'GET'],
    ['/api/telemetry/?runId=run-contract', 'GET'], ['/api/telemetry?runId=run-contract', 'HEAD'],
  ] as const) {
    test(`actual Express compatibility ${requestMethod} ${request}`, async () => {
      const observed = await runTelemetryConsumerV1({ request, requestMethod });
      assert.equal(observed.httpStatus, 200); assert.equal(observed.sql.length, 2);
      assert.equal(requestMethod === 'HEAD' ? observed.body : observed.body.runId, requestMethod === 'HEAD' ? '' : 'run-contract');
    });
  }
  test('actual route compares raw duration strictly before rounding and flags duplicate human groups', async () => {
    const row = { step_id: 'same', agent_id: null, status: 'done', started_at: null, updated_at: null };
    const observed = await runTelemetryConsumerV1({ request: '/api/telemetry?runId=run-contract',
      sqlRows: [{ ...row, duration_ms: 0.009 }, { ...row, duration_ms: 0 },
        { ...row, step_id: 'equal', duration_ms: 400 }, { ...row, step_id: 'waiting', status: 'waiting', duration_ms: null }],
      sqlAverages: [{ step_id: 'same', avg_ms: 0.003 }, { step_id: 'equal', avg_ms: 200 }] });
    assert.equal(observed.httpStatus, 200);
    assert.deepEqual(observed.body.steps.map((s: any) => [s.step_id, s.duration_ms, s.isBottleneck]),
      [['same', 0, true], ['same', 0, true], ['equal', 400, false], ['waiting', null, false]]);
    assert.deepEqual(observed.body.bottlenecks.map((b: any) => [b.stepId, b.value, b.threshold]), [['same', 0.009, 0.006]]);
  });
  for (const started_at of ['0001-02-29T00:00:00.000001Z BC', '12345-01-01T00:00:00.000001Z AD',
    '4714-11-24T00:00:00.000000Z BC', '294276-12-31T23:59:59.999999Z AD']) {
    test(`actual client accepts canonical finite calendar ${started_at}`, async () => {
      const body = availableFixtureV1(); body.steps[0].started_at = started_at; body.steps[0].duration_ms = 0;
      const observed = await runTelemetryConsumerV1({ clientRunId: 'run-contract', reply: { status: 200, body, contentType: 'application/json' } });
      assert.deepEqual(observed.clientResult, body);
    });
  }
  test('actual streamed client accepts the inclusive one-MiB boundary', async () => {
    const body = availableFixtureV1(), json = JSON.stringify(body);
    const observed = await runTelemetryConsumerV1({ clientRunId: 'run-contract',
      reply: { status: 200, text: ' '.repeat(1048576 - Buffer.byteLength(json)) + json, contentType: 'APPLICATION/JSON; CHARSET="UTF-8"' } });
    assert.deepEqual(observed.clientResult, body);
  });
  for (const [status, body, reason] of [
    [200, { ...availableFixtureV1(), runId: 'other' }, 'run_id_mismatch'],
    [503, { schema: 'mission-control.pipeline-telemetry.v1', status: 'unavailable', runId: 'other', code: 'TELEMETRY_READ_FAILED', reason: 'sql' }, 'run_id_mismatch'],
    [503, availableFixtureV1(), 'invalid_response'],
    [200, { ...availableFixtureV1(), unexpected: true }, 'invalid_response'],
  ] as const) {
    test(`actual client status/body/echo precedence ${status}/${reason}`, async () => {
      const observed = await runTelemetryConsumerV1({ clientRunId: 'run-contract', reply: { status, body, contentType: 'application/json' } });
      assert.deepEqual(observed.clientResult, { status: 'unavailable', runId: 'run-contract', reason });
    });
  }
  for (const contentType of ['application/problem+json', 'application/json; charset=latin1',
    'application/json; charset=utf-8; charset=utf-8', 'application/json; x=y', 'application/json, text/plain']) {
    test(`actual client refuses noncontract Content-Type ${contentType}`, async () => {
      const observed = await runTelemetryConsumerV1({ clientRunId: 'run-contract', reply: { status: 200, body: availableFixtureV1(), contentType } });
      assert.deepEqual(observed.clientResult, { status: 'unavailable', runId: 'run-contract', reason: 'invalid_response' });
    });
  }
  test('coherent raw client cap mutant is caught by the inclusive boundary consumer', async () => {
    const body = availableFixtureV1(), json = JSON.stringify(body);
    const observed = await runTelemetryConsumerV1({ clientRunId: 'run-contract',
      reply: { status: 200, text: ' '.repeat(1048576 - Buffer.byteLength(json)) + json, contentType: 'application/json' },
      replacements: { 'src/lib/api.ts': { from: 'bytes + next.value.byteLength > 1048576', to: 'bytes + next.value.byteLength >= 1048576' } } });
    assert.throws(() => assert.deepEqual(observed.clientResult, body), assert.AssertionError);
    assert.equal(observed.clientResult.reason, 'invalid_response');
  });
  test('coherent raw route threshold mutant is caught by equality consumer', async () => {
    const observed = await runTelemetryConsumerV1({ request: '/api/telemetry?runId=run-contract',
      sqlRows: [{ step_id: 'equal', agent_id: null, status: 'done', started_at: null, updated_at: null, duration_ms: 400 }],
      sqlAverages: [{ step_id: 'equal', avg_ms: 200 }],
      replacements: { 'server/routes/telemetry.ts': { from: 'if (row.duration_ms > threshold)', to: 'if (row.duration_ms >= threshold)' } } });
    assert.throws(() => assert.equal(observed.body.bottlenecks.length, 0), assert.AssertionError);
    assert.equal(observed.body.bottlenecks.length, 1);
  });
  test('coherent raw route rounding mutant is caught by submillisecond consumer', async () => {
    const observed = await runTelemetryConsumerV1({ request: '/api/telemetry?runId=run-contract',
      sqlRows: [{ step_id: 'sub', agent_id: null, status: 'done', started_at: null, updated_at: null, duration_ms: 0.009 }],
      sqlAverages: [{ step_id: 'sub', avg_ms: 0.003 }],
      replacements: { 'server/routes/telemetry.ts': { from: 'if (row.duration_ms > threshold)', to: 'if (Math.round(row.duration_ms) > threshold)' } } });
    assert.throws(() => assert.equal(observed.body.bottlenecks.length, 1), assert.AssertionError);
    assert.equal(observed.body.bottlenecks.length, 0);
  });
  test('coherent raw route second-decode mutant is caught by opaque ID echo', async () => {
    const runId = '%2F';
    const observed = await runTelemetryConsumerV1({ clientRunId: runId,
      replacements: { 'server/routes/telemetry.ts': { from: 'decodeURIComponent(query.slice(6))', to: 'decodeURIComponent(decodeURIComponent(query.slice(6)))' } } });
    assert.throws(() => assert.equal(observed.clientResult.status, 'available_limited'), assert.AssertionError);
    assert.equal(observed.clientResult.reason, 'run_id_mismatch');
    assert.deepEqual(observed.sql.map((row: any) => row.values), [['/'], ['/']]);
  });
  test('coherent raw client echo mutant is caught by validated wrong-run consumer', async () => {
    const body = { ...availableFixtureV1(), runId: 'other' };
    const observed = await runTelemetryConsumerV1({ clientRunId: 'run-contract', reply: { status: 200, body, contentType: 'application/json' },
      replacements: { 'src/lib/api.ts': { from: 'if (body.runId !== runId)', to: 'if (false)' } } });
    assert.throws(() => assert.equal(observed.clientResult.reason, 'run_id_mismatch'), assert.AssertionError);
    assert.equal(observed.clientResult.status, 'available_limited');
  });
  test('coherent raw client overflow mutant is caught by finite-total consumer', async () => {
    const body = availableFixtureV1(); body.steps = [{ ...body.steps[0], duration_ms: 1e308 }, { ...body.steps[0], duration_ms: 1e308 }];
    const observed = await runTelemetryConsumerV1({ clientRunId: 'run-contract', reply: { status: 200, body, contentType: 'application/json' },
      replacements: { 'src/lib/api.ts': { from: 'if (!Number.isFinite(total)) return invalid();', to: 'if (false) return invalid();' } } });
    assert.throws(() => assert.equal(observed.clientResult.reason, 'invalid_response'), assert.AssertionError);
    assert.equal(observed.clientResult.status, 'available_limited');
  });
  test('coherent raw client calendar mutant fails the actual upper-bound consumer', async () => {
    const body = availableFixtureV1(); body.steps[0].started_at = '294277-01-01T00:00:00.000000Z AD';
    const observed = await runTelemetryConsumerV1({ clientRunId: 'run-contract',
      reply: { status: 200, body, contentType: 'application/json' },
      replacements: { 'src/lib/api.ts': { from: 'return year <= 294276;', to: 'return true;' } } });
    assert.throws(() => assert.equal(observed.clientResult.reason, 'invalid_response'), assert.AssertionError);
    assert.equal(observed.clientResult.status, 'available_limited');
  });
  test('coherent raw client HTTP precedence mutant fails the actual unknown-status consumer', async () => {
    const observed = await runTelemetryConsumerV1({ clientRunId: 'run-contract',
      reply: { status: 418, text: '{', contentType: 'text/plain' },
      replacements: { 'src/lib/api.ts': { from: "if (![200, 400, 503].includes(response.status)) return refused('http');", to: "if (false) return refused('http');" } } });
    assert.throws(() => assert.equal(observed.clientResult.reason, 'http'), assert.AssertionError);
    assert.equal(observed.clientResult.reason, 'invalid_response');
  });
  test('owned after-effect cleanup faults preserve primary and attempt every remaining cleanup', async () => {
    const observed = await runTelemetryConsumerV1({ request: '/api/telemetry?runId=run-contract', primaryFault: true,
      cleanupFaults: ['idle', 'server', 'hook', 'restore'] });
    assert.equal(observed.httpStatus, 200);
    assert.equal(observed.primary, 'NOMINATED_PRIMARY_AFTER_CONSUMER');
    assert.deepEqual(observed.cleanupAttempts, ['idle', 'server', 'sockets', 'hook', 'restore']);
    assert.deepEqual(observed.cleanupCauses, ['NOMINATED_CLEANUP_idle', 'NOMINATED_CLEANUP_server', 'NOMINATED_CLEANUP_hook', 'NOMINATED_CLEANUP_restore']);
    assert.equal(observed.settled, false);
  });
  for (const [readerFaults, text, reason] of [
    [['read', 'cancel', 'release'], JSON.stringify(availableFixtureV1()), 'network'],
    [['cancel', 'release'], ' '.repeat(1048577), 'invalid_response'],
    [['release'], '{', 'invalid_json'],
    [['release'], JSON.stringify(availableFixtureV1()), 'network'],
  ] as const) {
    test(`owned reader after-effect faults preserve selected ${reason}`, async () => {
      const observed = await runTelemetryConsumerV1({ clientRunId: 'run-contract', readerFaults: [...readerFaults],
        reply: { status: 200, text, contentType: 'application/json' } });
      assert.deepEqual(observed.clientResult, { status: 'unavailable', runId: 'run-contract', reason });
      assert.equal(observed.readerActions.at(-1), 'release');
      assert.equal(observed.readerEffects.at(-1), 'release');
      assert.deepEqual(observed.readerNominations, [...readerFaults]);
      if ((readerFaults as readonly string[]).includes('cancel')) assert.ok(observed.readerEffects.includes('cancel'));
    });
  }
}
