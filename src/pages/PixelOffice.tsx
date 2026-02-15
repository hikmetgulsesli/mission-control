import { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { PixelOfficeEngine, OfficeAgentState } from '../lib/pixelOffice';
import { useWebSocket } from '../hooks/useWebSocket';
import { AGENT_MAP } from '../lib/constants';
import { api } from '../lib/api';

export function PixelOffice() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PixelOfficeEngine | null>(null);
  const prevStatesRef = useRef<Map<string, 'working' | 'idle'>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [chatOverlay, setChatOverlay] = useState<{ agent: string; text: string } | null>(null);

  // WebSocket for real-time chat bubbles
  const { messages: wsEvents } = useWebSocket();

  // Process WS events → chat bubbles
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
    }
  }, [wsEvents]);

  // Canvas click handler for chat bubbles
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

  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new PixelOfficeEngine(canvasRef.current);
    engineRef.current = engine;
    engine.start();

    let mounted = true;

    async function poll() {
      while (mounted) {
        try {
          const data = await api.officeStatus();
          if (mounted && data?.agents) {
            const agents = data.agents as OfficeAgentState[];

            // Handoff detection: compare prev states
            const prevStates = prevStatesRef.current;
            const newStates = new Map<string, 'working' | 'idle'>();
            for (const a of agents) newStates.set(a.id, a.status);

            if (prevStates.size > 0) {
              for (const [id, prev] of prevStates) {
                if (prev === 'working' && newStates.get(id) === 'idle') {
                  // Agent finished work — find who started
                  for (const [otherId, otherNew] of newStates) {
                    if (otherId !== id && prevStates.get(otherId) === 'idle' && otherNew === 'working') {
                      engine.triggerHandoff(id, otherId);
                      break;
                    }
                  }
                }
              }
            }
            prevStatesRef.current = newStates;

            engine.updateAgentStates(agents);
            setError(null);
          }
        } catch (err: any) {
          if (mounted) setError(err.message || 'Failed to fetch office status');
        }
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    poll();

    return () => {
      mounted = false;
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const agentInfo = chatOverlay ? AGENT_MAP[chatOverlay.agent] : null;

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
      {chatOverlay && (
        <div className="pixel-office__chat-overlay" onClick={() => setChatOverlay(null)}>
          <div className="pixel-office__chat-overlay-content" onClick={e => e.stopPropagation()}>
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
              dangerouslySetInnerHTML={{ __html: marked.parse(chatOverlay.text) as string }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
