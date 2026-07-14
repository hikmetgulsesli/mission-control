import { config } from "../config.js";
import type {
  OperationalProcessIdentityV1,
  OperationalSnapshotFetchResult,
  OperationalV3DeployReceiptV1,
} from "./setfarm-operational-snapshot.js";
import {
  parseSetfarmV3ListenerOwnershipV1 as parseCanonicalListenerOwnership,
  parseSetfarmV3RuntimeDeploymentV1,
  parseSetfarmV3RuntimeIsolationProofV1 as parseCanonicalRuntimeIsolationProof,
  sameSetfarmObservedProcessIdentity,
  type SetfarmV3RuntimeDeploymentV1,
  type SetfarmV3RuntimeIsolationProofV1 as CanonicalRuntimeIsolationProofV1,
} from "./setfarm-v3-runtime-contract.js";
import { hashCanonicalJson } from "./v3-project-transfer-ack.js";

const SHA256 = /^[a-f0-9]{64}$/;
const TIMESTAMP_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const MAX_RESPONSE_BYTES = 1_048_576;
export const V3_DEPLOYMENT_OBSERVATION_MAX_AGE_MS = 15_000;
const DEFAULT_BATCH_DEADLINE_MS = 4_500;
const DEFAULT_BATCH_CONCURRENCY = 4;
const DEFAULT_ACTIVE_CACHE_TTL_MS = 5_000;
const DEFAULT_UNKNOWN_CACHE_TTL_MS = 1_000;
const DEFAULT_MAX_CACHE_ENTRIES = 1_000;

type JsonRecord = Record<string, unknown>;

export interface SetfarmObservedProcessIdentityV1 {
  schema: "setfarm.process-identity.v1";
  pid: number;
  processStartedAt: string;
  processGroupId: number;
  source: "observed_os";
}

export type SetfarmV3RuntimeIsolationProofV1 = CanonicalRuntimeIsolationProofV1;

export interface SetfarmV3DeploymentObservationV1 {
  schema: "setfarm.v3-deployment-observation.v1";
  observationVersion: 1;
  runId: string;
  deploymentReceiptHash: string;
  receiptCompletedAt: string;
  candidateHash: string;
  packetHash: string;
  projectId: string;
  buildArtifactHash: string;
  sealedRuntimeManifestHash: string;
  sealedRuntimeManifestEvidenceRef: string;
  sealAuthorityHash: string;
  sealAuthorityEvidenceRef: string;
  runtimeIsolation: SetfarmV3RuntimeIsolationProofV1;
  runtime: SetfarmV3RuntimeDeploymentV1;
  listenerOwnership: {
    schema: "setfarm.v3-listener-ownership.v1";
    ownerProcess: SetfarmObservedProcessIdentityV1;
    listenerPids: number[];
    listenerProcesses: SetfarmObservedProcessIdentityV1[];
    host: string;
    port: number;
    checkedAt: string;
    evidenceRef: string;
  };
  deploymentStateHash: string;
  deploymentStateEvidenceRef: string;
  controlBindingHash: string;
  leaseIdentityHash: string;
  leaseIdentityEvidenceRef: string;
  httpProof: {
    schema: "setfarm.v3-runtime-http-proof.v1";
    healthUrl: string;
    httpStatus: number;
    checkedAt: string;
    evidenceRef: string;
  };
  checks: {
    receiptIdentity: "pass";
    processIdentity: "pass";
    listenerOwnership: "pass";
    runtimeHttp: "pass";
    sealedRuntime: "pass";
    runtimeIsolation: "pass";
  };
  observedAt: string;
  observationHash: string;
  evidenceRef: string;
}

export type SetfarmDeploymentObservationFetchResult =
  | Readonly<{ status: "ok"; observation: SetfarmV3DeploymentObservationV1 }>
  | Readonly<{ status: "unavailable" | "invalid"; code: string; upstreamStatus?: number }>;

export type CanonicalV3LiveObservation = Readonly<{
  status: "active" | "unknown";
  checkedAt: string;
  reasonCode: string;
}>;

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

function sha256(value: unknown, path: string): string {
  const parsed = boundedString(value, path, 64);
  if (!SHA256.test(parsed)) throw new Error(`${path}:invalid_sha256`);
  return parsed;
}

function positiveInteger(value: unknown, path: string, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > max) {
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
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`${path}:invalid_url_protocol`);
  return parsed;
}

export function parseSetfarmV3DeploymentObservation(value: unknown): SetfarmV3DeploymentObservationV1 {
  const root = exactRecord(value, [
    "schema", "observationVersion", "runId", "deploymentReceiptHash", "receiptCompletedAt", "candidateHash",
    "packetHash", "projectId", "buildArtifactHash", "sealedRuntimeManifestHash",
    "sealedRuntimeManifestEvidenceRef", "sealAuthorityHash", "sealAuthorityEvidenceRef", "runtime",
    "listenerOwnership", "runtimeIsolation", "deploymentStateHash", "deploymentStateEvidenceRef",
    "controlBindingHash", "leaseIdentityHash", "leaseIdentityEvidenceRef", "httpProof", "checks",
    "observedAt", "observationHash", "evidenceRef",
  ], "observation");
  if (root.schema !== "setfarm.v3-deployment-observation.v1" || root.observationVersion !== 1) {
    throw new Error("observation:unsupported_schema");
  }
  const runtime = parseSetfarmV3RuntimeDeploymentV1(root.runtime, "observation.runtime");
  const isolation = parseCanonicalRuntimeIsolationProof(root.runtimeIsolation, "observation.runtimeIsolation");
  const listener = parseCanonicalListenerOwnership(root.listenerOwnership, "observation.listenerOwnership");
  const httpProof = exactRecord(root.httpProof, [
    "schema", "healthUrl", "httpStatus", "checkedAt", "evidenceRef",
  ], "observation.httpProof");
  if (httpProof.schema !== "setfarm.v3-runtime-http-proof.v1") {
    throw new Error("observation.httpProof:unsupported_schema");
  }
  const checks = exactRecord(root.checks, [
    "receiptIdentity", "processIdentity", "listenerOwnership", "runtimeHttp", "sealedRuntime", "runtimeIsolation",
  ], "observation.checks");
  if (Object.values(checks).some((result) => result !== "pass")) {
    throw new Error("observation.checks:proof_not_passed");
  }
  const parsed: SetfarmV3DeploymentObservationV1 = {
    schema: "setfarm.v3-deployment-observation.v1",
    observationVersion: 1,
    runId: boundedString(root.runId, "observation.runId", 500),
    deploymentReceiptHash: sha256(root.deploymentReceiptHash, "observation.deploymentReceiptHash"),
    receiptCompletedAt: timestamp(root.receiptCompletedAt, "observation.receiptCompletedAt"),
    candidateHash: sha256(root.candidateHash, "observation.candidateHash"),
    packetHash: sha256(root.packetHash, "observation.packetHash"),
    projectId: boundedString(root.projectId, "observation.projectId", 120),
    buildArtifactHash: sha256(root.buildArtifactHash, "observation.buildArtifactHash"),
    sealedRuntimeManifestHash: sha256(root.sealedRuntimeManifestHash, "observation.sealedRuntimeManifestHash"),
    sealedRuntimeManifestEvidenceRef: boundedString(root.sealedRuntimeManifestEvidenceRef, "observation.sealedRuntimeManifestEvidenceRef"),
    sealAuthorityHash: sha256(root.sealAuthorityHash, "observation.sealAuthorityHash"),
    sealAuthorityEvidenceRef: boundedString(root.sealAuthorityEvidenceRef, "observation.sealAuthorityEvidenceRef"),
    runtime,
    listenerOwnership: listener,
    runtimeIsolation: isolation,
    deploymentStateHash: sha256(root.deploymentStateHash, "observation.deploymentStateHash"),
    deploymentStateEvidenceRef: boundedString(root.deploymentStateEvidenceRef, "observation.deploymentStateEvidenceRef"),
    controlBindingHash: sha256(root.controlBindingHash, "observation.controlBindingHash"),
    leaseIdentityHash: sha256(root.leaseIdentityHash, "observation.leaseIdentityHash"),
    leaseIdentityEvidenceRef: boundedString(root.leaseIdentityEvidenceRef, "observation.leaseIdentityEvidenceRef"),
    httpProof: {
      schema: "setfarm.v3-runtime-http-proof.v1",
      healthUrl: httpUrl(httpProof.healthUrl, "observation.httpProof.healthUrl"),
      httpStatus: positiveInteger(httpProof.httpStatus, "observation.httpProof.httpStatus", 399),
      checkedAt: timestamp(httpProof.checkedAt, "observation.httpProof.checkedAt"),
      evidenceRef: boundedString(httpProof.evidenceRef, "observation.httpProof.evidenceRef"),
    },
    checks: {
      receiptIdentity: "pass",
      processIdentity: "pass",
      listenerOwnership: "pass",
      runtimeHttp: "pass",
      sealedRuntime: "pass",
      runtimeIsolation: "pass",
    },
    observedAt: timestamp(root.observedAt, "observation.observedAt"),
    observationHash: sha256(root.observationHash, "observation.observationHash"),
    evidenceRef: boundedString(root.evidenceRef, "observation.evidenceRef"),
  };
  if (parsed.httpProof.httpStatus < 200) throw new Error("observation.httpProof.httpStatus:outside_success_range");
  const { observationHash, evidenceRef, ...identity } = parsed;
  if (hashCanonicalJson(identity) !== observationHash) throw new Error("observation.observationHash:identity_mismatch");
  const expectedRuntimeRef = `setfarm://deploy/runtime/${parsed.runId}/${parsed.projectId}`;
  const expectedManifestRef = `setfarm://deploy/sealed-runtime-manifest/${parsed.runId}/${parsed.candidateHash}/${parsed.buildArtifactHash}/${parsed.sealedRuntimeManifestHash}`;
  const expectedSealRef = `setfarm://deploy/seal-authority/${parsed.runId}/${parsed.candidateHash}/${parsed.buildArtifactHash}/${parsed.sealAuthorityHash}`;
  if (evidenceRef !== `setfarm://deploy/observation/${parsed.runId}/${parsed.deploymentReceiptHash}/${observationHash}`
    || parsed.projectId !== parsed.runtime.projectId
    || parsed.runId !== parsed.runtime.runtimeIsolation.runId
    || parsed.runId !== parsed.runtimeIsolation.runId
    || parsed.candidateHash !== parsed.runtime.runtimeIsolation.candidateHash
    || parsed.candidateHash !== parsed.runtimeIsolation.candidateHash
    || parsed.buildArtifactHash !== parsed.runtime.buildArtifactHash
    || parsed.buildArtifactHash !== parsed.runtimeIsolation.buildArtifactHash
    || parsed.sealedRuntimeManifestHash !== parsed.runtime.sealedRuntimeManifestHash
    || parsed.sealedRuntimeManifestEvidenceRef !== parsed.runtime.sealedRuntimeManifestEvidenceRef
    || parsed.sealedRuntimeManifestEvidenceRef !== expectedManifestRef
    || parsed.sealAuthorityHash !== parsed.runtime.sealAuthorityHash
    || parsed.sealAuthorityEvidenceRef !== parsed.runtime.sealAuthorityEvidenceRef
    || parsed.sealAuthorityEvidenceRef !== expectedSealRef
    || parsed.runtime.runtimeIsolation.authorityHash !== parsed.runtimeIsolation.authorityHash
    || parsed.runtime.runtimeDataContractHash !== parsed.runtimeIsolation.runtimeDataContractHash
    || parsed.runtime.volumeProvisioning.volumeProvisioningHash !== parsed.runtimeIsolation.volumeProvisioningHash
    || parsed.runtime.serviceId !== `process:${parsed.listenerOwnership.ownerProcess.pid}`
    || parsed.listenerOwnership.host !== parsed.runtime.host
    || parsed.listenerOwnership.port !== parsed.runtime.port
    || parsed.listenerOwnership.evidenceRef !== `${expectedRuntimeRef}/listener/${parsed.listenerOwnership.ownerProcess.pid}`
    || !sameSetfarmObservedProcessIdentity(
      parsed.runtimeIsolation.challenge.wrapperProcessIdentity,
      parsed.listenerOwnership.ownerProcess,
    )
    || parsed.deploymentStateEvidenceRef !== `setfarm://deploy/runtime-state/${parsed.runId}/${parsed.projectId}/${parsed.deploymentStateHash}`
    || parsed.leaseIdentityEvidenceRef !== `setfarm://deploy/runtime-lease/${parsed.runId}/${parsed.projectId}/${parsed.leaseIdentityHash}`
    || parsed.httpProof.healthUrl !== parsed.runtime.healthUrl
    || parsed.httpProof.evidenceRef !== `${expectedRuntimeRef}/http/${parsed.deploymentReceiptHash}`) {
    throw new Error("observation:authority_binding_mismatch");
  }
  const observedAt = Date.parse(parsed.observedAt);
  if (observedAt < Date.parse(parsed.receiptCompletedAt)
    || [parsed.listenerOwnership.checkedAt, parsed.runtimeIsolation.checkedAt, parsed.httpProof.checkedAt]
      .some((checkedAt) => {
        const elapsed = observedAt - Date.parse(checkedAt);
        return !Number.isFinite(elapsed) || elapsed < 0 || elapsed > 15_000;
      })) {
    throw new Error("observation:stale_evidence");
  }
  return parsed;
}

function sameProcess(
  observed: SetfarmObservedProcessIdentityV1,
  expected: OperationalProcessIdentityV1,
): boolean {
  return observed.schema === expected.schema
    && observed.pid === expected.pid
    && observed.processStartedAt === expected.processStartedAt
    && observed.processGroupId === expected.processGroupId
    && observed.source === expected.source;
}

function sameNumbers(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function exactReceiptObservation(
  receiptProjection: OperationalV3DeployReceiptV1,
  observation: SetfarmV3DeploymentObservationV1,
): boolean {
  const receipt = receiptProjection.receipt;
  const expectedListener = receipt.health.listenerOwnership;
  return observation.runId === receipt.runId
    && observation.deploymentReceiptHash === receipt.receiptHash
    && observation.receiptCompletedAt === receipt.completedAt
    && observation.candidateHash === receipt.candidateHash
    && observation.packetHash === receipt.packetHash
    && observation.projectId === receipt.project.projectId
    && observation.buildArtifactHash === receipt.buildArtifact.artifactHash
    && observation.sealedRuntimeManifestHash === receipt.runtime.sealedRuntimeManifestHash
    && observation.sealedRuntimeManifestEvidenceRef === receipt.runtime.sealedRuntimeManifestEvidenceRef
    && observation.sealAuthorityHash === receipt.runtime.sealAuthorityHash
    && observation.sealAuthorityEvidenceRef === receipt.runtime.sealAuthorityEvidenceRef
    && hashCanonicalJson(observation.runtime) === hashCanonicalJson(receipt.runtime)
    && observation.runtimeIsolation.adapterId === receipt.runtime.runtimeIsolation.adapterId
    && observation.runtimeIsolation.adapterVersion === receipt.runtime.runtimeIsolation.adapterVersion
    && observation.runtimeIsolation.runId === receipt.runtime.runtimeIsolation.runId
    && observation.runtimeIsolation.projectId === receipt.runtime.runtimeIsolation.projectId
    && observation.runtimeIsolation.candidateHash === receipt.runtime.runtimeIsolation.candidateHash
    && observation.runtimeIsolation.buildArtifactHash === receipt.runtime.runtimeIsolation.buildArtifactHash
    && observation.runtimeIsolation.policyHash === receipt.runtime.runtimeIsolation.policyHash
    && observation.runtimeIsolation.profileHash === receipt.runtime.runtimeIsolation.profileHash
    && observation.runtimeIsolation.wrapperArtifactHash === receipt.runtime.runtimeIsolation.wrapperArtifactHash
    && observation.runtimeIsolation.runtimeDataContractHash === receipt.runtime.runtimeIsolation.runtimeDataContractHash
    && observation.runtimeIsolation.volumeProvisioningHash === receipt.runtime.runtimeIsolation.volumeProvisioningHash
    && observation.runtimeIsolation.evidenceRef === receipt.runtime.runtimeIsolation.evidenceRef
    && observation.runtimeIsolation.authorityHash === receipt.runtime.runtimeIsolation.authorityHash
    && sameProcess(observation.runtimeIsolation.challenge.wrapperProcessIdentity, expectedListener.ownerProcess)
    && observation.listenerOwnership.host === expectedListener.host
    && observation.listenerOwnership.port === expectedListener.port
    && sameProcess(observation.listenerOwnership.ownerProcess, expectedListener.ownerProcess)
    && sameNumbers(observation.listenerOwnership.listenerPids, expectedListener.listenerPids)
    && observation.listenerOwnership.listenerProcesses.length === expectedListener.listenerProcesses.length
    && observation.listenerOwnership.listenerProcesses.every((process, index) =>
      sameProcess(process, expectedListener.listenerProcesses[index]!));
}

export function evaluateSetfarmV3DeploymentObservation(input: Readonly<{
  receiptProjection: OperationalV3DeployReceiptV1;
  observationResult: SetfarmDeploymentObservationFetchResult;
  nowMs?: number;
}>): CanonicalV3LiveObservation {
  const nowMs = input.nowMs ?? Date.now();
  const checkedAt = new Date(nowMs).toISOString();
  if (input.observationResult.status !== "ok") {
    return { status: "unknown", checkedAt, reasonCode: input.observationResult.code };
  }
  const observation = input.observationResult.observation;
  const observedAtMs = Date.parse(observation.observedAt);
  const listenerCheckedAtMs = Date.parse(observation.listenerOwnership.checkedAt);
  const isolationCheckedAtMs = Date.parse(observation.runtimeIsolation.checkedAt);
  const isolationChallengedAtMs = Date.parse(observation.runtimeIsolation.challenge.challengedAt);
  if (!Number.isFinite(observedAtMs) || !Number.isFinite(listenerCheckedAtMs) || !Number.isFinite(isolationCheckedAtMs)
    || !Number.isFinite(isolationChallengedAtMs)
    || observedAtMs > nowMs + 5_000 || listenerCheckedAtMs > nowMs + 5_000 || isolationCheckedAtMs > nowMs + 5_000
    || isolationChallengedAtMs > nowMs + 5_000
    || nowMs - observedAtMs > V3_DEPLOYMENT_OBSERVATION_MAX_AGE_MS
    || nowMs - listenerCheckedAtMs > V3_DEPLOYMENT_OBSERVATION_MAX_AGE_MS
    || nowMs - isolationCheckedAtMs > V3_DEPLOYMENT_OBSERVATION_MAX_AGE_MS
    || nowMs - isolationChallengedAtMs > V3_DEPLOYMENT_OBSERVATION_MAX_AGE_MS) {
    return { status: "unknown", checkedAt, reasonCode: "V3_DEPLOYMENT_OBSERVATION_STALE" };
  }
  if (!exactReceiptObservation(input.receiptProjection, observation)) {
    return { status: "unknown", checkedAt, reasonCode: "V3_DEPLOYMENT_OBSERVATION_RECEIPT_IDENTITY_MISMATCH" };
  }
  // ACTIVE is only as fresh as its oldest mandatory proof. The batch cache and
  // UI must not extend a new observedAt past an older listener/isolation
  // challenge boundary.
  const oldestAuthoritativeAt = Math.min(
    observedAtMs,
    listenerCheckedAtMs,
    isolationCheckedAtMs,
    isolationChallengedAtMs,
  );
  return {
    status: "active",
    checkedAt: new Date(oldestAuthoritativeAt).toISOString(),
    reasonCode: "V3_DEPLOYMENT_OBSERVATION_EXACT",
  };
}

type FetchLike = typeof fetch;

export class SetfarmDeploymentObservationClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(input: Readonly<{
    baseUrl?: string;
    token?: string;
    fetchImpl?: FetchLike;
    timeoutMs?: number;
  }> = {}) {
    this.baseUrl = (input.baseUrl ?? config.setfarmUrl).replace(/\/+$/, "");
    this.token = input.token ?? config.setfarmOperationalWriteToken;
    this.fetchImpl = input.fetchImpl ?? fetch;
    this.timeoutMs = input.timeoutMs ?? 5_000;
  }

  async get(runId: string, receiptHash: string): Promise<SetfarmDeploymentObservationFetchResult> {
    if (!runId || !SHA256.test(receiptHash)) {
      return { status: "invalid", code: "V3_DEPLOYMENT_OBSERVATION_REQUEST_IDENTITY_INVALID" };
    }
    if (this.token.length < 32) {
      return { status: "unavailable", code: "V3_DEPLOYMENT_OBSERVATION_READ_AUTHORITY_UNAVAILABLE" };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const endpoint = `${this.baseUrl}/api/runs/${encodeURIComponent(runId)}/deployment-observation?receiptHash=${receiptHash}`;
      const response = await this.fetchImpl(endpoint, {
        method: "GET",
        headers: {
          accept: "application/json",
          "x-setfarm-operational-token": this.token,
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        return {
          status: "unavailable",
          code: response.status === 404
            ? "V3_DEPLOYMENT_OBSERVATION_ENDPOINT_UNAVAILABLE"
            : "V3_DEPLOYMENT_OBSERVATION_UPSTREAM_UNAVAILABLE",
          upstreamStatus: response.status,
        };
      }
      const text = await response.text();
      if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) {
        return { status: "invalid", code: "V3_DEPLOYMENT_OBSERVATION_RESPONSE_TOO_LARGE" };
      }
      let payload: unknown;
      try { payload = JSON.parse(text); } catch {
        return { status: "invalid", code: "V3_DEPLOYMENT_OBSERVATION_INVALID_JSON" };
      }
      try {
        return { status: "ok", observation: parseSetfarmV3DeploymentObservation(payload) };
      } catch {
        return { status: "invalid", code: "V3_DEPLOYMENT_OBSERVATION_INVALID_PAYLOAD" };
      }
    } catch {
      return { status: "unavailable", code: "V3_DEPLOYMENT_OBSERVATION_UPSTREAM_UNAVAILABLE" };
    } finally {
      clearTimeout(timer);
    }
  }
}

export const setfarmDeploymentObservationClient = new SetfarmDeploymentObservationClient();

export async function observeCanonicalV3Deployment(input: Readonly<{
  project: Readonly<Record<string, unknown>>;
  snapshotReader: Readonly<{ get(runId: string): Promise<OperationalSnapshotFetchResult> }>;
  observationReader: Readonly<{
    get(runId: string, receiptHash: string): Promise<SetfarmDeploymentObservationFetchResult>;
  }>;
  now?: () => number;
}>): Promise<CanonicalV3LiveObservation> {
  const now = input.now ?? Date.now;
  const unknown = (reasonCode: string): CanonicalV3LiveObservation => ({
    status: "unknown",
    checkedAt: new Date(now()).toISOString(),
    reasonCode,
  });
  const runId = typeof input.project.workflowRunId === "string" ? input.project.workflowRunId : "";
  const receiptHash = typeof input.project.deploymentReceiptHash === "string"
    ? input.project.deploymentReceiptHash
    : "";
  if (!runId || !SHA256.test(receiptHash)) return unknown("V3_DEPLOYMENT_OBSERVATION_PROJECT_IDENTITY_INCOMPLETE");

  const [snapshotResult, observationResult] = await Promise.all([
    input.snapshotReader.get(runId),
    input.observationReader.get(runId, receiptHash),
  ]);
  if (snapshotResult.status !== "ok") return unknown("V3_DEPLOYMENT_OBSERVATION_SNAPSHOT_UNAVAILABLE");
  const receiptProjection = snapshotResult.snapshot.deploymentReceipt;
  if (!receiptProjection
    || receiptProjection.receipt.runId !== runId
    || receiptProjection.receipt.receiptHash !== receiptHash
    || receiptProjection.receipt.project.projectId !== input.project.id
    || receiptProjection.receipt.candidateHash !== input.project.acceptedCandidateHash
    || receiptProjection.receipt.runtime.serviceId !== input.project.service
    || receiptProjection.receipt.runtime.port !== (input.project.ports as Record<string, unknown> | undefined)?.frontend) {
    return unknown("V3_DEPLOYMENT_OBSERVATION_PROJECT_RECEIPT_MISMATCH");
  }
  // Freshness is authority only at read completion. Sampling before the two
  // upstream reads could accept a proof that expired while those reads were in
  // flight (or while an in-flight request was reused by a later batch).
  return evaluateSetfarmV3DeploymentObservation({
    receiptProjection,
    observationResult,
    nowMs: now(),
  });
}

interface CachedCanonicalV3Observation {
  observation: CanonicalV3LiveObservation;
  expiresAt: number;
}

interface QueuedCanonicalV3Observation {
  deadlineAt: number;
  run(): Promise<CanonicalV3LiveObservation>;
  resolve(value: CanonicalV3LiveObservation): void;
  reject(error: Error): void;
  timer?: NodeJS.Timeout;
}

function projectObservationCacheKey(project: Readonly<Record<string, unknown>>): string {
  return hashCanonicalJson({
    id: project.id,
    workflowRunId: project.workflowRunId,
    acceptedCandidateHash: project.acceptedCandidateHash,
    deploymentReceiptHash: project.deploymentReceiptHash,
    service: project.service,
    ports: project.ports,
  });
}

/**
 * Bounded Projects-list observer. It deduplicates immutable receipt identities,
 * caps concurrent Setfarm reads, and returns UNKNOWN for unfinished work at one
 * global deadline. ACTIVE cache entries expire no later than their proof's
 * 15-second freshness boundary.
 */
export class CanonicalV3DeploymentObservationBatcher {
  private readonly cache = new Map<string, CachedCanonicalV3Observation>();
  private readonly inFlight = new Map<string, Promise<CanonicalV3LiveObservation>>();
  private readonly observationQueue: QueuedCanonicalV3Observation[] = [];
  private readonly concurrency: number;
  private readonly maxCacheEntries: number;
  private activeObservations = 0;

  constructor(private readonly dependencies: Readonly<{
    snapshotReader: Readonly<{ get(runId: string): Promise<OperationalSnapshotFetchResult> }>;
    observationReader: Readonly<{
      get(runId: string, receiptHash: string): Promise<SetfarmDeploymentObservationFetchResult>;
    }>;
    now?: () => number;
    deadlineMs?: number;
    concurrency?: number;
    activeCacheTtlMs?: number;
    unknownCacheTtlMs?: number;
    maxCacheEntries?: number;
  }>) {
    const concurrency = dependencies.concurrency ?? DEFAULT_BATCH_CONCURRENCY;
    const deadlineMs = dependencies.deadlineMs ?? DEFAULT_BATCH_DEADLINE_MS;
    const activeCacheTtlMs = dependencies.activeCacheTtlMs ?? DEFAULT_ACTIVE_CACHE_TTL_MS;
    const unknownCacheTtlMs = dependencies.unknownCacheTtlMs ?? DEFAULT_UNKNOWN_CACHE_TTL_MS;
    const maxCacheEntries = dependencies.maxCacheEntries ?? DEFAULT_MAX_CACHE_ENTRIES;
    if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 16
      || !Number.isSafeInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 30_000
      || !Number.isSafeInteger(activeCacheTtlMs) || activeCacheTtlMs < 0 || activeCacheTtlMs > 30_000
      || !Number.isSafeInteger(unknownCacheTtlMs) || unknownCacheTtlMs < 0 || unknownCacheTtlMs > 30_000
      || !Number.isSafeInteger(maxCacheEntries) || maxCacheEntries < 1 || maxCacheEntries > 100_000) {
      throw new Error("V3_DEPLOYMENT_OBSERVATION_BATCH_CONFIGURATION_INVALID");
    }
    this.concurrency = concurrency;
    this.maxCacheEntries = maxCacheEntries;
  }

  async observe(
    projects: readonly Readonly<Record<string, unknown>>[],
  ): Promise<CanonicalV3LiveObservation[]> {
    const now = this.dependencies.now ?? Date.now;
    const startedAt = now();
    const deadlineAt = startedAt + (this.dependencies.deadlineMs ?? DEFAULT_BATCH_DEADLINE_MS);
    this.pruneExpiredCache(startedAt);
    const results: Array<CanonicalV3LiveObservation | undefined> = new Array(projects.length);
    const work: Array<{ key: string; project: Readonly<Record<string, unknown>>; indexes: number[] }> = [];
    const workByKey = new Map<string, (typeof work)[number]>();

    for (let index = 0; index < projects.length; index += 1) {
      const project = projects[index]!;
      const key = projectObservationCacheKey(project);
      const cached = this.cache.get(key);
      if (cached && cached.expiresAt > startedAt
        && (cached.observation.status !== "active"
          || startedAt - Date.parse(cached.observation.checkedAt) <= V3_DEPLOYMENT_OBSERVATION_MAX_AGE_MS)) {
        // Map insertion order is the LRU order.
        this.cache.delete(key);
        this.cache.set(key, cached);
        results[index] = cached.observation;
        continue;
      }
      if (cached) this.cache.delete(key);
      const existing = workByKey.get(key);
      if (existing) existing.indexes.push(index);
      else {
        const item = { key, project, indexes: [index] };
        workByKey.set(key, item);
        work.push(item);
      }
    }

    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < work.length && now() < deadlineAt) {
        const itemIndex = nextIndex;
        nextIndex += 1;
        const item = work[itemIndex]!;
        let operation = this.inFlight.get(item.key);
        if (!operation) {
          operation = this.scheduleObservation(deadlineAt, () => observeCanonicalV3Deployment({
              project: item.project,
              snapshotReader: this.dependencies.snapshotReader,
              observationReader: this.dependencies.observationReader,
              now,
            }));
          this.inFlight.set(item.key, operation);
          void operation.then(() => {
            if (this.inFlight.get(item.key) === operation) this.inFlight.delete(item.key);
          }, () => {
            if (this.inFlight.get(item.key) === operation) this.inFlight.delete(item.key);
          });
        }
        try {
          const observation = await operation;
          const completedAt = now();
          if (completedAt >= deadlineAt) continue;
          const configuredTtl = observation.status === "active"
            ? this.dependencies.activeCacheTtlMs ?? DEFAULT_ACTIVE_CACHE_TTL_MS
            : this.dependencies.unknownCacheTtlMs ?? DEFAULT_UNKNOWN_CACHE_TTL_MS;
          const proofExpiry = observation.status === "active"
            ? Date.parse(observation.checkedAt) + V3_DEPLOYMENT_OBSERVATION_MAX_AGE_MS
            : Number.POSITIVE_INFINITY;
          const expiresAt = Math.min(completedAt + configuredTtl, proofExpiry);
          if (expiresAt > completedAt) this.setCachedObservation(item.key, { observation, expiresAt }, completedAt);
          for (const index of item.indexes) results[index] = observation;
        } catch {
          // Canonical observation functions are fail-closed, but an injected
          // reader must not escape and fail the whole Projects response.
        }
      }
    };
    const workers = Promise.all(Array.from({
      length: Math.min(this.dependencies.concurrency ?? DEFAULT_BATCH_CONCURRENCY, work.length),
    }, worker));
    if (work.length > 0) {
      let deadlineTimer: NodeJS.Timeout | undefined;
      try {
        await Promise.race([
          workers,
          new Promise<void>((resolve) => {
            const remaining = Math.max(0, deadlineAt - now());
            deadlineTimer = setTimeout(resolve, remaining);
          }),
        ]);
      } finally {
        if (deadlineTimer) clearTimeout(deadlineTimer);
      }
    }
    const checkedAt = new Date(now()).toISOString();
    return Array.from({ length: projects.length }, (_, index) => results[index] ?? {
      status: "unknown",
      checkedAt,
      reasonCode: "V3_DEPLOYMENT_OBSERVATION_GLOBAL_DEADLINE",
    });
  }

  private scheduleObservation(
    deadlineAt: number,
    run: () => Promise<CanonicalV3LiveObservation>,
  ): Promise<CanonicalV3LiveObservation> {
    const now = this.dependencies.now ?? Date.now;
    return new Promise<CanonicalV3LiveObservation>((resolve, reject) => {
      const queued: QueuedCanonicalV3Observation = { deadlineAt, run, resolve, reject };
      const remaining = Math.max(0, deadlineAt - now());
      queued.timer = setTimeout(() => {
        const index = this.observationQueue.indexOf(queued);
        if (index === -1) return;
        this.observationQueue.splice(index, 1);
        reject(new Error("V3_DEPLOYMENT_OBSERVATION_GLOBAL_DEADLINE"));
      }, remaining);
      queued.timer.unref?.();
      this.observationQueue.push(queued);
      this.drainObservationQueue();
    });
  }

  private drainObservationQueue(): void {
    const now = this.dependencies.now ?? Date.now;
    while (this.activeObservations < this.concurrency && this.observationQueue.length > 0) {
      const queued = this.observationQueue.shift()!;
      if (now() >= queued.deadlineAt) {
        if (queued.timer) clearTimeout(queued.timer);
        queued.reject(new Error("V3_DEPLOYMENT_OBSERVATION_GLOBAL_DEADLINE"));
        continue;
      }
      if (queued.timer) clearTimeout(queued.timer);
      this.activeObservations += 1;
      void queued.run().then(queued.resolve, queued.reject).finally(() => {
        this.activeObservations -= 1;
        this.drainObservationQueue();
      });
    }
  }

  private pruneExpiredCache(nowMs: number): void {
    for (const [key, cached] of this.cache) {
      if (cached.expiresAt <= nowMs) this.cache.delete(key);
    }
  }

  private setCachedObservation(key: string, value: CachedCanonicalV3Observation, nowMs: number): void {
    this.pruneExpiredCache(nowMs);
    this.cache.delete(key);
    this.cache.set(key, value);
    while (this.cache.size > this.maxCacheEntries) {
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      this.cache.delete(oldestKey);
    }
  }
}
