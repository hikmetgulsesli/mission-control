import {
  isSetfarmOperationalActiveRunStatusV1,
  type SetfarmOperationalActiveRunStatusV1,
} from "../shared/setfarm-operational-active-run-status-v1.js";

export { getProjectRunRows } from "../utils/setfarm-db.js";

export interface ProjectRunRow {
  id: string;
  runNumber: number;
  protocol: "legacy" | "shadow" | "v3" | null;
  status: string;
  updatedAt: string | null;
}

export interface ProjectRunBindingHints {
  projectId: string;
  latestRunId: string | null;
  workflowRunId: string | null;
  setfarmRunIds: string[];
  latestRunNumber: number | null;
  runNumber: number | null;
}

export type ProjectRunBinding =
  | { status: "bound"; row: ProjectRunRow; source: "latest_run_id" | "workflow_run_id" | "setfarm_run_ids" | "latest_run_number" | "run_number" }
  | { status: "unbound"; reasonCode: "PROJECT_RUN_IDENTITY_ABSENT" | "PROJECT_RUN_NOT_FOUND" }
  | { status: "conflict"; reasonCode: "PROJECT_RUN_IDENTITY_CONFLICT" };

export interface ProjectExecutionState {
  schema: "mission-control.project-execution.v1";
  state: SetfarmOperationalActiveRunStatusV1 | "terminal" | "unbound" | "unavailable";
  active: boolean;
  runId: string | null;
  runStatus: string | null;
  protocol: "legacy" | "shadow" | "v3" | null;
  source: "setfarm_postgres_run" | "none";
  reasonCode: string;
}

function stringHint(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function runNumberHint(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function normalizedHints(hints: ProjectRunBindingHints): ProjectRunBindingHints {
  const setfarmRunIds = [...new Set((Array.isArray(hints.setfarmRunIds) ? hints.setfarmRunIds : [])
    .map(stringHint)
    .filter((value): value is string => value !== null))];
  return {
    projectId: stringHint(hints.projectId) ?? "",
    latestRunId: stringHint(hints.latestRunId),
    workflowRunId: stringHint(hints.workflowRunId),
    setfarmRunIds,
    latestRunNumber: runNumberHint(hints.latestRunNumber),
    runNumber: runNumberHint(hints.runNumber),
  };
}

export function projectRunBindingHints(project: Record<string, unknown>): ProjectRunBindingHints {
  return normalizedHints({
    projectId: typeof project.id === "string" ? project.id : "",
    latestRunId: typeof project.latestRunId === "string" ? project.latestRunId : null,
    workflowRunId: typeof project.workflowRunId === "string" ? project.workflowRunId : null,
    setfarmRunIds: Array.isArray(project.setfarmRunIds) ? project.setfarmRunIds.filter((value): value is string => typeof value === "string") : [],
    latestRunNumber: typeof project.latestRunNumber === "number" ? project.latestRunNumber : null,
    runNumber: typeof project.runNumber === "number" ? project.runNumber : null,
  });
}

function missingBinding(): ProjectRunBinding {
  return { status: "unbound", reasonCode: "PROJECT_RUN_NOT_FOUND" };
}

export function bindProjectRun(input: ProjectRunBindingHints, rows: readonly ProjectRunRow[]): ProjectRunBinding {
  const hints = normalizedHints(input);
  if (hints.latestRunId && hints.workflowRunId && hints.latestRunId !== hints.workflowRunId) {
    return { status: "conflict", reasonCode: "PROJECT_RUN_IDENTITY_CONFLICT" };
  }

  const singularRunId = hints.latestRunId ?? hints.workflowRunId;
  if (singularRunId) {
    const row = rows.find((candidate) => candidate.id === singularRunId);
    if (!row) return missingBinding();
    return {
      status: "bound",
      row,
      source: hints.latestRunId ? "latest_run_id" : "workflow_run_id",
    };
  }

  if (hints.setfarmRunIds.length > 0) {
    const ids = new Set(hints.setfarmRunIds);
    const matching = rows.filter((candidate) => ids.has(candidate.id));
    if (matching.length === 0) return missingBinding();
    const greatestRunNumber = Math.max(...matching.map((candidate) => candidate.runNumber));
    const selected = matching.filter((candidate) => candidate.runNumber === greatestRunNumber);
    if (selected.length !== 1) return { status: "conflict", reasonCode: "PROJECT_RUN_IDENTITY_CONFLICT" };
    return { status: "bound", row: selected[0]!, source: "setfarm_run_ids" };
  }

  if (hints.latestRunNumber && hints.runNumber && hints.latestRunNumber !== hints.runNumber) {
    return { status: "conflict", reasonCode: "PROJECT_RUN_IDENTITY_CONFLICT" };
  }
  const singularRunNumber = hints.latestRunNumber ?? hints.runNumber;
  if (singularRunNumber) {
    const matching = rows.filter((candidate) => candidate.runNumber === singularRunNumber);
    if (matching.length === 0) return missingBinding();
    if (matching.length !== 1) return { status: "conflict", reasonCode: "PROJECT_RUN_IDENTITY_CONFLICT" };
    return {
      status: "bound",
      row: matching[0]!,
      source: hints.latestRunNumber ? "latest_run_number" : "run_number",
    };
  }

  return { status: "unbound", reasonCode: "PROJECT_RUN_IDENTITY_ABSENT" };
}

function stateForBinding(binding: ProjectRunBinding): ProjectExecutionState {
  if (binding.status !== "bound") {
    return {
      schema: "mission-control.project-execution.v1",
      state: binding.status === "unbound" ? "unbound" : "unavailable",
      active: false,
      runId: null,
      runStatus: null,
      protocol: null,
      source: "none",
      reasonCode: binding.reasonCode,
    };
  }

  const { row } = binding;
  if (isSetfarmOperationalActiveRunStatusV1(row.status)) {
    return {
      schema: "mission-control.project-execution.v1", state: row.status, active: true,
      runId: row.id, runStatus: row.status, protocol: row.protocol,
      source: "setfarm_postgres_run", reasonCode: "PROJECT_RUN_BOUND",
    };
  }
  const terminal = new Set(["completed", "done", "failed", "cancelled", "canceled"]);
  return {
    schema: "mission-control.project-execution.v1",
    state: terminal.has(row.status) ? "terminal" : "unavailable",
    active: false,
    runId: row.id,
    runStatus: row.status,
    protocol: row.protocol,
    source: "setfarm_postgres_run",
    reasonCode: terminal.has(row.status) ? "PROJECT_RUN_TERMINAL" : "PROJECT_RUN_STATUS_UNAVAILABLE",
  };
}

export function deriveProjectExecutionState(binding: ProjectRunBinding): ProjectExecutionState {
  return stateForBinding(binding);
}
