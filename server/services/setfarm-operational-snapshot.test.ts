import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { toOperationalSnapshotHttpResult } from "../routes/setfarm-operational.js";
import {
  RUN_OPERATIONAL_SNAPSHOT_V1_SCHEMA,
  RUN_OPERATIONAL_SNAPSHOT_V2_SCHEMA,
  SetfarmOperationalSnapshotClient,
  computeOperationalSnapshotHash,
  parseRunOperationalSnapshotV1,
  parseRunOperationalSnapshotV2,
  type RunOperationalSnapshot,
  type RunOperationalSnapshotV1,
  type RunOperationalSnapshotV2,
} from "./setfarm-operational-snapshot.js";

function snapshotFixture(): RunOperationalSnapshotV1 {
  const snapshot: RunOperationalSnapshotV1 = {
    schema: RUN_OPERATIONAL_SNAPSHOT_V1_SCHEMA,
    generatedAt: "2026-07-13T12:00:00.000Z",
    snapshotHash: "a".repeat(64),
    source: {
      database: "postgres",
      projection: "partial",
      migrationVersions: [7, 8],
      verifiedReleaseSha: "b".repeat(40),
      capabilities: {
        attempts: true,
        claimBinding: true,
        runtimeOwnership: true,
        managerCompletion: false,
        effectLedger: false,
        findingRecovery: false,
        evidenceLedger: false,
        acceptedCandidate: false,
        deploymentReceipt: false,
        projectTransferAck: false,
      },
    },
    run: {
      ref: "setfarm://run/run-1",
      id: "run-1",
      runNumber: 2001,
      protocol: "shadow",
      status: "running",
      terminal: false,
      updatedAt: "2026-07-13T12:00:00.000Z",
    },
    summary: {
      lifecycleState: "runtime_active",
      health: "attention",
      activeClaims: 0,
      activeAttempts: 0,
      activeRuntimes: 0,
      openCompletions: 0,
      mandatoryEffectsPending: 0,
      unpublishedOutbox: 0,
      invariantViolations: 0,
      operatorActions: {
        stop: { allowed: true, reasonCode: "STOP_ALLOWED", stateHash: "c".repeat(64) },
        resume: { allowed: false, reasonCode: "RESUME_BLOCKED", stateHash: "d".repeat(64) },
      },
    },
    claims: [],
    attempts: [],
    runtimeSessions: [],
    completionRequests: [],
    terminationRequests: [],
    outbox: [],
    invariants: [],
  };
  return seal(snapshot);
}

function seal<T extends RunOperationalSnapshot>(snapshot: T): T {
  snapshot.snapshotHash = computeOperationalSnapshotHash(snapshot);
  return snapshot;
}

function snapshotV2Fixture(): RunOperationalSnapshotV2 {
  const envelope = JSON.parse(readFileSync(
    new URL("../../contracts/vendor/setfarm/run-operational-snapshot.v2.compatibility.json", import.meta.url),
    "utf8",
  )) as { fixture: RunOperationalSnapshotV2 };
  return structuredClone(envelope.fixture);
}

function deployTerminationProjectionFixture(): RunOperationalSnapshotV1 {
  const snapshot = snapshotFixture();
  snapshot.run.protocol = "v3";
  snapshot.terminationRequests = [{
    ref: "setfarm://run-termination/RTR_deploy-refusal-0001",
    requestId: "RTR_deploy-refusal-0001",
    runRef: snapshot.run.ref,
    targetStatus: "failed",
    state: "requested",
    requestedBy: "setfarm.product-compiler.deploy-refusal",
    diagnostic: "V3_DEPLOY_SOURCE_REVISION_MISMATCH:canonical refusal",
    evidence: {
      schema: "setfarm.v3-deploy-authority-termination.v1",
      terminalFailure: true,
      owner: "compiler",
      refusalHash: "c".repeat(64),
      authorityCode: "V3_DEPLOY_SOURCE_REVISION_MISMATCH",
      authorityEvidence: {
        expectedSha: "1".repeat(40),
        observedSha: "2".repeat(40),
      },
      claimId: 42,
      modelRedispatchBudget: 0,
      runtimeSessionCount: 1,
      ownerInstanceId: "setfarm-spawner",
    },
    requestedAt: "2026-07-13T12:00:00.000Z",
    drainedAt: null,
    terminalizedAt: null,
    createdAt: "2026-07-13T12:00:00.000Z",
    updatedAt: "2026-07-13T12:00:00.000Z",
  }];
  return seal(snapshot);
}

function recoveryProjectionFixture(): RunOperationalSnapshotV1 {
  const snapshot = snapshotFixture();
  const findingSetHash = "d".repeat(64);
  const findingId = `FIND_${"c".repeat(64)}`;
  const packetHash = "e".repeat(64);
  const sliceHash = "f".repeat(64);
  const sourceRevision = { sha: "1".repeat(40), treeHash: "2".repeat(40) };
  const findingSetRef = `setfarm://finding-sets/${findingSetHash}`;
  const recoveryCaseId = `RCV_${"4".repeat(64)}`;
  const recoveryCaseRef = `setfarm://recovery-cases/${recoveryCaseId}`;
  const revisionId = `RREV_${"6".repeat(64)}`;
  const revisionRef = `setfarm://recovery-revisions/${revisionId}`;

  snapshot.source.capabilities.findingRecovery = true;
  snapshot.source.capabilities.evidenceLedger = true;
  snapshot.findingSets = [{
    ref: findingSetRef,
    findingSetId: `FSET_${"a".repeat(64)}`,
    findingSetHash,
    runRef: snapshot.run.ref,
    storyRef: "setfarm://runs/run-1/stories/US-001",
    storyId: "US-001",
    packetHash,
    sliceHash,
    sourceRevision,
    findingIds: [findingId],
    createdAt: "2026-07-13T11:58:00.000Z",
  }];
  snapshot.evidenceBundles = [{
    ref: `setfarm://evidence-bundles/${"3".repeat(64)}`,
    evidenceId: `EVB_${"b".repeat(64)}`,
    evidenceBundleHash: "3".repeat(64),
    runRef: snapshot.run.ref,
    storyRef: "setfarm://runs/run-1/stories/US-001",
    storyId: "US-001",
    attemptRef: null,
    attemptId: null,
    packetHash,
    sliceHash,
    sourceRevision,
    aggregateVerdict: "fail",
    predicateCount: 2,
    observationCount: 3,
    createdAt: "2026-07-13T11:59:00.000Z",
  }];
  snapshot.recoveryCases = [{
    ref: recoveryCaseRef,
    recoveryCaseId,
    revisionRef,
    revisionId,
    revisionNumber: 1,
    runRef: snapshot.run.ref,
    storyRef: "setfarm://runs/run-1/stories/US-001",
    storyId: "US-001",
    findingSetRef,
    findingSetHash,
    packetHash,
    sliceHash,
    sourceRevision,
    owner: "supervisor",
    expectedDeltaKind: "source_change",
    status: "repairing",
    budget: {
      limits: { implement: 1, supervisorRepair: 1, evidenceOnly: 2 },
      used: { implement: 1, supervisorRepair: 0, evidenceOnly: 0 },
    },
    stateVersion: 2,
    terminalReasonCode: null,
    createdAt: "2026-07-13T11:58:00.000Z",
    updatedAt: "2026-07-13T12:00:00.000Z",
  }];
  snapshot.recoveryDispatches = [{
    ref: `setfarm://recovery-dispatches/RDISP_${"5".repeat(64)}`,
    dispatchId: `RDISP_${"5".repeat(64)}`,
    recoveryCaseRef,
    recoveryCaseId,
    revisionRef,
    revisionId,
    revisionNumber: 1,
    runRef: snapshot.run.ref,
    storyRef: "setfarm://runs/run-1/stories/US-001",
    storyId: "US-001",
    findingSetRef,
    findingSetHash,
    dispatchClass: "supervisor_repair",
    packetHash,
    sliceHash,
    sourceRevision,
    findingIds: [findingId],
    deliveryState: "authorized",
    attemptRef: null,
    attemptId: null,
    claimRef: null,
    executionSliceHash: null,
    attemptCount: 0,
    leaseOwnerInstanceId: null,
    leaseExpiresAt: null,
    terminalReasonCode: null,
    authorizedAt: "2026-07-13T12:00:00.000Z",
    terminalAt: null,
  }];
  return seal(snapshot);
}

function canonicalHash(value: unknown): string {
  const serialize = (item: unknown): string => {
    if (item === null || typeof item === "boolean" || typeof item === "string" || typeof item === "number") {
      return JSON.stringify(item);
    }
    if (Array.isArray(item)) return `[${item.map(serialize).join(",")}]`;
    const record = item as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${serialize(record[key])}`).join(",")}}`;
  };
  return createHash("sha256").update(serialize(value), "utf8").digest("hex");
}

function acceptedCandidateProjectionFixture(): RunOperationalSnapshotV1 {
  const snapshot = snapshotFixture();
  const attemptId = "ATT_00000000-0000-0000-0000-000000000777";
  const storyId = "US-001";
  const packetHash = "1".repeat(64);
  const storyPlanHash = "2".repeat(64);
  const sliceHash = "3".repeat(64);
  const bundleHash = "4".repeat(64);
  const sourceRevision = { sha: "5".repeat(40), treeHash: "6".repeat(40) };
  const evidenceId = `EVB_${"7".repeat(64)}`;
  const storyEvidence = [{
    storyId,
    attemptId,
    sliceHash,
    evidencePlanHash: "8".repeat(64),
    evidencePlanArtifactHash: "9".repeat(64),
    evidenceBundleHash: bundleHash,
    evidenceId,
    predicateRefs: ["EVID_SAVE_RELOAD"],
  }];
  const integrationEvidenceHash = canonicalHash({
    schema: "setfarm.integrated-source-evidence.v1",
    runId: snapshot.run.id,
    packetHash,
    storyPlanHash,
    sourceRevision,
    storyEvidence,
  });
  const identity = {
    schema: "setfarm.accepted-candidate.v1" as const,
    runId: snapshot.run.id,
    packetHash,
    storyPlanHash,
    sourceRevision,
    storyEvidence,
    integrationEvidenceHash,
    acceptor: {
      id: "setfarm-final-tree-acceptor" as const,
      version: "1.0.0" as const,
      codeSha: "a".repeat(40),
      environmentHash: "b".repeat(64),
    },
  };
  const candidateHash = canonicalHash(identity);
  snapshot.run.protocol = "v3";
  snapshot.source.capabilities.evidenceLedger = true;
  snapshot.source.capabilities.acceptedCandidate = true;
  snapshot.attempts = [{
    ref: `setfarm://execution-attempt/${attemptId}`,
    attemptId,
    runRef: snapshot.run.ref,
    claimRef: null,
    stepRef: `${snapshot.run.ref}/step/final-test`,
    storyRef: `${snapshot.run.ref}/story/${storyId}`,
    workflowStepId: "final-test",
    storyId,
    generation: 1,
    attemptClass: "evidence_only",
    packetHash,
    compilationReportHash: "c".repeat(64),
    sliceHash,
    sourceBefore: sourceRevision,
    sourceAfter: sourceRevision,
    findingSetHash: null,
    role: "tester",
    agentId: "feature-dev_tester",
    disposition: "verified",
    outputHash: bundleHash,
    createdAt: "2026-07-13T11:59:00.000Z",
    updatedAt: "2026-07-13T11:59:30.000Z",
  }];
  snapshot.evidenceBundles = [{
    ref: `setfarm://evidence-bundle/${bundleHash}`,
    evidenceId,
    evidenceBundleHash: bundleHash,
    runRef: snapshot.run.ref,
    storyRef: `${snapshot.run.ref}/story/${storyId}`,
    storyId,
    attemptRef: `setfarm://execution-attempt/${attemptId}`,
    attemptId,
    packetHash,
    sliceHash,
    sourceRevision,
    aggregateVerdict: "pass",
    predicateCount: 1,
    observationCount: 1,
    createdAt: "2026-07-13T11:59:30.000Z",
  }];
  snapshot.acceptedCandidate = {
    ref: `setfarm://accepted-candidate/${candidateHash}`,
    candidate: {
      ...identity,
      candidateId: `ACPT_${candidateHash}`,
      candidateHash,
    },
    createdAt: "2026-07-13T12:00:00.000Z",
  };
  return seal(snapshot);
}

/**
 * Cross-service wire fixture. Its runtime and health objects mirror Setfarm's
 * strict V3RuntimeDeploymentV1Schema and V3DeployHealthProofV1Schema rather
 * than a Mission Control-local subset.
 */
function deploymentReceiptProjectionFixture(): RunOperationalSnapshotV1 {
  const snapshot = acceptedCandidateProjectionFixture();
  const candidate = snapshot.acceptedCandidate?.candidate;
  if (!candidate) throw new Error("accepted candidate fixture missing");
  const projectId = `prod-ledger-${candidate.candidateHash.slice(0, 12)}`;
  const buildArtifactIdentity = {
    schema: "setfarm.v3-build-artifact.v1" as const,
    outputPaths: ["dist"],
    files: [{
      path: "dist/index.html",
      byteLength: 14,
      contentHash: "a".repeat(64),
      executable: false,
    }],
    totalBytes: 14,
  };
  const buildArtifactHash = canonicalHash(buildArtifactIdentity);
  const buildArtifactEvidenceRef = `setfarm://deploy/build-artifact/${snapshot.run.id}/${buildArtifactHash}`;
  const sealedRuntimeRef = `setfarm://deploy/sealed-runtime/${snapshot.run.id}/${candidate.candidateHash}/${buildArtifactHash}`;
  const sealedRuntimeManifestHash = "e".repeat(64);
  const sealedRuntimeManifestEvidenceRef = `setfarm://deploy/sealed-runtime-manifest/${snapshot.run.id}/${candidate.candidateHash}/${buildArtifactHash}/${sealedRuntimeManifestHash}`;
  const runtimeDataContractHash = "8".repeat(64);
  const volumeProvisioningIdentity = {
    schema: "setfarm.v3-runtime-volume-provisioning.v1" as const,
    runId: snapshot.run.id,
    projectId,
    runtimeDataContractHash,
    writableVolumes: [],
    scratch: { kind: "none" as const },
  };
  const volumeProvisioningHash = canonicalHash(volumeProvisioningIdentity);
  const runtimeIsolationIdentity = {
    schema: "setfarm.v3-runtime-isolation-authority.v1" as const,
    adapterId: "darwin-sandbox-exec" as const,
    adapterVersion: "1.0.0" as const,
    runId: snapshot.run.id,
    projectId,
    candidateHash: candidate.candidateHash,
    buildArtifactHash,
    policyHash: "6".repeat(64),
    profileHash: "9".repeat(64),
    wrapperArtifactHash: "7".repeat(64),
    runtimeDataContractHash,
    volumeProvisioningHash,
  };
  const runtimeIsolationAuthorityHash = canonicalHash(runtimeIsolationIdentity);
  const runtimeIsolationEvidenceRef = `setfarm://deploy/runtime-isolation/${snapshot.run.id}/${candidate.candidateHash}/${buildArtifactHash}/${runtimeIsolationAuthorityHash}`;
  const sealAuthorityHash = "5".repeat(64);
  const sealAuthorityEvidenceRef = `setfarm://deploy/seal-authority/${snapshot.run.id}/${candidate.candidateHash}/${buildArtifactHash}/${sealAuthorityHash}`;
  const ownerProcess = {
    schema: "setfarm.process-identity.v1" as const,
    pid: 7123,
    processStartedAt: "2026-07-13T11:59:45.000Z",
    processGroupId: 7123,
    source: "observed_os" as const,
  };
  const challengeIdentity = {
    schema: "setfarm.v3-runtime-isolation-challenge.v1" as const,
    nonce: "4".repeat(64),
    authorityHash: runtimeIsolationAuthorityHash,
    wrapperProcessIdentity: ownerProcess,
    deniedRootProbes: [
      { rootId: "sealed-runtime" as const, outcome: "denied" as const },
      { rootId: "state-authority" as const, outcome: "denied" as const },
    ],
    deniedReadProbes: [
      { authorityId: "launch-agents" as const, outcome: "denied" as const },
      { authorityId: "mission-control-config" as const, outcome: "denied" as const },
      { authorityId: "setfarm-config" as const, outcome: "denied" as const },
    ],
    deniedNetworkProbes: [{ authorityId: "all-outbound" as const, outcome: "denied" as const }],
    deniedProcessExecProbes: [{ executableId: "launchctl" as const, outcome: "denied" as const }],
    deniedSignalProbes: [{ authorityId: "control-sentinel" as const, outcome: "denied" as const }],
    allowedVolumeProbes: [],
    challengedAt: "2026-07-13T11:59:55.000Z",
  };
  const identity = {
    schema: "setfarm.v3-deploy-receipt.v1" as const,
    runId: snapshot.run.id,
    candidateId: candidate.candidateId,
    candidateHash: candidate.candidateHash,
    packetHash: candidate.packetHash,
    project: {
      schema: "setfarm.v3-deploy-project.v1" as const,
      productId: "PROD_LEDGER",
      projectId,
      displayName: "Canonical Ledger",
      summary: "Project only exact accepted deployment evidence.",
    },
    stack: {
      schema: "setfarm.v3-deploy-stack.v1" as const,
      stackPackId: "vite-react-web-app",
      stackPackVersion: "1.1.0",
      stackPackContentHash: "d".repeat(64),
      platform: "web" as const,
      techStack: "vite-react" as const,
    },
    buildCommandId: "CMD_BUILD",
    previewCommandId: "CMD_PREVIEW",
    sourceBefore: candidate.sourceRevision,
    sourceAfter: candidate.sourceRevision,
    buildArtifact: {
      ...buildArtifactIdentity,
      artifactHash: buildArtifactHash,
      evidenceRef: buildArtifactEvidenceRef,
    },
    runtime: {
      schema: "setfarm.v3-runtime-deployment.v1" as const,
      mode: "local" as const,
      projectId,
      serviceId: "process:7123",
      host: "127.0.0.1",
      port: 4123,
      healthUrl: "http://127.0.0.1:4123/",
      deployUrl: "http://127.0.0.1:4123/",
      evidenceRef: `setfarm://deploy/runtime/${snapshot.run.id}/${projectId}`,
      buildArtifactHash,
      buildArtifactEvidenceRef,
      sealedRuntimeRef,
      sealedRuntimeManifestHash,
      sealedRuntimeManifestEvidenceRef,
      sealAuthorityHash,
      sealAuthorityEvidenceRef,
      runtimeDataContractHash,
      volumeProvisioning: {
        ...volumeProvisioningIdentity,
        volumeProvisioningHash,
        evidenceRef: `setfarm://deploy/runtime-volumes/${snapshot.run.id}/${projectId}/${volumeProvisioningHash}`,
      },
      runtimeIsolation: {
        ...runtimeIsolationIdentity,
        evidenceRef: runtimeIsolationEvidenceRef,
        authorityHash: runtimeIsolationAuthorityHash,
      },
    },
    health: {
      schema: "setfarm.v3-deploy-health-proof.v1" as const,
      status: "pass" as const,
      httpStatus: 200,
      checkedAt: "2026-07-13T11:59:55.000Z",
      evidenceRef: `setfarm://deploy/runtime/${snapshot.run.id}/${projectId}/health`,
      buildArtifactHash,
      buildArtifactEvidenceRef,
      sealedRuntimeManifestHash,
      sealedRuntimeManifestEvidenceRef,
      listenerOwnership: {
        schema: "setfarm.v3-listener-ownership.v1" as const,
        ownerProcess,
        listenerPids: [7123],
        listenerProcesses: [ownerProcess],
        host: "127.0.0.1",
        port: 4123,
        checkedAt: "2026-07-13T11:59:55.000Z",
        evidenceRef: `setfarm://deploy/runtime/${snapshot.run.id}/${projectId}/listener/7123`,
      },
      runtimeIsolation: {
        ...runtimeIsolationIdentity,
        schema: "setfarm.v3-runtime-isolation-proof.v1" as const,
        evidenceRef: runtimeIsolationEvidenceRef,
        authorityHash: runtimeIsolationAuthorityHash,
        challenge: {
          ...challengeIdentity,
          challengeHash: canonicalHash(challengeIdentity),
        },
        checkedAt: "2026-07-13T11:59:55.000Z",
        checks: { runtimeIsolation: "pass" as const },
      },
    },
    terminalProjectProjection: {
      schema: "setfarm.v3-terminal-project-projection.v1" as const,
      owner: "mission-control-terminal-projector" as const,
      state: "pending_terminal_projection" as const,
      runId: snapshot.run.id,
      candidateHash: candidate.candidateHash,
      projectId,
      serviceId: "process:7123",
      port: 4123,
      healthUrl: "http://127.0.0.1:4123/",
      evidenceRef: `setfarm://run/${snapshot.run.id}/deploy-receipt`,
      buildArtifactHash,
    },
    environmentNames: ["DATABASE_URL"],
    completedAt: "2026-07-13T11:59:55.000Z",
  };
  const receiptHash = canonicalHash(identity);
  snapshot.source.capabilities.effectLedger = true;
  snapshot.source.capabilities.deploymentReceipt = true;
  snapshot.deploymentReceipt = {
    ref: `setfarm://v3-deploy-receipts/${receiptHash}`,
    receipt: { ...identity, receiptHash },
    createdAt: "2026-07-13T11:59:56.000Z",
  };
  return seal(snapshot);
}

function projectTransferAckProjectionFixture(): RunOperationalSnapshotV1 {
  const snapshot = deploymentReceiptProjectionFixture();
  const candidate = snapshot.acceptedCandidate?.candidate;
  const receipt = snapshot.deploymentReceipt?.receipt;
  if (!candidate || !receipt) throw new Error("project transfer authority fixture missing");
  const sourceSnapshotHash = snapshot.snapshotHash;
  const projectProjection = {
    id: receipt.project.projectId,
    name: receipt.project.displayName,
    description: receipt.project.summary,
    type: "web" as const,
    ports: { frontend: receipt.runtime.port },
    deployUrl: receipt.runtime.deployUrl,
    service: receipt.runtime.serviceId,
    serviceStatus: "active" as const,
    status: "active" as const,
    stack: [receipt.stack.techStack ?? receipt.stack.stackPackId].sort(),
    createdBy: "setfarm-v3-terminal-projector" as const,
    productCompilerProtocol: "v3" as const,
    workflowRunId: snapshot.run.id,
    setfarmRunIds: [snapshot.run.id],
    ...(snapshot.run.runNumber ? { runNumber: snapshot.run.runNumber } : {}),
    acceptedCandidateId: candidate.candidateId,
    acceptedCandidateHash: candidate.candidateHash,
    acceptedPacketHash: candidate.packetHash,
    acceptedSourceSha: candidate.sourceRevision.sha,
    acceptedSourceTreeHash: candidate.sourceRevision.treeHash,
    deploymentReceiptHash: receipt.receiptHash,
    deploymentReceiptRef: snapshot.deploymentReceipt!.ref,
    deploymentHealthRef: receipt.health.evidenceRef,
    deploymentHealthUrl: receipt.runtime.healthUrl,
    deployedAt: receipt.completedAt,
    completedAt: receipt.completedAt,
  };
  const projectionHash = canonicalHash(projectProjection);
  const persistedAt = "2026-07-13T12:00:02.000Z";
  const projectRecordHash = canonicalHash({
    schema: "mission-control.v3-canonical-project-record.v1",
    projection: projectProjection,
    projectionHash,
    persistedAt,
  });
  const ackPayload = {
    schema: "setfarm.v3-project-transfer-ack.v1" as const,
    ackVersion: 1 as const,
    runId: snapshot.run.id,
    candidateId: candidate.candidateId,
    candidateHash: candidate.candidateHash,
    packetHash: candidate.packetHash,
    sourceRevision: candidate.sourceRevision,
    deploymentReceiptHash: receipt.receiptHash,
    deploymentReceiptRef: snapshot.deploymentReceipt!.ref,
    sourceSnapshotHash,
    projectId: receipt.project.projectId,
    projectProjection,
    projectionHash,
    projectRecordHash,
    projectRecordRef: `mission-control://projects/${receipt.project.projectId}/${projectRecordHash}`,
    persistedAt,
    projector: { service: "mission-control" as const, protocol: "v3" as const },
  };
  const ackHash = canonicalHash(ackPayload);
  snapshot.run.status = "completed";
  snapshot.run.terminal = true;
  snapshot.source.capabilities.projectTransferAck = true;
  snapshot.projectTransferAck = {
    ref: `setfarm://v3-project-transfer-acks/${ackHash}`,
    acknowledgement: { ...ackPayload, ackHash },
    createdAt: "2026-07-13T12:00:03.000Z",
  };
  return seal(snapshot);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("v1 validator is strict and preserves the canonical payload object", () => {
  const snapshot = snapshotFixture();
  const parsed = parseRunOperationalSnapshotV1(snapshot);

  assert.equal(parsed, snapshot);
  assert.equal(parsed.source.projection, "partial");
  assert.equal(parsed.source.capabilities.managerCompletion, false);

  const withExtra = { ...snapshot, narrative: "agent said success" };
  assert.throws(() => parseRunOperationalSnapshotV1(withExtra));

  const badInvariantCount = structuredClone(snapshot);
  badInvariantCount.summary.invariantViolations = 1;
  assert.throws(() => parseRunOperationalSnapshotV1(badInvariantCount));

  const badComplete = structuredClone(snapshot);
  badComplete.source.projection = "complete";
  assert.throws(() => parseRunOperationalSnapshotV1(badComplete));

  const missingActionStateHash = structuredClone(snapshot) as unknown as {
    summary: { operatorActions: { resume: { stateHash?: string } } };
  };
  delete missingActionStateHash.summary.operatorActions.resume.stateHash;
  seal(missingActionStateHash as unknown as RunOperationalSnapshotV1);
  assert.throws(() => parseRunOperationalSnapshotV1(missingActionStateHash));
});

test("v2 validator preserves v1 semantics and strictly binds implementation proposal receipts", () => {
  const snapshot = snapshotV2Fixture();
  const parsed = parseRunOperationalSnapshotV2(snapshot);
  assert.equal(parsed, snapshot);
  assert.equal(parsed.schema, RUN_OPERATIONAL_SNAPSHOT_V2_SCHEMA);
  assert.equal(parsed.source.capabilities.implementationSubmissionEvidence, true);
  const evidence = parsed.completionRequests[0]?.implementationSubmissionEvidence;
  assert.ok(evidence);
  assert.equal(evidence.receipt.canonicalOutputHash, parsed.completionRequests[0]?.outputHash);
  assert.equal(
    evidence.sourceProposalRef,
    `setfarm://runtime-completion/${parsed.completionRequests[0]?.requestId}/source-proposal/${evidence.receipt.sourceProposalHash}`,
  );

  const cases: Array<(value: RunOperationalSnapshotV2) => void> = [
    (value) => { (value.completionRequests[0]!.implementationSubmissionEvidence!.receipt as unknown as Record<string, unknown>).agentSummary = "trusted"; },
    (value) => { value.completionRequests[0]!.implementationSubmissionEvidence!.receipt.sourceSchema = "setfarm.v3-unknown" as never; },
    (value) => { value.completionRequests[0]!.implementationSubmissionEvidence!.receipt.canonicalOutputHash = "f".repeat(64); },
    (value) => { value.completionRequests[0]!.implementationSubmissionEvidence!.receipt.sourceProposalHash = "A".repeat(64); },
    (value) => { value.completionRequests[0]!.implementationSubmissionEvidence!.sourceProposalRef = "setfarm://runtime-completion/foreign/source-proposal/" + "a".repeat(64); },
    (value) => { value.completionRequests[0]!.implementationSubmissionEvidence!.receipt.ignoredFieldPaths = ["/z", "/a"]; },
    (value) => { value.completionRequests[0]!.implementationSubmissionEvidence!.receipt.ignoredFieldPaths = ["/a", "/a"]; },
    (value) => { value.completionRequests[0]!.implementationSubmissionEvidence!.receipt.ignoredFieldPaths = ["not-a-pointer"]; },
    (value) => { value.completionRequests[0]!.implementationSubmissionEvidence!.receipt.ignoredFieldPaths = [`/${"a".repeat(2_001)}`]; },
    (value) => {
      value.completionRequests[0]!.implementationSubmissionEvidence!.receipt.ignoredFieldPaths = Array.from(
        { length: 66 },
        (_, index) => `/${String(index).padStart(2, "0")}${"a".repeat(1_997)}`,
      );
    },
    (value) => { value.source.capabilities.implementationSubmissionEvidence = false; },
  ];
  for (const mutate of cases) {
    const invalid = structuredClone(snapshot);
    mutate(invalid);
    seal(invalid);
    assert.throws(() => parseRunOperationalSnapshotV2(invalid));
  }

  const legacy = structuredClone(snapshot);
  legacy.completionRequests[0]!.implementationSubmissionEvidence = null;
  seal(legacy);
  assert.doesNotThrow(() => parseRunOperationalSnapshotV2(legacy));

  const unicodeBoundary = structuredClone(snapshot);
  unicodeBoundary.completionRequests[0]!.implementationSubmissionEvidence!.receipt.ignoredFieldPaths = [
    `/${"\u00fc".repeat(1_999)}`,
  ];
  seal(unicodeBoundary);
  assert.doesNotThrow(() => parseRunOperationalSnapshotV2(unicodeBoundary));

  const maxItems = structuredClone(snapshot);
  maxItems.completionRequests[0]!.implementationSubmissionEvidence!.receipt.ignoredFieldPaths = Array.from(
    { length: 20_000 },
    (_, index) => `/${index.toString(36).padStart(3, "0")}`,
  );
  seal(maxItems);
  assert.doesNotThrow(() => parseRunOperationalSnapshotV2(maxItems));

  const preV19 = structuredClone(legacy);
  preV19.source.migrationVersions = preV19.source.migrationVersions.filter((version) => version !== 19);
  preV19.source.capabilities.implementationSubmissionEvidence = false;
  seal(preV19);
  assert.doesNotThrow(() => parseRunOperationalSnapshotV2(preV19));

  const unattestedV19 = structuredClone(preV19);
  unattestedV19.source.migrationVersions.push(19);
  unattestedV19.source.verifiedReleaseSha = null;
  seal(unattestedV19);
  assert.doesNotThrow(() => parseRunOperationalSnapshotV2(unattestedV19));

  const missingMigrationAuthority = structuredClone(snapshot);
  missingMigrationAuthority.source.migrationVersions = missingMigrationAuthority.source.migrationVersions
    .filter((version) => version !== 19);
  seal(missingMigrationAuthority);
  assert.throws(() => parseRunOperationalSnapshotV2(missingMigrationAuthority));

  const unattestedAuthority = structuredClone(snapshot);
  unattestedAuthority.source.verifiedReleaseSha = null;
  seal(unattestedAuthority);
  assert.throws(() => parseRunOperationalSnapshotV2(unattestedAuthority));
});

test("typed termination projection preserves canonical refusal evidence and fails closed on drift", () => {
  const snapshot = deployTerminationProjectionFixture();
  const parsed = parseRunOperationalSnapshotV1(snapshot);
  assert.equal(parsed, snapshot);
  assert.equal(parsed.terminationRequests[0]?.requestedBy, "setfarm.product-compiler.deploy-refusal");
  assert.equal(parsed.terminationRequests[0]?.diagnostic, "V3_DEPLOY_SOURCE_REVISION_MISMATCH:canonical refusal");
  assert.deepEqual(parsed.terminationRequests[0]?.evidence, snapshot.terminationRequests[0]?.evidence);

  const plan = structuredClone(snapshot);
  plan.terminationRequests[0]!.requestedBy = "setfarm.product-compiler.plan-refusal";
  plan.terminationRequests[0]!.diagnostic = "V3_PLAN_CLARIFICATION_REQUIRED:PRODUCT_SPEC_TASK_AMBIGUOUS:REQ_PRIMARY";
  plan.terminationRequests[0]!.evidence = {
    schema: "setfarm.v3-plan-clarification-termination.v1",
    terminalFailure: true,
    owner: "compiler",
    rejectionHash: "d".repeat(64),
    sourceTaskHash: "e".repeat(64),
    reasonCodes: ["PRODUCT_SPEC_TASK_AMBIGUOUS"],
    requirementRefs: ["REQ_PRIMARY"],
    modelRedispatchBudget: 0,
  };
  seal(plan);
  assert.equal(
    parseRunOperationalSnapshotV1(plan).terminationRequests[0]?.evidence.schema,
    "setfarm.v3-plan-clarification-termination.v1",
  );

  const downstream = structuredClone(snapshot);
  downstream.terminationRequests[0]!.requestedBy = "setfarm-v3-downstream-compiler";
  downstream.terminationRequests[0]!.diagnostic = "packet_amendment_required:canonical contract gap";
  downstream.terminationRequests[0]!.evidence = {
    schema: "setfarm.v3-downstream-termination-evidence.v1",
    routeHash: "f".repeat(64),
    packetHash: "9".repeat(64),
    sourceRevision: { sha: "1".repeat(40), treeHash: "2".repeat(40) },
    outcome: "packet_amendment_required",
    storyEvidenceRefs: ["setfarm://evidence-bundle/example"],
    requiredArtifact: "setfarm.product-build-packet.v.next",
  };
  seal(downstream);
  assert.equal(
    parseRunOperationalSnapshotV1(downstream).terminationRequests[0]?.evidence.schema,
    "setfarm.v3-downstream-termination-evidence.v1",
  );

  const redispatch = structuredClone(snapshot) as unknown as {
    terminationRequests: Array<{ evidence: Record<string, unknown> }>;
  };
  redispatch.terminationRequests[0]!.evidence.modelRedispatchBudget = 1;
  seal(redispatch as unknown as RunOperationalSnapshotV1);
  assert.throws(() => parseRunOperationalSnapshotV1(redispatch));

  const wrongAuthority = structuredClone(snapshot) as unknown as {
    terminationRequests: Array<{ evidence: Record<string, unknown> }>;
  };
  wrongAuthority.terminationRequests[0]!.evidence.authorityCode = "AGENT_SAID_DEPLOY_FAILED";
  seal(wrongAuthority as unknown as RunOperationalSnapshotV1);
  assert.throws(() => parseRunOperationalSnapshotV1(wrongAuthority));

  const wrongRequester = structuredClone(snapshot);
  wrongRequester.terminationRequests[0]!.requestedBy = "agent-prose-classifier";
  seal(wrongRequester);
  assert.throws(() => parseRunOperationalSnapshotV1(wrongRequester));

  const unsupportedVersion = structuredClone(snapshot) as unknown as {
    terminationRequests: Array<{ evidence: Record<string, unknown> }>;
  };
  unsupportedVersion.terminationRequests[0]!.evidence.schema = "setfarm.v3-deploy-authority-termination.v2";
  seal(unsupportedVersion as unknown as RunOperationalSnapshotV1);
  assert.throws(() => parseRunOperationalSnapshotV1(unsupportedVersion));
});

test("optional finding, evidence, and bounded recovery projections preserve exact canonical identities", () => {
  const snapshot = recoveryProjectionFixture();
  const parsed = parseRunOperationalSnapshotV1(snapshot);

  assert.equal(parsed, snapshot);
  assert.equal(parsed.findingSets?.[0].findingSetId, `FSET_${"a".repeat(64)}`);
  assert.equal(parsed.evidenceBundles?.[0].aggregateVerdict, "fail");
  assert.equal(parsed.recoveryCases?.[0].owner, "supervisor");
  assert.equal(parsed.recoveryCases?.[0].status, "repairing");
  assert.equal(parsed.recoveryCases?.[0].revisionNumber, 1);
  assert.equal(parsed.recoveryDispatches?.[0].dispatchClass, "supervisor_repair");
  assert.equal(parsed.recoveryDispatches?.[0].deliveryState, "authorized");
  assert.equal(parsed.recoveryCases?.[0].packetHash, "e".repeat(64));
  assert.equal(parsed.recoveryCases?.[0].sliceHash, "f".repeat(64));
  assert.deepEqual(parsed.recoveryCases?.[0].sourceRevision, { sha: "1".repeat(40), treeHash: "2".repeat(40) });
});

test("accepted candidate projection verifies its hash, final source, attempt, and evidence bindings", () => {
  const snapshot = acceptedCandidateProjectionFixture();
  const parsed = parseRunOperationalSnapshotV1(snapshot);
  assert.equal(parsed.acceptedCandidate?.candidate.storyEvidence[0]?.storyId, "US-001");

  const tamperedIdentity = structuredClone(snapshot);
  if (tamperedIdentity.acceptedCandidate) tamperedIdentity.acceptedCandidate.candidate.sourceRevision.treeHash = "f".repeat(40);
  seal(tamperedIdentity);
  assert.throws(() => parseRunOperationalSnapshotV1(tamperedIdentity));

  const missingEvidence = structuredClone(snapshot);
  missingEvidence.evidenceBundles = [];
  seal(missingEvidence);
  assert.throws(() => parseRunOperationalSnapshotV1(missingEvidence));

  const unsupported = structuredClone(snapshot);
  unsupported.source.capabilities.acceptedCandidate = false;
  seal(unsupported);
  assert.throws(() => parseRunOperationalSnapshotV1(unsupported));
});

test("deployment receipt projection verifies canonical hash and exact run/candidate/source/runtime bindings", () => {
  const snapshot = deploymentReceiptProjectionFixture();
  const parsed = parseRunOperationalSnapshotV1(snapshot);
  assert.equal(parsed.deploymentReceipt?.receipt.project.displayName, "Canonical Ledger");
  assert.equal(parsed.deploymentReceipt?.receipt.runtime.serviceId, "process:7123");
  assert.equal(parsed.deploymentReceipt?.receipt.health.listenerOwnership.ownerProcess.pid, 7123);
  assert.equal(
    parsed.deploymentReceipt?.receipt.buildArtifact.artifactHash,
    parsed.deploymentReceipt?.receipt.runtime.buildArtifactHash,
  );
  assert.equal(
    parsed.deploymentReceipt?.receipt.runtime.sealedRuntimeManifestHash,
    parsed.deploymentReceipt?.receipt.health.sealedRuntimeManifestHash,
  );
  assert.match(
    parsed.deploymentReceipt?.receipt.runtime.sealedRuntimeManifestEvidenceRef || "",
    /^setfarm:\/\/deploy\/sealed-runtime-manifest\//,
  );

  const tamperedService = structuredClone(snapshot);
  if (tamperedService.deploymentReceipt) tamperedService.deploymentReceipt.receipt.runtime.serviceId = "stale-service";
  seal(tamperedService);
  assert.throws(() => parseRunOperationalSnapshotV1(tamperedService));

  const tamperedSource = structuredClone(snapshot);
  if (tamperedSource.deploymentReceipt) tamperedSource.deploymentReceipt.receipt.sourceAfter.treeHash = "f".repeat(40);
  seal(tamperedSource);
  assert.throws(() => parseRunOperationalSnapshotV1(tamperedSource));

  const tamperedBuildBytes = structuredClone(snapshot);
  if (tamperedBuildBytes.deploymentReceipt) {
    tamperedBuildBytes.deploymentReceipt.receipt.buildArtifact.files[0]!.contentHash = "0".repeat(64);
    const receipt = tamperedBuildBytes.deploymentReceipt.receipt;
    const { receiptHash: _receiptHash, ...receiptIdentity } = receipt;
    receipt.receiptHash = canonicalHash(receiptIdentity);
    tamperedBuildBytes.deploymentReceipt.ref = `setfarm://v3-deploy-receipts/${receipt.receiptHash}`;
  }
  seal(tamperedBuildBytes);
  assert.throws(() => parseRunOperationalSnapshotV1(tamperedBuildBytes));

  const foreignListener = structuredClone(snapshot);
  if (foreignListener.deploymentReceipt) {
    foreignListener.deploymentReceipt.receipt.health.listenerOwnership.ownerProcess.pid = 8123;
    foreignListener.deploymentReceipt.receipt.health.listenerOwnership.ownerProcess.processGroupId = 8123;
    foreignListener.deploymentReceipt.receipt.health.listenerOwnership.listenerPids = [8123];
    foreignListener.deploymentReceipt.receipt.health.listenerOwnership.listenerProcesses = [{
      schema: "setfarm.process-identity.v1",
      pid: 8123,
      processStartedAt: "2026-07-13T11:59:45.000Z",
      processGroupId: 8123,
      source: "observed_os",
    }];
    const receipt = foreignListener.deploymentReceipt.receipt;
    const { receiptHash: _receiptHash, ...receiptIdentity } = receipt;
    receipt.receiptHash = canonicalHash(receiptIdentity);
    foreignListener.deploymentReceipt.ref = `setfarm://v3-deploy-receipts/${receipt.receiptHash}`;
  }
  seal(foreignListener);
  assert.throws(() => parseRunOperationalSnapshotV1(foreignListener));

  const manifestHashMismatch = structuredClone(snapshot);
  if (manifestHashMismatch.deploymentReceipt) {
    const receipt = manifestHashMismatch.deploymentReceipt.receipt;
    receipt.health.sealedRuntimeManifestHash = "f".repeat(64);
    const { receiptHash: _receiptHash, ...receiptIdentity } = receipt;
    receipt.receiptHash = canonicalHash(receiptIdentity);
    manifestHashMismatch.deploymentReceipt.ref = `setfarm://v3-deploy-receipts/${receipt.receiptHash}`;
  }
  seal(manifestHashMismatch);
  assert.throws(() => parseRunOperationalSnapshotV1(manifestHashMismatch));

  const manifestEvidenceRefMismatch = structuredClone(snapshot);
  if (manifestEvidenceRefMismatch.deploymentReceipt) {
    const receipt = manifestEvidenceRefMismatch.deploymentReceipt.receipt;
    receipt.runtime.sealedRuntimeManifestEvidenceRef = "setfarm://deploy/sealed-runtime-manifest/wrong";
    receipt.health.sealedRuntimeManifestEvidenceRef = "setfarm://deploy/sealed-runtime-manifest/wrong";
    const { receiptHash: _receiptHash, ...receiptIdentity } = receipt;
    receipt.receiptHash = canonicalHash(receiptIdentity);
    manifestEvidenceRefMismatch.deploymentReceipt.ref = `setfarm://v3-deploy-receipts/${receipt.receiptHash}`;
  }
  seal(manifestEvidenceRefMismatch);
  assert.throws(() => parseRunOperationalSnapshotV1(manifestEvidenceRefMismatch));

  const missingManifestField = structuredClone(snapshot) as unknown as {
    deploymentReceipt: { receipt: { runtime: { sealedRuntimeManifestHash?: string } } };
  };
  delete missingManifestField.deploymentReceipt.receipt.runtime.sealedRuntimeManifestHash;
  seal(missingManifestField as unknown as RunOperationalSnapshotV1);
  assert.throws(() => parseRunOperationalSnapshotV1(missingManifestField));

  const missingCapability = structuredClone(snapshot);
  missingCapability.source.capabilities.deploymentReceipt = false;
  seal(missingCapability);
  assert.throws(() => parseRunOperationalSnapshotV1(missingCapability));
});

test("Setfarm strict deploy receipt wire fixture crosses into Mission Control without field loss", () => {
  const wireSnapshot = deploymentReceiptProjectionFixture();
  const wireReceipt = wireSnapshot.deploymentReceipt?.receipt;
  assert.ok(wireReceipt);
  const parsedReceipt = parseRunOperationalSnapshotV1(wireSnapshot).deploymentReceipt?.receipt;
  assert.deepEqual(parsedReceipt, wireReceipt);
  assert.deepEqual(Object.keys(parsedReceipt!.runtime).sort(), [
    "buildArtifactEvidenceRef", "buildArtifactHash", "deployUrl", "evidenceRef", "healthUrl", "host",
    "mode", "port", "projectId", "runtimeDataContractHash", "runtimeIsolation", "schema",
    "sealAuthorityEvidenceRef", "sealAuthorityHash", "sealedRuntimeManifestEvidenceRef",
    "sealedRuntimeManifestHash", "sealedRuntimeRef", "serviceId", "volumeProvisioning",
  ].sort());
  assert.deepEqual(Object.keys(parsedReceipt!.runtime.runtimeIsolation).sort(), [
    "adapterId", "adapterVersion", "authorityHash", "buildArtifactHash", "candidateHash", "evidenceRef",
    "policyHash", "profileHash", "projectId", "runId", "runtimeDataContractHash", "schema",
    "volumeProvisioningHash", "wrapperArtifactHash",
  ].sort());
  assert.deepEqual(Object.keys(parsedReceipt!.runtime.volumeProvisioning).sort(), [
    "evidenceRef", "projectId", "runId", "runtimeDataContractHash", "schema", "scratch",
    "volumeProvisioningHash", "writableVolumes",
  ].sort());
  assert.deepEqual(Object.keys(parsedReceipt!.health).sort(), [
    "buildArtifactEvidenceRef", "buildArtifactHash", "checkedAt", "evidenceRef", "httpStatus",
    "listenerOwnership", "runtimeIsolation", "schema", "sealedRuntimeManifestEvidenceRef",
    "sealedRuntimeManifestHash", "status",
  ].sort());
});

test("project transfer acknowledgement binds the exact terminal candidate, receipt, projection, and persisted record", () => {
  const snapshot = projectTransferAckProjectionFixture();
  const parsed = parseRunOperationalSnapshotV1(snapshot);
  assert.equal(parsed.projectTransferAck?.acknowledgement.projectId, parsed.deploymentReceipt?.receipt.project.projectId);
  assert.equal(parsed.projectTransferAck?.acknowledgement.projectProjection.runNumber, snapshot.run.runNumber);

  const tamperedProjection = structuredClone(snapshot);
  if (tamperedProjection.projectTransferAck) {
    tamperedProjection.projectTransferAck.acknowledgement.projectProjection.service = "process:forged";
  }
  seal(tamperedProjection);
  assert.throws(() => parseRunOperationalSnapshotV1(tamperedProjection));

  const tamperedAck = structuredClone(snapshot);
  if (tamperedAck.projectTransferAck) tamperedAck.projectTransferAck.acknowledgement.ackHash = "f".repeat(64);
  seal(tamperedAck);
  assert.throws(() => parseRunOperationalSnapshotV1(tamperedAck));

  const nonTerminal = structuredClone(snapshot);
  nonTerminal.run.status = "running";
  nonTerminal.run.terminal = false;
  seal(nonTerminal);
  assert.throws(() => parseRunOperationalSnapshotV1(nonTerminal));
});

test("snapshot digest binds canonical state but excludes polling clock fields", () => {
  const snapshot = snapshotFixture();
  const changedClock = structuredClone(snapshot);
  changedClock.generatedAt = "2026-07-13T12:01:00.000Z";
  assert.equal(changedClock.snapshotHash, snapshot.snapshotHash);
  assert.doesNotThrow(() => parseRunOperationalSnapshotV1(changedClock));

  const tamperedState = structuredClone(snapshot);
  tamperedState.run.status = "completed";
  assert.throws(() => parseRunOperationalSnapshotV1(tamperedState));
});

test("core projection verifies canonical row references and recomputed summary counters", () => {
  const snapshot = snapshotFixture();
  snapshot.claims = [{
    ref: "setfarm://claim-log/42",
    id: "42",
    runRef: snapshot.run.ref,
    stepRef: `${snapshot.run.ref}/step/implement`,
    storyRef: `${snapshot.run.ref}/story/US-001`,
    workflowStepId: "implement",
    storyId: "US-001",
    agentId: "feature-dev_implement",
    state: "open",
    outcome: null,
    claimedAt: "2026-07-13T11:59:00.000Z",
    abandonedAt: null,
  }];
  snapshot.summary.activeClaims = 1;
  seal(snapshot);
  assert.doesNotThrow(() => parseRunOperationalSnapshotV1(snapshot));

  const wrongReference = structuredClone(snapshot);
  wrongReference.claims[0]!.runRef = "setfarm://run/stale-run";
  seal(wrongReference);
  assert.throws(() => parseRunOperationalSnapshotV1(wrongReference));

  const wrongSummary = structuredClone(snapshot);
  wrongSummary.summary.activeClaims = 0;
  seal(wrongSummary);
  assert.throws(() => parseRunOperationalSnapshotV1(wrongSummary));
});

test("optional recovery projections fail closed when capability, completeness, or exact product identity disagrees", () => {
  const missingCapability = recoveryProjectionFixture();
  delete (missingCapability.source.capabilities as Partial<typeof missingCapability.source.capabilities>).findingRecovery;
  assert.throws(() => parseRunOperationalSnapshotV1(missingCapability));

  const incomplete = recoveryProjectionFixture();
  delete incomplete.recoveryDispatches;
  seal(incomplete);
  assert.throws(() => parseRunOperationalSnapshotV1(incomplete));

  const mismatched = recoveryProjectionFixture();
  if (mismatched.recoveryCases) mismatched.recoveryCases[0].packetHash = "9".repeat(64);
  seal(mismatched);
  assert.throws(() => parseRunOperationalSnapshotV1(mismatched));

  const proseOwner = recoveryProjectionFixture() as unknown as { recoveryCases: Array<{ owner: string }> };
  proseOwner.recoveryCases[0].owner = "agent says supervisor fixed it";
  seal(proseOwner as unknown as RunOperationalSnapshotV1);
  assert.throws(() => parseRunOperationalSnapshotV1(proseOwner));
});

test("rejects a complete v1 projection that omits either canonical ledger capability", () => {
  const oldFiveCapabilityPayload = snapshotFixture() as unknown as {
    source: { projection: string; capabilities: Record<string, boolean> };
  };
  oldFiveCapabilityPayload.source.projection = "complete";
  delete oldFiveCapabilityPayload.source.capabilities.findingRecovery;
  delete oldFiveCapabilityPayload.source.capabilities.evidenceLedger;
  assert.throws(() => parseRunOperationalSnapshotV1(oldFiveCapabilityPayload));
});

test("terminal recovery consumes the canonical lowercase terminal reason enum", () => {
  const snapshot = recoveryProjectionFixture();
  if (!snapshot.recoveryCases) throw new Error("fixture recovery case missing");
  snapshot.recoveryCases[0].status = "blocked";
  snapshot.recoveryCases[0].terminalReasonCode = "budget_exhausted";
  seal(snapshot);
  assert.equal(parseRunOperationalSnapshotV1(snapshot).recoveryCases?.[0].terminalReasonCode, "budget_exhausted");

  const malformed = recoveryProjectionFixture() as unknown as { recoveryCases: Array<{ status: string; terminalReasonCode: string }> };
  malformed.recoveryCases[0].status = "blocked";
  malformed.recoveryCases[0].terminalReasonCode = "agent_says_budget_exhausted";
  seal(malformed as unknown as RunOperationalSnapshotV1);
  assert.throws(() => parseRunOperationalSnapshotV1(malformed));
});

test("delivery projection requires exact revision, attempt, lease, and machine terminal state", () => {
  const snapshot = recoveryProjectionFixture();
  const delivery = snapshot.recoveryDispatches?.[0];
  if (!delivery) throw new Error("fixture recovery delivery missing");
  delivery.deliveryState = "failed";
  delivery.attemptRef = "setfarm://execution-attempt/ATT_0000000000000001";
  delivery.attemptId = "ATT_0000000000000001";
  delivery.claimRef = "setfarm://claim-log/42";
  delivery.executionSliceHash = "7".repeat(64);
  delivery.attemptCount = 1;
  delivery.leaseOwnerInstanceId = "recovery-worker";
  delivery.leaseExpiresAt = "2026-07-13T12:05:00.000Z";
  delivery.terminalReasonCode = "verification_failed";
  delivery.terminalAt = "2026-07-13T12:01:00.000Z";
  seal(snapshot);
  const parsed = parseRunOperationalSnapshotV1(snapshot);
  assert.equal(parsed.recoveryDispatches?.[0].attemptId, "ATT_0000000000000001");
  assert.equal(parsed.recoveryDispatches?.[0].terminalReasonCode, "verification_failed");

  const proseReason = structuredClone(snapshot);
  if (proseReason.recoveryDispatches) proseReason.recoveryDispatches[0].terminalReasonCode = "agent says verification failed";
  seal(proseReason);
  assert.throws(() => parseRunOperationalSnapshotV1(proseReason));

  const missingLease = structuredClone(snapshot);
  if (missingLease.recoveryDispatches) missingLease.recoveryDispatches[0].leaseExpiresAt = null;
  seal(missingLease);
  assert.throws(() => parseRunOperationalSnapshotV1(missingLease));
});

test("client returns a valid partial snapshot byte-structure without enrichment", async () => {
  const snapshot = snapshotFixture();
  const client = new SetfarmOperationalSnapshotClient({
    baseUrl: "http://setfarm.invalid",
    fetchImpl: async () => jsonResponse(snapshot),
  });

  const result = await client.get("run/with spaces");
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.deepEqual(result.snapshot, snapshot);
  assert.deepEqual(result.snapshot.source.capabilities, snapshot.source.capabilities);

  const http = toOperationalSnapshotHttpResult(result);
  assert.equal(http.statusCode, 200);
  assert.equal(http.body, result.snapshot);
});

test("client reads strict v2 and unknown schema fails closed without inferred legacy state", async () => {
  const v2 = snapshotV2Fixture();
  const v2Client = new SetfarmOperationalSnapshotClient({ fetchImpl: async () => jsonResponse(v2) });
  const v2Result = await v2Client.get(v2.run.id);
  assert.equal(v2Result.status, "ok");
  if (v2Result.status === "ok") assert.deepEqual(v2Result.snapshot, v2);

  const client = new SetfarmOperationalSnapshotClient({
    fetchImpl: async () => jsonResponse({ schema: "setfarm.run-operational-snapshot.v3", narrative: "completed" }),
  });

  const result = await client.get("run-1");
  assert.deepEqual(result, { status: "unsupported_schema", schema: "setfarm.run-operational-snapshot.v3" });
  assert.deepEqual(toOperationalSnapshotHttpResult(result), {
    statusCode: 501,
    body: {
      status: "unsupported_schema",
      code: "SETFARM_OPERATIONAL_SNAPSHOT_UNSUPPORTED_SCHEMA",
      schema: "setfarm.run-operational-snapshot.v3",
    },
  });
});

test("known but malformed v1 payload is a distinct upstream error", async () => {
  const malformed = { ...snapshotFixture(), summary: { ...snapshotFixture().summary, activeClaims: -1 } };
  const client = new SetfarmOperationalSnapshotClient({ fetchImpl: async () => jsonResponse(malformed) });

  const result = await client.get("run-1");
  assert.deepEqual(result, { status: "upstream_error", reason: "invalid_payload", upstreamStatus: 200 });
  assert.equal(toOperationalSnapshotHttpResult(result).statusCode, 502);
});

test("not-found, upstream HTTP failure, and transport failure remain distinct", async () => {
  const notFound = new SetfarmOperationalSnapshotClient({ fetchImpl: async () => jsonResponse({ error: "not found" }, 404) });
  const upstream = new SetfarmOperationalSnapshotClient({ fetchImpl: async () => jsonResponse({ secret: "must-not-leak" }, 500) });
  const unavailable = new SetfarmOperationalSnapshotClient({ fetchImpl: async () => { throw new Error("credential=secret"); } });

  const notFoundResult = await notFound.get("missing");
  const upstreamResult = await upstream.get("run-1");
  const unavailableResult = await unavailable.get("run-1");

  assert.deepEqual(notFoundResult, { status: "unavailable", reason: "not_found", upstreamStatus: 404 });
  assert.deepEqual(upstreamResult, { status: "upstream_error", reason: "http_error", upstreamStatus: 500 });
  assert.deepEqual(unavailableResult, { status: "unavailable", reason: "network" });
  assert.doesNotMatch(JSON.stringify(toOperationalSnapshotHttpResult(upstreamResult)), /secret/);
  assert.doesNotMatch(JSON.stringify(toOperationalSnapshotHttpResult(unavailableResult)), /credential/);
});

test("circuit breaker bounds repeated transport calls and half-opens after cooldown", async () => {
  let now = 1_000;
  let calls = 0;
  let healthy = false;
  const client = new SetfarmOperationalSnapshotClient({
    failureThreshold: 2,
    resetAfterMs: 100,
    now: () => now,
    fetchImpl: async () => {
      calls += 1;
      if (!healthy) throw new Error("offline");
      return jsonResponse(snapshotFixture());
    },
  });

  assert.equal((await client.get("run-1")).status, "unavailable");
  assert.equal((await client.get("run-1")).status, "unavailable");
  assert.deepEqual(await client.get("run-1"), { status: "unavailable", reason: "circuit_open" });
  assert.equal(calls, 2);

  now += 101;
  healthy = true;
  assert.equal((await client.get("run-1")).status, "ok");
  assert.equal(calls, 3);
});

test("request timeout is bounded and classified without exposing abort internals", async () => {
  const client = new SetfarmOperationalSnapshotClient({
    timeoutMs: 5,
    fetchImpl: async (_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }),
  });

  assert.deepEqual(await client.get("run-1"), { status: "unavailable", reason: "timeout" });
});

test("timeout remains active while the upstream response body is being read", async () => {
  const client = new SetfarmOperationalSnapshotClient({
    timeoutMs: 5,
    fetchImpl: async (_url, init) => ({
      ok: true,
      status: 200,
      json: () => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      }),
    }) as Response,
  });

  assert.deepEqual(await client.get("run-1"), { status: "unavailable", reason: "timeout" });
});
