import { Router } from "express";
import {
  setfarmOperationalSnapshotClient,
  type OperationalSnapshotFetchResult,
  type RunOperationalSnapshot,
} from "../services/setfarm-operational-snapshot.js";
import {
  setfarmProductBuildAuthorityClient,
  type ProductBuildAuthorityFetchResult,
  type ProductBuildAuthorityV1,
} from "../services/setfarm-product-build-authority.js";

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
  | { statusCode: 200; body: ProductBuildAuthorityV1 }
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
    case "unavailable":
      return {
        statusCode: result.reason === "not_found" ? 404 : result.reason === "not_ready" ? 409 : 503,
        body: {
          status: "unavailable",
          code: result.reason === "not_found"
            ? "SETFARM_PRODUCT_BUILD_AUTHORITY_NOT_FOUND"
            : result.reason === "not_ready"
              ? "SETFARM_PRODUCT_BUILD_AUTHORITY_NOT_READY"
              : "SETFARM_PRODUCT_BUILD_AUTHORITY_UNAVAILABLE",
          reason: result.reason,
          ...(result.upstreamStatus === undefined ? {} : { upstreamStatus: result.upstreamStatus }),
          ...(result.upstreamCode === undefined ? {} : { upstreamCode: result.upstreamCode }),
        },
      };
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

router.get("/setfarm/runs/:id/operational-snapshot", async (req, res) => {
  res.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");

  try {
    const response = toOperationalSnapshotHttpResult(await setfarmOperationalSnapshotClient.get(req.params.id));
    res.status(response.statusCode).json(response.body);
  } catch {
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
  } catch {
    res.status(503).json({
      status: "unavailable",
      code: "SETFARM_PRODUCT_BUILD_AUTHORITY_UNAVAILABLE",
      reason: "network",
    });
  }
});

export default router;
