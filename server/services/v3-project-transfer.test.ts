import assert from "node:assert/strict";
import test from "node:test";

import {
  buildV3CanonicalProjectProjection,
  evaluateV3ProjectTransfer,
  isV3RunProtocol,
  transferV3ProjectToCanonicalStore,
  upsertV3CanonicalProjectProjection,
} from "./v3-project-transfer.js";
import { createV3ProjectTransferAckV1, hashCanonicalJson } from "./v3-project-transfer-ack.js";
import { coordinateV3ProjectTransfer } from "./v3-project-transfer-coordinator.js";
import type { OperationalSnapshotFetchResult } from "./setfarm-operational-snapshot.js";

function snapshotResult() {
  const candidateHash = "a".repeat(64);
  const buildArtifactHash = "5".repeat(64);
  const sealedRuntimeManifestHash = "0".repeat(64);
  const sealedRuntimeManifestEvidenceRef = `setfarm://deploy/sealed-runtime-manifest/run-1/${candidateHash}/${buildArtifactHash}/${sealedRuntimeManifestHash}`;
  const runtimeProjectId = `prod-ledger-${candidateHash.slice(0, 12)}`;
  const runtimeDataContractHash = "8".repeat(64);
  const volumeProvisioningIdentity = {
    schema: "setfarm.v3-runtime-volume-provisioning.v1" as const,
    runId: "run-1",
    projectId: runtimeProjectId,
    runtimeDataContractHash,
    writableVolumes: [],
    scratch: { kind: "none" as const },
  };
  const volumeProvisioningHash = hashCanonicalJson(volumeProvisioningIdentity);
  const runtimeIsolationIdentity = {
    schema: "setfarm.v3-runtime-isolation-authority.v1" as const,
    adapterId: "darwin-sandbox-exec" as const,
    adapterVersion: "1.0.0" as const,
    runId: "run-1",
    projectId: runtimeProjectId,
    candidateHash,
    buildArtifactHash,
    policyHash: "6".repeat(64),
    profileHash: "9".repeat(64),
    wrapperArtifactHash: "7".repeat(64),
    runtimeDataContractHash,
    volumeProvisioningHash,
  };
  const runtimeIsolationAuthorityHash = hashCanonicalJson(runtimeIsolationIdentity);
  const runtimeIsolationEvidenceRef = `setfarm://deploy/runtime-isolation/run-1/${candidateHash}/${buildArtifactHash}/${runtimeIsolationAuthorityHash}`;
  const sealAuthorityHash = "1".repeat(64);
  const sealAuthorityEvidenceRef = `setfarm://deploy/seal-authority/run-1/${candidateHash}/${buildArtifactHash}/${sealAuthorityHash}`;
  const ownerProcess = {
    schema: "setfarm.process-identity.v1" as const,
    pid: 7123,
    processStartedAt: "2026-07-13T11:58:55.000Z",
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
    challengedAt: "2026-07-13T11:59:00.000Z",
  };
  return {
    status: "ok" as const,
    snapshot: {
      schema: "setfarm.run-operational-snapshot.v1" as const,
      generatedAt: "2026-07-13T12:00:00.000Z",
      snapshotHash: "b".repeat(64),
      source: {
        database: "postgres" as const,
        projection: "complete" as const,
        migrationVersions: [13],
        verifiedReleaseSha: "c".repeat(40),
        capabilities: {
          attempts: true,
          claimBinding: true,
          runtimeOwnership: true,
          managerCompletion: true,
          effectLedger: true,
          findingRecovery: true,
          evidenceLedger: true,
          acceptedCandidate: true,
          deploymentReceipt: true,
          projectTransferAck: true,
        },
      },
      run: {
        ref: "setfarm://run/run-1",
        id: "run-1",
        runNumber: 1,
        protocol: "v3" as const,
        status: "completed",
        terminal: true,
        updatedAt: "2026-07-13T12:00:00.000Z",
      },
      summary: {
        lifecycleState: "terminal" as const,
        health: "ok" as const,
        activeClaims: 0,
        activeAttempts: 0,
        activeRuntimes: 0,
        openCompletions: 0,
        mandatoryEffectsPending: 0,
        unpublishedOutbox: 0,
        invariantViolations: 0,
        operatorActions: {
          stop: { allowed: false, reasonCode: "RUN_ALREADY_TERMINAL", stateHash: "c".repeat(64) },
          resume: { allowed: false, reasonCode: "RUN_ALREADY_TERMINAL", stateHash: "d".repeat(64) },
        },
      },
      claims: [], attempts: [], runtimeSessions: [], completionRequests: [],
      terminationRequests: [], outbox: [], invariants: [],
      findingSets: [], evidenceBundles: [], recoveryCases: [], recoveryDispatches: [],
      acceptedCandidate: {
        ref: `setfarm://accepted-candidate/${candidateHash}`,
        candidate: {
          schema: "setfarm.accepted-candidate.v1" as const,
          runId: "run-1",
          packetHash: "d".repeat(64),
          storyPlanHash: "e".repeat(64),
          sourceRevision: { sha: "f".repeat(40), treeHash: "1".repeat(64) },
          storyEvidence: [{
            storyId: "US-001",
            attemptId: "ATT_00000000-0000-0000-0000-000000000777",
            sliceHash: "2".repeat(64),
            evidencePlanHash: "3".repeat(64),
            evidencePlanArtifactHash: "4".repeat(64),
            evidenceBundleHash: "5".repeat(64),
            evidenceId: `EVB_${"6".repeat(64)}`,
            predicateRefs: ["EVID_SAVE_RELOAD"],
          }],
          integrationEvidenceHash: "7".repeat(64),
          acceptor: {
            id: "setfarm-final-tree-acceptor" as const,
            version: "1.0.0" as const,
            codeSha: "8".repeat(40),
            environmentHash: "9".repeat(64),
          },
          candidateId: `ACPT_${candidateHash}`,
          candidateHash,
        },
        createdAt: "2026-07-13T12:00:00.000Z",
      },
      deploymentReceipt: {
        ref: `setfarm://v3-deploy-receipts/${"2".repeat(64)}`,
        receipt: {
          schema: "setfarm.v3-deploy-receipt.v1" as const,
          runId: "run-1",
          candidateId: `ACPT_${candidateHash}`,
          candidateHash,
          packetHash: "d".repeat(64),
          project: {
            schema: "setfarm.v3-deploy-project.v1" as const,
            productId: "PROD_LEDGER",
            projectId: `prod-ledger-${candidateHash.slice(0, 12)}`,
            displayName: "Canonical Ledger",
            summary: "Track exact operational evidence.",
          },
          stack: {
            schema: "setfarm.v3-deploy-stack.v1" as const,
            stackPackId: "vite-react",
            stackPackVersion: "1.0.0",
            stackPackContentHash: "3".repeat(64),
            platform: "web" as const,
            techStack: "vite-react" as const,
          },
          buildCommandId: "CMD_BUILD",
          previewCommandId: "CMD_PREVIEW",
          sourceBefore: { sha: "f".repeat(40), treeHash: "1".repeat(64) },
          sourceAfter: { sha: "f".repeat(40), treeHash: "1".repeat(64) },
          buildArtifact: {
            schema: "setfarm.v3-build-artifact.v1" as const,
            outputPaths: ["dist"],
            files: [{
              path: "dist/index.html",
              byteLength: 14,
              contentHash: "4".repeat(64),
              executable: false,
            }],
            totalBytes: 14,
            artifactHash: buildArtifactHash,
            evidenceRef: `setfarm://deploy/build-artifact/run-1/${buildArtifactHash}`,
          },
          runtime: {
            schema: "setfarm.v3-runtime-deployment.v1" as const,
            mode: "local" as const,
            projectId: `prod-ledger-${candidateHash.slice(0, 12)}`,
            serviceId: "process:7123",
            host: "127.0.0.1",
            port: 4123,
            healthUrl: "http://127.0.0.1:4123/",
            deployUrl: "http://127.0.0.1:4123/",
            evidenceRef: `setfarm://deploy/runtime/run-1/${runtimeProjectId}`,
            buildArtifactHash,
            buildArtifactEvidenceRef: `setfarm://deploy/build-artifact/run-1/${buildArtifactHash}`,
            sealedRuntimeRef: `setfarm://deploy/sealed-runtime/run-1/${candidateHash}/${buildArtifactHash}`,
            sealedRuntimeManifestHash,
            sealedRuntimeManifestEvidenceRef,
            sealAuthorityHash,
            sealAuthorityEvidenceRef,
            runtimeDataContractHash,
            volumeProvisioning: {
              ...volumeProvisioningIdentity,
              volumeProvisioningHash,
              evidenceRef: `setfarm://deploy/runtime-volumes/run-1/${runtimeProjectId}/${volumeProvisioningHash}`,
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
            checkedAt: "2026-07-13T11:59:00.000Z",
            evidenceRef: `setfarm://deploy/runtime/run-1/${runtimeProjectId}/health`,
            buildArtifactHash,
            buildArtifactEvidenceRef: `setfarm://deploy/build-artifact/run-1/${buildArtifactHash}`,
            sealedRuntimeManifestHash,
            sealedRuntimeManifestEvidenceRef,
            listenerOwnership: {
              schema: "setfarm.v3-listener-ownership.v1" as const,
              ownerProcess,
              listenerPids: [7123],
              listenerProcesses: [ownerProcess],
              host: "127.0.0.1",
              port: 4123,
              checkedAt: "2026-07-13T11:59:00.000Z",
              evidenceRef: `setfarm://deploy/runtime/run-1/${runtimeProjectId}/listener/7123`,
            },
            runtimeIsolation: {
              ...runtimeIsolationIdentity,
              schema: "setfarm.v3-runtime-isolation-proof.v1" as const,
              evidenceRef: runtimeIsolationEvidenceRef,
              authorityHash: runtimeIsolationAuthorityHash,
              challenge: {
                ...challengeIdentity,
                challengeHash: hashCanonicalJson(challengeIdentity),
              },
              checkedAt: "2026-07-13T11:59:00.000Z",
              checks: { runtimeIsolation: "pass" as const },
            },
          },
          terminalProjectProjection: {
            schema: "setfarm.v3-terminal-project-projection.v1" as const,
            owner: "mission-control-terminal-projector" as const,
            state: "pending_terminal_projection" as const,
            runId: "run-1",
            candidateHash,
            projectId: `prod-ledger-${candidateHash.slice(0, 12)}`,
            serviceId: "process:7123",
            port: 4123,
            healthUrl: "http://127.0.0.1:4123/",
            evidenceRef: "setfarm://run/run-1/deploy-receipt",
            buildArtifactHash,
          },
          environmentNames: [],
          completedAt: "2026-07-13T11:59:00.000Z",
          receiptHash: "2".repeat(64),
        },
        createdAt: "2026-07-13T11:59:00.000Z",
      },
      projectTransferAck: null,
    },
  };
}

test("authorizes v3 Projects transfer only from a complete invariant-free AcceptedCandidate snapshot", () => {
  const result = evaluateV3ProjectTransfer({
    run: { id: "run-1", status: "completed", protocol: "v3" },
    snapshotResult: snapshotResult(),
  });
  assert.equal(result.status, "authorized");
});

test("keeps pre-v19 snapshot v2 transfer independent from optional submission evidence", () => {
  const baseline = snapshotResult().snapshot;
  const preV19: OperationalSnapshotFetchResult = {
    status: "ok",
    snapshot: {
      ...baseline,
      schema: "setfarm.run-operational-snapshot.v2",
      source: {
        ...baseline.source,
        migrationVersions: [18],
        capabilities: {
          ...baseline.source.capabilities,
          implementationSubmissionEvidence: false,
        },
      },
      completionRequests: [],
    },
  };

  assert.equal(evaluateV3ProjectTransfer({
    run: { id: "run-1", status: "completed", protocol: "v3" },
    snapshotResult: preV19,
  }).status, "authorized");
});

test("blocks failed v3 runs and missing candidates instead of using generated dist files", () => {
  assert.deepEqual(evaluateV3ProjectTransfer({
    run: { id: "run-1", status: "failed", protocol: "v3" },
    snapshotResult: snapshotResult(),
  }), { status: "blocked", code: "V3_PROJECT_TRANSFER_RUN_NOT_COMPLETED" });
  assert.deepEqual(evaluateV3ProjectTransfer({
    run: { id: "run-1", status: "cancelled", protocol: "v3" },
    snapshotResult: snapshotResult(),
  }), { status: "blocked", code: "V3_PROJECT_TRANSFER_RUN_NOT_COMPLETED" });
  assert.deepEqual(evaluateV3ProjectTransfer({
    run: { id: "run-1", status: "running", protocol: "v3" },
    snapshotResult: snapshotResult(),
  }), { status: "blocked", code: "V3_PROJECT_TRANSFER_RUN_NOT_COMPLETED" });
  assert.equal(isV3RunProtocol({ context: JSON.stringify({ product_compiler_mode: "v3" }), status: "running" }), true);

  const missing = snapshotResult();
  missing.snapshot.acceptedCandidate = null as never;
  assert.deepEqual(evaluateV3ProjectTransfer({
    run: { id: "run-1", status: "completed", protocol: "v3" },
    snapshotResult: missing,
  }), { status: "blocked", code: "V3_PROJECT_TRANSFER_ACCEPTED_CANDIDATE_MISSING" });
});

test("blocks missing, tampered, and operationally-unsettled deployment authority", () => {
  const missing = snapshotResult();
  missing.snapshot.deploymentReceipt = null as never;
  assert.deepEqual(evaluateV3ProjectTransfer({
    run: { id: "run-1", status: "completed", protocol: "v3" },
    snapshotResult: missing,
  }), { status: "blocked", code: "V3_PROJECT_TRANSFER_DEPLOYMENT_RECEIPT_MISSING" });

  const tampered = snapshotResult();
  tampered.snapshot.deploymentReceipt.receipt.runtime.serviceId = "stale-same-name-service";
  assert.deepEqual(evaluateV3ProjectTransfer({
    run: { id: "run-1", status: "completed", protocol: "v3" },
    snapshotResult: tampered,
  }), { status: "blocked", code: "V3_PROJECT_TRANSFER_DEPLOYMENT_RECEIPT_MISMATCH" });

  const foreignListener = snapshotResult();
  foreignListener.snapshot.deploymentReceipt.receipt.health.listenerOwnership.ownerProcess.pid = 8123;
  foreignListener.snapshot.deploymentReceipt.receipt.health.listenerOwnership.ownerProcess.processGroupId = 8123;
  foreignListener.snapshot.deploymentReceipt.receipt.health.listenerOwnership.listenerProcesses = [{
    schema: "setfarm.process-identity.v1",
    pid: 8123,
    processStartedAt: "2026-07-13T11:58:55.000Z",
    processGroupId: 8123,
    source: "observed_os",
  }];
  assert.deepEqual(evaluateV3ProjectTransfer({
    run: { id: "run-1", status: "completed", protocol: "v3" },
    snapshotResult: foreignListener,
  }), { status: "blocked", code: "V3_PROJECT_TRANSFER_DEPLOYMENT_RECEIPT_MISMATCH" });

  const staleArtifact = snapshotResult();
  staleArtifact.snapshot.deploymentReceipt.receipt.runtime.buildArtifactHash = "0".repeat(64);
  assert.deepEqual(evaluateV3ProjectTransfer({
    run: { id: "run-1", status: "completed", protocol: "v3" },
    snapshotResult: staleArtifact,
  }), { status: "blocked", code: "V3_PROJECT_TRANSFER_DEPLOYMENT_RECEIPT_MISMATCH" });

  const manifestMismatch = snapshotResult();
  manifestMismatch.snapshot.deploymentReceipt.receipt.health.sealedRuntimeManifestHash = "9".repeat(64);
  assert.deepEqual(evaluateV3ProjectTransfer({
    run: { id: "run-1", status: "completed", protocol: "v3" },
    snapshotResult: manifestMismatch,
  }), { status: "blocked", code: "V3_PROJECT_TRANSFER_DEPLOYMENT_RECEIPT_MISMATCH" });

  const unsettled = snapshotResult();
  unsettled.snapshot.summary.unpublishedOutbox = 1;
  assert.deepEqual(evaluateV3ProjectTransfer({
    run: { id: "run-1", status: "completed", protocol: "v3" },
    snapshotResult: unsettled,
  }), { status: "blocked", code: "V3_PROJECT_TRANSFER_OPERATIONAL_STATE_UNSETTLED" });
});

test("missing, tampered, and stale v3 authority has zero Projects persistence side effects", () => {
  let persistenceCalls = 0;
  const persist = () => {
    persistenceCalls += 1;
    return { status: "created" as const, project: {} };
  };
  const run = { id: "run-1", status: "completed", protocol: "v3" };

  const missing = snapshotResult();
  missing.snapshot.deploymentReceipt = null as never;
  assert.equal(transferV3ProjectToCanonicalStore({ run, snapshotResult: missing, persist }).status, "blocked");

  const tampered = snapshotResult();
  tampered.snapshot.deploymentReceipt.receipt.sourceAfter.treeHash = "0".repeat(64);
  assert.equal(transferV3ProjectToCanonicalStore({ run, snapshotResult: tampered, persist }).status, "blocked");

  const stale = snapshotResult();
  stale.snapshot.run.id = "stale-run";
  assert.equal(transferV3ProjectToCanonicalStore({ run, snapshotResult: stale, persist }).status, "blocked");
  assert.equal(persistenceCalls, 0);

  const authorized = transferV3ProjectToCanonicalStore({
    run: { ...run, runNumber: 2025 },
    snapshotResult: snapshotResult(),
    persist,
  });
  assert.equal(authorized.status, "projected");
  assert.equal(persistenceCalls, 1);
  if (authorized.status === "projected") {
    assert.equal(authorized.projection.runNumber, 2025);
    assert.equal(authorized.projection.deploymentReceiptHash, "2".repeat(64));
  }
});

test("projects exact receipt identity without reusing a stale same-name service", () => {
  const authority = evaluateV3ProjectTransfer({
    run: { id: "run-1", status: "completed", protocol: "v3" },
    snapshotResult: snapshotResult(),
  });
  assert.equal(authority.status, "authorized");
  if (authority.status !== "authorized") throw new Error("fixture authority missing");
  const projection = buildV3CanonicalProjectProjection({ authority, runNumber: 2025 });
  const stale = {
    id: "canonical-ledger",
    name: projection.name,
    service: "stale-same-name-service",
    ports: { frontend: 3999 },
    createdBy: "legacy",
  };

  const created = upsertV3CanonicalProjectProjection([stale], projection, "2026-07-13T12:01:00.000Z");
  assert.equal(created.status, "created");
  assert.equal(created.projects.length, 2);
  assert.equal((created.project as any).id, projection.id);
  assert.equal((created.project as any).service, projection.service);
  assert.equal((created.project as any).ports.frontend, 4123);
  assert.equal((created.project as any).deployUrl, "http://127.0.0.1:4123/");
  assert.match((created.project as any).canonicalProjectionHash, /^[a-f0-9]{64}$/);
  assert.match((created.project as any).canonicalProjectRecordHash, /^[a-f0-9]{64}$/);
  assert.equal((created.project as any).canonicalProjectionPersistedAt, "2026-07-13T12:01:00.000Z");
  assert.equal((created.projects[0] as any).service, "stale-same-name-service");

  const replay = upsertV3CanonicalProjectProjection(created.projects, projection, "2026-07-13T12:02:00.000Z");
  assert.equal(replay.status, "unchanged");
  assert.equal(replay.projects.length, 2);
  assert.equal((replay.project as any).canonicalProjectionPersistedAt, "2026-07-13T12:01:00.000Z");
  assert.equal(
    (replay.project as any).canonicalProjectRecordHash,
    (created.project as any).canonicalProjectRecordHash,
  );

  const conflictingExactId = [{ ...stale, id: projection.id }];
  const conflict = upsertV3CanonicalProjectProjection(conflictingExactId, projection);
  assert.equal(conflict.status, "conflict");
  assert.equal(conflict.projects.length, 1);
});

test("keeps legacy transfer behavior outside the v3 authority boundary", () => {
  assert.deepEqual(evaluateV3ProjectTransfer({
    run: { id: "legacy-1", status: "failed", protocol: "legacy" },
    snapshotResult: { status: "unavailable", reason: "network" },
  }), { status: "not_v3" });
});

test("periodic replay reuses the already-bound exact ACK without a second callback", async () => {
  let projects: any[] = [];
  const persist = (projection: any) => {
    const result = upsertV3CanonicalProjectProjection(
      projects,
      projection,
      "2026-07-13T12:01:00.000Z",
    );
    if (result.status === "conflict") return result;
    projects = result.projects;
    return { status: result.status, project: result.project };
  };

  const preAck = snapshotResult();
  let published: ReturnType<typeof createV3ProjectTransferAckV1> | null = null;
  let publishCalls = 0;
  let readCalls = 0;
  const first = await coordinateV3ProjectTransfer({
    run: { id: "run-1", status: "completed", protocol: "v3", runNumber: 1 },
    snapshotReader: {
      async get() {
        readCalls += 1;
        if (!published) return preAck as any;
        const confirmed = snapshotResult();
        confirmed.snapshot.projectTransferAck = {
          ref: `setfarm://v3-project-transfer-acks/${published.ackHash}`,
          acknowledgement: published,
          createdAt: "2026-07-13T12:01:01.000Z",
        } as any;
        return confirmed as any;
      },
    },
    acknowledgementPublisher: {
      async publish(input) {
        publishCalls += 1;
        published = createV3ProjectTransferAckV1(input);
        return { status: "acknowledged" as const, acknowledgement: published };
      },
    },
    persist,
  });
  assert.equal(first.status, "synchronized");
  if (first.status !== "synchronized") throw new Error("first transfer failed");
  assert.equal(first.acknowledgementMode, "published");
  assert.equal(publishCalls, 1);
  assert.equal(readCalls, 2);
  assert.ok(published);
  const committedAck = first.acknowledgement;

  const postAck = snapshotResult();
  postAck.snapshot.snapshotHash = "0".repeat(64);
  postAck.snapshot.projectTransferAck = {
    ref: `setfarm://v3-project-transfer-acks/${committedAck.ackHash}`,
    acknowledgement: committedAck,
    createdAt: "2026-07-13T12:01:01.000Z",
  } as any;
  publishCalls = 0;
  readCalls = 0;
  const replay = await coordinateV3ProjectTransfer({
    run: { id: "run-1", status: "completed", protocol: "v3", runNumber: 1 },
    snapshotReader: {
      async get() {
        readCalls += 1;
        return postAck as any;
      },
    },
    acknowledgementPublisher: {
      async publish() {
        publishCalls += 1;
        throw new Error("already-bound ACK must not be republished");
      },
    },
    persist,
  });
  assert.equal(replay.status, "synchronized");
  if (replay.status !== "synchronized") throw new Error("replay failed");
  assert.equal(replay.acknowledgementMode, "existing");
  assert.equal(replay.acknowledgement.ackHash, committedAck.ackHash);
  assert.equal(publishCalls, 0);
  assert.equal(readCalls, 1);
});

test("ACK disaster replay rehydrates a lost project record with the exact ACK-bound identity", async () => {
  const authority = evaluateV3ProjectTransfer({
    run: { id: "run-1", status: "completed", protocol: "v3" },
    snapshotResult: snapshotResult(),
  });
  assert.equal(authority.status, "authorized");
  if (authority.status !== "authorized") throw new Error("fixture authority missing");
  const projection = buildV3CanonicalProjectProjection({ authority, runNumber: 1 });
  const original = upsertV3CanonicalProjectProjection([], projection, "2026-07-13T12:01:00.000Z");
  assert.equal(original.status, "created");
  const acknowledgement = createV3ProjectTransferAckV1({
    projection,
    sourceSnapshotHash: "b".repeat(64),
    projectRecord: original.project,
  });
  const postAck = snapshotResult();
  postAck.snapshot.snapshotHash = "0".repeat(64);
  postAck.snapshot.projectTransferAck = {
    ref: `setfarm://v3-project-transfer-acks/${acknowledgement.ackHash}`,
    acknowledgement,
    createdAt: "2026-07-13T12:01:01.000Z",
  } as any;

  let projects: any[] = [];
  let publishCalls = 0;
  let persistenceCalls = 0;
  const replay = await coordinateV3ProjectTransfer({
    run: { id: "run-1", status: "completed", protocol: "v3", runNumber: 1 },
    snapshotReader: { async get() { return postAck as any; } },
    acknowledgementPublisher: {
      async publish() {
        publishCalls += 1;
        throw new Error("immutable ACK replay must never republish");
      },
    },
    persist(candidate, rehydration) {
      persistenceCalls += 1;
      assert.equal(rehydration?.mode, "rehydrate_existing_ack");
      if (!rehydration) throw new Error("rehydration authority missing");
      const result = upsertV3CanonicalProjectProjection(
        projects,
        candidate,
        rehydration.persistedAt,
        rehydration,
      );
      if (result.status !== "conflict") projects = result.projects;
      return { status: result.status, project: result.project };
    },
  });

  assert.equal(replay.status, "synchronized");
  if (replay.status !== "synchronized") throw new Error("disaster replay failed");
  assert.equal(replay.acknowledgementMode, "existing");
  assert.equal(publishCalls, 0);
  assert.equal(persistenceCalls, 1);
  assert.equal(projects.length, 1);
  assert.equal(projects[0].canonicalProjectionPersistedAt, acknowledgement.persistedAt);
  assert.equal(projects[0].canonicalProjectionHash, acknowledgement.projectionHash);
  assert.equal(projects[0].canonicalProjectRecordHash, acknowledgement.projectRecordHash);
});

test("mismatched existing ACK quarantines replay before any project mutation", async () => {
  const postAck = snapshotResult();
  const authority = evaluateV3ProjectTransfer({
    run: { id: "run-1", status: "completed", protocol: "v3" },
    snapshotResult: postAck,
  });
  assert.equal(authority.status, "authorized");
  if (authority.status !== "authorized") throw new Error("fixture authority missing");
  const projection = buildV3CanonicalProjectProjection({ authority, runNumber: 1 });
  const original = upsertV3CanonicalProjectProjection([], projection, "2026-07-13T12:01:00.000Z");
  const acknowledgement = createV3ProjectTransferAckV1({
    projection,
    sourceSnapshotHash: "b".repeat(64),
    projectRecord: original.project,
  });
  postAck.snapshot.projectTransferAck = {
    ref: `setfarm://v3-project-transfer-acks/${acknowledgement.ackHash}`,
    acknowledgement: { ...acknowledgement, projectRecordHash: "9".repeat(64) },
    createdAt: "2026-07-13T12:01:01.000Z",
  } as any;
  let persistenceCalls = 0;
  let publishCalls = 0;
  const replay = await coordinateV3ProjectTransfer({
    run: { id: "run-1", status: "completed", protocol: "v3", runNumber: 1 },
    snapshotReader: { async get() { return postAck as any; } },
    acknowledgementPublisher: {
      async publish() {
        publishCalls += 1;
        return { status: "rejected", code: "unexpected" } as const;
      },
    },
    persist() {
      persistenceCalls += 1;
      return { status: "created", project: {} };
    },
  });
  assert.deepEqual(replay, { status: "skipped", code: "V3_PROJECT_TRANSFER_EXISTING_ACK_MISMATCH" });
  assert.equal(persistenceCalls, 0);
  assert.equal(publishCalls, 0);
});
