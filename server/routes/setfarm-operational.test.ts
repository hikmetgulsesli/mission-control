import assert from "node:assert/strict";
import test from "node:test";

import { toProductBuildAuthorityHttpResult } from "./setfarm-operational.js";

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
