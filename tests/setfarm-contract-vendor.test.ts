import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseSetfarmMissionControlCompatibilityEnvelopeV1 } from "../server/services/setfarm-contract-compatibility.js";
import { parseSetfarmV3DeploymentObservation } from "../server/services/setfarm-deployment-observation.js";
import {
  parseRunOperationalSnapshotV1,
  parseRunOperationalSnapshotV2,
  parseRunOperationalSnapshotV3,
} from "../server/services/setfarm-operational-snapshot.js";
import {
  hashCanonicalJson,
  matchExistingV3ProjectTransferAckProjection,
  type V3ProjectTransferAckV1,
} from "../server/services/v3-project-transfer-ack.js";
import { isSetfarmOperationalActiveRunStatusV1 } from "../server/shared/setfarm-operational-active-run-status-v1.js";

const ROOT = new URL("../", import.meta.url);

type ContractName =
  | "setfarm.run-operational-snapshot.v1"
  | "setfarm.run-operational-snapshot.v2"
  | "setfarm.run-operational-snapshot.v3"
  | "setfarm.v3-deployment-observation.v1"
  | "setfarm.v3-project-transfer-ack.v1"
  | "setfarm.operational-active-run-status.v1";

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

test("all twelve vendored Setfarm artifacts are byte-bound to the exact active-status producer commit", () => {
  const lock = json("contracts/vendor/setfarm/mission-control-contracts.v1.lock.json") as VendorLock;
  assert.equal(lock.producerCommit, "ff761a3680b0e899d8245e8d5fb1a0b2ca806424");
  assert.equal(lock.artifacts.length, 12);
  assert.equal(new Set(lock.artifacts.map((artifact) => artifact.vendoredPath)).size, 12);

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
    mutate(fixture: any): unknown;
    reject(fixture: any): void;
  }> = [
    {
      contract: "setfarm.run-operational-snapshot.v1",
      stem: "run-operational-snapshot.v1",
      mutate(fixture) { delete fixture.run; },
      reject(fixture) { assert.throws(() => parseRunOperationalSnapshotV1(fixture)); },
    },
    {
      contract: "setfarm.run-operational-snapshot.v2",
      stem: "run-operational-snapshot.v2",
      mutate(fixture) { delete fixture.completionRequests[0].implementationSubmissionEvidence.receipt.sourceProposalHash; },
      reject(fixture) { assert.throws(() => parseRunOperationalSnapshotV2(fixture)); },
    },
    {
      contract: "setfarm.run-operational-snapshot.v3",
      stem: "run-operational-snapshot.v3",
      mutate(fixture) { fixture.operationalFailure.terminationRequestRef = "setfarm://run-termination/foreign"; },
      reject(fixture) { assert.throws(() => parseRunOperationalSnapshotV3(fixture)); },
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
    {
      contract: "setfarm.operational-active-run-status.v1",
      stem: "operational-active-run-status.v1",
      mutate() { return "pending"; },
      reject(fixture) { assert.equal(isSetfarmOperationalActiveRunStatusV1(fixture), false); },
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
    const replacement = descriptor.mutate(drifted.fixture);
    if (replacement !== undefined) drifted.fixture = replacement;
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
