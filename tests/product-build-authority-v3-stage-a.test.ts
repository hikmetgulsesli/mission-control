import assert from "node:assert/strict";
import test from "node:test";
import corpus from "./fixtures/product-build-authority-v3-wire.json" with { type: "json" };

import { parseProductBuildAuthorityResponse } from "../src/lib/product-build-authority.js";

test("Stage A existing browser response parser accepts paired native graphless wire", () => {
  assert.equal(Reflect.get(globalThis, Symbol.for("setfarm.pba.inert-import-guard.v1")), true, "Required pre-import isolation guard must be active");
  const nativeCase = corpus.cases.find((entry) => entry.name === "native_none");
  assert.ok(nativeCase, "The paired synthetic native case must exist");
  const nativeWire = nativeCase.wire;
  const result = parseProductBuildAuthorityResponse(200, nativeWire, nativeWire.runId);
  assert.equal(result.status, "ok", "Stage A existing browser response parser must support native wire");
  if (result.status !== "ok") throw new Error("Expected native authority success");
  assert.deepEqual(result.authority, nativeWire, "Stage A browser preserves exact native wire");
});

for (const entry of corpus.cases) {
  test(`browser v3 dispatch preserves paired ${entry.name} authority`, () => {
    const result = parseProductBuildAuthorityResponse(200, entry.wire, entry.wire.runId);
    assert.equal(result.status, "ok");
    if (result.status !== "ok") throw new Error("Expected native/legacy/refused v3 wire");
    assert.deepEqual(result.authority, entry.wire);
  });
}

test("browser known malformed v3 is invalid_payload while unknown v99 remains unsupported_schema", () => {
  assert.deepEqual(parseProductBuildAuthorityResponse(200, { schema: "setfarm.product-build-authority.v3" }, "synthetic"), {
    status: "upstream_error", code: "SETFARM_PRODUCT_BUILD_AUTHORITY_UPSTREAM_ERROR", reason: "invalid_payload", upstreamStatus: 200,
  });
  assert.deepEqual(parseProductBuildAuthorityResponse(200, { schema: "setfarm.product-build-authority.v99" }, "synthetic"), {
    status: "unsupported_schema", code: "SETFARM_PRODUCT_BUILD_AUTHORITY_UNSUPPORTED_SCHEMA", schema: "setfarm.product-build-authority.v99",
  });
});

test("browser v3 dispatch rejects malformed native fields and foreign run", () => {
  const entry = corpus.cases.find((item) => item.name === "native_stitch"); assert.ok(entry);
  const value = structuredClone(entry.wire);
  const packet = value.packetAuthority;
  assert.ok(packet && "designGraph" in packet && packet.designGraph);
  packet.designGraph.controls[0]!.nativeControlKind = "future_control";
  assert.equal(parseProductBuildAuthorityResponse(200, value, value.runId).status, "upstream_error");
  assert.equal(parseProductBuildAuthorityResponse(200, entry.wire, "foreign-run").status, "upstream_error");
});

function record(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}

test("standalone browser v3 dispatch validates rendered refused and literal legacy fields", () => {
  const refusalCase = corpus.cases.find((item) => item.name === "refused_before_packet"); assert.ok(refusalCase);
  for (const field of ["failureClass", "failureCode"]) {
    const wire = structuredClone(refusalCase.wire);
    record(record(record(wire.refusal).failureIdentity).operationalCause)[field] = { unsafe: "rendered value" };
    assert.equal(parseProductBuildAuthorityResponse(200, wire, wire.runId).status, "upstream_error");
  }
  const legacyCase = corpus.cases.find((item) => item.name === "legacy2"); assert.ok(legacyCase);
  const wire = structuredClone(legacyCase.wire);
  record(record(wire.packetAuthority).productSpec).schema = "setfarm.product-spec.v99";
  assert.equal(parseProductBuildAuthorityResponse(200, wire, wire.runId).status, "upstream_error");
});

test("shared legacy compiler validation rejects malformed packets through v1, v2 and v3 dispatch", () => {
  const entry = corpus.cases.find((item) => item.name === "legacy2"); assert.ok(entry);
  const wire = structuredClone(entry.wire);
  const packet = record(wire.packetAuthority);
  const v2 = { ...wire, schema: "setfarm.product-build-authority.v2" };
  for (const body of [packet, v2, wire]) assert.equal(parseProductBuildAuthorityResponse(200, body, wire.runId).status, "ok");
  record(record(packet.packet).compiler).version = { invalid: "compiler version" };
  for (const body of [packet, v2, wire]) assert.equal(parseProductBuildAuthorityResponse(200, body, wire.runId).status, "upstream_error");
});

test("v3 legacy strengthening stays composed without changing baseline v1 or v2 acceptance", () => {
  const entry = corpus.cases.find((item) => item.name === "legacy2"); assert.ok(entry);
  for (const change of [
    (packet: Record<string, unknown>) => { record(packet.productSpec).schema = "setfarm.product-spec.v99"; },
    (packet: Record<string, unknown>) => { record(packet.producer).model = { invalid: "optional model" }; },
  ]) {
    const wire = structuredClone(entry.wire);
    const packet = record(wire.packetAuthority); change(packet);
    assert.equal(parseProductBuildAuthorityResponse(200, packet, wire.runId).status, "ok");
    assert.equal(parseProductBuildAuthorityResponse(200, { ...wire, schema: "setfarm.product-build-authority.v2" }, wire.runId).status, "ok");
    assert.equal(parseProductBuildAuthorityResponse(200, wire, wire.runId).status, "upstream_error");
  }
});

test("v3 refusal strengthening retains the original v2 baseline boundary", () => {
  const entry = corpus.cases.find((item) => item.name === "refused_before_packet"); assert.ok(entry);
  const wire = structuredClone(entry.wire);
  record(record(record(wire.refusal).failureIdentity).operationalCause).failureCode = { invalid: "rendered failure code" };
  assert.equal(parseProductBuildAuthorityResponse(200, { ...wire, schema: "setfarm.product-build-authority.v2" }, wire.runId).status, "ok");
  assert.equal(parseProductBuildAuthorityResponse(200, wire, wire.runId).status, "upstream_error");
});

import { isRenderableProductBuildAuthorityV3 } from "../src/lib/product-build-authority-v3.js";

for (const entry of corpus.cases) {
  test(`standalone two-argument v3 predicate accepts paired ${entry.name} wire`, () => {
    assert.equal(isRenderableProductBuildAuthorityV3(entry.wire, entry.wire.runId), true);
    assert.equal(isRenderableProductBuildAuthorityV3(entry.wire, "foreign-run"), false);
  });
}

test("shared source-map version validation rejects a native field in standalone predicate and response dispatch", () => {
  const entry = corpus.cases.find((item) => item.name === "native_none"); assert.ok(entry);
  assert.equal(isRenderableProductBuildAuthorityV3(entry.wire, entry.wire.runId), true);
  const wire = structuredClone(entry.wire);
  record(record(wire.packetAuthority).implementationSourceMap).sourceMapVersion = 99;
  assert.equal(isRenderableProductBuildAuthorityV3(wire, wire.runId), false);
  assert.equal(parseProductBuildAuthorityResponse(200, wire, wire.runId).status, "upstream_error");
});

// Final I1 regression stays outside server/ so the server project never imports
// browser src/. These are existing pure boundaries, not configured services.
import { hashCanonicalJson } from "../server/services/setfarm-canonical-json-v1.js";
import { parseProductBuildAuthorityV3 } from "../server/services/product-build-authority-v3-parser.js";
import { parseProductBuildAuthorityV1, parseProductBuildRefusalV2 } from "../server/services/setfarm-product-build-authority-core.js";

type OutcomeSide = "success" | "failure";
type OptionalOutcomeField = "persistenceRefs" | "userVisible";
const outcomeOmissions: Array<{ name: string; sides: OutcomeSide[]; fields: OptionalOutcomeField[] }> = [
  { name: "success persistenceRefs", sides: ["success"], fields: ["persistenceRefs"] },
  { name: "success userVisible", sides: ["success"], fields: ["userVisible"] },
  { name: "success both optional fields", sides: ["success"], fields: ["persistenceRefs", "userVisible"] },
  { name: "failure persistenceRefs", sides: ["failure"], fields: ["persistenceRefs"] },
  { name: "failure userVisible", sides: ["failure"], fields: ["userVisible"] },
  { name: "failure both optional fields", sides: ["failure"], fields: ["persistenceRefs", "userVisible"] },
  { name: "both outcomes both optional fields", sides: ["success", "failure"], fields: ["persistenceRefs", "userVisible"] },
];
function nativeOutcomeWire(): Record<string, unknown> {
  const entry = corpus.cases.find((item) => item.name === "native_none");
  assert.ok(entry);
  const wire = structuredClone(entry.wire);
  const native = record(wire.packetAuthority);
  assert.equal(native.designGraph, null);
  assert.equal(record(native.refs).designGraph, null);
  assert.deepEqual(record(native.productSpec).persistencePolicies, []);
  assert.deepEqual(record(native.implementationSourceMap).screens, []);
  assert.deepEqual(record(native.compilationReport).inputHashes, [hashCanonicalJson(native.productSpec)], "Confirm authored report input identity before rebinding");
  return wire;
}
function firstOutcome(wire: Record<string, unknown>, side: OutcomeSide): Record<string, unknown> {
  const actions = record(record(wire.packetAuthority).productSpec).actions;
  assert.ok(Array.isArray(actions));
  return record(record(actions[0])[side]);
}
function hashOutcomeIdentity(value: Record<string, unknown>): void {
  const { authorityHash: _hash, ...identity } = value;
  value.authorityHash = hashCanonicalJson(identity);
}
// Matching the SF native_none positive-control construction: rebind semantic
// dependencies first, then every top-level envelope/ref and containing hash.
// No graph, closure, producer or deterministic story partition is regenerated.
function rebindOutcomeWire(wire: Record<string, unknown>): void {
  const native = record(wire.packetAuthority);
  const story = record(native.storyPlan);
  const sourceMap = record(native.implementationSourceMap);
  const report = record(native.compilationReport);
  const refs = record(native.refs);
  const packet = record(native.packet);
  const reportRefs = record(report.artifactHashes);
  const specHash = hashCanonicalJson(native.productSpec);
  story.productSpecHash = specHash;
  sourceMap.productSpecV2PayloadHash = specHash;
  sourceMap.storyPlanV2PayloadHash = hashCanonicalJson(story);
  report.inputHashes = [specHash];
  const envelopeHash = (payload: unknown) => payload === null ? null : hashCanonicalJson({
    schema: "setfarm.semantic-artifact-envelope.v1", artifactType: record(payload).schema,
    producer: native.producer, payload,
  });
  for (const [field, packetField, reportField] of [
    ["productSpec", "productSpecV2Hash", "productSpecV2"],
    ["designGraph", "designGraphV2Hash", "designGraphV2"],
    ["buildTopology", "buildTopologyV1Hash", "buildTopologyV1"],
    ["storyPlan", "storyPlanV2Hash", "storyPlanV2"],
    ["designSourceClosure", "designSourceClosureV2Hash", "designSourceClosureV2"],
    ["implementationSourceMap", "implementationSourceMapV1Hash", "implementationSourceMapV1"],
  ] as const) {
    refs[field] = envelopeHash(native[field]);
    packet[packetField] = refs[field];
    reportRefs[reportField] = refs[field];
  }
  native.packetHash = refs.packet = envelopeHash(packet);
  report.packetHash = native.packetHash;
  refs.compilationReport = envelopeHash(report);
  hashOutcomeIdentity(native);
  hashOutcomeIdentity(wire);
}
const outcomeLegacyParsers = { packet: parseProductBuildAuthorityV1, refusal: parseProductBuildRefusalV2 };
const outcomeConsumers = [
  {
    name: "server parser",
    accept(wire: Record<string, unknown>): void {
      assert.equal(parseProductBuildAuthorityV3(wire, String(wire.runId), outcomeLegacyParsers), wire, "Server preserves the received authority object");
    },
    reject(wire: Record<string, unknown>): void {
      assert.throws(() => parseProductBuildAuthorityV3(wire, String(wire.runId), outcomeLegacyParsers), /native:invalid_structure/);
    },
  },
  {
    name: "direct browser predicate",
    accept(wire: Record<string, unknown>): void {
      assert.equal(isRenderableProductBuildAuthorityV3(wire, String(wire.runId)), true);
    },
    reject(wire: Record<string, unknown>): void {
      assert.equal(isRenderableProductBuildAuthorityV3(wire, String(wire.runId)), false);
    },
  },
  {
    name: "browser response dispatch",
    accept(wire: Record<string, unknown>): void {
      const result = parseProductBuildAuthorityResponse(200, wire, String(wire.runId));
      assert.equal(result.status, "ok");
      if (result.status !== "ok") throw new Error("Expected valid native outcome authority");
      assert.equal(result.authority, wire, "Browser dispatch preserves the received authority object");
    },
    reject(wire: Record<string, unknown>): void {
      assert.deepEqual(parseProductBuildAuthorityResponse(200, wire, String(wire.runId)), {
        status: "upstream_error", code: "SETFARM_PRODUCT_BUILD_AUTHORITY_UPSTREAM_ERROR", reason: "invalid_payload", upstreamStatus: 200,
      });
    },
  },
];
for (const consumer of outcomeConsumers) {
  test(`Final I1 MC ${consumer.name} accepts unchanged fully rebound native baseline`, () => {
    const wire = nativeOutcomeWire();
    const original = structuredClone(wire);
    rebindOutcomeWire(wire);
    assert.deepEqual(wire, original, "No-op rebinding reproduces the paired native baseline byte identity");
    consumer.accept(wire);
  });
  for (const omission of outcomeOmissions) {
    test(`Final I1 MC ${consumer.name} accepts omitted ${omission.name}`, () => {
      const wire = nativeOutcomeWire();
      for (const side of omission.sides) {
        const outcome = firstOutcome(wire, side);
        assert.deepEqual(outcome.persistenceRefs, [], "Only empty, unused persistence refs may be omitted");
        for (const field of omission.fields) delete outcome[field];
      }
      rebindOutcomeWire(wire);
      const before = structuredClone(wire);
      consumer.accept(wire);
      assert.deepEqual(wire, before, "Validation must not normalize any field or hash");
      for (const side of omission.sides) for (const field of omission.fields) {
        assert.equal(Object.hasOwn(firstOutcome(wire, side), field), false, "Omitted optional fields stay absent");
      }
    });
  }
  for (const side of ["success", "failure"] as const) {
    for (const control of [
      { name: "wrong persistenceRefs type", change: (outcome: Record<string, unknown>) => { outcome.persistenceRefs = "invalid-list"; } },
      { name: "wrong userVisible type", change: (outcome: Record<string, unknown>) => { outcome.userVisible = "true"; } },
      { name: "missing required stateRefs", change: (outcome: Record<string, unknown>) => { delete outcome.stateRefs; } },
      { name: "missing required evidenceRefs", change: (outcome: Record<string, unknown>) => { delete outcome.evidenceRefs; } },
      { name: "unknown outcome key", change: (outcome: Record<string, unknown>) => { outcome.futureOutcome = true; } },
    ]) {
      test(`Final I1 MC ${consumer.name} rejects ${side} ${control.name} with all hashes rebound`, () => {
        const wire = nativeOutcomeWire();
        consumer.accept(wire);
        control.change(firstOutcome(wire, side));
        rebindOutcomeWire(wire);
        consumer.reject(wire);
      });
    }
  }
}
