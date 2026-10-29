import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ProductBuildAuthority } from "../src/components/run-detail/ProductBuildAuthority.js";
import {
  parseProductBuildAuthorityResponse,
  shouldPollProductBuildAuthority,
  type ProductBuildAuthorityV1,
  type ProductBuildAuthorityV2,
} from "../src/lib/product-build-authority.js";

const HASH = "a".repeat(64);

function fixture(): ProductBuildAuthorityV1 {
  return {
    schema: "setfarm.product-build-authority.v1",
    runId: "run-ui-1",
    packetHash: HASH,
    authorityHash: "b".repeat(64),
    producer: { pass: "setup-build", codeSha: "c".repeat(40), toolVersions: {} },
    productSpec: { schema: "setfarm.product-spec.v1", routes: [{}], surfaces: [{}], actions: [{}] },
    designGraph: {
      schema: "setfarm.design-interaction-graph.v1",
      surfaces: [{}],
      controls: [{
        id: "CTRL_SAVE_TASK",
        kind: "button",
        surfaceRef: "SURF_EDITOR",
        label: "Save",
        source: { artifactHash: "d".repeat(64), locator: "stitch/screen.html", selector: "[data-action=ACT_SAVE_TASK]" },
        renderedSource: { artifactHash: "e".repeat(64), locator: "stitch/rendered-dom/screen.html", elementRef: "E000002" },
      }],
      bindings: [{
        controlRef: "CTRL_SAVE_TASK",
        disposition: "action",
        actionRef: "ACT_SAVE_TASK",
        stateRefs: ["STATE_EDITOR"],
        persistenceRefs: ["PERSIST_TASK_LOCAL"],
        evidenceRefs: ["EVID_SAVE_CONFIRMATION"],
      }],
    },
    buildTopology: { schema: "setfarm.build-topology.v1" },
    storyPlan: { schema: "setfarm.story-plan.v1", stories: [{}] },
    packet: {
      schema: "setfarm.product-build-packet.v2",
      packetVersion: 2,
      compiler: { version: "3.6.0", codeSha: "c".repeat(40) },
      validationIds: ["VALIDATE_DESIGN_SOURCE_CLOSURE"],
    },
    compilationReport: { schema: "setfarm.product-compilation-report.v2" },
    refs: {
      packet: HASH,
      productSpec: "1".repeat(64),
      designGraph: "2".repeat(64),
      buildTopology: "3".repeat(64),
      storyPlan: "4".repeat(64),
      designSourceClosure: "5".repeat(64),
      compilationReport: "6".repeat(64),
    },
    designSourceClosure: { schema: "setfarm.design-source-closure.v1", kind: "stitch" },
    designSources: {
      generationTargets: { schema: "setfarm.design-generation-targets.v1", targets: [{}] },
      directResponseEvidence: { schema: "setfarm.stitch-direct-response-evidence.v2" },
      renderedSemantics: { schema: "setfarm.stitch-rendered-semantics.v1", candidates: [{}] },
      candidateSelection: { schema: "setfarm.stitch-target-candidate-selection.v1" },
      responseBindings: {
        schema: "setfarm.stitch-target-response-bindings.v2",
        bindings: [{
          targetRef: "TGT_SURF_EDITOR",
          requestScreenKey: "editor",
          expectedScreenTitle: "Task editor",
          responseScreenId: "screen-editor",
          responseTitle: "Task editor",
          stageId: "stage-editor",
          htmlArtifactHash: "7".repeat(64),
          screenshotArtifactHash: "8".repeat(64),
          semanticDomHash: "9".repeat(64),
          semanticObservationHash: "0".repeat(64),
          contractElementRefs: ["E000001", "E000002"],
        }],
      },
    },
  };
}

function sealedV2Fixture(): ProductBuildAuthorityV2 {
  return {
    schema: "setfarm.product-build-authority.v2",
    runId: "run-ui-1",
    disposition: "sealed_packet",
    packetAuthority: fixture(),
    refusal: null,
    authorityHash: "f".repeat(64),
  };
}

function refusedV2Fixture(): ProductBuildAuthorityV2 {
  const failureArtifactHash = "1".repeat(64);
  const failureFingerprint = "2".repeat(64);
  const candidateSelectionHash = "3".repeat(64);
  return {
    schema: "setfarm.product-build-authority.v2",
    runId: "run-ui-refused",
    disposition: "refused_before_packet",
    packetAuthority: null,
    refusal: {
      terminationRequestRef: "setfarm://run-termination/RTR_ui_refused",
      failureIdentity: {
        schema: "setfarm.operational-failure-identity.v2",
        requestedBy: "setfarm.product-compiler.design-refusal",
        evidenceSchema: "setfarm.v3-design-candidate-authority-termination.v1",
        operationalCause: {
          schema: "setfarm.operational-failure-cause.v1",
          workflowStepId: "design",
          boundary: "product_compiler.design_candidate_authority",
          failureClass: "generated_artifact_invalid",
          failureCode: "V3_DESIGN_CANDIDATE_AUTHORITY_UNRESOLVED",
        },
        operationalCauseHash: "4".repeat(64),
        exactFailure: {
          schema: "setfarm.operational-exact-failure-identity.v2",
          kind: "stitch_target_candidate_selection",
          refKey: "STITCH_TARGET_CANDIDATE_SELECTION_FAILURE",
          artifactType: "setfarm.stitch-target-candidate-selection-failure.v1",
          failureArtifactHash,
          failureFingerprint,
          candidateSelectionHash,
        },
      },
      failureArtifact: {
        refKey: "STITCH_TARGET_CANDIDATE_SELECTION_FAILURE",
        artifactHash: failureArtifactHash,
        envelope: {
          schema: "setfarm.semantic-artifact-envelope.v1",
          artifactType: "setfarm.stitch-target-candidate-selection-failure.v1",
          producer: {},
          payload: { fingerprint: failureFingerprint, candidateSelectionHash },
        },
      },
    },
    authorityHash: "5".repeat(64),
  };
}

test("renders exact packet, target, action, persistence, and rendered-element authority", () => {
  const html = renderToStaticMarkup(<ProductBuildAuthority state={{ status: "ok", authority: fixture() }} />);
  assert.match(html, /setfarm\.product-build-authority\.v1/);
  assert.match(html, /TGT_SURF_EDITOR/);
  assert.match(html, /screen-editor/);
  assert.match(html, /CTRL_SAVE_TASK/);
  assert.match(html, /ACT_SAVE_TASK/);
  assert.match(html, /PERSIST_TASK_LOCAL/);
  assert.match(html, /E000002/);
  assert.doesNotMatch(html, /agent said/i);
});

test("renders versioned sealed and refused authority from canonical operational evidence", () => {
  const sealed = sealedV2Fixture();
  const sealedHtml = renderToStaticMarkup(<ProductBuildAuthority state={{ status: "ok", authority: sealed }} />);
  assert.match(sealedHtml, /setfarm\.product-build-authority\.v2/);
  assert.match(sealedHtml, /SEALED/);
  assert.match(sealedHtml, /ACT_SAVE_TASK/);

  const refused = refusedV2Fixture();
  const refusedHtml = renderToStaticMarkup(<ProductBuildAuthority state={{ status: "ok", authority: refused }} />);
  assert.match(refusedHtml, /REFUSED/);
  assert.match(refusedHtml, /V3_DESIGN_CANDIDATE_AUTHORITY_UNRESOLVED/);
  assert.match(refusedHtml, /product_compiler\.design_candidate_authority/);
  assert.match(refusedHtml, /RTR_ui_refused/);
  assert.doesNotMatch(refusedHtml, /agent said/i);

  assert.equal(parseProductBuildAuthorityResponse(200, sealed, sealed.runId).status, "ok");
  assert.equal(parseProductBuildAuthorityResponse(200, refused, refused.runId).status, "ok");
  const drifted = structuredClone(refused) as any;
  drifted.refusal.failureArtifact.artifactHash = "6".repeat(64);
  assert.equal(parseProductBuildAuthorityResponse(200, drifted, refused.runId).status, "upstream_error");
});

test("fails closed in the UI and response parser when canonical authority is unavailable", () => {
  const unavailable = {
    status: "unavailable" as const,
    code: "SETFARM_PRODUCT_BUILD_AUTHORITY_NOT_READY",
    reason: "not_ready",
    upstreamCode: "RUNTIME_PACKET_NOT_SEALED",
  };
  const html = renderToStaticMarkup(<ProductBuildAuthority state={unavailable} />);
  assert.match(html, /No agent output, story prose, or GitHub comment is used as a fallback/);
  assert.match(html, /RUNTIME_PACKET_NOT_SEALED/);

  assert.equal(parseProductBuildAuthorityResponse(200, { ...fixture(), runId: "foreign" }, "run-ui-1").status, "upstream_error");
  assert.deepEqual(parseProductBuildAuthorityResponse(200, { ...fixture(), schema: "setfarm.product-build-authority.v3" }, "run-ui-1"), { status: "upstream_error", code: "SETFARM_PRODUCT_BUILD_AUTHORITY_UPSTREAM_ERROR", reason: "invalid_payload", upstreamStatus: 200 });

  const missingCompiler = structuredClone(fixture()) as any;
  delete missingCompiler.packet.compiler;
  assert.equal(parseProductBuildAuthorityResponse(200, missingCompiler, "run-ui-1").status, "upstream_error");

  const missingElementRefs = structuredClone(fixture()) as any;
  delete missingElementRefs.designSources.responseBindings.bindings[0].contractElementRefs;
  assert.equal(parseProductBuildAuthorityResponse(200, missingElementRefs, "run-ui-1").status, "upstream_error");

  const missingStitchSources = structuredClone(fixture()) as any;
  delete missingStitchSources.designSources;
  assert.equal(parseProductBuildAuthorityResponse(200, missingStitchSources, "run-ui-1").status, "upstream_error");

  const legacy = structuredClone(fixture()) as any;
  legacy.packet.schema = "setfarm.product-build-packet.v1";
  legacy.packet.packetVersion = 1;
  delete legacy.designSourceClosure;
  delete legacy.designSources;
  delete legacy.refs.designSourceClosure;
  assert.equal(parseProductBuildAuthorityResponse(200, legacy, "run-ui-1").status, "ok");
});

test("polling ends once immutable Product Build authority is available", () => {
  assert.equal(shouldPollProductBuildAuthority({ status: "loading" }), true);
  assert.equal(shouldPollProductBuildAuthority({
    status: "unavailable",
    code: "SETFARM_PRODUCT_BUILD_AUTHORITY_NOT_READY",
    reason: "not_ready",
  }), true);
  assert.equal(shouldPollProductBuildAuthority({ status: "ok", authority: fixture() }), false);
});


// Stage B uses the unchanged paired corpus through the real browser parser.
// The earlier legacy render fixtures and assertions remain separate coverage.
import corpus from "./fixtures/product-build-authority-v3-wire.json" with { type: "json" };
import { NativeProductBuildAuthority } from "../src/components/run-detail/NativeProductBuildAuthority.js";

function paired(name: string) {
  const entry = corpus.cases.find(item => item.name === name); assert.ok(entry);
  const result = parseProductBuildAuthorityResponse(200, entry.wire, entry.wire.runId);
  assert.equal(result.status, "ok");
  if (result.status !== "ok") throw new Error("Expected paired authority");
  return result.authority;
}

function noFinalClaims(html: string) {
  assert.doesNotMatch(html, /deployed|deployment successful|final acceptance|accepted.final|production ready/i);
}

test("Stage B native Stitch renders exact graph and independent source-map references", () => {
  const authority = paired("native_stitch");
  const html = renderToStaticMarkup(<ProductBuildAuthority state={{ status: "ok", authority }} />);
  assert.ok(authority.schema === "setfarm.product-build-authority.v3" && authority.disposition === "sealed_packet" && authority.packetAuthority.schema === "setfarm.product-build-packet-authority.v3");
  const packet = authority.packetAuthority; assert.ok(packet.designGraph);
  for (const control of packet.designGraph.controls) {
    for (const value of [control.identity.actionRef, control.identity.controlSlotRef, control.identity.surfaceRef, control.elementRef, control.elementHash, control.source.targetRef, control.source.sourceHash]) assert.ok(html.includes(value), value);
  }
  for (const observable of packet.designGraph.observables) {
    for (const value of [observable.observableRef, observable.actionRef, observable.evidenceRef, observable.assertionsHash]) assert.ok(html.includes(value), value);
  }
  assert.match(html, /Native implementation source map/);
  for (const screen of packet.implementationSourceMap.screens) {
    for (const value of [screen.targetRef, screen.pathRef, screen.path, screen.contentHash, screen.rootSurface.sourceElementRef]) assert.ok(html.includes(value), value);
  }
  assert.match(html, /role: none/); assert.match(html, /href: none/);
  noFinalClaims(html);
});

test("Stage B native graphless authority explicitly shows no design rather than an empty graph", () => {
  const html = renderToStaticMarkup(<ProductBuildAuthority state={{ status: "ok", authority: paired("native_none") }} />);
  assert.match(html, /No design graph is required/);
  assert.match(html, /product_delivery_design_not_required/);
  assert.match(html, /No implementation screens are required/);
  assert.match(html, /designGraph.*?none/);
  noFinalClaims(html);
});

test("Stage B paired refused authority preserves exact cause, fingerprint and termination", () => {
  const authority = paired("refused_before_packet");
  assert.ok(authority.schema === "setfarm.product-build-authority.v3" && authority.disposition === "refused_before_packet");
  const html = renderToStaticMarkup(<ProductBuildAuthority state={{ status: "ok", authority }} />);
  const refusal = authority.refusal;
  for (const value of [refusal.failureIdentity.operationalCause.failureCode, refusal.failureIdentity.operationalCauseHash, refusal.failureIdentity.exactFailure.failureFingerprint, refusal.terminationRequestRef]) assert.ok(html.includes(value), value);
  assert.match(html, /REFUSED/); assert.doesNotMatch(html, /Native physical controls|Native implementation source map/); noFinalClaims(html);
});

for (const name of ["legacy1", "legacy2"]) {
  test(`Stage B v3-wrapped ${name} retains legacy rendering`, () => {
    const html = renderToStaticMarkup(<ProductBuildAuthority state={{ status: "ok", authority: paired(name) }} />);
    assert.match(html, /Exact control\/action\/link dispositions/);
    assert.doesNotMatch(html, /Native physical controls/); noFinalClaims(html);
  });
}

test("Stage B known malformed and unknown responses render unavailable without native collections", () => {
  for (const body of [{ schema: "setfarm.product-build-authority.v3" }, { schema: "setfarm.product-build-authority.v99" }]) {
    const state = parseProductBuildAuthorityResponse(200, body, "synthetic");
    const html = renderToStaticMarkup(<ProductBuildAuthority state={state} />);
    assert.match(html, /Sealed product authority is unavailable/);
    assert.doesNotMatch(html, /Native physical controls|Native implementation source map/); noFinalClaims(html);
  }
});

test("Stage B render-only synthetic collections are bounded independently at 200 with omitted counts", () => {
  // Renderer-only object: never passed to a parser or treated as sealed authority.
  const authority = paired("native_stitch");
  assert.ok(authority.schema === "setfarm.product-build-authority.v3" && authority.disposition === "sealed_packet" && authority.packetAuthority.schema === "setfarm.product-build-packet-authority.v3");
  const packet = structuredClone(authority.packetAuthority); assert.ok(packet.designGraph);
  const graph = packet.designGraph;
  graph.controls = Array.from({ length: 203 }, (_, index) => ({ ...graph.controls[0]!, id: `RENDER_ONLY_CONTROL_${index}` }));
  graph.actions = Array.from({ length: 203 }, (_, index) => ({ ...graph.actions[0]!, actionRef: `RENDER_ONLY_ACTION_${index}` }));
  graph.observables = Array.from({ length: 203 }, (_, index) => ({ ...graph.observables[0]!, observableRef: `RENDER_ONLY_OBSERVABLE_${index}` }));
  graph.surfaces = Array.from({ length: 203 }, (_, index) => ({ ...graph.surfaces[0]!, surfaceRef: `RENDER_ONLY_SURFACE_${index}` }));
  graph.sourceAuthorities = Array.from({ length: 203 }, (_, index) => ({ ...graph.sourceAuthorities[0]!, targetRef: `RENDER_ONLY_TARGET_${index}` }));
  const sourceMap = packet.implementationSourceMap;
  assert.equal(sourceMap.designSourceKind, "stitch");
  if (sourceMap.designSourceKind !== "stitch") throw new Error("Expected Stitch source map");
  sourceMap.screens = Array.from({ length: 203 }, (_, index) => ({ ...sourceMap.screens[0]!, path: `src/RenderOnlyScreen_${index}.tsx` }));
  const html = renderToStaticMarkup(<NativeProductBuildAuthority authority={packet} outerAuthorityHash={authority.authorityHash} outerSchema="setfarm.product-build-authority.v3" />);
  for (const label of ["CONTROL", "ACTION", "OBSERVABLE", "SURFACE", "TARGET"]) {
    assert.ok(html.includes(`RENDER_ONLY_${label}_199`));
    assert.ok(!html.includes(`RENDER_ONLY_${label}_200`));
  }
  assert.ok(html.includes("src/RenderOnlyScreen_199.tsx"));
  assert.ok(!html.includes("src/RenderOnlyScreen_200.tsx"));
  assert.ok((html.match(/3 additional .*? omitted from rendering/g) || []).length >= 6);
  noFinalClaims(html);
});
