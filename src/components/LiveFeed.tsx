import React, { useState, useEffect, useRef, useCallback } from 'react';

interface LiveEvent {
  id: string;
  ts: string;
  agent: string;
  agentEmoji: string;
  model: string;
  tool: string;
  action: string;
  summary: string;
  file: string | null;
  status: string;
  durationMs: number | null;
  exitCode: number | null;
  cwd: string | null;
  detail: string | null;
  output: string | null;
}

const AGENTS = [
  { id: 'all', label: 'ALL' },
  { id: 'arya', label: 'Arya' },
  { id: 'koda', label: 'Koda' },
  { id: 'flux', label: 'Flux' },
  { id: 'atlas', label: 'Atlas' },
  { id: 'iris', label: 'Iris' },
  { id: 'sentinel', label: 'Sentinel' },
  { id: 'cipher', label: 'Cipher' },
  { id: 'lux', label: 'Lux' },
  { id: 'nexus', label: 'Nexus' },
  { id: 'prism', label: 'Prism' },
];

function actionColor(action: string, status: string): string {
  if (status === 'error' || (status === 'completed' && action === 'bash')) {
    // bash completed with exitCode != 0 handled in row
  }
  switch (action) {
    case 'write':
    case 'edit':
      return 'var(--neon-green)';
    case 'bash':
      return 'var(--neon-cyan)';
    case 'read':
      return 'var(--text-dim)';
    case 'grep':
    case 'glob':
      return '#ffaa00';
    default:
      return 'var(--neon-purple)';
  }
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function hasDetailData(ev: LiveEvent): boolean {
  return !!(ev.detail || ev.output);
}

function renderDetailContent(ev: LiveEvent): React.JSX.Element | null {
  if (!ev.detail && !ev.output) return null;

  const lines: React.JSX.Element[] = [];

  if (ev.action === 'edit' && ev.detail) {
    ev.detail.split('\n').forEach((line, i) => {
      let cls = '';
      if (line.startsWith('+ ')) cls = 'lf-detail-line-add';
      else if (line.startsWith('- ')) cls = 'lf-detail-line-del';
      lines.push(<div key={'d-' + i} className={cls}>{line}</div>);
    });
  } else if (ev.action === 'bash') {
    if (ev.detail) {
      ev.detail.split('\n').forEach((line, i) => {
        lines.push(<div key={'c-' + i} className="lf-detail-line-cmd">{'$ ' + line}</div>);
      });
    }
    if (ev.output) {
      ev.output.split('\n').forEach((line, i) => {
        lines.push(<div key={'o-' + i}>{line}</div>);
      });
    }
  } else {
    // write, read, grep, glob, etc.
    const text = ev.detail || ev.output || '';
    text.split('\n').forEach((line, i) => {
      lines.push(<div key={'t-' + i}>{line}</div>);
    });
  }

  return <>{lines}</>;
}

export function LiveFeed() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const [agentFilter, setAgentFilter] = useState('all');
  const [lastTs, setLastTs] = useState<string | null>(null);
  const [hasActivity, setHasActivity] = useState(false);
  const [lastEventTime, setLastEventTime] = useState(Date.now());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const feedRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleExpand = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const fetchEvents = useCallback(async () => {
    if (paused) return;
    try {
      let url = '/api/live-feed';
      const params: string[] = [];
      if (lastTs) params.push('since=' + encodeURIComponent(lastTs));
      if (agentFilter !== 'all') params.push('agent=' + agentFilter);
      if (params.length) url += '?' + params.join('&');

      const res = await fetch(url);
      if (!res.ok) return;
      const data: LiveEvent[] = await res.json();

      if (data.length > 0) {
        setHasActivity(true);
        setLastEventTime(Date.now());
        setEvents(prev => {
          const merged = [...prev, ...data];
          const seen = new Set<string>();
          const deduped = merged.filter(e => {
            if (seen.has(e.id)) return false;
            seen.add(e.id);
            return true;
          });
          return deduped.slice(-300);
        });
        setLastTs(data[data.length - 1].ts);
      }
    } catch {
      // silent
    }
  }, [paused, lastTs, agentFilter]);

  useEffect(() => {
    fetchEvents();
    intervalRef.current = setInterval(fetchEvents, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchEvents]);

  useEffect(() => {
    const check = setInterval(() => {
      if (Date.now() - lastEventTime > 30000) {
        setHasActivity(false);
      }
    }, 5000);
    return () => clearInterval(check);
  }, [lastEventTime]);

  useEffect(() => {
    if (!paused && feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [events, paused]);

  useEffect(() => {
    setEvents([]);
    setLastTs(null);
    setExpanded(new Set());
  }, [agentFilter]);

  const displayed = events;

  return (
    <div className="lf-page">
      <div className="lf-header">
        <div className="lf-header__left">
          <span className="glitch" style={{ fontSize: '1.1em', marginBottom: 0 }}>LIVE AGENT ACTIVITY</span>
          <span className={`lf-live-dot ${hasActivity ? 'lf-live-dot--active' : ''}`} />
          {hasActivity ? (
            <span className="lf-live-label">LIVE</span>
          ) : (
            <span className="lf-live-label lf-live-label--inactive">NO ACTIVE SESSIONS</span>
          )}
        </div>
        <div className="lf-header__right">
          <select
            className="lf-select"
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value)}
          >
            {AGENTS.map(a => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
          <button
            className={`lf-btn ${paused ? 'lf-btn--active' : ''}`}
            onClick={() => setPaused(p => !p)}
            title={paused ? 'Resume' : 'Pause'}
          >
            {paused ? '\u25B6' : '\u23F8'}
          </button>
        </div>
      </div>

      <div className="lf-feed" ref={feedRef}>
        {displayed.length === 0 && (
          <div className="lf-empty">
            {hasActivity ? 'Loading...' : 'No active agent sessions. Events will appear here when agents are working.'}
          </div>
        )}
        {[...displayed].reverse().map((ev, i) => {
          const isError = ev.status === 'error' || (ev.exitCode !== null && ev.exitCode !== 0);
          const color = isError ? '#ff4444' : actionColor(ev.action, ev.status);
          const expandable = hasDetailData(ev);
          const isExpanded = expanded.has(ev.id);
          const rowKey = ev.id + '-' + i;

          return (
            <div key={rowKey} className="lf-entry">
              <div
                className={'lf-row' + (expandable ? ' lf-row--expandable' : '')}
                style={{ animationDelay: Math.min(i * 0.02, 0.5) + 's' }}
                onClick={expandable ? () => toggleExpand(ev.id) : undefined}
              >
                <span className="lf-row__emoji">{ev.agentEmoji}</span>
                <span className="lf-row__agent">{ev.agent}</span>
                <span className="lf-row__time">{formatTime(ev.ts)}</span>
                <span className="lf-row__action" style={{ color }}>
                  {ev.action}
                </span>
                <span className="lf-row__summary" style={{ color: isError ? '#ff4444' : undefined }}>
                  {ev.summary}
                </span>
                {ev.durationMs !== null && (
                  <span className="lf-row__duration">
                    {ev.durationMs < 1000 ? ev.durationMs + 'ms' : (ev.durationMs / 1000).toFixed(1) + 's'}
                  </span>
                )}
                {isError && <span className="lf-row__error">ERR</span>}
                {expandable && (
                  <span className="lf-row__expand">{isExpanded ? '\u25BC' : '\u25B6'}</span>
                )}
              </div>
              {isExpanded && (
                <div className="lf-detail">
                  {renderDetailContent(ev)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
