import type { ProductBuildPacketAuthorityV3Wire } from "../../shared/product-build-authority-v3-wire.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// These checks guard presentation structure. The server additionally verifies hashes and relationships.
type NativeCheck = (value: unknown) => boolean;
const nString: NativeCheck = (value) => typeof value === "string" && value.length > 0;
const nSha: NativeCheck = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const nCode: NativeCheck = (value) => typeof value === "string" && /^[a-f0-9]{7,64}$/.test(value);
const nBool: NativeCheck = (value) => typeof value === "boolean";
const nCount: NativeCheck = (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const nLiteral = (...values: unknown[]): NativeCheck => (value) => values.includes(value);
const nNullable = (check: NativeCheck): NativeCheck => (value) => value === null || check(value);
const nArray = (check: NativeCheck): NativeCheck => (value) => Array.isArray(value) && value.every(check);
const nStrings = nArray(nString);
const nShas = nArray(nSha);
function nObject(fields: Record<string, NativeCheck>, optional: Record<string, NativeCheck> = {}): NativeCheck {
  return (value) => isRecord(value)
    && Object.entries(fields).every(([key, check]) => Object.hasOwn(value, key) && check(value[key]))
    && Object.keys(value).every((key) => Object.hasOwn(fields, key) || (Object.hasOwn(optional, key) && optional[key]!(value[key])));
}
const nJson: NativeCheck = (value) => value === null || typeof value === "string" || typeof value === "boolean"
  || (typeof value === "number" && Number.isFinite(value))
  || (Array.isArray(value) ? value.every(nJson) : isRecord(value) && Object.values(value).every(nJson));
const nJsonObject: NativeCheck = (value) => isRecord(value) && nJson(value);
const nObjects = nArray(nJsonObject);
const nCounts: NativeCheck = (value) => isRecord(value) && Object.values(value).every(nCount);
const nCompiler = nObject({ version: nString, codeSha: nCode });
const nProducer = nObject({ pass: nString, codeSha: nCode, toolVersions: (value) => isRecord(value) && Object.values(value).every(nString) }, { model: nString, promptHash: nSha });
const nKind = nLiteral("none", "stitch");
const nInteractive = nLiteral("button", "link", "input", "textarea", "select");
const nElement = nObject({ elementRef: nString, elementHash: nSha });
const nComposition: NativeCheck = (value) => nObject({ kind: nLiteral("route_root") })(value)
  || nObject({ kind: nLiteral("contained"), hostSurfaceRef: nString })(value);
const nSelector: NativeCheck = (value) => nObject({ kind: nLiteral("control"), controlSlotRef: nString })(value)
  || nObject({ kind: nLiteral("surface"), surfaceRef: nString })(value)
  || nObject({ kind: nLiteral("accessibility"), surfaceRef: nString, role: nString, name: nString })(value);
const nPlacement = nObject({ id: nString, surfaceRef: nString, controlHint: nLiteral("primary_button", "secondary_button", "icon_button", "context_menu", "context_menu_destructive", "form_submit", "inline_edit", "swipe_action", "fab", "search_input_persistent", "canvas_region") });
const nSource = nObject({ targetRef: nString, responseScreenId: nString, sourceHash: nSha, htmlArtifactHash: nSha, screenshotArtifactHash: nSha, semanticDomHash: nSha, semanticObservationHash: nSha });
export const nTargetFields = { targetRef: nString, targetHash: nSha, responseScreenId: nString, stageId: nString,
  htmlSourceRefHash: nSha, screenshotSourceRefHash: nSha, htmlDownloadedArtifactHash: nSha, screenshotDownloadedArtifactHash: nSha,
  htmlArtifactHash: nSha, screenshotArtifactHash: nSha, renderedHtmlArtifactHash: nSha, renderedScreenshotArtifactHash: nSha,
  semanticDomHash: nSha, semanticObservationHash: nSha, roleReceiptSetHash: nSha };
const nTarget = nObject({ ...nTargetFields, sourceHash: nSha });
const nSurface = nObject({ surfaceRef: nString, productSurfaceHash: nSha, designSurfaceRef: nString, routeRef: nString,
  kind: nLiteral("page", "panel", "dialog", "overlay", "canvas", "terminal", "api"), required: nBool, composition: nComposition,
  source: nSource, elementRef: nString, elementHash: nSha });
const nControlIdentity = nObject({ schema: nLiteral("setfarm.design-control-identity.v2"), controlSlotRef: nString, actionRef: nString, routeRef: nString, surfaceRef: nString, identityHash: nSha });
const nControl = nObject({ id: nString, identity: nControlIdentity, controlPlacementHash: nSha, source: nSource, elementRef: nString, elementHash: nSha,
  dataAction: nString, dataControlSlot: nString, tagName: nString, nativeControlKind: nNullable(nInteractive), role: nNullable(nString), ariaLabel: nNullable(nString), href: nNullable(nString),
  interactiveRole: nBool, renderState: nLiteral("rendered"), enabled: nLiteral(true), pointerOperable: nLiteral(true),
  actionInputBindings: nArray(nObject({ actionInputRef: nString, fieldRef: nString, elementRef: nString, elementHash: nSha })) });
const nNavigation: NativeCheck = (value) => nObject({ kind: nLiteral("stay", "back") })(value)
  || nObject({ kind: nLiteral("route"), routeRef: nString })(value) || nObject({ kind: nLiteral("external"), url: nString })(value);
const nAction = nObject({ actionRef: nString, productActionHash: nSha, triggerKind: nLiteral("user", "system", "timer", "route"), navigation: nNavigation,
  controlSlotRefs: nStrings, controlRefs: nStrings, affectedSurfaceRefs: nStrings, observableRefs: nStrings });
const nAssertion: NativeCheck = (value) => nObject({ phase: nLiteral("before", "after", "reload"), property: nLiteral("visible_text", "value", "visibility", "enabled", "route"), operator: nLiteral("equals", "contains", "matches", "changed") }, { expected: nJson })(value)
  && isRecord(value) && (value.operator === "changed" ? value.expected === undefined && value.phase !== "before" : Object.hasOwn(value, "expected"));
const nObservable = nObject({ observableRef: nString, productObservableHash: nSha, actionRef: nString, selector: nSelector, selectorHash: nSha,
  assertions: nArray(nAssertion), assertionsHash: nSha, evidenceRef: nString, source: nSource, elementBindings: nArray(nElement),
  roleReceipt: nNullable(nObject({ receiptHash: nSha, receipt: nJsonObject })) });
const nGraph = nObject({ schema: nLiteral("setfarm.design-interaction-graph.v2"), productSpecHash: nSha, generationTargetsHash: nSha, renderedSemanticsHash: nSha,
  candidateSelectionHash: nSha, responseBindingsHash: nSha, rawArtifactHashes: nShas, sourceAuthorities: nArray(nTarget), surfaces: nArray(nSurface),
  actions: nArray(nAction), controls: nArray(nControl), observables: nArray(nObservable), cardinality: nCounts });
const nSurfaceSource = nObject({ surfaceRef: nString, sourceElementRef: nString, sourceElementHash: nSha });
const nHandler = nObject({ actionsPropName: nLiteral("actions"), callbackKey: nString, event: nLiteral("click", "change"), preventsDefault: nBool, inputFields: nStrings });
const nImplementationControl = nObject({ controlSlotRef: nString, actionRef: nString, placement: nPlacement, controlPlacementHash: nSha, affectedSurfaceRefs: nStrings,
  physicalControlRef: nString, sourceElementRef: nString, sourceElementHash: nSha, generatedLocalId: nString, generatedSelector: nString, generatedKind: nInteractive,
  tagName: nString, nativeControlKind: nNullable(nInteractive), role: nNullable(nString), ariaLabel: nNullable(nString), href: nNullable(nString), interactiveRole: nBool, handlerBinding: nHandler });
const nImplementationInput = nObject({ actionInputRef: nString, actionRef: nString, inputField: nString, sourceElementRef: nString, sourceElementHash: nSha,
  generatedControlId: nString, generatedSelector: nString, stateKey: nString, valueEvent: nLiteral("change"), actionHandlerIds: nStrings });
const nImplementationObservable = nObject({ observableRef: nString, actionRef: nString, selector: nSelector, selectorHash: nSha, evidenceRef: nString,
  sourceElementRef: nString, sourceElementHash: nSha, generatedSelector: nString, assertionsHash: nSha });
const nComponentApi = nObject({ schema: nLiteral("setfarm.generated-screen-component-api.v1"), actionsPropName: nLiteral("actions"),
  actionBindings: nArray(nObject({ generatedLocalId: nString, actionRef: nString, inputFields: nStrings })),
  inputTransports: nArray(nObject({ actionInputRef: nString, generatedControlId: nString, stateKey: nString })) });
const nRejected = nObject({ contract: nJsonObject, inertnessEvidence: nObject({ schema: nLiteral("setfarm.generated-control-inertness-evidence.v1"), sourceValidation: nLiteral("ast_exact"),
  hidden: nLiteral(true), ariaHidden: nLiteral(true), semanticBindingsAbsent: nLiteral(true), eventHandlersAbsent: nLiteral(true), nativeDisabledOrLinkNeutralized: nLiteral(true) }) });
const nInteractiveCounts = nObject({ buttons: nCount, links: nCount, inputs: nCount, textareas: nCount, selects: nCount });
const nScreen = nObject({ targetRef: nString, responseScreenId: nString, routeRef: nString, rootSurface: nSurfaceSource, containedSurfaces: nArray(nSurfaceSource),
  pathRef: nString, path: nString, contentHash: nSha, sourceByteLength: nCount, componentName: nString, componentApi: nComponentApi, targetHash: nSha,
  responseBindingHash: nSha, storyId: nString, ownerRef: nString, controls: nArray(nImplementationControl), actionInputs: nArray(nImplementationInput), observables: nArray(nImplementationObservable),
  rejectedControls: nArray(nRejected), cardinality: nObject({ raw: nInteractiveCounts, accepted: nInteractiveCounts, rejected: nInteractiveCounts }) });
const nSourceMapCommon = { schema: nLiteral("setfarm.implementation-source-map.v1"), sourceMapVersion: nLiteral(1), productSpecV2PayloadHash: nSha,
  buildTopologyV1PayloadHash: nSha, storyPlanV2PayloadHash: nSha, designSourceClosureV2PayloadHash: nSha };
const nSourceMap: NativeCheck = (value) => nObject({ ...nSourceMapCommon, designSourceKind: nLiteral("none"), designGraphV2PayloadHash: nLiteral(null), screenIndexV2PayloadHash: nLiteral(null),
  screenIndexSourceHash: nLiteral(null), converter: nLiteral(null), screens: (screens) => Array.isArray(screens) && screens.length === 0 })(value)
  || nObject({ ...nSourceMapCommon, designSourceKind: nLiteral("stitch"), designGraphV2PayloadHash: nSha, screenIndexV2PayloadHash: nSha, screenIndexSourceHash: nSha,
    converter: nObject({ schema: nLiteral("setfarm.implementation-source-converter.v1"), converterId: nLiteral("setfarm.stitch-to-jsx"), contractVersion: nLiteral(1), componentApiSchema: nLiteral("setfarm.generated-screen-component-api.v1"), sourceHash: nSha, sourceByteLength: nCount }), screens: (screens) => Array.isArray(screens) && screens.length > 0 && screens.every(nScreen) })(value);
export const nSourceLabels = {
  generationTargets: "setfarm.design-generation-targets.v2", directResponseEvidence: "setfarm.stitch-direct-response-evidence.v2",
  renderedSemantics: "setfarm.stitch-rendered-semantics.v2", candidateSelection: "setfarm.stitch-target-candidate-selection.v2", responseBindings: "setfarm.stitch-target-response-bindings.v3",
} as const;
const nArtifactRef = (label: string) => nObject({ artifactType: nLiteral(label), envelopeHash: nSha, payloadHash: nSha });
const nClosure: NativeCheck = (value) => nObject({ schema: nLiteral("setfarm.design-source-closure.v2"), kind: nLiteral("none"), reason: nLiteral("product_delivery_design_not_required") })(value)
  || nObject({ schema: nLiteral("setfarm.design-source-closure.v2"), kind: nLiteral("stitch"),
    ...Object.fromEntries(Object.entries(nSourceLabels).map(([key, label]) => [key, nArtifactRef(label)])),
    designGraph: nArtifactRef("setfarm.design-interaction-graph.v2"), acceptedAttempt: nObject({ attemptRef: nString, outputSealHash: nSha }),
    artifactManifest: nObject({ artifactType: nLiteral("setfarm.product-compilation-artifact-manifest.v1"), artifactHash: nSha }),
    projectionReceipt: nObject({ artifactType: nLiteral("setfarm.product-compilation-projection-receipt.v1"), artifactHash: nSha }) })(value);
const nControlHint = nLiteral("primary_button", "secondary_button", "icon_button", "context_menu", "context_menu_destructive", "form_submit", "inline_edit", "swipe_action", "fab", "search_input_persistent", "canvas_region");
const nGenerationTarget = nObject({ targetId: nString, designSurfaceId: nString, routeRef: nString, surfaceRef: nString, containedSurfaceRefs: nStrings, requestScreenKey: nString, expectedScreenTitle: nString,
  requiredControlPlacements: nArray(nObject({ controlSlotRef: nString, actionRef: nString, surfaceRef: nString, controlHint: nControlHint, inputFields: nStrings })), affectingActionRefs: nStrings,
  requiredObservableSelectors: nArray(nObject({ observableRef: nString, actionRef: nString, selector: nSelector, assertions: nArray(nAssertion) })) });
const nResponseBinding = nObject({ ...nTargetFields, requestScreenKey: nString, expectedScreenTitle: nString, responseTitle: nString,
  surfaceBindings: nArray(nObject({ surfaceRef: nString, elementRef: nString, elementHash: nSha })),
  controlSlotBindings: nArray(nObject({ controlSlotRef: nString, actionRef: nString, surfaceRef: nString, actionInputRefs: nStrings, elementRef: nString, elementHash: nSha })),
  actionInputBindings: nArray(nObject({ actionInputRef: nString, actionRef: nString, surfaceRef: nString, elementRef: nString, elementHash: nSha })),
  observableBindings: nArray(nObject({ observableRef: nString, actionRef: nString, selectorKind: nLiteral("control", "surface", "accessibility"), selectorHash: nSha, elementRefs: nStrings, elementHashes: nShas, roleReceiptHash: nNullable(nSha) })) });
const nSources = nObject({
  generationTargets: nObject({ schema: nLiteral(nSourceLabels.generationTargets), productSpecHash: nSha, targets: nArray(nGenerationTarget) }),
  directResponseEvidence: nObject({ schema: nLiteral(nSourceLabels.directResponseEvidence), projectId: nString, batches: nObjects }),
  renderedSemantics: nObject({ schema: nLiteral(nSourceLabels.renderedSemantics), policy: nString, generationTargetsHash: nSha, directResponseEvidenceHash: nSha, renderer: nJsonObject, profile: nJsonObject, resources: nObjects, candidates: nObjects }),
  candidateSelection: nObject({ schema: nLiteral(nSourceLabels.candidateSelection), policy: nString, generationTargetsHash: nSha, directResponseEvidenceHash: nSha, renderedSemanticsHash: nSha, candidates: nObjects, selections: nObjects }),
  responseBindings: nObject({ schema: nLiteral(nSourceLabels.responseBindings), generationTargetsHash: nSha, directResponseEvidenceHash: nSha, candidateSelectionHash: nSha, renderedSemanticsHash: nSha, bindings: nArray(nResponseBinding) }),
});
const nOutcome = nObject({ stateRefs: nStrings, persistenceRefs: nStrings, evidenceRefs: nStrings, userVisible: nBool });
const nProductSurface = nObject({ id: nString, name: nString, kind: nLiteral("page", "panel", "dialog", "overlay", "canvas", "terminal", "api"), routeRef: nString, required: nBool, composition: nComposition });
const nInvocation: NativeCheck = (value) => nObject({ schema: nLiteral("setfarm.action-invocation-interface-intent.v1"), kind: nLiteral("rendered_control") })(value)
  || nObject({ schema: nLiteral("setfarm.action-invocation-interface-intent.v1"), kind: nLiteral("route_entry"), routeRef: nString })(value)
  || nObject({ schema: nLiteral("setfarm.action-invocation-interface-intent.v1"), kind: nLiteral("cli_command"), subcommandTokens: nStrings, fieldBindings: nObjects, result: nJsonObject })(value)
  || nObject({ schema: nLiteral("setfarm.action-invocation-interface-intent.v1"), kind: nLiteral("http_request"), method: nLiteral("GET", "POST", "PUT", "PATCH", "DELETE"), routeRef: nString, fieldBindings: nObjects, result: nJsonObject })(value);
const nProductSelector: NativeCheck = (value) => nSelector(value) || nObject({ kind: nLiteral("invocation_output"), coordinate: nLiteral("result_value"), pointer: (entry) => typeof entry === "string", valueContract: nJsonObject })(value);
const nProductAction = nObject({ id: nString, name: nString, invocationInterface: nInvocation, controlPlacements: nArray(nPlacement), affectedSurfaceRefs: nStrings,
  trigger: nObject({ kind: nLiteral("user", "system", "timer", "route") }, { sourceRef: nString }),
  input: nObject({ fields: nArray(nObject({ name: nString, valueType: nLiteral("string", "number", "boolean", "date", "datetime", "enum", "object", "array"), required: nBool }, { entityFieldRef: nString })) }),
  preconditions: nObjects, evidenceScenario: nJsonObject, stateDeltas: nObjects, navigation: nNavigation, persistenceEffects: nObjects, success: nOutcome, failure: nOutcome, evidenceRefs: nStrings,
  observableEffects: nArray(nObject({ id: nString, selector: nProductSelector, assertions: nArray(nAssertion), evidenceRef: nString })) });
const nProduct = nObject({ id: nString, name: nString, class: nLiteral("utility", "operations", "game", "content", "commerce", "developer_tool", "service", "other"), goals: nArray(nObject({ id: nString, statement: nString })), nonGoals: nArray(nObject({ id: nString, statement: nString })) });
const nDelivery = nObject({ platform: nLiteral("web", "mobile", "desktop", "api", "cli", "game"), techStack: nLiteral("vite-react", "nextjs", "static-html", "browser-game", "node-express", "python-web", "node-cli", "python-cli", "react-native-expo", "android-native", "ios-native", "desktop-electron"), uiLanguage: nString, database: nLiteral("none", "postgres", "sqlite", "external"), designRequired: nBool, uiVisionSummary: nString });
const nSpec = nObject({ schema: nLiteral("setfarm.product-spec.v2"), product: nProduct, entities: nObjects, states: nObjects, persistencePolicies: nObjects,
  routes: nArray(nObject({ id: nString, path: nString, rootSurfaceRef: nString, surfaceRefs: nStrings, entry: nBool })), surfaces: nArray(nProductSurface), actions: nArray(nProductAction), evidencePredicates: nObjects,
  assumptions: nObjects, delivery: nDelivery, requirements: nObjects,
  traceability: (value) => nJsonObject(value) && isRecord(value) && value.schema === "setfarm.product-requirement-traceability.v2" });
const nTopology = nObject({ schema: nLiteral("setfarm.build-topology.v1"), stackPack: nJsonObject, repo: nJsonObject, owners: nObjects, pathBindings: nObjects,
  sharedGrants: nObjects, entrypoints: nObjects, commands: nObjects, capabilities: nObjects, policies: nJsonObject },
  { deliveryProfile: nJsonObject, runtimeDataContract: nJsonObject, runtimeDataContractHash: nSha, runtimeEvidenceContract: nJsonObject, runtimeEvidenceContractHash: nSha });
const nStory = nObject({ id: nString, order: nCount, componentHash: nSha, title: nString, description: nString, ownerRef: nString,
  dependsOn: nStrings, routeRefs: nStrings, surfaceRefs: nStrings, controlSlotRefs: nStrings, controlRefs: nStrings, actionRefs: nStrings, observableRefs: nStrings,
  stateRefs: nStrings, persistenceRefs: nStrings, evidenceRefs: nStrings, ownedPathRefs: nStrings, sharedGrantRefs: nStrings });
const nStoryPlan = nObject({ schema: nLiteral("setfarm.story-plan.v2"), productSpecHash: nSha, designSourceKind: nKind, designGraphHash: nNullable(nSha), buildTopologyHash: nSha,
  partitionHash: nSha, stories: nArray(nStory), cardinality: nCounts });
const nPacket = nObject({ schema: nLiteral("setfarm.product-build-packet.v3"), packetVersion: nLiteral(3), parentPacketHashes: nShas, designSourceKind: nKind,
  productSpecV2Hash: nSha, designGraphV2Hash: nNullable(nSha), buildTopologyV1Hash: nSha, storyPlanV2Hash: nSha, designSourceClosureV2Hash: nSha, implementationSourceMapV1Hash: nSha,
  compiler: nCompiler, validationIds: nStrings }, { runtimeDataContractHash: nSha, runtimeEvidenceContractHash: nSha });
const nReport = nObject({ schema: nLiteral("setfarm.product-compilation-report.v3"), compiler: nCompiler, inputHashes: nShas, diagnostics: nObjects, validationIds: nStrings,
  status: nLiteral("sealed"), packetHash: nSha, artifactHashes: nObject({ productSpecV2: nSha, designGraphV2: nNullable(nSha), buildTopologyV1: nSha, storyPlanV2: nSha, designSourceClosureV2: nSha, implementationSourceMapV1: nSha }) });
const nRefs = nObject({ productSpec: nSha, designGraph: nNullable(nSha), buildTopology: nSha, storyPlan: nSha, designSourceClosure: nSha, implementationSourceMap: nSha, packet: nSha, compilationReport: nSha });
export function isNativePacketStructure(value: unknown): value is ProductBuildPacketAuthorityV3Wire {
  return nObject({ schema: nLiteral("setfarm.product-build-packet-authority.v3"), runId: nString, packetHash: nSha, producer: nProducer,
    productSpec: nSpec, designGraph: nNullable(nGraph), buildTopology: nTopology, storyPlan: nStoryPlan, designSourceClosure: nClosure, implementationSourceMap: nSourceMap,
    packet: nPacket, compilationReport: nReport, refs: nRefs, authorityHash: nSha }, { designSources: nSources })(value);
}

export function isProductBuildAuthorityV3EnvelopeStructure(value: unknown): boolean {
  return nObject({ schema: nLiteral("setfarm.product-build-authority.v3"), runId: nString, disposition: nLiteral("sealed_packet", "refused_before_packet"),
    packetAuthority: nNullable(nJsonObject), refusal: nNullable(nJsonObject), authorityHash: nSha })(value);
}
