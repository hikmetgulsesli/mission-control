import { Router, type Request, type Response } from "express";
import pgSql from "../utils/pg.js";

const router = Router();
const SCHEMA = 'mission-control.pipeline-telemetry.v1';

function validId(value: unknown): value is string {
  if (typeof value !== 'string' || !value.length || value.includes('\0')) return false;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return Buffer.byteLength(value, 'utf8') <= 256;
}

function invalidId(res: Response) {
  return res.status(400).json({ schema: SCHEMA, status: 'unavailable', runId: null,
    code: 'TELEMETRY_RUN_ID_INVALID', reason: 'invalid_run_id' });
}

function requestId(req: Request): string | null {
  const at = req.url.indexOf('?');
  const query = at === -1 ? '' : req.url.slice(at + 1);
  if (req.params.runId !== undefined) {
    return !query && validId(req.params.runId) ? req.params.runId : null;
  }
  if (!/^runId=[^&]*$/.test(query)) return null;
  try { const value = decodeURIComponent(query.slice(6)); return validId(value) ? value : null; }
  catch { return null; }
}

// Express decodes path parameters before calling the handler. Refuse malformed
// escapes locally, without relying on its generic HTML error response.
router.use((req, res, next) => {
  const rawPath = req.url.split('?')[0]!;
  if (/^\/telemetry(?:\/|$)/i.test(rawPath)) {
    try { decodeURIComponent(rawPath); } catch { invalidId(res); return; }
  }
  next();
});

interface DurationRow {
  step_id: string; agent_id: string | null; status: string;
  started_at: string | null; updated_at: string | null; duration_ms: number | null;
}

router.get(['/telemetry', '/telemetry/:runId'], async (req, res) => {
  const runId = requestId(req);
  if (runId === null) { invalidId(res); return; }
  try {
    const steps = await pgSql<DurationRow[]>`
      SELECT s.step_id, s.agent_id, s.status,
             CASE WHEN s.started_at IS NOT NULL AND isfinite(s.started_at)
                  THEN to_char(s.started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" AD')
                  ELSE NULL END AS started_at,
             CASE WHEN s.updated_at IS NOT NULL AND isfinite(s.updated_at)
                  THEN to_char(s.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" AD')
                  ELSE NULL END AS updated_at,
             CASE WHEN s.started_at IS NOT NULL AND s.updated_at IS NOT NULL
                        AND isfinite(s.started_at) AND isfinite(s.updated_at)
                        AND s.status IN ('done', 'failed') AND s.updated_at > s.started_at
                  THEN ((((s.updated_at AT TIME ZONE 'UTC')::date - (s.started_at AT TIME ZONE 'UTC')::date)::numeric * 86400000)
                        + (EXTRACT(EPOCH FROM (s.updated_at AT TIME ZONE 'UTC')::time)
                           - EXTRACT(EPOCH FROM (s.started_at AT TIME ZONE 'UTC')::time)) * 1000)::double precision
                  ELSE NULL END AS duration_ms
      FROM steps s WHERE s.run_id = ${runId} ORDER BY s.step_index`;
    const averages = await pgSql<Array<{ step_id: string; avg_ms: number | null }>>`
      SELECT s.step_id,
             AVG(CASE WHEN s.started_at IS NOT NULL AND s.updated_at IS NOT NULL
                           AND isfinite(s.started_at) AND isfinite(s.updated_at)
                           AND s.status IN ('done', 'failed') AND s.updated_at > s.started_at
                      THEN ((s.updated_at AT TIME ZONE 'UTC')::date - (s.started_at AT TIME ZONE 'UTC')::date)::numeric * 86400000
                           + (EXTRACT(EPOCH FROM (s.updated_at AT TIME ZONE 'UTC')::time)
                              - EXTRACT(EPOCH FROM (s.started_at AT TIME ZONE 'UTC')::time)) * 1000
                      ELSE NULL END)::double precision AS avg_ms
      FROM steps s
      WHERE s.step_id IN (SELECT current_step.step_id FROM steps current_step WHERE current_step.run_id = ${runId})
      GROUP BY s.step_id`;
    const averageByStep = new Map<string, number>();
    for (const row of averages) {
      if (typeof row.step_id !== 'string' || row.avg_ms !== null
          && (typeof row.avg_ms !== 'number' || !Number.isFinite(row.avg_ms) || row.avg_ms <= 0)) throw Error('Invalid telemetry row');
      if (row.avg_ms !== null) averageByStep.set(row.step_id, row.avg_ms);
    }
    const bottlenecks: Array<{ type: 'execution_bottleneck'; stepId: string; message: string; value: number; threshold: number }> = [];
    for (const row of steps) {
      if (typeof row.step_id !== 'string' || typeof row.status !== 'string'
          || row.agent_id !== null && typeof row.agent_id !== 'string'
          || row.started_at !== null && typeof row.started_at !== 'string'
          || row.updated_at !== null && typeof row.updated_at !== 'string'
          || row.duration_ms !== null && (typeof row.duration_ms !== 'number'
            || !Number.isFinite(row.duration_ms) || row.duration_ms < 0 || !['done', 'failed'].includes(row.status))) throw Error('Invalid telemetry row');
      const average = averageByStep.get(row.step_id);
      if (row.duration_ms !== null && average !== undefined) {
        const threshold = 2 * average;
        if (!Number.isFinite(threshold)) throw Error('Invalid telemetry baseline');
        if (row.duration_ms > threshold) bottlenecks.push({ type: 'execution_bottleneck', stepId: row.step_id,
          message: `Step ${row.step_id} took ${Math.round(row.duration_ms / 1000)}s (avg: ${Math.round(average / 1000)}s)`,
          value: row.duration_ms, threshold });
      }
    }
    const flagged = new Set(bottlenecks.map(row => row.stepId));
    res.json({ schema: SCHEMA, status: 'available_limited', runId,
      history: { state: 'unavailable', reasonCode: 'PRECISE_TRANSITION_HISTORY_UNAVAILABLE' },
      analysis: { coverage: ['historical_execution_duration'] }, transitions: [], bottlenecks,
      steps: steps.map(row => ({ step_id: row.step_id, agent_id: row.agent_id, status: row.status,
        started_at: row.started_at, updated_at: row.updated_at,
        duration_ms: row.duration_ms === null ? null : Math.round(row.duration_ms), isBottleneck: flagged.has(row.step_id) })) });
  } catch {
    res.status(503).json({ schema: SCHEMA, status: 'unavailable', runId,
      code: 'TELEMETRY_READ_FAILED', reason: 'sql' });
  }
});

export default router;
