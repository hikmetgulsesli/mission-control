#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ARTIFACTS = [
  {
    producerPath: "contracts/generated/mission-control/run-operational-snapshot.v1.compatibility.json",
    vendoredPath: "contracts/vendor/setfarm/run-operational-snapshot.v1.compatibility.json",
  },
  {
    producerPath: "contracts/generated/mission-control/run-operational-snapshot.v1.schema.json",
    vendoredPath: "contracts/vendor/setfarm/run-operational-snapshot.v1.schema.json",
  },
  {
    producerPath: "contracts/generated/mission-control/run-operational-snapshot.v2.compatibility.json",
    vendoredPath: "contracts/vendor/setfarm/run-operational-snapshot.v2.compatibility.json",
  },
  {
    producerPath: "contracts/generated/mission-control/run-operational-snapshot.v2.schema.json",
    vendoredPath: "contracts/vendor/setfarm/run-operational-snapshot.v2.schema.json",
  },
  {
    producerPath: "contracts/generated/mission-control/deployment-observation.v1.compatibility.json",
    vendoredPath: "contracts/vendor/setfarm/deployment-observation.v1.compatibility.json",
  },
  {
    producerPath: "contracts/generated/mission-control/deployment-observation.v1.schema.json",
    vendoredPath: "contracts/vendor/setfarm/deployment-observation.v1.schema.json",
  },
  {
    producerPath: "contracts/generated/mission-control/project-transfer-ack.v1.compatibility.json",
    vendoredPath: "contracts/vendor/setfarm/project-transfer-ack.v1.compatibility.json",
  },
  {
    producerPath: "contracts/generated/mission-control/project-transfer-ack.v1.schema.json",
    vendoredPath: "contracts/vendor/setfarm/project-transfer-ack.v1.schema.json",
  },
];
const LOCK_PATH = "contracts/vendor/setfarm/mission-control-contracts.v1.lock.json";
const DEFAULT_REPOSITORY = "https://github.com/hikmetgulsesli/setfarm.git";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function git(source, args) {
  return execFileSync("git", ["-C", source, ...args], { encoding: "utf8" }).trim();
}

function rawGithubUrl(repository, commit, artifactPath) {
  const match = repository.match(/^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/);
  if (!match) throw new Error("SETFARM_CONTRACT_REPOSITORY_MUST_BE_HTTPS_GITHUB");
  return `https://raw.githubusercontent.com/${match[1]}/${commit}/${artifactPath}`;
}

const workspace = resolve(import.meta.dirname, "..");
const source = argument("--source") || process.env.SETFARM_CONTRACT_SOURCE || null;
let repository = argument("--repository") || DEFAULT_REPOSITORY;
let commit = argument("--commit");
const artifactBytes = new Map();

if (source) {
  const sourceRoot = resolve(source);
  commit = git(sourceRoot, ["rev-parse", "HEAD"]);
  repository = git(sourceRoot, ["remote", "get-url", "origin"]);
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error("SETFARM_CONTRACT_COMMIT_INVALID");
  for (const artifact of ARTIFACTS) {
    const tracked = git(sourceRoot, ["ls-files", "--error-unmatch", artifact.producerPath]);
    if (tracked !== artifact.producerPath) throw new Error(`SETFARM_CONTRACT_ARTIFACT_NOT_TRACKED:${artifact.producerPath}`);
    const committedBytes = Buffer.from(execFileSync(
      "git",
      ["-C", sourceRoot, "show", `${commit}:${artifact.producerPath}`],
    ));
    const workingBytes = readFileSync(join(sourceRoot, artifact.producerPath));
    if (!committedBytes.equals(workingBytes)) {
      throw new Error(`SETFARM_CONTRACT_ARTIFACT_NOT_COMMITTED_AT_PINNED_SHA:${artifact.producerPath}`);
    }
    artifactBytes.set(artifact.producerPath, committedBytes);
  }
} else {
  if (!commit || !/^[a-f0-9]{40}$/.test(commit)) {
    throw new Error("SETFARM_CONTRACT_PINNED_COMMIT_REQUIRED");
  }
  for (const artifact of ARTIFACTS) {
    const response = await fetch(rawGithubUrl(repository, commit, artifact.producerPath), {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`SETFARM_CONTRACT_DOWNLOAD_FAILED:${artifact.producerPath}:${response.status}`);
    artifactBytes.set(artifact.producerPath, Buffer.from(await response.arrayBuffer()));
  }
}

const lockArtifacts = ARTIFACTS.map((artifact) => {
  const bytes = artifactBytes.get(artifact.producerPath);
  if (!bytes) throw new Error(`SETFARM_CONTRACT_ARTIFACT_MISSING:${artifact.producerPath}`);
  JSON.parse(bytes.toString("utf8"));
  return {
    producerPath: artifact.producerPath,
    vendoredPath: artifact.vendoredPath,
    sha256: sha256(bytes),
  };
});
const lock = {
  schema: "mission-control.setfarm-contract-vendor-lock.v1",
  producerRepository: repository,
  producerCommit: commit,
  artifacts: lockArtifacts,
};
for (const artifact of lockArtifacts) {
  const bytes = artifactBytes.get(artifact.producerPath);
  const vendoredPath = join(workspace, artifact.vendoredPath);
  mkdirSync(dirname(vendoredPath), { recursive: true });
  writeFileSync(vendoredPath, bytes);
}
const lockPath = join(workspace, LOCK_PATH);
mkdirSync(dirname(lockPath), { recursive: true });
writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
console.log(`Setfarm contracts <= ${repository}@${commit} (${lockArtifacts.length} artifacts)`);
