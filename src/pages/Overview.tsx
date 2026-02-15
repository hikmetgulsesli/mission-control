import { usePolling } from '../hooks/usePolling';
import { api } from '../lib/api';
import { AgentCard } from '../components/AgentCard';
import { ActivityFeed } from '../components/ActivityFeed';
import { GlitchText } from '../components/GlitchText';
import type { OverviewData } from '../lib/types';
import { formatDistanceToNow } from 'date-fns';

function CronStatus({ crons }: { crons: any[] }) {
  if (!crons || crons.length === 0) return null;

  return (
    <div className="panel">
      <h3 className="panel__title">CRON STATUS</h3>
      <div className="cron-list">
        {crons.map((c: any) => (
          <div key={c.id} className="cron-item">
            <span className={`cron-item__dot cron-item__dot--${c.status}`} />
            <span className="cron-item__name">{c.name}</span>
            <span className="cron-item__last">
              {c.lastRunAt
                ? formatDistanceToNow(c.lastRunAt, { addSuffix: true })
                : 'never'}
            </span>
            {c.lastDuration && (
              <span className="cron-item__duration">
                {c.lastDuration < 1000 ? `${c.lastDuration}ms` : `${(c.lastDuration / 1000).toFixed(1)}s`}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


function ModelLimits() {
  const { data } = usePolling<any[]>(() => fetch('/api/model-limits').then(r => r.json()), 60000);
  const { data: quota } = usePolling<Record<string, { limit: number | null; used: number; tokens: number; windowHours: number }>>(() => fetch('/api/quota').then(r => r.json()), 60000);

  if (!data || !Array.isArray(data) || data.length === 0) return null;

  return (
    <div className="panel">
      <h3 className="panel__title">MODEL LIMITS</h3>
      <div className="model-limits">
        {data.map((p: any) => {
          const q = quota?.[p.id];
          const used = q?.used || 0;
          const limit = q?.limit || p.limits?.promptsPer5h || null;
          const pct = limit ? Math.min((used / limit) * 100, 100) : null;
          const barColor = pct !== null ? (pct > 80 ? 'var(--red, #f44)' : pct > 50 ? 'var(--orange, #ff9800)' : 'var(--green, #66bb6a)') : p.color;

          return (
            <div key={p.id} className="model-limit-item" style={{ borderLeftColor: p.color }}>
              <div className="model-limit-item__header">
                <span className="model-limit-item__dot" style={{ background: p.color }} />
                <span className="model-limit-item__name">{p.name}</span>
                <span className="model-limit-item__plan">{p.plan}</span>
                <span className="model-limit-item__cost">{p.cost}</span>
              </div>
              <div className="model-limit-item__details">
                <span className="model-limit-item__agents">
                  {p.agents.map((a: string) => a.charAt(0).toUpperCase() + a.slice(1)).join(', ')}
                </span>
                <span className="model-limit-item__usage">
                  {used} calls / 5h
                </span>
                {p.usage?.today?.cost > 0 && (
                  <span className="model-limit-item__today-cost">
                    ${p.usage.today.cost}
                  </span>
                )}
              </div>
              {limit && (
                <div className="quota-bar">
                  <div className="quota-bar__track">
                    <div className="quota-bar__fill" style={{ width: `${pct}%`, background: barColor }} />
                  </div>
                  <span className="quota-bar__label">{used}/{limit}</span>
                </div>
              )}
              {!limit && q && (
                <div className="quota-bar">
                  <span className="quota-bar__label" style={{ marginLeft: 0 }}>{used} calls / 5h</span>
                </div>
              )}
              {p.models?.length > 0 && (
                <div className="model-limit-item__models">
                  {p.models.map((m: any) => (
                    <span key={m.id} className={`model-limit-item__model-badge model-limit-item__model-badge--${m.status}`}>
                      {m.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Overview() {
  const { data, loading } = usePolling<OverviewData & { crons?: any[]; agentLastActive?: Record<string, number> }>(api.overview, 15000);

  if (loading || !data) {
    return <div className="page-loading">Loading overview...</div>;
  }

  return (
    <div className="overview">
      <GlitchText text="SYSTEM OVERVIEW" tag="h2" />

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-card__value">{data.agentCount}</div>
          <div className="stat-card__label">AGENTS</div>
          <div className="stat-card__sub">{data.sessions?.length || 0} sessions</div>
        </div>
        <div className="stat-card stat-card--cyan">
          <div className="stat-card__value">{data.activeRunCount}</div>
          <div className="stat-card__label">RUNNING</div>
          <div className="stat-card__sub">workflows</div>
        </div>
        <div className="stat-card stat-card--orange">
          <div className="stat-card__value">{data.cronCount}</div>
          <div className="stat-card__label">CRONS</div>
          <div className="stat-card__sub">active</div>
        </div>
        <div className="stat-card stat-card--green">
          <div className="stat-card__value">${data.costToday.toFixed(2)}</div>
          <div className="stat-card__label">TODAY</div>
          <div className="stat-card__sub">${data.costAllTime.toFixed(0)} total</div>
        </div>
      </div>

      <div className="agent-grid">
        {data.agents.map(agent => (
          <AgentCard
            key={agent.id}
            agent={{
              ...agent,
              lastActive: data.agentLastActive?.[agent.id],
            } as any}
            sessions={data.sessions}
            compact
          />
        ))}
      </div>

      <div className="overview__bottom">
        <div className="panel">
          <h3 className="panel__title">ACTIVE RUNS</h3>
          {data.activeRuns.length === 0 ? (
            <div className="panel__empty">No active runs</div>
          ) : (
            data.activeRuns.map(run => (
              <div key={run.id} className="mini-run">
                <span className="mini-run__name">{run.workflow}</span>
                <span className="mini-run__id">#{run.id.slice(0, 4)}</span>
                <span className="mini-run__step">{run.currentStep || 'starting'}</span>
              </div>
            ))
          )}
        </div>
        <CronStatus crons={data.crons || []} />
        <ModelLimits />
        <div className="panel">
          <h3 className="panel__title">ACTIVITY</h3>
          <ActivityFeed items={data.alerts || []} />
        </div>
      </div>
    </div>
  );
}
