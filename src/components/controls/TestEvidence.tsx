import type { ControlEvidenceProjectionV1, ControlEvidenceResponseV1, ControlJobReceiptV1 } from '../../lib/control-evidence';

const title = (value: string) => value.replaceAll('_',' ').replace(/\b\w/g, x => x.toUpperCase());
function statusText(receipt: ControlJobReceiptV1) { return receipt.cancelRequested && !['completed','failed','blocked','cancelled','ownership_unknown'].includes(receipt.state) ? 'Cancellation requested' : title(receipt.state); }
export function TestEvidence({ evaluation, ui, receipt }: { evaluation: ControlEvidenceProjectionV1['evaluation']; ui: ControlEvidenceResponseV1['ui']; receipt: ControlJobReceiptV1 | null }) {
  const report = evaluation.report;
  const qualified = report?.qualification === 'qualified' && report.compatibility === 'current' && report.executionMode === 'execute' && report.resultStatus === 'pass' && report.gateDecision === 'go';
  return <div className="controls__evidence">
    <section className="controls__panel" aria-label="Owned progress">
      <h2>Owned progress</h2>
      {receipt ? <>
        <p className="controls__lead">{statusText(receipt)} · {title(receipt.phase)}</p>
        <dl className="controls__facts"><div><dt>Job</dt><dd><code>{receipt.jobId}</code></dd></div><div><dt>Cases</dt><dd>{receipt.completedCases} of {receipt.plannedCases}</dd></div><div><dt>Current case</dt><dd>{receipt.currentCaseId ?? 'Unknown'}</dd></div><div><dt>Owned run</dt><dd>{receipt.ownedRunId ?? 'Unknown'}</dd></div><div><dt>Reason</dt><dd><code>{receipt.code ?? 'None reported'}</code></dd></div></dl>
      </> : <p>No selected job. Current case and owned run: Unknown.</p>}
    </section>
    <section className="controls__panel" aria-label="Evaluation evidence">
      <div className="controls__panel-heading"><h2>Evaluation evidence</h2><span className={`controls__badge controls__badge--${qualified ? 'pass' : 'unqualified'}`}>{qualified ? 'Qualified release' : report ? title(report.qualification) : title(evaluation.availability.state)}</span></div>
      {!report ? <p role="status">Evaluation report {evaluation.availability.state}. Reason: <code>{evaluation.availability.code ?? 'Unknown'}</code>.</p> : <>
        <p className="controls__lead">{report.completedCases} of {report.plannedCases} cases recorded · {title(report.resultStatus)} · {report.gateDecision ? `Gate ${title(report.gateDecision)}` : 'Gate decision unknown'} · {report.compatibility === 'historical' ? 'Historical' : 'Current'}.</p>
        {evaluation.availability.code && <p>Why is it waiting? <code>{evaluation.availability.code}</code></p>}
        {report.blockerCodes.length > 0 && <p>Why is it waiting? {report.blockerCodes.map(code => <code key={code}>{code} </code>)}</p>}
        <h3>Preflight checks</h3><ul className="controls__rows">{report.preflightChecks.map(check => <li key={check.id} data-testid="control-preflight-row"><strong>{title(check.id)}</strong><span>{title(check.status)}</span><code>{check.code}</code></li>)}</ul>
        <h3>Eight convergence cases</h3><ol className="controls__rows">{report.cases.map(c => <li key={`${c.caseId}-${c.repetition}`} data-testid="control-case-row"><strong>{title(c.caseId)}</strong><span>{c.evidenceState === 'not_started' ? 'Not started' : `${c.disposition ? title(c.disposition) : 'Recorded'} · ${c.passed === null ? 'Result unknown' : c.passed ? 'Passed' : 'Failed'}`}</span>{c.runId && <code>Run {c.runId}</code>}</li>)}</ol>
      </>}
    </section>
    <section className="controls__panel" aria-label="UI regression evidence">
      <div className="controls__panel-heading"><h2>UI regression evidence</h2><span className={`controls__badge controls__badge--${ui.report?.outcome ?? ui.availability.state}`}>{ui.report ? title(ui.report.outcome) : title(ui.availability.state)}</span></div>
      {!ui.report ? <p role="status">UI report {ui.availability.state}. Reason: <code>{ui.availability.code ?? 'Unknown'}</code>.</p> : <><p>{ui.report.compatibility === 'historical' ? 'Historical' : 'Current'} · {ui.report.assertions.length} assertions · {ui.report.screenshots.length} captures</p><ul className="controls__rows">{ui.report.assertions.map(a => <li key={a.id}><strong>{title(a.id)}</strong><span>{title(a.status)}</span>{a.code && <code>{a.code}</code>}</li>)}</ul></>}
    </section>
  </div>;
}
