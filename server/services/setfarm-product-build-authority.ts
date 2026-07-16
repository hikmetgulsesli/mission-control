import { config } from "../config.js";
import { hashCanonicalJson } from "./setfarm-operational-snapshot.js";

type JsonRecord = Record<string, unknown>;

export interface ProductBuildAuthorityV1 {
  schema: "setfarm.product-build-authority.v1";
  runId: string;
  packetHash: string;
  producer: JsonRecord;
  productSpec: JsonRecord;
  designGraph: JsonRecord;
  buildTopology: JsonRecord;
  storyPlan: JsonRecord;
  packet: JsonRecord & {
    schema: "setfarm.product-build-packet.v1" | "setfarm.product-build-packet.v2";
    packetVersion: 1 | 2;
    compiler: { version: string; codeSha: string };
    validationIds: string[];
  };
  compilationReport: JsonRecord;
  refs: JsonRecord;
  designSourceClosure?: JsonRecord;
  designSources?: JsonRecord;
  authorityHash: string;
}

export type ProductBuildAuthorityFetchResult =
  | { status: "ok"; authority: ProductBuildAuthorityV1 }
  | { status: "unavailable"; reason: "not_found" | "not_ready" | "timeout" | "network"; upstreamStatus?: number; upstreamCode?: string }
  | { status: "upstream_error"; reason: "http_error" | "invalid_json" | "invalid_payload"; upstreamStatus?: number; upstreamCode?: string }
  | { status: "unsupported_schema"; schema: string | null };

const SHA256 = /^[a-f0-9]{64}$/;
const CODE_SHA = /^[a-f0-9]{7,64}$/;

class ProductBuildAuthorityValidationError extends Error {}

function fail(path: string, reason: string): never {
  throw new ProductBuildAuthorityValidationError(`${path}:${reason}`);
}

function recordAt(value: unknown, path: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "expected_object");
  return value as JsonRecord;
}

function exactRecordAt(
  value: unknown,
  path: string,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): JsonRecord {
  const record = recordAt(value, path);
  const keys = Object.keys(record);
  if (
    requiredKeys.some((key) => !(key in record))
    || keys.some((key) => !requiredKeys.includes(key) && !optionalKeys.includes(key))
  ) fail(path, "unexpected_or_missing_field");
  return record;
}

function stringAt(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) fail(path, "expected_string");
  return value;
}

function shaAt(value: unknown, path: string): string {
  const result = stringAt(value, path);
  if (!SHA256.test(result)) fail(path, "expected_sha256");
  return result;
}

function schemaAt(value: unknown, path: string, schema: string): JsonRecord {
  const record = recordAt(value, path);
  if (record.schema !== schema) fail(`${path}.schema`, "unsupported_schema");
  return record;
}

function arrayAt(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, "expected_array");
  return value;
}

function stringArrayAt(value: unknown, path: string): string[] {
  return arrayAt(value, path).map((entry, index) => stringAt(entry, `${path}.${index}`));
}

function shaArrayAt(value: unknown, path: string): string[] {
  return arrayAt(value, path).map((entry, index) => shaAt(entry, `${path}.${index}`));
}

function compilerAt(value: unknown, path: string): JsonRecord {
  const compiler = exactRecordAt(value, path, ["version", "codeSha"]);
  stringAt(compiler.version, `${path}.version`);
  if (!CODE_SHA.test(stringAt(compiler.codeSha, `${path}.codeSha`))) fail(`${path}.codeSha`, "expected_code_sha");
  return compiler;
}

function semanticArtifactHash(artifactType: string, producer: JsonRecord, payload: unknown): string {
  return hashCanonicalJson({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType,
    producer,
    payload,
  });
}

function assertSemanticArtifactHash(
  payload: unknown,
  artifactType: string,
  producer: JsonRecord,
  expectedHash: string,
  path: string,
): void {
  if (semanticArtifactHash(artifactType, producer, payload) !== expectedHash) {
    fail(path, "semantic_artifact_hash_mismatch");
  }
}

function validateControl(value: unknown, path: string): void {
  const control = recordAt(value, path);
  stringAt(control.id, `${path}.id`);
  stringAt(control.kind, `${path}.kind`);
  stringAt(control.surfaceRef, `${path}.surfaceRef`);
  const source = recordAt(control.source, `${path}.source`);
  shaAt(source.artifactHash, `${path}.source.artifactHash`);
  stringAt(source.locator, `${path}.source.locator`);
  stringAt(source.selector, `${path}.source.selector`);
  if (control.renderedSource !== undefined) {
    const rendered = recordAt(control.renderedSource, `${path}.renderedSource`);
    shaAt(rendered.artifactHash, `${path}.renderedSource.artifactHash`);
    stringAt(rendered.locator, `${path}.renderedSource.locator`);
    stringAt(rendered.elementRef, `${path}.renderedSource.elementRef`);
  }
}

function optionalStringArrayAt(value: unknown, path: string): void {
  if (value !== undefined) stringArrayAt(value, path);
}

function validateDesignBinding(value: unknown, path: string): void {
  const binding = recordAt(value, path);
  stringAt(binding.controlRef, `${path}.controlRef`);
  const disposition = stringAt(binding.disposition, `${path}.disposition`);
  if (!["action", "external", "disabled", "informational", "value_input"].includes(disposition)) {
    fail(`${path}.disposition`, "unsupported_disposition");
  }
  if (binding.actionRef !== undefined) stringAt(binding.actionRef, `${path}.actionRef`);
  if (binding.routeRef !== undefined) stringAt(binding.routeRef, `${path}.routeRef`);
  optionalStringArrayAt(binding.stateRefs, `${path}.stateRefs`);
  optionalStringArrayAt(binding.persistenceRefs, `${path}.persistenceRefs`);
  optionalStringArrayAt(binding.evidenceRefs, `${path}.evidenceRefs`);
  if (disposition === "value_input") {
    arrayAt(binding.fields, `${path}.fields`).forEach((entry, index) => {
      const field = recordAt(entry, `${path}.fields.${index}`);
      stringAt(field.actionRef, `${path}.fields.${index}.actionRef`);
      stringAt(field.inputField, `${path}.fields.${index}.inputField`);
    });
  }
}

function validateStitchResponseBinding(value: unknown, path: string): void {
  const binding = exactRecordAt(value, path, [
    "targetRef", "requestScreenKey", "expectedScreenTitle", "responseScreenId", "responseTitle",
    "stageId", "htmlArtifactHash", "screenshotArtifactHash", "semanticDomHash",
    "semanticObservationHash", "contractElementRefs",
  ]);
  for (const field of [
    "targetRef", "requestScreenKey", "expectedScreenTitle", "responseScreenId", "responseTitle", "stageId",
  ]) stringAt(binding[field], `${path}.${field}`);
  for (const field of [
    "htmlArtifactHash", "screenshotArtifactHash", "semanticDomHash", "semanticObservationHash",
  ]) shaAt(binding[field], `${path}.${field}`);
  stringArrayAt(binding.contractElementRefs, `${path}.contractElementRefs`);
}

function designSourceArtifactRefAt(
  value: unknown,
  path: string,
  artifactType: string,
): JsonRecord {
  const reference = exactRecordAt(value, path, ["artifactType", "envelopeHash", "payloadHash"]);
  if (reference.artifactType !== artifactType) fail(`${path}.artifactType`, "artifact_type_mismatch");
  shaAt(reference.envelopeHash, `${path}.envelopeHash`);
  shaAt(reference.payloadHash, `${path}.payloadHash`);
  return reference;
}

function assertDesignSourceArtifact(
  closure: JsonRecord,
  field: string,
  payload: unknown,
  artifactType: string,
  producer: JsonRecord,
): void {
  const path = `authority.designSourceClosure.${field}`;
  const reference = designSourceArtifactRefAt(closure[field], path, artifactType);
  if (hashCanonicalJson(payload) !== reference.payloadHash) fail(`${path}.payloadHash`, "payload_hash_mismatch");
  assertSemanticArtifactHash(payload, artifactType, producer, String(reference.envelopeHash), `${path}.envelopeHash`);
}

export function parseProductBuildAuthorityV1(
  value: unknown,
  expectedRunId?: string,
): ProductBuildAuthorityV1 {
  const authority = exactRecordAt(value, "authority", [
    "schema", "runId", "packetHash", "producer", "productSpec", "designGraph",
    "buildTopology", "storyPlan", "packet", "compilationReport", "refs", "authorityHash",
  ], ["designSourceClosure", "designSources"]);
  if (authority.schema !== "setfarm.product-build-authority.v1") {
    fail("authority.schema", "unsupported_schema");
  }
  const runId = stringAt(authority.runId, "authority.runId");
  if (expectedRunId !== undefined && runId !== expectedRunId) fail("authority.runId", "run_identity_mismatch");
  const packetHash = shaAt(authority.packetHash, "authority.packetHash");
  const authorityHash = shaAt(authority.authorityHash, "authority.authorityHash");
  const producer = exactRecordAt(authority.producer, "authority.producer", ["pass", "codeSha", "toolVersions"], ["model", "promptHash"]);
  stringAt(producer.pass, "authority.producer.pass");
  if (!CODE_SHA.test(stringAt(producer.codeSha, "authority.producer.codeSha"))) fail("authority.producer.codeSha", "expected_code_sha");
  const toolVersions = recordAt(producer.toolVersions, "authority.producer.toolVersions");
  for (const [name, version] of Object.entries(toolVersions)) stringAt(version, `authority.producer.toolVersions.${name}`);
  if (producer.model !== undefined) stringAt(producer.model, "authority.producer.model");
  if (producer.promptHash !== undefined) shaAt(producer.promptHash, "authority.producer.promptHash");
  const productSpec = schemaAt(authority.productSpec, "authority.productSpec", "setfarm.product-spec.v1");
  arrayAt(productSpec.routes, "authority.productSpec.routes");
  arrayAt(productSpec.surfaces, "authority.productSpec.surfaces");
  arrayAt(productSpec.actions, "authority.productSpec.actions");
  const designGraph = schemaAt(authority.designGraph, "authority.designGraph", "setfarm.design-interaction-graph.v1");
  arrayAt(designGraph.surfaces, "authority.designGraph.surfaces");
  arrayAt(designGraph.controls, "authority.designGraph.controls")
    .forEach((control, index) => validateControl(control, `authority.designGraph.controls.${index}`));
  arrayAt(designGraph.bindings, "authority.designGraph.bindings")
    .forEach((binding, index) => validateDesignBinding(binding, `authority.designGraph.bindings.${index}`));
  schemaAt(authority.buildTopology, "authority.buildTopology", "setfarm.build-topology.v1");
  const storyPlan = schemaAt(authority.storyPlan, "authority.storyPlan", "setfarm.story-plan.v1");
  arrayAt(storyPlan.stories, "authority.storyPlan.stories");

  const packet = recordAt(authority.packet, "authority.packet");
  const packetSchema = packet.schema;
  const packetV2 = packetSchema === "setfarm.product-build-packet.v2";
  if (!packetV2 && packetSchema !== "setfarm.product-build-packet.v1") fail("authority.packet.schema", "unsupported_schema");
  if (packet.packetVersion !== (packetV2 ? 2 : 1)) fail("authority.packet.packetVersion", "version_mismatch");
  shaArrayAt(packet.parentPacketHashes, "authority.packet.parentPacketHashes");
  const packetCompiler = compilerAt(packet.compiler, "authority.packet.compiler");
  stringArrayAt(packet.validationIds, "authority.packet.validationIds");
  if (packet.runtimeDataContractHash !== undefined) shaAt(packet.runtimeDataContractHash, "authority.packet.runtimeDataContractHash");
  if (packet.runtimeEvidenceContractHash !== undefined) shaAt(packet.runtimeEvidenceContractHash, "authority.packet.runtimeEvidenceContractHash");
  const report = recordAt(authority.compilationReport, "authority.compilationReport");
  if (report.schema !== `setfarm.product-compilation-report.v${packetV2 ? 2 : 1}` || report.status !== "sealed") {
    fail("authority.compilationReport", "packet_report_version_mismatch");
  }
  const reportCompiler = compilerAt(report.compiler, "authority.compilationReport.compiler");
  if (hashCanonicalJson(reportCompiler) !== hashCanonicalJson(packetCompiler)) {
    fail("authority.compilationReport.compiler", "packet_compiler_mismatch");
  }
  shaArrayAt(report.inputHashes, "authority.compilationReport.inputHashes");
  arrayAt(report.diagnostics, "authority.compilationReport.diagnostics");
  stringArrayAt(report.validationIds, "authority.compilationReport.validationIds");
  if (shaAt(report.packetHash, "authority.compilationReport.packetHash") !== packetHash) {
    fail("authority.compilationReport.packetHash", "packet_hash_mismatch");
  }
  const refs = exactRecordAt(authority.refs, "authority.refs", [
    "productSpec", "designGraph", "buildTopology", "storyPlan", "packet", "compilationReport",
    ...(packetV2 ? ["designSourceClosure"] : []),
  ]);
  for (const [field, packetField] of [
    ["productSpec", "productSpecHash"],
    ["designGraph", "designGraphHash"],
    ["buildTopology", "buildTopologyHash"],
    ["storyPlan", "storyPlanHash"],
  ] as const) {
    if (shaAt(refs[field], `authority.refs.${field}`) !== shaAt(packet[packetField], `authority.packet.${packetField}`)) {
      fail(`authority.refs.${field}`, "packet_child_hash_mismatch");
    }
  }
  if (shaAt(refs.packet, "authority.refs.packet") !== packetHash) fail("authority.refs.packet", "packet_hash_mismatch");
  shaAt(refs.compilationReport, "authority.refs.compilationReport");

  const reportArtifactHashes = exactRecordAt(report.artifactHashes, "authority.compilationReport.artifactHashes", [
    "productSpec", "designGraph", "buildTopology", "storyPlan", ...(packetV2 ? ["designSourceClosure"] : []),
  ]);
  for (const field of ["productSpec", "designGraph", "buildTopology", "storyPlan"] as const) {
    if (shaAt(reportArtifactHashes[field], `authority.compilationReport.artifactHashes.${field}`) !== refs[field]) {
      fail(`authority.compilationReport.artifactHashes.${field}`, "authority_ref_mismatch");
    }
  }

  assertSemanticArtifactHash(authority.productSpec, "setfarm.product-spec.v1", producer, String(refs.productSpec), "authority.refs.productSpec");
  assertSemanticArtifactHash(authority.designGraph, "setfarm.design-interaction-graph.v1", producer, String(refs.designGraph), "authority.refs.designGraph");
  assertSemanticArtifactHash(authority.buildTopology, "setfarm.build-topology.v1", producer, String(refs.buildTopology), "authority.refs.buildTopology");
  assertSemanticArtifactHash(authority.storyPlan, "setfarm.story-plan.v1", producer, String(refs.storyPlan), "authority.refs.storyPlan");
  assertSemanticArtifactHash(authority.packet, String(packetSchema), producer, packetHash, "authority.packetHash");
  assertSemanticArtifactHash(authority.compilationReport, String(report.schema), producer, String(refs.compilationReport), "authority.refs.compilationReport");

  if (packetV2) {
    const closure = schemaAt(authority.designSourceClosure, "authority.designSourceClosure", "setfarm.design-source-closure.v1");
    const closureHash = shaAt(refs.designSourceClosure, "authority.refs.designSourceClosure");
    if (closureHash !== shaAt(packet.designSourceClosureHash, "authority.packet.designSourceClosureHash")) {
      fail("authority.refs.designSourceClosure", "closure_hash_mismatch");
    }
    if (shaAt(reportArtifactHashes.designSourceClosure, "authority.compilationReport.artifactHashes.designSourceClosure") !== closureHash) {
      fail("authority.compilationReport.artifactHashes.designSourceClosure", "closure_hash_mismatch");
    }
    assertSemanticArtifactHash(authority.designSourceClosure, "setfarm.design-source-closure.v1", producer, closureHash, "authority.refs.designSourceClosure");
    if (closure.kind === "stitch") {
      const sources = exactRecordAt(authority.designSources, "authority.designSources", [
        "generationTargets", "directResponseEvidence", "renderedSemantics", "candidateSelection", "responseBindings",
      ]);
      const targets = schemaAt(sources.generationTargets, "authority.designSources.generationTargets", "setfarm.design-generation-targets.v1");
      arrayAt(targets.targets, "authority.designSources.generationTargets.targets");
      schemaAt(sources.directResponseEvidence, "authority.designSources.directResponseEvidence", "setfarm.stitch-direct-response-evidence.v2");
      const rendered = schemaAt(sources.renderedSemantics, "authority.designSources.renderedSemantics", "setfarm.stitch-rendered-semantics.v1");
      arrayAt(rendered.candidates, "authority.designSources.renderedSemantics.candidates");
      schemaAt(sources.candidateSelection, "authority.designSources.candidateSelection", "setfarm.stitch-target-candidate-selection.v1");
      const bindings = schemaAt(sources.responseBindings, "authority.designSources.responseBindings", "setfarm.stitch-target-response-bindings.v2");
      arrayAt(bindings.bindings, "authority.designSources.responseBindings.bindings")
        .forEach((binding, index) => validateStitchResponseBinding(binding, `authority.designSources.responseBindings.bindings.${index}`));
      for (const [field, artifactType] of [
        ["generationTargets", "setfarm.design-generation-targets.v1"],
        ["directResponseEvidence", "setfarm.stitch-direct-response-evidence.v2"],
        ["renderedSemantics", "setfarm.stitch-rendered-semantics.v1"],
        ["candidateSelection", "setfarm.stitch-target-candidate-selection.v1"],
        ["responseBindings", "setfarm.stitch-target-response-bindings.v2"],
      ] as const) assertDesignSourceArtifact(closure, field, sources[field], artifactType, producer);
    } else if (closure.kind !== "none" || authority.designSources !== undefined) {
      fail("authority.designSourceClosure.kind", "unsupported_or_inconsistent_kind");
    } else if (closure.reason !== "product_delivery_design_not_required") {
      fail("authority.designSourceClosure.reason", "unsupported_none_reason");
    }
  } else if (authority.designSourceClosure !== undefined || authority.designSources !== undefined) {
    fail("authority.designSourceClosure", "v1_packet_cannot_claim_design_closure");
  }

  const { authorityHash: _authorityHash, ...identity } = authority;
  if (hashCanonicalJson(identity) !== authorityHash) fail("authority.authorityHash", "canonical_hash_mismatch");
  return value as ProductBuildAuthorityV1;
}

export interface SetfarmProductBuildAuthorityClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class SetfarmProductBuildAuthorityClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SetfarmProductBuildAuthorityClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? config.setfarmUrl).replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 3_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async get(runId: string): Promise<ProductBuildAuthorityFetchResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      let response: Response;
      try {
        response = await this.fetchImpl(
          `${this.baseUrl}/api/runs/${encodeURIComponent(runId)}/product-build-authority`,
          { signal: controller.signal },
        );
      } catch (error) {
        return {
          status: "unavailable",
          reason: controller.signal.aborted || (error instanceof Error && error.name === "AbortError") ? "timeout" : "network",
        };
      }
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        return { status: "upstream_error", reason: "invalid_json", upstreamStatus: response.status };
      }
      const raw = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as JsonRecord : {};
      const upstreamCode = typeof raw.code === "string" ? raw.code : undefined;
      if (response.status === 404) return { status: "unavailable", reason: "not_found", upstreamStatus: 404, ...(upstreamCode ? { upstreamCode } : {}) };
      if (response.status === 409) return { status: "unavailable", reason: "not_ready", upstreamStatus: 409, ...(upstreamCode ? { upstreamCode } : {}) };
      if (!response.ok) return { status: "upstream_error", reason: "http_error", upstreamStatus: response.status, ...(upstreamCode ? { upstreamCode } : {}) };
      if (raw.schema !== "setfarm.product-build-authority.v1") {
        return { status: "unsupported_schema", schema: typeof raw.schema === "string" ? raw.schema : null };
      }
      try {
        return { status: "ok", authority: parseProductBuildAuthorityV1(payload, runId) };
      } catch {
        return { status: "upstream_error", reason: "invalid_payload", upstreamStatus: response.status };
      }
    } finally {
      clearTimeout(timer);
    }
  }
}

export const setfarmProductBuildAuthorityClient = new SetfarmProductBuildAuthorityClient();
