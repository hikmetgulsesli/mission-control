import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  assertExactRenderRoutes,
  createIsolatedChildEnvironment,
  createRenderCleanupOwner,
  createRenderScreenshotWorkspace,
  createRequiredV3ProductBuildAuthorityTracker,
  isExpectedTypedRenderResponse,
} from "../scripts/render-smoke.mjs";
import { parseProductBuildAuthorityV2 } from "../server/services/setfarm-product-build-authority.js";
import { hashCanonicalJson } from "../server/services/setfarm-operational-snapshot.js";

const execFileAsync = promisify(execFile);
const renderScript = resolve("scripts/render-smoke.mjs");
const exactRoutes = [
  "/",
  "/setfarm",
  "/setfarm/active",
  "/projects",
  "/setfarm/runs/ac8cea43-7686-4d27-8092-1e3dd9207ca4",
  "/setfarm/runs/ad47fe65-4ec4-4fb5-89da-fff71eb4e79a",
] as const;

function sealedV3Fixture() {
  const runId = "ad47fe65-4ec4-4fb5-89da-fff71eb4e79a";
  const producer = { pass: "setup-build", codeSha: "b".repeat(40), toolVersions: { node: "22.13.0" } };
  const compiler = { version: "3.5.0", codeSha: "b".repeat(40) };
  const productSpec = { schema: "setfarm.product-spec.v1", routes: [], surfaces: [], actions: [] };
  const designGraph = { schema: "setfarm.design-interaction-graph.v1", surfaces: [], controls: [], bindings: [] };
  const buildTopology = { schema: "setfarm.build-topology.v1" };
  const storyPlan = { schema: "setfarm.story-plan.v1", stories: [] };
  const artifactHash = (artifactType: string, payload: unknown) => hashCanonicalJson({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType,
    producer,
    payload,
  });
  const childRefs = {
    productSpec: artifactHash("setfarm.product-spec.v1", productSpec),
    designGraph: artifactHash("setfarm.design-interaction-graph.v1", designGraph),
    buildTopology: artifactHash("setfarm.build-topology.v1", buildTopology),
    storyPlan: artifactHash("setfarm.story-plan.v1", storyPlan),
  };
  const packet = {
    schema: "setfarm.product-build-packet.v1",
    packetVersion: 1,
    parentPacketHashes: [],
    productSpecHash: childRefs.productSpec,
    designGraphHash: childRefs.designGraph,
    buildTopologyHash: childRefs.buildTopology,
    storyPlanHash: childRefs.storyPlan,
    compiler,
    validationIds: ["VALIDATE_PACKET"],
  };
  const packetHash = artifactHash("setfarm.product-build-packet.v1", packet);
  const compilationReport = {
    schema: "setfarm.product-compilation-report.v1",
    status: "sealed",
    compiler,
    inputHashes: ["8".padStart(64, "0")],
    artifactHashes: childRefs,
    diagnostics: [],
    validationIds: ["VALIDATE_PACKET"],
    packetHash,
  };
  const packetIdentity = {
    schema: "setfarm.product-build-authority.v1" as const,
    runId,
    packetHash,
    producer,
    productSpec,
    designGraph,
    buildTopology,
    storyPlan,
    packet,
    compilationReport,
    refs: {
      ...childRefs,
      packet: packetHash,
      compilationReport: artifactHash("setfarm.product-compilation-report.v1", compilationReport),
    },
  };
  const packetAuthority = { ...packetIdentity, authorityHash: hashCanonicalJson(packetIdentity) };
  const identity = {
    schema: "setfarm.product-build-authority.v2" as const,
    runId,
    disposition: "sealed_packet" as const,
    packetAuthority,
    refusal: null,
  };
  return { ...identity, authorityHash: hashCanonicalJson(identity) };
}

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
  const exact = sealedV3Fixture();

  const tracker = createRequiredV3ProductBuildAuthorityTracker(baseUrl, parseProductBuildAuthorityV2);
  assert.equal(await tracker.observe(response(200, url, exact)), true);
  tracker.requireObserved();

  for (const crossed of [
    response(409, url, exact),
    response(200, url, { ...exact, runId: "other" }),
    response(200, url, { ...exact, extra: true }),
    response(200, url, {
      runId: exact.runId,
      schema: exact.schema,
      disposition: exact.disposition,
      packetAuthority: exact.packetAuthority,
      refusal: exact.refusal,
      authorityHash: exact.authorityHash,
    }),
    response(200, url, { ...exact, disposition: "refused" }),
    response(200, url, { ...exact, packetAuthority: null }),
    response(200, url, { ...exact, refusal: {} }),
    response(200, url, { ...exact, authorityHash: "A".repeat(64) }),
    response(200, url, {
      ...exact,
      packetAuthority: { ...exact.packetAuthority, runId: "other" },
    }),
    response(200, url, {
      ...exact,
      packetAuthority: { ...exact.packetAuthority, packetHash: "f".repeat(64) },
    }),
    response(200, `${url}?crossed=1`, exact),
    response(200, url.replace(baseUrl, "http://127.0.0.1:3080"), exact),
    response(200, url, exact, "HEAD"),
  ]) {
    const rejected = createRequiredV3ProductBuildAuthorityTracker(baseUrl, parseProductBuildAuthorityV2);
    assert.equal(await rejected.observe(crossed), false);
    assert.throws(() => rejected.requireObserved(), /required V3 Product Build Authority response was not observed/);
  }
});

test("render smoke freezes the exact ordered six-route inventory", () => {
  assert.doesNotThrow(() => assertExactRenderRoutes([...exactRoutes]));
  for (const invalid of [
    [],
    exactRoutes.slice(0, -1),
    [...exactRoutes, exactRoutes[5]],
    [exactRoutes[1], exactRoutes[0], ...exactRoutes.slice(2)],
    [...exactRoutes, "/extra"],
  ]) assert.throws(() => assertExactRenderRoutes([...invalid]), /exact ordered six-route inventory/);
});

test("isolated child environment strips every loader-injection variable", () => {
  const environment = createIsolatedChildEnvironment({
    PATH: process.env.PATH,
    NODE_OPTIONS: "--import=/tmp/attacker.mjs",
    NODE_PATH: "/tmp/attacker",
    LD_PRELOAD: "/tmp/attacker.dylib",
    DYLD_INSERT_LIBRARIES: "/tmp/attacker.dylib",
    DYLD_LIBRARY_PATH: "/tmp",
  });
  assert.equal(environment.PATH, process.env.PATH);
  assert.equal(environment.MC_HOST, "127.0.0.1");
  assert.equal(environment.MC_PORT, "13081");
  for (const key of ["NODE_OPTIONS", "NODE_PATH", "LD_PRELOAD", "DYLD_INSERT_LIBRARIES", "DYLD_LIBRARY_PATH"]) {
    assert.equal(key in environment, false);
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

test("render smoke removes only its operation-owned screenshot workspace", async () => {
  const parent = await mkdtemp(join(tmpdir(), "mc-render-screenshots-"));
  const sentinel = join(parent, "keep.txt");
  await writeFile(sentinel, "keep\n", "utf8");
  try {
    const workspace = await createRenderScreenshotWorkspace(parent);
    assert.equal(workspace.directory.startsWith(`${parent}/.render-smoke-`), true);
    await writeFile(join(workspace.directory, "page.png"), "fake", "utf8");
    await workspace.close();
    await workspace.close();
    assert.deepEqual(await readdir(parent), ["keep.txt"]);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("cleanup frees the server before bounded browser cleanup and preserves the workspace boundary", async () => {
  const events: string[] = [];
  const child = Object.assign(new EventEmitter(), {
    pid: 424242,
    exitCode: null as number | null,
    signalCode: null as NodeJS.Signals | null,
    kill(signal: NodeJS.Signals) {
      events.push(`child:${signal}`);
      this.signalCode = signal;
      this.emit("exit", null, signal);
      return true;
    },
  });
  const workspace = { close: async () => { events.push("workspace"); } };
  const browserServer = {
    close: async () => await new Promise(() => {}),
    kill: async () => { events.push("browser:kill"); },
  };
  const owner = createRenderCleanupOwner({ workspace, timeoutMs: 20, verifyPortReleased: async () => events.push("port") });
  owner.setChild(child);
  owner.setBrowserServer(browserServer);
  await owner.close();
  assert.deepEqual(events.slice(0, 2), ["child:SIGTERM", "port"]);
  assert.equal(events.includes("browser:kill"), true);
  assert.equal(events.at(-1), "workspace");
  await owner.close();
});
