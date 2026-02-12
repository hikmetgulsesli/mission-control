import { Router } from 'express';
import { getWorkflows } from '../utils/antfarm.js';
import { cached } from '../utils/cache.js';
const router = Router();
router.get('/workflows', async (_req, res) => {
    try {
        const data = await cached('workflows', 30000, getWorkflows);
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
export default router;
