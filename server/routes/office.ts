import { Router } from 'express';
import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
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

const SESSIONS_BASE = '/home/setrox/.openclaw/agents';

interface AgentStatus {
  id: string;
  status: 'working' | 'idle';
  activity: string;
}

// Check if an agent has recent session activity (< 2 minutes)
function getSessionActivity(agentId: string): string | null {
  const dir = agentId === 'main' ? 'main' : agentId;
  const sessionsDir = join(SESSIONS_BASE, dir, 'sessions');
  if (!existsSync(sessionsDir)) return null;
  try {
    const files = readdirSync(sessionsDir)
      .filter((f: string) => f.endsWith('.jsonl'))
      .map((f: string) => ({ name: f, mtime: statSync(join(sessionsDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    if (files.length === 0) return null;
    const minutesAgo = (Date.now() - files[0].mtime) / 60_000;
    if (minutesAgo < 2) return 'active session';
  } catch { /* ignore */ }
  return null;
}

async function getOfficeStatus(): Promise<{ agents: AgentStatus[]; timestamp: number }> {
  const allAgents = ['main', 'koda', 'kaan', 'atlas', 'defne', 'sinan', 'elif', 'deniz', 'onur', 'mert'];
  const working = new Map<string, string>();

  // Arya always working (CEO)
  working.set('main', 'CEO orchestration');

  // Source 1: Antfarm pipeline step mapping
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

  // Source 2: Session file activity (catches direct interactions via Discord/WhatsApp/Telegram)
  for (const agentId of allAgents) {
    if (working.has(agentId)) continue; // Already marked working by antfarm
    const sessionActivity = getSessionActivity(agentId);
    if (sessionActivity) {
      working.set(agentId, sessionActivity);
    }
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
