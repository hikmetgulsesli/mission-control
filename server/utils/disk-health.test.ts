import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { afterEach, mock, test } from "node:test";
import * as disk from "./disk-health.js";
const { readWorkingVolumeDiskHealth } = disk;
const readWorkingVolumeObservation = () => { assert.equal(typeof disk.readWorkingVolumeObservation, "function", "structured disk probe is required"); return disk.readWorkingVolumeObservation(); };

type DfCallback = (error: Error | null, stdout: string, stderr: string) => void;

afterEach(() => mock.restoreAll());

function summary(value: { status: string; detail?: string }) { return { status: value.status, ...(value.detail ? { detail: value.detail } : {}) }; }

function report(percent: string): string {
  return `Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/data 1000 950 50 ${percent} /work\n`;
}

function dfOutput(output: string, failure: Error | null = null): void {
  mock.method(childProcess, "execFile", (
    _file: string, _args: string[], _options: unknown, callback: DfCallback,
  ) => {
    queueMicrotask(() => callback(failure, output, ""));
    return new childProcess.ChildProcess();
  });
}

test("disk health warns for the working volume even when root has space", async () => {
  const workingDirectory = process.cwd();
  assert.notEqual(workingDirectory, "/", "the regression needs distinct root and working paths");
  mock.method(childProcess, "execFile", (
    file: string, args: string[], options: unknown, callback: DfCallback,
  ) => {
    assert.equal(file, "df");
    assert.deepEqual(args, ["-k", workingDirectory]);
    assert.deepEqual(options, { timeout: 3000, maxBuffer: 64 * 1024, encoding: "utf8" });
    const percent = file === "df" && args.length === 2 && args[0] === "-k" && args[1] === workingDirectory
      ? "95%" : "52%";
    queueMicrotask(() => callback(null, report(percent), ""));
    return new childProcess.ChildProcess();
  });
  assert.deepEqual(summary(await readWorkingVolumeDiskHealth()), { status: "warning", detail: "95%" });
});

for (const [percent, status] of [["0%", "up"], ["89%", "up"], ["90%", "warning"], ["100%", "warning"]]) {
  test(`disk health classifies ${percent} as ${status}`, async () => {
    dfOutput(report(percent));
    assert.deepEqual(summary(await readWorkingVolumeDiskHealth()), { status, detail: percent });
  });
}

for (const output of ["", "Filesystem only\n", report("NaN%"), report("-1%"), report("101%"), report("90junk%")]) {
  test(`disk health refuses malformed output ${JSON.stringify(output)}`, async () => {
    dfOutput(output);
    assert.deepEqual(summary(await readWorkingVolumeDiskHealth()), { status: "unknown" });
  });
}

test("a failed disk probe reports unknown without leaking command output", async () => {
  dfOutput(report("52%"), new Error("private diagnostic must not be returned"));
  assert.deepEqual(summary(await readWorkingVolumeDiskHealth()), { status: "unknown" });
});

for (const failure of [null, new Error("private probe failure")]) {
  test(`concurrent health calls share one pending probe and retry after ${failure ? "failure" : "success"}`, async () => {
    const callbacks: DfCallback[] = [];
    mock.method(childProcess, "execFile", (
      _file: string, _args: string[], _options: unknown, callback: DfCallback,
    ) => {
      callbacks.push(callback);
      return new childProcess.ChildProcess();
    });
    const requests = Array.from({ length: 32 }, () => readWorkingVolumeDiskHealth());
    await Promise.resolve();
    try {
      assert.equal(callbacks.length, 1, "a public burst must own only one subprocess");
    } finally {
      for (const callback of callbacks) callback(failure, report("95%"), "");
      await Promise.all(requests);
    }
    const expected = failure ? { status: "unknown" } : { status: "warning", detail: "95%" };
    for (const result of await Promise.all(requests)) assert.deepEqual(summary(result), expected);
    const next = readWorkingVolumeDiskHealth();
    await Promise.resolve();
    assert.equal(callbacks.length, 2, "settled observations must not become a stale cache");
    callbacks[1]!(null, report("89%"), "");
    assert.deepEqual(summary(await next), { status: "up", detail: "89%" });
  });
}


test("working-volume observation retains APFS capacity, free bytes and mount containing spaces", async () => {
  dfOutput("Filesystem 1024-blocks Used Available Capacity iused ifree %iused Mounted on\n/dev/data 1000 400 50 95% 10 20 33% /System/Volumes/Data with space\n");
  const [volume, health] = await Promise.all([readWorkingVolumeObservation(), readWorkingVolumeDiskHealth()]);
  assert.equal(volume.percent, 95); // APFS capacity is authoritative, not used/total=40.
  assert.equal(volume.totalBytes, 1024000);
  assert.equal(volume.usedBytes, 409600);
  assert.equal(volume.freeBytes, 51200);
  assert.equal(volume.path, process.cwd());
  assert.equal(volume.mount, "/System/Volumes/Data with space");
  assert.equal(volume.source, "df");
  assert.equal(volume.status, "available");
  assert.ok(Number.isFinite(Date.parse(volume.observedAt)));
  assert.deepEqual(health.volume, volume);
});

for (const row of ["/dev/data nope 20 30 95% /work", "/dev/data 100 -1 30 95% /work", "/dev/data 100 20 999 95% /work", "/dev/data 100 20 30 95%", "/dev/data 0 0 0 0% /work"]) {
  test(`invalid byte fields or missing mount remain unknown: ${row}`, async () => {
    dfOutput("Filesystem 1024-blocks Used Available Capacity Mounted on\n" + row);
    const volume = await readWorkingVolumeObservation();
    assert.equal(volume.status, "unknown");
    assert.equal(volume.percent, null);
    assert.equal(volume.freeBytes, null);
  });
}
