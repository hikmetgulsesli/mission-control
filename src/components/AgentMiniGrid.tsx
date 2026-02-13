import { AGENTS } from '../lib/constants';

interface AgentMiniGridProps {
  agents: any[];
  pipeline: any[];
}

function getAgentStatus(agentId: string, agentsData: any[], pipeline: any[]): { status: 'active' | 'idle' | 'workflow'; label?: string } {
  // Check if agent is currently in a workflow step
  for (const run of pipeline) {
    if (run.status !== 'running') continue;
    for (const step of run.steps || []) {
      if (step.status === 'running') {
        // Cross-reference: if agent name appears in run context
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

export function AgentMiniGrid({ agents, pipeline }: AgentMiniGridProps) {
  return (
    <div className="af-grid">
      {AGENTS.map((agent) => {
        const { status, label } = getAgentStatus(agent.id, agents, pipeline);
        const agentData = agents.find((a: any) => a.id === agent.id || a.name?.toLowerCase() === agent.id);
        return (
          <div key={agent.id} className={`af-agent-card af-agent-card--${status}`}>
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
            <div className="af-agent-card__time">{timeAgo(agentData?.lastActive || agentData?.updatedAt)}</div>
            {label && <div className="af-agent-card__workflow">{label}</div>}
          </div>
        );
      })}
    </div>
  );
}
