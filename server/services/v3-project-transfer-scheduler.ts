import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

import { sql as defaultSql } from "../utils/pg.js";

export interface V3TransferCursor {
  timestamp: string;
  runId: string;
}

export interface V3PendingTransferRun {
  id: string;
  status: string;
  protocol: "v3";
  workflowId: string;
  runNumber?: number;
  cursorTimestamp: string;
}

export interface V3AcknowledgedTransferAuditRow extends V3PendingTransferRun {
  projectId: string;
  projectionHash: string;
  projectRecordHash: string;
  persistedAt: string;
}

export interface V3TransferSchedulerStateV1 {
  schema: "mission-control.v3-project-transfer-scheduler-state.v1";
  pendingCursor: V3TransferCursor | null;
  acknowledgedAuditCursor: V3TransferCursor | null;
  updatedAt: string;
}

export interface V3ProjectTransferCandidateSource {
  listPending(input: Readonly<{ after: V3TransferCursor | null; limit: number }>): Promise<V3PendingTransferRun[]>;
  listAcknowledgedForAudit(input: Readonly<{
    after: V3TransferCursor | null;
    limit: number;
  }>): Promise<V3AcknowledgedTransferAuditRow[]>;
  findByRunId(runId: string): Promise<V3PendingTransferRun | null>;
}

export interface V3ProjectTransferSchedulerStateStore {
  load(): V3TransferSchedulerStateV1;
  save(state: V3TransferSchedulerStateV1): void;
}

type SqlLike = Readonly<{
  unsafe<T extends readonly unknown[]>(query: string, parameters?: readonly unknown[]): Promise<T>;
}>;

type RunRow = Readonly<{
  id: string;
  status: string;
  protocol: string;
  workflow_id: string;
  run_number: number | null;
  cursor_timestamp: Date | string;
  project_id?: string;
  projection_hash?: string;
  project_record_hash?: string;
  persisted_at?: Date | string;
}>;

function timestamp(value: Date | string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error("V3_PROJECT_TRANSFER_CURSOR_TIMESTAMP_INVALID");
  return parsed.toISOString();
}

function pendingRun(row: RunRow): V3PendingTransferRun {
  if (!row.id || row.protocol !== "v3" || !["completed", "done"].includes(row.status.toLowerCase())) {
    throw new Error("V3_PROJECT_TRANSFER_SELECTION_ROW_INVALID");
  }
  return {
    id: row.id,
    status: row.status,
    protocol: "v3",
    workflowId: row.workflow_id,
    ...(row.run_number && row.run_number > 0 ? { runNumber: row.run_number } : {}),
    cursorTimestamp: timestamp(row.cursor_timestamp),
  };
}

export class PostgresV3ProjectTransferCandidateSource implements V3ProjectTransferCandidateSource {
  constructor(private readonly sql: SqlLike = defaultSql as unknown as SqlLike) {}

  async listPending(input: Readonly<{
    after: V3TransferCursor | null;
    limit: number;
  }>): Promise<V3PendingTransferRun[]> {
    const limit = boundedLimit(input.limit);
    const rows = await this.sql.unsafe<RunRow[]>(`
      SELECT r.id, r.status, r.protocol, r.workflow_id, r.run_number,
             r.updated_at AS cursor_timestamp
        FROM runs r
       WHERE r.protocol = 'v3'
         AND lower(r.status) IN ('completed', 'done')
         AND r.workflow_id = 'feature-dev'
         AND r.accepted_candidate_hash IS NOT NULL
         AND r.deploy_receipt_hash IS NOT NULL
         AND r.project_transfer_ack_hash IS NULL
         AND ($1::timestamptz IS NULL OR (r.updated_at, r.id) > ($1::timestamptz, $2::text))
       ORDER BY r.updated_at ASC, r.id ASC
       LIMIT $3
    `, [input.after?.timestamp ?? null, input.after?.runId ?? "", limit]);
    return rows.map(pendingRun);
  }

  async listAcknowledgedForAudit(input: Readonly<{
    after: V3TransferCursor | null;
    limit: number;
  }>): Promise<V3AcknowledgedTransferAuditRow[]> {
    const limit = boundedLimit(input.limit);
    const rows = await this.sql.unsafe<RunRow[]>(`
      SELECT r.id, r.status, r.protocol, r.workflow_id, r.run_number,
             ack.created_at AS cursor_timestamp,
             ack.project_id, ack.projection_hash, ack.project_record_hash, ack.persisted_at
        FROM runs r
        JOIN v3_project_transfer_acks ack
          ON ack.run_id = r.id
         AND ack.ack_hash = r.project_transfer_ack_hash
       WHERE r.protocol = 'v3'
         AND lower(r.status) IN ('completed', 'done')
         AND r.workflow_id = 'feature-dev'
         AND ($1::timestamptz IS NULL OR (ack.created_at, r.id) > ($1::timestamptz, $2::text))
       ORDER BY ack.created_at ASC, r.id ASC
       LIMIT $3
    `, [input.after?.timestamp ?? null, input.after?.runId ?? "", limit]);
    return rows.map((row) => {
      const base = pendingRun(row);
      if (!row.project_id || !row.projection_hash || !row.project_record_hash || !row.persisted_at) {
        throw new Error("V3_PROJECT_TRANSFER_ACK_AUDIT_ROW_INVALID");
      }
      return {
        ...base,
        projectId: row.project_id,
        projectionHash: row.projection_hash,
        projectRecordHash: row.project_record_hash,
        persistedAt: timestamp(row.persisted_at),
      };
    });
  }

  async findByRunId(runId: string): Promise<V3PendingTransferRun | null> {
    const rows = await this.sql.unsafe<RunRow[]>(`
      SELECT r.id, r.status, r.protocol, r.workflow_id, r.run_number,
             r.updated_at AS cursor_timestamp
        FROM runs r
       WHERE r.id = $1
         AND r.protocol = 'v3'
         AND lower(r.status) IN ('completed', 'done')
         AND r.workflow_id = 'feature-dev'
       LIMIT 1
    `, [runId]);
    return rows[0] ? pendingRun(rows[0]) : null;
  }
}

function boundedLimit(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 100) {
    throw new Error("V3_PROJECT_TRANSFER_PAGE_LIMIT_INVALID");
  }
  return value;
}

function emptyState(now: () => Date): V3TransferSchedulerStateV1 {
  return {
    schema: "mission-control.v3-project-transfer-scheduler-state.v1",
    pendingCursor: null,
    acknowledgedAuditCursor: null,
    updatedAt: now().toISOString(),
  };
}

function cursorAt(run: V3PendingTransferRun): V3TransferCursor {
  return { timestamp: run.cursorTimestamp, runId: run.id };
}

function parseCursor(value: unknown): V3TransferCursor | null {
  if (value === null) return null;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("V3_PROJECT_TRANSFER_CURSOR_INVALID");
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 2 || typeof record.timestamp !== "string"
    || !Number.isFinite(Date.parse(record.timestamp)) || typeof record.runId !== "string" || !record.runId) {
    throw new Error("V3_PROJECT_TRANSFER_CURSOR_INVALID");
  }
  return { timestamp: new Date(record.timestamp).toISOString(), runId: record.runId };
}

export class FileV3ProjectTransferSchedulerStateStore implements V3ProjectTransferSchedulerStateStore {
  constructor(private readonly filePath: string, private readonly now: () => Date = () => new Date()) {}

  load(): V3TransferSchedulerStateV1 {
    if (!existsSync(this.filePath)) return emptyState(this.now);
    const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("V3_PROJECT_TRANSFER_SCHEDULER_STATE_INVALID");
    }
    const record = parsed as Record<string, unknown>;
    if (Object.keys(record).length !== 4
      || record.schema !== "mission-control.v3-project-transfer-scheduler-state.v1"
      || typeof record.updatedAt !== "string" || !Number.isFinite(Date.parse(record.updatedAt))) {
      throw new Error("V3_PROJECT_TRANSFER_SCHEDULER_STATE_INVALID");
    }
    return {
      schema: "mission-control.v3-project-transfer-scheduler-state.v1",
      pendingCursor: parseCursor(record.pendingCursor),
      acknowledgedAuditCursor: parseCursor(record.acknowledgedAuditCursor),
      updatedAt: new Date(record.updatedAt).toISOString(),
    };
  }

  save(state: V3TransferSchedulerStateV1): void {
    const directory = dirname(this.filePath);
    mkdirSync(directory, { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    let descriptor: number | undefined;
    try {
      descriptor = openSync(temporary, "wx", 0o600);
      writeFileSync(descriptor, `${JSON.stringify(state, null, 2)}\n`);
      fsyncSync(descriptor);
      closeSync(descriptor);
      descriptor = undefined;
      renameSync(temporary, this.filePath);
      const directoryDescriptor = openSync(directory, "r");
      try { fsyncSync(directoryDescriptor); } finally { closeSync(directoryDescriptor); }
    } catch (error) {
      if (descriptor !== undefined) try { closeSync(descriptor); } catch { /* cleanup */ }
      try { unlinkSync(temporary); } catch { /* cleanup */ }
      throw error;
    }
  }
}

async function pageWithWrap<T extends V3PendingTransferRun>(input: Readonly<{
  cursor: V3TransferCursor | null;
  limit: number;
  load(after: V3TransferCursor | null): Promise<T[]>;
}>): Promise<Readonly<{ rows: T[]; cursor: V3TransferCursor | null }>> {
  let rows = await input.load(input.cursor);
  if (rows.length === 0 && input.cursor) rows = await input.load(null);
  return {
    rows,
    cursor: rows.length > 0 ? cursorAt(rows[rows.length - 1]!) : null,
  };
}

function ackNeedsReconciliation(
  ack: V3AcknowledgedTransferAuditRow,
  projectsById: ReadonlyMap<string, Readonly<Record<string, unknown>>>,
): boolean {
  const project = projectsById.get(ack.projectId);
  return !project
    || project.productCompilerProtocol !== "v3"
    || project.workflowRunId !== ack.id
    || project.canonicalProjectionHash !== ack.projectionHash
    || project.canonicalProjectRecordHash !== ack.projectRecordHash
    || project.canonicalProjectionPersistedAt !== ack.persistedAt;
}

async function mapBounded<T>(
  values: readonly T[],
  concurrency: number,
  visit: (value: T) => Promise<void>,
): Promise<void> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 16) {
    throw new Error("V3_PROJECT_TRANSFER_CONCURRENCY_INVALID");
  }
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      await visit(values[index]!);
    }
  }));
}

export async function runIncrementalV3ProjectTransfers(input: Readonly<{
  source: V3ProjectTransferCandidateSource;
  stateStore: V3ProjectTransferSchedulerStateStore;
  projects: readonly Readonly<Record<string, unknown>>[];
  processRun(run: V3PendingTransferRun): Promise<void>;
  pendingPageSize?: number;
  acknowledgedAuditPageSize?: number;
  concurrency?: number;
  now?: () => Date;
}>): Promise<Readonly<{
  selected: number;
  pendingSelected: number;
  reconciliationSelected: number;
  acknowledgedAudited: number;
}>> {
  const pendingPageSize = boundedLimit(input.pendingPageSize ?? 8);
  const acknowledgedAuditPageSize = boundedLimit(input.acknowledgedAuditPageSize ?? 32);
  const state = input.stateStore.load();
  const pendingPage = await pageWithWrap({
    cursor: state.pendingCursor,
    limit: pendingPageSize,
    load: (after) => input.source.listPending({ after, limit: pendingPageSize }),
  });
  const auditPage = await pageWithWrap({
    cursor: state.acknowledgedAuditCursor,
    limit: acknowledgedAuditPageSize,
    load: (after) => input.source.listAcknowledgedForAudit({ after, limit: acknowledgedAuditPageSize }),
  });
  const projectsById = new Map(input.projects.map((project) => [String(project.id), project]));
  const reconciliation = auditPage.rows.filter((row) => ackNeedsReconciliation(row, projectsById));
  const selectedByRunId = new Map<string, V3PendingTransferRun>();
  for (const run of [...pendingPage.rows, ...reconciliation]) selectedByRunId.set(run.id, run);
  const selected = [...selectedByRunId.values()];

  // Persist cursor advancement before upstream effects. A crashing worker can
  // be revisited after bounded wrap; a permanently bad run cannot pin page 1
  // and starve newer terminal runs.
  input.stateStore.save({
    schema: "mission-control.v3-project-transfer-scheduler-state.v1",
    pendingCursor: pendingPage.cursor,
    acknowledgedAuditCursor: auditPage.cursor,
    updatedAt: (input.now ?? (() => new Date()))().toISOString(),
  });
  await mapBounded(selected, input.concurrency ?? 2, input.processRun);
  return {
    selected: selected.length,
    pendingSelected: pendingPage.rows.length,
    reconciliationSelected: reconciliation.length,
    acknowledgedAudited: auditPage.rows.length,
  };
}
