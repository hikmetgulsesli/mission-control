#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseSetfarmMissionControlCompatibilityEnvelopeV1 } from "../server/services/setfarm-contract-compatibility.ts";
import { parseSetfarmV3DeploymentObservation } from "../server/services/setfarm-deployment-observation.ts";
import { parseRunOperationalSnapshotV1 } from "../server/services/setfarm-operational-snapshot.ts";
import { hashCanonicalJson, matchExistingV3ProjectTransferAckProjection } from "../server/services/v3-project-transfer-ack.ts";

const CONTRACTS = [
  {
    contract: "setfarm.run-operational-snapshot.v1",
    stem: "run-operational-snapshot.v1",
  },
  {
    contract: "setfarm.v3-deployment-observation.v1",
    stem: "deployment-observation.v1",
  },
  {
    contract: "setfarm.v3-project-transfer-ack.v1",
    stem: "project-transfer-ack.v1",
  },
];

const expectedArtifacts = CONTRACTS.flatMap(({ stem }) => [
  {
    producerPath: `contracts/generated/mission-control/${stem}.compatibility.json`,
    vendoredPath: `contracts/vendor/setfarm/${stem}.compatibility.json`,
  },
  {
    producerPath: `contracts/generated/mission-control/${stem}.schema.json`,
    vendoredPath: `contracts/vendor/setfarm/${stem}.schema.json`,
  },
]);

const workspace = resolve(import.meta.dirname, "..");
const lockPath = resolve(workspace, "contracts/vendor/setfarm/mission-control-contracts.v1.lock.json");
const lock = JSON.parse(readFileSync(lockPath, "utf8"));
const expectedLockKeys = ["schema", "producerRepository", "producerCommit", "artifacts"].sort();
if (JSON.stringify(Object.keys(lock).sort()) !== JSON.stringify(expectedLockKeys)
  || lock.schema !== "mission-control.setfarm-contract-vendor-lock.v1"
  || !/^https:\/\/github\.com\/[^/]+\/[^/]+(?:\.git)?$/.test(lock.producerRepository)
  || !/^[a-f0-9]{40}$/.test(lock.producerCommit)
  || !Array.isArray(lock.artifacts)
  || lock.artifacts.length !== expectedArtifacts.length) {
  throw new Error("SETFARM_CONTRACT_VENDOR_LOCK_INVALID");
}

const parsedArtifacts = new Map();
for (let index = 0; index < expectedArtifacts.length; index += 1) {
  const expected = expectedArtifacts[index];
  const artifact = lock.artifacts[index];
  if (typeof artifact !== "object" || artifact === null || Array.isArray(artifact)
    || JSON.stringify(Object.keys(artifact).sort()) !== JSON.stringify(["producerPath", "vendoredPath", "sha256"].sort())
    || artifact.producerPath !== expected.producerPath
    || artifact.vendoredPath !== expected.vendoredPath
    || !/^[a-f0-9]{64}$/.test(artifact.sha256)) {
    throw new Error("SETFARM_CONTRACT_VENDOR_LOCK_ARTIFACT_INVALID");
  }
  const bytes = readFileSync(resolve(workspace, artifact.vendoredPath));
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  if (actualHash !== artifact.sha256) throw new Error("SETFARM_CONTRACT_VENDOR_HASH_MISMATCH");
  parsedArtifacts.set(artifact.producerPath, JSON.parse(bytes.toString("utf8")));
}

const fixtures = new Map();
for (const descriptor of CONTRACTS) {
  const compatibilityPath = `contracts/generated/mission-control/${descriptor.stem}.compatibility.json`;
  const schemaPath = `contracts/generated/mission-control/${descriptor.stem}.schema.json`;
  const envelope = parseSetfarmMissionControlCompatibilityEnvelopeV1({
    compatibility: parsedArtifacts.get(compatibilityPath),
    jsonSchema: parsedArtifacts.get(schemaPath),
    expectedContract: descriptor.contract,
  });
  fixtures.set(descriptor.contract, envelope.fixture);
}

const snapshot = parseRunOperationalSnapshotV1(fixtures.get("setfarm.run-operational-snapshot.v1"));
parseSetfarmV3DeploymentObservation(fixtures.get("setfarm.v3-deployment-observation.v1"));

const acknowledgement = fixtures.get("setfarm.v3-project-transfer-ack.v1");
if (typeof acknowledgement !== "object" || acknowledgement === null || Array.isArray(acknowledgement)) {
  throw new Error("SETFARM_PROJECT_TRANSFER_ACK_COMPATIBILITY_INVALID");
}
const snapshotAcknowledgement = snapshot.projectTransferAck?.acknowledgement;
if (!snapshotAcknowledgement
  || hashCanonicalJson(acknowledgement) !== hashCanonicalJson(snapshotAcknowledgement)) {
  throw new Error("SETFARM_PROJECT_TRANSFER_ACK_COMPATIBILITY_MISMATCH");
}
const ack = acknowledgement;
const projection = ack.projectProjection;
if (typeof projection !== "object" || projection === null || Array.isArray(projection)
  || matchExistingV3ProjectTransferAckProjection({
    acknowledgement: ack,
    projection,
  }).status !== "matched") {
  throw new Error("SETFARM_PROJECT_TRANSFER_ACK_COMPATIBILITY_INVALID");
}

console.log(`Setfarm contract pin OK: ${lock.producerCommit} (${lock.artifacts.length} artifacts)`);
