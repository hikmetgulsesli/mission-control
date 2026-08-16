import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { document?: unknown }).document = { querySelector: () => null };

const { ProjectCard } = await import("../src/components/projects/ProjectCard.js");
const { ProjectDetailPanel } = await import("../src/components/projects/ProjectDetailPanel.js");
const projectsModule = await import("../src/pages/Projects.js") as {
  runProjectedMutation?: (
    mutation: () => Promise<unknown>,
    refresh: () => Promise<void>,
  ) => Promise<void>;
};

function fixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "project-1",
    name: "Project One",
    emoji: "P",
    description: "fixture",
    ports: {},
    domain: "",
    repo: "/repos/project-1",
    stack: [],
    service: "",
    createdBy: "setfarm-workflow",
    createdAt: "2026-08-17T08:00:00.000Z",
    status: "registered",
    execution: {
      schema: "mission-control.project-execution.v1",
      state: "unbound",
      active: false,
      runId: null,
      runStatus: null,
      protocol: null,
      source: "none",
      reasonCode: "PROJECT_RUN_IDENTITY_ABSENT",
    },
    runtime: {
      state: "inactive",
      checkedAt: null,
      reasonCode: "PROJECT_RUNTIME_LEGACY_SERVICE_STATUS_INACTIVE",
    },
    receipt: null,
    features: [],
    tasks: [],
    ...overrides,
  };
}

function renderCard(project: ReturnType<typeof fixture>, actionsDisabled = false): string {
  return renderToStaticMarkup(<ProjectCard
    project={project}
    selected={false}
    toggling={false}
    actionsDisabled={actionsDisabled}
    onSelect={() => undefined}
    onToggle={() => undefined}
    onExport={() => undefined}
    onDelete={() => undefined}
  />);
}

function renderDetail(project: ReturnType<typeof fixture>): string {
  return renderToStaticMarkup(<ProjectDetailPanel
    project={project}
    onClose={() => undefined}
    onChecklistUpdate={() => undefined}
    formatDuration={() => null}
  />);
}

function assertFourLabels(html: string, expected: readonly string[]): void {
  for (const label of expected) assert.match(html, new RegExp(label));
}

test("historical raw-active project renders registered and unbound without false workflow activity", () => {
  const project = fixture({ serviceStatus: "active" });
  for (const html of [renderCard(project), renderDetail(project)]) {
    assertFourLabels(html, ["PROJECT REGISTERED", "EXECUTION UNBOUND", "RUNTIME INACTIVE", "RECEIPT NONE"]);
    assert.doesNotMatch(html, /EXECUTION ACTIVE/);
  }
});

test("running execution renders independently from project, runtime, and receipt", () => {
  const project = fixture({
    status: "building",
    execution: {
      schema: "mission-control.project-execution.v1",
      state: "running",
      active: true,
      runId: "run-running",
      runStatus: "running",
      protocol: "v3",
      source: "setfarm_postgres_run",
      reasonCode: "PROJECT_RUN_BOUND",
    },
    runtime: { state: "active", checkedAt: null, reasonCode: "PROJECT_RUNTIME_LEGACY_SERVICE_STATUS_ACTIVE" },
  });
  for (const html of [renderCard(project), renderDetail(project)]) {
    assertFourLabels(html, ["PROJECT BUILDING", "EXECUTION RUNNING", "RUNTIME ACTIVE", "RECEIPT NONE"]);
  }
});

test("failed terminal execution does not render as active", () => {
  const project = fixture({
    status: "failed",
    execution: {
      schema: "mission-control.project-execution.v1",
      state: "terminal",
      active: false,
      runId: "run-failed",
      runStatus: "failed",
      protocol: "v3",
      source: "setfarm_postgres_run",
      reasonCode: "PROJECT_RUN_TERMINAL",
    },
  });
  for (const html of [renderCard(project), renderDetail(project)]) {
    assertFourLabels(html, ["PROJECT FAILED", "EXECUTION TERMINAL", "RUNTIME INACTIVE", "RECEIPT NONE"]);
    assert.doesNotMatch(html, /EXECUTION ACTIVE/);
  }
});

test("canonical completed receipt-active project keeps runtime and execution inactive", () => {
  const project = fixture({
    createdBy: "setfarm-v3-terminal-projector",
    productCompilerProtocol: "v3",
    status: "completed",
    workflowRunId: "run-completed",
    execution: {
      schema: "mission-control.project-execution.v1",
      state: "terminal",
      active: false,
      runId: "run-completed",
      runStatus: "completed",
      protocol: "v3",
      source: "setfarm_postgres_run",
      reasonCode: "PROJECT_RUN_TERMINAL",
    },
    runtime: {
      state: "inactive",
      checkedAt: new Date().toISOString(),
      reasonCode: "V3_DEPLOYMENT_OBSERVED_INACTIVE",
    },
    receipt: {
      status: "completed",
      serviceStatus: "active",
      projectionHash: "a".repeat(64),
      projectRecordHash: "b".repeat(64),
    },
  });
  for (const html of [renderCard(project), renderDetail(project)]) {
    assertFourLabels(html, ["PROJECT COMPLETED", "EXECUTION TERMINAL", "RUNTIME INACTIVE", "RECEIPT ACTIVE"]);
    assert.doesNotMatch(html, /EXECUTION ACTIVE/);
  }
});

test("stale, future, and malformed runtime projections render unknown and disable runtime actions", () => {
  const runtimeCases = [
    { state: "active", checkedAt: "2026-01-01T00:00:00.000Z", reasonCode: "V3_DEPLOYMENT_OBSERVED_ACTIVE" },
    { state: "active", checkedAt: new Date(Date.now() + 60_000).toISOString(), reasonCode: "V3_DEPLOYMENT_OBSERVED_ACTIVE" },
    { state: "active", checkedAt: "not-a-date", reasonCode: "V3_DEPLOYMENT_OBSERVED_ACTIVE" },
  ];
  for (const runtime of runtimeCases) {
    const project = fixture({ runtime });
    const card = renderCard(project);
    assert.match(card, /RUNTIME UNKNOWN/);
    assert.doesNotMatch(card, /RUNTIME ACTIVE/);
    assert.match(card, /project-card__toggle[^>]*disabled=""/);
    assert.match(renderDetail(project), /RUNTIME UNKNOWN/);
  }
});

test("projection refresh failure keeps mutation orchestration from completing successfully", async () => {
  assert.equal(typeof projectsModule.runProjectedMutation, "function");
  const events: string[] = [];
  for (const mutation of ["create", "import", "toggle"]) {
    events.length = 0;
    await assert.rejects(projectsModule.runProjectedMutation!(
      async () => { events.push(`${mutation}:mutated`); },
      async () => {
        events.push(`${mutation}:refresh`);
        throw new Error("PROJECT_PROJECTION_REFRESH_FAILED");
      },
    ), /PROJECT_PROJECTION_REFRESH_FAILED/);
    assert.deepEqual(events, [`${mutation}:mutated`, `${mutation}:refresh`]);
  }
});

test("an unavailable canonical projection disables otherwise actionable runtime controls", () => {
  const card = renderCard(fixture({
    runtime: { state: "active", checkedAt: null, reasonCode: "PROJECT_RUNTIME_LEGACY_SERVICE_STATUS_ACTIVE" },
  }), true);
  assert.match(card, /RUNTIME ACTIVE/);
  assert.match(card, /project-card__toggle[^>]*disabled=""/);
});
