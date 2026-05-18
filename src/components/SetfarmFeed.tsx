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
  repeatCount?: number;
  firstTs?: string;
  lastTs?: string;
}

// Wave 2 fix #16 (plan: reactive-frolicking-cupcake): story.failed, story.skipped,
// story.retry, step.skipped were all missing from this map. They were emitted by
// setfarm (see events.ts EventType) but rendered without color, so users couldn't
// visually distinguish a failed story from a successful one in the live feed.
const EVENT_COLORS: Record<string, string> = {
  'run.started': '#00ffff',
  'run.completed': '#00ff41',
  'run.failed': '#ff0040',
  'step.running': '#4488ff',
  'step.progress': '#a78bfa',
  'step.done': '#00ff41',
  'step.pending': '#666680',
  'step.timeout': '#ff6600',
  'step.failed': '#ff0040',
  'step.skipped': '#ffaa00',
  'story.started': '#8844ff',
  'story.done': '#44ff88',
  'story.verified': '#00ffff',
  'story.failed': '#ff0040',
  'story.skipped': '#ffaa00',
  'story.retry': '#ff6600',
  'story.conflict': '#ff00ff',
  'pipeline.advanced': '#666680',
};

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
}

function eventLabel(event: string): string {
  return (event || "").replace(".skipped", ".failed").replace('.', ' ').toUpperCase();
}

function visibleFeedText(value: string): string {
  return value
    .replace(/\bN\/A\b/gi, "Pending")
    .replace(/\bskipped\b/gi, "failed");
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
          if (e.storyTitle) detail = visibleFeedText(e.storyTitle);
          else if (e.detail) detail = visibleFeedText(e.detail);
          else if (e.stepId) detail = e.stepId;
          const title = [detail, e.repeatCount && e.repeatCount > 1 ? `Repeated ${e.repeatCount} times from ${e.firstTs || e.ts} to ${e.lastTs || e.ts}` : '']
            .filter(Boolean)
            .join('\n');

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
              {detail && <span className="af-feed__detail" title={title}>{detail}</span>}
              {e.repeatCount && e.repeatCount > 1 && (
                <span className="af-feed__repeat" title={title}>x{e.repeatCount}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
