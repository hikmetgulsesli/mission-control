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
  saves = 0;
  state: V3TransferSchedulerStateV1 = {
    schema: "mission-control.v3-project-transfer-scheduler-state.v1",
    pendingCursor: null,
    acknowledgedAuditCursor: null,
    updatedAt: "2026-07-14T00:00:00.000Z",
  };

  load() { return structuredClone(this.state); }
  save(state: V3TransferSchedulerStateV1) {
    this.saves += 1;
    this.state = structuredClone(state);
  }
}

test("empty null-cursor ticks keep polling without rewriting scheduler state", async () => {
  const state = new MemoryState();
  let pendingQueries = 0;
  let auditQueries = 0;
  let processed = 0;
  const source: V3ProjectTransferCandidateSource = {
    async listPending() { pendingQueries += 1; return []; },
    async listAcknowledgedForAudit() { auditQueries += 1; return []; },
    async findByRunId() { return null; },
  };
  const input = {
    source,
    stateStore: state,
    projects: [],
    processRun: async () => { processed += 1; },
  };

  await runIncrementalV3ProjectTransfers(input);
  await runIncrementalV3ProjectTransfers(input);

  assert.equal(pendingQueries, 2);
  assert.equal(auditQueries, 2);
  assert.equal(processed, 0);
  assert.equal(state.saves, 0);
  assert.deepEqual(state.load(), {
    schema: "mission-control.v3-project-transfer-scheduler-state.v1",
    pendingCursor: null,
    acknowledgedAuditCursor: null,
    updatedAt: "2026-07-14T00:00:00.000Z",
  });
});

test("a later pending run persists its cursor before processing", async () => {
  const state = new MemoryState();
  const candidate = run(1);
  let queries = 0;
  const order: string[] = [];
  const source: V3ProjectTransferCandidateSource = {
    async listPending() { queries += 1; return queries === 1 ? [] : [candidate]; },
    async listAcknowledgedForAudit() { return []; },
    async findByRunId() { return null; },
  };
  const stateStore: V3ProjectTransferSchedulerStateStore = {
    load: () => state.load(),
    save: (next) => { order.push("save"); state.save(next); },
  };
  const input = {
    source,
    stateStore,
    projects: [],
    processRun: async () => { order.push("process"); },
  };

  await runIncrementalV3ProjectTransfers(input);
  await runIncrementalV3ProjectTransfers(input);

  assert.equal(queries, 2);
  assert.deepEqual(order, ["save", "process"]);
  assert.equal(state.saves, 1);
  assert.deepEqual(state.load().pendingCursor, {
    timestamp: candidate.cursorTimestamp,
    runId: candidate.id,
  });
});

test("an exhausted non-null cursor persists its reset to null", async () => {
  const state = new MemoryState();
  state.state.pendingCursor = { timestamp: "2026-07-14T00:00:01.000Z", runId: "old-run" };
  const afters: (V3TransferCursor | null)[] = [];
  const source: V3ProjectTransferCandidateSource = {
    async listPending({ after }) { afters.push(after); return []; },
    async listAcknowledgedForAudit() { return []; },
    async findByRunId() { return null; },
  };

  await runIncrementalV3ProjectTransfers({
    source,
    stateStore: state,
    projects: [],
    processRun: async () => { throw new Error("NO_RUN_SELECTED"); },
  });

  assert.deepEqual(afters, [
    { timestamp: "2026-07-14T00:00:01.000Z", runId: "old-run" },
    null,
  ]);
  assert.equal(state.saves, 1);
  assert.equal(state.load().pendingCursor, null);
});

test("an exact ACK audit page persists its cursor without replay effects", async () => {
  const state = new MemoryState();
  const acknowledged: V3AcknowledgedTransferAuditRow = {
    ...run(2),
    projectId: "project-2",
    projectionHash: "a".repeat(64),
    projectRecordHash: "b".repeat(64),
    persistedAt: "2026-07-14T00:00:02.000Z",
  };
  const source: V3ProjectTransferCandidateSource = {
    async listPending() { return []; },
    async listAcknowledgedForAudit() { return [acknowledged]; },
    async findByRunId() { return null; },
  };
  const result = await runIncrementalV3ProjectTransfers({
    source,
    stateStore: state,
    projects: [{
      id: acknowledged.projectId,
      productCompilerProtocol: "v3",
      workflowRunId: acknowledged.id,
      canonicalProjectionHash: acknowledged.projectionHash,
      canonicalProjectRecordHash: acknowledged.projectRecordHash,
      canonicalProjectionPersistedAt: acknowledged.persistedAt,
    }],
    processRun: async () => { throw new Error("EXACT_ACK_MUST_NOT_REPLAY"); },
  });

  assert.equal(result.selected, 0);
  assert.equal(result.acknowledgedAudited, 1);
  assert.equal(state.saves, 1);
  assert.deepEqual(state.load().acknowledgedAuditCursor, {
    timestamp: acknowledged.cursorTimestamp,
    runId: acknowledged.id,
  });
});

test("a failed state save prevents pending transfer effects", async () => {
  const candidate = run(3);
  let processed = 0;
  const source: V3ProjectTransferCandidateSource = {
    async listPending() { return [candidate]; },
    async listAcknowledgedForAudit() { return []; },
    async findByRunId() { return null; },
  };
  const state = new MemoryState();
  const stateStore: V3ProjectTransferSchedulerStateStore = {
    load: () => state.load(),
    save: () => { throw new Error("DURABLE_SAVE_FAILED"); },
  };

  await assert.rejects(runIncrementalV3ProjectTransfers({
    source,
    stateStore,
    projects: [],
    processRun: async () => { processed += 1; },
  }), /DURABLE_SAVE_FAILED/);
  assert.equal(processed, 0);
});

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
