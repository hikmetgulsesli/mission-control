import type { ReactNode } from "react";
import { useOperationalSnapshot } from "../../hooks/useOperationalSnapshot";
import {
  collectOperationalEvidenceRefs,
  evaluateOperationalAction,
  operationalStateReason,
  type OperationalSnapshotState,
  type OperationalCompletionRequestV1,
  type OperationalCompletionRequestV2,
  type OperationalTerminationLifecycleEvidenceV1,
  type OperationalTerminationRequestV1,
  type OperationalV3DeployTerminationEvidenceV1,
  type OperationalV3DownstreamTerminationEvidenceV1,
  type OperationalV3PlanClarificationTerminationEvidenceV1,
  type RunOperationalSnapshot,
} from "../../lib/operational-snapshot";

function shortHash(value: string | null | undefined): string {
  if (!value) return "-";
  return value.length > 16 ? `${value.slice(0, 12)}…` : value;
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString("en-US") : value;
}

function freshness(generatedAt: string, now: number): { label: string; tone: string } {
  const parsed = Date.parse(generatedAt);
  if (!Number.isFinite(parsed)) return { label: "invalid timestamp", tone: "blocked" };
  const ageSeconds = Math.max(0, Math.floor((now - parsed) / 1_000));
  if (parsed - now > 5_000) return { label: "clock skew", tone: "blocked" };
  if (ageSeconds > 15) return { label: `${ageSeconds}s stale`, tone: "blocked" };
  return { label: ageSeconds < 2 ? "fresh now" : `${ageSeconds}s fresh`, tone: "ok" };
}

function EvidenceSection({
  title,
  count,
  children,
  supported = true,
}: {
  title: string;
  count: number;
  children: ReactNode;
  supported?: boolean;
}) {
  return (
    <details className="oe-section" open={supported && count > 0 && count <= 4}>
      <summary>
        <span>{title}</span>
        <b>{supported ? count : "unsupported"}</b>
      </summary>
      <div className="oe-section__body">
        {!supported
          ? <div className="oe-empty">Not exposed by the upstream canonical snapshot capability.</div>
          : count === 0
            ? <div className="oe-empty">No canonical evidence rows.</div>
            : children}
      </div>
    </details>
  );
}

function RefLine({ refValue, children }: { refValue: string; children: ReactNode }) {
  return (
    <div className="oe-row">
      <div className="oe-row__summary">{children}</div>
      <code title={refValue}>{refValue}</code>
    </div>
  );
}

const MAX_RENDERED_IGNORED_FIELD_PATHS = 100;

function CompletionSubmissionEvidence({
  request,
}: {
  request: OperationalCompletionRequestV1 | OperationalCompletionRequestV2;
}) {
  if (!("implementationSubmissionEvidence" in request)) return null;
  const evidence = request.implementationSubmissionEvidence;
  if (!evidence) return null;
  const receipt = evidence.receipt;
  const visiblePaths = receipt.ignoredFieldPaths.slice(0, MAX_RENDERED_IGNORED_FIELD_PATHS);
  return (
    <div className="oe-nested" data-testid="implementation-submission-evidence">
      <span>source schema {receipt.sourceSchema}</span>
      <span title={receipt.sourceProposalHash}>source {shortHash(receipt.sourceProposalHash)}</span>
      <span title={receipt.canonicalOutputHash}>canonical {shortHash(receipt.canonicalOutputHash)}</span>
      <details>
        <summary>ignored provider field paths · {receipt.ignoredFieldPaths.length}</summary>
        {visiblePaths.map((pointer) => <code key={pointer}>{pointer}</code>)}
        {receipt.ignoredFieldPaths.length > visiblePaths.length && (
          <span>{receipt.ignoredFieldPaths.length - visiblePaths.length} additional path(s) omitted from rendering</span>
        )}
      </details>
      <code title={evidence.sourceProposalRef}>{evidence.sourceProposalRef}</code>
    </div>
  );
}

function ProductIdentity({
  packetHash,
  sliceHash,
  sourceRevision,
}: {
  packetHash: string;
  sliceHash: string;
  sourceRevision: { sha: string; treeHash: string };
}) {
  return (
    <>
      <span title={`packet ${packetHash} · slice ${sliceHash}`}>packet {packetHash} · slice {sliceHash}</span>
      <span title={`source ${sourceRevision.sha} · tree ${sourceRevision.treeHash}`}>
        source {sourceRevision.sha} · tree {sourceRevision.treeHash}
      </span>
    </>
  );
}

function TerminationLifecycleDetails({ evidence }: { evidence: OperationalTerminationLifecycleEvidenceV1 }) {
  if (
    evidence.runtimeSessionCount === undefined
    && !evidence.ownerInstanceId
    && !evidence.deferredForCompletionRequestId
  ) return null;
  return (
    <span>
      runtime sessions {evidence.runtimeSessionCount ?? "-"}
      {" · "}termination owner {evidence.ownerInstanceId || "-"}
      {" · "}deferred completion {evidence.deferredForCompletionRequestId || "-"}
    </span>
  );
}

function TerminationEvidenceDetails({ request }: { request: OperationalTerminationRequestV1 }) {
  const evidence = request.evidence as Record<string, unknown>;
  const schema = typeof evidence.schema === "string" ? evidence.schema : "unversioned";
  if (schema === "setfarm.v3-deploy-authority-termination.v1") {
    const deploy = evidence as unknown as OperationalV3DeployTerminationEvidenceV1;
    return (
      <>
        <span><b>{deploy.authorityCode}</b> · refusal {deploy.refusalHash}</span>
        <span>owner {deploy.owner} · claim {deploy.claimId} · model redispatch budget {deploy.modelRedispatchBudget}</span>
        <code title="Canonical deploy authority evidence">{JSON.stringify(deploy.authorityEvidence)}</code>
        <TerminationLifecycleDetails evidence={deploy} />
      </>
    );
  }
  if (schema === "setfarm.v3-plan-clarification-termination.v1") {
    const plan = evidence as unknown as OperationalV3PlanClarificationTerminationEvidenceV1;
    return (
      <>
        <span>rejection {plan.rejectionHash} · source task {plan.sourceTaskHash}</span>
        <span>reason codes {plan.reasonCodes.join(", ")} · model redispatch budget {plan.modelRedispatchBudget}</span>
        <span>requirement refs {plan.requirementRefs.join(", ") || "none"}</span>
        <TerminationLifecycleDetails evidence={plan} />
      </>
    );
  }
  if (schema === "setfarm.v3-downstream-termination-evidence.v1") {
    const downstream = evidence as unknown as OperationalV3DownstreamTerminationEvidenceV1;
    return (
      <>
        <span>{downstream.outcome} · route {downstream.routeHash}</span>
        <span>packet {downstream.packetHash} · source {downstream.sourceRevision.sha} · tree {downstream.sourceRevision.treeHash}</span>
        <span>story evidence refs {downstream.storyEvidenceRefs.join(", ") || "none"}</span>
        {downstream.requiredArtifact && <span>required artifact {downstream.requiredArtifact}</span>}
        <TerminationLifecycleDetails evidence={downstream} />
      </>
    );
  }
  return <code title="Canonical termination evidence">{JSON.stringify(evidence)}</code>;
}

function OperationalEvidenceBody({ snapshot, now }: { snapshot: RunOperationalSnapshot; now: number }) {
  const refs = collectOperationalEvidenceRefs(snapshot);
  const fresh = freshness(snapshot.generatedAt, now);
  const stop = evaluateOperationalAction({ status: "ok", snapshot }, "stop", now);
  const resume = evaluateOperationalAction({ status: "ok", snapshot }, "resume", now);
  const capabilityEntries = Object.entries(snapshot.source.capabilities);
  const findingRecoverySupported = snapshot.source.capabilities.findingRecovery === true
    && snapshot.findingSets !== undefined
    && snapshot.recoveryCases !== undefined
    && snapshot.recoveryDispatches !== undefined;
  const evidenceLedgerSupported = snapshot.source.capabilities.evidenceLedger === true
    && snapshot.evidenceBundles !== undefined;
  const acceptedCandidateSupported = snapshot.source.capabilities.acceptedCandidate === true
    && snapshot.acceptedCandidate !== undefined;
  const deploymentReceiptSupported = snapshot.source.capabilities.deploymentReceipt === true
    && snapshot.deploymentReceipt !== undefined;
  const projectTransferAckSupported = snapshot.source.capabilities.projectTransferAck === true
    && snapshot.projectTransferAck !== undefined;
  const acceptedCandidateProjection = snapshot.acceptedCandidate ?? null;
  const acceptedCandidate = acceptedCandidateProjection?.candidate ?? null;
  const deploymentReceiptProjection = snapshot.deploymentReceipt ?? null;
  const deploymentReceipt = deploymentReceiptProjection?.receipt ?? null;
  const projectTransferAckProjection = snapshot.projectTransferAck ?? null;
  const projectTransferAck = projectTransferAckProjection?.acknowledgement ?? null;
  const findingSets = snapshot.findingSets ?? [];
  const evidenceBundles = snapshot.evidenceBundles ?? [];
  const recoveryCases = snapshot.recoveryCases ?? [];
  const recoveryDispatches = snapshot.recoveryDispatches ?? [];
  const recoveryRefs = [...new Set([
    ...snapshot.completionRequests.flatMap((request) => [request.ref, ...request.effects.map((effect) => effect.ref)]),
    ...snapshot.terminationRequests.map((request) => request.ref),
    ...snapshot.outbox.map((item) => item.ref),
    ...snapshot.invariants.flatMap((item) => item.refs),
    ...findingSets.map((item) => item.ref),
    ...evidenceBundles.flatMap((item) => [item.ref, ...(item.attemptRef ? [item.attemptRef] : [])]),
    ...recoveryCases.flatMap((item) => [item.ref, item.revisionRef, item.findingSetRef]),
    ...recoveryDispatches.flatMap((item) => [
      item.ref,
      item.recoveryCaseRef,
      item.revisionRef,
      item.findingSetRef,
      ...(item.attemptRef ? [item.attemptRef] : []),
      ...(item.claimRef ? [item.claimRef] : []),
    ]),
    ...(acceptedCandidateProjection ? [acceptedCandidateProjection.ref] : []),
    ...(deploymentReceiptProjection ? [deploymentReceiptProjection.ref] : []),
    ...(projectTransferAckProjection ? [projectTransferAckProjection.ref] : []),
  ])];

  return (
    <div className="oe-body">
      {snapshot.source.projection !== "complete" && (
        <div className="oe-warning">
          PARTIAL PROJECTION — absent rows are unknown, not zero. Operational mutations remain locked.
        </div>
      )}
      {(snapshot.summary.lifecycleState === "inconsistent" || snapshot.invariants.length > 0) && (
        <div className="oe-warning oe-warning--blocked">
          CONSISTENCY LOCK — canonical evidence reports {snapshot.invariants.length || snapshot.summary.invariantViolations} invariant violation(s).
        </div>
      )}

      <div className="oe-metrics">
        <div><span>Lifecycle</span><strong>{snapshot.summary.lifecycleState}</strong></div>
        <div><span>Health</span><strong>{snapshot.summary.health}</strong></div>
        <div><span>Claims</span><strong>{snapshot.summary.activeClaims}</strong></div>
        <div><span>Attempts</span><strong>{snapshot.summary.activeAttempts}</strong></div>
        <div><span>Runtimes</span><strong>{snapshot.summary.activeRuntimes}</strong></div>
        <div><span>Completions</span><strong>{snapshot.summary.openCompletions}</strong></div>
        <div><span>Effects pending</span><strong>{snapshot.summary.mandatoryEffectsPending}</strong></div>
        <div><span>Outbox pending</span><strong>{snapshot.summary.unpublishedOutbox}</strong></div>
      </div>

      <div className="oe-contract-grid">
        <div>
          <span>Run ref</span>
          <code>{snapshot.run.ref}</code>
        </div>
        <div>
          <span>Run status</span>
          <code>{snapshot.run.status} / {snapshot.run.terminal ? "terminal" : "non-terminal"}</code>
        </div>
        <div>
          <span>Protocol</span>
          <code>{snapshot.run.protocol || "unversioned"}</code>
        </div>
        <div>
          <span>Projection</span>
          <code>{snapshot.source.projection}</code>
        </div>
        <div>
          <span>Migrations</span>
          <code>{snapshot.source.migrationVersions.join(", ") || "none verified"}</code>
        </div>
        <div>
          <span>Release SHA</span>
          <code title={snapshot.source.verifiedReleaseSha || ""}>{shortHash(snapshot.source.verifiedReleaseSha)}</code>
        </div>
        <div>
          <span>Generated</span>
          <code>{formatTime(snapshot.generatedAt)}</code>
        </div>
        <div>
          <span>Snapshot hash</span>
          <code title={snapshot.snapshotHash}>{shortHash(snapshot.snapshotHash)}</code>
        </div>
      </div>

      <div className="oe-capabilities" aria-label="Operational projection capabilities">
        {capabilityEntries.map(([name, supported]) => (
          <span key={name} className={`oe-capability oe-capability--${supported ? "on" : "off"}`}>
            {supported ? "✓" : "×"} {name}
          </span>
        ))}
      </div>

      <div className="oe-authority">
        <div className={`oe-authority__item oe-authority__item--${stop.allowed ? "allowed" : "locked"}`}>
          <span>STOP</span><strong>{stop.allowed ? "ALLOWED" : "LOCKED"}</strong><code>{stop.reasonCode}</code>
        </div>
        <div className={`oe-authority__item oe-authority__item--${resume.allowed ? "allowed" : "locked"}`}>
          <span>RESUME</span><strong>{resume.allowed ? "ALLOWED" : "LOCKED"}</strong><code>{resume.reasonCode}</code>
        </div>
      </div>

      <div className="oe-sections">
        <EvidenceSection title="Step evidence refs" count={refs.stepRefs.length}>
          {refs.stepRefs.map((refValue) => <RefLine key={refValue} refValue={refValue}>Canonical step surface</RefLine>)}
        </EvidenceSection>
        <EvidenceSection title="Story evidence refs" count={refs.storyRefs.length}>
          {refs.storyRefs.map((refValue) => <RefLine key={refValue} refValue={refValue}>Canonical story surface</RefLine>)}
        </EvidenceSection>
        <EvidenceSection title="Claims" count={snapshot.claims.length}>
          {snapshot.claims.map((claim) => (
            <RefLine key={claim.ref} refValue={claim.ref}>
              <b>{claim.workflowStepId}{claim.storyId ? ` / ${claim.storyId}` : ""}</b>
              <span>{claim.state}{claim.outcome ? ` · ${claim.outcome}` : ""} · {claim.agentId}</span>
            </RefLine>
          ))}
        </EvidenceSection>
        <EvidenceSection title="Execution attempts" count={snapshot.attempts.length}>
          {snapshot.attempts.map((attempt) => (
            <RefLine key={attempt.ref} refValue={attempt.ref}>
              <b>{attempt.workflowStepId}{attempt.storyId ? ` / ${attempt.storyId}` : ""} · gen {attempt.generation}</b>
              <span>{attempt.attemptClass} · {attempt.disposition} · source {shortHash(attempt.sourceAfter?.sha || attempt.sourceBefore.sha)}</span>
            </RefLine>
          ))}
        </EvidenceSection>
        <EvidenceSection
          title="Accepted final-tree candidate"
          count={acceptedCandidate ? 1 : 0}
          supported={acceptedCandidateSupported}
        >
          {acceptedCandidateProjection && acceptedCandidate && (
            <div className="oe-nested">
              <RefLine refValue={acceptedCandidateProjection.ref}>
                <b>{acceptedCandidate.candidateId} · {acceptedCandidate.storyEvidence.length} story proof(s)</b>
                <span title={acceptedCandidate.candidateHash}>candidate {shortHash(acceptedCandidate.candidateHash)} · packet {shortHash(acceptedCandidate.packetHash)}</span>
                <span title={acceptedCandidate.storyPlanHash}>story plan {shortHash(acceptedCandidate.storyPlanHash)} · integration {shortHash(acceptedCandidate.integrationEvidenceHash)}</span>
                <span title={`${acceptedCandidate.sourceRevision.sha} / ${acceptedCandidate.sourceRevision.treeHash}`}>
                  final source {shortHash(acceptedCandidate.sourceRevision.sha)} · tree {shortHash(acceptedCandidate.sourceRevision.treeHash)}
                </span>
                <span>
                  accepted by {acceptedCandidate.acceptor.id} v{acceptedCandidate.acceptor.version} · {formatTime(acceptedCandidateProjection.createdAt)}
                </span>
              </RefLine>
              {acceptedCandidate.storyEvidence.map((story) => (
                <RefLine
                  key={story.storyId}
                  refValue={`setfarm://evidence-bundle/${story.evidenceBundleHash}`}
                >
                  <b>{story.storyId} · {story.predicateRefs.length} predicate proof(s)</b>
                  <span>attempt {story.attemptId} · slice {shortHash(story.sliceHash)}</span>
                  <span>plan {shortHash(story.evidencePlanHash)} · bundle {shortHash(story.evidenceBundleHash)}</span>
                </RefLine>
              ))}
            </div>
          )}
        </EvidenceSection>
        <EvidenceSection
          title="Canonical deployment receipt"
          count={deploymentReceipt ? 1 : 0}
          supported={deploymentReceiptSupported}
        >
          {deploymentReceiptProjection && deploymentReceipt && (
            <RefLine refValue={deploymentReceiptProjection.ref}>
              <b>{deploymentReceipt.project.displayName} · {deploymentReceipt.project.projectId}</b>
              <span title={deploymentReceipt.receiptHash}>
                receipt {shortHash(deploymentReceipt.receiptHash)} · candidate {shortHash(deploymentReceipt.candidateHash)} · packet {shortHash(deploymentReceipt.packetHash)}
              </span>
              <span title={`${deploymentReceipt.sourceAfter.sha} / ${deploymentReceipt.sourceAfter.treeHash}`}>
                exact source {shortHash(deploymentReceipt.sourceAfter.sha)} · tree {shortHash(deploymentReceipt.sourceAfter.treeHash)}
              </span>
              <span>
                service {deploymentReceipt.runtime.serviceId} · {deploymentReceipt.runtime.host}:{deploymentReceipt.runtime.port} · {deploymentReceipt.runtime.mode}
              </span>
              <span>
                health {deploymentReceipt.health.status} / HTTP {deploymentReceipt.health.httpStatus} · {formatTime(deploymentReceipt.health.checkedAt)}
              </span>
              <span title={deploymentReceipt.buildArtifact.evidenceRef}>
                sealed build {shortHash(deploymentReceipt.buildArtifact.artifactHash)} · {deploymentReceipt.buildArtifact.files.length} file(s) · {deploymentReceipt.buildArtifact.totalBytes} bytes
              </span>
              <span title={deploymentReceipt.runtime.sealedRuntimeRef}>
                immutable served runtime · {deploymentReceipt.runtime.sealedRuntimeRef}
              </span>
              <span title={deploymentReceipt.health.listenerOwnership.evidenceRef}>
                listener owner PID {deploymentReceipt.health.listenerOwnership.ownerProcess.pid} · observed PIDs {deploymentReceipt.health.listenerOwnership.listenerPids.join(", ")}
              </span>
              <a href={deploymentReceipt.runtime.deployUrl} target="_blank" rel="noopener noreferrer">
                {deploymentReceipt.runtime.deployUrl}
              </a>
              <span>
                stack {deploymentReceipt.stack.techStack || deploymentReceipt.stack.stackPackId} · terminal owner {deploymentReceipt.terminalProjectProjection.owner}
              </span>
            </RefLine>
          )}
        </EvidenceSection>
        <EvidenceSection
          title="Mission Control project-transfer acknowledgement"
          count={projectTransferAck ? 1 : 0}
          supported={projectTransferAckSupported}
        >
          {projectTransferAckProjection && projectTransferAck && (
            <RefLine refValue={projectTransferAckProjection.ref}>
              <b>{projectTransferAck.projectProjection.name} · {projectTransferAck.projectId}</b>
              <span title={projectTransferAck.ackHash}>
                ACK {shortHash(projectTransferAck.ackHash)} · record {shortHash(projectTransferAck.projectRecordHash)}
              </span>
              <span title={projectTransferAck.sourceSnapshotHash}>
                source snapshot {shortHash(projectTransferAck.sourceSnapshotHash)} · projection {shortHash(projectTransferAck.projectionHash)}
              </span>
              <span title={projectTransferAck.projectRecordRef}>
                persisted record {projectTransferAck.projectRecordRef}
              </span>
              <span>
                projector {projectTransferAck.projector.service}/{projectTransferAck.projector.protocol} · {formatTime(projectTransferAck.persistedAt)}
              </span>
            </RefLine>
          )}
        </EvidenceSection>
        <EvidenceSection title="Finding sets" count={findingSets.length} supported={findingRecoverySupported}>
          {findingSets.map((findingSet) => (
            <RefLine key={findingSet.ref} refValue={findingSet.ref}>
              <b>{findingSet.findingSetId} · {findingSet.findingIds.length} finding(s) · {findingSet.storyId}</b>
              <ProductIdentity
                packetHash={findingSet.packetHash}
                sliceHash={findingSet.sliceHash}
                sourceRevision={findingSet.sourceRevision}
              />
            </RefLine>
          ))}
        </EvidenceSection>
        <EvidenceSection title="Evidence bundles" count={evidenceBundles.length} supported={evidenceLedgerSupported}>
          {evidenceBundles.map((bundle) => (
            <RefLine key={bundle.ref} refValue={bundle.ref}>
              <b>{bundle.evidenceId} · {bundle.aggregateVerdict} · {bundle.storyId}</b>
              <span>{bundle.predicateCount} predicate(s) · {bundle.observationCount} observation(s) · attempt {bundle.attemptId || "unbound"}</span>
              <ProductIdentity
                packetHash={bundle.packetHash}
                sliceHash={bundle.sliceHash}
                sourceRevision={bundle.sourceRevision}
              />
            </RefLine>
          ))}
        </EvidenceSection>
        <EvidenceSection title="Recovery cases" count={recoveryCases.length} supported={findingRecoverySupported}>
          {recoveryCases.map((recoveryCase) => (
            <RefLine key={recoveryCase.ref} refValue={recoveryCase.ref}>
              <b>{recoveryCase.recoveryCaseId} · {recoveryCase.owner} / {recoveryCase.status} · v{recoveryCase.stateVersion}</b>
              <span title={recoveryCase.revisionRef}>current revision {recoveryCase.revisionNumber} · {recoveryCase.revisionId}</span>
              <span>
                delta {recoveryCase.expectedDeltaKind} · budget implement {recoveryCase.budget.used.implement}/{recoveryCase.budget.limits.implement}
                {" · "}supervisor {recoveryCase.budget.used.supervisorRepair}/{recoveryCase.budget.limits.supervisorRepair}
                {" · "}evidence {recoveryCase.budget.used.evidenceOnly}/{recoveryCase.budget.limits.evidenceOnly}
              </span>
              {recoveryCase.terminalReasonCode && <span>terminal {recoveryCase.terminalReasonCode}</span>}
              <ProductIdentity
                packetHash={recoveryCase.packetHash}
                sliceHash={recoveryCase.sliceHash}
                sourceRevision={recoveryCase.sourceRevision}
              />
            </RefLine>
          ))}
        </EvidenceSection>
        <EvidenceSection title="Recovery dispatches" count={recoveryDispatches.length} supported={findingRecoverySupported}>
          {recoveryDispatches.map((dispatch) => (
            <RefLine key={dispatch.ref} refValue={dispatch.ref}>
              <b>{dispatch.dispatchId} · {dispatch.dispatchClass} / {dispatch.deliveryState} · {dispatch.storyId}</b>
              <span title={dispatch.revisionRef}>revision {dispatch.revisionNumber} · {dispatch.revisionId} · case {dispatch.recoveryCaseId}</span>
              <span>
                {dispatch.findingIds.length} finding(s) · authorized {formatTime(dispatch.authorizedAt)} · attempts {dispatch.attemptCount}
              </span>
              <span title={dispatch.attemptRef || ""}>
                attempt {dispatch.attemptId || "unbound"} · claim {dispatch.claimRef || "unbound"} · execution slice {dispatch.executionSliceHash || "unbound"}
              </span>
              <span>
                lease {dispatch.leaseOwnerInstanceId || "unleased"} · expires {formatTime(dispatch.leaseExpiresAt)}
              </span>
              {dispatch.terminalAt && (
                <span>terminal reason {dispatch.terminalReasonCode || "-"} · {formatTime(dispatch.terminalAt)}</span>
              )}
              <ProductIdentity
                packetHash={dispatch.packetHash}
                sliceHash={dispatch.sliceHash}
                sourceRevision={dispatch.sourceRevision}
              />
            </RefLine>
          ))}
        </EvidenceSection>
        <EvidenceSection title="Runtime sessions" count={snapshot.runtimeSessions.length}>
          {snapshot.runtimeSessions.map((session) => (
            <RefLine key={session.ref} refValue={session.ref}>
              <b>{session.workflowStepId}{session.storyId ? ` / ${session.storyId}` : ""} · {session.runtimeKind}</b>
              <span>{session.state} · v{session.stateVersion} · heartbeat {formatTime(session.heartbeatAt)}</span>
            </RefLine>
          ))}
        </EvidenceSection>
        <EvidenceSection title="Completion requests and effects" count={snapshot.completionRequests.length}>
          {snapshot.completionRequests.map((request) => (
            <div className="oe-nested" key={request.ref}>
              <RefLine refValue={request.ref}>
                <b>{request.workflowStepId}{request.storyId ? ` / ${request.storyId}` : ""}</b>
                <span>{request.state} · {request.applyPhase} · {request.effects.length} effect(s)</span>
              </RefLine>
              <CompletionSubmissionEvidence request={request} />
              {request.effects.map((effect) => (
                <RefLine key={effect.ref} refValue={effect.ref}>
                  <span>#{effect.ordinal} {effect.effectType} · {effect.state} · attempts {effect.attemptCount}</span>
                </RefLine>
              ))}
            </div>
          ))}
        </EvidenceSection>
        <EvidenceSection title="Termination requests" count={snapshot.terminationRequests.length}>
          {snapshot.terminationRequests.map((request) => (
            <RefLine key={request.ref} refValue={request.ref}>
              <b>{request.targetStatus} · {request.requestedBy}</b>
              <span>{request.state} · requested {formatTime(request.requestedAt)}</span>
              <span>{request.diagnostic}</span>
              <span>evidence schema {typeof request.evidence.schema === "string" ? request.evidence.schema : "unversioned"}</span>
              <TerminationEvidenceDetails request={request} />
            </RefLine>
          ))}
        </EvidenceSection>
        <EvidenceSection title="Operational outbox" count={snapshot.outbox.length}>
          {snapshot.outbox.map((item) => (
            <RefLine key={item.ref} refValue={item.ref}>
              <b>{item.eventType}</b><span>{item.state} · {item.eventKey} · attempts {item.attemptCount}</span>
            </RefLine>
          ))}
        </EvidenceSection>
        <EvidenceSection title="Recovery evidence refs" count={recoveryRefs.length}>
          {recoveryRefs.map((refValue, index) => <RefLine key={`${refValue}-${index}`} refValue={refValue}>Durable recovery evidence</RefLine>)}
        </EvidenceSection>
        <EvidenceSection title="Invariant evidence" count={snapshot.invariants.length}>
          {snapshot.invariants.map((invariant, index) => (
            <div className={`oe-invariant oe-invariant--${invariant.severity}`} key={`${invariant.code}-${index}`}>
              <b>{invariant.severity.toUpperCase()} · {invariant.code}</b>
              <span>{formatTime(invariant.observedAt)}</span>
              {invariant.refs.map((refValue) => <code key={refValue}>{refValue}</code>)}
            </div>
          ))}
        </EvidenceSection>
      </div>

      <div className={`oe-freshness oe-freshness--${fresh.tone}`}>
        <span>Freshness</span><strong>{fresh.label}</strong>
      </div>
    </div>
  );
}

export function OperationalEvidence({ state, now = Date.now() }: { state: OperationalSnapshotState; now?: number }) {
  if (state.status !== "ok") {
    return (
      <section className={`oe-panel oe-panel--${state.status}`} aria-label="Canonical operational evidence">
        <div className="oe-header">
          <div><span>EXECUTION</span><h3>Operational Evidence</h3></div>
          <strong>{state.status.replace("_", " ").toUpperCase()}</strong>
        </div>
        <div className="oe-unavailable">
          <b>Operational authority is locked.</b>
          <p>{operationalStateReason(state)}</p>
          <p>No prose, transcript, regex classifier, or local status fallback is used to enable mutations.</p>
        </div>
      </section>
    );
  }

  const projectionTone = state.snapshot.source.projection === "complete" ? "ok" : "partial";
  return (
    <section className={`oe-panel oe-panel--${projectionTone}`} aria-label="Canonical operational evidence">
      <div className="oe-header">
        <div><span>EXECUTION</span><h3>Operational Evidence</h3></div>
        <strong>{state.snapshot.schema}</strong>
      </div>
      <OperationalEvidenceBody snapshot={state.snapshot} now={now} />
    </section>
  );
}

export function OperationalEvidenceLoader({ runId }: { runId: string }) {
  const state = useOperationalSnapshot(runId, 5_000);
  return <OperationalEvidence state={state} />;
}
