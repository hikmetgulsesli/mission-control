import React, { useState, useCallback, useEffect, memo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { ConfirmDialog } from "./ConfirmDialog";
import { ErrorCard } from "./pipeline/ErrorCard";
import { useOperationalSnapshots } from "../hooks/useOperationalSnapshot";
import {
  evaluateOperationalAction,
  operationalStateReason,
  type OperationalSnapshotState,
} from "../lib/operational-snapshot";
import { normalizeVisibleWorkflowStatus } from "../lib/status";

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
  storyProgress: { completed: number; total: number; done?: number; verified?: number; skipped?: number; running?: number; pending?: number; failed?: number };
  currentStoryId?: string | null;
  currentStoryTitle?: string | null;
  currentStoryStatus?: string | null;
  currentStoryRetry?: number;
  currentStoryMaxRetries?: number;
  nextStoryId?: string | null;
  nextStoryTitle?: string | null;
  nextStoryStatus?: string | null;
  blockerStepId?: string | null;
  blockerSummary?: string | null;
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
  const status = normalizeVisibleWorkflowStatus(s);
  if (status === "done") return "af-step--done";
  if (status === "running") return "af-step--running";
  if (status === "failed") return "af-step--failed";
  return "af-step--pending";
}

function extractTitle(task: string): string {
  const projeMatch = task.match(/Project:\s*([^\s]+)/);
  const aciklamaMatch = task.match(/Description:\s*(.+)/i);
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
  operationalSnapshot: OperationalSnapshotState;
  isExpanded: boolean;
  actionLoading: string | null;
  selectedStep: string | null;
  stepDetailData: StepDetailData | null;
  stepDetailLoading: boolean;
  errorCards: ClassifiedError[];
  onToggleExpand: () => void;
  onStop: (runId: string, snapshotHash: string) => void;
  onResume: (runId: string, snapshotHash: string) => void;
  onStepClick: (runId: string, stepId: string) => void;
  onOpenDetail: (runId: string) => void;
}

const RunCardInline = memo(function RunCardInline({
  run,
  operationalSnapshot,
  isExpanded,
  actionLoading,
  selectedStep,
  stepDetailData,
  stepDetailLoading,
  errorCards,
  onToggleExpand,
  onStop,
  onResume,
  onStepClick,
  onOpenDetail,
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
  const storyRetry = Number(run.currentStoryRetry || 0);
  const storyMaxRetries = Number(run.currentStoryMaxRetries || 0);
  const canonicalSnapshot = operationalSnapshot.status === "ok" ? operationalSnapshot.snapshot : null;
  const canonicalStatus = canonicalSnapshot?.run.status || "unknown";
  const stopAuthority = evaluateOperationalAction(operationalSnapshot, "stop");
  const resumeAuthority = evaluateOperationalAction(operationalSnapshot, "resume");
  const showStop = canonicalSnapshot ? !canonicalSnapshot.run.terminal : run.status === "running";
  const showResume = canonicalSnapshot ? canonicalSnapshot.run.terminal : run.status === "failed" || run.status === "cancelled";
  const hasStoryLine = Boolean(run.currentStoryId || run.nextStoryId || run.blockerSummary);

  // Phase grouping for feature-dev workflow (the main one with PIPELINE_PHASES)
  const phaseGroups = groupStepsByPhase(allSteps);
  const hasPhases = run.workflow === "feature-dev" || phaseGroups.every(g => g.phase !== "OTHER");

  // Find the selected step data for the detail panel
  const selectedStepData = selectedStep ? allSteps.find(s => s.stepId === selectedStep) : null;

  return (
    <div className={`af-pipeline__run af-pipeline__run--${canonicalStatus}`}>
      <div className="af-pipeline__header">
        <span
          className={`af-pipeline__status af-pipeline__status--${canonicalStatus}`}
          title={operationalStateReason(operationalSnapshot)}
        >
          {canonicalStatus === "running" && <span className="af-pulse" />}
          {canonicalStatus.toUpperCase()}
        </span>
        {run.runNumber && <span className="af-pipeline__run-id">#{run.runNumber}</span>}
        <span className="af-pipeline__wf">{run.workflow}</span>
        <span className={`af-pipeline__evidence af-pipeline__evidence--${canonicalSnapshot?.source.projection || operationalSnapshot.status}`}>
          {canonicalSnapshot ? `${canonicalSnapshot.source.projection} · ${canonicalSnapshot.summary.lifecycleState}` : operationalSnapshot.status.replace("_", " ")}
        </span>
        <span className="af-pipeline__task">{truncate(extractTitle(run.task), 60)}</span>
        <span className="af-pipeline__run-actions" onClick={(e) => e.stopPropagation()}>
          {showStop ? (
            <button
              className="af-run-btn af-run-btn--stop"
              onClick={() => stopAuthority.snapshotHash && onStop(run.id, stopAuthority.snapshotHash)}
              disabled={!stopAuthority.allowed || actionLoading === run.id + ":stop"}
              title={stopAuthority.reasonCode}
            >
              {actionLoading === run.id + ":stop" ? "..." : "\u23F8"}
            </button>
          ) : showResume ? (
            <button
              className="af-run-btn af-run-btn--resume"
              onClick={() => resumeAuthority.snapshotHash && onResume(run.id, resumeAuthority.snapshotHash)}
              disabled={!resumeAuthority.allowed || actionLoading === run.id + ":resume"}
              title={resumeAuthority.reasonCode}
            >
              {actionLoading === run.id + ":resume" ? "..." : "\u25B6"}
            </button>
          ) : null}
          <button className="af-run-btn af-run-btn--detail" onClick={() => onOpenDetail(run.id)} title="Open run detail">
            DETAIL
          </button>
          <button
            className="af-run-btn af-run-btn--delete"
            disabled
            title="OPERATIONAL_ACTION_NOT_DEFINED_IN_SNAPSHOT_V1"
          >
            LOCKED
          </button>
          <button className="af-run-btn af-run-btn--expand" onClick={onToggleExpand} title={isExpanded ? "Hide preview" : "Show preview"}>
            {isExpanded ? "\u25B2" : "\u25BC"}
          </button>
        </span>
      </div>

      <div className="af-pipeline__legacy-note">
        Pipeline steps, story progress, and diagnostic text below are read-only planning context. Canonical snapshot controls status and actions.
      </div>

      {hasStoryLine && (
        <div className="af-pipeline__storyline">
          {run.currentStoryId && (
            <span className="af-pipeline__story-pill">
              <b>{run.currentStoryId}</b>
              {run.currentStoryStatus && <span>{normalizeVisibleWorkflowStatus(run.currentStoryStatus)}</span>}
              {storyMaxRetries > 0 && <span>R{storyRetry}/{storyMaxRetries}</span>}
              {run.currentStoryTitle && <span title={run.currentStoryTitle}>{truncate(run.currentStoryTitle, 54)}</span>}
            </span>
          )}
          {run.nextStoryId && run.nextStoryId !== run.currentStoryId && (
            <span className="af-pipeline__story-pill af-pipeline__story-pill--next">
              <b>Next {run.nextStoryId}</b>
              {run.nextStoryStatus && <span>{normalizeVisibleWorkflowStatus(run.nextStoryStatus)}</span>}
              {run.nextStoryTitle && <span title={run.nextStoryTitle}>{truncate(run.nextStoryTitle, 54)}</span>}
            </span>
          )}
          {run.blockerSummary && (
            <span className="af-pipeline__story-pill af-pipeline__story-pill--blocker" title={run.blockerSummary}>
              <b>{run.blockerStepId || "blocker"}</b>
              <span>{truncate(run.blockerSummary, 110)}</span>
            </span>
          )}
        </div>
      )}

      <div className="af-pipeline__steps">
        {allSteps.map((step, i) => {
          const stepStatus = normalizeVisibleWorkflowStatus(step.status);
          return (
            <div key={`${step.stepId}-${i}`} className="af-step-wrapper">
              {i > 0 && <span className="af-step-arrow">&rarr;</span>}
              <div
                className={`af-step ${statusClass(stepStatus)} ${stepStatus === "failed" ? "af-step--failed-highlight" : ""} ${selectedStep === step.stepId ? "af-step--selected" : ""}`}
                title={`${step.stepId} (${step.agent?.split("/").pop() || "?"})`}
                onClick={(e) => { e.stopPropagation(); onStepClick(run.id, step.stepId); }}
                style={{ cursor: "pointer" }}
              >
                <div className="af-step__label">{STEP_LABELS[step.stepId] || step.stepId.toUpperCase()}</div>
                {step.agent && <div className="af-step__agent">{step.agent.split("/").pop()}</div>}
                {stepStatus === "running" && <div className="af-step__pulse" />}
                {step.retryCount > 0 && <div className="af-step__retry">R{step.retryCount}</div>}
                {stepStatus === "failed" && (
                  <button
                    className="af-step__retry-btn"
                    onClick={(e) => e.stopPropagation()}
                    disabled
                    title="OPERATIONAL_ACTION_NOT_DEFINED_IN_SNAPSHOT_V1"
                  >
                    LOCKED
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task 2 & 3: Step Detail Drill-Down Panel */}
      {selectedStep && selectedStepData && (() => {
        const selectedStatus = normalizeVisibleWorkflowStatus(selectedStepData.status);
        return (
        <div className={`af-step-detail ${selectedStatus === "failed" ? "af-step-detail--failed" : ""}`}>
          <div className="af-step-detail__header">
            <span className="af-step-detail__title">
              {STEP_LABELS[selectedStepData.stepId] || selectedStepData.stepId.toUpperCase()}
            </span>
            <span className={`af-step-detail__status af-step-detail__status--${selectedStatus}`}>
              {selectedStatus.toUpperCase()}
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
            {selectedStatus === "failed" && (() => {
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
            {(selectedStatus === "done" || selectedStatus === "failed") && stepDetailData?.output && (
              <div className="af-step-detail__output">
                <span className="af-step-detail__output-label">Output</span>
                <pre className="af-step-detail__output-text">{truncate(stepDetailData.output, 200)}</pre>
              </div>
            )}
            {!stepDetailLoading && !stepDetailData?.output && !stepDetailData?.error && (selectedStatus === "done" || selectedStatus === "failed") && (
              <div className="af-step-detail__empty">No output available</div>
            )}
          </div>
        </div>
        );
      })()}

      {/* Error details shown via step drill-down click — no duplicate list needed */}

      {/* Progress bar */}
      {run.storyProgress.total > 0 && (() => {
        const t = run.storyProgress.total;
        const sp = run.storyProgress as any;
        const verifiedPct = ((sp.verified || 0) / t) * 100;
        const donePct = ((sp.done || 0) / t) * 100;
        const failedPct = (((sp.failed || 0) + (sp.skipped || 0)) / t) * 100;
        const runningPct = ((sp.running || 0) / t) * 100;
        return (
          <div className="af-pipeline__actions">
            <div className="af-pipeline__progress">
              <div className="af-pipeline__progress-bar" style={{ display: "flex", overflow: "hidden" }}>
                {verifiedPct > 0 && <div style={{ width: `${verifiedPct}%`, background: "#22c55e", height: "100%", transition: "width .3s" }} title={`${sp.verified} verified`} />}
                {donePct > 0 && <div style={{ width: `${donePct}%`, background: "#3b82f6", height: "100%", transition: "width .3s" }} title={`${sp.done} done`} />}
                {failedPct > 0 && <div style={{ width: `${failedPct}%`, background: "#ff0040", height: "100%", transition: "width .3s" }} title={`${(sp.failed || 0) + (sp.skipped || 0)} failed`} />}
                {runningPct > 0 && <div style={{ width: `${runningPct}%`, background: "#f59e0b", height: "100%", transition: "width .3s" }} title={`${sp.running} running`} />}
              </div>
              <span className="af-pipeline__progress-text">
                {run.storyProgress.completed}/{run.storyProgress.total} stories ({progressPct}%)
                <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>
                  {sp.verified > 0 && <span style={{ color: "#22c55e" }}>{sp.verified} verified </span>}
                  {sp.done > 0 && <span style={{ color: "#3b82f6" }}>{sp.done} done </span>}
                  {sp.running > 0 && <span style={{ color: "#f59e0b" }}>{sp.running} running </span>}
                  {((sp.failed || 0) + (sp.skipped || 0)) > 0 && <span style={{ color: "#ff0040" }}>{(sp.failed || 0) + (sp.skipped || 0)} failed</span>}
                </span>
              </span>
            </div>
          </div>
        );
      })()}

      {/* Expanded: compact run preview. Full contract/design/story detail lives on the Run page. */}
      {isExpanded && (
        <div className="af-pipeline__expanded af-pipeline__expanded--preview">
          <div className="af-run-preview">
            <div className="af-run-preview__cell">
              <span>Current</span>
              <strong>{run.currentStoryId || run.blockerStepId || normalizeVisibleWorkflowStatus(run.currentStoryStatus || run.status)}</strong>
              <em>{truncate(run.currentStoryTitle || run.blockerSummary || extractTitle(run.task), 92)}</em>
            </div>
            <div className="af-run-preview__cell">
              <span>Stories</span>
              <strong>{run.storyProgress.completed}/{run.storyProgress.total || 0}</strong>
              <em>
                {Number((run.storyProgress as any).verified || 0)} verified
                {Number((run.storyProgress as any).running || 0) > 0 ? `, ${(run.storyProgress as any).running} running` : ""}
                {Number((run.storyProgress as any).failed || 0) > 0 ? `, ${(run.storyProgress as any).failed} failed` : ""}
              </em>
            </div>
            <button className="af-run-preview__open" onClick={() => onOpenDetail(run.id)}>
              Open Run Detail
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export function PipelineView({ runs, onRefresh }: { runs: PipelineRun[]; onRefresh?: () => void }) {
  const navigate = useNavigate();
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stopConfirm, setStopConfirm] = useState<{ runId: string; snapshotHash: string } | null>(null);
  const operationalSnapshots = useOperationalSnapshots((runs || []).map((run) => run.id), 5_000);

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
  const canonicalStatus = (run: PipelineRun): string | null => {
    const state = operationalSnapshots[run.id];
    return state?.status === "ok" ? state.snapshot.run.status : null;
  };
  const filteredRuns = (runs || [])
    .filter(r => !HIDDEN_WORKFLOWS.includes(r.workflow))
    .filter(r => statusFilter === "all" || canonicalStatus(r) === statusFilter)
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
            {(runs || []).filter(r => !HIDDEN_WORKFLOWS.includes(r.workflow) && canonicalStatus(r) === s).length}
          </span>}
        </button>
      ))}
    </div>
  );

  if (filteredRuns.length === 0) {
    return <div className="af-pipeline">{filterBar}<div className="af-empty">No runs found</div></div>;
  }

  const handleStop = (runId: string, snapshotHash: string) => {
    setStopConfirm({ runId, snapshotHash });
  };

  const handleStopConfirmed = async () => {
    if (!stopConfirm) return;
    const { runId, snapshotHash } = stopConfirm;
    setStopConfirm(null);
    setActionLoading(runId + ":stop");
    try {
      await api.stopRun(runId, snapshotHash);
      setActionNotice("");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setActionNotice(`Stop failed: ${err.message || String(err)}`);
    }
    finally { setActionLoading(null); }
  };

  const handleResume = async (runId: string, snapshotHash: string) => {
    setActionLoading(runId + ":resume");
    try {
      await api.resumeRun(runId, snapshotHash);
      setActionNotice("");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setActionNotice(`Resume failed: ${err.message || String(err)}`);
    }
    finally { setActionLoading(null); }
  };

  const handleOpenDetail = useCallback((runId: string) => {
    navigate(`/setfarm/runs/${runId}`);
  }, [navigate]);

  return (
    <div className="af-pipeline">
      {filterBar}
      {actionNotice && <div className="af-pipeline__authority-notice">{actionNotice}</div>}
      {filteredRuns.map((run) => {
        const runStepKey = selectedStepKey?.startsWith(run.id + ":") ? selectedStepKey : null;
        const currentSelectedStep = runStepKey ? runStepKey.split(":").slice(1).join(":") : null;
        return (
          <RunCardInline
            key={run.id}
            run={run}
            operationalSnapshot={operationalSnapshots[run.id] || { status: "loading" }}
            isExpanded={expandedRun === run.id}
            actionLoading={actionLoading}
            selectedStep={currentSelectedStep}
            stepDetailData={runStepKey ? stepDetailData : null}
            stepDetailLoading={runStepKey ? stepDetailLoading : false}
            errorCards={errorCardsMap[run.id] || []}
            onToggleExpand={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
            onStop={handleStop}
            onResume={handleResume}
            onStepClick={handleStepClick}
            onOpenDetail={handleOpenDetail}
          />
        );
      })}

      <ConfirmDialog
        open={!!stopConfirm}
        title="Stop Workflow"
        message="Stop this workflow?"
        confirmLabel="Stop"
        onConfirm={handleStopConfirmed}
        onCancel={() => setStopConfirm(null)}
      />
    </div>
  );
}
