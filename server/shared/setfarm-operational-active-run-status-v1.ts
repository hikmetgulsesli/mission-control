import schema from "../../contracts/vendor/setfarm/operational-active-run-status.v1.schema.json" with { type: "json" };

declare const setfarmOperationalActiveRunStatusV1Brand: unique symbol;

export type SetfarmOperationalActiveRunStatusV1 = string & Readonly<{
  [setfarmOperationalActiveRunStatusV1Brand]: true;
}>;

function validatedSchemaEnum(value: unknown): readonly string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("SETFARM_OPERATIONAL_ACTIVE_RUN_STATUS_SCHEMA_INVALID");
  }
  const record = value as Record<string, unknown>;
  const requiredKeys = ["$id", "$schema", "enum", "type"];
  if (Object.keys(record).length !== requiredKeys.length
    || !requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(record, key))
    || record.$id !== "https://contracts.setfarm.dev/mission-control/setfarm.operational-active-run-status.v1.schema.json"
    || record.$schema !== "https://json-schema.org/draft/2020-12/schema"
    || record.type !== "string"
    || !Array.isArray(record.enum)
    || record.enum.length === 0
    || record.enum.some((entry) => typeof entry !== "string" || !entry)
    || new Set(record.enum).size !== record.enum.length) {
    throw new Error("SETFARM_OPERATIONAL_ACTIVE_RUN_STATUS_SCHEMA_INVALID");
  }
  return Object.freeze([...record.enum]);
}

const activeRunStatuses = Object.freeze(new Set(validatedSchemaEnum(schema)));

export function isSetfarmOperationalActiveRunStatusV1(
  value: unknown,
): value is SetfarmOperationalActiveRunStatusV1 {
  return typeof value === "string" && activeRunStatuses.has(value);
}
