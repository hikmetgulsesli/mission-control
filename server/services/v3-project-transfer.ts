import type {
  OperationalAcceptedCandidateV1,
  OperationalSnapshotFetchResult,
  OperationalV3DeployReceiptV1,
} from "./setfarm-operational-snapshot.js";
import { createV3CanonicalProjectRecordIdentity } from "./v3-project-transfer-ack.js";

export type V3ProjectTransferBlockCode =
  | "V3_PROJECT_TRANSFER_RUN_NOT_COMPLETED"
  | "V3_PROJECT_TRANSFER_SNAPSHOT_UNAVAILABLE"
  | "V3_PROJECT_TRANSFER_PROJECTION_INCOMPLETE"
  | "V3_PROJECT_TRANSFER_RUN_IDENTITY_MISMATCH"
  | "V3_PROJECT_TRANSFER_OPERATIONAL_STATE_UNSETTLED"
  | "V3_PROJECT_TRANSFER_INVARIANT_VIOLATION"
  | "V3_PROJECT_TRANSFER_ACCEPTED_CANDIDATE_MISSING"
  | "V3_PROJECT_TRANSFER_DEPLOYMENT_RECEIPT_MISSING"
  | "V3_PROJECT_TRANSFER_DEPLOYMENT_RECEIPT_MISMATCH";

export interface V3CanonicalProjectProjection {
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

export type V3ProjectTransferAuthority =
  | Readonly<{ status: "not_v3" }>
  | Readonly<{ status: "blocked"; code: V3ProjectTransferBlockCode }>
  | Readonly<{
    status: "authorized";
    acceptedCandidate: OperationalAcceptedCandidateV1;
    deploymentReceipt: OperationalV3DeployReceiptV1;
  }>;

export function isV3RunProtocol(run: Readonly<Record<string, unknown>>): boolean {
  let context: Record<string, unknown> = {};
  if (typeof run.context === "string") {
    try {
      const parsed = JSON.parse(run.context) as unknown;
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) context = parsed as Record<string, unknown>;
    } catch { /* malformed context cannot create v3 authority */ }
  } else if (typeof run.context === "object" && run.context !== null && !Array.isArray(run.context)) {
    context = run.context as Record<string, unknown>;
  }
  return String(run.protocol || context.product_compiler_mode || context.protocol || "legacy") === "v3";
}

/**
 * Mission Control may project a v3 run into Projects only from Setfarm's
 * canonical operational snapshot. It never infers acceptance from run prose,
 * a dist directory, a generated project status, or an agent deploy claim.
 */
export function evaluateV3ProjectTransfer(input: Readonly<{
  run: Readonly<{ id: string; status: string; protocol: string }>;
  snapshotResult: OperationalSnapshotFetchResult;
}>): V3ProjectTransferAuthority {
  if (input.run.protocol !== "v3") return { status: "not_v3" };
  if (!["completed", "done"].includes(input.run.status.toLowerCase())) {
    return { status: "blocked", code: "V3_PROJECT_TRANSFER_RUN_NOT_COMPLETED" };
  }
  if (input.snapshotResult.status !== "ok") {
    return { status: "blocked", code: "V3_PROJECT_TRANSFER_SNAPSHOT_UNAVAILABLE" };
  }
  const snapshot = input.snapshotResult.snapshot;
  if (
    snapshot.source.projection !== "complete"
    || !Object.values(snapshot.source.capabilities).every(Boolean)
  ) {
    return { status: "blocked", code: "V3_PROJECT_TRANSFER_PROJECTION_INCOMPLETE" };
  }
  if (
    snapshot.run.id !== input.run.id
    || snapshot.run.protocol !== "v3"
    || !snapshot.run.terminal
    || !["completed", "done"].includes(snapshot.run.status.toLowerCase())
  ) {
    return { status: "blocked", code: "V3_PROJECT_TRANSFER_RUN_IDENTITY_MISMATCH" };
  }
  if (
    snapshot.summary.lifecycleState !== "terminal"
    || snapshot.summary.health !== "ok"
    || snapshot.summary.invariantViolations !== 0
    || snapshot.invariants.length !== 0
  ) {
    return { status: "blocked", code: "V3_PROJECT_TRANSFER_INVARIANT_VIOLATION" };
  }
  if (
    snapshot.summary.activeClaims !== 0
    || snapshot.summary.activeAttempts !== 0
    || snapshot.summary.activeRuntimes !== 0
    || snapshot.summary.openCompletions !== 0
    || snapshot.summary.mandatoryEffectsPending !== 0
    || snapshot.summary.unpublishedOutbox !== 0
    || snapshot.claims.some((claim) => claim.state === "open")
    || snapshot.attempts.some((attempt) => ["claimed", "running"].includes(attempt.disposition))
    || snapshot.runtimeSessions.some((runtime) => ["reserved", "starting", "running", "drain_requested"].includes(runtime.state))
    || snapshot.completionRequests.some((request) => ["requested", "draining", "processing"].includes(request.state))
    || snapshot.completionRequests.some((request) => request.effects.some((effect) => !["applied", "reconciled"].includes(effect.state)))
    || snapshot.terminationRequests.some((request) => request.state !== "terminalized")
    || snapshot.outbox.some((item) => item.state !== "published")
    || (snapshot.recoveryCases ?? []).some((item) => !["resolved", "blocked", "superseded"].includes(item.status))
    || (snapshot.recoveryDispatches ?? []).some((item) => !["succeeded", "failed", "blocked", "superseded"].includes(item.deliveryState))
  ) {
    return { status: "blocked", code: "V3_PROJECT_TRANSFER_OPERATIONAL_STATE_UNSETTLED" };
  }
  const acceptedCandidate = snapshot.acceptedCandidate;
  if (
    !snapshot.source.capabilities.acceptedCandidate
    || !acceptedCandidate
    || acceptedCandidate.candidate.runId !== input.run.id
  ) {
    return { status: "blocked", code: "V3_PROJECT_TRANSFER_ACCEPTED_CANDIDATE_MISSING" };
  }
  const deploymentReceipt = snapshot.deploymentReceipt;
  if (!snapshot.source.capabilities.deploymentReceipt || !deploymentReceipt) {
    return { status: "blocked", code: "V3_PROJECT_TRANSFER_DEPLOYMENT_RECEIPT_MISSING" };
  }
  const candidate = acceptedCandidate.candidate;
  const receipt = deploymentReceipt.receipt;
  const expectedBuildArtifactRef = `setfarm://deploy/build-artifact/${receipt.runId}/${receipt.buildArtifact.artifactHash}`;
  const expectedSealedRuntimeRef = `setfarm://deploy/sealed-runtime/${receipt.runId}/${receipt.candidateHash}/${receipt.buildArtifact.artifactHash}`;
  const expectedManifestEvidenceRef = `setfarm://deploy/sealed-runtime-manifest/${receipt.runId}/${receipt.candidateHash}/${receipt.buildArtifact.artifactHash}/${receipt.runtime.sealedRuntimeManifestHash}`;
  if (
    receipt.runId !== input.run.id
    || receipt.candidateId !== candidate.candidateId
    || receipt.candidateHash !== candidate.candidateHash
    || receipt.packetHash !== candidate.packetHash
    || receipt.sourceBefore.sha !== candidate.sourceRevision.sha
    || receipt.sourceBefore.treeHash !== candidate.sourceRevision.treeHash
    || receipt.sourceAfter.sha !== candidate.sourceRevision.sha
    || receipt.sourceAfter.treeHash !== candidate.sourceRevision.treeHash
    || receipt.health.status !== "pass"
    || receipt.runtime.projectId !== receipt.project.projectId
    || receipt.buildArtifact.evidenceRef !== expectedBuildArtifactRef
    || receipt.runtime.buildArtifactHash !== receipt.buildArtifact.artifactHash
    || receipt.runtime.buildArtifactEvidenceRef !== expectedBuildArtifactRef
    || receipt.runtime.sealedRuntimeRef !== expectedSealedRuntimeRef
    || receipt.runtime.sealedRuntimeManifestHash !== receipt.health.sealedRuntimeManifestHash
    || receipt.runtime.sealedRuntimeManifestEvidenceRef !== expectedManifestEvidenceRef
    || receipt.health.sealedRuntimeManifestEvidenceRef !== expectedManifestEvidenceRef
    || receipt.health.buildArtifactHash !== receipt.buildArtifact.artifactHash
    || receipt.health.buildArtifactEvidenceRef !== expectedBuildArtifactRef
    || receipt.terminalProjectProjection.buildArtifactHash !== receipt.buildArtifact.artifactHash
    || receipt.health.listenerOwnership.ownerProcess.source !== "observed_os"
    || receipt.health.listenerOwnership.ownerProcess.processGroupId !== receipt.health.listenerOwnership.ownerProcess.pid
    || receipt.health.listenerOwnership.listenerProcesses.length !== receipt.health.listenerOwnership.listenerPids.length
    || receipt.health.listenerOwnership.listenerProcesses.some((process, index) =>
      process.pid !== receipt.health.listenerOwnership.listenerPids[index]
      || process.source !== "observed_os"
      || process.processGroupId !== receipt.health.listenerOwnership.ownerProcess.pid)
    || receipt.runtime.serviceId !== `process:${receipt.health.listenerOwnership.ownerProcess.pid}`
    || receipt.health.listenerOwnership.host !== receipt.runtime.host
    || receipt.health.listenerOwnership.port !== receipt.runtime.port
    || receipt.terminalProjectProjection.runId !== input.run.id
    || receipt.terminalProjectProjection.candidateHash !== candidate.candidateHash
    || receipt.terminalProjectProjection.projectId !== receipt.project.projectId
    || receipt.terminalProjectProjection.serviceId !== receipt.runtime.serviceId
    || receipt.terminalProjectProjection.port !== receipt.runtime.port
    || receipt.terminalProjectProjection.healthUrl !== receipt.runtime.healthUrl
  ) {
    return { status: "blocked", code: "V3_PROJECT_TRANSFER_DEPLOYMENT_RECEIPT_MISMATCH" };
  }
  return { status: "authorized", acceptedCandidate, deploymentReceipt };
}

/**
 * Builds a Projects record exclusively from canonical terminal authority. Run
 * task prose, repository paths, same-name cards and filesystem/service probes
 * are deliberately not accepted as inputs.
 */
export function buildV3CanonicalProjectProjection(input: Readonly<{
  authority: Extract<V3ProjectTransferAuthority, { status: "authorized" }>;
  runNumber?: number;
}>): V3CanonicalProjectProjection {
  const candidate = input.authority.acceptedCandidate.candidate;
  const projection = input.authority.deploymentReceipt;
  const receipt = projection.receipt;
  const type = receipt.stack.platform === "mobile" ? "mobile" : "web";
  return {
    id: receipt.project.projectId,
    name: receipt.project.displayName,
    description: receipt.project.summary,
    type,
    ports: { frontend: receipt.runtime.port },
    deployUrl: receipt.runtime.deployUrl,
    service: receipt.runtime.serviceId,
    serviceStatus: "active",
    status: "active",
    stack: [receipt.stack.techStack ?? receipt.stack.stackPackId],
    createdBy: "setfarm-v3-terminal-projector",
    productCompilerProtocol: "v3",
    workflowRunId: receipt.runId,
    setfarmRunIds: [receipt.runId],
    ...(input.runNumber ? { runNumber: input.runNumber } : {}),
    acceptedCandidateId: candidate.candidateId,
    acceptedCandidateHash: candidate.candidateHash,
    acceptedPacketHash: candidate.packetHash,
    acceptedSourceSha: candidate.sourceRevision.sha,
    acceptedSourceTreeHash: candidate.sourceRevision.treeHash,
    deploymentReceiptHash: receipt.receiptHash,
    deploymentReceiptRef: projection.ref,
    deploymentHealthRef: receipt.health.evidenceRef,
    deploymentHealthUrl: receipt.runtime.healthUrl,
    deployedAt: receipt.completedAt,
    completedAt: receipt.completedAt,
  };
}

export type V3CanonicalProjectPersistenceResult = Readonly<{
  status: "created" | "unchanged" | "conflict" | "deleted";
  project: unknown;
}>;

export interface V3CanonicalProjectRehydrationAuthority {
  mode: "rehydrate_existing_ack";
  persistedAt: string;
  projectionHash: string;
  projectRecordHash: string;
}

export type V3CanonicalProjectTransferResult =
  | Extract<V3ProjectTransferAuthority, { status: "not_v3" | "blocked" }>
  | Readonly<{
    status: "projected";
    projection: V3CanonicalProjectProjection;
    persistence: V3CanonicalProjectPersistenceResult;
  }>;

/**
 * The sole effect gate for canonical v3 Projects persistence. A missing,
 * stale, tampered or operationally unsettled authority cannot invoke the
 * injected store callback.
 */
export function transferV3ProjectToCanonicalStore(input: Readonly<{
  run: Readonly<{ id: string; status: string; protocol: string; runNumber?: number }>;
  snapshotResult: OperationalSnapshotFetchResult;
  persist: (projection: V3CanonicalProjectProjection) => V3CanonicalProjectPersistenceResult;
}>): V3CanonicalProjectTransferResult {
  const authority = evaluateV3ProjectTransfer({ run: input.run, snapshotResult: input.snapshotResult });
  if (authority.status !== "authorized") return authority;
  const projection = buildV3CanonicalProjectProjection({
    authority,
    ...(input.run.runNumber ? { runNumber: input.run.runNumber } : {}),
  });
  return {
    status: "projected",
    projection,
    persistence: input.persist(projection),
  };
}

export type V3ProjectUpsertResult =
  | Readonly<{ status: "created" | "unchanged"; projects: unknown[]; project: Record<string, unknown> }>
  | Readonly<{ status: "conflict"; projects: unknown[]; project: Record<string, unknown> }>;

/** Pure exact-id upsert used by the file-backed Projects repository wrapper. */
export function upsertV3CanonicalProjectProjection(
  projectsInput: readonly unknown[],
  projection: V3CanonicalProjectProjection,
  now = new Date().toISOString(),
  expectedIdentity?: Readonly<{ projectionHash: string; projectRecordHash: string }>,
): V3ProjectUpsertResult {
  const projects = projectsInput.map((project) => ({ ...(project as Record<string, unknown>) }));
  const record = createV3CanonicalProjectRecordIdentity({ projection, persistedAt: now });
  if (expectedIdentity && (
    record.identity.projectionHash !== expectedIdentity.projectionHash
    || record.recordHash !== expectedIdentity.projectRecordHash
  )) {
    return {
      status: "conflict",
      projects,
      project: projects.find((project) => project.id === projection.id) ?? { id: projection.id },
    };
  }
  const exactIndex = projects.findIndex((project) => project.id === projection.id);
  if (exactIndex === -1) {
    const project: Record<string, unknown> = {
      ...projection,
      canonicalProjectionHash: record.identity.projectionHash,
      canonicalProjectionPersistedAt: record.identity.persistedAt,
      canonicalProjectRecordHash: record.recordHash,
      emoji: "🚀",
      domain: "",
      repo: "",
      createdAt: projection.completedAt,
      updatedAt: now,
      stories: { total: 0, done: 0 },
      features: [],
      tasks: [],
      github: "",
      category: "own",
      checklist: [],
    };
    projects.push(project);
    return { status: "created", projects, project };
  }

  const current = projects[exactIndex]!;
  const currentProtocol = current.productCompilerProtocol;
  const currentRunId = current.workflowRunId;
  const currentCandidateHash = current.acceptedCandidateHash;
  const currentReceiptHash = current.deploymentReceiptHash;
  const exactAuthority = currentProtocol === "v3"
    && currentRunId === projection.workflowRunId
    && currentCandidateHash === projection.acceptedCandidateHash
    && currentReceiptHash === projection.deploymentReceiptHash;
  if (!exactAuthority) return { status: "conflict", projects, project: current };
  const persistedAt = typeof current.canonicalProjectionPersistedAt === "string"
    ? current.canonicalProjectionPersistedAt
    : now;
  const expected = createV3CanonicalProjectRecordIdentity({ projection, persistedAt });
  const existingProjectionHash = current.canonicalProjectionHash;
  const existingRecordHash = current.canonicalProjectRecordHash;
  if (
    (existingProjectionHash !== undefined && existingProjectionHash !== expected.identity.projectionHash)
    || (existingRecordHash !== undefined && existingRecordHash !== expected.recordHash)
  ) {
    return { status: "conflict", projects, project: current };
  }
  const project = {
    ...current,
    ...projection,
    canonicalProjectionHash: expected.identity.projectionHash,
    canonicalProjectionPersistedAt: expected.identity.persistedAt,
    canonicalProjectRecordHash: expected.recordHash,
    updatedAt: current.updatedAt ?? now,
  };
  projects[exactIndex] = project;
  return { status: "unchanged", projects, project };
}
