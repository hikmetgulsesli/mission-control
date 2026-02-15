import { Router } from 'express';
import { readFileSync } from 'fs';
import { config } from '../config.js';
import { cached } from '../utils/cache.js';
const router = Router();
const MODEL_NORMALIZE = {
    'anthropic/claude-sonnet-4-5-20250929': 'sonnet-4.5',
    'anthropic/claude-opus-4-6': 'opus-4.6',
    'minimax/MiniMax-M2.5': 'minimax-m2.5',
    'minimax-coding/MiniMax-M2.5': 'minimax-m2.5',
    'kimi-coding/k2p5': 'kimi-k2p5',
};
function normalizeModel(raw) {
    if (MODEL_NORMALIZE[raw])
        return MODEL_NORMALIZE[raw];
    const slash = raw.indexOf('/');
    return slash >= 0 ? raw.slice(slash + 1) : raw;
}
function loadAgentModels() {
    try {
        const ocPath = '/home/setrox/.openclaw/openclaw.json';
        const raw = readFileSync(ocPath, 'utf-8');
        const oc = JSON.parse(raw);
        const agents = oc.agents || {};
        const defaultModel = agents.defaults?.model?.primary || agents.defaults?.primary || 'unknown';
        const list = agents.list || [];
        const models = {};
        const knownIds = ['main', 'koda', 'kaan', 'atlas', 'defne', 'sinan', 'elif', 'deniz', 'onur', 'mert'];
        for (const id of knownIds) {
            const entry = list.find((a) => a.id === id);
            const primary = entry?.model?.primary || defaultModel;
            models[id] = normalizeModel(primary);
        }
        return models;
    }
    catch {
        // Fallback if config is unreadable
        return {
            main: 'minimax-m2.5', koda: 'kimi-k2p5', kaan: 'kimi-k2p5', atlas: 'kimi-k2p5',
            defne: 'minimax-m2.5', sinan: 'minimax-m2.5', elif: 'kimi-k2p5',
            deniz: 'minimax-m2.5', onur: 'minimax-m2.5', mert: 'minimax-m2.5',
        };
    }
}
router.get('/performance', async (_req, res) => {
    try {
        const data = await cached('performance', 30000, async () => {
            const raw = readFileSync(config.dataJson, 'utf-8');
            const d = JSON.parse(raw);
            const agentModels = loadAgentModels();
            const sessions = d.sessions || [];
            const tokenUsage = Array.isArray(d.tokenUsage) ? d.tokenUsage : [];
            const tokenUsageToday = Array.isArray(d.tokenUsageToday) ? d.tokenUsageToday : [];
            const costBreakdown = d.costBreakdown || [];
            const costBreakdownToday = d.costBreakdownToday || [];
            // Per-agent session count and last activity
            const agentStats = {};
            for (const [agentId, model] of Object.entries(agentModels)) {
                const agentSessions = sessions.filter((s) => {
                    const sid = s.agent || s.key?.split(':')?.[1];
                    return sid === agentId;
                });
                const lastTs = agentSessions.reduce((max, s) => {
                    const t = s.updatedAt || (s.lastActivity ? new Date(s.lastActivity).getTime() : 0);
                    return t > max ? t : max;
                }, 0);
                agentStats[agentId] = {
                    id: agentId,
                    model,
                    sessionCount: agentSessions.length,
                    totalTokens: agentSessions.reduce((sum, s) => sum + (s.totalTokens || 0), 0),
                    lastActive: lastTs || null,
                };
            }
            // Per-model cost data
            const modelCosts = {};
            const modelCostsToday = {};
            for (const c of costBreakdown) {
                modelCosts[c.model] = (modelCosts[c.model] || 0) + c.cost;
            }
            for (const c of costBreakdownToday) {
                modelCostsToday[c.model] = (modelCostsToday[c.model] || 0) + c.cost;
            }
            // Per-model token stats
            const modelTokens = {};
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
export default router;
