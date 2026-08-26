import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  createRequiredV3ProductBuildAuthorityTracker,
  isExpectedTypedRenderResponse,
} from "../scripts/render-smoke.mjs";

const execFileAsync = promisify(execFile);
const renderScript = resolve("scripts/render-smoke.mjs");

async function runRenderExpectingFailure(env: NodeJS.ProcessEnv): Promise<string> {
  try {
    await execFileAsync(process.execPath, [renderScript], {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      encoding: "utf8",
      timeout: 5_000,
      maxBuffer: 64 * 1024,
    });
  } catch (error) {
    return String((error as {stderr?: string}).stderr || (error as Error).message);
  }
  assert.fail("render smoke unexpectedly succeeded");
}

function response(
  status: number,
  url: string,
  body: unknown,
  method = "GET",
): Readonly<{ status(): number; url(): string; json(): Promise<unknown>; request(): Readonly<{method(): string}> }> {
  return {
    status: () => status,
    url: () => url,
    json: async () => body,
    request: () => ({ method: () => method }),
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
  assert.equal(await isExpectedTypedRenderResponse(response(409, url, exact, "HEAD"), baseUrl, renderedRoute), false);
  assert.equal(
    await isExpectedTypedRenderResponse(
      response(409, url.replace(runId, "other-run"), exact),
      baseUrl,
      "/setfarm/runs/other-run",
    ),
    false,
  );
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
  const renderedRoute = `/setfarm/runs/${runId}`;
  assert.equal(await isExpectedTypedRenderResponse(response(404, url, exact), baseUrl, renderedRoute), true);
  assert.equal(await isExpectedTypedRenderResponse(response(404, url, exact, "HEAD"), baseUrl, renderedRoute), false);
  assert.equal(await isExpectedTypedRenderResponse(response(404, url + "?crossed=1", exact), baseUrl, renderedRoute), false);
  assert.equal(await isExpectedTypedRenderResponse(response(404, url + "#crossed", exact), baseUrl, renderedRoute), false);
  assert.equal(await isExpectedTypedRenderResponse(response(404, url.replace(baseUrl, "http://127.0.0.1:13081"), exact), baseUrl, renderedRoute), false);
  assert.equal(await isExpectedTypedRenderResponse(response(404, url, { ...exact, extra: true }), baseUrl, renderedRoute), false);
  assert.equal(await isExpectedTypedRenderResponse(response(404, url, {
    code: exact.code,
    status: exact.status,
    reason: exact.reason,
  }), baseUrl, renderedRoute), false);
  assert.equal(await isExpectedTypedRenderResponse(response(404, url, Object.assign(Object.create(null), exact)), baseUrl, renderedRoute), false);
  assert.equal(await isExpectedTypedRenderResponse(response(404, url, exact), baseUrl, "/setfarm/runs/other"), false);
});

test("render smoke requires the exact durable V3 sealed response before and during its route", async () => {
  const baseUrl = "http://127.0.0.1:13081";
  const runId = "ad47fe65-4ec4-4fb5-89da-fff71eb4e79a";
  const url = `${baseUrl}/api/setfarm/runs/${runId}/product-build-authority`;
  const exact = {
    schema: "setfarm.product-build-authority.v2",
    runId,
    disposition: "sealed_packet",
    packetAuthority: { schema: "setfarm.packet-authority.v1" },
    refusal: null,
    authorityHash: "a".repeat(64),
  };

  const tracker = createRequiredV3ProductBuildAuthorityTracker(baseUrl);
  assert.equal(await tracker.observe(response(200, url, exact)), true);
  tracker.requireObserved();

  for (const crossed of [
    response(409, url, exact),
    response(200, url, { ...exact, runId: "other" }),
    response(200, url, { ...exact, disposition: "refused" }),
    response(200, url, { ...exact, packetAuthority: null }),
    response(200, url, { ...exact, refusal: {} }),
    response(200, url, { ...exact, authorityHash: "A".repeat(64) }),
    response(200, `${url}?crossed=1`, exact),
    response(200, url.replace(baseUrl, "http://127.0.0.1:3080"), exact),
    response(200, url, exact, "HEAD"),
  ]) {
    const rejected = createRequiredV3ProductBuildAuthorityTracker(baseUrl);
    assert.equal(await rejected.observe(crossed), false);
    assert.throws(() => rejected.requireObserved(), /required V3 Product Build Authority response was not observed/);
  }
});

test("render smoke rejects any non-authoritative origin before starting a server", async () => {
  const stderr = await runRenderExpectingFailure({ MC_RENDER_BASE_URL: "http://127.0.0.1:3080" });
  assert.match(stderr, /MC_RENDER_BASE_URL must equal http:\/\/127\.0\.0\.1:13081/);
});

test("render smoke refuses a preoccupied isolated port without reusing its listener", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "mc-render-port-"));
  const server = createServer((_request) => {});
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(13081, "127.0.0.1", resolveListen);
  });
  try {
    const stderr = await runRenderExpectingFailure({
      MC_RENDER_BASE_URL: "http://127.0.0.1:13081",
      MC_RENDER_SCREENSHOT_DIR: temporary,
    });
    assert.match(stderr, /render port 127\.0\.0\.1:13081 is preoccupied/);
  } finally {
    await new Promise<void>((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
    await rm(temporary, { recursive: true, force: true });
  }
});
