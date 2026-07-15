import { createHash } from "node:crypto";

import { config } from "../config.js";
import {
  parseSetfarmV3ListenerOwnershipV1,
  parseSetfarmV3RuntimeDeploymentV1,
  parseSetfarmV3RuntimeIsolationProofV1,
  sameSetfarmObservedProcessIdentity,
  type SetfarmV3RuntimeIsolationProofV1,
  type SetfarmV3RuntimeVolumeProvisioningV1,
} from "./setfarm-v3-runtime-contract.js";

export const RUN_OPERATIONAL_SNAPSHOT_V1_SCHEMA = "setfarm.run-operational-snapshot.v1" as const;
export const RUN_OPERATIONAL_SNAPSHOT_V2_SCHEMA = "setfarm.run-operational-snapshot.v2" as const;

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

export interface OperationalProjectionCapabilitiesV2 extends OperationalProjectionCapabilitiesV1 {
  implementationSubmissionEvidence: boolean;
}

export const OPERATIONAL_LIFECYCLE_CAPABILITY_KEYS = [
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

export function hasCompleteOperationalLifecycleCapabilities(
  capabilities: OperationalProjectionCapabilitiesV1 | OperationalProjectionCapabilitiesV2,
): boolean {
  return OPERATIONAL_LIFECYCLE_CAPABILITY_KEYS.every(
    (capability) => capabilities[capability],
  );
}

export interface OperationalProjectionSourceV1 {
  database: "postgres";
  projection: "complete" | "partial" | "unavailable";
  migrationVersions: number[];
  verifiedReleaseSha: Nullable<string>;
  capabilities: OperationalProjectionCapabilitiesV1;
}

export interface OperationalProjectionSourceV2 extends Omit<OperationalProjectionSourceV1, "capabilities"> {
  capabilities: OperationalProjectionCapabilitiesV2;
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

export interface RuntimeCompletionSubmissionEvidenceV1 {
  schema: "setfarm.runtime-completion-submission-evidence.v1";
  compiler: "setfarm.v3-implementation-output-compilation.v1";
  sourceSchema:
    | "setfarm.v3-implementation-agent-proposal.v1"
    | "setfarm.v3-implementation-agent-output.v1";
  sourceProposalHash: string;
  canonicalOutputHash: string;
  ignoredFieldPaths: string[];
}

export interface OperationalImplementationSubmissionEvidenceV2 {
  receipt: RuntimeCompletionSubmissionEvidenceV1;
  sourceProposalRef: string;
}

export interface OperationalCompletionRequestV2 extends OperationalCompletionRequestV1 {
  implementationSubmissionEvidence: Nullable<OperationalImplementationSubmissionEvidenceV2>;
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

export interface OperationalV3RuntimeIsolationAuthorityV1 {
  schema: "setfarm.v3-runtime-isolation-authority.v1";
  adapterId: "darwin-sandbox-exec";
  adapterVersion: "1.0.0";
  runId: string;
  projectId: string;
  candidateHash: string;
  buildArtifactHash: string;
  policyHash: string;
  profileHash: string;
  wrapperArtifactHash: string;
  runtimeDataContractHash: string;
  volumeProvisioningHash: string;
  evidenceRef: string;
  authorityHash: string;
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
    techStack: Nullable<
      | "vite-react"
      | "nextjs"
      | "static-html"
      | "browser-game"
      | "node-express"
      | "python-web"
      | "node-cli"
      | "python-cli"
      | "react-native-expo"
      | "android-native"
      | "ios-native"
      | "desktop-electron"
    >;
  };
  buildCommandId: string;
  previewCommandId: string;
  sourceBefore: { sha: string; treeHash: string };
  sourceAfter: { sha: string; treeHash: string };
  buildArtifact: OperationalV3BuildArtifactV1;
  runtime: {
    schema: "setfarm.v3-runtime-deployment.v1";
    mode: "local";
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
    sealAuthorityHash: string;
    sealAuthorityEvidenceRef: string;
    runtimeDataContractHash: string;
    volumeProvisioning: SetfarmV3RuntimeVolumeProvisioningV1;
    runtimeIsolation: OperationalV3RuntimeIsolationAuthorityV1;
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
    runtimeIsolation: SetfarmV3RuntimeIsolationProofV1;
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

export interface RunOperationalSnapshotV2 extends Omit<
  RunOperationalSnapshotV1,
  "schema" | "source" | "completionRequests"
> {
  schema: typeof RUN_OPERATIONAL_SNAPSHOT_V2_SCHEMA;
  source: OperationalProjectionSourceV2;
  completionRequests: OperationalCompletionRequestV2[];
}

export type RunOperationalSnapshot = RunOperationalSnapshotV1 | RunOperationalSnapshotV2;

export type OperationalSnapshotFetchResult =
  | { status: "ok"; snapshot: RunOperationalSnapshot }
  | { status: "unavailable"; reason: "not_found" | "timeout" | "network" | "circuit_open"; upstreamStatus?: number }
  | { status: "upstream_error"; reason: "http_error" | "invalid_json" | "invalid_payload"; upstreamStatus?: number }
  | { status: "unsupported_schema"; schema: string | null };

type JsonRecord = Record<string, unknown>;

const IDENTITY_MAX = 1_000;
const COLLECTION_MAX = 100_000;
const CANONICAL_REF = /^setfarm:\/\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/;
const REASON_CODE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;
const SHA256 = /^[a-f0-9]{64}$/;
const GIT_HASH = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const POSITIVE_DECIMAL = /^[1-9][0-9]*$/;
const FINDING_ID = /^FIND_[a-f0-9]{64}$/;
const FINDING_SET_ID = /^FSET_[a-f0-9]{64}$/;
const EVIDENCE_BUNDLE_ID = /^EVB_[a-f0-9]{64}$/;
const RECOVERY_CASE_ID = /^RCV_[a-f0-9]{64}$/;
const RECOVERY_REVISION_ID = /^RREV_[a-f0-9]{64}$/;
const RECOVERY_DISPATCH_ID = /^RDISP_[a-f0-9]{64}$/;
const ATTEMPT_ID = /^ATT_[A-Za-z0-9-]{16,160}$/;
const ACCEPTED_CANDIDATE_ID = /^ACPT_[a-f0-9]{64}$/;
const PRODUCT_ID = /^PROD_[A-Z0-9]+(?:_[A-Z0-9]+)*$/;
const PROJECT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ENVIRONMENT_NAME = /^[A-Z_][A-Z0-9_]*$/;
const EVIDENCE_PREDICATE_REF = /^EVID_[A-Z0-9]+(?:_[A-Z0-9]+)*$/;
const MACHINE_REASON_CODE = /^(?:[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*|[a-z][a-z0-9]*(?:_[a-z0-9]+)*)$/;
const TIMESTAMP_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const V3_BUILD_ARTIFACT_MAX_FILES = 50_000;
const V3_BUILD_ARTIFACT_MAX_FILE_BYTES = 1_073_741_824;
const V3_BUILD_ARTIFACT_MAX_TOTAL_BYTES = 4_294_967_296;
const IMPLEMENTATION_IGNORED_PATH_MAX_ITEMS = 20_000;
const IMPLEMENTATION_IGNORED_PATH_MAX_BYTES = 128 * 1024;
const IMPLEMENTATION_IGNORED_PATH_MAX_ITEM_LENGTH = 2_000;
const JSON_POINTER = /^\/(?:[^~/]|~[01])*(?:\/(?:[^~/]|~[01])*)*$/;

class SnapshotValidationError extends Error {}

function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new SnapshotValidationError("canonical JSON requires finite numbers");
    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJsonStringify).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJsonStringify(record[key])}`).join(",")}}`;
  }
  throw new SnapshotValidationError("unsupported canonical JSON value");
}

function hashCanonicalJson(value: unknown): string {
  return createHash("sha256").update(canonicalJsonStringify(value), "utf8").digest("hex");
}

function fail(path: string, message: string): never {
  throw new SnapshotValidationError(`${path}: ${message}`);
}

function objectAt(value: unknown, path: string, keys: readonly string[]): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(path, "expected object");
  const record = value as JsonRecord;
  const actualKeys = Object.keys(record);
  if (actualKeys.length !== keys.length || actualKeys.some((key) => !keys.includes(key))) {
    fail(path, "unexpected or missing field");
  }
  return record;
}

function objectWithOptionalAt(
  value: unknown,
  path: string,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[],
): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(path, "expected object");
  const record = value as JsonRecord;
  const actualKeys = Object.keys(record);
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  if (requiredKeys.some((key) => !Object.hasOwn(record, key)) || actualKeys.some((key) => !allowed.has(key))) {
    fail(path, "unexpected or missing field");
  }
  return record;
}

function stringAt(value: unknown, path: string, options: { regex?: RegExp; max?: number } = {}): string {
  if (typeof value !== "string" || value.length === 0) fail(path, "expected non-empty string");
  if (options.max !== undefined && value.length > options.max) fail(path, "string too long");
  if (options.regex && !options.regex.test(value)) fail(path, "invalid format");
  return value;
}

function identityAt(value: unknown, path: string): string {
  return stringAt(value, path, { max: IDENTITY_MAX });
}

function optionalIdentityAt(value: unknown, path: string): Nullable<string> {
  return value === null ? null : identityAt(value, path);
}

function enumAt<T extends string>(value: unknown, path: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) fail(path, "unsupported value");
  return value as T;
}

function booleanAt(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path, "expected boolean");
  return value;
}

function integerAt(value: unknown, path: string, min: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min) fail(path, "expected bounded integer");
  return value;
}

function nullableIntegerAt(value: unknown, path: string, min: number): Nullable<number> {
  return value === null ? null : integerAt(value, path, min);
}

function timestampAt(value: unknown, path: string): string {
  const timestamp = stringAt(value, path, { regex: TIMESTAMP_WITH_OFFSET });
  if (!Number.isFinite(Date.parse(timestamp))) fail(path, "invalid timestamp");
  return timestamp;
}

function optionalTimestampAt(value: unknown, path: string): Nullable<string> {
  return value === null ? null : timestampAt(value, path);
}

function sha256At(value: unknown, path: string): string {
  return stringAt(value, path, { regex: SHA256 });
}

function optionalSha256At(value: unknown, path: string): Nullable<string> {
  return value === null ? null : sha256At(value, path);
}

function gitHashAt(value: unknown, path: string): string {
  return stringAt(value, path, { regex: GIT_HASH });
}

function optionalGitHashAt(value: unknown, path: string): Nullable<string> {
  return value === null ? null : gitHashAt(value, path);
}

function urlAt(value: unknown, path: string): string {
  const url = stringAt(value, path, { max: 4_000 });
  try {
    // Match Setfarm's z.string().url() boundary without normalizing the value.
    new URL(url);
  } catch {
    fail(path, "invalid URL");
  }
  return url;
}

function canonicalRefAt(value: unknown, path: string): string {
  return stringAt(value, path, { regex: CANONICAL_REF, max: 4_000 });
}

function optionalCanonicalRefAt(value: unknown, path: string): Nullable<string> {
  return value === null ? null : canonicalRefAt(value, path);
}

function reasonCodeAt(value: unknown, path: string): string {
  return stringAt(value, path, { regex: REASON_CODE, max: 160 });
}

function normalizedRelativeLocatorAt(value: unknown, path: string): string {
  const locator = stringAt(value, path, { max: 1_024 });
  const segments = locator.split("/");
  if (
    locator.includes("\0")
    || locator.includes("\\")
    || locator.startsWith("/")
    || /^[A-Za-z]:\//.test(locator)
    || locator.startsWith("./")
    || locator.endsWith("/")
    || segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    fail(path, "expected normalized relative locator");
  }
  return locator;
}

function arrayAt<T>(value: unknown, path: string, parseItem: (item: unknown, itemPath: string) => T, max = COLLECTION_MAX): T[] {
  if (!Array.isArray(value) || value.length > max) fail(path, "expected bounded array");
  return value.map((item, index) => parseItem(item, `${path}[${index}]`));
}

function canonicalStringArrayAt(
  value: unknown,
  path: string,
  regex: RegExp,
  options: { min?: number; max?: number } = {},
): string[] {
  const values = arrayAt(
    value,
    path,
    (item, itemPath) => stringAt(item, itemPath, { regex, max: IDENTITY_MAX }),
    options.max ?? COLLECTION_MAX,
  );
  if (values.length < (options.min ?? 0)) fail(path, "expected non-empty canonical array");
  const canonical = [...new Set(values)].sort();
  if (canonical.length !== values.length || values.some((item, index) => item !== canonical[index])) {
    fail(path, "expected unique canonical order");
  }
  return values;
}

function sourceRevisionAt(value: unknown, path: string): { sha: string; treeHash: string } {
  const source = objectAt(value, path, ["sha", "treeHash"]);
  return { sha: gitHashAt(source.sha, `${path}.sha`), treeHash: gitHashAt(source.treeHash, `${path}.treeHash`) };
}

function optionalSourceRevisionAt(value: unknown, path: string): Nullable<{ sha: string; treeHash: string }> {
  return value === null ? null : sourceRevisionAt(value, path);
}

function projectionCapabilitiesAt(value: unknown, path: string): OperationalProjectionCapabilitiesV1 {
  const capabilities = objectAt(
    value,
    path,
    ["attempts", "claimBinding", "runtimeOwnership", "managerCompletion", "effectLedger", "findingRecovery", "evidenceLedger", "acceptedCandidate", "deploymentReceipt", "projectTransferAck"],
  );
  return {
    attempts: booleanAt(capabilities.attempts, `${path}.attempts`),
    claimBinding: booleanAt(capabilities.claimBinding, `${path}.claimBinding`),
    runtimeOwnership: booleanAt(capabilities.runtimeOwnership, `${path}.runtimeOwnership`),
    managerCompletion: booleanAt(capabilities.managerCompletion, `${path}.managerCompletion`),
    effectLedger: booleanAt(capabilities.effectLedger, `${path}.effectLedger`),
    findingRecovery: booleanAt(capabilities.findingRecovery, `${path}.findingRecovery`),
    evidenceLedger: booleanAt(capabilities.evidenceLedger, `${path}.evidenceLedger`),
    acceptedCandidate: booleanAt(capabilities.acceptedCandidate, `${path}.acceptedCandidate`),
    deploymentReceipt: booleanAt(capabilities.deploymentReceipt, `${path}.deploymentReceipt`),
    projectTransferAck: booleanAt(capabilities.projectTransferAck, `${path}.projectTransferAck`),
  };
}

function projectionCapabilitiesV2At(value: unknown, path: string): OperationalProjectionCapabilitiesV2 {
  const capabilities = objectAt(
    value,
    path,
    [
      "attempts", "claimBinding", "runtimeOwnership", "managerCompletion", "implementationSubmissionEvidence",
      "effectLedger", "findingRecovery", "evidenceLedger", "acceptedCandidate", "deploymentReceipt", "projectTransferAck",
    ],
  );
  return {
    attempts: booleanAt(capabilities.attempts, `${path}.attempts`),
    claimBinding: booleanAt(capabilities.claimBinding, `${path}.claimBinding`),
    runtimeOwnership: booleanAt(capabilities.runtimeOwnership, `${path}.runtimeOwnership`),
    managerCompletion: booleanAt(capabilities.managerCompletion, `${path}.managerCompletion`),
    implementationSubmissionEvidence: booleanAt(
      capabilities.implementationSubmissionEvidence,
      `${path}.implementationSubmissionEvidence`,
    ),
    effectLedger: booleanAt(capabilities.effectLedger, `${path}.effectLedger`),
    findingRecovery: booleanAt(capabilities.findingRecovery, `${path}.findingRecovery`),
    evidenceLedger: booleanAt(capabilities.evidenceLedger, `${path}.evidenceLedger`),
    acceptedCandidate: booleanAt(capabilities.acceptedCandidate, `${path}.acceptedCandidate`),
    deploymentReceipt: booleanAt(capabilities.deploymentReceipt, `${path}.deploymentReceipt`),
    projectTransferAck: booleanAt(capabilities.projectTransferAck, `${path}.projectTransferAck`),
  };
}

function projectionSourceAt(value: unknown, path: string): OperationalProjectionSourceV1 {
  const source = objectAt(value, path, ["database", "projection", "migrationVersions", "verifiedReleaseSha", "capabilities"]);
  const migrationVersions = arrayAt(source.migrationVersions, `${path}.migrationVersions`, (item, itemPath) => integerAt(item, itemPath, 1), 1_000);
  if (new Set(migrationVersions).size !== migrationVersions.length || migrationVersions.some((item, index) => index > 0 && item <= migrationVersions[index - 1])) {
    fail(`${path}.migrationVersions`, "expected unique ascending versions");
  }
  const capabilities = projectionCapabilitiesAt(source.capabilities, `${path}.capabilities`);
  const projection = enumAt(source.projection, `${path}.projection`, ["complete", "partial", "unavailable"] as const);
  if (projection === "complete" && !hasCompleteOperationalLifecycleCapabilities(capabilities)) {
    fail(`${path}.projection`, "complete projection requires all lifecycle capabilities");
  }
  return {
    database: enumAt(source.database, `${path}.database`, ["postgres"] as const),
    projection,
    migrationVersions,
    verifiedReleaseSha: optionalGitHashAt(source.verifiedReleaseSha, `${path}.verifiedReleaseSha`),
    capabilities,
  };
}

function projectionSourceV2At(value: unknown, path: string): OperationalProjectionSourceV2 {
  const source = objectAt(value, path, ["database", "projection", "migrationVersions", "verifiedReleaseSha", "capabilities"]);
  const migrationVersions = arrayAt(source.migrationVersions, `${path}.migrationVersions`, (item, itemPath) => integerAt(item, itemPath, 1), 1_000);
  if (new Set(migrationVersions).size !== migrationVersions.length || migrationVersions.some((item, index) => index > 0 && item <= migrationVersions[index - 1])) {
    fail(`${path}.migrationVersions`, "expected unique ascending versions");
  }
  const capabilities = projectionCapabilitiesV2At(source.capabilities, `${path}.capabilities`);
  const projection = enumAt(source.projection, `${path}.projection`, ["complete", "partial", "unavailable"] as const);
  if (
    projection === "complete"
    && !hasCompleteOperationalLifecycleCapabilities(capabilities)
  ) {
    fail(`${path}.projection`, "complete projection requires every lifecycle capability");
  }
  const verifiedReleaseSha = optionalGitHashAt(source.verifiedReleaseSha, `${path}.verifiedReleaseSha`);
  if (capabilities.implementationSubmissionEvidence && !capabilities.managerCompletion) {
    fail(`${path}.capabilities.implementationSubmissionEvidence`, "requires manager completion authority");
  }
  if (
    capabilities.implementationSubmissionEvidence
    && (!migrationVersions.includes(19) || verifiedReleaseSha === null)
  ) {
    fail(
      `${path}.capabilities.implementationSubmissionEvidence`,
      "requires an attested migration 19 shape",
    );
  }
  return {
    database: enumAt(source.database, `${path}.database`, ["postgres"] as const),
    projection,
    migrationVersions,
    verifiedReleaseSha,
    capabilities,
  };
}

function runAt(value: unknown, path: string): OperationalRunV1 {
  const run = objectAt(value, path, ["ref", "id", "runNumber", "protocol", "status", "terminal", "updatedAt"]);
  return {
    ref: canonicalRefAt(run.ref, `${path}.ref`),
    id: identityAt(run.id, `${path}.id`),
    runNumber: nullableIntegerAt(run.runNumber, `${path}.runNumber`, 1),
    protocol: run.protocol === null ? null : enumAt(run.protocol, `${path}.protocol`, ["legacy", "shadow", "v3"] as const),
    status: identityAt(run.status, `${path}.status`),
    terminal: booleanAt(run.terminal, `${path}.terminal`),
    updatedAt: optionalTimestampAt(run.updatedAt, `${path}.updatedAt`),
  };
}

function operatorActionAt(value: unknown, path: string): { allowed: boolean; reasonCode: string; stateHash: string } {
  const action = objectAt(value, path, ["allowed", "reasonCode", "stateHash"]);
  return {
    allowed: booleanAt(action.allowed, `${path}.allowed`),
    reasonCode: reasonCodeAt(action.reasonCode, `${path}.reasonCode`),
    stateHash: sha256At(action.stateHash, `${path}.stateHash`),
  };
}

function summaryAt(value: unknown, path: string): OperationalSummaryV1 {
  const summary = objectAt(value, path, [
    "lifecycleState", "health", "activeClaims", "activeAttempts", "activeRuntimes", "openCompletions",
    "mandatoryEffectsPending", "unpublishedOutbox", "invariantViolations", "operatorActions",
  ]);
  const operatorActions = objectAt(summary.operatorActions, `${path}.operatorActions`, ["stop", "resume"]);
  return {
    lifecycleState: enumAt(summary.lifecycleState, `${path}.lifecycleState`, [
      "legacy_untracked", "idle", "claimed", "runtime_active", "completion_requested", "effects_applying", "settled", "terminal", "inconsistent",
    ] as const),
    health: enumAt(summary.health, `${path}.health`, ["ok", "attention", "blocked", "unavailable"] as const),
    activeClaims: integerAt(summary.activeClaims, `${path}.activeClaims`, 0),
    activeAttempts: integerAt(summary.activeAttempts, `${path}.activeAttempts`, 0),
    activeRuntimes: integerAt(summary.activeRuntimes, `${path}.activeRuntimes`, 0),
    openCompletions: integerAt(summary.openCompletions, `${path}.openCompletions`, 0),
    mandatoryEffectsPending: integerAt(summary.mandatoryEffectsPending, `${path}.mandatoryEffectsPending`, 0),
    unpublishedOutbox: integerAt(summary.unpublishedOutbox, `${path}.unpublishedOutbox`, 0),
    invariantViolations: integerAt(summary.invariantViolations, `${path}.invariantViolations`, 0),
    operatorActions: {
      stop: operatorActionAt(operatorActions.stop, `${path}.operatorActions.stop`),
      resume: operatorActionAt(operatorActions.resume, `${path}.operatorActions.resume`),
    },
  };
}

function claimAt(value: unknown, path: string): OperationalClaimV1 {
  const claim = objectAt(value, path, [
    "ref", "id", "runRef", "stepRef", "storyRef", "workflowStepId", "storyId", "agentId", "state", "outcome", "claimedAt", "abandonedAt",
  ]);
  return {
    ref: canonicalRefAt(claim.ref, `${path}.ref`),
    id: stringAt(claim.id, `${path}.id`, { regex: POSITIVE_DECIMAL }),
    runRef: canonicalRefAt(claim.runRef, `${path}.runRef`),
    stepRef: canonicalRefAt(claim.stepRef, `${path}.stepRef`),
    storyRef: optionalCanonicalRefAt(claim.storyRef, `${path}.storyRef`),
    workflowStepId: identityAt(claim.workflowStepId, `${path}.workflowStepId`),
    storyId: optionalIdentityAt(claim.storyId, `${path}.storyId`),
    agentId: identityAt(claim.agentId, `${path}.agentId`),
    state: enumAt(claim.state, `${path}.state`, ["open", "closed"] as const),
    outcome: optionalIdentityAt(claim.outcome, `${path}.outcome`),
    claimedAt: timestampAt(claim.claimedAt, `${path}.claimedAt`),
    abandonedAt: optionalTimestampAt(claim.abandonedAt, `${path}.abandonedAt`),
  };
}

function attemptAt(value: unknown, path: string): OperationalAttemptV1 {
  const attempt = objectAt(value, path, [
    "ref", "attemptId", "runRef", "claimRef", "stepRef", "storyRef", "workflowStepId", "storyId", "generation", "attemptClass",
    "packetHash", "compilationReportHash", "sliceHash", "sourceBefore", "sourceAfter", "findingSetHash", "role", "agentId", "disposition",
    "outputHash", "createdAt", "updatedAt",
  ]);
  return {
    ref: canonicalRefAt(attempt.ref, `${path}.ref`),
    attemptId: identityAt(attempt.attemptId, `${path}.attemptId`),
    runRef: canonicalRefAt(attempt.runRef, `${path}.runRef`),
    claimRef: optionalCanonicalRefAt(attempt.claimRef, `${path}.claimRef`),
    stepRef: canonicalRefAt(attempt.stepRef, `${path}.stepRef`),
    storyRef: optionalCanonicalRefAt(attempt.storyRef, `${path}.storyRef`),
    workflowStepId: identityAt(attempt.workflowStepId, `${path}.workflowStepId`),
    storyId: optionalIdentityAt(attempt.storyId, `${path}.storyId`),
    generation: integerAt(attempt.generation, `${path}.generation`, 1),
    attemptClass: enumAt(attempt.attemptClass, `${path}.attemptClass`, [
      "product_implementation", "evidence_only", "infrastructure_retry", "supervisor_repair",
    ] as const),
    packetHash: optionalSha256At(attempt.packetHash, `${path}.packetHash`),
    compilationReportHash: sha256At(attempt.compilationReportHash, `${path}.compilationReportHash`),
    sliceHash: optionalSha256At(attempt.sliceHash, `${path}.sliceHash`),
    sourceBefore: sourceRevisionAt(attempt.sourceBefore, `${path}.sourceBefore`),
    sourceAfter: optionalSourceRevisionAt(attempt.sourceAfter, `${path}.sourceAfter`),
    findingSetHash: optionalSha256At(attempt.findingSetHash, `${path}.findingSetHash`),
    role: identityAt(attempt.role, `${path}.role`),
    agentId: optionalIdentityAt(attempt.agentId, `${path}.agentId`),
    disposition: enumAt(attempt.disposition, `${path}.disposition`, [
      "claimed", "running", "produced_delta", "already_satisfied", "no_progress", "inconclusive", "failed", "verified", "superseded",
    ] as const),
    outputHash: optionalSha256At(attempt.outputHash, `${path}.outputHash`),
    createdAt: timestampAt(attempt.createdAt, `${path}.createdAt`),
    updatedAt: timestampAt(attempt.updatedAt, `${path}.updatedAt`),
  };
}

function runtimeSessionAt(value: unknown, path: string): OperationalRuntimeSessionV1 {
  const session = objectAt(value, path, [
    "ref", "sessionId", "runRef", "claimRef", "attemptRef", "stepRef", "storyRef", "workflowStepId", "storyId", "runtimeKind", "state",
    "stateVersion", "startedAt", "heartbeatAt", "drainRequestedAt", "drainedAt", "releasedAt", "createdAt", "updatedAt",
  ]);
  return {
    ref: canonicalRefAt(session.ref, `${path}.ref`),
    sessionId: identityAt(session.sessionId, `${path}.sessionId`),
    runRef: canonicalRefAt(session.runRef, `${path}.runRef`),
    claimRef: canonicalRefAt(session.claimRef, `${path}.claimRef`),
    attemptRef: optionalCanonicalRefAt(session.attemptRef, `${path}.attemptRef`),
    stepRef: canonicalRefAt(session.stepRef, `${path}.stepRef`),
    storyRef: optionalCanonicalRefAt(session.storyRef, `${path}.storyRef`),
    workflowStepId: identityAt(session.workflowStepId, `${path}.workflowStepId`),
    storyId: optionalIdentityAt(session.storyId, `${path}.storyId`),
    runtimeKind: enumAt(session.runtimeKind, `${path}.runtimeKind`, ["local_process", "openclaw_session", "external_session"] as const),
    state: enumAt(session.state, `${path}.state`, ["reserved", "starting", "running", "drain_requested", "drained", "released", "quarantined"] as const),
    stateVersion: integerAt(session.stateVersion, `${path}.stateVersion`, 1),
    startedAt: optionalTimestampAt(session.startedAt, `${path}.startedAt`),
    heartbeatAt: timestampAt(session.heartbeatAt, `${path}.heartbeatAt`),
    drainRequestedAt: optionalTimestampAt(session.drainRequestedAt, `${path}.drainRequestedAt`),
    drainedAt: optionalTimestampAt(session.drainedAt, `${path}.drainedAt`),
    releasedAt: optionalTimestampAt(session.releasedAt, `${path}.releasedAt`),
    createdAt: timestampAt(session.createdAt, `${path}.createdAt`),
    updatedAt: timestampAt(session.updatedAt, `${path}.updatedAt`),
  };
}

function completionEffectAt(value: unknown, path: string): OperationalCompletionEffectV1 {
  const effect = objectAt(value, path, [
    "ref", "effectKey", "ordinal", "effectType", "inputHash", "mandatory", "state", "attemptCount", "appliedAt", "reconciledAt", "createdAt", "updatedAt",
  ]);
  return {
    ref: canonicalRefAt(effect.ref, `${path}.ref`),
    effectKey: identityAt(effect.effectKey, `${path}.effectKey`),
    ordinal: integerAt(effect.ordinal, `${path}.ordinal`, 0),
    effectType: identityAt(effect.effectType, `${path}.effectType`),
    inputHash: sha256At(effect.inputHash, `${path}.inputHash`),
    mandatory: booleanAt(effect.mandatory, `${path}.mandatory`),
    state: enumAt(effect.state, `${path}.state`, ["pending", "leased", "applied", "reconciled", "quarantined"] as const),
    attemptCount: integerAt(effect.attemptCount, `${path}.attemptCount`, 0),
    appliedAt: optionalTimestampAt(effect.appliedAt, `${path}.appliedAt`),
    reconciledAt: optionalTimestampAt(effect.reconciledAt, `${path}.reconciledAt`),
    createdAt: timestampAt(effect.createdAt, `${path}.createdAt`),
    updatedAt: timestampAt(effect.updatedAt, `${path}.updatedAt`),
  };
}

function completionRequestAt(value: unknown, path: string): OperationalCompletionRequestV1 {
  const request = objectAt(value, path, [
    "ref", "requestId", "runRef", "runtimeSessionRef", "claimRef", "attemptRef", "stepRef", "storyRef", "workflowStepId", "storyId", "outputHash",
    "applyPhase", "claimOutcome", "completionPlanHash", "state", "requestedAt", "drainedAt", "processingAt", "acceptedAt", "rejectedAt", "createdAt", "updatedAt", "effects",
  ]);
  return {
    ref: canonicalRefAt(request.ref, `${path}.ref`),
    requestId: identityAt(request.requestId, `${path}.requestId`),
    runRef: canonicalRefAt(request.runRef, `${path}.runRef`),
    runtimeSessionRef: canonicalRefAt(request.runtimeSessionRef, `${path}.runtimeSessionRef`),
    claimRef: canonicalRefAt(request.claimRef, `${path}.claimRef`),
    attemptRef: optionalCanonicalRefAt(request.attemptRef, `${path}.attemptRef`),
    stepRef: canonicalRefAt(request.stepRef, `${path}.stepRef`),
    storyRef: optionalCanonicalRefAt(request.storyRef, `${path}.storyRef`),
    workflowStepId: identityAt(request.workflowStepId, `${path}.workflowStepId`),
    storyId: optionalIdentityAt(request.storyId, `${path}.storyId`),
    outputHash: sha256At(request.outputHash, `${path}.outputHash`),
    applyPhase: enumAt(request.applyPhase, `${path}.applyPhase`, ["proposed", "executing", "owner_committed", "effects_committed"] as const),
    claimOutcome: optionalIdentityAt(request.claimOutcome, `${path}.claimOutcome`),
    completionPlanHash: optionalSha256At(request.completionPlanHash, `${path}.completionPlanHash`),
    state: enumAt(request.state, `${path}.state`, ["requested", "draining", "processing", "accepted", "rejected", "quarantined"] as const),
    requestedAt: timestampAt(request.requestedAt, `${path}.requestedAt`),
    drainedAt: optionalTimestampAt(request.drainedAt, `${path}.drainedAt`),
    processingAt: optionalTimestampAt(request.processingAt, `${path}.processingAt`),
    acceptedAt: optionalTimestampAt(request.acceptedAt, `${path}.acceptedAt`),
    rejectedAt: optionalTimestampAt(request.rejectedAt, `${path}.rejectedAt`),
    createdAt: timestampAt(request.createdAt, `${path}.createdAt`),
    updatedAt: timestampAt(request.updatedAt, `${path}.updatedAt`),
    effects: arrayAt(request.effects, `${path}.effects`, completionEffectAt),
  };
}

function implementationSubmissionReceiptAt(
  value: unknown,
  path: string,
): RuntimeCompletionSubmissionEvidenceV1 {
  const receipt = objectAt(value, path, [
    "schema", "compiler", "sourceSchema", "sourceProposalHash", "canonicalOutputHash", "ignoredFieldPaths",
  ]);
  if (receipt.schema !== "setfarm.runtime-completion-submission-evidence.v1") {
    fail(`${path}.schema`, "unsupported schema");
  }
  if (receipt.compiler !== "setfarm.v3-implementation-output-compilation.v1") {
    fail(`${path}.compiler`, "unsupported compiler");
  }
  const ignoredFieldPaths = arrayAt(
    receipt.ignoredFieldPaths,
    `${path}.ignoredFieldPaths`,
    (item, itemPath) => stringAt(item, itemPath, {
      regex: JSON_POINTER,
      max: IMPLEMENTATION_IGNORED_PATH_MAX_ITEM_LENGTH,
    }),
    IMPLEMENTATION_IGNORED_PATH_MAX_ITEMS,
  );
  const encodedPaths = ignoredFieldPaths.map((pointer) => ({
    pointer,
    bytes: Buffer.from(pointer, "utf8"),
  }));
  const totalBytes = encodedPaths.reduce((bytes, item) => bytes + item.bytes.length, 0);
  if (totalBytes > IMPLEMENTATION_IGNORED_PATH_MAX_BYTES) {
    fail(`${path}.ignoredFieldPaths`, "aggregate byte capacity exceeded");
  }
  encodedPaths.sort((left, right) => Buffer.compare(left.bytes, right.bytes));
  for (let index = 0; index < encodedPaths.length; index += 1) {
    const item = encodedPaths[index]!;
    if (
      item.pointer !== ignoredFieldPaths[index]
      || (index > 0 && item.pointer === encodedPaths[index - 1]!.pointer)
    ) {
      fail(`${path}.ignoredFieldPaths`, "expected unique canonical order");
    }
  }
  return {
    schema: "setfarm.runtime-completion-submission-evidence.v1",
    compiler: "setfarm.v3-implementation-output-compilation.v1",
    sourceSchema: enumAt(receipt.sourceSchema, `${path}.sourceSchema`, [
      "setfarm.v3-implementation-agent-proposal.v1",
      "setfarm.v3-implementation-agent-output.v1",
    ] as const),
    sourceProposalHash: sha256At(receipt.sourceProposalHash, `${path}.sourceProposalHash`),
    canonicalOutputHash: sha256At(receipt.canonicalOutputHash, `${path}.canonicalOutputHash`),
    ignoredFieldPaths,
  };
}

function implementationSubmissionEvidenceAt(
  value: unknown,
  requestId: string,
  outputHash: string,
  path: string,
): OperationalImplementationSubmissionEvidenceV2 {
  const evidence = objectAt(value, path, ["receipt", "sourceProposalRef"]);
  const receipt = implementationSubmissionReceiptAt(evidence.receipt, `${path}.receipt`);
  const sourceProposalRef = canonicalRefAt(evidence.sourceProposalRef, `${path}.sourceProposalRef`);
  if (receipt.canonicalOutputHash !== outputHash) {
    fail(`${path}.receipt.canonicalOutputHash`, "does not bind completion output hash");
  }
  const expectedRef = `setfarm://runtime-completion/${requestId}/source-proposal/${receipt.sourceProposalHash}`;
  if (sourceProposalRef !== expectedRef) {
    fail(`${path}.sourceProposalRef`, "does not bind request and source proposal hash");
  }
  return { receipt, sourceProposalRef };
}

function completionRequestV2At(value: unknown, path: string): OperationalCompletionRequestV2 {
  const request = objectAt(value, path, [
    "ref", "requestId", "runRef", "runtimeSessionRef", "claimRef", "attemptRef", "stepRef", "storyRef", "workflowStepId", "storyId", "outputHash",
    "implementationSubmissionEvidence", "applyPhase", "claimOutcome", "completionPlanHash", "state", "requestedAt", "drainedAt", "processingAt",
    "acceptedAt", "rejectedAt", "createdAt", "updatedAt", "effects",
  ]);
  const { implementationSubmissionEvidence, ...v1Request } = request;
  const parsed = completionRequestAt(v1Request, path);
  return {
    ...parsed,
    implementationSubmissionEvidence: implementationSubmissionEvidence === null
      ? null
      : implementationSubmissionEvidenceAt(
          implementationSubmissionEvidence,
          parsed.requestId,
          parsed.outputHash,
          `${path}.implementationSubmissionEvidence`,
        ),
  };
}

const TERMINATION_LIFECYCLE_EVIDENCE_KEYS = [
  "deferredForCompletionRequestId",
  "runtimeSessionCount",
  "ownerInstanceId",
] as const;

const V3_DEPLOY_AUTHORITY_CODES = [
  "V3_DEPLOY_RUN_NOT_FOUND",
  "V3_DEPLOY_ACCEPTED_CANDIDATE_MISSING",
  "V3_DEPLOY_ACCEPTED_CANDIDATE_INVALID",
  "V3_DEPLOY_ACCEPTED_CANDIDATE_POINTER_MISMATCH",
  "V3_DEPLOY_SOURCE_UNAVAILABLE",
  "V3_DEPLOY_SOURCE_REVISION_MISMATCH",
  "V3_DEPLOY_PACKET_INVALID",
  "V3_DEPLOY_RUNTIME_ENV_MISSING",
  "V3_DEPLOY_TARGET_UNSUPPORTED",
  "V3_DEPLOY_PLATFORM_FAILED",
  "V3_DEPLOY_HEALTH_FAILED",
  "V3_DEPLOY_ROLLBACK_FAILED",
] as const;

function arbitraryRecordAt(value: unknown, path: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(path, "expected object");
  return value as JsonRecord;
}

function validateTerminationLifecycleEvidence(record: JsonRecord, path: string): void {
  if (record.deferredForCompletionRequestId !== undefined) {
    identityAt(record.deferredForCompletionRequestId, `${path}.deferredForCompletionRequestId`);
  }
  if (record.runtimeSessionCount !== undefined) {
    integerAt(record.runtimeSessionCount, `${path}.runtimeSessionCount`, 0);
  }
  if (record.ownerInstanceId !== undefined) {
    identityAt(record.ownerInstanceId, `${path}.ownerInstanceId`);
  }
}

function authorityEvidenceAt(value: unknown, path: string): Record<string, string | null> {
  const record = arbitraryRecordAt(value, path);
  for (const [key, item] of Object.entries(record)) {
    if (key.length === 0 || key.length > IDENTITY_MAX) fail(path, "invalid authority evidence key");
    if (item !== null && (typeof item !== "string" || item.length > 4_000)) {
      fail(`${path}.${key}`, "expected bounded string or null");
    }
  }
  return record as Record<string, string | null>;
}

function assertCompilerTerminationAuthority(
  path: string,
  targetStatus: "cancelled" | "failed",
  requestedBy: string,
  expectedRequester: string,
): void {
  if (targetStatus !== "failed" || requestedBy !== expectedRequester) {
    fail(path, "typed compiler termination evidence is bound to its exact failed-request authority");
  }
}

function v3DeployTerminationEvidenceAt(
  value: unknown,
  path: string,
  targetStatus: "cancelled" | "failed",
  requestedBy: string,
): OperationalV3DeployTerminationEvidenceV1 {
  const evidence = objectWithOptionalAt(value, path, [
    "schema", "terminalFailure", "owner", "refusalHash", "authorityCode", "authorityEvidence", "claimId", "modelRedispatchBudget",
  ], TERMINATION_LIFECYCLE_EVIDENCE_KEYS);
  assertCompilerTerminationAuthority(path, targetStatus, requestedBy, "setfarm.product-compiler.deploy-refusal");
  if (evidence.schema !== "setfarm.v3-deploy-authority-termination.v1") fail(`${path}.schema`, "unsupported schema");
  if (evidence.terminalFailure !== true) fail(`${path}.terminalFailure`, "expected true");
  if (evidence.owner !== "compiler") fail(`${path}.owner`, "expected compiler");
  sha256At(evidence.refusalHash, `${path}.refusalHash`);
  enumAt(evidence.authorityCode, `${path}.authorityCode`, V3_DEPLOY_AUTHORITY_CODES);
  authorityEvidenceAt(evidence.authorityEvidence, `${path}.authorityEvidence`);
  integerAt(evidence.claimId, `${path}.claimId`, 1);
  if (integerAt(evidence.modelRedispatchBudget, `${path}.modelRedispatchBudget`, 0) !== 0) {
    fail(`${path}.modelRedispatchBudget`, "compiler refusal must not redispatch the model");
  }
  validateTerminationLifecycleEvidence(evidence, path);
  return value as OperationalV3DeployTerminationEvidenceV1;
}

function v3PlanTerminationEvidenceAt(
  value: unknown,
  path: string,
  targetStatus: "cancelled" | "failed",
  requestedBy: string,
): OperationalV3PlanClarificationTerminationEvidenceV1 {
  const evidence = objectWithOptionalAt(value, path, [
    "schema", "terminalFailure", "owner", "rejectionHash", "sourceTaskHash", "reasonCodes", "requirementRefs", "modelRedispatchBudget",
  ], TERMINATION_LIFECYCLE_EVIDENCE_KEYS);
  assertCompilerTerminationAuthority(path, targetStatus, requestedBy, "setfarm.product-compiler.plan-refusal");
  if (evidence.schema !== "setfarm.v3-plan-clarification-termination.v1") fail(`${path}.schema`, "unsupported schema");
  if (evidence.terminalFailure !== true) fail(`${path}.terminalFailure`, "expected true");
  if (evidence.owner !== "compiler") fail(`${path}.owner`, "expected compiler");
  sha256At(evidence.rejectionHash, `${path}.rejectionHash`);
  sha256At(evidence.sourceTaskHash, `${path}.sourceTaskHash`);
  const reasonCodes = arrayAt(evidence.reasonCodes, `${path}.reasonCodes`, reasonCodeAt, 1_000);
  if (reasonCodes.length === 0) fail(`${path}.reasonCodes`, "expected at least one reason code");
  arrayAt(evidence.requirementRefs, `${path}.requirementRefs`, identityAt, 10_000);
  if (integerAt(evidence.modelRedispatchBudget, `${path}.modelRedispatchBudget`, 0) !== 0) {
    fail(`${path}.modelRedispatchBudget`, "compiler refusal must not redispatch the model");
  }
  validateTerminationLifecycleEvidence(evidence, path);
  return value as OperationalV3PlanClarificationTerminationEvidenceV1;
}

function v3DownstreamTerminationEvidenceAt(
  value: unknown,
  path: string,
  targetStatus: "cancelled" | "failed",
  requestedBy: string,
): OperationalV3DownstreamTerminationEvidenceV1 {
  const evidence = objectWithOptionalAt(value, path, [
    "schema", "routeHash", "packetHash", "sourceRevision", "outcome", "storyEvidenceRefs",
  ], ["requiredArtifact", ...TERMINATION_LIFECYCLE_EVIDENCE_KEYS]);
  assertCompilerTerminationAuthority(path, targetStatus, requestedBy, "setfarm-v3-downstream-compiler");
  if (evidence.schema !== "setfarm.v3-downstream-termination-evidence.v1") fail(`${path}.schema`, "unsupported schema");
  sha256At(evidence.routeHash, `${path}.routeHash`);
  sha256At(evidence.packetHash, `${path}.packetHash`);
  sourceRevisionAt(evidence.sourceRevision, `${path}.sourceRevision`);
  const outcome = enumAt(evidence.outcome, `${path}.outcome`, ["packet_amendment_required", "bounded_recovery_blocked"] as const);
  arrayAt(evidence.storyEvidenceRefs, `${path}.storyEvidenceRefs`, canonicalRefAt, 10_000);
  if ((outcome === "packet_amendment_required") !== (evidence.requiredArtifact === "setfarm.product-build-packet.v.next")) {
    fail(`${path}.requiredArtifact`, "packet-amendment evidence must bind the next packet artifact exactly");
  }
  validateTerminationLifecycleEvidence(evidence, path);
  return value as OperationalV3DownstreamTerminationEvidenceV1;
}

function terminationEvidenceAt(
  value: unknown,
  path: string,
  targetStatus: "cancelled" | "failed",
  requestedBy: string,
): OperationalTerminationEvidenceV1 {
  const evidence = arbitraryRecordAt(value, path);
  if (Object.hasOwn(evidence, "schema") && typeof evidence.schema !== "string") {
    fail(`${path}.schema`, "versioned evidence schema must be a string");
  }
  const schema = typeof evidence.schema === "string" ? evidence.schema : null;
  const expectedSchemaByRequester: Record<string, string> = {
    "setfarm.product-compiler.deploy-refusal": "setfarm.v3-deploy-authority-termination.v1",
    "setfarm.product-compiler.plan-refusal": "setfarm.v3-plan-clarification-termination.v1",
    "setfarm-v3-downstream-compiler": "setfarm.v3-downstream-termination-evidence.v1",
  };
  const expectedSchema = expectedSchemaByRequester[requestedBy];
  if (expectedSchema && schema !== expectedSchema) {
    fail(`${path}.schema`, "typed compiler termination requester requires its exact versioned evidence schema");
  }
  if (schema === "setfarm.v3-deploy-authority-termination.v1") {
    return v3DeployTerminationEvidenceAt(value, path, targetStatus, requestedBy);
  }
  if (schema === "setfarm.v3-plan-clarification-termination.v1") {
    return v3PlanTerminationEvidenceAt(value, path, targetStatus, requestedBy);
  }
  if (schema === "setfarm.v3-downstream-termination-evidence.v1") {
    return v3DownstreamTerminationEvidenceAt(value, path, targetStatus, requestedBy);
  }
  if (schema?.startsWith("setfarm.v3-")) fail(`${path}.schema`, "unsupported versioned v3 termination evidence");
  return value as Record<string, unknown>;
}

function terminationRequestAt(value: unknown, path: string): OperationalTerminationRequestV1 {
  const request = objectAt(value, path, [
    "ref", "requestId", "runRef", "targetStatus", "state", "requestedBy", "diagnostic", "evidence", "requestedAt", "drainedAt", "terminalizedAt", "createdAt", "updatedAt",
  ]);
  const targetStatus = enumAt(request.targetStatus, `${path}.targetStatus`, ["cancelled", "failed"] as const);
  const requestedBy = stringAt(request.requestedBy, `${path}.requestedBy`, { max: 500 });
  return {
    ref: canonicalRefAt(request.ref, `${path}.ref`),
    requestId: identityAt(request.requestId, `${path}.requestId`),
    runRef: canonicalRefAt(request.runRef, `${path}.runRef`),
    targetStatus,
    state: enumAt(request.state, `${path}.state`, ["requested", "draining", "drained", "terminalized", "quarantined"] as const),
    requestedBy,
    diagnostic: stringAt(request.diagnostic, `${path}.diagnostic`, { max: 4_000 }),
    evidence: terminationEvidenceAt(request.evidence, `${path}.evidence`, targetStatus, requestedBy),
    requestedAt: timestampAt(request.requestedAt, `${path}.requestedAt`),
    drainedAt: optionalTimestampAt(request.drainedAt, `${path}.drainedAt`),
    terminalizedAt: optionalTimestampAt(request.terminalizedAt, `${path}.terminalizedAt`),
    createdAt: timestampAt(request.createdAt, `${path}.createdAt`),
    updatedAt: timestampAt(request.updatedAt, `${path}.updatedAt`),
  };
}

function outboxItemAt(value: unknown, path: string): OperationalOutboxItemV1 {
  const item = objectAt(value, path, [
    "ref", "outboxId", "requestRef", "eventKey", "eventType", "aggregateType", "aggregateId", "state", "attemptCount", "publishedAt", "createdAt", "updatedAt",
  ]);
  return {
    ref: canonicalRefAt(item.ref, `${path}.ref`),
    outboxId: identityAt(item.outboxId, `${path}.outboxId`),
    requestRef: optionalCanonicalRefAt(item.requestRef, `${path}.requestRef`),
    eventKey: identityAt(item.eventKey, `${path}.eventKey`),
    eventType: identityAt(item.eventType, `${path}.eventType`),
    aggregateType: identityAt(item.aggregateType, `${path}.aggregateType`),
    aggregateId: identityAt(item.aggregateId, `${path}.aggregateId`),
    state: enumAt(item.state, `${path}.state`, ["pending", "leased", "published", "quarantined"] as const),
    attemptCount: integerAt(item.attemptCount, `${path}.attemptCount`, 0),
    publishedAt: optionalTimestampAt(item.publishedAt, `${path}.publishedAt`),
    createdAt: timestampAt(item.createdAt, `${path}.createdAt`),
    updatedAt: timestampAt(item.updatedAt, `${path}.updatedAt`),
  };
}

function invariantAt(value: unknown, path: string): OperationalInvariantV1 {
  const invariant = objectAt(value, path, ["code", "severity", "refs", "observedAt"]);
  const refs = arrayAt(invariant.refs, `${path}.refs`, canonicalRefAt, 100);
  if (refs.length === 0) fail(`${path}.refs`, "expected at least one ref");
  return {
    code: reasonCodeAt(invariant.code, `${path}.code`),
    severity: enumAt(invariant.severity, `${path}.severity`, ["warning", "error"] as const),
    refs,
    observedAt: timestampAt(invariant.observedAt, `${path}.observedAt`),
  };
}

function findingSetAt(value: unknown, path: string): OperationalFindingSetV1 {
  const item = objectAt(value, path, [
    "ref", "findingSetId", "findingSetHash", "runRef", "storyRef", "storyId", "packetHash", "sliceHash",
    "sourceRevision", "findingIds", "createdAt",
  ]);
  const findingSetHash = sha256At(item.findingSetHash, `${path}.findingSetHash`);
  const findingSetId = stringAt(item.findingSetId, `${path}.findingSetId`, { regex: FINDING_SET_ID });
  return {
    ref: canonicalRefAt(item.ref, `${path}.ref`),
    findingSetId,
    findingSetHash,
    runRef: canonicalRefAt(item.runRef, `${path}.runRef`),
    storyRef: canonicalRefAt(item.storyRef, `${path}.storyRef`),
    storyId: identityAt(item.storyId, `${path}.storyId`),
    packetHash: sha256At(item.packetHash, `${path}.packetHash`),
    sliceHash: sha256At(item.sliceHash, `${path}.sliceHash`),
    sourceRevision: sourceRevisionAt(item.sourceRevision, `${path}.sourceRevision`),
    findingIds: canonicalStringArrayAt(item.findingIds, `${path}.findingIds`, FINDING_ID, { min: 1, max: 5_000 }),
    createdAt: timestampAt(item.createdAt, `${path}.createdAt`),
  };
}

function evidenceBundleAt(value: unknown, path: string): OperationalEvidenceBundleV1 {
  const item = objectAt(value, path, [
    "ref", "evidenceId", "evidenceBundleHash", "runRef", "storyRef", "storyId", "attemptRef", "attemptId",
    "packetHash", "sliceHash", "sourceRevision", "aggregateVerdict", "predicateCount", "observationCount", "createdAt",
  ]);
  const evidenceBundleHash = sha256At(item.evidenceBundleHash, `${path}.evidenceBundleHash`);
  const evidenceId = stringAt(item.evidenceId, `${path}.evidenceId`, { regex: EVIDENCE_BUNDLE_ID });
  const attemptRef = optionalCanonicalRefAt(item.attemptRef, `${path}.attemptRef`);
  const attemptId = item.attemptId === null
    ? null
    : stringAt(item.attemptId, `${path}.attemptId`, { regex: ATTEMPT_ID });
  if ((attemptRef === null) !== (attemptId === null)) fail(`${path}.attemptRef`, "attempt ref and ID must be jointly present");
  return {
    ref: canonicalRefAt(item.ref, `${path}.ref`),
    evidenceId,
    evidenceBundleHash,
    runRef: canonicalRefAt(item.runRef, `${path}.runRef`),
    storyRef: canonicalRefAt(item.storyRef, `${path}.storyRef`),
    storyId: identityAt(item.storyId, `${path}.storyId`),
    attemptRef,
    attemptId,
    packetHash: sha256At(item.packetHash, `${path}.packetHash`),
    sliceHash: sha256At(item.sliceHash, `${path}.sliceHash`),
    sourceRevision: sourceRevisionAt(item.sourceRevision, `${path}.sourceRevision`),
    aggregateVerdict: enumAt(item.aggregateVerdict, `${path}.aggregateVerdict`, ["pass", "fail", "inconclusive", "incomplete"] as const),
    predicateCount: integerAt(item.predicateCount, `${path}.predicateCount`, 1),
    observationCount: integerAt(item.observationCount, `${path}.observationCount`, 1),
    createdAt: timestampAt(item.createdAt, `${path}.createdAt`),
  };
}

function recoveryBudgetAt(value: unknown, path: string): OperationalRecoveryBudgetV1 {
  const budget = objectAt(value, path, ["limits", "used"]);
  const parseCounts = (input: unknown, countPath: string) => {
    const counts = objectAt(input, countPath, ["implement", "supervisorRepair", "evidenceOnly"]);
    const parsed = {
      implement: integerAt(counts.implement, `${countPath}.implement`, 0),
      supervisorRepair: integerAt(counts.supervisorRepair, `${countPath}.supervisorRepair`, 0),
      evidenceOnly: integerAt(counts.evidenceOnly, `${countPath}.evidenceOnly`, 0),
    };
    if (parsed.implement > 1 || parsed.supervisorRepair > 1 || parsed.evidenceOnly > 3) {
      fail(countPath, "exceeds bounded recovery maximum");
    }
    return parsed;
  };
  const limits = parseCounts(budget.limits, `${path}.limits`);
  const used = parseCounts(budget.used, `${path}.used`);
  if (used.implement > limits.implement || used.supervisorRepair > limits.supervisorRepair || used.evidenceOnly > limits.evidenceOnly) {
    fail(`${path}.used`, "exceeds recovery limit");
  }
  return { limits, used };
}

function recoveryCaseAt(value: unknown, path: string): OperationalRecoveryCaseV1 {
  const item = objectAt(value, path, [
    "ref", "recoveryCaseId", "revisionRef", "revisionId", "revisionNumber", "runRef", "storyRef", "storyId",
    "findingSetRef", "findingSetHash", "packetHash", "sliceHash", "sourceRevision", "owner", "expectedDeltaKind",
    "status", "budget", "stateVersion", "terminalReasonCode", "createdAt", "updatedAt",
  ]);
  const status = enumAt(item.status, `${path}.status`, ["open", "repairing", "evidencing", "resolved", "blocked", "superseded"] as const);
  const terminalReasonCode = item.terminalReasonCode === null
    ? null
    : enumAt(item.terminalReasonCode, `${path}.terminalReasonCode`, [
      "evidence_satisfied",
      "specification_incomplete",
      "evidence_inconclusive",
      "budget_exhausted",
      "source_superseded",
      "upstream_recompile_required",
      "operator_required",
    ] as const);
  const terminal = ["resolved", "blocked", "superseded"].includes(status);
  if (terminal !== (terminalReasonCode !== null)) fail(`${path}.terminalReasonCode`, "must match recovery terminal state");
  const createdAt = timestampAt(item.createdAt, `${path}.createdAt`);
  const updatedAt = timestampAt(item.updatedAt, `${path}.updatedAt`);
  if (Date.parse(updatedAt) < Date.parse(createdAt)) fail(`${path}.updatedAt`, "precedes creation");
  return {
    ref: canonicalRefAt(item.ref, `${path}.ref`),
    recoveryCaseId: stringAt(item.recoveryCaseId, `${path}.recoveryCaseId`, { regex: RECOVERY_CASE_ID }),
    revisionRef: canonicalRefAt(item.revisionRef, `${path}.revisionRef`),
    revisionId: stringAt(item.revisionId, `${path}.revisionId`, { regex: RECOVERY_REVISION_ID }),
    revisionNumber: integerAt(item.revisionNumber, `${path}.revisionNumber`, 1),
    runRef: canonicalRefAt(item.runRef, `${path}.runRef`),
    storyRef: canonicalRefAt(item.storyRef, `${path}.storyRef`),
    storyId: identityAt(item.storyId, `${path}.storyId`),
    findingSetRef: canonicalRefAt(item.findingSetRef, `${path}.findingSetRef`),
    findingSetHash: sha256At(item.findingSetHash, `${path}.findingSetHash`),
    packetHash: sha256At(item.packetHash, `${path}.packetHash`),
    sliceHash: sha256At(item.sliceHash, `${path}.sliceHash`),
    sourceRevision: sourceRevisionAt(item.sourceRevision, `${path}.sourceRevision`),
    owner: enumAt(item.owner, `${path}.owner`, ["implement", "supervisor", "compiler", "infrastructure", "operator"] as const),
    expectedDeltaKind: enumAt(item.expectedDeltaKind, `${path}.expectedDeltaKind`, ["source_change", "evidence_refresh", "upstream_recompile", "operator_action"] as const),
    status,
    budget: recoveryBudgetAt(item.budget, `${path}.budget`),
    stateVersion: integerAt(item.stateVersion, `${path}.stateVersion`, 1),
    terminalReasonCode,
    createdAt,
    updatedAt,
  };
}

function recoveryDispatchAt(value: unknown, path: string): OperationalRecoveryDispatchV1 {
  const item = objectAt(value, path, [
    "ref", "dispatchId", "recoveryCaseRef", "recoveryCaseId", "revisionRef", "revisionId", "revisionNumber",
    "runRef", "storyRef", "storyId", "findingSetRef", "findingSetHash", "dispatchClass", "packetHash", "sliceHash",
    "sourceRevision", "findingIds", "deliveryState", "attemptRef", "attemptId", "claimRef", "executionSliceHash",
    "attemptCount", "leaseOwnerInstanceId", "leaseExpiresAt", "terminalReasonCode", "authorizedAt", "terminalAt",
  ]);
  const deliveryState = enumAt(item.deliveryState, `${path}.deliveryState`, [
    "authorized", "leased", "attempt_reserved", "running", "succeeded", "failed", "blocked", "superseded",
  ] as const);
  const attemptRefValue = optionalCanonicalRefAt(item.attemptRef, `${path}.attemptRef`);
  const attemptId = item.attemptId === null
    ? null
    : stringAt(item.attemptId, `${path}.attemptId`, { regex: ATTEMPT_ID });
  const claimRefValue = optionalCanonicalRefAt(item.claimRef, `${path}.claimRef`);
  const attemptFields = [attemptRefValue, attemptId, claimRefValue].filter(Boolean).length;
  if (attemptFields !== 0 && attemptFields !== 3) fail(`${path}.attemptRef`, "attempt and claim refs must be jointly present");
  const executionSliceHash = optionalSha256At(item.executionSliceHash, `${path}.executionSliceHash`);
  const requiresAttempt = ["attempt_reserved", "running", "succeeded", "failed"].includes(deliveryState);
  if (requiresAttempt && (attemptFields !== 3 || !executionSliceHash)) fail(`${path}.attemptRef`, "delivery state requires exact attempt and execution slice");
  const leaseOwnerInstanceId = optionalIdentityAt(item.leaseOwnerInstanceId, `${path}.leaseOwnerInstanceId`);
  const leaseExpiresAt = optionalTimestampAt(item.leaseExpiresAt, `${path}.leaseExpiresAt`);
  const leaseFields = [leaseOwnerInstanceId, leaseExpiresAt].filter(Boolean).length;
  if ((deliveryState === "authorized" && leaseFields !== 0) || (deliveryState !== "authorized" && leaseFields !== 2)) {
    fail(`${path}.leaseOwnerInstanceId`, "lease projection does not match delivery state");
  }
  const terminalAt = optionalTimestampAt(item.terminalAt, `${path}.terminalAt`);
  const terminal = ["succeeded", "failed", "blocked", "superseded"].includes(deliveryState);
  if (terminal !== Boolean(terminalAt)) fail(`${path}.terminalAt`, "terminal timestamp does not match delivery state");
  const terminalReasonCode = item.terminalReasonCode === null
    ? null
    : stringAt(item.terminalReasonCode, `${path}.terminalReasonCode`, { regex: MACHINE_REASON_CODE, max: 160 });
  if (!terminal && terminalReasonCode) fail(`${path}.terminalReasonCode`, "non-terminal delivery cannot expose terminal reason");
  return {
    ref: canonicalRefAt(item.ref, `${path}.ref`),
    dispatchId: stringAt(item.dispatchId, `${path}.dispatchId`, { regex: RECOVERY_DISPATCH_ID }),
    recoveryCaseRef: canonicalRefAt(item.recoveryCaseRef, `${path}.recoveryCaseRef`),
    recoveryCaseId: stringAt(item.recoveryCaseId, `${path}.recoveryCaseId`, { regex: RECOVERY_CASE_ID }),
    revisionRef: canonicalRefAt(item.revisionRef, `${path}.revisionRef`),
    revisionId: stringAt(item.revisionId, `${path}.revisionId`, { regex: RECOVERY_REVISION_ID }),
    revisionNumber: integerAt(item.revisionNumber, `${path}.revisionNumber`, 1),
    runRef: canonicalRefAt(item.runRef, `${path}.runRef`),
    storyRef: canonicalRefAt(item.storyRef, `${path}.storyRef`),
    storyId: identityAt(item.storyId, `${path}.storyId`),
    findingSetRef: canonicalRefAt(item.findingSetRef, `${path}.findingSetRef`),
    findingSetHash: sha256At(item.findingSetHash, `${path}.findingSetHash`),
    dispatchClass: enumAt(item.dispatchClass, `${path}.dispatchClass`, ["product_implementation", "supervisor_repair", "evidence_only"] as const),
    packetHash: sha256At(item.packetHash, `${path}.packetHash`),
    sliceHash: sha256At(item.sliceHash, `${path}.sliceHash`),
    sourceRevision: sourceRevisionAt(item.sourceRevision, `${path}.sourceRevision`),
    findingIds: canonicalStringArrayAt(item.findingIds, `${path}.findingIds`, FINDING_ID, { min: 1, max: 5_000 }),
    deliveryState,
    attemptRef: attemptRefValue,
    attemptId,
    claimRef: claimRefValue,
    executionSliceHash,
    attemptCount: integerAt(item.attemptCount, `${path}.attemptCount`, 0),
    leaseOwnerInstanceId,
    leaseExpiresAt,
    terminalReasonCode,
    authorizedAt: timestampAt(item.authorizedAt, `${path}.authorizedAt`),
    terminalAt,
  };
}

function acceptedStoryEvidenceAt(value: unknown, path: string): OperationalAcceptedStoryEvidenceV1 {
  const story = objectAt(value, path, [
    "storyId", "attemptId", "sliceHash", "evidencePlanHash", "evidencePlanArtifactHash",
    "evidenceBundleHash", "evidenceId", "predicateRefs",
  ]);
  return {
    storyId: identityAt(story.storyId, `${path}.storyId`),
    attemptId: stringAt(story.attemptId, `${path}.attemptId`, { regex: ATTEMPT_ID }),
    sliceHash: sha256At(story.sliceHash, `${path}.sliceHash`),
    evidencePlanHash: sha256At(story.evidencePlanHash, `${path}.evidencePlanHash`),
    evidencePlanArtifactHash: sha256At(story.evidencePlanArtifactHash, `${path}.evidencePlanArtifactHash`),
    evidenceBundleHash: sha256At(story.evidenceBundleHash, `${path}.evidenceBundleHash`),
    evidenceId: stringAt(story.evidenceId, `${path}.evidenceId`, { regex: EVIDENCE_BUNDLE_ID }),
    predicateRefs: canonicalStringArrayAt(story.predicateRefs, `${path}.predicateRefs`, EVIDENCE_PREDICATE_REF, { min: 1, max: 10_000 }),
  };
}

function acceptedCandidateAt(value: unknown, path: string): OperationalAcceptedCandidateV1 {
  const projection = objectAt(value, path, ["ref", "candidate", "createdAt"]);
  const raw = objectAt(projection.candidate, `${path}.candidate`, [
    "schema", "runId", "packetHash", "storyPlanHash", "sourceRevision", "storyEvidence",
    "integrationEvidenceHash", "acceptor", "candidateId", "candidateHash",
  ]);
  if (raw.schema !== "setfarm.accepted-candidate.v1") fail(`${path}.candidate.schema`, "unsupported accepted candidate schema");
  const acceptor = objectAt(raw.acceptor, `${path}.candidate.acceptor`, ["id", "version", "codeSha", "environmentHash"]);
  const storyEvidence = arrayAt(raw.storyEvidence, `${path}.candidate.storyEvidence`, acceptedStoryEvidenceAt, 5_000);
  if (storyEvidence.length === 0) fail(`${path}.candidate.storyEvidence`, "accepted candidate requires story evidence");
  const storyIds = storyEvidence.map((story) => story.storyId);
  const attemptIds = storyEvidence.map((story) => story.attemptId);
  const bundleHashes = storyEvidence.map((story) => story.evidenceBundleHash);
  if (new Set(storyIds).size !== storyIds.length
    || storyIds.some((storyId, index) => storyId !== [...storyIds].sort()[index])
    || new Set(attemptIds).size !== attemptIds.length
    || new Set(bundleHashes).size !== bundleHashes.length) {
    fail(`${path}.candidate.storyEvidence`, "accepted stories must have canonical unique identities");
  }
  const candidateHash = sha256At(raw.candidateHash, `${path}.candidate.candidateHash`);
  const candidateId = stringAt(raw.candidateId, `${path}.candidate.candidateId`, { regex: ACCEPTED_CANDIDATE_ID });
  if (candidateId !== `ACPT_${candidateHash}`) fail(`${path}.candidate.candidateId`, "does not bind candidate hash");
  const ref = canonicalRefAt(projection.ref, `${path}.ref`);
  if (ref !== `setfarm://accepted-candidate/${candidateHash}`) fail(`${path}.ref`, "does not bind candidate hash");
  const candidate: OperationalAcceptedCandidatePayloadV1 = {
    schema: "setfarm.accepted-candidate.v1",
    runId: identityAt(raw.runId, `${path}.candidate.runId`),
    packetHash: sha256At(raw.packetHash, `${path}.candidate.packetHash`),
    storyPlanHash: sha256At(raw.storyPlanHash, `${path}.candidate.storyPlanHash`),
    sourceRevision: sourceRevisionAt(raw.sourceRevision, `${path}.candidate.sourceRevision`),
    storyEvidence,
    integrationEvidenceHash: sha256At(raw.integrationEvidenceHash, `${path}.candidate.integrationEvidenceHash`),
    acceptor: {
      id: enumAt(acceptor.id, `${path}.candidate.acceptor.id`, ["setfarm-final-tree-acceptor"] as const),
      version: enumAt(acceptor.version, `${path}.candidate.acceptor.version`, ["1.0.0"] as const),
      codeSha: gitHashAt(acceptor.codeSha, `${path}.candidate.acceptor.codeSha`),
      environmentHash: sha256At(acceptor.environmentHash, `${path}.candidate.acceptor.environmentHash`),
    },
    candidateId,
    candidateHash,
  };
  const expectedIntegrationHash = hashCanonicalJson({
    schema: "setfarm.integrated-source-evidence.v1",
    runId: candidate.runId,
    packetHash: candidate.packetHash,
    storyPlanHash: candidate.storyPlanHash,
    sourceRevision: candidate.sourceRevision,
    storyEvidence: candidate.storyEvidence,
  });
  if (candidate.integrationEvidenceHash !== expectedIntegrationHash) {
    fail(`${path}.candidate.integrationEvidenceHash`, "does not bind final-tree story evidence");
  }
  const { candidateId: _candidateId, candidateHash: _candidateHash, ...candidateIdentity } = candidate;
  if (hashCanonicalJson(candidateIdentity) !== candidateHash) {
    fail(`${path}.candidate.candidateHash`, "does not bind canonical candidate identity");
  }
  return {
    ref,
    candidate,
    createdAt: timestampAt(projection.createdAt, `${path}.createdAt`),
  };
}

function processIdentityAt(value: unknown, path: string): OperationalProcessIdentityV1 {
  const raw = objectWithOptionalAt(
    value,
    path,
    ["schema", "pid", "processStartedAt", "source"],
    ["processGroupId"],
  );
  if (raw.schema !== "setfarm.process-identity.v1") fail(`${path}.schema`, "unsupported process identity schema");
  return {
    schema: "setfarm.process-identity.v1",
    pid: integerAt(raw.pid, `${path}.pid`, 1),
    processStartedAt: timestampAt(raw.processStartedAt, `${path}.processStartedAt`),
    ...(raw.processGroupId === undefined
      ? {}
      : { processGroupId: integerAt(raw.processGroupId, `${path}.processGroupId`, 1) }),
    source: enumAt(raw.source, `${path}.source`, ["observed_os", "tracked_child", "legacy-backfill"] as const),
  };
}

function buildArtifactAt(value: unknown, path: string): OperationalV3BuildArtifactV1 {
  const raw = objectAt(value, path, [
    "schema", "outputPaths", "files", "totalBytes", "artifactHash", "evidenceRef",
  ]);
  if (raw.schema !== "setfarm.v3-build-artifact.v1") fail(`${path}.schema`, "unsupported build artifact schema");
  const outputPaths = arrayAt(
    raw.outputPaths,
    `${path}.outputPaths`,
    normalizedRelativeLocatorAt,
    500,
  );
  if (outputPaths.length === 0
    || new Set(outputPaths).size !== outputPaths.length
    || outputPaths.some((entry, index) => entry !== [...outputPaths].sort()[index])) {
    fail(`${path}.outputPaths`, "expected non-empty unique canonical order");
  }
  outputPaths.forEach((entry, index) => {
    if (outputPaths.some((candidate, candidateIndex) =>
      candidateIndex !== index && entry.startsWith(`${candidate}/`))) {
      fail(`${path}.outputPaths[${index}]`, "build output paths cannot overlap");
    }
  });
  const files = arrayAt(raw.files, `${path}.files`, (item, itemPath) => {
    const file = objectAt(item, itemPath, ["path", "byteLength", "contentHash", "executable"]);
    const byteLength = integerAt(file.byteLength, `${itemPath}.byteLength`, 0);
    if (byteLength > V3_BUILD_ARTIFACT_MAX_FILE_BYTES) fail(`${itemPath}.byteLength`, "build artifact file is too large");
    return {
      path: normalizedRelativeLocatorAt(file.path, `${itemPath}.path`),
      byteLength,
      contentHash: sha256At(file.contentHash, `${itemPath}.contentHash`),
      executable: booleanAt(file.executable, `${itemPath}.executable`),
    };
  }, V3_BUILD_ARTIFACT_MAX_FILES);
  if (files.length === 0
    || new Set(files.map((file) => file.path)).size !== files.length
    || files.some((entry, index) => entry.path !== [...files].sort((left, right) => left.path.localeCompare(right.path))[index]?.path)) {
    fail(`${path}.files`, "expected non-empty unique canonical file order");
  }
  files.forEach((file, index) => {
    if (!outputPaths.some((outputPath) => file.path === outputPath || file.path.startsWith(`${outputPath}/`))) {
      fail(`${path}.files[${index}].path`, "build artifact file is outside sealed output paths");
    }
  });
  outputPaths.forEach((outputPath, index) => {
    if (!files.some((file) => file.path === outputPath || file.path.startsWith(`${outputPath}/`))) {
      fail(`${path}.outputPaths[${index}]`, "sealed output path contains no file");
    }
  });
  const totalBytes = integerAt(raw.totalBytes, `${path}.totalBytes`, 0);
  if (totalBytes > V3_BUILD_ARTIFACT_MAX_TOTAL_BYTES
    || files.reduce((total, file) => total + file.byteLength, 0) !== totalBytes) {
    fail(`${path}.totalBytes`, "does not match bounded build artifact files");
  }
  const artifactHash = sha256At(raw.artifactHash, `${path}.artifactHash`);
  const artifact: OperationalV3BuildArtifactV1 = {
    schema: "setfarm.v3-build-artifact.v1",
    outputPaths,
    files,
    totalBytes,
    artifactHash,
    evidenceRef: stringAt(raw.evidenceRef, `${path}.evidenceRef`, { max: 2_000 }),
  };
  const { artifactHash: _artifactHash, evidenceRef: _evidenceRef, ...identity } = artifact;
  if (hashCanonicalJson(identity) !== artifact.artifactHash) fail(`${path}.artifactHash`, "does not bind canonical build artifact");
  return artifact;
}

function listenerOwnershipAt(value: unknown, path: string): OperationalV3ListenerOwnershipV1 {
  const raw = objectAt(value, path, [
    "schema", "ownerProcess", "listenerPids", "listenerProcesses", "host", "port", "checkedAt", "evidenceRef",
  ]);
  if (raw.schema !== "setfarm.v3-listener-ownership.v1") fail(`${path}.schema`, "unsupported listener ownership schema");
  const listenerPids = arrayAt(
    raw.listenerPids,
    `${path}.listenerPids`,
    (item, itemPath) => integerAt(item, itemPath, 1),
    10_000,
  );
  if (listenerPids.length === 0
    || new Set(listenerPids).size !== listenerPids.length
    || listenerPids.some((pid, index) => pid !== [...listenerPids].sort((left, right) => left - right)[index])) {
    fail(`${path}.listenerPids`, "expected non-empty unique canonical PID order");
  }
  const ownerProcess = processIdentityAt(raw.ownerProcess, `${path}.ownerProcess`);
  if (ownerProcess.source !== "observed_os"
    || ownerProcess.processGroupId === undefined
    || ownerProcess.processGroupId !== ownerProcess.pid) {
    fail(`${path}.ownerProcess`, "listener owner must be an observed process-group leader");
  }
  const listenerProcesses = arrayAt(
    raw.listenerProcesses,
    `${path}.listenerProcesses`,
    processIdentityAt,
    10_000,
  );
  if (
    listenerProcesses.length !== listenerPids.length
    || listenerProcesses.some((process, index) => process.pid !== listenerPids[index])
    || listenerProcesses.some((process) =>
      process.source !== "observed_os" || process.processGroupId !== ownerProcess.pid)
  ) {
    fail(`${path}.listenerProcesses`, "must bind every canonical listener PID to the observed owner process group");
  }
  const port = integerAt(raw.port, `${path}.port`, 1);
  if (port > 65_535) fail(`${path}.port`, "port is out of range");
  return {
    schema: "setfarm.v3-listener-ownership.v1",
    ownerProcess,
    listenerPids,
    listenerProcesses,
    host: stringAt(raw.host, `${path}.host`, { max: 500 }),
    port,
    checkedAt: timestampAt(raw.checkedAt, `${path}.checkedAt`),
    evidenceRef: stringAt(raw.evidenceRef, `${path}.evidenceRef`, { max: 2_000 }),
  };
}

function deploymentReceiptAt(value: unknown, path: string): OperationalV3DeployReceiptV1 {
  const projection = objectAt(value, path, ["ref", "receipt", "createdAt"]);
  const raw = objectAt(projection.receipt, `${path}.receipt`, [
    "schema", "runId", "candidateId", "candidateHash", "packetHash", "project", "stack",
    "buildCommandId", "previewCommandId", "sourceBefore", "sourceAfter", "buildArtifact", "runtime", "health",
    "terminalProjectProjection", "environmentNames", "completedAt", "receiptHash",
  ]);
  if (raw.schema !== "setfarm.v3-deploy-receipt.v1") fail(`${path}.receipt.schema`, "unsupported deploy receipt schema");

  const project = objectAt(raw.project, `${path}.receipt.project`, ["schema", "productId", "projectId", "displayName", "summary"]);
  if (project.schema !== "setfarm.v3-deploy-project.v1") fail(`${path}.receipt.project.schema`, "unsupported project schema");
  const parsedProject = {
    schema: "setfarm.v3-deploy-project.v1" as const,
    productId: stringAt(project.productId, `${path}.receipt.project.productId`, { regex: PRODUCT_ID, max: 160 }),
    projectId: stringAt(project.projectId, `${path}.receipt.project.projectId`, { regex: PROJECT_ID, max: 120 }),
    displayName: stringAt(project.displayName, `${path}.receipt.project.displayName`, { max: 200 }),
    summary: stringAt(project.summary, `${path}.receipt.project.summary`, { max: 2_000 }),
  };

  const stack = objectAt(raw.stack, `${path}.receipt.stack`, [
    "schema", "stackPackId", "stackPackVersion", "stackPackContentHash", "platform", "techStack",
  ]);
  if (stack.schema !== "setfarm.v3-deploy-stack.v1") fail(`${path}.receipt.stack.schema`, "unsupported stack schema");
  const parsedStack: OperationalV3DeployReceiptPayloadV1["stack"] = {
    schema: "setfarm.v3-deploy-stack.v1",
    stackPackId: stringAt(stack.stackPackId, `${path}.receipt.stack.stackPackId`, { max: 160 }),
    stackPackVersion: stringAt(stack.stackPackVersion, `${path}.receipt.stack.stackPackVersion`, { max: 100 }),
    stackPackContentHash: sha256At(stack.stackPackContentHash, `${path}.receipt.stack.stackPackContentHash`),
    platform: stack.platform === null ? null : enumAt(stack.platform, `${path}.receipt.stack.platform`, ["web", "mobile", "desktop", "api", "cli", "game"] as const),
    techStack: stack.techStack === null ? null : enumAt(stack.techStack, `${path}.receipt.stack.techStack`, [
      "vite-react", "nextjs", "static-html", "browser-game", "node-express", "python-web",
      "node-cli", "python-cli", "react-native-expo", "android-native", "ios-native", "desktop-electron",
    ] as const),
  };

  const parsedBuildArtifact = buildArtifactAt(raw.buildArtifact, `${path}.receipt.buildArtifact`);

  const parsedRuntime = parseSetfarmV3RuntimeDeploymentV1(
    raw.runtime,
    `${path}.receipt.runtime`,
  );

  const health = objectAt(raw.health, `${path}.receipt.health`, [
    "schema", "status", "httpStatus", "checkedAt", "evidenceRef",
    "buildArtifactHash", "buildArtifactEvidenceRef", "sealedRuntimeManifestHash",
    "sealedRuntimeManifestEvidenceRef", "listenerOwnership", "runtimeIsolation",
  ]);
  if (health.schema !== "setfarm.v3-deploy-health-proof.v1") fail(`${path}.receipt.health.schema`, "unsupported health schema");
  const parsedHealth: OperationalV3DeployReceiptPayloadV1["health"] = {
    schema: "setfarm.v3-deploy-health-proof.v1",
    status: enumAt(health.status, `${path}.receipt.health.status`, ["pass"] as const),
    httpStatus: integerAt(health.httpStatus, `${path}.receipt.health.httpStatus`, 200),
    checkedAt: timestampAt(health.checkedAt, `${path}.receipt.health.checkedAt`),
    evidenceRef: stringAt(health.evidenceRef, `${path}.receipt.health.evidenceRef`, { max: 2_000 }),
    buildArtifactHash: sha256At(health.buildArtifactHash, `${path}.receipt.health.buildArtifactHash`),
    buildArtifactEvidenceRef: stringAt(health.buildArtifactEvidenceRef, `${path}.receipt.health.buildArtifactEvidenceRef`, { max: 2_000 }),
    sealedRuntimeManifestHash: sha256At(health.sealedRuntimeManifestHash, `${path}.receipt.health.sealedRuntimeManifestHash`),
    sealedRuntimeManifestEvidenceRef: stringAt(health.sealedRuntimeManifestEvidenceRef, `${path}.receipt.health.sealedRuntimeManifestEvidenceRef`, { max: 2_000 }),
    listenerOwnership: parseSetfarmV3ListenerOwnershipV1(
      health.listenerOwnership,
      `${path}.receipt.health.listenerOwnership`,
    ),
    runtimeIsolation: parseSetfarmV3RuntimeIsolationProofV1(
      health.runtimeIsolation,
      `${path}.receipt.health.runtimeIsolation`,
    ),
  };
  if (parsedHealth.httpStatus > 399) fail(`${path}.receipt.health.httpStatus`, "health status is out of range");

  const terminal = objectAt(raw.terminalProjectProjection, `${path}.receipt.terminalProjectProjection`, [
    "schema", "owner", "state", "runId", "candidateHash", "projectId", "serviceId", "port", "healthUrl", "evidenceRef",
    "buildArtifactHash",
  ]);
  if (terminal.schema !== "setfarm.v3-terminal-project-projection.v1") fail(`${path}.receipt.terminalProjectProjection.schema`, "unsupported terminal projection schema");
  const parsedTerminal: OperationalV3DeployReceiptPayloadV1["terminalProjectProjection"] = {
    schema: "setfarm.v3-terminal-project-projection.v1",
    owner: enumAt(terminal.owner, `${path}.receipt.terminalProjectProjection.owner`, ["mission-control-terminal-projector"] as const),
    state: enumAt(terminal.state, `${path}.receipt.terminalProjectProjection.state`, ["pending_terminal_projection"] as const),
    runId: identityAt(terminal.runId, `${path}.receipt.terminalProjectProjection.runId`),
    candidateHash: sha256At(terminal.candidateHash, `${path}.receipt.terminalProjectProjection.candidateHash`),
    projectId: stringAt(terminal.projectId, `${path}.receipt.terminalProjectProjection.projectId`, { regex: PROJECT_ID, max: 120 }),
    serviceId: stringAt(terminal.serviceId, `${path}.receipt.terminalProjectProjection.serviceId`, { max: 500 }),
    port: integerAt(terminal.port, `${path}.receipt.terminalProjectProjection.port`, 1),
    healthUrl: urlAt(terminal.healthUrl, `${path}.receipt.terminalProjectProjection.healthUrl`),
    evidenceRef: stringAt(terminal.evidenceRef, `${path}.receipt.terminalProjectProjection.evidenceRef`, { max: 2_000 }),
    buildArtifactHash: sha256At(terminal.buildArtifactHash, `${path}.receipt.terminalProjectProjection.buildArtifactHash`),
  };
  if (parsedTerminal.port > 65_535) fail(`${path}.receipt.terminalProjectProjection.port`, "port is out of range");

  const receipt: OperationalV3DeployReceiptPayloadV1 = {
    schema: "setfarm.v3-deploy-receipt.v1",
    runId: identityAt(raw.runId, `${path}.receipt.runId`),
    candidateId: stringAt(raw.candidateId, `${path}.receipt.candidateId`, { regex: ACCEPTED_CANDIDATE_ID }),
    candidateHash: sha256At(raw.candidateHash, `${path}.receipt.candidateHash`),
    packetHash: sha256At(raw.packetHash, `${path}.receipt.packetHash`),
    project: parsedProject,
    stack: parsedStack,
    buildCommandId: stringAt(raw.buildCommandId, `${path}.receipt.buildCommandId`, { max: 160 }),
    previewCommandId: stringAt(raw.previewCommandId, `${path}.receipt.previewCommandId`, { max: 160 }),
    sourceBefore: sourceRevisionAt(raw.sourceBefore, `${path}.receipt.sourceBefore`),
    sourceAfter: sourceRevisionAt(raw.sourceAfter, `${path}.receipt.sourceAfter`),
    buildArtifact: parsedBuildArtifact,
    runtime: parsedRuntime,
    health: parsedHealth,
    terminalProjectProjection: parsedTerminal,
    environmentNames: canonicalStringArrayAt(raw.environmentNames, `${path}.receipt.environmentNames`, ENVIRONMENT_NAME, { max: 500 }),
    completedAt: timestampAt(raw.completedAt, `${path}.receipt.completedAt`),
    receiptHash: sha256At(raw.receiptHash, `${path}.receipt.receiptHash`),
  };
  if (receipt.candidateId !== `ACPT_${receipt.candidateHash}`) fail(`${path}.receipt.candidateId`, "does not bind candidate hash");
  if (!sourceIdentityMatches(receipt.sourceBefore, receipt.sourceAfter)) fail(`${path}.receipt.sourceAfter`, "deploy changed AcceptedCandidate source");
  if (receipt.runtime.projectId !== receipt.project.projectId) fail(`${path}.receipt.runtime.projectId`, "does not bind project");
  const expectedBuildArtifactRef = `setfarm://deploy/build-artifact/${receipt.runId}/${receipt.buildArtifact.artifactHash}`;
  const expectedSealedRuntimeRef = `setfarm://deploy/sealed-runtime/${receipt.runId}/${receipt.candidateHash}/${receipt.buildArtifact.artifactHash}`;
  const expectedManifestEvidenceRef = `setfarm://deploy/sealed-runtime-manifest/${receipt.runId}/${receipt.candidateHash}/${receipt.buildArtifact.artifactHash}/${receipt.runtime.sealedRuntimeManifestHash}`;
  const expectedSealAuthorityEvidenceRef = `setfarm://deploy/seal-authority/${receipt.runId}/${receipt.candidateHash}/${receipt.buildArtifact.artifactHash}/${receipt.runtime.sealAuthorityHash}`;
  const expectedRuntimeEvidenceRef = `setfarm://deploy/runtime/${receipt.runId}/${receipt.project.projectId}`;
  const expectedIsolationEvidenceRef = `setfarm://deploy/runtime-isolation/${receipt.runId}/${receipt.candidateHash}/${receipt.buildArtifact.artifactHash}/${receipt.runtime.runtimeIsolation.authorityHash}`;
  if (
    receipt.buildArtifact.evidenceRef !== expectedBuildArtifactRef
    || receipt.runtime.buildArtifactHash !== receipt.buildArtifact.artifactHash
    || receipt.runtime.buildArtifactEvidenceRef !== expectedBuildArtifactRef
    || receipt.runtime.sealedRuntimeRef !== expectedSealedRuntimeRef
    || receipt.runtime.sealedRuntimeManifestHash !== receipt.health.sealedRuntimeManifestHash
    || receipt.runtime.sealedRuntimeManifestEvidenceRef !== expectedManifestEvidenceRef
    || receipt.health.sealedRuntimeManifestEvidenceRef !== expectedManifestEvidenceRef
    || receipt.runtime.sealAuthorityEvidenceRef !== expectedSealAuthorityEvidenceRef
    || receipt.runtime.evidenceRef !== expectedRuntimeEvidenceRef
    || receipt.health.evidenceRef !== `${expectedRuntimeEvidenceRef}/health`
    || receipt.health.buildArtifactHash !== receipt.buildArtifact.artifactHash
    || receipt.health.buildArtifactEvidenceRef !== expectedBuildArtifactRef
    || receipt.terminalProjectProjection.buildArtifactHash !== receipt.buildArtifact.artifactHash
    || receipt.runtime.runtimeIsolation.evidenceRef !== expectedIsolationEvidenceRef
    || receipt.runtime.runtimeDataContractHash !== receipt.runtime.runtimeIsolation.runtimeDataContractHash
    || receipt.runtime.runtimeDataContractHash !== receipt.runtime.volumeProvisioning.runtimeDataContractHash
    || receipt.runtime.volumeProvisioning.runId !== receipt.runId
    || receipt.runtime.volumeProvisioning.projectId !== receipt.project.projectId
    || receipt.runtime.runtimeIsolation.volumeProvisioningHash !== receipt.runtime.volumeProvisioning.volumeProvisioningHash
    || receipt.health.runtimeIsolation.authorityHash !== receipt.runtime.runtimeIsolation.authorityHash
    || receipt.health.runtimeIsolation.evidenceRef !== receipt.runtime.runtimeIsolation.evidenceRef
  ) fail(`${path}.receipt.buildArtifact`, "runtime, sealed runtime, health, and terminal projection do not bind exact build artifact");
  if (
    receipt.runtime.serviceId !== `process:${receipt.health.listenerOwnership.ownerProcess.pid}`
    || receipt.health.listenerOwnership.host !== receipt.runtime.host
    || receipt.health.listenerOwnership.port !== receipt.runtime.port
    || !sameSetfarmObservedProcessIdentity(
      receipt.health.runtimeIsolation.challenge.wrapperProcessIdentity,
      receipt.health.listenerOwnership.ownerProcess,
    )
  ) fail(`${path}.receipt.health.listenerOwnership`, "does not bind runtime listener ownership");
  if (
    receipt.terminalProjectProjection.runId !== receipt.runId
    || receipt.terminalProjectProjection.candidateHash !== receipt.candidateHash
    || receipt.terminalProjectProjection.projectId !== receipt.project.projectId
    || receipt.terminalProjectProjection.serviceId !== receipt.runtime.serviceId
    || receipt.terminalProjectProjection.port !== receipt.runtime.port
    || receipt.terminalProjectProjection.healthUrl !== receipt.runtime.healthUrl
    || receipt.terminalProjectProjection.buildArtifactHash !== receipt.runtime.buildArtifactHash
  ) fail(`${path}.receipt.terminalProjectProjection`, "does not bind deploy authority");
  const { receiptHash: _receiptHash, ...receiptIdentity } = receipt;
  if (hashCanonicalJson(receiptIdentity) !== receipt.receiptHash) fail(`${path}.receipt.receiptHash`, "does not bind canonical receipt identity");
  const ref = canonicalRefAt(projection.ref, `${path}.ref`);
  if (ref !== `setfarm://v3-deploy-receipts/${receipt.receiptHash}`) fail(`${path}.ref`, "does not bind receipt hash");
  return {
    ref,
    receipt,
    createdAt: timestampAt(projection.createdAt, `${path}.createdAt`),
  };
}

function projectTransferProjectionAt(
  value: unknown,
  path: string,
): OperationalV3CanonicalProjectProjectionV1 {
  const raw = objectWithOptionalAt(value, path, [
    "id", "name", "description", "type", "ports", "deployUrl", "service", "serviceStatus",
    "status", "stack", "createdBy", "productCompilerProtocol", "workflowRunId", "setfarmRunIds",
    "acceptedCandidateId", "acceptedCandidateHash", "acceptedPacketHash", "acceptedSourceSha",
    "acceptedSourceTreeHash", "deploymentReceiptHash", "deploymentReceiptRef", "deploymentHealthRef",
    "deploymentHealthUrl", "deployedAt", "completedAt",
  ], ["runNumber"]);
  const ports = objectAt(raw.ports, `${path}.ports`, ["frontend"]);
  const frontend = integerAt(ports.frontend, `${path}.ports.frontend`, 1);
  if (frontend > 65_535) fail(`${path}.ports.frontend`, "port is out of range");
  if (typeof raw.description !== "string" || raw.description.length > 4_000) {
    fail(`${path}.description`, "expected bounded string");
  }
  const stack = arrayAt(
    raw.stack,
    `${path}.stack`,
    (item, itemPath) => stringAt(item, itemPath, { max: 500 }),
    100,
  );
  if (stack.length < 1
    || new Set(stack).size !== stack.length
    || stack.some((item, index) => item !== [...stack].sort()[index])) {
    fail(`${path}.stack`, "expected non-empty unique canonical order");
  }
  const setfarmRunIds = arrayAt(
    raw.setfarmRunIds,
    `${path}.setfarmRunIds`,
    (item, itemPath) => identityAt(item, itemPath),
    1,
  );
  if (setfarmRunIds.length !== 1) fail(`${path}.setfarmRunIds`, "expected exact run binding");
  const parsed: OperationalV3CanonicalProjectProjectionV1 = {
    id: stringAt(raw.id, `${path}.id`, { regex: PROJECT_ID, max: 160 }),
    name: stringAt(raw.name, `${path}.name`, { max: 500 }),
    description: raw.description,
    type: enumAt(raw.type, `${path}.type`, ["web", "mobile"] as const),
    ports: { frontend },
    deployUrl: urlAt(raw.deployUrl, `${path}.deployUrl`),
    service: stringAt(raw.service, `${path}.service`, { max: 500 }),
    serviceStatus: enumAt(raw.serviceStatus, `${path}.serviceStatus`, ["active"] as const),
    status: enumAt(raw.status, `${path}.status`, ["active"] as const),
    stack,
    createdBy: enumAt(raw.createdBy, `${path}.createdBy`, ["setfarm-v3-terminal-projector"] as const),
    productCompilerProtocol: enumAt(raw.productCompilerProtocol, `${path}.productCompilerProtocol`, ["v3"] as const),
    workflowRunId: identityAt(raw.workflowRunId, `${path}.workflowRunId`),
    setfarmRunIds,
    ...(raw.runNumber === undefined ? {} : { runNumber: integerAt(raw.runNumber, `${path}.runNumber`, 1) }),
    acceptedCandidateId: stringAt(raw.acceptedCandidateId, `${path}.acceptedCandidateId`, { regex: ACCEPTED_CANDIDATE_ID }),
    acceptedCandidateHash: sha256At(raw.acceptedCandidateHash, `${path}.acceptedCandidateHash`),
    acceptedPacketHash: sha256At(raw.acceptedPacketHash, `${path}.acceptedPacketHash`),
    acceptedSourceSha: gitHashAt(raw.acceptedSourceSha, `${path}.acceptedSourceSha`),
    acceptedSourceTreeHash: gitHashAt(raw.acceptedSourceTreeHash, `${path}.acceptedSourceTreeHash`),
    deploymentReceiptHash: sha256At(raw.deploymentReceiptHash, `${path}.deploymentReceiptHash`),
    deploymentReceiptRef: stringAt(raw.deploymentReceiptRef, `${path}.deploymentReceiptRef`, { max: 2_000 }),
    deploymentHealthRef: stringAt(raw.deploymentHealthRef, `${path}.deploymentHealthRef`, { max: 2_000 }),
    deploymentHealthUrl: urlAt(raw.deploymentHealthUrl, `${path}.deploymentHealthUrl`),
    deployedAt: timestampAt(raw.deployedAt, `${path}.deployedAt`),
    completedAt: timestampAt(raw.completedAt, `${path}.completedAt`),
  };
  if (parsed.setfarmRunIds[0] !== parsed.workflowRunId) fail(`${path}.setfarmRunIds`, "does not bind workflow run");
  if (parsed.acceptedCandidateId !== `ACPT_${parsed.acceptedCandidateHash}`) {
    fail(`${path}.acceptedCandidateId`, "does not bind candidate hash");
  }
  return parsed;
}

function projectTransferAckAt(value: unknown, path: string): OperationalV3ProjectTransferAckV1 {
  const projection = objectAt(value, path, ["ref", "acknowledgement", "createdAt"]);
  const raw = objectAt(projection.acknowledgement, `${path}.acknowledgement`, [
    "schema", "ackVersion", "runId", "candidateId", "candidateHash", "packetHash",
    "sourceRevision", "deploymentReceiptHash", "deploymentReceiptRef", "sourceSnapshotHash",
    "projectId", "projectProjection", "projectionHash", "projectRecordHash", "projectRecordRef",
    "persistedAt", "projector", "ackHash",
  ]);
  if (raw.schema !== "setfarm.v3-project-transfer-ack.v1") {
    fail(`${path}.acknowledgement.schema`, "unsupported project transfer acknowledgement schema");
  }
  if (raw.ackVersion !== 1) fail(`${path}.acknowledgement.ackVersion`, "unsupported acknowledgement version");
  const projector = objectAt(raw.projector, `${path}.acknowledgement.projector`, ["service", "protocol"]);
  const projectProjection = projectTransferProjectionAt(
    raw.projectProjection,
    `${path}.acknowledgement.projectProjection`,
  );
  const acknowledgement: OperationalV3ProjectTransferAckPayloadV1 = {
    schema: "setfarm.v3-project-transfer-ack.v1",
    ackVersion: 1,
    runId: identityAt(raw.runId, `${path}.acknowledgement.runId`),
    candidateId: stringAt(raw.candidateId, `${path}.acknowledgement.candidateId`, { regex: ACCEPTED_CANDIDATE_ID }),
    candidateHash: sha256At(raw.candidateHash, `${path}.acknowledgement.candidateHash`),
    packetHash: sha256At(raw.packetHash, `${path}.acknowledgement.packetHash`),
    sourceRevision: sourceRevisionAt(raw.sourceRevision, `${path}.acknowledgement.sourceRevision`),
    deploymentReceiptHash: sha256At(raw.deploymentReceiptHash, `${path}.acknowledgement.deploymentReceiptHash`),
    deploymentReceiptRef: stringAt(raw.deploymentReceiptRef, `${path}.acknowledgement.deploymentReceiptRef`, { max: 2_000 }),
    sourceSnapshotHash: sha256At(raw.sourceSnapshotHash, `${path}.acknowledgement.sourceSnapshotHash`),
    projectId: stringAt(raw.projectId, `${path}.acknowledgement.projectId`, { regex: PROJECT_ID, max: 160 }),
    projectProjection,
    projectionHash: sha256At(raw.projectionHash, `${path}.acknowledgement.projectionHash`),
    projectRecordHash: sha256At(raw.projectRecordHash, `${path}.acknowledgement.projectRecordHash`),
    projectRecordRef: stringAt(raw.projectRecordRef, `${path}.acknowledgement.projectRecordRef`, {
      regex: /^mission-control:\/\/projects\/[a-z0-9-]+\/[a-f0-9]{64}$/,
      max: 1_000,
    }),
    persistedAt: timestampAt(raw.persistedAt, `${path}.acknowledgement.persistedAt`),
    projector: {
      service: enumAt(projector.service, `${path}.acknowledgement.projector.service`, ["mission-control"] as const),
      protocol: enumAt(projector.protocol, `${path}.acknowledgement.projector.protocol`, ["v3"] as const),
    },
    ackHash: sha256At(raw.ackHash, `${path}.acknowledgement.ackHash`),
  };
  if (acknowledgement.candidateId !== `ACPT_${acknowledgement.candidateHash}`) {
    fail(`${path}.acknowledgement.candidateId`, "does not bind candidate hash");
  }
  if (acknowledgement.projectionHash !== hashCanonicalJson(projectProjection)) {
    fail(`${path}.acknowledgement.projectionHash`, "does not bind project projection");
  }
  const expectedProjectRecordHash = hashCanonicalJson({
    schema: "mission-control.v3-canonical-project-record.v1",
    projection: projectProjection,
    projectionHash: acknowledgement.projectionHash,
    persistedAt: acknowledgement.persistedAt,
  });
  if (acknowledgement.projectRecordHash !== expectedProjectRecordHash
    || acknowledgement.projectRecordRef !== `mission-control://projects/${acknowledgement.projectId}/${expectedProjectRecordHash}`) {
    fail(`${path}.acknowledgement.projectRecordHash`, "does not bind persisted project record");
  }
  if (acknowledgement.projectId !== projectProjection.id
    || acknowledgement.runId !== projectProjection.workflowRunId
    || acknowledgement.candidateId !== projectProjection.acceptedCandidateId
    || acknowledgement.candidateHash !== projectProjection.acceptedCandidateHash
    || acknowledgement.packetHash !== projectProjection.acceptedPacketHash
    || acknowledgement.sourceRevision.sha !== projectProjection.acceptedSourceSha
    || acknowledgement.sourceRevision.treeHash !== projectProjection.acceptedSourceTreeHash
    || acknowledgement.deploymentReceiptHash !== projectProjection.deploymentReceiptHash
    || acknowledgement.deploymentReceiptRef !== projectProjection.deploymentReceiptRef) {
    fail(`${path}.acknowledgement.projectProjection`, "does not bind acknowledgement authority");
  }
  const { ackHash: _ackHash, ...ackPayload } = acknowledgement;
  if (acknowledgement.ackHash !== hashCanonicalJson(ackPayload)) {
    fail(`${path}.acknowledgement.ackHash`, "does not bind canonical acknowledgement payload");
  }
  const ref = canonicalRefAt(projection.ref, `${path}.ref`);
  if (ref !== `setfarm://v3-project-transfer-acks/${acknowledgement.ackHash}`) {
    fail(`${path}.ref`, "does not bind acknowledgement hash");
  }
  return {
    ref,
    acknowledgement,
    createdAt: timestampAt(projection.createdAt, `${path}.createdAt`),
  };
}

function sourceIdentityMatches(
  left: { sha: string; treeHash: string },
  right: { sha: string; treeHash: string },
): boolean {
  return left.sha === right.sha && left.treeHash === right.treeHash;
}

function assertUniqueProjectionIdentities(
  values: readonly { ref: string }[],
  identities: readonly string[],
  path: string,
): void {
  if (new Set(values.map((item) => item.ref)).size !== values.length || new Set(identities).size !== identities.length) {
    fail(path, "contains duplicate canonical identity");
  }
}

export function computeOperationalSnapshotHash(snapshot: RunOperationalSnapshot): string {
  const { snapshotHash: _snapshotHash, generatedAt: _generatedAt, ...state } = snapshot;
  return hashCanonicalJson({
    ...state,
    invariants: state.invariants.map(({ observedAt: _observedAt, ...invariant }) => invariant),
  });
}

function validateCoreOperationalBindings(snapshot: RunOperationalSnapshot): void {
  const segment = (value: string) => encodeURIComponent(value);
  const expectedRunRef = `setfarm://run/${segment(snapshot.run.id)}`;
  if (snapshot.run.ref !== expectedRunRef) fail("snapshot.run.ref", "does not bind run id");

  const claims = new Map(snapshot.claims.map((item) => [item.ref, item]));
  const attempts = new Map(snapshot.attempts.map((item) => [item.ref, item]));
  const runtimes = new Map(snapshot.runtimeSessions.map((item) => [item.ref, item]));
  assertUniqueProjectionIdentities(snapshot.claims, snapshot.claims.map((item) => item.id), "snapshot.claims");
  assertUniqueProjectionIdentities(snapshot.attempts, snapshot.attempts.map((item) => item.attemptId), "snapshot.attempts");
  assertUniqueProjectionIdentities(snapshot.runtimeSessions, snapshot.runtimeSessions.map((item) => item.sessionId), "snapshot.runtimeSessions");
  assertUniqueProjectionIdentities(snapshot.completionRequests, snapshot.completionRequests.map((item) => item.requestId), "snapshot.completionRequests");
  assertUniqueProjectionIdentities(snapshot.terminationRequests, snapshot.terminationRequests.map((item) => item.requestId), "snapshot.terminationRequests");
  assertUniqueProjectionIdentities(snapshot.outbox, snapshot.outbox.map((item) => item.outboxId), "snapshot.outbox");

  snapshot.claims.forEach((claim, index) => {
    if (claim.runRef !== snapshot.run.ref
      || claim.ref !== `setfarm://claim-log/${claim.id}`
      || claim.stepRef !== `${snapshot.run.ref}/step/${segment(claim.workflowStepId)}`
      || claim.storyRef !== (claim.storyId ? `${snapshot.run.ref}/story/${segment(claim.storyId)}` : null)) {
      fail(`snapshot.claims[${index}]`, "does not bind canonical run/step/story identity");
    }
  });
  snapshot.attempts.forEach((attempt, index) => {
    if (attempt.runRef !== snapshot.run.ref
      || attempt.ref !== `setfarm://execution-attempt/${segment(attempt.attemptId)}`
      || attempt.stepRef !== `${snapshot.run.ref}/step/${segment(attempt.workflowStepId)}`
      || attempt.storyRef !== (attempt.storyId ? `${snapshot.run.ref}/story/${segment(attempt.storyId)}` : null)
      || (attempt.claimRef !== null && !claims.has(attempt.claimRef))) {
      fail(`snapshot.attempts[${index}]`, "does not bind canonical run/claim/step/story identity");
    }
  });
  snapshot.runtimeSessions.forEach((runtime, index) => {
    if (runtime.runRef !== snapshot.run.ref
      || runtime.ref !== `setfarm://runtime-session/${segment(runtime.sessionId)}`
      || !claims.has(runtime.claimRef)
      || (runtime.attemptRef !== null && !attempts.has(runtime.attemptRef))
      || runtime.stepRef !== `${snapshot.run.ref}/step/${segment(runtime.workflowStepId)}`
      || runtime.storyRef !== (runtime.storyId ? `${snapshot.run.ref}/story/${segment(runtime.storyId)}` : null)) {
      fail(`snapshot.runtimeSessions[${index}]`, "does not bind canonical run/claim/attempt/step/story identity");
    }
  });
  snapshot.completionRequests.forEach((request, index) => {
    if (request.runRef !== snapshot.run.ref
      || request.ref !== `setfarm://runtime-completion/${segment(request.requestId)}`
      || !runtimes.has(request.runtimeSessionRef)
      || !claims.has(request.claimRef)
      || (request.attemptRef !== null && !attempts.has(request.attemptRef))
      || request.stepRef !== `${snapshot.run.ref}/step/${segment(request.workflowStepId)}`
      || request.storyRef !== (request.storyId ? `${snapshot.run.ref}/story/${segment(request.storyId)}` : null)) {
      fail(`snapshot.completionRequests[${index}]`, "does not bind canonical lifecycle identity");
    }
    const effectRefs = new Set<string>();
    request.effects.forEach((effect, effectIndex) => {
      const expectedRef = `${request.ref}/effect/${segment(effect.effectKey)}`;
      if (effect.ref !== expectedRef || effectRefs.has(effect.ref)) {
        fail(`snapshot.completionRequests[${index}].effects[${effectIndex}].ref`, "does not bind unique completion effect");
      }
      effectRefs.add(effect.ref);
    });
  });
  snapshot.terminationRequests.forEach((request, index) => {
    if (request.runRef !== snapshot.run.ref || request.ref !== `setfarm://run-termination/${segment(request.requestId)}`) {
      fail(`snapshot.terminationRequests[${index}]`, "does not bind canonical run identity");
    }
  });
  snapshot.outbox.forEach((item, index) => {
    if (item.ref !== `setfarm://operational-outbox/${segment(item.outboxId)}`) {
      fail(`snapshot.outbox[${index}].ref`, "does not bind outbox identity");
    }
    if (item.requestRef !== null
      && !snapshot.completionRequests.some((request) => request.ref === item.requestRef)) {
      fail(`snapshot.outbox[${index}].requestRef`, "does not bind projected completion request");
    }
  });

  const counts = {
    activeClaims: snapshot.claims.filter((item) => item.state === "open").length,
    activeAttempts: snapshot.attempts.filter((item) => ["claimed", "running"].includes(item.disposition)).length,
    activeRuntimes: snapshot.runtimeSessions.filter((item) => ["reserved", "starting", "running", "drain_requested"].includes(item.state)).length,
    openCompletions: snapshot.completionRequests.filter((item) => ["requested", "draining", "processing"].includes(item.state)).length,
    mandatoryEffectsPending: snapshot.completionRequests.flatMap((item) => item.effects)
      .filter((item) => item.mandatory && !["applied", "reconciled"].includes(item.state)).length,
    unpublishedOutbox: snapshot.outbox.filter((item) => item.state !== "published").length,
    invariantViolations: snapshot.invariants.length,
  };
  (Object.keys(counts) as Array<keyof typeof counts>).forEach((key) => {
    if (snapshot.summary[key] !== counts[key]) fail(`snapshot.summary.${key}`, "does not match canonical rows");
  });
}

export function validateRunOperationalSnapshotV1(value: unknown): value is RunOperationalSnapshotV1 {
  try {
    parseRunOperationalSnapshotV1(value);
    return true;
  } catch {
    return false;
  }
}

function parseRunOperationalSnapshotVersion(
  value: unknown,
  expectedSchema: typeof RUN_OPERATIONAL_SNAPSHOT_V1_SCHEMA | typeof RUN_OPERATIONAL_SNAPSHOT_V2_SCHEMA,
): RunOperationalSnapshot {
  const snapshot = objectWithOptionalAt(value, "snapshot", [
    "schema", "generatedAt", "snapshotHash", "source", "run", "summary", "claims", "attempts", "runtimeSessions",
    "completionRequests", "terminationRequests", "outbox", "invariants",
  ], ["findingSets", "evidenceBundles", "recoveryCases", "recoveryDispatches", "acceptedCandidate", "deploymentReceipt", "projectTransferAck"]);
  if (snapshot.schema !== expectedSchema) fail("snapshot.schema", "unsupported schema");
  const v2 = expectedSchema === RUN_OPERATIONAL_SNAPSHOT_V2_SCHEMA;

  const parsed = {
    schema: expectedSchema,
    generatedAt: timestampAt(snapshot.generatedAt, "snapshot.generatedAt"),
    snapshotHash: sha256At(snapshot.snapshotHash, "snapshot.snapshotHash"),
    source: v2
      ? projectionSourceV2At(snapshot.source, "snapshot.source")
      : projectionSourceAt(snapshot.source, "snapshot.source"),
    run: runAt(snapshot.run, "snapshot.run"),
    summary: summaryAt(snapshot.summary, "snapshot.summary"),
    claims: arrayAt(snapshot.claims, "snapshot.claims", claimAt),
    attempts: arrayAt(snapshot.attempts, "snapshot.attempts", attemptAt),
    runtimeSessions: arrayAt(snapshot.runtimeSessions, "snapshot.runtimeSessions", runtimeSessionAt),
    completionRequests: v2
      ? arrayAt(snapshot.completionRequests, "snapshot.completionRequests", completionRequestV2At)
      : arrayAt(snapshot.completionRequests, "snapshot.completionRequests", completionRequestAt),
    terminationRequests: arrayAt(snapshot.terminationRequests, "snapshot.terminationRequests", terminationRequestAt),
    outbox: arrayAt(snapshot.outbox, "snapshot.outbox", outboxItemAt),
    invariants: arrayAt(snapshot.invariants, "snapshot.invariants", invariantAt),
    ...(snapshot.findingSets === undefined
      ? {}
      : { findingSets: arrayAt(snapshot.findingSets, "snapshot.findingSets", findingSetAt) }),
    ...(snapshot.evidenceBundles === undefined
      ? {}
      : { evidenceBundles: arrayAt(snapshot.evidenceBundles, "snapshot.evidenceBundles", evidenceBundleAt) }),
    ...(snapshot.recoveryCases === undefined
      ? {}
      : { recoveryCases: arrayAt(snapshot.recoveryCases, "snapshot.recoveryCases", recoveryCaseAt) }),
    ...(snapshot.recoveryDispatches === undefined
      ? {}
      : { recoveryDispatches: arrayAt(snapshot.recoveryDispatches, "snapshot.recoveryDispatches", recoveryDispatchAt) }),
    ...(snapshot.acceptedCandidate === undefined
      ? {}
      : { acceptedCandidate: snapshot.acceptedCandidate === null
        ? null
        : acceptedCandidateAt(snapshot.acceptedCandidate, "snapshot.acceptedCandidate") }),
    ...(snapshot.deploymentReceipt === undefined
      ? {}
      : { deploymentReceipt: snapshot.deploymentReceipt === null
        ? null
        : deploymentReceiptAt(snapshot.deploymentReceipt, "snapshot.deploymentReceipt") }),
    ...(snapshot.projectTransferAck === undefined
      ? {}
      : { projectTransferAck: snapshot.projectTransferAck === null
        ? null
        : projectTransferAckAt(snapshot.projectTransferAck, "snapshot.projectTransferAck") }),
  } as RunOperationalSnapshot;

  if (
    parsed.schema === RUN_OPERATIONAL_SNAPSHOT_V2_SCHEMA
    && !parsed.source.capabilities.implementationSubmissionEvidence
    && parsed.completionRequests.some((request) => request.implementationSubmissionEvidence !== null)
  ) {
    fail("snapshot.completionRequests", "implementation submission evidence requires explicit capability");
  }

  const findingRecoveryCollectionsPresent = [snapshot.findingSets, snapshot.recoveryCases, snapshot.recoveryDispatches]
    .filter((item) => item !== undefined).length;
  if (parsed.source.capabilities.findingRecovery === true && findingRecoveryCollectionsPresent !== 3) {
    fail("snapshot", "finding-recovery capability requires every canonical recovery collection");
  }
  if (parsed.source.capabilities.findingRecovery !== true && findingRecoveryCollectionsPresent !== 0) {
    fail("snapshot", "finding-recovery collections require explicit capability");
  }
  if (parsed.source.capabilities.evidenceLedger === true && snapshot.evidenceBundles === undefined) {
    fail("snapshot.evidenceBundles", "evidence-ledger capability requires canonical collection");
  }
  if (parsed.source.capabilities.evidenceLedger !== true && snapshot.evidenceBundles !== undefined) {
    fail("snapshot.evidenceBundles", "evidence collection requires explicit capability");
  }
  if (parsed.source.capabilities.acceptedCandidate === true && snapshot.acceptedCandidate === undefined) {
    fail("snapshot.acceptedCandidate", "accepted-candidate capability requires canonical projection");
  }
  if (parsed.source.capabilities.acceptedCandidate === true
    && (!parsed.source.capabilities.attempts || !parsed.source.capabilities.evidenceLedger)) {
    fail("snapshot.source.capabilities.acceptedCandidate", "accepted candidate authority requires attempt and evidence ledgers");
  }
  if (parsed.source.capabilities.acceptedCandidate !== true && snapshot.acceptedCandidate !== undefined) {
    fail("snapshot.acceptedCandidate", "accepted candidate projection requires explicit capability");
  }
  if (parsed.source.capabilities.deploymentReceipt === true && snapshot.deploymentReceipt === undefined) {
    fail("snapshot.deploymentReceipt", "deployment-receipt capability requires canonical projection");
  }
  if (parsed.source.capabilities.deploymentReceipt === true
    && (!parsed.source.capabilities.acceptedCandidate || !parsed.source.capabilities.effectLedger)) {
    fail("snapshot.source.capabilities.deploymentReceipt", "deployment receipt authority requires accepted-candidate and effect ledgers");
  }
  if (parsed.source.capabilities.deploymentReceipt !== true && snapshot.deploymentReceipt !== undefined) {
    fail("snapshot.deploymentReceipt", "deployment receipt projection requires explicit capability");
  }
  if (parsed.source.capabilities.projectTransferAck === true && snapshot.projectTransferAck === undefined) {
    fail("snapshot.projectTransferAck", "project-transfer-ack capability requires canonical projection");
  }
  if (parsed.source.capabilities.projectTransferAck === true
    && (!parsed.source.capabilities.acceptedCandidate || !parsed.source.capabilities.deploymentReceipt)) {
    fail("snapshot.source.capabilities.projectTransferAck", "project transfer acknowledgement requires candidate and deploy authority");
  }
  if (parsed.source.capabilities.projectTransferAck !== true && snapshot.projectTransferAck !== undefined) {
    fail("snapshot.projectTransferAck", "project transfer acknowledgement projection requires explicit capability");
  }

  const findingSets = parsed.findingSets ?? [];
  const evidenceBundles = parsed.evidenceBundles ?? [];
  const recoveryCases = parsed.recoveryCases ?? [];
  const recoveryDispatches = parsed.recoveryDispatches ?? [];
  assertUniqueProjectionIdentities(findingSets, findingSets.map((item) => item.findingSetHash), "snapshot.findingSets");
  assertUniqueProjectionIdentities(evidenceBundles, evidenceBundles.map((item) => item.evidenceBundleHash), "snapshot.evidenceBundles");
  assertUniqueProjectionIdentities(recoveryCases, recoveryCases.map((item) => item.recoveryCaseId), "snapshot.recoveryCases");
  assertUniqueProjectionIdentities(recoveryDispatches, recoveryDispatches.map((item) => item.dispatchId), "snapshot.recoveryDispatches");

  for (const [path, items] of [
    ["findingSets", findingSets],
    ["evidenceBundles", evidenceBundles],
    ["recoveryCases", recoveryCases],
    ["recoveryDispatches", recoveryDispatches],
  ] as const) {
    items.forEach((item, index) => {
      if (item.runRef !== parsed.run.ref) fail(`snapshot.${path}[${index}].runRef`, "does not match run");
    });
  }

  const findingSetByHash = new Map(findingSets.map((item) => [item.findingSetHash, item]));
  const recoveryCaseById = new Map(recoveryCases.map((item) => [item.recoveryCaseId, item]));
  recoveryCases.forEach((item, index) => {
    const findingSet = findingSetByHash.get(item.findingSetHash);
    if (!findingSet || item.findingSetRef !== findingSet.ref) fail(`snapshot.recoveryCases[${index}].findingSetRef`, "finding set is absent or mismatched");
    if (
      item.storyId !== findingSet.storyId
      || item.storyRef !== findingSet.storyRef
      || item.packetHash !== findingSet.packetHash
      || item.sliceHash !== findingSet.sliceHash
      || !sourceIdentityMatches(item.sourceRevision, findingSet.sourceRevision)
    ) fail(`snapshot.recoveryCases[${index}]`, "does not bind exact finding-set product identity");
  });
  recoveryDispatches.forEach((item, index) => {
    const recoveryCase = recoveryCaseById.get(item.recoveryCaseId);
    const findingSet = findingSetByHash.get(item.findingSetHash);
    if (
      !recoveryCase
      || item.recoveryCaseRef !== recoveryCase.ref
      || item.storyId !== recoveryCase.storyId
      || item.storyRef !== recoveryCase.storyRef
    ) fail(`snapshot.recoveryDispatches[${index}].recoveryCaseRef`, "recovery case is absent or mismatched");
    if (
      !findingSet
      || item.findingSetRef !== findingSet.ref
      || item.storyId !== findingSet.storyId
      || item.storyRef !== findingSet.storyRef
      || item.packetHash !== findingSet.packetHash
      || item.sliceHash !== findingSet.sliceHash
      || !sourceIdentityMatches(item.sourceRevision, findingSet.sourceRevision)
      || item.findingIds.some((findingId) => !findingSet.findingIds.includes(findingId))
    ) fail(`snapshot.recoveryDispatches[${index}]`, "does not bind exact revision finding-set identity");
  });

  const acceptedCandidate = parsed.acceptedCandidate?.candidate;
  if (acceptedCandidate) {
    if (parsed.run.protocol !== "v3" || acceptedCandidate.runId !== parsed.run.id) {
      fail("snapshot.acceptedCandidate.candidate.runId", "does not bind exact v3 run");
    }
    const attemptById = new Map(parsed.attempts.map((attempt) => [attempt.attemptId, attempt]));
    const evidenceByHash = new Map(evidenceBundles.map((bundle) => [bundle.evidenceBundleHash, bundle]));
    acceptedCandidate.storyEvidence.forEach((story, index) => {
      const attempt = attemptById.get(story.attemptId);
      const evidence = evidenceByHash.get(story.evidenceBundleHash);
      if (!attempt
        || attempt.storyId !== story.storyId
        || attempt.attemptClass !== "evidence_only"
        || attempt.packetHash !== acceptedCandidate.packetHash
        || attempt.sliceHash !== story.sliceHash
        || attempt.disposition !== "verified"
        || attempt.outputHash !== story.evidenceBundleHash
        || !attempt.sourceAfter
        || !sourceIdentityMatches(attempt.sourceAfter, acceptedCandidate.sourceRevision)) {
        fail(`snapshot.acceptedCandidate.candidate.storyEvidence[${index}].attemptId`, "does not bind verified final-source attempt");
      }
      if (!evidence
        || evidence.storyId !== story.storyId
        || evidence.attemptId !== story.attemptId
        || evidence.packetHash !== acceptedCandidate.packetHash
        || evidence.sliceHash !== story.sliceHash
        || evidence.aggregateVerdict !== "pass"
        || !sourceIdentityMatches(evidence.sourceRevision, acceptedCandidate.sourceRevision)) {
        fail(`snapshot.acceptedCandidate.candidate.storyEvidence[${index}].evidenceBundleHash`, "does not bind canonical passing final-source evidence");
      }
    });
  }
  const deploymentReceipt = parsed.deploymentReceipt?.receipt;
  if (deploymentReceipt) {
    if (!acceptedCandidate
      || parsed.run.protocol !== "v3"
      || deploymentReceipt.runId !== parsed.run.id
      || deploymentReceipt.candidateId !== acceptedCandidate.candidateId
      || deploymentReceipt.candidateHash !== acceptedCandidate.candidateHash
      || deploymentReceipt.packetHash !== acceptedCandidate.packetHash
      || !sourceIdentityMatches(deploymentReceipt.sourceBefore, acceptedCandidate.sourceRevision)
      || !sourceIdentityMatches(deploymentReceipt.sourceAfter, acceptedCandidate.sourceRevision)) {
      fail("snapshot.deploymentReceipt.receipt", "does not bind exact run AcceptedCandidate source");
    }
  }
  const projectTransferAck = parsed.projectTransferAck?.acknowledgement;
  if (projectTransferAck) {
    if (!acceptedCandidate
      || !deploymentReceipt
      || parsed.run.protocol !== "v3"
      || !parsed.run.terminal
      || !["completed", "done"].includes(parsed.run.status.toLowerCase())
      || projectTransferAck.runId !== parsed.run.id
      || projectTransferAck.candidateId !== acceptedCandidate.candidateId
      || projectTransferAck.candidateHash !== acceptedCandidate.candidateHash
      || projectTransferAck.packetHash !== acceptedCandidate.packetHash
      || !sourceIdentityMatches(projectTransferAck.sourceRevision, acceptedCandidate.sourceRevision)
      || projectTransferAck.deploymentReceiptHash !== deploymentReceipt.receiptHash
      || projectTransferAck.deploymentReceiptRef !== parsed.deploymentReceipt?.ref) {
      fail("snapshot.projectTransferAck.acknowledgement", "does not bind exact candidate and deploy receipt");
    }
  }
  const successfulV3 = parsed.run.protocol === "v3"
    && parsed.run.terminal
    && ["completed", "done"].includes(parsed.run.status.toLowerCase());
  if (parsed.source.capabilities.acceptedCandidate && successfulV3 && !acceptedCandidate
    && !parsed.invariants.some((invariant) => invariant.code === "SUCCESSFUL_V3_RUN_MISSING_ACCEPTED_CANDIDATE")) {
    fail("snapshot.acceptedCandidate", "successful v3 run without candidate must be inconsistent");
  }

  if (parsed.summary.invariantViolations !== parsed.invariants.length) fail("snapshot.summary.invariantViolations", "does not match invariants");
  if (parsed.source.projection === "unavailable" && parsed.summary.health !== "unavailable") fail("snapshot.summary.health", "unavailable projection requires unavailable health");
  if (parsed.summary.lifecycleState === "inconsistent" && !parsed.invariants.some((item) => item.severity === "error")) {
    fail("snapshot.summary.lifecycleState", "inconsistent lifecycle requires an error invariant");
  }

  validateCoreOperationalBindings(parsed);
  if (computeOperationalSnapshotHash(parsed) !== parsed.snapshotHash) {
    fail("snapshot.snapshotHash", "does not bind canonical operational state");
  }

  // Validation intentionally returns the original object. The proxy must never
  // normalize, enrich, or otherwise mutate Setfarm's canonical payload.
  return value as RunOperationalSnapshot;
}

export function parseRunOperationalSnapshotV1(value: unknown): RunOperationalSnapshotV1 {
  return parseRunOperationalSnapshotVersion(value, RUN_OPERATIONAL_SNAPSHOT_V1_SCHEMA) as RunOperationalSnapshotV1;
}

export function validateRunOperationalSnapshotV2(value: unknown): value is RunOperationalSnapshotV2 {
  try {
    parseRunOperationalSnapshotV2(value);
    return true;
  } catch {
    return false;
  }
}

export function parseRunOperationalSnapshotV2(value: unknown): RunOperationalSnapshotV2 {
  return parseRunOperationalSnapshotVersion(value, RUN_OPERATIONAL_SNAPSHOT_V2_SCHEMA) as RunOperationalSnapshotV2;
}

export function parseRunOperationalSnapshot(value: unknown): RunOperationalSnapshot {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail("snapshot", "expected object");
  }
  const schema = (value as JsonRecord).schema;
  if (schema === RUN_OPERATIONAL_SNAPSHOT_V1_SCHEMA) return parseRunOperationalSnapshotV1(value);
  if (schema === RUN_OPERATIONAL_SNAPSHOT_V2_SCHEMA) return parseRunOperationalSnapshotV2(value);
  fail("snapshot.schema", "unsupported schema");
}

export interface SetfarmOperationalSnapshotClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  failureThreshold?: number;
  resetAfterMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export class SetfarmOperationalSnapshotClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly failureThreshold: number;
  private readonly resetAfterMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private consecutiveFailures = 0;
  private openUntil = 0;

  constructor(options: SetfarmOperationalSnapshotClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? config.setfarmUrl).replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 3_000;
    this.failureThreshold = options.failureThreshold ?? 3;
    this.resetAfterMs = options.resetAfterMs ?? 10_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
  }

  async get(runId: string): Promise<OperationalSnapshotFetchResult> {
    if (this.openUntil > this.now()) return { status: "unavailable", reason: "circuit_open" };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      let response: Response;
      try {
        response = await this.fetchImpl(
          `${this.baseUrl}/api/runs/${encodeURIComponent(runId)}/operational-snapshot`,
          { signal: controller.signal },
        );
      } catch (error) {
        this.recordFailure();
        return {
          status: "unavailable",
          reason: controller.signal.aborted || (error instanceof Error && error.name === "AbortError") ? "timeout" : "network",
        };
      }

      if (response.status === 404) return { status: "unavailable", reason: "not_found", upstreamStatus: 404 };
      if (!response.ok) {
        if (response.status >= 500 || response.status === 429) this.recordFailure();
        return { status: "upstream_error", reason: "http_error", upstreamStatus: response.status };
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch (error) {
        this.recordFailure();
        if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
          return { status: "unavailable", reason: "timeout" };
        }
        return { status: "upstream_error", reason: "invalid_json", upstreamStatus: response.status };
      }

      const schema = typeof payload === "object" && payload !== null && !Array.isArray(payload)
        ? (payload as JsonRecord).schema
        : null;
      if (schema !== RUN_OPERATIONAL_SNAPSHOT_V1_SCHEMA && schema !== RUN_OPERATIONAL_SNAPSHOT_V2_SCHEMA) {
        return { status: "unsupported_schema", schema: typeof schema === "string" ? schema : null };
      }

      try {
        const snapshot = parseRunOperationalSnapshot(payload);
        this.resetCircuit();
        return { status: "ok", snapshot };
      } catch {
        this.recordFailure();
        return { status: "upstream_error", reason: "invalid_payload", upstreamStatus: response.status };
      }
    } finally {
      clearTimeout(timer);
    }
  }

  private recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) this.openUntil = this.now() + this.resetAfterMs;
  }

  private resetCircuit(): void {
    this.consecutiveFailures = 0;
    this.openUntil = 0;
  }
}

export const setfarmOperationalSnapshotClient = new SetfarmOperationalSnapshotClient();
