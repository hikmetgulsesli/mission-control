import assert from 'node:assert/strict';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const noEnvPreload = fileURLToPath(new URL('../../tests/fixtures/task6a-no-env-preload.mjs', import.meta.url));

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
  child.kill('SIGTERM');
  await Promise.race([exited, new Promise<void>((resolve) => setTimeout(resolve, 5000))]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await exited;
  }
}

function stopDisposableProject(root: string): void {
  const marker = path.join(root, 'child-ran');
  if (!existsSync(marker)) return;
  const pid = Number(readFileSync(marker, 'utf8'));
  if (!Number.isSafeInteger(pid) || pid < 1) throw new Error('MC_TASK6A_PRIVATE_PROJECT_PID_INVALID');
  let command: string;
  try {
    command = execFileSync('/bin/ps', ['-o', 'command=', '-p', String(pid)], {
      encoding: 'utf8', timeout: 2000,
    }).trim();
  } catch { return; } // Fixture child already exited; never target a port.
  if (!command.includes(`${path.join(root, 'bin', 'npm')} run dev`)) {
    throw new Error('MC_TASK6A_PRIVATE_PROJECT_IDENTITY_CHANGED');
  }
  try { process.kill(-pid, 'SIGTERM'); } catch { /* already stopped */ }
}

async function cleanupFixture(root: string, child: ChildProcess | undefined): Promise<void> {
  let failure: unknown;
  try { stopDisposableProject(root); } catch (error) { failure = error; }
  try { if (child) await stopChild(child); } catch (error) { failure ??= error; }
  // Preserve the exact disposable root for diagnosis if identity/reaping failed.
  if (failure) throw failure;
  if (/^\/tmp\/mc-task6a-project-[A-Za-z0-9]+$/.test(root)) rmSync(root, { recursive: true });
}

function makeProject(root: string): void {
  const repo = path.join(root, 'repo');
  const bin = path.join(root, 'bin');
  mkdirSync(repo, { recursive: true });
  mkdirSync(bin, { recursive: true });
  writeFileSync(path.join(repo, 'package.json'), '{"scripts":{"dev":"node ignored.js"}}\n');
  writeFileSync(path.join(root, 'projects.json'), JSON.stringify([{
    id: 'private-project', name: 'Private Project', repo, stack: ['vite'],
    ports: {}, category: 'local', serviceStatus: 'inactive',
  }]));
  const fakeNpm = path.join(bin, 'npm');
  writeFileSync(fakeNpm, `#!${process.execPath}\n` +
    `const fs = require('node:fs');\n` +
    `const http = require('node:http');\n` +
    `fs.writeFileSync(process.env.TASK6A_MARKER, String(process.pid));\n` +
    `const i = process.argv.indexOf('--port');\n` +
    `const port = Number(process.argv[i + 1]);\n` +
    `const server = http.createServer((_req, res) => res.end('ok'));\n` +
    `server.listen(port, '127.0.0.1');\n` +
    `process.on('SIGTERM', () => server.close(() => process.exit(0)));\n`);
  chmodSync(fakeNpm, 0o700);
}

async function startChild(root: string, flag: string | undefined):
  Promise<Readonly<{ child: ChildProcess; port: number }>> {
  const child = spawn(process.execPath,
    ['--import', 'tsx', '--import', noEnvPreload,
      'server/routes/task6a-project-start-no-spawn-child.ts'], {
      cwd: process.cwd(),
      env: {
        PATH: `${path.join(root, 'bin')}:/opt/homebrew/bin:/usr/bin:/bin`,
        LANG: 'C', LC_ALL: 'C', GATEWAY_TOKEN: 'private-fixture-no-live-read',
        SETFARM_PG_URL: 'postgresql://invalid@127.0.0.1:1/private',
        DATABASE_URL: '', SETFARM_URL: 'http://127.0.0.1:1',
        SETFARM_DIR: path.join(root, 'setfarm'), PROJECTS_DIR: path.join(root, 'projects'),
        PROJECTS_JSON: path.join(root, 'projects.json'), TASK6A_MARKER: path.join(root, 'child-ran'),
        ...(flag === undefined ? {} : { MC_TASK6A_PROJECT_START_NO_SPAWN_V1: flag }),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  try {
    const port = await new Promise<number>((resolve, reject) => {
      let output = '';
      let settled = false;
      const finish = (error: Error | null, value?: number) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        child.off('exit', onExit);
        child.stdout!.off('data', onData);
        if (error) reject(error);
        else resolve(value!);
      };
      const onExit = () => finish(new Error('MC_TASK6A_PRIVATE_CHILD_EXITED_EARLY'));
      const onData = (chunk: Buffer) => {
        output += chunk.toString('utf8');
        if (output.length > 1024) return finish(new Error('MC_TASK6A_PRIVATE_CHILD_OUTPUT_INVALID'));
        const line = output.indexOf('\n');
        if (line < 0) return;
        try {
          const parsed = JSON.parse(output.slice(0, line)) as { port?: unknown };
          if (!Number.isInteger(parsed.port) || Number(parsed.port) < 1 || Number(parsed.port) > 65535) {
            throw new Error('MC_TASK6A_PRIVATE_CHILD_PORT_INVALID');
          }
          finish(null, Number(parsed.port));
        } catch { finish(new Error('MC_TASK6A_PRIVATE_CHILD_OUTPUT_INVALID')); }
      };
      const timeout = setTimeout(() => finish(new Error('MC_TASK6A_PRIVATE_CHILD_START_TIMEOUT')), 10000);
      child.once('exit', onExit);
      child.stdout!.on('data', onData);
    });
    return { child, port };
  } catch (error) {
    await stopChild(child);
    throw error;
  }
}

async function post(port: number, route: string, action?: string): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}${route}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(action === undefined ? {} : { action }),
    signal: AbortSignal.timeout(12000),
  });
}

for (const flag of ['1', '0']) {
  test(`private project-start ${flag} refuses before child and side effects`, async () => {
    const root = mkdtempSync('/tmp/mc-task6a-project-');
    let child: ChildProcess | undefined;
    try {
      makeProject(root);
      const original = readFileSync(path.join(root, 'projects.json'), 'utf8');
      const started = await startChild(root, flag);
      child = started.child;
      for (const [route, action] of [
        ['/api/projects/private-project/toggle', 'start'],
        ['/api/PROJECTS/private-project/TOGGLE/', 'start'],
        ['/api/projects/start-all', undefined],
        ['/api/PROJECTS/START-ALL/', undefined],
      ] as const) {
        const response = await post(started.port, route, action);
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: 'MC_TASK6A_PROJECT_START_NO_SPAWN' });
      }
      assert.equal(existsSync(path.join(root, 'child-ran')), false);
      assert.equal(existsSync(path.join(root, 'local-project-runners')), false);
      assert.equal(existsSync(path.join(root, 'repo', '.setfarm')), false);
      assert.equal(readFileSync(path.join(root, 'projects.json'), 'utf8'), original);
      const after = await fetch(`http://127.0.0.1:${started.port}/api/task6a-after-projects`);
      assert.equal(after.status, 200);
      const stop = await post(started.port, '/api/projects/private-project/toggle', 'stop');
      assert.equal(stop.status, 200);
      assert.equal((await stop.json() as { success: unknown }).success, true);
    } finally {
      await cleanupFixture(root, child);
    }
  });
}

test('ordinary project start still executes a disposable child', async () => {
  const root = mkdtempSync('/tmp/mc-task6a-project-');
  let child: ChildProcess | undefined;
  let projectPid: number | undefined;
  try {
    makeProject(root);
    const started = await startChild(root, undefined);
    child = started.child;
    const response = await post(started.port, '/api/projects/private-project/toggle', 'start');
    assert.equal(response.status, 200);
    assert.equal((await response.json() as { success: unknown }).success, true);
    assert.equal(existsSync(path.join(root, 'child-ran')), true);
    projectPid = Number(readFileSync(path.join(root, 'child-ran'), 'utf8'));
    assert.equal(Number.isSafeInteger(projectPid) && projectPid > 0, true);
  } finally {
    await cleanupFixture(root, child);
  }
});
