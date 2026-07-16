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

const SHA256 = /^[a-f0-9]{64}$/;

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
    const packet = record.packet as Record<string, unknown> | undefined;
    const designGraph = record.designGraph as Record<string, unknown> | undefined;
    const storyPlan = record.storyPlan as Record<string, unknown> | undefined;
    if (
      record.runId !== expectedRunId
      || typeof record.packetHash !== "string"
      || !SHA256.test(record.packetHash)
      || typeof record.authorityHash !== "string"
      || !SHA256.test(record.authorityHash)
      || !packet
      || !["setfarm.product-build-packet.v1", "setfarm.product-build-packet.v2"].includes(String(packet.schema))
      || !designGraph
      || !Array.isArray(designGraph.controls)
      || !Array.isArray(designGraph.bindings)
      || !storyPlan
      || !Array.isArray(storyPlan.stories)
    ) {
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
