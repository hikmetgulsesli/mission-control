import { useState, memo } from "react";
import { api } from "../lib/api";
import { ConfirmDialog } from "./ConfirmDialog";
import { InlinePlanView } from "./pipeline/InlinePlanView";
import { DeleteRunModal } from "./pipeline/DeleteRunModal";

const STEP_ORDER = ["plan", "design", "stories", "setup-repo", "setup-build", "implement", "verify", "security-gate", "qa-test", "final-test", "deploy"];
const STEP_LABELS: Record<string, string> = {
  plan: "PLAN", design: "DSG", stories: "STR", "setup-repo": "REPO", "setup-build": "BLD", implement: "IMPL", deploy: "DEP",
  verify: "VRF", "security-gate": "SEC", "qa-test": "QA", "final-test": "TEST",
  test: "TEST", pr: "PR", review: "REVIEW",
  triage: "TRIAGE", investigate: "INVEST", fix: "FIX",
  collect: "COLLECT", report: "REPORT",
  "external-review": "EXT-REV", merge: "MERGE",
};

const WORKFLOW_STEPS: Record<string, string[]> = {
  "feature-dev": ["plan", "design", "stories", "setup-repo", "setup-build", "implement", "verify", "security-gate", "qa-test", "final-test", "deploy"],
  "bug-fix": ["triage", "investigate", "fix", "verify", "test", "pr", "review"],
  "security-audit": ["collect", "plan", "fix", "verify", "test", "report", "review"],
  "daily-standup": ["collect", "report"],
  "ui-refactor": ["plan", "setup", "implement", "verify", "test", "deploy"],
};

interface PipelineRun {
  id: string;
  runNumber?: number;
  workflow: string;
  task: string;
  status: string;
  updatedAt: string;
  steps: { stepId: string; agent: string; status: string; retryCount: number; type: string; currentStoryId?: string; abandonedCount: number }[];
  storyProgress: { completed: number; total: number };
}

function statusClass(s: string): string {
  if (s === "done") return "af-step--done";
  if (s === "running") return "af-step--running";
  if (s === "failed") return "af-step--failed";
  return "af-step--pending";
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "..." : s;
}

interface RunCardInlineProps {
  run: PipelineRun;
  isExpanded: boolean;
  retrying: string | null;
  actionLoading: string | null;
  onToggleExpand: () => void;
  onRetry: (runId: string, stepId: string) => void;
  onStoryRetry: (runId: string, storyId: string) => void;
  onStop: (runId: string) => void;
  onResume: (runId: string) => void;
  onDelete: (run: PipelineRun) => void;
}

const RunCardInline = memo(function RunCardInline({
  run,
  isExpanded,
  retrying,
  actionLoading,
  onToggleExpand,
  onRetry,
  onStoryRetry,
  onStop,
  onResume,
  onDelete,
}: RunCardInlineProps) {
  const steps = run.steps.sort((a, b) => {
    const ai = STEP_ORDER.indexOf(a.stepId);
    const bi = STEP_ORDER.indexOf(b.stepId);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const seen = new Set<string>();
  const uniqueSteps = [...steps].reverse().filter(s => {
    if (seen.has(s.stepId)) return false;
    seen.add(s.stepId);
    return true;
  }).reverse();

  const wfSteps = WORKFLOW_STEPS[run.workflow] || STEP_ORDER;
  const stepMap = new Map(uniqueSteps.map(s => [s.stepId, s]));
  const allSteps = wfSteps.map(stepId => stepMap.get(stepId) || {
    stepId, agent: "", status: "pending", retryCount: 0, type: "step", abandonedCount: 0
  });

  const progressPct = run.storyProgress.total > 0
    ? Math.round((run.storyProgress.completed / run.storyProgress.total) * 100)
    : 0;

  return (
    <div className={`af-pipeline__run af-pipeline__run--${run.status}`}>
      <div className="af-pipeline__header" onClick={onToggleExpand} style={{ cursor: "pointer" }}>
        <span className={`af-pipeline__status af-pipeline__status--${run.status}`}>
          {run.status === "running" && <span className="af-pulse" />}
          {run.status.toUpperCase()}
        </span>
        {run.runNumber && <span className="af-pipeline__run-id">#{run.runNumber}</span>}
        <span className="af-pipeline__wf">{run.workflow}</span>
        <span className="af-pipeline__task">{truncate(run.task, 60)}</span>
        <span className="af-pipeline__run-actions" onClick={(e) => e.stopPropagation()}>
          {run.status === "running" ? (
            <button className="af-run-btn af-run-btn--stop" onClick={() => onStop(run.id)} disabled={actionLoading === run.id + ":stop"} title="Durdur">
              {actionLoading === run.id + ":stop" ? "..." : "\u23F8"}
            </button>
          ) : (run.status === "failed" || run.status === "cancelled") ? (
            <button className="af-run-btn af-run-btn--resume" onClick={() => onResume(run.id)} disabled={actionLoading === run.id + ":resume"} title="Devam Et">
              {actionLoading === run.id + ":resume" ? "..." : "\u25B6"}
            </button>
          ) : null}
          <button className="af-run-btn af-run-btn--delete" onClick={() => onDelete(run)} disabled={actionLoading === run.id + ":delete"} title="Sil">
            {actionLoading === run.id + ":delete" ? "..." : "\u2715"}
          </button>
        </span>
        <span className="af-pipeline__expand">{isExpanded ? "\u25B2" : "\u25BC"}</span>
      </div>

      <div className="af-pipeline__steps">
        {allSteps.map((step, i) => (
          <div key={`${step.stepId}-${i}`} className="af-step-wrapper">
            {i > 0 && <span className="af-step-arrow">&rarr;</span>}
            <div className={`af-step ${statusClass(step.status)}`} title={`${step.stepId} (${step.agent?.split("/").pop() || "?"})`}>
              <div className="af-step__label">{STEP_LABELS[step.stepId] || step.stepId.toUpperCase()}</div>
              {step.agent && <div className="af-step__agent">{step.agent.split("/").pop()}</div>}
              {step.status === "running" && <div className="af-step__pulse" />}
              {step.retryCount > 0 && <div className="af-step__retry">R{step.retryCount}</div>}
              {step.status === "failed" && (
                <button
                  className="af-step__retry-btn"
                  onClick={(e) => { e.stopPropagation(); onRetry(run.id, step.stepId); }}
                  disabled={retrying === step.stepId}
                >
                  {retrying === step.stepId ? "..." : "RETRY"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {run.storyProgress.total > 0 && (() => {
        const t = run.storyProgress.total;
        const sp = run.storyProgress as any;
        const verifiedPct = ((sp.verified || 0) / t) * 100;
        const donePct = ((sp.done || 0) / t) * 100;
        const skippedPct = ((sp.skipped || 0) / t) * 100;
        const runningPct = ((sp.running || 0) / t) * 100;
        return (
          <div className="af-pipeline__actions">
            <div className="af-pipeline__progress">
              <div className="af-pipeline__progress-bar" style={{ display: "flex", overflow: "hidden" }}>
                {verifiedPct > 0 && <div style={{ width: `${verifiedPct}%`, background: "#22c55e", height: "100%", transition: "width .3s" }} title={`${sp.verified} verified`} />}
                {donePct > 0 && <div style={{ width: `${donePct}%`, background: "#3b82f6", height: "100%", transition: "width .3s" }} title={`${sp.done} done`} />}
                {skippedPct > 0 && <div style={{ width: `${skippedPct}%`, background: "#6b7280", height: "100%", transition: "width .3s" }} title={`${sp.skipped} skipped`} />}
                {runningPct > 0 && <div style={{ width: `${runningPct}%`, background: "#f59e0b", height: "100%", transition: "width .3s" }} title={`${sp.running} running`} />}
              </div>
              <span className="af-pipeline__progress-text">
                {run.storyProgress.completed}/{run.storyProgress.total} stories ({progressPct}%)
                <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>
                  {sp.verified > 0 && <span style={{ color: "#22c55e" }}>{sp.verified} verified </span>}
                  {sp.done > 0 && <span style={{ color: "#3b82f6" }}>{sp.done} done </span>}
                  {sp.running > 0 && <span style={{ color: "#f59e0b" }}>{sp.running} running </span>}
                  {sp.skipped > 0 && <span style={{ color: "#6b7280" }}>{sp.skipped} skipped</span>}
                </span>
              </span>
            </div>
          </div>
        );
      })()}

      {/* Expanded: inline plan view */}
      {isExpanded && (
        <div className="af-pipeline__expanded">
          <InlinePlanView runId={run.id} onRetry={(storyId) => onStoryRetry(run.id, storyId)} />
        </div>
      )}
    </div>
  );
});

export function PipelineView({ runs, onRefresh }: { runs: PipelineRun[]; onRefresh?: () => void }) {
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [hiddenRuns, setHiddenRuns] = useState<Set<string>>(new Set());
  const [deleteModal, setDeleteModal] = useState<{ runId: string; runNumber: number; task: string } | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteSteps, setDeleteSteps] = useState<Array<{id: string; label: string; status: string; detail?: string}>>([]);
  const [deleteResult, setDeleteResult] = useState<{success?: boolean; error?: string} | null>(null);
  const [deleteCleanup, setDeleteCleanup] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stopConfirm, setStopConfirm] = useState<string | null>(null);

  const HIDDEN_WORKFLOWS = ["daily-standup"];
  const filteredRuns = (runs || [])
    .filter(r => !HIDDEN_WORKFLOWS.includes(r.workflow) && !hiddenRuns.has(r.id))
    .filter(r => statusFilter === "all" || r.status === statusFilter)
    .sort((a, b) => (b.runNumber || 0) - (a.runNumber || 0));

  const filterBar = (
    <div className="af-pipeline__filters">
      {["all", "running", "completed", "failed", "cancelled"].map(s => (
        <button
          key={s}
          className={`af-pipeline__filter-btn ${statusFilter === s ? "af-pipeline__filter-btn--active" : ""}`}
          onClick={() => setStatusFilter(s)}
        >
          {s.toUpperCase()}
          {s !== "all" && <span className="af-pipeline__filter-count">
            {(runs || []).filter(r => !HIDDEN_WORKFLOWS.includes(r.workflow) && r.status === s).length}
          </span>}
        </button>
      ))}
    </div>
  );

  if (filteredRuns.length === 0) {
    return <div className="af-pipeline">{filterBar}<div className="af-empty">No runs found</div></div>;
  }

  const handleRetry = async (runId: string, stepId: string) => {
    setRetrying(stepId);
    try {
      await api.retryRun(runId, stepId);
    } catch (err: any) {
      console.error("Retry failed:", err);
    } finally {
      setRetrying(null);
    }
  };

  const handleStoryRetry = async (runId: string, storyId: string) => {
    try {
      await api.retryRun(runId, undefined, `Retry story ${storyId}`);
    } catch (err: any) {
      console.error("Story retry failed:", err);
    }
  };

  const handleStop = async (runId: string) => {
    setStopConfirm(runId);
  };

  const handleStopConfirmed = async () => {
    if (!stopConfirm) return;
    const runId = stopConfirm;
    setStopConfirm(null);
    setActionLoading(runId + ":stop");
    try { await api.stopRun(runId); if (onRefresh) onRefresh(); } catch (err: any) { console.error("Stop failed:", err); }
    finally { setActionLoading(null); }
  };

  const openDeleteModal = (run: PipelineRun) => {
    setDeleteModal({ runId: run.id, runNumber: run.runNumber || 0, task: run.task });
    setDeleteInput("");
    setDeleteCleanup(false);
    setDeleteSteps([]);
    setDeleteResult(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal) return;
    setActionLoading(deleteModal.runId + ":delete");
    setDeleteResult(null);

    const steps: { id: string; label: string; status: "waiting" | "done" | "fail" | "skip"; detail?: string }[] = [
      { id: "db", label: "DB kayitlari", status: "waiting", detail: "runs, steps, stories" },
    ];
    if (deleteCleanup) {
      steps.push(
        { id: "github", label: "GitHub repo", status: "waiting" },
        { id: "files", label: "Yerel dosyalar", status: "waiting" },
        { id: "service", label: "Systemd servisi", status: "waiting" },
        { id: "json", label: "projects.json", status: "waiting" },
        { id: "tunnel", label: "Cloudflare tunnel", status: "waiting" },
      );
    }
    setDeleteSteps(steps);

    try {
      const result = await api.deleteRun(deleteModal.runId, deleteCleanup);
      const log = ((result as any).log || []).join("\n");

      const updates = steps.map(s => {
        if (s.id === "db") return { ...s, status: "done" as const };
        if (s.id === "github") {
          if (log.includes("GitHub repo deleted")) return { ...s, status: "done" as const };
          if (log.includes("GitHub delete failed")) return { ...s, status: "fail" as const };
          return { ...s, status: "skip" as const, detail: "repo bulunamadi" };
        }
        if (s.id === "files") {
          if (log.includes("Local repo deleted") || (log.includes("Repo") && log.includes("deleted"))) return { ...s, status: "done" as const };
          if (log.includes("delete failed") || log.includes("deletion failed")) return { ...s, status: "fail" as const };
          return { ...s, status: "skip" as const, detail: "dosya bulunamadi" };
        }
        if (s.id === "service") {
          if (log.includes("Service stopped")) return { ...s, status: "done" as const };
          return { ...s, status: "skip" as const, detail: "servis yok" };
        }
        if (s.id === "json") {
          if (log.includes("Removed from projects.json")) return { ...s, status: "done" as const };
          return { ...s, status: "skip" as const };
        }
        if (s.id === "tunnel") {
          if (log.includes("Tunnel:") || log.includes("Tunnel entry")) return { ...s, status: "done" as const };
          if (log.includes("Tunnel cleanup failed")) return { ...s, status: "fail" as const };
          return { ...s, status: "skip" as const, detail: "tunnel yok" };
        }
        return s;
      });

      for (let i = 0; i < updates.length; i++) {
        await new Promise(r => setTimeout(r, 200));
        setDeleteSteps(prev => prev.map((s, j) => j <= i ? updates[j] : s));
      }

      setDeleteResult({ success: true });
      setHiddenRuns(prev => new Set([...prev, deleteModal.runId]));
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error("Delete failed:", err);
      setDeleteResult({ error: err.message });
      setDeleteSteps(prev => prev.map(s => s.status === "waiting" ? { ...s, status: "fail" as const } : s));
    }
    finally { setActionLoading(null); }
  };

  const handleResume = async (runId: string) => {
    setActionLoading(runId + ":resume");
    try { await api.resumeRun(runId); if (onRefresh) onRefresh(); } catch (err: any) { console.error("Resume failed:", err); }
    finally { setActionLoading(null); }
  };

  return (
    <div className="af-pipeline">
      {filterBar}
      {filteredRuns.map((run) => (
        <RunCardInline
          key={run.id}
          run={run}
          isExpanded={expandedRun === run.id}
          retrying={retrying}
          actionLoading={actionLoading}
          onToggleExpand={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
          onRetry={handleRetry}
          onStoryRetry={handleStoryRetry}
          onStop={handleStop}
          onResume={handleResume}
          onDelete={openDeleteModal}
        />
      ))}

      <DeleteRunModal
        modal={deleteModal}
        input={deleteInput}
        cleanup={deleteCleanup}
        steps={deleteSteps}
        result={deleteResult}
        loading={actionLoading === (deleteModal?.runId + ":delete")}
        onInputChange={setDeleteInput}
        onCleanupChange={setDeleteCleanup}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteModal(null)}
      />

      <ConfirmDialog
        open={!!stopConfirm}
        title="Workflow Durdur"
        message="Bu workflow durdurulsun mu?"
        confirmLabel="Durdur"
        onConfirm={handleStopConfirmed}
        onCancel={() => setStopConfirm(null)}
      />
    </div>
  );
}
