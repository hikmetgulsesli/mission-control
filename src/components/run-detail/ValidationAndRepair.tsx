import { RUN_OPERATIONAL_SNAPSHOT_V3_SCHEMA, type RunOperationalSnapshot } from "../../lib/operational-snapshot";

export type ValidationPipelineStep = Readonly<{ id: string; status: string }>;

const validationStageLabels = new Map([
  ["design", "Design validation"],
  ["setup-build", "Build setup"],
  ["verify", "Verification"],
  ["supervise", "Supervisor checks"],
  ["security-gate", "Security gate"],
  ["qa-test", "QA testing"],
  ["final-test", "Final testing"],
]);

function validationStageStatus(step: ValidationPipelineStep, snapshot: RunOperationalSnapshot, failureStepId?: string): string {
  const runtimes = snapshot.runtimeSessions.filter(runtime => runtime.workflowStepId === step.id);
  const completions = snapshot.completionRequests.filter(request => request.workflowStepId === step.id);
  const completionBlocked = completions.some(request =>
    request.state === "quarantined"
    || request.effects.some(effect => effect.mandatory && effect.state === "quarantined"));
  if (failureStepId === step.id || completionBlocked || runtimes.some(runtime => runtime.state === "quarantined")) return "Blocked";
  if (completions.some(request =>
    request.state === "requested" || request.state === "draining" || request.state === "processing"
    || request.effects.some(effect => effect.mandatory && (effect.state === "pending" || effect.state === "leased"))
  )) return "Finalizing";
  if (runtimes.some(runtime => runtime.state === "running")) return "Running";
  if (runtimes.some(runtime => runtime.state === "starting" || runtime.state === "reserved")) return "Starting";
  if (runtimes.some(runtime => runtime.state === "drain_requested")) return "Closing";
  if (snapshot.claims.some(claim => claim.workflowStepId === step.id && claim.state === "open")) return "Claimed";
  switch (step.status) {
    case "done": return "Completed";
    case "pending":
    case "waiting": return "Pending";
    case "failed": return "Failed";
    case "cancelled": return "Cancelled";
    case "skipped": return "Skipped";
    case "running": return "Awaiting runtime evidence";
    default: return "State unavailable";
  }
}

function mostRecent<T>(items: readonly T[], dateOf: (item: T) => string): T | undefined {
  return items.reduce<T | undefined>((latest, item) => (
    latest === undefined || Date.parse(dateOf(item)) >= Date.parse(dateOf(latest)) ? item : latest
  ), undefined);
}

export function ValidationAndRepair({ snapshot, pipelineSteps }: {
  snapshot: RunOperationalSnapshot;
  pipelineSteps?: readonly ValidationPipelineStep[];
}) {
  const complete = snapshot.source.projection === "complete";
  const evidence = snapshot.source.capabilities.evidenceLedger ? snapshot.evidenceBundles : undefined;
  const cases = snapshot.source.capabilities.findingRecovery ? snapshot.recoveryCases : undefined;
  const dispatches = snapshot.source.capabilities.findingRecovery ? snapshot.recoveryDispatches : undefined;
  const bundle = mostRecent(evidence ?? [], item => item.createdAt);
  const recovery = mostRecent(cases ?? [], item => item.updatedAt);
  const dispatch = mostRecent(dispatches ?? [], item => item.authorizedAt);
  const cause = snapshot.schema === RUN_OPERATIONAL_SNAPSHOT_V3_SCHEMA
    ? snapshot.operationalFailure?.failureIdentity.operationalCause
    : undefined;
  const invariant = snapshot.invariants.find(item => item.severity === "error");
  const stages = pipelineSteps?.flatMap(step => {
    const label = validationStageLabels.get(step.id);
    return label === undefined ? [] : [{ ...step, label }];
  });

  return (
    <section className="oe-section oe-validation-repair" aria-label="Validation and repair">
      <h4>Validation and repair</h4>
      <div className="oe-contract-grid">
        <div>
          <span>Recorded blocker</span>
          {cause ? <>
            <code title={cause.failureCode}>{cause.failureCode}</code>
            <code title={cause.boundary}>{cause.workflowStepId} · {cause.boundary}</code>
          </> : invariant ? (
            <code title={invariant.code}>{invariant.code}</code>
          ) : (
            <code>{complete ? "No blocker recorded" : "Blocker state unavailable"}</code>
          )}
        </div>
        <div>
          <span>Latest validation evidence</span>
          {bundle ? <>
            <code title={bundle.ref}>{bundle.storyId} · {bundle.aggregateVerdict}</code>
            <code>{bundle.predicateCount} checks · {bundle.observationCount} observations</code>
          </> : (
            <code>{complete && evidence ? "No validation evidence recorded yet" : "Validation evidence unavailable"}</code>
          )}
        </div>
        <div>
          <span>Latest recovery case</span>
          {recovery ? <>
            <code title={recovery.ref}>{recovery.storyId} · {recovery.owner} / {recovery.status}</code>
            <code>
              Attempts used · implement {recovery.budget.used.implement}/{recovery.budget.limits.implement}
              {" · "}supervisor {recovery.budget.used.supervisorRepair}/{recovery.budget.limits.supervisorRepair}
              {" · "}evidence {recovery.budget.used.evidenceOnly}/{recovery.budget.limits.evidenceOnly}
            </code>
            {recovery.terminalReasonCode && <code>{recovery.terminalReasonCode}</code>}
          </> : (
            <code>{complete && cases ? "No recovery case recorded yet" : "Repair state unavailable"}</code>
          )}
        </div>
        <div>
          <span>Latest repair dispatch</span>
          {dispatch ? <>
            <code title={dispatch.ref}>{dispatch.storyId} · {dispatch.dispatchClass} / {dispatch.deliveryState}</code>
            {dispatch.terminalReasonCode && <code>{dispatch.terminalReasonCode}</code>}
          </> : (
            <code>{complete && dispatches ? "No repair dispatch recorded yet" : "Repair dispatch unavailable"}</code>
          )}
        </div>
      </div>
      <div className="oe-validation-stages">
        <h5>Validation stages in this run</h5>
        {!pipelineSteps?.length ? (
          <p>Validation stage list unavailable</p>
        ) : stages?.length ? (
          <ul>
            {stages.map(step => (
              <li key={step.id}><b>{step.label}</b><span>{validationStageStatus(step, snapshot, cause?.workflowStepId)}</span></li>
            ))}
          </ul>
        ) : (
          <p>No validation stages in the recorded pipeline</p>
        )}
      </div>
    </section>
  );
}
