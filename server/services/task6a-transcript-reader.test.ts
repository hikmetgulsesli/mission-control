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

test('private transcript reader rejects a regular file replaced between stat and open', () => {
  const root = mkdtempSync('/tmp/mc-task6a-transcript-');
  try {
    const transcripts = path.join(root, 'transcripts');
    const workflow = path.join(transcripts, 'wf-1');
    mkdirSync(workflow, { recursive: true });
    const name = 'agent-2026-09-28T00-00-00.log';
    const source = path.join(workflow, name);
    const replacement = path.join(root, 'replacement.log');
    writeFileSync(source, 'ORIGINAL\n');
    writeFileSync(replacement, 'REPLACED\n');
    const race = `import importlib.util, json, os, sys
spec = importlib.util.spec_from_file_location('reader', sys.argv[1])
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)
original_open = os.open
switched = False
def racing_open(name, flags, mode=0o777, *, dir_fd=None):
    global switched
    if name == sys.argv[4] and dir_fd is not None and not switched:
        switched = True
        os.rename(sys.argv[3], sys.argv[3] + '.old')
        os.rename(sys.argv[5], sys.argv[3])
    return original_open(name, flags, mode, dir_fd=dir_fd)
os.open = racing_open
print(json.dumps(reader.snapshot(sys.argv[2])))
`;
    const result = spawnSync('/usr/bin/python3', ['-I', '-c', race,
      helper, realpathSync(transcripts), source, name, replacement], {
      encoding: 'utf8', timeout: 10_000, maxBuffer: 64_000_000, env: childEnv,
    });
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(result.stderr, /changed transcript file/);
  } finally {
    if (/^\/tmp\/mc-task6a-transcript-[A-Za-z0-9]+$/.test(root)) {
      rmSync(root, { recursive: true });
    }
  }
});

test('private transcript reader rejects a file added after workflow enumeration', () => {
  const root = mkdtempSync('/tmp/mc-task6a-transcript-');
  try {
    const transcripts = path.join(root, 'transcripts');
    const workflow = path.join(transcripts, 'wf-1');
    mkdirSync(workflow, { recursive: true });
    writeFileSync(path.join(workflow, 'agent-2026-09-28T00-00-00.log'), 'ORIGINAL\n');
    const race = `import importlib.util, json, os, sys
spec = importlib.util.spec_from_file_location('reader', sys.argv[1])
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)
original_names = reader.bounded_names
workflow_inode = os.stat(sys.argv[3]).st_ino
added = False
def racing_names(fd, limit):
    global added
    names = original_names(fd, limit)
    if os.fstat(fd).st_ino == workflow_inode and not added:
        added = True
        with open(os.path.join(sys.argv[3], 'late.log'), 'w') as late:
            late.write('LATE\\n')
    return names
reader.bounded_names = racing_names
print(json.dumps(reader.snapshot(sys.argv[2])))
`;
    const result = spawnSync('/usr/bin/python3', ['-I', '-c', race,
      helper, realpathSync(transcripts), workflow], {
      encoding: 'utf8', timeout: 10_000, maxBuffer: 64_000_000, env: childEnv,
    });
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(result.stderr, /changed transcript workflow/);
  } finally {
    if (/^\/tmp\/mc-task6a-transcript-[A-Za-z0-9]+$/.test(root)) {
      rmSync(root, { recursive: true });
    }
  }
});

test('private transcript reader rejects an earlier file changed while later files are read', () => {
  const root = mkdtempSync('/tmp/mc-task6a-transcript-');
  try {
    const transcripts = path.join(root, 'transcripts');
    const workflow = path.join(transcripts, 'wf-1');
    mkdirSync(workflow, { recursive: true });
    const first = path.join(workflow, 'a.log');
    writeFileSync(first, 'FIRST\n');
    writeFileSync(path.join(workflow, 'b.log'), 'SECOND\n');
    const race = `import importlib.util, json, os, sys
spec = importlib.util.spec_from_file_location('reader', sys.argv[1])
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)
original_open = os.open
changed = False
def racing_open(name, flags, mode=0o777, *, dir_fd=None):
    global changed
    if name == 'b.log' and dir_fd is not None and not changed:
        changed = True
        with open(sys.argv[3], 'a') as earlier:
            earlier.write('CHANGED\\n')
    return original_open(name, flags, mode, dir_fd=dir_fd)
os.open = racing_open
print(json.dumps(reader.snapshot(sys.argv[2])))
`;
    const result = spawnSync('/usr/bin/python3', ['-I', '-c', race,
      helper, realpathSync(transcripts), first], {
      encoding: 'utf8', timeout: 10_000, maxBuffer: 64_000_000, env: childEnv,
    });
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(result.stderr, /changed transcript file/);
  } finally {
    if (/^\/tmp\/mc-task6a-transcript-[A-Za-z0-9]+$/.test(root)) {
      rmSync(root, { recursive: true });
    }
  }
});
