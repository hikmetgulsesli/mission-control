import React, { useState, useCallback, useEffect, memo } from "react";
import { api } from "../lib/api";
import { ConfirmDialog } from "./ConfirmDialog";
import { InlinePlanView } from "./pipeline/InlinePlanView";
import { DeleteRunModal } from "./pipeline/DeleteRunModal";
import { ErrorCard } from "./pipeline/ErrorCard";

const STEP_ORDER = ["plan", "design", "stories", "setup-repo", "setup-build", "implement", "verify", "security-gate", "qa-test", "final-test", "deploy"];
const STEP_LABELS: Record<string, string> = {
  plan: "PLAN", design: "DESIGN", stories: "STORIES", "setup-repo": "SETUP", "setup-build": "BUILD", implement: "IMPL", deploy: "DEPLOY",
  verify: "VERIFY", "security-gate": "SEC GATE", "qa-test": "QA TEST", "final-test": "FINAL TEST",
  test: "TEST", pr: "PR", review: "REVIEW",
  triage: "TRIAGE", investigate: "INVEST", fix: "FIX",
  collect: "COLLECT", report: "REPORT",
  "external-review": "EXT-REV", merge: "MERGE",
};

/* ── Pipeline Phase Grouping ── */
const PIPELINE_PHASES: Record<string, string[]> = {
  "PLANNING": ["plan", "design", "stories"],
  "BUILDING": ["setup-repo", "setup-build", "implement"],
  "QUALITY": ["verify", "security-gate", "qa-test", "final-test"],
  "DEPLOY": ["deploy"],
};

/** Map stepId -> phase label */
const STEP_TO_PHASE: Record<string, string> = {};
for (const [phase, stepIds] of Object.entries(PIPELINE_PHASES)) {
  for (const sid of stepIds) STEP_TO_PHASE[sid] = phase;
}

/** Group ordered steps into phase buckets, preserving order */
function groupStepsByPhase(steps: StepLike[]): { phase: string; steps: StepLike[] }[] {
  const groups: { phase: string; steps: StepLike[] }[] = [];
  let currentPhase = "";
  for (const step of steps) {
    const phase = STEP_TO_PHASE[step.stepId] || "OTHER";
    if (phase !== currentPhase) {
      groups.push({ phase, steps: [step] });
      currentPhase = phase;
    } else {
      groups[groups.length - 1].steps.push(step);
    }
  }
  return groups;
}

type StepLike = { stepId: string; agent: string; status: string; retryCount: number; type: string; currentStoryId?: string; abandonedCount: number };

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
  steps: StepLike[];
  storyProgress: { completed: number; total: number };
}

/** Step detail data fetched on demand from runDetail API */
interface StepDetailData {
  output?: string;
  error?: string;
  duration?: string;
  startedAt?: string;
  completedAt?: string;
  implementPhase?: string;
}

function statusClass(s: string): string {
  if (s === "done") return "af-step--done";
  if (s === "running") return "af-step--running";
  if (s === "failed") return "af-step--failed";
  return "af-step--pending";
}

function extractTitle(task: string): string {
  const projeMatch = task.match(/Proje:\s*([^\s]+)/);
  const aciklamaMatch = task.match(/A[c\xe7][\u0131i]klama:\s*(.+)/i);
  if (projeMatch) {
    const name = projeMatch[1];
    const desc = aciklamaMatch ? aciklamaMatch[1].trim() : "";
    return desc ? name + " \u2014 " + desc : name;
  }
  return task;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "..." : s;
}

interface ClassifiedError {
  stepId: string;
  category: string;
  message: string;
  suggestion: string;
  severity: "error" | "warning" | "info";
}

interface RunCardInlineProps {
  run: PipelineRun;
  isExpanded: boolean;
  retrying: string | null;
  actionLoading: string | null;
  selectedStep: string | null;
  stepDetailData: StepDetailData | null;
  stepDetailLoading: boolean;
  errorCards: ClassifiedError[];
  onToggleExpand: () => void;
  onRetry: (runId: string, stepId: string) => void;
  onStoryRetry: (runId: string, storyId: string) => void;
  onStop: (runId: string) => void;
  onResume: (runId: string) => void;
  onDelete: (run: PipelineRun) => void;
  onStepClick: (runId: string, stepId: string) => void;
}

const RunCardInline = memo(function RunCardInline({
  run,
  isExpanded,
  retrying,
  actionLoading,
  selectedStep,
  stepDetailData,
  stepDetailLoading,
  errorCards,
  onToggleExpand,
  onRetry,
  onStoryRetry,
  onStop,
  onResume,
  onDelete,
  onStepClick,
}: RunCardInlineProps) {
  // Task 4: Fix Array.sort mutation — use spread copy before sorting
  const steps = [...run.steps].sort((a, b) => {
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

  // Phase grouping for feature-dev workflow (the main one with PIPELINE_PHASES)
  const phaseGroups = groupStepsByPhase(allSteps);
  const hasPhases = run.workflow === "feature-dev" || phaseGroups.every(g => g.phase !== "OTHER");

  // Find the selected step data for the detail panel
  const selectedStepData = selectedStep ? allSteps.find(s => s.stepId === selectedStep) : null;

  return (
    <div className={`af-pipeline__run af-pipeline__run--${run.status}`}>
      <div className="af-pipeline__header" onClick={onToggleExpand} style={{ cursor: "pointer" }}>
        <span className={`af-pipeline__status af-pipeline__status--${run.status}`}>
          {run.status === "running" && <span className="af-pulse" />}
          {run.status.toUpperCase()}
        </span>
        {run.runNumber && <span className="af-pipeline__run-id">#{run.runNumber}</span>}
        <span className="af-pipeline__wf">{run.workflow}</span>
        <span className="af-pipeline__task">{truncate(extractTitle(run.task), 60)}</span>
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
            <div
              className={`af-step ${statusClass(step.status)} ${step.status === "failed" ? "af-step--failed-highlight" : ""} ${selectedStep === step.stepId ? "af-step--selected" : ""}`}
              title={`${step.stepId} (${step.agent?.split("/").pop() || "?"})`}
              onClick={(e) => { e.stopPropagation(); onStepClick(run.id, step.stepId); }}
              style={{ cursor: "pointer" }}
            >
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

      {/* Task 2 & 3: Step Detail Drill-Down Panel */}
      {selectedStep && selectedStepData && (
        <div className={`af-step-detail ${selectedStepData.status === "failed" ? "af-step-detail--failed" : ""}`}>
          <div className="af-step-detail__header">
            <span className="af-step-detail__title">
              {STEP_LABELS[selectedStepData.stepId] || selectedStepData.stepId.toUpperCase()}
            </span>
            <span className={`af-step-detail__status af-step-detail__status--${selectedStepData.status}`}>
              {selectedStepData.status.toUpperCase()}
            </span>
            {selectedStepData.agent && (
              <span className="af-step-detail__agent">Agent: {selectedStepData.agent.split("/").pop()}</span>
            )}
            <button className="af-step-detail__close" onClick={(e) => { e.stopPropagation(); onStepClick(run.id, selectedStep); }}>
              &times;
            </button>
          </div>
          <div className="af-step-detail__body">
            <div className="af-step-detail__meta">
              {stepDetailData?.implementPhase && (
                <span className="af-step-detail__meta-item af-step-detail__meta-item--phase">
                  Phase: {stepDetailData.implementPhase === "foundation" ? "1/3 Foundation" : stepDetailData.implementPhase === "core" ? "2/3 Core" : stepDetailData.implementPhase === "ui" ? "3/3 UI" : stepDetailData.implementPhase}
                </span>
              )}
              {selectedStepData.retryCount > 0 && (
                <span className="af-step-detail__meta-item af-step-detail__meta-item--orange">
                  Retries: {selectedStepData.retryCount}
                </span>
              )}
              {selectedStepData.abandonedCount > 0 && (
                <span className="af-step-detail__meta-item af-step-detail__meta-item--red">
                  Abandoned: {selectedStepData.abandonedCount}
                </span>
              )}
              {stepDetailData?.duration && (
                <span className="af-step-detail__meta-item">
                  Duration: {stepDetailData.duration}
                </span>
              )}
              {stepDetailData?.startedAt && (
                <span className="af-step-detail__meta-item">
                  Started: {new Date(stepDetailData.startedAt).toLocaleTimeString()}
                </span>
              )}
              {stepDetailData?.completedAt && (
                <span className="af-step-detail__meta-item">
                  Completed: {new Date(stepDetailData.completedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
            {stepDetailLoading && (
              <div className="af-step-detail__loading">Loading step details...</div>
            )}
            {/* Task 3: Diagnostic Error Cards for failed steps */}
            {selectedStepData.status === "failed" && (() => {
              const stepErrors = errorCards.filter(e => e.stepId === selectedStepData.stepId);
              if (stepErrors.length > 0) {
                return stepErrors.map((err, i) => (
                  <ErrorCard
                    key={`${err.stepId}-${i}`}
                    category={err.category}
                    message={err.message}
                    suggestion={err.suggestion}
                    severity={err.severity}
                    stepId={err.stepId}
                    runId={run.id}
                    onRetry={() => onRetry(run.id, err.stepId)}
                  />
                ));
              }
              // Fallback: raw error if no classified cards available
              if (stepDetailData?.error) {
                return (
                  <div className="af-step-detail__error">
                    <span className="af-step-detail__error-label">ERROR</span>
                    <pre className="af-step-detail__error-text">{stepDetailData.error}</pre>
                  </div>
                );
              }
              return null;
            })()}
            {/* Output excerpt for done/failed steps */}
            {(selectedStepData.status === "done" || selectedStepData.status === "failed") && stepDetailData?.output && (
              <div className="af-step-detail__output">
                <span className="af-step-detail__output-label">Output</span>
                <pre className="af-step-detail__output-text">{truncate(stepDetailData.output, 200)}</pre>
              </div>
            )}
            {!stepDetailLoading && !stepDetailData?.output && !stepDetailData?.error && (selectedStepData.status === "done" || selectedStepData.status === "failed") && (
              <div className="af-step-detail__empty">No output available</div>
            )}
          </div>
        </div>
      )}

      {/* Error details shown via step drill-down click — no duplicate list needed */}

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

  // Task 2: Step detail drill-down state — keyed by "runId:stepId"
  const [selectedStepKey, setSelectedStepKey] = useState<string | null>(null);
  const [stepDetailData, setStepDetailData] = useState<StepDetailData | null>(null);
  const [stepDetailLoading, setStepDetailLoading] = useState(false);

  // Task 3: Diagnostic error cards per run
  const [errorCardsMap, setErrorCardsMap] = useState<Record<string, ClassifiedError[]>>({});

  // Fetch error cards for runs that have failed steps
  useEffect(() => {
    const runsWithFailedSteps = (runs || []).filter(r =>
      r.steps.some(s => s.status === "failed") && !errorCardsMap[r.id]
    );
    for (const run of runsWithFailedSteps) {
      api.runErrors(run.id)
        .then(errors => {
          setErrorCardsMap(prev => ({ ...prev, [run.id]: errors }));
        })
        .catch(() => {
          // Silent — error cards are a nice-to-have
        });
    }
  }, [runs]);

  const handleStepClick = useCallback(async (runId: string, stepId: string) => {
    const key = `${runId}:${stepId}`;
    if (selectedStepKey === key) {
      // Toggle off
      setSelectedStepKey(null);
      setStepDetailData(null);
      return;
    }
    setSelectedStepKey(key);
    setStepDetailData(null);
    setStepDetailLoading(true);
    try {
      const detail = await api.runDetail(runId);
      const stepInfo = (detail?.steps || []).find((s: any) => s.id === stepId || s.stepId === stepId);
      if (stepInfo) {
        const startedAt = stepInfo.startedAt || stepInfo.created_at || stepInfo.createdAt;
        const completedAt = stepInfo.completedAt || stepInfo.updated_at || stepInfo.updatedAt;
        let duration: string | undefined;
        if (startedAt && completedAt && (stepInfo.status === "done" || stepInfo.status === "failed")) {
          const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
          if (ms > 0) {
            const mins = Math.floor(ms / 60000);
            const secs = Math.floor((ms % 60000) / 1000);
            duration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
          }
        }
        // Extract implement_phase from run context for phased development indicator
        let implementPhase: string | undefined;
        if (stepId === "implement") {
          try {
            const ctx = typeof detail?.context === "string" ? JSON.parse(detail.context) : detail?.context;
            if (ctx?.implement_phase) implementPhase = ctx.implement_phase;
          } catch { /* ignore parse errors */ }
        }

        setStepDetailData({
          output: stepInfo.output || undefined,
          error: stepInfo.error || (stepInfo.status === "failed" ? stepInfo.output : undefined) || undefined,
          duration,
          startedAt,
          completedAt,
          implementPhase,
        });
      }
    } catch (err) {
      console.error("Failed to fetch step detail:", err);
    } finally {
      setStepDetailLoading(false);
    }
  }, [selectedStepKey]);

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
      {filteredRuns.map((run) => {
        const runStepKey = selectedStepKey?.startsWith(run.id + ":") ? selectedStepKey : null;
        const currentSelectedStep = runStepKey ? runStepKey.split(":").slice(1).join(":") : null;
        return (
          <RunCardInline
            key={run.id}
            run={run}
            isExpanded={expandedRun === run.id}
            retrying={retrying}
            actionLoading={actionLoading}
            selectedStep={currentSelectedStep}
            stepDetailData={runStepKey ? stepDetailData : null}
            stepDetailLoading={runStepKey ? stepDetailLoading : false}
            errorCards={errorCardsMap[run.id] || []}
            onToggleExpand={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
            onRetry={handleRetry}
            onStoryRetry={handleStoryRetry}
            onStop={handleStop}
            onResume={handleResume}
            onDelete={openDeleteModal}
            onStepClick={handleStepClick}
          />
        );
      })}

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
