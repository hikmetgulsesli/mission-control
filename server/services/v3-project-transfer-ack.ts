import { createHash } from "node:crypto";

import type { V3CanonicalProjectProjection } from "./v3-project-transfer.js";

const SHA256 = /^[a-f0-9]{64}$/;
const GIT_OBJECT = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;

export interface V3CanonicalProjectRecordIdentityV1 {
  schema: "mission-control.v3-canonical-project-record.v1";
  projection: V3CanonicalProjectProjection;
  projectionHash: string;
  persistedAt: string;
}

export interface V3ProjectTransferAckV1 {
  schema: "setfarm.v3-project-transfer-ack.v1";
  ackVersion: 1;
  runId: string;
  candidateId: string;
  candidateHash: string;
  packetHash: string;
  sourceRevision: { sha: string; treeHash: string };
  deploymentReceiptHash: string;
  deploymentReceiptRef: string;
  sourceSnapshotHash: string;
  projectId: string;
  projectProjection: V3CanonicalProjectProjection;
  projectionHash: string;
  projectRecordHash: string;
  projectRecordRef: string;
  persistedAt: string;
  projector: {
    service: "mission-control";
    protocol: "v3";
  };
  ackHash: string;
}

export type ExistingV3ProjectTransferAckMatch =
  | Readonly<{ status: "absent" }>
  | Readonly<{ status: "matched"; acknowledgement: V3ProjectTransferAckV1 }>
  | Readonly<{ status: "mismatch"; code: "V3_PROJECT_TRANSFER_EXISTING_ACK_MISMATCH" }>;

export type ExistingV3ProjectTransferAckProjectionMatch =
  | Readonly<{ status: "absent" }>
  | Readonly<{
      status: "matched";
      acknowledgement: V3ProjectTransferAckV1;
      rehydration: {
        persistedAt: string;
        projectionHash: string;
        projectRecordHash: string;
      };
    }>
  | Readonly<{ status: "mismatch"; code: "V3_PROJECT_TRANSFER_EXISTING_ACK_MISMATCH" }>;

export function canonicalJsonStringify(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("V3_PROJECT_TRANSFER_CANONICAL_NUMBER_INVALID");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJsonStringify).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJsonStringify(record[key])}`)
      .join(",")}}`;
  }
  throw new Error("V3_PROJECT_TRANSFER_CANONICAL_VALUE_UNSUPPORTED");
}

export function hashCanonicalJson(value: unknown): string {
  return createHash("sha256").update(canonicalJsonStringify(value), "utf8").digest("hex");
}

export function createV3CanonicalProjectRecordIdentity(input: Readonly<{
  projection: V3CanonicalProjectProjection;
  persistedAt: string;
}>): Readonly<{ identity: V3CanonicalProjectRecordIdentityV1; recordHash: string }> {
  if (!Number.isFinite(Date.parse(input.persistedAt))) {
    throw new Error("V3_PROJECT_TRANSFER_PERSISTED_AT_INVALID");
  }
  const projectionHash = hashCanonicalJson(input.projection);
  const identity: V3CanonicalProjectRecordIdentityV1 = {
    schema: "mission-control.v3-canonical-project-record.v1",
    projection: input.projection,
    projectionHash,
    persistedAt: new Date(input.persistedAt).toISOString(),
  };
  return Object.freeze({ identity, recordHash: hashCanonicalJson(identity) });
}

export function createV3ProjectTransferAckV1(input: Readonly<{
  projection: V3CanonicalProjectProjection;
  sourceSnapshotHash: string;
  projectRecord: Readonly<Record<string, unknown>>;
}>): V3ProjectTransferAckV1 {
  const persistedAt = String(input.projectRecord.canonicalProjectionPersistedAt || "");
  const projectionHash = String(input.projectRecord.canonicalProjectionHash || "");
  const projectRecordHash = String(input.projectRecord.canonicalProjectRecordHash || "");
  const expected = createV3CanonicalProjectRecordIdentity({
    projection: input.projection,
    persistedAt,
  });
  if (
    projectionHash !== expected.identity.projectionHash
    || projectRecordHash !== expected.recordHash
    || input.projectRecord.id !== input.projection.id
    || input.projectRecord.workflowRunId !== input.projection.workflowRunId
    || input.projectRecord.acceptedCandidateHash !== input.projection.acceptedCandidateHash
    || input.projectRecord.deploymentReceiptHash !== input.projection.deploymentReceiptHash
  ) {
    throw new Error("V3_PROJECT_TRANSFER_PERSISTED_RECORD_MISMATCH");
  }
  if (!SHA256.test(input.sourceSnapshotHash)) {
    throw new Error("V3_PROJECT_TRANSFER_SNAPSHOT_HASH_INVALID");
  }
  if (
    !SHA256.test(input.projection.acceptedCandidateHash)
    || !SHA256.test(input.projection.acceptedPacketHash)
    || !SHA256.test(input.projection.deploymentReceiptHash)
    || !GIT_OBJECT.test(input.projection.acceptedSourceSha)
    || !GIT_OBJECT.test(input.projection.acceptedSourceTreeHash)
  ) {
    throw new Error("V3_PROJECT_TRANSFER_AUTHORITY_HASH_INVALID");
  }
  const payload = {
    schema: "setfarm.v3-project-transfer-ack.v1" as const,
    ackVersion: 1 as const,
    runId: input.projection.workflowRunId,
    candidateId: input.projection.acceptedCandidateId,
    candidateHash: input.projection.acceptedCandidateHash,
    packetHash: input.projection.acceptedPacketHash,
    sourceRevision: {
      sha: input.projection.acceptedSourceSha,
      treeHash: input.projection.acceptedSourceTreeHash,
    },
    deploymentReceiptHash: input.projection.deploymentReceiptHash,
    deploymentReceiptRef: input.projection.deploymentReceiptRef,
    sourceSnapshotHash: input.sourceSnapshotHash,
    projectId: input.projection.id,
    projectProjection: input.projection,
    projectionHash,
    projectRecordHash,
    projectRecordRef: `mission-control://projects/${input.projection.id}/${projectRecordHash}`,
    persistedAt: expected.identity.persistedAt,
    projector: {
      service: "mission-control" as const,
      protocol: "v3" as const,
    },
  };
  return Object.freeze({ ...payload, ackHash: hashCanonicalJson(payload) });
}

/**
 * Validate an immutable Setfarm ACK before any Projects mutation. The ACK
 * carries the full projection, persisted instant, and record hash, so a lost
 * registry row can be reconstructed byte-for-byte only after this proof
 * matches the current canonical receipt projection.
 */
export function matchExistingV3ProjectTransferAckProjection(input: Readonly<{
  acknowledgement: V3ProjectTransferAckV1 | null | undefined;
  projection: V3CanonicalProjectProjection;
}>): ExistingV3ProjectTransferAckProjectionMatch {
  const acknowledgement = input.acknowledgement;
  if (!acknowledgement) return { status: "absent" };
  try {
    const expected = createV3CanonicalProjectRecordIdentity({
      projection: input.projection,
      persistedAt: acknowledgement.persistedAt,
    });
    const { ackHash, ...payload } = acknowledgement;
    const matches =
      acknowledgement.schema === "setfarm.v3-project-transfer-ack.v1"
      && acknowledgement.ackVersion === 1
      && SHA256.test(ackHash)
      && ackHash === hashCanonicalJson(payload)
      && SHA256.test(acknowledgement.sourceSnapshotHash)
      && SHA256.test(acknowledgement.candidateHash)
      && SHA256.test(acknowledgement.packetHash)
      && SHA256.test(acknowledgement.deploymentReceiptHash)
      && GIT_OBJECT.test(acknowledgement.sourceRevision.sha)
      && GIT_OBJECT.test(acknowledgement.sourceRevision.treeHash)
      && acknowledgement.runId === input.projection.workflowRunId
      && acknowledgement.candidateId === input.projection.acceptedCandidateId
      && acknowledgement.candidateHash === input.projection.acceptedCandidateHash
      && acknowledgement.packetHash === input.projection.acceptedPacketHash
      && acknowledgement.sourceRevision.sha === input.projection.acceptedSourceSha
      && acknowledgement.sourceRevision.treeHash === input.projection.acceptedSourceTreeHash
      && acknowledgement.deploymentReceiptHash === input.projection.deploymentReceiptHash
      && acknowledgement.deploymentReceiptRef === input.projection.deploymentReceiptRef
      && acknowledgement.projectId === input.projection.id
      && hashCanonicalJson(acknowledgement.projectProjection) === hashCanonicalJson(input.projection)
      && acknowledgement.projectionHash === expected.identity.projectionHash
      && acknowledgement.projectRecordHash === expected.recordHash
      && acknowledgement.projectRecordRef === `mission-control://projects/${input.projection.id}/${expected.recordHash}`
      && acknowledgement.persistedAt === expected.identity.persistedAt
      && acknowledgement.projector.service === "mission-control"
      && acknowledgement.projector.protocol === "v3";
    return matches
      ? {
          status: "matched",
          acknowledgement,
          rehydration: {
            persistedAt: expected.identity.persistedAt,
            projectionHash: expected.identity.projectionHash,
            projectRecordHash: expected.recordHash,
          },
        }
      : { status: "mismatch", code: "V3_PROJECT_TRANSFER_EXISTING_ACK_MISMATCH" };
  } catch {
    return { status: "mismatch", code: "V3_PROJECT_TRANSFER_EXISTING_ACK_MISMATCH" };
  }
}

/**
 * A post-ACK operational snapshot has a different snapshot hash from the
 * pre-ACK source snapshot. Replay must therefore reuse the immutable ACK that
 * Setfarm already exposes, never derive a second acknowledgement from the new
 * snapshot hash.
 */
export function matchExistingV3ProjectTransferAck(input: Readonly<{
  acknowledgement: V3ProjectTransferAckV1 | null | undefined;
  projection: V3CanonicalProjectProjection;
  projectRecord: Readonly<Record<string, unknown>>;
}>): ExistingV3ProjectTransferAckMatch {
  const projectionMatch = matchExistingV3ProjectTransferAckProjection(input);
  if (projectionMatch.status !== "matched") return projectionMatch;
  const acknowledgement = projectionMatch.acknowledgement;
  try {
    const persistedAt = String(input.projectRecord.canonicalProjectionPersistedAt || "");
    const expected = createV3CanonicalProjectRecordIdentity({
      projection: input.projection,
      persistedAt,
    });
    const matches =
      acknowledgement.projectionHash === expected.identity.projectionHash
      && acknowledgement.projectRecordHash === expected.recordHash
      && acknowledgement.persistedAt === expected.identity.persistedAt
      && input.projectRecord.id === input.projection.id
      && input.projectRecord.workflowRunId === input.projection.workflowRunId
      && input.projectRecord.acceptedCandidateHash === input.projection.acceptedCandidateHash
      && input.projectRecord.deploymentReceiptHash === input.projection.deploymentReceiptHash
      && input.projectRecord.canonicalProjectionHash === expected.identity.projectionHash
      && input.projectRecord.canonicalProjectRecordHash === expected.recordHash;
    return matches
      ? { status: "matched", acknowledgement }
      : { status: "mismatch", code: "V3_PROJECT_TRANSFER_EXISTING_ACK_MISMATCH" };
  } catch {
    return { status: "mismatch", code: "V3_PROJECT_TRANSFER_EXISTING_ACK_MISMATCH" };
  }
}
