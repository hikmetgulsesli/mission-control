import { Router } from "express";
import pgSql from "../utils/pg.js";
import { execFileSync } from "node:child_process";

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

    // Query transitions if available
    let transitions: any[] = [];
    try {
      transitions = await pgSql`
        SELECT step_id, from_status, to_status, agent_id, created_at
        FROM step_transitions WHERE run_id = ${runId} ORDER BY created_at`;
    } catch {}

    // Use setfarm's bottleneck detection (5 algorithms: queue, execution, reliability, thrashing, saturation)
    let bottlenecks: any[] = [];
    try {
      const setfarmCli = process.env.HOME + "/.openclaw/setfarm-repo/dist/installer/bottleneck.js";
      const out = execFileSync("node", ["-e", `
        import("${setfarmCli.replace(/\\/g, '/')}").then(m => m.detectBottlenecks("${runId}")).then(r => console.log(JSON.stringify(r))).catch(() => console.log("[]"))
      `], { encoding: "utf-8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] });
      bottlenecks = JSON.parse(out.trim() || "[]");
    } catch {
      // Fallback: simple inline bottleneck detection
      const avgDurations = await pgSql`
        SELECT s.step_id, AVG(EXTRACT(EPOCH FROM s.updated_at::timestamptz - s.started_at::timestamptz) * 1000) as avg_ms
        FROM steps s WHERE s.started_at IS NOT NULL AND s.status IN ('done','failed')
        GROUP BY s.step_id`;
      const avgMap = Object.fromEntries(avgDurations.map((r: any) => [r.step_id, Number(r.avg_ms)]));
      bottlenecks = (steps as any[])
        .filter(s => s.duration_ms && avgMap[s.step_id] && Number(s.duration_ms) > avgMap[s.step_id] * 2)
        .map(s => ({ type: "execution_bottleneck", stepId: s.step_id, message: `Step ${s.step_id} took ${Math.round(Number(s.duration_ms)/1000)}s (avg: ${Math.round(avgMap[s.step_id]/1000)}s)`, value: Number(s.duration_ms), threshold: avgMap[s.step_id] * 2 }));
    }

    const stepsWithBottleneck = (steps as any[]).map(s => ({
      ...s,
      duration_ms: s.duration_ms ? Math.round(Number(s.duration_ms)) : null,
      isBottleneck: bottlenecks.some((b: any) => b.stepId === s.step_id),
    }));

    res.json({ steps: stepsWithBottleneck, transitions, bottlenecks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
