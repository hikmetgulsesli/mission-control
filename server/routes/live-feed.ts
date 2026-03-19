import { Router } from 'express';
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const router = Router();

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
}

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

  const since = req.query.since as string;
  if (since) {
    const sinceMs = new Date(since).getTime();
    if (!isNaN(sinceMs)) {
      filtered = filtered.filter(e => new Date(e.ts).getTime() > sinceMs);
    }
  }

  const agent = req.query.agent as string;
  if (agent) {
    filtered = filtered.filter(e => e.agent === agent.toLowerCase());
  }

  // Cap at 500 events
  res.json(filtered.slice(-500));
}

export default router;
