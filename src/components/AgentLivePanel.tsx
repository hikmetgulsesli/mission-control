import { useState, useEffect, useRef } from 'react';
import { AGENT_MAP } from '../lib/constants';

interface LiveData {
  status: 'working' | 'idle' | 'error';
  currentSession: {
    id: string;
    startedAt: string;
    lastEvent: string;
    recentOutput: string[];
    filesModified: string[];
    model: string;
  } | null;
  totalSessions: number;
}

interface Props {
  agentId: string;
  onClose: () => void;
}

function formatAgentName(id: string): string {
  const meta = AGENT_MAP[id];
  if (meta) return meta.name;
  return id.split('_').map(part =>
    part.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  ).join(' / ');
}

function getAgentEmoji(id: string): string {
  if (AGENT_MAP[id]) return AGENT_MAP[id].emoji;
  if (id.includes('planner')) return '\u{1F4CB}';
  if (id.includes('developer')) return '\u{1F4BB}';
  if (id.includes('verifier')) return '\u{2705}';
  if (id.includes('tester')) return '\u{1F9EA}';
  if (id.includes('reviewer')) return '\u{1F50D}';
  if (id.includes('setup')) return '\u{2699}\uFE0F';
  if (id.includes('fixer')) return '\u{1F527}';
  return '\u{1F916}';
}

export function AgentLivePanel({ agentId, onClose }: Props) {
  const [data, setData] = useState<LiveData | null>(null);
  const [tab, setTab] = useState<'output' | 'files' | 'info'>('output');
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const name = formatAgentName(agentId);
  const emoji = getAgentEmoji(agentId);

  useEffect(() => {
    let mounted = true;

    async function poll() {
      while (mounted) {
        try {
          const res = await fetch(`/api/agents/${agentId}/live`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          if (mounted) {
            setData(json);
            setError(null);
          }
        } catch (err: any) {
          if (mounted) setError(err.message);
        }
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    poll();
    return () => { mounted = false; };
  }, [agentId]);

  useEffect(() => {
    if (tab === 'output' && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [data?.currentSession?.recentOutput, tab]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const hasOutput = data?.currentSession?.recentOutput && data.currentSession.recentOutput.length > 0;

  return (
    <div className="live-panel-backdrop" onClick={onClose}>
      <div className="live-panel" onClick={e => e.stopPropagation()}>
        <div className="live-panel__header">
          <div className="live-panel__agent">
            <span>{emoji}</span>
            <span className="live-panel__name">{name}</span>
            {data && (
              <span className={`live-panel__status live-panel__status--${data.status}`}>
                {data.status}
              </span>
            )}
          </div>
          <button className="live-panel__close" onClick={onClose}>
            {'\u2715'}
          </button>
        </div>

        <div className="live-panel__tabs">
          <button
            className={`live-panel__tab ${tab === 'output' ? 'live-panel__tab--active' : ''}`}
            onClick={() => setTab('output')}
          >
            OUTPUT
          </button>
          <button
            className={`live-panel__tab ${tab === 'files' ? 'live-panel__tab--active' : ''}`}
            onClick={() => setTab('files')}
          >
            FILES
          </button>
          <button
            className={`live-panel__tab ${tab === 'info' ? 'live-panel__tab--active' : ''}`}
            onClick={() => setTab('info')}
          >
            INFO
          </button>
        </div>

        <div className="live-panel__body">
          {error && <div className="live-panel__error">{error}</div>}

          {!data && !error && <div className="live-panel__loading">Loading...</div>}

          {data && tab === 'output' && (
            <div className="live-panel__output" ref={outputRef}>
              {hasOutput ? (
                data.currentSession!.recentOutput.map((line, i) => (
                  <div key={i} className="live-panel__line">{line}</div>
                ))
              ) : (
                <div className="live-panel__empty">
                  {data.status === 'idle'
                    ? 'Agent is idle \u2014 no recent output'
                    : 'No output yet'}
                </div>
              )}
            </div>
          )}

          {data && tab === 'files' && (
            <div className="live-panel__files">
              {data.currentSession?.filesModified?.length ? (
                data.currentSession.filesModified.map((f, i) => (
                  <div key={i} className="live-panel__file">{f}</div>
                ))
              ) : (
                <div className="live-panel__empty">No files modified</div>
              )}
            </div>
          )}

          {data && tab === 'info' && (
            <div className="live-panel__info">
              <div className="live-panel__info-row">
                <span>Model</span>
                <span>{data.currentSession?.model || AGENT_MAP[agentId]?.model || 'unknown'}</span>
              </div>
              <div className="live-panel__info-row">
                <span>Role</span>
                <span>{AGENT_MAP[agentId]?.role || name}</span>
              </div>
              <div className="live-panel__info-row">
                <span>Status</span>
                <span className={`live-panel__status live-panel__status--${data.status}`}>{data.status}</span>
              </div>
              <div className="live-panel__info-row">
                <span>Total Sessions</span>
                <span>{data.totalSessions}</span>
              </div>
              {data.currentSession && (
                <>
                  <div className="live-panel__info-row">
                    <span>Session ID</span>
                    <span className="live-panel__mono">{data.currentSession.id.slice(0, 12)}</span>
                  </div>
                  <div className="live-panel__info-row">
                    <span>Started</span>
                    <span>{data.currentSession.startedAt}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
