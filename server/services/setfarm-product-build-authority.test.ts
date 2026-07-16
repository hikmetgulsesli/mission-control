import assert from "node:assert/strict";
import test from "node:test";

import {
  SetfarmProductBuildAuthorityClient,
  parseProductBuildAuthorityV1,
} from "./setfarm-product-build-authority.js";
import { hashCanonicalJson } from "./setfarm-operational-snapshot.js";

const HASHES = Array.from({ length: 10 }, (_, index) => index.toString(16).padStart(64, "0"));

function fixture() {
  const identity = {
    schema: "setfarm.product-build-authority.v1" as const,
    runId: "run-authority-1",
    packetHash: HASHES[0]!,
    producer: { pass: "setup-build", codeSha: "a".repeat(40), toolVersions: { node: "22.13.0" } },
    productSpec: { schema: "setfarm.product-spec.v1", routes: [], surfaces: [], actions: [] },
    designGraph: { schema: "setfarm.design-interaction-graph.v1", controls: [], bindings: [] },
    buildTopology: { schema: "setfarm.build-topology.v1" },
    storyPlan: { schema: "setfarm.story-plan.v1", stories: [] },
    packet: {
      schema: "setfarm.product-build-packet.v2",
      packetVersion: 2,
      productSpecHash: HASHES[1],
      designGraphHash: HASHES[2],
      buildTopologyHash: HASHES[3],
      storyPlanHash: HASHES[4],
      designSourceClosureHash: HASHES[5],
    },
    compilationReport: {
      schema: "setfarm.product-compilation-report.v2",
      status: "sealed",
      packetHash: HASHES[0],
    },
    refs: {
      productSpec: HASHES[1],
      designGraph: HASHES[2],
      buildTopology: HASHES[3],
      storyPlan: HASHES[4],
      designSourceClosure: HASHES[5],
      packet: HASHES[0],
      compilationReport: HASHES[6],
    },
    designSourceClosure: { schema: "setfarm.design-source-closure.v1", kind: "stitch" },
    designSources: {
      generationTargets: { schema: "setfarm.design-generation-targets.v1", targets: [] },
      directResponseEvidence: { schema: "setfarm.stitch-direct-response-evidence.v2" },
      renderedSemantics: { schema: "setfarm.stitch-rendered-semantics.v1", candidates: [] },
      candidateSelection: { schema: "setfarm.stitch-target-candidate-selection.v1" },
      responseBindings: { schema: "setfarm.stitch-target-response-bindings.v2", bindings: [] },
    },
  };
  return { ...identity, authorityHash: hashCanonicalJson(identity) };
}

test("strictly preserves one hash-bound Product Build authority payload", () => {
  const value = fixture();
  assert.equal(parseProductBuildAuthorityV1(value, value.runId), value);

  const wrongRun = structuredClone(value);
  wrongRun.runId = "foreign-run";
  assert.throws(() => parseProductBuildAuthorityV1(wrongRun, value.runId));

  const wrongRef = structuredClone(value);
  wrongRef.refs.designGraph = HASHES[9]!;
  assert.throws(() => parseProductBuildAuthorityV1(wrongRef, value.runId));

  const embellished = { ...value, agentSummary: "looks complete" };
  assert.throws(() => parseProductBuildAuthorityV1(embellished, value.runId));
});

test("client distinguishes not-ready authority from transport and schema failures", async () => {
  const value = fixture();
  const ok = new SetfarmProductBuildAuthorityClient({
    baseUrl: "http://setfarm.invalid",
    fetchImpl: (async () => new Response(JSON.stringify(value), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch,
  });
  assert.equal((await ok.get(value.runId)).status, "ok");

  const notReady = new SetfarmProductBuildAuthorityClient({
    baseUrl: "http://setfarm.invalid",
    fetchImpl: (async () => new Response(JSON.stringify({
      schema: "setfarm.product-build-authority-error.v1",
      code: "RUNTIME_PACKET_NOT_SEALED",
    }), {
      status: 409,
      headers: { "content-type": "application/json" },
    })) as typeof fetch,
  });
  assert.deepEqual(await notReady.get(value.runId), {
    status: "unavailable",
    reason: "not_ready",
    upstreamStatus: 409,
    upstreamCode: "RUNTIME_PACKET_NOT_SEALED",
  });

  const unsupported = new SetfarmProductBuildAuthorityClient({
    baseUrl: "http://setfarm.invalid",
    fetchImpl: (async () => new Response(JSON.stringify({ schema: "setfarm.product-build-authority.v2" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch,
  });
  assert.deepEqual(await unsupported.get(value.runId), {
    status: "unsupported_schema",
    schema: "setfarm.product-build-authority.v2",
  });
});
