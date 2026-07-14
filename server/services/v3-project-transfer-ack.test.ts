import assert from "node:assert/strict";
import test from "node:test";

import {
  createV3CanonicalProjectRecordIdentity,
  createV3ProjectTransferAckV1,
  hashCanonicalJson,
  matchExistingV3ProjectTransferAck,
} from "./v3-project-transfer-ack.js";
import type { V3CanonicalProjectProjection } from "./v3-project-transfer.js";

const projection: V3CanonicalProjectProjection = {
  id: "ledger-app",
  name: "Ledger App",
  description: "Canonical ledger",
  type: "web",
  ports: { frontend: 4123 },
  deployUrl: "http://127.0.0.1:4123/",
  service: "process:44123",
  serviceStatus: "active",
  status: "active",
  stack: ["vite-react-web-app"],
  createdBy: "setfarm-v3-terminal-projector",
  productCompilerProtocol: "v3",
  workflowRunId: "run-1",
  setfarmRunIds: ["run-1"],
  runNumber: 2025,
  acceptedCandidateId: `ACPT_${"1".repeat(64)}`,
  acceptedCandidateHash: "1".repeat(64),
  acceptedPacketHash: "2".repeat(64),
  acceptedSourceSha: "3".repeat(40),
  acceptedSourceTreeHash: "4".repeat(40),
  deploymentReceiptHash: "5".repeat(64),
  deploymentReceiptRef: `setfarm://v3-deploy-receipts/${"5".repeat(64)}`,
  deploymentHealthRef: "setfarm://health/run-1",
  deploymentHealthUrl: "http://127.0.0.1:4123/health",
  deployedAt: "2026-07-13T12:00:00.000Z",
  completedAt: "2026-07-13T12:00:00.000Z",
};

test("project transfer acknowledgement binds exact immutable projection and persisted record", () => {
  const record = createV3CanonicalProjectRecordIdentity({
    projection,
    persistedAt: "2026-07-13T12:01:00.000Z",
  });
  const projectRecord = {
    ...projection,
    canonicalProjectionHash: record.identity.projectionHash,
    canonicalProjectionPersistedAt: record.identity.persistedAt,
    canonicalProjectRecordHash: record.recordHash,
  };
  const ack = createV3ProjectTransferAckV1({
    projection,
    sourceSnapshotHash: "6".repeat(64),
    projectRecord,
  });
  const { ackHash, ...payload } = ack;
  assert.equal(ackHash, hashCanonicalJson(payload));
  assert.equal(ack.projectionHash, hashCanonicalJson(projection));
  assert.equal(ack.projectRecordHash, record.recordHash);
  assert.equal(
    ack.projectRecordRef,
    `mission-control://projects/ledger-app/${record.recordHash}`,
  );

  const replay = createV3ProjectTransferAckV1({
    projection,
    sourceSnapshotHash: "6".repeat(64),
    projectRecord,
  });
  assert.deepEqual(replay, ack);
});

test("project transfer acknowledgement fails closed on persisted-record or snapshot drift", () => {
  const record = createV3CanonicalProjectRecordIdentity({
    projection,
    persistedAt: "2026-07-13T12:01:00.000Z",
  });
  const projectRecord = {
    ...projection,
    canonicalProjectionHash: record.identity.projectionHash,
    canonicalProjectionPersistedAt: record.identity.persistedAt,
    canonicalProjectRecordHash: record.recordHash,
  };
  assert.throws(() => createV3ProjectTransferAckV1({
    projection,
    sourceSnapshotHash: "short",
    projectRecord,
  }), /V3_PROJECT_TRANSFER_SNAPSHOT_HASH_INVALID/);
  assert.throws(() => createV3ProjectTransferAckV1({
    projection,
    sourceSnapshotHash: "6".repeat(64),
    projectRecord: { ...projectRecord, canonicalProjectRecordHash: "0".repeat(64) },
  }), /V3_PROJECT_TRANSFER_PERSISTED_RECORD_MISMATCH/);
  assert.throws(() => createV3ProjectTransferAckV1({
    projection: { ...projection, ports: { frontend: 4999 } },
    sourceSnapshotHash: "6".repeat(64),
    projectRecord,
  }), /V3_PROJECT_TRANSFER_PERSISTED_RECORD_MISMATCH/);
});

test("existing acknowledgement replay requires the exact persisted projection identity", () => {
  const record = createV3CanonicalProjectRecordIdentity({
    projection,
    persistedAt: "2026-07-13T12:01:00.000Z",
  });
  const projectRecord = {
    ...projection,
    canonicalProjectionHash: record.identity.projectionHash,
    canonicalProjectionPersistedAt: record.identity.persistedAt,
    canonicalProjectRecordHash: record.recordHash,
  };
  const acknowledgement = createV3ProjectTransferAckV1({
    projection,
    sourceSnapshotHash: "6".repeat(64),
    projectRecord,
  });
  assert.equal(matchExistingV3ProjectTransferAck({
    acknowledgement,
    projection,
    projectRecord,
  }).status, "matched");
  assert.deepEqual(matchExistingV3ProjectTransferAck({
    acknowledgement,
    projection: { ...projection, deploymentHealthUrl: "http://127.0.0.1:4999/health" },
    projectRecord,
  }), {
    status: "mismatch",
    code: "V3_PROJECT_TRANSFER_EXISTING_ACK_MISMATCH",
  });

  const { ackHash: _ackHash, ...payload } = acknowledgement;
  const wrongSchema = {
    ...payload,
    schema: "setfarm.v3-project-transfer-ack.v0",
  } as any;
  wrongSchema.ackHash = hashCanonicalJson(wrongSchema);
  assert.deepEqual(matchExistingV3ProjectTransferAck({
    acknowledgement: wrongSchema,
    projection,
    projectRecord,
  }), {
    status: "mismatch",
    code: "V3_PROJECT_TRANSFER_EXISTING_ACK_MISMATCH",
  });
});
