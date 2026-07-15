import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  RUN_OPERATIONAL_SNAPSHOT_V1_SCHEMA,
  type RunOperationalSnapshotV1,
  type RunOperationalSnapshotV2,
} from "../src/lib/operational-snapshot.ts";

(globalThis as { document?: unknown }).document = { querySelector: () => null };

const { OperationalEvidence } = await import("../src/components/run-detail/OperationalEvidence.tsx");

function renderSnapshot(projection: "complete" | "partial", includeRecovery = false, includeTermination = false, includeDeployment = false) {
  const snapshot = {
    schema: RUN_OPERATIONAL_SNAPSHOT_V1_SCHEMA,
    generatedAt: "2026-07-13T09:59:59.000Z",
    snapshotHash: "a".repeat(64),
    source: {
      database: "postgres",
      projection,
      migrationVersions: projection === "complete" ? [1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 4],
      verifiedReleaseSha: "b".repeat(40),
      capabilities: {
        attempts: projection === "complete",
        claimBinding: projection === "complete",
        runtimeOwnership: projection === "complete",
        managerCompletion: projection === "complete",
        effectLedger: projection === "complete",
        findingRecovery: projection === "complete",
        evidenceLedger: projection === "complete",
        acceptedCandidate: projection === "complete",
        deploymentReceipt: projection === "complete",
        projectTransferAck: projection === "complete",
      },
    },
    run: {
      ref: "setfarm://runs/run-1",
      id: "run-1",
      runNumber: 1,
      protocol: "v3",
      status: "running",
      terminal: false,
      updatedAt: "2026-07-13T09:59:59.000Z",
    },
    summary: {
      lifecycleState: "runtime_active",
      health: "ok",
      activeClaims: 1,
      activeAttempts: 0,
      activeRuntimes: 0,
      openCompletions: 0,
      mandatoryEffectsPending: 0,
      unpublishedOutbox: 0,
      invariantViolations: 0,
      operatorActions: {
        stop: { allowed: true, reasonCode: "STOP_ALLOWED", stateHash: "c".repeat(64) },
        resume: { allowed: false, reasonCode: "RUN_NOT_RESUMABLE", stateHash: "d".repeat(64) },
      },
    },
    claims: [{
      ref: "setfarm://claims/claim-1",
      id: "claim-1",
      runRef: "setfarm://runs/run-1",
      stepRef: "setfarm://runs/run-1/steps/implement",
      storyRef: "setfarm://runs/run-1/stories/story-1",
      workflowStepId: "implement",
      storyId: "story-1",
      agentId: "implementer",
      state: "open",
      outcome: null,
      claimedAt: "2026-07-13T09:59:00.000Z",
      abandonedAt: null,
    }],
    attempts: [],
    runtimeSessions: [],
    completionRequests: [],
    terminationRequests: [],
    outbox: [],
    invariants: [],
    ...(projection === "complete" ? { acceptedCandidate: null, deploymentReceipt: null, projectTransferAck: null } : {}),
  } as RunOperationalSnapshotV1;

  if (includeTermination) {
    snapshot.terminationRequests = [{
      ref: "setfarm://run-termination/RTR_deploy-refusal-0001",
      requestId: "RTR_deploy-refusal-0001",
      runRef: snapshot.run.ref,
      targetStatus: "failed",
      state: "requested",
      requestedBy: "setfarm.product-compiler.deploy-refusal",
      diagnostic: "V3_DEPLOY_SOURCE_REVISION_MISMATCH:canonical refusal",
      evidence: {
        schema: "setfarm.v3-deploy-authority-termination.v1",
        terminalFailure: true,
        owner: "compiler",
        refusalHash: "c".repeat(64),
        authorityCode: "V3_DEPLOY_SOURCE_REVISION_MISMATCH",
        authorityEvidence: {
          expectedSha: "1".repeat(40),
          observedSha: "2".repeat(40),
        },
        claimId: 42,
        modelRedispatchBudget: 0,
      },
      requestedAt: "2026-07-13T09:59:59.000Z",
      drainedAt: null,
      terminalizedAt: null,
      createdAt: "2026-07-13T09:59:59.000Z",
      updatedAt: "2026-07-13T09:59:59.000Z",
    }];
  }

  if (includeRecovery) {
    const findingSetHash = "d".repeat(64);
    const findingId = `FIND_${"c".repeat(64)}`;
    const packetHash = "e".repeat(64);
    const sliceHash = "f".repeat(64);
    const sourceRevision = { sha: "1".repeat(40), treeHash: "2".repeat(40) };
    const findingSetRef = `setfarm://finding-sets/${findingSetHash}`;
    const recoveryCaseId = `RCV_${"4".repeat(64)}`;
    const recoveryCaseRef = `setfarm://recovery-cases/${recoveryCaseId}`;
    const revisionId = `RREV_${"6".repeat(64)}`;
    const revisionRef = `setfarm://recovery-revisions/${revisionId}`;
    snapshot.source.capabilities.findingRecovery = true;
    snapshot.source.capabilities.evidenceLedger = true;
    snapshot.findingSets = [{
      ref: findingSetRef,
      findingSetId: `FSET_${"a".repeat(64)}`,
      findingSetHash,
      runRef: snapshot.run.ref,
      storyRef: "setfarm://runs/run-1/stories/US-001",
      storyId: "US-001",
      packetHash,
      sliceHash,
      sourceRevision,
      findingIds: [findingId],
      createdAt: "2026-07-13T09:59:00.000Z",
    }];
    snapshot.evidenceBundles = [{
      ref: `setfarm://evidence-bundles/${"3".repeat(64)}`,
      evidenceId: `EVB_${"b".repeat(64)}`,
      evidenceBundleHash: "3".repeat(64),
      runRef: snapshot.run.ref,
      storyRef: "setfarm://runs/run-1/stories/US-001",
      storyId: "US-001",
      attemptRef: null,
      attemptId: null,
      packetHash,
      sliceHash,
      sourceRevision,
      aggregateVerdict: "fail",
      predicateCount: 2,
      observationCount: 3,
      createdAt: "2026-07-13T09:59:30.000Z",
    }];
    snapshot.recoveryCases = [{
      ref: recoveryCaseRef,
      recoveryCaseId,
      revisionRef,
      revisionId,
      revisionNumber: 1,
      runRef: snapshot.run.ref,
      storyRef: "setfarm://runs/run-1/stories/US-001",
      storyId: "US-001",
      findingSetRef,
      findingSetHash,
      packetHash,
      sliceHash,
      sourceRevision,
      owner: "supervisor",
      expectedDeltaKind: "source_change",
      status: "repairing",
      budget: {
        limits: { implement: 1, supervisorRepair: 1, evidenceOnly: 2 },
        used: { implement: 1, supervisorRepair: 0, evidenceOnly: 0 },
      },
      stateVersion: 2,
      terminalReasonCode: null,
      createdAt: "2026-07-13T09:59:00.000Z",
      updatedAt: "2026-07-13T09:59:59.000Z",
    }];
    snapshot.recoveryDispatches = [{
      ref: `setfarm://recovery-dispatches/RDISP_${"5".repeat(64)}`,
      dispatchId: `RDISP_${"5".repeat(64)}`,
      recoveryCaseRef,
      recoveryCaseId,
      revisionRef,
      revisionId,
      revisionNumber: 1,
      runRef: snapshot.run.ref,
      storyRef: "setfarm://runs/run-1/stories/US-001",
      storyId: "US-001",
      findingSetRef,
      findingSetHash,
      dispatchClass: "supervisor_repair",
      packetHash,
      sliceHash,
      sourceRevision,
      findingIds: [findingId],
      deliveryState: "failed",
      attemptRef: "setfarm://execution-attempt/ATT_0000000000000001",
      attemptId: "ATT_0000000000000001",
      claimRef: "setfarm://claim-log/42",
      executionSliceHash: "7".repeat(64),
      attemptCount: 1,
      leaseOwnerInstanceId: "recovery-worker",
      leaseExpiresAt: "2026-07-13T10:01:00.000Z",
      terminalReasonCode: "verification_failed",
      authorizedAt: "2026-07-13T09:59:59.000Z",
      terminalAt: "2026-07-13T10:00:00.000Z",
    }];
  }

  if (includeDeployment) {
    snapshot.deploymentReceipt = {
      ref: `setfarm://v3-deploy-receipts/${"d".repeat(64)}`,
      receipt: {
        schema: "setfarm.v3-deploy-receipt.v1",
        runId: snapshot.run.id,
        candidateId: `ACPT_${"c".repeat(64)}`,
        candidateHash: "c".repeat(64),
        packetHash: "b".repeat(64),
        project: {
          schema: "setfarm.v3-deploy-project.v1",
          productId: "PROD_LEDGER",
          projectId: "prod-ledger-cccccccccccc",
          displayName: "Canonical Ledger",
          summary: "Canonical operational evidence ledger.",
        },
        stack: {
          schema: "setfarm.v3-deploy-stack.v1",
          stackPackId: "vite-react",
          stackPackVersion: "1.0.0",
          stackPackContentHash: "a".repeat(64),
          platform: "web",
          techStack: "vite-react",
        },
        buildCommandId: "CMD_BUILD",
        previewCommandId: "CMD_PREVIEW",
        sourceBefore: { sha: "1".repeat(40), treeHash: "2".repeat(40) },
        sourceAfter: { sha: "1".repeat(40), treeHash: "2".repeat(40) },
        buildArtifact: {
          schema: "setfarm.v3-build-artifact.v1",
          outputPaths: ["dist"],
          files: [{
            path: "dist/index.html",
            byteLength: 14,
            contentHash: "e".repeat(64),
            executable: false,
          }],
          totalBytes: 14,
          artifactHash: "f".repeat(64),
          evidenceRef: `setfarm://deploy/build-artifact/${snapshot.run.id}/${"f".repeat(64)}`,
        },
        runtime: {
          schema: "setfarm.v3-runtime-deployment.v1",
          mode: "local",
          projectId: "prod-ledger-cccccccccccc",
          serviceId: "process:7123",
          host: "127.0.0.1",
          port: 4123,
          healthUrl: "http://127.0.0.1:4123/",
          deployUrl: "http://127.0.0.1:4123/",
          evidenceRef: "setfarm://deploy/runtime-proof",
          buildArtifactHash: "f".repeat(64),
          buildArtifactEvidenceRef: `setfarm://deploy/build-artifact/${snapshot.run.id}/${"f".repeat(64)}`,
          sealedRuntimeRef: `setfarm://deploy/sealed-runtime/${snapshot.run.id}/${"c".repeat(64)}/${"f".repeat(64)}`,
        },
        health: {
          schema: "setfarm.v3-deploy-health-proof.v1",
          status: "pass",
          httpStatus: 200,
          checkedAt: "2026-07-13T09:59:59.000Z",
          evidenceRef: "setfarm://deploy/health-proof",
          buildArtifactHash: "f".repeat(64),
          buildArtifactEvidenceRef: `setfarm://deploy/build-artifact/${snapshot.run.id}/${"f".repeat(64)}`,
          listenerOwnership: {
            schema: "setfarm.v3-listener-ownership.v1",
            ownerProcess: {
              schema: "setfarm.process-identity.v1",
              pid: 7123,
              processStartedAt: "2026-07-13T09:59:50.000Z",
              processGroupId: 7123,
              source: "observed_os",
            },
            listenerPids: [7123],
            listenerProcesses: [{
              schema: "setfarm.process-identity.v1",
              pid: 7123,
              processStartedAt: "2026-07-13T09:59:50.000Z",
              processGroupId: 7123,
              source: "observed_os",
            }],
            host: "127.0.0.1",
            port: 4123,
            checkedAt: "2026-07-13T09:59:59.000Z",
            evidenceRef: "setfarm://deploy/listener-proof",
          },
        },
        terminalProjectProjection: {
          schema: "setfarm.v3-terminal-project-projection.v1",
          owner: "mission-control-terminal-projector",
          state: "pending_terminal_projection",
          runId: snapshot.run.id,
          candidateHash: "c".repeat(64),
          projectId: "prod-ledger-cccccccccccc",
          serviceId: "process:7123",
          port: 4123,
          healthUrl: "http://127.0.0.1:4123/",
          evidenceRef: "setfarm://run/run-1/deploy-receipt",
          buildArtifactHash: "f".repeat(64),
        },
        environmentNames: [],
        completedAt: "2026-07-13T09:59:59.000Z",
        receiptHash: "d".repeat(64),
      },
      createdAt: "2026-07-13T09:59:59.000Z",
    };
  }

  return renderToStaticMarkup(
    <OperationalEvidence state={{ status: "ok", snapshot }} now={Date.parse("2026-07-13T10:00:00.000Z")} />,
  );
}

test("renders explicit unavailable state without an operational prose fallback", () => {
  const html = renderToStaticMarkup(<OperationalEvidence state={{
    status: "unavailable",
    code: "SETFARM_OPERATIONAL_SNAPSHOT_UNAVAILABLE",
    reason: "network",
  }} />);

  assert.match(html, /Operational authority is locked/);
  assert.match(html, /No prose, transcript, regex classifier, or local status fallback/);
  assert.doesNotMatch(html, /STOP_ALLOWED/);
});

test("renders partial projection honestly and keeps actions locked", () => {
  const html = renderSnapshot("partial");
  assert.match(html, /PARTIAL PROJECTION/);
  assert.match(html, /OPERATIONAL_PROJECTION_INCOMPLETE/);
  assert.match(html, /setfarm:\/\/runs\/run-1\/steps\/implement/);
  assert.match(html, /setfarm:\/\/claims\/claim-1/);
});

test("renders complete canonical action authority and evidence refs", () => {
  const html = renderSnapshot("complete");
  assert.match(html, /STOP/);
  assert.match(html, /ALLOWED/);
  assert.match(html, /STOP_ALLOWED/);
  assert.match(html, /Step evidence refs/);
  assert.match(html, /Story evidence refs/);
});

test("renders typed finding, evidence, and bounded recovery identity without prose-derived status", () => {
  const html = renderSnapshot("complete", true);

  assert.match(html, new RegExp(`FSET_${"a".repeat(64)}`));
  assert.match(html, new RegExp(`EVB_${"b".repeat(64)}`));
  assert.match(html, new RegExp(`RCV_${"4".repeat(64)}`));
  assert.match(html, new RegExp(`RDISP_${"5".repeat(64)}`));
  assert.match(html, /supervisor \/ repairing/);
  assert.match(html, /supervisor 0\/1/);
  assert.match(html, new RegExp(`RREV_${"6".repeat(64)}`));
  assert.match(html, /supervisor_repair \/ failed/);
  assert.match(html, /ATT_0000000000000001/);
  assert.match(html, /setfarm:\/\/claim-log\/42/);
  assert.match(html, /recovery-worker/);
  assert.match(html, /verification_failed/);
  assert.match(html, new RegExp(`packet ${"e".repeat(64)}`));
  assert.match(html, new RegExp(`slice ${"f".repeat(64)}`));
  assert.match(html, new RegExp(`source ${"1".repeat(40)}`));
  assert.match(html, /fail/);
  assert.doesNotMatch(html, /agent says|review comment says|probably fixed/i);
});

test("renders canonical typed termination authority without classifying diagnostic prose", () => {
  const html = renderSnapshot("complete", false, true);
  assert.match(html, /setfarm\.product-compiler\.deploy-refusal/);
  assert.match(html, /V3_DEPLOY_SOURCE_REVISION_MISMATCH:canonical refusal/);
  assert.match(html, /setfarm\.v3-deploy-authority-termination\.v1/);
  assert.match(html, /refusal c{64}/);
  assert.match(html, /model redispatch budget 0/);
  assert.match(html, /expectedSha/);
  assert.match(html, /observedSha/);
  assert.doesNotMatch(html, /regex|classifier matched|probably/i);
});

test("labels absent optional recovery collections unsupported instead of canonical zero", () => {
  const html = renderSnapshot("complete");
  assert.match(html, /Finding sets/);
  assert.match(html, /Evidence bundles/);
  assert.match(html, /Not exposed by the upstream canonical snapshot capability/);
  assert.match(html, /unsupported/);
});

test("renders canonical deployment receipt fields without a service-name heuristic", () => {
  const html = renderSnapshot("complete", false, false, true);
  assert.match(html, /Canonical deployment receipt/);
  assert.match(html, /Canonical Ledger/);
  assert.match(html, /prod-ledger-cccccccccccc/);
  assert.match(html, /process:7123/);
  assert.match(html, /sealed build ffffffffffff/);
  assert.match(html, /immutable served runtime/);
  assert.match(html, /listener owner PID 7123/);
  assert.match(html, /HTTP 200/);
  assert.match(html, /http:\/\/127\.0\.0\.1:4123\//);
  assert.match(html, /mission-control-terminal-projector/);
  assert.doesNotMatch(html, /probably|same-name|prefix match/i);
});

test("renders bounded v2 implementation receipt metadata without raw proposal or result", () => {
  const envelope = JSON.parse(readFileSync(
    new URL("../contracts/vendor/setfarm/run-operational-snapshot.v2.compatibility.json", import.meta.url),
    "utf8",
  )) as { fixture: RunOperationalSnapshotV2 };
  const snapshot = envelope.fixture;
  const evidence = snapshot.completionRequests[0]?.implementationSubmissionEvidence;
  assert.ok(evidence);
  const html = renderToStaticMarkup(
    <OperationalEvidence
      state={{ status: "ok", snapshot }}
      now={Date.parse(snapshot.generatedAt)}
    />,
  );
  assert.match(html, new RegExp(evidence.receipt.sourceSchema.replaceAll(".", "\\.")));
  assert.match(html, new RegExp(evidence.receipt.sourceProposalHash.slice(0, 12)));
  assert.match(html, new RegExp(evidence.receipt.canonicalOutputHash.slice(0, 12)));
  assert.match(html, new RegExp(`ignored provider field paths · ${evidence.receipt.ignoredFieldPaths.length}`));
  evidence.receipt.ignoredFieldPaths.forEach((pointer) => assert.match(html, new RegExp(pointer.replace("/", "\\/"))));
  assert.doesNotMatch(html, /providerAnnotation.*transport-only|raw proposal|completion result/i);

  const manyPaths = structuredClone(snapshot);
  manyPaths.completionRequests[0]!.implementationSubmissionEvidence!.receipt.ignoredFieldPaths = Array.from(
    { length: 101 },
    (_, index) => `/field-${String(index).padStart(3, "0")}`,
  );
  const boundedHtml = renderToStaticMarkup(
    <OperationalEvidence state={{ status: "ok", snapshot: manyPaths }} now={Date.parse(manyPaths.generatedAt)} />,
  );
  assert.match(boundedHtml, /ignored provider field paths · 101/);
  assert.match(boundedHtml, /1 additional path\(s\) omitted from rendering/);
  assert.doesNotMatch(boundedHtml, /\/field-100/);
});
