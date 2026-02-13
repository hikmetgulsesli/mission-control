interface WfAgent {
  name: string;
  runs: number;
  successRate: number;
  failed: number;
  timeout: number;
}

interface AlertData {
  counts: { abandoned: number; timeout: number; failed: number };
  recent: any[];
}

export function WorkflowAgentStats({ agents, alerts }: { agents: WfAgent[]; alerts?: AlertData | null }) {
  const counts = alerts?.counts || { abandoned: 0, timeout: 0, failed: 0 };
  const hasAlerts = counts.abandoned + counts.timeout + counts.failed > 0;

  return (
    <div className="af-stats">
      {/* Alert banner */}
      {hasAlerts && (
        <div className="af-stats__alert">
          {counts.abandoned > 0 && (
            <span className="af-stats__alert-item af-stats__alert-item--orange">
              {counts.abandoned} abandoned
            </span>
          )}
          {counts.timeout > 0 && (
            <span className="af-stats__alert-item af-stats__alert-item--yellow">
              {counts.timeout} timeout
            </span>
          )}
          {counts.failed > 0 && (
            <span className="af-stats__alert-item af-stats__alert-item--red">
              {counts.failed} failed
            </span>
          )}
        </div>
      )}

      {/* Workflow agent mini cards */}
      <div className="af-stats__agents-title">WORKFLOW AGENTS</div>
      <div className="af-stats__agents">
        {agents.length === 0 && <div className="af-empty">No agent data</div>}
        {agents.map((a) => (
          <div key={a.name} className="af-stats__agent">
            <div className="af-stats__agent-header">
              <span className="af-stats__agent-name">{a.name}</span>
              <span className={`af-stats__agent-rate ${a.successRate >= 80 ? 'af-stats__agent-rate--good' : a.successRate >= 50 ? 'af-stats__agent-rate--mid' : 'af-stats__agent-rate--bad'}`}>
                {a.successRate}%
              </span>
            </div>
            <div className="af-stats__agent-row">
              <span className="af-stats__agent-stat">{a.runs} runs</span>
              {a.failed > 0 && <span className="af-stats__agent-stat af-stats__agent-stat--red">{a.failed} fail</span>}
              {a.timeout > 0 && <span className="af-stats__agent-stat af-stats__agent-stat--orange">{a.timeout} timeout</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Recent alerts */}
      {alerts?.recent && alerts.recent.length > 0 && (
        <div className="af-stats__recent">
          <div className="af-stats__recent-title">RECENT ISSUES</div>
          {alerts.recent.slice(0, 8).map((e: any, i: number) => (
            <div key={i} className="af-stats__recent-item">
              <span className="af-stats__recent-time">
                {new Date(e.ts).toLocaleDateString('tr-TR', { month: '2-digit', day: '2-digit' })}
                {' '}
                {new Date(e.ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className={`af-stats__recent-type af-stats__recent-type--${e.event.includes('timeout') ? 'orange' : 'red'}`}>
                {e.event.replace('.', ' ')}
              </span>
              {e.detail && <span className="af-stats__recent-detail">{e.detail}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
