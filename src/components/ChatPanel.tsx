import { useState, useRef, useEffect, useMemo } from 'react';
import { marked } from 'marked';
import { api } from '../lib/api';
import { AGENT_MAP } from '../lib/constants';

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

function renderMarkdown(text: string): string {
  try {
    return marked.parse(text) as string;
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
  ts: number;
  toolName?: string;
  responseMs?: number;
}

interface HistoryMessage {
  role: string;
  text: string;
  toolName?: string;
  timestamp?: string;
  sessionId: string;
}

interface Props {
  events: WsEvent[];
  onSend: (msg: any) => void;
  connected: boolean;
  selectedAgent: string;
}

export function ChatPanel({ events, onSend, connected, selectedAgent }: Props) {
  const [input, setInput] = useState('');
  const [userMessages, setUserMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const lastUserSendTs = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    setHistory([]);
    setLoadingHistory(true);

    api.agentHistory(selectedAgent, 40).then((data: any) => {
      if (cancelled) return;
      const msgs: ChatMessage[] = (data.messages || []).map((m: HistoryMessage, i: number) => ({
        id: `hist-${i}`,
        role: m.role === 'user' ? 'user' : m.role === 'toolResult' ? 'toolResult' : 'assistant',
        agent: selectedAgent,
        text: m.text,
        done: true,
        ts: m.timestamp ? new Date(m.timestamp).getTime() : Date.now() - (data.messages.length - i) * 1000,
        toolName: m.toolName,
      }));
      setHistory(msgs);
    }).catch(() => {}).finally(() => {
      if (!cancelled) setLoadingHistory(false);
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
          ts: existing?.ts || ev.payload.message.timestamp || Date.now(),
          responseMs: responseMs || existing?.responseMs,
        });
      }

      if (ev.event === 'agent' && ev.payload.stream === 'lifecycle' && ev.payload.data?.phase === 'end') {
        const existing = byRun.get(runId);
        if (existing) existing.done = true;
      }
    }

    return Array.from(byRun.values()).sort((a, b) => b.ts - a.ts);
  }, [events, selectedAgent]);

  const allMessages = useMemo(() => {
    const filteredUser = userMessages.filter(m => m.agent === selectedAgent);
    return [...history, ...filteredUser, ...agentMessages].sort((a, b) => b.ts - a.ts);
  }, [history, userMessages, agentMessages, selectedAgent]);

  const isThinking = useMemo(() => {
    return agentMessages.some(m => m.role === 'assistant' && !m.done);
  }, [agentMessages]);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !connected) return;

    const text = input.trim();
    lastUserSendTs.current = Date.now();

    setUserMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      role: 'user',
      agent: selectedAgent,
      text,
      done: true,
      ts: Date.now(),
    }]);

    onSend({
      type: 'message',
      to: selectedAgent,
      content: text,
    });
    setInput('');
  };

  const meta = AGENT_MAP[selectedAgent];
  const agentName = meta?.name || selectedAgent;
  const agentEmoji = meta?.emoji || '?';

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
          {connected ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>

      <div className="chat-panel__messages">
        <div ref={topRef} />
        {isThinking && allMessages.every(m => m.done) && (
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
        {loadingHistory && (
          <div className="chat-panel__loading">Loading history...</div>
        )}
        {!loadingHistory && allMessages.length === 0 && (
          <div className="chat-panel__empty">
            <div className="chat-panel__empty-icon">{agentEmoji}</div>
            <div>No messages with {agentName} yet</div>
            <div className="chat-panel__empty-sub">Send a message to start a conversation</div>
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
              {!msg.done && <span className="chat-msg__thinking">thinking...</span>}
              {msg.toolName && <span className="chat-msg__tool">{msg.toolName}</span>}
              {msg.done && msg.responseMs && (
                <span className="chat-msg__time">{formatResponseTime(msg.responseMs)}</span>
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
