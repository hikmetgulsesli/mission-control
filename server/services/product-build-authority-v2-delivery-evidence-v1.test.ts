import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type {
  ProductBuildAuthorityV2DeliveryEvidenceV1,
  ProductBuildAuthorityV2PathBlobIdentityV1,
  ProductBuildAuthorityV2VendorArtifactIdentityV1,
  ProductBuildAuthorityV2VendorLockProjectionV1,
} from "./product-build-authority-v2-delivery-evidence-v1.js";

const DELIVERY_EVIDENCE_REF =
  `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${"a".repeat(64)}`;
const DELIVERY_EVIDENCE_HASH = "a".repeat(64);
const BRANCH_REFUSAL_CODE = "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_NOT_CURRENT";
const PAIR_INVALID_CODE = "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_PAIR_INVALID";

function reconciliationBranch(): boolean {
  return execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim()
    === "fix/internal-production-baseline-reconciliation";
}

function runDeliveryEvidenceCli(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<Readonly<{ exitCode: number; stdout: string; stderr: string }>> {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "--silent", "internal:product-build-authority-v2-delivery-evidence", "--", "--json"], {
      cwd: new URL("../..", import.meta.url),
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (exitCode) => resolve({ exitCode: exitCode ?? -1, stdout, stderr }));
  });
}

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;
type Assert<Type extends true> = Type;
type ExactDeliveredPathBlobs = readonly [
  ProductBuildAuthorityV2PathBlobIdentityV1,
  ProductBuildAuthorityV2PathBlobIdentityV1,
  ProductBuildAuthorityV2PathBlobIdentityV1,
  ProductBuildAuthorityV2PathBlobIdentityV1,
  ProductBuildAuthorityV2PathBlobIdentityV1,
  ProductBuildAuthorityV2PathBlobIdentityV1,
  ProductBuildAuthorityV2PathBlobIdentityV1,
  ProductBuildAuthorityV2PathBlobIdentityV1,
];
type ExactVendorArtifacts = readonly [
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
type _DeliveredPathsAreExactTuple = Assert<Equal<
  ProductBuildAuthorityV2DeliveryEvidenceV1["deliveredPathBlobs"],
  ExactDeliveredPathBlobs
>>;
type _VendorArtifactsAreExactTuple = Assert<Equal<
  ProductBuildAuthorityV2VendorLockProjectionV1["artifacts"],
  ExactVendorArtifacts
>>;

const PRIVATE_DELIVERED_PATHS = [
  ["server/routes/setfarm-operational.test.ts", "4"],
  ["server/routes/setfarm-operational.ts", "5"],
  ["server/services/setfarm-product-build-authority.ts", "6"],
  ["server/services/setfarm-product-build-authority.test.ts", "7"],
  ["src/lib/product-build-authority.ts", "8"],
  ["src/components/run-detail/ProductBuildAuthority.tsx", "9"],
  ["tests/product-build-authority-render.test.tsx", "a"],
  ["contracts/vendor/setfarm/mission-control-contracts.v1.lock.json", "b"],
] as const;

const PRIVATE_VENDOR_ARTIFACTS = [
  ["contracts/generated/mission-control/run-operational-snapshot.v1.compatibility.json", "contracts/vendor/setfarm/run-operational-snapshot.v1.compatibility.json", "d"],
  ["contracts/generated/mission-control/run-operational-snapshot.v1.schema.json", "contracts/vendor/setfarm/run-operational-snapshot.v1.schema.json", "e"],
  ["contracts/generated/mission-control/run-operational-snapshot.v2.compatibility.json", "contracts/vendor/setfarm/run-operational-snapshot.v2.compatibility.json", "f"],
  ["contracts/generated/mission-control/run-operational-snapshot.v2.schema.json", "contracts/vendor/setfarm/run-operational-snapshot.v2.schema.json", "0"],
  ["contracts/generated/mission-control/run-operational-snapshot.v3.compatibility.json", "contracts/vendor/setfarm/run-operational-snapshot.v3.compatibility.json", "1"],
  ["contracts/generated/mission-control/run-operational-snapshot.v3.schema.json", "contracts/vendor/setfarm/run-operational-snapshot.v3.schema.json", "2"],
  ["contracts/generated/mission-control/deployment-observation.v1.compatibility.json", "contracts/vendor/setfarm/deployment-observation.v1.compatibility.json", "3"],
  ["contracts/generated/mission-control/deployment-observation.v1.schema.json", "contracts/vendor/setfarm/deployment-observation.v1.schema.json", "4"],
  ["contracts/generated/mission-control/project-transfer-ack.v1.compatibility.json", "contracts/vendor/setfarm/project-transfer-ack.v1.compatibility.json", "5"],
  ["contracts/generated/mission-control/project-transfer-ack.v1.schema.json", "contracts/vendor/setfarm/project-transfer-ack.v1.schema.json", "6"],
  ["contracts/generated/mission-control/operational-active-run-status.v1.compatibility.json", "contracts/vendor/setfarm/operational-active-run-status.v1.compatibility.json", "7"],
  ["contracts/generated/mission-control/operational-active-run-status.v1.schema.json", "contracts/vendor/setfarm/operational-active-run-status.v1.schema.json", "8"],
] as const;

const PRIVATE_COMMAND_HASH = "0db837757920ce51b060993d379611fba899058e3ab9272888ab92d81fc5093b";
const PRIVATE_FOCUSED_HASH = "d279cd2e9b2c984bbc4e290b4d7e608fad7502e92bd9f4df06a012afa0e1e667";
const PRIVATE_COMPATIBILITY_HASH = "d81f264f01999758c95d6ce30a3312f67ce1fb9309daf0dcb1a0711c665a4407";
const PRIVATE_VENDOR_HASH = "c98a5ac68d8f6b2c9653a8f64fb6d4142f2245862c630a8b79c96a5403fd3471";
const PRIVATE_EVIDENCE_HASH = "f72e19755f5ab92a0053b5779d5dc2c49e6008e1426c0b32171bb409256c6424";
const PRIVATE_EVIDENCE_CORE_CANONICAL_BYTES = Buffer.from(
  "eyJjdXJyZW50U291cmNlIjp7ImJyYW5jaCI6Im1haW4iLCJidWlsZEhhc2giOiIzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzIiwiY2xlYW4iOnRydWUsIm9yaWdpbk1haW5TaGEiOiIxMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExIiwic2hhIjoiMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMSIsInRyZWVIYXNoIjoiMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMiJ9LCJjdXJyZW50U3RhdHVzIjoiY3VycmVudCIsImRlbGl2ZXJlZFBhdGhCbG9icyI6W3siYmxvYkhhc2giOiI0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0IiwicGF0aCI6InNlcnZlci9yb3V0ZXMvc2V0ZmFybS1vcGVyYXRpb25hbC50ZXN0LnRzIn0seyJibG9iSGFzaCI6IjU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTUiLCJwYXRoIjoic2VydmVyL3JvdXRlcy9zZXRmYXJtLW9wZXJhdGlvbmFsLnRzIn0seyJibG9iSGFzaCI6IjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjYiLCJwYXRoIjoic2VydmVyL3NlcnZpY2VzL3NldGZhcm0tcHJvZHVjdC1idWlsZC1hdXRob3JpdHkudHMifSx7ImJsb2JIYXNoIjoiNzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3NyIsInBhdGgiOiJzZXJ2ZXIvc2VydmljZXMvc2V0ZmFybS1wcm9kdWN0LWJ1aWxkLWF1dGhvcml0eS50ZXN0LnRzIn0seyJibG9iSGFzaCI6Ijg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODgiLCJwYXRoIjoic3JjL2xpYi9wcm9kdWN0LWJ1aWxkLWF1dGhvcml0eS50cyJ9LHsiYmxvYkhhc2giOiI5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5IiwicGF0aCI6InNyYy9jb21wb25lbnRzL3J1bi1kZXRhaWwvUHJvZHVjdEJ1aWxkQXV0aG9yaXR5LnRzeCJ9LHsiYmxvYkhhc2giOiJhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhIiwicGF0aCI6InRlc3RzL3Byb2R1Y3QtYnVpbGQtYXV0aG9yaXR5LXJlbmRlci50ZXN0LnRzeCJ9LHsiYmxvYkhhc2giOiJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiIiwicGF0aCI6ImNvbnRyYWN0cy92ZW5kb3Ivc2V0ZmFybS9taXNzaW9uLWNvbnRyb2wtY29udHJhY3RzLnYxLmxvY2suanNvbiJ9XSwiZGVsaXZlcnlNZXJnZUFuY2VzdG9yT2ZDdXJyZW50U291cmNlIjp0cnVlLCJkZWxpdmVyeU1lcmdlU2hhIjoiMjQwZTc3OWQ3ODgwNDg0M2ExMjAyY2JmMDQ0MGZlNDIzYjgwNmIxYSIsImRlbGl2ZXJ5UHJOdW1iZXIiOjE5LCJmb2N1c2VkVGVzdHMiOnsiYXJndiI6WyJub2RlIiwiLS1pbXBvcnQiLCJ0c3giLCItLXRlc3QiLCJzZXJ2ZXIvcm91dGVzL3NldGZhcm0tb3BlcmF0aW9uYWwudGVzdC50cyIsInNlcnZlci9zZXJ2aWNlcy9zZXRmYXJtLXByb2R1Y3QtYnVpbGQtYXV0aG9yaXR5LnRlc3QudHMiLCJ0ZXN0cy9wcm9kdWN0LWJ1aWxkLWF1dGhvcml0eS1yZW5kZXIudGVzdC50c3giXSwiY29tbWFuZENvbnRyYWN0SGFzaCI6IjBkYjgzNzc1NzkyMGNlNTFiMDYwOTkzZDM3OTYxMWZiYTg5OTA1OGUzYWI5MjcyODg4YWI5MmQ4MWZjNTA5M2IiLCJleGl0Q29kZSI6MCwiZm9jdXNlZFRlc3RSZWNlaXB0SGFzaCI6ImQyNzljZDJlOWIyYzk4NGJiYzRlMjkwYjRkN2U2MDhmYWQ3NTAyZTkyYmQ5ZjRkZjA2YTAxMmFmYTBlMWU2NjciLCJmb2N1c2VkVGVzdFJlY2VpcHRSZWYiOiJtaXNzaW9uLWNvbnRyb2w6Ly9pbnRlcm5hbC1wcm9kdWN0aW9uL3Byb2R1Y3QtYnVpbGQtYXV0aG9yaXR5LXYyLWZvY3VzZWQtdGVzdC1yZWNlaXB0L3NoYTI1Ni9kMjc5Y2QyZTliMmM5ODRiYmM0ZTI5MGI0ZDdlNjA4ZmFkNzUwMmU5MmJkOWY0ZGYwNmEwMTJhZmEwZTFlNjY3IiwicGFzc2VkIjp0cnVlLCJzY2hlbWEiOiJtaXNzaW9uLWNvbnRyb2wucHJvZHVjdC1idWlsZC1hdXRob3JpdHktdjItZm9jdXNlZC10ZXN0LXJlY2VpcHQudjEiLCJ0ZXN0UGF0aEJsb2JzIjpbeyJibG9iSGFzaCI6IjQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQiLCJwYXRoIjoic2VydmVyL3JvdXRlcy9zZXRmYXJtLW9wZXJhdGlvbmFsLnRlc3QudHMifSx7ImJsb2JIYXNoIjoiNzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3NyIsInBhdGgiOiJzZXJ2ZXIvc2VydmljZXMvc2V0ZmFybS1wcm9kdWN0LWJ1aWxkLWF1dGhvcml0eS50ZXN0LnRzIn0seyJibG9iSGFzaCI6ImFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWEiLCJwYXRoIjoidGVzdHMvcHJvZHVjdC1idWlsZC1hdXRob3JpdHktcmVuZGVyLnRlc3QudHN4In1dfSwic2NoZW1hIjoibWlzc2lvbi1jb250cm9sLnByb2R1Y3QtYnVpbGQtYXV0aG9yaXR5LXYyLWRlbGl2ZXJ5LWV2aWRlbmNlLnYxIiwidmVuZG9yTG9jayI6eyJhcnRpZmFjdHMiOlt7InByb2R1Y2VyUGF0aCI6ImNvbnRyYWN0cy9nZW5lcmF0ZWQvbWlzc2lvbi1jb250cm9sL3J1bi1vcGVyYXRpb25hbC1zbmFwc2hvdC52MS5jb21wYXRpYmlsaXR5Lmpzb24iLCJzaGEyNTYiOiJkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkIiwidmVuZG9yZWRQYXRoIjoiY29udHJhY3RzL3ZlbmRvci9zZXRmYXJtL3J1bi1vcGVyYXRpb25hbC1zbmFwc2hvdC52MS5jb21wYXRpYmlsaXR5Lmpzb24ifSx7InByb2R1Y2VyUGF0aCI6ImNvbnRyYWN0cy9nZW5lcmF0ZWQvbWlzc2lvbi1jb250cm9sL3J1bi1vcGVyYXRpb25hbC1zbmFwc2hvdC52MS5zY2hlbWEuanNvbiIsInNoYTI1NiI6ImVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWUiLCJ2ZW5kb3JlZFBhdGgiOiJjb250cmFjdHMvdmVuZG9yL3NldGZhcm0vcnVuLW9wZXJhdGlvbmFsLXNuYXBzaG90LnYxLnNjaGVtYS5qc29uIn0seyJwcm9kdWNlclBhdGgiOiJjb250cmFjdHMvZ2VuZXJhdGVkL21pc3Npb24tY29udHJvbC9ydW4tb3BlcmF0aW9uYWwtc25hcHNob3QudjIuY29tcGF0aWJpbGl0eS5qc29uIiwic2hhMjU2IjoiZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZiIsInZlbmRvcmVkUGF0aCI6ImNvbnRyYWN0cy92ZW5kb3Ivc2V0ZmFybS9ydW4tb3BlcmF0aW9uYWwtc25hcHNob3QudjIuY29tcGF0aWJpbGl0eS5qc29uIn0seyJwcm9kdWNlclBhdGgiOiJjb250cmFjdHMvZ2VuZXJhdGVkL21pc3Npb24tY29udHJvbC9ydW4tb3BlcmF0aW9uYWwtc25hcHNob3QudjIuc2NoZW1hLmpzb24iLCJzaGEyNTYiOiIwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwIiwidmVuZG9yZWRQYXRoIjoiY29udHJhY3RzL3ZlbmRvci9zZXRmYXJtL3J1bi1vcGVyYXRpb25hbC1zbmFwc2hvdC52Mi5zY2hlbWEuanNvbiJ9LHsicHJvZHVjZXJQYXRoIjoiY29udHJhY3RzL2dlbmVyYXRlZC9taXNzaW9uLWNvbnRyb2wvcnVuLW9wZXJhdGlvbmFsLXNuYXBzaG90LnYzLmNvbXBhdGliaWxpdHkuanNvbiIsInNoYTI1NiI6IjExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTEiLCJ2ZW5kb3JlZFBhdGgiOiJjb250cmFjdHMvdmVuZG9yL3NldGZhcm0vcnVuLW9wZXJhdGlvbmFsLXNuYXBzaG90LnYzLmNvbXBhdGliaWxpdHkuanNvbiJ9LHsicHJvZHVjZXJQYXRoIjoiY29udHJhY3RzL2dlbmVyYXRlZC9taXNzaW9uLWNvbnRyb2wvcnVuLW9wZXJhdGlvbmFsLXNuYXBzaG90LnYzLnNjaGVtYS5qc29uIiwic2hhMjU2IjoiMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMiIsInZlbmRvcmVkUGF0aCI6ImNvbnRyYWN0cy92ZW5kb3Ivc2V0ZmFybS9ydW4tb3BlcmF0aW9uYWwtc25hcHNob3QudjMuc2NoZW1hLmpzb24ifSx7InByb2R1Y2VyUGF0aCI6ImNvbnRyYWN0cy9nZW5lcmF0ZWQvbWlzc2lvbi1jb250cm9sL2RlcGxveW1lbnQtb2JzZXJ2YXRpb24udjEuY29tcGF0aWJpbGl0eS5qc29uIiwic2hhMjU2IjoiMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMyIsInZlbmRvcmVkUGF0aCI6ImNvbnRyYWN0cy92ZW5kb3Ivc2V0ZmFybS9kZXBsb3ltZW50LW9ic2VydmF0aW9uLnYxLmNvbXBhdGliaWxpdHkuanNvbiJ9LHsicHJvZHVjZXJQYXRoIjoiY29udHJhY3RzL2dlbmVyYXRlZC9taXNzaW9uLWNvbnRyb2wvZGVwbG95bWVudC1vYnNlcnZhdGlvbi52MS5zY2hlbWEuanNvbiIsInNoYTI1NiI6IjQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQiLCJ2ZW5kb3JlZFBhdGgiOiJjb250cmFjdHMvdmVuZG9yL3NldGZhcm0vZGVwbG95bWVudC1vYnNlcnZhdGlvbi52MS5zY2hlbWEuanNvbiJ9LHsicHJvZHVjZXJQYXRoIjoiY29udHJhY3RzL2dlbmVyYXRlZC9taXNzaW9uLWNvbnRyb2wvcHJvamVjdC10cmFuc2Zlci1hY2sudjEuY29tcGF0aWJpbGl0eS5qc29uIiwic2hhMjU2IjoiNTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NSIsInZlbmRvcmVkUGF0aCI6ImNvbnRyYWN0cy92ZW5kb3Ivc2V0ZmFybS9wcm9qZWN0LXRyYW5zZmVyLWFjay52MS5jb21wYXRpYmlsaXR5Lmpzb24ifSx7InByb2R1Y2VyUGF0aCI6ImNvbnRyYWN0cy9nZW5lcmF0ZWQvbWlzc2lvbi1jb250cm9sL3Byb2plY3QtdHJhbnNmZXItYWNrLnYxLnNjaGVtYS5qc29uIiwic2hhMjU2IjoiNjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NiIsInZlbmRvcmVkUGF0aCI6ImNvbnRyYWN0cy92ZW5kb3Ivc2V0ZmFybS9wcm9qZWN0LXRyYW5zZmVyLWFjay52MS5zY2hlbWEuanNvbiJ9LHsicHJvZHVjZXJQYXRoIjoiY29udHJhY3RzL2dlbmVyYXRlZC9taXNzaW9uLWNvbnRyb2wvb3BlcmF0aW9uYWwtYWN0aXZlLXJ1bi1zdGF0dXMudjEuY29tcGF0aWJpbGl0eS5qc29uIiwic2hhMjU2IjoiNzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3NyIsInZlbmRvcmVkUGF0aCI6ImNvbnRyYWN0cy92ZW5kb3Ivc2V0ZmFybS9vcGVyYXRpb25hbC1hY3RpdmUtcnVuLXN0YXR1cy52MS5jb21wYXRpYmlsaXR5Lmpzb24ifSx7InByb2R1Y2VyUGF0aCI6ImNvbnRyYWN0cy9nZW5lcmF0ZWQvbWlzc2lvbi1jb250cm9sL29wZXJhdGlvbmFsLWFjdGl2ZS1ydW4tc3RhdHVzLnYxLnNjaGVtYS5qc29uIiwic2hhMjU2IjoiODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4OCIsInZlbmRvcmVkUGF0aCI6ImNvbnRyYWN0cy92ZW5kb3Ivc2V0ZmFybS9vcGVyYXRpb25hbC1hY3RpdmUtcnVuLXN0YXR1cy52MS5zY2hlbWEuanNvbiJ9XSwiY29tcGF0aWJpbGl0eVNldEhhc2giOiJkODFmMjY0ZjAxOTk5NzU4Yzk1ZDZjZTMwYTMzMTJmNjdjZTFmYjkzMDlkYWYwZGNiMWEwNzExYzY2NWE0NDA3IiwibG9ja0NvbnRlbnRIYXNoIjoiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYiIsImxvY2tQYXRoIjoiY29udHJhY3RzL3ZlbmRvci9zZXRmYXJtL21pc3Npb24tY29udHJvbC1jb250cmFjdHMudjEubG9jay5qc29uIiwicHJvZHVjZXJDb21taXQiOiJjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjIiwicHJvZHVjZXJSZXBvc2l0b3J5IjoiaHR0cHM6Ly9naXRodWIuY29tL2hpa21ldGd1bHNlc2xpL3NldGZhcm0uZ2l0Iiwic2NoZW1hIjoibWlzc2lvbi1jb250cm9sLnByb2R1Y3QtYnVpbGQtYXV0aG9yaXR5LXYyLXZlbmRvci1sb2NrLXByb2plY3Rpb24udjEiLCJ2ZW5kb3JMb2NrUHJvamVjdGlvbkhhc2giOiJjOThhNWFjNjhkOGY2YjJjOTY1M2E4ZjY0ZmI2ZDQxNDJmMjI0NTg2MmM2MzBhOGI3OWM5NmE1NDAzZmQzNDcxIn19",
  "base64",
).toString("utf8");
const PRIVATE_RESPONSE_WIRE_JSON_BYTES = Buffer.from(
  "eyJzY2hlbWEiOiJtaXNzaW9uLWNvbnRyb2wucHJvZHVjdC1idWlsZC1hdXRob3JpdHktdjItZGVsaXZlcnktZXZpZGVuY2UtcmVzcG9uc2UudjEiLCJjdXJyZW50U3RhdHVzIjoiY3VycmVudCIsImRlbGl2ZXJ5RXZpZGVuY2VSZWYiOiJtaXNzaW9uLWNvbnRyb2w6Ly9pbnRlcm5hbC1wcm9kdWN0aW9uL3Byb2R1Y3QtYnVpbGQtYXV0aG9yaXR5LXYyLWRlbGl2ZXJ5LWV2aWRlbmNlL3NoYTI1Ni9mNzJlMTk3NTVmNWFiOTJhMDA1M2I1Nzc5ZDVkYzJjNDllNjAwOGUxNDI2YzBiMzIxNzFiYjQwOTI1NmM2NDI0IiwiZGVsaXZlcnlFdmlkZW5jZUhhc2giOiJmNzJlMTk3NTVmNWFiOTJhMDA1M2I1Nzc5ZDVkYzJjNDllNjAwOGUxNDI2YzBiMzIxNzFiYjQwOTI1NmM2NDI0IiwiZXZpZGVuY2UiOnsic2NoZW1hIjoibWlzc2lvbi1jb250cm9sLnByb2R1Y3QtYnVpbGQtYXV0aG9yaXR5LXYyLWRlbGl2ZXJ5LWV2aWRlbmNlLnYxIiwiY3VycmVudFN0YXR1cyI6ImN1cnJlbnQiLCJkZWxpdmVyeVByTnVtYmVyIjoxOSwiZGVsaXZlcnlNZXJnZVNoYSI6IjI0MGU3NzlkNzg4MDQ4NDNhMTIwMmNiZjA0NDBmZTQyM2I4MDZiMWEiLCJkZWxpdmVyeU1lcmdlQW5jZXN0b3JPZkN1cnJlbnRTb3VyY2UiOnRydWUsImN1cnJlbnRTb3VyY2UiOnsiYnJhbmNoIjoibWFpbiIsImNsZWFuIjp0cnVlLCJzaGEiOiIxMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExIiwidHJlZUhhc2giOiIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyIiwiYnVpbGRIYXNoIjoiMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMyIsIm9yaWdpbk1haW5TaGEiOiIxMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExIn0sImRlbGl2ZXJlZFBhdGhCbG9icyI6W3sicGF0aCI6InNlcnZlci9yb3V0ZXMvc2V0ZmFybS1vcGVyYXRpb25hbC50ZXN0LnRzIiwiYmxvYkhhc2giOiI0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0In0seyJwYXRoIjoic2VydmVyL3JvdXRlcy9zZXRmYXJtLW9wZXJhdGlvbmFsLnRzIiwiYmxvYkhhc2giOiI1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1In0seyJwYXRoIjoic2VydmVyL3NlcnZpY2VzL3NldGZhcm0tcHJvZHVjdC1idWlsZC1hdXRob3JpdHkudHMiLCJibG9iSGFzaCI6IjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjYifSx7InBhdGgiOiJzZXJ2ZXIvc2VydmljZXMvc2V0ZmFybS1wcm9kdWN0LWJ1aWxkLWF1dGhvcml0eS50ZXN0LnRzIiwiYmxvYkhhc2giOiI3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3In0seyJwYXRoIjoic3JjL2xpYi9wcm9kdWN0LWJ1aWxkLWF1dGhvcml0eS50cyIsImJsb2JIYXNoIjoiODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4OCJ9LHsicGF0aCI6InNyYy9jb21wb25lbnRzL3J1bi1kZXRhaWwvUHJvZHVjdEJ1aWxkQXV0aG9yaXR5LnRzeCIsImJsb2JIYXNoIjoiOTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OSJ9LHsicGF0aCI6InRlc3RzL3Byb2R1Y3QtYnVpbGQtYXV0aG9yaXR5LXJlbmRlci50ZXN0LnRzeCIsImJsb2JIYXNoIjoiYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYSJ9LHsicGF0aCI6ImNvbnRyYWN0cy92ZW5kb3Ivc2V0ZmFybS9taXNzaW9uLWNvbnRyb2wtY29udHJhY3RzLnYxLmxvY2suanNvbiIsImJsb2JIYXNoIjoiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYiJ9XSwiZm9jdXNlZFRlc3RzIjp7InNjaGVtYSI6Im1pc3Npb24tY29udHJvbC5wcm9kdWN0LWJ1aWxkLWF1dGhvcml0eS12Mi1mb2N1c2VkLXRlc3QtcmVjZWlwdC52MSIsImFyZ3YiOlsibm9kZSIsIi0taW1wb3J0IiwidHN4IiwiLS10ZXN0Iiwic2VydmVyL3JvdXRlcy9zZXRmYXJtLW9wZXJhdGlvbmFsLnRlc3QudHMiLCJzZXJ2ZXIvc2VydmljZXMvc2V0ZmFybS1wcm9kdWN0LWJ1aWxkLWF1dGhvcml0eS50ZXN0LnRzIiwidGVzdHMvcHJvZHVjdC1idWlsZC1hdXRob3JpdHktcmVuZGVyLnRlc3QudHN4Il0sImNvbW1hbmRDb250cmFjdEhhc2giOiIwZGI4Mzc3NTc5MjBjZTUxYjA2MDk5M2QzNzk2MTFmYmE4OTkwNThlM2FiOTI3Mjg4OGFiOTJkODFmYzUwOTNiIiwidGVzdFBhdGhCbG9icyI6W3sicGF0aCI6InNlcnZlci9yb3V0ZXMvc2V0ZmFybS1vcGVyYXRpb25hbC50ZXN0LnRzIiwiYmxvYkhhc2giOiI0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0In0seyJwYXRoIjoic2VydmVyL3NlcnZpY2VzL3NldGZhcm0tcHJvZHVjdC1idWlsZC1hdXRob3JpdHkudGVzdC50cyIsImJsb2JIYXNoIjoiNzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3NyJ9LHsicGF0aCI6InRlc3RzL3Byb2R1Y3QtYnVpbGQtYXV0aG9yaXR5LXJlbmRlci50ZXN0LnRzeCIsImJsb2JIYXNoIjoiYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYSJ9XSwiZXhpdENvZGUiOjAsInBhc3NlZCI6dHJ1ZSwiZm9jdXNlZFRlc3RSZWNlaXB0UmVmIjoibWlzc2lvbi1jb250cm9sOi8vaW50ZXJuYWwtcHJvZHVjdGlvbi9wcm9kdWN0LWJ1aWxkLWF1dGhvcml0eS12Mi1mb2N1c2VkLXRlc3QtcmVjZWlwdC9zaGEyNTYvZDI3OWNkMmU5YjJjOTg0YmJjNGUyOTBiNGQ3ZTYwOGZhZDc1MDJlOTJiZDlmNGRmMDZhMDEyYWZhMGUxZTY2NyIsImZvY3VzZWRUZXN0UmVjZWlwdEhhc2giOiJkMjc5Y2QyZTliMmM5ODRiYmM0ZTI5MGI0ZDdlNjA4ZmFkNzUwMmU5MmJkOWY0ZGYwNmEwMTJhZmEwZTFlNjY3In0sInZlbmRvckxvY2siOnsic2NoZW1hIjoibWlzc2lvbi1jb250cm9sLnByb2R1Y3QtYnVpbGQtYXV0aG9yaXR5LXYyLXZlbmRvci1sb2NrLXByb2plY3Rpb24udjEiLCJsb2NrUGF0aCI6ImNvbnRyYWN0cy92ZW5kb3Ivc2V0ZmFybS9taXNzaW9uLWNvbnRyb2wtY29udHJhY3RzLnYxLmxvY2suanNvbiIsInByb2R1Y2VyUmVwb3NpdG9yeSI6Imh0dHBzOi8vZ2l0aHViLmNvbS9oaWttZXRndWxzZXNsaS9zZXRmYXJtLmdpdCIsInByb2R1Y2VyQ29tbWl0IjoiY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjYyIsImxvY2tDb250ZW50SGFzaCI6ImJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmIiLCJhcnRpZmFjdHMiOlt7InByb2R1Y2VyUGF0aCI6ImNvbnRyYWN0cy9nZW5lcmF0ZWQvbWlzc2lvbi1jb250cm9sL3J1bi1vcGVyYXRpb25hbC1zbmFwc2hvdC52MS5jb21wYXRpYmlsaXR5Lmpzb24iLCJ2ZW5kb3JlZFBhdGgiOiJjb250cmFjdHMvdmVuZG9yL3NldGZhcm0vcnVuLW9wZXJhdGlvbmFsLXNuYXBzaG90LnYxLmNvbXBhdGliaWxpdHkuanNvbiIsInNoYTI1NiI6ImRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGQifSx7InByb2R1Y2VyUGF0aCI6ImNvbnRyYWN0cy9nZW5lcmF0ZWQvbWlzc2lvbi1jb250cm9sL3J1bi1vcGVyYXRpb25hbC1zbmFwc2hvdC52MS5zY2hlbWEuanNvbiIsInZlbmRvcmVkUGF0aCI6ImNvbnRyYWN0cy92ZW5kb3Ivc2V0ZmFybS9ydW4tb3BlcmF0aW9uYWwtc25hcHNob3QudjEuc2NoZW1hLmpzb24iLCJzaGEyNTYiOiJlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlIn0seyJwcm9kdWNlclBhdGgiOiJjb250cmFjdHMvZ2VuZXJhdGVkL21pc3Npb24tY29udHJvbC9ydW4tb3BlcmF0aW9uYWwtc25hcHNob3QudjIuY29tcGF0aWJpbGl0eS5qc29uIiwidmVuZG9yZWRQYXRoIjoiY29udHJhY3RzL3ZlbmRvci9zZXRmYXJtL3J1bi1vcGVyYXRpb25hbC1zbmFwc2hvdC52Mi5jb21wYXRpYmlsaXR5Lmpzb24iLCJzaGEyNTYiOiJmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmIn0seyJwcm9kdWNlclBhdGgiOiJjb250cmFjdHMvZ2VuZXJhdGVkL21pc3Npb24tY29udHJvbC9ydW4tb3BlcmF0aW9uYWwtc25hcHNob3QudjIuc2NoZW1hLmpzb24iLCJ2ZW5kb3JlZFBhdGgiOiJjb250cmFjdHMvdmVuZG9yL3NldGZhcm0vcnVuLW9wZXJhdGlvbmFsLXNuYXBzaG90LnYyLnNjaGVtYS5qc29uIiwic2hhMjU2IjoiMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCJ9LHsicHJvZHVjZXJQYXRoIjoiY29udHJhY3RzL2dlbmVyYXRlZC9taXNzaW9uLWNvbnRyb2wvcnVuLW9wZXJhdGlvbmFsLXNuYXBzaG90LnYzLmNvbXBhdGliaWxpdHkuanNvbiIsInZlbmRvcmVkUGF0aCI6ImNvbnRyYWN0cy92ZW5kb3Ivc2V0ZmFybS9ydW4tb3BlcmF0aW9uYWwtc25hcHNob3QudjMuY29tcGF0aWJpbGl0eS5qc29uIiwic2hhMjU2IjoiMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMSJ9LHsicHJvZHVjZXJQYXRoIjoiY29udHJhY3RzL2dlbmVyYXRlZC9taXNzaW9uLWNvbnRyb2wvcnVuLW9wZXJhdGlvbmFsLXNuYXBzaG90LnYzLnNjaGVtYS5qc29uIiwidmVuZG9yZWRQYXRoIjoiY29udHJhY3RzL3ZlbmRvci9zZXRmYXJtL3J1bi1vcGVyYXRpb25hbC1zbmFwc2hvdC52My5zY2hlbWEuanNvbiIsInNoYTI1NiI6IjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIifSx7InByb2R1Y2VyUGF0aCI6ImNvbnRyYWN0cy9nZW5lcmF0ZWQvbWlzc2lvbi1jb250cm9sL2RlcGxveW1lbnQtb2JzZXJ2YXRpb24udjEuY29tcGF0aWJpbGl0eS5qc29uIiwidmVuZG9yZWRQYXRoIjoiY29udHJhY3RzL3ZlbmRvci9zZXRmYXJtL2RlcGxveW1lbnQtb2JzZXJ2YXRpb24udjEuY29tcGF0aWJpbGl0eS5qc29uIiwic2hhMjU2IjoiMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMyJ9LHsicHJvZHVjZXJQYXRoIjoiY29udHJhY3RzL2dlbmVyYXRlZC9taXNzaW9uLWNvbnRyb2wvZGVwbG95bWVudC1vYnNlcnZhdGlvbi52MS5zY2hlbWEuanNvbiIsInZlbmRvcmVkUGF0aCI6ImNvbnRyYWN0cy92ZW5kb3Ivc2V0ZmFybS9kZXBsb3ltZW50LW9ic2VydmF0aW9uLnYxLnNjaGVtYS5qc29uIiwic2hhMjU2IjoiNDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NCJ9LHsicHJvZHVjZXJQYXRoIjoiY29udHJhY3RzL2dlbmVyYXRlZC9taXNzaW9uLWNvbnRyb2wvcHJvamVjdC10cmFuc2Zlci1hY2sudjEuY29tcGF0aWJpbGl0eS5qc29uIiwidmVuZG9yZWRQYXRoIjoiY29udHJhY3RzL3ZlbmRvci9zZXRmYXJtL3Byb2plY3QtdHJhbnNmZXItYWNrLnYxLmNvbXBhdGliaWxpdHkuanNvbiIsInNoYTI1NiI6IjU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTUifSx7InByb2R1Y2VyUGF0aCI6ImNvbnRyYWN0cy9nZW5lcmF0ZWQvbWlzc2lvbi1jb250cm9sL3Byb2plY3QtdHJhbnNmZXItYWNrLnYxLnNjaGVtYS5qc29uIiwidmVuZG9yZWRQYXRoIjoiY29udHJhY3RzL3ZlbmRvci9zZXRmYXJtL3Byb2plY3QtdHJhbnNmZXItYWNrLnYxLnNjaGVtYS5qc29uIiwic2hhMjU2IjoiNjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NiJ9LHsicHJvZHVjZXJQYXRoIjoiY29udHJhY3RzL2dlbmVyYXRlZC9taXNzaW9uLWNvbnRyb2wvb3BlcmF0aW9uYWwtYWN0aXZlLXJ1bi1zdGF0dXMudjEuY29tcGF0aWJpbGl0eS5qc29uIiwidmVuZG9yZWRQYXRoIjoiY29udHJhY3RzL3ZlbmRvci9zZXRmYXJtL29wZXJhdGlvbmFsLWFjdGl2ZS1ydW4tc3RhdHVzLnYxLmNvbXBhdGliaWxpdHkuanNvbiIsInNoYTI1NiI6Ijc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3NzcifSx7InByb2R1Y2VyUGF0aCI6ImNvbnRyYWN0cy9nZW5lcmF0ZWQvbWlzc2lvbi1jb250cm9sL29wZXJhdGlvbmFsLWFjdGl2ZS1ydW4tc3RhdHVzLnYxLnNjaGVtYS5qc29uIiwidmVuZG9yZWRQYXRoIjoiY29udHJhY3RzL3ZlbmRvci9zZXRmYXJtL29wZXJhdGlvbmFsLWFjdGl2ZS1ydW4tc3RhdHVzLnYxLnNjaGVtYS5qc29uIiwic2hhMjU2IjoiODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4OCJ9XSwiY29tcGF0aWJpbGl0eVNldEhhc2giOiJkODFmMjY0ZjAxOTk5NzU4Yzk1ZDZjZTMwYTMzMTJmNjdjZTFmYjkzMDlkYWYwZGNiMWEwNzExYzY2NWE0NDA3IiwidmVuZG9yTG9ja1Byb2plY3Rpb25IYXNoIjoiYzk4YTVhYzY4ZDhmNmIyYzk2NTNhOGY2NGZiNmQ0MTQyZjIyNDU4NjJjNjMwYThiNzljOTZhNTQwM2ZkMzQ3MSJ9LCJkZWxpdmVyeUV2aWRlbmNlUmVmIjoibWlzc2lvbi1jb250cm9sOi8vaW50ZXJuYWwtcHJvZHVjdGlvbi9wcm9kdWN0LWJ1aWxkLWF1dGhvcml0eS12Mi1kZWxpdmVyeS1ldmlkZW5jZS9zaGEyNTYvZjcyZTE5NzU1ZjVhYjkyYTAwNTNiNTc3OWQ1ZGMyYzQ5ZTYwMDhlMTQyNmMwYjMyMTcxYmI0MDkyNTZjNjQyNCIsImRlbGl2ZXJ5RXZpZGVuY2VIYXNoIjoiZjcyZTE5NzU1ZjVhYjkyYTAwNTNiNTc3OWQ1ZGMyYzQ5ZTYwMDhlMTQyNmMwYjMyMTcxYmI0MDkyNTZjNjQyNCJ9fQ==",
  "base64",
).toString("utf8");

function privateCanonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("private canonical fixture requires finite numbers");
    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(privateCanonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${privateCanonicalJson(record[key])}`).join(",")}}`;
  }
  throw new TypeError("private canonical fixture only permits JSON values");
}

function privateHash(value: unknown): string {
  return createHash("sha256").update(privateCanonicalJson(value), "utf8").digest("hex");
}

function privateEvidenceFixture(): Record<string, unknown> {
  const deliveredPathBlobs = PRIVATE_DELIVERED_PATHS.map(([path, fill]) => ({ path, blobHash: fill.repeat(64) }));
  const artifacts = PRIVATE_VENDOR_ARTIFACTS.map(([producerPath, vendoredPath, fill]) => ({
    producerPath,
    vendoredPath,
    sha256: fill.repeat(64),
  }));
  const focusedCore = {
    schema: "mission-control.product-build-authority-v2-focused-test-receipt.v1",
    argv: [
      "node", "--import", "tsx", "--test",
      "server/routes/setfarm-operational.test.ts",
      "server/services/setfarm-product-build-authority.test.ts",
      "tests/product-build-authority-render.test.tsx",
    ],
    commandContractHash: PRIVATE_COMMAND_HASH,
    testPathBlobs: [deliveredPathBlobs[0], deliveredPathBlobs[3], deliveredPathBlobs[6]],
    exitCode: 0,
    passed: true,
  };
  const focusedTests = {
    ...focusedCore,
    focusedTestReceiptRef: `mission-control://internal-production/product-build-authority-v2-focused-test-receipt/sha256/${PRIVATE_FOCUSED_HASH}`,
    focusedTestReceiptHash: PRIVATE_FOCUSED_HASH,
  };
  const vendorCore = {
    schema: "mission-control.product-build-authority-v2-vendor-lock-projection.v1",
    lockPath: "contracts/vendor/setfarm/mission-control-contracts.v1.lock.json",
    producerRepository: "https://github.com/hikmetgulsesli/setfarm.git",
    producerCommit: "c".repeat(64),
    lockContentHash: "b".repeat(64),
    artifacts,
    compatibilitySetHash: PRIVATE_COMPATIBILITY_HASH,
  };
  const vendorLock = { ...vendorCore, vendorLockProjectionHash: PRIVATE_VENDOR_HASH };
  return {
    schema: "mission-control.product-build-authority-v2-delivery-evidence.v1",
    currentStatus: "current",
    deliveryPrNumber: 19,
    deliveryMergeSha: "240e779d78804843a1202cbf0440fe423b806b1a",
    deliveryMergeAncestorOfCurrentSource: true,
    currentSource: {
      branch: "main",
      clean: true,
      sha: "1".repeat(40),
      treeHash: "2".repeat(64),
      buildHash: "3".repeat(64),
      originMainSha: "1".repeat(40),
    },
    deliveredPathBlobs,
    focusedTests,
    vendorLock,
  };
}

function privateEvaluateCanonicalCandidate(candidate: Record<string, unknown>): Readonly<{ evidence: Record<string, unknown>; wireJson: string }> {
  const evidence = structuredClone(candidate);
  const focused = evidence.focusedTests as Record<string, unknown>;
  const vendorLock = evidence.vendorLock as Record<string, unknown>;
  const focusedCore = structuredClone(focused);
  delete focusedCore.focusedTestReceiptRef;
  delete focusedCore.focusedTestReceiptHash;
  const vendorCore = structuredClone(vendorLock);
  delete vendorCore.vendorLockProjectionHash;
  assert.equal(privateHash({ argv: focused.argv }), PRIVATE_COMMAND_HASH);
  assert.equal(privateHash(focusedCore), PRIVATE_FOCUSED_HASH);
  assert.equal(privateHash({ schema: "mission-control.setfarm-contract-compatibility-set.v1", artifacts: vendorLock.artifacts }), PRIVATE_COMPATIBILITY_HASH);
  assert.equal(privateHash(vendorCore), PRIVATE_VENDOR_HASH);
  const bytes = privateCanonicalJson(evidence);
  assert.equal(bytes, PRIVATE_EVIDENCE_CORE_CANONICAL_BYTES);
  assert.equal(privateHash(evidence), PRIVATE_EVIDENCE_HASH);
  const deliveryEvidenceRef = `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${PRIVATE_EVIDENCE_HASH}`;
  const wireJson = JSON.stringify({
    schema: "mission-control.product-build-authority-v2-delivery-evidence-response.v1",
    currentStatus: "current",
    deliveryEvidenceRef,
    deliveryEvidenceHash: PRIVATE_EVIDENCE_HASH,
    evidence: { ...evidence, deliveryEvidenceRef, deliveryEvidenceHash: PRIVATE_EVIDENCE_HASH },
  });
  return Object.freeze({ evidence: Object.freeze(evidence), wireJson });
}

test("private canonical fixture computes only the frozen non-authoritative delivery evidence", () => {
  const candidate = privateEvidenceFixture();
  const evaluation = privateEvaluateCanonicalCandidate(candidate);
  assert.equal(evaluation.wireJson, PRIVATE_RESPONSE_WIRE_JSON_BYTES);

  const recursivelyRekeyed = structuredClone(candidate) as Record<string, unknown>;
  recursivelyRekeyed.currentSource = Object.fromEntries(Object.entries(recursivelyRekeyed.currentSource as Record<string, unknown>).reverse());
  const rekeyedEvaluation = privateEvaluateCanonicalCandidate(recursivelyRekeyed);
  assert.equal(privateCanonicalJson(rekeyedEvaluation.evidence), PRIVATE_EVIDENCE_CORE_CANONICAL_BYTES);
  assert.equal(rekeyedEvaluation.evidence.deliveryMergeSha, candidate.deliveryMergeSha);

  for (const mutate of [
    (value: Record<string, unknown>) => { delete value.vendorLock; },
    (value: Record<string, unknown>) => { (value.deliveredPathBlobs as unknown[]).reverse(); },
    (value: Record<string, unknown>) => { ((value.vendorLock as Record<string, unknown>).artifacts as unknown[]).reverse(); },
    (value: Record<string, unknown>) => { ((value.deliveredPathBlobs as Array<Record<string, unknown>>)[0]!.blobHash) = "0".repeat(64); },
  ]) {
    const mutated = structuredClone(candidate) as Record<string, unknown>;
    mutate(mutated);
    assert.throws(() => privateEvaluateCanonicalCandidate(mutated));
  }
});

test("feature-branch observer and pair resolver refuse before a delivery-evidence pair exists", async (context) => {
  if (!reconciliationBranch()) {
    context.skip("only the reconciliation branch must exercise pre-publication refusal");
    return;
  }
  const {
    observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1,
    resolveProductBuildAuthorityV2DeliveryEvidenceV1,
  } = await import("./product-build-authority-v2-delivery-evidence-v1.js");

  await assert.rejects(
    observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1(),
    new RegExp(BRANCH_REFUSAL_CODE),
  );
  await assert.rejects(
    resolveProductBuildAuthorityV2DeliveryEvidenceV1({
      deliveryEvidenceRef: DELIVERY_EVIDENCE_REF,
      deliveryEvidenceHash: DELIVERY_EVIDENCE_HASH,
    }),
    new RegExp(BRANCH_REFUSAL_CODE),
  );
});

test("feature-branch CLI refuses with empty stdout before it can emit a delivery-evidence response", async (context) => {
  if (!reconciliationBranch()) {
    context.skip("only the reconciliation branch must exercise pre-publication refusal");
    return;
  }
  const result = await runDeliveryEvidenceCli();

  assert.notEqual(result.exitCode, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, new RegExp(BRANCH_REFUSAL_CODE));
});

test("ambient Git pager is ignored while a feature branch remains unavailable", async (context) => {
  if (!reconciliationBranch()) {
    context.skip("only the reconciliation branch must exercise production observer refusal");
    return;
  }
  const { observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1 } = await import("./product-build-authority-v2-delivery-evidence-v1.js");
  const previous = process.env.GIT_PAGER;
  process.env.GIT_PAGER = "cat";
  try {
    await assert.rejects(
      observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1(),
      new RegExp(BRANCH_REFUSAL_CODE),
    );
  } finally {
    if (previous === undefined) delete process.env.GIT_PAGER;
    else process.env.GIT_PAGER = previous;
  }
});

test("hostile PATH and Git repository overrides never reach the trusted Git child", async (context) => {
  if (!reconciliationBranch()) {
    context.skip("only the reconciliation branch must exercise production observer refusal");
    return;
  }
  const { observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1 } = await import("./product-build-authority-v2-delivery-evidence-v1.js");
  for (const variable of ["PATH", "GIT_DIR", "GIT_WORK_TREE", "GIT_NAMESPACE", "GIT_OBJECT_DIRECTORY"] as const) {
    const previous = process.env[variable];
    process.env[variable] = "/tmp/attacker-git-redirection";
    try {
      await assert.rejects(
        observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1(),
        new RegExp(BRANCH_REFUSAL_CODE),
      );
    } finally {
      if (previous === undefined) delete process.env[variable];
      else process.env[variable] = previous;
    }
  }
});

test("pair validation rejects symbols, non-enumerables, accessors, and cross-pairs before the current observer", async () => {
  const { resolveProductBuildAuthorityV2DeliveryEvidenceV1 } = await import("./product-build-authority-v2-delivery-evidence-v1.js");
  const hash = "b".repeat(64);
  const ref = `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${hash}`;
  const candidates: unknown[] = [
    { deliveryEvidenceRef: `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${"a".repeat(64)}`, deliveryEvidenceHash: hash },
    Object.defineProperty({ deliveryEvidenceRef: ref, deliveryEvidenceHash: hash }, "hidden", { value: true }),
    Object.defineProperty({ deliveryEvidenceRef: ref, deliveryEvidenceHash: hash }, Symbol("hidden"), { value: true }),
    Object.defineProperty({ deliveryEvidenceRef: ref }, "deliveryEvidenceHash", { enumerable: true, get: () => hash }),
  ];
  for (const candidate of candidates) {
    await assert.rejects(
      resolveProductBuildAuthorityV2DeliveryEvidenceV1(candidate as never),
      new RegExp(PAIR_INVALID_CODE),
    );
  }
});

test("package does not expose independently callable build identity writing", async () => {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")) as { scripts?: Record<string, unknown> };
  assert.equal(manifest.scripts?.["internal:write-build-identity"], undefined);
});

test("clean build removes stale output and recreates deterministic build identity", async () => {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const staleOutput = resolve(root, "dist-server/round1-stale-output.txt");
  const identityPath = resolve(root, "dist-server/internal-production-build-identity.v1.json");
  await mkdir(resolve(root, "dist-server"), { recursive: true });
  await writeFile(staleOutput, "stale", "utf8");
  try {
    execFileSync("npm", ["run", "--silent", "build"], { cwd: root, stdio: "pipe" });
    await assert.rejects(stat(staleOutput));
    const firstIdentity = await readFile(identityPath, "utf8");
    execFileSync("npm", ["run", "--silent", "build"], { cwd: root, stdio: "pipe" });
    assert.equal(await readFile(identityPath, "utf8"), firstIdentity);
  } finally {
    await rm(staleOutput, { force: true });
  }
});

test("private endpoint producer enforces attestation, real lock bytes, and bounded single-flight cooldowns", async () => {
  const ownerModuleUrl = new URL("./product-build-authority-v2-delivery-evidence-v1.ts", import.meta.url).href;
  const realLockBase64 = (await readFile(new URL(
    "../../contracts/vendor/setfarm/mission-control-contracts.v1.lock.json",
    import.meta.url,
  ))).toString("base64");
  const fixture = `
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import test from "node:test";

const root = "/private-fixture";
const mode = process.env.PBA_FIXTURE_MODE;
const trustedGitEnvironment = { PATH: "/opt/homebrew/bin:/usr/bin:/bin", LANG: "C", LC_ALL: "C", GIT_TERMINAL_PROMPT: "0" };
const focusedEnvironment = { PATH: "/opt/homebrew/bin:/usr/bin:/bin", LANG: "C", LC_ALL: "C" };
process.env.PATH = "/tmp/hostile-path";
process.env.GIT_DIR = "/tmp/hostile-git-dir";
process.env.GIT_WORK_TREE = "/tmp/hostile-git-work-tree";
const firstSha = "a".repeat(40);
const secondSha = "b".repeat(40);
const firstTree = "c".repeat(40);
const secondTree = "d".repeat(40);
let now = 1_000_000;
Date.now = () => now;
const artifactPaths = ${JSON.stringify([
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
  ])};
const delivered = [
  "server/routes/setfarm-operational.test.ts", "server/routes/setfarm-operational.ts",
  "server/services/setfarm-product-build-authority.ts", "server/services/setfarm-product-build-authority.test.ts",
  "src/lib/product-build-authority.ts", "src/components/run-detail/ProductBuildAuthority.tsx",
  "tests/product-build-authority-render.test.tsx", "contracts/vendor/setfarm/mission-control-contracts.v1.lock.json",
];
const bytes = new Map();
for (const path of delivered) bytes.set(root + "/" + path, Buffer.from("delivered:" + path));
bytes.set(root + "/dist/app.js", Buffer.from("dist"));
bytes.set(root + "/dist-server/service.js", Buffer.from("server"));
const buildHash = (() => {
  const hash = createHash("sha256");
  hash.update("mission-control.internal-production-build-content.v1\\0", "utf8");
  for (const path of ["dist-server/service.js", "dist/app.js"].sort()) {
    const value = bytes.get(root + "/" + path);
    hash.update(path, "utf8"); hash.update("\\0", "utf8"); hash.update(String(value.byteLength), "utf8"); hash.update("\\0", "utf8"); hash.update(value); hash.update("\\0", "utf8");
  }
  return hash.digest("hex");
})();
const fixtureLock = { schema: "mission-control.setfarm-contract-vendor-lock.v1", producerRepository: "https://github.com/hikmetgulsesli/setfarm.git", producerCommit: "e".repeat(40), artifacts: artifactPaths.map(([producerPath, vendoredPath], index) => ({ producerPath, vendoredPath, sha256: index.toString(16).padStart(64, "0") })) };
const realLock = JSON.parse(Buffer.from(${JSON.stringify(realLockBase64)}, "base64").toString("utf8"));
const lock = mode === "real-lock-success" || mode === "real-lock-tamper"
  ? (mode === "real-lock-tamper"
    ? { ...realLock, artifacts: [{ ...realLock.artifacts[0], vendoredPath: "contracts/vendor/setfarm/tampered.json" }, ...realLock.artifacts.slice(1)] }
    : realLock)
  : fixtureLock;
bytes.set(root + "/contracts/vendor/setfarm/mission-control-contracts.v1.lock.json", Buffer.from(JSON.stringify(lock)));
let focusedRuns = 0;
let focusedAttempts = 0;
const callback = () => undefined;
callback[promisify.custom] = async (command, args, options) => {
  if (command === process.execPath) {
    assert.deepEqual(options.env, focusedEnvironment);
    assert.equal(options.timeout, 120_000);
    assert.equal(options.killSignal, "SIGKILL");
    if (mode === "focused-failure") throw new Error("focused failure");
    focusedAttempts += 1;
    if (mode === "cache-failure") throw new Error("focused failure");
    focusedRuns += 1;
    return { stdout: "", stderr: "" };
  }
  assert.equal(command, "/usr/bin/git");
  assert.deepEqual(options.env, trustedGitEnvironment);
  assert.deepEqual(args.slice(0, 2), ["-C", root]);
  const commandArgs = args.slice(2);
  if (commandArgs[0] === "branch") return { stdout: "main\\n", stderr: "" };
  if (commandArgs[0] === "status") return { stdout: mode === "dirty" && focusedRuns > 0 ? " M server/routes/setfarm-operational.ts\\n" : "", stderr: "" };
  if (commandArgs[0] === "merge-base") return { stdout: "", stderr: "" };
  if (commandArgs[0] === "show") {
    const path = commandArgs[1].slice(commandArgs[1].indexOf(":") + 1);
    if (mode.startsWith("path-") && path === delivered[Number(mode.slice("path-".length))]) throw new Error("missing immutable blob");
    if (mode === "lock-tamper" && path === "contracts/vendor/setfarm/mission-control-contracts.v1.lock.json") return { stdout: Buffer.from(JSON.stringify({ ...lock, artifacts: [{ ...lock.artifacts[0], vendoredPath: "contracts/vendor/setfarm/tampered.json" }, ...lock.artifacts.slice(1)] })), stderr: "" };
    return { stdout: bytes.get(root + "/" + path), stderr: "" };
  }
  if (commandArgs[0] === "rev-parse") {
    const changed = mode === "source" && focusedRuns > 0;
    const target = commandArgs[1];
    if (target === "HEAD") return { stdout: (changed ? secondSha : firstSha) + "\\n", stderr: "" };
    if (target === "refs/remotes/origin/main") return { stdout: (changed ? secondSha : firstSha) + "\\n", stderr: "" };
    if (target === "HEAD^{tree}") return { stdout: (changed ? secondTree : firstTree) + "\\n", stderr: "" };
    if (target === "--show-toplevel") return { stdout: (mode === "wrong-toplevel" ? root + "-redirect" : root) + "\\n", stderr: "" };
  }
  throw new Error("unexpected git command " + JSON.stringify({ command, args }));
};
const member = (name) => ({ name, isDirectory: () => false, isFile: () => true });
test("final attestation", async (context) => {
  context.mock.module("node:child_process", { exports: { execFile: callback } });
  context.mock.module("node:url", { exports: { fileURLToPath: () => root + "/server/services/product-build-authority-v2-delivery-evidence-v1.ts" } });
  context.mock.module("node:fs/promises", { exports: {
    realpath: async (path) => path,
    stat: async () => ({ isDirectory: () => true }),
    readdir: async (path) => path === root + "/dist" ? [member("app.js")] : path === root + "/dist-server" ? [member("service.js"), member("internal-production-build-identity.v1.json")] : [],
    readFile: async (path) => {
      if (path === root + "/package.json") return JSON.stringify({ name: "mission-control" });
      if (path === root + "/dist-server/internal-production-build-identity.v1.json") { if (mode === "missing-identity") throw new Error("missing identity"); return JSON.stringify({ schema: "mission-control.internal-production-build-identity.v1", sourceSha: mode === "source" && focusedRuns > 0 ? secondSha : firstSha, treeHash: mode === "source" && focusedRuns > 0 ? secondTree : firstTree, buildHash }); }
      if (path === root + "/contracts/vendor/setfarm/mission-control-contracts.v1.lock.json") return JSON.stringify(mode === "lock-tamper" ? { ...lock, artifacts: [{ ...lock.artifacts[0], vendoredPath: "contracts/vendor/setfarm/tampered.json" }, ...lock.artifacts.slice(1)] } : lock);
      if (mode === "build-tamper" && focusedRuns > 0 && path === root + "/dist/app.js") return Buffer.from("tampered build output");
      const value = bytes.get(path); if (value === undefined) throw new Error("missing " + path); return value;
    },
  } });
  const owner = await import(process.env.PBA_OWNER_URL + "?private-attestation");
  if (mode === "cache-success") {
    const first = owner.currentProductBuildAuthorityV2DeliveryEvidenceResponseV1();
    const concurrent = owner.currentProductBuildAuthorityV2DeliveryEvidenceResponseV1();
    assert.strictEqual(concurrent, first);
    const [firstResponse, concurrentResponse] = await Promise.all([first, concurrent]);
    assert.strictEqual(concurrentResponse, firstResponse);
    assert.equal(focusedAttempts, 1);
    now += 29_999;
    assert.strictEqual(owner.currentProductBuildAuthorityV2DeliveryEvidenceResponseV1(), first);
    assert.equal(focusedAttempts, 1);
    now += 1;
    const afterCooldown = owner.currentProductBuildAuthorityV2DeliveryEvidenceResponseV1();
    assert.notStrictEqual(afterCooldown, first);
    await afterCooldown;
    assert.equal(focusedAttempts, 2);
    return;
  }
  if (mode === "cache-failure") {
    const first = owner.currentProductBuildAuthorityV2DeliveryEvidenceResponseV1();
    const concurrent = owner.currentProductBuildAuthorityV2DeliveryEvidenceResponseV1();
    assert.strictEqual(concurrent, first);
    await assert.rejects(first, /PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_FOCUSED_TESTS_FAILED/);
    await assert.rejects(concurrent, /PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_FOCUSED_TESTS_FAILED/);
    assert.equal(focusedAttempts, 1);
    now += 4_999;
    const duringCooldown = owner.currentProductBuildAuthorityV2DeliveryEvidenceResponseV1();
    assert.strictEqual(duringCooldown, first);
    await assert.rejects(duringCooldown, /PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_FOCUSED_TESTS_FAILED/);
    assert.equal(focusedAttempts, 1);
    now += 1;
    const afterCooldown = owner.currentProductBuildAuthorityV2DeliveryEvidenceResponseV1();
    assert.notStrictEqual(afterCooldown, first);
    await assert.rejects(afterCooldown, /PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_FOCUSED_TESTS_FAILED/);
    assert.equal(focusedAttempts, 2);
    return;
  }
  if (mode === "real-lock-success") {
    const response = await owner.currentProductBuildAuthorityV2DeliveryEvidenceResponseV1();
    assert.equal(response.evidence.vendorLock.artifacts.length, 12);
    assert.equal(response.evidence.vendorLock.producerCommit, "ff761a3680b0e899d8245e8d5fb1a0b2ca806424");
    return;
  }
  if (mode === "real-lock-tamper") {
    await assert.rejects(
      owner.currentProductBuildAuthorityV2DeliveryEvidenceResponseV1(),
      /PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_VENDOR_LOCK_INVALID/,
    );
    return;
  }
  const expected = mode === "source" ? "SOURCE_CHANGED_DURING_OBSERVATION" : mode === "build-tamper" || mode === "missing-identity" ? "BUILD_IDENTITY_INVALID" : mode === "lock-tamper" ? "VENDOR_LOCK_INVALID" : mode === "focused-failure" ? "FOCUSED_TESTS_FAILED" : "NOT_CURRENT";
  await assert.rejects(owner.observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1(), new RegExp("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_" + expected));
  assert.equal(focusedRuns, mode.startsWith("path-") || mode === "missing-identity" || mode === "focused-failure" || mode === "wrong-toplevel" ? 0 : 1);
});
`;
  async function runPrivateHarness(mode: string): Promise<Readonly<{ exitCode: number; stdout: string; stderr: string }>> {
    return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [
      "--experimental-test-module-mocks",
      "--import",
      "tsx",
      "--input-type=module",
      "--eval",
      fixture,
    ], {
      env: (() => {
        const environment: NodeJS.ProcessEnv = {
          ...process.env,
          PBA_OWNER_URL: ownerModuleUrl,
          PBA_FIXTURE_MODE: mode,
        };
        delete environment.NODE_TEST_CONTEXT;
        return environment;
      })(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (exitCode) => resolveResult({ exitCode: exitCode ?? -1, stdout, stderr }));
    });
  }
  for (const mode of ["cache-success", "cache-failure", "real-lock-success", "real-lock-tamper", "source", "dirty", "build-tamper", "missing-identity", "lock-tamper", "focused-failure", "wrong-toplevel", ...Array.from({ length: 8 }, (_, index) => `path-${index}`)]) {
    const result = await runPrivateHarness(mode);
    assert.equal(result.exitCode, 0, `${mode}: ${result.stdout}${result.stderr}`);
  }
});

test("focused production child strips hostile NODE_OPTIONS and runs the exact three tests before final refusal", async () => {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const ownerModuleUrl = new URL("./product-build-authority-v2-delivery-evidence-v1.ts", import.meta.url).href;
  const fixture = `
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const root = process.env.PBA_REAL_ROOT;
const trustedGitEnvironment = { PATH: "/opt/homebrew/bin:/usr/bin:/bin", LANG: "C", LC_ALL: "C", GIT_TERMINAL_PROMPT: "0" };
const focusedEnvironment = { PATH: "/opt/homebrew/bin:/usr/bin:/bin", LANG: "C", LC_ALL: "C" };
const head = execFileSync("/usr/bin/git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8", env: trustedGitEnvironment }).trim();
const tree = execFileSync("/usr/bin/git", ["-C", root, "rev-parse", "HEAD^{tree}"], { encoding: "utf8", env: trustedGitEnvironment }).trim();
process.env.NODE_OPTIONS = "--test-name-pattern=definitely-no-tests-match";
process.env.NODE_PATH = "/tmp/hostile-node-path";
let focusedRuns = 0;
let focusedOutput = "";
const callback = () => undefined;
callback[promisify.custom] = async (command, args, options) => {
  if (command === process.execPath) {
    const result = spawnSync(command, args, { cwd: options.cwd, env: options.env, encoding: "utf8" });
    focusedRuns += 1;
    focusedOutput = result.stdout;
    assert.match(focusedOutput, /^ℹ tests [1-9][0-9]*$/m);
    assert.deepEqual(options.env, focusedEnvironment);
    if (result.status !== 0) throw new Error(result.stderr);
    return { stdout: result.stdout, stderr: result.stderr };
  }
  assert.equal(command, "/usr/bin/git");
  assert.deepEqual(options.env, trustedGitEnvironment);
  const commandArgs = args.slice(2);
  if (commandArgs[0] === "branch") return { stdout: "main\\n", stderr: "" };
  if (commandArgs[0] === "status") return { stdout: focusedRuns === 0 ? "" : " M server/routes/setfarm-operational.ts\\n", stderr: "" };
  if (commandArgs[0] === "merge-base") return { stdout: "", stderr: "" };
  if (commandArgs[0] === "rev-parse") {
    if (commandArgs[1] === "--show-toplevel") return { stdout: root + "\\n", stderr: "" };
    if (commandArgs[1] === "HEAD") return { stdout: head + "\\n", stderr: "" };
    if (commandArgs[1] === "refs/remotes/origin/main") return { stdout: head + "\\n", stderr: "" };
    if (commandArgs[1] === "HEAD^{tree}") return { stdout: tree + "\\n", stderr: "" };
  }
  if (commandArgs[0] === "show") {
    const stdout = execFileSync(command, args, { encoding: options.encoding, env: options.env });
    return { stdout, stderr: "" };
  }
  throw new Error("unexpected Git command " + JSON.stringify(args));
};

test("focused child", async (context) => {
  context.mock.module("node:child_process", { exports: { execFile: callback } });
  const owner = await import(process.env.PBA_OWNER_URL + "?focused-child");
  await assert.rejects(
    owner.observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1(),
    /PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_NOT_CURRENT/,
  );
  assert.equal(focusedRuns, 1);
});
`;
  const result = await new Promise<Readonly<{ exitCode: number; stdout: string; stderr: string }>>((resolveResult, reject) => {
    const child = spawn(process.execPath, [
      "--experimental-test-module-mocks",
      "--import",
      "tsx",
      "--input-type=module",
      "--eval",
      fixture,
    ], {
      env: (() => {
        const environment: NodeJS.ProcessEnv = {
          ...process.env,
          PBA_OWNER_URL: ownerModuleUrl,
          PBA_REAL_ROOT: root,
        };
        delete environment.NODE_TEST_CONTEXT;
        return environment;
      })(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (exitCode) => resolveResult({ exitCode: exitCode ?? -1, stdout, stderr }));
  });
  assert.equal(result.exitCode, 0, `${result.stdout}${result.stderr}`);
});

test("module evaluation freezes the exact loaded build while disk and current-source CLI advance", async () => {
  const ownerModuleUrl = new URL("./product-build-authority-v2-delivery-evidence-v1.ts", import.meta.url).href;
  const fixture = String.raw`
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as actualFs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const RESPONSE_SCHEMA = "mission-control.product-build-authority-v2-loaded-build-response.v1";
const STARTUP_SCHEMA = "mission-control.product-build-authority-v2-startup-instance.v1";
const LOADED_SCHEMA = "mission-control.product-build-authority-v2-loaded-build.v1";
const IDENTITY_SCHEMA = "mission-control.internal-production-build-identity.v1";
const ENTRY_PATH = "dist-server/services/product-build-authority-v2-delivery-evidence-v1.js";
const REF_PREFIX = "mission-control://internal-production/product-build-authority-v2-loaded-build/sha256/";
const UNAVAILABLE_CODE = "PRODUCT_BUILD_AUTHORITY_V2_LOADED_BUILD_STARTUP_CAPTURE_INVALID";

function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonical(value[key])).join(",") + "}";
}

function hashBytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hashCanonical(value) {
  return hashBytes(Buffer.from(canonical(value), "utf8"));
}

function contentHash(files) {
  const hash = createHash("sha256");
  hash.update("mission-control.internal-production-build-content.v1\0", "utf8");
  for (const path of [...files.keys()].sort()) {
    const bytes = files.get(path);
    hash.update(path, "utf8");
    hash.update("\0", "utf8");
    hash.update(String(bytes.byteLength), "utf8");
    hash.update("\0", "utf8");
    hash.update(bytes);
    hash.update("\0", "utf8");
  }
  return hash.digest("hex");
}

test("startup capture", async (context) => {
  const root = await actualFs.mkdtemp(join(tmpdir(), "mc-loaded-build-"));
  const entryModule = join(root, ENTRY_PATH);
  let fsObservations = 0;
  let cliCalls = 0;
  let cliGeneration = "A";
  const execFile = () => undefined;
  execFile[promisify.custom] = async () => {
    cliCalls += 1;
    return { stdout: cliGeneration, stderr: "" };
  };

  async function writeGeneration(name, sourceDigit, treeDigit) {
    await actualFs.rm(join(root, "dist"), { recursive: true, force: true });
    await actualFs.rm(join(root, "dist-server"), { recursive: true, force: true });
    await actualFs.mkdir(join(root, "dist"), { recursive: true });
    await actualFs.mkdir(join(root, "dist-server/services"), { recursive: true });
    const files = new Map([
      ["dist/assets/app.js", Buffer.from("browser-" + name)],
      [ENTRY_PATH, Buffer.from("compiled-owner-" + name)],
      ["dist-server/routes/other.js", Buffer.from("compiled-route-" + name)],
    ]);
    await actualFs.mkdir(join(root, "dist/assets"), { recursive: true });
    await actualFs.mkdir(join(root, "dist-server/routes"), { recursive: true });
    for (const [path, bytes] of files) await actualFs.writeFile(join(root, path), bytes);
    const buildIdentity = {
      schema: IDENTITY_SCHEMA,
      sourceSha: sourceDigit.repeat(40),
      treeHash: treeDigit.repeat(40),
      buildHash: contentHash(files),
    };
    const identityBytes = Buffer.from(JSON.stringify(buildIdentity) + "\n", "utf8");
    await actualFs.writeFile(join(root, "dist-server/internal-production-build-identity.v1.json"), identityBytes);
    return { files, buildIdentity, identityBytes };
  }

  try {
    await actualFs.writeFile(join(root, "package.json"), JSON.stringify({ name: "mission-control" }));
    const generationA = await writeGeneration("A", "a", "b");
    context.mock.module("node:child_process", { exports: { execFile } });
    context.mock.module("node:url", { exports: { fileURLToPath: () => entryModule } });
    context.mock.module("node:fs/promises", { exports: {
      readFile: async (...args) => { fsObservations += 1; return actualFs.readFile(...args); },
      readdir: async (...args) => { fsObservations += 1; return actualFs.readdir(...args); },
      realpath: async (...args) => { fsObservations += 1; return actualFs.realpath(...args); },
      stat: async (...args) => { fsObservations += 1; return actualFs.stat(...args); },
    } });

    const ownerA = await import(process.env.PBA_OWNER_URL + "?loaded-a");
    const firstState = ownerA.productBuildAuthorityV2LoadedBuildStartupStateV1();
    assert.equal(firstState.status, "available");
    const first = firstState.response;
    const expectedLoadedA = {
      schema: LOADED_SCHEMA,
      entryModulePath: ENTRY_PATH,
      entryModuleHash: hashBytes(generationA.files.get(ENTRY_PATH)),
      buildIdentity: generationA.buildIdentity,
      buildIdentityHash: hashBytes(generationA.identityBytes),
    };
    const expectedHashA = hashCanonical(expectedLoadedA);
    assert.deepEqual(first, {
      schema: RESPONSE_SCHEMA,
      loadedBuildRef: REF_PREFIX + expectedHashA,
      loadedBuildHash: expectedHashA,
      startupInstance: {
        schema: STARTUP_SCHEMA,
        pid: process.pid,
        instanceId: first.startupInstance.instanceId,
      },
      loadedBuild: expectedLoadedA,
    });
    assert.match(first.startupInstance.instanceId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert(Object.isFrozen(first));
    assert(Object.isFrozen(first.startupInstance));
    assert(Object.isFrozen(first.loadedBuild));
    assert(Object.isFrozen(first.loadedBuild.buildIdentity));

    const observationsAfterA = fsObservations;
    cliGeneration = "B";
    const generationB = await writeGeneration("B", "c", "d");
    assert.strictEqual(ownerA.productBuildAuthorityV2LoadedBuildStartupStateV1(), firstState);
    assert.equal(fsObservations, observationsAfterA);
    assert.equal(cliCalls, 0);

    const ownerB = await import(process.env.PBA_OWNER_URL + "?loaded-b");
    const secondState = ownerB.productBuildAuthorityV2LoadedBuildStartupStateV1();
    assert.equal(secondState.status, "available");
    assert.notDeepEqual(secondState.response.loadedBuild, first.loadedBuild);
    assert.notEqual(secondState.response.loadedBuildHash, first.loadedBuildHash);
    assert.notEqual(secondState.response.loadedBuildRef, first.loadedBuildRef);
    assert.notEqual(secondState.response.startupInstance.instanceId, first.startupInstance.instanceId);
    assert.equal(secondState.response.loadedBuild.entryModuleHash, hashBytes(generationB.files.get(ENTRY_PATH)));
    assert.equal(secondState.response.loadedBuild.buildIdentityHash, hashBytes(generationB.identityBytes));
    assert.equal(secondState.response.loadedBuildHash, hashCanonical(secondState.response.loadedBuild));
    assert.equal(secondState.response.loadedBuildRef, REF_PREFIX + secondState.response.loadedBuildHash);
    assert.equal(cliCalls, 0);

    await actualFs.writeFile(
      join(root, "dist-server/internal-production-build-identity.v1.json"),
      JSON.stringify({ ...generationB.buildIdentity, unexpected: true }),
    );
    const unavailableOwner = await import(process.env.PBA_OWNER_URL + "?loaded-unavailable");
    assert.deepEqual(unavailableOwner.productBuildAuthorityV2LoadedBuildStartupStateV1(), {
      status: "unavailable",
      code: UNAVAILABLE_CODE,
    });
    assert(Object.isFrozen(unavailableOwner.productBuildAuthorityV2LoadedBuildStartupStateV1()));
    assert.equal(cliCalls, 0);
  } finally {
    await actualFs.rm(root, { recursive: true, force: true });
  }
});
`;
  const result = await new Promise<Readonly<{ exitCode: number; stdout: string; stderr: string }>>((resolveResult, reject) => {
    const child = spawn(process.execPath, [
      "--experimental-test-module-mocks",
      "--import",
      "tsx",
      "--input-type=module",
      "--eval",
      fixture,
    ], {
      env: { ...process.env, PBA_OWNER_URL: ownerModuleUrl },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (exitCode) => resolveResult({ exitCode: exitCode ?? -1, stdout, stderr }));
  });
  assert.equal(result.exitCode, 0, `${result.stdout}${result.stderr}`);
});
