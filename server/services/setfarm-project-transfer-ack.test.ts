import assert from "node:assert/strict";
import test from "node:test";

import { SetfarmProjectTransferAckClient } from "./setfarm-project-transfer-ack.js";
import {
  createV3CanonicalProjectRecordIdentity,
  createV3ProjectTransferAckV1,
} from "./v3-project-transfer-ack.js";
import type { V3CanonicalProjectProjection } from "./v3-project-transfer.js";

const projection: V3CanonicalProjectProjection = {
  id: "ack-client",
  name: "Ack Client",
  description: "Canonical ack client",
  type: "web",
  ports: { frontend: 4123 },
  deployUrl: "http://127.0.0.1:4123/",
  service: "process:44123",
  serviceStatus: "active",
  status: "active",
  stack: ["vite-react-web-app"],
  createdBy: "setfarm-v3-terminal-projector",
  productCompilerProtocol: "v3",
  workflowRunId: "run-ack",
  setfarmRunIds: ["run-ack"],
  acceptedCandidateId: `ACPT_${"1".repeat(64)}`,
  acceptedCandidateHash: "1".repeat(64),
  acceptedPacketHash: "2".repeat(64),
  acceptedSourceSha: "3".repeat(40),
  acceptedSourceTreeHash: "4".repeat(40),
  deploymentReceiptHash: "5".repeat(64),
  deploymentReceiptRef: `setfarm://v3-deploy-receipts/${"5".repeat(64)}`,
  deploymentHealthRef: "setfarm://health/run-ack",
  deploymentHealthUrl: "http://127.0.0.1:4123/health",
  deployedAt: "2026-07-13T12:00:00.000Z",
  completedAt: "2026-07-13T12:00:00.000Z",
};

function input() {
  const record = createV3CanonicalProjectRecordIdentity({
    projection,
    persistedAt: "2026-07-13T12:01:00.000Z",
  });
  return {
    projection,
    sourceSnapshotHash: "6".repeat(64),
    projectRecord: {
      ...projection,
      canonicalProjectionHash: record.identity.projectionHash,
      canonicalProjectionPersistedAt: record.identity.persistedAt,
      canonicalProjectRecordHash: record.recordHash,
    },
  };
}

test("ack client fails closed before network when write authority is unavailable", async () => {
  let calls = 0;
  const client = new SetfarmProjectTransferAckClient({
    token: "short",
    fetchImpl: (async () => { calls += 1; throw new Error("unexpected"); }) as typeof fetch,
  });
  assert.deepEqual(await client.publish(input()), {
    status: "unavailable",
    code: "V3_PROJECT_TRANSFER_WRITE_AUTHORITY_UNAVAILABLE",
  });
  assert.equal(calls, 0);
});

test("ack client publishes exact hash-bound payload and accepts only the matching receipt", async () => {
  const token = "t".repeat(48);
  let observedUrl = "";
  let observedToken = "";
  const client = new SetfarmProjectTransferAckClient({
    baseUrl: "http://127.0.0.1:3333/",
    token,
    fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
      observedUrl = String(url);
      observedToken = String((init?.headers as Record<string, string>)["x-setfarm-operational-token"]);
      const acknowledgement = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        schema: "setfarm.v3-project-transfer-ack-result.v1",
        status: "committed",
        acknowledgement,
      }), { status: 201, headers: { "content-type": "application/json" } });
    }) as typeof fetch,
  });
  const result = await client.publish(input());
  assert.equal(result.status, "acknowledged");
  assert.equal(observedUrl, "http://127.0.0.1:3333/api/runs/run-ack/project-transfer-ack");
  assert.equal(observedToken, token);
  if (result.status === "acknowledged") {
    assert.deepEqual(result.acknowledgement, createV3ProjectTransferAckV1(input()));
  }
});

test("ack client rejects an upstream response for another record", async () => {
  const client = new SetfarmProjectTransferAckClient({
    token: "t".repeat(48),
    fetchImpl: (async (_url: string | URL | Request, init?: RequestInit) => {
      const acknowledgement = JSON.parse(String(init?.body));
      acknowledgement.projectRecordHash = "0".repeat(64);
      return new Response(JSON.stringify({
        schema: "setfarm.v3-project-transfer-ack-result.v1",
        status: "existing",
        acknowledgement,
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch,
  });
  assert.deepEqual(await client.publish(input()), {
    status: "rejected",
    code: "V3_PROJECT_TRANSFER_ACK_RESPONSE_MISMATCH",
    upstreamStatus: 200,
  });
});
