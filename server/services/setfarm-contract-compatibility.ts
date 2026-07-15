import { hashCanonicalJson } from "./v3-project-transfer-ack.js";

const SHA256 = /^[a-f0-9]{64}$/;

function exactRecord(value: unknown, keys: readonly string[], path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path}:expected_object`);
  }
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) {
    throw new Error(`${path}:unexpected_or_missing_field`);
  }
  return record;
}

export interface SetfarmMissionControlCompatibilityEnvelopeV1 {
  schema: "setfarm.mission-control-contract-compatibility.v1";
  contract:
    | "setfarm.run-operational-snapshot.v1"
    | "setfarm.run-operational-snapshot.v2"
    | "setfarm.v3-deployment-observation.v1"
    | "setfarm.v3-project-transfer-ack.v1";
  producer: { name: "setfarm"; contractVersion: 1 };
  jsonSchemaHash: string;
  fixtureHash: string;
  fixture: unknown;
}

/** Strict, deterministic producer-envelope validation before consumer parsing. */
export function parseSetfarmMissionControlCompatibilityEnvelopeV1(input: Readonly<{
  compatibility: unknown;
  jsonSchema: unknown;
  expectedContract: SetfarmMissionControlCompatibilityEnvelopeV1["contract"];
}>): SetfarmMissionControlCompatibilityEnvelopeV1 {
  if (typeof input.jsonSchema !== "object" || input.jsonSchema === null || Array.isArray(input.jsonSchema)) {
    throw new Error("jsonSchema:expected_object");
  }
  const schema = input.jsonSchema as Record<string, unknown>;
  if (Object.keys(schema).length === 0) throw new Error("jsonSchema:empty");
  const raw = exactRecord(input.compatibility, [
    "schema", "contract", "producer", "jsonSchemaHash", "fixtureHash", "fixture",
  ], "compatibility");
  const producer = exactRecord(raw.producer, ["name", "contractVersion"], "compatibility.producer");
  if (raw.schema !== "setfarm.mission-control-contract-compatibility.v1"
    || raw.contract !== input.expectedContract
    || producer.name !== "setfarm"
    || producer.contractVersion !== 1) {
    throw new Error("compatibility:unsupported_contract_version");
  }
  if (typeof raw.jsonSchemaHash !== "string" || !SHA256.test(raw.jsonSchemaHash)
    || typeof raw.fixtureHash !== "string" || !SHA256.test(raw.fixtureHash)) {
    throw new Error("compatibility:invalid_hash");
  }
  if (hashCanonicalJson(schema) !== raw.jsonSchemaHash) {
    throw new Error("compatibility:json_schema_hash_mismatch");
  }
  if (hashCanonicalJson(raw.fixture) !== raw.fixtureHash) {
    throw new Error("compatibility:fixture_hash_mismatch");
  }
  return {
    schema: "setfarm.mission-control-contract-compatibility.v1",
    contract: input.expectedContract,
    producer: { name: "setfarm", contractVersion: 1 },
    jsonSchemaHash: raw.jsonSchemaHash,
    fixtureHash: raw.fixtureHash,
    fixture: raw.fixture,
  };
}
