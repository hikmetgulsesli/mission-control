import { Router } from 'express';
import { getRuns, getEvents } from '../utils/setfarm.js';
import { cached } from '../utils/cache.js';
import { runCli } from '../utils/cli.js';
import { config } from '../config.js';
import { getStuckRuns, unstickRun, getRunDetail, diagnoseStuckStep, tryAutoFix, skipStory } from '../utils/setfarm-db.js';
const router = Router();
router.get('/runs', async (_req, res) => {
    try {
        const data = await cached('runs', 5000, getRuns);
        const active = data.filter((r) => r.status === 'running' || r.status === 'pending');
        res.json(active);
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
        const out = await runCli('setfarm', ['workflow', 'run', workflow, task]);
        res.json({ success: true, output: out });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// POST /runs/:id/retry — Retry a failed step/story
router.post('/runs/:id/retry', async (req, res) => {
    try {
        const { id } = req.params;
        const { step_id, message } = req.body;
        const args = ['workflow', 'retry', id];
        if (step_id)
            args.push('--step', step_id);
        if (message)
            args.push('--message', message);
        try {
            const out = await runCli('setfarm', args);
            console.log(`[RETRY] CLI success: run=${id} step=${step_id || 'all'}`);
            res.json({ success: true, source: 'cli', output: out });
        }
        catch (cliErr) {
            console.warn(`[RETRY] CLI failed: run=${id} err=${cliErr.message}, falling back to API`);
            // Fallback: if setfarm CLI doesn't have retry, try via API
            try {
                const body = { step_id };
                if (message)
                    body.message = message;
                const apiRes = await fetch(`${config.setfarmUrl}/api/runs/${id}/retry`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: AbortSignal.timeout(10000),
                });
                if (!apiRes.ok)
                    throw new Error(`Setfarm API ${apiRes.status}`);
                const data = await apiRes.json();
                console.log(`[RETRY] API fallback success: run=${id}`);
                res.json({ success: true, source: 'api', output: data });
            }
            catch (apiErr) {
                console.error(`[RETRY] Both CLI and API failed: run=${id} cli=${cliErr.message} api=${apiErr.message}`);
                res.status(500).json({ error: `Retry failed (CLI: ${cliErr.message}, API: ${apiErr.message})` });
            }
        }
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/runs/stuck', async (_req, res) => {
    try {
        const runs = await getStuckRuns();
        res.json({ runs });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/runs/:id/detail', async (req, res) => {
    try {
        const detail = await getRunDetail(req.params.id);
        if (!detail) {
            res.status(404).json({ error: 'Run not found' });
            return;
        }
        res.json(detail);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/runs/:id/unstick', async (req, res) => {
    try {
        const result = await unstickRun(req.params.id, req.body?.stepId);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/runs/:id/diagnose', async (req, res) => {
    try {
        const result = await diagnoseStuckStep(req.params.id, req.query.stepId);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/runs/:id/autofix', async (req, res) => {
    try {
        const { cause, storyId } = req.body;
        if (!cause) {
            res.status(400).json({ error: 'cause required' });
            return;
        }
        const result = await tryAutoFix(req.params.id, cause, storyId);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/runs/:id/skip-story', async (req, res) => {
    try {
        const { storyId, reason } = req.body;
        if (!storyId) {
            res.status(400).json({ error: 'storyId required' });
            return;
        }
        const result = await skipStory(req.params.id, storyId, reason || 'Manual skip');
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
export default router;
