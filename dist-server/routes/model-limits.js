import { Router } from 'express';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { cached } from '../utils/cache.js';
import { config } from '../config.js';
const router = Router();
const limitsPath = resolve(import.meta.dirname || __dirname, '..', 'model-limits.json');
router.get('/model-limits', async (_req, res) => {
    try {
        const [limitsConfig, dataFile] = await Promise.all([
            cached('model-limits-config', 300000, async () => {
                const raw = readFileSync(limitsPath, 'utf-8');
                return JSON.parse(raw);
            }),
            cached('datafile-limits', 15000, async () => {
                const raw = readFileSync(config.dataJson, 'utf-8');
                return JSON.parse(raw);
            }),
        ]);
        const providers = limitsConfig.providers || [];
        const tokenUsage = dataFile.tokenUsage || [];
        const tokenUsageToday = dataFile.tokenUsageToday || [];
        const availableModels = dataFile.availableModels || [];
        // Map provider to usage
        const providerModelMap = {
            'kimi-coding': ['kimi-coding/k2p5', 'kimi-coding/kimi-k2-thinking'],
            'minimax': ['minimax/MiniMax-M2.5', 'minimax/MiniMax-M2.5-lightning'],
            'zai': ['zai/glm-4.7', 'zai/glm-4-7'],
            'deepseek': ['deepseek/deepseek-chat', 'deepseek/deepseek-reasoner'],
            'xai': ['xai/grok-3'],
            'anthropic': ['anthropic/claude-opus-4-6', 'anthropic/claude-sonnet-4-5'],
        };
        const result = providers.map(p => {
            const modelIds = providerModelMap[p.id] || [];
            // Find model names that match
            const modelNames = availableModels
                .filter((m) => modelIds.includes(m.id))
                .map((m) => m.name);
            // Sum usage for this provider's models
            const matchUsage = (list) => {
                let calls = 0, cost = 0, totalTokens = 0;
                for (const u of list) {
                    const name = (u.model || '').toLowerCase();
                    const isMatch = modelIds.some(mid => {
                        const parts = mid.split('/');
                        const modelName = parts[parts.length - 1].toLowerCase();
                        return name.includes(modelName) || name.includes(parts[0].toLowerCase());
                    }) || modelNames.some(mn => name.includes(mn.toLowerCase()));
                    if (isMatch) {
                        calls += u.calls || 0;
                        cost += u.cost || 0;
                        totalTokens += u.totalTokensRaw || 0;
                    }
                }
                return { calls, cost: Math.round(cost * 100) / 100, totalTokens };
            };
            const allTime = matchUsage(tokenUsage);
            const today = matchUsage(tokenUsageToday);
            // Check model availability
            const status = availableModels
                .filter((m) => modelIds.includes(m.id))
                .map((m) => ({ id: m.id, name: m.name, status: m.status }));
            return {
                ...p,
                models: status,
                usage: {
                    allTime,
                    today,
                },
            };
        });
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
export default router;
