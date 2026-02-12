import { Router } from 'express';
import { getRuns, getEvents } from '../utils/antfarm.js';
import { cached } from '../utils/cache.js';
import { runCli } from '../utils/cli.js';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
const router = Router();
const AGENTS_BASE = '/home/setrox/.openclaw/agents';
function transformRun(r) {
    const steps = r.steps || [];
    const pendingStep = steps.find((s) => s.status === 'pending');
    const runningStep = steps.find((s) => s.status === 'running');
    const currentStep = runningStep?.step_id || pendingStep?.step_id || null;
    const doneSteps = steps.filter((s) => s.status === 'done').length;
    const totalSteps = steps.length;
    // Extract stories from plan output
    let storyCount = 0;
    const planStep = steps.find((s) => s.step_id === 'plan');
    if (planStep?.output) {
        const matches = planStep.output.match(/US-\d+/g);
        storyCount = matches ? new Set(matches).size : 0;
    }
    // Extract repo path from context
    let repo = '';
    try {
        const ctx = typeof r.context === 'string' ? JSON.parse(r.context) : r.context;
        repo = ctx?.repo || '';
    }
    catch { }
    return {
        id: r.id,
        workflow: r.workflow_id,
        status: r.status,
        currentStep,
        task: r.task,
        startedAt: r.created_at ? new Date(r.created_at).getTime() : undefined,
        finishedAt: r.status === 'completed' && r.updated_at ? new Date(r.updated_at).getTime() : undefined,
        progress: `${doneSteps}/${totalSteps} steps`,
        steps: steps.map((s) => ({
            id: s.step_id,
            agent: s.agent_id,
            status: s.status,
            output: s.output?.substring(0, 200),
            retryCount: s.retry_count || 0,
            updatedAt: s.updated_at,
        })),
        storyCount,
        repo,
    };
}
router.get('/runs', async (_req, res) => {
    try {
        const raw = await cached('runs', 15000, getRuns);
        const data = raw.map(transformRun);
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Detailed run view — includes agent chat logs, file changes, full step output
router.get('/runs/:id/detail', async (req, res) => {
    try {
        const raw = await getRuns();
        const run = raw.find((r) => r.id === req.params.id);
        if (!run) {
            res.status(404).json({ error: 'Run not found' });
            return;
        }
        const transformed = transformRun(run);
        const steps = run.steps || [];
        // Full step outputs
        const fullSteps = steps.map((s) => ({
            id: s.step_id,
            agent: s.agent_id,
            status: s.status,
            output: s.output || null,
            retryCount: s.retry_count || 0,
            updatedAt: s.updated_at,
            createdAt: s.created_at,
        }));
        // Extract repo from context
        let repo = '';
        let stories = [];
        try {
            const ctx = typeof run.context === 'string' ? JSON.parse(run.context) : run.context;
            repo = ctx?.repo || '';
        }
        catch { }
        // Extract stories from plan step
        const planStep = steps.find((s) => s.step_id === 'plan');
        if (planStep?.output) {
            const jsonMatch = planStep.output.match(/STORIES_JSON:\s*(\[[\s\S]*\])/);
            if (jsonMatch) {
                try {
                    stories = JSON.parse(jsonMatch[1]);
                }
                catch { }
            }
        }
        // Git log (file changes)
        let gitLog = [];
        let fileTree = [];
        if (repo && existsSync(repo)) {
            try {
                const log = execSync(`cd ${JSON.stringify(repo)} && git log --format='{"hash":"%h","message":"%s","date":"%ci","author":"%an"}' --reverse 2>/dev/null`, { encoding: 'utf-8', timeout: 5000 });
                gitLog = log.trim().split('\n').filter(Boolean).map(line => {
                    try {
                        return JSON.parse(line);
                    }
                    catch {
                        return null;
                    }
                }).filter(Boolean);
            }
            catch { }
            try {
                const tree = execSync(`cd ${JSON.stringify(repo)} && find . -not -path '*/node_modules/*' -not -path '*/.git/*' -type f 2>/dev/null | sort`, { encoding: 'utf-8', timeout: 5000 });
                fileTree = tree.trim().split('\n').filter(Boolean);
            }
            catch { }
        }
        // Git diff stats per commit
        let diffStats = [];
        if (repo && existsSync(repo) && gitLog.length > 0) {
            try {
                const stat = execSync(`cd ${JSON.stringify(repo)} && git log --reverse --stat --format="COMMIT:%h" 2>/dev/null`, { encoding: 'utf-8', timeout: 5000 });
                let currentHash = '';
                const chunks = {};
                for (const line of stat.split('\n')) {
                    if (line.startsWith('COMMIT:')) {
                        currentHash = line.slice(7);
                        chunks[currentHash] = [];
                    }
                    else if (currentHash && line.trim()) {
                        chunks[currentHash].push(line);
                    }
                }
                diffStats = Object.entries(chunks).map(([hash, lines]) => ({ hash, files: lines }));
            }
            catch { }
        }
        // Agent session logs (conversations)
        const agentChats = [];
        const seenAgents = new Set();
        for (const step of steps) {
            const agentId = step.agent_id; // e.g. "feature-dev/planner"
            if (!agentId || seenAgents.has(agentId))
                continue;
            seenAgents.add(agentId);
            const agentDir = agentId.replace('/', '-'); // "feature-dev-planner"
            const sessionsDir = join(AGENTS_BASE, agentDir, 'sessions');
            if (!existsSync(sessionsDir))
                continue;
            // Find sessions that contain this run's ID
            const sessionFiles = readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));
            for (const sf of sessionFiles) {
                try {
                    const raw = readFileSync(join(sessionsDir, sf), 'utf-8');
                    const lines = raw.trim().split('\n');
                    const containsRunId = lines.some(l => l.includes(run.id));
                    if (!containsRunId)
                        continue;
                    const messages = [];
                    for (const line of lines) {
                        try {
                            const entry = JSON.parse(line);
                            if (entry.message) {
                                const m = entry.message;
                                const role = m.role;
                                let text = '';
                                if (typeof m.content === 'string') {
                                    text = m.content;
                                }
                                else if (Array.isArray(m.content)) {
                                    const parts = [];
                                    for (const c of m.content) {
                                        if (c.type === 'text')
                                            parts.push(c.text);
                                        else if (c.type === 'tool_use')
                                            parts.push(`[tool: ${c.name}]`);
                                        else if (c.type === 'tool_result') {
                                            const r = typeof c.content === 'string' ? c.content : JSON.stringify(c.content);
                                            parts.push(`[result: ${r.substring(0, 150)}]`);
                                        }
                                    }
                                    text = parts.join('\n');
                                }
                                if (text && role) {
                                    messages.push({
                                        role,
                                        text: text.substring(0, 500),
                                        timestamp: entry.timestamp,
                                    });
                                }
                            }
                        }
                        catch { }
                    }
                    if (messages.length > 0) {
                        agentChats.push({
                            agent: agentId,
                            sessionId: sf.replace('.jsonl', ''),
                            messages: messages.slice(0, 50), // limit
                        });
                    }
                }
                catch { }
            }
        }
        // Progress file
        let progressLog = '';
        if (repo && existsSync(join(repo, 'progress.txt'))) {
            try {
                progressLog = readFileSync(join(repo, 'progress.txt'), 'utf-8').substring(0, 5000);
            }
            catch { }
        }
        res.json({
            ...transformed,
            fullSteps,
            stories,
            gitLog,
            diffStats,
            fileTree,
            agentChats,
            progressLog,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/runs/:id/events', async (req, res) => {
    try {
        const data = await getEvents(req.params.id);
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/runs', async (req, res) => {
    try {
        const { workflow, task } = req.body;
        if (!workflow || !task) {
            res.status(400).json({ error: 'workflow and task required' });
            return;
        }
        const out = await runCli('antfarm', ['workflow', 'run', workflow, task]);
        res.json({ success: true, output: out });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Delete a run
router.delete('/runs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const out = await runCli('antfarm', ['workflow', 'delete', id]);
        res.json({ success: true, output: out });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Retry a specific step
router.post('/runs/:id/retry', async (req, res) => {
    try {
        const { id } = req.params;
        const { step_id, message } = req.body;
        const args = ['workflow', 'run', id];
        if (message)
            args.push(message);
        const out = await runCli('antfarm', args);
        res.json({ success: true, output: out });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
export default router;
