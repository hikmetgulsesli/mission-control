import { dataSyncMessage } from '../lib/data-sync';
import { api } from "../lib/api";
import { usePolling } from '../hooks/usePolling';
import { useAppStore } from '../store/appStore';
import { AgentCard } from '../components/AgentCard';
import { ActivityFeed } from '../components/ActivityFeed';
import { GlitchText } from '../components/GlitchText';
import type { CronStatusItem, OpenPR, DeployInfo, AgentSummary, ModelLimitItem, ModelBadge } from '../lib/types';
import { formatDistanceToNow } from 'date-fns';

function CronStatus({ crons }: { crons: CronStatusItem[] }) {
  if (!crons || crons.length === 0) return null;
  return (
    <div className="panel">
      <h3 className="panel__title">CRON STATUS</h3>

      {/* System Health */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "8px", marginBottom: "12px" }}>
        {["Gateway", "Database", "Disk", "Memory"].map(label => (
          <div key={label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "4px", padding: "8px 12px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span aria-hidden="true" style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--text-dim)", display: "inline-block" }} />
            <span style={{ fontSize: "14px", color: "var(--text-primary)", fontFamily: "var(--font)" }}>{label}: Unverified</span>
          </div>
        ))}
      </div>
      <div className="cron-list">
        {crons.map((c) => (
          <div key={c.id} className="cron-item">
            <span className={`cron-item__dot cron-item__dot--${c.status}`} />
            <span className="cron-item__name">{c.name}</span>
            <span className="cron-item__last">
              {c.lastRunAt ? formatDistanceToNow(c.lastRunAt, { addSuffix: true }) : 'never'}
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
  const { data } = usePolling<ModelLimitItem[]>(() => api.modelLimits(), 60000);
  const { data: quota } = usePolling<Record<string, { limit: number | null; used: number; tokens: number; windowHours: number }>>(() => api.quota(), 60000);

  if (!data || !Array.isArray(data) || data.length === 0) return null;

  return (
    <div className="panel">
      <h3 className="panel__title">LOCAL MODEL CONFIGURATION</h3>
      <p>Plans, prices and agent assignments are configured defaults; account billing is not verified.</p>
      <div className="model-limits">
        {data.map((p) => {
          const q = quota?.[p.id];
          const used = q?.used ?? null;
          const limit = q?.limit ?? p.limits?.promptsPer5h ?? null;
          const pct = used !== null && limit ? Math.min((used / limit) * 100, 100) : null;
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
                  {used === null ? 'Usage unavailable' : `${used} calls / 5h`}
                </span>
                {(p.usage?.today?.cost ?? 0) > 0 && (
                  <span className="model-limit-item__today-cost">
                    ${p.usage?.today?.cost}
                  </span>
                )}
              </div>
              {used === null && limit !== null && (
                <div className="quota-bar">
                  <span className="quota-bar__label" style={{ marginLeft: 0 }}>Configured limit: {limit} calls / 5h</span>
                </div>
              )}
              {used !== null && limit !== null && (
                <div className="quota-bar">
                  <div className="quota-bar__track">
                    <div className="quota-bar__fill" style={{ width: `${pct}%`, background: barColor }} />
                  </div>
                  <span className="quota-bar__label">{used}/{limit}</span>
                </div>
              )}
              {used !== null && limit === null && (
                <div className="quota-bar">
                  <span className="quota-bar__label" style={{ marginLeft: 0 }}>{used} calls / 5h</span>
                </div>
              )}
              {(p.models?.length ?? 0) > 0 && (
                <div className="model-limit-item__models">
                  {p.models?.map((m: ModelBadge) => (
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

/* Command Center Hub */

function OpenPRsPanel({ prs }: { prs: OpenPR[] }) {
  return (
    <div className="hub-col">
      <h4 className="hub-col__title">
        <span className="hub-col__icon">{'\u2442'}</span> OPEN PRs
        <span className="hub-col__count">{prs.length}</span>
      </h4>
      {prs.length === 0 ? (
        <div className="hub-col__empty">No open PRs</div>
      ) : (
        <div className="hub-col__list">
          {prs.map((pr) => (
            <a
              key={pr.number}
              className="hub-pr"
              href={pr.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="hub-pr__top">
                <span className="hub-pr__number">#{pr.number}</span>
                <span className="hub-pr__title">{pr.title}</span>
              </div>
              <div className="hub-pr__bottom">
                <span className="hub-pr__branch">{pr.headRefName}</span>
                {pr.updatedAt && (
                  <span className="hub-pr__time">
                    {formatDistanceToNow(new Date(pr.updatedAt), { addSuffix: true })}
                  </span>
                )}
                {pr.mergeable === 'MERGEABLE' && <span className="hub-pr__merge hub-pr__merge--ready">ready</span>}
                {pr.mergeable === 'CONFLICTING' && <span className="hub-pr__merge hub-pr__merge--conflict">conflict</span>}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function DeploysPanel({ deploys }: { deploys: DeployInfo[] }) {
  return (
    <div className="hub-col">
      <h4 className="hub-col__title">
        <span className="hub-col__icon">{'\u25B2'}</span> DEPLOYS
        <span className="hub-col__count">{deploys.length}</span>
      </h4>
      {deploys.length === 0 ? (
        <div className="hub-col__empty">No projects</div>
      ) : (
        <div className="hub-col__list">
          {deploys.map((d) => (
            <div key={d.id || d.name} className="hub-deploy">
              <div className="hub-deploy__top">
                <span className={`hub-deploy__dot ${d.online ? 'hub-deploy__dot--online' : 'hub-deploy__dot--offline'}`} />
                <span className="hub-deploy__name">{d.name}</span>
                <span className="hub-deploy__port">:{d.port}</span>
              </div>
              {d.subdomain && (
                <div className="hub-deploy__url">{d.subdomain}.setrox.com.tr</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentSummaryPanel({ agents }: { agents?: AgentSummary[] | null }) {
  const mappedCount = agents?.filter(agent => agent.status === 'mapped').length ?? 0;
  const mappingUnavailable = agents?.some(agent => agent.status === 'unknown');

  return (
    <div className="hub-col">
      <h4 className="hub-col__title">
        <span className="hub-col__icon">{'\u25C9'}</span> AGENTS
        <span className="hub-col__count">
          {agents == null ? 'Unknown' : mappingUnavailable ? 'Running-step mappings unavailable' : `${mappedCount}/${agents.length} running-step mappings`}
        </span>
      </h4>
      {agents == null ? (
        <div className="hub-col__empty">Agent roster unavailable</div>
      ) : agents.length === 0 ? (
        <div className="hub-col__empty">No observed agents</div>
      ) : (
        <div className="hub-col__list">
          {agents.map(agent => {
            const isMapped = agent.status === 'mapped';
            const lastActivity = agent.lastActivity == null ? NaN : typeof agent.lastActivity === 'number'
              ? agent.lastActivity : new Date(agent.lastActivity).getTime();
            return (
              <div key={agent.id} className={`hub-agent ${isMapped ? 'hub-agent--working' : ''}`}>
                <span className="hub-agent__emoji">{agent.identityEmoji || '◉'}</span>
                <span className="hub-agent__name">{agent.identityName || agent.name || agent.id}</span>
                <span className={`hub-agent__dot ${isMapped ? 'hub-agent__dot--on' : ''}`} />
                <span className="hub-agent__task">
                  {agent.status === 'unknown' ? 'Mapping unavailable' : isMapped ? agent.currentTask : 'No mapped running step'}
                  {Number.isFinite(lastActivity) && ` · Last activity ${formatDistanceToNow(lastActivity, { addSuffix: true })}`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Overview() {
  const data = useAppStore(s => s.overview);
  const sync = useAppStore(s => s.sync?.overview);

  if (!data) {
    return <div className="page-loading" role="status">Overview: {dataSyncMessage(sync)}{sync?.observedAt != null ? ' · No overview payload' : ''}</div>;
  }

  return (
    <div className="overview">
      <GlitchText text="SYSTEM OVERVIEW" tag="h2" />
      <p role="status">Overview: {dataSyncMessage(sync)}</p>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-card__value">{data.agentCount ?? 'Unknown'}</div>
          <div className="stat-card__label">AGENTS</div>
          <div className="stat-card__sub">{data.sessions?.length || 0} sessions</div>
        </div>
        <div className="stat-card stat-card--cyan">
          <div className="stat-card__value">{data.activeRunCount}</div>
          <div className="stat-card__label">RUNNING</div>
          <div className="stat-card__sub">workflows</div>
        </div>
        <div className="stat-card stat-card--orange">
          <div className="stat-card__value">{data.cronCount ?? 'Unknown'}</div>
          <div className="stat-card__label">CRONS</div>
          <div className="stat-card__sub">enabled schedules</div>
        </div>
        <div className="stat-card stat-card--green">
          <div className="stat-card__value">${(data.costToday ?? 0).toFixed(2)}</div>
          <div className="stat-card__label">TODAY</div>
          <div className="stat-card__sub">${(data.costAllTime ?? 0).toFixed(0)} total</div>
        </div>
      </div>

      {/* Command Center Hub */}
      <div className="command-center">
        <h3 className="command-center__title">COMMAND CENTER</h3>
        <div className="command-center__grid">
          <OpenPRsPanel prs={data.openPRs || []} />
          <DeploysPanel deploys={data.recentDeploys || []} />
          <AgentSummaryPanel agents={data.agentSummary} />
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
