import { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { PixelOfficeEngine, OfficeAgentState } from '../lib/pixelOffice';
import { useWebSocket } from '../hooks/useWebSocket';
import { AGENT_MAP } from '../lib/constants';
import { api } from '../lib/api';
import { formatDistanceToNow } from 'date-fns';

// Format workflow agent IDs: "bug-fix_investigator" -> "Bug Fix / Investigator"
function formatAgentId(id: string): { name: string; emoji: string } {
  const meta = AGENT_MAP[id];
  if (meta) return { name: meta.name, emoji: meta.emoji };
  const name = id.split('_').map(part =>
    part.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  ).join(' / ');
  let emoji = '\u{1F916}';
  if (id.includes('planner')) emoji = '\u{1F4CB}';
  else if (id.includes('developer') || id.includes('fixer')) emoji = '\u{1F4BB}';
  else if (id.includes('verifier')) emoji = '\u2705';
  else if (id.includes('tester')) emoji = '\u{1F9EA}';
  else if (id.includes('reviewer')) emoji = '\u{1F50D}';
  else if (id.includes('setup')) emoji = '\u2699\uFE0F';
  else if (id.includes('investigator')) emoji = '\u{1F575}';
  else if (id.includes('triager') || id.includes('triage')) emoji = '\u{1F4CA}';
  else if (id.includes('scan')) emoji = '\u{1F50E}';
  return { name, emoji };
}

function sanitizeMarkdown(text: string): { __html: string } {
  // Content comes from our own agent WebSocket responses (trusted internal source)
  // DOMPurify sanitization provides defense-in-depth
  return { __html: DOMPurify.sanitize(marked.parse(text) as string) };
}

interface Props {
  visible: boolean;
}

export function PixelOffice({ visible }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PixelOfficeEngine | null>(null);
  const prevStatesRef = useRef<Map<string, 'working' | 'idle'>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [chatOverlay, setChatOverlay] = useState<{ agent: string; text: string } | null>(null);
  const [agentStates, setAgentStates] = useState<OfficeAgentState[]>([]);
  const [recentEvents, setRecentEvents] = useState<{ agent: string; text: string; time: number }[]>([]);

  const { messages: wsEvents } = useWebSocket();

  // Create engine once, persist across navigations
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new PixelOfficeEngine(canvasRef.current);
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Pause/resume engine based on visibility
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (visible) {
      engine.start();
    } else {
      engine.stop();
    }
  }, [visible]);

  // Poll office status (only when visible), using setInterval instead of while loop
  useEffect(() => {
    if (!visible) return;

    let mounted = true;

    async function poll() {
      try {
        const data = await api.officeStatus();
        if (!mounted || !data?.agents) return;

        const agents = data.agents as OfficeAgentState[];
        setAgentStates(agents);

        // Handoff detection
        const prevStates = prevStatesRef.current;
        const newStates = new Map<string, 'working' | 'idle'>();
        for (const a of agents) newStates.set(a.id, a.status);

        if (prevStates.size > 0) {
          for (const [id, prev] of prevStates) {
            if (prev === 'working' && newStates.get(id) === 'idle') {
              for (const [otherId, otherNew] of newStates) {
                if (otherId !== id && prevStates.get(otherId) === 'idle' && otherNew === 'working') {
                  engineRef.current?.triggerHandoff(id, otherId);
                  break;
                }
              }
            }
          }
        }
        prevStatesRef.current = newStates;

        engineRef.current?.updateAgentStates(agents);
        setError(null);
      } catch (err: any) {
        if (mounted) setError(err.message || 'Failed to fetch office status');
      }
    }

    poll();
    const id = setInterval(poll, 5000);
    return () => { mounted = false; clearInterval(id); };
  }, [visible]);

  // Process WS events -> chat bubbles + activity feed
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    for (const ev of wsEvents) {
      if (ev.event !== 'chat') continue;
      const payload = ev.payload;
      if (!payload) continue;
      if (payload.state !== 'delta' && payload.state !== 'final') continue;
      if (payload.message?.role === 'user') continue;

      const sessionKey: string = payload.sessionKey || '';
      const agentId = sessionKey.split(':')?.[1] || '';
      if (!agentId) continue;

      const content = payload.message?.content;
      if (!content) continue;
      const text = (Array.isArray(content) ? content : [content])
        .map((c: any) => c.text || (typeof c === 'string' ? c : '')).join('');
      if (!text) continue;

      const done = payload.state === 'final';
      engine.updateChatBubble(agentId, text, done);

      if (done && text.length > 10 && !text.startsWith('HEARTBEAT') && text !== 'HEARTBEAT_OK') {
        setRecentEvents(prev => [
          { agent: agentId, text: text.slice(0, 80), time: Date.now() },
          ...prev.slice(0, 9),
        ]);
      }
    }
  }, [wsEvents]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!engine || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = 1100 / rect.width;
    const scaleY = 720 / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const bubble = engine.getChatBubbleAt(x, y);
    if (bubble) {
      setChatOverlay({ agent: bubble.agentId, text: bubble.text });
    }
  };

  const agentInfo = chatOverlay ? AGENT_MAP[chatOverlay.agent] : null;
  const workingAgents = agentStates.filter(a => a.status === 'working');
  const idleAgents = agentStates.filter(a => a.status === 'idle');

  return (
    <div className="pixel-office">
      <div className="pixel-office__canvas-wrap">
        <canvas
          ref={canvasRef}
          className="pixel-office__canvas"
          onClick={handleCanvasClick}
        />
      </div>
      {error && (
        <div className="pixel-office__error">
          <span className="pixel-office__error-icon">!</span> {error}
        </div>
      )}

      <div className="office-info">
        <div className="office-info__col">
          <h4 className="office-info__title">WORKING ({workingAgents.length})</h4>
          {workingAgents.map(a => {
            const meta = AGENT_MAP[a.id];
            return (
              <div key={a.id} className="office-info__agent office-info__agent--working">
                <span>{meta?.emoji || '?'}</span>
                <span>{meta?.name || a.id}</span>
                <span className="office-info__task">{a.activity}</span>
              </div>
            );
          })}
          {workingAgents.length === 0 && <div className="office-info__empty">All idle</div>}
        </div>

        <div className="office-info__col">
          <h4 className="office-info__title">IDLE ({idleAgents.length})</h4>
          {idleAgents.map(a => {
            const meta = AGENT_MAP[a.id];
            return (
              <div key={a.id} className="office-info__agent">
                <span>{meta?.emoji || '?'}</span>
                <span>{meta?.name || a.id}</span>
              </div>
            );
          })}
        </div>

        <div className="office-info__col office-info__col--wide">
          <h4 className="office-info__title">RECENT ACTIVITY</h4>
          {recentEvents.length === 0 ? (
            <div className="office-info__empty">No recent activity</div>
          ) : (
            recentEvents.slice(0, 5).map((ev, i) => {
              const info = formatAgentId(ev.agent);
              return (
                <div key={i} className="office-info__event">
                  <span className="office-info__event-agent">{info.emoji} {info.name}</span>
                  <span className="office-info__event-text">{ev.text}</span>
                  <span className="office-info__event-time">
                    {formatDistanceToNow(ev.time, { addSuffix: true })}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {chatOverlay && (
        <div className="pixel-office__chat-overlay" onClick={() => setChatOverlay(null)}>
          <div className="pixel-office__chat-overlay-content" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div className="pixel-office__chat-overlay-header">
              {agentInfo ? `${agentInfo.emoji} ${agentInfo.name}` : chatOverlay.agent}
              <button
                className="pixel-office__chat-overlay-close"
                onClick={() => setChatOverlay(null)}
              >
                x
              </button>
            </div>
            <div
              className="pixel-office__chat-overlay-body"
              dangerouslySetInnerHTML={sanitizeMarkdown(chatOverlay.text)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
