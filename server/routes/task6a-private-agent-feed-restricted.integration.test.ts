import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
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

async function startChild(privateUrl: string, root: string, mode: string | null = '1',
  appendMode?: string):
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
        ...(appendMode === undefined ? {} : { MC_TASK6A_RESTRICTED_AGENT_FEED_APPEND_V2: appendMode }),
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

test('private restricted agent-session append persists before returning feed', {
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
  const databaseName = `mc_task6a_append_${randomBytes(8).toString('hex')}`;
  const outsideDatabaseName = `mc_task6a_outside_${randomBytes(8).toString('hex')}`;
  const roleName = `mc_task6a_append_role_${randomBytes(8).toString('hex')}`;
  const password = randomBytes(24).toString('hex');
  const admin = postgres(adminUrl, { max: 1 });
  let db: postgres.Sql | undefined;
  let child: ChildProcess | undefined;
  let privateRoot: string | undefined;
  let databaseCreated = false;
  let outsideDatabaseCreated = false;
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
    const sessions = path.join(privateRoot, 'agents', 'agent-v2', 'sessions');
    mkdirSync(sessions, { recursive: true });
    const fileMessage = path.join(sessions, 'session-v2.jsonl');
    writeFileSync(fileMessage, `${JSON.stringify({ message: { role: 'assistant',
      content: [{ type: 'text', text: 'PRIVATE APPEND MESSAGE' }] } })}\n`);
    const transcripts = path.join(privateRoot, 'transcripts');
    mkdirSync(transcripts);
    writeFileSync(path.join(transcripts, 'excluded.jsonl'), `${JSON.stringify({
      role: 'assistant', content: [{ type: 'text', text: 'TRANSCRIPT MUST NOT BE APPENDED' }],
    })}\n`);
    const fileBefore = readFileSync(fileMessage, 'utf8');
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
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
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
    const probe = postgres(privateUrl.toString(), { max: 1 });
    try {
      const rights = await probe<Array<{ login: string; databaseCreate: boolean; databaseTemp: boolean;
        schemaCreate: boolean; tableSelect: boolean; tableInsert: boolean;
        tableExtra: boolean; sequenceUsage: boolean; sequenceSelect: boolean;
        sequenceUpdate: boolean }>>`
        SELECT session_user AS login,
          has_database_privilege(current_user, current_database(), 'CREATE') AS "databaseCreate",
          has_database_privilege(current_user, current_database(), 'TEMPORARY') AS "databaseTemp",
          has_schema_privilege(current_user, 'public', 'CREATE') AS "schemaCreate",
          has_table_privilege(current_user, 'public.agent_feed', 'SELECT') AS "tableSelect",
          has_table_privilege(current_user, 'public.agent_feed', 'INSERT') AS "tableInsert",
          has_table_privilege(current_user, 'public.agent_feed',
            'UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN') AS "tableExtra",
          has_sequence_privilege(current_user, 'public.agent_feed_id_seq', 'USAGE') AS "sequenceUsage",
          has_sequence_privilege(current_user, 'public.agent_feed_id_seq', 'SELECT') AS "sequenceSelect",
          has_sequence_privilege(current_user, 'public.agent_feed_id_seq', 'UPDATE') AS "sequenceUpdate"`;
      assert.deepEqual(rights[0], { login: roleName, databaseCreate: false, databaseTemp: false,
        schemaCreate: false, tableSelect: true, tableInsert: true,
        tableExtra: false, sequenceUsage: true, sequenceSelect: false,
        sequenceUpdate: false });
    } finally { await probe.end({ timeout: 5 }); }

    stage = 'append-red-green';
    const started = await startChild(privateUrl.toString(), privateRoot, null, '1');
    child = started.child;
    const base = `http://127.0.0.1:${started.port}`;
    const health = await request(base, '/api/health');
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { database: 'up', feed: 0 });
    const feed = await request(base, '/api/setfarm/agent-feed?limit=10');
    assert.equal(feed.status, 200);
    const rows = await feed.json() as Array<{ id: number; message: string; agent_id: string;
      session_id: string; msg_hash: string }>;
    assert.equal(rows.length, 1);
    assert.ok(Number.isSafeInteger(rows[0].id) && rows[0].id > 0);
    assert.deepEqual({ message: rows[0].message, agent_id: rows[0].agent_id,
      session_id: rows[0].session_id },
      { message: 'PRIVATE APPEND MESSAGE', agent_id: 'agent-v2', session_id: 'session-v2' });
    assert.match(rows[0].msg_hash, /^[a-f0-9]{32}$/);
    const persisted = await db<Array<{ id: number; message: string; msg_hash: string }>>`
      SELECT id, message, msg_hash FROM public.agent_feed`;
    assert.deepEqual([...persisted], [{ id: rows[0].id, message: rows[0].message,
      msg_hash: rows[0].msg_hash }]);
    const repeated = await request(base, '/api/setfarm/agent-feed?limit=10');
    assert.equal(repeated.status, 200);
    assert.deepEqual((await repeated.json() as Array<{ id: number }>).map((row) => row.id),
      [rows[0].id]);
    const count = await db<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count FROM public.agent_feed`;
    assert.equal(count[0]?.count, 1);
    assert.equal(readFileSync(fileMessage, 'utf8'), fileBefore);

    stage = 'route-and-source-refusal';
    for (const [route, method] of [
      ['/api/setfarm/agent-feed', 'DELETE'],
      ['/api/SETFARM/AGENT-FEED', 'DELETE'],
      ['/api/setfarm/activity', 'DELETE'],
      ['/api/setfarm/sync-projects', 'POST'],
    ]) {
      const refused = await request(base, route, method);
      assert.equal(refused.status, 503);
      assert.deepEqual(await refused.json(),
        { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_ROUTE_UNVERIFIED' });
    }
    const after = await request(base, '/api/task6a-after-feed');
    assert.equal(after.status, 200);
    assert.deepEqual(await after.json(), { reachable: true });
    const agentsDir = path.join(privateRoot, 'agents');
    const hiddenAgentsDir = path.join(privateRoot, 'agents-hidden');
    renameSync(agentsDir, hiddenAgentsDir);
    const missingSource = await request(base, '/api/setfarm/agent-feed');
    assert.equal(missingSource.status, 502);
    assert.deepEqual(await missingSource.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_VERIFY_REFUSED' });
    symlinkSync(hiddenAgentsDir, agentsDir);
    const unsafeRoot = await request(base, '/api/setfarm/agent-feed');
    assert.equal(unsafeRoot.status, 502);
    assert.deepEqual(await unsafeRoot.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_VERIFY_REFUSED' });
    unlinkSync(agentsDir);
    renameSync(hiddenAgentsDir, agentsDir);
    const symlink = path.join(sessions, 'symlink.jsonl');
    symlinkSync(path.join(transcripts, 'excluded.jsonl'), symlink);
    const unsafeSource = await request(base, '/api/setfarm/agent-feed');
    assert.equal(unsafeSource.status, 502);
    assert.deepEqual(await unsafeSource.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_VERIFY_REFUSED' });
    unlinkSync(symlink);
    const hiddenSessions = path.join(privateRoot, 'sessions-hidden');
    renameSync(sessions, hiddenSessions);
    symlinkSync(transcripts, sessions);
    const unsafeParent = await request(base, '/api/setfarm/agent-feed');
    assert.equal(unsafeParent.status, 502);
    assert.deepEqual(await unsafeParent.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_VERIFY_REFUSED' });
    unlinkSync(sessions);
    renameSync(hiddenSessions, sessions);

    stage = 'post-verify-extra-grant-refusal';
    await db.unsafe(`GRANT UPDATE ON public.agent_feed TO "${roleName}"`);
    const broadenedAfterReady = await request(base, '/api/setfarm/agent-feed');
    assert.equal(broadenedAfterReady.status, 502);
    assert.deepEqual(await broadenedAfterReady.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_VERIFY_REFUSED' });
    await db.unsafe(`REVOKE UPDATE ON public.agent_feed FROM "${roleName}"`);
    assert.equal((await db<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count FROM public.agent_feed`)[0]?.count, 1);

    stage = 'post-verify-replication-role-refusal';
    await admin.unsafe(`ALTER ROLE "${roleName}" REPLICATION`);
    const replicationRole = await request(base, '/api/setfarm/agent-feed');
    assert.equal(replicationRole.status, 502);
    assert.deepEqual(await replicationRole.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_VERIFY_REFUSED' });
    await admin.unsafe(`ALTER ROLE "${roleName}" NOREPLICATION`);

    stage = 'post-verify-other-database-connect-refusal';
    await admin.unsafe(`CREATE DATABASE "${outsideDatabaseName}"`);
    outsideDatabaseCreated = true;
    await admin.unsafe(`REVOKE CONNECT ON DATABASE "${outsideDatabaseName}" FROM PUBLIC`);
    await admin.unsafe(`GRANT CONNECT ON DATABASE "${outsideDatabaseName}" TO "${roleName}"`);
    const otherDatabase = await request(base, '/api/setfarm/agent-feed');
    assert.equal(otherDatabase.status, 502);
    assert.deepEqual(await otherDatabase.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_VERIFY_REFUSED' });
    await admin.unsafe(`REVOKE CONNECT ON DATABASE "${outsideDatabaseName}" FROM "${roleName}"`);
    const restoredDatabaseFence = await request(base, '/api/setfarm/agent-feed');
    assert.equal(restoredDatabaseFence.status, 200);
    await admin.unsafe(`DROP DATABASE "${outsideDatabaseName}"`);
    outsideDatabaseCreated = false;

    stage = 'post-verify-other-table-grant-refusal';
    await db`CREATE TABLE public.unrelated_feed (id integer PRIMARY KEY)`;
    await db.unsafe(`GRANT SELECT ON public.unrelated_feed TO "${roleName}"`);
    const otherTable = await request(base, '/api/setfarm/agent-feed');
    assert.equal(otherTable.status, 502);
    assert.deepEqual(await otherTable.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_VERIFY_REFUSED' });
    await db.unsafe(`REVOKE SELECT ON public.unrelated_feed FROM "${roleName}"`);
    await db`DROP TABLE public.unrelated_feed`;

    stage = 'post-verify-other-schema-grant-refusal';
    await db`CREATE SCHEMA unrelated_schema`;
    await db.unsafe(`GRANT USAGE ON SCHEMA unrelated_schema TO "${roleName}"`);
    const otherSchema = await request(base, '/api/setfarm/agent-feed');
    assert.equal(otherSchema.status, 502);
    assert.deepEqual(await otherSchema.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_VERIFY_REFUSED' });
    await db.unsafe(`REVOKE USAGE ON SCHEMA unrelated_schema FROM "${roleName}"`);
    await db`DROP SCHEMA unrelated_schema`;

    stage = 'post-verify-other-sequence-grant-refusal';
    await db`CREATE SEQUENCE public.unrelated_feed_seq`;
    await db.unsafe(`GRANT USAGE ON SEQUENCE public.unrelated_feed_seq TO "${roleName}"`);
    const otherSequence = await request(base, '/api/setfarm/agent-feed');
    assert.equal(otherSequence.status, 502);
    assert.deepEqual(await otherSequence.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_VERIFY_REFUSED' });
    await db.unsafe(`REVOKE USAGE ON SEQUENCE public.unrelated_feed_seq FROM "${roleName}"`);
    await db`DROP SEQUENCE public.unrelated_feed_seq`;

    stage = 'post-verify-database-temp-grant-refusal';
    await admin.unsafe(`GRANT TEMPORARY ON DATABASE "${databaseName}" TO "${roleName}"`);
    const tempGrant = await request(base, '/api/setfarm/agent-feed');
    assert.equal(tempGrant.status, 502);
    assert.deepEqual(await tempGrant.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_VERIFY_REFUSED' });
    await admin.unsafe(`REVOKE TEMPORARY ON DATABASE "${databaseName}" FROM "${roleName}"`);

    stage = 'post-verify-large-object-grant-refusal';
    const largeObject = await db<Array<{ oid: number }>>`
      SELECT pg_catalog.lo_create(0) AS oid`;
    const largeObjectOid = largeObject[0]!.oid;
    assert.ok(Number.isSafeInteger(largeObjectOid) && largeObjectOid > 0);
    await db.unsafe(`GRANT SELECT ON LARGE OBJECT ${largeObjectOid} TO "${roleName}"`);
    const largeObjectGrant = await request(base, '/api/setfarm/agent-feed');
    assert.equal(largeObjectGrant.status, 502);
    assert.deepEqual(await largeObjectGrant.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_VERIFY_REFUSED' });
    await db.unsafe(`REVOKE SELECT ON LARGE OBJECT ${largeObjectOid} FROM "${roleName}"`);
    await db`SELECT pg_catalog.lo_unlink(${largeObjectOid})`;

    stage = 'post-verify-other-type-refusal';
    await db`CREATE TYPE public.unrelated_type AS ENUM ('unexpected')`;
    const otherType = await request(base, '/api/setfarm/agent-feed');
    assert.equal(otherType.status, 502);
    assert.deepEqual(await otherType.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_VERIFY_REFUSED' });
    await db`DROP TYPE public.unrelated_type`;

    stage = 'post-verify-insert-refusal';
    await db.unsafe(`REVOKE INSERT ON public.agent_feed FROM "${roleName}"`);
    const revokedAfterReady = await request(base, '/api/setfarm/agent-feed');
    assert.equal(revokedAfterReady.status, 502);
    assert.deepEqual(await revokedAfterReady.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_VERIFY_REFUSED' });
    await db.unsafe(`GRANT INSERT ON public.agent_feed TO "${roleName}"`);
    const unchanged = await db<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count FROM public.agent_feed`;
    assert.equal(unchanged[0]?.count, 1);

    stage = 'insert-grant-refusal';
    await stopChild(child);
    child = undefined;
    await db.unsafe(`REVOKE INSERT ON public.agent_feed FROM "${roleName}"`);
    const noInsert = await startChild(privateUrl.toString(), privateRoot, null, '1');
    child = noInsert.child;
    const noInsertResponse = await request(`http://127.0.0.1:${noInsert.port}`, '/api/setfarm/agent-feed');
    assert.equal(noInsertResponse.status, 502);
    assert.deepEqual(await noInsertResponse.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_VERIFY_REFUSED' });
    await stopChild(child);
    child = undefined;
    await db.unsafe(`GRANT INSERT ON public.agent_feed TO "${roleName}"`);

    stage = 'sequence-grant-refusal';
    await db.unsafe(`REVOKE USAGE ON SEQUENCE public.agent_feed_id_seq FROM "${roleName}"`);
    const noSequence = await startChild(privateUrl.toString(), privateRoot, null, '1');
    child = noSequence.child;
    const noSequenceResponse = await request(`http://127.0.0.1:${noSequence.port}`, '/api/setfarm/agent-feed');
    assert.equal(noSequenceResponse.status, 502);
    assert.deepEqual(await noSequenceResponse.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_VERIFY_REFUSED' });
    await stopChild(child);
    child = undefined;
    await db.unsafe(`GRANT USAGE ON SEQUENCE public.agent_feed_id_seq TO "${roleName}"`);
    const stillOne = await db<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count FROM public.agent_feed`;
    assert.equal(stillOne[0]?.count, 1);

    stage = 'schema-drift-refusal';
    await db`DROP INDEX public.idx_agent_feed_created`;
    const noIndex = await startChild(privateUrl.toString(), privateRoot, null, '1');
    child = noIndex.child;
    const noIndexResponse = await request(`http://127.0.0.1:${noIndex.port}`, '/api/setfarm/agent-feed');
    assert.equal(noIndexResponse.status, 502);
    assert.deepEqual(await noIndexResponse.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_VERIFY_REFUSED' });
    await stopChild(child);
    child = undefined;
    await db`CREATE INDEX idx_agent_feed_created ON public.agent_feed(created_at DESC)`;

    stage = 'simultaneous-mode-refusal';
    const mixed = await startChild(privateUrl.toString(), privateRoot, '1', '1');
    child = mixed.child;
    const mixedResponse = await request(`http://127.0.0.1:${mixed.port}`, '/api/setfarm/agent-feed');
    assert.equal(mixedResponse.status, 503);
    assert.deepEqual(await mixedResponse.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_ROUTE_UNVERIFIED' });
    assert.equal((await db<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count FROM public.agent_feed`)[0]?.count, 1);
    assert.equal(readFileSync(fileMessage, 'utf8'), fileBefore);
    await stopChild(child);
    child = undefined;

    stage = 'same-transaction-feed-order';
    writeFileSync(fileMessage, fileBefore + ['SECOND APPEND MESSAGE', 'THIRD APPEND MESSAGE']
      .map((text) => `${JSON.stringify({ message: { role: 'assistant',
        content: [{ type: 'text', text }] } })}\n`).join(''));
    const ordered = await startChild(privateUrl.toString(), privateRoot, null, '1');
    child = ordered.child;
    const limited = await request(`http://127.0.0.1:${ordered.port}`,
      '/api/setfarm/agent-feed?limit=1');
    assert.equal(limited.status, 200);
    assert.deepEqual((await limited.json() as Array<{ message: string }>).map((row) => row.message),
      ['THIRD APPEND MESSAGE']);
    assert.equal((await db<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count FROM public.agent_feed`)[0]?.count, 3);

    stage = 'apostrophe-preservation';
    writeFileSync(fileMessage, `${readFileSync(fileMessage, 'utf8')}${JSON.stringify({
      message: { role: 'assistant', content: [{ type: 'text', text: "I'm done with this task" }] },
    })}\n`);
    const quoted = await request(`http://127.0.0.1:${ordered.port}`,
      '/api/setfarm/agent-feed?limit=1');
    assert.equal(quoted.status, 200);
    assert.deepEqual((await quoted.json() as Array<{ message: string }>).map((row) => row.message),
      ["I'm done with this task"]);
    assert.equal((await db<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count FROM public.agent_feed`)[0]?.count, 4);

    stage = 'malformed-utf8-refusal';
    const validFeedBytes = readFileSync(fileMessage);
    writeFileSync(fileMessage, Buffer.concat([validFeedBytes,
      Buffer.from('{"message":{"role":"assistant","content":[{"type":"text","text":"BAD '),
      Buffer.from([0xff]), Buffer.from(' BYTE"}]}}\n')]));
    const malformed = await request(`http://127.0.0.1:${ordered.port}`,
      '/api/setfarm/agent-feed?limit=1');
    assert.equal(malformed.status, 502);
    assert.deepEqual(await malformed.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_VERIFY_REFUSED' });
    assert.equal((await db<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count FROM public.agent_feed`)[0]?.count, 4);

    stage = 'legacy-apostrophe-collision-refusal';
    const sourceLegacy = "LEGACY I'm done";
    const storedLegacy = "LEGACY I''m done";
    const legacyHash = createHash('md5')
      .update('agent-v2' + 'session-v2' + storedLegacy).digest('hex');
    await db`INSERT INTO public.agent_feed
      (agent_id, agent_name, message, session_id, msg_hash)
      VALUES ('agent-v2', 'agent-v2', ${storedLegacy}, 'session-v2', ${legacyHash})`;
    writeFileSync(fileMessage, Buffer.concat([validFeedBytes,
      Buffer.from(`${JSON.stringify({ message: { role: 'assistant',
        content: [{ type: 'text', text: sourceLegacy }] } })}\n`)]));
    const legacyCollision = await request(`http://127.0.0.1:${ordered.port}`,
      '/api/setfarm/agent-feed?limit=1');
    assert.equal(legacyCollision.status, 502);
    assert.deepEqual(await legacyCollision.json(),
      { error: 'MC_TASK6A_RESTRICTED_AGENT_FEED_VERIFY_REFUSED' });
    assert.equal((await db<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count FROM public.agent_feed`)[0]?.count, 5);
    assert.equal((await db<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count FROM public.agent_feed
      WHERE message = ${sourceLegacy}`)[0]?.count, 0);
  } catch (error) {
    failure = error;
    process.stderr.write(`[mc-task6a-private-append] failed at ${stage}\n`);
    throw error;
  } finally {
    const cleanupFailures: string[] = [];
    let childReaped = true;
    try { if (child) await stopChild(child); }
    catch { childReaped = false; cleanupFailures.push('child_not_reaped_fixture_retained'); }
    try { await db?.end({ timeout: 5 }); } catch { cleanupFailures.push('database_connection'); }
    try { if (childReaped && outsideDatabaseCreated) await admin.unsafe(`DROP DATABASE IF EXISTS "${outsideDatabaseName}"`); }
    catch { cleanupFailures.push('outside_fixture_database'); }
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
