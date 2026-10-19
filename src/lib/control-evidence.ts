/** Browser views and refusal parsing. The selected server schemas remain authoritative. */
export type ControlJobKindV1 = 'activation_preflight' | 'convergence_full8' | 'ui_regression';
export type Availability = { state: 'available' | 'unconfigured' | 'missing' | 'invalid' | 'unsafe'; code: string | null };
export type ControlEvidenceProjectionV1 = {
  activation: { availability: Availability; report: null | { hash: string; status: 'pass' | 'fail'; protocol: 'shadow' | 'v3'; compatibility: 'current' | 'historical'; observedAt: string | null; checks: { id: string; status: 'pass' | 'fail' | 'advisory'; blocking: boolean; code: string }[] } };
  evaluation: { availability: Availability; report: null | { resultHash: string; gateHash: string | null; compatibility: 'current' | 'historical'; executionMode: 'preflight' | 'execute'; resultStatus: 'planned' | 'pass' | 'fail' | 'blocked'; gateDecision: 'go' | 'no_go' | null; qualification: 'qualified' | 'unqualified' | 'historical'; preflightChecks: { id: string; status: 'pass' | 'fail'; code: string }[]; cases: { caseId: string; repetition: 1; evidenceState: 'not_started' | 'recorded'; disposition: 'completed' | 'failed' | 'cancelled' | 'timeout' | 'invalidated' | null; passed: boolean | null; runId: string | null; resultHash: string | null }[]; completedCases: number; plannedCases: 8; blockerCodes: string[] } };
};
export type ControlEvidenceResponseV1 = ControlEvidenceProjectionV1 & { ui: { availability: Availability; report: null | { hash: string; compatibility: 'current' | 'historical'; mcSourceSha: string; mcBuildHash: string; fixtureVersion: string; fixtureHash: string; startedAt: string; finishedAt: string | null; outcome: 'pass' | 'fail' | 'incomplete'; assertions: { id: string; status: 'pass' | 'fail'; code: string | null }[]; screenshots: { captureId: string; route: string; viewport: { width: number; height: number }; sha256: string }[] } } };
export type ControlEvidenceEnvelopeV1 = { schema: 'mission-control.controls-evidence-envelope.v1'; selectionHash: string | null; evidence: ControlEvidenceResponseV1; history: readonly { id: string; sourceSha: string; evidence: ControlEvidenceProjectionV1 }[] };
export type ControlJobReceiptV1 = { schema: 'mission-control.control-job.v1'; jobId: string; kind: ControlJobKindV1; revision: number; selectionHash: string; sourceSha: string; mcSourceSha: string; mcBuildHash: string; suiteHash: string | null; state: 'accepted' | 'starting' | 'running' | 'cancelling' | 'completed' | 'failed' | 'blocked' | 'cancelled' | 'ownership_unknown'; requestedAt: string; startedAt: string | null; updatedAt: string; finishedAt: string | null; phase: string; code: string | null; currentCaseId: string | null; ownedRunId: string | null; completedCases: number; plannedCases: number; reportRefs: { activationHash?: string; resultHash?: string; gateHash?: string; uiReportHash?: string }; cancelRequested: boolean };
export type PendingControlLaunchV1 = { kind: ControlJobKindV1; expectedSelectionHash: string; idempotencyKey: string };
const HASH = /^[a-f0-9]{64}$/; const SOURCE = /^[a-f0-9]{40}$/; const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/; const CODE = /^[A-Za-z0-9_.:-]{1,200}$/;
const kinds = ['activation_preflight','convergence_full8','ui_regression'] as const;
function invalid(): never { throw new Error('CONTROL_RESPONSE_INVALID'); }
function obj(value: unknown, keys: string[]): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== keys.sort().join('|')) invalid(); return value as Record<string, unknown>; }
function match(value: unknown, pattern: RegExp): string { if (typeof value !== 'string' || !pattern.test(value)) invalid(); return value; }
function one<T extends string>(value: unknown, choices: readonly T[]): T { if (!choices.includes(value as T)) invalid(); return value as T; }
function count(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 0) invalid(); return value as number; }
function nullable<T>(value: unknown, read: (value: unknown) => T): T | null { return value === null ? null : read(value); }
function rows<T>(value: unknown, max: number, read: (value: unknown) => T): T[] { if (!Array.isArray(value) || value.length > max) invalid(); return value.map(read); }
function time(value: unknown): string { if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) invalid(); return value; }
function availability(value: unknown): Availability { const v = obj(value, ['state','code']); return { state: one(v.state, ['available','unconfigured','missing','invalid','unsafe']), code: nullable(v.code, x => match(x, CODE)) }; }
function availableReport<T>(value: unknown, read: (value: unknown) => T): { availability: Availability; report: T | null } {
  const v = obj(value, ['availability','report']); const a = availability(v.availability); const report = nullable(v.report, read);
  if ((a.state === 'available') !== (report !== null)) invalid();
  return { availability: a, report };
}
function projection(value: unknown): ControlEvidenceProjectionV1 {
  const v = obj(value, ['activation','evaluation']);
  const activation = availableReport(v.activation, raw => {
    const r = obj(raw, ['hash','status','protocol','compatibility','observedAt','checks']);
    return { hash: match(r.hash,HASH), status: one(r.status,['pass','fail']), protocol: one(r.protocol,['shadow','v3']), compatibility: one(r.compatibility,['current','historical']), observedAt: nullable(r.observedAt,time), checks: rows(r.checks,64,x => { const c=obj(x,['id','status','blocking','code']); if (typeof c.blocking !== 'boolean') invalid(); return { id:match(c.id,CODE),status:one(c.status,['pass','fail','advisory']),blocking:c.blocking,code:match(c.code,CODE) }; }) };
  });
  const evaluation = availableReport(v.evaluation, raw => {
    const r = obj(raw,['resultHash','gateHash','compatibility','executionMode','resultStatus','gateDecision','qualification','preflightChecks','cases','completedCases','plannedCases','blockerCodes']);
    const preflightChecks = rows(r.preflightChecks,64,x => { const c=obj(x,['id','status','code']); return { id:match(c.id,CODE), status:one(c.status,['pass','fail']), code:match(c.code,CODE) }; });
    const cases = rows(r.cases,64,x => { const c=obj(x,['caseId','repetition','evidenceState','disposition','passed','runId','resultHash']); if (c.repetition !== 1 || c.passed !== null && typeof c.passed !== 'boolean') invalid(); return { caseId:match(c.caseId,CODE),repetition:1 as const,evidenceState:one(c.evidenceState,['not_started','recorded']),disposition:nullable(c.disposition,y=>one(y,['completed','failed','cancelled','timeout','invalidated'] as const)),passed:c.passed as boolean|null,runId:nullable(c.runId,y=>match(y,CODE)),resultHash:nullable(c.resultHash,y=>match(y,HASH)) }; });
    const completedCases=count(r.completedCases); if (r.plannedCases !== 8 || completedCases > 8) invalid();
    return { resultHash:match(r.resultHash,HASH),gateHash:nullable(r.gateHash,x=>match(x,HASH)),compatibility:one(r.compatibility,['current','historical']),executionMode:one(r.executionMode,['preflight','execute']),resultStatus:one(r.resultStatus,['planned','pass','fail','blocked']),gateDecision:nullable(r.gateDecision,x=>one(x,['go','no_go'] as const)),qualification:one(r.qualification,['qualified','unqualified','historical']),preflightChecks,cases,completedCases,plannedCases:8 as const,blockerCodes:rows(r.blockerCodes,64,x=>match(x,CODE)) };
  });
  return { activation, evaluation };
}
function uiReport(value: unknown): NonNullable<ControlEvidenceResponseV1['ui']['report']> {
  const v=obj(value,['hash','compatibility','mcSourceSha','mcBuildHash','fixtureVersion','fixtureHash','startedAt','finishedAt','outcome','assertions','screenshots']);
  const assertions=rows(v.assertions,2048,x=>{const a=obj(x,['id','status','code']);return{id:match(a.id,CODE),status:one(a.status,['pass','fail']),code:nullable(a.code,y=>match(y,CODE))};});
  const screenshots=rows(v.screenshots,512,x=>{const s=obj(x,['captureId','route','viewport','sha256']);const p=obj(s.viewport,['width','height']);const width=count(p.width),height=count(p.height);if(!width||!height||width>10000||height>10000)invalid();return{captureId:match(s.captureId,CODE),route:match(s.route,/^\/(?!\/)[A-Za-z0-9_/-]{0,511}$/),viewport:{width,height},sha256:match(s.sha256,HASH)};});
  if(new Set(assertions.map(x=>x.id)).size!==assertions.length||new Set(screenshots.map(x=>x.captureId)).size!==screenshots.length)invalid();
  const startedAt=time(v.startedAt),finishedAt=nullable(v.finishedAt,time),outcome=one(v.outcome,['pass','fail','incomplete']);
  if(finishedAt&&finishedAt<startedAt||outcome==='pass'&&(!finishedAt||!assertions.length||assertions.some(x=>x.status!=='pass')))invalid();
  return{hash:match(v.hash,HASH),compatibility:one(v.compatibility,['current','historical']),mcSourceSha:match(v.mcSourceSha,SOURCE),mcBuildHash:match(v.mcBuildHash,HASH),fixtureVersion:match(v.fixtureVersion,CODE),fixtureHash:match(v.fixtureHash,HASH),startedAt,finishedAt,outcome,assertions,screenshots};
}
export function parseControlEvidenceEnvelopeV1(value: unknown): ControlEvidenceEnvelopeV1 {
  const v=obj(value,['schema','selectionHash','evidence','history']); if(v.schema!=='mission-control.controls-evidence-envelope.v1')invalid();
  const e=obj(v.evidence,['activation','evaluation','ui']); const current=projection({activation:e.activation,evaluation:e.evaluation});
  const ui=availableReport(e.ui,uiReport);
  const history=rows(v.history,50,x=>{const h=obj(x,['id','sourceSha','evidence']);return{id:match(h.id,HASH),sourceSha:match(h.sourceSha,SOURCE),evidence:projection(h.evidence)};});
  if(new Set(history.map(x=>x.id)).size!==history.length)invalid();
  return {schema:'mission-control.controls-evidence-envelope.v1',selectionHash:nullable(v.selectionHash,x=>match(x,HASH)),evidence:{...current,ui},history};
}
export function parseControlJobReceiptV1(value: unknown): ControlJobReceiptV1 {
  const v=obj(value,['schema','jobId','kind','revision','selectionHash','sourceSha','mcSourceSha','mcBuildHash','suiteHash','state','requestedAt','startedAt','updatedAt','finishedAt','phase','code','currentCaseId','ownedRunId','completedCases','plannedCases','reportRefs','cancelRequested']);
  if(v.schema!=='mission-control.control-job.v1'||typeof v.cancelRequested!=='boolean')invalid();
  const refs=v.reportRefs;if(!refs||typeof refs!=='object'||Array.isArray(refs)||Object.keys(refs).some(k=>!['activationHash','resultHash','gateHash','uiReportHash'].includes(k)))invalid();
  const reportRefs: ControlJobReceiptV1['reportRefs']={};for(const [key,val] of Object.entries(refs))reportRefs[key as keyof typeof reportRefs]=match(val,HASH);
  const kind=one(v.kind,kinds),suiteHash=nullable(v.suiteHash,x=>match(x,HASH)),completedCases=count(v.completedCases),plannedCases=count(v.plannedCases);
  if((kind==='convergence_full8')!==(suiteHash!==null)||kind==='convergence_full8'&&plannedCases!==8||completedCases>plannedCases)invalid();
  return {schema:'mission-control.control-job.v1',jobId:match(v.jobId,UUID),kind,revision:count(v.revision),selectionHash:match(v.selectionHash,HASH),sourceSha:match(v.sourceSha,SOURCE),mcSourceSha:match(v.mcSourceSha,SOURCE),mcBuildHash:match(v.mcBuildHash,HASH),suiteHash,state:one(v.state,['accepted','starting','running','cancelling','completed','failed','blocked','cancelled','ownership_unknown']),requestedAt:time(v.requestedAt),startedAt:nullable(v.startedAt,time),updatedAt:time(v.updatedAt),finishedAt:nullable(v.finishedAt,time),phase:match(v.phase,CODE),code:nullable(v.code,x=>match(x,CODE)),currentCaseId:nullable(v.currentCaseId,x=>match(x,CODE)),ownedRunId:nullable(v.ownedRunId,x=>match(x,CODE)),completedCases,plannedCases,reportRefs,cancelRequested:v.cancelRequested};
}
export const CONTROL_PENDING_KEY_V1='mission-control.controls.pending-launch.v1';
export function parsePendingControlLaunchV1(value: unknown): PendingControlLaunchV1 { const v=obj(value,['kind','expectedSelectionHash','idempotencyKey']);return{kind:one(v.kind,kinds),expectedSelectionHash:match(v.expectedSelectionHash,HASH),idempotencyKey:match(v.idempotencyKey,UUID)}; }
export function readPendingControlLaunchV1(storage?: Pick<Storage,'getItem'>): PendingControlLaunchV1|null {try{const raw=storage?.getItem(CONTROL_PENDING_KEY_V1);return raw?parsePendingControlLaunchV1(JSON.parse(raw)):null;}catch{return null;}}
export function writePendingControlLaunchV1(storage:Pick<Storage,'setItem'>,pending:PendingControlLaunchV1):void {storage.setItem(CONTROL_PENDING_KEY_V1,JSON.stringify(parsePendingControlLaunchV1(pending)));}
export function clearPendingControlLaunchV1(storage:Pick<Storage,'removeItem'>):void {storage.removeItem(CONTROL_PENDING_KEY_V1);}
export const terminalControlStates = new Set<ControlJobReceiptV1['state']>(['completed','failed','blocked','cancelled','ownership_unknown']);
