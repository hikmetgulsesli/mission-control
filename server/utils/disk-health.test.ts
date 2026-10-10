import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { afterEach, mock, test } from "node:test";
import { readWorkingVolumeDiskHealth } from "./disk-health.js";

type DfCallback = (error: Error | null, stdout: string, stderr: string) => void;

afterEach(() => mock.restoreAll());

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
  assert.deepEqual(await readWorkingVolumeDiskHealth(), { status: "warning", detail: "95%" });
});

for (const [percent, status] of [["0%", "up"], ["89%", "up"], ["90%", "warning"], ["100%", "warning"]]) {
  test(`disk health classifies ${percent} as ${status}`, async () => {
    dfOutput(report(percent));
    assert.deepEqual(await readWorkingVolumeDiskHealth(), { status, detail: percent });
  });
}

for (const output of ["", "Filesystem only\n", report("NaN%"), report("-1%"), report("101%"), report("90junk%")]) {
  test(`disk health refuses malformed output ${JSON.stringify(output)}`, async () => {
    dfOutput(output);
    assert.deepEqual(await readWorkingVolumeDiskHealth(), { status: "unknown" });
  });
}

test("a failed disk probe reports unknown without leaking command output", async () => {
  dfOutput(report("52%"), new Error("private diagnostic must not be returned"));
  assert.deepEqual(await readWorkingVolumeDiskHealth(), { status: "unknown" });
});
