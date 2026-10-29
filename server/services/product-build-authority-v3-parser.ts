import { isNativePacketStructure, isProductBuildAuthorityV3EnvelopeStructure, nSourceLabels, nTargetFields } from "./product-build-authority-v3-structure.js";
import { hashCanonicalJson } from "./setfarm-canonical-json-v1.js";
import type { ProductBuildAuthorityV1, ProductBuildRefusalV2 } from "./setfarm-product-build-authority-core.js";
import type { ProductBuildPacketAuthorityV3Wire, ProductBuildAuthorityV3Wire, NativeElementSource } from "../../shared/product-build-authority-v3-wire.js";
export type { ProductBuildPacketAuthorityV3Wire, ProductBuildAuthorityV3Wire } from "../../shared/product-build-authority-v3-wire.js";
export type ProductBuildPacketAuthorityV3 = ProductBuildPacketAuthorityV3Wire;
export type ProductBuildAuthorityV3 = ProductBuildAuthorityV3Wire<ProductBuildAuthorityV1, ProductBuildRefusalV2>;
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function invalid(path: string, reason: string): never {
  throw new Error(`${path}:${reason}`);
}
function requireRelation(condition: boolean, path: string): void {
  if (!condition) invalid(path, "relationship_mismatch");
}
function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) invalid(path, "expected_object");
  return value;
}
function envelopeHash(producer: ProductBuildPacketAuthorityV3["producer"], payload: { schema: string }): string {
  return hashCanonicalJson({ schema: "setfarm.semantic-artifact-envelope.v1", artifactType: payload.schema, producer, payload });
}
function requireIdentityHash(value: { authorityHash: string }, path: string): void {
  const { authorityHash, ...identity } = value;
  requireRelation(hashCanonicalJson(identity) === authorityHash, `${path}.authorityHash`);
}
function sameValues(left: unknown, right: unknown): boolean {
  return hashCanonicalJson(left) === hashCanonicalJson(right);
}
function requireUnique(values: readonly string[], path: string): void {
  requireRelation(new Set(values).size === values.length, path);
}

function validateNativeRefs(value: ProductBuildPacketAuthorityV3): void {
  const { refs, packet, compilationReport: report, producer } = value;
  requireRelation(value.packetHash === refs.packet && report.packetHash === refs.packet
    && producer.codeSha === packet.compiler.codeSha && sameValues(packet.compiler, report.compiler), "native.packet");
  for (const [field, packetField, reportField] of [
    ["productSpec", "productSpecV2Hash", "productSpecV2"], ["designGraph", "designGraphV2Hash", "designGraphV2"],
    ["buildTopology", "buildTopologyV1Hash", "buildTopologyV1"], ["storyPlan", "storyPlanV2Hash", "storyPlanV2"],
    ["designSourceClosure", "designSourceClosureV2Hash", "designSourceClosureV2"], ["implementationSourceMap", "implementationSourceMapV1Hash", "implementationSourceMapV1"],
  ] as const) {
    requireRelation(refs[field] === packet[packetField] && refs[field] === report.artifactHashes[reportField], `native.refs.${field}`);
  }
  for (const field of ["productSpec", "designGraph", "buildTopology", "storyPlan", "designSourceClosure", "implementationSourceMap", "packet", "compilationReport"] as const) {
    const payload = value[field];
    requireRelation(refs[field] === (payload === null ? null : envelopeHash(producer, payload)), `native.refs.${field}`);
  }
  requireRelation(report.diagnostics.every((diagnostic) => diagnostic.severity !== "error"), "native.compilationReport.diagnostics");
  requireUnique(packet.parentPacketHashes, "native.packet.parentPacketHashes");
  requireUnique(packet.validationIds, "native.packet.validationIds");
  requireRelation(packet.validationIds.length > 0 && report.validationIds.length > 0 && report.inputHashes.length > 0, "native.compilationReport");
}

function validateSourceMapPayloads(value: ProductBuildPacketAuthorityV3): void {
  const { productSpec: spec, designGraph: graph, buildTopology: topology, storyPlan: stories, designSourceClosure: closure, implementationSourceMap: sourceMap, packet } = value;
  const kind = spec.delivery.designRequired ? "stitch" : "none";
  requireRelation(packet.designSourceKind === kind && stories.designSourceKind === kind && closure.kind === kind && sourceMap.designSourceKind === kind
    && (graph !== null) === (kind === "stitch") && (value.designSources !== undefined) === (kind === "stitch"), "native.designSourceKind");
  const specHash = hashCanonicalJson(spec), graphHash = graph === null ? null : hashCanonicalJson(graph), topologyHash = hashCanonicalJson(topology);
  requireRelation(sourceMap.productSpecV2PayloadHash === specHash && sourceMap.designGraphV2PayloadHash === graphHash
    && sourceMap.buildTopologyV1PayloadHash === topologyHash && sourceMap.storyPlanV2PayloadHash === hashCanonicalJson(stories)
    && sourceMap.designSourceClosureV2PayloadHash === hashCanonicalJson(closure)
    && stories.productSpecHash === specHash && stories.designGraphHash === graphHash && stories.buildTopologyHash === topologyHash
    && (graph === null || graph.productSpecHash === specHash), "native.implementationSourceMap.payloadHashes");
  const hasData = topology.runtimeDataContractHash !== undefined, hasEvidence = topology.runtimeEvidenceContractHash !== undefined;
  requireRelation(hasData === hasEvidence && packet.runtimeDataContractHash === topology.runtimeDataContractHash
    && packet.runtimeEvidenceContractHash === topology.runtimeEvidenceContractHash, "native.packet.runtimeContracts");
  requireRelation(stories.partitionHash === hashCanonicalJson(stories.stories), "native.storyPlan.partitionHash");
  requireUnique(stories.stories.map((story) => story.id), "native.storyPlan.stories");
  stories.stories.forEach((story, index) => {
    const { routeRefs, surfaceRefs, controlSlotRefs, controlRefs, actionRefs, observableRefs, stateRefs, persistenceRefs, evidenceRefs } = story;
    requireRelation(story.componentHash === hashCanonicalJson({ routeRefs, surfaceRefs, controlSlotRefs, controlRefs, actionRefs, observableRefs, stateRefs, persistenceRefs, evidenceRefs })
      && story.order === index + 1, "native.storyPlan.stories.componentHash");
  });
}

function validateNativeGraph(value: ProductBuildPacketAuthorityV3): void {
  const graph = value.designGraph;
  if (!graph) return;
  const sourceByTarget = new Map(graph.sourceAuthorities.map((source) => [source.targetRef, source]));
  const surfaces = new Map(graph.surfaces.map((surface) => [surface.surfaceRef, surface]));
  const actions = new Map(graph.actions.map((action) => [action.actionRef, action]));
  const controls = new Map(graph.controls.map((control) => [control.identity.controlSlotRef, control]));
  for (const [name, identities] of [
    ["sources", graph.sourceAuthorities.map((item) => item.targetRef)], ["surfaces", graph.surfaces.map((item) => item.surfaceRef)],
    ["actions", graph.actions.map((item) => item.actionRef)], ["controls", graph.controls.map((item) => item.id)],
    ["controlSlots", graph.controls.map((item) => item.identity.controlSlotRef)], ["observables", graph.observables.map((item) => item.observableRef)],
  ] as const) requireUnique(identities, `native.designGraph.${name}`);
  requireRelation(graph.sourceAuthorities.length > 0 && graph.surfaces.length > 0 && graph.actions.length > 0 && graph.observables.length > 0, "native.designGraph.collections");
  for (const authority of graph.sourceAuthorities) {
    const { sourceHash, ...identity } = authority;
    requireRelation(sourceHash === hashCanonicalJson(identity) && authority.htmlDownloadedArtifactHash === authority.htmlArtifactHash
      && authority.renderedHtmlArtifactHash === authority.htmlArtifactHash && authority.screenshotDownloadedArtifactHash === authority.screenshotArtifactHash
      && authority.renderedScreenshotArtifactHash === authority.screenshotArtifactHash, "native.designGraph.sourceAuthorities");
  }
  const validateSource = (source: NativeElementSource) => {
    const authority = sourceByTarget.get(source.targetRef);
    requireRelation(Boolean(authority) && Object.entries(source).every(([key, entry]) => authority && entry === Reflect.get(authority, key)), "native.designGraph.elementSource");
  };
  for (const surface of graph.surfaces) {
    validateSource(surface.source);
    const productSurface = value.productSpec.surfaces.find((item) => item.id === surface.surfaceRef);
    requireRelation(productSurface !== undefined && surface.productSurfaceHash === hashCanonicalJson(productSurface)
      && surface.routeRef === productSurface.routeRef && surface.kind === productSurface.kind && sameValues(surface.composition, productSurface.composition), "native.designGraph.productSurface");
  }
  for (const control of graph.controls) {
    validateSource(control.source);
    const { identityHash, ...identity } = control.identity;
    const surface = surfaces.get(control.identity.surfaceRef);
    const productAction = value.productSpec.actions.find((item) => item.id === identity.actionRef);
    const placement = productAction?.controlPlacements.find((item) => item.id === identity.controlSlotRef);
    requireRelation(placement !== undefined && placement.surfaceRef === identity.surfaceRef && control.controlPlacementHash === hashCanonicalJson(placement), "native.designGraph.controlPlacement");
    requireRelation(identityHash === hashCanonicalJson(identity) && control.id === `CTRL_${identityHash.slice(0, 16)}`
      && control.dataAction === identity.actionRef && control.dataControlSlot === identity.controlSlotRef
      && actions.has(identity.actionRef) && Boolean(surface) && surface?.routeRef === identity.routeRef
      && surface?.source.targetRef === control.source.targetRef && surface?.source.responseScreenId === control.source.responseScreenId
      && (control.nativeControlKind !== null || control.interactiveRole), "native.designGraph.controls");
    control.actionInputBindings.forEach((input) => requireRelation(input.actionInputRef === `${identity.actionRef}.${input.fieldRef}`, "native.designGraph.actionInputBindings"));
  }
  for (const action of graph.actions) {
    const actionControls = graph.controls.filter((control) => control.identity.actionRef === action.actionRef);
    const productAction = value.productSpec.actions.find((item) => item.id === action.actionRef);
    requireRelation(productAction !== undefined && action.productActionHash === hashCanonicalJson(productAction)
      && action.triggerKind === productAction.trigger.kind && sameValues(action.navigation, productAction.navigation), "native.designGraph.productAction");
    requireRelation(sameValues(action.controlRefs, actionControls.map((control) => control.id).sort())
      && sameValues(action.controlSlotRefs, actionControls.map((control) => control.identity.controlSlotRef).sort())
      && sameValues(action.observableRefs, graph.observables.filter((observable) => observable.actionRef === action.actionRef).map((observable) => observable.observableRef).sort())
      && action.affectedSurfaceRefs.every((ref) => surfaces.has(ref))
      && (action.triggerKind === "user" ? actionControls.length > 0 : actionControls.length === 0), "native.designGraph.actions");
  }
  for (const observable of graph.observables) {
    validateSource(observable.source);
    const productAction = value.productSpec.actions.find((item) => item.id === observable.actionRef);
    const productObservable = productAction?.observableEffects.find((item) => item.id === observable.observableRef);
    requireRelation(productObservable !== undefined && observable.productObservableHash === hashCanonicalJson(productObservable)
      && sameValues(observable.selector, productObservable.selector) && sameValues(observable.assertions, productObservable.assertions)
      && observable.evidenceRef === productObservable.evidenceRef, "native.designGraph.productObservable");
    requireRelation(actions.has(observable.actionRef) && observable.selectorHash === hashCanonicalJson(observable.selector)
      && observable.assertionsHash === hashCanonicalJson(observable.assertions) && observable.assertions.length > 0
      && observable.elementBindings.length === 1 && (observable.selector.kind === "accessibility") === (observable.roleReceipt !== null), "native.designGraph.observables");
    if (observable.roleReceipt) requireRelation(observable.roleReceipt.receiptHash === hashCanonicalJson(observable.roleReceipt.receipt), "native.designGraph.roleReceipt");
    const selected = observable.selector.kind === "control" ? controls.get(observable.selector.controlSlotRef) : surfaces.get(observable.selector.surfaceRef);
    requireRelation(Boolean(selected) && selected?.source.targetRef === observable.source.targetRef, "native.designGraph.observableSelector");
    if (observable.selector.kind !== "accessibility" && selected) requireRelation(sameValues(observable.elementBindings, [{ elementRef: selected.elementRef, elementHash: selected.elementHash }]), "native.designGraph.observableElement");
  }
  const expectedCardinality = { rawArtifacts: graph.rawArtifactHashes.length, sourceAuthorities: graph.sourceAuthorities.length, surfaces: graph.surfaces.length,
    actions: graph.actions.length, userActions: graph.actions.filter((action) => action.triggerKind === "user").length,
    controlSlots: graph.actions.reduce((sum, action) => sum + action.controlSlotRefs.length, 0), physicalControls: graph.controls.length,
    actionInputBindings: graph.controls.reduce((sum, control) => sum + control.actionInputBindings.length, 0), observables: graph.observables.length };
  requireRelation(sameValues(graph.cardinality, expectedCardinality)
    && sameValues(graph.rawArtifactHashes, [...new Set(graph.sourceAuthorities.flatMap((source) => [source.htmlArtifactHash, source.screenshotArtifactHash]))].sort()), "native.designGraph.cardinality");
}

function validateStitchSources(value: ProductBuildPacketAuthorityV3): void {
  const { designSourceClosure: closure, designGraph: graph, designSources: sources, implementationSourceMap: sourceMap } = value;
  if (closure.kind !== "stitch" || !graph || !sources || sourceMap.designSourceKind !== "stitch") return;
  requireRelation(closure.designGraph.envelopeHash === value.refs.designGraph && closure.designGraph.payloadHash === hashCanonicalJson(graph), "native.designSourceClosure.designGraph");
  for (const field of Object.keys(nSourceLabels) as Array<keyof typeof nSourceLabels>) {
    // Nested envelope producers are absent from this wire. Retain exact refs;
    // validate payload hashes and type labels without inventing a producer.
    requireRelation(closure[field].artifactType === sources[field].schema && closure[field].payloadHash === hashCanonicalJson(sources[field]), `native.designSources.${field}`);
  }
  const targetsHash = hashCanonicalJson(sources.generationTargets), directHash = hashCanonicalJson(sources.directResponseEvidence), renderedHash = hashCanonicalJson(sources.renderedSemantics);
  const selectionHash = hashCanonicalJson(sources.candidateSelection), bindingsHash = hashCanonicalJson(sources.responseBindings);
  requireRelation(sources.generationTargets.productSpecHash === hashCanonicalJson(value.productSpec)
    && sources.renderedSemantics.generationTargetsHash === targetsHash && sources.renderedSemantics.directResponseEvidenceHash === directHash
    && sources.candidateSelection.generationTargetsHash === targetsHash && sources.candidateSelection.directResponseEvidenceHash === directHash && sources.candidateSelection.renderedSemanticsHash === renderedHash
    && sources.responseBindings.generationTargetsHash === targetsHash && sources.responseBindings.directResponseEvidenceHash === directHash
    && sources.responseBindings.renderedSemanticsHash === renderedHash && sources.responseBindings.candidateSelectionHash === selectionHash
    && graph.generationTargetsHash === targetsHash && graph.renderedSemanticsHash === renderedHash && graph.candidateSelectionHash === selectionHash && graph.responseBindingsHash === bindingsHash, "native.designSources.payloadChain");
  requireUnique(sources.generationTargets.targets.map((target) => target.targetId), "native.designSources.targetIds");
  requireUnique(sources.responseBindings.bindings.map((response) => response.targetRef), "native.designSources.responseTargets");
  const targets = new Map(sources.generationTargets.targets.map((target) => [target.targetId, target]));
  const responses = new Map(sources.responseBindings.bindings.map((response) => [response.targetRef, response]));
  requireRelation(sourceMap.screens.length === targets.size && sourceMap.screens.length === responses.size && graph.sourceAuthorities.length === targets.size, "native.implementationSourceMap.screens");
  requireUnique(sourceMap.screens.map((screen) => screen.targetRef), "native.implementationSourceMap.targetRefs");
  requireUnique(sourceMap.screens.map((screen) => screen.path), "native.implementationSourceMap.paths");
  for (const authority of graph.sourceAuthorities) {
    const response = responses.get(authority.targetRef);
    requireRelation(Boolean(response) && (Object.keys(nTargetFields) as Array<keyof typeof nTargetFields>).every((key) => response?.[key] === authority[key]), "native.designGraph.selectedResponse");
  }
  for (const screen of sourceMap.screens) {
    const target = targets.get(screen.targetRef), response = responses.get(screen.targetRef);
    requireRelation(Boolean(target) && Boolean(response) && screen.responseScreenId === response?.responseScreenId
      && screen.routeRef === target?.routeRef && screen.rootSurface.surfaceRef === target?.surfaceRef
      && screen.targetHash === hashCanonicalJson(target) && screen.targetHash === response?.targetHash
      && screen.responseBindingHash === hashCanonicalJson(response), "native.implementationSourceMap.screenHashes");
    const componentBindings = new Map(screen.componentApi.actionBindings.map((binding) => [binding.generatedLocalId, binding]));
    for (const control of screen.controls) {
      const binding = componentBindings.get(control.generatedLocalId);
      requireRelation(control.controlSlotRef === control.placement.id && control.controlPlacementHash === hashCanonicalJson(control.placement)
        && control.handlerBinding.callbackKey === control.generatedLocalId && binding?.actionRef === control.actionRef
        && sameValues(binding.inputFields, control.handlerBinding.inputFields)
        && control.handlerBinding.event === (["button", "link"].includes(control.generatedKind) ? "click" : "change")
        && control.handlerBinding.preventsDefault === (control.tagName === "a"), "native.implementationSourceMap.control");
    }
    for (const input of screen.actionInputs) requireRelation(input.actionInputRef === `${input.actionRef}.${input.inputField}` && input.stateKey === input.actionInputRef, "native.implementationSourceMap.actionInput");
    for (const observable of screen.observables) requireRelation(observable.selectorHash === hashCanonicalJson(observable.selector), "native.implementationSourceMap.observable");
    for (const key of ["buttons", "links", "inputs", "textareas", "selects"]) requireRelation(screen.cardinality.raw[key] === screen.cardinality.accepted[key]! + screen.cardinality.rejected[key]!, "native.implementationSourceMap.cardinality");
  }
}

function parseNativePacket(value: unknown, runId: string): ProductBuildPacketAuthorityV3 {
  if (!isNativePacketStructure(value)) invalid("native", "invalid_structure");
  requireRelation(value.runId === runId, "native.runId");
  validateNativeRefs(value);
  validateSourceMapPayloads(value);
  validateNativeGraph(value);
  validateStitchSources(value);
  requireIdentityHash(value, "native");
  return value;
}

export function parseProductBuildAuthorityV3(
  value: unknown,
  expectedRunId: string | undefined,
  legacy: { packet(value: unknown, runId?: string): ProductBuildAuthorityV1; refusal(value: unknown): ProductBuildRefusalV2 },
): ProductBuildAuthorityV3 {
  const authority = objectAt(value, "authority");
  if (!isProductBuildAuthorityV3EnvelopeStructure(authority)) invalid("authority", "invalid_structure");
  const runId = authority.runId;
  if (typeof runId !== "string") invalid("authority.runId", "expected_string");
  if (expectedRunId !== undefined && runId !== expectedRunId) invalid("authority.runId", "run_identity_mismatch");
  if (authority.disposition === "sealed_packet") {
    if (authority.refusal !== null) invalid("authority.refusal", "sealed_refusal_must_be_null");
    const packet = objectAt(authority.packetAuthority, "authority.packetAuthority");
    if (packet.schema === "setfarm.product-build-authority.v1") legacy.packet(packet, runId);
    else parseNativePacket(packet, runId);
  } else {
    if (authority.packetAuthority !== null) invalid("authority.packetAuthority", "refused_packet_must_be_null");
    legacy.refusal(authority.refusal);
  }
  const { authorityHash, ...identity } = authority;
  requireRelation(hashCanonicalJson(identity) === authorityHash, "authority.authorityHash");
  // Every outer branch and every native rendered substructure has been checked;
  // legacy/refusal branches are validated by the unchanged same-side callbacks.
  return value as ProductBuildAuthorityV3;
}
