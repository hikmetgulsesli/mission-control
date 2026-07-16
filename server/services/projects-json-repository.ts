import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import {
  closeSync,
  chmodSync,
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

type ProjectRecord = Record<string, unknown>;

interface ProjectsSnapshotMetadata {
  targetRevision: string;
  baseline: ProjectRecord[];
}

interface ProjectsJsonLockProcessIdentity {
  schema: "mission-control.process-identity.v1";
  pid: number;
  processStartedAt: string;
  processGroupId: number;
  source: "observed_os";
}

interface ProjectsJsonLockRecord {
  schema: "mission-control.projects-json-lock.v1";
  lockVersion: 1;
  ownerToken: string;
  processIdentity: ProjectsJsonLockProcessIdentity;
  acquiredAt: string;
}

interface ProjectsJsonLockHandle {
  database: DatabaseSync;
  record: ProjectsJsonLockRecord;
}

const DEFAULT_LOCK_TIMEOUT_MS = 5_000;

export class ProjectsJsonRevisionConflictError extends Error {
  readonly code = "PROJECTS_JSON_REVISION_CONFLICT";

  constructor(readonly projectId: string) {
    super(`PROJECTS_JSON_REVISION_CONFLICT:${projectId}`);
    this.name = "ProjectsJsonRevisionConflictError";
  }
}

export class ProjectsJsonCommittedLockReleaseError extends Error {
  readonly code = "PROJECTS_JSON_COMMITTED_LOCK_RELEASE_FAILED";

  constructor(
    readonly committedRevision: string,
    readonly committedProjects: ProjectRecord[],
    cause: unknown,
  ) {
    super(`PROJECTS_JSON_COMMITTED_LOCK_RELEASE_FAILED:${committedRevision}`, { cause });
    this.name = "ProjectsJsonCommittedLockReleaseError";
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("PROJECTS_JSON_NON_FINITE_NUMBER");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new Error("PROJECTS_JSON_UNSUPPORTED_VALUE");
}

function semanticHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function fileRevision(contents: string | null): string {
  return createHash("sha256")
    .update(contents === null ? "projects-json:missing:v1" : contents, "utf8")
    .digest("hex");
}

function parseProjects(contents: string, source: string): ProjectRecord[] {
  const parsed = JSON.parse(contents) as unknown;
  if (!Array.isArray(parsed)) throw new Error(`PROJECTS_JSON_ARRAY_REQUIRED:${source}`);
  const ids = new Set<string>();
  return parsed.map((value, index) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(`PROJECTS_JSON_RECORD_REQUIRED:${source}:${index}`);
    }
    const record = value as ProjectRecord;
    const id = String(record.id || "").trim();
    if (!id || ids.has(id)) throw new Error(`PROJECTS_JSON_UNIQUE_ID_REQUIRED:${source}:${index}`);
    ids.add(id);
    return record;
  });
}

function recordsById(projects: readonly ProjectRecord[]): Map<string, ProjectRecord> {
  return new Map(projects.map((project) => [String(project.id), project]));
}

function same(left: unknown, right: unknown): boolean {
  return semanticHash(left) === semanticHash(right);
}

function fsyncDirectory(directory: string): void {
  const descriptor = openSync(directory, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function restrictSqliteLockFilePermissions(databasePath: string): void {
  for (const candidate of [databasePath, `${databasePath}-journal`, `${databasePath}-wal`, `${databasePath}-shm`]) {
    try {
      chmodSync(candidate, 0o600);
    } catch (error) {
      // SQLite may remove transient journal/WAL files between observation and
      // chmod. A missing candidate is already the desired terminal state.
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

/** Observe PID + start instant + process group; PID alone is not ownership. */
function observeProcessIdentity(pid: number): ProjectsJsonLockProcessIdentity | null {
  try {
    const output = execFileSync("ps", ["-o", "pid=", "-o", "lstart=", "-o", "pgid=", "-p", String(pid)], {
      encoding: "utf8",
      timeout: 2_000,
    }).trim();
    const tokens = output.split(/\s+/);
    if (tokens.length !== 7) return null;
    const observedPid = Number(tokens[0]);
    const processGroupId = Number(tokens[6]);
    const startedAtMs = Date.parse(tokens.slice(1, 6).join(" "));
    if (observedPid !== pid || !Number.isSafeInteger(processGroupId) || processGroupId < 1
      || !Number.isFinite(startedAtMs)) return null;
    return {
      schema: "mission-control.process-identity.v1",
      pid: observedPid,
      processStartedAt: new Date(startedAtMs).toISOString(),
      processGroupId,
      source: "observed_os",
    };
  } catch {
    return null;
  }
}

export function supportsUnflaggedNodeSqlite(nodeVersion: string): boolean {
  const [major, minor] = nodeVersion.split(".").map(Number);
  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor)) return false;
  return major > 23 || (major === 23 && minor >= 4) || (major === 22 && minor >= 13);
}

export function assertProjectsJsonLockCapability(): void {
  if (typeof DatabaseSync !== "function" || !supportsUnflaggedNodeSqlite(process.versions.node)) {
    throw new Error("PROJECTS_JSON_SQLITE_LOCK_CAPABILITY_REQUIRED");
  }
}

/**
 * Record-level three-way merge. A candidate may change only records that still
 * equal its exact load baseline. Concurrent additions and changes to other
 * records survive; divergent changes to the same record fail closed.
 */
export function mergeProjectsByRevision(input: Readonly<{
  baseline: readonly ProjectRecord[];
  candidate: readonly ProjectRecord[];
  current: readonly ProjectRecord[];
}>): ProjectRecord[] {
  const baselineById = recordsById(input.baseline);
  const candidateById = recordsById(input.candidate);
  const currentById = recordsById(input.current);
  const mergedById = new Map(currentById);

  for (const [id, baseline] of baselineById) {
    const candidate = candidateById.get(id);
    const current = currentById.get(id);
    if (!candidate) {
      if (!current) continue;
      if (!same(current, baseline)) throw new ProjectsJsonRevisionConflictError(id);
      mergedById.delete(id);
      continue;
    }
    if (same(candidate, baseline)) continue;
    if (!current) throw new ProjectsJsonRevisionConflictError(id);
    if (same(current, candidate)) continue;
    if (!same(current, baseline)) throw new ProjectsJsonRevisionConflictError(id);
    mergedById.set(id, candidate);
  }

  for (const [id, candidate] of candidateById) {
    if (baselineById.has(id)) continue;
    const current = currentById.get(id);
    if (current && !same(current, candidate)) throw new ProjectsJsonRevisionConflictError(id);
    mergedById.set(id, candidate);
  }

  const emitted = new Set<string>();
  const merged: ProjectRecord[] = [];
  // Preserve the current file order, replacing records selected by the merge.
  for (const current of input.current) {
    const id = String(current.id);
    const selected = mergedById.get(id);
    if (!selected) continue;
    merged.push(selected);
    emitted.add(id);
  }
  // Candidate-only additions retain candidate order.
  for (const candidate of input.candidate) {
    const id = String(candidate.id);
    if (emitted.has(id)) continue;
    const selected = mergedById.get(id);
    if (!selected) continue;
    merged.push(selected);
    emitted.add(id);
  }
  return merged;
}

export class ProjectsJsonRepository {
  private readonly snapshots = new WeakMap<ProjectRecord[], ProjectsSnapshotMetadata>();

  constructor(private readonly options: Readonly<{
    filePath: string;
    fallbackPath?: string;
    lockTimeoutMs?: number;
  }>) {
    assertProjectsJsonLockCapability();
  }

  load(): ProjectRecord[] {
    const targetContents = existsSync(this.options.filePath)
      ? readFileSync(this.options.filePath, "utf8")
      : null;
    const readablePath = targetContents !== null
      ? this.options.filePath
      : this.options.fallbackPath && existsSync(this.options.fallbackPath)
        ? this.options.fallbackPath
        : null;
    const readableContents = targetContents ?? (readablePath ? readFileSync(readablePath, "utf8") : "[]");
    const projects = parseProjects(readableContents, readablePath ?? this.options.filePath);
    this.snapshots.set(projects, {
      targetRevision: fileRevision(targetContents),
      baseline: cloneJson(projects),
    });
    return projects;
  }

  save(projects: ProjectRecord[], source: ProjectRecord[] = projects): Readonly<{
    projects: ProjectRecord[];
    revision: string;
  }> {
    const metadata = this.snapshots.get(source) ?? this.snapshots.get(projects);
    if (!metadata) throw new Error("PROJECTS_JSON_EXACT_SOURCE_REVISION_REQUIRED");
    const lock = this.acquireWriteLock();
    let committedResult: Readonly<{ projects: ProjectRecord[]; revision: string }> | null = null;
    try {
      // The current revision is read only after cross-process lock ownership is
      // established. This makes read/merge/write/readback one serialized CAS.
      const targetContents = existsSync(this.options.filePath)
        ? readFileSync(this.options.filePath, "utf8")
        : null;
      const currentRevision = fileRevision(targetContents);
      const current = targetContents === null
        ? cloneJson(metadata.baseline)
        : parseProjects(targetContents, this.options.filePath);
      const candidate = cloneJson(projects);
      const committed = currentRevision === metadata.targetRevision
        ? candidate
        : mergeProjectsByRevision({ baseline: metadata.baseline, candidate, current });

      // Validate identities before the durable replacement.
      parseProjects(JSON.stringify(committed), "candidate");
      const serialized = `${JSON.stringify(committed, null, 2)}\n`;
      this.writeDurably(serialized);

      const readback = readFileSync(this.options.filePath, "utf8");
      const readbackProjects = parseProjects(readback, this.options.filePath);
      if (!same(readbackProjects, committed)) throw new Error("PROJECTS_JSON_DURABLE_READBACK_MISMATCH");
      const revision = fileRevision(readback);

      // Keep repeat saves from the same caller bound to the committed revision.
      projects.splice(0, projects.length, ...readbackProjects);
      const nextMetadata = { targetRevision: revision, baseline: cloneJson(readbackProjects) };
      this.snapshots.set(projects, nextMetadata);
      committedResult = { projects, revision };
    } catch (error) {
      this.abandonWriteLock(lock);
      throw error;
    }
    try {
      this.releaseWriteLock(lock);
    } catch (error) {
      // The JSON replacement and readback already succeeded. Preserve that
      // fact explicitly so callers never mistake a mutex-release failure for
      // an uncommitted registry mutation.
      throw new ProjectsJsonCommittedLockReleaseError(
        committedResult.revision,
        cloneJson(committedResult.projects),
        error,
      );
    }
    return committedResult;
  }

  revisionOf(projects: ProjectRecord[]): string | null {
    return this.snapshots.get(projects)?.targetRevision ?? null;
  }

  private acquireWriteLock(): ProjectsJsonLockHandle {
    const directory = dirname(this.options.filePath);
    mkdirSync(directory, { recursive: true });
    const timeoutMs = this.options.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
      throw new Error("PROJECTS_JSON_LOCK_CONFIGURATION_INVALID");
    }
    const processIdentity = observeProcessIdentity(process.pid);
    if (!processIdentity) throw new Error("PROJECTS_JSON_LOCK_PROCESS_IDENTITY_UNAVAILABLE");
    const record: ProjectsJsonLockRecord = {
      schema: "mission-control.projects-json-lock.v1",
      lockVersion: 1,
      ownerToken: randomUUID(),
      processIdentity,
      acquiredAt: new Date().toISOString(),
    };
    const databasePath = `${this.options.filePath}.lock.sqlite`;
    const database = new DatabaseSync(databasePath);
    try {
      restrictSqliteLockFilePermissions(databasePath);
      database.exec(`PRAGMA busy_timeout = ${timeoutMs}`);
      database.exec(`
        CREATE TABLE IF NOT EXISTS projects_json_lock_owner (
          singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
          schema TEXT NOT NULL,
          lock_version INTEGER NOT NULL,
          owner_token TEXT NOT NULL,
          pid INTEGER NOT NULL,
          process_started_at TEXT NOT NULL,
          process_group_id INTEGER NOT NULL,
          source TEXT NOT NULL,
          acquired_at TEXT NOT NULL
        ) STRICT
      `);
      // SQLite's kernel-backed write lock is the authority. If this process
      // crashes, the OS closes the descriptor and SQLite rolls back, so no
      // heuristic stale-file deletion or PID-only reaping exists.
      database.exec("BEGIN IMMEDIATE");
      database.prepare(`
        INSERT INTO projects_json_lock_owner (
          singleton, schema, lock_version, owner_token, pid,
          process_started_at, process_group_id, source, acquired_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(singleton) DO UPDATE SET
          schema = excluded.schema,
          lock_version = excluded.lock_version,
          owner_token = excluded.owner_token,
          pid = excluded.pid,
          process_started_at = excluded.process_started_at,
          process_group_id = excluded.process_group_id,
          source = excluded.source,
          acquired_at = excluded.acquired_at
      `).run(
        record.schema,
        record.lockVersion,
        record.ownerToken,
        record.processIdentity.pid,
        record.processIdentity.processStartedAt,
        record.processIdentity.processGroupId,
        record.processIdentity.source,
        record.acquiredAt,
      );
      restrictSqliteLockFilePermissions(databasePath);
      const readback = database.prepare(`
        SELECT owner_token, pid, process_started_at, process_group_id, source
        FROM projects_json_lock_owner WHERE singleton = 1
      `).get() as Record<string, unknown> | undefined;
      if (!readback
        || readback.owner_token !== record.ownerToken
        || readback.pid !== record.processIdentity.pid
        || readback.process_started_at !== record.processIdentity.processStartedAt
        || readback.process_group_id !== record.processIdentity.processGroupId
        || readback.source !== record.processIdentity.source) {
        throw new Error("PROJECTS_JSON_LOCK_IDENTITY_READBACK_MISMATCH");
      }
      return { database, record };
    } catch (error) {
      try { database.exec("ROLLBACK"); } catch { /* no active transaction */ }
      database.close();
      if ((error as { code?: string }).code === "ERR_SQLITE_ERROR"
        && /(?:database is locked|SQLITE_BUSY)/i.test(String((error as Error).message))) {
        throw new Error("PROJECTS_JSON_LOCK_TIMEOUT", { cause: error });
      }
      throw error;
    }
  }

  private releaseWriteLock(lock: ProjectsJsonLockHandle): void {
    try {
      const current = lock.database.prepare(`
        SELECT owner_token, pid, process_started_at, process_group_id, source
        FROM projects_json_lock_owner WHERE singleton = 1
      `).get() as Record<string, unknown> | undefined;
      if (!current
        || current.owner_token !== lock.record.ownerToken
        || current.pid !== lock.record.processIdentity.pid
        || current.process_started_at !== lock.record.processIdentity.processStartedAt
        || current.process_group_id !== lock.record.processIdentity.processGroupId
        || current.source !== lock.record.processIdentity.source) {
        throw new Error("PROJECTS_JSON_LOCK_OWNERSHIP_LOST");
      }
      lock.database.exec("COMMIT");
    } finally {
      lock.database.close();
    }
  }

  private abandonWriteLock(lock: ProjectsJsonLockHandle): void {
    try { lock.database.exec("ROLLBACK"); } catch { /* close still releases the kernel lock */ }
    try { lock.database.close(); } catch { /* preserve the primary save failure */ }
  }

  private writeDurably(serialized: string): void {
    const directory = dirname(this.options.filePath);
    mkdirSync(directory, { recursive: true });
    const temporary = `${this.options.filePath}.${process.pid}.${randomUUID()}.tmp`;
    let fileDescriptor: number | undefined;
    try {
      fileDescriptor = openSync(temporary, "wx", 0o600);
      writeFileSync(fileDescriptor, serialized);
      fsyncSync(fileDescriptor);
      closeSync(fileDescriptor);
      fileDescriptor = undefined;
      renameSync(temporary, this.options.filePath);
      fsyncDirectory(directory);
    } catch (error) {
      if (fileDescriptor !== undefined) {
        try { closeSync(fileDescriptor); } catch { /* cleanup */ }
      }
      try { unlinkSync(temporary); } catch { /* cleanup */ }
      throw error;
    }
  }
}
