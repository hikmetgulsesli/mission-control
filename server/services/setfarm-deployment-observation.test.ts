import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  parseRunOperationalSnapshotV1,
  type RunOperationalSnapshotV1,
  type OperationalSnapshotFetchResult,
  type OperationalV3DeployReceiptV1,
} from "./setfarm-operational-snapshot.js";
import {
  CanonicalV3DeploymentObservationBatcher,
  SetfarmDeploymentObservationClient,
  V3_DEPLOYMENT_OBSERVATION_MAX_AGE_MS,
  evaluateSetfarmV3DeploymentObservation,
  observeCanonicalV3Deployment,
  parseSetfarmV3DeploymentObservation,
  type SetfarmV3DeploymentObservationV1,
} from "./setfarm-deployment-observation.js";
import { hashCanonicalJson } from "./v3-project-transfer-ack.js";

function vendoredFixture(fileName: string): unknown {
  const envelope = JSON.parse(readFileSync(
    new URL(`../../contracts/vendor/setfarm/${fileName}`, import.meta.url),
    "utf8",
  )) as { fixture?: unknown };
  if (envelope.fixture === undefined) throw new Error(`vendored fixture missing: ${fileName}`);
  return envelope.fixture;
}

const VENDORED_OBSERVATION = parseSetfarmV3DeploymentObservation(
  vendoredFixture("deployment-observation.v1.compatibility.json"),
);
const VENDORED_SNAPSHOT: RunOperationalSnapshotV1 = parseRunOperationalSnapshotV1(
  vendoredFixture("run-operational-snapshot.v1.compatibility.json"),
);
function vendoredReceipt(): OperationalV3DeployReceiptV1 {
  const receipt = VENDORED_SNAPSHOT.deploymentReceipt;
  if (!receipt) throw new Error("vendored deployment receipt fixture missing");
  return receipt;
}

const NOW_MS = Date.parse(VENDORED_OBSERVATION.observedAt) + 10_000;
const NOW = new Date(NOW_MS).toISOString();
const RUN_ID = VENDORED_OBSERVATION.runId;
const RECEIPT_HASH = VENDORED_OBSERVATION.deploymentReceiptHash;
const CANDIDATE_HASH = VENDORED_OBSERVATION.candidateHash;
const BUILD_ARTIFACT_HASH = VENDORED_OBSERVATION.buildArtifactHash;
const MANIFEST_HASH = VENDORED_OBSERVATION.sealedRuntimeManifestHash;
const PROJECT_ID = VENDORED_OBSERVATION.projectId;
const PORT = VENDORED_OBSERVATION.runtime.port;
const PROCESS_ID = VENDORED_OBSERVATION.listenerOwnership.ownerProcess.pid;
const PROCESS_STARTED_AT = VENDORED_OBSERVATION.listenerOwnership.ownerProcess.processStartedAt;
const OPERATIONAL_TOKEN = "t".repeat(32);

function processIdentity(pid = PROCESS_ID, startedAt = PROCESS_STARTED_AT) {
  return {
    schema: "setfarm.process-identity.v1" as const,
    pid,
    processStartedAt: startedAt,
    processGroupId: pid,
    source: "observed_os" as const,
  };
}

function receiptProjection(): OperationalV3DeployReceiptV1 {
  return structuredClone(vendoredReceipt());
}

function resealObservation(value: Omit<SetfarmV3DeploymentObservationV1, "observationHash"> & {
  observationHash?: string;
}, options: Readonly<{ syncRuntimeAuthority?: boolean }> = {}): SetfarmV3DeploymentObservationV1 {
  const candidate = structuredClone(value);
  const authorityIdentity = {
    schema: "setfarm.v3-runtime-isolation-authority.v1",
    adapterId: candidate.runtimeIsolation.adapterId,
    adapterVersion: candidate.runtimeIsolation.adapterVersion,
    runId: candidate.runtimeIsolation.runId,
    projectId: candidate.runtimeIsolation.projectId,
    candidateHash: candidate.runtimeIsolation.candidateHash,
    buildArtifactHash: candidate.runtimeIsolation.buildArtifactHash,
    policyHash: candidate.runtimeIsolation.policyHash,
    profileHash: candidate.runtimeIsolation.profileHash,
    wrapperArtifactHash: candidate.runtimeIsolation.wrapperArtifactHash,
    runtimeDataContractHash: candidate.runtimeIsolation.runtimeDataContractHash,
    volumeProvisioningHash: candidate.runtimeIsolation.volumeProvisioningHash,
  };
  candidate.runtimeIsolation.authorityHash = hashCanonicalJson(authorityIdentity);
  candidate.runtimeIsolation.evidenceRef = `setfarm://deploy/runtime-isolation/${candidate.runId}/${candidate.candidateHash}/${candidate.buildArtifactHash}/${candidate.runtimeIsolation.authorityHash}`;
  if (options.syncRuntimeAuthority) {
    const { challenge: _challenge, checkedAt: _checkedAt, checks: _checks, ...proofAuthority } = candidate.runtimeIsolation;
    candidate.runtime.runtimeIsolation = {
      ...proofAuthority,
      schema: "setfarm.v3-runtime-isolation-authority.v1",
    };
  }
  candidate.runtimeIsolation.challenge.authorityHash = candidate.runtimeIsolation.authorityHash;
  const { challengeHash: _challengeHash, ...challengeIdentity } = candidate.runtimeIsolation.challenge;
  candidate.runtimeIsolation.challenge.challengeHash = hashCanonicalJson(challengeIdentity);
  const { observationHash: _observationHash, evidenceRef: _evidenceRef, ...identity } = candidate;
  const observationHash = hashCanonicalJson(identity);
  if (options.syncRuntimeAuthority) {
    const checks = {
      runRuntime: candidate.runId === candidate.runtime.runtimeIsolation.runId,
      runProof: candidate.runId === candidate.runtimeIsolation.runId,
      project: candidate.projectId === candidate.runtime.projectId,
      candidateRuntime: candidate.candidateHash === candidate.runtime.runtimeIsolation.candidateHash,
      candidateProof: candidate.candidateHash === candidate.runtimeIsolation.candidateHash,
      buildRuntime: candidate.buildArtifactHash === candidate.runtime.buildArtifactHash,
      buildProof: candidate.buildArtifactHash === candidate.runtimeIsolation.buildArtifactHash,
      authority: candidate.runtime.runtimeIsolation.authorityHash === candidate.runtimeIsolation.authorityHash,
      manifestHash: candidate.sealedRuntimeManifestHash === candidate.runtime.sealedRuntimeManifestHash,
      manifestRef: candidate.sealedRuntimeManifestEvidenceRef === candidate.runtime.sealedRuntimeManifestEvidenceRef,
      sealHash: candidate.sealAuthorityHash === candidate.runtime.sealAuthorityHash,
      sealRef: candidate.sealAuthorityEvidenceRef === candidate.runtime.sealAuthorityEvidenceRef,
      runtimeData: candidate.runtime.runtimeDataContractHash === candidate.runtimeIsolation.runtimeDataContractHash,
      volume: candidate.runtime.volumeProvisioning.volumeProvisioningHash === candidate.runtimeIsolation.volumeProvisioningHash,
      service: candidate.runtime.serviceId === `process:${candidate.listenerOwnership.ownerProcess.pid}`,
      listenerHost: candidate.listenerOwnership.host === candidate.runtime.host,
      listenerPort: candidate.listenerOwnership.port === candidate.runtime.port,
      process: JSON.stringify(candidate.runtimeIsolation.challenge.wrapperProcessIdentity) === JSON.stringify(candidate.listenerOwnership.ownerProcess),
      listenerRef: candidate.listenerOwnership.evidenceRef === `setfarm://deploy/runtime/${candidate.runId}/${candidate.projectId}/listener/${candidate.listenerOwnership.ownerProcess.pid}`,
      stateRef: candidate.deploymentStateEvidenceRef === `setfarm://deploy/runtime-state/${candidate.runId}/${candidate.projectId}/${candidate.deploymentStateHash}`,
      leaseRef: candidate.leaseIdentityEvidenceRef === `setfarm://deploy/runtime-lease/${candidate.runId}/${candidate.projectId}/${candidate.leaseIdentityHash}`,
      httpRef: candidate.httpProof.evidenceRef === `setfarm://deploy/runtime/${candidate.runId}/${candidate.projectId}/http/${candidate.deploymentReceiptHash}`,
      httpUrl: candidate.httpProof.healthUrl === candidate.runtime.healthUrl,
    };
    const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
    if (failed.length > 0) throw new Error(`test fixture binding mismatch: ${failed.join(",")}`);
  }
  return parseSetfarmV3DeploymentObservation({
    ...identity,
    observationHash,
    evidenceRef: `setfarm://deploy/observation/${candidate.runId}/${candidate.deploymentReceiptHash}/${observationHash}`,
  });
}

function exactObservation(): SetfarmV3DeploymentObservationV1 {
  return structuredClone(VENDORED_OBSERVATION);
}

function evaluate(observation: SetfarmV3DeploymentObservationV1) {
  return evaluateSetfarmV3DeploymentObservation({
    receiptProjection: receiptProjection(),
    observationResult: { status: "ok", observation },
    nowMs: NOW_MS,
  });
}

test("strict observation proof activates only the exact receipt runtime identity", () => {
  const observation = exactObservation();
  assert.equal(evaluate(observation).status, "active");
  assert.equal(
    observation.observationHash,
    hashCanonicalJson((({ observationHash: _, evidenceRef: __, ...identity }) => identity)(observation)),
  );
  assert.throws(() => parseSetfarmV3DeploymentObservation({ ok: true }));
  assert.throws(() => parseSetfarmV3DeploymentObservation({ ...observation, prose: "service looks healthy" }));

  const packetDrift = structuredClone(observation);
  packetDrift.packetHash = "0".repeat(64);
  assert.equal(evaluate(resealObservation(packetDrift)).status, "unknown");

  const completionDrift = structuredClone(observation);
  completionDrift.receiptCompletedAt = new Date(Date.parse(completionDrift.receiptCompletedAt) - 1).toISOString();
  assert.equal(evaluate(resealObservation(completionDrift)).status, "unknown");

  const sealDrift = structuredClone(observation);
  sealDrift.sealAuthorityHash = "8".repeat(64);
  sealDrift.sealAuthorityEvidenceRef = `setfarm://deploy/seal-authority/${RUN_ID}/${CANDIDATE_HASH}/${BUILD_ARTIFACT_HASH}/${sealDrift.sealAuthorityHash}`;
  sealDrift.runtime.sealAuthorityHash = sealDrift.sealAuthorityHash;
  sealDrift.runtime.sealAuthorityEvidenceRef = sealDrift.sealAuthorityEvidenceRef;
  assert.equal(evaluate(resealObservation(sealDrift)).status, "unknown");
});

test("same-port foreign listener cannot make a dead receipt ACTIVE", () => {
  const foreign = structuredClone(exactObservation());
  const process = processIdentity(8123, "2026-07-14T12:00:00.000Z");
  foreign.runtime.serviceId = "process:8123";
  foreign.listenerOwnership.ownerProcess = process;
  foreign.listenerOwnership.listenerPids = [process.pid];
  foreign.listenerOwnership.listenerProcesses = [process];
  foreign.listenerOwnership.evidenceRef = `setfarm://deploy/runtime/${RUN_ID}/${PROJECT_ID}/listener/${process.pid}`;
  foreign.runtimeIsolation.challenge.wrapperProcessIdentity = process;
  const selfConsistentForeignProof = resealObservation(foreign);
  assert.equal(selfConsistentForeignProof.runtime.port, PORT);
  assert.deepEqual(evaluate(selfConsistentForeignProof), {
    status: "unknown",
    checkedAt: NOW,
    reasonCode: "V3_DEPLOYMENT_OBSERVATION_RECEIPT_IDENTITY_MISMATCH",
  });
});

test("PID reuse with a different process start time cannot make a dead receipt ACTIVE", () => {
  const reused = structuredClone(exactObservation());
  const process = processIdentity(PROCESS_ID, "2026-07-14T12:00:00.000Z");
  reused.listenerOwnership.ownerProcess = process;
  reused.listenerOwnership.listenerProcesses = [process];
  reused.runtimeIsolation.challenge.wrapperProcessIdentity = process;
  assert.equal(evaluate(resealObservation(reused)).status, "unknown");
});

test("listener or sealed-manifest drift fails closed even with a valid observation hash", () => {
  const listenerDrift = structuredClone(exactObservation());
  const worker = { ...processIdentity(), pid: 7124 };
  listenerDrift.listenerOwnership.listenerPids = [7124];
  listenerDrift.listenerOwnership.listenerProcesses = [worker];
  assert.throws(() => resealObservation(listenerDrift));

  const manifestDrift = structuredClone(exactObservation());
  manifestDrift.sealedRuntimeManifestHash = "9".repeat(64);
  manifestDrift.sealedRuntimeManifestEvidenceRef = `setfarm://deploy/sealed-runtime-manifest/${RUN_ID}/${CANDIDATE_HASH}/${BUILD_ARTIFACT_HASH}/${"9".repeat(64)}`;
  manifestDrift.runtime.sealedRuntimeManifestHash = manifestDrift.sealedRuntimeManifestHash;
  manifestDrift.runtime.sealedRuntimeManifestEvidenceRef = manifestDrift.sealedRuntimeManifestEvidenceRef;
  assert.equal(evaluate(resealObservation(manifestDrift)).status, "unknown");

  const isolationDrift = structuredClone(exactObservation());
  isolationDrift.runtimeIsolation.policyHash = "8".repeat(64);
  assert.throws(() => resealObservation(isolationDrift));

  const foreignWrapper = structuredClone(exactObservation());
  foreignWrapper.runtimeIsolation.challenge.wrapperProcessIdentity = processIdentity(8123);
  assert.throws(() => resealObservation(foreignWrapper));

  const incompleteChallenge = structuredClone(exactObservation());
  incompleteChallenge.runtimeIsolation.challenge.deniedRootProbes = [
    { rootId: "sealed-runtime", outcome: "denied" },
  ];
  assert.throws(() => resealObservation(incompleteChallenge));

  const emptyProbeNonemptyProvisioning = structuredClone(exactObservation());
  emptyProbeNonemptyProvisioning.runtimeIsolation.volumeProvisioningHash = "9".repeat(64);
  assert.throws(() => resealObservation(emptyProbeNonemptyProvisioning));

  assert.equal(evaluateSetfarmV3DeploymentObservation({
    receiptProjection: receiptProjection(),
    observationResult: { status: "ok", observation: exactObservation() },
    nowMs: Date.parse(exactObservation().observedAt) + V3_DEPLOYMENT_OBSERVATION_MAX_AGE_MS + 1,
  }).reasonCode, "V3_DEPLOYMENT_OBSERVATION_STALE");
});

test("isolation challenge requires exact sensitive-read and control-plane network denials", () => {
  const missingRead = structuredClone(exactObservation());
  missingRead.runtimeIsolation.challenge.deniedReadProbes.pop();
  assert.throws(() => resealObservation(missingRead), /deniedReadProbes:invalid_cardinality/);

  const reorderedReads = structuredClone(exactObservation());
  reorderedReads.runtimeIsolation.challenge.deniedReadProbes.reverse();
  assert.throws(() => resealObservation(reorderedReads), /deniedReadProbes:invalid_probe/);

  const missingAuthorityIsNotDenial = structuredClone(exactObservation());
  (missingAuthorityIsNotDenial.runtimeIsolation.challenge.deniedReadProbes[0] as { outcome: string }).outcome = "not_found";
  assert.throws(() => resealObservation(missingAuthorityIsNotDenial), /invalid_probe/);

  const missingNetwork = structuredClone(exactObservation());
  missingNetwork.runtimeIsolation.challenge.deniedNetworkProbes.pop();
  assert.throws(() => resealObservation(missingNetwork), /deniedNetworkProbes:invalid_cardinality/);

  const refusedConnectionIsNotDenial = structuredClone(exactObservation());
  (refusedConnectionIsNotDenial.runtimeIsolation.challenge.deniedNetworkProbes[0] as { outcome: string }).outcome = "connection_refused";
  assert.throws(() => resealObservation(refusedConnectionIsNotDenial), /invalid_probe/);

  const executableMissingIsNotDenial = structuredClone(exactObservation());
  (executableMissingIsNotDenial.runtimeIsolation.challenge.deniedProcessExecProbes[0] as { outcome: string }).outcome = "not_found";
  assert.throws(() => resealObservation(executableMissingIsNotDenial), /invalid_probe/);

  const signalMissingIsNotDenial = structuredClone(exactObservation());
  (signalMissingIsNotDenial.runtimeIsolation.challenge.deniedSignalProbes[0] as { outcome: string }).outcome = "process_missing";
  assert.throws(() => resealObservation(signalMissingIsNotDenial), /invalid_probe/);

  const invalidVolumeIdentity = structuredClone(exactObservation());
  invalidVolumeIdentity.runtimeIsolation.challenge.allowedVolumeProbes = [{
    volumeId: "uploads",
    outcome: "write_read_delete_pass",
  }];
  assert.throws(() => resealObservation(invalidVolumeIdentity), /invalid_probe/);
});

test("generic 2xx JSON and a missing Setfarm endpoint never become an observation proof", async () => {
  const generic = new SetfarmDeploymentObservationClient({
    baseUrl: "http://setfarm.invalid",
    token: OPERATIONAL_TOKEN,
    fetchImpl: (async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as typeof fetch,
  });
  assert.deepEqual(await generic.get(RUN_ID, RECEIPT_HASH), {
    status: "invalid",
    code: "V3_DEPLOYMENT_OBSERVATION_INVALID_PAYLOAD",
  });

  const missing = new SetfarmDeploymentObservationClient({
    baseUrl: "http://setfarm.invalid",
    token: OPERATIONAL_TOKEN,
    fetchImpl: (async () => new Response("not found", { status: 404 })) as typeof fetch,
  });
  assert.deepEqual(await missing.get(RUN_ID, RECEIPT_HASH), {
    status: "unavailable",
    code: "V3_DEPLOYMENT_OBSERVATION_ENDPOINT_UNAVAILABLE",
    upstreamStatus: 404,
  });
});

test("deployment observation requires and sends operational read authority", async () => {
  let fetchCalls = 0;
  const missingAuthority = new SetfarmDeploymentObservationClient({
    baseUrl: "http://setfarm.invalid",
    token: "",
    fetchImpl: (async () => {
      fetchCalls += 1;
      throw new Error("unauthenticated request must not leave Mission Control");
    }) as typeof fetch,
  });
  assert.deepEqual(await missingAuthority.get(RUN_ID, RECEIPT_HASH), {
    status: "unavailable",
    code: "V3_DEPLOYMENT_OBSERVATION_READ_AUTHORITY_UNAVAILABLE",
  });
  assert.equal(fetchCalls, 0);

  let observedToken = "";
  const authenticated = new SetfarmDeploymentObservationClient({
    baseUrl: "http://setfarm.invalid",
    token: OPERATIONAL_TOKEN,
    fetchImpl: (async (_url, init) => {
      observedToken = String((init?.headers as Record<string, string>)["x-setfarm-operational-token"]);
      return new Response(JSON.stringify(exactObservation()), { status: 200 });
    }) as typeof fetch,
  });
  assert.equal((await authenticated.get(RUN_ID, RECEIPT_HASH)).status, "ok");
  assert.equal(observedToken, OPERATIONAL_TOKEN);
});

test("canonical project observation requires both the strict snapshot receipt and live proof endpoint", async () => {
  const receipt = receiptProjection();
  const snapshotResult = {
    status: "ok",
    snapshot: { deploymentReceipt: receipt },
  } as OperationalSnapshotFetchResult;
  const project = {
    id: PROJECT_ID,
    workflowRunId: RUN_ID,
    deploymentReceiptHash: RECEIPT_HASH,
    acceptedCandidateHash: CANDIDATE_HASH,
    service: receipt.receipt.runtime.serviceId,
    ports: { frontend: PORT },
    deploymentHealthUrl: receipt.receipt.runtime.healthUrl,
  };
  const exact = await observeCanonicalV3Deployment({
    project,
    snapshotReader: { async get() { return snapshotResult; } },
    observationReader: { async get() { return { status: "ok", observation: exactObservation() }; } },
    now: () => NOW_MS,
  });
  assert.equal(exact.status, "active");

  const endpointMissing = await observeCanonicalV3Deployment({
    project,
    snapshotReader: { async get() { return snapshotResult; } },
    observationReader: {
      async get() {
        return { status: "unavailable", code: "V3_DEPLOYMENT_OBSERVATION_ENDPOINT_UNAVAILABLE" };
      },
    },
    now: () => NOW_MS,
  });
  assert.equal(endpointMissing.status, "unknown");
});

function batchFixture(index: number, observedAt: string) {
  const runId = `batch-run-${index}`;
  const projectId = `batch-project-${index}`;
  const receiptHash = String((index % 8) + 1).repeat(64);
  const port = 4200 + index;
  const pid = 7200 + index;
  const observation = structuredClone(exactObservation());
  observation.runId = runId;
  observation.deploymentReceiptHash = receiptHash;
  observation.receiptCompletedAt = vendoredReceipt().receipt.completedAt;
  observation.projectId = projectId;
  observation.runtime.projectId = projectId;
  observation.runtime.serviceId = `process:${pid}`;
  observation.runtime.port = port;
  observation.runtime.healthUrl = `http://127.0.0.1:${port}/`;
  observation.runtime.deployUrl = observation.runtime.healthUrl;
  observation.runtime.evidenceRef = `setfarm://deploy/runtime/${runId}/${projectId}`;
  observation.runtime.buildArtifactEvidenceRef = `setfarm://deploy/build-artifact/${runId}/${BUILD_ARTIFACT_HASH}`;
  observation.runtime.sealedRuntimeRef = `setfarm://deploy/sealed-runtime/${runId}/${CANDIDATE_HASH}/${BUILD_ARTIFACT_HASH}`;
  observation.runtime.sealedRuntimeManifestEvidenceRef = `setfarm://deploy/sealed-runtime-manifest/${runId}/${CANDIDATE_HASH}/${BUILD_ARTIFACT_HASH}/${MANIFEST_HASH}`;
  observation.runtime.sealAuthorityEvidenceRef = `setfarm://deploy/seal-authority/${runId}/${CANDIDATE_HASH}/${BUILD_ARTIFACT_HASH}/${observation.runtime.sealAuthorityHash}`;
  observation.sealedRuntimeManifestEvidenceRef = observation.runtime.sealedRuntimeManifestEvidenceRef;
  observation.sealAuthorityEvidenceRef = observation.runtime.sealAuthorityEvidenceRef;
  const volumeIdentity = {
    schema: "setfarm.v3-runtime-volume-provisioning.v1" as const,
    runId,
    projectId,
    runtimeDataContractHash: observation.runtime.runtimeDataContractHash,
    writableVolumes: [],
    scratch: { kind: "none" as const },
  };
  const volumeProvisioningHash = hashCanonicalJson(volumeIdentity);
  observation.runtime.volumeProvisioning = {
    ...volumeIdentity,
    volumeProvisioningHash,
    evidenceRef: `setfarm://deploy/runtime-volumes/${runId}/${projectId}/${volumeProvisioningHash}`,
  };
  observation.runtimeIsolation.runId = runId;
  observation.runtimeIsolation.projectId = projectId;
  observation.runtimeIsolation.volumeProvisioningHash = volumeProvisioningHash;
  observation.listenerOwnership.ownerProcess = processIdentity(pid);
  observation.listenerOwnership.listenerPids = [pid];
  observation.listenerOwnership.listenerProcesses = [processIdentity(pid)];
  observation.listenerOwnership.port = port;
  observation.listenerOwnership.evidenceRef = `setfarm://deploy/runtime/${runId}/${projectId}/listener/${pid}`;
  observation.listenerOwnership.checkedAt = observedAt;
  observation.runtimeIsolation.checkedAt = observedAt;
  observation.runtimeIsolation.challenge.wrapperProcessIdentity = processIdentity(pid);
  observation.runtimeIsolation.challenge.challengedAt = observedAt;
  observation.deploymentStateEvidenceRef = `setfarm://deploy/runtime-state/${runId}/${projectId}/${observation.deploymentStateHash}`;
  observation.leaseIdentityEvidenceRef = `setfarm://deploy/runtime-lease/${runId}/${projectId}/${observation.leaseIdentityHash}`;
  observation.httpProof.healthUrl = observation.runtime.healthUrl;
  observation.httpProof.checkedAt = observedAt;
  observation.httpProof.evidenceRef = `setfarm://deploy/runtime/${runId}/${projectId}/http/${receiptHash}`;
  observation.observedAt = observedAt;
  const sealedObservation = resealObservation(observation, { syncRuntimeAuthority: true });
  const receipt = structuredClone(receiptProjection()) as OperationalV3DeployReceiptV1;
  receipt.ref = `setfarm://v3-deploy-receipts/${receiptHash}`;
  receipt.receipt.runId = runId;
  receipt.receipt.receiptHash = receiptHash;
  receipt.receipt.completedAt = sealedObservation.receiptCompletedAt;
  receipt.receipt.project.projectId = projectId;
  receipt.receipt.runtime = structuredClone(sealedObservation.runtime);
  receipt.receipt.health.listenerOwnership = structuredClone(sealedObservation.listenerOwnership);
  receipt.receipt.health.runtimeIsolation = structuredClone(sealedObservation.runtimeIsolation);
  return {
    project: {
      id: projectId,
      workflowRunId: runId,
      deploymentReceiptHash: receiptHash,
      acceptedCandidateHash: CANDIDATE_HASH,
      service: `process:${pid}`,
      ports: { frontend: port },
    },
    snapshot: { status: "ok", snapshot: { deploymentReceipt: receipt } } as OperationalSnapshotFetchResult,
    observation: sealedObservation,
  };
}

test("batch observation bounds concurrency and returns UNKNOWN at one global deadline", async () => {
  const observedAt = new Date().toISOString();
  const fixtures = Array.from({ length: 7 }, (_, index) => batchFixture(index, observedAt));
  let activeSnapshotCalls = 0;
  let maxActiveSnapshotCalls = 0;
  let snapshotCalls = 0;
  let observationCalls = 0;
  const byRun = new Map(fixtures.map((fixture) => [fixture.project.workflowRunId, fixture]));
  const batcher = new CanonicalV3DeploymentObservationBatcher({
    deadlineMs: 40,
    concurrency: 2,
    snapshotReader: {
      async get(runId) {
        snapshotCalls += 1;
        activeSnapshotCalls += 1;
        maxActiveSnapshotCalls = Math.max(maxActiveSnapshotCalls, activeSnapshotCalls);
        if (runId === fixtures[0]!.project.workflowRunId) return new Promise(() => {});
        const fixture = byRun.get(runId)!;
        activeSnapshotCalls -= 1;
        return fixture.snapshot;
      },
    },
    observationReader: {
      async get(runId) {
        observationCalls += 1;
        return { status: "ok", observation: byRun.get(runId)!.observation };
      },
    },
  });
  const results = await batcher.observe(fixtures.map((fixture) => fixture.project));
  assert.equal(results[0]!.status, "unknown");
  assert.equal(results[0]!.reasonCode, "V3_DEPLOYMENT_OBSERVATION_GLOBAL_DEADLINE");
  assert.equal(results.slice(1).every((result) => result.status === "active"), true);
  assert.equal(snapshotCalls, 7);
  assert.equal(observationCalls, 7);
  assert.equal(maxActiveSnapshotCalls <= 2, true);
});

test("ACTIVE cache is keyed by immutable receipt identity and never outlives proof freshness", async () => {
  let nowMs = NOW_MS;
  const base = batchFixture(20, new Date(nowMs).toISOString());
  let snapshotCalls = 0;
  let observationCalls = 0;
  const batcher = new CanonicalV3DeploymentObservationBatcher({
    now: () => nowMs,
    deadlineMs: 100,
    activeCacheTtlMs: 20_000,
    snapshotReader: {
      async get() {
        snapshotCalls += 1;
        return base.snapshot;
      },
    },
    observationReader: {
      async get() {
        observationCalls += 1;
        return {
          status: "ok",
          observation: batchFixture(20, new Date(nowMs).toISOString()).observation,
        };
      },
    },
  });
  assert.equal((await batcher.observe([base.project]))[0]!.status, "active");
  nowMs += 4_000;
  assert.equal((await batcher.observe([base.project]))[0]!.status, "active");
  assert.equal(snapshotCalls, 1);
  assert.equal(observationCalls, 1);

  nowMs = NOW_MS + V3_DEPLOYMENT_OBSERVATION_MAX_AGE_MS + 1;
  assert.equal((await batcher.observe([base.project]))[0]!.status, "active");
  assert.equal(snapshotCalls, 2);
  assert.equal(observationCalls, 2);
});

test("an observation that expires during upstream reads cannot become ACTIVE", async () => {
  let nowMs = NOW_MS;
  const base = batchFixture(21, new Date(nowMs).toISOString());
  let releaseSnapshot!: (result: OperationalSnapshotFetchResult) => void;
  const batcher = new CanonicalV3DeploymentObservationBatcher({
    now: () => nowMs,
    deadlineMs: 30_000,
    snapshotReader: {
      get() {
        return new Promise<OperationalSnapshotFetchResult>((resolve) => { releaseSnapshot = resolve; });
      },
    },
    observationReader: {
      async get() { return { status: "ok", observation: base.observation }; },
    },
  });
  const pending = batcher.observe([base.project]);
  nowMs += V3_DEPLOYMENT_OBSERVATION_MAX_AGE_MS + 1;
  releaseSnapshot(base.snapshot);
  assert.deepEqual((await pending)[0], {
    status: "unknown",
    checkedAt: new Date(nowMs).toISOString(),
    reasonCode: "V3_DEPLOYMENT_OBSERVATION_STALE",
  });
});

test("ACTIVE cache expiry follows the oldest mandatory proof timestamp", async () => {
  let nowMs = NOW_MS;
  const base = batchFixture(22, new Date(nowMs).toISOString());
  const oldChallenge = structuredClone(base.observation);
  const challengedAt = new Date(nowMs - 14_000).toISOString();
  oldChallenge.runtimeIsolation.challenge.challengedAt = challengedAt;
  base.observation = resealObservation(oldChallenge);
  let snapshotCalls = 0;
  let observationCalls = 0;
  const batcher = new CanonicalV3DeploymentObservationBatcher({
    now: () => nowMs,
    activeCacheTtlMs: 5_000,
    snapshotReader: {
      async get() {
        snapshotCalls += 1;
        return base.snapshot;
      },
    },
    observationReader: {
      async get() {
        observationCalls += 1;
        return { status: "ok", observation: base.observation };
      },
    },
  });
  const first = (await batcher.observe([base.project]))[0]!;
  assert.equal(first.status, "active");
  assert.equal(first.checkedAt, challengedAt);

  nowMs += 1_001;
  const second = (await batcher.observe([base.project]))[0]!;
  assert.equal(second.status, "unknown");
  assert.equal(second.reasonCode, "V3_DEPLOYMENT_OBSERVATION_STALE");
  assert.equal(snapshotCalls, 2);
  assert.equal(observationCalls, 2);
});

test("overlapping batches share one global observation concurrency limit", async () => {
  const observedAt = new Date().toISOString();
  const fixtures = Array.from({ length: 8 }, (_, index) => batchFixture(40 + index, observedAt));
  const byRun = new Map(fixtures.map((fixture) => [fixture.project.workflowRunId, fixture]));
  let active = 0;
  let peak = 0;
  const batcher = new CanonicalV3DeploymentObservationBatcher({
    concurrency: 2,
    deadlineMs: 1_000,
    snapshotReader: {
      async get(runId) {
        active += 1;
        peak = Math.max(peak, active);
        try {
          await new Promise<void>((resolve) => setTimeout(resolve, 5));
          return byRun.get(runId)!.snapshot;
        } finally {
          active -= 1;
        }
      },
    },
    observationReader: {
      async get(runId) { return { status: "ok", observation: byRun.get(runId)!.observation }; },
    },
  });
  const [left, right] = await Promise.all([
    batcher.observe(fixtures.slice(0, 4).map((fixture) => fixture.project)),
    batcher.observe(fixtures.slice(4).map((fixture) => fixture.project)),
  ]);
  assert.equal([...left, ...right].every((observation) => observation.status === "active"), true);
  assert.equal(peak, 2);
});

test("observation cache is bounded LRU and sweeps expired unrelated receipts", async () => {
  let nowMs = NOW_MS;
  const fixtures = Array.from({ length: 4 }, (_, index) => batchFixture(60 + index, new Date(nowMs).toISOString()));
  const byRun = new Map(fixtures.map((fixture) => [fixture.project.workflowRunId, fixture]));
  let calls = 0;
  const batcher = new CanonicalV3DeploymentObservationBatcher({
    now: () => nowMs,
    maxCacheEntries: 2,
    activeCacheTtlMs: 1_000,
    snapshotReader: {
      async get(runId) {
        calls += 1;
        return byRun.get(runId)!.snapshot;
      },
    },
    observationReader: {
      async get(runId) { return { status: "ok", observation: byRun.get(runId)!.observation }; },
    },
  });
  await batcher.observe([fixtures[0]!.project]);
  await batcher.observe([fixtures[1]!.project]);
  await batcher.observe([fixtures[0]!.project]); // touch first entry; second is now LRU
  await batcher.observe([fixtures[2]!.project]);
  await batcher.observe([fixtures[1]!.project]); // second entry was evicted
  assert.equal(calls, 4);
  assert.equal((batcher as unknown as { cache: Map<string, unknown> }).cache.size, 2);

  nowMs += 1_001;
  await batcher.observe([fixtures[3]!.project]);
  assert.equal((batcher as unknown as { cache: Map<string, unknown> }).cache.size, 1);
});
