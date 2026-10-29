import { isNativePacketStructure } from "../../server/services/product-build-authority-v3-structure.js";
import type { ProductBuildAuthorityV1, ProductBuildAuthorityV2, ProductBuildRefusalV2, ProductDesignControlV1, ProductDesignBindingV1, StitchTargetResponseBindingV2 } from "./product-build-authority.js";
import type { ProductBuildPacketAuthorityV3Wire, ProductBuildAuthorityV3Wire } from "../../shared/product-build-authority-v3-wire.js";
export type { ProductBuildPacketAuthorityV3Wire, ProductBuildAuthorityV3Wire } from "../../shared/product-build-authority-v3-wire.js";
export type ProductBuildPacketAuthorityV3 = ProductBuildPacketAuthorityV3Wire;
export type ProductBuildAuthorityV3 = ProductBuildAuthorityV3Wire<ProductBuildAuthorityV1, ProductBuildRefusalV2>;

const SHA256 = /^[a-f0-9]{64}$/;
const CODE_SHA = /^[a-f0-9]{7,64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isSha(value: unknown): value is string {
  return isString(value) && SHA256.test(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isCompiler(value: unknown): value is { version: string; codeSha: string } {
  return isRecord(value) && isString(value.version) && isString(value.codeSha) && CODE_SHA.test(value.codeSha);
}

function isDesignControl(value: unknown): value is ProductDesignControlV1 {
  if (!isRecord(value) || !isString(value.id) || !isString(value.kind) || !isString(value.surfaceRef)) return false;
  if (!isRecord(value.source)
    || !isSha(value.source.artifactHash)
    || !isString(value.source.locator)
    || !isString(value.source.selector)) return false;
  if (value.renderedSource === undefined) return true;
  return isRecord(value.renderedSource)
    && isSha(value.renderedSource.artifactHash)
    && isString(value.renderedSource.locator)
    && isString(value.renderedSource.elementRef);
}

function isOptionalStringArray(value: unknown): boolean {
  return value === undefined || isStringArray(value);
}

function isDesignBinding(value: unknown): value is ProductDesignBindingV1 {
  if (!isRecord(value) || !isString(value.controlRef) || !isString(value.disposition)) return false;
  if (!["action", "external", "disabled", "informational", "value_input"].includes(value.disposition)) return false;
  if (value.actionRef !== undefined && !isString(value.actionRef)) return false;
  if (value.routeRef !== undefined && !isString(value.routeRef)) return false;
  if (!isOptionalStringArray(value.stateRefs)
    || !isOptionalStringArray(value.persistenceRefs)
    || !isOptionalStringArray(value.evidenceRefs)) return false;
  if (value.disposition !== "value_input") return true;
  return Array.isArray(value.fields) && value.fields.every((field) =>
    isRecord(field) && isString(field.actionRef) && isString(field.inputField));
}

function isStitchResponseBinding(value: unknown): value is StitchTargetResponseBindingV2 {
  if (!isRecord(value)) return false;
  for (const field of [
    "targetRef", "requestScreenKey", "expectedScreenTitle", "responseScreenId", "responseTitle", "stageId",
  ]) if (!isString(value[field])) return false;
  for (const field of [
    "htmlArtifactHash", "screenshotArtifactHash", "semanticDomHash", "semanticObservationHash",
  ]) if (!isSha(value[field])) return false;
  return isStringArray(value.contractElementRefs);
}

function hasAuthorityRefs(value: unknown, packetVersion: 1 | 2): value is Record<string, string> {
  if (!isRecord(value)) return false;
  const required = [
    "productSpec", "designGraph", "buildTopology", "storyPlan", "packet", "compilationReport",
    ...(packetVersion === 2 ? ["designSourceClosure"] : []),
  ];
  return required.every((field) => isSha(value[field])) && Object.values(value).every(isSha);
}

function hasRenderableDesignSources(value: unknown): boolean {
  if (!isRecord(value)
    || !isRecord(value.generationTargets)
    || !Array.isArray(value.generationTargets.targets)
    || !isRecord(value.renderedSemantics)
    || !Array.isArray(value.renderedSemantics.candidates)
    || !isRecord(value.responseBindings)
    || !Array.isArray(value.responseBindings.bindings)) return false;
  return value.responseBindings.bindings.every(isStitchResponseBinding);
}

export function isRenderableProductBuildAuthorityV1(
  record: Record<string, unknown>,
  expectedRunId: string,
): record is Record<string, unknown> & ProductBuildAuthorityV1 {
  if (record.runId !== expectedRunId || !isSha(record.packetHash) || !isSha(record.authorityHash)) return false;
  if (!isRecord(record.producer)
    || !isString(record.producer.pass)
    || !isString(record.producer.codeSha)
    || !CODE_SHA.test(record.producer.codeSha)
    || !isRecord(record.producer.toolVersions)) return false;

  if (!isRecord(record.packet)) return false;
  const packetVersion = record.packet.packetVersion;
  if (packetVersion !== 1 && packetVersion !== 2) return false;
  if (record.packet.schema !== `setfarm.product-build-packet.v${packetVersion}`
    || !isCompiler(record.packet.compiler)
    || !isStringArray(record.packet.validationIds)) return false;
  if (!hasAuthorityRefs(record.refs, packetVersion)) return false;

  if (!isRecord(record.productSpec)
    || !Array.isArray(record.productSpec.routes)
    || !Array.isArray(record.productSpec.surfaces)
    || !Array.isArray(record.productSpec.actions)) return false;
  if (!isRecord(record.designGraph)
    || !Array.isArray(record.designGraph.controls)
    || !record.designGraph.controls.every(isDesignControl)
    || !Array.isArray(record.designGraph.bindings)
    || !record.designGraph.bindings.every(isDesignBinding)) return false;
  if (!isRecord(record.storyPlan) || !Array.isArray(record.storyPlan.stories)) return false;
  if (!isRecord(record.buildTopology) || !isRecord(record.compilationReport)) return false;

  if (packetVersion === 1) {
    return record.designSourceClosure === undefined && record.designSources === undefined;
  }
  if (!isRecord(record.designSourceClosure)) return false;
  if (record.designSourceClosure.kind === "none") return record.designSources === undefined;
  if (record.designSourceClosure.kind !== "stitch") return false;
  return hasRenderableDesignSources(record.designSources);
}

function hasExactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isProductBuildRefusalV2(value: unknown): value is ProductBuildRefusalV2 {
  if (!isRecord(value) || !hasExactKeys(value, ["terminationRequestRef", "failureIdentity", "failureArtifact"])) return false;
  if (!isString(value.terminationRequestRef) || !value.terminationRequestRef.startsWith("setfarm://run-termination/")) return false;
  const identity = value.failureIdentity;
  const artifact = value.failureArtifact;
  if (!isRecord(identity) || !isRecord(artifact) || !isRecord(identity.exactFailure)) return false;
  if (identity.schema !== "setfarm.operational-failure-identity.v2"
    || identity.requestedBy !== "setfarm.product-compiler.design-refusal"
    || identity.evidenceSchema !== "setfarm.v3-design-candidate-authority-termination.v1"
    || !isSha(identity.operationalCauseHash)
    || !isRecord(identity.operationalCause)
    || identity.operationalCause.schema !== "setfarm.operational-failure-cause.v1"
    || identity.operationalCause.workflowStepId !== "design"
    || identity.operationalCause.boundary !== "product_compiler.design_candidate_authority") return false;
  const exact = identity.exactFailure;
  if (exact.schema !== "setfarm.operational-exact-failure-identity.v2"
    || exact.kind !== "stitch_target_candidate_selection"
    || exact.refKey !== "STITCH_TARGET_CANDIDATE_SELECTION_FAILURE"
    || exact.artifactType !== "setfarm.stitch-target-candidate-selection-failure.v1"
    || !isSha(exact.failureArtifactHash)
    || !isSha(exact.failureFingerprint)
    || !isSha(exact.candidateSelectionHash)) return false;
  if (artifact.refKey !== exact.refKey || artifact.artifactHash !== exact.failureArtifactHash || !isSha(artifact.artifactHash)) return false;
  if (!isRecord(artifact.envelope) || artifact.envelope.schema !== "setfarm.semantic-artifact-envelope.v1"
    || artifact.envelope.artifactType !== exact.artifactType || !isRecord(artifact.envelope.payload)) return false;
  return artifact.envelope.payload.fingerprint === exact.failureFingerprint
    && artifact.envelope.payload.candidateSelectionHash === exact.candidateSelectionHash;
}

export function isRenderableProductBuildAuthorityV2(
  record: Record<string, unknown>,
  expectedRunId: string,
): record is Record<string, unknown> & ProductBuildAuthorityV2 {
  if (!hasExactKeys(record, ["schema", "runId", "disposition", "packetAuthority", "refusal", "authorityHash"])
    || record.schema !== "setfarm.product-build-authority.v2"
    || record.runId !== expectedRunId
    || !isSha(record.authorityHash)) return false;
  if (record.disposition === "sealed_packet") {
    return record.refusal === null
      && isRecord(record.packetAuthority)
      && isRenderableProductBuildAuthorityV1(record.packetAuthority, expectedRunId);
  }
  return record.disposition === "refused_before_packet"
    && record.packetAuthority === null
    && isProductBuildRefusalV2(record.refusal);
}

function isRenderableLegacyPacketV3(
  value: Record<string, unknown>,
  expectedRunId: string,
): value is Record<string, unknown> & ProductBuildAuthorityV1 {
  if (!isRenderableProductBuildAuthorityV1(value, expectedRunId)) return false;
  const producer = value.producer;
  if (!Object.values(producer.toolVersions).every(isString)
    || (producer.model !== undefined && !isString(producer.model))
    || (producer.promptHash !== undefined && !isSha(producer.promptHash))) return false;
  if (value.productSpec.schema !== "setfarm.product-spec.v1"
    || value.designGraph.schema !== "setfarm.design-interaction-graph.v1"
    || !Array.isArray(value.designGraph.surfaces)
    || value.storyPlan.schema !== "setfarm.story-plan.v1"
    || value.buildTopology.schema !== "setfarm.build-topology.v1") return false;
  if (value.packet.packetVersion === 1) return true;
  if (value.designSourceClosure?.schema !== "setfarm.design-source-closure.v1") return false;
  if (value.designSourceClosure.kind === "none") return true;
  const sources = value.designSources;
  if (!sources) return false;
  return sources.generationTargets.schema === "setfarm.design-generation-targets.v1"
    && isRecord(sources.directResponseEvidence)
    && sources.directResponseEvidence.schema === "setfarm.stitch-direct-response-evidence.v2"
    && isRecord(sources.candidateSelection)
    && sources.candidateSelection.schema === "setfarm.stitch-target-candidate-selection.v1"
    && sources.renderedSemantics.schema === "setfarm.stitch-rendered-semantics.v1"
    && sources.responseBindings.schema === "setfarm.stitch-target-response-bindings.v2";
}

function isRenderableRefusalV3(value: unknown): value is ProductBuildRefusalV2 {
  return isProductBuildRefusalV2(value)
    && isString(value.failureIdentity.operationalCause.failureClass)
    && isString(value.failureIdentity.operationalCause.failureCode);
}


export function isRenderableProductBuildAuthorityV3(value: unknown, expectedRunId: string): value is ProductBuildAuthorityV3 {
  if (!isRecord(value) || !hasExactKeys(value, ["schema", "runId", "disposition", "packetAuthority", "refusal", "authorityHash"])
    || value.schema !== "setfarm.product-build-authority.v3" || value.runId !== expectedRunId || !isSha(value.authorityHash)) return false;
  if (value.disposition === "refused_before_packet") return value.packetAuthority === null && isRenderableRefusalV3(value.refusal);
  if (value.disposition !== "sealed_packet" || value.refusal !== null || !isRecord(value.packetAuthority)) return false;
  const packet = value.packetAuthority;
  if (packet.schema === "setfarm.product-build-authority.v1") return isRenderableLegacyPacketV3(packet, expectedRunId);
  if (!isNativePacketStructure(packet) || packet.runId !== expectedRunId) return false;
  const kind = packet.productSpec.delivery.designRequired ? "stitch" : "none";
  return packet.packet.designSourceKind === kind && packet.storyPlan.designSourceKind === kind
    && packet.designSourceClosure.kind === kind && packet.implementationSourceMap.designSourceKind === kind
    && (packet.designGraph !== null) === (kind === "stitch") && (packet.designSources !== undefined) === (kind === "stitch");
}
