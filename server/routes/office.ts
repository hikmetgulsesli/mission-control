import { Router } from 'express';
import { getRuns } from '../utils/setfarm.js';
import { STEP_MAPPING } from '../shared/agents.js';

const router = Router();

// Setfarm step agent → named agent mapping
// Lives here so setfarm updates don't break it

interface AgentStatus {
  id: string;
  status: 'working' | 'idle';
  activity: string;
}

async function getOfficeStatus(): Promise<{ agents: AgentStatus[]; timestamp: number }> {
  const allAgents = ['main', 'koda', 'flux', 'atlas', 'iris', 'sentinel', 'cipher', 'lux', 'nexus', 'prism'];
  const runs = await getRuns();
  if (!Array.isArray(runs)) throw new Error('OFFICE_STATUS_UNAVAILABLE');
  const working = new Map<string, string>();
  for (const run of runs) {
    if (!run || typeof run !== 'object' || typeof run.status !== 'string')
      throw new Error('OFFICE_STATUS_UNAVAILABLE');
    if (run.status !== 'running') continue;
    if (run.steps !== undefined && !Array.isArray(run.steps))
      throw new Error('OFFICE_STATUS_UNAVAILABLE');
    const workflowId = run.workflow_id || run.workflow || '';
    const mapping = STEP_MAPPING[workflowId];
    if (!mapping) continue;
    for (const step of run.steps || []) {
      if (!step || typeof step !== 'object' || typeof step.status !== 'string')
        throw new Error('OFFICE_STATUS_UNAVAILABLE');
      if (step.status !== 'running') continue;
      const stepId = step.step_id || step.id || '';
      for (const id of mapping[stepId] || [])
        working.set(id, `Mapped running step: ${stepId} (${workflowId})`);
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
    res.json(await getOfficeStatus());
  } catch {
    res.status(503).json({ error: 'OFFICE_STATUS_UNAVAILABLE' });
  }
});

export default router;
