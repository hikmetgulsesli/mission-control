export const RUN_OPERATIONAL_SNAPSHOT_V1_SCHEMA = "setfarm.run-operational-snapshot.v1" as const;
export const OPERATIONAL_SNAPSHOT_MAX_AGE_MS = 15_000;

type Nullable<T> = T | null;

export interface OperationalProjectionCapabilitiesV1 {
  attempts: boolean;
  claimBinding: boolean;
  runtimeOwnership: boolean;
  managerCompletion: boolean;
  effectLedger: boolean;
  findingRecovery: boolean;
  evidenceLedger: boolean;
  acceptedCandidate: boolean;
  deploymentReceipt: boolean;
  projectTransferAck: boolean;
}

export interface OperationalProjectionSourceV1 {
  database: "postgres";
  projection: "complete" | "partial" | "unavailable";
  migrationVersions: number[];
  verifiedReleaseSha: Nullable<string>;
  capabilities: OperationalProjectionCapabilitiesV1;
}

export interface OperationalRunV1 {
  ref: string;
  id: string;
  runNumber: Nullable<number>;
  protocol: Nullable<"legacy" | "shadow" | "v3">;
  status: string;
  terminal: boolean;
  updatedAt: Nullable<string>;
}

export interface OperationalSummaryV1 {
  lifecycleState:
    | "legacy_untracked"
    | "idle"
    | "claimed"
    | "runtime_active"
    | "completion_requested"
    | "effects_applying"
    | "settled"
    | "terminal"
    | "inconsistent";
  health: "ok" | "attention" | "blocked" | "unavailable";
  activeClaims: number;
  activeAttempts: number;
  activeRuntimes: number;
  openCompletions: number;
  mandatoryEffectsPending: number;
  unpublishedOutbox: number;
  invariantViolations: number;
  operatorActions: {
    stop: { allowed: boolean; reasonCode: string; stateHash: string };
    resume: { allowed: boolean; reasonCode: string; stateHash: string };
  };
}

export interface OperationalClaimV1 {
  ref: string;
  id: string;
  runRef: string;
  stepRef: string;
  storyRef: Nullable<string>;
  workflowStepId: string;
  storyId: Nullable<string>;
  agentId: string;
  state: "open" | "closed";
  outcome: Nullable<string>;
  claimedAt: string;
  abandonedAt: Nullable<string>;
}

export interface OperationalAttemptV1 {
  ref: string;
  attemptId: string;
  runRef: string;
  claimRef: Nullable<string>;
  stepRef: string;
  storyRef: Nullable<string>;
  workflowStepId: string;
  storyId: Nullable<string>;
  generation: number;
  attemptClass: "product_implementation" | "evidence_only" | "infrastructure_retry" | "supervisor_repair";
  packetHash: Nullable<string>;
  compilationReportHash: string;
  sliceHash: Nullable<string>;
  sourceBefore: { sha: string; treeHash: string };
  sourceAfter: Nullable<{ sha: string; treeHash: string }>;
  findingSetHash: Nullable<string>;
  role: string;
  agentId: Nullable<string>;
  disposition:
    | "claimed"
    | "running"
    | "produced_delta"
    | "already_satisfied"
    | "no_progress"
    | "inconclusive"
    | "failed"
    | "verified"
    | "superseded";
  outputHash: Nullable<string>;
  createdAt: string;
  updatedAt: string;
}

export interface OperationalRuntimeSessionV1 {
  ref: string;
  sessionId: string;
  runRef: string;
  claimRef: string;
  attemptRef: Nullable<string>;
  stepRef: string;
  storyRef: Nullable<string>;
  workflowStepId: string;
  storyId: Nullable<string>;
  runtimeKind: "local_process" | "openclaw_session" | "external_session";
  state: "reserved" | "starting" | "running" | "drain_requested" | "drained" | "released" | "quarantined";
  stateVersion: number;
  startedAt: Nullable<string>;
  heartbeatAt: string;
  drainRequestedAt: Nullable<string>;
  drainedAt: Nullable<string>;
  releasedAt: Nullable<string>;
  createdAt: string;
  updatedAt: string;
}

export interface OperationalCompletionEffectV1 {
  ref: string;
  effectKey: string;
  ordinal: number;
  effectType: string;
  inputHash: string;
  mandatory: boolean;
  state: "pending" | "leased" | "applied" | "reconciled" | "quarantined";
  attemptCount: number;
  appliedAt: Nullable<string>;
  reconciledAt: Nullable<string>;
  createdAt: string;
  updatedAt: string;
}

export interface OperationalCompletionRequestV1 {
  ref: string;
  requestId: string;
  runRef: string;
  runtimeSessionRef: string;
  claimRef: string;
  attemptRef: Nullable<string>;
  stepRef: string;
  storyRef: Nullable<string>;
  workflowStepId: string;
  storyId: Nullable<string>;
  outputHash: string;
  applyPhase: "proposed" | "executing" | "owner_committed" | "effects_committed";
  claimOutcome: Nullable<string>;
  completionPlanHash: Nullable<string>;
  state: "requested" | "draining" | "processing" | "accepted" | "rejected" | "quarantined";
  requestedAt: string;
  drainedAt: Nullable<string>;
  processingAt: Nullable<string>;
  acceptedAt: Nullable<string>;
  rejectedAt: Nullable<string>;
  createdAt: string;
  updatedAt: string;
  effects: OperationalCompletionEffectV1[];
}

export type V3DeployAuthorityCode =
  | "V3_DEPLOY_RUN_NOT_FOUND"
  | "V3_DEPLOY_ACCEPTED_CANDIDATE_MISSING"
  | "V3_DEPLOY_ACCEPTED_CANDIDATE_INVALID"
  | "V3_DEPLOY_ACCEPTED_CANDIDATE_POINTER_MISMATCH"
  | "V3_DEPLOY_SOURCE_UNAVAILABLE"
  | "V3_DEPLOY_SOURCE_REVISION_MISMATCH"
  | "V3_DEPLOY_PACKET_INVALID"
  | "V3_DEPLOY_RUNTIME_ENV_MISSING"
  | "V3_DEPLOY_TARGET_UNSUPPORTED"
  | "V3_DEPLOY_PLATFORM_FAILED"
  | "V3_DEPLOY_HEALTH_FAILED"
  | "V3_DEPLOY_ROLLBACK_FAILED";

export interface OperationalTerminationLifecycleEvidenceV1 {
  deferredForCompletionRequestId?: string;
  runtimeSessionCount?: number;
  ownerInstanceId?: string;
}

export interface OperationalV3DeployTerminationEvidenceV1 extends OperationalTerminationLifecycleEvidenceV1 {
  schema: "setfarm.v3-deploy-authority-termination.v1";
  terminalFailure: true;
  owner: "compiler";
  refusalHash: string;
  authorityCode: V3DeployAuthorityCode;
  authorityEvidence: Record<string, string | null>;
  claimId: number;
  modelRedispatchBudget: 0;
}

export interface OperationalV3PlanClarificationTerminationEvidenceV1 extends OperationalTerminationLifecycleEvidenceV1 {
  schema: "setfarm.v3-plan-clarification-termination.v1";
  terminalFailure: true;
  owner: "compiler";
  rejectionHash: string;
  sourceTaskHash: string;
  reasonCodes: string[];
  requirementRefs: string[];
  modelRedispatchBudget: 0;
}

export interface OperationalV3DownstreamTerminationEvidenceV1 extends OperationalTerminationLifecycleEvidenceV1 {
  schema: "setfarm.v3-downstream-termination-evidence.v1";
  routeHash: string;
  packetHash: string;
  sourceRevision: { sha: string; treeHash: string };
  outcome: "packet_amendment_required" | "bounded_recovery_blocked";
  storyEvidenceRefs: string[];
  requiredArtifact?: "setfarm.product-build-packet.v.next";
}

export type OperationalTerminationEvidenceV1 =
  | OperationalV3DeployTerminationEvidenceV1
  | OperationalV3PlanClarificationTerminationEvidenceV1
  | OperationalV3DownstreamTerminationEvidenceV1
  | Record<string, unknown>;

export interface OperationalTerminationRequestV1 {
  ref: string;
  requestId: string;
  runRef: string;
  targetStatus: "cancelled" | "failed";
  state: "requested" | "draining" | "drained" | "terminalized" | "quarantined";
  requestedBy: string;
  diagnostic: string;
  evidence: OperationalTerminationEvidenceV1;
  requestedAt: string;
  drainedAt: Nullable<string>;
  terminalizedAt: Nullable<string>;
  createdAt: string;
  updatedAt: string;
}

export interface OperationalOutboxItemV1 {
  ref: string;
  outboxId: string;
  requestRef: Nullable<string>;
  eventKey: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  state: "pending" | "leased" | "published" | "quarantined";
  attemptCount: number;
  publishedAt: Nullable<string>;
  createdAt: string;
  updatedAt: string;
}

export interface OperationalInvariantV1 {
  code: string;
  severity: "warning" | "error";
  refs: string[];
  observedAt: string;
}

export interface OperationalFindingSetV1 {
  ref: string;
  findingSetId: string;
  findingSetHash: string;
  runRef: string;
  storyRef: string;
  storyId: string;
  packetHash: string;
  sliceHash: string;
  sourceRevision: { sha: string; treeHash: string };
  findingIds: string[];
  createdAt: string;
}

export interface OperationalEvidenceBundleV1 {
  ref: string;
  evidenceId: string;
  evidenceBundleHash: string;
  runRef: string;
  storyRef: string;
  storyId: string;
  attemptRef: Nullable<string>;
  attemptId: Nullable<string>;
  packetHash: string;
  sliceHash: string;
  sourceRevision: { sha: string; treeHash: string };
  aggregateVerdict: "pass" | "fail" | "inconclusive" | "incomplete";
  predicateCount: number;
  observationCount: number;
  createdAt: string;
}

export interface OperationalRecoveryBudgetV1 {
  limits: { implement: number; supervisorRepair: number; evidenceOnly: number };
  used: { implement: number; supervisorRepair: number; evidenceOnly: number };
}

export interface OperationalRecoveryCaseV1 {
  ref: string;
  recoveryCaseId: string;
  revisionRef: string;
  revisionId: string;
  revisionNumber: number;
  runRef: string;
  storyRef: string;
  storyId: string;
  findingSetRef: string;
  findingSetHash: string;
  packetHash: string;
  sliceHash: string;
  sourceRevision: { sha: string; treeHash: string };
  owner: "implement" | "supervisor" | "compiler" | "infrastructure" | "operator";
  expectedDeltaKind: "source_change" | "evidence_refresh" | "upstream_recompile" | "operator_action";
  status: "open" | "repairing" | "evidencing" | "resolved" | "blocked" | "superseded";
  budget: OperationalRecoveryBudgetV1;
  stateVersion: number;
  terminalReasonCode: Nullable<
    | "evidence_satisfied"
    | "specification_incomplete"
    | "evidence_inconclusive"
    | "budget_exhausted"
    | "source_superseded"
    | "upstream_recompile_required"
    | "operator_required"
  >;
  createdAt: string;
  updatedAt: string;
}

export interface OperationalRecoveryDispatchV1 {
  ref: string;
  dispatchId: string;
  recoveryCaseRef: string;
  recoveryCaseId: string;
  revisionRef: string;
  revisionId: string;
  revisionNumber: number;
  runRef: string;
  storyRef: string;
  storyId: string;
  findingSetRef: string;
  findingSetHash: string;
  dispatchClass: "product_implementation" | "supervisor_repair" | "evidence_only";
  packetHash: string;
  sliceHash: string;
  sourceRevision: { sha: string; treeHash: string };
  findingIds: string[];
  deliveryState: "authorized" | "leased" | "attempt_reserved" | "running" | "succeeded" | "failed" | "blocked" | "superseded";
  attemptRef: Nullable<string>;
  attemptId: Nullable<string>;
  claimRef: Nullable<string>;
  executionSliceHash: Nullable<string>;
  attemptCount: number;
  leaseOwnerInstanceId: Nullable<string>;
  leaseExpiresAt: Nullable<string>;
  terminalReasonCode: Nullable<string>;
  authorizedAt: string;
  terminalAt: Nullable<string>;
}

export interface OperationalAcceptedStoryEvidenceV1 {
  storyId: string;
  attemptId: string;
  sliceHash: string;
  evidencePlanHash: string;
  evidencePlanArtifactHash: string;
  evidenceBundleHash: string;
  evidenceId: string;
  predicateRefs: string[];
}

export interface OperationalAcceptedCandidatePayloadV1 {
  schema: "setfarm.accepted-candidate.v1";
  runId: string;
  packetHash: string;
  storyPlanHash: string;
  sourceRevision: { sha: string; treeHash: string };
  storyEvidence: OperationalAcceptedStoryEvidenceV1[];
  integrationEvidenceHash: string;
  acceptor: {
    id: "setfarm-final-tree-acceptor";
    version: "1.0.0";
    codeSha: string;
    environmentHash: string;
  };
  candidateId: string;
  candidateHash: string;
}

export interface OperationalAcceptedCandidateV1 {
  ref: string;
  candidate: OperationalAcceptedCandidatePayloadV1;
  createdAt: string;
}

export interface OperationalProcessIdentityV1 {
  schema: "setfarm.process-identity.v1";
  pid: number;
  processStartedAt: string;
  processGroupId?: number;
  source: "observed_os" | "tracked_child" | "legacy-backfill";
}

export interface OperationalV3BuildArtifactV1 {
  schema: "setfarm.v3-build-artifact.v1";
  outputPaths: string[];
  files: Array<{
    path: string;
    byteLength: number;
    contentHash: string;
    executable: boolean;
  }>;
  totalBytes: number;
  artifactHash: string;
  evidenceRef: string;
}

export interface OperationalV3ListenerOwnershipV1 {
  schema: "setfarm.v3-listener-ownership.v1";
  ownerProcess: OperationalProcessIdentityV1;
  listenerPids: number[];
  listenerProcesses: OperationalProcessIdentityV1[];
  host: string;
  port: number;
  checkedAt: string;
  evidenceRef: string;
}

export interface OperationalV3DeployReceiptPayloadV1 {
  schema: "setfarm.v3-deploy-receipt.v1";
  runId: string;
  candidateId: string;
  candidateHash: string;
  packetHash: string;
  project: {
    schema: "setfarm.v3-deploy-project.v1";
    productId: string;
    projectId: string;
    displayName: string;
    summary: string;
  };
  stack: {
    schema: "setfarm.v3-deploy-stack.v1";
    stackPackId: string;
    stackPackVersion: string;
    stackPackContentHash: string;
    platform: Nullable<"web" | "mobile" | "desktop" | "api" | "cli" | "game">;
    techStack: Nullable<string>;
  };
  buildCommandId: string;
  previewCommandId: string;
  sourceBefore: { sha: string; treeHash: string };
  sourceAfter: { sha: string; treeHash: string };
  buildArtifact: OperationalV3BuildArtifactV1;
  runtime: {
    schema: "setfarm.v3-runtime-deployment.v1";
    mode: "local" | "remote";
    projectId: string;
    serviceId: string;
    host: string;
    port: number;
    healthUrl: string;
    deployUrl: string;
    evidenceRef: string;
    buildArtifactHash: string;
    buildArtifactEvidenceRef: string;
    sealedRuntimeRef: string;
    sealedRuntimeManifestHash: string;
    sealedRuntimeManifestEvidenceRef: string;
  };
  health: {
    schema: "setfarm.v3-deploy-health-proof.v1";
    status: "pass";
    httpStatus: number;
    checkedAt: string;
    evidenceRef: string;
    buildArtifactHash: string;
    buildArtifactEvidenceRef: string;
    sealedRuntimeManifestHash: string;
    sealedRuntimeManifestEvidenceRef: string;
    listenerOwnership: OperationalV3ListenerOwnershipV1;
  };
  terminalProjectProjection: {
    schema: "setfarm.v3-terminal-project-projection.v1";
    owner: "mission-control-terminal-projector";
    state: "pending_terminal_projection";
    runId: string;
    candidateHash: string;
    projectId: string;
    serviceId: string;
    port: number;
    healthUrl: string;
    evidenceRef: string;
    buildArtifactHash: string;
  };
  environmentNames: string[];
  completedAt: string;
  receiptHash: string;
}

export interface OperationalV3DeployReceiptV1 {
  ref: string;
  receipt: OperationalV3DeployReceiptPayloadV1;
  createdAt: string;
}

export interface OperationalV3CanonicalProjectProjectionV1 {
  id: string;
  name: string;
  description: string;
  type: "web" | "mobile";
  ports: { frontend: number };
  deployUrl: string;
  service: string;
  serviceStatus: "active";
  status: "active";
  stack: string[];
  createdBy: "setfarm-v3-terminal-projector";
  productCompilerProtocol: "v3";
  workflowRunId: string;
  setfarmRunIds: string[];
  runNumber?: number;
  acceptedCandidateId: string;
  acceptedCandidateHash: string;
  acceptedPacketHash: string;
  acceptedSourceSha: string;
  acceptedSourceTreeHash: string;
  deploymentReceiptHash: string;
  deploymentReceiptRef: string;
  deploymentHealthRef: string;
  deploymentHealthUrl: string;
  deployedAt: string;
  completedAt: string;
}

export interface OperationalV3ProjectTransferAckPayloadV1 {
  schema: "setfarm.v3-project-transfer-ack.v1";
  ackVersion: 1;
  runId: string;
  candidateId: string;
  candidateHash: string;
  packetHash: string;
  sourceRevision: { sha: string; treeHash: string };
  deploymentReceiptHash: string;
  deploymentReceiptRef: string;
  sourceSnapshotHash: string;
  projectId: string;
  projectProjection: OperationalV3CanonicalProjectProjectionV1;
  projectionHash: string;
  projectRecordHash: string;
  projectRecordRef: string;
  persistedAt: string;
  projector: { service: "mission-control"; protocol: "v3" };
  ackHash: string;
}

export interface OperationalV3ProjectTransferAckV1 {
  ref: string;
  acknowledgement: OperationalV3ProjectTransferAckPayloadV1;
  createdAt: string;
}

export interface RunOperationalSnapshotV1 {
  schema: typeof RUN_OPERATIONAL_SNAPSHOT_V1_SCHEMA;
  generatedAt: string;
  snapshotHash: string;
  source: OperationalProjectionSourceV1;
  run: OperationalRunV1;
  summary: OperationalSummaryV1;
  claims: OperationalClaimV1[];
  attempts: OperationalAttemptV1[];
  runtimeSessions: OperationalRuntimeSessionV1[];
  completionRequests: OperationalCompletionRequestV1[];
  terminationRequests: OperationalTerminationRequestV1[];
  outbox: OperationalOutboxItemV1[];
  invariants: OperationalInvariantV1[];
  findingSets?: OperationalFindingSetV1[];
  evidenceBundles?: OperationalEvidenceBundleV1[];
  recoveryCases?: OperationalRecoveryCaseV1[];
  recoveryDispatches?: OperationalRecoveryDispatchV1[];
  acceptedCandidate?: Nullable<OperationalAcceptedCandidateV1>;
  deploymentReceipt?: Nullable<OperationalV3DeployReceiptV1>;
  projectTransferAck?: Nullable<OperationalV3ProjectTransferAckV1>;
}

export type OperationalSnapshotFetchResult =
  | { status: "ok"; snapshot: RunOperationalSnapshotV1 }
  | {
      status: "unavailable";
      code: string;
      reason: "not_found" | "timeout" | "network" | "circuit_open";
      upstreamStatus?: number;
    }
  | {
      status: "upstream_error";
      code: string;
      reason: "http_error" | "invalid_json" | "invalid_payload";
      upstreamStatus?: number;
    }
  | { status: "unsupported_schema"; code: string; schema: string | null };

export type OperationalSnapshotState = { status: "loading" } | OperationalSnapshotFetchResult;
export type OperationalAction = "stop" | "resume";

export interface OperationalActionAuthority {
  allowed: boolean;
  reasonCode: string;
  snapshotHash: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const OPERATIONAL_CAPABILITY_KEYS = [
  "attempts",
  "claimBinding",
  "runtimeOwnership",
  "managerCompletion",
  "effectLedger",
  "findingRecovery",
  "evidenceLedger",
  "acceptedCandidate",
  "deploymentReceipt",
  "projectTransferAck",
] as const;

function hasExactOperationalCapabilities(value: unknown): value is OperationalProjectionCapabilitiesV1 {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  const expected = [...OPERATIONAL_CAPABILITY_KEYS].sort();
  return keys.length === expected.length
    && keys.every((key, index) => key === expected[index])
    && OPERATIONAL_CAPABILITY_KEYS.every((key) => typeof value[key] === "boolean");
}

export function parseOperationalSnapshotResponse(
  responseStatus: number,
  body: unknown,
  requestedRunId: string,
): OperationalSnapshotFetchResult {
  if (responseStatus >= 200 && responseStatus < 300) {
    if (!isRecord(body)) {
      return { status: "upstream_error", code: "SETFARM_OPERATIONAL_SNAPSHOT_INVALID_PAYLOAD", reason: "invalid_payload" };
    }
    if (body.schema !== RUN_OPERATIONAL_SNAPSHOT_V1_SCHEMA) {
      return {
        status: "unsupported_schema",
        code: "SETFARM_OPERATIONAL_SNAPSHOT_UNSUPPORTED_SCHEMA",
        schema: typeof body.schema === "string" ? body.schema : null,
      };
    }
    if (!isRecord(body.run) || body.run.id !== requestedRunId) {
      return { status: "upstream_error", code: "SETFARM_OPERATIONAL_SNAPSHOT_INVALID_PAYLOAD", reason: "invalid_payload" };
    }
    if (!isRecord(body.source) || !hasExactOperationalCapabilities(body.source.capabilities)) {
      return { status: "upstream_error", code: "SETFARM_OPERATIONAL_SNAPSHOT_INVALID_PAYLOAD", reason: "invalid_payload" };
    }
    return { status: "ok", snapshot: body as unknown as RunOperationalSnapshotV1 };
  }

  if (isRecord(body) && body.status === "unsupported_schema") {
    return {
      status: "unsupported_schema",
      code: typeof body.code === "string" ? body.code : "SETFARM_OPERATIONAL_SNAPSHOT_UNSUPPORTED_SCHEMA",
      schema: typeof body.schema === "string" ? body.schema : null,
    };
  }

  if (isRecord(body) && body.status === "unavailable") {
    const allowedReasons = ["not_found", "timeout", "network", "circuit_open"] as const;
    const reason = allowedReasons.find((candidate) => candidate === body.reason) || "network";
    return {
      status: "unavailable",
      code: typeof body.code === "string" ? body.code : "SETFARM_OPERATIONAL_SNAPSHOT_UNAVAILABLE",
      reason,
      ...(typeof body.upstreamStatus === "number" ? { upstreamStatus: body.upstreamStatus } : {}),
    };
  }

  if (isRecord(body) && body.status === "upstream_error") {
    const allowedReasons = ["http_error", "invalid_json", "invalid_payload"] as const;
    const reason = allowedReasons.find((candidate) => candidate === body.reason) || "http_error";
    return {
      status: "upstream_error",
      code: typeof body.code === "string" ? body.code : "SETFARM_OPERATIONAL_SNAPSHOT_UPSTREAM_ERROR",
      reason,
      ...(typeof body.upstreamStatus === "number" ? { upstreamStatus: body.upstreamStatus } : {}),
    };
  }

  return {
    status: "upstream_error",
    code: "SETFARM_OPERATIONAL_SNAPSHOT_UPSTREAM_ERROR",
    reason: "http_error",
    upstreamStatus: responseStatus,
  };
}

export function evaluateOperationalAction(
  state: OperationalSnapshotState,
  action: OperationalAction,
  now = Date.now(),
): OperationalActionAuthority {
  if (state.status === "loading") {
    return { allowed: false, reasonCode: "OPERATIONAL_EVIDENCE_LOADING", snapshotHash: null };
  }
  if (state.status !== "ok") {
    const reasonCode = state.status === "unsupported_schema"
      ? "OPERATIONAL_EVIDENCE_SCHEMA_UNSUPPORTED"
      : state.status === "upstream_error"
        ? "OPERATIONAL_EVIDENCE_UPSTREAM_ERROR"
        : "OPERATIONAL_EVIDENCE_UNAVAILABLE";
    return { allowed: false, reasonCode, snapshotHash: null };
  }

  const { snapshot } = state;
  if (snapshot.source.projection !== "complete") {
    return { allowed: false, reasonCode: "OPERATIONAL_PROJECTION_INCOMPLETE", snapshotHash: snapshot.snapshotHash };
  }
  if (!hasExactOperationalCapabilities(snapshot.source.capabilities)
    || OPERATIONAL_CAPABILITY_KEYS.some((key) => !snapshot.source.capabilities[key])) {
    return { allowed: false, reasonCode: "OPERATIONAL_CAPABILITY_INCOMPLETE", snapshotHash: snapshot.snapshotHash };
  }

  const generatedAt = Date.parse(snapshot.generatedAt);
  if (!Number.isFinite(generatedAt) || generatedAt - now > 5_000 || now - generatedAt > OPERATIONAL_SNAPSHOT_MAX_AGE_MS) {
    return { allowed: false, reasonCode: "OPERATIONAL_EVIDENCE_STALE", snapshotHash: snapshot.snapshotHash };
  }
  if (snapshot.summary.lifecycleState === "inconsistent" || snapshot.summary.invariantViolations > 0 || snapshot.invariants.length > 0) {
    return { allowed: false, reasonCode: "OPERATIONAL_INVARIANT_VIOLATION", snapshotHash: snapshot.snapshotHash };
  }

  const decision = snapshot.summary.operatorActions[action];
  return { allowed: decision.allowed, reasonCode: decision.reasonCode, snapshotHash: snapshot.snapshotHash };
}

export function collectOperationalEvidenceRefs(snapshot: RunOperationalSnapshotV1): {
  stepRefs: string[];
  storyRefs: string[];
} {
  const stepRefs = new Set<string>();
  const storyRefs = new Set<string>();
  const add = (stepRef: string, storyRef: string | null) => {
    stepRefs.add(stepRef);
    if (storyRef) storyRefs.add(storyRef);
  };

  snapshot.claims.forEach((item) => add(item.stepRef, item.storyRef));
  snapshot.attempts.forEach((item) => add(item.stepRef, item.storyRef));
  snapshot.runtimeSessions.forEach((item) => add(item.stepRef, item.storyRef));
  snapshot.completionRequests.forEach((item) => add(item.stepRef, item.storyRef));

  return {
    stepRefs: [...stepRefs].sort(),
    storyRefs: [...storyRefs].sort(),
  };
}

export function operationalStateReason(state: OperationalSnapshotState): string {
  switch (state.status) {
    case "loading":
      return "Canonical operational evidence is loading.";
    case "unavailable":
      return `${state.code}: ${state.reason}${state.upstreamStatus ? ` (upstream ${state.upstreamStatus})` : ""}`;
    case "upstream_error":
      return `${state.code}: ${state.reason}${state.upstreamStatus ? ` (upstream ${state.upstreamStatus})` : ""}`;
    case "unsupported_schema":
      return `${state.code}: ${state.schema || "schema missing"}`;
    case "ok":
      return state.snapshot.source.projection === "complete"
        ? "Canonical operational evidence is available."
        : "Canonical endpoint is available, but the database projection is partial.";
  }
}
