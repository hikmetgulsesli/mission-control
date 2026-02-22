import { useState, useEffect, useRef } from 'react';

interface SetfarmEvent {
  ts: string;
  event: string;
  runId?: string;
  workflowId?: string;
  stepId?: string;
  agentId?: string;
  storyId?: string;
  storyTitle?: string;
  detail?: string;
}

const EVENT_COLORS: Record<string, string> = {
  'run.started': '#00ffff',
  'run.completed': '#00ff41',
  'run.failed': '#ff0040',
  'step.running': '#4488ff',
  'step.done': '#00ff41',
  'step.pending': '#666680',
  'step.timeout': '#ff6600',
  'step.failed': '#ff0040',
  'story.started': '#8844ff',
  'story.done': '#44ff88',
  'story.verified': '#00ffff',
  'pipeline.advanced': '#666680',
};

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString('tr-TR', { month: '2-digit', day: '2-digit' });
}

function eventLabel(event: string): string {
  return event.replace('.', ' ').toUpperCase();
}

export function SetfarmFeed({ events }: { events: SetfarmEvent[] }) {
  const [paused, setPaused] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!paused && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [events, paused]);

  if (!events || events.length === 0) {
    return <div className="af-empty">No events yet</div>;
  }

  return (
    <div className="af-feed">
      <div className="af-feed__controls">
        <button
          className={`af-feed__pause ${paused ? 'af-feed__pause--active' : ''}`}
          onClick={() => setPaused(!paused)}
        >
          {paused ? 'RESUME' : 'PAUSE'}
        </button>
        <span className="af-feed__count">{events.length} events</span>
      </div>
      <div className="af-feed__list" ref={listRef}>
        {events.map((e, i) => {
          const color = EVENT_COLORS[e.event] || '#666680';
          const agent = e.agentId?.split('/').pop();
          let detail = '';
          if (e.storyTitle) detail = e.storyTitle;
          else if (e.detail) detail = e.detail;
          else if (e.stepId) detail = e.stepId;

          return (
            <div key={`${e.ts}-${i}`} className="af-feed__item">
              <span className="af-feed__time">
                <span className="af-feed__date">{formatDate(e.ts)}</span>
                {formatTime(e.ts)}
              </span>
              {agent && <span className="af-feed__agent">{agent}</span>}
              <span className="af-feed__badge" style={{ color, borderColor: color + '44' }}>
                {eventLabel(e.event)}
              </span>
              {detail && <span className="af-feed__detail" title={detail}>{detail}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
