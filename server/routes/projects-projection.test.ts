import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  readProjectApiProjections,
  toProjectApiProjection,
} from "./projects.js";
import type { ProjectExecutionState } from "../services/project-execution-state.js";

const unboundExecution: ProjectExecutionState = {
  schema: "mission-control.project-execution.v1",
  state: "unbound",
  active: false,
  runId: null,
  runStatus: null,
  protocol: null,
  source: "none",
  reasonCode: "PROJECT_RUN_NOT_FOUND",
};

test("publishes one zero-input projected collection reader used by the list route", () => {
  assert.equal(typeof readProjectApiProjections, "function");
  assert.equal(readProjectApiProjections.length, 0);
  const source = readFileSync(new URL("./projects.ts", import.meta.url), "utf8");
  assert.match(source, /router\.get\("\/projects"[\s\S]*?await readProjectApiProjections\(\)/);
  assert.match(source, /const bindings = bindProjectRuns\(snapshots\.map\(\(snapshot\) => snapshot\.bindingHints\), runRows\)/);
  assert.doesNotMatch(source, /snapshots\.map\(\(snapshot\) => deriveProjectExecutionState\(\s*bindProjectRun/);
});

test("list projection preserves bound identities and only explicitly hides synthesized cancelled history", async (t) => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "mc-project-projection-"));
  t.after(() => rmSync(temporaryRoot, { recursive: true, force: true }));
  const projectsPath = join(temporaryRoot, "projects.json");
  writeFileSync(projectsPath, JSON.stringify([{
    id: "shared-project",
    name: "Shared Project",
    status: "active",
    serviceStatus: "unknown",
    createdBy: "setfarm-workflow",
    category: "setfarm",
    repo: "/repos/shared-project",
    latestRunId: "run-snapshot",
    workflowRunId: "run-snapshot",
    setfarmRunIds: ["run-snapshot"],
    latestRunNumber: 7,
    runNumber: 7,
  }, ...["duplicate-a", "duplicate-b"].map((id) => ({
    id,
    name: id,
    status: "active",
    serviceStatus: "unknown",
    createdBy: "setfarm-workflow",
    category: "setfarm",
    repo: "/repos/" + id,
    latestRunId: "run-conflict",
    workflowRunId: "run-conflict",
    setfarmRunIds: ["run-conflict"],
    latestRunNumber: 8,
    runNumber: 8,
  }))]) + "\n");

  const fixture = String.raw`
import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import express from "express";

const runs = [
  {
    id: "run-conflict", run_number: 8, protocol: "v3", status: "running",
    task: "Build Duplicate A", context: JSON.stringify({ project_slug: "duplicate-a", repo: "/repos/duplicate-a" }),
    created_at: "2026-08-17T08:00:00.000Z", updated_at: "2026-08-17T08:01:00.000Z",
  },
  {
    id: "run-snapshot", run_number: 7, protocol: "legacy", status: "running",
    task: "Build Shared Project", context: JSON.stringify({ project_slug: "shared-project", repo: "/repos/shared-project" }),
    created_at: "2026-08-17T07:00:00.000Z", updated_at: "2026-08-17T07:01:00.000Z",
  },
  {
    id: "run-unrelated", run_number: 12, protocol: "legacy", status: "failed",
    task: "Repair Shared Project", context: JSON.stringify({ project_slug: "shared-project", repo: "/repos/shared-project" }),
    created_at: "2026-08-17T12:00:00.000Z", updated_at: "2026-08-17T12:01:00.000Z",
  },
  {
    id: "run-cancelled", run_number: 9, protocol: "legacy", status: "cancelled",
    task: "Build Cancelled History", context: JSON.stringify({ project_slug: "cancelled-history", repo: "/repos/cancelled-history" }),
    created_at: "2026-08-17T09:00:00.000Z", updated_at: "2026-08-17T09:01:00.000Z",
  },
];

async function sql(strings) {
  const query = strings.join("?");
  if (/SELECT id, run_number, protocol, status, updated_at/.test(query)) {
    return runs.map((run) => ({
      id: run.id, run_number: run.run_number, protocol: run.protocol,
      status: run.status, updated_at: run.updated_at,
    }));
  }
  if (/SELECT \* FROM runs/.test(query)) return runs.map((run) => ({ ...run }));
  if (/FROM steps|FROM stories/.test(query)) return [];
  throw new Error("unexpected SQL: " + query);
}

test("route projection", async (context) => {
  context.mock.module(process.env.MC_PG_URL, { exports: { sql } });
  context.mock.module(process.env.MC_SUPERVISOR_URL, {
    exports: { getSupervisorSummaryForRun: async () => ({ state: "observed" }) },
  });
  const { default: projectsRouter } = await import(process.env.MC_PROJECTS_URL + "?authority-regression");
  const app = express();
  app.use(express.json());
  app.use("/api", projectsRouter);
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = "http://127.0.0.1:" + address.port + "/api/projects";

  const defaultResponse = await fetch(base);
  assert.equal(defaultResponse.status, 200);
  const projects = await defaultResponse.json();
  const bound = projects.find((project) => project.id === "shared-project");
  assert.ok(bound);
  assert.ok(
    projects.some((project) => project.id === "cancelled-history" && project.status === "cancelled"),
    "cancelled history missing from default projection",
  );
  assert.equal(bound.execution.runId, "run-snapshot");
  assert.equal(bound.latestRunId, "run-snapshot");
  assert.equal(bound.workflowRunId, "run-snapshot");
  assert.deepEqual(bound.setfarmRunIds, ["run-snapshot"]);
  assert.equal(bound.latestRunNumber, 7);
  assert.equal(bound.runNumber, 7);
  for (const id of ["duplicate-a", "duplicate-b"]) {
    const conflicted = projects.find((project) => project.id === id);
    assert.ok(conflicted, id);
    assert.deepEqual(conflicted.execution, {
      schema: "mission-control.project-execution.v1",
      state: "unavailable",
      active: false,
      runId: null,
      runStatus: null,
      protocol: null,
      source: "none",
      reasonCode: "PROJECT_RUN_IDENTITY_CONFLICT",
    });
    assert.equal(conflicted.status, "registered");
  }

  const hiddenResponse = await fetch(base + "?hideTerminal=1");
  assert.equal(hiddenResponse.status, 200);
  const visible = await hiddenResponse.json();
  assert.ok(visible.some((project) => project.id === "shared-project"), "active project unexpectedly hidden");
  assert.ok(!visible.some((project) => project.id === "cancelled-history"), "cancelled project not hidden explicitly");
});
`;

  const childEnvironment = { ...process.env };
  delete childEnvironment.NODE_TEST_CONTEXT;
  const result = await new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [
      "--experimental-test-module-mocks",
      "--import",
      "tsx",
      "--input-type=module",
      "--eval",
      fixture,
    ], {
      env: {
        ...childEnvironment,
        PROJECTS_JSON: projectsPath,
        MC_PROJECTS_URL: new URL("./projects.ts", import.meta.url).href,
        MC_PG_URL: new URL("../utils/pg.ts", import.meta.url).href,
        MC_SUPERVISOR_URL: new URL("../utils/supervisor.ts", import.meta.url).href,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (exitCode) => resolve({ exitCode: exitCode ?? -1, stdout, stderr }));
  });
  assert.equal(result.exitCode, 0, `${result.stdout}${result.stderr}`);
});

function boundExecution(
  runStatus: string,
  state: string = "terminal",
): ProjectExecutionState {
  return {
    schema: "mission-control.project-execution.v1",
    state: state as ProjectExecutionState["state"],
    active: state !== "terminal",
    runId: "run-42",
    runStatus,
    protocol: "v3",
    source: "setfarm_postgres_run",
    reasonCode: state === "terminal" ? "PROJECT_RUN_TERMINAL" : "PROJECT_RUN_BOUND",
  };
}

test("legacy registry active is registered when no Setfarm execution is bound", () => {
  const projected = toProjectApiProjection({
    id: "old-card",
    status: "active",
    serviceStatus: "inactive",
    createdBy: "setfarm-workflow",
  }, unboundExecution);

  assert.equal(projected.status, "registered");
  assert.equal(projected.execution.active, false);
  assert.deepEqual(projected.runtime, {
    state: "inactive",
    checkedAt: null,
    reasonCode: "PROJECT_RUNTIME_LEGACY_SERVICE_STATUS_INACTIVE",
  });
  assert.equal(projected.receipt, null);
});

test("only exact Setfarm active execution makes a legacy catalog project building", () => {
  for (const state of ["running", "resuming", "cancelling", "failing"] as const) {
    const projected = toProjectApiProjection({
      id: `legacy-${state}`,
      status: "active",
      serviceStatus: "active",
    }, boundExecution(state, state));

    assert.equal(projected.status, "building", state);
    assert.equal(projected.execution.state, state);
    assert.equal(projected.execution.active, true);
    assert.equal(projected.runtime.state, "active");
  }
});

test("unbound legacy terminal catalog states remain visible without inventing runtime", () => {
  const cases = [
    { persisted: "failed", expected: "failed" },
    { persisted: "error", expected: "failed" },
    { persisted: "completed", expected: "completed" },
    { persisted: "done", expected: "completed" },
  ] as const;

  for (const fixture of cases) {
    const projected = toProjectApiProjection({
      id: `legacy-${fixture.persisted}`,
      status: fixture.persisted,
      serviceStatus: "building",
    }, unboundExecution);
    assert.equal(projected.status, fixture.expected, fixture.persisted);
    assert.deepEqual(projected.runtime, {
      state: "unknown",
      checkedAt: null,
      reasonCode: "PROJECT_RUNTIME_LEGACY_SERVICE_STATUS_UNKNOWN",
    }, fixture.persisted);
  }
});

test("terminal execution maps failed and both cancellation spellings exactly", () => {
  const cases = [
    { runStatus: "completed", expected: "completed" },
    { runStatus: "done", expected: "completed" },
    { runStatus: "failed", expected: "failed" },
    { runStatus: "cancelled", expected: "cancelled" },
    { runStatus: "canceled", expected: "cancelled" },
  ] as const;

  for (const fixture of cases) {
    const projected = toProjectApiProjection({
      id: `terminal-${fixture.runStatus}`,
      status: "active",
      serviceStatus: "unknown",
    }, boundExecution(fixture.runStatus));
    assert.equal(projected.status, fixture.expected, fixture.runStatus);
    assert.equal(projected.execution.state, "terminal", fixture.runStatus);
  }
});

test("active resuming execution overrides a stale failed catalog state", () => {
  const projected = toProjectApiProjection({
    id: "resuming-project",
    status: "failed",
    serviceStatus: "inactive",
  }, boundExecution("resuming", "resuming"));

  assert.equal(projected.status, "building");
  assert.equal(projected.execution.state, "resuming");
  assert.equal(projected.execution.active, true);
});

test("canonical receipt stays immutable while execution and observed runtime change", () => {
  const projectionHash = "a".repeat(64);
  const projectRecordHash = "b".repeat(64);
  const persisted = {
    id: "canonical-project",
    name: "Canonical Project",
    productCompilerProtocol: "v3",
    createdBy: "setfarm-v3-terminal-projector",
    status: "active",
    serviceStatus: "active",
    canonicalProjectionHash: projectionHash,
    canonicalProjectRecordHash: projectRecordHash,
    observedServiceStatus: "inactive",
    observedServiceCheckedAt: "2026-08-17T10:00:00.000Z",
    observedServiceReasonCode: "V3_DEPLOYMENT_PROCESS_NOT_RUNNING",
  };
  const before = structuredClone(persisted);

  const projected = toProjectApiProjection(persisted, boundExecution("completed"));

  assert.equal(projected.status, "completed");
  assert.deepEqual(projected.execution, boundExecution("completed"));
  assert.deepEqual(projected.runtime, {
    state: "inactive",
    checkedAt: "2026-08-17T10:00:00.000Z",
    reasonCode: "V3_DEPLOYMENT_PROCESS_NOT_RUNNING",
  });
  assert.deepEqual(projected.receipt, {
    status: "active",
    serviceStatus: "active",
    projectionHash,
    projectRecordHash,
  });
  assert.deepEqual(persisted, before);
  assert.notEqual(projected, persisted);
});

test("canonical missing observation is unknown and never falls back to receipt service status", () => {
  const projected = toProjectApiProjection({
    id: "canonical-unobserved",
    productCompilerProtocol: "v3",
    createdBy: "setfarm-v3-terminal-projector",
    status: "active",
    serviceStatus: "active",
    canonicalProjectionHash: "c".repeat(64),
    canonicalProjectRecordHash: "d".repeat(64),
  }, unboundExecution);

  assert.equal(projected.status, "registered");
  assert.deepEqual(projected.runtime, {
    state: "unknown",
    checkedAt: null,
    reasonCode: "V3_DEPLOYMENT_OBSERVATION_UNAVAILABLE",
  });
  assert.equal(projected.receipt?.serviceStatus, "active");
});

test("fails closed when execution active membership and transition state disagree", () => {
  const inactiveRunning: ProjectExecutionState = {
    ...boundExecution("running", "running"),
    active: false,
  };
  const activeTerminal: ProjectExecutionState = {
    ...boundExecution("running", "running"),
    state: "terminal",
  };

  assert.throws(
    () => toProjectApiProjection({ status: "active" }, inactiveRunning),
    /PROJECT_EXECUTION_ACTIVE_RELATION_INVALID/,
  );
  assert.throws(
    () => toProjectApiProjection({ status: "active" }, activeTerminal),
    /PROJECT_EXECUTION_ACTIVE_RELATION_INVALID/,
  );
});

test("fails closed when terminal execution has no exact terminal run status", () => {
  assert.throws(
    () => toProjectApiProjection({ status: "completed" }, boundExecution("pending")),
    /PROJECT_EXECUTION_TERMINAL_STATUS_INVALID/,
  );
  assert.throws(
    () => toProjectApiProjection({ status: "completed" }, {
      ...boundExecution("completed"),
      runStatus: null,
    }),
    /PROJECT_EXECUTION_TERMINAL_STATUS_INVALID/,
  );
  assert.throws(
    () => toProjectApiProjection({ status: "completed" }, boundExecution("error")),
    /PROJECT_EXECUTION_TERMINAL_STATUS_INVALID/,
  );
});

test("fails closed for every corrupted canonical receipt authority field", () => {
  const valid = {
    id: "canonical-project",
    productCompilerProtocol: "v3",
    createdBy: "setfarm-v3-terminal-projector",
    status: "active",
    serviceStatus: "active",
    canonicalProjectionHash: "e".repeat(64),
    canonicalProjectRecordHash: "f".repeat(64),
  };
  const corruptions: Record<string, unknown>[] = [
    { status: "completed" },
    { serviceStatus: "inactive" },
    { canonicalProjectionHash: "E".repeat(64) },
    { canonicalProjectionHash: "e".repeat(63) },
    { canonicalProjectRecordHash: "not-a-hash" },
  ];

  for (const corruption of corruptions) {
    assert.throws(
      () => toProjectApiProjection({ ...valid, ...corruption }, unboundExecution),
      /PROJECT_API_CANONICAL_RECEIPT_INVALID/,
      JSON.stringify(corruption),
    );
  }
});

test("returns a clone and does not mutate nested execution or persisted values", () => {
  const persisted = {
    id: "clone-project",
    status: "active",
    serviceStatus: "unknown",
    metadata: { owner: "setrox" },
  };
  const execution = structuredClone(unboundExecution);
  const persistedBefore = structuredClone(persisted);
  const executionBefore = structuredClone(execution);

  const projected = toProjectApiProjection(persisted, execution);

  assert.deepEqual(persisted, persistedBefore);
  assert.deepEqual(execution, executionBefore);
  assert.notEqual(projected, persisted);
  assert.notEqual(projected.execution, execution);
  assert.deepEqual(projected.metadata, { owner: "setrox" });
});
