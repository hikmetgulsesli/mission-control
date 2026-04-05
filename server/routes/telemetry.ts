import { Router } from "express";
import pgSql from "../utils/pg.js";

const router = Router();

router.get("/telemetry/:runId", async (req, res) => {
  try {
    const { runId } = req.params;

    // Query step durations
    const steps = await pgSql`
      SELECT step_id, agent_id, status, started_at, updated_at,
             CASE WHEN started_at IS NOT NULL AND status IN ('done','failed')
               THEN EXTRACT(EPOCH FROM updated_at::timestamptz - started_at::timestamptz) * 1000
               ELSE NULL END as duration_ms
      FROM steps WHERE run_id = ${runId} ORDER BY step_index`;

    // Query transitions if available — graceful fallback if table doesn't exist
    let transitions: any[] = [];
    try {
      transitions = await pgSql`
        SELECT step_id, from_status, to_status, agent_id, created_at
        FROM step_transitions WHERE run_id = ${runId} ORDER BY created_at`;
    } catch {
      // step_transitions table may not exist — that's OK
    }

    // Compute average durations for bottleneck detection
    const avgDurations = await pgSql`
      SELECT s.step_id, AVG(EXTRACT(EPOCH FROM s.updated_at::timestamptz - s.started_at::timestamptz) * 1000) as avg_ms
      FROM steps s WHERE s.started_at IS NOT NULL AND s.status IN ('done','failed')
      GROUP BY s.step_id`;

    const avgMap = Object.fromEntries(avgDurations.map((r: any) => [r.step_id, Number(r.avg_ms)]));

    const stepsWithBottleneck = (steps as any[]).map(s => ({
      ...s,
      duration_ms: s.duration_ms ? Math.round(Number(s.duration_ms)) : null,
      isBottleneck: s.duration_ms && avgMap[s.step_id] ? Number(s.duration_ms) > avgMap[s.step_id] * 2 : false,
    }));

    res.json({ steps: stepsWithBottleneck, transitions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
