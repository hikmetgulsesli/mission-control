import { Router } from 'express';
import { cached } from '../utils/cache.js';
import { getRuns } from '../utils/antfarm.js';

const router = Router();

// Antfarm step agent → named agent mapping
// Lives here so antfarm updates don't break it
const STEP_MAPPING: Record<string, Record<string, string[]>> = {
  'feature-dev': {
    plan:      ['defne'],
    setup:     ['atlas'],
    implement: ['koda', 'mert'],
    verify:    ['sinan'],
    test:      ['onur', 'mert'],
    pr:        ['koda', 'mert'],
    review:    ['kaan', 'deniz'],
  },
  'bug-fix': {
    triage:      ['defne'],
    investigate: ['koda'],
    setup:       ['atlas'],
    fix:         ['elif'],
    verify:      ['sinan'],
    pr:          ['kaan', 'deniz'],
  },
  'security-audit': {
    scan:       ['defne'],
    prioritize: ['main'],
    setup:      ['atlas'],
    fix:        ['koda'],
    verify:     ['sinan'],
    test:       ['onur', 'mert'],
    pr:         ['kaan', 'deniz'],
  },
};

// Cron-based agent activity
const CRON_AGENTS: Record<string, string[]> = {
  'daily-standup': ['deniz'],
};

interface AgentStatus {
  id: string;
  status: 'working' | 'idle';
  activity: string;
}

async function getOfficeStatus(): Promise<{ agents: AgentStatus[]; timestamp: number }> {
  const allAgents = ['main', 'koda', 'kaan', 'atlas', 'defne', 'sinan', 'elif', 'deniz', 'onur', 'mert'];
  const working = new Map<string, string>();

  // Arya always working (CEO)
  working.set('main', 'CEO orchestration');

  try {
    const runs = (await getRuns()) as any[];
    const activeRuns = runs.filter((r: any) => r.status === 'running');

    for (const run of activeRuns) {
      const workflowId = run.workflow_id || run.workflow || '';
      const mapping = STEP_MAPPING[workflowId];
      if (!mapping) continue;

      const steps = run.steps || [];
      for (const step of steps) {
        if (step.status !== 'running') continue;
        const stepId = step.step_id || step.id || '';
        const agents = mapping[stepId];
        if (!agents) continue;

        for (const agentId of agents) {
          working.set(agentId, `${stepId} (${workflowId})`);
        }
      }

      // Check cron-based agents
      const cronAgents = CRON_AGENTS[workflowId];
      if (cronAgents) {
        for (const agentId of cronAgents) {
          working.set(agentId, workflowId);
        }
      }
    }
  } catch {
    // If antfarm is down, only Arya shows as working
  }

  const agents: AgentStatus[] = allAgents.map(id => ({
    id,
    status: working.has(id) ? 'working' : 'idle',
    activity: working.get(id) || '',
  }));

  return { agents, timestamp: Date.now() };
}

router.get('/office/status', async (_req, res) => {
  try {
    const data = await cached('office-status', 5_000, getOfficeStatus);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Office status failed' });
  }
});

export default router;
