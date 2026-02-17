import { Router } from 'express';
import { getRuns, getEvents } from '../utils/antfarm.js';
import { cached } from '../utils/cache.js';
import { runCli } from '../utils/cli.js';
import { getStuckRuns, unstickRun, getRunDetail } from '../utils/antfarm-db.js';

const router = Router();

router.get('/runs', async (_req, res) => {
  try {
    const data = await cached('runs', 15000, getRuns) as any[];
    const active = data.filter((r: any) => r.status === 'running' || r.status === 'pending');
    res.json(active);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/runs/:id/events', async (req, res) => {
  try {
    const data = await getEvents(req.params.id);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/runs', async (req, res) => {
  try {
    const { workflow, task } = req.body;
    if (!workflow || !task) {
      res.status(400).json({ error: 'workflow and task required' }); return;
    }
    const out = await runCli('antfarm', ['workflow', 'run', workflow, task]);
    res.json({ success: true, output: out });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /runs/:id/retry — Retry a failed step/story
router.post('/runs/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;
    const { step_id, message } = req.body;

    const args = ['workflow', 'retry', id];
    if (step_id) args.push('--step', step_id);
    if (message) args.push('--message', message);

    try {
      const out = await runCli('antfarm', args);
      res.json({ success: true, output: out });
    } catch {
      // Fallback: if antfarm CLI doesn't have retry, try via API
      try {
        const body: any = { step_id };
        if (message) body.message = message;
        const apiRes = await fetch(`http://127.0.0.1:3333/api/runs/${id}/retry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        });
        if (!apiRes.ok) throw new Error(`Antfarm API ${apiRes.status}`);
        const data = await apiRes.json();
        res.json({ success: true, output: data });
      } catch (err2: any) {
        res.status(500).json({ error: `Retry failed: ${err2.message}` });
      }
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/runs/stuck', async (_req, res) => {
  try {
    const runs = await getStuckRuns();
    res.json({ runs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/runs/:id/detail', async (req, res) => {
  try {
    const detail = await getRunDetail(req.params.id);
    if (!detail) { res.status(404).json({ error: 'Run not found' }); return; }
    res.json(detail);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/runs/:id/unstick', async (req, res) => {
  try {
    const result = await unstickRun(req.params.id, req.body?.stepId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

