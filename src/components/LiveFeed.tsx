import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

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
  project: string | null;
  category?: string;
  repeatCount?: number;
  firstTs?: string;
  lastTs?: string;
}

interface ProjectOption {
  id: string;
  label: string;
  status?: string | null;
}

const UUIDISH_PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;

function compactProjectLabel(id: string, label?: string | null, status?: string | null): string {
  const cleanId = String(id || '').trim();
  const cleanLabel = String(label || '').replace(/\s+/g, ' ').trim();
  const fullIdLabel = cleanLabel === cleanId || UUIDISH_PROJECT_ID.test(cleanLabel);
  const base = fullIdLabel || !cleanLabel
    ? `${cleanId.slice(0, 8)} - Setfarm run`
    : cleanLabel;
  const upperStatus = String(status || '').trim().toUpperCase();
  if (!upperStatus || base.toUpperCase().endsWith(` - ${upperStatus}`)) return base;
  return `${base} - ${upperStatus}`;
}

// Category classification definitions
const CATEGORY_DEFS: Record<string, { color: string; icon: string; patterns: RegExp[] }> = {
  PIPELINE: { color: '#00ffff', icon: '◆', patterns: [/setfarm|pipeline|step\.|story\.|run\.|supervisor|stitch|design preclaim/i] },
  DATABASE: { color: '#a855f7', icon: '\u{1F5C4}\uFE0F', patterns: [/CREATE|INSERT|UPDATE|DELETE|migration|prisma|drizzle|\.sql|postgres|sqlite/i] },
  UI: { color: '#3b82f6', icon: '\u{1F3A8}', patterns: [/\.tsx|\.css|component|styling|tailwind|font|style|scss|layout/i] },
  BUILD: { color: '#f59e0b', icon: '\u{1F528}', patterns: [/npm|build|vite|tsc|webpack|compile|bundle|esbuild/i] },
  TEST: { color: '#10b981', icon: '\u{1F9EA}', patterns: [/test|jest|vitest|playwright|spec|assert/i] },
  ERROR: { color: '#ff0040', icon: '\u274C', patterns: [/error|fail|crash|ENOENT|EACCES|EPERM|panic/i] },
  GIT: { color: '#ff6600', icon: '\u{1F4E6}', patterns: [/git |commit|push|pull|merge|branch|checkout|rebase/i] },
  API: { color: '#00ffff', icon: '\u{1F50C}', patterns: [/api\/|routes\/|fetch|curl|endpoint|express|router/i] },
};

function classifyCategory(ev: LiveEvent): string | null {
  // Use server-provided category if available
  if (ev.category) return ev.category;

  const text = `${ev.summary || ''} ${ev.file || ''} ${ev.detail || ''}`;
  for (const [catId, def] of Object.entries(CATEGORY_DEFS)) {
    if (def.patterns.some(p => p.test(text))) return catId;
  }
  return null;
}

// Phase grouping definitions
const PHASE_DEFINITIONS = [
  { id: 'PLANNING', label: 'PLANNING', color: '#a78bfa', steps: ['plan', 'design', 'stories'] },
  { id: 'BUILDING', label: 'BUILDING', color: '#4488ff', steps: ['setup-repo', 'setup-build', 'setup', 'implement'] },
  { id: 'QUALITY', label: 'QUALITY', color: '#f59e0b', steps: ['verify', 'security-gate', 'sec-gate', 'qa-test', 'final-test'] },
  { id: 'DEPLOY', label: 'DEPLOY', color: '#00ff41', steps: ['deploy'] },
] as const;

type PhaseId = typeof PHASE_DEFINITIONS[number]['id'];

function classifyEventPhase(ev: LiveEvent): PhaseId | 'OTHER' {
  const text = `${ev.summary || ''} ${ev.action || ''} ${ev.detail || ''}`.toLowerCase();
  for (const phase of PHASE_DEFINITIONS) {
    for (const step of phase.steps) {
      // Match step names in summary like "step:plan", "step: design", "[plan]", "plan step"
      if (
        text.includes(`step:${step}`) ||
        text.includes(`step: ${step}`) ||
        text.includes(`[${step}]`) ||
        text.includes(`${step} step`) ||
        text.includes(`step=${step}`) ||
        // Match step name at start of summary or surrounded by spaces/punctuation
        new RegExp(`\\b${step.replace('-', '[-\\s]?')}\\b`).test(text)
      ) {
        return phase.id;
      }
    }
  }
  return 'OTHER';
}

interface PhaseGroup {
  phase: typeof PHASE_DEFINITIONS[number] | { id: 'OTHER'; label: 'OTHER'; color: '#888888'; steps: string[] };
  events: LiveEvent[];
}

const AGENTS = [
  { id: 'all', label: 'ALL' },
  { id: 'planner', label: 'Planner' },
  { id: 'designer', label: 'Designer' },
  { id: 'developer', label: 'Developer' },
  { id: 'reviewer', label: 'Reviewer' },
  { id: 'supervisor', label: 'Supervisor' },
  { id: 'security-gate', label: 'Security Gate' },
  { id: 'qa-test', label: 'QA Test' },
  { id: 'final-test', label: 'Final Test' },
  { id: 'deployer', label: 'Deployer' },
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

const ACTION_TYPES = [
  { id: 'all', label: 'ALL TYPES' },
  { id: 'pipeline', label: 'PIPELINE' },
  { id: 'bash', label: 'BASH' },
  { id: 'write', label: 'WRITE' },
  { id: 'edit', label: 'EDIT' },
  { id: 'read', label: 'READ' },
  { id: 'grep', label: 'GREP' },
  { id: 'glob', label: 'GLOB' },
];

const STATUS_FILTERS = [
  { id: 'all', label: 'ALL STATUS' },
  { id: 'error', label: 'ERR ONLY' },
];

const TIME_RANGES = [
  { id: 'all', label: 'ALL TIME' },
  { id: '5m', label: 'LAST 5m' },
  { id: '15m', label: 'LAST 15m' },
  { id: '30m', label: 'LAST 30m' },
  { id: '1h', label: 'LAST 1h' },
  { id: '3h', label: 'LAST 3h' },
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

function visibleFeedText(value: string | null | undefined): string {
  return String(value || '')
    .replace(/\bN\/A\b/gi, 'Pending')
    .replace(/\bskipped\b/gi, 'failed');
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function hasRecentActivity(events: LiveEvent[]): boolean {
  const cutoff = Date.now() - 5 * 60 * 1000;
  return events.some((event) => {
    const ts = new Date(event.ts).getTime();
    return Number.isFinite(ts) && ts >= cutoff;
  });
}

function hasDetailData(ev: LiveEvent): boolean {
  return !!(ev.detail || ev.output);
}

function renderDetailContent(ev: LiveEvent): React.JSX.Element | null {
  if (!ev.detail && !ev.output) return null;

  const lines: React.JSX.Element[] = [];

  if (ev.action === 'edit' && ev.detail) {
    visibleFeedText(ev.detail).split('\n').forEach((line, i) => {
      let cls = '';
      if (line.startsWith('+ ')) cls = 'lf-detail-line-add';
      else if (line.startsWith('- ')) cls = 'lf-detail-line-del';
      lines.push(<div key={'d-' + i} className={cls}>{line}</div>);
    });
  } else if (ev.action === 'bash') {
    if (ev.detail) {
      visibleFeedText(ev.detail).split('\n').forEach((line, i) => {
        lines.push(<div key={'c-' + i} className="lf-detail-line-cmd">{'$ ' + line}</div>);
      });
    }
    if (ev.output) {
      visibleFeedText(ev.output).split('\n').forEach((line, i) => {
        lines.push(<div key={'o-' + i}>{line}</div>);
      });
    }
  } else {
    // write, read, grep, glob, etc.
    const text = visibleFeedText(ev.detail || ev.output || '');
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
  const [actionFilter, setActionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modelFilter, setModelFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('all');
  const [models, setModels] = useState<string[]>([]);
  const [lastTs, setLastTs] = useState<string | null>(null);
  const [hasActivity, setHasActivity] = useState(false);
  const [lastEventTime, setLastEventTime] = useState(Date.now());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [focusMode, setFocusMode] = useState(false);
  const [phaseGrouping, setPhaseGrouping] = useState(false);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
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

  const togglePhaseCollapse = useCallback((phaseId: string) => {
    setCollapsedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch available projects
  useEffect(() => {
    const normalizeProjects = (rows: unknown): ProjectOption[] => {
      if (!Array.isArray(rows)) return [];
      return rows
        .map((row) => {
          if (typeof row === 'string') return { id: row, label: compactProjectLabel(row) };
          const value = row as Partial<ProjectOption>;
          const id = String(value.id || '').trim();
          if (!id) return null;
          return { id, label: compactProjectLabel(id, value.label, value.status), status: value.status || null };
        })
        .filter(Boolean) as ProjectOption[];
    };
    fetch('/api/live-feed/projects?format=rich')
      .then(r => r.ok ? r.json() : [])
      .then(rows => setProjects(normalizeProjects(rows)))
      .catch(() => {});
    const iv = setInterval(() => {
      fetch('/api/live-feed/projects?format=rich')
        .then(r => r.ok ? r.json() : [])
        .then(rows => setProjects(normalizeProjects(rows)))
        .catch(() => {});
    }, 15000);
    return () => clearInterval(iv);
  }, []);

  const fetchEvents = useCallback(async () => {
    if (paused) return;
    try {
      // Always read from DB via /history endpoint
      let url = '/api/live-feed/history';
      const params: string[] = ['limit=300'];
      if (agentFilter !== 'all') params.push('agent=' + agentFilter);
      if (actionFilter !== 'all') params.push('action=' + actionFilter);
      if (statusFilter !== 'all') params.push('status=' + statusFilter);
      if (projectFilter !== 'all') params.push('project=' + encodeURIComponent(projectFilter));
      if (timeRange !== 'all') params.push('range=' + timeRange);
      if (debouncedSearch) params.push('q=' + encodeURIComponent(debouncedSearch));
      if (params.length) url += '?' + params.join('&');

      const res = await fetch(url);
      if (!res.ok) return;
      const data: LiveEvent[] = await res.json();

      if (data.length > 0) {
        const recent = hasRecentActivity(data);
        setHasActivity(recent);
        if (recent) setLastEventTime(Date.now());
        setEvents(prev => {
          const byId = new Map<string, LiveEvent>();
          for (const event of [...prev, ...data]) byId.set(event.id, event);
          return [...byId.values()]
            .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
            .slice(0, 300);
        });
        setLastTs(data[0]?.ts || data[data.length - 1].ts);
        // Extract unique models
        setModels(prev => {
          const all = new Set(prev);
          data.forEach((e: LiveEvent) => { if (e.model) all.add(e.model); });
          return [...all].sort();
        });
      }
    } catch {
      // silent
    }
  }, [paused, lastTs, agentFilter, actionFilter, statusFilter, projectFilter, timeRange, debouncedSearch]);

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
  }, [agentFilter, actionFilter, statusFilter, projectFilter, modelFilter, categoryFilter, timeRange, debouncedSearch]);

  // Determine the currently running step for focus mode
  const runningStep = useMemo(() => {
    if (!focusMode) return null;
    // Look through recent events to find the active step
    for (const ev of events) {
      const text = `${ev.summary || ''} ${ev.detail || ''}`.toLowerCase();
      const stepMatch = text.match(/step[=:\s]+([a-z][-a-z]*)/);
      if (stepMatch) return stepMatch[1];
    }
    return null;
  }, [events, focusMode]);

  const displayed = useMemo(() => {
    let result = (modelFilter === 'all' ? events : events.filter(e => e.model === modelFilter))
      .filter(e => !e.summary?.includes('step peek'));

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter(ev => classifyCategory(ev) === categoryFilter);
    }

    // Focus mode: only show events from the currently running step
    if (focusMode && runningStep) {
      result = result.filter(ev => {
        const text = `${ev.summary || ''} ${ev.action || ''} ${ev.detail || ''}`.toLowerCase();
        return text.includes(runningStep);
      });
    }

    return result;
  }, [events, modelFilter, categoryFilter, focusMode, runningStep]);

  const renderEventRow = useCallback((ev: LiveEvent, i: number) => {
    const visibleStatus = visibleFeedText(ev.status);
    const visibleAction = visibleFeedText(ev.action);
    const visibleSummary = visibleFeedText(ev.summary);
    const isError = visibleStatus === 'error' || (ev.exitCode !== null && ev.exitCode !== 0);
    const color = isError ? '#ff4444' : actionColor(visibleAction, visibleStatus);
    const expandable = hasDetailData(ev);
    const isExpanded = expanded.has(ev.id);
    const rowKey = ev.id + '-' + i;
    const cat = classifyCategory(ev);
    const catDef = cat ? CATEGORY_DEFS[cat] : null;

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
          {catDef && (
            <span
              className="lf-row__category"
              style={{
                fontSize: 9,
                padding: '1px 5px',
                borderRadius: 3,
                background: catDef.color + '18',
                color: catDef.color,
                border: `1px solid ${catDef.color}40`,
                letterSpacing: 0.5,
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
              title={cat || ''}
            >
              {catDef.icon} {cat}
            </span>
          )}
          <span className="lf-row__action" style={{ color }}>
            {visibleAction}
          </span>
          <span className="lf-row__summary" style={{ color: isError ? '#ff4444' : undefined }}>
            {visibleSummary}
          </span>
          {ev.repeatCount && ev.repeatCount > 1 && (
            <span className="lf-row__repeat" title={ev.firstTs && ev.lastTs ? `${ev.firstTs} - ${ev.lastTs}` : 'Repeated event'}>
              x{ev.repeatCount}
            </span>
          )}
          {ev.durationMs !== null && (
            <span className="lf-row__duration">
              {ev.durationMs < 1000 ? ev.durationMs + 'ms' : (ev.durationMs / 1000).toFixed(1) + 's'}
            </span>
          )}
          {ev.project && (
            <span className="lf-row__project" title={ev.project}>{ev.project}</span>
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
  }, [expanded, toggleExpand]);

  // Group events by phase (only used when phaseGrouping is active)
  const phaseGroups = useMemo((): PhaseGroup[] => {
    if (!phaseGrouping) return [];
    const groups = new Map<string, PhaseGroup>();
    // Initialize all phases in order
    for (const phase of PHASE_DEFINITIONS) {
      groups.set(phase.id, { phase, events: [] });
    }
    groups.set('OTHER', { phase: { id: 'OTHER', label: 'OTHER', color: '#888888', steps: [] }, events: [] });

    for (const ev of displayed) {
      const phaseId = classifyEventPhase(ev);
      groups.get(phaseId)!.events.push(ev);
    }

    // Return only non-empty groups
    return [...groups.values()].filter(g => g.events.length > 0);
  }, [displayed, phaseGrouping]);

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
          <input
            className="lf-search"
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search..."
            title="Search in commands, files, output"
          />
          <select
            className="lf-select lf-select--project"
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
            title="Filter by project"
          >
            <option value="all">ALL PROJECTS</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <select
            className="lf-select"
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value)}
            title="Filter by agent"
          >
            {AGENTS.map(a => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
          <select
            className="lf-select"
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            title="Filter by action type"
          >
            {ACTION_TYPES.map(a => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
          <select
            className={`lf-select ${statusFilter === 'error' ? 'lf-select--error' : ''}`}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            title="Filter by status"
          >
            {STATUS_FILTERS.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <select
            className="lf-select"
            value={modelFilter}
            onChange={e => setModelFilter(e.target.value)}
            title="Filter by model"
          >
            <option value="all">ALL MODELS</option>
            {models.map(m => (
              <option key={m} value={m}>{m.split('/').pop() || m}</option>
            ))}
          </select>
          <select
            className="lf-select"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            title="Filter by category"
          >
            <option value="all">ALL CATEGORIES</option>
            {Object.entries(CATEGORY_DEFS).map(([id, def]) => (
              <option key={id} value={id}>{def.icon} {id}</option>
            ))}
          </select>
          <select
            className="lf-select"
            value={timeRange}
            onChange={e => setTimeRange(e.target.value)}
            title="Filter by time range"
          >
            {TIME_RANGES.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <button
            className={`lf-btn ${phaseGrouping ? 'lf-btn--active' : ''}`}
            onClick={() => setPhaseGrouping(p => !p)}
            title={phaseGrouping ? 'Disable phase grouping' : 'Group by pipeline phase'}
            style={phaseGrouping ? { color: '#a78bfa', borderColor: '#a78bfa' } : undefined}
          >
            PHASES
          </button>
          <button
            className={`lf-btn ${focusMode ? 'lf-btn--active' : ''}`}
            onClick={() => setFocusMode(f => !f)}
            title={focusMode ? 'Show all events' : 'Focus on currently running step'}
            style={focusMode ? { color: '#00ff41', borderColor: '#00ff41' } : undefined}
          >
            FOCUS
          </button>
          <button
            className={`lf-btn ${paused ? 'lf-btn--active' : ''}`}
            onClick={() => setPaused(p => !p)}
            title={paused ? 'Resume' : 'Pause'}
          >
            {paused ? '\u25B6' : '\u23F8'}
          </button>
        </div>
      </div>

      {/* Focus mode indicator */}
      {focusMode && (
        <div className="lf-focus-bar">
          <span className="lf-focus-bar__icon">&#9673;</span>
          FOCUS MODE {runningStep ? `- Step: ${runningStep.toUpperCase()}` : '- No active step detected'}
        </div>
      )}

      <div className="lf-feed" ref={feedRef}>
        {displayed.length === 0 && (
          <div className="lf-empty">
            {focusMode && !runningStep
              ? 'Focus mode is active, but no running step was found. The feed will auto-filter when an active run starts.'
              : hasActivity
                ? 'Agents are active but only polling right now. New task activity will appear here.'
                : 'No active agent session. Events will appear here when agents start working.'}
          </div>
        )}

        {/* Phase-grouped rendering */}
        {phaseGrouping && phaseGroups.length > 0 && phaseGroups.map(group => {
          const isCollapsed = collapsedPhases.has(group.phase.id);
          return (
            <div key={group.phase.id} className="lf-phase-group">
              <div
                className="lf-phase-header"
                style={{ borderLeftColor: group.phase.color }}
                onClick={() => togglePhaseCollapse(group.phase.id)}
              >
                <span className="lf-phase-header__arrow">{isCollapsed ? '\u25B6' : '\u25BC'}</span>
                <span className="lf-phase-header__label" style={{ color: group.phase.color }}>
                  {group.phase.label}
                </span>
                <span className="lf-phase-header__count">{group.events.length} events</span>
              </div>
              {!isCollapsed && group.events.map((ev, i) => renderEventRow(ev, i))}
            </div>
          );
        })}

        {/* Flat list rendering (default) */}
        {!phaseGrouping && displayed.map((ev, i) => renderEventRow(ev, i))}
      </div>
    </div>
  );
}
