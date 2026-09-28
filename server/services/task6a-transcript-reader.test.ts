import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync,
  symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const helper = fileURLToPath(new URL('./task6a-transcript-reader.py', import.meta.url));
const childEnv = { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C' };

function runReader(root: string) {
  return spawnSync('/usr/bin/python3', ['-I', helper, realpathSync(root)], {
    encoding: 'utf8', timeout: 10_000, maxBuffer: 64_000_000, env: childEnv,
  });
}

test('private transcript reader snapshots exact completed-message source bytes', () => {
  const root = mkdtempSync('/tmp/mc-task6a-transcript-');
  try {
    const transcripts = path.join(root, 'transcripts');
    const workflow = path.join(transcripts, 'wf-1');
    mkdirSync(workflow, { recursive: true });
    const name = 'agent-2026-09-28T00-00-00.log';
    const line = '{"type":"item.completed","item":{"type":"agent_message","text":"TRANSCRIPT SENTINEL"}}\n';
    const source = path.join(workflow, name);
    writeFileSync(source, line);
    const result = runReader(transcripts);
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.deepEqual(JSON.parse(result.stdout), [{ workflowId: 'wf-1',
      sessionId: 'agent-2026-09-28T00-00-00', raw: line }]);
    assert.equal(readFileSync(source, 'utf8'), line);
  } finally {
    if (/^\/tmp\/mc-task6a-transcript-[A-Za-z0-9]+$/.test(root)) {
      rmSync(root, { recursive: true });
    }
  }
});

for (const caseName of ['workflow-symlink', 'file-symlink', 'oversize', 'invalid-utf8'] as const) {
  test(`private transcript reader rejects ${caseName} without changing source`, () => {
    const root = mkdtempSync('/tmp/mc-task6a-transcript-');
    try {
      const transcripts = path.join(root, 'transcripts');
      const workflow = path.join(transcripts, 'wf-1');
      mkdirSync(workflow, { recursive: true });
      const source = path.join(workflow, 'agent-2026-09-28T00-00-00.log');
      const bytes = caseName === 'oversize' ? Buffer.alloc(256_001, 65)
        : caseName === 'invalid-utf8' ? Buffer.from([0xff, 0x0a])
          : Buffer.from('SOURCE MUST NOT CHANGE\n');
      writeFileSync(source, bytes);
      if (caseName === 'workflow-symlink') {
        symlinkSync(workflow, path.join(transcripts, 'wf-link'));
      } else if (caseName === 'file-symlink') {
        symlinkSync(source, path.join(workflow, 'linked.log'));
      }
      const result = runReader(transcripts);
      assert.notEqual(result.status, 0);
      assert.equal(readFileSync(source).equals(bytes), true);
    } finally {
      if (/^\/tmp\/mc-task6a-transcript-[A-Za-z0-9]+$/.test(root)) {
        rmSync(root, { recursive: true });
      }
    }
  });
}
