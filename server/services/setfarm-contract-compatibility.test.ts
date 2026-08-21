import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseSetfarmMissionControlCompatibilityEnvelopeV1 } from "./setfarm-contract-compatibility.js";
import { hashCanonicalJson } from "./v3-project-transfer-ack.js";

function fixture(
  contract:
    | "setfarm.run-operational-snapshot.v1"
    | "setfarm.run-operational-snapshot.v2"
    | "setfarm.v3-deployment-observation.v1"
    | "setfarm.v3-project-transfer-ack.v1" = "setfarm.run-operational-snapshot.v1",
) {
  const jsonSchema = { $schema: "https://json-schema.org/draft/2020-12/schema", type: "object" };
  const positiveFixture = { schema: contract, fixture: true };
  return {
    jsonSchema,
    compatibility: {
      schema: "setfarm.mission-control-contract-compatibility.v1",
      contract,
      producer: { name: "setfarm", contractVersion: 1 },
      jsonSchemaHash: hashCanonicalJson(jsonSchema),
      fixtureHash: hashCanonicalJson(positiveFixture),
      fixture: positiveFixture,
    },
  };
}

test("producer compatibility envelope binds the exact schema and positive fixture", () => {
  const value = fixture();
  assert.deepEqual(parseSetfarmMissionControlCompatibilityEnvelopeV1({
    ...value,
    expectedContract: "setfarm.run-operational-snapshot.v1",
  }).fixture, value.compatibility.fixture);
});

test("compatibility envelope rejects version drift and either hash drift", () => {
  const versionDrift = fixture();
  versionDrift.compatibility.producer.contractVersion = 2;
  assert.throws(() => parseSetfarmMissionControlCompatibilityEnvelopeV1({
    ...versionDrift,
    expectedContract: "setfarm.run-operational-snapshot.v1",
  }), /unsupported_contract_version/);

  const schemaDrift = fixture();
  schemaDrift.jsonSchema.type = "array";
  assert.throws(() => parseSetfarmMissionControlCompatibilityEnvelopeV1({
    ...schemaDrift,
    expectedContract: "setfarm.run-operational-snapshot.v1",
  }), /json_schema_hash_mismatch/);

  const fixtureDrift = fixture();
  fixtureDrift.compatibility.fixture.fixture = false;
  assert.throws(() => parseSetfarmMissionControlCompatibilityEnvelopeV1({
    ...fixtureDrift,
    expectedContract: "setfarm.run-operational-snapshot.v1",
  }), /fixture_hash_mismatch/);

  const wrongContract = fixture("setfarm.v3-deployment-observation.v1");
  assert.throws(() => parseSetfarmMissionControlCompatibilityEnvelopeV1({
    ...wrongContract,
    expectedContract: "setfarm.v3-project-transfer-ack.v1",
  }), /unsupported_contract_version/);
});

test("active-status compatibility accepts only its exact generated producer-export extension", () => {
  const compatibility = JSON.parse(readFileSync(new URL(
    "../../contracts/vendor/setfarm/operational-active-run-status.v1.compatibility.json",
    import.meta.url,
  ), "utf8"));
  const jsonSchema = JSON.parse(readFileSync(new URL(
    "../../contracts/vendor/setfarm/operational-active-run-status.v1.schema.json",
    import.meta.url,
  ), "utf8"));
  const parsed = parseSetfarmMissionControlCompatibilityEnvelopeV1({
    compatibility,
    jsonSchema,
    expectedContract: "setfarm.operational-active-run-status.v1",
  });
  assert.equal(parsed.fixture, "running");
  assert.deepEqual(parsed.producerExports, {
    predicateExport: "isSetfarmOperationalActiveRunStatusV1",
    schemaExport: "SetfarmOperationalActiveRunStatusV1Schema",
    statusesExport: "SETFARM_OPERATIONAL_ACTIVE_RUN_STATUSES_V1",
  });

  for (const drift of [
    { ...compatibility, producerExports: { ...compatibility.producerExports, predicateExport: "isActive" } },
    { ...compatibility, producerExports: { ...compatibility.producerExports, extra: "forbidden" } },
    { ...compatibility, producerExports: undefined },
  ]) {
    assert.throws(() => parseSetfarmMissionControlCompatibilityEnvelopeV1({
      compatibility: drift,
      jsonSchema,
      expectedContract: "setfarm.operational-active-run-status.v1",
    }));
  }

  const older = fixture();
  assert.throws(() => parseSetfarmMissionControlCompatibilityEnvelopeV1({
    ...older,
    compatibility: { ...older.compatibility, producerExports: compatibility.producerExports },
    expectedContract: "setfarm.run-operational-snapshot.v1",
  }), /unexpected_or_missing_field/);
});
