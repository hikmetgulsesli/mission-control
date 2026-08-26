import { execFile as execFileCallback } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { hashCanonicalJson } from "./setfarm-operational-snapshot.js";

const execFile = promisify(execFileCallback);

export const PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_RESPONSE_SCHEMA_V1 =
  "mission-control.product-build-authority-v2-delivery-evidence-response.v1" as const;
export const PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_CURRENT_STATUS_V1 = "current" as const;
export const PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_SCHEMA_V1 =
  "mission-control.product-build-authority-v2-delivery-evidence.v1" as const;
export const PRODUCT_BUILD_AUTHORITY_V2_BUILD_IDENTITY_SCHEMA_V1 =
  "mission-control.internal-production-build-identity.v1" as const;
export const PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_RESPONSE_SCHEMA_V1 =
  "mission-control.product-build-authority-v2-loaded-build-response.v1" as const;
export const PRODUCT_BUILD_AUTHORITY_V2_STARTUP_INSTANCE_SCHEMA_V1 =
  "mission-control.product-build-authority-v2-startup-instance.v1" as const;
export const PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_SCHEMA_V1 =
  "mission-control.product-build-authority-v2-loaded-build.v1" as const;
export const PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID_CODE =
  "PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID" as const;

const DELIVERY_PR_NUMBER = 19 as const;
const DELIVERY_MERGE_SHA = "240e779d78804843a1202cbf0440fe423b806b1a" as const;
const DELIVERY_EVIDENCE_REF_PREFIX =
  "mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/";
const FOCUSED_TEST_RECEIPT_REF_PREFIX =
  "mission-control://internal-production/product-build-authority-v2-focused-test-receipt/sha256/";
const VENDOR_LOCK_PATH = "contracts/vendor/setfarm/mission-control-contracts.v1.lock.json" as const;
const VENDOR_LOCK_SCHEMA = "mission-control.product-build-authority-v2-vendor-lock-projection.v1" as const;
const VENDOR_COMPATIBILITY_SET_SCHEMA = "mission-control.setfarm-contract-compatibility-set.v1" as const;
const FOCUSED_TEST_RECEIPT_SCHEMA = "mission-control.product-build-authority-v2-focused-test-receipt.v1" as const;
const FOCUSED_TEST_TIMEOUT_MS = 120_000 as const;
const BUILD_IDENTITY_RELATIVE_PATH = "dist-server/internal-production-build-identity.v1.json" as const;
const LOADED_BUILD_ENTRY_MODULE_PATH =
  "dist-server/services/product-build-authority-v2-delivery-evidence-v1.js" as const;
const LOADED_BUILD_REF_PREFIX =
  "mission-control://internal-production/product-build-authority-v2-loaded-build/sha256/" as const;
const TRUSTED_GIT_EXECUTABLE = "/usr/bin/git" as const;
const TRUSTED_FOCUSED_TEST_ENVIRONMENT = Object.freeze({
  PATH: "/opt/homebrew/bin:/usr/bin:/bin",
  LANG: "C",
  LC_ALL: "C",
});
const GIT_OBJECT_HASH = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const SHA256 = /^[0-9a-f]{64}$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const DELIVERED_PATHS = [
  "server/routes/setfarm-operational.test.ts",
  "server/routes/setfarm-operational.ts",
  "server/services/setfarm-product-build-authority.ts",
  "server/services/setfarm-product-build-authority.test.ts",
  "src/lib/product-build-authority.ts",
  "src/components/run-detail/ProductBuildAuthority.tsx",
  "tests/product-build-authority-render.test.tsx",
  VENDOR_LOCK_PATH,
] as const;

const FOCUSED_ARGV = [
  "node",
  "--import",
  "tsx",
  "--test",
  "server/routes/setfarm-operational.test.ts",
  "server/services/setfarm-product-build-authority.test.ts",
  "tests/product-build-authority-render.test.tsx",
] as const;

const VENDOR_ARTIFACT_PATHS = [
  ["contracts/generated/mission-control/run-operational-snapshot.v1.compatibility.json", "contracts/vendor/setfarm/run-operational-snapshot.v1.compatibility.json"],
  ["contracts/generated/mission-control/run-operational-snapshot.v1.schema.json", "contracts/vendor/setfarm/run-operational-snapshot.v1.schema.json"],
  ["contracts/generated/mission-control/run-operational-snapshot.v2.compatibility.json", "contracts/vendor/setfarm/run-operational-snapshot.v2.compatibility.json"],
  ["contracts/generated/mission-control/run-operational-snapshot.v2.schema.json", "contracts/vendor/setfarm/run-operational-snapshot.v2.schema.json"],
  ["contracts/generated/mission-control/run-operational-snapshot.v3.compatibility.json", "contracts/vendor/setfarm/run-operational-snapshot.v3.compatibility.json"],
  ["contracts/generated/mission-control/run-operational-snapshot.v3.schema.json", "contracts/vendor/setfarm/run-operational-snapshot.v3.schema.json"],
  ["contracts/generated/mission-control/deployment-observation.v1.compatibility.json", "contracts/vendor/setfarm/deployment-observation.v1.compatibility.json"],
  ["contracts/generated/mission-control/deployment-observation.v1.schema.json", "contracts/vendor/setfarm/deployment-observation.v1.schema.json"],
  ["contracts/generated/mission-control/project-transfer-ack.v1.compatibility.json", "contracts/vendor/setfarm/project-transfer-ack.v1.compatibility.json"],
  ["contracts/generated/mission-control/project-transfer-ack.v1.schema.json", "contracts/vendor/setfarm/project-transfer-ack.v1.schema.json"],
  ["contracts/generated/mission-control/operational-active-run-status.v1.compatibility.json", "contracts/vendor/setfarm/operational-active-run-status.v1.compatibility.json"],
  ["contracts/generated/mission-control/operational-active-run-status.v1.schema.json", "contracts/vendor/setfarm/operational-active-run-status.v1.schema.json"],
] as const;

export type ProductBuildAuthorityV2PathBlobIdentityV1 = Readonly<{
  path: string;
  blobHash: string;
}>;

export type ProductBuildAuthorityV2VendorArtifactIdentityV1 = Readonly<{
  producerPath: string;
  vendoredPath: string;
  sha256: string;
}>;

export type ProductBuildAuthorityV2DeliveredPathBlobsV1 = readonly [
  ProductBuildAuthorityV2PathBlobIdentityV1,
  ProductBuildAuthorityV2PathBlobIdentityV1,
  ProductBuildAuthorityV2PathBlobIdentityV1,
  ProductBuildAuthorityV2PathBlobIdentityV1,
  ProductBuildAuthorityV2PathBlobIdentityV1,
  ProductBuildAuthorityV2PathBlobIdentityV1,
  ProductBuildAuthorityV2PathBlobIdentityV1,
  ProductBuildAuthorityV2PathBlobIdentityV1,
];

export type ProductBuildAuthorityV2VendorArtifactIdentitiesV1 = readonly [
  ProductBuildAuthorityV2VendorArtifactIdentityV1,
  ProductBuildAuthorityV2VendorArtifactIdentityV1,
  ProductBuildAuthorityV2VendorArtifactIdentityV1,
  ProductBuildAuthorityV2VendorArtifactIdentityV1,
  ProductBuildAuthorityV2VendorArtifactIdentityV1,
  ProductBuildAuthorityV2VendorArtifactIdentityV1,
  ProductBuildAuthorityV2VendorArtifactIdentityV1,
  ProductBuildAuthorityV2VendorArtifactIdentityV1,
  ProductBuildAuthorityV2VendorArtifactIdentityV1,
  ProductBuildAuthorityV2VendorArtifactIdentityV1,
  ProductBuildAuthorityV2VendorArtifactIdentityV1,
  ProductBuildAuthorityV2VendorArtifactIdentityV1,
];

export type ProductBuildAuthorityV2FocusedTestReceiptV1 = Readonly<{
  schema: typeof FOCUSED_TEST_RECEIPT_SCHEMA;
  argv: typeof FOCUSED_ARGV;
  commandContractHash: string;
  testPathBlobs: readonly [
    ProductBuildAuthorityV2PathBlobIdentityV1,
    ProductBuildAuthorityV2PathBlobIdentityV1,
    ProductBuildAuthorityV2PathBlobIdentityV1,
  ];
  exitCode: 0;
  passed: true;
  focusedTestReceiptRef: string;
  focusedTestReceiptHash: string;
}>;

export type ProductBuildAuthorityV2VendorLockProjectionV1 = Readonly<{
  schema: typeof VENDOR_LOCK_SCHEMA;
  lockPath: typeof VENDOR_LOCK_PATH;
  producerRepository: "https://github.com/hikmetgulsesli/setfarm.git";
  producerCommit: string;
  lockContentHash: string;
  artifacts: ProductBuildAuthorityV2VendorArtifactIdentitiesV1;
  compatibilitySetHash: string;
  vendorLockProjectionHash: string;
}>;

export type ProductBuildAuthorityV2DeliveryEvidenceV1 = Readonly<{
  schema: typeof PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_SCHEMA_V1;
  currentStatus: typeof PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_CURRENT_STATUS_V1;
  deliveryPrNumber: typeof DELIVERY_PR_NUMBER;
  deliveryMergeSha: typeof DELIVERY_MERGE_SHA;
  deliveryMergeAncestorOfCurrentSource: true;
  currentSource: Readonly<{
    branch: "main";
    clean: true;
    sha: string;
    treeHash: string;
    buildHash: string;
    originMainSha: string;
  }>;
  deliveredPathBlobs: ProductBuildAuthorityV2DeliveredPathBlobsV1;
  focusedTests: ProductBuildAuthorityV2FocusedTestReceiptV1;
  vendorLock: ProductBuildAuthorityV2VendorLockProjectionV1;
  deliveryEvidenceRef: string;
  deliveryEvidenceHash: string;
}>;

export type ProductBuildAuthorityV2DeliveryEvidencePairV1 = Readonly<{
  deliveryEvidenceRef: string;
  deliveryEvidenceHash: string;
}>;

export type ProductBuildAuthorityV2DeliveryEvidenceResponseV1 = Readonly<{
  schema: typeof PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_RESPONSE_SCHEMA_V1;
  currentStatus: typeof PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_CURRENT_STATUS_V1;
  deliveryEvidenceRef: string;
  deliveryEvidenceHash: string;
  evidence: ProductBuildAuthorityV2DeliveryEvidenceV1;
}>;

export type ProductBuildAuthorityV2LoadedBuildResponseV1 = Readonly<{
  schema: typeof PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_RESPONSE_SCHEMA_V1;
  loadedBuildRef: `mission-control://internal-production/product-build-authority-v2-loaded-build/sha256/${string}`;
  loadedBuildHash: string;
  startupInstance: Readonly<{
    schema: typeof PRODUCT_BUILD_AUTHORITY_V2_STARTUP_INSTANCE_SCHEMA_V1;
    pid: number;
    instanceId: string;
  }>;
  loadedBuild: Readonly<{
    schema: typeof PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_SCHEMA_V1;
    entryModulePath: typeof LOADED_BUILD_ENTRY_MODULE_PATH;
    entryModuleHash: string;
    buildIdentity: Readonly<{
      schema: typeof PRODUCT_BUILD_AUTHORITY_V2_BUILD_IDENTITY_SCHEMA_V1;
      sourceSha: string;
      treeHash: string;
      buildHash: string;
    }>;
    buildIdentityHash: string;
  }>;
}>;

export type ProductBuildAuthorityV2LoadedBuildStartupStateV1 =
  | Readonly<{ status: "available"; response: ProductBuildAuthorityV2LoadedBuildResponseV1 }>
  | Readonly<{
      status: "unavailable";
      code: typeof PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID_CODE;
    }>;

export class ProductBuildAuthorityV2DeliveryEvidenceError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ProductBuildAuthorityV2DeliveryEvidenceError";
  }
}

type AuthenticatedCurrentBuildV1 = Readonly<{
  topLevel: string;
  branch: "main";
  cleanStatus: "";
  sha: string;
  originMainSha: string;
  treeHash: string;
  buildHash: string;
  buildIdentityHash: string;
}>;

function fail(code: string): never {
  throw new ProductBuildAuthorityV2DeliveryEvidenceError(code);
}

function strictRecord(value: unknown, code: string): Record<string, unknown> {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
      fail(code);
    }
    const detached: Record<string, unknown> = Object.create(Object.prototype) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== "string" || descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) fail(code);
      Object.defineProperty(detached, key, {
        value: descriptor.value,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return detached;
  } catch {
    fail(code);
  }
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], code: string): void {
  try {
    const actual = Reflect.ownKeys(value).sort();
    const wanted = [...expected].sort();
    if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) fail(code);
  } catch {
    fail(code);
  }
}

function deepFreeze<Value>(value: Value): Value {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor !== undefined && "value" in descriptor) deepFreeze(descriptor.value);
    }
    Object.freeze(value);
  }
  return value;
}

function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Value(value: unknown, code: string): string {
  if (typeof value !== "string" || !SHA256.test(value)) fail(code);
  return value;
}

function gitHashValue(value: unknown, code: string): string {
  if (typeof value !== "string" || !GIT_OBJECT_HASH.test(value)) fail(code);
  return value;
}

function trustedGitEnvironment(): Readonly<Record<string, string>> {
  return { PATH: "/opt/homebrew/bin:/usr/bin:/bin", LANG: "C", LC_ALL: "C", GIT_TERMINAL_PROMPT: "0" };
}

async function repositoryRootFromModule(): Promise<string> {
  const modulePath = await realpath(fileURLToPath(import.meta.url));
  const servicesDirectory = dirname(modulePath);
  const buildDirectory = dirname(servicesDirectory);
  if (basename(servicesDirectory) !== "services" || !["server", "dist-server"].includes(basename(buildDirectory))) {
    fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_MODULE_LOCATION_INVALID");
  }
  const root = dirname(buildDirectory);
  const packagePath = resolve(root, "package.json");
  try {
    if (await realpath(packagePath) !== packagePath) fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_MODULE_LOCATION_INVALID");
    const packageValue = strictRecord(JSON.parse(await readFile(packagePath, "utf8")),
      "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_MODULE_LOCATION_INVALID");
    exactKeys(packageValue, Object.keys(packageValue), "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_MODULE_LOCATION_INVALID");
    if (packageValue.name !== "mission-control") fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_MODULE_LOCATION_INVALID");
  } catch (error) {
    if (error instanceof ProductBuildAuthorityV2DeliveryEvidenceError) throw error;
    fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_MODULE_LOCATION_INVALID");
  }
  return root;
}

async function trustedGitText(root: string, args: readonly string[]): Promise<string> {
  try {
    const result = await execFile(TRUSTED_GIT_EXECUTABLE, ["-C", root, ...args], {
      encoding: "utf8",
      env: trustedGitEnvironment(),
      maxBuffer: 1024 * 1024,
    });
    return result.stdout.trim();
  } catch (error) {
    if (error instanceof ProductBuildAuthorityV2DeliveryEvidenceError) throw error;
    fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_NOT_CURRENT");
  }
}

async function trustedGitBytes(root: string, args: readonly string[]): Promise<Buffer> {
  try {
    const result = await execFile(TRUSTED_GIT_EXECUTABLE, ["-C", root, ...args], {
      encoding: "buffer",
      env: trustedGitEnvironment(),
      maxBuffer: 8 * 1024 * 1024,
    } as never) as Readonly<{ stdout: Buffer | string }>;
    return Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout, "utf8");
  } catch (error) {
    if (error instanceof ProductBuildAuthorityV2DeliveryEvidenceError) throw error;
    fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_NOT_CURRENT");
  }
}

async function isMergeAncestor(root: string, ancestor: string, descendant: string): Promise<boolean> {
  try {
    await trustedGitText(root, ["merge-base", "--is-ancestor", ancestor, descendant]);
    return true;
  } catch (error) {
    if (error instanceof ProductBuildAuthorityV2DeliveryEvidenceError
      && error.code === "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_GIT_ENVIRONMENT_INVALID") throw error;
    return false;
  }
}

async function builtFiles(root: string, directory: "dist" | "dist-server"): Promise<readonly string[]> {
  const directoryPath = resolve(root, directory);
  const entries: string[] = [];
  async function visit(current: string): Promise<void> {
    const members = await readdir(current, { withFileTypes: true });
    for (const member of members) {
      const memberPath = resolve(current, member.name);
      if (member.isDirectory()) await visit(memberPath);
      else if (member.isFile()) {
        const repositoryRelativePath = relative(root, memberPath).split("\\").join("/");
        if (repositoryRelativePath !== BUILD_IDENTITY_RELATIVE_PATH) entries.push(repositoryRelativePath);
      } else fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_BUILD_CONTENT_INVALID");
    }
  }
  try {
    if (!(await stat(directoryPath)).isDirectory()) fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_BUILD_IDENTITY_INVALID");
    await visit(directoryPath);
  } catch (error) {
    if (error instanceof ProductBuildAuthorityV2DeliveryEvidenceError) throw error;
    fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_BUILD_IDENTITY_INVALID");
  }
  return entries.sort();
}

async function currentBuildHash(root: string): Promise<string> {
  const contentHash = createHash("sha256");
  contentHash.update("mission-control.internal-production-build-content.v1\0", "utf8");
  for (const filePath of [...await builtFiles(root, "dist"), ...await builtFiles(root, "dist-server")].sort()) {
    const bytes = await readFile(resolve(root, filePath));
    contentHash.update(filePath, "utf8");
    contentHash.update("\0", "utf8");
    contentHash.update(String(bytes.byteLength), "utf8");
    contentHash.update("\0", "utf8");
    contentHash.update(bytes);
    contentHash.update("\0", "utf8");
  }
  return contentHash.digest("hex");
}

async function captureProductBuildAuthorityV2LoadedBuildV1(): Promise<ProductBuildAuthorityV2LoadedBuildResponseV1> {
  const modulePath = await realpath(fileURLToPath(import.meta.url));
  const servicesDirectory = dirname(modulePath);
  const buildDirectory = dirname(servicesDirectory);
  if (basename(modulePath) !== basename(LOADED_BUILD_ENTRY_MODULE_PATH)
    || basename(servicesDirectory) !== "services"
    || basename(buildDirectory) !== "dist-server") {
    fail(PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID_CODE);
  }
  const root = dirname(buildDirectory);
  if (relative(root, modulePath).split("\\").join("/") !== LOADED_BUILD_ENTRY_MODULE_PATH) {
    fail(PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID_CODE);
  }
  const packagePath = resolve(root, "package.json");
  let identityBytes: Buffer;
  let entryModuleBytes: Buffer;
  let identityValue: unknown;
  try {
    if (await realpath(packagePath) !== packagePath) {
      fail(PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID_CODE);
    }
    const packageValue = strictRecord(
      JSON.parse(await readFile(packagePath, "utf8")),
      PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID_CODE,
    );
    if (packageValue.name !== "mission-control") {
      fail(PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID_CODE);
    }
    identityBytes = await readFile(resolve(root, BUILD_IDENTITY_RELATIVE_PATH));
    entryModuleBytes = await readFile(modulePath);
    identityValue = JSON.parse(identityBytes.toString("utf8"));
  } catch {
    fail(PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID_CODE);
  }
  const identity = strictRecord(
    identityValue,
    PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID_CODE,
  );
  exactKeys(
    identity,
    ["schema", "sourceSha", "treeHash", "buildHash"],
    PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID_CODE,
  );
  if (identity.schema !== PRODUCT_BUILD_AUTHORITY_V2_BUILD_IDENTITY_SCHEMA_V1) {
    fail(PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID_CODE);
  }
  const buildIdentity = deepFreeze({
    schema: PRODUCT_BUILD_AUTHORITY_V2_BUILD_IDENTITY_SCHEMA_V1,
    sourceSha: gitHashValue(
      identity.sourceSha,
      PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID_CODE,
    ),
    treeHash: gitHashValue(
      identity.treeHash,
      PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID_CODE,
    ),
    buildHash: sha256Value(
      identity.buildHash,
      PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID_CODE,
    ),
  });
  if (buildIdentity.buildHash !== await currentBuildHash(root)) {
    fail(PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID_CODE);
  }
  const [terminalIdentityBytes, terminalEntryModuleBytes] = await Promise.all([
    readFile(resolve(root, BUILD_IDENTITY_RELATIVE_PATH)),
    readFile(modulePath),
  ]);
  if (!identityBytes.equals(terminalIdentityBytes) || !entryModuleBytes.equals(terminalEntryModuleBytes)) {
    fail(PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID_CODE);
  }
  const loadedBuild = deepFreeze({
    schema: PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_SCHEMA_V1,
    entryModulePath: LOADED_BUILD_ENTRY_MODULE_PATH,
    entryModuleHash: sha256Bytes(entryModuleBytes),
    buildIdentity,
    buildIdentityHash: sha256Bytes(identityBytes),
  });
  const loadedBuildHash = hashCanonicalJson(loadedBuild);
  const instanceId = randomUUID();
  if (!UUID_V4.test(instanceId) || !Number.isSafeInteger(process.pid) || process.pid <= 0) {
    fail(PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID_CODE);
  }
  return deepFreeze({
    schema: PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_RESPONSE_SCHEMA_V1,
    loadedBuildRef: `${LOADED_BUILD_REF_PREFIX}${loadedBuildHash}`,
    loadedBuildHash,
    startupInstance: deepFreeze({
      schema: PRODUCT_BUILD_AUTHORITY_V2_STARTUP_INSTANCE_SCHEMA_V1,
      pid: process.pid,
      instanceId,
    }),
    loadedBuild,
  });
}

async function assertAuthenticatedCurrentBuild(root: string): Promise<AuthenticatedCurrentBuildV1> {
  const topLevel = await trustedGitText(root, ["rev-parse", "--show-toplevel"]);
  let canonicalTopLevel: string;
  try {
    canonicalTopLevel = await realpath(topLevel);
  } catch {
    fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_NOT_CURRENT");
  }
  if (canonicalTopLevel !== root) fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_NOT_CURRENT");
  const [branch, cleanStatus, sha, originMainSha, treeHash] = await Promise.all([
    trustedGitText(root, ["branch", "--show-current"]),
    trustedGitText(root, ["status", "--porcelain=v1", "--untracked-files=all"]),
    trustedGitText(root, ["rev-parse", "HEAD"]),
    trustedGitText(root, ["rev-parse", "refs/remotes/origin/main"]),
    trustedGitText(root, ["rev-parse", "HEAD^{tree}"]),
  ]);
  if (branch !== "main" || cleanStatus !== "" || sha !== originMainSha || !(await isMergeAncestor(root, DELIVERY_MERGE_SHA, sha))) {
    fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_NOT_CURRENT");
  }
  let identityBytes: Buffer;
  let identityValue: unknown;
  try {
    identityBytes = await readFile(resolve(root, BUILD_IDENTITY_RELATIVE_PATH));
    identityValue = JSON.parse(identityBytes.toString("utf8"));
  } catch {
    fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_BUILD_IDENTITY_INVALID");
  }
  const identity = strictRecord(identityValue, "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_BUILD_IDENTITY_INVALID");
  exactKeys(identity, ["schema", "sourceSha", "treeHash", "buildHash"],
    "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_BUILD_IDENTITY_INVALID");
  if (identity.schema !== PRODUCT_BUILD_AUTHORITY_V2_BUILD_IDENTITY_SCHEMA_V1
    || gitHashValue(identity.sourceSha, "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_BUILD_IDENTITY_INVALID") !== sha
    || gitHashValue(identity.treeHash, "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_BUILD_IDENTITY_INVALID") !== treeHash) {
    fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_BUILD_IDENTITY_INVALID");
  }
  const buildHash = sha256Value(identity.buildHash, "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_BUILD_IDENTITY_INVALID");
  if (buildHash !== await currentBuildHash(root)) fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_BUILD_IDENTITY_INVALID");
  return deepFreeze({
    topLevel: canonicalTopLevel,
    branch: "main",
    cleanStatus: "",
    sha,
    originMainSha,
    treeHash,
    buildHash,
    buildIdentityHash: sha256Bytes(identityBytes),
  });
}

function sameAttestation(first: AuthenticatedCurrentBuildV1, final: AuthenticatedCurrentBuildV1): boolean {
  return first.topLevel === final.topLevel
    && first.branch === final.branch
    && first.cleanStatus === final.cleanStatus
    && first.sha === final.sha
    && first.originMainSha === final.originMainSha
    && first.treeHash === final.treeHash
    && first.buildHash === final.buildHash
    && first.buildIdentityHash === final.buildIdentityHash;
}

async function pinnedBlobIdentity(root: string, sourceSha: string, filePath: string): Promise<ProductBuildAuthorityV2PathBlobIdentityV1> {
  const bytes = await trustedGitBytes(root, ["show", `${sourceSha}:${filePath}`]);
  return deepFreeze({ path: filePath, blobHash: sha256Bytes(bytes) });
}

async function pinnedBlobBytes(root: string, sourceSha: string, filePath: string): Promise<Buffer> {
  return trustedGitBytes(root, ["show", `${sourceSha}:${filePath}`]);
}

function asDeliveredPathBlobs(values: readonly ProductBuildAuthorityV2PathBlobIdentityV1[]): ProductBuildAuthorityV2DeliveredPathBlobsV1 {
  if (values.length !== DELIVERED_PATHS.length) fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_PATH_BLOBS_INVALID");
  return deepFreeze([
    values[0]!, values[1]!, values[2]!, values[3]!, values[4]!, values[5]!, values[6]!, values[7]!,
  ]);
}

async function focusedTests(root: string, deliveredPathBlobs: ProductBuildAuthorityV2DeliveredPathBlobsV1): Promise<ProductBuildAuthorityV2FocusedTestReceiptV1> {
  try {
    await execFile(process.execPath, [...FOCUSED_ARGV.slice(1)], {
      cwd: root,
      env: TRUSTED_FOCUSED_TEST_ENVIRONMENT,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      timeout: FOCUSED_TEST_TIMEOUT_MS,
      killSignal: "SIGKILL",
    });
  } catch {
    fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_FOCUSED_TESTS_FAILED");
  }
  const testPathBlobs = deepFreeze([deliveredPathBlobs[0], deliveredPathBlobs[3], deliveredPathBlobs[6]] as const);
  const receiptCore = deepFreeze({
    schema: FOCUSED_TEST_RECEIPT_SCHEMA,
    argv: FOCUSED_ARGV,
    commandContractHash: hashCanonicalJson({ argv: FOCUSED_ARGV }),
    testPathBlobs,
    exitCode: 0 as const,
    passed: true as const,
  });
  const focusedTestReceiptHash = hashCanonicalJson(receiptCore);
  return deepFreeze({
    ...receiptCore,
    focusedTestReceiptRef: `${FOCUSED_TEST_RECEIPT_REF_PREFIX}${focusedTestReceiptHash}`,
    focusedTestReceiptHash,
  });
}

function asVendorArtifacts(values: readonly ProductBuildAuthorityV2VendorArtifactIdentityV1[]): ProductBuildAuthorityV2VendorArtifactIdentitiesV1 {
  if (values.length !== VENDOR_ARTIFACT_PATHS.length) fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_VENDOR_LOCK_INVALID");
  return deepFreeze([
    values[0]!, values[1]!, values[2]!, values[3]!, values[4]!, values[5]!, values[6]!, values[7]!, values[8]!, values[9]!, values[10]!, values[11]!,
  ]);
}

function vendorLock(lockBytes: Buffer, lockContentHash: string): ProductBuildAuthorityV2VendorLockProjectionV1 {
  let lockValue: unknown;
  try {
    lockValue = JSON.parse(lockBytes.toString("utf8"));
  } catch {
    fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_VENDOR_LOCK_INVALID");
  }
  const lock = strictRecord(lockValue, "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_VENDOR_LOCK_INVALID");
  exactKeys(lock, ["schema", "producerRepository", "producerCommit", "artifacts"],
    "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_VENDOR_LOCK_INVALID");
  if (lock.schema !== "mission-control.setfarm-contract-vendor-lock.v1"
    || lock.producerRepository !== "https://github.com/hikmetgulsesli/setfarm.git") {
    fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_VENDOR_LOCK_INVALID");
  }
  const producerCommit = gitHashValue(lock.producerCommit, "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_VENDOR_LOCK_INVALID");
  if (!Array.isArray(lock.artifacts) || lock.artifacts.length !== VENDOR_ARTIFACT_PATHS.length) {
    fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_VENDOR_LOCK_INVALID");
  }
  const artifacts = asVendorArtifacts(lock.artifacts.map((candidate, index) => {
    const artifact = strictRecord(candidate, "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_VENDOR_LOCK_INVALID");
    exactKeys(artifact, ["producerPath", "vendoredPath", "sha256"], "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_VENDOR_LOCK_INVALID");
    const expected = VENDOR_ARTIFACT_PATHS[index];
    if (expected === undefined
      || typeof artifact.producerPath !== "string"
      || typeof artifact.vendoredPath !== "string"
      || artifact.producerPath !== expected[0]
      || artifact.vendoredPath !== expected[1]) {
      fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_VENDOR_LOCK_INVALID");
    }
    return deepFreeze({
      producerPath: artifact.producerPath,
      vendoredPath: artifact.vendoredPath,
      sha256: sha256Value(artifact.sha256, "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_VENDOR_LOCK_INVALID"),
    });
  }));
  const compatibilitySetHash = hashCanonicalJson({ schema: VENDOR_COMPATIBILITY_SET_SCHEMA, artifacts });
  const projectionCore = deepFreeze({
    schema: VENDOR_LOCK_SCHEMA,
    lockPath: VENDOR_LOCK_PATH,
    producerRepository: "https://github.com/hikmetgulsesli/setfarm.git" as const,
    producerCommit,
    lockContentHash,
    artifacts,
    compatibilitySetHash,
  });
  return deepFreeze({ ...projectionCore, vendorLockProjectionHash: hashCanonicalJson(projectionCore) });
}

async function observeCurrentEvidence(): Promise<ProductBuildAuthorityV2DeliveryEvidenceV1> {
  const root = await repositoryRootFromModule();
  const firstAttestation = await assertAuthenticatedCurrentBuild(root);
  const deliveredPathBlobs = asDeliveredPathBlobs(await Promise.all(
    DELIVERED_PATHS.map((filePath) => pinnedBlobIdentity(root, firstAttestation.sha, filePath)),
  ));
  const lockBytes = await pinnedBlobBytes(root, firstAttestation.sha, VENDOR_LOCK_PATH);
  const focusedTestReceipt = await focusedTests(root, deliveredPathBlobs);
  const finalAttestation = await assertAuthenticatedCurrentBuild(root);
  if (!sameAttestation(firstAttestation, finalAttestation)) {
    fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_SOURCE_CHANGED_DURING_OBSERVATION");
  }
  const lock = vendorLock(lockBytes, deliveredPathBlobs[7].blobHash);
  const evidenceCore = deepFreeze({
    schema: PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_SCHEMA_V1,
    currentStatus: PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_CURRENT_STATUS_V1,
    deliveryPrNumber: DELIVERY_PR_NUMBER,
    deliveryMergeSha: DELIVERY_MERGE_SHA,
    deliveryMergeAncestorOfCurrentSource: true as const,
    currentSource: deepFreeze({
      branch: "main" as const,
      clean: true as const,
      sha: firstAttestation.sha,
      treeHash: firstAttestation.treeHash,
      buildHash: firstAttestation.buildHash,
      originMainSha: firstAttestation.originMainSha,
    }),
    deliveredPathBlobs,
    focusedTests: focusedTestReceipt,
    vendorLock: lock,
  });
  const deliveryEvidenceHash = hashCanonicalJson(evidenceCore);
  return deepFreeze({
    ...evidenceCore,
    deliveryEvidenceRef: `${DELIVERY_EVIDENCE_REF_PREFIX}${deliveryEvidenceHash}`,
    deliveryEvidenceHash,
  });
}

function validPair(input: ProductBuildAuthorityV2DeliveryEvidencePairV1): ProductBuildAuthorityV2DeliveryEvidencePairV1 {
  const pair = strictRecord(input, "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_PAIR_INVALID");
  exactKeys(pair, ["deliveryEvidenceRef", "deliveryEvidenceHash"], "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_PAIR_INVALID");
  const deliveryEvidenceHash = sha256Value(pair.deliveryEvidenceHash, "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_PAIR_INVALID");
  if (pair.deliveryEvidenceRef !== `${DELIVERY_EVIDENCE_REF_PREFIX}${deliveryEvidenceHash}`) {
    fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_PAIR_INVALID");
  }
  return deepFreeze({ deliveryEvidenceRef: pair.deliveryEvidenceRef as string, deliveryEvidenceHash });
}

export async function observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1(): Promise<ProductBuildAuthorityV2DeliveryEvidenceV1> {
  return observeCurrentEvidence();
}

export async function resolveProductBuildAuthorityV2DeliveryEvidenceV1(
  input: ProductBuildAuthorityV2DeliveryEvidencePairV1,
): Promise<ProductBuildAuthorityV2DeliveryEvidenceV1> {
  const pair = validPair(input);
  const evidence = await observeCurrentEvidence();
  if (evidence.deliveryEvidenceRef !== pair.deliveryEvidenceRef || evidence.deliveryEvidenceHash !== pair.deliveryEvidenceHash) {
    fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_NOT_CURRENT");
  }
  return evidence;
}

async function createCurrentProductBuildAuthorityV2DeliveryEvidenceResponseV1(): Promise<ProductBuildAuthorityV2DeliveryEvidenceResponseV1> {
  const evidence = await observeCurrentEvidence();
  return deepFreeze({
    schema: PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_RESPONSE_SCHEMA_V1,
    currentStatus: PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_CURRENT_STATUS_V1,
    deliveryEvidenceRef: evidence.deliveryEvidenceRef,
    deliveryEvidenceHash: evidence.deliveryEvidenceHash,
    evidence,
  });
}

let currentProductBuildAuthorityV2DeliveryEvidenceAttemptV1:
  Promise<ProductBuildAuthorityV2DeliveryEvidenceResponseV1> | null = null;

export function currentProductBuildAuthorityV2DeliveryEvidenceResponseV1(): Promise<ProductBuildAuthorityV2DeliveryEvidenceResponseV1> {
  const existing = currentProductBuildAuthorityV2DeliveryEvidenceAttemptV1;
  if (existing !== null) return existing;

  const attempt = createCurrentProductBuildAuthorityV2DeliveryEvidenceResponseV1();
  currentProductBuildAuthorityV2DeliveryEvidenceAttemptV1 = attempt;
  void attempt.then(
    () => {
      if (currentProductBuildAuthorityV2DeliveryEvidenceAttemptV1 === attempt) {
        currentProductBuildAuthorityV2DeliveryEvidenceAttemptV1 = null;
      }
    },
    () => {
      if (currentProductBuildAuthorityV2DeliveryEvidenceAttemptV1 === attempt) {
        currentProductBuildAuthorityV2DeliveryEvidenceAttemptV1 = null;
      }
    },
  );
  return attempt;
}

const productBuildAuthorityV2LoadedBuildStartupState = await captureProductBuildAuthorityV2LoadedBuildV1()
  .then((response): ProductBuildAuthorityV2LoadedBuildStartupStateV1 => deepFreeze({ status: "available", response }))
  .catch((): ProductBuildAuthorityV2LoadedBuildStartupStateV1 => deepFreeze({
    status: "unavailable",
    code: PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID_CODE,
  }));

export function productBuildAuthorityV2LoadedBuildStartupStateV1(): ProductBuildAuthorityV2LoadedBuildStartupStateV1 {
  return productBuildAuthorityV2LoadedBuildStartupState;
}

async function runCli(): Promise<void> {
  if (process.argv.slice(2).length !== 1 || process.argv[2] !== "--json") {
    fail("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_CLI_ARGUMENT_INVALID");
  }
  process.stdout.write(`${JSON.stringify(await currentProductBuildAuthorityV2DeliveryEvidenceResponseV1())}\n`);
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  void runCli().catch((error: unknown) => {
    const code = error instanceof ProductBuildAuthorityV2DeliveryEvidenceError
      ? error.code
      : "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_UNAVAILABLE";
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  });
}
