import { Router } from 'express';
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
const router = Router();
// Agent name/emoji mapping
const AGENT_MAP = {
    main: { name: 'Arya', emoji: '\u{1F99E}' },
    koda: { name: 'Koda', emoji: '\u{1F916}' },
    kaan: { name: 'Flux', emoji: '\u26A1' },
    flux: { name: 'Flux', emoji: '\u26A1' },
    atlas: { name: 'Atlas', emoji: '\u{1F30D}' },
    defne: { name: 'Iris', emoji: '\u{1F50D}' },
    iris: { name: 'Iris', emoji: '\u{1F50D}' },
    sinan: { name: 'Sentinel', emoji: '\u{1F6E1}\uFE0F' },
    sentinel: { name: 'Sentinel', emoji: '\u{1F6E1}\uFE0F' },
    elif: { name: 'Cipher', emoji: '\u{1F4BB}' },
    cipher: { name: 'Cipher', emoji: '\u{1F4BB}' },
    deniz: { name: 'Lux', emoji: '\u270D\uFE0F' },
    lux: { name: 'Lux', emoji: '\u270D\uFE0F' },
    onur: { name: 'Nexus', emoji: '\u{1F504}' },
    nexus: { name: 'Nexus', emoji: '\u{1F504}' },
    mert: { name: 'Prism', emoji: '\u{1F3A8}' },
    prism: { name: 'Prism', emoji: '\u{1F3A8}' },
};
// Known agent folder names (skip workflow-specific agents)
const KNOWN_AGENTS = new Set(Object.keys(AGENT_MAP));
// Cache
let feedCache = { data: [], ts: 0 };
const CACHE_TTL_MS = 3000;
function normalizeAction(toolName) {
    const name = toolName.toLowerCase();
    if (name === 'exec' || name === 'bash' || name === 'shell')
        return 'bash';
    if (name === 'write_file' || name === 'write' || name === 'create_file')
        return 'write';
    if (name === 'edit_file' || name === 'edit' || name === 'str_replace_editor')
        return 'edit';
    if (name === 'read_file' || name === 'read' || name === 'view_file')
        return 'read';
    if (name === 'grep' || name === 'search' || name === 'ripgrep')
        return 'grep';
    if (name === 'glob' || name === 'find_files')
        return 'glob';
    return name;
}
function extractSummary(toolName, args) {
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
    }
    catch {
        return { summary: toolName, file: null };
    }
}
function tailLines(filePath, n) {
    try {
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(Boolean);
        return lines.slice(-n);
    }
    catch {
        return [];
    }
}
function truncate(s, max) {
    if (!s)
        return null;
    return s.length > max ? s.slice(0, max) + '\n... (truncated)' : s;
}
function extractDetail(toolName, args, resultContent) {
    const action = normalizeAction(toolName);
    let parsed;
    try {
        parsed = typeof args === 'string' ? JSON.parse(args) : args;
    }
    catch {
        parsed = {};
    }
    let resultText = null;
    try {
        if (typeof resultContent === 'string') {
            resultText = resultContent;
        }
        else if (Array.isArray(resultContent)) {
            resultText = resultContent
                .filter((b) => b.type === 'text')
                .map((b) => b.text)
                .join('\n');
        }
        else if (resultContent?.text) {
            resultText = resultContent.text;
        }
    }
    catch {
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
function scanSessions() {
    const agentsDir = join(homedir(), '.openclaw', 'agents');
    const events = [];
    const now = Date.now();
    const FIVE_MIN = 5 * 60 * 1000;
    let agentDirs;
    try {
        agentDirs = readdirSync(agentsDir);
    }
    catch {
        return [];
    }
    for (const agentId of agentDirs) {
        if (!KNOWN_AGENTS.has(agentId))
            continue;
        const sessionsDir = join(agentsDir, agentId, 'sessions');
        let sessionFiles;
        try {
            sessionFiles = readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));
        }
        catch {
            continue;
        }
        // Only active sessions (modified in last 5 minutes)
        const activeFiles = sessionFiles.filter(f => {
            try {
                const st = statSync(join(sessionsDir, f));
                return (now - st.mtimeMs) < FIVE_MIN;
            }
            catch {
                return false;
            }
        });
        const agentInfo = AGENT_MAP[agentId] || { name: agentId, emoji: '?' };
        for (const file of activeFiles) {
            const lines = tailLines(join(sessionsDir, file), 200);
            // Build a map of toolCall id -> toolCall entry for pairing
            const toolCalls = new Map();
            for (const line of lines) {
                let parsed;
                try {
                    parsed = JSON.parse(line);
                }
                catch {
                    continue;
                }
                if (parsed.type !== 'message')
                    continue;
                const msg = parsed.message;
                if (!msg)
                    continue;
                if (msg.role === 'assistant' && Array.isArray(msg.content)) {
                    for (const block of msg.content) {
                        if (block.type === 'toolCall') {
                            toolCalls.set(block.id, { msg, line: parsed });
                        }
                    }
                }
                if (msg.role === 'toolResult' && msg.toolCallId) {
                    const call = toolCalls.get(msg.toolCallId);
                    if (!call)
                        continue;
                    // Find the toolCall block
                    const callBlock = call.msg.content.find((b) => b.type === 'toolCall' && b.id === msg.toolCallId);
                    if (!callBlock)
                        continue;
                    const { summary, file: filePath } = extractSummary(callBlock.name, callBlock.arguments);
                    const { detail, output } = extractDetail(callBlock.name, callBlock.arguments, msg.content);
                    const details = msg.details || {};
                    const event = {
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
    }
    catch (err) {
        console.error('[live-feed] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});
function filterAndRespond(events, req, res) {
    let filtered = events;
    const since = req.query.since;
    if (since) {
        const sinceMs = new Date(since).getTime();
        if (!isNaN(sinceMs)) {
            filtered = filtered.filter(e => new Date(e.ts).getTime() > sinceMs);
        }
    }
    const agent = req.query.agent;
    if (agent) {
        filtered = filtered.filter(e => e.agent === agent.toLowerCase());
    }
    // Cap at 500 events
    res.json(filtered.slice(-500));
}
export default router;
