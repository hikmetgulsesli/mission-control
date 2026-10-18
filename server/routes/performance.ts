import { Router } from 'express';
import { readFileSync } from 'fs';
import { config } from '../config.js';
import { cached } from '../utils/cache.js';
import { runCliJson } from '../utils/cli.js';
import { freshMissionControlSelectedV1 } from '../services/fresh-installation-runtime.js';
import { resolveAgentRoster, sessionAgentId, sessionTimestamp } from '../services/agent-identity.js';

const router = Router();
const measured = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

router.get('/performance', async (_req, res) => {
  try {
    const data = await cached('performance', 30000, async () => {
      let d: any = {};
      try { d = JSON.parse(readFileSync(config.dataJson, 'utf-8')); }
      catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
      const configured = freshMissionControlSelectedV1() ? [] : await cached('agents', 30000, async () => {
        try { return await runCliJson<any[]>('openclaw', ['agents', 'list', '--json']); }
        catch { return []; }
      });
      const sessions = Array.isArray(d.sessions) ? d.sessions : [];
      const roster = resolveAgentRoster(configured, sessions);
      const agents = Object.fromEntries(roster.map(agent => {
        const ownSessions = sessions.filter((session: any) => sessionAgentId(session) === agent.id);
        const tokens = ownSessions.map((session: any) => session.totalTokens);
        return [agent.id, {
          ...agent,
          sessionCount: ownSessions.length,
          totalTokens: tokens.every(measured) ? tokens.reduce((sum: number, n: number) => sum + n, 0) : null,
          lastActive: ownSessions.reduce((latest: number, session: any) => Math.max(latest,sessionTimestamp(session)),0) || null,
        }];
      }));
      const costs = (rows: unknown) => {
        const result: Record<string, number> = {};
        for (const row of Array.isArray(rows) ? rows : []) {
          if (typeof row?.model === 'string' && measured(row.cost)) result[row.model] = (result[row.model] ?? 0) + row.cost;
        }
        return result;
      };
      const modelTokens = Object.fromEntries((Array.isArray(d.tokenUsage) ? d.tokenUsage : [])
        .filter((row: any) => typeof row?.model === 'string').map((row: any) => [row.model,{
          calls:measured(row.calls) ? row.calls : null, totalTokens:row.totalTokens ?? null,
          cost:measured(row.cost) ? row.cost : null,
        }]));
      return {
        agents, modelCosts:costs(d.costBreakdown), modelCostsToday:costs(d.costBreakdownToday), modelTokens,
        totalCostToday:measured(d.totalCostToday) ? d.totalCostToday : null,
        totalCostAllTime:measured(d.totalCostAllTime) ? d.totalCostAllTime : null,
        sessionsStatus:Array.isArray(d.sessions) ? 'available' : 'unknown',
        costStatus:{today:measured(d.totalCostToday) ? 'available' : 'unknown',allTime:measured(d.totalCostAllTime) ? 'available' : 'unknown'},
        usageSource:'dashboard_data',
      };
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
