import { Router } from 'express';
import { getRuns, getEvents } from '../utils/setfarm.js';
import { cached } from '../utils/cache.js';
import { runCli } from '../utils/cli.js';
import { config } from '../config.js';
import { sql } from '../utils/pg.js';
import { getStuckRuns, unstickRun, getRunDetail, diagnoseStuckStep, tryAutoFix, skipStory, deleteRun } from '../utils/setfarm-db.js';

const router = Router();
const USE_PG = true; // Faz7: PG-only

router.get('/runs', async (_req, res) => {
  try {
    const data = await cached('runs', 5000, getRuns) as any[];
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
    const out = await runCli('setfarm', ['workflow', 'run', workflow, task]);
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
      const out = await runCli('setfarm', args);
      console.log(`[RETRY] CLI success: run=${id} step=${step_id || 'all'}`);
      res.json({ success: true, source: 'cli', output: out });
    } catch (cliErr: any) {
      console.warn(`[RETRY] CLI failed: run=${id} err=${cliErr.message}, falling back`);

      // PG path: reset failed step/story status directly
      if (USE_PG) {
        try {
          // P1-08: Add max_retries guard to prevent infinite retries
          if (step_id) {
            const stepCheck = await sql`SELECT retry_count, max_retries FROM steps WHERE run_id = ${id} AND step_id = ${step_id} AND status = 'failed'`;
            if (stepCheck.length > 0 && stepCheck[0].retry_count >= stepCheck[0].max_retries + 2) {
              res.status(400).json({ error: `Step ${step_id} has exceeded max retries (${stepCheck[0].retry_count}/${stepCheck[0].max_retries})` });
              return;
            }
            await sql`UPDATE steps SET status = 'waiting', retry_count = retry_count + 1, updated_at = now() WHERE run_id = ${id} AND step_id = ${step_id} AND status = 'failed'`;
            // Only reset stories for this specific step's loop (not ALL stories)
            const loopStep = await sql`SELECT id, type FROM steps WHERE run_id = ${id} AND step_id = ${step_id}`;
            if (loopStep.length > 0 && loopStep[0].type === 'loop') {
              await sql`UPDATE stories SET status = 'pending', retry_count = retry_count + 1, updated_at = now() WHERE run_id = ${id} AND status = 'failed'`;
            }
          } else {
            // No step_id: require explicit step_id for safety
            res.status(400).json({ error: 'step_id required for PG retry — use CLI for full run retry' });
            return;
          }
          await sql`UPDATE runs SET status = 'running', updated_at = now() WHERE id = ${id}`;
          console.log(`[RETRY] PG fallback success: run=${id}`);
          res.json({ success: true, source: 'pg', output: 'Reset failed steps/stories via PG' });
          return;
        } catch (pgErr: any) {
          console.warn(`[RETRY] PG fallback failed: ${pgErr.message}`);
        }
      }

      // HTTP API fallback
      try {
        const body: any = { step_id };
        if (message) body.message = message;
        const apiRes = await fetch(`${config.setfarmUrl}/api/runs/${id}/retry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        });
        if (!apiRes.ok) throw new Error(`Setfarm API ${apiRes.status}`);
        const data = await apiRes.json();
        console.log(`[RETRY] API fallback success: run=${id}`);
        res.json({ success: true, source: 'api', output: data });
      } catch (apiErr: any) {
        console.error(`[RETRY] All fallbacks failed: run=${id} cli=${cliErr.message} api=${apiErr.message}`);
        res.status(500).json({ error: `Retry failed (CLI: ${cliErr.message}, API: ${apiErr.message})` });
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


router.get('/runs/:id/diagnose', async (req, res) => {
  try {
    const result = await diagnoseStuckStep(req.params.id, req.query.stepId as string | undefined);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/runs/:id/autofix', async (req, res) => {
  try {
    const { cause, storyId } = req.body;
    if (!cause) { res.status(400).json({ error: 'cause required' }); return; }
    const result = await tryAutoFix(req.params.id, cause, storyId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/runs/:id/skip-story', async (req, res) => {
  try {
    const { storyId, reason } = req.body;
    if (!storyId) { res.status(400).json({ error: 'storyId required' }); return; }
    const result = await skipStory(req.params.id, storyId, reason || 'Manual skip');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// POST /runs/:id/stop — Stop/cancel a running workflow
router.post('/runs/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;
    const out = await runCli('setfarm', ['workflow', 'stop', id]);
    res.json({ success: true, output: out });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// POST /runs/:id/resume — Resume a failed run
router.post('/runs/:id/resume', async (req, res) => {
  try {
    const { id } = req.params;
    const out = await runCli('setfarm', ['workflow', 'resume', id]);
    res.json({ success: true, output: out });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /runs/:id — Delete a workflow run from DB (optionally cleanup project)
router.delete('/runs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { cleanupProject } = req.body || {};
    const result = await deleteRun(id, !!cleanupProject);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
export default router;
