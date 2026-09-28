import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const noEnvPreload = fileURLToPath(new URL('../../tests/fixtures/task6a-no-env-preload.mjs', import.meta.url));

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const wait = (signal: NodeJS.Signals) => new Promise<boolean>((resolve) => {
    const finish = (exited: boolean) => {
      clearTimeout(timeout);
      child.off('exit', onExit);
      resolve(exited);
    };
    const onExit = () => finish(true);
    const timeout = setTimeout(() => finish(false), 5000);
    child.once('exit', onExit);
    child.kill(signal);
    if (child.exitCode !== null || child.signalCode !== null) finish(true);
  });
  if (await wait('SIGTERM')) return;
  if (await wait('SIGKILL')) return;
  throw new Error('MC_TASK6A_PRIVATE_CHILD_NOT_REAPED');
}

async function startChild(root: string, flag: string | undefined):
  Promise<Readonly<{ child: ChildProcess; port: number }>> {
  const child = spawn(process.execPath,
    ['--import', 'tsx', '--import', noEnvPreload,
      'server/routes/task6a-selected-cli-no-spawn-child.ts'], {
      cwd: process.cwd(),
      env: {
        PATH: '/opt/homebrew/bin:/usr/bin:/bin', LANG: 'C', LC_ALL: 'C',
        GATEWAY_TOKEN: 'private-fixture-no-live-read',
        SETFARM_PG_URL: 'postgresql://invalid@127.0.0.1:1/private',
        DATABASE_URL: '', SETFARM_DIR: root, PROJECTS_DIR: path.join(root, 'projects'),
        PROJECTS_JSON: path.join(root, 'projects.json'),
        ...(flag === undefined ? {} : { MC_TASK6A_SELECTED_CLI_NO_SPAWN_V1: flag }),
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

async function postStartRun(port: number, route = '/api/prd/start-run'): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}${route}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    signal: AbortSignal.timeout(5000),
  });
}

test('private selected-CLI mode refuses PRD start-run before handler effects', async () => {
  const root = mkdtempSync('/tmp/mc-task6a-cli-route-');
  let child: ChildProcess | undefined;
  try {
    const started = await startChild(root, '1');
    child = started.child;
    for (const route of ['/api/prd/start-run', '/api/PRD/START-RUN',
      '/api/prd/start-run/']) {
      const response = await postStartRun(started.port, route);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { error: 'MC_TASK6A_SELECTED_CLI_NO_SPAWN' });
    }
    const after = await fetch(`http://127.0.0.1:${started.port}/api/task6a-after-prd`);
    assert.equal(after.status, 200);
    assert.deepEqual(await after.json(), { reachable: true });
    assert.equal(existsSync(path.join(root, 'projects')), false);
  } finally {
    if (child) await stopChild(child);
    if (/^\/tmp\/mc-task6a-cli-route-[A-Za-z0-9]+$/.test(root)) {
      rmSync(root, { recursive: true });
    }
  }
});

for (const flag of ['0', undefined]) {
  test(`PRD start-run ${flag === undefined ? 'ordinary' : 'invalid private'} mode`, async () => {
    const root = mkdtempSync('/tmp/mc-task6a-cli-route-');
    let child: ChildProcess | undefined;
    try {
      const started = await startChild(root, flag);
      child = started.child;
      const response = await postStartRun(started.port);
      if (flag === undefined) {
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { error: 'prdId required' });
      } else {
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: 'MC_TASK6A_SELECTED_CLI_NO_SPAWN' });
      }
      assert.equal(existsSync(path.join(root, 'projects')), false);
    } finally {
      if (child) await stopChild(child);
      if (/^\/tmp\/mc-task6a-cli-route-[A-Za-z0-9]+$/.test(root)) {
        rmSync(root, { recursive: true });
      }
    }
  });
}
