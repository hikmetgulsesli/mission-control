import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  bindProjectRun,
  bindProjectRuns,
  deriveProjectExecutionState,
  projectRunBindingHints,
  type ProjectRunRow,
} from "./project-execution-state.js";

const rows: ProjectRunRow[] = [
  { id: "run-old", runNumber: 41, protocol: "legacy", status: "failed", updatedAt: null },
  { id: "run-new", runNumber: 42, protocol: "v3", status: "running", updatedAt: null },
];

test("binds an agreed singular identity before historical collections", () => {
  const binding = bindProjectRun({
    projectId: "ledger", latestRunId: "run-new", workflowRunId: "run-new",
    setfarmRunIds: ["run-old", "run-new"], latestRunNumber: 42, runNumber: 42,
  }, rows);
  assert.equal(binding.status, "bound");
  if (binding.status === "bound") {
    assert.equal(binding.source, "latest_run_id");
    assert.equal(binding.row.id, "run-new");
  }
});

test("fails closed when singular run identities conflict", () => {
  assert.deepEqual(bindProjectRun({
    projectId: "ledger", latestRunId: "run-new", workflowRunId: "run-old",
    setfarmRunIds: ["run-old", "run-new"], latestRunNumber: 42, runNumber: 41,
  }, rows), { status: "conflict", reasonCode: "PROJECT_RUN_IDENTITY_CONFLICT" });
});

test("marks every cross-project owner of one run conflicted independent of collection order", () => {
  const ledger = {
    projectId: "ledger", latestRunId: "run-new", workflowRunId: "run-new",
    setfarmRunIds: [], latestRunNumber: null, runNumber: null,
  };
  const storefront = {
    projectId: "storefront", latestRunId: "run-new", workflowRunId: "run-new",
    setfarmRunIds: [], latestRunNumber: null, runNumber: null,
  };
  const conflict = { status: "conflict", reasonCode: "PROJECT_RUN_IDENTITY_CONFLICT" } as const;

  assert.deepEqual(bindProjectRuns([ledger, storefront], rows), [conflict, conflict]);
  assert.deepEqual(bindProjectRuns([storefront, ledger], [...rows].reverse()), [conflict, conflict]);
});

test("collection binding leaves unique and pre-existing failed bindings unchanged", () => {
  const bindings = bindProjectRuns([{
    projectId: "ledger", latestRunId: "run-new", workflowRunId: "run-new",
    setfarmRunIds: [], latestRunNumber: null, runNumber: null,
  }, {
    projectId: "history", latestRunId: "run-old", workflowRunId: "run-missing",
    setfarmRunIds: [], latestRunNumber: null, runNumber: null,
  }], rows);
  assert.equal(bindings[0]?.status, "bound");
  assert.deepEqual(bindings[1], {
    status: "conflict", reasonCode: "PROJECT_RUN_IDENTITY_CONFLICT",
  });
});

test("never upgrades an unbound historical record to active", () => {
  assert.deepEqual(deriveProjectExecutionState({
    status: "unbound", reasonCode: "PROJECT_RUN_NOT_FOUND",
  }), {
    schema: "mission-control.project-execution.v1", state: "unbound", active: false,
    runId: null, runStatus: null, protocol: null, source: "none",
    reasonCode: "PROJECT_RUN_NOT_FOUND",
  });
});

test("normalizes persisted identities with trim-only strings and positive safe integers", () => {
  assert.deepEqual(projectRunBindingHints({
    id: " ledger ", latestRunId: " run-new ", workflowRunId: " run-new ",
    setfarmRunIds: [" run-old ", "", 9, "run-new"], latestRunNumber: 42, runNumber: 41.5,
  }), {
    projectId: "ledger", latestRunId: "run-new", workflowRunId: "run-new",
    setfarmRunIds: ["run-old", "run-new"], latestRunNumber: 42, runNumber: null,
  });
});

test("rejects unequal trimmed singular string identities before row lookup", () => {
  assert.deepEqual(bindProjectRun({
    projectId: "ledger", latestRunId: " run-new ", workflowRunId: "run-old",
    setfarmRunIds: [], latestRunNumber: null, runNumber: null,
  }, []), { status: "conflict", reasonCode: "PROJECT_RUN_IDENTITY_CONFLICT" });
});

test("rejects unequal singular numeric identities before numeric binding", () => {
  assert.deepEqual(bindProjectRun({
    projectId: "ledger", latestRunId: null, workflowRunId: null,
    setfarmRunIds: [], latestRunNumber: 42, runNumber: 41,
  }, rows), { status: "conflict", reasonCode: "PROJECT_RUN_IDENTITY_CONFLICT" });
});

test("binds one singular string ID exactly and never falls back when it is absent", () => {
  assert.deepEqual(bindProjectRun({
    projectId: "ledger", latestRunId: "run-missing", workflowRunId: null,
    setfarmRunIds: ["run-new"], latestRunNumber: 42, runNumber: 42,
  }, rows), { status: "unbound", reasonCode: "PROJECT_RUN_NOT_FOUND" });

  const binding = bindProjectRun({
    projectId: "ledger", latestRunId: null, workflowRunId: "run-new",
    setfarmRunIds: ["run-old"], latestRunNumber: 41, runNumber: 41,
  }, rows);
  assert.equal(binding.status, "bound");
  if (binding.status === "bound") assert.equal(binding.source, "workflow_run_id");
});

test("selects the greatest exact historical run number only without singular identity", () => {
  const binding = bindProjectRun({
    projectId: "ledger", latestRunId: null, workflowRunId: null,
    setfarmRunIds: ["run-old", "run-new", "run-new"], latestRunNumber: 41, runNumber: 41,
  }, rows);
  assert.equal(binding.status, "bound");
  if (binding.status === "bound") {
    assert.equal(binding.source, "setfarm_run_ids");
    assert.equal(binding.row.id, "run-new");
  }
});

test("fails closed when historical identities select duplicate greatest run numbers", () => {
  assert.deepEqual(bindProjectRun({
    projectId: "ledger", latestRunId: null, workflowRunId: null,
    setfarmRunIds: ["run-a", "run-b"], latestRunNumber: null, runNumber: null,
  }, [
    { id: "run-a", runNumber: 42, protocol: "legacy", status: "failed", updatedAt: null },
    { id: "run-b", runNumber: 42, protocol: "v3", status: "running", updatedAt: null },
  ]), { status: "conflict", reasonCode: "PROJECT_RUN_IDENTITY_CONFLICT" });
});

test("uses exact numeric identity only after singular and historical identities are absent", () => {
  const binding = bindProjectRun({
    projectId: "ledger", latestRunId: null, workflowRunId: null,
    setfarmRunIds: [], latestRunNumber: 42, runNumber: 42,
  }, rows);
  assert.equal(binding.status, "bound");
  if (binding.status === "bound") {
    assert.equal(binding.source, "latest_run_number");
    assert.equal(binding.row.id, "run-new");
  }
});

test("fails closed for missing or ambiguous numeric rows", () => {
  const hints = {
    projectId: "ledger", latestRunId: null, workflowRunId: null,
    setfarmRunIds: [], latestRunNumber: null, runNumber: 42,
  };
  assert.deepEqual(bindProjectRun(hints, []), {
    status: "unbound", reasonCode: "PROJECT_RUN_NOT_FOUND",
  });
  assert.deepEqual(bindProjectRun(hints, [
    { id: "run-a", runNumber: 42, protocol: "legacy", status: "failed", updatedAt: null },
    { id: "run-b", runNumber: 42, protocol: "v3", status: "running", updatedAt: null },
  ]), { status: "conflict", reasonCode: "PROJECT_RUN_IDENTITY_CONFLICT" });
});

test("preserves every contract-defined active state across a terminal transition", () => {
  for (const status of ["running", "resuming", "cancelling", "failing"]) {
    assert.deepEqual(deriveProjectExecutionState({
      status: "bound",
      row: { id: "run-1", runNumber: 1, protocol: "v3", status, updatedAt: null },
      source: "latest_run_id",
    }), {
      schema: "mission-control.project-execution.v1", state: status, active: true,
      runId: "run-1", runStatus: status, protocol: "v3", source: "setfarm_postgres_run",
      reasonCode: "PROJECT_RUN_BOUND",
    });
  }
  for (const status of ["completed", "failed", "cancelled"]) {
    const result = deriveProjectExecutionState({
      status: "bound",
      row: { id: "run-1", runNumber: 1, protocol: "v3", status, updatedAt: null },
      source: "latest_run_id",
    });
    assert.equal(result.state, "terminal");
    assert.equal(result.active, false);
  }
});

test("does not extend the Setfarm active tuple and recognizes terminal aliases", () => {
  for (const status of ["pending", "unknown"]) {
    const result = deriveProjectExecutionState({
      status: "bound",
      row: { id: "run-1", runNumber: 1, protocol: null, status, updatedAt: null },
      source: "latest_run_id",
    });
    assert.equal(result.state, "unavailable");
    assert.equal(result.active, false);
  }
  for (const status of ["completed", "done", "failed", "cancelled", "canceled"]) {
    const result = deriveProjectExecutionState({
      status: "bound",
      row: { id: "run-1", runNumber: 1, protocol: null, status, updatedAt: null },
      source: "latest_run_id",
    });
    assert.equal(result.state, "terminal");
    assert.equal(result.active, false);
  }
});

test("uses exact parameterized run identity predicates in the database reader", () => {
  const source = readFileSync(new URL("../utils/setfarm-db.ts", import.meta.url), "utf8");
  assert.match(source, /WHERE id = ANY\(\$\{ids\}\) OR run_number = ANY\(\$\{runNumbers\}\)/);
  assert.doesNotMatch(source, /task\s+(?:LIKE|ILIKE)|repo.*LIKE|name.*LIKE/i);
});

test("pins the provisional schema and derives active membership from its enum", () => {
  const schemaBytes = readFileSync(new URL("../../contracts/vendor/setfarm/operational-active-run-status.v1.schema.json", import.meta.url));
  assert.equal(createHash("sha256").update(schemaBytes).digest("hex"), "7383bd667f36aecb7955dcb99776c87cf9ad9a879a01c00bb6c6a02d9673aec1");
  assert.deepEqual(JSON.parse(schemaBytes.toString("utf8")).enum, ["running", "resuming", "cancelling", "failing"]);
  const adapter = readFileSync(new URL("../shared/setfarm-operational-active-run-status-v1.ts", import.meta.url), "utf8");
  assert.match(adapter, /validatedSchemaEnum\(schema\)/);
  assert.doesNotMatch(adapter, /new Set\(\[\s*["']running["']/);
});
