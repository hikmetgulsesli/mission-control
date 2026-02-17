import { AGENT_MAP } from '../lib/constants';

interface Props {
  agents: { id: string; identityName?: string; identityEmoji?: string }[];
  selected: string;
  onSelect: (id: string) => void;
  loading?: boolean;
}

export function ChatSidebar({ agents, selected, onSelect, loading }: Props) {
  // Sort: selected agent first, then alphabetically
  const sorted = [...agents].sort((a, b) => {
    if (a.id === selected) return -1;
    if (b.id === selected) return 1;
    const nameA = a.identityName || AGENT_MAP[a.id]?.name || a.id;
    const nameB = b.identityName || AGENT_MAP[b.id]?.name || b.id;
    return nameA.localeCompare(nameB);
  });

  return (
    <aside className="chat-sidebar">
      <h3 className="chat-sidebar__title">AGENTS</h3>

      {/* New Chat button always on top */}
      <button
        className="chat-sidebar__new-chat"
        onClick={() => onSelect('main')}
      >
        + New Chat
      </button>

      {loading && agents.length === 0 && (
        <div className="chat-sidebar__loading">Loading agents...</div>
      )}

      {sorted.map(agent => {
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
            {meta?.role && <span className="chat-sidebar__role">{meta.role}</span>}
          </button>
        );
      })}
    </aside>
  );
}
