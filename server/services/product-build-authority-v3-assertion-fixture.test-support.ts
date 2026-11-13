import assert from "node:assert/strict";
import type { ProductBuildPacketAuthorityV3Wire } from "../../shared/product-build-authority-v3-wire.js";
import { hashCanonicalJson } from "./setfarm-canonical-json-v1.js";

type RecordValue = Record<string, unknown>;

export function stitchAssertionParts(wire: RecordValue) {
  // Only called with a clone of the checked-in synthetic native_stitch corpus.
  const native = wire.packetAuthority as ProductBuildPacketAuthorityV3Wire;
  const { designGraph: graph, designSources: sources, designSourceClosure: closure } = native;
  assert.ok(graph && sources && closure.kind === "stitch");
  const productAction = native.productSpec.actions[0]!;
  const productObservable = productAction.observableEffects[0]!;
  const graphObservable = graph.observables[0]!;
  assert.equal(productObservable.id, "OBS_READY");
  assert.equal(graphObservable.observableRef, productObservable.id);
  return { native, graph, sources, closure, productAction, productObservable, graphObservable };
}

function hashIdentity(value: { authorityHash: unknown }): void {
  const { authorityHash: _hash, ...identity } = value;
  value.authorityHash = hashCanonicalJson(identity);
}

// Rebind assertion-dependent leaves before their parents. Never sort either
// assertion list or repair semantic differences between graph and ProductSpec.
export function resealSyntheticStitchAssertions(
  wire: RecordValue,
  preserveObservableHash?: "productObservableHash" | "assertionsHash",
): void {
  const { native, graph, sources, closure, productAction, productObservable, graphObservable } = stitchAssertionParts(wire);
  const envelopeHash = (payload: { schema: string }) => hashCanonicalJson({
    schema: "setfarm.semantic-artifact-envelope.v1", artifactType: payload.schema,
    producer: native.producer, payload,
  });
  if (preserveObservableHash !== "productObservableHash") graphObservable.productObservableHash = hashCanonicalJson(productObservable);
  if (preserveObservableHash !== "assertionsHash") graphObservable.assertionsHash = hashCanonicalJson(graphObservable.assertions);
  graph.actions[0]!.productActionHash = hashCanonicalJson(productAction);
  const specHash = hashCanonicalJson(native.productSpec);
  graph.productSpecHash = sources.generationTargets.productSpecHash = specHash;
  const target = sources.generationTargets.targets[0]!;
  target.requiredObservableSelectors[0]!.assertions = structuredClone(productObservable.assertions);
  const targetHash = hashCanonicalJson(target);
  const response = sources.responseBindings.bindings[0]!;
  response.targetHash = targetHash;
  const authority = graph.sourceAuthorities[0]!;
  authority.targetHash = targetHash;
  const { sourceHash: _sourceHash, ...sourceIdentity } = authority;
  authority.sourceHash = hashCanonicalJson(sourceIdentity);
  for (const element of [...graph.surfaces, ...graph.controls, ...graph.observables]) element.source.sourceHash = authority.sourceHash;

  const targetsHash = hashCanonicalJson(sources.generationTargets);
  const directHash = hashCanonicalJson(sources.directResponseEvidence);
  sources.renderedSemantics.generationTargetsHash = targetsHash;
  sources.renderedSemantics.directResponseEvidenceHash = directHash;
  const renderedHash = hashCanonicalJson(sources.renderedSemantics);
  Object.assign(sources.candidateSelection, { generationTargetsHash: targetsHash, directResponseEvidenceHash: directHash, renderedSemanticsHash: renderedHash });
  const selectionHash = hashCanonicalJson(sources.candidateSelection);
  Object.assign(sources.responseBindings, { generationTargetsHash: targetsHash, directResponseEvidenceHash: directHash, renderedSemanticsHash: renderedHash, candidateSelectionHash: selectionHash });
  Object.assign(graph, { generationTargetsHash: targetsHash, renderedSemanticsHash: renderedHash, candidateSelectionHash: selectionHash, responseBindingsHash: hashCanonicalJson(sources.responseBindings) });

  // Nested producers are not in the paired wire. These synthetic replacements
  // use the fixture's known producer instead of claiming an unknown identity.
  for (const field of ["generationTargets", "directResponseEvidence", "renderedSemantics", "candidateSelection", "responseBindings"] as const) {
    closure[field].payloadHash = hashCanonicalJson(sources[field]);
    closure[field].envelopeHash = envelopeHash(sources[field]);
  }
  const graphHash = hashCanonicalJson(graph);
  closure.designGraph.payloadHash = graphHash;
  closure.designGraph.envelopeHash = envelopeHash(graph);
  const stories = native.storyPlan;
  stories.productSpecHash = specHash;
  stories.designGraphHash = graphHash;
  const sourceMap = native.implementationSourceMap;
  Object.assign(sourceMap, {
    productSpecV2PayloadHash: specHash, designGraphV2PayloadHash: graphHash,
    storyPlanV2PayloadHash: hashCanonicalJson(stories), designSourceClosureV2PayloadHash: hashCanonicalJson(closure),
  });
  sourceMap.screens[0]!.targetHash = targetHash;
  sourceMap.screens[0]!.responseBindingHash = hashCanonicalJson(response);
  sourceMap.screens[0]!.observables[0]!.assertionsHash = graphObservable.assertionsHash;
  native.compilationReport.inputHashes = [specHash];

  for (const [field, packetField, reportField] of [
    ["productSpec", "productSpecV2Hash", "productSpecV2"], ["designGraph", "designGraphV2Hash", "designGraphV2"],
    ["buildTopology", "buildTopologyV1Hash", "buildTopologyV1"], ["storyPlan", "storyPlanV2Hash", "storyPlanV2"],
    ["designSourceClosure", "designSourceClosureV2Hash", "designSourceClosureV2"], ["implementationSourceMap", "implementationSourceMapV1Hash", "implementationSourceMapV1"],
  ] as const) {
    const hash = envelopeHash(native[field]!);
    native.refs[field] = hash;
    native.packet[packetField] = hash;
    native.compilationReport.artifactHashes[reportField] = hash;
  }
  native.packetHash = native.refs.packet = envelopeHash(native.packet);
  native.compilationReport.packetHash = native.packetHash;
  native.refs.compilationReport = envelopeHash(native.compilationReport);
  hashIdentity(native);
  assert.ok("authorityHash" in wire);
  hashIdentity(wire as RecordValue & { authorityHash: unknown });
}
