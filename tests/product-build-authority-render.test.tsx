import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ProductBuildAuthority } from "../src/components/run-detail/ProductBuildAuthority.js";
import {
  parseProductBuildAuthorityResponse,
  type ProductBuildAuthorityV1,
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
  assert.equal(parseProductBuildAuthorityResponse(200, { ...fixture(), schema: "setfarm.product-build-authority.v2" }, "run-ui-1").status, "unsupported_schema");
});
