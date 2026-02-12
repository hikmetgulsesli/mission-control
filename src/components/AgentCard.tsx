import { AGENT_MAP } from '../lib/constants';

interface AgentCardProps {
  agent: {
    id: string;
    name?: string;
    identityName?: string;
    identityEmoji?: string;
    model?: string;
    role?: string;
    description?: string;
    tags?: string[];
  };
  sessions?: any[];
  compact?: boolean;
  onChat?: (agent: any) => void;
  onActivity?: (agent: any) => void;
  onEdit?: (agent: any) => void;
}

export function AgentCard({ agent, sessions = [], compact = false, onChat, onActivity, onEdit }: AgentCardProps) {
  const meta = AGENT_MAP[agent.id];
  const name = agent.identityName || agent.name || meta?.name || agent.id;
  const emoji = agent.identityEmoji || meta?.emoji || '?';
  const color = meta?.color || '#00ffff';

  const agentSessions = sessions.filter(s => {
    const sid = s.agent || s.key?.split(':')?.[1];
    return sid === agent.id;
  });
  // Agent is active only if a session was updated within the last 2 minutes
  const now = Date.now();
  const isActive = agentSessions.some(s => {
    const updated = s.updatedAt || s.lastActivity;
    if (!updated) return false;
    const ts = typeof updated === 'number' ? updated : new Date(updated).getTime();
    return (now - ts) < 120_000;
  });

  const avatarUrl = `/avatars/${agent.id === 'main' ? 'arya' : agent.id}.svg`;

  const handleCardClick = () => {
    if (onChat) onChat(agent);
  };

  const handleGearClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) onEdit(agent);
  };

  const handleActivityClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onActivity) onActivity(agent);
  };

  if (compact) {
    return (
      <div className="agent-card agent-card--compact agent-card--clickable" style={{ borderColor: color }} onClick={handleCardClick}>
        <div className="agent-card__compact-top">
          <div className="agent-card__compact-left">
            <img
              src={avatarUrl}
              alt={name}
              className="agent-card__avatar agent-card__avatar--small"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div>
              <div className="agent-card__name">{emoji} {name}</div>
              <div className="agent-card__role">{agent.role || meta?.role || 'Agent'}</div>
            </div>
          </div>
          <div className="agent-card__compact-center">
            <span className={`status-dot ${isActive ? 'status-dot--online' : 'status-dot--idle'}`} />
            <span className="agent-card__status-text">{isActive ? 'busy' : 'idle'}</span>
          </div>
          <div className="agent-card__compact-right">
            {onActivity && (
              <button className="btn btn--small" onClick={handleActivityClick}>ACTIVITY</button>
            )}
          </div>
        </div>
        {onEdit && (
          <button className="agent-card__gear-corner" onClick={handleGearClick} title="Settings">⚙️</button>
        )}
        <div className="agent-card__details">
          <div className="agent-card__detail">
            <span className="agent-card__label">MODEL</span>
            <span>{agent.model || meta?.model || 'unknown'}</span>
          </div>
          <div className="agent-card__detail">
            <span className="agent-card__label">SESSIONS</span>
            <span>{agentSessions.length}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="agent-card agent-card--clickable" style={{ borderColor: color }} onClick={handleCardClick}>
      <div className="agent-card__header">
        <img
          src={avatarUrl}
          alt={name}
          className="agent-card__avatar"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div style={{ flex: 1 }}>
          <div className="agent-card__name">{emoji} {name}</div>
          <div className="agent-card__role">{agent.role || meta?.role || 'Agent'}</div>
        </div>
        <span className={`status-dot ${isActive ? 'status-dot--online' : 'status-dot--idle'}`} />
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: '8px' }}>
          {isActive ? 'busy' : 'idle'}
        </span>
        {onActivity && (
          <button 
            className="btn btn--small" 
            onClick={handleActivityClick}
          >
            ACTIVITY
          </button>
        )}
      </div>
      {onEdit && (
        <button className="agent-card__gear-corner" onClick={handleGearClick} title="Settings">⚙️</button>
      )}
      <div className="agent-card__details">
        <div className="agent-card__detail">
          <span className="agent-card__label">MODEL</span>
          <span>{agent.model || meta?.model || 'unknown'}</span>
        </div>
        <div className="agent-card__detail">
          <span className="agent-card__label">SESSIONS</span>
          <span>{agentSessions.length}</span>
        </div>
      </div>
    </div>
  );
}
