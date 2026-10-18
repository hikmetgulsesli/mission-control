import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import { promisify } from 'node:util';
const readWorkingVolumeObservation = async () => ({source:'df',status:'unknown',observedAt:'2026-10-19T00:00:00Z',path:'/work',mount:null,totalBytes:null,usedBytes:null,freeBytes:null,percent:null});

// Execute production statements, replacing only I/O imports. Never load private
// config/env, gateway or selected runtime while checking metrics.
function metrics(options: { query?: (query: string) => unknown; times?: number[][]; memory?: [number, number]; clock?: number[] } = {}) {
  const source = readFileSync(new URL('./prometheus.ts', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('prometheus.ts', source, ts.ScriptTarget.Latest, true);
  const body = tree.statements.filter(node => !ts.isImportDeclaration(node)).map(node => node.getText(tree)).join('\n');
  const js = ts.transpileModule(body, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/^export /gm, '');
  let sample = 0; let clock = 0; let tick = 0;
  const os = { totalmem: () => options.memory?.[0] ?? 8 * 1073741824, freemem: () => options.memory?.[1] ?? 3 * 1073741824,
    loadavg: () => [0, 0, 0], cpus: () => { const [idle, user] = options.times?.[sample++] ?? [100, 0]; return [{ times: { idle, user, nice: 0, sys: 0, irq: 0 } }]; } };
  const fetch = async (url: string) => { const query = new URL(url).searchParams.get('query')!; const data = options.query?.(query); if (data instanceof Error) throw data; if (data instanceof Response) return data;
    return new Response(JSON.stringify({ status: 'success', data: data ?? { resultType: 'vector', result: [] } })); };
  return new Function('config', 'os', 'fetch', 'readWorkingVolumeObservation', 'performance', 'promisify', 'execFile', js + ';return {getSystemMetrics,extractScalar};')(
    { prometheusUrl: 'http://fixture.invalid' }, os, fetch, readWorkingVolumeObservation, { now: () => options.clock?.[tick++] ?? (clock += 100) }, promisify, (_file: string, _args: string[], _opts: unknown, callback: Function) => callback(null, {stdout:'Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/root 100 5 95 5% /\n'}),
  );
}

test('empty, malformed, NaN and infinite Prometheus values are unknown; real zero survives', () => {
  const { extractScalar } = metrics();
  for (const data of [null, {}, {resultType:'vector', result:[]}, {resultType:'vector', result:[{value:[1,'NaN']}]}, {resultType:'vector', result:[{value:[1,'Infinity']}]}, {resultType:'vector', result:[{value:[1,'5junk']}]}, {resultType:'vector', result:[{value:[1,'']}]}, {resultType:'vector', result:[{value:[1]}]}]) assert.equal(extractScalar(data), null);
  assert.equal(extractScalar({resultType:'vector',result:[{value:[1,'0']}]}), 0);
});

test('local RAM states total minus freemem semantics; initial CPU has no fabricated measurement', async () => {
  const value = await metrics().getSystemMetrics();
  assert.deepEqual([value.ram.total, value.ram.used, value.ram.percent], [8,5,63]);
  assert.equal(value.ram.source, 'node:os'); assert.equal(value.ram.semantics, 'total-os.freemem');
  assert.equal(value.cpu.percent, null); assert.equal(value.cpu.status, 'unknown');
  assert.equal(value.load, 0);
});

test('valid timed CPU deltas retain measured zero and then measure busy time', async () => {
  const reader = metrics({times:[[100,0],[200,0],[250,50]]});
  assert.equal((await reader.getSystemMetrics()).cpu.percent, null);
  const zero = await reader.getSystemMetrics(); assert.equal(zero.cpu.percent, 0); assert.equal(zero.cpu.source, 'node:os');
  assert.equal((await reader.getSystemMetrics()).cpu.percent, 50);
});

test('counter resets never become CPU usage and invalid OS RAM never becomes zero', async () => {
  const reader = metrics({times:[[100,20],[90,10]], memory:[8,9]});
  await reader.getSystemMetrics(); const value = await reader.getSystemMetrics();
  assert.equal(value.cpu.percent, null); assert.equal(value.ram.used, null); assert.equal(value.ram.percent, null);
});

test('partial Prometheus failures cannot construct RAM/disk subtraction; CPU zero is available', async () => {
  const value = await metrics({query: q => q.includes('node_cpu') ? {resultType:'vector',result:[{value:[1,'0']}]} : new Error('fixture offline')}).getSystemMetrics();
  assert.equal(value.cpu.percent, 0); assert.equal(value.cpu.source, 'prometheus');
  assert.deepEqual([value.ram.total,value.ram.used], [8,5]);
  assert.equal(value.disk.source, 'df');
  assert.ok(value.disk.used === null || value.disk.used >= 0);
});


for (const times of [[[100,0],[100,0]], [[-100,0],[-50,0]], [[100,0],[Infinity,0]]]) {
  test(`invalid or stationary CPU counters remain unavailable: ${JSON.stringify(times)}`,async()=>{
    const reader=metrics({times});await reader.getSystemMetrics();assert.equal((await reader.getSystemMetrics()).cpu.percent,null);
  });
}

test('zero elapsed CPU sample cannot be reported as measured zero',async()=>{
  const reader=metrics({times:[[100,0],[200,0]],clock:[100,100]});await reader.getSystemMetrics();assert.equal((await reader.getSystemMetrics()).cpu.percent,null);
});

for (const response of [()=>new Response('private upstream failure',{status:503}),()=>new Response('{"status":"error","error":"private upstream failure"}'),()=>new Response('not-json')]) {
  test('failed or malformed Prometheus response falls back without invented CPU values',async()=>{
    const value=await metrics({query:()=>response()}).getSystemMetrics();assert.equal(value.cpu.percent,null);assert.equal(value.cpu.status,'unknown');assert.equal(value.load,0);
  });
}
