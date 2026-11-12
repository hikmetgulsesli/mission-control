/** Only canonical Stop authority may recover the two known quarantine classes. */
export function allowsCanonicalQuarantineStop(action: string, snapshot: {
  summary: {
    operatorActions: { stop: { allowed: boolean; reasonCode: string } };
  };
  invariants: readonly { code: string }[];
}): boolean {
  return action === "stop"
    && snapshot.summary.operatorActions.stop.allowed === true
    && snapshot.summary.operatorActions.stop.reasonCode === "RUN_CAN_BE_STOPPED_WITH_QUARANTINE_RECOVERY"
    && snapshot.invariants.length > 0
    && snapshot.invariants.every((invariant) =>
      invariant.code === "COMPLETION_REQUEST_QUARANTINED"
      || invariant.code === "RUNTIME_SESSION_QUARANTINED");
}
