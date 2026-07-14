export const PROJECT_OBSERVATION_MAX_AGE_MS = 15_000;
export const PROJECT_OBSERVATION_POLL_INTERVAL_MS = 10_000;
export const PROJECT_OBSERVATION_DISPLAY_TICK_MS = 1_000;

export interface ProjectRuntimeObservationInput {
  observedServiceStatus?: string | null;
  observedServiceCheckedAt?: string | null;
}

export interface ProjectRuntimeObservation {
  status: "active" | "inactive" | "unknown";
  label: "ACTIVE" | "INACTIVE" | "UNKNOWN";
  checkedAt: string | null;
  reason: "observed" | "missing" | "invalid_timestamp" | "stale" | "clock_skew";
}

/** No timestamp means no current observation; receipt status is never a fallback. */
export function projectRuntimeObservation(
  project: ProjectRuntimeObservationInput,
  now = Date.now(),
): ProjectRuntimeObservation {
  const rawStatus = String(project.observedServiceStatus || "").trim().toLowerCase();
  const checkedAt = typeof project.observedServiceCheckedAt === "string"
    ? project.observedServiceCheckedAt
    : null;
  if (!checkedAt || (rawStatus !== "active" && rawStatus !== "inactive")) {
    return { status: "unknown", label: "UNKNOWN", checkedAt, reason: "missing" };
  }
  const checkedAtMs = Date.parse(checkedAt);
  if (!Number.isFinite(checkedAtMs)) {
    return { status: "unknown", label: "UNKNOWN", checkedAt, reason: "invalid_timestamp" };
  }
  if (checkedAtMs > now + 5_000) {
    return { status: "unknown", label: "UNKNOWN", checkedAt, reason: "clock_skew" };
  }
  if (now - checkedAtMs > PROJECT_OBSERVATION_MAX_AGE_MS) {
    return { status: "unknown", label: "UNKNOWN", checkedAt, reason: "stale" };
  }
  return {
    status: rawStatus,
    label: rawStatus === "active" ? "ACTIVE" : "INACTIVE",
    checkedAt,
    reason: "observed",
  };
}
