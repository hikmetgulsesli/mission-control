type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export interface SetfarmPipelineFailureProjection {
  hasFailures: boolean;
  blockerStepId: string | null;
  blockerSummary: string | null;
}

/**
 * Projects terminal failure display only from canonical run/step/operational
 * evidence. Story counts remain useful, but a single-step workflow failure must
 * not disappear merely because no story rows exist.
 */
export function deriveSetfarmPipelineFailureProjection(input: Readonly<{
  run: unknown;
  storyProgress: unknown;
  operational: unknown;
}>): SetfarmPipelineFailureProjection {
  const run = record(input.run);
  const storyProgress = record(input.storyProgress);
  const operational = record(input.operational);
  const failure = record(operational.failure);
  const pipeline = record(operational.pipeline);
  const steps = Array.isArray(run.steps) ? run.steps.map(record) : [];

  const failedStepId = optionalText(pipeline.failedStepId);
  const sourceStepId = optionalText(failure.sourceStepId);
  const fallbackBlockerStepId = optionalText(run.blockerStepId) ?? optionalText(run.blocker_step_id);
  const canonicalSummary = optionalText(failure.summary);
  const fallbackSummary = optionalText(run.blockerSummary) ?? optionalText(run.blocker_summary);
  const hasFailedStep = steps.some((step) => String(step.status || "").toLowerCase() === "failed");
  const failedStories = typeof storyProgress.failed === "number" ? storyProgress.failed : 0;

  return {
    hasFailures: failedStories > 0
      || String(run.status || "").toLowerCase() === "failed"
      || failure.present === true
      || failedStepId !== null
      || hasFailedStep,
    blockerStepId: failedStepId ?? sourceStepId ?? fallbackBlockerStepId,
    blockerSummary: canonicalSummary ?? fallbackSummary,
  };
}
