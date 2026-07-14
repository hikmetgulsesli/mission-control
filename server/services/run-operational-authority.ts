import {
  type OperationalSnapshotFetchResult,
  type RunOperationalSnapshotV1,
} from "./setfarm-operational-snapshot.js";

export const OPERATIONAL_ACTION_SNAPSHOT_MAX_AGE_MS = 15_000;

export type RunOperationalAction = "stop" | "resume";

export type OperationalAuthorityCode =
  | "OPERATIONAL_SNAPSHOT_HASH_REQUIRED"
  | "OPERATIONAL_SNAPSHOT_UNAVAILABLE"
  | "OPERATIONAL_SNAPSHOT_UNSUPPORTED"
  | "OPERATIONAL_SNAPSHOT_RUN_MISMATCH"
  | "OPERATIONAL_SNAPSHOT_STALE"
  | "OPERATIONAL_SNAPSHOT_CHANGED"
  | "OPERATIONAL_PROJECTION_INCOMPLETE"
  | "OPERATIONAL_INVARIANT_VIOLATION"
  | "OPERATIONAL_ACTION_NOT_ALLOWED"
  | "COMPILER_PROTOCOL_MANUAL_RESUME_DISABLED";

export interface OperationalAuthorityFailure {
  status: "blocked";
  statusCode: 409 | 428 | 503;
  code: OperationalAuthorityCode;
  reason?: string;
}

export interface OperationalActionAuthority {
  status: "authorized";
  action: RunOperationalAction;
  runId: string;
  snapshotHash: string;
  protocol: "legacy" | "shadow" | "v3" | null;
}

export type OperationalActionAuthorityResult = OperationalActionAuthority | OperationalAuthorityFailure;

export interface OperationalSnapshotReader {
  get(runId: string): Promise<OperationalSnapshotFetchResult>;
}

function unavailableResult(result: Exclude<OperationalSnapshotFetchResult, { status: "ok" }>): OperationalAuthorityFailure {
  if (result.status === "unsupported_schema") {
    return {
      status: "blocked",
      statusCode: 503,
      code: "OPERATIONAL_SNAPSHOT_UNSUPPORTED",
      reason: result.schema ?? "missing_schema",
    };
  }
  return {
    status: "blocked",
    statusCode: 503,
    code: "OPERATIONAL_SNAPSHOT_UNAVAILABLE",
    reason: result.reason,
  };
}

function validateFreshCanonicalSnapshot(input: {
  runId: string;
  expectedSnapshotHash?: string;
  snapshotResult: OperationalSnapshotFetchResult;
  nowMs: number;
  requireExpectedHash: boolean;
}): RunOperationalSnapshotV1 | OperationalAuthorityFailure {
  if (input.requireExpectedHash && !input.expectedSnapshotHash) {
    return {
      status: "blocked",
      statusCode: 428,
      code: "OPERATIONAL_SNAPSHOT_HASH_REQUIRED",
    };
  }
  if (input.snapshotResult.status !== "ok") return unavailableResult(input.snapshotResult);

  const { snapshot } = input.snapshotResult;
  if (snapshot.run.id !== input.runId) {
    return {
      status: "blocked",
      statusCode: 409,
      code: "OPERATIONAL_SNAPSHOT_RUN_MISMATCH",
    };
  }
  const generatedAtMs = Date.parse(snapshot.generatedAt);
  if (!Number.isFinite(generatedAtMs)
    || generatedAtMs > input.nowMs + 1_000
    || input.nowMs - generatedAtMs > OPERATIONAL_ACTION_SNAPSHOT_MAX_AGE_MS) {
    return {
      status: "blocked",
      statusCode: 409,
      code: "OPERATIONAL_SNAPSHOT_STALE",
    };
  }
  if (input.expectedSnapshotHash && snapshot.snapshotHash !== input.expectedSnapshotHash) {
    return {
      status: "blocked",
      statusCode: 409,
      code: "OPERATIONAL_SNAPSHOT_CHANGED",
    };
  }
  if (snapshot.source.projection !== "complete"
    || !Object.values(snapshot.source.capabilities).every(Boolean)) {
    return {
      status: "blocked",
      statusCode: 409,
      code: "OPERATIONAL_PROJECTION_INCOMPLETE",
    };
  }
  if (snapshot.invariants.length > 0
    || snapshot.summary.invariantViolations !== 0
    || snapshot.summary.lifecycleState === "inconsistent") {
    return {
      status: "blocked",
      statusCode: 409,
      code: "OPERATIONAL_INVARIANT_VIOLATION",
    };
  }
  return snapshot;
}

export function evaluateOperationalActionAuthority(input: {
  action: RunOperationalAction;
  runId: string;
  expectedSnapshotHash?: string;
  snapshotResult: OperationalSnapshotFetchResult;
  nowMs?: number;
}): OperationalActionAuthorityResult {
  const snapshot = validateFreshCanonicalSnapshot({
    runId: input.runId,
    ...(input.expectedSnapshotHash === undefined ? {} : { expectedSnapshotHash: input.expectedSnapshotHash }),
    snapshotResult: input.snapshotResult,
    nowMs: input.nowMs ?? Date.now(),
    requireExpectedHash: true,
  });
  if (!("schema" in snapshot)) return snapshot;

  if (input.action === "resume" && snapshot.run.protocol !== "legacy") {
    return {
      status: "blocked",
      statusCode: 409,
      code: "COMPILER_PROTOCOL_MANUAL_RESUME_DISABLED",
    };
  }
  const projectedAction = snapshot.summary.operatorActions[input.action];
  if (!projectedAction.allowed) {
    return {
      status: "blocked",
      statusCode: 409,
      code: "OPERATIONAL_ACTION_NOT_ALLOWED",
      reason: projectedAction.reasonCode,
    };
  }
  return {
    status: "authorized",
    action: input.action,
    runId: snapshot.run.id,
    snapshotHash: snapshot.snapshotHash,
    protocol: snapshot.run.protocol,
  };
}

export async function authorizeOperationalAction(input: {
  action: RunOperationalAction;
  runId: string;
  expectedSnapshotHash?: string;
  snapshotReader: OperationalSnapshotReader;
  nowMs?: number;
}): Promise<OperationalActionAuthorityResult> {
  const snapshotResult = await input.snapshotReader.get(input.runId);
  return evaluateOperationalActionAuthority({
    action: input.action,
    runId: input.runId,
    ...(input.expectedSnapshotHash === undefined ? {} : { expectedSnapshotHash: input.expectedSnapshotHash }),
    snapshotResult,
    ...(input.nowMs === undefined ? {} : { nowMs: input.nowMs }),
  });
}
