import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import express from 'express';
import ts from 'typescript';
import * as metadata from '../shared/agents.js';

const identity: any = await import(new URL('./agent-identity.ts', import.meta.url).href).catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});

test('resolver preserves raw provider/model and labels observed, configured, static and unknown evidence', () => {
  assert.equal(typeof identity.resolveAgentModelIdentity, 'function', 'shared identity resolver is required');
  const resolve = identity.resolveAgentModelIdentity;
  assert.deepEqual(resolve({ observedModel: 'provider/model', configuredModel: 'other/configured', staticModel: 'alias' }), {
    rawModelId: 'provider/model', rawProviderId: 'provider', provenance: 'observed_session',
    observedModelId: 'provider/model', configuredModelId: 'other/configured', staticModelId: 'alias',
  });
  assert.equal(resolve({configuredModel:'vendor/configured'}).provenance, 'configured');
  assert.equal(resolve({staticModel:'alias'}).provenance, 'static_fallback');
  assert.equal(resolve({}).provenance, 'unknown');
  assert.equal(resolve({}).rawModelId, null);
  assert.equal(resolve({observedModel:'raw-model',observedProvider:'raw-provider'}).rawProviderId, 'raw-provider');
  assert.equal(resolve({observedModel:'',configuredModel:'unknown',staticModel:'alias'}).provenance, 'static_fallback');
});

function compile(relative: string): string {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
  const tree = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true);
  const body = tree.statements.filter(node => !ts.isImportDeclaration(node) && !ts.isExportAssignment(node)).map(node => node.getText(tree)).join('\n');
  return ts.transpileModule(body, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
}

async function fixture(t: { after(fn:()=>Promise<void>):void }, selected = false) {
  let dashboard: any = { sessions: [
    {agent:'koda',model:'older/model',updatedAt:10,totalTokens:12},
    {agent:'koda',model:'observed/current',updatedAt:20,totalTokens:0},
    {key:'agent:visitor:main',model:'custom/model',provider:'custom',updatedAt:30,totalTokens:0},
  ], totalCostToday:0, totalCostAllTime:2, costBreakdown:[], tokenUsage:[] };
  const reads: string[] = [];
  const activityReads: string[] = [];
  const configured = [{id:'koda',model:'configured/koda'}, {id:'external',name:'External',model:'vendor/external'}];
  const read = (file: string) => {
    if (file === '/fixture/data.json') {
      if (dashboard === undefined) throw Object.assign(Error('missing'), {code:'ENOENT'});
      return JSON.stringify(dashboard);
    }
    reads.push(String(file));
    throw Object.assign(Error('ambient file access forbidden'), {code:'ENOENT'});
  };
  const ports: Record<string, unknown> = {
    ...metadata, ...identity, Router:express.Router, readFileSync:read,
    writeFileSync:()=>{throw Error('write forbidden');}, existsSync:(file:string)=>{activityReads.push(file);return false;}, readdirSync:()=>[], statSync:()=>{throw Error('stat forbidden');},
    join:(...parts:string[])=>parts.join('/'), homedir:()=>'/ambient',
    config:{dataJson:'/fixture/data.json',clawtabsConfig:'/ambient/profiles.json'}, PATHS:{agentsDir:'/fixture/agents'},
    runCliJson:async()=>configured, runCli:()=>{throw Error('CLI write forbidden');},
    cached:async(_key:string,_ttl:number,read:()=>Promise<unknown>)=>read(), setCache:()=>{},
    freshMissionControlSelectedV1:()=>selected,
  };
  const app=express();
  for (const route of ['agents','performance','costs']) {
    const router=new Function(...Object.keys(ports),compile(`../routes/${route}.ts`)+';return router;')(...Object.values(ports));
    app.use('/api',router);
  }
  const server=createServer(app);server.listen(0,'127.0.0.1');await once(server,'listening');
  const address=server.address();assert.ok(address && typeof address!=='string');
  t.after(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});
  return {reads,activityReads,setData:(value:any)=>{dashboard=value;},get:async(route:string)=>{
    const response=await fetch(`http://127.0.0.1:${address.port}/api/${route}`);
    assert.equal(response.status,200);return response.json();
  }};
}

test('actual agents and performance HTTP retain all14 and unknown runtime/configured agents with the same identity',async t=>{
  const f=await fixture(t);const agents=await f.get('agents');const perf=await f.get('performance');
  for (const id of ['main','koda','flux','atlas','iris','sentinel','cipher','lux','nexus','prism','axon','nova','zeta','helix','visitor','external']) {
    const agent=agents.find((a:any)=>a.id===id);assert.ok(agent,`agents missing ${id}`);assert.ok(perf.agents[id],`performance missing ${id}`);
    assert.deepEqual(agent.modelIdentity,perf.agents[id].modelIdentity);
  }
  assert.equal(agents.find((a:any)=>a.id==='atlas').name,'Atlas');
  assert.equal(agents.find((a:any)=>a.id==='lux').role,'Dev / Writer');
  assert.equal(agents.find((a:any)=>a.id==='nexus').role,'Dev / SRE');
  assert.equal(perf.agents.koda.model,'observed/current');assert.equal(perf.agents.koda.modelIdentity.provenance,'observed_session');
  assert.equal(perf.agents.external.modelIdentity.provenance,'configured');assert.equal(perf.agents.helix.modelIdentity.provenance,'static_fallback');
  assert.equal(perf.agents.koda.totalTokens,12);assert.equal(perf.totalCostToday,0);
  const detail=await f.get('agents/visitor');assert.equal(detail.model,'custom/model');
});

test('newly discoverable unknown identities never become filesystem path segments',async t=>{
  const f=await fixture(t);f.setData({sessions:[{agent:'../outside'},{agent:'new-agent'}]});
  const agents=await f.get('agents');const perf=await f.get('performance');
  for(const id of ['../outside','new-agent']) {
    assert.ok(agents.find((agent:any)=>agent.id===id));
    assert.equal(perf.agents[id].modelIdentity.provenance,'unknown');
    assert.equal(perf.agents[id].modelIdentity.rawModelId,null);
  }
  assert.equal(f.activityReads.some(file=>file.includes('../outside')),false);
});

test('selected fresh identity HTTP never reads ambient OpenClaw config or profiles',async t=>{
  const f=await fixture(t,true);await f.get('agents');await f.get('performance');assert.deepEqual(f.reads,[]);
});

test('actual missing usage HTTP keeps unavailable totals distinct from measured zero',async t=>{
  const f=await fixture(t);f.setData(undefined);
  const perf=await f.get('performance');const costs=await f.get('costs');
  assert.equal(perf.totalCostToday,null);assert.equal(perf.totalCostAllTime,null);
  assert.equal(perf.sessionsStatus,'unknown');assert.equal(perf.costStatus.today,'unknown');assert.equal(perf.usageSource,'dashboard_data');
  assert.equal(costs.totalToday,null);assert.equal(costs.costStatus.totalToday,'unknown');assert.equal(costs.usageSource,'dashboard_data');
  f.setData({sessions:[],totalCostToday:0,totalCostAllTime:0,projectedMonthly:0,subagentCostToday:0});
  const zero=await f.get('performance');const zeroCosts=await f.get('costs');
  assert.equal(zero.totalCostToday,0);assert.equal(zero.sessionsStatus,'available');assert.equal(zero.costStatus.today,'available');
  assert.equal(zeroCosts.totalToday,0);assert.equal(zeroCosts.costStatus.totalToday,'available');
  assert.equal(zeroCosts.subagentCostAllTime,null);assert.equal(zeroCosts.costStatus.subagentCostAllTime,'unknown');
});
