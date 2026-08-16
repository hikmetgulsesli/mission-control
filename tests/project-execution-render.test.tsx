import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { document?: unknown }).document = { querySelector: () => null };

const { ProjectCard } = await import("../src/components/projects/ProjectCard.js");
const { ProjectDetailPanel } = await import("../src/components/projects/ProjectDetailPanel.js");

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

function renderCard(project: ReturnType<typeof fixture>): string {
  return renderToStaticMarkup(<ProjectCard
    project={project}
    selected={false}
    toggling={false}
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
      checkedAt: "2026-08-17T08:01:00.000Z",
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
