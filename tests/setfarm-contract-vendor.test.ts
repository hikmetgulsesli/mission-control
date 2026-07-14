import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseSetfarmMissionControlCompatibilityEnvelopeV1 } from "../server/services/setfarm-contract-compatibility.js";
import { parseSetfarmV3DeploymentObservation } from "../server/services/setfarm-deployment-observation.js";
import { parseRunOperationalSnapshotV1 } from "../server/services/setfarm-operational-snapshot.js";
import {
  hashCanonicalJson,
  matchExistingV3ProjectTransferAckProjection,
  type V3ProjectTransferAckV1,
} from "../server/services/v3-project-transfer-ack.js";

const ROOT = new URL("../", import.meta.url);

type ContractName =
  | "setfarm.run-operational-snapshot.v1"
  | "setfarm.v3-deployment-observation.v1"
  | "setfarm.v3-project-transfer-ack.v1";

interface VendorLock {
  producerCommit: string;
  artifacts: Array<{
    producerPath: string;
    vendoredPath: string;
    sha256: string;
  }>;
}

function json(path: string): any {
  return JSON.parse(readFileSync(new URL(path, ROOT), "utf8"));
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

test("all six vendored Setfarm artifacts are byte-bound to one immutable producer commit", () => {
  const lock = json("contracts/vendor/setfarm/mission-control-contracts.v1.lock.json") as VendorLock;
  assert.match(lock.producerCommit, /^[a-f0-9]{40}$/);
  assert.equal(lock.artifacts.length, 6);
  assert.equal(new Set(lock.artifacts.map((artifact) => artifact.vendoredPath)).size, 6);

  for (const artifact of lock.artifacts) {
    const bytes = readFileSync(new URL(artifact.vendoredPath, ROOT));
    assert.equal(sha256(bytes), artifact.sha256, artifact.vendoredPath);
    const mutated = Buffer.from(bytes);
    mutated[Math.max(0, mutated.length - 2)]! ^= 1;
    assert.notEqual(sha256(mutated), artifact.sha256, `${artifact.vendoredPath} mutation`);
  }
});

test("vendored compatibility fixtures cross each semantic consumer and fail closed after rehashed drift", () => {
  const descriptors: Array<{
    contract: ContractName;
    stem: string;
    mutate(fixture: any): void;
    reject(fixture: any): void;
  }> = [
    {
      contract: "setfarm.run-operational-snapshot.v1",
      stem: "run-operational-snapshot.v1",
      mutate(fixture) { delete fixture.run; },
      reject(fixture) { assert.throws(() => parseRunOperationalSnapshotV1(fixture)); },
    },
    {
      contract: "setfarm.v3-deployment-observation.v1",
      stem: "deployment-observation.v1",
      mutate(fixture) { delete fixture.packetHash; },
      reject(fixture) { assert.throws(() => parseSetfarmV3DeploymentObservation(fixture)); },
    },
    {
      contract: "setfarm.v3-project-transfer-ack.v1",
      stem: "project-transfer-ack.v1",
      mutate(fixture) { delete fixture.packetHash; },
      reject(fixture) {
        assert.equal(matchExistingV3ProjectTransferAckProjection({
          acknowledgement: fixture as V3ProjectTransferAckV1,
          projection: fixture.projectProjection,
        }).status, "mismatch");
      },
    },
  ];

  for (const descriptor of descriptors) {
    const compatibility = json(`contracts/vendor/setfarm/${descriptor.stem}.compatibility.json`);
    const jsonSchema = json(`contracts/vendor/setfarm/${descriptor.stem}.schema.json`);
    const parsed = parseSetfarmMissionControlCompatibilityEnvelopeV1({
      compatibility,
      jsonSchema,
      expectedContract: descriptor.contract,
    });
    const drifted = structuredClone(compatibility);
    descriptor.mutate(drifted.fixture);
    drifted.fixtureHash = hashCanonicalJson(drifted.fixture);
    assert.doesNotThrow(() => parseSetfarmMissionControlCompatibilityEnvelopeV1({
      compatibility: drifted,
      jsonSchema,
      expectedContract: descriptor.contract,
    }));
    descriptor.reject(drifted.fixture);
    assert.notEqual(hashCanonicalJson(drifted.fixture), parsed.fixtureHash);
  }
});
