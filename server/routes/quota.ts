import { Router } from 'express';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { cached } from '../utils/cache.js';

const router = Router();

const AGENTS_DIR = '/home/setrox/.openclaw/agents';
const FIVE_HOURS_MS = 5 * 3600 * 1000;

// Map provider to model substrings to match in JSONL
const PROVIDER_MODELS: Record<string, string[]> = {
  'minimax': ['minimax', 'MiniMax'],
  'kimi-coding': ['kimi', 'k2p5', 'moonshot'],
  'zai': ['glm', 'zai', 'zhipu', 'bigmodel'],
  'anthropic': ['claude', 'anthropic'],
};

function countRecentCalls(): Record<string, { calls: number; tokens: number }> {
  const now = Date.now();
  const cutoff = now - FIVE_HOURS_MS;
  const counts: Record<string, { calls: number; tokens: number }> = {};

  for (const pid of Object.keys(PROVIDER_MODELS)) {
    counts[pid] = { calls: 0, tokens: 0 };
  }

  try {
    const agentDirs = readdirSync(AGENTS_DIR);
    for (const agent of agentDirs) {
      const sessDir = join(AGENTS_DIR, agent, 'sessions');
      let files: string[];
      try {
        files = readdirSync(sessDir).filter(f => f.endsWith('.jsonl'));
      } catch { continue; }

      for (const file of files) {
        const fpath = join(sessDir, file);
        try {
          const stat = statSync(fpath);
          // Skip files not modified in last 5 hours
          if (stat.mtimeMs < cutoff) continue;

          const content = readFileSync(fpath, 'utf-8');
          const lines = content.split('\n');

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const entry = JSON.parse(line);
              const ts = entry.timestamp || entry.ts || 0;
              if (ts && ts < cutoff) continue;

              // Count assistant messages (= API calls)
              const msg = entry.message;
              if (msg?.role === 'assistant') {
                const model = (entry.model || msg.model || '').toLowerCase();
                for (const [pid, patterns] of Object.entries(PROVIDER_MODELS)) {
                  if (patterns.some(p => model.includes(p.toLowerCase()))) {
                    counts[pid].calls++;
                    // Rough token count from usage
                    const usage = entry.usage || msg.usage;
                    if (usage) {
                      counts[pid].tokens += (usage.total_tokens || usage.totalTokens || 0);
                    }
                    break;
                  }
                }
              }
            } catch {}
          }
        } catch {}
      }
    }
  } catch {}

  return counts;
}

router.get('/quota', async (_req, res) => {
  try {
    const counts = await cached('quota-counts', 60000, async () => countRecentCalls());
    
    const limits: Record<string, { limit: number | null; used: number; tokens: number; windowHours: number }> = {
      'minimax': { limit: 300, used: counts['minimax']?.calls || 0, tokens: counts['minimax']?.tokens || 0, windowHours: 5 },
      'kimi-coding': { limit: null, used: counts['kimi-coding']?.calls || 0, tokens: counts['kimi-coding']?.tokens || 0, windowHours: 5 },
      'zai': { limit: null, used: counts['zai']?.calls || 0, tokens: counts['zai']?.tokens || 0, windowHours: 5 },
      'anthropic': { limit: null, used: counts['anthropic']?.calls || 0, tokens: counts['anthropic']?.tokens || 0, windowHours: 5 },
    };

    res.json(limits);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
