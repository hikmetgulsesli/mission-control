import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
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

async function startChild(privateUrl: string, mode: string | null = '1'):
  Promise<Readonly<{ child: ChildProcess; port: number }>> {
  const child = spawn(process.execPath,
    ['--import', 'tsx', 'server/routes/task6a-private-prd-child.ts'], {
      cwd: process.cwd(),
      env: {
        PATH: '/opt/homebrew/bin:/usr/bin:/bin', LANG: 'C', LC_ALL: 'C',
        SETFARM_PG_URL: privateUrl,
        GATEWAY_TOKEN: 'private-fixture-no-live-read',
        ...(mode === null ? {} : { MC_TASK6A_RESTRICTED_PRD_READS_VERIFY_V1: mode }),
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
      'schema', (SELECT jsonb_agg(jsonb_build_array(c.relname, c.relkind,
        c.relpersistence, c.relowner::text, a.attname, a.atttypid::text,
        a.attnotnull, pg_catalog.pg_get_expr(d.adbin, d.adrelid))
        ORDER BY c.relname, a.attnum)
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
        LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
        WHERE n.nspname = 'public'),
      'indexes', (SELECT jsonb_agg(pg_catalog.pg_get_indexdef(i.indexrelid)
        ORDER BY ic.relname) FROM pg_catalog.pg_index i
        JOIN pg_catalog.pg_class ic ON ic.oid = i.indexrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = ic.relnamespace
        WHERE n.nspname = 'public'),
      'prds', (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM public.prds p),
      'templates', (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM public.prd_templates t)
    )::text) AS hash`;
  assert.match(rows[0]?.hash ?? '', /^[a-f0-9]{32}$/);
  return rows[0]!.hash;
}

test('private restricted MC PRD reads require precreated safe public tables', {
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
  const databaseName = `mc_task6a_prd_${randomBytes(8).toString('hex')}`;
  const roleName = `mc_task6a_prd_role_${randomBytes(8).toString('hex')}`;
  const password = randomBytes(24).toString('hex');
  const admin = postgres(adminUrl, { max: 1 });
  let db: postgres.Sql | undefined;
  let child: ChildProcess | undefined;
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

    stage = 'private-schema';
    await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
    databaseCreated = true;
    const dbUrl = new URL(adminUrl);
    dbUrl.pathname = `/${databaseName}`;
    db = postgres(dbUrl.toString(), { max: 1 });
    await db`CREATE TABLE public.prds (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, platform TEXT DEFAULT 'web',
      urls TEXT, description TEXT, analysis TEXT, research TEXT,
      chat_history TEXT, prd_content TEXT, prd_version INTEGER DEFAULT 1,
      score INTEGER, score_details TEXT, mockup_screens TEXT, pages TEXT,
      cost_estimate TEXT, run_id TEXT, template_id TEXT, stitch_project_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`;
    await db`CREATE TABLE public.prd_templates (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT,
      platform TEXT DEFAULT 'web', prd_content TEXT, description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW())`;
    await db`INSERT INTO public.prds (id, title) VALUES ('prd-private', 'Private sentinel')`;
    await db`INSERT INTO public.prd_templates (id, name) VALUES ('tpl-private', 'Private template')`;
    const before = await fingerprint(db);

    stage = 'private-role';
    await admin.unsafe(`CREATE ROLE "${roleName}" LOGIN PASSWORD '${password}'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    roleCreated = true;
    await admin.unsafe(`GRANT CONNECT ON DATABASE "${databaseName}" TO "${roleName}"`);
    await db.unsafe(`GRANT USAGE ON SCHEMA public TO "${roleName}"`);
    await db.unsafe(`GRANT SELECT ON public.prds, public.prd_templates TO "${roleName}"`);
    const privateUrl = new URL(dbUrl);
    privateUrl.username = roleName;
    privateUrl.password = password;
    const probe = postgres(privateUrl.toString(), { max: 1 });
    try {
      const rights = await probe<Array<{ login: string; databaseCreate: boolean;
        schemaCreate: boolean; prdsWrite: boolean; templatesWrite: boolean }>>`
        SELECT session_user AS login,
          has_database_privilege(current_user, current_database(), 'CREATE') AS "databaseCreate",
          has_schema_privilege(current_user, 'public', 'CREATE') AS "schemaCreate",
          has_table_privilege(current_user, 'public.prds',
            'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN') AS "prdsWrite",
          has_table_privilege(current_user, 'public.prd_templates',
            'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN') AS "templatesWrite"`;
      assert.deepEqual(rights[0], { login: roleName, databaseCreate: false,
        schemaCreate: false, prdsWrite: false, templatesWrite: false });
    } finally { await probe.end({ timeout: 5 }); }

    stage = 'restricted-reads-red-green';
    const started = await startChild(privateUrl.toString());
    child = started.child;
    const base = `http://127.0.0.1:${started.port}`;
    const health = await request(base, '/api/health');
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { database: 'up', prds: 1 });
    const history = await request(base, '/api/prd/history');
    assert.equal(history.status, 200);
    assert.deepEqual((await history.json() as Array<{ id: string }>).map((row) => row.id), ['prd-private']);
    const templates = await request(base, '/api/prd/templates');
    assert.equal(templates.status, 200);
    assert.deepEqual((await templates.json() as Array<{ id: string }>).map((row) => row.id), ['tpl-private']);
    const detail = await request(base, '/api/prd/history/prd-private');
    assert.equal(detail.status, 503);
    assert.deepEqual(await detail.json(), { error: 'MC_TASK6A_RESTRICTED_PRD_ROUTE_UNVERIFIED' });
    for (const [route, method] of [
      ['/api/prd/analyze', 'POST'], ['/api/prd/history/prd-private', 'DELETE'],
      ['/api/prd/benchmark/run-private', 'GET'], ['/api/prd/analytics', 'GET'],
      ['/api/PRD/history/prd-private', 'GET'], ['/api/PRD/analyze', 'POST'],
    ]) {
      const refused = await request(base, route, method);
      assert.equal(refused.status, 503);
      assert.deepEqual(await refused.json(), { error: 'MC_TASK6A_RESTRICTED_PRD_ROUTE_UNVERIFIED' });
    }
    const after = await request(base, '/api/task6a-after-prd');
    assert.equal(after.status, 200);
    assert.deepEqual(await after.json(), { reachable: true });
    assert.equal(await fingerprint(db), before);

    stage = 'shadow-search-path';
    await stopChild(child);
    child = undefined;
    await db`CREATE SCHEMA shadow`;
    await db`CREATE TABLE shadow.prds (id text, title text, updated_at timestamptz)`;
    await db`CREATE TABLE shadow.prd_templates (id text, name text)`;
    await db`INSERT INTO shadow.prds VALUES ('prd-shadow', 'Wrong source', now())`;
    await db`INSERT INTO shadow.prd_templates VALUES ('tpl-shadow', 'Wrong source')`;
    await db.unsafe(`GRANT USAGE ON SCHEMA shadow TO "${roleName}"`);
    await db.unsafe(`GRANT SELECT ON shadow.prds, shadow.prd_templates TO "${roleName}"`);
    await admin.unsafe(`ALTER ROLE "${roleName}" IN DATABASE "${databaseName}"
      SET search_path = shadow, public`);
    const shadow = await startChild(privateUrl.toString());
    child = shadow.child;
    const shadowBase = `http://127.0.0.1:${shadow.port}`;
    const shadowHistory = (await (await request(shadowBase, '/api/prd/history')).json()) as Array<{ id: string }>;
    const shadowTemplates = (await (await request(shadowBase, '/api/prd/templates')).json()) as Array<{ id: string }>;
    assert.deepEqual(shadowHistory.map((row) => row.id), ['prd-private']);
    assert.deepEqual(shadowTemplates.map((row) => row.id), ['tpl-private']);
    await stopChild(child);
    child = undefined;
    await admin.unsafe(`ALTER ROLE "${roleName}" IN DATABASE "${databaseName}"
      RESET search_path`);
    assert.equal(await fingerprint(db), before);

    stage = 'empty-templates-refusal';
    const originalTemplates = await db<Array<{ createdAt: string }>>`
      SELECT created_at::text AS "createdAt" FROM public.prd_templates WHERE id = 'tpl-private'`;
    assert.equal(originalTemplates.length, 1);
    await db`DELETE FROM public.prd_templates`;
    const emptyTemplates = await startChild(privateUrl.toString());
    child = emptyTemplates.child;
    const emptyResponse = await request(`http://127.0.0.1:${emptyTemplates.port}`, '/api/prd/templates');
    assert.equal(emptyResponse.status, 502);
    assert.deepEqual(await emptyResponse.json(), { error: 'MC_TASK6A_RESTRICTED_PRD_VERIFY_REFUSED' });
    await stopChild(child);
    child = undefined;
    await db`INSERT INTO public.prd_templates (id, name, created_at)
      VALUES ('tpl-private', 'Private template', ${originalTemplates[0].createdAt}::timestamptz)`;

    stage = 'default-drift-refusal';
    await db`ALTER TABLE public.prds ALTER COLUMN platform SET DEFAULT 'mobile'`;
    const drift = await startChild(privateUrl.toString());
    child = drift.child;
    const driftResponse = await request(`http://127.0.0.1:${drift.port}`, '/api/prd/history');
    assert.equal(driftResponse.status, 502);
    assert.deepEqual(await driftResponse.json(), { error: 'MC_TASK6A_RESTRICTED_PRD_VERIFY_REFUSED' });
    await stopChild(child);
    child = undefined;
    await db`ALTER TABLE public.prds ALTER COLUMN platform SET DEFAULT 'web'`;

    stage = 'write-grant-refusal';
    await db.unsafe(`GRANT UPDATE ON public.prds TO "${roleName}"`);
    const writer = await startChild(privateUrl.toString());
    child = writer.child;
    const writerResponse = await request(`http://127.0.0.1:${writer.port}`, '/api/prd/history');
    assert.equal(writerResponse.status, 502);
    assert.deepEqual(await writerResponse.json(), { error: 'MC_TASK6A_RESTRICTED_PRD_VERIFY_REFUSED' });
    await stopChild(child);
    child = undefined;
    await db.unsafe(`REVOKE UPDATE ON public.prds FROM "${roleName}"`);

    stage = 'column-write-grant-refusal';
    await db.unsafe(`GRANT UPDATE (title) ON public.prds TO "${roleName}"`);
    const columnWriter = await startChild(privateUrl.toString());
    child = columnWriter.child;
    const columnWriterResponse = await request(`http://127.0.0.1:${columnWriter.port}`, '/api/prd/history');
    assert.equal(columnWriterResponse.status, 502);
    assert.deepEqual(await columnWriterResponse.json(), { error: 'MC_TASK6A_RESTRICTED_PRD_VERIFY_REFUSED' });
    await stopChild(child);
    child = undefined;
    await db.unsafe(`REVOKE UPDATE (title) ON public.prds FROM "${roleName}"`);

    stage = 'schema-create-grant-refusal';
    await db.unsafe(`GRANT CREATE ON SCHEMA public TO "${roleName}"`);
    const schemaWriter = await startChild(privateUrl.toString());
    child = schemaWriter.child;
    const schemaWriterResponse = await request(`http://127.0.0.1:${schemaWriter.port}`, '/api/prd/history');
    assert.equal(schemaWriterResponse.status, 502);
    assert.deepEqual(await schemaWriterResponse.json(), { error: 'MC_TASK6A_RESTRICTED_PRD_VERIFY_REFUSED' });
    await stopChild(child);
    child = undefined;
    await db.unsafe(`REVOKE CREATE ON SCHEMA public FROM "${roleName}"`);

    stage = 'invalid-mode-refusal';
    const invalid = await startChild(privateUrl.toString(), '0');
    child = invalid.child;
    const invalidResponse = await request(`http://127.0.0.1:${invalid.port}`, '/api/prd/history');
    assert.equal(invalidResponse.status, 503);
    assert.deepEqual(await invalidResponse.json(), { error: 'MC_TASK6A_RESTRICTED_PRD_ROUTE_UNVERIFIED' });
    await stopChild(child);
    child = undefined;

    stage = 'ordinary-mode-preserved';
    await db`DROP TABLE public.prd_templates`;
    await db`DROP TABLE public.prds`;
    const ordinary = await startChild(dbUrl.toString(), null);
    child = ordinary.child;
    const ordinaryBase = `http://127.0.0.1:${ordinary.port}`;
    const ordinaryHistory = await request(ordinaryBase, '/api/prd/history');
    assert.equal(ordinaryHistory.status, 200);
    assert.deepEqual(await ordinaryHistory.json(), []);
    const ordinaryTemplates = await request(ordinaryBase, '/api/prd/templates');
    assert.equal(ordinaryTemplates.status, 200);
    assert.equal((await ordinaryTemplates.json() as unknown[]).length, 9);
  } catch (error) {
    failure = error;
    process.stderr.write(`[mc-task6a-private-prd] failed at ${stage}\n`);
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
    if (cleanupFailures.length > 0) {
      const cleanup = new Error(`MC_TASK6A_PRIVATE_CLEANUP_FAILED:${cleanupFailures.join(',')}`);
      if (failure !== undefined) throw new AggregateError([failure, cleanup],
        'MC_TASK6A_PRIVATE_TEST_AND_CLEANUP_FAILED');
      throw cleanup;
    }
  }
});
