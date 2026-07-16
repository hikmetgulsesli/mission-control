export interface ProductDesignControlV1 {
  id: string;
  kind: string;
  surfaceRef: string;
  label?: string;
  source: { artifactHash: string; locator: string; selector: string; line?: number };
  renderedSource?: { artifactHash: string; locator: string; elementRef: string };
}

export interface ProductDesignBindingV1 {
  controlRef: string;
  disposition: "action" | "external" | "disabled" | "informational" | "value_input";
  actionRef?: string;
  routeRef?: string;
  stateRefs?: string[];
  persistenceRefs?: string[];
  evidenceRefs?: string[];
  fields?: Array<{ actionRef: string; inputField: string }>;
}

export interface StitchTargetResponseBindingV2 {
  targetRef: string;
  requestScreenKey: string;
  expectedScreenTitle: string;
  responseScreenId: string;
  responseTitle: string;
  stageId: string;
  htmlArtifactHash: string;
  screenshotArtifactHash: string;
  semanticDomHash: string;
  semanticObservationHash: string;
  contractElementRefs: string[];
}

export interface ProductBuildAuthorityV1 {
  schema: "setfarm.product-build-authority.v1";
  runId: string;
  packetHash: string;
  producer: { pass: string; codeSha: string; model?: string; promptHash?: string; toolVersions: Record<string, string> };
  productSpec: { schema: "setfarm.product-spec.v1"; routes: unknown[]; surfaces: unknown[]; actions: unknown[] };
  designGraph: {
    schema: "setfarm.design-interaction-graph.v1";
    surfaces: unknown[];
    controls: ProductDesignControlV1[];
    bindings: ProductDesignBindingV1[];
  };
  buildTopology: { schema: "setfarm.build-topology.v1" } & Record<string, unknown>;
  storyPlan: { schema: "setfarm.story-plan.v1"; stories: unknown[] };
  packet: {
    schema: "setfarm.product-build-packet.v1" | "setfarm.product-build-packet.v2";
    packetVersion: 1 | 2;
    compiler: { version: string; codeSha: string };
    validationIds: string[];
  } & Record<string, unknown>;
  compilationReport: Record<string, unknown>;
  refs: Record<string, string>;
  designSourceClosure?: { schema: "setfarm.design-source-closure.v1"; kind: "none" | "stitch" } & Record<string, unknown>;
  designSources?: {
    generationTargets: { schema: "setfarm.design-generation-targets.v1"; targets: unknown[] };
    directResponseEvidence: Record<string, unknown>;
    renderedSemantics: { schema: "setfarm.stitch-rendered-semantics.v1"; candidates: unknown[] };
    candidateSelection: Record<string, unknown>;
    responseBindings: {
      schema: "setfarm.stitch-target-response-bindings.v2";
      bindings: StitchTargetResponseBindingV2[];
    };
  };
  authorityHash: string;
}

export type ProductBuildAuthorityState =
  | { status: "loading" }
  | { status: "ok"; authority: ProductBuildAuthorityV1 }
  | { status: "unavailable"; code: string; reason: string; upstreamStatus?: number; upstreamCode?: string }
  | { status: "upstream_error"; code: string; reason: string; upstreamStatus?: number; upstreamCode?: string }
  | { status: "unsupported_schema"; code: string; schema: string | null };

export function shouldPollProductBuildAuthority(state: ProductBuildAuthorityState): boolean {
  return state.status !== "ok";
}

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

function isRenderableProductBuildAuthority(
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

export function parseProductBuildAuthorityResponse(
  statusCode: number,
  body: unknown,
  expectedRunId: string,
): Exclude<ProductBuildAuthorityState, { status: "loading" }> {
  const record = body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
  if (statusCode === 200) {
    if (record.schema !== "setfarm.product-build-authority.v1") {
      return {
        status: "unsupported_schema",
        code: "SETFARM_PRODUCT_BUILD_AUTHORITY_UNSUPPORTED_SCHEMA",
        schema: typeof record.schema === "string" ? record.schema : null,
      };
    }
    if (!isRenderableProductBuildAuthority(record, expectedRunId)) {
      return {
        status: "upstream_error",
        code: "SETFARM_PRODUCT_BUILD_AUTHORITY_UPSTREAM_ERROR",
        reason: "invalid_payload",
        upstreamStatus: statusCode,
      };
    }
    return { status: "ok", authority: body as ProductBuildAuthorityV1 };
  }
  const status = record.status;
  const code = typeof record.code === "string"
    ? record.code
    : "SETFARM_PRODUCT_BUILD_AUTHORITY_UPSTREAM_ERROR";
  const reason = typeof record.reason === "string" ? record.reason : "http_error";
  const upstreamStatus = typeof record.upstreamStatus === "number" ? record.upstreamStatus : statusCode;
  const upstreamCode = typeof record.upstreamCode === "string" ? record.upstreamCode : undefined;
  if (status === "unsupported_schema") {
    return {
      status: "unsupported_schema",
      code,
      schema: typeof record.schema === "string" ? record.schema : null,
    };
  }
  if (status === "unavailable") {
    return { status: "unavailable", code, reason, upstreamStatus, ...(upstreamCode ? { upstreamCode } : {}) };
  }
  return { status: "upstream_error", code, reason, upstreamStatus, ...(upstreamCode ? { upstreamCode } : {}) };
}

export function productBuildAuthorityReason(state: Exclude<ProductBuildAuthorityState, { status: "ok" }>): string {
  if (state.status === "loading") return "Loading sealed Product Build Packet authority.";
  if (state.status === "unsupported_schema") return `Unsupported Product Build authority schema: ${state.schema || "missing"}.`;
  const upstream = state.upstreamCode ? ` Upstream: ${state.upstreamCode}.` : "";
  return `${state.code}: ${state.reason}.${upstream}`;
}
