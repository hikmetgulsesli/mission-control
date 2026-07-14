import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import {
  ProjectsJsonRepository,
  ProjectsJsonRevisionConflictError,
  supportsUnflaggedNodeSqlite,
} from "./projects-json-repository.js";

test("projects registry requires a Node release with unflagged node:sqlite", () => {
  assert.equal(supportsUnflaggedNodeSqlite("22.12.0"), false);
  assert.equal(supportsUnflaggedNodeSqlite("22.13.0"), true);
  assert.equal(supportsUnflaggedNodeSqlite("23.3.0"), false);
  assert.equal(supportsUnflaggedNodeSqlite("23.4.0"), true);
  assert.equal(supportsUnflaggedNodeSqlite("24.0.0"), true);
});

function fixture(t: test.TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "mc-projects-cas-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const filePath = join(directory, "projects.json");
  writeFileSync(filePath, `${JSON.stringify([
    { id: "legacy", name: "Legacy", status: "active" },
  ], null, 2)}\n`);
  return { filePath, repository: new ProjectsJsonRepository({ filePath }) };
}

test("stale legacy save preserves a concurrently committed canonical v3 project", (t) => {
  const { filePath, repository } = fixture(t);
  const stale = repository.load();
  const canonicalWriter = repository.load();

  canonicalWriter.push({
    id: "canonical-v3",
    name: "Canonical V3",
    productCompilerProtocol: "v3",
    canonicalProjectRecordHash: "a".repeat(64),
  });
  repository.save(canonicalWriter);

  stale[0]!.status = "inactive";
  const committed = repository.save(stale).projects;
  assert.deepEqual(committed.map((project) => project.id), ["legacy", "canonical-v3"]);
  assert.equal(committed[0]!.status, "inactive");
  assert.equal(committed[1]!.canonicalProjectRecordHash, "a".repeat(64));
  assert.deepEqual(JSON.parse(readFileSync(filePath, "utf8")), committed);
});

test("revision merge preserves concurrent changes to another existing record", (t) => {
  const { repository } = fixture(t);
  const seed = repository.load();
  seed.push({ id: "second", name: "Second", status: "active" });
  repository.save(seed);

  const firstWriter = repository.load();
  const secondWriter = repository.load();
  firstWriter.find((project) => project.id === "legacy")!.status = "inactive";
  repository.save(firstWriter);
  secondWriter.find((project) => project.id === "second")!.status = "inactive";
  const committed = repository.save(secondWriter).projects;

  assert.equal(committed.find((project) => project.id === "legacy")!.status, "inactive");
  assert.equal(committed.find((project) => project.id === "second")!.status, "inactive");
});

test("revision merge rejects divergent changes to the same project record", (t) => {
  const { repository } = fixture(t);
  const firstWriter = repository.load();
  const secondWriter = repository.load();
  firstWriter[0]!.status = "inactive";
  repository.save(firstWriter);
  secondWriter[0]!.status = "failed";

  assert.throws(
    () => repository.save(secondWriter),
    (error: unknown) => error instanceof ProjectsJsonRevisionConflictError
      && error.projectId === "legacy",
  );
  assert.equal(repository.load()[0]!.status, "inactive");
});

test("derived-array removal remains bound to the source file revision", (t) => {
  const { repository } = fixture(t);
  const source = repository.load();
  const removed = source.filter((project) => project.id !== "legacy");
  const committed = repository.save(removed, source).projects;
  assert.deepEqual(committed, []);

  // The derived result owns the new revision. The stale source must not be
  // rebound to bytes that no longer describe its in-memory contents.
  source[0]!.status = "failed";
  assert.throws(
    () => repository.save(source),
    (error: unknown) => error instanceof ProjectsJsonRevisionConflictError
      && error.projectId === "legacy",
  );
});

async function waitUntil(predicate: () => boolean, timeoutMs = 10_000): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("TEST_BARRIER_TIMEOUT");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test("cross-process CAS preserves every writer that loaded the same baseline", async (t) => {
  const { filePath } = fixture(t);
  const barrierDirectory = `${filePath}.barrier`;
  const moduleUrl = pathToFileURL(join(process.cwd(), "server/services/projects-json-repository.ts")).href;
  const workerSource = `
    import { existsSync, mkdirSync, writeFileSync } from "node:fs";
    import { join } from "node:path";
    const { ProjectsJsonRepository } = await import(process.env.MC_REPOSITORY_MODULE_URL);
    const id = process.env.MC_WRITER_ID;
    const filePath = process.env.MC_PROJECTS_FILE;
    const barrier = process.env.MC_BARRIER_DIRECTORY;
    mkdirSync(barrier, { recursive: true });
    const repository = new ProjectsJsonRepository({ filePath, lockTimeoutMs: 15000 });
    const projects = repository.load();
    writeFileSync(join(barrier, id + ".ready"), "ready");
    while (!existsSync(join(barrier, "start"))) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
    }
    projects.push({ id, name: id, status: "active" });
    repository.save(projects);
  `;
  const children: ChildProcess[] = [];
  const exits: Array<Promise<void>> = [];
  t.after(() => {
    for (const child of children) {
      if (child.exitCode === null) child.kill("SIGKILL");
    }
  });

  for (let index = 0; index < 8; index += 1) {
    const id = `writer-${index}`;
    const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", workerSource], {
      env: {
        ...process.env,
        MC_REPOSITORY_MODULE_URL: moduleUrl,
        MC_WRITER_ID: id,
        MC_PROJECTS_FILE: filePath,
        MC_BARRIER_DIRECTORY: barrierDirectory,
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    children.push(child);
    exits.push(new Promise((resolve, reject) => {
      let stderr = "";
      child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
      child.once("error", reject);
      child.once("exit", (code, signal) => {
        if (code === 0) resolve();
        else reject(new Error(`writer ${id} exited ${String(code ?? signal)}: ${stderr}`));
      });
    }));
  }

  await waitUntil(() => Array.from({ length: 8 }, (_, index) =>
    existsSync(join(barrierDirectory, `writer-${index}.ready`))).every(Boolean));
  writeFileSync(join(barrierDirectory, "start"), "start");
  await Promise.all(exits);

  const committed = JSON.parse(readFileSync(filePath, "utf8")) as Array<Record<string, unknown>>;
  assert.deepEqual(
    committed.map((project) => String(project.id)).sort(),
    ["legacy", ...Array.from({ length: 8 }, (_, index) => `writer-${index}`)].sort(),
  );
  for (const candidate of [
    `${filePath}.lock.sqlite`,
    `${filePath}.lock.sqlite-journal`,
    `${filePath}.lock.sqlite-wal`,
    `${filePath}.lock.sqlite-shm`,
  ]) {
    if (existsSync(candidate)) assert.equal(statSync(candidate).mode & 0o777, 0o600);
  }
});

test("SQLite kernel lock is released after a competing writer crashes", async (t) => {
  const { filePath } = fixture(t);
  const readyPath = `${filePath}.crash-owner-ready`;
  const crashHolder = spawn(process.execPath, ["--input-type=module", "-e", `
    import { DatabaseSync } from "node:sqlite";
    import { writeFileSync } from "node:fs";
    const database = new DatabaseSync(process.env.MC_LOCK_DATABASE);
    database.exec("BEGIN IMMEDIATE");
    writeFileSync(process.env.MC_READY_PATH, "locked");
    setTimeout(() => process.exit(17), 150);
  `], {
    env: {
      ...process.env,
      MC_LOCK_DATABASE: `${filePath}.lock.sqlite`,
      MC_READY_PATH: readyPath,
    },
    stdio: "ignore",
  });
  t.after(() => {
    if (crashHolder.exitCode === null) crashHolder.kill("SIGKILL");
  });
  const crashed = new Promise<number | null>((resolve, reject) => {
    crashHolder.once("error", reject);
    crashHolder.once("exit", (code) => resolve(code));
  });
  await waitUntil(() => existsSync(readyPath));

  const repository = new ProjectsJsonRepository({
    filePath,
    lockTimeoutMs: 1_000,
  });
  const projects = repository.load();
  projects[0]!.status = "recovered";
  repository.save(projects);
  assert.equal(await crashed, 17);
  assert.equal(repository.load()[0]!.status, "recovered");
});
