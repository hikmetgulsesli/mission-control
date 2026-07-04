import { Router } from 'express';
import { getWorkflows } from '../utils/setfarm.js';
import { cached } from '../utils/cache.js';

const router = Router();

router.get('/workflows', async (_req, res) => {
  try {
    const data = await cached('workflows', 30000, getWorkflows);
    res.json(Array.isArray(data) ? data : []);
  } catch (err: any) {
    res.json([]);
  }
});

export default router;
