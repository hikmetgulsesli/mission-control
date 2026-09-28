import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const preload = fileURLToPath(new URL('./fixtures/task6a-no-env-preload.mjs', import.meta.url));

test('private test-child preload refuses local env-file reads', () => {
  const root = mkdtempSync('/tmp/mc-task6a-env-preload-');
  try {
    const envFile = path.join(root, '.env');
    writeFileSync(envFile, 'PRIVATE FIXTURE ONLY\n');
    const program = `
      import { readFileSync } from 'node:fs';
      try {
        process.stdout.write(JSON.stringify({ bytes: readFileSync(process.argv[1], 'utf8') }));
      } catch (error) {
        process.stdout.write(JSON.stringify({ code: error.code, message: error.message }));
      }
    `;
    const child = spawnSync(process.execPath,
      ['--import', preload, '--input-type=module', '-e', program, envFile], {
        encoding: 'utf8', timeout: 10_000, maxBuffer: 1_000_000,
        env: { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C' },
      });
    assert.equal(child.status, 0, child.stderr || child.error?.message);
    assert.deepEqual(JSON.parse(child.stdout), {
      code: 'ENOENT', message: 'TASK6A_PRIVATE_ENV_FILE_READ_DENIED',
    });
  } finally {
    if (/^\/tmp\/mc-task6a-env-preload-[A-Za-z0-9]+$/.test(root)) {
      rmSync(root, { recursive: true });
    }
  }
});
