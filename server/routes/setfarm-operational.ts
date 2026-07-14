import { Router } from "express";
import {
  setfarmOperationalSnapshotClient,
  type OperationalSnapshotFetchResult,
  type RunOperationalSnapshotV1,
} from "../services/setfarm-operational-snapshot.js";

export type OperationalSnapshotHttpResult =
  | { statusCode: 200; body: RunOperationalSnapshotV1 }
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

export default router;
