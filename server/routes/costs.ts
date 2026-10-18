import { Router } from 'express';
import { readFileSync } from 'fs';
import { config } from '../config.js';
import { cached } from '../utils/cache.js';

const router = Router();

router.get('/costs', async (_req, res) => {
  try {
    const data = await cached('costs', 60000, async () => {
      let d: any = {};
      try { d = JSON.parse(readFileSync(config.dataJson, 'utf-8')); }
      catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
      const fields: Record<string,unknown> = {
        totalToday:d.totalCostToday, totalAllTime:d.totalCostAllTime, projectedMonthly:d.projectedMonthly,
        subagentCostAllTime:d.subagentCostAllTime, subagentCostToday:d.subagentCostToday,
      };
      const costStatus: Record<string,'available'|'unknown'> = {};
      const totals = Object.fromEntries(Object.entries(fields).map(([key,value]) => {
        const available = typeof value === 'number' && Number.isFinite(value) && value >= 0;
        costStatus[key] = available ? 'available' : 'unknown';
        return [key,available ? value : null];
      }));
      return {
        ...totals, costStatus, usageSource:'dashboard_data',
        breakdownAllTime:Array.isArray(d.costBreakdown) ? d.costBreakdown : [],
        breakdownToday:Array.isArray(d.costBreakdownToday) ? d.costBreakdownToday : [],
        tokenUsage:Array.isArray(d.tokenUsage) ? d.tokenUsage : [],
        tokenUsageToday:Array.isArray(d.tokenUsageToday) ? d.tokenUsageToday : [],
      };
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
