import assert from "node:assert/strict";
import test from "node:test";

import {
  SetfarmProductBuildAuthorityClient,
  parseProductBuildAuthority,
  parseProductBuildAuthorityV1,
  parseProductBuildAuthorityV2,
} from "./setfarm-product-build-authority.js";
import { hashCanonicalJson } from "./setfarm-operational-snapshot.js";

const HASHES = Array.from({ length: 10 }, (_, index) => index.toString(16).padStart(64, "0"));

function artifactHash(artifactType: string, producer: Record<string, unknown>, payload: unknown): string {
  return hashCanonicalJson({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType,
    producer,
    payload,
  });
}

function fixture() {
  const producer = { pass: "setup-build", codeSha: "a".repeat(40), toolVersions: { node: "22.13.0" } };
  const compiler = { version: "3.6.0", codeSha: "a".repeat(40) };
  const productSpec = { schema: "setfarm.product-spec.v1", routes: [], surfaces: [], actions: [] };
  const designGraph = { schema: "setfarm.design-interaction-graph.v1", surfaces: [], controls: [], bindings: [] };
  const buildTopology = { schema: "setfarm.build-topology.v1" };
  const storyPlan = { schema: "setfarm.story-plan.v1", stories: [] };
  const designSources = {
    generationTargets: { schema: "setfarm.design-generation-targets.v1", targets: [] },
    directResponseEvidence: { schema: "setfarm.stitch-direct-response-evidence.v2" },
    renderedSemantics: { schema: "setfarm.stitch-rendered-semantics.v1", candidates: [] },
    candidateSelection: { schema: "setfarm.stitch-target-candidate-selection.v1" },
    responseBindings: { schema: "setfarm.stitch-target-response-bindings.v2", bindings: [] },
  };
  const designSourceTypes = {
    generationTargets: "setfarm.design-generation-targets.v1",
    directResponseEvidence: "setfarm.stitch-direct-response-evidence.v2",
    renderedSemantics: "setfarm.stitch-rendered-semantics.v1",
    candidateSelection: "setfarm.stitch-target-candidate-selection.v1",
    responseBindings: "setfarm.stitch-target-response-bindings.v2",
  } as const;
  const designSourceClosure = {
    schema: "setfarm.design-source-closure.v1",
    kind: "stitch",
    ...Object.fromEntries(Object.entries(designSourceTypes).map(([field, artifactType]) => {
      const payload = designSources[field as keyof typeof designSources];
      return [field, {
        artifactType,
        envelopeHash: artifactHash(artifactType, producer, payload),
        payloadHash: hashCanonicalJson(payload),
      }];
    })),
  };
  const childRefs = {
    productSpec: artifactHash("setfarm.product-spec.v1", producer, productSpec),
    designGraph: artifactHash("setfarm.design-interaction-graph.v1", producer, designGraph),
    buildTopology: artifactHash("setfarm.build-topology.v1", producer, buildTopology),
    storyPlan: artifactHash("setfarm.story-plan.v1", producer, storyPlan),
    designSourceClosure: artifactHash("setfarm.design-source-closure.v1", producer, designSourceClosure),
  };
  const packet = {
    schema: "setfarm.product-build-packet.v2",
    packetVersion: 2,
    parentPacketHashes: [],
    productSpecHash: childRefs.productSpec,
    designGraphHash: childRefs.designGraph,
    buildTopologyHash: childRefs.buildTopology,
    storyPlanHash: childRefs.storyPlan,
    designSourceClosureHash: childRefs.designSourceClosure,
    compiler,
    validationIds: ["VALIDATE_DESIGN_SOURCE_CLOSURE"],
  };
  const packetHash = artifactHash("setfarm.product-build-packet.v2", producer, packet);
  const compilationReport = {
    schema: "setfarm.product-compilation-report.v2",
    status: "sealed",
    compiler,
    inputHashes: [HASHES[7]!],
    artifactHashes: childRefs,
    diagnostics: [],
    validationIds: ["VALIDATE_DESIGN_SOURCE_CLOSURE"],
    packetHash,
  };
  const identity = {
    schema: "setfarm.product-build-authority.v1" as const,
    runId: "run-authority-1",
    packetHash,
    producer,
    productSpec,
    designGraph,
    buildTopology,
    storyPlan,
    packet,
    compilationReport,
    refs: {
      ...childRefs,
      packet: packetHash,
      compilationReport: artifactHash("setfarm.product-compilation-report.v2", producer, compilationReport),
    },
    designSourceClosure,
    designSources,
  };
  return { ...identity, authorityHash: hashCanonicalJson(identity) };
}

function legacyFixture() {
  const producer = { pass: "setup-build", codeSha: "b".repeat(40), toolVersions: { node: "22.13.0" } };
  const compiler = { version: "3.5.0", codeSha: "b".repeat(40) };
  const productSpec = { schema: "setfarm.product-spec.v1", routes: [], surfaces: [], actions: [] };
  const designGraph = { schema: "setfarm.design-interaction-graph.v1", surfaces: [], controls: [], bindings: [] };
  const buildTopology = { schema: "setfarm.build-topology.v1" };
  const storyPlan = { schema: "setfarm.story-plan.v1", stories: [] };
  const childRefs = {
    productSpec: artifactHash("setfarm.product-spec.v1", producer, productSpec),
    designGraph: artifactHash("setfarm.design-interaction-graph.v1", producer, designGraph),
    buildTopology: artifactHash("setfarm.build-topology.v1", producer, buildTopology),
    storyPlan: artifactHash("setfarm.story-plan.v1", producer, storyPlan),
  };
  const packet = {
    schema: "setfarm.product-build-packet.v1",
    packetVersion: 1,
    parentPacketHashes: [],
    productSpecHash: childRefs.productSpec,
    designGraphHash: childRefs.designGraph,
    buildTopologyHash: childRefs.buildTopology,
    storyPlanHash: childRefs.storyPlan,
    compiler,
    validationIds: ["VALIDATE_PACKET"],
  };
  const packetHash = artifactHash("setfarm.product-build-packet.v1", producer, packet);
  const compilationReport = {
    schema: "setfarm.product-compilation-report.v1",
    status: "sealed",
    compiler,
    inputHashes: [HASHES[8]!],
    artifactHashes: childRefs,
    diagnostics: [],
    validationIds: ["VALIDATE_PACKET"],
    packetHash,
  };
  const identity = {
    schema: "setfarm.product-build-authority.v1" as const,
    runId: "run-authority-v1",
    packetHash,
    producer,
    productSpec,
    designGraph,
    buildTopology,
    storyPlan,
    packet,
    compilationReport,
    refs: {
      ...childRefs,
      packet: packetHash,
      compilationReport: artifactHash("setfarm.product-compilation-report.v1", producer, compilationReport),
    },
  };
  return { ...identity, authorityHash: hashCanonicalJson(identity) };
}

function sealedV2Fixture() {
  const packetAuthority = fixture();
  const identity = {
    schema: "setfarm.product-build-authority.v2" as const,
    runId: packetAuthority.runId,
    disposition: "sealed_packet" as const,
    packetAuthority,
    refusal: null,
  };
  return { ...identity, authorityHash: hashCanonicalJson(identity) };
}

function refusedV2Fixture() {
  const runId = "run-authority-refused-v2";
  const operationalCause = {
    schema: "setfarm.operational-failure-cause.v1",
    workflowStepId: "design",
    boundary: "product_compiler.design_candidate_authority",
    failureClass: "generated_artifact_invalid",
    failureCode: "V3_DESIGN_CANDIDATE_AUTHORITY_UNRESOLVED",
  };
  const payload = {
    schema: "setfarm.stitch-target-candidate-selection-failure.v1",
    fingerprint: "c".repeat(64),
    candidateSelectionHash: "d".repeat(64),
  };
  const envelope = {
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType: "setfarm.stitch-target-candidate-selection-failure.v1",
    producer: { pass: "candidate-selection", codeSha: "e".repeat(40), toolVersions: { zod: "4.4.3" } },
    payload,
  };
  const artifactHash = hashCanonicalJson(envelope);
  const exactFailure = {
    schema: "setfarm.operational-exact-failure-identity.v2",
    kind: "stitch_target_candidate_selection",
    refKey: "STITCH_TARGET_CANDIDATE_SELECTION_FAILURE",
    artifactType: envelope.artifactType,
    failureArtifactHash: artifactHash,
    failureFingerprint: payload.fingerprint,
    candidateSelectionHash: payload.candidateSelectionHash,
  };
  const identity = {
    schema: "setfarm.product-build-authority.v2" as const,
    runId,
    disposition: "refused_before_packet" as const,
    packetAuthority: null,
    refusal: {
      terminationRequestRef: "setfarm://run-termination/RTR_refused_v2",
      failureIdentity: {
        schema: "setfarm.operational-failure-identity.v2",
        requestedBy: "setfarm.product-compiler.design-refusal",
        evidenceSchema: "setfarm.v3-design-candidate-authority-termination.v1",
        operationalCause,
        operationalCauseHash: hashCanonicalJson(operationalCause),
        exactFailure,
      },
      failureArtifact: {
        refKey: exactFailure.refKey,
        artifactHash,
        envelope,
      },
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

  const driftedGraph = structuredClone(value);
  (driftedGraph.designGraph.surfaces as unknown[]).push({ id: "SURF_UNSEALED" });
  const { authorityHash: _graphHash, ...driftedGraphIdentity } = driftedGraph;
  driftedGraph.authorityHash = hashCanonicalJson(driftedGraphIdentity);
  assert.throws(() => parseProductBuildAuthorityV1(driftedGraph, value.runId));

  const driftedNestedSource = structuredClone(value);
  (driftedNestedSource.designSources.generationTargets.targets as unknown[]).push({ targetId: "TGT_UNSEALED" });
  const { authorityHash: _sourceHash, ...driftedSourceIdentity } = driftedNestedSource;
  driftedNestedSource.authorityHash = hashCanonicalJson(driftedSourceIdentity);
  assert.throws(() => parseProductBuildAuthorityV1(driftedNestedSource, value.runId));

  const missingCompiler = structuredClone(value) as any;
  delete missingCompiler.packet.compiler;
  const { authorityHash: _compilerHash, ...missingCompilerIdentity } = missingCompiler;
  missingCompiler.authorityHash = hashCanonicalJson(missingCompilerIdentity);
  assert.throws(() => parseProductBuildAuthorityV1(missingCompiler, value.runId));
});

test("deeply validates sealed and refused Product Build Authority v2 without prose fallback", () => {
  const sealed = sealedV2Fixture();
  assert.equal(parseProductBuildAuthorityV2(sealed, sealed.runId), sealed);
  assert.equal(parseProductBuildAuthority(sealed, sealed.runId), sealed);
  const refused = refusedV2Fixture();
  assert.equal(parseProductBuildAuthorityV2(refused, refused.runId), refused);

  const drifted = structuredClone(refused);
  drifted.refusal.failureIdentity.exactFailure.failureFingerprint = "f".repeat(64);
  const { authorityHash: _hash, ...identity } = drifted;
  drifted.authorityHash = hashCanonicalJson(identity);
  assert.throws(() => parseProductBuildAuthorityV2(drifted, refused.runId));

  const prose = { ...refused, agentSummary: "looks fixed" };
  assert.throws(() => parseProductBuildAuthorityV2(prose, refused.runId));
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

  const v2 = sealedV2Fixture();
  const current = new SetfarmProductBuildAuthorityClient({
    baseUrl: "http://setfarm.invalid",
    fetchImpl: (async () => new Response(JSON.stringify(v2), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch,
  });
  assert.equal((await current.get(v2.runId)).status, "ok");

  const unsupported = new SetfarmProductBuildAuthorityClient({
    baseUrl: "http://setfarm.invalid",
    fetchImpl: (async () => new Response(JSON.stringify({ schema: "setfarm.product-build-authority.v3" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch,
  });
  assert.deepEqual(await unsupported.get(value.runId), {
    status: "unsupported_schema",
    schema: "setfarm.product-build-authority.v3",
  });
});

test("keeps hash-bound Product Build Packet v1 authority readable during migration", () => {
  const value = legacyFixture();
  assert.equal(parseProductBuildAuthorityV1(value, value.runId), value);
});
