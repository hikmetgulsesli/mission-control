import assert from "node:assert/strict";
import test from "node:test";

import {
  PROJECT_OBSERVATION_MAX_AGE_MS,
  PROJECT_OBSERVATION_DISPLAY_TICK_MS,
  PROJECT_OBSERVATION_POLL_INTERVAL_MS,
  projectRuntimeAction,
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
    runtime: {
      state: "inactive",
      checkedAt: "2026-07-14T10:00:20.000Z",
      reasonCode: "V3_DEPLOYMENT_OBSERVED_INACTIVE",
    },
  }, NOW), {
    status: "inactive",
    label: "INACTIVE",
    checkedAt: "2026-07-14T10:00:20.000Z",
    reason: "observed",
  });
});

test("missing, malformed, future, or stale observations fail closed to unknown", () => {
  assert.equal(projectRuntimeObservation({
    runtime: { state: "unknown", checkedAt: null, reasonCode: "PROJECT_RUNTIME_UNAVAILABLE" },
  }, NOW).status, "unknown");
  assert.equal(projectRuntimeObservation({
    runtime: { state: "active", checkedAt: "not-a-date", reasonCode: "V3_DEPLOYMENT_OBSERVED_ACTIVE" },
  }, NOW).reason, "invalid_timestamp");
  assert.equal(projectRuntimeObservation({
    runtime: { state: "active", checkedAt: "2026-07-14T10:00:40.000Z", reasonCode: "V3_DEPLOYMENT_OBSERVED_ACTIVE" },
  }, NOW).reason, "clock_skew");
  assert.equal(projectRuntimeObservation({
    runtime: {
      state: "active",
      checkedAt: new Date(NOW - PROJECT_OBSERVATION_MAX_AGE_MS - 1).toISOString(),
      reasonCode: "V3_DEPLOYMENT_OBSERVED_ACTIVE",
    },
  }, NOW).reason, "stale");
  assert.equal(projectRuntimeObservation({
    runtime: {
      state: "active",
      checkedAt: new Date(NOW - PROJECT_OBSERVATION_MAX_AGE_MS).toISOString(),
      reasonCode: "V3_DEPLOYMENT_OBSERVED_ACTIVE",
    },
  }, NOW).status, "active");
});

test("runtime mutations are unavailable for stale, future, malformed, and unknown projections", () => {
  const refused = [
    { state: "unknown", checkedAt: null, reasonCode: "PROJECT_RUNTIME_UNAVAILABLE" },
    { state: "active", checkedAt: "not-a-date", reasonCode: "V3_DEPLOYMENT_OBSERVED_ACTIVE" },
    { state: "active", checkedAt: "2026-07-14T10:00:40.000Z", reasonCode: "V3_DEPLOYMENT_OBSERVED_ACTIVE" },
    {
      state: "active",
      checkedAt: new Date(NOW - PROJECT_OBSERVATION_MAX_AGE_MS - 1).toISOString(),
      reasonCode: "V3_DEPLOYMENT_OBSERVED_ACTIVE",
    },
  ] as const;
  for (const runtime of refused) {
    assert.equal(projectRuntimeAction({ runtime }, NOW), null);
  }

  assert.equal(projectRuntimeAction({
    runtime: {
      state: "active",
      checkedAt: new Date(NOW - PROJECT_OBSERVATION_MAX_AGE_MS).toISOString(),
      reasonCode: "V3_DEPLOYMENT_OBSERVED_ACTIVE",
    },
  }, NOW), "stop");
  assert.equal(projectRuntimeAction({
    runtime: { state: "inactive", checkedAt: null, reasonCode: "PROJECT_RUNTIME_LEGACY_SERVICE_STATUS_INACTIVE" },
  }, NOW), "start");
});
