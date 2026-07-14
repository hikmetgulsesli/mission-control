import type {
  OperationalSnapshotFetchResult,
} from "./setfarm-operational-snapshot.js";
import type {
  SetfarmProjectTransferAckResult,
} from "./setfarm-project-transfer-ack.js";
import {
  matchExistingV3ProjectTransferAck,
  matchExistingV3ProjectTransferAckProjection,
  type V3ProjectTransferAckV1,
} from "./v3-project-transfer-ack.js";
import {
  buildV3CanonicalProjectProjection,
  evaluateV3ProjectTransfer,
  type V3CanonicalProjectPersistenceResult,
  type V3CanonicalProjectProjection,
  type V3CanonicalProjectRehydrationAuthority,
} from "./v3-project-transfer.js";

export type V3ProjectTransferCoordinationResult =
  | Readonly<{
      status: "synchronized";
      acknowledgementMode: "published" | "existing";
      acknowledgement: V3ProjectTransferAckV1;
      projection: V3CanonicalProjectProjection;
      persistence: V3CanonicalProjectPersistenceResult;
    }>
  | Readonly<{ status: "skipped"; code: string }>;

/**
 * One exact v3 transfer coordinator shared by periodic and manual sync paths.
 * It treats Setfarm's already-bound acknowledgement as immutable replay
 * authority and therefore never sends a post-ACK snapshot back as a new ACK.
 */
export async function coordinateV3ProjectTransfer(input: Readonly<{
  run: Readonly<{ id: string; status: string; protocol: string; runNumber?: number }>;
  snapshotReader: Readonly<{ get(runId: string): Promise<OperationalSnapshotFetchResult> }>;
  acknowledgementPublisher: Readonly<{
    publish(input: Readonly<{
      projection: V3CanonicalProjectProjection;
      sourceSnapshotHash: string;
      projectRecord: Readonly<Record<string, unknown>>;
    }>): Promise<SetfarmProjectTransferAckResult>;
  }>;
  persist(
    projection: V3CanonicalProjectProjection,
    rehydration?: V3CanonicalProjectRehydrationAuthority,
  ): V3CanonicalProjectPersistenceResult;
}>): Promise<V3ProjectTransferCoordinationResult> {
  const snapshotResult = await input.snapshotReader.get(input.run.id);
  const authority = evaluateV3ProjectTransfer({ run: input.run, snapshotResult });
  if (authority.status !== "authorized") {
    return {
      status: "skipped",
      code: authority.status === "blocked" ? authority.code : "V3_PROJECT_TRANSFER_AUTHORITY_UNAVAILABLE",
    };
  }
  if (snapshotResult.status !== "ok") {
    return { status: "skipped", code: "V3_PROJECT_TRANSFER_SNAPSHOT_UNAVAILABLE" };
  }
  const projection = buildV3CanonicalProjectProjection({
    authority,
    ...(input.run.runNumber ? { runNumber: input.run.runNumber } : {}),
  });

  // Disaster replay is decided before any registry write. A malformed or
  // projection-mismatched ACK quarantines the run with zero local mutation.
  const existingProjection = matchExistingV3ProjectTransferAckProjection({
    acknowledgement: snapshotResult.snapshot.projectTransferAck?.acknowledgement,
    projection,
  });
  if (existingProjection.status === "mismatch") {
    return { status: "skipped", code: existingProjection.code };
  }
  if (existingProjection.status === "matched") {
    const persistence = input.persist(projection, {
      mode: "rehydrate_existing_ack",
      ...existingProjection.rehydration,
    });
    if (persistence.status === "conflict" || persistence.status === "deleted") {
      return { status: "skipped", code: `V3_PROJECT_TRANSFER_PROJECT_${persistence.status.toUpperCase()}` };
    }
    const readbackMatch = matchExistingV3ProjectTransferAck({
      acknowledgement: existingProjection.acknowledgement,
      projection,
      projectRecord: persistence.project as Record<string, unknown>,
    });
    if (readbackMatch.status !== "matched") {
      return { status: "skipped", code: "V3_PROJECT_TRANSFER_ACK_REHYDRATION_READBACK_MISMATCH" };
    }
    return {
      status: "synchronized",
      acknowledgementMode: "existing",
      acknowledgement: readbackMatch.acknowledgement,
      projection,
      persistence,
    };
  }

  const persistence = input.persist(projection);
  if (persistence.status === "conflict" || persistence.status === "deleted") {
    return { status: "skipped", code: `V3_PROJECT_TRANSFER_PROJECT_${persistence.status.toUpperCase()}` };
  }

  const published = await input.acknowledgementPublisher.publish({
    projection,
    sourceSnapshotHash: snapshotResult.snapshot.snapshotHash,
    projectRecord: persistence.project as Record<string, unknown>,
  });
  if (published.status !== "acknowledged") return { status: "skipped", code: published.code };

  const confirmed = await input.snapshotReader.get(input.run.id);
  const confirmedMatch = confirmed.status === "ok"
    ? matchExistingV3ProjectTransferAck({
        acknowledgement: confirmed.snapshot.projectTransferAck?.acknowledgement,
        projection,
        projectRecord: persistence.project as Record<string, unknown>,
      })
    : { status: "absent" as const };
  if (confirmedMatch.status !== "matched"
    || confirmedMatch.acknowledgement.ackHash !== published.acknowledgement.ackHash) {
    return { status: "skipped", code: "V3_PROJECT_TRANSFER_ACK_NOT_VISIBLE" };
  }
  return {
    status: "synchronized",
    acknowledgementMode: "published",
    acknowledgement: published.acknowledgement,
    projection,
    persistence,
  };
}
