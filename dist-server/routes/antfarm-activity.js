import { Router } from 'express';
import { cached } from '../utils/cache.js';
import { getRuns, getAntfarmActivity, getAntfarmAgentStats, getAntfarmAlerts } from '../utils/antfarm.js';
const router = Router();
// Recent activity events (last 50, reverse chronological)
router.get('/antfarm/activity', async (_req, res) => {
    try {
        const limit = Math.min(parseInt(_req.query.limit) || 50, 200);
        const data = await cached(`af-activity-${limit}`, 10_000, () => getAntfarmActivity(limit));
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Activity fetch failed' });
    }
});
// Workflow agent statistics
router.get('/antfarm/agents', async (_req, res) => {
    try {
        const data = await cached('af-agents', 30_000, getAntfarmAgentStats);
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Agent stats failed' });
    }
});
// Alerts: timeout + failed + abandoned
router.get('/antfarm/alerts', async (_req, res) => {
    try {
        const data = await cached('af-alerts', 15_000, getAntfarmAlerts);
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Alerts fetch failed' });
    }
});
// Active run pipeline state
router.get('/antfarm/pipeline', async (_req, res) => {
    try {
        const data = await cached('af-pipeline', 10_000, async () => {
            const allRuns = (await getRuns());
            const running = allRuns.filter((r) => r.status === 'running');
            const recent = allRuns
                .filter((r) => r.status !== 'running')
                .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                .slice(0, 3);
            return [...running, ...recent].map((r) => {
                let storyProgress = { completed: 0, total: 0 };
                try {
                    const ctx = JSON.parse(r.context || '{}');
                    const completed = (ctx.completed_stories || '').split('\n').filter((l) => l.startsWith('- ')).length;
                    const remaining = parseInt(ctx.stories_remaining) || 0;
                    storyProgress = { completed, total: completed + remaining };
                }
                catch { }
                return {
                    id: r.id,
                    workflow: r.workflow_id,
                    task: r.task,
                    status: r.status,
                    updatedAt: r.updated_at,
                    createdAt: r.created_at,
                    steps: (r.steps || []).map((s) => ({
                        stepId: s.step_id,
                        agent: s.agent_id,
                        status: s.status,
                        retryCount: s.retry_count || 0,
                        type: s.type,
                        currentStoryId: s.current_story_id,
                        abandonedCount: s.abandoned_count || 0,
                    })),
                    storyProgress,
                };
            });
        });
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Pipeline fetch failed' });
    }
});
export default router;
