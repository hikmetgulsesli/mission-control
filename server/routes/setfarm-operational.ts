import { Router } from "express";
import {
  setfarmOperationalSnapshotClient,
  type OperationalSnapshotFetchResult,
  type RunOperationalSnapshot,
} from "../services/setfarm-operational-snapshot.js";
import {
  setfarmProductBuildAuthorityClient,
  type ProductBuildAuthority,
  type ProductBuildAuthorityFetchResult,
} from "../services/setfarm-product-build-authority.js";
import {
  ProductBuildAuthorityV2DeliveryEvidenceError,
  currentProductBuildAuthorityV2DeliveryEvidenceResponseV1,
  productBuildAuthorityV2LoadedBuildStartupStateV1,
} from "../services/product-build-authority-v2-delivery-evidence-v1.js";

export type OperationalSnapshotHttpResult =
  | { statusCode: 200; body: RunOperationalSnapshot }
  | {
      statusCode: 404 | 501 | 502 | 503;
      body: {
        status: "unavailable" | "upstream_error" | "unsupported_schema";
        code: string;
        reason?: string;
        upstreamStatus?: number;
        schema?: string | null;
      };
    };

export function toOperationalSnapshotHttpResult(result: OperationalSnapshotFetchResult): OperationalSnapshotHttpResult {
  switch (result.status) {
    case "ok":
      return { statusCode: 200, body: result.snapshot };
    case "unavailable":
      return {
        statusCode: result.reason === "not_found" ? 404 : 503,
        body: {
          status: "unavailable",
          code: result.reason === "not_found" ? "SETFARM_OPERATIONAL_SNAPSHOT_NOT_FOUND" : "SETFARM_OPERATIONAL_SNAPSHOT_UNAVAILABLE",
          reason: result.reason,
          ...(result.upstreamStatus === undefined ? {} : { upstreamStatus: result.upstreamStatus }),
        },
      };
    case "upstream_error":
      return {
        statusCode: 502,
        body: {
          status: "upstream_error",
          code: "SETFARM_OPERATIONAL_SNAPSHOT_UPSTREAM_ERROR",
          reason: result.reason,
          ...(result.upstreamStatus === undefined ? {} : { upstreamStatus: result.upstreamStatus }),
        },
      };
    case "unsupported_schema":
      return {
        statusCode: 501,
        body: {
          status: "unsupported_schema",
          code: "SETFARM_OPERATIONAL_SNAPSHOT_UNSUPPORTED_SCHEMA",
          schema: result.schema,
        },
      };
  }
}

export type ProductBuildAuthorityHttpResult =
  | { statusCode: 200; body: ProductBuildAuthority }
  | {
      statusCode: 404 | 409 | 501 | 502 | 503;
      body: {
        status: "unavailable" | "upstream_error" | "unsupported_schema";
        code: string;
        reason?: string;
        upstreamStatus?: number;
        upstreamCode?: string;
        schema?: string | null;
      };
    };

export function toProductBuildAuthorityHttpResult(result: ProductBuildAuthorityFetchResult): ProductBuildAuthorityHttpResult {
  switch (result.status) {
    case "ok":
      return { statusCode: 200, body: result.authority };
    case "unavailable": {
      let statusCode: 404 | 409 | 503;
      let code: string;
      switch (result.reason) {
        case "not_found":
          statusCode = 404;
          code = "SETFARM_PRODUCT_BUILD_AUTHORITY_NOT_FOUND";
          break;
        case "not_ready":
          statusCode = 409;
          code = "SETFARM_PRODUCT_BUILD_AUTHORITY_NOT_READY";
          break;
        default:
          statusCode = 503;
          code = "SETFARM_PRODUCT_BUILD_AUTHORITY_UNAVAILABLE";
      }
      return {
        statusCode,
        body: {
          status: "unavailable",
          code,
          reason: result.reason,
          ...(result.upstreamStatus === undefined ? {} : { upstreamStatus: result.upstreamStatus }),
          ...(result.upstreamCode === undefined ? {} : { upstreamCode: result.upstreamCode }),
        },
      };
    }
    case "upstream_error":
      return {
        statusCode: 502,
        body: {
          status: "upstream_error",
          code: "SETFARM_PRODUCT_BUILD_AUTHORITY_UPSTREAM_ERROR",
          reason: result.reason,
          ...(result.upstreamStatus === undefined ? {} : { upstreamStatus: result.upstreamStatus }),
          ...(result.upstreamCode === undefined ? {} : { upstreamCode: result.upstreamCode }),
        },
      };
    case "unsupported_schema":
      return {
        statusCode: 501,
        body: {
          status: "unsupported_schema",
          code: "SETFARM_PRODUCT_BUILD_AUTHORITY_UNSUPPORTED_SCHEMA",
          schema: result.schema,
        },
      };
  }
}

const router = Router();
const PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_PATH =
  "/internal-production/product-build-authority-v2-loaded-build" as const;
const PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_FULL_PATH =
  `/api${PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_PATH}` as const;

router.get("/setfarm/runs/:id/operational-snapshot", async (req, res) => {
  res.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");

  try {
    const response = toOperationalSnapshotHttpResult(await setfarmOperationalSnapshotClient.get(req.params.id));
    res.status(response.statusCode).json(response.body);
  } catch (error) {
    console.error("[setfarm-operational-snapshot] unexpected route failure:", error instanceof Error ? error.message : error);
    res.status(503).json({
      status: "unavailable",
      code: "SETFARM_OPERATIONAL_SNAPSHOT_UNAVAILABLE",
      reason: "network",
    });
  }
});

router.get("/setfarm/runs/:id/product-build-authority", async (req, res) => {
  res.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");

  try {
    const response = toProductBuildAuthorityHttpResult(await setfarmProductBuildAuthorityClient.get(req.params.id));
    res.status(response.statusCode).json(response.body);
  } catch (error) {
    console.error("[setfarm-product-build-authority] unexpected route failure:", error instanceof Error ? error.message : error);
    res.status(503).json({
      status: "unavailable",
      code: "SETFARM_PRODUCT_BUILD_AUTHORITY_UNAVAILABLE",
      reason: "network",
    });
  }
});

router.get("/internal-production/product-build-authority-v2-delivery-evidence", async (req, res) => {
  res.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  if (Object.keys(req.query).length !== 0
    || req.headers["content-length"] !== undefined
    || req.headers["transfer-encoding"] !== undefined
    || req.body !== undefined) {
    res.status(400).json({
      status: "unavailable",
      code: "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_REQUEST_INVALID",
    });
    return;
  }
  try {
    res.status(200).json(await currentProductBuildAuthorityV2DeliveryEvidenceResponseV1());
  } catch (error) {
    const code = error instanceof ProductBuildAuthorityV2DeliveryEvidenceError
      ? error.code
      : "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_UNAVAILABLE";
    res.status(503).json({ status: "unavailable", code });
  }
});

router.get(PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_PATH, (req, res, next) => {
  const queryOffset = req.originalUrl.indexOf("?");
  const rawPathname = queryOffset === -1 ? req.originalUrl : req.originalUrl.slice(0, queryOffset);
  if (req.method !== "GET" || rawPathname !== PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_FULL_PATH) {
    next();
    return;
  }
  res.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  if (Object.keys(req.query).length !== 0
    || req.headers["content-length"] !== undefined
    || req.headers["transfer-encoding"] !== undefined
    || req.body !== undefined) {
    res.status(400).json({
      status: "unavailable",
      code: "PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_REQUEST_INVALID",
    });
    return;
  }
  const startupState = productBuildAuthorityV2LoadedBuildStartupStateV1();
  if (startupState.status === "unavailable") {
    res.status(503).json({ status: "unavailable", code: startupState.code });
    return;
  }
  res.status(200).json(startupState.response);
});

export default router;
