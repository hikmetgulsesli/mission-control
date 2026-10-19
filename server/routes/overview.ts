import { REAL_AGENT_IDS, STEP_MAPPING } from '../shared/agents.js';
import { Router } from 'express';
import { readFileSync } from 'fs';
import { config } from '../config.js';
import { cached } from '../utils/cache.js';
import { runCliJson, runCli } from '../utils/cli.js';
import { getSystemMetrics } from '../utils/prometheus.js';
import { getRuns } from '../utils/setfarm.js';
import {
  readProjectApiProjections,
  type ProjectApiProjection,
} from './projects.js';
import { isSetfarmOperationalActiveRunStatusV1 } from '../shared/setfarm-operational-active-run-status-v1.js';

const router = Router();

const REAL_AGENTS = REAL_AGENT_IDS as unknown as string[];
type ProjectProjectionRecord = Record<string, unknown> & ProjectApiProjection;

export function selectOperationalActiveProjects<T extends ProjectProjectionRecord>(
  projects: readonly T[],
): T[] {
  const seenRunIds = new Set<string>();
  return projects.filter((project) => {
    const { execution } = project;
    if (execution.active !== true
      || execution.runId === null
      || execution.runStatus === null
      || !isSetfarmOperationalActiveRunStatusV1(execution.runStatus)
      || execution.state !== execution.runStatus
      || seenRunIds.has(execution.runId)) {
      return false;
    }
    seenRunIds.add(execution.runId);
    return true;
  });
}

function declaredRuntimePort(project: ProjectProjectionRecord): number | null {
  if (typeof project.ports !== 'object' || project.ports === null || Array.isArray(project.ports)) return null;
  const ports = project.ports as Record<string, unknown>;
  for (const candidate of [ports.frontend, ports.main]) {
    if (typeof candidate === 'number'
      && Number.isSafeInteger(candidate)
      && candidate > 0
      && candidate <= 65535) {
      return candidate;
    }
  }
  return null;
}

export function selectRecentRuntimeProjects<T extends ProjectProjectionRecord>(
  projects: readonly T[],
): T[] {
  return projects
    .filter((project) => declaredRuntimePort(project) !== null)
    .sort((a, b) => {
      const aTime = typeof a.createdAt === 'string' ? Date.parse(a.createdAt) : 0;
      const bTime = typeof b.createdAt === 'string' ? Date.parse(b.createdAt) : 0;
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    })
    .slice(0, 6);
}

async function isLocalPortOnline(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, {
      signal: AbortSignal.timeout(1000),
    });
    return res.status > 0;
  } catch {
    return false;
  }
}

// Fetch open PRs from GitHub (cached 5 min)
async function fetchOpenPRs(): Promise<any[]> {
  try {
    const raw = await runCli('gh', [
      'pr', 'list', '--state', 'open', '--json',
      'number,title,headRefName,updatedAt,author,mergeable,url',
      '--limit', '10',
    ]);
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Load recent projects with port check
async function fetchRecentDeploys(projects: readonly ProjectProjectionRecord[]): Promise<any[]> {
  try {
    const sorted = selectRecentRuntimeProjects(projects);

    const results = await Promise.allSettled(
      sorted.map(async (p: any) => {
        const port = declaredRuntimePort(p);
        if (port === null) throw new Error('PROJECT_RUNTIME_PORT_INVALID');
        const online = await isLocalPortOnline(port);
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
// Workflow mappings describe role templates, not observed agent ownership.
function buildAgentSummary(agents: any[] | null, activeRuns: any[] | null, dataFile: any): any[] | null {
  if (agents === null) return null;
  const sessions = dataFile?.sessions || [];
  const mappedSteps = new Map<string, string>();
  for (const run of activeRuns || []) {
    const workflow = run.workflow_id || run.workflow || '';
    const mapping = STEP_MAPPING[workflow];
    if (!mapping) continue;
    for (const step of run.steps || []) {
      if (step.status !== 'running') continue;
      const stepId = step.step_id || step.id || '';
      for (const agentId of mapping[stepId] || []) {
        mappedSteps.set(agentId, `Mapped running step: ${stepId} (${workflow})`);
      }
    }
  }

  return agents.map(agent => {
    const latestSession = sessions
      .filter((session: any) => (session.agent || session.key?.split(':')?.[1]) === agent.id && session.updatedAt)
      .sort((a: any, b: any) => b.updatedAt - a.updatedAt)[0];
    return {
      id: agent.id,
      name: agent.name,
      identityName: agent.identityName,
      identityEmoji: agent.identityEmoji,
      status: activeRuns === null ? 'unknown' : mappedSteps.has(agent.id) ? 'mapped' : 'unmapped',
      currentTask: mappedSteps.get(agent.id) || '',
      lastActivity: latestSession?.updatedAt || null,
    };
  });
}

router.get('/overview', async (_req, res) => {
  try {
    const [agents, system, runs, dataFile, openPRs, projectProjections] = await Promise.allSettled([
      cached('agents', 30000, () => runCliJson<any[]>('openclaw', ['agents', 'list', '--json'])),
      cached('system', 15000, getSystemMetrics),
      cached('runs', 15000, getRuns),
      cached('datafile', 30000, async () => {
        const raw = readFileSync(config.dataJson, 'utf-8');
        return JSON.parse(raw);
      }),
      cached('open-prs', 300000, fetchOpenPRs),
      readProjectApiProjections(),
    ]);

    const agentList = agents.status === 'fulfilled'
      ? agents.value
      : [];

    const runList = runs.status === 'fulfilled' ? runs.value as any[] : [];
    const projectedProjects = projectProjections.status === 'fulfilled'
      ? projectProjections.value
      : [];
    const activeRunStatusById = new Map(
      selectOperationalActiveProjects(projectedProjects).map((project) => [
        project.execution.runId as string,
        project.execution.runStatus as string,
      ]),
    );
    const returnedRunIds = new Set<string>();
    const activeRuns = runList.filter((run: any) => {
      const runId = typeof run.id === 'string' ? run.id : '';
      const expectedStatus = activeRunStatusById.get(runId);
      if (expectedStatus === undefined
        || !isSetfarmOperationalActiveRunStatusV1(run.status)
        || run.status !== expectedStatus
        || returnedRunIds.has(runId)) {
        return false;
      }
      returnedRunIds.add(runId);
      return true;
    });
    const recentDeploys = await cached('recent-deploys', 60000, () => fetchRecentDeploys(projectedProjects));

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
    const agentSummary = buildAgentSummary(
      agents.status === 'fulfilled' ? agentList : null,
      runs.status === 'fulfilled' && projectProjections.status === 'fulfilled' ? activeRuns : null,
      data,
    );

    res.json({
      agents: agentList,
      agentCount: agents.status === 'fulfilled' ? agentList.length : null,
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
      recentDeploys,
      agentSummary,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
