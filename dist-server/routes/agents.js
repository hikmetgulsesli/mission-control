import { Router } from 'express';
import { readFileSync, writeFileSync } from 'fs';
import { runCliJson, runCli } from '../utils/cli.js';
import { cached, setCache } from '../utils/cache.js';
import { config } from '../config.js';
const router = Router();
const REAL_AGENTS = ['main', 'koda', 'kaan', 'atlas', 'defne', 'sinan', 'elif', 'deniz', 'onur', 'mert'];
function loadProfiles() {
    try {
        const raw = readFileSync(config.clawtabsConfig, 'utf-8');
        const parsed = JSON.parse(raw);
        const map = {};
        for (const gw of parsed.gateways || []) {
            const agentId = gw.id?.split('-')[0];
            if (agentId && gw.profile) {
                map[agentId === 'arya' ? 'main' : agentId] = gw.profile;
            }
        }
        return map;
    }
    catch {
        return {};
    }
}
function saveProfiles(profiles) {
    try {
        const raw = readFileSync(config.clawtabsConfig, 'utf-8');
        const parsed = JSON.parse(raw);
        for (const gw of parsed.gateways || []) {
            const agentId = gw.id?.split('-')[0];
            const key = agentId === 'arya' ? 'main' : agentId;
            if (key && profiles[key]) {
                gw.profile = { ...gw.profile, ...profiles[key] };
            }
        }
        writeFileSync(config.clawtabsConfig, JSON.stringify(parsed, null, 2));
    }
    catch (err) {
        console.error('Failed to save profiles:', err);
        throw err;
    }
}
function mergeProfile(agent, profiles) {
    const profile = profiles[agent.id];
    if (!profile)
        return agent;
    return {
        ...agent,
        role: profile.role || undefined,
        description: profile.description || undefined,
        tags: profile.tags || undefined,
    };
}
router.get('/agents', async (_req, res) => {
    try {
        const [all, profiles] = await Promise.all([
            cached('agents', 30000, () => runCliJson('openclaw', ['agents', 'list', '--json'])),
            cached('profiles', 120000, async () => loadProfiles()),
        ]);
        const filtered = all
            .filter((a) => REAL_AGENTS.includes(a.id))
            .map((a) => mergeProfile(a, profiles));
        res.json(filtered);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/agents/:id', async (req, res) => {
    try {
        const [all, profiles] = await Promise.all([
            cached('agents', 30000, () => runCliJson('openclaw', ['agents', 'list', '--json'])),
            cached('profiles', 120000, async () => loadProfiles()),
        ]);
        const agent = all.find((a) => a.id === req.params.id);
        if (!agent) {
            res.status(404).json({ error: 'Agent not found' });
            return;
        }
        res.json(mergeProfile(agent, profiles));
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// PATCH /api/agents/:id — Update agent settings
router.patch('/agents/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!REAL_AGENTS.includes(id)) {
            res.status(404).json({ error: 'Agent not found' });
            return;
        }
        const { name, role, model, description } = req.body;
        // Update profile in clawtabs-config.json
        const profiles = loadProfiles();
        if (!profiles[id])
            profiles[id] = {};
        if (name)
            profiles[id].name = name;
        if (role)
            profiles[id].role = role;
        if (description !== undefined)
            profiles[id].description = description;
        saveProfiles(profiles);
        // Update model via openclaw CLI if changed
        if (model) {
            try {
                // Model alias mapping
                const MODEL_MAP = {
                    'kimi-k2p5': 'kimi-coding/k2p5',
                    'sonnet-4.5': 'anthropic/claude-sonnet-4-5',
                    'opus-4.6': 'anthropic/claude-opus-4-6',
                    'glm-4.7': 'zai/glm-4.7',
                    'minimax-m2.1': 'minimax/MiniMax-M2.1',
                    'deepseek-chat': 'deepseek/deepseek-chat',
                    'deepseek-reasoner': 'deepseek/deepseek-reasoner',
                    'grok-3': 'xai/grok-3',
                };
                const fullModel = MODEL_MAP[model] || model;
                // Find agent index in agents.list
                const agentsList = JSON.parse((await runCli('openclaw', ['config', 'get', 'agents.list'])).trim());
                const agentIndex = agentsList.findIndex((a) => a.id === id);
                if (agentIndex === -1)
                    throw new Error(`Agent ${id} not found in config`);
                // Use openclaw config set to update model.primary
                await runCli('openclaw', [
                    'config', 'set',
                    `agents.list[${agentIndex}].model.primary`,
                    fullModel
                ]);
                console.log(`[Agent] Model change: ${id} → ${fullModel} (index ${agentIndex})`);
            }
            catch (err) {
                console.error(`[Agent] Failed to update model for ${id}:`, err);
                // Don't fail the whole request if model update fails
            }
        }
        // Invalidate caches
        setCache('profiles', null, 0);
        setCache('agents', null, 0);
        res.json({ success: true, id, changes: { name, role, model, description } });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// GET /api/models — List available models
router.get('/models', async (_req, res) => {
    try {
        const models = [
            { id: 'kimi-k2p5', name: 'Kimi K2.5', provider: 'kimi-coding', cost: 'low' },
            { id: 'minimax-m2.1', name: 'MiniMax M2.1', provider: 'minimax', cost: 'low' },
            { id: 'glm-4.7', name: 'GLM 4.7', provider: 'zai', cost: 'low' },
            { id: 'sonnet-4.5', name: 'Claude Sonnet 4.5', provider: 'anthropic', cost: 'medium' },
            { id: 'opus-4.6', name: 'Claude Opus 4.6', provider: 'anthropic', cost: 'high' },
            { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'deepseek', cost: 'low' },
            { id: 'deepseek-reasoner', name: 'DeepSeek R1', provider: 'deepseek', cost: 'low' },
            { id: 'grok-3', name: 'Grok 3', provider: 'xai', cost: 'medium' },
        ];
        res.json(models);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// GET /api/agents/:id/history — Get agent's recent chat history
router.get('/agents/:id/history', async (req, res) => {
    try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit || '50', 10);
        // Find session dir for this agent
        const agentDir = id === 'main' ? 'main' : id;
        const sessionsDir = `/home/setrox/.openclaw/agents/${agentDir}/sessions`;
        const { existsSync, readdirSync, readFileSync, statSync } = await import('fs');
        const { join } = await import('path');
        if (!existsSync(sessionsDir)) {
            res.json({ messages: [], sessions: [] });
            return;
        }
        // Find the most recent session file
        const files = readdirSync(sessionsDir)
            .filter(f => f.endsWith('.jsonl'))
            .map(f => ({
            name: f,
            path: join(sessionsDir, f),
            mtime: statSync(join(sessionsDir, f)).mtimeMs,
        }))
            .sort((a, b) => b.mtime - a.mtime);
        if (files.length === 0) {
            res.json({ messages: [], sessions: [] });
            return;
        }
        // Parse the most recent sessions (up to 3)
        const messages = [];
        const sessionMeta = [];
        for (const file of files.slice(0, 3)) {
            const raw = readFileSync(file.path, 'utf-8');
            const lines = raw.trim().split('\n');
            const sessionMessages = [];
            for (const line of lines) {
                try {
                    const entry = JSON.parse(line);
                    if (entry.message) {
                        const m = entry.message;
                        const role = m.role;
                        let text = '';
                        let toolName = '';
                        if (typeof m.content === 'string') {
                            text = m.content;
                        }
                        else if (Array.isArray(m.content)) {
                            const parts = [];
                            for (const c of m.content) {
                                if (c.type === 'text' && c.text)
                                    parts.push(c.text);
                                else if (c.type === 'tool_use') {
                                    toolName = c.name || '';
                                    parts.push(`[Tool: ${c.name}]`);
                                }
                                else if (c.type === 'tool_result') {
                                    const r = typeof c.content === 'string' ? c.content : JSON.stringify(c.content);
                                    parts.push(`[Result: ${r.substring(0, 200)}]`);
                                }
                            }
                            text = parts.join('\n');
                        }
                        if (text && role) {
                            sessionMessages.push({
                                role,
                                text: text.substring(0, 1000),
                                toolName,
                                timestamp: entry.timestamp,
                                sessionId: file.name.replace('.jsonl', ''),
                            });
                        }
                    }
                }
                catch { }
            }
            if (sessionMessages.length > 0) {
                sessionMeta.push({
                    id: file.name.replace('.jsonl', ''),
                    messageCount: sessionMessages.length,
                    lastActivity: new Date(file.mtime).toISOString(),
                });
                messages.push(...sessionMessages);
            }
        }
        // Return latest messages
        res.json({
            messages: messages.slice(-limit),
            sessions: sessionMeta,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
export default router;
// GET /api/agents/:id/activity — Get all runs and activities for an agent
router.get('/agents/:id/activity', async (req, res) => {
    try {
        const { id } = req.params;
        const agentDir = id === 'main' ? 'main' : id;
        const sessionsDir = `/home/setrox/.openclaw/agents/${agentDir}/sessions`;
        // Get all runs from Antfarm
        const { getRuns } = await import('../utils/antfarm.js');
        const rawRuns = await getRuns();
        // Find runs where this agent participated
        const agentRuns = [];
        for (const run of rawRuns) {
            const steps = run.steps || [];
            for (const step of steps) {
                if (step.agent_id && (step.agent_id === id ||
                    step.agent_id === `feature-dev/${id}` ||
                    step.agent_id === `bug-fix/${id}` ||
                    step.agent_id === `security-audit/${id}`)) {
                    // Find this agent's session files
                    const sessionFiles = existsSync(sessionsDir)
                        ? readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'))
                        : [];
                    // Check which sessions contain this run ID
                    const relevantSessions = [];
                    for (const sf of sessionFiles) {
                        try {
                            const raw = readFileSync(join(sessionsDir, sf), 'utf-8');
                            if (raw.includes(run.id)) {
                                relevantSessions.push({
                                    id: sf.replace('.jsonl', ''),
                                    lastActivity: statSync(join(sessionsDir, sf)).mtimeMs,
                                });
                            }
                        }
                        catch { }
                    }
                    agentRuns.push({
                        runId: run.id,
                        workflow: run.workflow_id,
                        task: run.task?.split('\n')[0] || '',
                        step: step.step_id,
                        status: step.status,
                        output: step.output?.substring(0, 500) || '',
                        completedAt: step.updated_at,
                        sessions: relevantSessions,
                    });
                    break; // Found this agent in this run, no need to check other steps
                }
            }
        }
        // Sort by date (newest first)
        agentRuns.sort((a, b) => {
            const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
            const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
            return bTime - aTime;
        });
        res.json({
            agentId: id,
            totalRuns: agentRuns.length,
            runs: agentRuns,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
