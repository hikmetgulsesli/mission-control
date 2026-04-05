import { Router } from 'express';
// import Database from 'better-sqlite3'; // Faz7: SQLite removed
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import pgSql from '../utils/pg.js';

const router = Router();

// Faz7: PG-only backend

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
  category: string | null;
}

// Category classification — matches client-side CATEGORY_DEFS
const CATEGORY_PATTERNS: { id: string; patterns: RegExp[] }[] = [
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


// SQLite persistence removed (Faz7: PG-only)

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
      readdirSync(join(homedir(), 'projects'))
        .filter(d => { try { return statSync(join(homedir(), 'projects', d)).isDirectory(); } catch { return false; } })
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
  const agentsDir = join(homedir(), '.openclaw', 'agents');
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

    const events = scanSessions();
    await persistEvents(events);
    feedCache = { data: events, ts: now };
    return filterAndRespond(events, req, res);
  } catch (err: any) {
    console.error('[live-feed] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

function filterAndRespond(events: LiveEvent[], req: any, res: any) {
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
  res.json(filtered.slice(-500));
}

router.get('/live-feed/projects', async (_req, res) => {
  try {
    // Cross-check with real ~/projects/ dirs to filter partial-path artifacts
    const realProjects = getRealProjects();

    await ensurePgReady();
    const rows = await pgSql`SELECT DISTINCT project FROM live_events WHERE project IS NOT NULL AND project != '' ORDER BY project`;
    res.json(rows.map((r: any) => r.project).filter((p: string) => realProjects.has(p)));
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
    const mapped = (rows as any[]).map(r => ({
      ...r,
      durationMs: r.duration_ms,
      exitCode: r.exit_code,
      agentEmoji: Object.values(AGENT_MAP).find(a => a.name.toLowerCase() === (r.agent || '').toLowerCase())?.emoji || '',
      category: r.category || classifyCategory(r.summary, r.file, r.detail),
    }));
    res.json(mapped);
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
    const mapped = (rows as any[]).map(r => ({
      ...r,
      durationMs: r.duration_ms,
      exitCode: r.exit_code,
      agentEmoji: Object.values(AGENT_MAP).find(a => a.name.toLowerCase() === (r.agent || '').toLowerCase())?.emoji || '',
      category: r.category || classifyCategory(r.summary, r.file, r.detail),
    }));
    res.json(mapped);
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
