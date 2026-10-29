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
