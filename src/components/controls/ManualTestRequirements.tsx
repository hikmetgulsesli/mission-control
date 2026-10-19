import type { ControlJobKindV1 } from '../../lib/control-evidence';
const content: Record<ControlJobKindV1, { title: string; details: string[] }> = {
  activation_preflight: { title: 'Activation preflight', details: ['Checks the selected installation and its activation evidence.', 'A pass means readiness checks passed for this selection; it does not qualify a release.'] },
  convergence_full8: { title: 'Full eight-case convergence', details: ['Runs the fixed eight-case suite against the selected release.', 'Budget: up to 48 hours plus setup and settlement overhead. This is a maximum, not an ETA.', 'Release qualification requires source evidence and a linked GO admission, not a completed job alone.'] },
  ui_regression: { title: 'UI regression', details: ['Exercises the fixed UI fixture and records assertions and captures.', 'A passing UI report is separate from release qualification.'] },
};
export function ManualTestRequirements({ kind }: { kind: ControlJobKindV1 }) {
  const selected = content[kind];
  return <section className="controls__requirements" aria-label="Manual check requirements"><h3>{selected.title}</h3><ul>{selected.details.map(line => <li key={line}>{line}</li>)}</ul></section>;
}
