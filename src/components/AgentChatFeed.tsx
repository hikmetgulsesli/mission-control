import { usePolling } from '../hooks/usePolling';
import { api } from '../lib/api';
import { AGENTS } from '../lib/constants';

const AGENT_LOOKUP = Object.fromEntries(AGENTS.map(a => [a.id, a]));

function timeAgo(ts: string): string {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

interface FeedEntry {
  id: number;
  agent_id: string;
  agent_name: string;
  message: string;
  session_id?: string;
  created_at: string;
}

export function AgentChatFeed() {
  const { data: feed, loading } = usePolling<FeedEntry[]>(
    () => api.setfarmAgentFeed(100),
    10_000,
  );

  if (loading && !feed) {
    return <div className="agent-chat__loading">Loading feed...</div>;
  }

  const entries = feed || [];

  return (
    <div className="agent-chat">
      {entries.length === 0 && (
        <div className="agent-chat__empty">No agent output yet</div>
      )}
      {entries.map((e) => {
        const agent = AGENT_LOOKUP[e.agent_id];
        const emoji = agent?.emoji || '🤖';
        const name = agent?.name || e.agent_name;
        const color = agent?.color || '#00ff41';
        return (
          <div key={e.id} className="agent-chat__msg">
            <div className="agent-chat__header">
              <span className="agent-chat__identity">
                <span className="agent-chat__emoji">{emoji}</span>
                <span className="agent-chat__name" style={{ color }}>{name}</span>
              </span>
              <span className="agent-chat__time">{timeAgo(e.created_at)}</span>
            </div>
            <div className="agent-chat__text">{e.message}</div>
          </div>
        );
      })}
    </div>
  );
}
