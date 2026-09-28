import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const cliModule = new URL('./cli.ts', import.meta.url).href;
const privateUrl = 'postgresql://invalid@127.0.0.1:1/private';

function runProbe(flag: string | undefined): { result: ReturnType<typeof spawnSync>; marker: boolean } {
  const root = mkdtempSync('/tmp/mc-task6a-cli-');
  try {
    const markerPath = path.join(root, 'child-ran');
    const executable = path.join(root, 'probe');
    writeFileSync(executable,
      `#!/bin/sh\nprintf CHILD_RAN > '${markerPath}'\nprintf 'CHILD_RAN\\n'\n`);
    chmodSync(executable, 0o700);
    const program = `
      const { runCli } = await import(${JSON.stringify(cliModule)});
      try {
        const output = await runCli(process.argv[1], []);
        process.stdout.write(JSON.stringify({ output }));
      } catch (error) {
        process.stdout.write(JSON.stringify({ error: error.message }));
      }
    `;
    const result = spawnSync(process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', program, executable], {
        cwd: process.cwd(), encoding: 'utf8', timeout: 10_000, maxBuffer: 1_000_000,
        env: { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C',
          SETFARM_PG_URL: privateUrl,
          ...(flag === undefined ? {} : { MC_TASK6A_SELECTED_CLI_NO_SPAWN_V1: flag }) },
      });
    return { result, marker: existsSync(markerPath) };
  } finally {
    if (/^\/tmp\/mc-task6a-cli-[A-Za-z0-9]+$/.test(root)) {
      rmSync(root, { recursive: true });
    }
  }
}

for (const flag of ['1', '0']) {
  test(`private selected-CLI flag ${flag} refuses before running the child`, () => {
    const { result, marker } = runProbe(flag);
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.deepEqual(JSON.parse(result.stdout as string),
      { error: 'MC_TASK6A_SELECTED_CLI_NO_SPAWN' });
    assert.equal(marker, false);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /postgresql:\/\//);
  });
}

test('ordinary shared CLI still runs a disposable executable with the flag absent', () => {
  const { result, marker } = runProbe(undefined);
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.deepEqual(JSON.parse(result.stdout as string), { output: 'CHILD_RAN' });
  assert.equal(marker, true);
});
