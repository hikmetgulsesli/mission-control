import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { readPrivateAgentSessionSnapshot } from './agent-feed.js';

test('private session snapshot does not block the Node event loop', async () => {
  const root = mkdtempSync('/tmp/mc-task6a-source-');
  let timer: NodeJS.Timeout | undefined;
  try {
    const helper = path.join(root, 'slow-snapshot.py');
    writeFileSync(helper, 'import time\ntime.sleep(0.25)\nprint("[]")\n');
    const events: string[] = [];
    timer = setTimeout(() => events.push('timer'), 20);
    const output = await readPrivateAgentSessionSnapshot(helper, root).then((value) => {
      events.push('snapshot');
      return value;
    });
    assert.equal(output, '[]\n');
    assert.deepEqual(events, ['timer', 'snapshot']);
  } finally {
    if (timer) clearTimeout(timer);
    if (/^\/tmp\/mc-task6a-source-[A-Za-z0-9]+$/.test(root)) {
      rmSync(root, { recursive: true });
    }
  }
});

test('private session snapshot admits only one reader child at a time', async () => {
  const root = mkdtempSync('/tmp/mc-task6a-source-');
  try {
    const helper = path.join(root, 'slow-snapshot.py');
    writeFileSync(helper, 'import time\ntime.sleep(0.25)\nprint("[]")\n');
    const first = readPrivateAgentSessionSnapshot(helper, root);
    await assert.rejects(readPrivateAgentSessionSnapshot(helper, root),
      /MC_TASK6A_RESTRICTED_AGENT_FEED_SOURCE_BUSY/);
    assert.equal(await first, '[]\n');
    assert.equal(await readPrivateAgentSessionSnapshot(helper, root), '[]\n');
  } finally {
    if (/^\/tmp\/mc-task6a-source-[A-Za-z0-9]+$/.test(root)) {
      rmSync(root, { recursive: true });
    }
  }
});

test('private source snapshot accepts bounded non-ASCII sessions without JSON expansion', () => {
  const root = mkdtempSync('/tmp/mc-task6a-source-');
  try {
    const agents = path.join(root, 'agents');
    const raw = 'é'.repeat(100_000); // 200 KB per file, 8 MB across 40 agents.
    for (let index = 0; index < 40; index += 1) {
      const sessions = path.join(agents, `agent-${index}`, 'sessions');
      mkdirSync(sessions, { recursive: true });
      writeFileSync(path.join(sessions, 'session.jsonl'), raw);
    }
    const helper = fileURLToPath(new URL('./task6a-agent-session-reader.py', import.meta.url));
    const result = spawnSync('/usr/bin/python3', ['-I', helper, realpathSync(agents)], {
      encoding: 'utf8', timeout: 10_000, maxBuffer: 16_000_000,
      env: { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C' },
    });
    assert.equal(result.status, 0, result.error?.message);
    const rows = JSON.parse(result.stdout) as Array<{ raw: string }>;
    assert.equal(rows.length, 40);
    assert.ok(rows.every((row) => row.raw === raw));
  } finally {
    if (/^\/tmp\/mc-task6a-source-[A-Za-z0-9]+$/.test(root)) {
      rmSync(root, { recursive: true });
    }
  }
});
