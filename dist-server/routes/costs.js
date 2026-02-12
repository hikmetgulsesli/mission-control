import { Router } from 'express';
import { readFileSync } from 'fs';
import { config } from '../config.js';
import { cached } from '../utils/cache.js';
const router = Router();
router.get('/costs', async (_req, res) => {
    try {
        const data = await cached('costs', 60000, async () => {
            const raw = readFileSync(config.dataJson, 'utf-8');
            const d = JSON.parse(raw);
            return {
                totalToday: d.totalCostToday || 0,
                totalAllTime: d.totalCostAllTime || 0,
                projectedMonthly: d.projectedMonthly || 0,
                breakdownAllTime: d.costBreakdown || [],
                breakdownToday: d.costBreakdownToday || [],
                subagentCostAllTime: d.subagentCostAllTime || 0,
                subagentCostToday: d.subagentCostToday || 0,
                tokenUsage: d.tokenUsage || {},
                tokenUsageToday: d.tokenUsageToday || {},
            };
        });
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
export default router;
