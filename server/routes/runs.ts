import { Router } from 'express';
import { getRuns, getEvents } from '../utils/setfarm.js';
import { cached, invalidateCache, clearAllCache } from '../utils/cache.js';
import { runCli } from '../utils/cli.js';
import { sql } from '../utils/pg.js';
import { getStuckRuns, getRunDetail, diagnoseStuckStep } from '../utils/setfarm-db.js';
import { getSupervisorSummaryByRunId } from '../utils/supervisor.js';
import { setfarmOperationalSnapshotClient } from '../services/setfarm-operational-snapshot.js';
import {
  authorizeOperationalAction,
  type OperationalAuthorityFailure,
} from '../services/run-operational-authority.js';

const router = Router();

function sendOperationalAuthorityFailure(res: any, failure: OperationalAuthorityFailure): void {
  res.status(failure.statusCode).json({
    error: failure.code,
    code: failure.code,
    ...(failure.reason === undefined ? {} : { reason: failure.reason }),
  });
}

function sendRecoveryOwnerRequired(res: any): void {
  res.status(405).json({
    error: 'SETFARM_RECOVERY_OWNER_REQUIRED',
    code: 'SETFARM_RECOVERY_OWNER_REQUIRED',
  });
}

export function operationalActionCliArgs(
  action: "stop" | "resume",
  runId: string,
  expectedSnapshotHash: string,
): string[] {
  if (!runId.trim()) throw new Error("OPERATIONAL_ACTION_RUN_ID_REQUIRED");
  if (!/^[a-f0-9]{64}$/.test(expectedSnapshotHash)) {
    throw new Error("OPERATIONAL_ACTION_SNAPSHOT_HASH_INVALID");
  }
  return [
    "workflow",
    action,
    runId,
    "--expected-snapshot-hash",
    expectedSnapshotHash,
    ...(action === "stop" ? ["--force"] : []),
  ];
}

const REFRESH_REQUIRED_ACTION_CODES = new Set([
  "RUN_OPERATIONAL_ACTION_RUN_NOT_FOUND",
  "RUN_OPERATIONAL_ACTION_TARGET_AMBIGUOUS",
  "RUN_OPERATIONAL_ACTION_STALE_SNAPSHOT",
  "RUN_OPERATIONAL_ACTION_PROJECTION_INCOMPLETE",
  "RUN_OPERATIONAL_ACTION_INVARIANT_BLOCKED",
  "RUN_OPERATIONAL_ACTION_DENIED",
  "RUN_OPERATIONAL_ACTION_CONFLICT",
]);

export function operationalActionCliFailure(error: unknown): {
  statusCode: 409;
  code: string;
  reason: string;
} | null {
  const candidate = error as { message?: unknown; stderr?: unknown; stdout?: unknown };
  const diagnostic = [candidate?.stderr, candidate?.stdout, candidate?.message, error]
    .filter((value) => typeof value === "string")
    .join("\n");
  const code = diagnostic.match(/\bRUN_OPERATIONAL_ACTION_[A-Z_]+\b/)?.[0];
  if (!code || !REFRESH_REQUIRED_ACTION_CODES.has(code)) return null;
  return {
    statusCode: 409,
    code,
    reason: "Canonical run state changed or no longer authorizes this action. Refresh operational evidence before retrying.",
  };
}

function sendOperationalActionCliFailure(res: any, error: unknown): boolean {
  const failure = operationalActionCliFailure(error);
  if (!failure) return false;
  res.status(failure.statusCode).json({
    error: failure.code,
    code: failure.code,
    reason: failure.reason,
    refreshRequired: true,
  });
  return true;
}

// Wave 4 fix #15 (plan: reactive-frolicking-cupcake): structured errors with
// classification and log context instead of a bare 500. Previously a PG outage
// or setfarm unreachable both surfaced as '500 — {err.message}' with no way to
// tell them apart from the frontend.
function classifyRouteError(err: any): { code: string; status: number; detail: string } {
  const msg = String(err?.message || err || '');
  if (/ECONNREFUSED|ENOTFOUND|EHOSTUNREACH/i.test(msg)) {
    return { code: 'UPSTREAM_UNREACHABLE', status: 503, detail: 'PostgreSQL or setfarm daemon not reachable' };
  }
  if (/timeout|ETIMEDOUT/i.test(msg)) {
    return { code: 'UPSTREAM_TIMEOUT', status: 504, detail: 'Upstream query took too long' };
  }
  if (/authentication|permission denied|password/i.test(msg)) {
    return { code: 'UPSTREAM_AUTH', status: 502, detail: 'Upstream auth failure' };
  }
  if (/relation.*does not exist|column.*does not exist|schema/i.test(msg)) {
    return { code: 'SCHEMA_MISMATCH', status: 500, detail: 'DB schema mismatch — migration may be pending' };
  }
  return { code: 'INTERNAL', status: 500, detail: msg.slice(0, 300) };
}

router.get('/runs', async (_req, res) => {
  try {
    const data = await cached('runs', 5000, getRuns) as any[];
    const active = data.filter((r: any) => r.status === 'running' || r.status === 'pending');
    res.json(active);
  } catch (err: any) {
    const { code, status, detail } = classifyRouteError(err);
    console.error('[runs] ' + code + ': ' + detail);
    res.status(status).json({ error: detail, code });
  }
});

// 2026-04-23: live progress file exposure. Agents write to /tmp/setfarm-progress-<runId>.txt
// every ~5min during implement step. MC polls this endpoint for real-time visibility.
router.get('/runs/:id/progress', async (req, res) => {
  try {
    const fs = await import('node:fs');
    const progressPath = `/tmp/setfarm-progress-${req.params.id}.txt`;
    if (!fs.existsSync(progressPath)) {
      res.json({ available: false, lines: [], mtime: null });
      return;
    }
    const stat = fs.statSync(progressPath);
    const content = fs.readFileSync(progressPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim().length > 0).slice(-50);
    res.json({ available: true, lines, mtime: stat.mtimeMs, ageSeconds: Math.round((Date.now() - stat.mtimeMs) / 1000) });
  } catch (err: any) {
    const { code, status, detail } = classifyRouteError(err);
    res.status(status).json({ error: detail, code, runId: req.params.id });
  }
});

router.get('/runs/:id/events', async (req, res) => {
  try {
    const data = await getEvents(req.params.id);
    res.json(data);
  } catch (err: any) {
    const { code, status, detail } = classifyRouteError(err);
    console.error('[runs/events] ' + code + ': ' + detail);
    res.status(status).json({ error: detail, code, runId: req.params.id });
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
  void req;
  sendRecoveryOwnerRequired(res);
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
    const supervisor = await getSupervisorSummaryByRunId(req.params.id);
    res.json({ ...detail, supervisor });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/runs/:id/supervisor', async (req, res) => {
  try {
    const supervisor = await getSupervisorSummaryByRunId(req.params.id);
    if (!supervisor) { res.status(404).json({ error: 'Run not found' }); return; }
    res.json(supervisor);
  } catch (err: any) {
    const { code, status, detail } = classifyRouteError(err);
    res.status(status).json({ error: detail, code, runId: req.params.id });
  }
});

router.post('/runs/:id/unstick', async (req, res) => {
  void req;
  sendRecoveryOwnerRequired(res);
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
  void req;
  sendRecoveryOwnerRequired(res);
});

router.post('/runs/:id/skip-story', async (req, res) => {
  void req;
  sendRecoveryOwnerRequired(res);
});


// POST /runs/:id/stop — Stop/cancel a running workflow
router.post('/runs/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;
    const authority = await authorizeOperationalAction({
      action: 'stop',
      runId: id,
      expectedSnapshotHash: req.body?.expectedSnapshotHash,
      snapshotReader: setfarmOperationalSnapshotClient,
    });
    if (authority.status !== 'authorized') {
      sendOperationalAuthorityFailure(res, authority);
      return;
    }
    const out = await runCli('setfarm', operationalActionCliArgs('stop', id, authority.snapshotHash));
    res.json({ success: true, snapshotHash: authority.snapshotHash, output: out });
  } catch (err: any) {
    if (sendOperationalActionCliFailure(res, err)) return;
    res.status(500).json({ error: err.message });
  }
});



// POST /runs/:id/resume — Resume a failed run
router.post('/runs/:id/resume', async (req, res) => {
  try {
    const { id } = req.params;
    const authority = await authorizeOperationalAction({
      action: 'resume',
      runId: id,
      expectedSnapshotHash: req.body?.expectedSnapshotHash,
      snapshotReader: setfarmOperationalSnapshotClient,
    });
    if (authority.status !== 'authorized') {
      sendOperationalAuthorityFailure(res, authority);
      return;
    }
    const out = await runCli('setfarm', operationalActionCliArgs('resume', id, authority.snapshotHash));
    res.json({ success: true, snapshotHash: authority.snapshotHash, output: out });
  } catch (err: any) {
    if (sendOperationalActionCliFailure(res, err)) return;
    res.status(500).json({ error: err.message });
  }
});

// GET /runs/:id/errors — Classified error cards for failed steps
router.get('/runs/:id/errors', async (req, res) => {
  try {
    const { id } = req.params;

    // Query failed steps. Use SELECT * because live Setfarm step schemas vary
    // across migrations and older DBs may not expose a dedicated error column.
    const failedSteps = await sql`
      SELECT *
      FROM steps WHERE run_id = ${id} AND status = 'failed'
      ORDER BY updated_at DESC`;

    // Error classification patterns
    const ERROR_PATTERNS: { category: string; severity: 'error' | 'warning' | 'info'; patterns: RegExp[]; suggestion: string }[] = [
      { category: 'TIMEOUT', severity: 'error', patterns: [/timeout|timed out|ETIMEDOUT|AbortError/i], suggestion: 'Step timeout. Try changing the agent model or narrowing the task scope.' },
      { category: 'BUILD', severity: 'error', patterns: [/npm|build|vite|tsc|webpack|compile|TypeScript|SyntaxError/i], suggestion: 'Build failure. Check package.json dependencies and TypeScript configuration.' },
      { category: 'NETWORK', severity: 'error', patterns: [/ECONNREFUSED|ENOTFOUND|fetch failed|network|ECONNRESET|502|503/i], suggestion: 'Network failure. Check service status and DNS settings.' },
      { category: 'PERMISSION', severity: 'error', patterns: [/EACCES|permission denied|EPERM|sudo/i], suggestion: 'Permission failure. Check file permissions and user privileges.' },
      { category: 'FILE', severity: 'warning', patterns: [/ENOENT|not found|no such file|missing/i], suggestion: 'Missing file. Check the path and filename.' },
      { category: 'GIT', severity: 'warning', patterns: [/git|merge conflict|diverged|rejected/i], suggestion: 'Git failure. Check branch status and merge conflicts.' },
      { category: 'MEMORY', severity: 'error', patterns: [/OOM|heap|memory|ENOMEM|killed/i], suggestion: 'Insufficient memory. Increase MemoryMax or reduce parallel work.' },
      { category: 'LLM', severity: 'warning', patterns: [/rate limit|429|quota|api key|token limit|context length/i], suggestion: 'LLM API failure. Check quota, rate limits, and API key configuration.' },
      { category: 'TEST', severity: 'info', patterns: [/test fail|assertion|expect|jest|vitest|playwright/i], suggestion: 'Test failure. Inspect the test output and fix the code or test.' },
    ];

    const errors = (failedSteps as any[]).map(step => {
      const errorText = [
        step.error,
        step.error_message,
        step.failure_reason,
        step.summary,
        step.output,
        step.result,
        step.context,
      ].find((value) => typeof value === 'string' && value.trim().length > 0) || '';
      let category = 'UNKNOWN';
      let suggestion = 'Error could not be classified. Inspect the step output.';
      let severity: 'error' | 'warning' | 'info' = 'error';

      for (const pattern of ERROR_PATTERNS) {
        if (pattern.patterns.some(p => p.test(errorText))) {
          category = pattern.category;
          suggestion = pattern.suggestion;
          severity = pattern.severity;
          break;
        }
      }

      return {
        stepId: step.step_id,
        category,
        message: errorText.slice(0, 2000),
        suggestion,
        severity,
      };
    });

    res.json(errors);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /runs/:id — Delete a workflow run from DB (optionally cleanup project)
router.delete('/runs/:id', async (req, res) => {
  void req;
  res.status(405).json({
    error: 'SETFARM_OPERATIONAL_HISTORY_IMMUTABLE',
    code: 'SETFARM_OPERATIONAL_HISTORY_IMMUTABLE',
  });
});


// Wave 5 fix #22 (plan: reactive-frolicking-cupcake): cache flush endpoint.
router.post('/cache/invalidate', (req: any, res: any) => {
  const key = (req.body && req.body.key) || null;
  if (key) { invalidateCache(key); console.log('[cache] invalidated: ' + key); res.json({ ok: true, invalidated: key }); }
  else { const n = clearAllCache(); console.log('[cache] cleared ' + n); res.json({ ok: true, cleared: n }); }
});

export default router;
