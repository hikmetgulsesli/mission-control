import assert from "node:assert/strict";
import test from "node:test";
import corpus from "./fixtures/product-build-authority-v3-wire.json" with { type: "json" };
import { fetchProductBuildAuthority } from "../src/lib/product-build-authority-request.js";
import { resolveProductBuildAuthoritySchema, resolveProductBuildAuthorityHttpRequest, toProductBuildAuthorityHttpResult } from "../server/services/product-build-authority-http.js";
import { parseProductBuildAuthority } from "../server/services/setfarm-product-build-authority-core.js";
import type { ProductBuildAuthorityFetchResult } from "../server/services/setfarm-product-build-authority-core.js";

const unavailable: ProductBuildAuthorityFetchResult = { status: "unavailable", reason: "not_ready", upstreamStatus: 409, upstreamCode: "RUNTIME_PACKET_NOT_SEALED" };

test("Stage B pure route adapter defaults to v2 and forwards each explicit supported version", async () => {
  assert.equal(Reflect.get(globalThis, Symbol.for("setfarm.pba.inert-import-guard.v1")), true);
  const calls: unknown[][] = [];
  const client = { async get(runId: string, version: "v1" | "v2" | "v3") { calls.push([runId, version]); return unavailable; } };
  for (const [query, expected] of [[undefined, "v2"], ["v1", "v1"], ["v2", "v2"], ["v3", "v3"]] as const) {
    assert.equal(resolveProductBuildAuthoritySchema(query), expected);
    assert.deepEqual(await resolveProductBuildAuthorityHttpRequest("run /?", query, client), toProductBuildAuthorityHttpResult(unavailable));
    assert.deepEqual(calls.at(-1), ["run /?", expected]);
  }
});

for (const query of [["v3", "v3"], ["v3"], "v99", "", null, 3, { schema: "v3" }]) {
  test(`Stage B rejects schema query ${JSON.stringify(query)} before the client`, async () => {
    assert.throws(() => resolveProductBuildAuthoritySchema(query));
    const response = await resolveProductBuildAuthorityHttpRequest("run", query, { async get() { assert.fail("Client must not be called for invalid query"); } });
    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, { status: "unsupported_schema", code: "SETFARM_PRODUCT_BUILD_AUTHORITY_UNSUPPORTED_SCHEMA", schema: typeof query === "string" ? query : null });
  });
}

test("Stage B HTTP mapping retains exact legacy statuses and upstream details", () => {
  for (const [reason, statusCode, code] of [["not_found", 404, "NOT_FOUND"], ["not_ready", 409, "NOT_READY"], ["timeout", 503, "UNAVAILABLE"], ["network", 503, "UNAVAILABLE"]] as const) {
    assert.deepEqual(toProductBuildAuthorityHttpResult({ status: "unavailable", reason, upstreamStatus: 418, upstreamCode: "EXACT" }), {
      statusCode, body: { status: "unavailable", code: `SETFARM_PRODUCT_BUILD_AUTHORITY_${code}`, reason, upstreamStatus: 418, upstreamCode: "EXACT" },
    });
  }
  assert.deepEqual(toProductBuildAuthorityHttpResult({ status: "upstream_error", reason: "invalid_payload", upstreamStatus: 200, upstreamCode: "EXACT" }), {
    statusCode: 502, body: { status: "upstream_error", code: "SETFARM_PRODUCT_BUILD_AUTHORITY_UPSTREAM_ERROR", reason: "invalid_payload", upstreamStatus: 200, upstreamCode: "EXACT" },
  });
  assert.deepEqual(toProductBuildAuthorityHttpResult({ status: "unsupported_schema", schema: "v99" }), {
    statusCode: 501, body: { status: "unsupported_schema", code: "SETFARM_PRODUCT_BUILD_AUTHORITY_UNSUPPORTED_SCHEMA", schema: "v99" },
  });
});

for (const entry of corpus.cases) {
  test(`Stage B injected request preserves complete paired ${entry.name} response`, async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => { calls.push({ input, init }); return new Response(JSON.stringify(entry.wire), { status: 200 }); };
    const headers = { "X-MC-Token": "synthetic-token" };
    const result = await fetchProductBuildAuthority(entry.wire.runId, fetchImpl, "https://synthetic.invalid/base", headers);
    assert.deepEqual(result, { status: "ok", authority: entry.wire });
    assert.deepEqual(calls, [{ input: `https://synthetic.invalid/base/api/setfarm/runs/${encodeURIComponent(entry.wire.runId)}/product-build-authority?schema=v3`, init: { headers, cache: "no-store" } }]);
  });
}

test("Stage B request encodes runId and preserves invalid JSON, network and literal error statuses", async () => {
  const runId = "run /?&雪";
  const fetchImpl: typeof fetch = async (input, init) => {
    assert.equal(input, `/api/setfarm/runs/${encodeURIComponent(runId)}/product-build-authority?schema=v3`);
    assert.equal(init?.cache, "no-store"); return new Response("not json", { status: 502 });
  };
  assert.deepEqual(await fetchProductBuildAuthority(runId, fetchImpl, "", {}), { status: "upstream_error", code: "SETFARM_PRODUCT_BUILD_AUTHORITY_UPSTREAM_ERROR", reason: "invalid_json", upstreamStatus: 502 });
  assert.deepEqual(await fetchProductBuildAuthority(runId, async () => { throw new Error("synthetic network"); }, "", {}), { status: "unavailable", code: "SETFARM_PRODUCT_BUILD_AUTHORITY_UNAVAILABLE", reason: "network" });
  for (const [status, body] of [
    [409, { status: "unavailable", code: "EXACT_NOT_READY", reason: "not_ready", upstreamCode: "EXACT_UPSTREAM" }],
    [502, { status: "upstream_error", code: "EXACT_ERROR", reason: "invalid_payload" }],
    [501, { status: "unsupported_schema", code: "EXACT_UNSUPPORTED", schema: "v99" }],
  ] as const) {
    const result = await fetchProductBuildAuthority(runId, async () => new Response(JSON.stringify(body), { status }), "", {});
    assert.equal(result.status, body.status);
    assert.equal("code" in result && result.code, body.code);
  }
  const malformed = await fetchProductBuildAuthority(runId, async () => new Response(JSON.stringify({ schema: "setfarm.product-build-authority.v3" })), "", {});
  assert.equal(malformed.status, "upstream_error");
  assert.equal("reason" in malformed && malformed.reason, "invalid_payload");
  const unknown = await fetchProductBuildAuthority(runId, async () => new Response(JSON.stringify({ schema: "setfarm.product-build-authority.v99" })), "", {});
  assert.equal(unknown.status, "unsupported_schema");
});


test("Stage B pure adapter leaves unexpected client failures to the operational route catch", async () => {
  const failure = new Error("synthetic client failure");
  await assert.rejects(resolveProductBuildAuthorityHttpRequest("run", "v3", { async get() { throw failure; } }), error => error === failure);
});


for (const entry of corpus.cases) {
  test(`Stage B pure route adapter returns complete paired ${entry.name} authority unchanged`, async () => {
    const authority = parseProductBuildAuthority(entry.wire, entry.wire.runId);
    const response = await resolveProductBuildAuthorityHttpRequest(entry.wire.runId, "v3", {
      async get(runId, version) { assert.equal(runId, entry.wire.runId); assert.equal(version, "v3"); return { status: "ok", authority }; },
    });
    assert.deepEqual(response, { statusCode: 200, body: entry.wire });
  });
}
