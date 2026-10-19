import { useCallback, useEffect, useRef, useState } from 'react';
import { controlsApi } from '../lib/api';
import type { ControlEvidenceEnvelopeV1, ControlJobKindV1, ControlJobReceiptV1 } from '../lib/control-evidence';
import { ControlJobSessionV1, isControlReceiptTerminalV1 } from '../lib/control-job-session';
import { HealthChecks } from '../components/controls/HealthChecks';
import { TestEvidence } from '../components/controls/TestEvidence';
import { ManualTestRequirements } from '../components/controls/ManualTestRequirements';

const SELECTED_KEY = 'mission-control.controls.selected-job.v1';
const noReport = { availability: { state: 'unconfigured' as const, code: 'CONTROL_EVIDENCE_NOT_LOADED' }, report: null };
function storage(): Storage | null { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } }
function selectedFromStorage(): string | null { try { const value=storage()?.getItem(SELECTED_KEY); return value && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value) ? value : null; } catch { return null; } }
function rememberJob(id: string | null) { try { const s=storage(); if(id)s?.setItem(SELECTED_KEY,id);else s?.removeItem(SELECTED_KEY); } catch { /* read-only UI still works */ } }
const label: Record<ControlJobKindV1,string> = { activation_preflight:'Activation preflight',convergence_full8:'Full eight-case convergence',ui_regression:'UI regression' };

export function Controls() {
  const sessionRef = useRef<ControlJobSessionV1 | null>(null);
  if (!sessionRef.current) sessionRef.current = new ControlJobSessionV1(storage(), controlsApi.launch, selectedFromStorage());
  const session = sessionRef.current;
  const [evidence,setEvidence] = useState<ControlEvidenceEnvelopeV1|null>(null);
  const [jobs,setJobs] = useState<ControlJobReceiptV1[]>([]);
  const [selectedId,setSelectedId] = useState<string|null>(session.selectedJobId);
  const [receipt,setReceipt] = useState<ControlJobReceiptV1|null>(null);
  const [pending,setPending] = useState(session.pending);
  const [kind,setKind] = useState<ControlJobKindV1>(session.kind);
  const [confirmed,setConfirmed] = useState(false);
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const [notice,setNotice] = useState<string|null>(null);
  const alive=useRef(false);
  const selectedRef=useRef(selectedId);
  const receiptRef=useRef(receipt);
  const refreshGeneration=useRef(0);
  selectedRef.current=selectedId; receiptRef.current=receipt;

  const acceptReceipt=useCallback((next:ControlJobReceiptV1) => {
    const previous=receiptRef.current;
    if(selectedRef.current!==next.jobId || previous?.jobId===next.jobId && next.revision<previous.revision)return;
    session.acceptReceipt(next);
    setPending(session.pending);
    receiptRef.current=next;setReceipt(next);
  },[session]);

  const refresh=useCallback(async (signal?:AbortSignal) => {
    const generation=++refreshGeneration.current;
    const wanted=selectedRef.current;
    const [e,j,r]=await Promise.allSettled([controlsApi.evidence(),controlsApi.jobs(),wanted?controlsApi.job(wanted):Promise.resolve(null)]);
    if(signal?.aborted||!alive.current||generation!==refreshGeneration.current)return;
    const problems:string[]=[];
    if(e.status==='fulfilled') {
      session.setSelection(e.value.selectionHash);
      setConfirmed(session.isConfirmed());
      setEvidence(e.value);
    } else problems.push(`Evidence: ${String(e.reason instanceof Error?e.reason.message:e.reason)}`);
    if (j.status === 'fulfilled') setJobs(j.value);
    else problems.push(`Jobs: ${String(j.reason instanceof Error ? j.reason.message : j.reason)}`);
    if (selectedRef.current === wanted) {
      if (r.status === 'fulfilled' && r.value) acceptReceipt(r.value);
      else if (r.status === 'rejected') problems.push(`Selected job: ${String(r.reason instanceof Error ? r.reason.message : r.reason)}`);
    }
    setError(problems.length ? problems.join(' · ') : null);
    setLoading(false);
  },[acceptReceipt,session]);

  useEffect(() => {
    alive.current = true;
    session.activate();
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => { alive.current = false; session.dispose(); controller.abort(); };
  }, [refresh,session]);
  useEffect(() => {
    if (!selectedId || receipt?.jobId === selectedId && isControlReceiptTerminalV1(receipt)) return;
    let active = true;
    let inFlight = false;
    const timer = window.setInterval(async () => {
      if (inFlight || !active) return;
      inFlight = true;
      try {
        const next = await controlsApi.job(selectedId);
        if (active && alive.current && selectedRef.current === selectedId) acceptReceipt(next);
      } catch (e) {
        if (active && alive.current && selectedRef.current === selectedId)
          setError(`Selected job: ${e instanceof Error ? e.message : 'CONTROL_UNAVAILABLE'}`);
      } finally { inFlight = false; }
    }, 3000);
    return () => { active = false; window.clearInterval(timer); };
  },[selectedId,receipt?.jobId,receipt?.state,receipt?.finishedAt,acceptReceipt]);

  function chooseJob(id:string){
    session.chooseJob(id);
    selectedRef.current=id;
    setSelectedId(id);
    setReceipt(null);
    rememberJob(id);
    setError(null);
    void controlsApi.job(id).then(next=>{
      if(alive.current&&selectedRef.current===id)acceptReceipt(next);
    }).catch(e=>{
      if(alive.current&&selectedRef.current===id)setError(`Selected job: ${e instanceof Error?e.message:'CONTROL_UNAVAILABLE'}`);
    });
  }
  async function launch(){
    if(busy)return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const awaiting = session.launch();
      setPending(session.pending);
      const result = await awaiting;
      if (!alive.current) return;
      session.acceptReceipt(result.receipt);
      setPending(session.pending);
      setConfirmed(false);
      if (result.reveal) {
        selectedRef.current = result.receipt.jobId;
        setSelectedId(result.receipt.jobId);
        rememberJob(result.receipt.jobId);
        acceptReceipt(result.receipt);
        setNotice(result.replay ? 'Existing request reconnected.' : 'Check accepted.');
      } else {
        setNotice(`Check accepted as job ${result.receipt.jobId}. Your selected job remains in view.`);
      }
      void refresh();
    } catch (e) {
      if (alive.current) setError(`Launch status unknown: ${e instanceof Error ? e.message : 'CONTROL_UNAVAILABLE'}. A pending retry keeps the same request key.`);
    } finally {
      if (alive.current) { setPending(session.pending); setBusy(false); }
    }
  }
  function prepareNew(){
    try {
      session.prepareNew();
      setPending(session.pending);
      setConfirmed(false);
      setNotice('New check prepared. Confirm its selection and budget before launch.');
    } catch { setError('Pending request could not be cleared. Its original key remains in use.'); }
  }
  async function cancel(){
    if(!receipt||busy||isControlReceiptTerminalV1(receipt))return;
    const jobId=receipt.jobId;
    setBusy(true);
    try {
      const result=await controlsApi.cancel(jobId,{idempotencyKey:crypto.randomUUID(),expectedRevision:receipt.revision});
      if(alive.current && selectedRef.current===jobId){
        acceptReceipt(result.receipt);
        setNotice('Cancellation requested; awaiting terminal evidence.');
      }
    } catch(e) {
      if(alive.current && selectedRef.current===jobId)setError(`Cancel: ${e instanceof Error?e.message:'CONTROL_UNAVAILABLE'}`);
    } finally { if(alive.current)setBusy(false); }
  }
  const selected=evidence?.selectionHash;
  const stale=receipt&&selected&&receipt.selectionHash!==selected;
  const current=evidence?.evidence;
  return <main className="controls">
    <header className="controls__header"><div><p className="controls__eyebrow">Operator workspace</p><h1>Controls</h1><p>Selected evidence, manual checks, and owned job progress.</p></div><button type="button" onClick={()=>void refresh()} disabled={loading}>Refresh evidence</button></header>
    {loading&&<p role="status">Loading selected evidence and recent jobs…</p>}
    {error&&<p className="controls__alert" role="alert">{error}</p>}{notice&&<p className="controls__notice" role="status">{notice}</p>}
    <div className="controls__top">
      <section className="controls__panel controls__readiness" aria-label="Selected readiness"><h2>Selected readiness</h2><p>{selected?'An installation is selected.':'No installation is selected.'}</p><dl className="controls__facts"><div><dt>Current selection</dt><dd><code>{selected??'Unknown'}</code></dd></div><div><dt>Current source</dt><dd>Unknown in the selected evidence envelope</dd></div><div><dt>Current MC build</dt><dd>Unknown in the selected evidence envelope</dd></div><div><dt>Why is it waiting?</dt><dd>{selected?'Review the checks and confirm a manual check.':<code>{current?.activation.availability.code??'CONTROL_SELECTION_UNAVAILABLE'}</code>}</dd></div></dl>{stale&&<p className="controls__alert">This job belongs to a different selection. Its progress remains historical.</p>}</section>
      <HealthChecks activation={current?.activation??noReport}/>
    </div>
    <section className="controls__panel controls__manual" aria-label="Manual check"><h2>Manual check</h2><label htmlFor="control-kind">Check</label><select id="control-kind" value={kind} onChange={e=>{const next=e.target.value as ControlJobKindV1;session.setKind(next);setKind(next);setConfirmed(false);}}>{Object.entries(label).map(([value,text])=><option key={value} value={value}>{text}</option>)}</select><ManualTestRequirements kind={kind}/>
      {pending&&<p className="controls__notice">A launch request is pending for {label[pending.kind]}. Retry keeps its exact selection and idempotency key.</p>}
      <label className="controls__confirm"><input type="checkbox" checked={confirmed} onChange={e=>{if(e.target.checked)session.confirm();else session.clearConfirmation();setConfirmed(session.isConfirmed());}}/> I confirm this check, the selected installation, and the visible budget.</label>
      <div className="controls__actions"><button type="button" disabled={!selected||!confirmed||!session.isConfirmed()||busy||!!pending&&(pending.kind!==kind||pending.expectedSelectionHash!==selected)} onClick={()=>void launch()}>{busy?'Working…':pending?'Retry same request':'Start manual check'}</button>{pending&&<button type="button" className="controls__secondary" disabled={busy} onClick={prepareNew}>Prepare a new check</button>}{receipt&&!isControlReceiptTerminalV1(receipt)&&<button type="button" className="controls__secondary" disabled={busy} onClick={()=>void cancel()}>Request cancellation</button>}</div>
    </section>
    <TestEvidence evaluation={current?.evaluation??noReport} ui={current?.ui??noReport} receipt={receipt}/>
    <section className="controls__panel" aria-label="Recent jobs"><h2>Recent jobs</h2>{jobs.length?<ul className="controls__jobs">{jobs.map(job=><li key={job.jobId}><button type="button" aria-current={selectedId===job.jobId?'true':undefined} onClick={()=>chooseJob(job.jobId)}><strong>{label[job.kind]}</strong><span>{job.state.replaceAll('_',' ')} · {job.completedCases} of {job.plannedCases}</span><code>{job.jobId}</code></button></li>)}</ul>:<p>No recent receipts available.</p>}</section>
    {evidence?.history.length ? <EvidenceHistory history={evidence.history}/> : null}
  </main>;
}

export function EvidenceHistory({ history }: { history: ControlEvidenceEnvelopeV1['history'] }) {
  return <section className="controls__history" aria-label="Historical evidence">
    <h2>Historical evidence</h2>
    {history.map(item => <details className="controls__history-entry" key={item.id}>
      <summary>Historical source <code>{item.sourceSha}</code> · Activation {item.evidence.activation.report?.status ?? item.evidence.activation.availability.state} · Evaluation {item.evidence.evaluation.report?.qualification ?? item.evidence.evaluation.availability.state}</summary>
      <div className="controls__top"><HealthChecks activation={item.evidence.activation}/>
        <TestEvidence evaluation={item.evidence.evaluation} ui={{ availability:{ state:'unconfigured',code:'HISTORICAL_UI_REPORT_NOT_INDEXED' },report:null }} receipt={null}/>
      </div>
    </details>)}
  </section>;
}
