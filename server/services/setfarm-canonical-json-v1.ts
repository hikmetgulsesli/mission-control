import { createHash } from "node:crypto";

export class SnapshotValidationError extends Error {}

export function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new SnapshotValidationError("canonical JSON requires finite numbers");
    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJsonStringify).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJsonStringify(record[key])}`).join(",")}}`;
  }
  throw new SnapshotValidationError("unsupported canonical JSON value");
}

export function hashCanonicalJson(value: unknown): string {
  return createHash("sha256").update(canonicalJsonStringify(value), "utf8").digest("hex");
}
