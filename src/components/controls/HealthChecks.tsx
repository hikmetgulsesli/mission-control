import type { ControlEvidenceProjectionV1 } from '../../lib/control-evidence';

const title = (value: string) => value.replaceAll('_',' ').replace(/\b\w/g, x => x.toUpperCase());
export function HealthChecks({ activation }: { activation: ControlEvidenceProjectionV1['activation'] }) {
  const report = activation.report;
  return <section className="controls__panel" aria-label="Activation health">
    <div className="controls__panel-heading"><h2>Activation health</h2><span className={`controls__badge controls__badge--${report?.status ?? activation.availability.state}`}>{report ? title(report.status) : title(activation.availability.state)}</span></div>
    {!report ? <p role="status">Activation report {activation.availability.state}. Reason: <code>{activation.availability.code ?? 'Unknown'}</code>.</p> : <>
      <p>{report.compatibility === 'historical' ? 'Historical report' : 'Current report'} · Protocol {report.protocol} · {report.observedAt ? new Date(report.observedAt).toLocaleString() : 'Observation time unknown'}</p>
      <ul className="controls__rows">{report.checks.map(check => <li key={check.id} data-testid="activation-check-row"><strong>{title(check.id)}</strong><span>{title(check.status)}{check.blocking ? ' · Blocking' : ''}</span><code>{check.code}</code></li>)}</ul>
    </>}
  </section>;
}
