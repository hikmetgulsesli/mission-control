import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePolling } from '../hooks/usePolling';
import { api } from '../lib/api';
import { AgentCard } from '../components/AgentCard';
import { AgentEditModal } from '../components/AgentEditModal';
import { AgentActivityModal } from '../components/AgentActivityModal';
import { GlitchText } from '../components/GlitchText';

export function Agents() {
  const { data: agents, loading, refresh } = usePolling(api.agents, 30000);
  const { data: sessions } = usePolling(api.sessions, 30000);
  const [editAgent, setEditAgent] = useState<any>(null);
  const [activityAgent, setActivityAgent] = useState<{ id: string; name: string } | null>(null);
  const navigate = useNavigate();

  if (loading) return <div className="page-loading">Loading agents...</div>;

  const handleChat = (agent: any) => {
    // Navigate to chat page with this agent selected
    navigate(`/chat?agent=${agent.id}`);
  };

  const handleActivity = (agent: any) => {
    setActivityAgent({ id: agent.id, name: agent.name || agent.id });
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

  return (
    <div className="agents-page">
      <GlitchText text="AGENT ROSTER" tag="h2" />
      <div className="agent-grid agent-grid--full">
        {(agents || []).map((agent: any) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            sessions={sessions || []}
            onChat={handleChat}
            onActivity={() => handleActivity(agent)}
            onEdit={(a) => setEditAgent(a)}
          />
        ))}
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
