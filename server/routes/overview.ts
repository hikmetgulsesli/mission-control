import { Router } from 'express';
import { readFileSync } from 'fs';
import { config } from '../config.js';
import { cached } from '../utils/cache.js';
import { runCliJson, runCli } from '../utils/cli.js';
import { getSystemMetrics } from '../utils/prometheus.js';
import { getRuns } from '../utils/setfarm.js';

const router = Router();

const REAL_AGENTS = ['main', 'koda', 'kaan', 'atlas', 'defne', 'sinan', 'elif', 'deniz', 'onur', 'mert'];

// Fetch open PRs from GitHub (cached 5 min)
async function fetchOpenPRs(): Promise<any[]> {
  try {
    const raw = await runCli('gh', [
      'pr', 'list', '--state', 'open', '--json',
      'number,title,headRefName,updatedAt,author,mergeable,url,repository',
      '--limit', '10',
    ]);
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Load recent projects with port check
async function fetchRecentDeploys(): Promise<any[]> {
  try {
    const raw = readFileSync(config.projectsJson, 'utf-8');
    const projects = JSON.parse(raw);
    const sorted = projects
      .filter((p: any) => p.ports?.frontend && p.status === 'active')
      .sort((a: any, b: any) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 6);

    const results = await Promise.allSettled(
      sorted.map(async (p: any) => {
        const port = p.ports?.frontend || p.ports?.main;
        let online = false;
        try {
          await runCli('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '--connect-timeout', '1', 'http://127.0.0.1:' + port + '/']);
          online = true;
        } catch {}
        const subdomain = p.domain ? p.domain.replace('.setrox.com.tr', '') : '';
        return { id: p.id, name: p.name, port, subdomain, online, emoji: p.emoji || '' };
      })
    );

    return results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map(r => r.value);
  } catch {
    return [];
  }
}
// Build agent summary from sessions + office status
async function fetchAgentSummary(dataFile: any): Promise<any[]> {
  const sessions = dataFile?.sessions || [];
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;

  // Get office status for working/idle
  let officeAgents: any[] = [];
  try {
    const runs = (await getRuns()) as any[];
    const activeRuns = runs.filter((r: any) => r.status === 'running');
    const working = new Map<string, string>();
    working.set('main', 'CEO orchestration');

    const STEP_MAPPING: Record<string, Record<string, string[]>> = {
      'feature-dev': { plan: ['defne'], setup: ['atlas'], implement: ['koda', 'mert'], verify: ['sinan'], test: ['onur', 'mert'], pr: ['koda', 'mert'], review: ['kaan', 'deniz'] },
      'bug-fix': { triage: ['defne'], investigate: ['koda'], setup: ['atlas'], fix: ['elif'], verify: ['sinan'], pr: ['kaan', 'deniz'] },
      'security-audit': { scan: ['defne'], prioritize: ['main'], setup: ['atlas'], fix: ['koda'], verify: ['sinan'], test: ['onur', 'mert'], pr: ['kaan', 'deniz'] },
    };

    for (const run of activeRuns) {
      const wf = run.workflow_id || run.workflow || '';
      const mapping = STEP_MAPPING[wf];
      if (!mapping) continue;
      for (const step of run.steps || []) {
        if (step.status !== 'running') continue;
        const agents = mapping[step.step_id || step.id || ''];
        if (agents) for (const a of agents) working.set(a, `${step.step_id} (${wf})`);
      }
    }
    officeAgents = REAL_AGENTS.map(id => ({
      id,
      status: working.has(id) ? 'working' : 'idle',
      currentTask: working.get(id) || '',
    }));
  } catch {
    officeAgents = REAL_AGENTS.map(id => ({ id, status: 'idle', currentTask: '' }));
  }

  // Merge with session data for lastActivity
  return officeAgents.map(a => {
    const agentSessions = sessions.filter((s: any) => {
      const sid = s.agent || s.key?.split(':')?.[1];
      return sid === a.id;
    });
    const latestSession = agentSessions
      .filter((s: any) => s.updatedAt)
      .sort((x: any, y: any) => (y.updatedAt || 0) - (x.updatedAt || 0))[0];
    const lastActivity = latestSession?.updatedAt || null;

    return {
      ...a,
      lastActivity,
    };
  });
}

router.get('/overview', async (_req, res) => {
  try {
    const [agents, system, runs, dataFile, openPRs, recentDeploys] = await Promise.allSettled([
      cached('agents', 30000, () => runCliJson<any[]>('openclaw', ['agents', 'list', '--json'])),
      cached('system', 15000, getSystemMetrics),
      cached('runs', 15000, getRuns),
      cached('datafile', 30000, async () => {
        const raw = readFileSync(config.dataJson, 'utf-8');
        return JSON.parse(raw);
      }),
      cached('open-prs', 300000, fetchOpenPRs),
      cached('recent-deploys', 60000, fetchRecentDeploys),
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
      if (s.updatedAt && (now - s.updatedAt) > ONE_HOUR) return false;
      return true;
    });

    const allAlerts = data.alerts || [];
    const recentAlerts = allAlerts.filter((a: any) => {
      const ts = a.timestamp || a.ts;
      if (!ts) return false;
      return (now - new Date(ts).getTime()) < TWENTY_FOUR_HOURS;
    });

    // Agent summary
    const agentSummary = await cached('agent-summary', 15000, () => fetchAgentSummary(data));

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
      // Command Center data
      openPRs: openPRs.status === 'fulfilled' ? openPRs.value : [],
      recentDeploys: recentDeploys.status === 'fulfilled' ? recentDeploys.value : [],
      agentSummary,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
