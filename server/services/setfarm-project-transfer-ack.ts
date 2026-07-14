import { config } from "../config.js";
import {
  createV3ProjectTransferAckV1,
  type V3ProjectTransferAckV1,
} from "./v3-project-transfer-ack.js";
import type { V3CanonicalProjectProjection } from "./v3-project-transfer.js";

export type SetfarmProjectTransferAckResult =
  | Readonly<{ status: "acknowledged"; acknowledgement: V3ProjectTransferAckV1 }>
  | Readonly<{
      status: "unavailable" | "rejected";
      code: string;
      upstreamStatus?: number;
    }>;

type FetchLike = typeof fetch;

export class SetfarmProjectTransferAckClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(input: Readonly<{
    baseUrl?: string;
    token?: string;
    fetchImpl?: FetchLike;
    timeoutMs?: number;
  }> = {}) {
    this.baseUrl = (input.baseUrl ?? config.setfarmUrl).replace(/\/+$/, "");
    this.token = input.token ?? config.setfarmOperationalWriteToken;
    this.fetchImpl = input.fetchImpl ?? fetch;
    this.timeoutMs = input.timeoutMs ?? 10_000;
  }

  async publish(input: Readonly<{
    projection: V3CanonicalProjectProjection;
    sourceSnapshotHash: string;
    projectRecord: Readonly<Record<string, unknown>>;
  }>): Promise<SetfarmProjectTransferAckResult> {
    if (this.token.length < 32) {
      return { status: "unavailable", code: "V3_PROJECT_TRANSFER_WRITE_AUTHORITY_UNAVAILABLE" };
    }
    let acknowledgement: V3ProjectTransferAckV1;
    try {
      acknowledgement = createV3ProjectTransferAckV1(input);
    } catch {
      return { status: "rejected", code: "V3_PROJECT_TRANSFER_ACK_BUILD_REJECTED" };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(
        `${this.baseUrl}/api/runs/${encodeURIComponent(acknowledgement.runId)}/project-transfer-ack`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-setfarm-operational-token": this.token,
          },
          body: JSON.stringify(acknowledgement),
          signal: controller.signal,
        },
      );
      let payload: any;
      try { payload = await response.json(); } catch { payload = null; }
      if (!response.ok) {
        return {
          status: "rejected",
          code: typeof payload?.error === "string"
            ? payload.error
            : "V3_PROJECT_TRANSFER_ACK_UPSTREAM_REJECTED",
          upstreamStatus: response.status,
        };
      }
      if (
        payload?.schema !== "setfarm.v3-project-transfer-ack-result.v1"
        || !["committed", "existing"].includes(payload?.status)
        || payload?.acknowledgement?.ackHash !== acknowledgement.ackHash
        || payload?.acknowledgement?.projectRecordHash !== acknowledgement.projectRecordHash
      ) {
        return {
          status: "rejected",
          code: "V3_PROJECT_TRANSFER_ACK_RESPONSE_MISMATCH",
          upstreamStatus: response.status,
        };
      }
      return { status: "acknowledged", acknowledgement };
    } catch {
      return { status: "unavailable", code: "V3_PROJECT_TRANSFER_ACK_UPSTREAM_UNAVAILABLE" };
    } finally {
      clearTimeout(timer);
    }
  }
}

export const setfarmProjectTransferAckClient = new SetfarmProjectTransferAckClient();
