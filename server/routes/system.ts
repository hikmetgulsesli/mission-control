import { Router } from 'express';
import { getSystemMetrics } from '../utils/prometheus.js';
import { cached } from '../utils/cache.js';
import { runCli } from '../utils/cli.js';

const router = Router();

router.get('/system', async (_req, res) => {
  try {
    const metrics = await cached('system', 15000, getSystemMetrics);
    res.json(metrics);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/system/docker', async (_req, res) => {
  try {
    const data = await cached('docker', 30000, async () => {
      const out = await runCli('docker', ['ps', '--format', '{{json .}}']);
      return out.split('\n').filter(Boolean).reduce((acc: any[], line: string) => {
        try {
          acc.push(JSON.parse(line));
        } catch (e) {
          console.warn('Failed to parse docker line:', line);
        }
        return acc;
      }, []);
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
