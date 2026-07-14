import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PROJECT_OBSERVATION_MAX_AGE_MS,
  PROJECT_OBSERVATION_DISPLAY_TICK_MS,
  PROJECT_OBSERVATION_POLL_INTERVAL_MS,
  projectRuntimeObservation,
} from "../src/lib/project-health.js";

const NOW = Date.parse("2026-07-14T10:00:30.000Z");

test("Projects refreshes before canonical deployment proof authority expires", () => {
  assert.equal(PROJECT_OBSERVATION_MAX_AGE_MS, 15_000);
  assert.equal(PROJECT_OBSERVATION_POLL_INTERVAL_MS <= 10_000, true);
  assert.equal(PROJECT_OBSERVATION_POLL_INTERVAL_MS < PROJECT_OBSERVATION_MAX_AGE_MS, true);
  assert.equal(PROJECT_OBSERVATION_DISPLAY_TICK_MS <= 1_000, true);
});

test("current observed health is separate from immutable receipt status", () => {
  assert.deepEqual(projectRuntimeObservation({
    observedServiceStatus: "inactive",
    observedServiceCheckedAt: "2026-07-14T10:00:20.000Z",
  }, NOW), {
    status: "inactive",
    label: "INACTIVE",
    checkedAt: "2026-07-14T10:00:20.000Z",
    reason: "observed",
  });
});

test("missing, malformed, future, or stale observations fail closed to unknown", () => {
  assert.equal(projectRuntimeObservation({}, NOW).status, "unknown");
  assert.equal(projectRuntimeObservation({
    observedServiceStatus: "active",
    observedServiceCheckedAt: "not-a-date",
  }, NOW).reason, "invalid_timestamp");
  assert.equal(projectRuntimeObservation({
    observedServiceStatus: "active",
    observedServiceCheckedAt: "2026-07-14T10:00:40.000Z",
  }, NOW).reason, "clock_skew");
  assert.equal(projectRuntimeObservation({
    observedServiceStatus: "active",
    observedServiceCheckedAt: new Date(NOW - PROJECT_OBSERVATION_MAX_AGE_MS - 1).toISOString(),
  }, NOW).reason, "stale");
  assert.equal(projectRuntimeObservation({
    observedServiceStatus: "active",
    observedServiceCheckedAt: new Date(NOW - PROJECT_OBSERVATION_MAX_AGE_MS).toISOString(),
  }, NOW).status, "active");
});

test("Project surfaces label receipt status and live health independently", () => {
  const card = readFileSync(new URL("../src/components/projects/ProjectCard.tsx", import.meta.url), "utf8");
  const detail = readFileSync(new URL("../src/components/projects/ProjectDetailPanel.tsx", import.meta.url), "utf8");
  const projectsPage = readFileSync(new URL("../src/pages/Projects.tsx", import.meta.url), "utf8");
  assert.match(card, /RECEIPT.*runStatus\.toUpperCase/);
  assert.match(card, /LIVE \{observedHealth\.label\}/);
  assert.match(card, /observedHealth\.checkedAt/);
  assert.match(detail, /Receipt status/);
  assert.match(detail, /Observed live health/);
  assert.match(projectsPage, /!isCanonicalV3Project\(p\).*p\.service/);
});
