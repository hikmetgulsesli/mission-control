import { hashCanonicalJson } from "./v3-project-transfer-ack.js";

const SHA256 = /^[a-f0-9]{64}$/;
const PROJECT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RUNTIME_VOLUME_ID = /^VOLUME_[A-Z0-9]+(?:_[A-Z0-9]+)*$/;
const TIMESTAMP_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

type JsonRecord = Record<string, unknown>;

export interface SetfarmObservedProcessIdentityV1 {
  schema: "setfarm.process-identity.v1";
  pid: number;
  processStartedAt: string;
  processGroupId: number;
  source: "observed_os";
}

export interface SetfarmV3ListenerOwnershipV1 {
  schema: "setfarm.v3-listener-ownership.v1";
  ownerProcess: SetfarmObservedProcessIdentityV1;
  listenerPids: number[];
  listenerProcesses: SetfarmObservedProcessIdentityV1[];
  host: string;
  port: number;
  checkedAt: string;
  evidenceRef: string;
}

export interface SetfarmV3RuntimeVolumeProvisioningV1 {
  schema: "setfarm.v3-runtime-volume-provisioning.v1";
  runId: string;
  projectId: string;
  runtimeDataContractHash: string;
  writableVolumes: Array<{
    volumeId: string;
    persistenceClass: "project" | "run" | "ephemeral";
    purpose: "application-data" | "database" | "uploads";
    rootEvidenceRef: string;
    rootIdentity: { dev: number; ino: number };
    quota: { maxBytes: number; maxFiles: number };
    migrationCommandRef: string;
  }>;
  scratch:
    | { kind: "none" }
    | {
        kind: "platform-managed";
        rootEvidenceRef: string;
        rootIdentity: { dev: number; ino: number };
        quota: { maxBytes: number; maxFiles: number };
      };
  volumeProvisioningHash: string;
  evidenceRef: string;
}

export interface SetfarmV3RuntimeIsolationAuthorityV1 {
  schema: "setfarm.v3-runtime-isolation-authority.v1";
  adapterId: "darwin-sandbox-exec";
  adapterVersion: "1.0.0";
  runId: string;
  projectId: string;
  candidateHash: string;
  buildArtifactHash: string;
  policyHash: string;
  profileHash: string;
  wrapperArtifactHash: string;
  runtimeDataContractHash: string;
  volumeProvisioningHash: string;
  evidenceRef: string;
  authorityHash: string;
}

export interface SetfarmV3RuntimeIsolationProofV1
  extends Omit<SetfarmV3RuntimeIsolationAuthorityV1, "schema"> {
  schema: "setfarm.v3-runtime-isolation-proof.v1";
  challenge: {
    schema: "setfarm.v3-runtime-isolation-challenge.v1";
    nonce: string;
    authorityHash: string;
    wrapperProcessIdentity: SetfarmObservedProcessIdentityV1;
    deniedRootProbes: Array<{
      rootId: "sealed-runtime" | "state-authority";
      outcome: "denied";
    }>;
    deniedReadProbes: Array<{
      authorityId: "launch-agents" | "mission-control-config" | "setfarm-config";
      outcome: "denied";
    }>;
    deniedNetworkProbes: Array<{ authorityId: "all-outbound"; outcome: "denied" }>;
    deniedProcessExecProbes: Array<{ executableId: "launchctl"; outcome: "denied" }>;
    deniedSignalProbes: Array<{ authorityId: "control-sentinel"; outcome: "denied" }>;
    allowedVolumeProbes: Array<{ volumeId: string; outcome: "write_read_delete_pass" }>;
    challengedAt: string;
    challengeHash: string;
  };
  checkedAt: string;
  checks: { runtimeIsolation: "pass" };
}

export interface SetfarmV3RuntimeDeploymentV1 {
  schema: "setfarm.v3-runtime-deployment.v1";
  mode: "local";
  projectId: string;
  serviceId: string;
  host: "127.0.0.1";
  port: number;
  healthUrl: string;
  deployUrl: string;
  evidenceRef: string;
  buildArtifactHash: string;
  buildArtifactEvidenceRef: string;
  sealedRuntimeRef: string;
  sealedRuntimeManifestHash: string;
  sealedRuntimeManifestEvidenceRef: string;
  sealAuthorityHash: string;
  sealAuthorityEvidenceRef: string;
  runtimeDataContractHash: string;
  volumeProvisioning: SetfarmV3RuntimeVolumeProvisioningV1;
  runtimeIsolation: SetfarmV3RuntimeIsolationAuthorityV1;
}

function exactRecord(value: unknown, keys: readonly string[], path: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path}:expected_object`);
  }
  const record = value as JsonRecord;
  const actual = Object.keys(record);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) {
    throw new Error(`${path}:unexpected_or_missing_field`);
  }
  return record;
}

function boundedString(value: unknown, path: string, max = 2_000): string {
  if (typeof value !== "string" || value.length === 0 || value.length > max) {
    throw new Error(`${path}:invalid_string`);
  }
  return value;
}

function projectId(value: unknown, path: string): string {
  const parsed = boundedString(value, path, 120);
  if (!PROJECT_ID.test(parsed)) throw new Error(`${path}:invalid_project_id`);
  return parsed;
}

function sha256(value: unknown, path: string): string {
  const parsed = boundedString(value, path, 64);
  if (!SHA256.test(parsed)) throw new Error(`${path}:invalid_sha256`);
  return parsed;
}

function integer(value: unknown, path: string, minimum: number, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${path}:invalid_integer`);
  }
  return value;
}

function timestamp(value: unknown, path: string): string {
  const parsed = boundedString(value, path, 100);
  if (!TIMESTAMP_WITH_OFFSET.test(parsed) || !Number.isFinite(Date.parse(parsed))) {
    throw new Error(`${path}:invalid_timestamp`);
  }
  return parsed;
}

function httpUrl(value: unknown, path: string): string {
  const parsed = boundedString(value, path, 4_000);
  let url: URL;
  try { url = new URL(parsed); } catch { throw new Error(`${path}:invalid_url`); }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${path}:invalid_url_protocol`);
  }
  return parsed;
}

function rootIdentity(value: unknown, path: string): { dev: number; ino: number } {
  const raw = exactRecord(value, ["dev", "ino"], path);
  return {
    dev: integer(raw.dev, `${path}.dev`, 0),
    ino: integer(raw.ino, `${path}.ino`, 0),
  };
}

function quota(value: unknown, path: string): { maxBytes: number; maxFiles: number } {
  const raw = exactRecord(value, ["maxBytes", "maxFiles"], path);
  return {
    maxBytes: integer(raw.maxBytes, `${path}.maxBytes`, 1),
    maxFiles: integer(raw.maxFiles, `${path}.maxFiles`, 1),
  };
}

export function parseSetfarmObservedProcessIdentityV1(
  value: unknown,
  path: string,
): SetfarmObservedProcessIdentityV1 {
  const raw = exactRecord(value, ["schema", "pid", "processStartedAt", "processGroupId", "source"], path);
  if (raw.schema !== "setfarm.process-identity.v1" || raw.source !== "observed_os") {
    throw new Error(`${path}:unsupported_process_identity`);
  }
  const parsed: SetfarmObservedProcessIdentityV1 = {
    schema: "setfarm.process-identity.v1",
    pid: integer(raw.pid, `${path}.pid`, 1),
    processStartedAt: timestamp(raw.processStartedAt, `${path}.processStartedAt`),
    processGroupId: integer(raw.processGroupId, `${path}.processGroupId`, 1),
    source: "observed_os",
  };
  if (parsed.processGroupId !== parsed.pid) throw new Error(`${path}:not_process_group_leader`);
  return parsed;
}

export function parseSetfarmV3ListenerOwnershipV1(
  value: unknown,
  path: string,
): SetfarmV3ListenerOwnershipV1 {
  const raw = exactRecord(value, [
    "schema", "ownerProcess", "listenerPids", "listenerProcesses", "host", "port", "checkedAt", "evidenceRef",
  ], path);
  if (raw.schema !== "setfarm.v3-listener-ownership.v1") {
    throw new Error(`${path}:unsupported_listener_ownership`);
  }
  const ownerProcess = parseSetfarmObservedProcessIdentityV1(raw.ownerProcess, `${path}.ownerProcess`);
  if (!Array.isArray(raw.listenerPids) || !Array.isArray(raw.listenerProcesses)
    || raw.listenerPids.length === 0 || raw.listenerPids.length > 10_000
    || raw.listenerProcesses.length !== raw.listenerPids.length) {
    throw new Error(`${path}:invalid_listener_cardinality`);
  }
  const listenerPids = raw.listenerPids.map((pid, index) => integer(pid, `${path}.listenerPids[${index}]`, 1));
  const listenerProcesses = raw.listenerProcesses.map((process, index) =>
    parseSetfarmObservedProcessIdentityV1(process, `${path}.listenerProcesses[${index}]`));
  const canonicalPids = [...new Set(listenerPids)].sort((left, right) => left - right);
  if (canonicalPids.length !== listenerPids.length
    || listenerPids.some((pid, index) => pid !== canonicalPids[index])
    || listenerProcesses.some((process, index) => process.pid !== listenerPids[index])
    || listenerProcesses.some((process) => process.processGroupId !== ownerProcess.pid)) {
    throw new Error(`${path}:listener_identity_mismatch`);
  }
  return {
    schema: "setfarm.v3-listener-ownership.v1",
    ownerProcess,
    listenerPids,
    listenerProcesses,
    host: boundedString(raw.host, `${path}.host`, 500),
    port: integer(raw.port, `${path}.port`, 1, 65_535),
    checkedAt: timestamp(raw.checkedAt, `${path}.checkedAt`),
    evidenceRef: boundedString(raw.evidenceRef, `${path}.evidenceRef`),
  };
}

export function parseSetfarmV3RuntimeVolumeProvisioningV1(
  value: unknown,
  path: string,
): SetfarmV3RuntimeVolumeProvisioningV1 {
  const raw = exactRecord(value, [
    "schema", "runId", "projectId", "runtimeDataContractHash", "writableVolumes", "scratch",
    "volumeProvisioningHash", "evidenceRef",
  ], path);
  if (raw.schema !== "setfarm.v3-runtime-volume-provisioning.v1" || !Array.isArray(raw.writableVolumes)
    || raw.writableVolumes.length > 1_000) {
    throw new Error(`${path}:invalid_volume_provisioning`);
  }
  const runId = boundedString(raw.runId, `${path}.runId`, 500);
  const parsedProjectId = projectId(raw.projectId, `${path}.projectId`);
  const writableVolumes = raw.writableVolumes.map((value, index) => {
    const itemPath = `${path}.writableVolumes[${index}]`;
    const item = exactRecord(value, [
      "volumeId", "persistenceClass", "purpose", "rootEvidenceRef", "rootIdentity", "quota", "migrationCommandRef",
    ], itemPath);
    const volumeId = boundedString(item.volumeId, `${itemPath}.volumeId`, 160);
    if (!RUNTIME_VOLUME_ID.test(volumeId)
      || !["project", "run", "ephemeral"].includes(String(item.persistenceClass))
      || !["application-data", "database", "uploads"].includes(String(item.purpose))) {
      throw new Error(`${itemPath}:invalid_volume`);
    }
    const identity = rootIdentity(item.rootIdentity, `${itemPath}.rootIdentity`);
    const rootEvidenceRef = boundedString(item.rootEvidenceRef, `${itemPath}.rootEvidenceRef`);
    if (rootEvidenceRef !== `setfarm://deploy/runtime-volume-root/${runId}/${parsedProjectId}/${volumeId}/${identity.dev}:${identity.ino}`) {
      throw new Error(`${itemPath}.rootEvidenceRef:identity_mismatch`);
    }
    return {
      volumeId,
      persistenceClass: item.persistenceClass as "project" | "run" | "ephemeral",
      purpose: item.purpose as "application-data" | "database" | "uploads",
      rootEvidenceRef,
      rootIdentity: identity,
      quota: quota(item.quota, `${itemPath}.quota`),
      migrationCommandRef: boundedString(item.migrationCommandRef, `${itemPath}.migrationCommandRef`, 160),
    };
  });
  const volumeIds = writableVolumes.map((entry) => entry.volumeId);
  if (new Set(volumeIds).size !== volumeIds.length
    || volumeIds.some((volumeId, index) => volumeId !== [...volumeIds].sort()[index])) {
    throw new Error(`${path}.writableVolumes:noncanonical`);
  }
  const scratchRaw = raw.scratch as unknown;
  let scratch: SetfarmV3RuntimeVolumeProvisioningV1["scratch"];
  if (typeof scratchRaw === "object" && scratchRaw !== null && !Array.isArray(scratchRaw)
    && (scratchRaw as JsonRecord).kind === "none") {
    exactRecord(scratchRaw, ["kind"], `${path}.scratch`);
    scratch = { kind: "none" };
  } else {
    const item = exactRecord(scratchRaw, ["kind", "rootEvidenceRef", "rootIdentity", "quota"], `${path}.scratch`);
    if (item.kind !== "platform-managed") throw new Error(`${path}.scratch:invalid_kind`);
    const identity = rootIdentity(item.rootIdentity, `${path}.scratch.rootIdentity`);
    const rootEvidenceRef = boundedString(item.rootEvidenceRef, `${path}.scratch.rootEvidenceRef`);
    if (rootEvidenceRef !== `setfarm://deploy/runtime-volume-root/${runId}/${parsedProjectId}/scratch/${identity.dev}:${identity.ino}`) {
      throw new Error(`${path}.scratch.rootEvidenceRef:identity_mismatch`);
    }
    scratch = {
      kind: "platform-managed",
      rootEvidenceRef,
      rootIdentity: identity,
      quota: quota(item.quota, `${path}.scratch.quota`),
    };
  }
  const identity = {
    schema: "setfarm.v3-runtime-volume-provisioning.v1" as const,
    runId,
    projectId: parsedProjectId,
    runtimeDataContractHash: sha256(raw.runtimeDataContractHash, `${path}.runtimeDataContractHash`),
    writableVolumes,
    scratch,
  };
  const volumeProvisioningHash = sha256(raw.volumeProvisioningHash, `${path}.volumeProvisioningHash`);
  const evidenceRef = boundedString(raw.evidenceRef, `${path}.evidenceRef`);
  if (hashCanonicalJson(identity) !== volumeProvisioningHash
    || evidenceRef !== `setfarm://deploy/runtime-volumes/${runId}/${parsedProjectId}/${volumeProvisioningHash}`) {
    throw new Error(`${path}:identity_mismatch`);
  }
  return { ...identity, volumeProvisioningHash, evidenceRef };
}

export function parseSetfarmV3RuntimeIsolationAuthorityV1(
  value: unknown,
  path: string,
): SetfarmV3RuntimeIsolationAuthorityV1 {
  const raw = exactRecord(value, [
    "schema", "adapterId", "adapterVersion", "runId", "projectId", "candidateHash", "buildArtifactHash",
    "policyHash", "profileHash", "wrapperArtifactHash", "runtimeDataContractHash", "volumeProvisioningHash",
    "evidenceRef", "authorityHash",
  ], path);
  if (raw.schema !== "setfarm.v3-runtime-isolation-authority.v1"
    || raw.adapterId !== "darwin-sandbox-exec" || raw.adapterVersion !== "1.0.0") {
    throw new Error(`${path}:unsupported_runtime_isolation_authority`);
  }
  const identity = {
    schema: "setfarm.v3-runtime-isolation-authority.v1" as const,
    adapterId: "darwin-sandbox-exec" as const,
    adapterVersion: "1.0.0" as const,
    runId: boundedString(raw.runId, `${path}.runId`, 500),
    projectId: projectId(raw.projectId, `${path}.projectId`),
    candidateHash: sha256(raw.candidateHash, `${path}.candidateHash`),
    buildArtifactHash: sha256(raw.buildArtifactHash, `${path}.buildArtifactHash`),
    policyHash: sha256(raw.policyHash, `${path}.policyHash`),
    profileHash: sha256(raw.profileHash, `${path}.profileHash`),
    wrapperArtifactHash: sha256(raw.wrapperArtifactHash, `${path}.wrapperArtifactHash`),
    runtimeDataContractHash: sha256(raw.runtimeDataContractHash, `${path}.runtimeDataContractHash`),
    volumeProvisioningHash: sha256(raw.volumeProvisioningHash, `${path}.volumeProvisioningHash`),
  };
  const authorityHash = sha256(raw.authorityHash, `${path}.authorityHash`);
  const evidenceRef = boundedString(raw.evidenceRef, `${path}.evidenceRef`);
  if (hashCanonicalJson(identity) !== authorityHash
    || evidenceRef !== `setfarm://deploy/runtime-isolation/${identity.runId}/${identity.candidateHash}/${identity.buildArtifactHash}/${authorityHash}`) {
    throw new Error(`${path}:identity_mismatch`);
  }
  return { ...identity, evidenceRef, authorityHash };
}

function singleDeniedProbe(
  value: unknown,
  path: string,
  key: "authorityId" | "executableId",
  expected: string,
): void {
  if (!Array.isArray(value) || value.length !== 1) throw new Error(`${path}:invalid_cardinality`);
  const probe = exactRecord(value[0], [key, "outcome"], `${path}[0]`);
  if (probe[key] !== expected || probe.outcome !== "denied") throw new Error(`${path}:invalid_probe`);
}

export function parseSetfarmV3RuntimeIsolationProofV1(
  value: unknown,
  path: string,
): SetfarmV3RuntimeIsolationProofV1 {
  const raw = exactRecord(value, [
    "schema", "adapterId", "adapterVersion", "runId", "projectId", "candidateHash", "buildArtifactHash",
    "policyHash", "profileHash", "wrapperArtifactHash", "runtimeDataContractHash", "volumeProvisioningHash",
    "evidenceRef", "authorityHash", "challenge", "checkedAt", "checks",
  ], path);
  const authority = parseSetfarmV3RuntimeIsolationAuthorityV1({
    schema: "setfarm.v3-runtime-isolation-authority.v1",
    adapterId: raw.adapterId,
    adapterVersion: raw.adapterVersion,
    runId: raw.runId,
    projectId: raw.projectId,
    candidateHash: raw.candidateHash,
    buildArtifactHash: raw.buildArtifactHash,
    policyHash: raw.policyHash,
    profileHash: raw.profileHash,
    wrapperArtifactHash: raw.wrapperArtifactHash,
    runtimeDataContractHash: raw.runtimeDataContractHash,
    volumeProvisioningHash: raw.volumeProvisioningHash,
    evidenceRef: raw.evidenceRef,
    authorityHash: raw.authorityHash,
  }, `${path}.authority`);
  const challengeRaw = exactRecord(raw.challenge, [
    "schema", "nonce", "authorityHash", "wrapperProcessIdentity", "deniedRootProbes", "deniedReadProbes",
    "deniedNetworkProbes", "deniedProcessExecProbes", "deniedSignalProbes", "allowedVolumeProbes",
    "challengedAt", "challengeHash",
  ], `${path}.challenge`);
  if (challengeRaw.schema !== "setfarm.v3-runtime-isolation-challenge.v1") {
    throw new Error(`${path}.challenge:unsupported_schema`);
  }
  if (!Array.isArray(challengeRaw.deniedRootProbes) || challengeRaw.deniedRootProbes.length !== 2) {
    throw new Error(`${path}.challenge.deniedRootProbes:invalid_cardinality`);
  }
  const roots = ["sealed-runtime", "state-authority"] as const;
  const deniedRootProbes = challengeRaw.deniedRootProbes.map((value, index) => {
    const probe = exactRecord(value, ["rootId", "outcome"], `${path}.challenge.deniedRootProbes[${index}]`);
    if (probe.rootId !== roots[index] || probe.outcome !== "denied") throw new Error(`${path}.challenge.deniedRootProbes:invalid_probe`);
    return { rootId: roots[index]!, outcome: "denied" as const };
  }) as SetfarmV3RuntimeIsolationProofV1["challenge"]["deniedRootProbes"];
  const readAuthorities = ["launch-agents", "mission-control-config", "setfarm-config"] as const;
  if (!Array.isArray(challengeRaw.deniedReadProbes) || challengeRaw.deniedReadProbes.length !== 3) {
    throw new Error(`${path}.challenge.deniedReadProbes:invalid_cardinality`);
  }
  const deniedReadProbes = challengeRaw.deniedReadProbes.map((value, index) => {
    const probe = exactRecord(value, ["authorityId", "outcome"], `${path}.challenge.deniedReadProbes[${index}]`);
    if (probe.authorityId !== readAuthorities[index] || probe.outcome !== "denied") throw new Error(`${path}.challenge.deniedReadProbes:invalid_probe`);
    return { authorityId: readAuthorities[index]!, outcome: "denied" as const };
  }) as SetfarmV3RuntimeIsolationProofV1["challenge"]["deniedReadProbes"];
  singleDeniedProbe(challengeRaw.deniedNetworkProbes, `${path}.challenge.deniedNetworkProbes`, "authorityId", "all-outbound");
  singleDeniedProbe(challengeRaw.deniedProcessExecProbes, `${path}.challenge.deniedProcessExecProbes`, "executableId", "launchctl");
  singleDeniedProbe(challengeRaw.deniedSignalProbes, `${path}.challenge.deniedSignalProbes`, "authorityId", "control-sentinel");
  if (!Array.isArray(challengeRaw.allowedVolumeProbes) || challengeRaw.allowedVolumeProbes.length > 1_000) {
    throw new Error(`${path}.challenge.allowedVolumeProbes:invalid_array`);
  }
  const allowedVolumeProbes = challengeRaw.allowedVolumeProbes.map((value, index) => {
    const probe = exactRecord(value, ["volumeId", "outcome"], `${path}.challenge.allowedVolumeProbes[${index}]`);
    const volumeId = boundedString(probe.volumeId, `${path}.challenge.allowedVolumeProbes[${index}].volumeId`, 160);
    if (!RUNTIME_VOLUME_ID.test(volumeId) || probe.outcome !== "write_read_delete_pass") {
      throw new Error(`${path}.challenge.allowedVolumeProbes[${index}]:invalid_probe`);
    }
    return { volumeId, outcome: "write_read_delete_pass" as const };
  });
  const volumeIds = allowedVolumeProbes.map((probe) => probe.volumeId);
  if (new Set(volumeIds).size !== volumeIds.length
    || volumeIds.some((volumeId, index) => volumeId !== [...volumeIds].sort()[index])) {
    throw new Error(`${path}.challenge.allowedVolumeProbes:noncanonical`);
  }
  const challengeIdentity = {
    schema: "setfarm.v3-runtime-isolation-challenge.v1" as const,
    nonce: sha256(challengeRaw.nonce, `${path}.challenge.nonce`),
    authorityHash: sha256(challengeRaw.authorityHash, `${path}.challenge.authorityHash`),
    wrapperProcessIdentity: parseSetfarmObservedProcessIdentityV1(
      challengeRaw.wrapperProcessIdentity,
      `${path}.challenge.wrapperProcessIdentity`,
    ),
    deniedRootProbes,
    deniedReadProbes,
    deniedNetworkProbes: [{ authorityId: "all-outbound" as const, outcome: "denied" as const }],
    deniedProcessExecProbes: [{ executableId: "launchctl" as const, outcome: "denied" as const }],
    deniedSignalProbes: [{ authorityId: "control-sentinel" as const, outcome: "denied" as const }],
    allowedVolumeProbes,
    challengedAt: timestamp(challengeRaw.challengedAt, `${path}.challenge.challengedAt`),
  };
  const challengeHash = sha256(challengeRaw.challengeHash, `${path}.challenge.challengeHash`);
  if (hashCanonicalJson(challengeIdentity) !== challengeHash
    || challengeIdentity.authorityHash !== authority.authorityHash) {
    throw new Error(`${path}.challenge:identity_mismatch`);
  }
  const checks = exactRecord(raw.checks, ["runtimeIsolation"], `${path}.checks`);
  if (checks.runtimeIsolation !== "pass") throw new Error(`${path}.checks:proof_not_passed`);
  const checkedAt = timestamp(raw.checkedAt, `${path}.checkedAt`);
  const elapsed = Date.parse(checkedAt) - Date.parse(challengeIdentity.challengedAt);
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > 15_000) throw new Error(`${path}:stale_challenge`);
  const { schema: _schema, ...authorityFields } = authority;
  return {
    ...authorityFields,
    schema: "setfarm.v3-runtime-isolation-proof.v1",
    challenge: { ...challengeIdentity, challengeHash },
    checkedAt,
    checks: { runtimeIsolation: "pass" },
  };
}

export function parseSetfarmV3RuntimeDeploymentV1(
  value: unknown,
  path: string,
): SetfarmV3RuntimeDeploymentV1 {
  const raw = exactRecord(value, [
    "schema", "mode", "projectId", "serviceId", "host", "port", "healthUrl", "deployUrl", "evidenceRef",
    "buildArtifactHash", "buildArtifactEvidenceRef", "sealedRuntimeRef", "sealedRuntimeManifestHash",
    "sealedRuntimeManifestEvidenceRef", "sealAuthorityHash", "sealAuthorityEvidenceRef", "runtimeDataContractHash",
    "volumeProvisioning", "runtimeIsolation",
  ], path);
  if (raw.schema !== "setfarm.v3-runtime-deployment.v1" || raw.mode !== "local" || raw.host !== "127.0.0.1") {
    throw new Error(`${path}:unsupported_runtime`);
  }
  const parsedProjectId = projectId(raw.projectId, `${path}.projectId`);
  const port = integer(raw.port, `${path}.port`, 1, 65_535);
  const healthUrl = httpUrl(raw.healthUrl, `${path}.healthUrl`);
  const deployUrl = httpUrl(raw.deployUrl, `${path}.deployUrl`);
  if (healthUrl !== `http://127.0.0.1:${port}/` || deployUrl !== healthUrl) {
    throw new Error(`${path}:loopback_url_mismatch`);
  }
  const volumeProvisioning = parseSetfarmV3RuntimeVolumeProvisioningV1(raw.volumeProvisioning, `${path}.volumeProvisioning`);
  const runtimeIsolation = parseSetfarmV3RuntimeIsolationAuthorityV1(raw.runtimeIsolation, `${path}.runtimeIsolation`);
  const parsed: SetfarmV3RuntimeDeploymentV1 = {
    schema: "setfarm.v3-runtime-deployment.v1",
    mode: "local",
    projectId: parsedProjectId,
    serviceId: boundedString(raw.serviceId, `${path}.serviceId`, 500),
    host: "127.0.0.1",
    port,
    healthUrl,
    deployUrl,
    evidenceRef: boundedString(raw.evidenceRef, `${path}.evidenceRef`),
    buildArtifactHash: sha256(raw.buildArtifactHash, `${path}.buildArtifactHash`),
    buildArtifactEvidenceRef: boundedString(raw.buildArtifactEvidenceRef, `${path}.buildArtifactEvidenceRef`),
    sealedRuntimeRef: boundedString(raw.sealedRuntimeRef, `${path}.sealedRuntimeRef`),
    sealedRuntimeManifestHash: sha256(raw.sealedRuntimeManifestHash, `${path}.sealedRuntimeManifestHash`),
    sealedRuntimeManifestEvidenceRef: boundedString(raw.sealedRuntimeManifestEvidenceRef, `${path}.sealedRuntimeManifestEvidenceRef`),
    sealAuthorityHash: sha256(raw.sealAuthorityHash, `${path}.sealAuthorityHash`),
    sealAuthorityEvidenceRef: boundedString(raw.sealAuthorityEvidenceRef, `${path}.sealAuthorityEvidenceRef`),
    runtimeDataContractHash: sha256(raw.runtimeDataContractHash, `${path}.runtimeDataContractHash`),
    volumeProvisioning,
    runtimeIsolation,
  };
  const runId = runtimeIsolation.runId;
  const candidateHash = runtimeIsolation.candidateHash;
  if (parsed.projectId !== runtimeIsolation.projectId
    || parsed.buildArtifactHash !== runtimeIsolation.buildArtifactHash
    || parsed.runtimeDataContractHash !== runtimeIsolation.runtimeDataContractHash
    || parsed.runtimeDataContractHash !== volumeProvisioning.runtimeDataContractHash
    || parsed.projectId !== volumeProvisioning.projectId
    || runId !== volumeProvisioning.runId
    || runtimeIsolation.volumeProvisioningHash !== volumeProvisioning.volumeProvisioningHash
    || parsed.evidenceRef !== `setfarm://deploy/runtime/${runId}/${parsed.projectId}`
    || parsed.buildArtifactEvidenceRef !== `setfarm://deploy/build-artifact/${runId}/${parsed.buildArtifactHash}`
    || parsed.sealedRuntimeRef !== `setfarm://deploy/sealed-runtime/${runId}/${candidateHash}/${parsed.buildArtifactHash}`
    || parsed.sealedRuntimeManifestEvidenceRef !== `setfarm://deploy/sealed-runtime-manifest/${runId}/${candidateHash}/${parsed.buildArtifactHash}/${parsed.sealedRuntimeManifestHash}`
    || parsed.sealAuthorityEvidenceRef !== `setfarm://deploy/seal-authority/${runId}/${candidateHash}/${parsed.buildArtifactHash}/${parsed.sealAuthorityHash}`) {
    throw new Error(`${path}:authority_binding_mismatch`);
  }
  return parsed;
}

export function sameSetfarmObservedProcessIdentity(
  left: SetfarmObservedProcessIdentityV1,
  right: Readonly<{
    schema: string;
    pid: number;
    processStartedAt: string;
    processGroupId?: number;
    source: string;
  }>,
): boolean {
  return left.schema === right.schema
    && left.pid === right.pid
    && left.processStartedAt === right.processStartedAt
    && left.processGroupId === right.processGroupId
    && left.source === right.source;
}
