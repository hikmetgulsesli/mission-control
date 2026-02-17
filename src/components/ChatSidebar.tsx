import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AGENT_MAP } from '../lib/constants';
import { api } from '../lib/api';

interface HistoryPreview {
  agentId: string;
  lastMessage: string;
  lastTimestamp: number;
  messageCount: number;
}

interface Props {
  agents: { id: string; identityName?: string; identityEmoji?: string }[];
  selected: string;
  onSelect: (id: string) => void;
  loading?: boolean;
}

export function ChatSidebar({ agents, selected, onSelect, loading }: Props) {
  const [view, setView] = useState<'agents' | 'history'>('agents');
  const [historyPreviews, setHistoryPreviews] = useState<HistoryPreview[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load history previews for all agents when switching to history tab
  useEffect(() => {
    if (view !== 'history') return;
    let cancelled = false;
    setLoadingHistory(true);

    async function loadPreviews() {
      const previews: HistoryPreview[] = [];
      for (const agent of agents) {
        try {
          const data = await api.agentHistory(agent.id, 1);
          const msgs = data.messages || [];
          if (msgs.length > 0) {
            const last = msgs[msgs.length - 1];
            previews.push({
              agentId: agent.id,
              lastMessage: last.text?.slice(0, 80) || '',
              lastTimestamp: last.timestamp ? new Date(last.timestamp).getTime() : Date.now(),
              messageCount: data.total || msgs.length,
            });
          }
        } catch {}
      }
      if (!cancelled) {
        previews.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
        setHistoryPreviews(previews);
        setLoadingHistory(false);
      }
    }

    loadPreviews();
    return () => { cancelled = true; };
  }, [view, agents]);

  // Sort agents: selected first, then alphabetically
  const sorted = [...agents].sort((a, b) => {
    if (a.id === selected) return -1;
    if (b.id === selected) return 1;
    const nameA = a.identityName || AGENT_MAP[a.id]?.name || a.id;
    const nameB = b.identityName || AGENT_MAP[b.id]?.name || b.id;
    return nameA.localeCompare(nameB);
  });

  return (
    <aside className="chat-sidebar">
      {/* Tab switcher */}
      <div className="chat-sidebar__tabs">
        <button
          className={`chat-sidebar__tab ${view === 'agents' ? 'chat-sidebar__tab--active' : ''}`}
          onClick={() => setView('agents')}
        >
          AGENTS
        </button>
        <button
          className={`chat-sidebar__tab ${view === 'history' ? 'chat-sidebar__tab--active' : ''}`}
          onClick={() => setView('history')}
        >
          HISTORY
        </button>
      </div>

      {/* New Chat button */}
      <button className="chat-sidebar__new-chat" onClick={() => onSelect('main')}>
        + New Chat
      </button>

      {view === 'agents' ? (
        <>
          {loading && agents.length === 0 && (
            <div className="chat-sidebar__loading">Loading agents...</div>
          )}
          {sorted.map(agent => {
            const meta = AGENT_MAP[agent.id];
            const name = agent.identityName || meta?.name || agent.id;
            const emoji = agent.identityEmoji || meta?.emoji || '?';
            const isActive = agent.id === selected;
            const preview = historyPreviews.find(h => h.agentId === agent.id);

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
        </>
      ) : (
        <div className="chat-sidebar__sessions">
          {loadingHistory && (
            <div className="chat-sidebar__loading">Loading history...</div>
          )}
          {!loadingHistory && historyPreviews.length === 0 && (
            <div className="chat-sidebar__empty">No chat history yet</div>
          )}
          {historyPreviews.map(preview => {
            const meta = AGENT_MAP[preview.agentId];
            const name = meta?.name || preview.agentId;
            const emoji = meta?.emoji || '?';
            const isActive = preview.agentId === selected;

            return (
              <div
                key={preview.agentId}
                className={`chat-sidebar__session ${isActive ? 'chat-sidebar__session--active' : ''}`}
                onClick={() => { onSelect(preview.agentId); setView('agents'); }}
              >
                <div className="chat-sidebar__session-header">
                  <span className="chat-sidebar__session-emoji">{emoji}</span>
                  <span className="chat-sidebar__session-title">{name}</span>
                </div>
                <div className="chat-sidebar__session-meta">
                  <span>{formatDistanceToNow(preview.lastTimestamp, { addSuffix: true })}</span>
                </div>
                {preview.lastMessage && (
                  <div className="chat-sidebar__session-preview">
                    {preview.lastMessage}{preview.lastMessage.length >= 80 ? '...' : ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
