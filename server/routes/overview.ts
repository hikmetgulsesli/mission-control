import { Router } from 'express';
import { readFileSync } from 'fs';
import { config } from '../config.js';
import { cached } from '../utils/cache.js';
import { runCliJson } from '../utils/cli.js';
import { getSystemMetrics } from '../utils/prometheus.js';
import { getRuns } from '../utils/antfarm.js';

const router = Router();

const REAL_AGENTS = ['main', 'koda', 'kaan', 'atlas', 'defne', 'sinan', 'elif', 'deniz', 'onur', 'mert'];

router.get('/overview', async (_req, res) => {
  try {
    const [agents, system, runs, dataFile] = await Promise.allSettled([
      cached('agents', 30000, () => runCliJson<any[]>('openclaw', ['agents', 'list', '--json'])),
      cached('system', 15000, getSystemMetrics),
      cached('runs', 15000, getRuns),
      cached('datafile', 30000, async () => {
        const raw = readFileSync(config.dataJson, 'utf-8');
        return JSON.parse(raw);
      }),
    ]);

    const agentList = agents.status === 'fulfilled'
      ? agents.value.filter((a: any) => REAL_AGENTS.includes(a.id))
      : [];

    const runList = runs.status === 'fulfilled' ? runs.value as any[] : [];
    const activeRuns = runList.filter((r: any) => r.status === 'running' || r.status === 'pending');

    const data = dataFile.status === 'fulfilled' ? dataFile.value : {} as any;

    const cronJobs = data.crons || [];
    const activeCrons = Array.isArray(cronJobs) ? cronJobs.filter((c: any) => c.enabled !== false).length : 0;

    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;
    const TWENTY_FOUR_HOURS = 24 * ONE_HOUR;

    const sessions = data.sessions || [];
    const activeSessions = sessions.filter((s: any) => {
      const agentId = s.agent || s.key?.split(':')?.[1];
      if (!REAL_AGENTS.includes(agentId)) return false;
      // Filter stale sessions: only show sessions active in last 1 hour
      if (s.updatedAt && (now - s.updatedAt) > ONE_HOUR) return false;
      return true;
    });

    // Filter alerts to last 24 hours only
    const allAlerts = data.alerts || [];
    const recentAlerts = allAlerts.filter((a: any) => {
      const ts = a.timestamp || a.ts;
      if (!ts) return false;
      return (now - new Date(ts).getTime()) < TWENTY_FOUR_HOURS;
    });

    res.json({
      agents: agentList,
      agentCount: agentList.length,
      activeRuns,
      activeRunCount: activeRuns.length,
      cronCount: activeCrons,
      costToday: data.totalCostToday || 0,
      costAllTime: data.totalCostAllTime || 0,
      system: system.status === 'fulfilled' ? system.value : null,
      gateway: data.gateway || null,
      sessions: activeSessions.slice(0, 20),
      alerts: recentAlerts,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
