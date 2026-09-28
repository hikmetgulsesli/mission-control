import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

async function startChild(privateUrl: string, root: string, mode: string | null = '1'):
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
        ...(mode === null ? {} : { MC_TASK6A_RESTRICTED_AGENT_FEED_READS_VERIFY_V1: mode }),
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

async function fingerprint(db: postgres.Sql): Promise<string> {
  const rows = await db<Array<{ hash: string }>>`
    SELECT md5(jsonb_build_object(
      'rows', (SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id) FROM public.agent_feed f),
      'columns', (SELECT jsonb_agg(jsonb_build_array(a.attname, a.atttypid::text,
        a.attnotnull, pg_catalog.pg_get_expr(d.adbin, d.adrelid)) ORDER BY a.attnum)
        FROM pg_catalog.pg_attribute a
        LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attrelid = 'public.agent_feed'::regclass AND a.attnum > 0 AND NOT a.attisdropped),
      'indexes', (SELECT jsonb_agg(pg_catalog.pg_get_indexdef(i.indexrelid)
        ORDER BY c.relname) FROM pg_catalog.pg_index i
        JOIN pg_catalog.pg_class c ON c.oid = i.indexrelid
        WHERE i.indrelid = 'public.agent_feed'::regclass)
    )::text) AS hash`;
  assert.match(rows[0]?.hash ?? '', /^[a-f0-9]{32}$/);
  return rows[0]!.hash;
}

test('private restricted agent-feed returns DB rows, never file fallback', {
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
  const databaseName = `mc_task6a_feed_${randomBytes(8).toString('hex')}`;
  const roleName = `mc_task6a_feed_role_${randomBytes(8).toString('hex')}`;
  const password = randomBytes(24).toString('hex');
  const admin = postgres(adminUrl, { max: 1 });
  let db: postgres.Sql | undefined;
  let child: ChildProcess | undefined;
  let privateRoot: string | undefined;
  let databaseCreated = false;
  let roleCreated = false;
  let stage = 'private-preflight';
  let failure: unknown;
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
    privateRoot = mkdtempSync('/tmp/mc-task6a-feed-');
    const sessions = path.join(privateRoot, 'agents', 'agent-private', 'sessions');
    mkdirSync(sessions, { recursive: true });
    const fileMessage = path.join(sessions, 'session-private.jsonl');
    writeFileSync(fileMessage, `${JSON.stringify({ message: { role: 'assistant',
      content: [{ type: 'text', text: 'FILE FALLBACK MUST NOT WIN' }] } })}\n`);
    const fileBefore = readFileSync(fileMessage, 'utf8');
    await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
    databaseCreated = true;
    const dbUrl = new URL(adminUrl);
    dbUrl.pathname = `/${databaseName}`;
    db = postgres(dbUrl.toString(), { max: 1 });
    await db`CREATE TABLE public.agent_feed (
      id SERIAL PRIMARY KEY, agent_id TEXT NOT NULL, agent_name TEXT NOT NULL,
      message TEXT NOT NULL, session_id TEXT, msg_hash TEXT UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    await db`CREATE INDEX idx_agent_feed_created ON public.agent_feed(created_at DESC)`;
    await db`INSERT INTO public.agent_feed (agent_id, agent_name, message, session_id, msg_hash)
      VALUES ('agent-db', 'DB agent', 'DB SENTINEL ONLY', 'db-session', 'db-hash')`;
    const before = await fingerprint(db);
    await admin.unsafe(`CREATE ROLE "${roleName}" LOGIN PASSWORD '${password}'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    roleCreated = true;
    await admin.unsafe(`GRANT CONNECT ON DATABASE "${databaseName}" TO "${roleName}"`);
    await db.unsafe(`GRANT USAGE ON SCHEMA public TO "${roleName}"`);
    await db.unsafe(`GRANT SELECT ON public.agent_feed TO "${roleName}"`);
    const privateUrl = new URL(dbUrl);
    privateUrl.username = roleName;
    privateUrl.password = password;

    stage = 'db-over-file-red-green';
    const started = await startChild(privateUrl.toString(), privateRoot);
    child = started.child;
    const base = `http://127.0.0.1:${started.port}`;
    const health = await request(base, '/api/health');
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { database: 'up', feed: 1 });
    const feed = await request(base, '/api/setfarm/agent-feed?limit=10');
    assert.equal(feed.status, 200);
    assert.deepEqual((await feed.json() as Array<{ message: string }>).map((row) => row.message),
      ['DB SENTINEL ONLY']);
    assert.equal(await fingerprint(db), before);
    assert.equal(readFileSync(fileMessage, 'utf8'), fileBefore);

    stage = 'route-and-cache-exclusion';
    for (const [route, method] of [
      ['/api/setfarm/agent-feed', 'DELETE'],
      ['/api/SETFARM/AGENT-FEED', 'DELETE'],
      ['/api/setfarm/activity', 'DELETE'],
      ['/api/setfarm/sync-projects', 'POST'],
      ['/api/setfarm/agents', 'GET'],
    ]) {
      const refused = await request(base, route, method);
      assert.equal(refused.status, 503);
      assert.deepEqual(await refused.json(),
        { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_ROUTE_UNVERIFIED' });
    }
    const after = await request(base, '/api/task6a-after-feed');
    assert.equal(after.status, 200);
    assert.deepEqual(await after.json(), { reachable: true });
    await db`UPDATE public.agent_feed SET message = 'DB UPDATED WITHOUT CACHE' WHERE id = 1`;
    const refreshed = await request(base, '/api/setfarm/agent-feed?limit=10');
    assert.equal(refreshed.status, 200);
    assert.deepEqual((await refreshed.json() as Array<{ message: string }>).map((row) => row.message),
      ['DB UPDATED WITHOUT CACHE']);
    await db.unsafe(`REVOKE SELECT ON public.agent_feed FROM "${roleName}"`);
    const postVerifyDenied = await request(base, '/api/setfarm/agent-feed');
    assert.equal(postVerifyDenied.status, 502);
    assert.deepEqual(await postVerifyDenied.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_VERIFY_REFUSED' });
    await db.unsafe(`GRANT SELECT ON public.agent_feed TO "${roleName}"`);
    await stopChild(child);
    child = undefined;

    stage = 'shadow-search-path';
    await db`CREATE SCHEMA shadow`;
    await db`CREATE TABLE shadow.agent_feed (id integer, message text, created_at timestamptz)`;
    await db`INSERT INTO shadow.agent_feed VALUES (1, 'SHADOW MUST NOT WIN', now())`;
    await db.unsafe(`GRANT USAGE ON SCHEMA shadow TO "${roleName}"`);
    await db.unsafe(`GRANT SELECT ON shadow.agent_feed TO "${roleName}"`);
    await admin.unsafe(`ALTER ROLE "${roleName}" IN DATABASE "${databaseName}"
      SET search_path = shadow, public`);
    const shadow = await startChild(privateUrl.toString(), privateRoot);
    child = shadow.child;
    const shadowResponse = await request(`http://127.0.0.1:${shadow.port}`, '/api/setfarm/agent-feed');
    assert.equal(shadowResponse.status, 200);
    assert.deepEqual((await shadowResponse.json() as Array<{ message: string }>).map((row) => row.message),
      ['DB UPDATED WITHOUT CACHE']);
    await stopChild(child);
    child = undefined;
    await admin.unsafe(`ALTER ROLE "${roleName}" IN DATABASE "${databaseName}"
      RESET search_path`);

    stage = 'index-drift-refusal';
    await db`DROP INDEX public.idx_agent_feed_created`;
    const noIndex = await startChild(privateUrl.toString(), privateRoot);
    child = noIndex.child;
    const noIndexResponse = await request(`http://127.0.0.1:${noIndex.port}`, '/api/setfarm/agent-feed');
    assert.equal(noIndexResponse.status, 502);
    assert.deepEqual(await noIndexResponse.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_VERIFY_REFUSED' });
    await stopChild(child);
    child = undefined;
    await db`CREATE INDEX idx_agent_feed_created ON public.agent_feed(created_at DESC)`;

    stage = 'write-grant-refusal';
    await db.unsafe(`GRANT UPDATE ON public.agent_feed TO "${roleName}"`);
    const writer = await startChild(privateUrl.toString(), privateRoot);
    child = writer.child;
    const writerResponse = await request(`http://127.0.0.1:${writer.port}`, '/api/setfarm/agent-feed');
    assert.equal(writerResponse.status, 502);
    assert.deepEqual(await writerResponse.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_VERIFY_REFUSED' });
    await stopChild(child);
    child = undefined;
    await db.unsafe(`REVOKE UPDATE ON public.agent_feed FROM "${roleName}"`);

    stage = 'database-unavailable-no-fallback';
    await db.unsafe(`REVOKE SELECT ON public.agent_feed FROM "${roleName}"`);
    const denied = await startChild(privateUrl.toString(), privateRoot);
    child = denied.child;
    const deniedResponse = await request(`http://127.0.0.1:${denied.port}`, '/api/setfarm/agent-feed');
    assert.equal(deniedResponse.status, 502);
    assert.deepEqual(await deniedResponse.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_VERIFY_REFUSED' });
    await stopChild(child);
    child = undefined;
    await db.unsafe(`GRANT SELECT ON public.agent_feed TO "${roleName}"`);
    assert.equal(readFileSync(fileMessage, 'utf8'), fileBefore);

    stage = 'invalid-mode-refusal';
    const invalid = await startChild(privateUrl.toString(), privateRoot, '0');
    child = invalid.child;
    const invalidResponse = await request(`http://127.0.0.1:${invalid.port}`, '/api/setfarm/agent-feed');
    assert.equal(invalidResponse.status, 503);
    assert.deepEqual(await invalidResponse.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_ROUTE_UNVERIFIED' });
    await stopChild(child);
    child = undefined;

    stage = 'ordinary-shadow-consistency';
    await db`DROP TABLE shadow.agent_feed`;
    await db`CREATE TABLE shadow.agent_feed (
      id SERIAL PRIMARY KEY, agent_id TEXT NOT NULL, agent_name TEXT NOT NULL,
      message TEXT NOT NULL, session_id TEXT, msg_hash TEXT UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    await db`CREATE INDEX idx_agent_feed_created ON shadow.agent_feed(created_at DESC)`;
    const ordinaryUrl = new URL(dbUrl);
    ordinaryUrl.searchParams.set('options', '-c search_path=shadow,public');
    const ordinaryProbe = postgres(ordinaryUrl.toString(), { max: 1 });
    try {
      const pathRows = await ordinaryProbe<Array<{ searchPath: string }>>`
        SELECT current_setting('search_path') AS "searchPath"`;
      assert.equal(pathRows[0]?.searchPath, 'shadow,public');
    } finally { await ordinaryProbe.end({ timeout: 5 }); }
    const ordinary = await startChild(ordinaryUrl.toString(), privateRoot, null);
    child = ordinary.child;
    const ordinaryResponse = await request(`http://127.0.0.1:${ordinary.port}`, '/api/setfarm/agent-feed');
    assert.equal(ordinaryResponse.status, 200);
    assert.deepEqual((await ordinaryResponse.json() as Array<{ message: string }>).map((row) => row.message),
      ['FILE FALLBACK MUST NOT WIN']);
    const shadowWritten = await db<Array<{ message: string }>>`
      SELECT message FROM shadow.agent_feed ORDER BY created_at DESC`;
    assert.deepEqual(shadowWritten.map((row) => row.message), ['FILE FALLBACK MUST NOT WIN']);
  } catch (error) {
    failure = error;
    process.stderr.write(`[mc-task6a-private-feed] failed at ${stage}\n`);
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
      if (childReaped && privateRoot && /^\/tmp\/mc-task6a-feed-[A-Za-z0-9]+$/.test(privateRoot)) {
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
