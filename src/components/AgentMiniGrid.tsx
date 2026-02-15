import { useState } from 'react';
import { AGENTS } from '../lib/constants';
import { AgentActivityPanel } from './AgentActivityPanel';

interface AgentMiniGridProps {
  agents: any[];
  pipeline: any[];
  sessions?: any[];
}

function getAgentStatus(agentId: string, agentsData: any[], pipeline: any[]): { status: 'active' | 'idle' | 'workflow'; label?: string } {
  for (const run of pipeline) {
    if (run.status !== 'running') continue;
    for (const step of run.steps || []) {
      if (step.status === 'running') {
        const agentData = agentsData.find((a: any) => a.id === agentId || a.name?.toLowerCase() === agentId);
        if (agentData?.status === 'active') {
          return { status: 'workflow', label: `${step.stepId} (${run.workflow})` };
        }
      }
    }
  }

  const agentData = agentsData.find((a: any) => a.id === agentId || a.name?.toLowerCase() === agentId);
  if (agentData?.status === 'active' || agentData?.lastActive) {
    const lastActive = agentData.lastActive ? new Date(agentData.lastActive) : null;
    if (lastActive) {
      const minutesAgo = (Date.now() - lastActive.getTime()) / 60_000;
      if (minutesAgo < 10) return { status: 'active' };
    }
  }

  return { status: 'idle' };
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return 'never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatSessionTime(ms: number): string {
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h${mins % 60 > 0 ? ` ${mins % 60}m` : ''}`;
}

function sessionTimeClass(ms: number): string {
  const mins = ms / 60000;
  if (mins < 5) return 'session-time--green';
  if (mins < 30) return 'session-time--orange';
  return 'session-time--red';
}

export function AgentMiniGrid({ agents, pipeline, sessions = [] }: AgentMiniGridProps) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  return (
    <>
      <div className="af-grid">
        {AGENTS.map((agent) => {
          const { status, label } = getAgentStatus(agent.id, agents, pipeline);
          const agentData = agents.find((a: any) => a.id === agent.id || a.name?.toLowerCase() === agent.id);

          // Find session for this agent
          const agentSession = sessions.find((s: any) => {
            const sAgent = s.agentId || s.agent;
            return sAgent === agent.id || sAgent === (agent.id === 'main' ? 'arya' : agent.id);
          });
          const sessionDuration = agentSession?.duration || 0;

          // Idle tracking
          const lastActiveStr = agentData?.lastActive || agentData?.updatedAt;
          const idleDays = lastActiveStr
            ? (Date.now() - new Date(lastActiveStr).getTime()) / (1000 * 60 * 60 * 24)
            : -1;
          const isLongIdle = idleDays > 1;
          const neverUsed = !lastActiveStr || idleDays === -1;

          return (
            <div
              key={agent.id}
              className={`af-agent-card af-agent-card--${status} ${isLongIdle ? 'af-agent-card--long-idle' : ''} ${neverUsed ? 'af-agent-card--never' : ''}`}
              onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
              style={{ cursor: 'pointer' }}
            >
              <div className="af-agent-card__top">
                <span className="af-agent-card__emoji">{agent.emoji}</span>
                <span className="af-agent-card__name">{agent.name}</span>
                <span className={`af-agent-card__badge af-agent-card__badge--${status}`}>
                  {status === 'active' && 'ACTIVE'}
                  {status === 'idle' && 'IDLE'}
                  {status === 'workflow' && 'WORKFLOW'}
                </span>
              </div>
              <div className="af-agent-card__model">{agent.model}</div>
              <div className="af-agent-card__bottom-row">
                <span className="af-agent-card__time">{timeAgo(lastActiveStr)}</span>
                {sessionDuration > 0 && (
                  <span className={`af-agent-card__session-time ${sessionTimeClass(sessionDuration)}`}>
                    {formatSessionTime(sessionDuration)}
                  </span>
                )}
              </div>
              {label && <div className="af-agent-card__workflow">{label}</div>}
            </div>
          );
        })}
      </div>

      {/* Agent activity slide-out panel */}
      {selectedAgent && (
        <AgentActivityPanel
          agentId={selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </>
  );
}
