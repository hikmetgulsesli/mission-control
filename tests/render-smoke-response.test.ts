import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  assertExactRenderRoutes,
  assertExactChildListener,
  createIsolatedChildEnvironment,
  createRenderCleanupOwner,
  createRenderScreenshotWorkspace,
  createRequiredV3ProductBuildAuthorityTracker,
  installCleanupSignalHandlers,
  isExpectedTypedRenderResponse,
  runOwnedRenderLifecycle,
  terminateIsolatedServer,
  waitForIsolatedServer,
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
      timeout: 8_000,
      maxBuffer: 64 * 1024,
    });
  } catch (error) {
    assert.equal((error as any).killed, false); assert.equal((error as any).signal, null); assert.equal((error as any).code, 2);
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
  const reordered = createRequiredV3ProductBuildAuthorityTracker(baseUrl, parseProductBuildAuthorityV2);
  assert.equal(await reordered.observe(response(200, url, {
    runId: exact.runId, schema: exact.schema, disposition: exact.disposition,
    packetAuthority: exact.packetAuthority, refusal: exact.refusal, authorityHash: exact.authorityHash,
  })), true);
  reordered.requireObserved();

  for (const crossed of [
    response(409, url, exact),
    response(200, url, { ...exact, runId: "other" }),
    response(200, url, { ...exact, extra: true }),
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
  assert.match(stderr, /TASK4_BINDING_REFUSED/);
});

test("render smoke refuses missing private fd4 before any port or workspace effect", async () => {
  const stderr = await runRenderExpectingFailure({});
  assert.match(stderr, /TASK4_FRAME_(INVALID|TIMEOUT|UNAVAILABLE)/);
  assert.doesNotMatch(stderr, /Chromium|isolated server|ECONNREFUSED/);
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

test("render smoke removes each operation-created empty screenshot ancestor", async () => {
  const ancestor = await mkdtemp(join(tmpdir(), "mc-render-ancestor-"));
  const parent = join(ancestor, "artifacts", "render-smoke");
  try {
    const workspace = await createRenderScreenshotWorkspace(parent);
    await writeFile(join(workspace.directory, "page.png"), "fake", "utf8");
    await workspace.close();
    assert.deepEqual(await readdir(ancestor), []);
  } finally {
    await rm(ancestor, { recursive: true, force: true });
  }
});

test("render smoke rolls back earlier screenshot ancestors when later creation fails", async () => {
  const ancestor = await mkdtemp(join(tmpdir(), "mc-render-create-failure-"));
  const sentinel = join(ancestor, "keep.txt");
  const oversizedComponent = "x".repeat(256);
  const parent = join(ancestor, "operation-owned", oversizedComponent, "render-smoke");
  await writeFile(sentinel, "keep\n", "utf8");
  try {
    await assert.rejects(createRenderScreenshotWorkspace(parent), (error: NodeJS.ErrnoException) => {
      assert.equal(error.code, "ENAMETOOLONG");
      return true;
    });
    assert.deepEqual(await readdir(ancestor), ["keep.txt"]);
  } finally {
    await rm(ancestor, { recursive: true, force: true });
  }
});

test("listener and readiness checks reject missing, exited, crossed, and timed-out children", async () => {
  const live = { pid: 4242, exitCode: null, signalCode: null };
  const exactObservation = async () => ({ stdout: "p4242\0cnode\0f20\0n127.0.0.1:13081\0", stderr: "" });
  await assert.doesNotReject(assertExactChildListener(live, exactObservation));
  await assert.rejects(assertExactChildListener(null, exactObservation), /child is not live/);
  await assert.rejects(assertExactChildListener({ ...live, exitCode: 1 }, exactObservation), /child is not live/);
  await assert.rejects(
    assertExactChildListener(live, async () => ({ stdout: "p9999\0n127.0.0.1:13081\0", stderr: "" })),
    /listener identity mismatch/,
  );
  await assert.rejects(
    assertExactChildListener(live, async () => ({ stdout: "p4242\0n127.0.0.1:13081\0", stderr: "diagnostic" })),
    /emitted diagnostics/,
  );

  let clock = 0;
  const unavailable = Object.assign(new Error("not listening"), { code: 1 });
  await assert.rejects(
    waitForIsolatedServer(live, { current: null }, 400, {
      now: () => clock,
      sleep: async (milliseconds: number) => { clock += milliseconds; },
      observeListener: async () => { throw unavailable; },
      isReachable: async () => false,
    }),
    /did not become ready/,
  );
  await assert.rejects(
    waitForIsolatedServer({ ...live, signalCode: "SIGTERM" }, { current: null }, 1),
    /exited with SIGTERM/,
  );
  await assert.rejects(
    waitForIsolatedServer(live, { current: new Error("spawn failed") }, 1),
    /spawn failed/,
  );
});

test("forced child teardown escalates, waits, verifies the port, and handles every termination signal", async () => {
  const events: string[] = [];
  const stubborn = Object.assign(new EventEmitter(), {
    pid: 434343,
    exitCode: null as number | null,
    signalCode: null as NodeJS.Signals | null,
    kill(signal: NodeJS.Signals) {
      events.push(signal);
      if (signal === "SIGKILL") {
        this.signalCode = signal;
        this.emit("exit", null, signal);
      }
      return true;
    },
  });
  await terminateIsolatedServer(stubborn, async () => { events.push("port"); }, 10);
  assert.deepEqual(events, ["SIGTERM", "SIGKILL", "port"]);

  for (const [signal, expectedCode] of [["SIGHUP", 129], ["SIGINT", 130], ["SIGTERM", 143]] as const) {
    const processTarget = new EventEmitter();
    const observed: Array<string | number> = [];
    const owner = { close: async () => { observed.push("close"); } };
    // Simulated event transport only: this test never supplies or claims an actual process owner.
    const fakeEventTarget = processTarget as unknown as Parameters<typeof installCleanupSignalHandlers>[1];
    // Simulated exit observer returns to the test; it never exits a process.
    const fakeExitObserver = ((code: number) => observed.push(code)) as unknown as Parameters<typeof installCleanupSignalHandlers>[2];
    const removeHandlers = installCleanupSignalHandlers(owner, fakeEventTarget, fakeExitObserver);
    processTarget.emit(signal);
    await new Promise((resolveTurn) => setImmediate(resolveTurn));
    removeHandlers();
    assert.deepEqual(observed, ["close", expectedCode]);
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
  const owner = createRenderCleanupOwner({ workspace, timeoutMs: 20, verifyPortReleased: async () => { events.push("port"); } });
  owner.setChild(child);
  owner.setBrowserLaunch(new Promise((resolveLaunch) => setImmediate(() => resolveLaunch(browserServer))));
  await owner.close();
  assert.deepEqual(events.slice(0, 2), ["child:SIGTERM", "port"]);
  assert.equal(events.includes("browser:kill"), true);
  assert.equal(events.at(-1), "workspace");
  await owner.close();
});

test("preflight and response failures always pass through the same cleanup owner", async () => {
  for (const message of ["preflight failed", "response failed"]) {
    const events: string[] = [];
    const owner = { close: async () => { events.push("close"); } };
    await assert.rejects(
      runOwnedRenderLifecycle(owner, async () => {
        events.push("action");
        throw new Error(message);
      }, () => events.push("signals-removed")),
      new RegExp(message),
    );
    assert.deepEqual(events, ["action", "close", "signals-removed"]);
  }
});

test('Task4 canonical sealed vector is accepted by the real strict parser and response tracker', async () => {
  const { task4SeedV1, task4CanonicalV1 } = await import('../scripts/render-smoke-owned-fixture.mjs');
  const body = JSON.parse(task4CanonicalV1(task4SeedV1('1'.repeat(40)).productResponse));
  assert.equal(parseProductBuildAuthorityV2(body, 'ad47fe65-4ec4-4fb5-89da-fff71eb4e79a'), body);
  const tracker = createRequiredV3ProductBuildAuthorityTracker('http://127.0.0.1:13081', parseProductBuildAuthorityV2);
  const response = (payload: any, status = 200) => ({ request: () => ({ method: () => 'GET' }), status: () => status,
    url: () => 'http://127.0.0.1:13081/api/setfarm/runs/ad47fe65-4ec4-4fb5-89da-fff71eb4e79a/product-build-authority', json: async () => payload });
  assert.equal(await tracker.observe(response(body)), true); tracker.requireObserved();
  for (const changed of [{ ...body, extra: true }, { ...body, packetAuthority: { ...body.packetAuthority, packetHash: 'f'.repeat(64) } }, { ...body, runId: 'ac8cea43-7686-4d27-8092-1e3dd9207ca4' }])
    assert.equal(await tracker.observe(response(changed)), false);
  assert.equal(await tracker.observe(response(body, 409)), false);
});

test('Task4 fixed upstream snapshots are real strict partial200 for both exact run IDs', async () => {
  const { task4MockResponseV1, task4NetworkRecipesV1 } = await import('../scripts/render-smoke-owned-fixture.mjs');
  const { parseRunOperationalSnapshotV1 } = await import('../server/services/setfarm-operational-snapshot.js');
  const source = '1'.repeat(40), ids = ['ac8cea43-7686-4d27-8092-1e3dd9207ca4', 'ad47fe65-4ec4-4fb5-89da-fff71eb4e79a'];
  for (const [index, id] of ids.entries()) {
    const path = `/api/runs/${id}/operational-snapshot`;
    const response = task4MockResponseV1('GET', path, source);
    assert.equal(response.status, 200); assert.equal(response.contentType, 'application/json; charset=utf-8');
    const body = JSON.parse(response.body), parsed = parseRunOperationalSnapshotV1(body);
    assert.equal(parsed.run.id, id); assert.equal(parsed.run.protocol, index ? 'v3' : 'legacy');
    assert.equal(parsed.source.projection, 'partial'); assert.equal(parsed.summary.operatorActions.stop.allowed, false);
    assert.equal(parsed.summary.operatorActions.resume.allowed, false); assert.equal(parsed.claims.length, 0); assert.equal(parsed.attempts.length, 0);
    assert.equal(task4MockResponseV1('POST', path, source), null);
    assert.equal(task4MockResponseV1('GET', path + '?extra=1', source), null);
    const model = JSON.parse(task4MockResponseV1('GET', `/api/runs/${id}/operational-model`, source).body);
    assert.equal(model.schema, 'setfarm.run-operational-model.v1'); assert.equal(model.run.id, id); assert.equal(model.failure.present, false);
    assert.equal(model.stories.total, 0); assert.equal(model.pipeline.stepsTotal, 0);
  }
  const legacy = task4MockResponseV1('GET', `/api/runs/${ids[0]}/product-build-authority`, source);
  assert.equal(legacy.status, 409); assert.equal(legacy.body, '{"code":"RUNTIME_PACKET_RUN_NOT_V3"}');
  const v3 = task4MockResponseV1('GET', `/api/runs/${ids[1]}/product-build-authority`, source);
  assert.equal(v3.status, 200); assert.equal(parseProductBuildAuthorityV2(JSON.parse(v3.body), ids[1]).disposition, 'sealed_packet');
  assert.equal(task4MockResponseV1('GET', '/api/runs/foreign/operational-snapshot', source), null);
  const registry = task4NetworkRecipesV1(); assert.ok(Object.isFrozen(registry));
  for (const group of ['browser', 'mock']) {
    assert.equal(new Set(registry[group].map((r: any) => r.pathId)).size, registry[group].length);
    assert.ok(registry[group].every((r: any) => ['GET', 'HEAD'].includes(r.method) && Object.isFrozen(r)));
  }
  assert.equal(registry.mock.length, 6);
});


test("render smoke consumes original empty fd4 EOF and exits naturally before resources", async () => {
  const child = spawn(process.execPath, [renderScript], { cwd: process.cwd(), env: { PATH: '/usr/bin:/bin', HOME: process.env.HOME }, stdio: ['ignore', 'pipe', 'pipe', 'ignore', 'pipe'] });
  let output = '', errorOutput = '', exited: any = null;
  child.stdout!.on('data', value => { output += value; }); child.stderr!.on('data', value => { errorOutput += value; });
  child.on('exit', (code, signal) => { exited = { code, signal }; });
  const closed = new Promise<void>((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => {
    try { assert.deepEqual(exited, { code: 2, signal: null }); assert.equal(code, 2); assert.equal(signal, null); resolve(); } catch (error) { reject(error); }
  }); });
  (child.stdio[4] as import('node:stream').Writable).end();
  await closed; assert.equal(output, ''); assert.equal(errorOutput, '[render-smoke] TASK4_FRAME_INVALID\n');
});
