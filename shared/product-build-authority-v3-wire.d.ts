/** Data declarations only. Runtime consumers validate before narrowing. */
export type NativeJsonValue = null | boolean | number | string | NativeJsonValue[] | { [key: string]: NativeJsonValue };
export type NativeJsonObject = { [key: string]: NativeJsonValue };
export interface NativeCompiler { version: string; codeSha: string }
export interface NativeProducer { pass: string; codeSha: string; toolVersions: Record<string, string>; model?: string; promptHash?: string }
export type NativeDesignKind = "none" | "stitch";
export type NativeInteractiveKind = "button" | "link" | "input" | "textarea" | "select";
export type NativeRenderedSelector =
  | { kind: "control"; controlSlotRef: string }
  | { kind: "surface"; surfaceRef: string }
  | { kind: "accessibility"; surfaceRef: string; role: string; name: string };
export type NativeComposition = { kind: "route_root" } | { kind: "contained"; hostSurfaceRef: string };
export type NativeControlHint = "primary_button" | "secondary_button" | "icon_button" | "context_menu" | "context_menu_destructive" | "form_submit" | "inline_edit" | "swipe_action" | "fab" | "search_input_persistent" | "canvas_region";
export interface NativePlacement { id: string; surfaceRef: string; controlHint: NativeControlHint }
export interface NativeAssertion { phase: "before" | "after" | "reload"; property: "visible_text" | "value" | "visibility" | "enabled" | "route"; operator: "equals" | "contains" | "matches" | "changed"; expected?: NativeJsonValue }
export type NativeNavigation = { kind: "stay" } | { kind: "back" } | { kind: "route"; routeRef: string } | { kind: "external"; url: string };
export type NativeInvocation = { schema: "setfarm.action-invocation-interface-intent.v1" } & (
  | { kind: "rendered_control" } | { kind: "route_entry"; routeRef: string }
  | { kind: "cli_command"; subcommandTokens: string[]; fieldBindings: NativeJsonObject[]; result: NativeJsonObject }
  | { kind: "http_request"; method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; routeRef: string; fieldBindings: NativeJsonObject[]; result: NativeJsonObject });
export interface NativeProductSurface { id: string; name: string; kind: "page" | "panel" | "dialog" | "overlay" | "canvas" | "terminal" | "api"; routeRef: string; required: boolean; composition: NativeComposition }
export interface NativeActionOutcome { stateRefs: string[]; persistenceRefs?: string[]; evidenceRefs: string[]; userVisible?: boolean }
export type NativeProductSelector = NativeRenderedSelector | { kind: "invocation_output"; coordinate: "result_value"; pointer: string; valueContract: NativeJsonObject };
export interface NativeProductAction {
  id: string; name: string; invocationInterface: NativeInvocation; controlPlacements: NativePlacement[]; affectedSurfaceRefs: string[];
  trigger: { kind: "user" | "system" | "timer" | "route"; sourceRef?: string };
  input: { fields: Array<{ name: string; valueType: "string" | "number" | "boolean" | "date" | "datetime" | "enum" | "object" | "array"; required: boolean; entityFieldRef?: string }> };
  preconditions: NativeJsonObject[]; evidenceScenario: NativeJsonObject; stateDeltas: NativeJsonObject[]; navigation: NativeNavigation;
  persistenceEffects: NativeJsonObject[]; success: NativeActionOutcome; failure: NativeActionOutcome; evidenceRefs: string[];
  observableEffects: Array<{ id: string; selector: NativeProductSelector; assertions: NativeAssertion[]; evidenceRef: string }>;
}
export interface NativeProductSpecV2 {
  schema: "setfarm.product-spec.v2";
  product: { id: string; name: string; class: "utility" | "operations" | "game" | "content" | "commerce" | "developer_tool" | "service" | "other"; goals: Array<{ id: string; statement: string }>; nonGoals: Array<{ id: string; statement: string }> };
  entities: NativeJsonObject[];
  states: NativeJsonObject[];
  persistencePolicies: NativeJsonObject[];
  routes: Array<{ id: string; path: string; rootSurfaceRef: string; surfaceRefs: string[]; entry: boolean }>;
  surfaces: NativeProductSurface[];
  actions: NativeProductAction[];
  evidencePredicates: NativeJsonObject[];
  assumptions: NativeJsonObject[];
  delivery: { platform: "web" | "mobile" | "desktop" | "api" | "cli" | "game"; techStack: "vite-react" | "nextjs" | "static-html" | "browser-game" | "node-express" | "python-web" | "node-cli" | "python-cli" | "react-native-expo" | "android-native" | "ios-native" | "desktop-electron"; uiLanguage: string; database: "none" | "postgres" | "sqlite" | "external"; designRequired: boolean; uiVisionSummary: string };
  requirements: NativeJsonObject[];
  traceability: NativeJsonObject & { schema: "setfarm.product-requirement-traceability.v2" };
}
export interface NativeBuildTopologyV1 {
  schema: "setfarm.build-topology.v1";
  stackPack: NativeJsonObject;
  deliveryProfile?: NativeJsonObject;
  repo: NativeJsonObject;
  owners: NativeJsonObject[];
  pathBindings: NativeJsonObject[];
  sharedGrants: NativeJsonObject[];
  entrypoints: NativeJsonObject[];
  commands: NativeJsonObject[];
  capabilities: NativeJsonObject[];
  policies: NativeJsonObject;
  runtimeDataContract?: NativeJsonObject;
  runtimeDataContractHash?: string;
  runtimeEvidenceContract?: NativeJsonObject;
  runtimeEvidenceContractHash?: string;
}
export interface NativeStoryV2 {
  id: string; order: number; componentHash: string; title: string; description: string; ownerRef: string;
  dependsOn: string[]; routeRefs: string[]; surfaceRefs: string[]; controlSlotRefs: string[]; controlRefs: string[];
  actionRefs: string[]; observableRefs: string[]; stateRefs: string[]; persistenceRefs: string[];
  evidenceRefs: string[]; ownedPathRefs: string[]; sharedGrantRefs: string[];
}
export interface NativeStoryPlanV2 {
  schema: "setfarm.story-plan.v2";
  productSpecHash: string; designSourceKind: NativeDesignKind; designGraphHash: string | null;
  buildTopologyHash: string; partitionHash: string; stories: NativeStoryV2[]; cardinality: Record<string, number>;
}
export interface NativeArtifactRef<T extends string> { artifactType: T; envelopeHash: string; payloadHash: string }
export type NativeDesignSourceClosureV2 =
  | { schema: "setfarm.design-source-closure.v2"; kind: "none"; reason: "product_delivery_design_not_required" }
  | {
    schema: "setfarm.design-source-closure.v2"; kind: "stitch";
    generationTargets: NativeArtifactRef<"setfarm.design-generation-targets.v2">;
    directResponseEvidence: NativeArtifactRef<"setfarm.stitch-direct-response-evidence.v2">;
    renderedSemantics: NativeArtifactRef<"setfarm.stitch-rendered-semantics.v2">;
    candidateSelection: NativeArtifactRef<"setfarm.stitch-target-candidate-selection.v2">;
    responseBindings: NativeArtifactRef<"setfarm.stitch-target-response-bindings.v3">;
    designGraph: NativeArtifactRef<"setfarm.design-interaction-graph.v2">;
    acceptedAttempt: { attemptRef: string; outputSealHash: string };
    artifactManifest: { artifactType: "setfarm.product-compilation-artifact-manifest.v1"; artifactHash: string };
    projectionReceipt: { artifactType: "setfarm.product-compilation-projection-receipt.v1"; artifactHash: string };
  };
export interface NativeElementBinding { elementRef: string; elementHash: string }
export interface NativeElementSource {
  targetRef: string; responseScreenId: string; sourceHash: string;
  htmlArtifactHash: string; screenshotArtifactHash: string; semanticDomHash: string; semanticObservationHash: string;
}
export interface NativeTargetSourceAuthority {
  targetRef: string; targetHash: string; responseScreenId: string; stageId: string;
  htmlSourceRefHash: string; screenshotSourceRefHash: string; htmlDownloadedArtifactHash: string;
  screenshotDownloadedArtifactHash: string; htmlArtifactHash: string; screenshotArtifactHash: string;
  renderedHtmlArtifactHash: string; renderedScreenshotArtifactHash: string; semanticDomHash: string;
  semanticObservationHash: string; roleReceiptSetHash: string; sourceHash: string;
}
export interface NativeSurfaceBinding extends NativeElementBinding {
  surfaceRef: string; productSurfaceHash: string; designSurfaceRef: string; routeRef: string;
  kind: "page" | "panel" | "dialog" | "overlay" | "canvas" | "terminal" | "api";
  required: boolean; composition: NativeComposition; source: NativeElementSource;
}
export interface NativePhysicalControl extends NativeElementBinding {
  id: string;
  identity: { schema: "setfarm.design-control-identity.v2"; controlSlotRef: string; actionRef: string; routeRef: string; surfaceRef: string; identityHash: string };
  controlPlacementHash: string; source: NativeElementSource;
  dataAction: string; dataControlSlot: string; tagName: string; nativeControlKind: NativeInteractiveKind | null;
  role: string | null; ariaLabel: string | null; href: string | null; interactiveRole: boolean;
  renderState: "rendered"; enabled: true; pointerOperable: true;
  actionInputBindings: Array<NativeElementBinding & { actionInputRef: string; fieldRef: string }>;
}
export interface NativeActionBinding {
  actionRef: string; productActionHash: string; triggerKind: "user" | "system" | "timer" | "route";
  navigation: NativeNavigation;
  controlSlotRefs: string[]; controlRefs: string[]; affectedSurfaceRefs: string[]; observableRefs: string[];
}
export interface NativeObservableBinding {
  observableRef: string; productObservableHash: string; actionRef: string; selector: NativeRenderedSelector;
  selectorHash: string; assertions: NativeAssertion[]; assertionsHash: string; evidenceRef: string;
  source: NativeElementSource; elementBindings: NativeElementBinding[];
  roleReceipt: null | { receiptHash: string; receipt: NativeJsonObject };
}
export interface NativeDesignInteractionGraphV2 {
  schema: "setfarm.design-interaction-graph.v2";
  productSpecHash: string; generationTargetsHash: string; renderedSemanticsHash: string;
  candidateSelectionHash: string; responseBindingsHash: string; rawArtifactHashes: string[];
  sourceAuthorities: NativeTargetSourceAuthority[]; surfaces: NativeSurfaceBinding[];
  actions: NativeActionBinding[]; controls: NativePhysicalControl[]; observables: NativeObservableBinding[];
  cardinality: Record<string, number>;
}
export interface NativeSurfaceSource { surfaceRef: string; sourceElementRef: string; sourceElementHash: string }
export interface NativeImplementationControl {
  controlSlotRef: string; actionRef: string; placement: NativePlacement; controlPlacementHash: string;
  affectedSurfaceRefs: string[]; physicalControlRef: string; sourceElementRef: string; sourceElementHash: string;
  generatedLocalId: string; generatedSelector: string; generatedKind: NativeInteractiveKind; tagName: string;
  nativeControlKind: NativeInteractiveKind | null; role: string | null; ariaLabel: string | null;
  href: string | null; interactiveRole: boolean;
  handlerBinding: { actionsPropName: "actions"; callbackKey: string; event: "click" | "change"; preventsDefault: boolean; inputFields: string[] };
}
export interface NativeImplementationActionInput {
  actionInputRef: string; actionRef: string; inputField: string; sourceElementRef: string; sourceElementHash: string;
  generatedControlId: string; generatedSelector: string; stateKey: string; valueEvent: "change"; actionHandlerIds: string[];
}
export interface NativeImplementationObservable {
  observableRef: string; actionRef: string; selector: NativeRenderedSelector; selectorHash: string;
  evidenceRef: string; sourceElementRef: string; sourceElementHash: string; generatedSelector: string; assertionsHash: string;
}
export interface NativeImplementationScreen {
  targetRef: string; responseScreenId: string; routeRef: string; rootSurface: NativeSurfaceSource;
  containedSurfaces: NativeSurfaceSource[]; pathRef: string; path: string; contentHash: string; sourceByteLength: number;
  componentName: string;
  componentApi: { schema: "setfarm.generated-screen-component-api.v1"; actionsPropName: "actions";
    actionBindings: Array<{ generatedLocalId: string; actionRef: string; inputFields: string[] }>;
    inputTransports: Array<{ actionInputRef: string; generatedControlId: string; stateKey: string }> };
  targetHash: string; responseBindingHash: string; storyId: string; ownerRef: string;
  controls: NativeImplementationControl[]; actionInputs: NativeImplementationActionInput[]; observables: NativeImplementationObservable[];
  rejectedControls: Array<{ contract: NativeJsonObject; inertnessEvidence: { schema: "setfarm.generated-control-inertness-evidence.v1";
    sourceValidation: "ast_exact"; hidden: true; ariaHidden: true; semanticBindingsAbsent: true; eventHandlersAbsent: true; nativeDisabledOrLinkNeutralized: true } }>;
  cardinality: { raw: Record<string, number>; accepted: Record<string, number>; rejected: Record<string, number> };
}
export type NativeImplementationSourceMapV1 = {
  schema: "setfarm.implementation-source-map.v1"; sourceMapVersion: 1;
  productSpecV2PayloadHash: string; buildTopologyV1PayloadHash: string; storyPlanV2PayloadHash: string; designSourceClosureV2PayloadHash: string;
} & (
  | { designSourceKind: "none"; designGraphV2PayloadHash: null; screenIndexV2PayloadHash: null; screenIndexSourceHash: null; converter: null; screens: [] }
  | { designSourceKind: "stitch"; designGraphV2PayloadHash: string; screenIndexV2PayloadHash: string; screenIndexSourceHash: string;
    converter: { schema: "setfarm.implementation-source-converter.v1"; converterId: "setfarm.stitch-to-jsx"; contractVersion: 1;
      componentApiSchema: "setfarm.generated-screen-component-api.v1"; sourceHash: string; sourceByteLength: number };
    screens: NativeImplementationScreen[] }
);
export interface NativeGenerationTarget {
  targetId: string; designSurfaceId: string; routeRef: string; surfaceRef: string; containedSurfaceRefs: string[];
  requestScreenKey: string; expectedScreenTitle: string;
  requiredControlPlacements: Array<{ controlSlotRef: string; actionRef: string; surfaceRef: string; controlHint: NativeControlHint; inputFields: string[] }>;
  affectingActionRefs: string[];
  requiredObservableSelectors: Array<{ observableRef: string; actionRef: string; selector: NativeRenderedSelector; assertions: NativeAssertion[] }>;
}
export interface NativeResponseBinding extends Omit<NativeTargetSourceAuthority, "sourceHash"> {
  requestScreenKey: string; expectedScreenTitle: string; responseTitle: string;
  surfaceBindings: Array<NativeElementBinding & { surfaceRef: string }>;
  controlSlotBindings: Array<NativeElementBinding & { controlSlotRef: string; actionRef: string; surfaceRef: string; actionInputRefs: string[] }>;
  actionInputBindings: Array<NativeElementBinding & { actionInputRef: string; actionRef: string; surfaceRef: string }>;
  observableBindings: Array<{ observableRef: string; actionRef: string; selectorKind: "control" | "surface" | "accessibility";
    selectorHash: string; elementRefs: string[]; elementHashes: string[]; roleReceiptHash: string | null }>;
}
export interface NativeDesignSources {
  generationTargets: { schema: "setfarm.design-generation-targets.v2"; productSpecHash: string; targets: NativeGenerationTarget[] };
  directResponseEvidence: { schema: "setfarm.stitch-direct-response-evidence.v2"; projectId: string; batches: NativeJsonObject[] };
  renderedSemantics: { schema: "setfarm.stitch-rendered-semantics.v2"; policy: string; generationTargetsHash: string; directResponseEvidenceHash: string;
    renderer: NativeJsonObject; profile: NativeJsonObject; resources: NativeJsonObject[]; candidates: NativeJsonObject[] };
  candidateSelection: { schema: "setfarm.stitch-target-candidate-selection.v2"; policy: string; generationTargetsHash: string; directResponseEvidenceHash: string;
    renderedSemanticsHash: string; candidates: NativeJsonObject[]; selections: NativeJsonObject[] };
  responseBindings: { schema: "setfarm.stitch-target-response-bindings.v3"; generationTargetsHash: string; directResponseEvidenceHash: string;
    candidateSelectionHash: string; renderedSemanticsHash: string; bindings: NativeResponseBinding[] };
}
export interface NativePacketV3 {
  schema: "setfarm.product-build-packet.v3"; packetVersion: 3; parentPacketHashes: string[]; designSourceKind: NativeDesignKind;
  productSpecV2Hash: string; designGraphV2Hash: string | null; buildTopologyV1Hash: string; storyPlanV2Hash: string;
  runtimeDataContractHash?: string; runtimeEvidenceContractHash?: string; designSourceClosureV2Hash: string;
  implementationSourceMapV1Hash: string; compiler: NativeCompiler; validationIds: string[];
}
export interface NativeCompilationReportV3 {
  schema: "setfarm.product-compilation-report.v3"; compiler: NativeCompiler; inputHashes: string[];
  diagnostics: NativeJsonObject[]; validationIds: string[]; status: "sealed"; packetHash: string;
  artifactHashes: { productSpecV2: string; designGraphV2: string | null; buildTopologyV1: string; storyPlanV2: string; designSourceClosureV2: string; implementationSourceMapV1: string };
}
export interface ProductBuildPacketAuthorityV3Wire {
  schema: "setfarm.product-build-packet-authority.v3"; runId: string; packetHash: string; producer: NativeProducer;
  productSpec: NativeProductSpecV2; designGraph: NativeDesignInteractionGraphV2 | null; buildTopology: NativeBuildTopologyV1;
  storyPlan: NativeStoryPlanV2; designSourceClosure: NativeDesignSourceClosureV2; implementationSourceMap: NativeImplementationSourceMapV1;
  designSources?: NativeDesignSources; packet: NativePacketV3; compilationReport: NativeCompilationReportV3;
  refs: { productSpec: string; designGraph: string | null; buildTopology: string; storyPlan: string; designSourceClosure: string; implementationSourceMap: string; packet: string; compilationReport: string };
  authorityHash: string;
}
export type ProductBuildAuthorityV3Wire<
  TLegacyPacket extends { schema: "setfarm.product-build-authority.v1"; runId: string }, TRefusal,
> = { schema: "setfarm.product-build-authority.v3"; runId: string; authorityHash: string } & (
  | { disposition: "sealed_packet"; packetAuthority: TLegacyPacket | ProductBuildPacketAuthorityV3Wire; refusal: null }
  | { disposition: "refused_before_packet"; packetAuthority: null; refusal: TRefusal }
);
