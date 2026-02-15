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
        // Expanded filter: show sessions active in last 24 hours (was 1 hour)
        const now = Date.now();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
        const active = data
            .filter((s) => {
            if (s.updatedAt && (now - s.updatedAt) > TWENTY_FOUR_HOURS)
                return false;
            return true;
        })
            .map((s) => ({
            ...s,
            duration: s.createdAt ? now - s.createdAt : (s.updatedAt ? now - s.updatedAt : 0),
        }));
        res.json(active);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
export default router;
