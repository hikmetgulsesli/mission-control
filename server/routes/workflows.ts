import { Router, type Request, type Response } from 'express';
import { getWorkflows } from '../utils/setfarm.js';
import { cached } from '../utils/cache.js';

const router = Router();

/** Injectable I/O ports keep the actual HTTP result testable without runtime access. */
export function createWorkflowsHandler(
  load: () => Promise<unknown> = getWorkflows,
  cache: (key: string, ttl: number, loader: () => Promise<unknown>) => Promise<unknown> = cached,
) {
  return async (_req: Request, res: Response) => {
    try {
      const data = await cache('workflows', 30000, load);
      if (!Array.isArray(data)) throw new Error('WORKFLOWS_UNAVAILABLE');
      res.json(data);
    } catch {
      res.status(503).json({ error: 'WORKFLOWS_UNAVAILABLE' });
    }
  };
}
router.get('/workflows', createWorkflowsHandler());

export default router;
