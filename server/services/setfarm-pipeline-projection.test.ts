import assert from "node:assert/strict";
import test from "node:test";

import { deriveSetfarmPipelineFailureProjection } from "./setfarm-pipeline-projection.js";

test("terminal run failure uses canonical operational source without requiring a failed story", () => {
  assert.deepEqual(deriveSetfarmPipelineFailureProjection({
    run: {
      status: "failed",
      blockerStepId: "deploy",
      blockerSummary: "copied downstream failure",
      steps: [
        { step_id: "design", status: "failed" },
        { step_id: "deploy", status: "failed" },
      ],
    },
    storyProgress: { failed: 0 },
    operational: {
      failure: { present: true, sourceStepId: "design", summary: "DESIGN authority rejected" },
      pipeline: { failedStepId: "design" },
    },
  }), {
    hasFailures: true,
    blockerStepId: "design",
    blockerSummary: "DESIGN authority rejected",
  });
});

test("healthy run preserves the existing blocker fallback without inventing failure", () => {
  assert.deepEqual(deriveSetfarmPipelineFailureProjection({
    run: { status: "running", blockerStepId: null, blockerSummary: null, steps: [] },
    storyProgress: { failed: 0 },
    operational: { failure: { present: false }, pipeline: { failedStepId: null } },
  }), {
    hasFailures: false,
    blockerStepId: null,
    blockerSummary: null,
  });
});
