import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { createServer, request as nodeRequest } from "node:http";
import test from "node:test";
import express from "express";

import setfarmOperationalRouter, { toProductBuildAuthorityHttpResult } from "./setfarm-operational.js";

for (const key of Object.keys(process.env)) {
  if (key.startsWith("GIT_")) delete process.env[key];
}

function reconciliationBranch(): boolean {
  return execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim()
    === "fix/internal-production-baseline-reconciliation";
}

async function rawGet(
  port: number,
  headers: Readonly<Record<string, string | undefined>>,
  body: string,
): Promise<Readonly<{ statusCode: number; body: unknown }>> {
  return new Promise((resolve, reject) => {
    const request = nodeRequest({
      host: "127.0.0.1",
      port,
      method: "GET",
      path: "/api/internal-production/product-build-authority-v2-delivery-evidence",
      headers,
    }, (response) => {
      let responseBody = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { responseBody += chunk; });
      response.once("error", reject);
      response.once("end", () => {
        resolve({ statusCode: response.statusCode ?? 0, body: JSON.parse(responseBody) });
      });
    });
    request.once("error", reject);
    request.end(body);
  });
}

test("Product Build authority unavailable causes map without prose classification", () => {
  assert.deepEqual(toProductBuildAuthorityHttpResult({ status: "unavailable", reason: "not_found" }), {
    statusCode: 404,
    body: {
      status: "unavailable",
      code: "SETFARM_PRODUCT_BUILD_AUTHORITY_NOT_FOUND",
      reason: "not_found",
    },
  });
  assert.deepEqual(toProductBuildAuthorityHttpResult({ status: "unavailable", reason: "not_ready" }), {
    statusCode: 409,
    body: {
      status: "unavailable",
      code: "SETFARM_PRODUCT_BUILD_AUTHORITY_NOT_READY",
      reason: "not_ready",
    },
  });
  assert.deepEqual(toProductBuildAuthorityHttpResult({ status: "unavailable", reason: "timeout" }), {
    statusCode: 503,
    body: {
      status: "unavailable",
      code: "SETFARM_PRODUCT_BUILD_AUTHORITY_UNAVAILABLE",
      reason: "timeout",
    },
  });
});

test("delivery-evidence endpoint refuses feature-branch reads without serializing a current pair", async (context) => {
  if (!reconciliationBranch()) {
    context.skip("only the reconciliation branch must exercise pre-publication refusal");
    return;
  }
  const app = express();
  app.use("/api", setfarmOperationalRouter);
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    if (address === null || typeof address === "string") throw new TypeError("expected TCP listener");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/internal-production/product-build-authority-v2-delivery-evidence`);

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      status: "unavailable",
      code: "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_NOT_CURRENT",
    });
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("delivery-evidence endpoint rejects every caller-selected query", async () => {
  const app = express();
  app.use("/api", setfarmOperationalRouter);
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    if (address === null || typeof address === "string") throw new TypeError("expected TCP listener");
    for (const query of ["forbidden=true", "runId=42", "ref=main", `hash=${"a".repeat(64)}`]) {
      const response: Response = await fetch(
        `http://127.0.0.1:${address.port}/api/internal-production/product-build-authority-v2-delivery-evidence?${query}`,
      );

      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), {
        status: "unavailable",
        code: "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_REQUEST_INVALID",
      });
    }
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("delivery-evidence endpoint refuses all request bodies and body-framing headers before observation", async () => {
  const app = express();
  app.use(express.json());
  app.use("/api", setfarmOperationalRouter);
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    if (address === null || typeof address === "string") throw new TypeError("expected TCP listener");
    for (const candidate of [
      { headers: { "content-type": "application/json", "content-length": "2" }, body: "{}" },
      { headers: { "content-type": "application/json", "content-length": "20" }, body: '{"runId":"attacker"}' },
      { headers: { "transfer-encoding": "chunked" }, body: "arbitrary" },
    ]) {
      const response = await rawGet(address.port, candidate.headers, candidate.body);
      assert.equal(response.statusCode, 400);
      assert.deepEqual(response.body, {
        status: "unavailable",
        code: "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_REQUEST_INVALID",
      });
    }
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("loaded-build endpoint serializes only the frozen startup state and refuses caller input", async () => {
  const routeModuleUrl = new URL("./setfarm-operational.ts", import.meta.url).href;
  const fixture = String.raw`
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, request as nodeRequest } from "node:http";
import test from "node:test";
import express from "express";

const response = Object.freeze({
  schema: "mission-control.product-build-authority-v2-loaded-build-response.v1",
  loadedBuildRef: "mission-control://internal-production/product-build-authority-v2-loaded-build/sha256/" + "1".repeat(64),
  loadedBuildHash: "1".repeat(64),
  startupInstance: Object.freeze({
    schema: "mission-control.product-build-authority-v2-startup-instance.v1",
    pid: 4242,
    instanceId: "123e4567-e89b-42d3-a456-426614174000",
  }),
  loadedBuild: Object.freeze({
    schema: "mission-control.product-build-authority-v2-loaded-build.v1",
    entryModulePath: "dist-server/services/product-build-authority-v2-delivery-evidence-v1.js",
    entryModuleHash: "2".repeat(64),
    buildIdentity: Object.freeze({
      schema: "mission-control.internal-production-build-identity.v1",
      sourceSha: "3".repeat(40),
      treeHash: "4".repeat(40),
      buildHash: "5".repeat(64),
    }),
    buildIdentityHash: "6".repeat(64),
  }),
});
let startupState = Object.freeze({ status: "available", response });
let loadedStateReads = 0;
class DeliveryEvidenceError extends Error { constructor(code) { super(code); this.code = code; } }

function rawRequest(port, method, path, headers = {}, body = "") {
  return new Promise((resolve, reject) => {
    const request = nodeRequest({ host: "127.0.0.1", port, method, path, headers }, (incoming) => {
      let text = "";
      incoming.setEncoding("utf8");
      incoming.on("data", (chunk) => { text += chunk; });
      incoming.once("error", reject);
      incoming.once("end", () => {
        let body;
        try { body = text === "" ? undefined : JSON.parse(text); }
        catch { body = text; }
        resolve({ statusCode: incoming.statusCode ?? 0, headers: incoming.headers, body });
      });
    });
    request.once("error", reject);
    request.end(body);
  });
}

test("loaded route", async (context) => {
  context.mock.module(process.env.PBA_SERVICE_URL, { exports: {
    ProductBuildAuthorityV2DeliveryEvidenceError: DeliveryEvidenceError,
    currentProductBuildAuthorityV2DeliveryEvidenceResponseV1: async () => { throw new Error("not used"); },
    productBuildAuthorityV2LoadedBuildStartupStateV1: () => { loadedStateReads += 1; return startupState; },
  } });
  const { default: router } = await import(process.env.PBA_ROUTE_URL + "?loaded-route");
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    if (address === null || typeof address === "string") throw new TypeError("expected TCP listener");
    const port = address.port;
    const ok = await rawRequest(port, "GET", "/api/internal-production/product-build-authority-v2-loaded-build");
    assert.equal(ok.statusCode, 200);
    assert.deepEqual(ok.body, response);
    assert.equal(ok.headers["cache-control"], "no-store, max-age=0, must-revalidate");
    assert.equal(ok.headers.pragma, "no-cache");
    assert.equal(ok.headers.expires, "0");
    assert.equal(loadedStateReads, 1);

    const head = await rawRequest(port, "HEAD", "/api/internal-production/product-build-authority-v2-loaded-build");
    assert.equal(head.statusCode, 404);
    assert.equal(loadedStateReads, 1);

    const aliasReadsBefore = loadedStateReads;
    const aliasResults = [];
    for (const path of [
      "/api/internal-production/Product-Build-Authority-V2-Loaded-Build",
      "/api/internal-production/product-build-authority-v2-loaded-build/",
      "/API/internal-production/product-build-authority-v2-loaded-build",
    ]) {
      aliasResults.push(await rawRequest(port, "GET", path));
    }
    assert.deepEqual(aliasResults.map(({ statusCode }) => statusCode), [404, 404, 404]);
    assert.equal(loadedStateReads, aliasReadsBefore);

    for (const candidate of [
      { method: "GET", path: "/api/internal-production/product-build-authority-v2-loaded-build?ref=main", headers: {}, body: "" },
      { method: "GET", path: "/api/internal-production/product-build-authority-v2-loaded-build", headers: { "content-length": "0" }, body: "" },
      { method: "GET", path: "/api/internal-production/product-build-authority-v2-loaded-build", headers: { "content-type": "application/json", "content-length": "2" }, body: "{}" },
      { method: "GET", path: "/api/internal-production/product-build-authority-v2-loaded-build", headers: { "transfer-encoding": "chunked" }, body: "attacker" },
    ]) {
      const invalid = await rawRequest(port, candidate.method, candidate.path, candidate.headers, candidate.body);
      assert.equal(invalid.statusCode, 400);
      assert.deepEqual(invalid.body, {
        status: "unavailable",
        code: "PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_REQUEST_INVALID",
      });
    }
    assert.equal(loadedStateReads, 1);

    const post = await rawRequest(port, "POST", "/api/internal-production/product-build-authority-v2-loaded-build");
    assert.equal(post.statusCode, 404);
    assert.equal(loadedStateReads, 1);

    startupState = Object.freeze({
      status: "unavailable",
      code: "PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID",
    });
    const unavailable = await rawRequest(port, "GET", "/api/internal-production/product-build-authority-v2-loaded-build");
    assert.equal(unavailable.statusCode, 503);
    assert.deepEqual(unavailable.body, {
      status: "unavailable",
      code: "PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID",
    });
    assert.equal(loadedStateReads, 2);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
`;
  const result = await new Promise<Readonly<{ exitCode: number; stdout: string; stderr: string }>>((resolveResult, reject) => {
    const child = spawn(process.execPath, [
      "--experimental-test-module-mocks",
      "--import",
      "tsx",
      "--input-type=module",
      "--eval",
      fixture,
    ], {
      env: {
        ...process.env,
        PBA_ROUTE_URL: routeModuleUrl,
        PBA_SERVICE_URL: new URL("../services/product-build-authority-v2-delivery-evidence-v1.ts", import.meta.url).href,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (exitCode) => resolveResult({ exitCode: exitCode ?? -1, stdout, stderr }));
  });
  assert.equal(result.exitCode, 0, `${result.stdout}${result.stderr}`);
});

async function runProductionAuthFixture(
  mode: "available" | "missing" | "short",
): Promise<Readonly<{ exitCode: number; stdout: string; stderr: string }>> {
  const fixture = String.raw`
import assert from "node:assert/strict";
import * as actualHttp from "node:http";
import test from "node:test";

const canonicalPath = "/api/internal-production/product-build-authority-v2-loaded-build";
const operationalToken = "operational-test-token-1234567890abcdef";
let authCalls = 0;
let bootListenCalls = 0;
let loadedStateReads = 0;
let capturedServer;
let listenForTest;

function rawRequest(port, method, path, headers = {}, body = "") {
  return new Promise((resolve, reject) => {
    const request = actualHttp.request({
      host: "127.0.0.1",
      port,
      method,
      path,
      headers,
    }, (incoming) => {
      let text = "";
      incoming.setEncoding("utf8");
      incoming.on("data", (chunk) => { text += chunk; });
      incoming.once("error", reject);
      incoming.once("end", () => {
        let responseBody;
        try { responseBody = JSON.parse(text); }
        catch { responseBody = text; }
        resolve({ statusCode: incoming.statusCode ?? 0, body: responseBody });
      });
    });
    request.once("error", reject);
    request.end(body);
  });
}

test("production middleware order", async (context) => {
  context.mock.module(process.env.MC_AUTH_URL, { exports: {
    authMiddleware: (req, res, next) => {
      authCalls += 1;
      if (req.headers["x-mc-token"] !== "private-test-token") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      next();
    },
  } });
  context.mock.module(process.env.MC_LIVE_FEED_URL, { exports: {
    default: (_req, _res, next) => next(),
  } });
  context.mock.module(process.env.MC_SERVICE_URL, { exports: {
    ProductBuildAuthorityV2DeliveryEvidenceError: class extends Error {},
    currentProductBuildAuthorityV2DeliveryEvidenceResponseV1: async () => { throw new Error("not used"); },
    productBuildAuthorityV2LoadedBuildStartupStateV1: () => {
      loadedStateReads += 1;
      return Object.freeze({
        status: "unavailable",
        code: "PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID",
      });
    },
  } });
  context.mock.module("http", { exports: { ...actualHttp,
    createServer: (...args) => {
      const server = actualHttp.createServer(...args);
      capturedServer = server;
      listenForTest = server.listen.bind(server);
      server.listen = () => { bootListenCalls += 1; return server; };
      return server;
    },
  } });

  await import(process.env.MC_INDEX_URL + "?auth-before-json");
  assert.equal(bootListenCalls, 1);
  assert(capturedServer);
  await new Promise((resolve, reject) => {
    capturedServer.once("error", reject);
    listenForTest(0, "127.0.0.1", resolve);
  });
  try {
    const address = capturedServer.address();
    if (address === null || typeof address === "string") throw new TypeError("expected TCP listener");
    if (process.env.MC_AUTH_MODE !== "available") {
      const unavailable = await rawRequest(address.port, "GET", canonicalPath, {
        "x-setfarm-operational-token": operationalToken,
      });
      assert.equal(unavailable.statusCode, 503);
      assert.deepEqual(unavailable.body, {
        status: "unavailable",
        code: "PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_AUTH_UNAVAILABLE",
      });
      assert.equal(authCalls, 0);
      assert.equal(loadedStateReads, 0);
      return;
    }

    for (const candidate of [
      { headers: {}, body: "" },
      { headers: { "x-mc-token": "private-test-token" }, body: "" },
      { headers: { "x-mc-token": "private-test-token", "x-setfarm-operational-token": "wrong-operational-token" }, body: "" },
      { path: canonicalPath + "?x-setfarm-operational-token=" + operationalToken, headers: {}, body: "" },
      {
        headers: { "content-type": "application/json", "content-length": String(JSON.stringify({ token: operationalToken }).length) },
        body: JSON.stringify({ token: operationalToken }),
      },
    ]) {
      const denied = await rawRequest(
        address.port,
        "GET",
        candidate.path ?? canonicalPath,
        candidate.headers,
        candidate.body,
      );
      assert.equal(denied.statusCode, 401);
      assert.deepEqual(denied.body, {
        status: "unavailable",
        code: "PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_UNAUTHORIZED",
      });
    }
    assert.equal(authCalls, 0);
    assert.equal(loadedStateReads, 0);

    const malformed = await rawRequest(address.port, "GET", canonicalPath, {
      "x-setfarm-operational-token": operationalToken,
      "content-type": "application/json",
      "content-length": "1",
    }, "{");
    assert.equal(malformed.statusCode, 400);
    assert.deepEqual(malformed.body, {
      status: "unavailable",
      code: "PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_REQUEST_INVALID",
    });
    assert.equal(authCalls, 0);
    assert.equal(loadedStateReads, 0);

    const unavailable = await rawRequest(address.port, "GET", canonicalPath, {
      "x-setfarm-operational-token": operationalToken,
    });
    assert.equal(unavailable.statusCode, 503);
    assert.deepEqual(unavailable.body, {
      status: "unavailable",
      code: "PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID",
    });
    assert.equal(authCalls, 0);
    assert.equal(loadedStateReads, 1);

    const head = await rawRequest(address.port, "HEAD", canonicalPath, {
      "x-setfarm-operational-token": operationalToken,
    });
    assert.equal(head.statusCode, 404);
    assert.equal(authCalls, 0);
    assert.equal(loadedStateReads, 1);

    for (const alias of [
      "/api/internal-production/Product-Build-Authority-V2-Loaded-Build",
      canonicalPath + "/",
      "/API/internal-production/product-build-authority-v2-loaded-build",
    ]) {
      const response = await rawRequest(address.port, "GET", alias, {
        "x-mc-token": "private-test-token",
        "x-setfarm-operational-token": operationalToken,
      });
      assert.equal(response.statusCode, 404);
    }
    assert.equal(authCalls, 3);
    assert.equal(loadedStateReads, 1);

    const otherApiDenied = await rawRequest(address.port, "GET", "/api/not-a-real-route");
    assert.equal(otherApiDenied.statusCode, 401);
    assert.deepEqual(otherApiDenied.body, { error: "Unauthorized" });
    const otherApiAuthenticated = await rawRequest(address.port, "GET", "/api/not-a-real-route", {
      "x-mc-token": "private-test-token",
    });
    assert.equal(otherApiAuthenticated.statusCode, 404);
    assert.equal(authCalls, 5);
    assert.equal(loadedStateReads, 1);
  } finally {
    capturedServer.closeAllConnections();
    await new Promise((resolve) => capturedServer.close(resolve));
  }
});
`;
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    MC_AUTH_MODE: mode,
    MC_AUTH_URL: new URL("../middleware/auth.ts", import.meta.url).href,
    MC_INDEX_URL: new URL("../index.ts", import.meta.url).href,
    MC_LIVE_FEED_URL: new URL("./live-feed.ts", import.meta.url).href,
    MC_SERVICE_URL: new URL("../services/product-build-authority-v2-delivery-evidence-v1.ts", import.meta.url).href,
  };
  if (mode === "missing") delete childEnv.SETFARM_OPERATIONAL_WRITE_TOKEN;
  else if (mode === "short") childEnv.SETFARM_OPERATIONAL_WRITE_TOKEN = "x".repeat(31);
  else childEnv.SETFARM_OPERATIONAL_WRITE_TOKEN = "operational-test-token-1234567890abcdef";
  delete childEnv.NODE_TEST_CONTEXT;

  return new Promise<Readonly<{ exitCode: number; stdout: string; stderr: string }>>((resolveResult, reject) => {
    const child = spawn(process.execPath, [
      "--experimental-test-module-mocks",
      "--import",
      "tsx",
      "--input-type=module",
      "--eval",
      fixture,
    ], {
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (exitCode) => resolveResult({ exitCode: exitCode ?? -1, stdout, stderr }));
  });
}

test("production startup uses exact endpoint operational auth before general auth and parsing", async () => {
  for (const mode of ["available", "missing", "short"] as const) {
    const result = await runProductionAuthFixture(mode);
    assert.equal(result.exitCode, 0, `${mode}: ${result.stdout}${result.stderr}`);
    assert.doesNotMatch(
      `${result.stdout}${result.stderr}`,
      /operational-test-token-1234567890abcdef|wrong-operational-token|private-test-token/,
    );
  }
});

test("internal-production routes preserve auth, delivery-rate, parser, and router order", async () => {
  const indexSource = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../index.ts", import.meta.url), "utf8"));
  const operationalAuthMount = indexSource.indexOf("app.use(productBuildAuthorityV2OperationalAuth);");
  const authMount = indexSource.indexOf("app.use('/api', productBuildAuthorityV2GeneralAuth);");
  const deliveryRateMount = indexSource.indexOf("app.use(productBuildAuthorityV2DeliveryEvidenceRateLimitExact);");
  const parserMount = indexSource.indexOf("app.use(jsonBodyParser);");
  const routerMount = indexSource.indexOf('app.use("/api", setfarmOperationalRouter);');
  assert.notEqual(operationalAuthMount, -1);
  assert.notEqual(authMount, -1);
  assert.notEqual(deliveryRateMount, -1);
  assert.notEqual(parserMount, -1);
  assert.notEqual(routerMount, -1);
  assert(operationalAuthMount < authMount);
  assert(authMount < deliveryRateMount);
  assert(deliveryRateMount < parserMount);
  assert(parserMount < routerMount);
});

async function runProductionDeliveryEndpointFixture(
  mode: "available" | "rate" | "missing" | "short",
): Promise<Readonly<{ exitCode: number; stdout: string; stderr: string }>> {
  const fixture = String.raw`
import assert from "node:assert/strict";
import * as actualHttp from "node:http";
import test from "node:test";

const canonicalPath = "/api/internal-production/product-build-authority-v2-delivery-evidence";
const operationalToken = "operational-test-token-1234567890abcdef";
let authCalls = 0;
let bootListenCalls = 0;
let evidenceReads = 0;
let loadedStateReads = 0;
let capturedServer;
let listenForTest;

function rawRequest(port, method, path, headers = {}, body = "") {
  return new Promise((resolve, reject) => {
    const request = actualHttp.request({ host: "127.0.0.1", port, method, path, headers }, (incoming) => {
      let text = "";
      incoming.setEncoding("utf8");
      incoming.on("data", (chunk) => { text += chunk; });
      incoming.once("error", reject);
      incoming.once("end", () => {
        let responseBody;
        try { responseBody = text === "" ? undefined : JSON.parse(text); }
        catch { responseBody = text; }
        resolve({ statusCode: incoming.statusCode ?? 0, headers: incoming.headers, body: responseBody });
      });
    });
    request.once("error", reject);
    request.end(body);
  });
}

test("delivery endpoint production boundary", async (context) => {
  context.mock.module(process.env.MC_AUTH_URL, { exports: {
    authMiddleware: (req, res, next) => {
      authCalls += 1;
      if (req.headers["x-mc-token"] !== "private-test-token") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      next();
    },
  } });
  context.mock.module(process.env.MC_LIVE_FEED_URL, { exports: {
    default: (_req, _res, next) => next(),
  } });
  context.mock.module(process.env.MC_SERVICE_URL, { exports: {
    ProductBuildAuthorityV2DeliveryEvidenceError: class extends Error {},
    currentProductBuildAuthorityV2DeliveryEvidenceResponseV1: () => {
      evidenceReads += 1;
      return Promise.resolve({ schema: "fixture", evidenceReads });
    },
    productBuildAuthorityV2LoadedBuildStartupStateV1: () => {
      loadedStateReads += 1;
      return Object.freeze({
        status: "unavailable",
        code: "PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID",
      });
    },
  } });
  context.mock.module("http", { exports: { ...actualHttp,
    createServer: (...args) => {
      const server = actualHttp.createServer(...args);
      capturedServer = server;
      listenForTest = server.listen.bind(server);
      server.listen = () => { bootListenCalls += 1; return server; };
      return server;
    },
  } });

  await import(process.env.MC_INDEX_URL + "?delivery-auth-rate-" + process.env.MC_AUTH_MODE);
  assert.equal(bootListenCalls, 1);
  assert(capturedServer);
  await new Promise((resolve, reject) => {
    capturedServer.once("error", reject);
    listenForTest(0, "127.0.0.1", resolve);
  });
  try {
    const address = capturedServer.address();
    if (address === null || typeof address === "string") throw new TypeError("expected TCP listener");
    const operationalHeaders = { "x-setfarm-operational-token": operationalToken };
    if (process.env.MC_AUTH_MODE === "missing" || process.env.MC_AUTH_MODE === "short") {
      const unavailable = await rawRequest(address.port, "GET", canonicalPath, operationalHeaders);
      assert.equal(unavailable.statusCode, 503);
      assert.deepEqual(unavailable.body, {
        status: "unavailable",
        code: "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_AUTH_UNAVAILABLE",
      });
      assert.equal(authCalls, 0);
      assert.equal(evidenceReads, 0);
      assert.equal(loadedStateReads, 0);
      return;
    }

    if (process.env.MC_AUTH_MODE === "rate") {
      const refusedQuery = await rawRequest(address.port, "GET", canonicalPath + "?ref=main", operationalHeaders);
      assert.equal(refusedQuery.statusCode, 400);
      assert.deepEqual(refusedQuery.body, {
        status: "unavailable",
        code: "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_REQUEST_INVALID",
      });
      assert.equal(evidenceReads, 0);
      for (let index = 0; index < 6; index += 1) {
        const accepted = await rawRequest(address.port, "GET", canonicalPath, operationalHeaders);
        assert.equal(accepted.statusCode, 200, "accepted " + index);
      }
      const limited = await rawRequest(address.port, "GET", canonicalPath, operationalHeaders);
      assert.equal(limited.statusCode, 429);
      assert.deepEqual(limited.body, {
        status: "unavailable",
        code: "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_RATE_LIMITED",
      });
      assert.match(String(limited.headers["retry-after"]), /^[1-9][0-9]*$/);
      assert.equal(evidenceReads, 6);
      assert.equal(authCalls, 0);
      assert.equal(loadedStateReads, 0);
      return;
    }

    for (const candidate of [
      { headers: {}, body: "" },
      { headers: { "x-mc-token": "private-test-token" }, body: "" },
      { headers: { "x-mc-token": "private-test-token", "x-setfarm-operational-token": "wrong-operational-token" }, body: "" },
      { path: canonicalPath + "?x-setfarm-operational-token=" + operationalToken, headers: {}, body: "" },
      {
        headers: { "content-type": "application/json", "content-length": String(JSON.stringify({ token: operationalToken }).length) },
        body: JSON.stringify({ token: operationalToken }),
      },
    ]) {
      const denied = await rawRequest(address.port, "GET", candidate.path ?? canonicalPath, candidate.headers, candidate.body);
      assert.equal(denied.statusCode, 401);
      assert.deepEqual(denied.body, {
        status: "unavailable",
        code: "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_UNAUTHORIZED",
      });
    }
    assert.equal(authCalls, 0);
    assert.equal(evidenceReads, 0);

    const malformed = await rawRequest(address.port, "GET", canonicalPath, {
      ...operationalHeaders,
      "content-type": "application/json",
      "content-length": "1",
    }, "{");
    assert.equal(malformed.statusCode, 400);
    assert.deepEqual(malformed.body, {
      status: "unavailable",
      code: "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_REQUEST_INVALID",
    });
    assert.equal(evidenceReads, 0);

    const query = await rawRequest(address.port, "GET", canonicalPath + "?ref=main", operationalHeaders);
    assert.equal(query.statusCode, 400);
    assert.deepEqual(query.body, {
      status: "unavailable",
      code: "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_REQUEST_INVALID",
    });
    assert.equal(evidenceReads, 0);

    const emptyQuery = await rawRequest(address.port, "GET", canonicalPath + "?", operationalHeaders);
    assert.equal(emptyQuery.statusCode, 400);
    assert.deepEqual(emptyQuery.body, {
      status: "unavailable",
      code: "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_REQUEST_INVALID",
    });
    assert.equal(evidenceReads, 0);

    const emptyFraming = await rawRequest(address.port, "GET", canonicalPath, {
      ...operationalHeaders,
      "content-length": "0",
    });
    assert.equal(emptyFraming.statusCode, 400);
    assert.deepEqual(emptyFraming.body, {
      status: "unavailable",
      code: "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_REQUEST_INVALID",
    });
    assert.equal(evidenceReads, 0);

    const head = await rawRequest(address.port, "HEAD", canonicalPath, operationalHeaders);
    assert.equal(head.statusCode, 404);
    assert.equal(evidenceReads, 0);

    const post = await rawRequest(address.port, "POST", canonicalPath, operationalHeaders);
    assert.equal(post.statusCode, 404);
    assert.equal(evidenceReads, 0);

    for (const alias of [
      "/api/internal-production/Product-Build-Authority-V2-Delivery-Evidence",
      canonicalPath + "/",
      "/API/internal-production/product-build-authority-v2-delivery-evidence",
      "/api/internal-production//product-build-authority-v2-delivery-evidence",
      "/api/internal-production/%70roduct-build-authority-v2-delivery-evidence",
    ]) {
      const response = await rawRequest(address.port, "GET", alias, {
        "x-mc-token": "private-test-token",
        ...operationalHeaders,
      });
      assert.equal(response.statusCode, 404, alias);
    }
    assert.equal(authCalls, 5);
    assert.equal(evidenceReads, 0);

    const accepted = await rawRequest(address.port, "GET", canonicalPath, operationalHeaders);
    assert.equal(accepted.statusCode, 200);
    assert.deepEqual(accepted.body, { schema: "fixture", evidenceReads: 1 });
    assert.equal(authCalls, 5);
    assert.equal(evidenceReads, 1);
    assert.equal(loadedStateReads, 0);
  } finally {
    capturedServer.closeAllConnections();
    await new Promise((resolve) => capturedServer.close(resolve));
  }
});
`;
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    MC_AUTH_MODE: mode,
    MC_AUTH_URL: new URL("../middleware/auth.ts", import.meta.url).href,
    MC_INDEX_URL: new URL("../index.ts", import.meta.url).href,
    MC_LIVE_FEED_URL: new URL("./live-feed.ts", import.meta.url).href,
    MC_SERVICE_URL: new URL("../services/product-build-authority-v2-delivery-evidence-v1.ts", import.meta.url).href,
  };
  if (mode === "missing") delete childEnv.SETFARM_OPERATIONAL_WRITE_TOKEN;
  else if (mode === "short") childEnv.SETFARM_OPERATIONAL_WRITE_TOKEN = "x".repeat(31);
  else childEnv.SETFARM_OPERATIONAL_WRITE_TOKEN = "operational-test-token-1234567890abcdef";
  delete childEnv.NODE_TEST_CONTEXT;

  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [
      "--experimental-test-module-mocks", "--import", "tsx", "--input-type=module", "--eval", fixture,
    ], { env: childEnv, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (exitCode) => resolveResult({ exitCode: exitCode ?? -1, stdout, stderr }));
  });
}

test("delivery-evidence uses exact operational auth, zero-read refusal, and a finite GET rate", async () => {
  for (const mode of ["available", "rate", "missing", "short"] as const) {
    const result = await runProductionDeliveryEndpointFixture(mode);
    assert.equal(result.exitCode, 0, `${mode}: ${result.stdout}${result.stderr}`);
    assert.doesNotMatch(
      `${result.stdout}${result.stderr}`,
      /operational-test-token-1234567890abcdef|wrong-operational-token|private-test-token/,
    );
  }
});
