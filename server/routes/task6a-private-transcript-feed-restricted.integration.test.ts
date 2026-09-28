import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync,
  symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import postgres from 'postgres';

const expectedDataDirectory = process.env.SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY;

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

async function startChild(privateUrl: string, root: string, mode: 'v3' | 'v2' | 'mixed' = 'v3'):
  Promise<Readonly<{ child: ChildProcess; port: number }>> {
  const child = spawn(process.execPath,
    ['--import', 'tsx', 'server/routes/task6a-private-agent-feed-child.ts'], {
      cwd: process.cwd(),
      env: {
        PATH: '/opt/homebrew/bin:/usr/bin:/bin', LANG: 'C', LC_ALL: 'C',
        SETFARM_PG_URL: privateUrl,
        GATEWAY_TOKEN: 'private-fixture-no-live-read',
        SETFARM_DIR: root,
        AGENTS_DIR: path.join(root, 'agents'),
        TRANSCRIPTS_DIR: path.join(root, 'transcripts'),
        EVENTS_JSONL: path.join(root, 'events.jsonl'),
        PROJECTS_DIR: path.join(root, 'projects'),
        PROJECTS_JSON: path.join(root, 'projects.json'),
        DATA_JSON: path.join(root, 'data.json'),
        JOBS_JSON: path.join(root, 'jobs.json'),
        SESSIONS_DIR: path.join(root, 'sessions'),
        SETFARM_REPO_DIR: path.join(root, 'repos'),
        PORT_REGISTRY: path.join(root, 'port-registry.json'),
        ...(mode === 'v3' || mode === 'mixed'
          ? { MC_TASK6A_RESTRICTED_AGENT_FEED_TRANSCRIPT_APPEND_V3: '1' } : {}),
        ...(mode === 'v2' || mode === 'mixed'
          ? { MC_TASK6A_RESTRICTED_AGENT_FEED_APPEND_V2: '1' } : {}),
      },
      stdio: ['ignore', 'pipe', 'ignore'],
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

async function request(base: string, route: string, method = 'GET'): Promise<Response> {
  return fetch(`${base}${route}`, { method, signal: AbortSignal.timeout(5000) });
}

test('private transcript feed commits the completed agent message before returning', {
  skip: expectedDataDirectory ? false : 'requires explicitly identified private PostgreSQL 17 cluster',
}, async () => {
  assert.equal(process.env.SETFARM_PG_URL, undefined);
  assert.match(expectedDataDirectory!, /^\/tmp\/setfarm-task6a-pg\.[A-Za-z0-9]+\/data$/);
  assert.equal(existsSync(path.join(process.cwd(), '.env')), false);
  assert.equal(existsSync(path.join(process.cwd(), '.env.local')), false);
  const adminUrl = process.env.SETFARM_TEST_PG_ADMIN_URL;
  assert.ok(adminUrl);
  const parsed = new URL(adminUrl);
  assert.equal(parsed.pathname, '/postgres');
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname));
  assert.notEqual(parsed.port, '5432');
  const databaseName = `mc_task6a_transcript_${randomBytes(8).toString('hex')}`;
  const roleName = `mc_task6a_transcript_role_${randomBytes(8).toString('hex')}`;
  const password = randomBytes(24).toString('hex');
  const admin = postgres(adminUrl, { max: 1 });
  let db: postgres.Sql | undefined;
  let child: ChildProcess | undefined;
  let privateRoot: string | undefined;
  let databaseCreated = false;
  let roleCreated = false;
  let failure: unknown;
  let stage = 'private-preflight';
  try {
    const identity = await admin<Array<{ dataDirectory: string; port: string;
      socketDirectories: string; version: number }>>`
      SELECT current_setting('data_directory') AS "dataDirectory",
        current_setting('port') AS port,
        current_setting('unix_socket_directories') AS "socketDirectories",
        current_setting('server_version_num')::integer AS version`;
    assert.equal(identity[0]?.dataDirectory, expectedDataDirectory);
    assert.equal(identity[0]?.port, parsed.port);
    assert.ok(identity[0]?.socketDirectories.split(',').map((item) => item.trim())
      .includes(path.dirname(expectedDataDirectory!)));
    assert.ok(identity[0]!.version >= 170000 && identity[0]!.version < 180000);

    stage = 'private-fixture';
    privateRoot = mkdtempSync('/tmp/mc-task6a-transcript-feed-');
    mkdirSync(path.join(privateRoot, 'agents'));
    const workflow = path.join(privateRoot, 'transcripts', 'wf-1');
    mkdirSync(workflow, { recursive: true });
    const source = path.join(workflow, 'agent-2026-09-28T00-00-00.log');
    const line = `${JSON.stringify({ type: 'item.completed', item: {
      type: 'agent_message', text: 'PRIVATE TRANSCRIPT SENTINEL',
    } })}\n`;
    writeFileSync(source, line);
    await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
    databaseCreated = true;
    await admin.unsafe(`REVOKE TEMPORARY ON DATABASE "${databaseName}" FROM PUBLIC`);
    const dbUrl = new URL(adminUrl);
    dbUrl.pathname = `/${databaseName}`;
    db = postgres(dbUrl.toString(), { max: 1 });
    await db`CREATE TABLE public.agent_feed (
      id SERIAL PRIMARY KEY, agent_id TEXT NOT NULL, agent_name TEXT NOT NULL,
      message TEXT NOT NULL, session_id TEXT, msg_hash TEXT UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    await db`CREATE INDEX idx_agent_feed_created ON public.agent_feed(created_at DESC)`;
    await admin.unsafe(`CREATE ROLE "${roleName}" LOGIN PASSWORD '${password}'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOREPLICATION`);
    roleCreated = true;
    await admin.unsafe(`GRANT CONNECT ON DATABASE "${databaseName}" TO "${roleName}"`);
    const outsideConnections = await admin<Array<{ name: string }>>`
      SELECT candidate.datname AS name FROM pg_catalog.pg_database candidate
      WHERE candidate.datallowconn AND candidate.datname <> ${databaseName}
        AND has_database_privilege(${roleName}, candidate.oid, 'CONNECT')`;
    assert.deepEqual([...outsideConnections], [],
      'MC_TASK6A_PRIVATE_CLUSTER_CONNECT_ISOLATION_REQUIRED');
    await db.unsafe(`GRANT USAGE ON SCHEMA public TO "${roleName}"`);
    await db.unsafe(`GRANT SELECT, INSERT ON public.agent_feed TO "${roleName}"`);
    await db.unsafe(`GRANT USAGE ON SEQUENCE public.agent_feed_id_seq TO "${roleName}"`);
    const privateUrl = new URL(dbUrl);
    privateUrl.username = roleName;
    privateUrl.password = password;

    stage = 'transcript-red-green';
    const started = await startChild(privateUrl.toString(), privateRoot);
    child = started.child;
    const base = `http://127.0.0.1:${started.port}`;
    const feed = await request(base, '/api/setfarm/agent-feed?limit=10');
    assert.equal(feed.status, 200);
    const rows = await feed.json() as Array<{ id: number; agent_id: string;
      session_id: string; message: string }>;
    assert.equal(rows.length, 1);
    assert.ok(Number.isSafeInteger(rows[0].id) && rows[0].id > 0);
    assert.deepEqual({ agent_id: rows[0].agent_id, session_id: rows[0].session_id,
      message: rows[0].message }, { agent_id: 'agent',
      session_id: 'agent-2026-09-28T00-00-00', message: 'PRIVATE TRANSCRIPT SENTINEL' });
    const persisted = await db<Array<{ id: number; agent_id: string; session_id: string;
      message: string }>>`
      SELECT id, agent_id, session_id, message FROM public.agent_feed`;
    assert.deepEqual([...persisted], [{ id: rows[0].id, agent_id: rows[0].agent_id,
      session_id: rows[0].session_id, message: rows[0].message }]);
    const repeated = await request(base, '/api/setfarm/agent-feed?limit=10');
    assert.equal(repeated.status, 200);
    assert.deepEqual((await repeated.json() as Array<{ id: number }>).map((row) => row.id),
      [rows[0].id]);
    assert.equal(readFileSync(source, 'utf8'), line);

    const dbForAssertions = db;
    assert.ok(dbForAssertions);
    const assertUnchanged = async () => {
      assert.equal((await dbForAssertions<Array<{ count: number }>>`
        SELECT COUNT(*)::integer AS count FROM public.agent_feed`)[0]?.count, 1);
    };
    const assertRefused = async () => {
      const response = await request(base, '/api/setfarm/agent-feed');
      assert.equal(response.status, 502);
      assert.deepEqual(await response.json(),
        { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_VERIFY_REFUSED' });
      await assertUnchanged();
    };

    stage = 'route-refusal';
    for (const [route, method] of [
      ['/api/setfarm/agent-feed', 'DELETE'],
      ['/api/SETFARM/AGENT-FEED', 'DELETE'],
      ['/api/setfarm/activity', 'DELETE'],
      ['/api/setfarm/sync-projects', 'POST'],
    ]) {
      const response = await request(base, route, method);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(),
        { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_ROUTE_UNVERIFIED' });
    }
    assert.equal((await request(base, '/api/task6a-after-feed')).status, 200);
    await assertUnchanged();

    stage = 'v3-omits-agent-sessions';
    const sessions = path.join(privateRoot, 'agents', 'agent-session-only', 'sessions');
    mkdirSync(sessions, { recursive: true });
    writeFileSync(path.join(sessions, 'session.jsonl'), `${JSON.stringify({
      message: { role: 'assistant', content: [{ type: 'text', text: 'AGENT SESSION MUST NOT APPEND' }] },
    })}\n`);
    const v3Only = await request(base, '/api/setfarm/agent-feed');
    assert.equal(v3Only.status, 200);
    await assertUnchanged();

    stage = 'empty-transcript-root-reads-db-history';
    const hiddenWorkflow = path.join(privateRoot, 'workflow-hidden');
    renameSync(workflow, hiddenWorkflow);
    const empty = await request(base, '/api/setfarm/agent-feed');
    assert.equal(empty.status, 200);
    assert.deepEqual((await empty.json() as Array<{ id: number }>).map((row) => row.id),
      [rows[0].id]);
    renameSync(hiddenWorkflow, workflow);

    stage = 'missing-transcript-root-refusal';
    const transcriptsRoot = path.join(privateRoot, 'transcripts');
    const hiddenRoot = path.join(privateRoot, 'transcripts-hidden');
    renameSync(transcriptsRoot, hiddenRoot);
    await assertRefused();
    renameSync(hiddenRoot, transcriptsRoot);

    stage = 'workflow-symlink-refusal';
    const hiddenWorkflowInRoot = path.join(transcriptsRoot, 'wf-hidden');
    renameSync(workflow, hiddenWorkflowInRoot);
    symlinkSync(hiddenWorkflowInRoot, workflow);
    await assertRefused();
    unlinkSync(workflow);
    renameSync(hiddenWorkflowInRoot, workflow);

    stage = 'file-symlink-refusal';
    const hiddenSource = `${source}.hidden`;
    renameSync(source, hiddenSource);
    symlinkSync(hiddenSource, source);
    await assertRefused();
    unlinkSync(source);
    renameSync(hiddenSource, source);

    stage = 'oversize-and-utf8-refusal';
    writeFileSync(source, Buffer.alloc(256_001, 65));
    await assertRefused();
    writeFileSync(source, Buffer.from([0xff, 0x0a]));
    await assertRefused();
    writeFileSync(source, line);

    stage = 'database-rights-refusal';
    await db.unsafe(`REVOKE INSERT ON public.agent_feed FROM "${roleName}"`);
    await assertRefused();
    await db.unsafe(`GRANT INSERT ON public.agent_feed TO "${roleName}"`);
    await db.unsafe(`REVOKE USAGE ON SEQUENCE public.agent_feed_id_seq FROM "${roleName}"`);
    await assertRefused();
    await db.unsafe(`GRANT USAGE ON SEQUENCE public.agent_feed_id_seq TO "${roleName}"`);
    assert.equal(readFileSync(source, 'utf8'), line);

    stage = 'v2-omits-new-transcript';
    await stopChild(child);
    child = undefined;
    renameSync(path.join(privateRoot, 'agents', 'agent-session-only'),
      path.join(privateRoot, 'agent-session-hidden'));
    const secondSource = path.join(workflow, 'second-2026-09-28T01-00-00.log');
    writeFileSync(secondSource, `${JSON.stringify({ type: 'item.completed',
      item: { type: 'agent_message', text: 'V2 MUST OMIT TRANSCRIPT' } })}\n`);
    const v2 = await startChild(privateUrl.toString(), privateRoot, 'v2');
    child = v2.child;
    const v2Response = await request(`http://127.0.0.1:${v2.port}`, '/api/setfarm/agent-feed');
    assert.equal(v2Response.status, 200);
    await assertUnchanged();
    await stopChild(child);
    child = undefined;

    stage = 'mixed-mode-refusal';
    const mixed = await startChild(privateUrl.toString(), privateRoot, 'mixed');
    child = mixed.child;
    const mixedResponse = await request(`http://127.0.0.1:${mixed.port}`, '/api/setfarm/agent-feed');
    assert.equal(mixedResponse.status, 503);
    assert.deepEqual(await mixedResponse.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_ROUTE_UNVERIFIED' });
    await assertUnchanged();
  } catch (error) {
    failure = error;
    process.stderr.write(`[mc-task6a-private-transcript] failed at ${stage}\n`);
    throw error;
  } finally {
    const cleanupFailures: string[] = [];
    let childReaped = true;
    try { if (child) await stopChild(child); }
    catch { childReaped = false; cleanupFailures.push('child_not_reaped_fixture_retained'); }
    try { await db?.end({ timeout: 5 }); } catch { cleanupFailures.push('database_connection'); }
    try { if (childReaped && databaseCreated) await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}"`); }
    catch { cleanupFailures.push('fixture_database'); }
    try { if (childReaped && roleCreated) await admin.unsafe(`DROP ROLE IF EXISTS "${roleName}"`); }
    catch { cleanupFailures.push('fixture_role'); }
    try { await admin.end({ timeout: 5 }); } catch { cleanupFailures.push('admin_connection'); }
    try {
      if (childReaped && privateRoot && /^\/tmp\/mc-task6a-transcript-feed-[A-Za-z0-9]+$/.test(privateRoot)) {
        rmSync(privateRoot, { recursive: true });
      }
    } catch { cleanupFailures.push('fixture_files'); }
    if (cleanupFailures.length > 0) {
      const cleanup = new Error(`MC_TASK6A_PRIVATE_CLEANUP_FAILED:${cleanupFailures.join(',')}`);
      if (failure !== undefined) throw new AggregateError([failure, cleanup],
        'MC_TASK6A_PRIVATE_TEST_AND_CLEANUP_FAILED');
      throw cleanup;
    }
  }
});
