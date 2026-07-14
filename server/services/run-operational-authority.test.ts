import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateOperationalActionAuthority,
} from "./run-operational-authority.js";
import type {
  OperationalSnapshotFetchResult,
  RunOperationalSnapshotV1,
} from "./setfarm-operational-snapshot.js";

const NOW = Date.parse("2026-07-13T12:00:10.000Z");

function snapshotFixture(overrides: {
  protocol?: "legacy" | "shadow" | "v3" | null;
  generatedAt?: string;
  snapshotHash?: string;
  projection?: "complete" | "partial" | "unavailable";
  stopAllowed?: boolean;
  resumeAllowed?: boolean;
} = {}): RunOperationalSnapshotV1 {
  return {
    schema: "setfarm.run-operational-snapshot.v1",
    generatedAt: overrides.generatedAt ?? "2026-07-13T12:00:00.000Z",
    snapshotHash: overrides.snapshotHash ?? "a".repeat(64),
    source: {
      database: "postgres",
      projection: overrides.projection ?? "complete",
      migrationVersions: [14],
      verifiedReleaseSha: "b".repeat(40),
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
      runNumber: 2001,
      protocol: overrides.protocol === undefined ? "legacy" : overrides.protocol,
      status: "running",
      terminal: false,
      updatedAt: "2026-07-13T12:00:00.000Z",
    },
    summary: {
      lifecycleState: "idle",
      health: "ok",
      activeClaims: 0,
      activeAttempts: 0,
      activeRuntimes: 0,
      openCompletions: 0,
      mandatoryEffectsPending: 0,
      unpublishedOutbox: 0,
      invariantViolations: 0,
      operatorActions: {
        stop: {
          allowed: overrides.stopAllowed ?? true,
          reasonCode: overrides.stopAllowed === false ? "STOP_BLOCKED" : "STOP_ALLOWED",
          stateHash: "c".repeat(64),
        },
        resume: {
          allowed: overrides.resumeAllowed ?? true,
          reasonCode: overrides.resumeAllowed === false ? "RESUME_BLOCKED" : "RESUME_ALLOWED",
          stateHash: "d".repeat(64),
        },
      },
    },
    claims: [],
    attempts: [],
    runtimeSessions: [],
    completionRequests: [],
    terminationRequests: [],
    outbox: [],
    invariants: [],
    findingSets: [],
    evidenceBundles: [],
    recoveryCases: [],
    recoveryDispatches: [],
    acceptedCandidate: null,
    deploymentReceipt: null,
    projectTransferAck: null,
  };
}

function ok(snapshot = snapshotFixture()): OperationalSnapshotFetchResult {
  return { status: "ok", snapshot };
}

function blockedCode(result: ReturnType<typeof evaluateOperationalActionAuthority>): string {
  assert.equal(result.status, "blocked");
  if (result.status !== "blocked") throw new Error("expected blocked authority");
  return result.code;
}

test("requires the UI-observed snapshot hash before any stop or resume mutation", () => {
  assert.deepEqual(evaluateOperationalActionAuthority({
    action: "stop",
    runId: "run-1",
    snapshotResult: ok(),
    nowMs: NOW,
  }), {
    status: "blocked",
    statusCode: 428,
    code: "OPERATIONAL_SNAPSHOT_HASH_REQUIRED",
  });
});

test("rejects a changed, stale, wrong-run, or incomplete snapshot", () => {
  assert.equal(blockedCode(evaluateOperationalActionAuthority({
    action: "stop",
    runId: "run-1",
    expectedSnapshotHash: "c".repeat(64),
    snapshotResult: ok(),
    nowMs: NOW,
  })), "OPERATIONAL_SNAPSHOT_CHANGED");

  assert.equal(blockedCode(evaluateOperationalActionAuthority({
    action: "stop",
    runId: "run-1",
    expectedSnapshotHash: "a".repeat(64),
    snapshotResult: ok(snapshotFixture({ generatedAt: "2026-07-13T11:59:00.000Z" })),
    nowMs: NOW,
  })), "OPERATIONAL_SNAPSHOT_STALE");

  const wrongRun = snapshotFixture();
  wrongRun.run.id = "run-2";
  assert.equal(blockedCode(evaluateOperationalActionAuthority({
    action: "stop",
    runId: "run-1",
    expectedSnapshotHash: wrongRun.snapshotHash,
    snapshotResult: ok(wrongRun),
    nowMs: NOW,
  })), "OPERATIONAL_SNAPSHOT_RUN_MISMATCH");

  const partial = snapshotFixture({ projection: "partial" });
  assert.equal(blockedCode(evaluateOperationalActionAuthority({
    action: "stop",
    runId: "run-1",
    expectedSnapshotHash: partial.snapshotHash,
    snapshotResult: ok(partial),
    nowMs: NOW,
  })), "OPERATIONAL_PROJECTION_INCOMPLETE");
});

test("requires invariant-free canonical action authority", () => {
  const inconsistent = snapshotFixture();
  inconsistent.invariants.push({
    code: "OPEN_CLAIM_ON_IDLE_RUN",
    severity: "error",
    refs: [inconsistent.run.ref],
    observedAt: "2026-07-13T12:00:00.000Z",
  });
  inconsistent.summary.invariantViolations = 1;
  inconsistent.summary.lifecycleState = "inconsistent";
  assert.equal(blockedCode(evaluateOperationalActionAuthority({
    action: "stop",
    runId: "run-1",
    expectedSnapshotHash: inconsistent.snapshotHash,
    snapshotResult: ok(inconsistent),
    nowMs: NOW,
  })), "OPERATIONAL_INVARIANT_VIOLATION");

  const denied = snapshotFixture({ stopAllowed: false });
  assert.deepEqual(evaluateOperationalActionAuthority({
    action: "stop",
    runId: "run-1",
    expectedSnapshotHash: denied.snapshotHash,
    snapshotResult: ok(denied),
    nowMs: NOW,
  }), {
    status: "blocked",
    statusCode: 409,
    code: "OPERATIONAL_ACTION_NOT_ALLOWED",
    reason: "STOP_BLOCKED",
  });
});

test("allows monotonic stop for compiler protocols but never manual compiler resume", () => {
  const v3 = snapshotFixture({ protocol: "v3" });
  assert.deepEqual(evaluateOperationalActionAuthority({
    action: "stop",
    runId: "run-1",
    expectedSnapshotHash: v3.snapshotHash,
    snapshotResult: ok(v3),
    nowMs: NOW,
  }), {
    status: "authorized",
    action: "stop",
    runId: "run-1",
    snapshotHash: v3.snapshotHash,
    protocol: "v3",
  });

  assert.equal(blockedCode(evaluateOperationalActionAuthority({
    action: "resume",
    runId: "run-1",
    expectedSnapshotHash: v3.snapshotHash,
    snapshotResult: ok(v3),
    nowMs: NOW,
  })), "COMPILER_PROTOCOL_MANUAL_RESUME_DISABLED");
});

test("fails closed when canonical operational evidence is unavailable", () => {
  assert.deepEqual(evaluateOperationalActionAuthority({
    action: "stop",
    runId: "run-1",
    expectedSnapshotHash: "a".repeat(64),
    snapshotResult: { status: "unavailable", reason: "network" },
    nowMs: NOW,
  }), {
    status: "blocked",
    statusCode: 503,
    code: "OPERATIONAL_SNAPSHOT_UNAVAILABLE",
    reason: "network",
  });
});
