import { Router } from 'express';
import { readFileSync } from 'fs';
import { config } from '../config.js';
import { cached, invalidateCache } from '../utils/cache.js';
import { runCli } from '../utils/cli.js';

const router = Router();

router.get('/cron', async (_req, res) => {
  try {
    const data = await cached('cron', 30000, async () => {
      const raw = readFileSync(config.jobsJson, 'utf-8');
      const parsed = JSON.parse(raw);
      return parsed.jobs || [];
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cron/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const raw = readFileSync(config.jobsJson, 'utf-8');
    const parsed = JSON.parse(raw);
    const job = parsed.jobs?.find((j: any) => j.id === id);
    if (!job) { res.status(404).json({ error: 'Job not found' }); return; }

    const action = job.enabled ? 'disable' : 'enable';
    await runCli('openclaw', ['cron', action, job.name]);
    invalidateCache('cron');
    res.json({ success: true, name: job.name, enabled: !job.enabled });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
