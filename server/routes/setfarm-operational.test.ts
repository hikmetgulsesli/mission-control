import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
