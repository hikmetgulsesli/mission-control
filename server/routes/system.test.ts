import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import { createServer } from 'node:http';
import childProcess from 'node:child_process';
import os from 'node:os';
import { afterEach, mock, test } from 'node:test';
import express from 'express';
import ts from 'typescript';
import { cached } from '../utils/cache.js';
import { readWorkingVolumeDiskHealth, readWorkingVolumeObservation } from '../utils/disk-health.js';

afterEach(() => mock.restoreAll());
function statements(file: string, select?: (node: ts.Statement) => boolean): string {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  return tree.statements.filter(node => !ts.isImportDeclaration(node) && !ts.isExportAssignment(node) && (!select || select(node)))
    .map(node => node.getText(tree)).join('\n');
}
function compile(body: string) { return ts.transpileModule(body, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/^export /gm,''); }
function service() {
  const getSystemMetrics = new Function('config','os','fetch','readWorkingVolumeObservation', compile(statements('../utils/prometheus.ts')) + ';return getSystemMetrics;')(
    {prometheusUrl:'http://fixture.invalid'},os,async () => new Response('{"status":"success","data":{"resultType":"vector","result":[]}}'),readWorkingVolumeObservation);
  const router = new Function('Router','getSystemMetrics','cached','runCli',compile(statements('./system.ts'))+';return router;')(
    express.Router,getSystemMetrics,cached,()=>{throw Error('CLI forbidden');});
  const app = express(); app.use('/api', router);
  // Execute the actual production health registration only; substitute its DB
  // import data port so no config/PG/runtime module gets initialized.
  const health = statements('../app.ts', node => ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)
    && node.expression.arguments[0]?.getText() === "'/api/health'");
  assert.ok(health);
  new Function('app','config','os','fetch','readWorkingVolumeDiskHealth','healthDatabase',compile(health.replace("import('./utils/pg.js')",'healthDatabase()')))(
    app,{gatewayWs:'ws://fixture.invalid'},os,async()=>new Response('',{status:200}),readWorkingVolumeDiskHealth,async()=>({sql:async()=>[{count:0}]}));
  return app;
}
async function fixture(t: {after(fn:()=>Promise<void>):void}, app: express.Express) {
  const server=createServer(app); server.listen(0,'127.0.0.1'); await once(server,'listening');
  const address=server.address(); assert.ok(address && typeof address !== 'string');
  t.after(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});
  return `http://127.0.0.1:${address.port}`;
}

test('actual health and system HTTP use cwd volume APFS capacity and refresh after settlement',async t=>{
  let percent=95; let probes=0;
  mock.method(childProcess,'execFile',(_file:string,args:string[],_opts:unknown,callback:Function)=>{
    probes++; const capacity=args[1] === process.cwd() ? percent : 5;
    queueMicrotask(()=>callback(null,`Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/data 1000 400 50 ${capacity}% /Data\n`,''));
    return new childProcess.ChildProcess();
  });
  const base=await fixture(t,service());
  const system=await (await fetch(base+'/api/system')).json();
  const health=await (await fetch(base+'/api/health')).json();
  assert.equal(system.disk.percent,95); assert.equal(health.checks.disk.volume.percent,95);
  assert.equal(system.disk.freeBytes,51200); assert.equal(health.checks.disk.volume.freeBytes,51200);
  assert.equal(system.disk.path,process.cwd()); assert.equal(system.disk.mount,'/Data'); assert.equal(system.disk.source,'df');
  assert.ok(Number.isFinite(Date.parse(system.disk.observedAt)));
  percent=89; const next=await (await fetch(base+'/api/system')).json();
  assert.equal(next.disk.percent,89,'settled working-volume observation cannot become stale API data');
  assert.equal(probes,3);
});

test('failed df HTTP observations are unknown with null fields on both surfaces',async t=>{
  mock.method(childProcess,'execFile',(_file:string,_args:string[],_opts:unknown,callback:Function)=>{
    queueMicrotask(()=>callback(new Error('private fixture diagnostic'),'',''));return new childProcess.ChildProcess();});
  const base=await fixture(t,service());
  const system=await (await fetch(base+'/api/system')).json();const health=await (await fetch(base+'/api/health')).json();
  assert.equal(system.disk.percent,null);assert.equal(system.disk.freeBytes,null);assert.equal(system.disk.status,'unknown');
  assert.equal(health.checks.disk.status,'unknown');assert.equal(health.checks.disk.volume.percent,null);
  assert.doesNotMatch(JSON.stringify({system,health}),/private fixture diagnostic/);
});


test('health memory is labelled total minus freemem and invalid RAM remains unknown',async t=>{
  mock.method(childProcess,'execFile',(_file:string,_args:string[],_opts:unknown,callback:Function)=>{
    queueMicrotask(()=>callback(new Error('fixture df unavailable'),'',''));return new childProcess.ChildProcess();});
  mock.method(os,'totalmem',()=>8);mock.method(os,'freemem',()=>9);
  const base=await fixture(t,service());const response=await fetch(base+'/api/health');const value=await response.json();
  assert.equal(value.checks.memory.status,'unknown');assert.equal(value.checks.memory.source,'node:os');
  assert.equal(value.checks.memory.semantics,'total-os.freemem');assert.equal(value.checks.memory.detail,undefined);
});
