import { isRenderableProductBuildAuthorityV1, isRenderableProductBuildAuthorityV2, isRenderableProductBuildAuthorityV3 } from "./product-build-authority-v3.js";
import type { ProductBuildAuthorityV3 } from "./product-build-authority-v3.js";
export type { ProductBuildAuthorityV3, ProductBuildPacketAuthorityV3 } from "./product-build-authority-v3.js";

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

export interface ProductBuildRefusalV2 {
  terminationRequestRef: string;
  failureIdentity: {
    schema: "setfarm.operational-failure-identity.v2";
    requestedBy: string;
    evidenceSchema: string;
    operationalCause: {
      schema: "setfarm.operational-failure-cause.v1";
      workflowStepId: string;
      boundary: string;
      failureClass: string;
      failureCode: string;
    };
    operationalCauseHash: string;
    exactFailure: {
      schema: "setfarm.operational-exact-failure-identity.v2";
      kind: "stitch_target_candidate_selection";
      refKey: string;
      artifactType: string;
      failureArtifactHash: string;
      failureFingerprint: string;
      candidateSelectionHash: string;
    };
  };
  failureArtifact: {
    refKey: string;
    artifactHash: string;
    envelope: {
      schema: "setfarm.semantic-artifact-envelope.v1";
      artifactType: string;
      payload: Record<string, unknown> & { fingerprint: string; candidateSelectionHash: string };
    } & Record<string, unknown>;
  };
}

export type ProductBuildAuthorityV2 = {
  schema: "setfarm.product-build-authority.v2";
  runId: string;
  authorityHash: string;
} & (
  | { disposition: "sealed_packet"; packetAuthority: ProductBuildAuthorityV1; refusal: null }
  | { disposition: "refused_before_packet"; packetAuthority: null; refusal: ProductBuildRefusalV2 }
);

export type ProductBuildAuthority = ProductBuildAuthorityV1 | ProductBuildAuthorityV2 | ProductBuildAuthorityV3;

export type ProductBuildAuthorityState =
  | { status: "loading" }
  | { status: "ok"; authority: ProductBuildAuthority }
  | { status: "unavailable"; code: string; reason: string; upstreamStatus?: number; upstreamCode?: string }
  | { status: "upstream_error"; code: string; reason: string; upstreamStatus?: number; upstreamCode?: string }
  | { status: "unsupported_schema"; code: string; schema: string | null };

export function shouldPollProductBuildAuthority(state: ProductBuildAuthorityState): boolean {
  return state.status !== "ok";
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
    if (!["setfarm.product-build-authority.v1", "setfarm.product-build-authority.v2", "setfarm.product-build-authority.v3"].includes(String(record.schema))) {
      return {
        status: "unsupported_schema",
        code: "SETFARM_PRODUCT_BUILD_AUTHORITY_UNSUPPORTED_SCHEMA",
        schema: typeof record.schema === "string" ? record.schema : null,
      };
    }
    const valid = record.schema === "setfarm.product-build-authority.v1"
      ? isRenderableProductBuildAuthorityV1(record, expectedRunId)
      : record.schema === "setfarm.product-build-authority.v2"
        ? isRenderableProductBuildAuthorityV2(record, expectedRunId)
        : isRenderableProductBuildAuthorityV3(record, expectedRunId);
    if (!valid) {
      return {
        status: "upstream_error",
        code: "SETFARM_PRODUCT_BUILD_AUTHORITY_UPSTREAM_ERROR",
        reason: "invalid_payload",
        upstreamStatus: statusCode,
      };
    }
    return { status: "ok", authority: body as ProductBuildAuthority };
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
