import { AGENT_MAP } from '../lib/constants';

interface Props {
  agents: { id: string; identityName?: string; identityEmoji?: string }[];
  selected: string;
  onSelect: (id: string) => void;
}

export function ChatSidebar({ agents, selected, onSelect }: Props) {
  return (
    <aside className="chat-sidebar">
      <h3 className="chat-sidebar__title">AGENTS</h3>
      {agents.map(agent => {
        const meta = AGENT_MAP[agent.id];
        const name = agent.identityName || meta?.name || agent.id;
        const emoji = agent.identityEmoji || meta?.emoji || '?';
        const isActive = agent.id === selected;

        return (
          <button
            key={agent.id}
            className={`chat-sidebar__agent ${isActive ? 'chat-sidebar__agent--active' : ''}`}
            onClick={() => onSelect(agent.id)}
            style={{ borderLeftColor: meta?.color || '#00ffff' }}
          >
            <span>{emoji}</span>
            <span>{name}</span>
          </button>
        );
      })}
    </aside>
  );
}
