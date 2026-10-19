import { Router } from 'express';
import { readFileSync } from 'fs';
import { config } from '../config.js';
import { cached, invalidateCache } from '../utils/cache.js';
import { runCli } from '../utils/cli.js';

interface CronDependencies {
  readJobs: () => unknown;
  runCli: typeof runCli;
}

export function createCronRouter(deps: Partial<CronDependencies> = {}) {
  const readJobs = deps.readJobs ?? (() => JSON.parse(readFileSync(config.jobsJson, 'utf-8')).jobs);
  const execute = deps.runCli ?? runCli;
  const router = Router();

  router.get('/cron', async (_req, res) => {
    try {
      const data = await cached('cron', 30000, async () => readJobs() || []);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/cron/:id/toggle', async (req, res) => {
    try {
      const { id } = req.params;
      if (id.length !== 36 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        res.status(400).json({ error: 'Invalid job ID' }); return;
      }
      // Reread authority rather than the display cache before selecting an action.
      const jobs = readJobs();
      if (!Array.isArray(jobs)) throw new Error('Invalid cron jobs');
      const job = jobs.find((j: any) => j && j.id === id);
      if (!job) { res.status(404).json({ error: 'Job not found' }); return; }
      if (typeof job.enabled !== 'boolean' || typeof job.name !== 'string') {
        throw new Error('Invalid cron job');
      }

      const action = job.enabled ? 'disable' : 'enable';
      await execute('openclaw', ['cron', action, job.id]);
      invalidateCache('cron');
      res.json({ success: true, name: job.name, enabled: !job.enabled });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

const router = createCronRouter();
export default router;
