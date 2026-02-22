interface AlertData {
  counts: { abandoned: number; timeout: number; failed: number };
  recent: any[];
}

interface WfAgent {
  name: string;
  runs: number;
  successRate: number;
  failed: number;
  timeout: number;
  avgDuration?: number;
  lastActive?: string;
}

function rateColor(rate: number): string {
  if (rate >= 80) return '#00ff41';
  if (rate >= 50) return '#ffaa00';
  return '#ff0040';
}

function rateBg(rate: number): string {
  if (rate >= 80) return 'rgba(0,255,65,0.10)';
  if (rate >= 50) return 'rgba(255,170,0,0.10)';
  return 'rgba(255,0,64,0.10)';
}

function shortName(name: string): string {
  const parts = name.split('_');
  return parts.length > 1 ? parts[parts.length - 1] : name.replace(/^.*?-/, '');
}

export function CompactStatsBar({ alerts, agents }: { alerts?: AlertData | null; agents: WfAgent[] }) {
  const counts = alerts?.counts || { abandoned: 0, timeout: 0, failed: 0 };
  const totalAlerts = counts.abandoned + counts.timeout + counts.failed;
  const sorted = [...agents].sort((a, b) => b.runs - a.runs);
  const totalRuns = agents.reduce((s, a) => s + a.runs, 0);
  const avgRate = agents.length > 0
    ? Math.round(agents.reduce((s, a) => s + a.successRate, 0) / agents.length)
    : 0;

  return (
    <div className="csb">
      {/* Alerts */}
      <div className="csb__alerts">
        {totalAlerts === 0 ? (
          <span className="csb__pill csb__pill--ok">OK</span>
        ) : (
          <>
            {counts.timeout > 0 && <span className="csb__pill csb__pill--warn">{counts.timeout} timeout</span>}
            {counts.failed > 0 && <span className="csb__pill csb__pill--err">{counts.failed} failed</span>}
            {counts.abandoned > 0 && <span className="csb__pill csb__pill--abandon">{counts.abandoned} abandon</span>}
          </>
        )}
      </div>

      <div className="csb__sep" />

      {/* Health */}
      <div className="csb__health">
        <span className="csb__health-label">{totalRuns} runs</span>
        <span className="csb__health-rate" style={{ color: rateColor(avgRate) }}>{avgRate}%</span>
      </div>

      <div className="csb__sep" />

      {/* Agent dots */}
      <div className="csb__dots">
        {sorted.map((a) => (
          <div
            key={a.name}
            className="csb__dot"
            title={`${a.name}: ${a.successRate}% (${a.runs} runs)`}
            style={{ '--dot-color': rateColor(a.successRate), '--dot-bg': rateBg(a.successRate) } as React.CSSProperties}
          >
            <div className="csb__dot-bar" style={{ width: `${Math.max(a.successRate, 8)}%` }} />
            <span className="csb__dot-name">{shortName(a.name)}</span>
            <span className="csb__dot-rate">{a.successRate}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
