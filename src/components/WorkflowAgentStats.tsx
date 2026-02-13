const AGENT_META: Record<string, { emoji: string; desc: string }> = {
  planner:   { emoji: '\u{1F4CB}', desc: 'Task breakdown & planning' },
  setup:     { emoji: '\u{2699}\u{FE0F}',  desc: 'Project scaffolding' },
  developer: { emoji: '\u{1F4BB}', desc: 'Code implementation' },
  verifier:  { emoji: '\u{1F50D}', desc: 'Code verification' },
  tester:    { emoji: '\u{1F9EA}', desc: 'Test writing & execution' },
  pr:        { emoji: '\u{1F4E6}', desc: 'PR creation & docs' },
  reviewer:  { emoji: '\u{2705}', desc: 'Final code review' },
};

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function timeAgo(ts: string): string {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
        {agents.map((a) => {
          const meta = AGENT_META[a.name] || { emoji: '\u{1F916}', desc: '' };
          return (
            <div key={a.name} className="af-stats__agent">
              <div className="af-stats__agent-header">
                <span className="af-stats__agent-identity">
                  <span className="af-stats__agent-emoji">{meta.emoji}</span>
                  <span className="af-stats__agent-name">{a.name}</span>
                </span>
                <span className={`af-stats__agent-rate ${a.successRate >= 80 ? 'af-stats__agent-rate--good' : a.successRate >= 50 ? 'af-stats__agent-rate--mid' : 'af-stats__agent-rate--bad'}`}>
                  {a.successRate}%
                </span>
              </div>
              {meta.desc && <div className="af-stats__agent-desc">{meta.desc}</div>}
              {/* Success rate bar */}
              <div className="af-stats__agent-bar">
                <div
                  className={`af-stats__agent-bar-fill ${a.successRate >= 80 ? 'af-stats__agent-bar-fill--good' : a.successRate >= 50 ? 'af-stats__agent-bar-fill--mid' : 'af-stats__agent-bar-fill--bad'}`}
                  style={{ width: `${a.successRate}%` }}
                />
              </div>
              <div className="af-stats__agent-row">
                <span className="af-stats__agent-stat">{a.runs} runs</span>
                {a.avgDuration != null && a.avgDuration > 0 && (
                  <span className="af-stats__agent-stat">avg {formatDuration(a.avgDuration)}</span>
                )}
                {a.failed > 0 && <span className="af-stats__agent-stat af-stats__agent-stat--red">{a.failed} fail</span>}
                {a.timeout > 0 && <span className="af-stats__agent-stat af-stats__agent-stat--orange">{a.timeout} timeout</span>}
              </div>
              {a.lastActive && (
                <div className="af-stats__agent-last">{timeAgo(a.lastActive)}</div>
              )}
            </div>
          );
        })}
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
