import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { RunDetail } from "./RunDetail";

interface PipelineRunSummary {
  id: string;
  runNumber?: number;
  workflow: string;
  task: string;
  status: string;
  updatedAt?: string;
}

function newestFirst(a: PipelineRunSummary, b: PipelineRunSummary): number {
  const ar = Number(a.runNumber || 0);
  const br = Number(b.runNumber || 0);
  if (ar !== br) return br - ar;
  return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
}

function pickActiveRun(runs: PipelineRunSummary[]): PipelineRunSummary | null {
  const ordered = [...runs].sort(newestFirst);
  return (
    ordered.find((run) => run.status === "running") ||
    ordered.find((run) => run.status === "pending") ||
    ordered.find((run) => run.status === "completed" || run.status === "done") ||
    ordered.find((run) => run.status === "failed") ||
    ordered.find((run) => run.status === "cancelled") ||
    ordered[0] ||
    null
  );
}

export function ActiveRun() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<PipelineRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const nextRuns = await api.setfarmPipeline();
        if (!cancelled) {
          setRuns(Array.isArray(nextRuns) ? nextRuns : []);
          setError("");
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load active run");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const activeRun = useMemo(() => pickActiveRun(runs), [runs]);

  if (loading) return <div className="page-loading">Loading active run...</div>;

  if (error) {
    return (
      <div className="active-run-empty">
        <h2>ACTIVE RUN</h2>
        <p>{error}</p>
        <button className="btn btn--primary" onClick={() => navigate("/setfarm")}>Back to Pipeline</button>
      </div>
    );
  }

  if (!activeRun) {
    return (
      <div className="active-run-empty">
        <h2>ACTIVE RUN</h2>
        <p>No Setfarm runs found.</p>
        <button className="btn btn--primary" onClick={() => navigate("/setfarm")}>Back to Pipeline</button>
      </div>
    );
  }

  return (
    <RunDetail
      runId={activeRun.id}
      initialTab="contract"
      onBack={() => navigate("/setfarm")}
    />
  );
}
