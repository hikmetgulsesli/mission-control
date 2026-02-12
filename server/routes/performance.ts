import { Router } from 'express';
import { readFileSync } from 'fs';
import { config } from '../config.js';
import { cached } from '../utils/cache.js';

const router = Router();

const AGENT_MODELS: Record<string, string> = {
  main: 'minimax-m2.1',
  koda: 'kimi-k2p5',
  kaan: 'sonnet-4.5',
  atlas: 'sonnet-4.5',
  defne: 'minimax-m2.1',
  sinan: 'glm-4.7',
  elif: 'kimi-k2p5',
  deniz: 'minimax-m2.1',
  onur: 'minimax-m2.1',
  mert: 'glm-4.7',
};

router.get('/performance', async (_req, res) => {
  try {
    const data = await cached('performance', 30000, async () => {
      const raw = readFileSync(config.dataJson, 'utf-8');
      const d = JSON.parse(raw);

      const sessions = d.sessions || [];
      const tokenUsage = Array.isArray(d.tokenUsage) ? d.tokenUsage : [];
      const tokenUsageToday = Array.isArray(d.tokenUsageToday) ? d.tokenUsageToday : [];
      const costBreakdown = d.costBreakdown || [];
      const costBreakdownToday = d.costBreakdownToday || [];

      // Per-agent session count and last activity
      const agentStats: Record<string, any> = {};
      for (const [agentId, model] of Object.entries(AGENT_MODELS)) {
        const agentSessions = sessions.filter((s: any) => {
          const sid = s.agent || s.key?.split(':')?.[1];
          return sid === agentId;
        });
        const lastTs = agentSessions.reduce((max: number, s: any) => {
          const t = s.updatedAt || (s.lastActivity ? new Date(s.lastActivity).getTime() : 0);
          return t > max ? t : max;
        }, 0);

        agentStats[agentId] = {
          id: agentId,
          model,
          sessionCount: agentSessions.length,
          totalTokens: agentSessions.reduce((sum: number, s: any) => sum + (s.totalTokens || 0), 0),
          lastActive: lastTs || null,
        };
      }

      // Per-model cost data
      const modelCosts: Record<string, number> = {};
      const modelCostsToday: Record<string, number> = {};
      for (const c of costBreakdown) {
        modelCosts[c.model] = (modelCosts[c.model] || 0) + c.cost;
      }
      for (const c of costBreakdownToday) {
        modelCostsToday[c.model] = (modelCostsToday[c.model] || 0) + c.cost;
      }

      // Per-model token stats
      const modelTokens: Record<string, any> = {};
      for (const t of tokenUsage) {
        modelTokens[t.model] = {
          calls: t.calls || 0,
          totalTokens: t.totalTokens || '0',
          cost: t.cost || 0,
        };
      }

      return {
        agents: agentStats,
        modelCosts,
        modelCostsToday,
        modelTokens,
        totalCostToday: d.totalCostToday || 0,
        totalCostAllTime: d.totalCostAllTime || 0,
      };
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
