import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import test from "node:test";

import express from "express";

import runsRouter, {
  operationalActionCliArgs,
  operationalActionCliFailure,
} from "./runs.js";

test("Mission Control forwards the authorized canonical snapshot hash to Setfarm CAS", () => {
  const snapshotHash = "a".repeat(64);
  assert.deepEqual(operationalActionCliArgs("stop", "run-1", snapshotHash), [
    "workflow", "stop", "run-1", "--expected-snapshot-hash", snapshotHash, "--force",
  ]);
  assert.deepEqual(operationalActionCliArgs("resume", "run-1", snapshotHash), [
    "workflow", "resume", "run-1", "--expected-snapshot-hash", snapshotHash,
  ]);
  assert.throws(
    () => operationalActionCliArgs("stop", "run-1", "not-a-hash"),
    /OPERATIONAL_ACTION_SNAPSHOT_HASH_INVALID/,
  );
});

test("Setfarm CAS conflicts become a refresh-required HTTP 409 boundary", () => {
  assert.deepEqual(operationalActionCliFailure({
    message: "setfarm exited 1",
    stderr: "RUN_OPERATIONAL_ACTION_STALE_SNAPSHOT: expected snapshot no longer matches",
  }), {
    statusCode: 409,
    code: "RUN_OPERATIONAL_ACTION_STALE_SNAPSHOT",
    reason: "Canonical run state changed or no longer authorizes this action. Refresh operational evidence before retrying.",
  });
  assert.deepEqual(operationalActionCliFailure({
    stderr: "RUN_OPERATIONAL_ACTION_CONFLICT",
  })?.statusCode, 409);
  assert.equal(operationalActionCliFailure({ stderr: "DATABASE_CONNECTION_FAILED" }), null);
  assert.equal(operationalActionCliFailure({
    stderr: "RUN_OPERATIONAL_ACTION_EXPECTED_SNAPSHOT_HASH_INVALID",
  }), null, "an MC-generated malformed CAS token is an internal bug, not a refresh conflict");
});

test("Mission Control exposes no direct retry, unstick, autofix, skip, or run-delete owner", async (t) => {
  const app = express();
  app.use(express.json());
  app.use("/api", runsRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}/api/runs/run-1`;

  const actions: Array<{ path: string; method: "POST" | "DELETE"; expectedCode: string }> = [
    { path: "/retry", method: "POST", expectedCode: "SETFARM_RECOVERY_OWNER_REQUIRED" },
    { path: "/unstick", method: "POST", expectedCode: "SETFARM_RECOVERY_OWNER_REQUIRED" },
    { path: "/autofix", method: "POST", expectedCode: "SETFARM_RECOVERY_OWNER_REQUIRED" },
    { path: "/skip-story", method: "POST", expectedCode: "SETFARM_RECOVERY_OWNER_REQUIRED" },
    { path: "", method: "DELETE", expectedCode: "SETFARM_OPERATIONAL_HISTORY_IMMUTABLE" },
  ];

  for (const action of actions) {
    const response = await fetch(`${base}${action.path}`, {
      method: action.method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 405, `${action.method} ${action.path || "/"}`);
    const body = await response.json() as { code?: string };
    assert.equal(body.code, action.expectedCode);
  }
});

test("project lifecycle cannot erase canonical Setfarm operational history", () => {
  const projectsRoute = readFileSync(new URL("./projects.ts", import.meta.url), "utf8");
  const setfarmDb = readFileSync(new URL("../utils/setfarm-db.ts", import.meta.url), "utf8");
  assert.doesNotMatch(projectsRoute, /deleteRunsByProject|DELETE\s+FROM\s+(?:runs|steps|stories|claim_log)/i);
  assert.doesNotMatch(setfarmDb, /DELETE\s+FROM\s+(?:runs|steps|stories|claim_log)/i);
  assert.match(projectsRoute, /Setfarm operational history preserved/);
});
