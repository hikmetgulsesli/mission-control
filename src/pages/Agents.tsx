import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePolling } from '../hooks/usePolling';
import { api } from '../lib/api';
import { AgentCard } from '../components/AgentCard';
import { AgentEditModal } from '../components/AgentEditModal';
import { AgentActivityModal } from '../components/AgentActivityModal';
import { AgentLivePanel } from '../components/AgentLivePanel';
import { GlitchText } from '../components/GlitchText';

export function Agents() {
  const { data: agents, loading, refresh } = usePolling(api.agents, 30000);
  const { data: sessions } = usePolling(api.sessions, 30000);
  const [editAgent, setEditAgent] = useState<any>(null);
  const [activityAgent, setActivityAgent] = useState<{ id: string; name: string } | null>(null);
  const [liveAgent, setLiveAgent] = useState<string | null>(null);
  const navigate = useNavigate();

  if (loading) return <div className="page-loading">Loading agents...</div>;

  const handleChat = (agent: any) => {
    navigate(`/chat?agent=${agent.id}`);
  };

  const handleActivity = (agent: any) => {
    setActivityAgent({ id: agent.id, name: agent.name || agent.id });
  };

  const handleLive = (agent: any) => {
    setLiveAgent(liveAgent === agent.id ? null : agent.id);
  };

  const handleSave = async (agentId: string, changes: any) => {
    const res = await fetch(`/api/agents/${agentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    refresh();
  };

  // Determine active status for glow effect
  const agentStatuses = new Map<string, 'working' | 'idle'>();
  const now = Date.now();
  (agents || []).forEach((agent: any) => {
    const agentSessions = (sessions || []).filter((s: any) => {
      const sid = s.agent || s.key?.split(':')?.[1];
      return sid === agent.id;
    });
    const isActive = agentSessions.some((s: any) => {
      const updated = s.updatedAt || s.lastActivity;
      if (!updated) return false;
      const ts = typeof updated === 'number' ? updated : new Date(updated).getTime();
      return (now - ts) < 120_000;
    });
    agentStatuses.set(agent.id, isActive ? 'working' : 'idle');
  });

  return (
    <div className="agents-page">
      <GlitchText text="AGENT ROSTER" tag="h2" />

      <div className={`agents-page__layout ${liveAgent ? 'agents-page__layout--with-panel' : ''}`}>
        <div className="agents-page__grid">
          <div className="agent-grid agent-grid--full">
            {(agents || []).map((agent: any) => {
              const status = agentStatuses.get(agent.id) || 'idle';
              return (
                <div
                  key={agent.id}
                  className={`agent-card-wrap ${status === 'working' ? 'agent-card-wrap--active' : ''} ${liveAgent === agent.id ? 'agent-card-wrap--selected' : ''}`}
                >
                  <AgentCard
                    agent={agent}
                    sessions={sessions || []}
                    onChat={handleChat}
                    onActivity={() => handleActivity(agent)}
                    onEdit={(a) => setEditAgent(a)}
                  />
                  <button
                    className="agent-card-wrap__live-btn"
                    onClick={(e) => { e.stopPropagation(); handleLive(agent); }}
                    title="Live view"
                  >
                    {'\u25C9'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {liveAgent && (
          <AgentLivePanel
            agentId={liveAgent}
            onClose={() => setLiveAgent(null)}
          />
        )}
      </div>

      {editAgent && (
        <AgentEditModal
          agent={editAgent}
          onClose={() => setEditAgent(null)}
          onSave={handleSave}
        />
      )}

      {activityAgent && (
        <AgentActivityModal
          agentId={activityAgent.id}
          agentName={activityAgent.name}
          onClose={() => setActivityAgent(null)}
        />
      )}
    </div>
  );
}
