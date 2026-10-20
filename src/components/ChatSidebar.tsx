import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AGENT_MAP } from '../lib/constants';
import { api } from '../lib/api';
import { chatTargetDisplay, chatTimestamp, newestKnownChatTime, type ChatTarget } from '../lib/chat-presentation';

interface HistoryPreview {
  agentId: string;
  lastMessage: string;
  lastTimestamp: number | null;
}

interface Props {
  agents: ChatTarget[];
  selected: string;
  onSelect: (id: string) => void;
  loading?: boolean;
  error?: string | null;
}

export function ChatSidebar({ agents, selected, onSelect, loading, error }: Props) {
  const [view, setView] = useState<'agents' | 'history'>('agents');
  const [historyObservation, setHistoryObservation] = useState<{
    previews: HistoryPreview[]; failed: number; attempted: number; status: 'loading' | 'ready';
  }>({ previews: [], failed: 0, attempted: 0, status: 'loading' });

  // Load history previews for all agents when switching to history tab
  useEffect(() => {
    if (view !== 'history') return;
    let cancelled = false;
    setHistoryObservation({ previews: [], failed: 0, attempted: agents.length, status: 'loading' });

    async function loadPreviews() {
      const results = await Promise.allSettled(
        agents.map(async agent => {
          const data = await api.agentHistory(agent.id, 1);
          if (!Array.isArray(data?.messages)) throw new Error('CHAT_HISTORY_UNAVAILABLE');
          return { agent, messages: data.messages };
        })
      );
      if (cancelled) return;

      const previews: HistoryPreview[] = [];
      let failed = 0;
      for (const r of results) {
        if (r.status === 'rejected') { failed += 1; continue; }
        const { agent, messages: msgs } = r.value;
        if (msgs.length > 0) {
          const last = msgs[msgs.length - 1];
          previews.push({
            agentId: agent.id,
            lastMessage: last.text?.slice(0, 80) || '',
            lastTimestamp: chatTimestamp(last.timestamp),
          });
        }
      }
      previews.sort((a, b) => newestKnownChatTime({ ts: a.lastTimestamp }, { ts: b.lastTimestamp }));
      setHistoryObservation({ previews, failed, attempted: agents.length, status: 'ready' });
    }

    loadPreviews();
    return () => { cancelled = true; };
  }, [view, agents]);

  // Sort agents: selected first, then alphabetically
  const sorted = [...agents].sort((a, b) => {
    if (a.id === selected) return -1;
    if (b.id === selected) return 1;
    const { name: nameA } = chatTargetDisplay(a.id, a);
    const { name: nameB } = chatTargetDisplay(b.id, b);
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

      {/* Select the main target without creating or resetting a session. */}
      <button className="chat-sidebar__new-chat" onClick={() => onSelect('main')}>
        Select main target
      </button>

      {error && (
        <p className="chat-sidebar__notice">{agents.length ? 'Agent list unavailable; showing last loaded targets.' : 'Agent list unavailable.'}</p>
      )}
      {!loading && !error && agents.length === 0 && (
        <p className="chat-sidebar__notice">No targets in the last roster response.</p>
      )}

      {view === 'agents' ? (
        <>
          {loading && agents.length === 0 && (
            <div className="chat-sidebar__loading">Loading agents...</div>
          )}
          {sorted.map(agent => {
            const meta = AGENT_MAP[agent.id];
            const { name, emoji } = chatTargetDisplay(agent.id, agent);
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
                {meta?.role && <span className="chat-sidebar__role">Catalog role: {meta.role}</span>}
              </button>
            );
          })}
        </>
      ) : (
        <div className="chat-sidebar__sessions">
          <p className="chat-sidebar__notice">Saved local history for listed targets.</p>
          {historyObservation.status === 'loading' && (
            <div className="chat-sidebar__loading">Loading history...</div>
          )}
          {historyObservation.status === 'ready' && historyObservation.failed > 0 && (
            <p className="chat-sidebar__notice">{`Saved history unavailable for ${historyObservation.failed} of ${historyObservation.attempted} targets.`}</p>
          )}
          {historyObservation.status === 'ready' && historyObservation.failed === 0 && historyObservation.attempted > 0 && historyObservation.previews.length === 0 && (
            <div className="chat-sidebar__empty">No saved messages returned for listed targets.</div>
          )}
          {historyObservation.previews.map(preview => {
            const { name, emoji } = chatTargetDisplay(preview.agentId, agents.find(agent => agent.id === preview.agentId));
            const isActive = preview.agentId === selected;

            return (
              <button
                type="button"
                key={preview.agentId}
                className={`chat-sidebar__session ${isActive ? 'chat-sidebar__session--active' : ''}`}
                onClick={() => { onSelect(preview.agentId); setView('agents'); }}
              >
                <div className="chat-sidebar__session-header">
                  <span className="chat-sidebar__session-emoji">{emoji}</span>
                  <span className="chat-sidebar__session-title">{name}</span>
                </div>
                <div className="chat-sidebar__session-meta">
                  <span>{preview.lastTimestamp === null ? 'Time unknown' : formatDistanceToNow(preview.lastTimestamp, { addSuffix: true })}</span>
                </div>
                {preview.lastMessage && (
                  <div className="chat-sidebar__session-preview">
                    {preview.lastMessage}{preview.lastMessage.length >= 80 ? '...' : ''}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}
