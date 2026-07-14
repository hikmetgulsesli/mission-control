import assert from "node:assert/strict";
import test from "node:test";

import {
  runIncrementalV3ProjectTransfers,
  type V3AcknowledgedTransferAuditRow,
  type V3PendingTransferRun,
  type V3ProjectTransferCandidateSource,
  type V3ProjectTransferSchedulerStateStore,
  type V3TransferCursor,
  type V3TransferSchedulerStateV1,
} from "./v3-project-transfer-scheduler.js";

function run(index: number, id = `run-${String(index).padStart(4, "0")}`): V3PendingTransferRun {
  return {
    id,
    status: "completed",
    protocol: "v3",
    workflowId: "feature-dev",
    runNumber: index + 1,
    cursorTimestamp: new Date(Date.UTC(2026, 6, 14, 0, 0, index)).toISOString(),
  };
}

function afterCursor<T extends V3PendingTransferRun>(rows: readonly T[], cursor: V3TransferCursor | null): T[] {
  if (!cursor) return [...rows];
  return rows.filter((row) => row.cursorTimestamp > cursor.timestamp
    || (row.cursorTimestamp === cursor.timestamp && row.id > cursor.runId));
}

class MemoryState implements V3ProjectTransferSchedulerStateStore {
  state: V3TransferSchedulerStateV1 = {
    schema: "mission-control.v3-project-transfer-scheduler-state.v1",
    pendingCursor: null,
    acknowledgedAuditCursor: null,
    updatedAt: "2026-07-14T00:00:00.000Z",
  };

  load() { return structuredClone(this.state); }
  save(state: V3TransferSchedulerStateV1) { this.state = structuredClone(state); }
}

test("hundreds of ACKed runs plus one unacked run produce one bounded upstream transfer", async () => {
  const acknowledged: V3AcknowledgedTransferAuditRow[] = Array.from({ length: 500 }, (_, index) => ({
    ...run(index),
    projectId: `project-${index}`,
    projectionHash: String(index % 10).repeat(64),
    projectRecordHash: String((index + 1) % 10).repeat(64),
    persistedAt: new Date(Date.UTC(2026, 6, 14, 0, 0, index)).toISOString(),
  }));
  const unacked = run(501, "new-unacked-run");
  let pendingQueryCalls = 0;
  let auditQueryCalls = 0;
  let largestAuditPage = 0;
  const source: V3ProjectTransferCandidateSource = {
    async listPending({ after, limit }) {
      pendingQueryCalls += 1;
      return afterCursor([unacked], after).slice(0, limit);
    },
    async listAcknowledgedForAudit({ after, limit }) {
      auditQueryCalls += 1;
      const page = afterCursor(acknowledged, after).slice(0, limit);
      largestAuditPage = Math.max(largestAuditPage, page.length);
      return page;
    },
    async findByRunId() { return null; },
  };
  const projects = acknowledged.map((ack) => ({
    id: ack.projectId,
    productCompilerProtocol: "v3",
    workflowRunId: ack.id,
    canonicalProjectionHash: ack.projectionHash,
    canonicalProjectRecordHash: ack.projectRecordHash,
    canonicalProjectionPersistedAt: ack.persistedAt,
  }));
  const processed: string[] = [];
  const result = await runIncrementalV3ProjectTransfers({
    source,
    stateStore: new MemoryState(),
    projects,
    processRun: async (candidate) => { processed.push(candidate.id); },
    pendingPageSize: 8,
    acknowledgedAuditPageSize: 32,
    concurrency: 2,
  });

  assert.deepEqual(processed, [unacked.id]);
  assert.deepEqual(result, {
    selected: 1,
    pendingSelected: 1,
    reconciliationSelected: 0,
    acknowledgedAudited: 32,
  });
  assert.equal(pendingQueryCalls, 1);
  assert.equal(auditQueryCalls, 1);
  assert.equal(largestAuditPage, 32);
});

test("durable pending cursor prevents a bad first page from starving a newly completed run", async () => {
  const pending = Array.from({ length: 20 }, (_, index) => run(index));
  const source: V3ProjectTransferCandidateSource = {
    async listPending({ after, limit }) { return afterCursor(pending, after).slice(0, limit); },
    async listAcknowledgedForAudit() { return []; },
    async findByRunId(runId) { return pending.find((candidate) => candidate.id === runId) ?? null; },
  };
  const state = new MemoryState();
  const processed: string[] = [];
  let active = 0;
  let maxActive = 0;
  const processRun = async (candidate: V3PendingTransferRun) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    processed.push(candidate.id);
    active -= 1;
  };

  await runIncrementalV3ProjectTransfers({ source, stateStore: state, projects: [], processRun, pendingPageSize: 8, concurrency: 2 });
  const newlyCompleted = run(21, "newly-completed");
  pending.push(newlyCompleted);
  await runIncrementalV3ProjectTransfers({ source, stateStore: state, projects: [], processRun, pendingPageSize: 8, concurrency: 2 });
  await runIncrementalV3ProjectTransfers({ source, stateStore: state, projects: [], processRun, pendingPageSize: 8, concurrency: 2 });

  assert.equal(processed.includes(newlyCompleted.id), true);
  assert.equal(maxActive <= 2, true);
  assert.equal(processed.length, 21);
});

test("ACK audit invokes replay only for a missing or drifted canonical project record", async () => {
  const exact: V3AcknowledgedTransferAuditRow = {
    ...run(1, "exact-run"),
    projectId: "exact-project",
    projectionHash: "a".repeat(64),
    projectRecordHash: "b".repeat(64),
    persistedAt: "2026-07-14T00:00:01.000Z",
  };
  const missing: V3AcknowledgedTransferAuditRow = {
    ...run(2, "missing-run"),
    projectId: "missing-project",
    projectionHash: "c".repeat(64),
    projectRecordHash: "d".repeat(64),
    persistedAt: "2026-07-14T00:00:02.000Z",
  };
  const source: V3ProjectTransferCandidateSource = {
    async listPending() { return []; },
    async listAcknowledgedForAudit() { return [exact, missing]; },
    async findByRunId() { return null; },
  };
  const processed: string[] = [];
  const result = await runIncrementalV3ProjectTransfers({
    source,
    stateStore: new MemoryState(),
    projects: [{
      id: exact.projectId,
      productCompilerProtocol: "v3",
      workflowRunId: exact.id,
      canonicalProjectionHash: exact.projectionHash,
      canonicalProjectRecordHash: exact.projectRecordHash,
      canonicalProjectionPersistedAt: exact.persistedAt,
    }],
    processRun: async (candidate) => { processed.push(candidate.id); },
  });
  assert.deepEqual(processed, [missing.id]);
  assert.equal(result.reconciliationSelected, 1);
});
