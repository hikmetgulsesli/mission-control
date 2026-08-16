import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  selectOperationalActiveProjects,
  selectRecentRuntimeProjects,
} from "./overview.js";

function project(id: string, state: string, overrides: Record<string, unknown> = {}): any {
  return {
    id,
    name: id,
    status: state === "terminal" ? "completed" : state === "unbound" ? "registered" : "building",
    createdAt: "2026-08-17T08:00:00.000Z",
    ports: {},
    execution: {
      schema: "mission-control.project-execution.v1",
      state,
      active: ["running", "resuming", "cancelling", "failing"].includes(state),
      runId: state === "unbound" ? null : `run-${id}`,
      runStatus: state === "terminal" ? "completed" : state === "unbound" ? null : state,
      protocol: state === "unbound" ? null : "v3",
      source: state === "unbound" ? "none" : "setfarm_postgres_run",
      reasonCode: state === "terminal" ? "PROJECT_RUN_TERMINAL" : state === "unbound" ? "PROJECT_RUN_NOT_FOUND" : "PROJECT_RUN_BOUND",
    },
    runtime: { state: "inactive", checkedAt: null, reasonCode: "PROJECT_RUNTIME_LEGACY_SERVICE_STATUS_INACTIVE" },
    receipt: null,
    ...overrides,
  };
}

test("operational projects require exact active equality and distinct projected run identity", () => {
  const exact = ["running", "resuming", "cancelling", "failing"].map((state) => project(state, state));
  const rawActiveHistorical = project("historical", "unbound", { serviceStatus: "active" });
  const pending = project("pending", "pending");
  const terminal = project("terminal", "terminal");
  const disagreement = project("disagreement", "running", {
    execution: {
      ...project("disagreement", "running").execution,
      state: "resuming",
      runStatus: "running",
    },
  });
  const duplicateRun = project("duplicate", "running", {
    execution: { ...project("duplicate", "running").execution, runId: "run-running" },
  });

  assert.deepEqual(
    selectOperationalActiveProjects([
      rawActiveHistorical, pending, terminal, disagreement, duplicateRun, ...exact,
    ]).map((candidate) => candidate.execution.runId),
    ["run-running", "run-resuming", "run-cancelling", "run-failing"],
  );
});

test("recent runtime projects include terminal catalog records with valid frontend or main ports", () => {
  const candidates = Array.from({ length: 8 }, (_, index) => project(`candidate-${index}`, "terminal", {
    createdAt: `2026-08-${String(index + 1).padStart(2, "0")}T08:00:00.000Z`,
    ports: index % 2 === 0 ? { frontend: 4100 + index } : { main: 4100 + index },
  }));
  candidates.push(project("invalid-zero", "running", { ports: { frontend: 0 } }));
  candidates.push(project("invalid-large", "running", { ports: { main: 65536 } }));
  candidates.push(project("backend-only", "running", { ports: { backend: 4200 } }));

  const recent = selectRecentRuntimeProjects(candidates);
  assert.deepEqual(recent.map((candidate) => candidate.id), [
    "candidate-7", "candidate-6", "candidate-5", "candidate-4", "candidate-3", "candidate-2",
  ]);
  assert.ok(recent.every((candidate) => candidate.status === "completed"));
});

test("overview returns only raw runs agreeing with projected active identity and probes completed runtime candidates", async (t) => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "mc-overview-"));
  t.after(() => rmSync(temporaryRoot, { recursive: true, force: true }));
  const dataPath = join(temporaryRoot, "data.json");
  writeFileSync(dataPath, "{}\n");

  const fixture = String.raw`
import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import express from "express";

test("overview projection boundary", async (context) => {
  const runtimeServer = createServer((_request, response) => response.end("ok"));
  await new Promise((resolve) => runtimeServer.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve, reject) => runtimeServer.close((error) => error ? reject(error) : resolve())));
  const runtimeAddress = runtimeServer.address();
  assert.ok(runtimeAddress && typeof runtimeAddress === "object");

  const execution = (state, runId, runStatus = state) => ({
    schema: "mission-control.project-execution.v1", state, active: true,
    runId, runStatus, protocol: "v3", source: "setfarm_postgres_run", reasonCode: "PROJECT_RUN_BOUND",
  });
  const projected = [
    { id: "accepted", name: "Accepted", status: "building", createdAt: "2026-08-17T10:00:00.000Z", ports: {}, execution: execution("running", "run-accepted"), runtime: { state: "inactive", checkedAt: null, reasonCode: "x" }, receipt: null },
    { id: "raw-pending", name: "Raw Pending", status: "building", createdAt: "2026-08-17T09:00:00.000Z", ports: {}, execution: execution("resuming", "run-raw-pending"), runtime: { state: "inactive", checkedAt: null, reasonCode: "x" }, receipt: null },
    { id: "disagreement", name: "Disagreement", status: "building", createdAt: "2026-08-17T08:00:00.000Z", ports: {}, execution: execution("failing", "run-disagreement"), runtime: { state: "inactive", checkedAt: null, reasonCode: "x" }, receipt: null },
    { id: "completed-live", name: "Completed Live", status: "completed", createdAt: "2026-08-17T11:00:00.000Z", ports: { frontend: runtimeAddress.port }, execution: { schema: "mission-control.project-execution.v1", state: "terminal", active: false, runId: "run-completed", runStatus: "completed", protocol: "v3", source: "setfarm_postgres_run", reasonCode: "PROJECT_RUN_TERMINAL" }, runtime: { state: "active", checkedAt: null, reasonCode: "x" }, receipt: null },
  ];
  const runs = [
    { id: "run-accepted", status: "running", workflow: "feature-dev", task: "accepted" },
    { id: "run-raw-pending", status: "pending", workflow: "feature-dev", task: "pending" },
    { id: "run-disagreement", status: "cancelling", workflow: "feature-dev", task: "wrong" },
    { id: "run-unbound", status: "running", workflow: "feature-dev", task: "unbound" },
  ];

  context.mock.module(process.env.MC_PROJECTS_MODULE, { exports: { readProjectApiProjections: async () => projected } });
  context.mock.module(process.env.MC_SETFARM_MODULE, { exports: { getRuns: async () => runs } });
  context.mock.module(process.env.MC_CLI_MODULE, { exports: { runCliJson: async () => [], runCli: async () => "[]" } });
  context.mock.module(process.env.MC_METRICS_MODULE, { exports: { getSystemMetrics: async () => null } });

  const { default: overviewRouter } = await import(process.env.MC_OVERVIEW_MODULE + "?projection-boundary");
  const app = express();
  app.use("/api", overviewRouter);
  const appServer = createServer(app);
  await new Promise((resolve) => appServer.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve, reject) => appServer.close((error) => error ? reject(error) : resolve())));
  const address = appServer.address();
  assert.ok(address && typeof address === "object");
  const response = await fetch("http://127.0.0.1:" + address.port + "/api/overview");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.activeRuns.map((run) => run.id), ["run-accepted"]);
  assert.equal(body.activeRunCount, 1);
  assert.deepEqual(body.recentDeploys, [{
    id: "completed-live", name: "Completed Live", port: runtimeAddress.port,
    subdomain: "", online: true, emoji: "",
  }]);
});
`;

  const childEnvironment = { ...process.env };
  delete childEnvironment.NODE_TEST_CONTEXT;
  const result = await new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [
      "--experimental-test-module-mocks",
      "--import", "tsx",
      "--input-type=module",
      "--eval", fixture,
    ], {
      env: {
        ...childEnvironment,
        DATA_JSON: dataPath,
        PROJECTS_JSON: join(temporaryRoot, "must-not-be-read.json"),
        MC_OVERVIEW_MODULE: new URL("./overview.ts", import.meta.url).href,
        MC_PROJECTS_MODULE: new URL("./projects.ts", import.meta.url).href,
        MC_SETFARM_MODULE: new URL("../utils/setfarm.ts", import.meta.url).href,
        MC_CLI_MODULE: new URL("../utils/cli.ts", import.meta.url).href,
        MC_METRICS_MODULE: new URL("../utils/prometheus.ts", import.meta.url).href,
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
