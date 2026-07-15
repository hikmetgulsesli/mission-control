import assert from "node:assert/strict";
import test from "node:test";
import {
  RUN_OPERATIONAL_SNAPSHOT_V1_SCHEMA,
  RUN_OPERATIONAL_SNAPSHOT_V2_SCHEMA,
  collectOperationalEvidenceRefs,
  evaluateOperationalAction,
  parseOperationalSnapshotResponse,
  type RunOperationalSnapshotV1,
  type RunOperationalSnapshotV2,
} from "../src/lib/operational-snapshot.ts";

const HASH = "a".repeat(64);
const GIT_SHA = "b".repeat(40);
const NOW = Date.parse("2026-07-13T10:00:00.000Z");

function makeSnapshot(): RunOperationalSnapshotV1 {
  return {
    schema: RUN_OPERATIONAL_SNAPSHOT_V1_SCHEMA,
    generatedAt: "2026-07-13T09:59:59.000Z",
    snapshotHash: HASH,
    source: {
      database: "postgres",
      projection: "complete",
      migrationVersions: [1, 2, 3, 4, 5, 6, 7, 8],
      verifiedReleaseSha: GIT_SHA,
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
      ref: "setfarm://runs/run-1",
      id: "run-1",
      runNumber: 1,
      protocol: "v3",
      status: "running",
      terminal: false,
      updatedAt: "2026-07-13T09:59:58.000Z",
    },
    summary: {
      lifecycleState: "runtime_active",
      health: "ok",
      activeClaims: 1,
      activeAttempts: 1,
      activeRuntimes: 1,
      openCompletions: 0,
      mandatoryEffectsPending: 0,
      unpublishedOutbox: 0,
      invariantViolations: 0,
      operatorActions: {
        stop: { allowed: true, reasonCode: "STOP_ALLOWED", stateHash: "c".repeat(64) },
        resume: { allowed: false, reasonCode: "RUN_NOT_RESUMABLE", stateHash: "d".repeat(64) },
      },
    },
    claims: [{
      ref: "setfarm://claims/claim-1",
      id: "claim-1",
      runRef: "setfarm://runs/run-1",
      stepRef: "setfarm://runs/run-1/steps/implement",
      storyRef: "setfarm://runs/run-1/stories/story-1",
      workflowStepId: "implement",
      storyId: "story-1",
      agentId: "implementer",
      state: "open",
      outcome: null,
      claimedAt: "2026-07-13T09:59:00.000Z",
      abandonedAt: null,
    }],
    attempts: [{
      ref: "setfarm://attempts/attempt-1",
      attemptId: "attempt-1",
      runRef: "setfarm://runs/run-1",
      claimRef: "setfarm://claims/claim-1",
      stepRef: "setfarm://runs/run-1/steps/implement",
      storyRef: "setfarm://runs/run-1/stories/story-1",
      workflowStepId: "implement",
      storyId: "story-1",
      generation: 1,
      attemptClass: "product_implementation",
      packetHash: HASH,
      compilationReportHash: HASH,
      sliceHash: HASH,
      sourceBefore: { sha: GIT_SHA, treeHash: GIT_SHA },
      sourceAfter: null,
      findingSetHash: null,
      role: "implementer",
      agentId: "implementer",
      disposition: "running",
      outputHash: null,
      createdAt: "2026-07-13T09:59:00.000Z",
      updatedAt: "2026-07-13T09:59:30.000Z",
    }],
    runtimeSessions: [],
    completionRequests: [],
    terminationRequests: [],
    outbox: [],
    invariants: [],
    acceptedCandidate: null,
    deploymentReceipt: null,
    projectTransferAck: null,
  };
}

function makeV2Snapshot(): RunOperationalSnapshotV2 {
  const v1 = makeSnapshot();
  return {
    ...v1,
    schema: RUN_OPERATIONAL_SNAPSHOT_V2_SCHEMA,
    source: {
      ...v1.source,
      migrationVersions: [...v1.source.migrationVersions, 19],
      capabilities: {
        ...v1.source.capabilities,
        implementationSubmissionEvidence: true,
      },
    },
    completionRequests: [],
  };
}

test("accepts a fresh complete invariant-free snapshot as stop authority", () => {
  const decision = evaluateOperationalAction({ status: "ok", snapshot: makeSnapshot() }, "stop", NOW);
  assert.deepEqual(decision, { allowed: true, reasonCode: "STOP_ALLOWED", snapshotHash: HASH });
});

test("preserves a canonical operator denial instead of deriving from local run status", () => {
  const decision = evaluateOperationalAction({ status: "ok", snapshot: makeSnapshot() }, "resume", NOW);
  assert.deepEqual(decision, { allowed: false, reasonCode: "RUN_NOT_RESUMABLE", snapshotHash: HASH });
});

test("fails closed for partial, stale, capability-incomplete, and inconsistent projections", () => {
  const partial = makeSnapshot();
  partial.source.projection = "partial";
  assert.equal(evaluateOperationalAction({ status: "ok", snapshot: partial }, "stop", NOW).reasonCode, "OPERATIONAL_PROJECTION_INCOMPLETE");

  const stale = makeSnapshot();
  stale.generatedAt = "2026-07-13T09:59:00.000Z";
  assert.equal(evaluateOperationalAction({ status: "ok", snapshot: stale }, "stop", NOW).reasonCode, "OPERATIONAL_EVIDENCE_STALE");

  const incomplete = makeSnapshot();
  incomplete.source.capabilities.effectLedger = false;
  assert.equal(evaluateOperationalAction({ status: "ok", snapshot: incomplete }, "stop", NOW).reasonCode, "OPERATIONAL_CAPABILITY_INCOMPLETE");

  const inconsistent = makeSnapshot();
  inconsistent.summary.lifecycleState = "inconsistent";
  inconsistent.summary.invariantViolations = 1;
  inconsistent.invariants = [{
    code: "TERMINAL_RUN_HAS_ACTIVE_ATTEMPT",
    severity: "error",
    refs: ["setfarm://attempts/attempt-1"],
    observedAt: "2026-07-13T09:59:59.000Z",
  }];
  assert.equal(evaluateOperationalAction({ status: "ok", snapshot: inconsistent }, "stop", NOW).reasonCode, "OPERATIONAL_INVARIANT_VIOLATION");
});

test("rejects and locks an old five-capability payload even when it claims complete", () => {
  const oldPayload = makeSnapshot() as unknown as {
    source: { capabilities: Record<string, boolean> };
    run: { id: string };
  };
  delete oldPayload.source.capabilities.findingRecovery;
  delete oldPayload.source.capabilities.evidenceLedger;
  delete oldPayload.source.capabilities.acceptedCandidate;
  delete oldPayload.source.capabilities.deploymentReceipt;

  const parsed = parseOperationalSnapshotResponse(200, oldPayload, oldPayload.run.id);
  assert.equal(parsed.status, "upstream_error");
  assert.equal(evaluateOperationalAction({ status: "ok", snapshot: oldPayload as unknown as RunOperationalSnapshotV1 }, "stop", NOW).allowed, false);
});

test("fails closed when canonical evidence is loading, unavailable, or unsupported", () => {
  assert.equal(evaluateOperationalAction({ status: "loading" }, "stop", NOW).allowed, false);
  assert.equal(evaluateOperationalAction({
    status: "unavailable",
    code: "SETFARM_OPERATIONAL_SNAPSHOT_UNAVAILABLE",
    reason: "network",
  }, "stop", NOW).reasonCode, "OPERATIONAL_EVIDENCE_UNAVAILABLE");
  assert.equal(evaluateOperationalAction({
    status: "unsupported_schema",
    code: "SETFARM_OPERATIONAL_SNAPSHOT_UNSUPPORTED_SCHEMA",
    schema: "setfarm.run-operational-snapshot.v2",
  }, "stop", NOW).reasonCode, "OPERATIONAL_EVIDENCE_SCHEMA_UNSUPPORTED");
});

test("maps HTTP success and error bodies without a prose fallback", () => {
  const snapshot = makeSnapshot();
  assert.equal(parseOperationalSnapshotResponse(200, snapshot, "run-1").status, "ok");
  const v2 = makeV2Snapshot();
  assert.equal(parseOperationalSnapshotResponse(200, v2, "run-1").status, "ok");
  assert.equal(evaluateOperationalAction({ status: "ok", snapshot: v2 }, "stop", NOW).allowed, true);
  const unicodeBoundary = makeV2Snapshot();
  const requestId = "request-1";
  const sourceProposalHash = "e".repeat(64);
  unicodeBoundary.completionRequests = [{
    requestId,
    outputHash: HASH,
    implementationSubmissionEvidence: {
      receipt: {
        schema: "setfarm.runtime-completion-submission-evidence.v1",
        compiler: "setfarm.v3-implementation-output-compilation.v1",
        sourceSchema: "setfarm.v3-implementation-agent-proposal.v1",
        sourceProposalHash,
        canonicalOutputHash: HASH,
        ignoredFieldPaths: [`/${"\u00fc".repeat(1_999)}`],
      },
      sourceProposalRef: `setfarm://runtime-completion/${requestId}/source-proposal/${sourceProposalHash}`,
    },
  }] as unknown as RunOperationalSnapshotV2["completionRequests"];
  assert.equal(parseOperationalSnapshotResponse(200, unicodeBoundary, "run-1").status, "ok");
  unicodeBoundary.completionRequests[0]!.implementationSubmissionEvidence!.receipt.ignoredFieldPaths = Array.from(
    { length: 20_000 },
    (_, index) => `/${index.toString(36).padStart(3, "0")}`,
  );
  assert.equal(parseOperationalSnapshotResponse(200, unicodeBoundary, "run-1").status, "ok");
  const preV19 = makeV2Snapshot();
  preV19.source.migrationVersions = preV19.source.migrationVersions.filter((version) => version !== 19);
  preV19.source.capabilities.implementationSubmissionEvidence = false;
  assert.equal(parseOperationalSnapshotResponse(200, preV19, "run-1").status, "ok");
  assert.equal(evaluateOperationalAction({ status: "ok", snapshot: preV19 }, "stop", NOW).allowed, true);
  const missingMigrationAuthority = makeV2Snapshot();
  missingMigrationAuthority.source.migrationVersions = missingMigrationAuthority.source.migrationVersions
    .filter((version) => version !== 19);
  assert.equal(
    parseOperationalSnapshotResponse(200, missingMigrationAuthority, "run-1").status,
    "upstream_error",
  );
  const unattestedAuthority = makeV2Snapshot();
  unattestedAuthority.source.verifiedReleaseSha = null;
  assert.equal(
    parseOperationalSnapshotResponse(200, unattestedAuthority, "run-1").status,
    "upstream_error",
  );
  assert.equal(parseOperationalSnapshotResponse(200, { ...snapshot, schema: "setfarm.run-operational-snapshot.v3" }, "run-1").status, "unsupported_schema");
  assert.deepEqual(parseOperationalSnapshotResponse(503, {
    status: "unavailable",
    code: "SETFARM_OPERATIONAL_SNAPSHOT_UNAVAILABLE",
    reason: "circuit_open",
  }, "run-1"), {
    status: "unavailable",
    code: "SETFARM_OPERATIONAL_SNAPSHOT_UNAVAILABLE",
    reason: "circuit_open",
  });
  assert.equal(parseOperationalSnapshotResponse(200, snapshot, "different-run").status, "upstream_error");
});

test("derives step and story surfaces only from canonical evidence refs", () => {
  const snapshot = makeSnapshot();
  snapshot.runtimeSessions = [{
    ref: "setfarm://runtime-sessions/session-1",
    sessionId: "session-1",
    runRef: snapshot.run.ref,
    claimRef: snapshot.claims[0].ref,
    attemptRef: snapshot.attempts[0].ref,
    stepRef: "setfarm://runs/run-1/steps/verify",
    storyRef: "setfarm://runs/run-1/stories/story-1",
    workflowStepId: "verify",
    storyId: "story-1",
    runtimeKind: "local_process",
    state: "running",
    stateVersion: 2,
    startedAt: "2026-07-13T09:59:00.000Z",
    heartbeatAt: "2026-07-13T09:59:59.000Z",
    drainRequestedAt: null,
    drainedAt: null,
    releasedAt: null,
    createdAt: "2026-07-13T09:59:00.000Z",
    updatedAt: "2026-07-13T09:59:59.000Z",
  }];

  assert.deepEqual(collectOperationalEvidenceRefs(snapshot), {
    stepRefs: [
      "setfarm://runs/run-1/steps/implement",
      "setfarm://runs/run-1/steps/verify",
    ],
    storyRefs: ["setfarm://runs/run-1/stories/story-1"],
  });
});
