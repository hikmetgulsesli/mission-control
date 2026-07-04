import { Router } from 'express';
// import Database from 'better-sqlite3'; // Phase 7: SQLite removed
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import pgSql from '../utils/pg.js';
import { PATHS } from '../config.js';
import { getSetfarmActivity } from '../utils/setfarm.js';

const router = Router();

// Phase 7: PG-only backend

// Agent name/emoji mapping
const AGENT_MAP: Record<string, { name: string; emoji: string }> = {
  main:     { name: 'Arya',     emoji: '\u{1F99E}' },
  koda:     { name: 'Koda',     emoji: '\u{1F916}' },
  kaan:     { name: 'Flux',     emoji: '\u26A1' },
  flux:     { name: 'Flux',     emoji: '\u26A1' },
  atlas:    { name: 'Atlas',    emoji: '\u{1F30D}' },
  defne:    { name: 'Iris',     emoji: '\u{1F50D}' },
  iris:     { name: 'Iris',     emoji: '\u{1F50D}' },
  sinan:    { name: 'Sentinel', emoji: '\u{1F6E1}\uFE0F' },
  sentinel: { name: 'Sentinel', emoji: '\u{1F6E1}\uFE0F' },
  elif:     { name: 'Cipher',   emoji: '\u{1F4BB}' },
  cipher:   { name: 'Cipher',   emoji: '\u{1F4BB}' },
  deniz:    { name: 'Lux',      emoji: '\u270D\uFE0F' },
  lux:      { name: 'Lux',      emoji: '\u270D\uFE0F' },
  onur:     { name: 'Nexus',    emoji: '\u{1F504}' },
  nexus:    { name: 'Nexus',    emoji: '\u{1F504}' },
  mert:     { name: 'Prism',    emoji: '\u{1F3A8}' },
  prism:    { name: 'Prism',    emoji: '\u{1F3A8}' },
};

// Known agent folder names (skip workflow-specific agents)
const KNOWN_AGENTS = new Set(Object.keys(AGENT_MAP));

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
  projectLabel?: string | null;
  category: string | null;
  repeatCount?: number;
  firstTs?: string;
  lastTs?: string;
}

interface LiveProjectOption {
  id: string;
  label: string;
  status?: string | null;
}

const UUIDISH_PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
const UUIDISH_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractProjectDisplayName(task: unknown, fallbackId: string): string {
  const compactTask = String(task || '').replace(/\s+/g, ' ').trim();
  if (!compactTask) return UUIDISH_PROJECT_ID.test(fallbackId) ? 'Setfarm run' : fallbackId;
  const nameMatch = compactTask.match(/\bcalled\s+([^.]+?)(?:\.|\s+It\b|$)/i);
  return (nameMatch?.[1] || compactTask).slice(0, 52);
}

function formatProjectOption(id: string, run?: any): LiveProjectOption {
  const shortId = id.slice(0, 8);
  if (!run) {
    return { id, label: UUIDISH_PROJECT_ID.test(id) ? `${shortId} - Setfarm run` : id };
  }
  const status = String(run.status || '').toUpperCase();
  const displayName = extractProjectDisplayName(run.task, id);
  return {
    id,
    status,
    label: `${shortId} - ${displayName}${status ? ` - ${status}` : ''}`,
  };
}

// Category classification — matches client-side CATEGORY_DEFS
const CATEGORY_PATTERNS: { id: string; patterns: RegExp[] }[] = [
  { id: 'PIPELINE', patterns: [/setfarm|pipeline|step\.|story\.|run\.|supervisor|stitch|design preclaim/i] },
  { id: 'DATABASE', patterns: [/CREATE|INSERT|UPDATE|DELETE|migration|prisma|drizzle|\.sql|postgres|sqlite/i] },
  { id: 'UI', patterns: [/\.tsx|\.css|component|styling|tailwind|font|style|scss|layout/i] },
  { id: 'BUILD', patterns: [/npm|build|vite|tsc|webpack|compile|bundle|esbuild/i] },
  { id: 'TEST', patterns: [/test|jest|vitest|playwright|spec|assert/i] },
  { id: 'ERROR', patterns: [/error|fail|crash|ENOENT|EACCES|EPERM|panic/i] },
  { id: 'GIT', patterns: [/git |commit|push|pull|merge|branch|checkout|rebase/i] },
  { id: 'API', patterns: [/api\/|routes\/|fetch|curl|endpoint|express|router/i] },
];

function classifyCategory(summary: string | null, file: string | null, detail: string | null): string | null {
  const text = `${summary || ''} ${file || ''} ${detail || ''}`;
  for (const cat of CATEGORY_PATTERNS) {
    if (cat.patterns.some(p => p.test(text))) return cat.id;
  }
  return null;
}

function normalizeSetfarmAgent(raw: unknown): string {
  const value = String(raw || 'setfarm')
    .replace(/^feature-dev_/, '')
    .replace(/_/g, '-')
    .trim()
    .toLowerCase();
  return value || 'setfarm';
}

function setfarmEventStatus(eventName: string, detail: string): string {
  const text = `${eventName} ${detail}`;
  if (/(\.pass|\.done|^step\.done$|^story\.done$|^run\.completed$)/i.test(eventName)) return 'completed';
  if (/^(story\.retry|step\.failed|run\.failed|step\.timeout)$/i.test(eventName)) return 'error';
  if (/deploy/i.test(text) && /deployment infrastructure is unavailable|DEPLOY_CAPABILITY:\s*unavailable|no SETFARM_DEPLOY_HOST|deploy_host context is configured/i.test(text)) return 'completed';
  if (/(failed|failure|unavailable|blocked|\bblock\b|exhausted|error|PR_REVIEW_COMMENTS_OPEN|unresolved[\s\S]{0,120}review\s+thread|actionable[\s\S]{0,120}review\s+comments)/i.test(text)) return 'error';
  if (/(running|started|pending|progress|retry)/i.test(text)) return 'running';
  return 'completed';
}

function compactPipelineSummary(eventName: string, stepId: string, detail: string, repeatCount?: number): string {
  const prefix = stepId ? `${stepId}: ` : '';
  const repeat = repeatCount && repeatCount > 1 ? ` x${repeatCount}` : '';
  const source = detail || eventName;
  return `${prefix}${source}${repeat}`.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function stripRepeatSuffix(text: string | null | undefined): string {
  return String(text || '').replace(/\s+x\d+$/i, '').replace(/\s+/g, ' ').trim();
}

function coalescibleLiveEventKey(event: LiveEvent): string | null {
  const isSetfarm = event.tool === 'setfarm' || event.model === 'setfarm';
  if (!isSetfarm || event.action !== 'pipeline' || event.status === 'error') return null;
  const text = `${event.summary || ''} ${event.detail || ''}`.toLowerCase();
  const isProgress =
    text.includes('step.progress') ||
    text.includes('design preclaim') ||
    text.includes('still generating stitch screens') ||
    text.includes('generating stitch screens') ||
    text.includes('downloading stitch html files') ||
    text.includes('step.running');
  if (!isProgress) return null;
  return [
    event.project || '',
    event.agent || '',
    event.action || '',
    stripRepeatSuffix(event.summary),
    stripRepeatSuffix(event.detail),
  ].join('|');
}

function coalesceLiveEvents(events: LiveEvent[]): LiveEvent[] {
  const byKey = new Map<string, LiveEvent>();
  const passthrough: LiveEvent[] = [];

  for (const event of events) {
    const key = coalescibleLiveEventKey(event);
    if (!key) {
      passthrough.push(event);
      continue;
    }

    const count = Math.max(1, Number(event.repeatCount || 1));
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        ...event,
        summary: stripRepeatSuffix(event.summary),
        detail: event.detail ? stripRepeatSuffix(event.detail) : event.detail,
        repeatCount: count,
        firstTs: event.firstTs || event.ts,
        lastTs: event.lastTs || event.ts,
      });
      continue;
    }

    const existingTs = new Date(existing.ts).getTime();
    const currentTs = new Date(event.ts).getTime();
    const firstTs = new Date(existing.firstTs || existing.ts).getTime() <= new Date(event.firstTs || event.ts).getTime()
      ? (existing.firstTs || existing.ts)
      : (event.firstTs || event.ts);
    const lastTs = new Date(existing.lastTs || existing.ts).getTime() >= new Date(event.lastTs || event.ts).getTime()
      ? (existing.lastTs || existing.ts)
      : (event.lastTs || event.ts);
    byKey.set(key, {
      ...(currentTs >= existingTs ? event : existing),
      summary: stripRepeatSuffix(event.summary || existing.summary),
      detail: event.detail ? stripRepeatSuffix(event.detail) : existing.detail,
      repeatCount: Math.max(1, Number(existing.repeatCount || 1)) + count,
      firstTs,
      lastTs,
      ts: currentTs >= existingTs ? event.ts : existing.ts,
    });
  }

  return [...passthrough, ...byKey.values()]
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
}

async function enrichProjectLabels(events: LiveEvent[]): Promise<LiveEvent[]> {
  const runIds = [...new Set(events.map((event) => String(event.project || '').trim()).filter((id) => UUIDISH_ID.test(id)))];
  if (runIds.length === 0) return events;
  try {
    const rows = await pgSql.unsafe(
      'SELECT id, workflow_id, task, status, created_at FROM runs WHERE id = ANY($1::text[])',
      [runIds],
    );
    const runMap = new Map((rows as any[]).map((run) => [String(run.id), run]));
    return events.map((event) => {
      if (!event.project || !UUIDISH_ID.test(event.project)) return event;
      return { ...event, projectLabel: formatProjectOption(event.project, runMap.get(event.project)).label };
    });
  } catch (err: any) {
    console.error('[live-feed] Project label enrichment failed:', err.message);
    return events;
  }
}

function stepLookupKey(runId: unknown, stepId: unknown): string | null {
  const run = String(runId || '').trim();
  const step = String(stepId || '').trim();
  if (!run || !UUIDISH_ID.test(step)) return null;
  return `${run}:${step}`;
}

function parseSummaryStepPrefix(summary: unknown): string | null {
  const match = String(summary || '').trim().match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):\s*/i);
  return match?.[1] || null;
}

function collectSetfarmStepCandidates(records: any[]): Array<{ runId: string; stepId: string }> {
  const seen = new Set<string>();
  const candidates: Array<{ runId: string; stepId: string }> = [];
  for (const record of records) {
    const runId = String(record?.runId || record?.project || '').trim();
    if (!runId) continue;
    const possibleStepIds = [
      record?.stepId,
      record?.agent,
      parseSummaryStepPrefix(record?.summary),
    ];
    for (const possible of possibleStepIds) {
      const key = stepLookupKey(runId, possible);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      candidates.push({ runId, stepId: String(possible).trim() });
    }
  }
  return candidates;
}

async function resolveSetfarmStepNames(records: any[]): Promise<Map<string, string>> {
  const candidates = collectSetfarmStepCandidates(records);
  if (candidates.length === 0) return new Map();

  const runIds = [...new Set(candidates.map((candidate) => candidate.runId))];
    const stepIds = [...new Set(candidates.map((candidate) => candidate.stepId))];
  try {
    const rows = await pgSql.unsafe(
      'SELECT run_id, id, step_id FROM steps WHERE run_id = ANY($1::text[]) AND id = ANY($2::text[])',
      [runIds, stepIds],
    );
    const entries: Array<[string, string]> = [];
    for (const row of rows as any[]) {
      const stepId = String(row.step_id || '').trim();
      if (stepId) entries.push([`${String(row.run_id)}:${String(row.id)}`, stepId]);
    }
    return new Map(entries);
  } catch (err: any) {
    console.error('[live-feed] Step name resolution failed:', err.message);
    return new Map();
  }
}

function resolveStepIdForDisplay(runId: unknown, rawStepId: unknown, stepNameByInternal: Map<string, string>): string {
  const stepId = String(rawStepId || '').trim();
  const lookupKey = stepLookupKey(runId, stepId);
  return (lookupKey && stepNameByInternal.get(lookupKey)) || stepId;
}

function replaceStepPrefix(text: string | null | undefined, runId: unknown, stepNameByInternal: Map<string, string>): string | null {
  if (!text) return text || null;
  const rawStepId = parseSummaryStepPrefix(text);
  if (!rawStepId) return text;
  const stepId = resolveStepIdForDisplay(runId, rawStepId, stepNameByInternal);
  if (stepId === rawStepId) return text;
  return text.replace(rawStepId, stepId);
}

function mapSetfarmEvent(event: any, stepNameByInternal: Map<string, string> = new Map()): LiveEvent {
  const eventName = String(event?.event || event?.action || 'setfarm.event');
  const project = String(event?.runId || '').trim() || null;
  const stepId = resolveStepIdForDisplay(project, event?.stepId, stepNameByInternal);
  const storyId = String(event?.storyId || '').trim();
  const detail = String(event?.detail || event?.storyTitle || '').trim();
  const repeatCount = Number(event?.repeatCount || 0) || undefined;
  const status = setfarmEventStatus(eventName, detail);
  const agent = normalizeSetfarmAgent(event?.agentId || stepId || 'setfarm');
  const idParts = [
    'setfarm',
    event?.runId || 'run',
    eventName,
    stepId,
    storyId,
    detail.slice(0, 120),
  ];
  return {
    id: idParts.join(':'),
    ts: String(event?.lastTs || event?.ts || new Date().toISOString()),
    agent,
    agentEmoji: '◆',
    model: 'setfarm',
    tool: 'setfarm',
    action: 'pipeline',
    summary: compactPipelineSummary(eventName, stepId, detail, repeatCount),
    file: null,
    status,
    durationMs: null,
    exitCode: status === 'error' ? 1 : null,
    cwd: null,
    detail: detail || eventName,
    output: event?.storyTitle ? String(event.storyTitle) : null,
    project,
    category: 'PIPELINE',
    ...(repeatCount && repeatCount > 1 ? {
      repeatCount,
      firstTs: String(event?.firstTs || event?.ts || ''),
      lastTs: String(event?.lastTs || event?.ts || ''),
    } : {}),
  };
}

function applyEventQueryFilters(events: LiveEvent[], query: Record<string, any>): LiveEvent[] {
  let filtered = events;
  const project = query.project as string;
  const agent = query.agent as string;
  const action = query.action as string;
  const since = query.since as string;
  const until = query.until as string;
  const status = query.status as string;
  const range = query.range as string;
  const q = query.q as string;

  if (project) filtered = filtered.filter((e) => e.project === project);
  if (agent) filtered = filtered.filter((e) => e.agent === agent.toLowerCase());
  if (action) filtered = filtered.filter((e) => e.action === action.toLowerCase());
  if (since) {
    const sinceMs = new Date(since).getTime();
    if (!Number.isNaN(sinceMs)) filtered = filtered.filter((e) => new Date(e.ts).getTime() > sinceMs);
  }
  if (until) {
    const untilMs = new Date(until).getTime();
    if (!Number.isNaN(untilMs)) filtered = filtered.filter((e) => new Date(e.ts).getTime() < untilMs);
  }
  if (range && range !== 'all') {
    const rangeMs: Record<string, number> = { '5m': 5*60e3, '15m': 15*60e3, '30m': 30*60e3, '1h': 60*60e3, '3h': 3*60*60e3 };
    const cutoff = Date.now() - (rangeMs[range] || 60*60e3);
    filtered = filtered.filter((e) => new Date(e.ts).getTime() > cutoff);
  }
  if (status === 'error') {
    filtered = filtered.filter((e) => e.status === 'error' || (e.exitCode !== null && e.exitCode !== 0));
  }
  if (q) {
    const needle = q.toLowerCase();
    filtered = filtered.filter((e) => `${e.summary || ''} ${e.detail || ''} ${e.output || ''} ${e.file || ''}`.toLowerCase().includes(needle));
  }

  return filtered;
}

async function getSetfarmLiveEvents(limit: number, query: Record<string, any> = {}): Promise<LiveEvent[]> {
  const raw = await getSetfarmActivity(Math.min(Math.max(limit, 50), 300));
  const stepNameByInternal = await resolveSetfarmStepNames(raw);
  return applyEventQueryFilters(raw.map((event) => mapSetfarmEvent(event, stepNameByInternal)), query);
}

function normalizePersistedSetfarmEvent(event: LiveEvent, stepNameByInternal: Map<string, string>): LiveEvent {
  if (event.tool !== 'setfarm' && event.model !== 'setfarm') return event;
  const stepId = resolveStepIdForDisplay(event.project, event.agent, stepNameByInternal);
  const summary = replaceStepPrefix(event.summary, event.project, stepNameByInternal);
  const detail = replaceStepPrefix(event.detail, event.project, stepNameByInternal);
  const agent = stepId === event.agent ? event.agent : normalizeSetfarmAgent(stepId);
  return { ...event, agent, summary: summary || event.summary, detail: detail || event.detail };
}


// SQLite persistence removed (Phase 7: PG-only)

// ── PostgreSQL persistence ──

async function pgEnsureTable(): Promise<void> {
  await pgSql`
    CREATE TABLE IF NOT EXISTS live_events (
      id TEXT PRIMARY KEY,
      ts TIMESTAMPTZ NOT NULL,
      agent TEXT NOT NULL,
      model TEXT,
      tool TEXT,
      action TEXT NOT NULL,
      summary TEXT,
      file TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      duration_ms INTEGER,
      exit_code INTEGER,
      cwd TEXT,
      project TEXT,
      detail TEXT,
      output TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await pgSql`CREATE INDEX IF NOT EXISTS idx_live_events_ts ON live_events(ts)`;
  await pgSql`CREATE INDEX IF NOT EXISTS idx_live_events_status ON live_events(status)`;
  await pgSql`CREATE INDEX IF NOT EXISTS idx_live_events_project ON live_events(project)`;
  await pgSql`CREATE INDEX IF NOT EXISTS idx_live_events_agent ON live_events(agent)`;
  await pgSql`CREATE INDEX IF NOT EXISTS idx_live_events_action ON live_events(action)`;
  await pgSql`CREATE INDEX IF NOT EXISTS idx_live_events_error ON live_events(exit_code) WHERE exit_code IS NOT NULL AND exit_code != 0`;
}

let pgReady = false;
async function ensurePgReady(): Promise<void> {
  if (pgReady) return;
  await pgEnsureTable();
  pgReady = true;
}

async function pgPersistEvents(events: LiveEvent[]): Promise<void> {
  if (events.length === 0) return;
  await ensurePgReady();
  // Use pgSql.begin with type assertion — TransactionSql loses call signatures due to Omit<>
  await pgSql.begin(async (tx: any) => {
    for (const e of events) {
      await tx`
        INSERT INTO live_events (id, ts, agent, model, tool, action, summary, file, status, duration_ms, exit_code, cwd, project, detail, output)
        VALUES (${e.id}, ${e.ts}, ${e.agent}, ${e.model || null}, ${e.tool || null}, ${e.action}, ${e.summary || null}, ${e.file}, ${e.status}, ${e.durationMs}, ${e.exitCode}, ${e.cwd}, ${e.project}, ${e.detail}, ${e.output})
        ON CONFLICT (id) DO NOTHING
      `;
    }
  });
}

async function persistEvents(events: LiveEvent[]): Promise<void> {
  // Filter out step peek/claim noise — these are polling heartbeats, not real work
  events = events.filter(e => {
    if (e.action === 'bash' && e.summary) {
      const s = e.summary.toLowerCase();
      if (s.includes('step peek') || s.includes('step claim') || s.includes('heartbeat')) return false;
    }
    return true;
  });
  if (events.length === 0) return;
  try {
    await pgPersistEvents(events);
  } catch (err: any) {
    console.error('[live-feed-db] Persist error:', err.message);
  }
}

// Cleanup events older than 30 days (runs once on startup)
ensurePgReady().then(async () => {
  try {
    await pgSql`DELETE FROM live_events WHERE ts < NOW() - INTERVAL '30 days'`;
  } catch {}
}).catch(() => {});

// Background scanner — keeps DB populated even when no client is viewing live feed
setInterval(async () => {
  try {
    const events = scanSessions();
    await persistEvents(events);
  } catch (err: any) {
    console.error('[live-feed-db] Background scan error:', err.message);
  }
}, 5000);

// Cache
let feedCache: { data: LiveEvent[]; ts: number } = { data: [], ts: 0 };
const CACHE_TTL_MS = 3000;

function normalizeAction(toolName: string): string {
  const name = toolName.toLowerCase();
  if (name === 'exec' || name === 'bash' || name === 'shell') return 'bash';
  if (name === 'write_file' || name === 'write' || name === 'create_file') return 'write';
  if (name === 'edit_file' || name === 'edit' || name === 'str_replace_editor') return 'edit';
  if (name === 'read_file' || name === 'read' || name === 'view_file') return 'read';
  if (name === 'grep' || name === 'search' || name === 'ripgrep') return 'grep';
  if (name === 'glob' || name === 'find_files') return 'glob';
  return name;
}

function extractSummary(toolName: string, args: any): { summary: string; file: string | null } {
  const action = normalizeAction(toolName);
  try {
    const parsed = typeof args === 'string' ? JSON.parse(args) : args;
    switch (action) {
      case 'bash': {
        const cmd = parsed?.command || parsed?.cmd || '';
        return { summary: cmd.slice(0, 80), file: null };
      }
      case 'write':
      case 'edit': {
        const f = parsed?.file_path || parsed?.path || parsed?.filePath || '';
        const short = f.split('/').slice(-2).join('/');
        return { summary: `${action} ${short}`, file: f };
      }
      case 'read': {
        const f = parsed?.file_path || parsed?.path || parsed?.filePath || '';
        const short = f.split('/').slice(-2).join('/');
        return { summary: `read ${short}`, file: f };
      }
      case 'grep': {
        const pattern = parsed?.pattern || parsed?.regex || '';
        return { summary: `grep ${pattern.slice(0, 60)}`, file: null };
      }
      case 'glob': {
        const pattern = parsed?.pattern || parsed?.glob || '';
        return { summary: `glob ${pattern.slice(0, 60)}`, file: null };
      }
      default: {
        const firstVal = Object.values(parsed || {})[0];
        const desc = typeof firstVal === 'string' ? firstVal.slice(0, 50) : '';
        return { summary: `${toolName} ${desc}`.trim(), file: null };
      }
    }
  } catch {
    return { summary: toolName, file: null };
  }
}

function tailLines(filePath: string, n: number): string[] {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    return lines.slice(-n);
  } catch {
    return [];
  }
}


function truncate(s: string | undefined | null, max: number): string | null {
  if (!s) return null;
  return s.length > max ? s.slice(0, max) + '\n... (truncated)' : s;
}

// Cache real project dirs (refreshed every 60s)
let _realProjectsCache: Set<string> | null = null;
let _realProjectsCacheTs = 0;
function getRealProjects(): Set<string> {
  const now = Date.now();
  if (_realProjectsCache && now - _realProjectsCacheTs < 60000) return _realProjectsCache;
  try {
    _realProjectsCache = new Set(
      readdirSync(PATHS.projectsDir)
        .filter(d => { try { return statSync(join(PATHS.projectsDir, d)).isDirectory(); } catch { return false; } })
    );
  } catch {
    _realProjectsCache = new Set();
  }
  _realProjectsCacheTs = now;
  return _realProjectsCache;
}

function extractProject(cwd: string | null, summary?: string | null, file?: string | null, detail?: string | null): string | null {
  const realProjects = getRealProjects();
  const sources = [cwd, summary, file, detail].filter(Boolean) as string[];
  for (const src of sources) {
    const m = src.match(/\/projects\/([a-zA-Z0-9_-]+)/);
    if (m && realProjects.has(m[1])) return m[1];
  }
  return null;
}

function extractDetail(toolName: string, args: any, resultContent: any): { detail: string | null; output: string | null } {
  const action = normalizeAction(toolName);
  let parsed: any;
  try {
    parsed = typeof args === 'string' ? JSON.parse(args) : args;
  } catch {
    parsed = {};
  }

  let resultText: string | null = null;
  try {
    if (typeof resultContent === 'string') {
      resultText = resultContent;
    } else if (Array.isArray(resultContent)) {
      resultText = resultContent
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n');
    } else if (resultContent?.text) {
      resultText = resultContent.text;
    }
  } catch {
    // ignore
  }

  switch (action) {
    case 'write':
      return { detail: truncate(parsed?.content, 2000), output: null };
    case 'edit':
      if (parsed?.old_string || parsed?.new_string) {
        const diff = `- ${(parsed.old_string || '').replace(/\n/g, '\n- ')}\n+ ${(parsed.new_string || '').replace(/\n/g, '\n+ ')}`;
        return { detail: truncate(diff, 2000), output: null };
      }
      return { detail: null, output: null };
    case 'bash':
      return { detail: truncate(parsed?.command || parsed?.cmd, 2000), output: truncate(resultText, 1000) };
    case 'read':
      return { detail: null, output: truncate(resultText, 1000) };
    case 'grep':
    case 'glob':
      return { detail: truncate(parsed?.pattern || parsed?.glob || parsed?.regex, 2000), output: truncate(resultText, 1000) };
    default:
      return { detail: null, output: truncate(resultText, 1000) };
  }
}
function scanSessions(): LiveEvent[] {
  const agentsDir = PATHS.agentsDir;
  const events: LiveEvent[] = [];
  const now = Date.now();
  const FIVE_MIN = 5 * 60 * 1000;

  let agentDirs: string[];
  try {
    agentDirs = readdirSync(agentsDir);
  } catch {
    return [];
  }

  for (const agentId of agentDirs) {
    if (!KNOWN_AGENTS.has(agentId)) continue;

    const sessionsDir = join(agentsDir, agentId, 'sessions');
    let sessionFiles: string[];
    try {
      sessionFiles = readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));
    } catch {
      continue;
    }

    // Only active sessions (modified in last 5 minutes)
    const activeFiles = sessionFiles.filter(f => {
      try {
        const st = statSync(join(sessionsDir, f));
        return (now - st.mtimeMs) < FIVE_MIN;
      } catch {
        return false;
      }
    });

    const agentInfo = AGENT_MAP[agentId] || { name: agentId, emoji: '?' };

    for (const file of activeFiles) {
      const lines = tailLines(join(sessionsDir, file), 200);

      // Build a map of toolCall id -> toolCall entry for pairing
      const toolCalls = new Map<string, { msg: any; line: any }>();

      for (const line of lines) {
        let parsed: any;
        try {
          parsed = JSON.parse(line);
        } catch {
          continue;
        }

        if (parsed.type !== 'message') continue;
        const msg = parsed.message;
        if (!msg) continue;

        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === 'toolCall') {
              toolCalls.set(block.id, { msg, line: parsed });
            }
          }
        }

        if (msg.role === 'toolResult' && msg.toolCallId) {
          const call = toolCalls.get(msg.toolCallId);
          if (!call) continue;

          // Find the toolCall block
          const callBlock = call.msg.content.find(
            (b: any) => b.type === 'toolCall' && b.id === msg.toolCallId
          );
          if (!callBlock) continue;

          const { summary, file: filePath } = extractSummary(callBlock.name, callBlock.arguments);
          const { detail, output } = extractDetail(callBlock.name, callBlock.arguments, msg.content);
          const details = msg.details || {};

          const event: LiveEvent = {
            id: msg.toolCallId || `${parsed.id}-${callBlock.id}`,
            ts: parsed.timestamp || call.line.timestamp,
            agent: agentInfo.name.toLowerCase(),
            agentEmoji: agentInfo.emoji,
            model: call.msg.model || call.msg.provider || '',
            tool: callBlock.name,
            action: normalizeAction(callBlock.name),
            summary,
            file: filePath,
            status: details.status || (msg.isError ? 'error' : 'completed'),
            durationMs: details.durationMs ?? null,
            exitCode: details.exitCode ?? null,
            cwd: details.cwd || null,
            detail,
            output,
            project: extractProject(details.cwd || null, summary, filePath, typeof callBlock.arguments === "string" ? callBlock.arguments : null),
            category: classifyCategory(summary, filePath, detail),
          };
          events.push(event);
        }
      }
    }
  }

  // Sort by timestamp ascending
  events.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  return events;
}

router.get('/live-feed', async (req, res) => {
  try {
    const now = Date.now();
    // Use cache if fresh
    if (now - feedCache.ts < CACHE_TTL_MS && feedCache.data.length > 0) {
      return filterAndRespond(feedCache.data, req, res);
    }

    const sessionEvents = scanSessions();
    const setfarmEvents = await getSetfarmLiveEvents(300).catch(() => []);
    const events = [...sessionEvents, ...setfarmEvents]
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    await persistEvents(events);
    feedCache = { data: events, ts: now };
    return filterAndRespond(events, req, res);
  } catch (err: any) {
    console.error('[live-feed] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

async function filterAndRespond(events: LiveEvent[], req: any, res: any) {
  let filtered = events;
  // Filter out step peek polling noise (runs every ~7s per agent, floods the feed)
  filtered = filtered.filter(e => !(e.summary && e.summary.includes("step peek")));
  // grep exit 1 = no match (normal), not an error
  filtered = filtered.map(e => {
    if (e.action === 'bash' && e.exitCode === 1 && e.summary && e.summary.match(/^(grep |find )/)) {
      return { ...e, exitCode: 0, status: 'completed' };
    }
    return e;
  });

  const since = req.query.since as string;
  if (since) {
    const sinceMs = new Date(since).getTime();
    if (!isNaN(sinceMs)) {
      filtered = filtered.filter(e => new Date(e.ts).getTime() > sinceMs);
    }
  }

  const project = req.query.project as string;
  if (project) {
    filtered = filtered.filter(e => e.project === project);
  }

  const status = req.query.status as string;
  if (status === 'error') {
    filtered = filtered.filter(e => e.status === 'error' || (e.exitCode !== null && e.exitCode !== 0));
  }

  const action = req.query.action as string;
  if (action) {
    filtered = filtered.filter(e => e.action === action.toLowerCase());
  }

  const range = req.query.range as string;
  if (range && range !== 'all') {
    const rangeMs: Record<string, number> = { '5m': 5*60e3, '15m': 15*60e3, '30m': 30*60e3, '1h': 60*60e3, '3h': 3*60*60e3 };
    const cutoff = Date.now() - (rangeMs[range] || 60*60e3);
    filtered = filtered.filter(e => new Date(e.ts).getTime() > cutoff);
  }

  const agent = req.query.agent as string;
  if (agent) {
    filtered = filtered.filter(e => e.agent === agent.toLowerCase());
  }

  // Cap at 500 events
  const responseEvents = await enrichProjectLabels(coalesceLiveEvents(filtered).slice(-500));
  res.json(responseEvents);
}

router.get('/live-feed/projects', async (req, res) => {
  try {
    // Cross-check with real ~/projects/ dirs to filter partial-path artifacts
    const realProjects = getRealProjects();

    await ensurePgReady();
    const rows = await pgSql`SELECT DISTINCT project FROM live_events WHERE project IS NOT NULL AND project != '' ORDER BY project`;
    const dbProjects = rows.map((r: any) => r.project).filter((p: string) => realProjects.has(p));
    const setfarmProjects = await getSetfarmActivity(200)
      .then((events: any[]) => [...new Set(events.map((event) => String(event?.runId || '').trim()).filter(Boolean))])
      .catch(() => []);
    const ids = [...new Set([...dbProjects, ...setfarmProjects])].sort();
    let runRows: any[] = [];
    if (ids.length > 0) {
      runRows = await pgSql`
        SELECT id, workflow_id, task, status, created_at
        FROM runs
        WHERE id = ANY(${ids})
      `;
    }
    const runMap = new Map(runRows.map((run: any) => [String(run.id), run]));
    const options: LiveProjectOption[] = ids.map((id) => formatProjectOption(id, runMap.get(id)));
    const rich = String(req.query.format || '').toLowerCase() === 'rich';
    res.json(rich ? options : options.map((option) => option.id));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/live-feed/errors', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const project = req.query.project as string;
    const agent = req.query.agent as string;
    const since = req.query.since as string;
    const action = req.query.action as string;

    await ensurePgReady();
    const conditions: string[] = ["(status = 'error' OR (exit_code IS NOT NULL AND exit_code != 0))"];
    const params: any[] = [];
    let paramIdx = 1;

    if (project) { conditions.push(`project = $${paramIdx++}`); params.push(project); }
    if (agent) { conditions.push(`agent = $${paramIdx++}`); params.push(agent.toLowerCase()); }
    if (action) { conditions.push(`action = $${paramIdx++}`); params.push(action.toLowerCase()); }
    if (since) { conditions.push(`ts > $${paramIdx++}`); params.push(since); }

    const where = conditions.join(' AND ');
    const query = `SELECT * FROM live_events WHERE ${where} ORDER BY ts DESC LIMIT $${paramIdx}`;
    params.push(limit);

    const rows = await pgSql.unsafe(query, params);
    const rawMapped = (rows as any[]).map(r => ({
      ...r,
      durationMs: r.duration_ms,
      exitCode: r.exit_code,
      agentEmoji: Object.values(AGENT_MAP).find(a => a.name.toLowerCase() === (r.agent || '').toLowerCase())?.emoji || '',
      category: r.category || classifyCategory(r.summary, r.file, r.detail),
    }));
    const stepNameByInternal = await resolveSetfarmStepNames(rawMapped);
    const mapped = rawMapped.map((event) => normalizePersistedSetfarmEvent(event, stepNameByInternal));
    res.json(await enrichProjectLabels(coalesceLiveEvents(mapped)));
  } catch (err: any) {
    console.error('[live-feed-db] Errors query error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/live-feed/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const project = req.query.project as string;
    const agent = req.query.agent as string;
    const action = req.query.action as string;
    const since = req.query.since as string;
    const until = req.query.until as string;
    const status = req.query.status as string;
    const range = req.query.range as string;
    const q = req.query.q as string;

    await ensurePgReady();
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let paramIdx = 1;

    if (project) { conditions.push(`project = $${paramIdx++}`); params.push(project); }
    if (agent) { conditions.push(`agent = $${paramIdx++}`); params.push(agent.toLowerCase()); }
    if (action) { conditions.push(`action = $${paramIdx++}`); params.push(action.toLowerCase()); }
    if (since) { conditions.push(`ts > $${paramIdx++}`); params.push(since); }
    if (until) { conditions.push(`ts < $${paramIdx++}`); params.push(until); }
    if (range && range !== 'all') {
      const rangeMs: Record<string, number> = { '5m': 5*60e3, '15m': 15*60e3, '30m': 30*60e3, '1h': 60*60e3, '3h': 3*60*60e3 };
      const cutoff = new Date(Date.now() - (rangeMs[range] || 60*60e3)).toISOString();
      conditions.push(`ts > $${paramIdx++}`); params.push(cutoff);
    }
    if (status === 'error') { conditions.push("(status = 'error' OR (exit_code IS NOT NULL AND exit_code != 0))"); }
    if (q) {
      const like = '%' + q + '%';
      conditions.push(`(summary ILIKE $${paramIdx} OR detail ILIKE $${paramIdx + 1} OR output ILIKE $${paramIdx + 2} OR file ILIKE $${paramIdx + 3})`);
      paramIdx += 4;
      params.push(like, like, like, like);
    }

    const where = conditions.join(' AND ');
    const query = `SELECT * FROM live_events WHERE ${where} ORDER BY ts DESC LIMIT $${paramIdx}`;
    params.push(limit);

    const rows = await pgSql.unsafe(query, params);
    const rawMapped = (rows as any[]).map(r => ({
      ...r,
      durationMs: r.duration_ms,
      exitCode: r.exit_code,
      agentEmoji: Object.values(AGENT_MAP).find(a => a.name.toLowerCase() === (r.agent || '').toLowerCase())?.emoji || '',
      category: r.category || classifyCategory(r.summary, r.file, r.detail),
    }));
    const stepNameByInternal = await resolveSetfarmStepNames(rawMapped);
    const mapped = rawMapped.map((event) => normalizePersistedSetfarmEvent(event, stepNameByInternal));
    const setfarmEvents = await getSetfarmLiveEvents(limit, req.query).catch(() => []);
    const byId = new Map<string, LiveEvent>();
    for (const event of mapped) byId.set(event.id, event);
    for (const event of setfarmEvents) byId.set(event.id, event);
    const merged = [...byId.values()]
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .slice(0, limit);
    const responseEvents = await enrichProjectLabels(
      coalesceLiveEvents(merged).sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, limit),
    );
    res.json(responseEvents);
  } catch (err: any) {
    console.error('[live-feed-db] History query error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/live-feed/stats', async (_req, res) => {
  try {
    await ensurePgReady();
    const [totalRow] = await pgSql`SELECT COUNT(*) as count FROM live_events`;
    const [errorsRow] = await pgSql`SELECT COUNT(*) as count FROM live_events WHERE status = 'error' OR (exit_code IS NOT NULL AND exit_code != 0)`;
    const byProject = await pgSql`SELECT project, COUNT(*)::int as count, SUM(CASE WHEN status = 'error' OR (exit_code IS NOT NULL AND exit_code != 0) THEN 1 ELSE 0 END)::int as errors FROM live_events WHERE project IS NOT NULL GROUP BY project ORDER BY count DESC`;
    const byAgent = await pgSql`SELECT agent, COUNT(*)::int as count, SUM(CASE WHEN status = 'error' OR (exit_code IS NOT NULL AND exit_code != 0) THEN 1 ELSE 0 END)::int as errors FROM live_events GROUP BY agent ORDER BY count DESC`;
    const byAction = await pgSql`SELECT action, COUNT(*)::int as count, SUM(CASE WHEN status = 'error' OR (exit_code IS NOT NULL AND exit_code != 0) THEN 1 ELSE 0 END)::int as errors FROM live_events GROUP BY action ORDER BY count DESC`;
    const [oldestRow] = await pgSql`SELECT MIN(ts) as oldest FROM live_events`;

    const total = Number(totalRow.count);
    const errors = Number(errorsRow.count);
    res.json({
      total,
      errors,
      errorRate: total > 0 ? ((errors / total) * 100).toFixed(1) + '%' : '0%',
      oldestEvent: oldestRow.oldest,
      byProject,
      byAgent,
      byAction,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
