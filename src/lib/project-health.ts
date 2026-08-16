export const PROJECT_OBSERVATION_MAX_AGE_MS = 15_000;
export const PROJECT_OBSERVATION_POLL_INTERVAL_MS = 10_000;
export const PROJECT_OBSERVATION_DISPLAY_TICK_MS = 1_000;

export interface ProjectRuntimeObservationInput {
  runtime: {
    state: "active" | "inactive" | "unknown";
    checkedAt: string | null;
    reasonCode: string;
  };
}

export interface ProjectRuntimeObservation {
  status: "active" | "inactive" | "unknown";
  label: "ACTIVE" | "INACTIVE" | "UNKNOWN";
  checkedAt: string | null;
  reason: "observed" | "missing" | "invalid_timestamp" | "stale" | "clock_skew";
}

/** Projected runtime is authoritative; a supplied observation timestamp may still age out locally. */
export function projectRuntimeObservation(
  project: ProjectRuntimeObservationInput,
  now = Date.now(),
): ProjectRuntimeObservation {
  const rawStatus = project.runtime.state;
  const checkedAt = typeof project.runtime.checkedAt === "string"
    ? project.runtime.checkedAt
    : null;
  if (rawStatus !== "active" && rawStatus !== "inactive") {
    return { status: "unknown", label: "UNKNOWN", checkedAt, reason: "missing" };
  }
  if (!checkedAt) {
    return {
      status: rawStatus,
      label: rawStatus === "active" ? "ACTIVE" : "INACTIVE",
      checkedAt: null,
      reason: "observed",
    };
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

export interface ProjectRuntimePresentation extends ProjectRuntimeObservation {
  action: "start" | "stop" | null;
  connectivityTone: "online" | "offline" | "unknown";
  switchTone: "on" | "off" | "unknown";
  switchLabel: "ON" | "OFF" | "UNKNOWN";
  availabilityLabel: "Online" | "Offline" | "Unknown";
}

export function projectRuntimePresentation(
  project: ProjectRuntimeObservationInput,
  now = Date.now(),
): ProjectRuntimePresentation {
  const observation = projectRuntimeObservation(project, now);
  if (observation.status === "active") {
    return {
      ...observation,
      action: "stop",
      connectivityTone: "online",
      switchTone: "on",
      switchLabel: "ON",
      availabilityLabel: "Online",
    };
  }
  if (observation.status === "inactive") {
    return {
      ...observation,
      action: "start",
      connectivityTone: "offline",
      switchTone: "off",
      switchLabel: "OFF",
      availabilityLabel: "Offline",
    };
  }
  return {
    ...observation,
    action: null,
    connectivityTone: "unknown",
    switchTone: "unknown",
    switchLabel: "UNKNOWN",
    availabilityLabel: "Unknown",
  };
}

export function projectRuntimeAction(
  project: ProjectRuntimeObservationInput,
  now = Date.now(),
): "start" | "stop" | null {
  return projectRuntimePresentation(project, now).action;
}
