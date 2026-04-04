import React from 'react';
import { AGENT_MAP } from '../lib/constants';


function normalizeModel(raw: string): string {
  const map: Record<string, string> = {
    'anthropic/claude-sonnet-4-5-20250929': 'sonnet-4.5',
    'anthropic/claude-opus-4-6': 'opus-4.6',
    'minimax/MiniMax-M2.7': 'minimax-m2.7',
    'minimax-coding/MiniMax-M2.7': 'minimax-m2.7',
    'kimi-coding/k2p5': 'kimi-k2p5',
  };
  if (map[raw]) return map[raw];
  // Strip provider prefix (e.g. "anthropic/claude-..." -> "claude-...")
  const slash = raw.indexOf('/');
  return slash >= 0 ? raw.slice(slash + 1) : raw;
}
export interface AgentStats {
  agentId: string;
  storiesCompleted: number;
  storiesFailed: number;
  successRate: number;
  avgDurationMs: number;
  errorCount: number;
  totalSteps: number;
}

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
  stats?: AgentStats | null;
  onChat?: (agent: any) => void;
  onActivity?: (agent: any) => void;
  onEdit?: (agent: any) => void;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '-';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

export const AgentCard = React.memo(function AgentCard({ agent, sessions = [], compact = false, stats, onChat, onActivity, onEdit }: AgentCardProps) {
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
            <span>{normalizeModel(agent.model || meta?.model || 'unknown')}</span>
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
          <span>{normalizeModel(agent.model || meta?.model || 'unknown')}</span>
        </div>
        <div className="agent-card__detail">
          <span className="agent-card__label">SESSIONS</span>
          <span>{agentSessions.length}</span>
        </div>
      </div>
      {stats && stats.totalSteps > 0 && (
        <div className="agent-card__stats">
          <div className="agent-card__stats-row">
            <div className="agent-card__stat">
              <span className="agent-card__stat-value" style={{ color: 'var(--neon-green)' }}>{stats.storiesCompleted}</span>
              <span className="agent-card__stat-label">done</span>
            </div>
            <div className="agent-card__stat">
              <span className="agent-card__stat-value" style={{ color: stats.successRate >= 80 ? 'var(--neon-green)' : stats.successRate >= 50 ? 'var(--neon-orange, #ffaa00)' : 'var(--neon-red, #ff0040)' }}>{stats.successRate}%</span>
              <span className="agent-card__stat-label">success</span>
            </div>
            <div className="agent-card__stat">
              <span className="agent-card__stat-value">{formatDuration(stats.avgDurationMs)}</span>
              <span className="agent-card__stat-label">avg</span>
            </div>
            {stats.errorCount > 0 && (
              <div className="agent-card__stat">
                <span className="agent-card__stat-value" style={{ color: 'var(--neon-red, #ff0040)' }}>{stats.errorCount}</span>
                <span className="agent-card__stat-label">errors</span>
              </div>
            )}
          </div>
          {agent.tags && agent.tags.length > 0 && (
            <div className="agent-card__tags">
              {agent.tags.map((tag, i) => (
                <span key={i} className="agent-card__tag">{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
