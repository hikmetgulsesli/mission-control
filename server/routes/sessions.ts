import { Router } from 'express';
import { readFileSync } from 'fs';
import { config } from '../config.js';
import { cached } from '../utils/cache.js';

const router = Router();

router.get('/sessions', async (_req, res) => {
  try {
    const data = await cached('sessions', 30000, async () => {
      const raw = readFileSync(config.dataJson, 'utf-8');
      const parsed = JSON.parse(raw);
      return parsed.sessions || [];
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
