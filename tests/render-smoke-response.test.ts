import assert from "node:assert/strict";
import test from "node:test";

import { isExpectedTypedRenderResponse } from "../scripts/render-smoke.mjs";

function response(
  status: number,
  url: string,
  body: unknown,
): Readonly<{ status(): number; url(): string; json(): Promise<unknown> }> {
  return {
    status: () => status,
    url: () => url,
    json: async () => body,
  };
}

test("render smoke accepts only the exact translated legacy-run Product Build Authority refusal", async () => {
  const baseUrl = "http://127.0.0.1:13080";
  const runId = "ac8cea43-7686-4d27-8092-1e3dd9207ca4";
  const renderedRoute = `/setfarm/runs/${runId}`;
  const url = `${baseUrl}/api/setfarm/runs/${runId}/product-build-authority`;
  const exact = {
    status: "unavailable",
    code: "SETFARM_PRODUCT_BUILD_AUTHORITY_NOT_READY",
    reason: "not_ready",
    upstreamStatus: 409,
    upstreamCode: "RUNTIME_PACKET_RUN_NOT_V3",
  };

  assert.equal(await isExpectedTypedRenderResponse(response(409, url, exact), baseUrl, renderedRoute), true);
  assert.equal(await isExpectedTypedRenderResponse(response(409, url, exact), baseUrl, "/setfarm"), false);
  assert.equal(await isExpectedTypedRenderResponse(response(409, url.replace(runId, "other-run"), exact), baseUrl, renderedRoute), false);
  assert.equal(await isExpectedTypedRenderResponse(response(409, url, { ...exact, upstreamCode: "OTHER" }), baseUrl, renderedRoute), false);
  assert.equal(await isExpectedTypedRenderResponse(response(409, url, { ...exact, upstreamStatus: 404 }), baseUrl, renderedRoute), false);
  assert.equal(await isExpectedTypedRenderResponse(response(409, url, { ...exact, extra: true }), baseUrl, renderedRoute), false);
  assert.equal(await isExpectedTypedRenderResponse(response(409, url, {
    code: exact.code,
    status: exact.status,
    reason: exact.reason,
    upstreamStatus: exact.upstreamStatus,
    upstreamCode: exact.upstreamCode,
  }), baseUrl, renderedRoute), false);
  assert.equal(await isExpectedTypedRenderResponse(response(409, url, Object.assign(Object.create(null), exact)), baseUrl, renderedRoute), false);
  assert.equal(await isExpectedTypedRenderResponse(response(409, url + "?crossed=1", exact), baseUrl, renderedRoute), false);
  assert.equal(await isExpectedTypedRenderResponse(response(409, url + "#crossed", exact), baseUrl, renderedRoute), false);
  assert.equal(await isExpectedTypedRenderResponse(response(409, url.replace(baseUrl, "http://127.0.0.1:13081"), exact), baseUrl, renderedRoute), false);
  assert.equal(await isExpectedTypedRenderResponse(response(500, url, exact), baseUrl, renderedRoute), false);
  assert.equal(
    await isExpectedTypedRenderResponse(response(409, url.replace("product-build-authority", "other"), exact), baseUrl, renderedRoute),
    false,
  );
});

test("render smoke retains the exact typed operational-snapshot not-found allowance", async () => {
  const baseUrl = "http://127.0.0.1:13080";
  const runId = "missing-run";
  const url = `${baseUrl}/api/setfarm/runs/${runId}/operational-snapshot`;
  const exact = {
    status: "unavailable",
    code: "SETFARM_OPERATIONAL_SNAPSHOT_NOT_FOUND",
    reason: "not_found",
  };
  assert.equal(await isExpectedTypedRenderResponse(response(404, url, exact), baseUrl), true);
  assert.equal(await isExpectedTypedRenderResponse(response(404, url + "?crossed=1", exact), baseUrl), false);
  assert.equal(await isExpectedTypedRenderResponse(response(404, url + "#crossed", exact), baseUrl), false);
  assert.equal(await isExpectedTypedRenderResponse(response(404, url.replace(baseUrl, "http://127.0.0.1:13081"), exact), baseUrl), false);
  assert.equal(await isExpectedTypedRenderResponse(response(404, url, { ...exact, extra: true }), baseUrl), false);
  assert.equal(await isExpectedTypedRenderResponse(response(404, url, {
    code: exact.code,
    status: exact.status,
    reason: exact.reason,
  }), baseUrl), false);
  assert.equal(await isExpectedTypedRenderResponse(response(404, url, Object.assign(Object.create(null), exact)), baseUrl), false);
});
