import { useState, useRef, useEffect, useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { api } from '../lib/api';
import { chatTargetDisplay, chatTimestamp, newestKnownChatTime, type ChatTarget } from '../lib/chat-presentation';

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

function renderMarkdown(text: string): string {
  try {
    return DOMPurify.sanitize(marked.parse(text) as string);
  } catch {
    return text;
  }
}

interface WsEvent {
  type: string;
  event?: string;
  payload?: any;
  [key: string]: any;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'toolResult';
  agent: string;
  text: string;
  done: boolean;
  ts: number | null;
  origin: 'saved' | 'local' | 'socket';
  sessionId?: string;
  toolName?: string;
  responseMs?: number;
}

interface HistoryMessage {
  role: string;
  text: string;
  toolName?: string;
  timestamp?: unknown;
  sessionId?: string;
}

interface Props {
  events: WsEvent[];
  onSend: (msg: any) => void;
  connected: boolean;
  selectedAgent: string;
  selectedAgentData?: ChatTarget;
}

export function ChatPanel({ events, onSend, connected, selectedAgent, selectedAgentData }: Props) {
  const [input, setInput] = useState('');
  const [userMessages, setUserMessages] = useState<ChatMessage[]>([]);
  const [historyState, setHistoryState] = useState<{
    agentId: string; status: 'loading' | 'ready' | 'unavailable'; messages: ChatMessage[];
  }>({ agentId: selectedAgent, status: 'loading', messages: [] });
  const messagesRef = useRef<HTMLDivElement>(null);
  const lastUserSendTs = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    setHistoryState({ agentId: selectedAgent, status: 'loading', messages: [] });

    api.agentHistory(selectedAgent, 40).then((data: any) => {
      if (cancelled) return;
      if (!Array.isArray(data?.messages)) throw new Error('CHAT_HISTORY_UNAVAILABLE');
      const msgs: ChatMessage[] = data.messages.map((m: HistoryMessage, i: number) => ({
        id: `hist-${i}`,
        role: m.role === 'user' ? 'user' : m.role === 'toolResult' ? 'toolResult' : 'assistant',
        agent: selectedAgent,
        text: m.text,
        done: true,
        ts: chatTimestamp(m.timestamp),
        origin: 'saved',
        sessionId: m.sessionId,
        toolName: m.toolName,
      }));
      setHistoryState({ agentId: selectedAgent, status: 'ready', messages: msgs });
    }).catch(() => {
      if (!cancelled) setHistoryState({ agentId: selectedAgent, status: 'unavailable', messages: [] });
    });

    return () => { cancelled = true; };
  }, [selectedAgent]);

  const agentMessages = useMemo(() => {
    const byRun = new Map<string, ChatMessage>();

    for (const ev of events) {
      if (!ev.payload) continue;
      const sessionKey = ev.payload.sessionKey || '';
      const agentId = sessionKey.split(':')?.[1] || '';

      const matchAgent = selectedAgent === 'main' ? agentId === 'main' : agentId === selectedAgent;
      if (!matchAgent && agentId) continue;

      const runId = ev.payload.runId || '';
      if (!runId) continue;

      if (ev.event === 'chat' && (ev.payload.state === 'delta' || ev.payload.state === 'final') && ev.payload.message?.content) {
        const content = ev.payload.message.content;
        const text = content.map((c: any) => c.text || '').join('');
        const existing = byRun.get(runId);

        let responseMs: number | undefined;
        if (ev.payload.message.role !== 'user' && ev.payload.state === 'final' && lastUserSendTs.current > 0) {
          responseMs = Date.now() - lastUserSendTs.current;
        }

        byRun.set(runId, {
          id: runId,
          role: ev.payload.message.role === 'user' ? 'user' : 'assistant',
          agent: agentId,
          text,
          done: ev.payload.state === 'final',
          ts: existing?.ts ?? chatTimestamp(ev.payload.message.timestamp),
          origin: 'socket',
          responseMs: responseMs || existing?.responseMs,
        });
      }

      if (ev.event === 'agent' && ev.payload.stream === 'lifecycle' && ev.payload.data?.phase === 'end') {
        const existing = byRun.get(runId);
        if (existing) existing.done = true;
      }
    }

    return Array.from(byRun.values()).sort(newestKnownChatTime);
  }, [events, selectedAgent]);

  const allMessages = useMemo(() => {
    const filteredUser = userMessages.filter(m => m.agent === selectedAgent);
    const history = historyState.agentId === selectedAgent ? historyState.messages : [];
    return [...history, ...filteredUser, ...agentMessages].sort(newestKnownChatTime);
  }, [historyState, userMessages, agentMessages, selectedAgent]);

  const historyStatus = historyState.agentId === selectedAgent ? historyState.status : 'loading';

  const isThinking = useMemo(() => {
    return agentMessages.some(m => m.role === 'assistant' && !m.done);
  }, [agentMessages]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [allMessages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !connected) return;

    const text = input.trim();
    const submittedAt = Date.now();
    lastUserSendTs.current = submittedAt;

    setUserMessages(prev => [...prev, {
      id: `user-${submittedAt}`,
      role: 'user',
      agent: selectedAgent,
      text,
      done: true,
      ts: submittedAt,
      origin: 'local',
    }]);

    onSend({
      type: 'message',
      to: selectedAgent,
      content: text,
    });
    setInput('');
  };

  const { name: agentName, emoji: agentEmoji } = chatTargetDisplay(selectedAgent, selectedAgentData);

  function formatResponseTime(ms?: number): string {
    if (!ms) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  return (
    <div className="chat-panel">
      <div className="chat-panel__header">
        <span className="chat-panel__agent-info">
          <span>{agentEmoji}</span>
          <span className="chat-panel__agent-name">{agentName}</span>
        </span>
        <span className={`chat-panel__status ${connected ? 'chat-panel__status--on' : ''}`}>
          {connected ? 'MC SOCKET CONNECTED' : 'MC SOCKET NOT CONNECTED'}
        </span>
        <p className="chat-panel__connection-note">Browser-to-Mission-Control connection only; gateway and target availability are unverified.</p>
      </div>

      <div className="chat-panel__messages" ref={messagesRef}>
        {isThinking && !agentMessages.some(m => !m.done && m.text) && (
          <div className="chat-msg chat-msg--assistant">
            <div className="chat-msg__header">
              <span className="chat-msg__from">{agentEmoji} {agentName}</span>
            </div>
            <div className="chat-msg__bubble chat-msg__thinking-bubble">
              <span className="thinking-dots">
                <span>.</span><span>.</span><span>.</span>
              </span>
              {' '}Agent is thinking
            </div>
          </div>
        )}
        {historyStatus === 'loading' && (
          <div className="chat-panel__loading">Loading saved history...</div>
        )}
        {historyStatus === 'unavailable' && (
          <div className="chat-panel__notice">Saved history unavailable.</div>
        )}
        {historyStatus === 'ready' && allMessages.length === 0 && (
          <div className="chat-panel__empty">
            <div className="chat-panel__empty-icon">{agentEmoji}</div>
            <div>{`No saved messages returned for ${agentName}.`}</div>
            <div className="chat-panel__empty-sub">Local submissions and received events appear here.</div>
          </div>
        )}
        {allMessages.map((msg) => (
          <div key={msg.id} className={`chat-msg chat-msg--${msg.role}`}>
            <div className="chat-msg__header">
              <span className="chat-msg__from">
                {msg.role === 'user' ? '👤 You'
                  : msg.role === 'toolResult' ? '🔧 Tool'
                  : agentEmoji + ' ' + agentName}
              </span>
              <span className="chat-msg__provenance">{msg.origin === 'saved' ? 'Saved local history'
                : msg.origin === 'local' ? 'Local submission — delivery unconfirmed' : 'Received via MC socket'}</span>
              {msg.ts === null ? <span className="chat-msg__timestamp">Time unknown</span>
                : <time className="chat-msg__timestamp" dateTime={new Date(msg.ts).toISOString()}>
                    {msg.origin === 'local' ? 'Local time: ' : ''}{new Date(msg.ts).toLocaleString()}
                  </time>}
              {!msg.done && <span className="chat-msg__thinking">thinking...</span>}
              {msg.toolName && <span className="chat-msg__tool">{msg.toolName}</span>}
              {msg.done && msg.responseMs && (
                <span className="chat-msg__time">Local elapsed estimate: {formatResponseTime(msg.responseMs)}</span>
              )}
            </div>
            {msg.role === 'assistant' || msg.role === 'toolResult' ? (
              <div
                className="chat-msg__bubble chat-msg__markdown"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
              />
            ) : (
              <div className="chat-msg__bubble">{msg.text}</div>
            )}
          </div>
        ))}
        
        
      </div>

      <form className="chat-panel__input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={connected ? `Message ${agentName}...` : 'Disconnected...'}
          disabled={!connected}
        />
        <button type="submit" disabled={!connected || !input.trim()}>SEND</button>
      </form>
    </div>
  );
}
