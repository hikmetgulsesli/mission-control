import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { PipelineRunSummary } from "../src/pages/ActiveRun.js";
import { isSetfarmOperationalActiveRunStatusV1 } from "../server/shared/setfarm-operational-active-run-status-v1.js";

(globalThis as { document?: unknown }).document = { querySelector: () => null };
const { pickActiveRun } = await import("../src/pages/ActiveRun.js");

const schema = JSON.parse(readFileSync(new URL(
  "../contracts/vendor/setfarm/operational-active-run-status.v1.schema.json",
  import.meta.url,
), "utf8")) as { enum: string[] };

function run(id: string, status: string, runNumber: number): PipelineRunSummary {
  return { id, workflow: "feature-dev", task: id, status, runNumber };
}

test("shared schema is the only Active Run status authority", () => {
  assert.deepEqual(schema.enum, ["running", "resuming", "cancelling", "failing"]);
  assert.deepEqual(
    ["running", "resuming", "cancelling", "failing", "pending", "completed", "failed", "unknown"]
      .filter(isSetfarmOperationalActiveRunStatusV1),
    schema.enum,
  );
});

test("Active Run never falls back to a terminal run", () => {
  assert.equal(pickActiveRun([
    run("failed", "failed", 9),
    run("done", "completed", 10),
  ]), null);
});

test("Active Run accepts every exact operational-active transition and selects newest", () => {
  for (const status of schema.enum) {
    assert.equal(pickActiveRun([
      run(`old-${status}`, status, 10),
      run(`new-${status}`, status, 11),
    ])?.id, `new-${status}`);
  }

  assert.equal(pickActiveRun([
    run("invented", "pending", 12),
    run("resuming", "resuming", 11),
  ])?.id, "resuming");
});

test("one run remains selected through the exact active lifecycle only", () => {
  for (const status of schema.enum) {
    assert.equal(pickActiveRun([run("run-42", status, 42)])?.id, "run-42", status);
  }
  assert.equal(pickActiveRun([run("run-42", "completed", 42)]), null);
});
