import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ControlJobSessionV1, isControlReceiptTerminalV1 } from '../src/lib/control-job-session';
import type { ControlJobReceiptV1 } from '../src/lib/control-evidence';

const a = 'a'.repeat(64), b = 'b'.repeat(64);
const jobA = '00000000-0000-4000-8000-000000000001';
const jobB = '00000000-0000-4000-8000-000000000002';
const receipt = (jobId: string, state: ControlJobReceiptV1['state'], finishedAt: string | null = null): ControlJobReceiptV1 => ({ schema:'mission-control.control-job.v1', jobId, kind:'activation_preflight', revision:1, selectionHash:a, sourceSha:'c'.repeat(40), mcSourceSha:'d'.repeat(40), mcBuildHash:'e'.repeat(64), suiteHash:null, state, requestedAt:'2026-10-19T00:00:00.000Z', startedAt:'2026-10-19T00:00:00.000Z', updatedAt:'2026-10-19T00:00:01.000Z', finishedAt, phase:'starting', code:null, currentCaseId:null, ownedRunId:null, completedCases:0, plannedCases:0, reportRefs:{}, cancelRequested:false });
function storage() { const map = new Map<string,string>(); return { map, getItem:(key:string)=>map.get(key)??null, setItem:(key:string,value:string)=>{map.set(key,value);}, removeItem:(key:string)=>{map.delete(key);} }; }

test('ownership unknown keeps exact pending request and remains reconnectable through recovery', async () => {
  const store=storage();
  const session=new ControlJobSessionV1(store, async () => ({receipt:receipt(jobA,'ownership_unknown'),replay:false}), null, ()=>'00000000-0000-4000-8000-000000000003');
  session.setSelection(a); session.confirm();
  const launched=await session.launch();
  const original=session.pending;
  assert.equal(launched.reveal,true);
  assert.equal(isControlReceiptTerminalV1(launched.receipt),false);
  session.acceptReceipt(launched.receipt);
  assert.deepEqual(session.pending,original);
  const reloaded=new ControlJobSessionV1(store, async request => {assert.deepEqual(request,original);return {receipt:receipt(jobA,'running'),replay:true};},jobA);
  reloaded.setSelection(a); reloaded.confirm();
  await reloaded.launch();
  assert.deepEqual(reloaded.pending,original);
  reloaded.acceptReceipt(receipt(jobA,'completed','2026-10-19T00:00:02.000Z'));
  assert.equal(reloaded.pending,null);
});

test('read-only construction does not launch, and mismatched terminal receipt cannot clear pending identity', async () => {
  const store=storage();let calls=0;
  const session=new ControlJobSessionV1(store,async()=>{calls++;return{receipt:receipt(jobA,'accepted'),replay:false};},null,()=>jobB);
  session.setSelection(a);
  assert.equal(calls,0);
  session.confirm();
  await session.launch();
  const pending=session.pending;
  session.acceptReceipt({...receipt(jobA,'completed','2026-10-19T00:00:02.000Z'),selectionHash:b});
  assert.deepEqual(session.pending,pending);
});

test('confirmation is bound to kind and exact selection across refresh', async () => {
  const calls:unknown[]=[]; const session=new ControlJobSessionV1(storage(),async request=>{calls.push(request);return{receipt:receipt(jobA,'accepted'),replay:false};},null,()=>jobB);
  session.setSelection(a);session.confirm();
  session.setSelection(b);
  assert.equal(session.isConfirmed(),false);
  await assert.rejects(session.launch());
  session.setSelection(a);session.confirm();session.setKind('convergence_full8');
  assert.equal(session.isConfirmed(),false);
  await assert.rejects(session.launch());
  assert.equal(calls.length,0);
});

test('late accepted POST retains request mapping but never overrides newer user-selected job', async () => {
  let resolve!: (value:{receipt:ControlJobReceiptV1;replay:boolean})=>void;
  const api=()=>new Promise<{receipt:ControlJobReceiptV1;replay:boolean}>(r=>{resolve=r;});
  const session=new ControlJobSessionV1(storage(),api,null,()=>jobB);
  session.setSelection(a);session.confirm();
  const launch=session.launch();
  const pending=session.pending;
  session.chooseJob(jobB);
  resolve({receipt:receipt(jobA,'accepted'),replay:false});
  const accepted=await launch;
  assert.equal(accepted.reveal,false);
  assert.equal(session.selectedJobId,jobB);
  assert.equal(session.pendingJobId,jobA);
  assert.deepEqual(session.pending,pending);
  session.acceptReceipt(receipt(jobB,'completed','2026-10-19T00:00:02.000Z'));
  assert.deepEqual(session.pending,pending);
});

test('old unmounted launch cannot replace or clear a newer exact pending request across sessions', async () => {
  const store=storage();
  const keyA='00000000-0000-4000-8000-000000000003';
  const keyB='00000000-0000-4000-8000-000000000004';
  let finishA!: (value:{receipt:ControlJobReceiptV1;replay:boolean})=>void;
  const sessionA=new ControlJobSessionV1(store,()=>new Promise(resolve=>{finishA=resolve;}),null,()=>keyA);
  sessionA.setSelection(a);sessionA.confirm();
  const delayedA=sessionA.launch();
  assert.equal(sessionA.pending?.idempotencyKey,keyA);
  sessionA.dispose();

  const sessionB=new ControlJobSessionV1(store,async request=>{
    assert.equal(request.idempotencyKey,keyB);
    return {receipt:receipt(jobB,'running'),replay:false};
  },null,()=>keyB);
  sessionB.prepareNew();
  sessionB.setSelection(a);sessionB.confirm();
  await sessionB.launch();
  assert.equal(sessionB.pending?.idempotencyKey,keyB);
  assert.equal(sessionB.pendingJobId,jobB);

  finishA({receipt:receipt(jobA,'completed','2026-10-19T00:00:02.000Z'),replay:false});
  const acceptedA=await delayedA;
  assert.equal(acceptedA.reveal,false);
  const sessionC=new ControlJobSessionV1(store,async()=>{throw new Error('read-only');},jobB);
  assert.equal(sessionC.pending?.idempotencyKey,keyB);
  assert.equal(sessionC.pendingJobId,jobB);
  sessionA.acceptReceipt(receipt(jobA,'completed','2026-10-19T00:00:02.000Z'));
  sessionC.acceptReceipt(receipt(jobA,'completed','2026-10-19T00:00:02.000Z'));
  assert.equal(new ControlJobSessionV1(store,async()=>{throw new Error('read-only');},null).pending?.idempotencyKey,keyB);
  sessionC.acceptReceipt(receipt(jobB,'completed','2026-10-19T00:00:03.000Z'));
  assert.equal(new ControlJobSessionV1(store,async()=>{throw new Error('read-only');},null).pending,null);
});

test('reconstruction refuses mapping with same kind and selection but another key', async () => {
  const store=storage();
  const keyA='00000000-0000-4000-8000-000000000003';
  const sessionA=new ControlJobSessionV1(store,async()=>({receipt:receipt(jobA,'running'),replay:false}),null,()=>keyA);
  sessionA.setSelection(a);sessionA.confirm();await sessionA.launch();
  const staleMapping=store.map.get('mission-control.controls.pending-job.v1');
  const sessionB=new ControlJobSessionV1(store,async()=>({receipt:receipt(jobB,'running'),replay:false}),null,()=>jobB);
  sessionB.prepareNew();sessionB.setSelection(a);sessionB.confirm();await sessionB.launch();
  store.map.set('mission-control.controls.pending-job.v1',staleMapping!);
  const reconstructed=new ControlJobSessionV1(store,async()=>{throw new Error('read-only');},null);
  assert.equal(reconstructed.pending?.idempotencyKey,jobB);
  assert.equal(reconstructed.pendingJobId,null);
  reconstructed.acceptReceipt(receipt(jobA,'completed','2026-10-19T00:00:02.000Z'));
  assert.equal(reconstructed.pending?.idempotencyKey,jobB);
});
