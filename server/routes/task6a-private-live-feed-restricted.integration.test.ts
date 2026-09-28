import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import postgres from "postgres";

const expectedDataDirectory = process.env.SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY;

async function publicFingerprint(sql: postgres.Sql): Promise<string> {
  const rows = await sql<Array<{ value: string }>>`
    SELECT md5(jsonb_build_object(
      'relations', (SELECT jsonb_agg(jsonb_build_array(c.relname, c.relkind, c.relowner::text)
        ORDER BY c.relname) FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public'),
      'columns', (SELECT jsonb_agg(jsonb_build_array(c.relname, a.attname,
        a.atttypid::text, a.attnotnull) ORDER BY c.relname, a.attname)
        FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND a.attnum > 0 AND NOT a.attisdropped),
      'indexes', (SELECT jsonb_agg(pg_catalog.pg_get_indexdef(i.indexrelid)
        ORDER BY ic.relname) FROM pg_catalog.pg_index i
        JOIN pg_catalog.pg_class ic ON ic.oid = i.indexrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = ic.relnamespace WHERE n.nspname = 'public')
    )::text) AS value`;
  assert.match(rows[0]?.value ?? "", /^[a-f0-9]{32}$/);
  return rows[0]!.value;
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const signalAndWait = (signal: NodeJS.Signals) => new Promise<boolean>((resolve) => {
    const finish = (exited: boolean) => {
      clearTimeout(timeout);
      child.off("exit", onExit);
      resolve(exited);
    };
    const onExit = () => finish(true);
    const timeout = setTimeout(() => finish(false), 5000);
    child.once("exit", onExit);
    child.kill(signal);
    if (child.exitCode !== null || child.signalCode !== null) finish(true);
  });
  if (await signalAndWait("SIGTERM")) return;
  if (await signalAndWait("SIGKILL")) return;
  throw new Error("MC_TASK6A_PRIVATE_CHILD_NOT_REAPED");
}

async function startChild(privateUrl: string, restricted = true): Promise<Readonly<{ child: ChildProcess; port: number }>> {
  const child = spawn(process.execPath,
    ["--import", "tsx", "server/routes/task6a-private-live-feed-child.ts"], {
      cwd: process.cwd(),
      env: {
        PATH: "/opt/homebrew/bin:/usr/bin:/bin",
        LANG: "C", LC_ALL: "C",
        SETFARM_PG_URL: privateUrl,
        GATEWAY_TOKEN: "private-fixture-no-live-read",
        ...(restricted ? { MC_TASK6A_RESTRICTED_LIVE_FEED_VERIFY_V1: "1" } : {}),
      },
      stdio: ["ignore", "pipe", "ignore"],
  });
  try {
    const port = await new Promise<number>((resolve, reject) => {
      let output = "";
      let settled = false;
      const finish = (error: Error | null, value?: number) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        child.off("exit", onExit);
        child.stdout!.off("data", onData);
        if (error) reject(error);
        else resolve(value!);
      };
      const onExit = () => finish(new Error("MC_TASK6A_PRIVATE_CHILD_EXITED_EARLY"));
      const onData = (chunk: Buffer) => {
        output += chunk.toString("utf8");
        if (output.length > 1024) {
          finish(new Error("MC_TASK6A_PRIVATE_CHILD_OUTPUT_INVALID"));
          return;
        }
        const line = output.indexOf("\n");
        if (line < 0) return;
        try {
          const parsed = JSON.parse(output.slice(0, line)) as { port?: unknown };
          if (!Number.isInteger(parsed.port) || Number(parsed.port) < 1 || Number(parsed.port) > 65535) {
            throw new Error("MC_TASK6A_PRIVATE_CHILD_PORT_INVALID");
          }
          finish(null, Number(parsed.port));
        } catch { finish(new Error("MC_TASK6A_PRIVATE_CHILD_OUTPUT_INVALID")); }
      };
      const timeout = setTimeout(() => finish(new Error("MC_TASK6A_PRIVATE_CHILD_START_TIMEOUT")), 10000);
      child.once("exit", onExit);
      child.stdout!.on("data", onData);
    });
    return { child, port };
  } catch (error) {
    await stopChild(child);
    throw error;
  }
}

test("private restricted MC live feed verifies catalog without DDL while health remains independent", {
  skip: expectedDataDirectory ? false : "requires an explicitly identified private PostgreSQL 17 cluster",
}, async () => {
  assert.equal(process.env.SETFARM_PG_URL, undefined);
  assert.match(expectedDataDirectory!, /^\/tmp\/setfarm-task6a-pg\.[A-Za-z0-9]+\/data$/);
  assert.equal(existsSync(path.join(process.cwd(), ".env")), false);
  assert.equal(existsSync(path.join(process.cwd(), ".env.local")), false);
  const adminUrl = process.env.SETFARM_TEST_PG_ADMIN_URL;
  assert.ok(adminUrl);
  const parsed = new URL(adminUrl);
  assert.equal(parsed.pathname, "/postgres");
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname));
  assert.notEqual(parsed.port, "5432");
  const databaseName = `mc_task6a_private_${randomBytes(8).toString("hex")}`;
  const roleName = `mc_task6a_restricted_${randomBytes(8).toString("hex")}`;
  const password = randomBytes(24).toString("hex");
  const admin = postgres(adminUrl, { max: 1 });
  let db: postgres.Sql | undefined;
  let child: ChildProcess | undefined;
  let databaseCreated = false;
  let roleCreated = false;
  let stage = "private-preflight";
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
    assert.ok(identity[0]?.socketDirectories.split(",").map((item) => item.trim())
      .includes(path.dirname(expectedDataDirectory!)));
    assert.ok(identity[0]!.version >= 170000 && identity[0]!.version < 180000);

    stage = "private-schema";
    await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
    databaseCreated = true;
    const dbUrl = new URL(adminUrl);
    dbUrl.pathname = `/${databaseName}`;
    db = postgres(dbUrl.toString(), { max: 1 });
    await db`CREATE TABLE runs (id text PRIMARY KEY)`;
    await db`CREATE TABLE live_events (
      id TEXT PRIMARY KEY, ts TIMESTAMPTZ NOT NULL, agent TEXT NOT NULL,
      model TEXT, tool TEXT, action TEXT NOT NULL, summary TEXT, file TEXT,
      status TEXT NOT NULL DEFAULT 'completed', duration_ms INTEGER,
      exit_code INTEGER, cwd TEXT, project TEXT, detail TEXT, output TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    await db`CREATE INDEX idx_live_events_ts ON live_events(ts)`;
    await db`CREATE INDEX idx_live_events_status ON live_events(status)`;
    await db`CREATE INDEX idx_live_events_project ON live_events(project)`;
    await db`CREATE INDEX idx_live_events_agent ON live_events(agent)`;
    await db`CREATE INDEX idx_live_events_action ON live_events(action)`;
    await db`CREATE INDEX idx_live_events_error ON live_events(exit_code)
      WHERE exit_code IS NOT NULL AND exit_code != 0`;
    const before = await publicFingerprint(db);

    stage = "private-role";
    await admin.unsafe(`CREATE ROLE "${roleName}" LOGIN PASSWORD '${password}'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    roleCreated = true;
    await admin.unsafe(`GRANT CONNECT ON DATABASE "${databaseName}" TO "${roleName}"`);
    await db.unsafe(`GRANT USAGE ON SCHEMA public TO "${roleName}"`);
    await db.unsafe(`GRANT SELECT ON public.runs, public.live_events TO "${roleName}"`);
    const privateUrl = new URL(dbUrl);
    privateUrl.username = roleName;
    privateUrl.password = password;
    const probe = postgres(privateUrl.toString(), { max: 1 });
    try {
      const rights = await probe<Array<{ login: string; superuser: boolean;
        bypass: boolean; createRole: boolean; createDb: boolean;
        databaseCreate: boolean; schemaCreate: boolean; tableWrite: boolean[] }>>`
        SELECT session_user AS login, r.rolsuper AS superuser,
          r.rolbypassrls AS bypass, r.rolcreaterole AS "createRole",
          r.rolcreatedb AS "createDb",
          has_database_privilege(current_user, current_database(), 'CREATE') AS "databaseCreate",
          has_schema_privilege(current_user, 'public', 'CREATE') AS "schemaCreate",
          ARRAY(SELECT has_table_privilege(current_user, name, privilege)
            FROM unnest(ARRAY['public.runs', 'public.live_events']) AS tables(name)
            CROSS JOIN unnest(ARRAY['INSERT', 'UPDATE', 'DELETE']) AS rights(privilege)) AS "tableWrite"
        FROM pg_catalog.pg_roles r WHERE r.rolname = session_user`;
      assert.deepEqual(rights[0], { login: roleName, superuser: false, bypass: false,
        createRole: false, createDb: false, databaseCreate: false,
        schemaCreate: false, tableWrite: Array(6).fill(false) });
    } finally { await probe.end({ timeout: 5 }); }

    stage = "session-role-impersonation-boundary";
    const impersonated = await db.begin(async (transaction) => {
      const tx = transaction as unknown as postgres.Sql;
      await tx.unsafe(`SET LOCAL ROLE "${roleName}"`);
      const rows = await tx<Array<{ sessionLogin: string; effective: string;
        effectiveSuperuser: boolean }>>`
        SELECT session_user AS "sessionLogin", current_user AS effective,
          r.rolsuper AS "effectiveSuperuser"
        FROM pg_catalog.pg_roles r WHERE r.rolname = current_user`;
      return rows[0];
    });
    assert.ok(impersonated);
    assert.equal(impersonated.effective, roleName);
    assert.notEqual(impersonated.sessionLogin, impersonated.effective);
    assert.equal(impersonated.effectiveSuperuser, false);
    const liveFeedSource = readFileSync(path.join(process.cwd(), "server/routes/live-feed.ts"), "utf8");
    assert.match(liveFeedSource, /session_user AS "sessionLogin"/);
    assert.match(liveFeedSource, /actualRole\.sessionLogin !== actualRole\.login/);

    stage = "route-startup";
    const started = await startChild(privateUrl.toString());
    child = started.child;
    const base = `http://127.0.0.1:${started.port}`;
    const health = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5000) });
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { database: "up", runs: 0 });
    const stats = await fetch(`${base}/api/live-feed/stats`, { signal: AbortSignal.timeout(5000) });
    assert.equal(stats.status, 200);
    assert.equal((await stats.json() as { total: number }).total, 0);
    const afterLiveFeed = await fetch(`${base}/api/task6a-after-live-feed`,
      { signal: AbortSignal.timeout(5000) });
    assert.equal(afterLiveFeed.status, 200);
    assert.deepEqual(await afterLiveFeed.json(), { reachable: true });
    assert.equal(await publicFingerprint(db), before);

    stage = "shadow-search-path-binding";
    await stopChild(child);
    child = undefined;
    await db`CREATE SCHEMA shadow`;
    await db`CREATE TABLE shadow.live_events (
      ts timestamptz NOT NULL, agent text NOT NULL, action text NOT NULL,
      status text NOT NULL, exit_code integer, project text)`;
    await db`INSERT INTO shadow.live_events (ts, agent, action, status)
      VALUES (NOW(), 'shadow', 'shadow', 'completed')`;
    await db.unsafe(`GRANT USAGE ON SCHEMA shadow TO "${roleName}"`);
    await db.unsafe(`GRANT SELECT ON shadow.live_events TO "${roleName}"`);
    await db.unsafe(`ALTER ROLE "${roleName}" IN DATABASE "${databaseName}"
      SET search_path = shadow, public`);
    const shadowed = await startChild(privateUrl.toString());
    child = shadowed.child;
    const shadowStats = await fetch(`http://127.0.0.1:${shadowed.port}/api/live-feed/stats`,
      { signal: AbortSignal.timeout(5000) });
    assert.equal(shadowStats.status, 200);
    assert.equal((await shadowStats.json() as { total: number }).total, 0);
    for (const route of ["/api/live-feed", "/api/live-feed/projects?format=rich",
      "/api/live-feed/errors", "/api/live-feed/history", "/api/LIVE-FEED/history"]) {
      const refused = await fetch(`http://127.0.0.1:${shadowed.port}${route}`,
        { signal: AbortSignal.timeout(5000) });
      assert.equal(refused.status, 503, route);
      assert.deepEqual(await refused.json(),
        { error: "MC_TASK6A_RESTRICTED_LIVE_FEED_ROUTE_UNVERIFIED" });
    }
    assert.equal(await publicFingerprint(db), before);

    stage = "inherited-child-refusal";
    await stopChild(child);
    child = undefined;
    await db`CREATE TABLE shadow.live_events_child () INHERITS (public.live_events)`;
    await db`INSERT INTO shadow.live_events_child (id, ts, agent, action, status)
      VALUES ('inherited-shadow', NOW(), 'shadow', 'shadow', 'completed')`;
    const inherited = await startChild(privateUrl.toString());
    child = inherited.child;
    const inheritedStats = await fetch(`http://127.0.0.1:${inherited.port}/api/live-feed/stats`,
      { signal: AbortSignal.timeout(5000) });
    assert.equal(inheritedStats.status, 500);
    assert.deepEqual(await inheritedStats.json(),
      { error: "MC_TASK6A_RESTRICTED_LIVE_FEED_VERIFY_REFUSED" });

    stage = "ordinary-mode-preserved";
    await stopChild(child);
    child = undefined;
    await db`DROP TABLE shadow.live_events_child`;
    stage = "write-capable-role-refusal";
    await db.unsafe(`GRANT INSERT, DELETE ON public.live_events TO "${roleName}"`);
    const writeCapable = await startChild(privateUrl.toString());
    child = writeCapable.child;
    const writeCapableStats = await fetch(`http://127.0.0.1:${writeCapable.port}/api/live-feed/stats`,
      { signal: AbortSignal.timeout(5000) });
    assert.equal(writeCapableStats.status, 500);
    assert.deepEqual(await writeCapableStats.json(),
      { error: "MC_TASK6A_RESTRICTED_LIVE_FEED_VERIFY_REFUSED" });
    await stopChild(child);
    child = undefined;
    await db.unsafe(`REVOKE INSERT, DELETE ON public.live_events FROM "${roleName}"`);
    await db.unsafe(`GRANT UPDATE(status) ON public.live_events TO "${roleName}"`);
    const columnWriter = await startChild(privateUrl.toString());
    child = columnWriter.child;
    const columnWriterStats = await fetch(`http://127.0.0.1:${columnWriter.port}/api/live-feed/stats`,
      { signal: AbortSignal.timeout(5000) });
    assert.equal(columnWriterStats.status, 500);
    assert.deepEqual(await columnWriterStats.json(),
      { error: "MC_TASK6A_RESTRICTED_LIVE_FEED_VERIFY_REFUSED" });
    await stopChild(child);
    child = undefined;
    await db.unsafe(`REVOKE UPDATE(status) ON public.live_events FROM "${roleName}"`);

    stage = "ordinary-mode-preserved";
    const ordinary = await startChild(dbUrl.toString(), false);
    child = ordinary.child;
    const ordinaryStats = await fetch(`http://127.0.0.1:${ordinary.port}/api/live-feed/stats`,
      { signal: AbortSignal.timeout(5000) });
    assert.equal(ordinaryStats.status, 200);
    assert.equal(await publicFingerprint(db), before);

    stage = "privileged-mode-refusal";
    await stopChild(child);
    child = undefined;
    const privileged = await startChild(dbUrl.toString());
    child = privileged.child;
    const privilegedStats = await fetch(`http://127.0.0.1:${privileged.port}/api/live-feed/stats`,
      { signal: AbortSignal.timeout(5000) });
    assert.equal(privilegedStats.status, 500);
    assert.deepEqual(await privilegedStats.json(),
      { error: "MC_TASK6A_RESTRICTED_LIVE_FEED_VERIFY_REFUSED" });
    assert.equal(await publicFingerprint(db), before);

    stage = "restricted-catalog-drift";
    await stopChild(child);
    child = undefined;
    await db`DROP INDEX public.idx_live_events_error`;
    const drifted = await publicFingerprint(db);
    const driftChild = await startChild(privateUrl.toString());
    child = driftChild.child;
    const driftHealth = await fetch(`http://127.0.0.1:${driftChild.port}/api/health`,
      { signal: AbortSignal.timeout(5000) });
    assert.equal(driftHealth.status, 200);
    const driftStats = await fetch(`http://127.0.0.1:${driftChild.port}/api/live-feed/stats`,
      { signal: AbortSignal.timeout(5000) });
    assert.equal(driftStats.status, 500);
    assert.deepEqual(await driftStats.json(),
      { error: "MC_TASK6A_RESTRICTED_LIVE_FEED_VERIFY_REFUSED" });
    assert.equal(await publicFingerprint(db), drifted);

    stage = "restricted-broader-index-predicate";
    await stopChild(child);
    child = undefined;
    await db`CREATE INDEX idx_live_events_error ON live_events(exit_code)
      WHERE (exit_code IS NOT NULL AND exit_code != 0) OR TRUE`;
    const broadened = await publicFingerprint(db);
    const broadenedChild = await startChild(privateUrl.toString());
    child = broadenedChild.child;
    const broadenedStats = await fetch(`http://127.0.0.1:${broadenedChild.port}/api/live-feed/stats`,
      { signal: AbortSignal.timeout(5000) });
    assert.equal(broadenedStats.status, 500);
    assert.deepEqual(await broadenedStats.json(),
      { error: "MC_TASK6A_RESTRICTED_LIVE_FEED_VERIFY_REFUSED" });
    assert.equal(await publicFingerprint(db), broadened);

    stage = "restricted-column-drift";
    await stopChild(child);
    child = undefined;
    await db`DROP INDEX public.idx_live_events_error`;
    await db`CREATE INDEX idx_live_events_error ON live_events(exit_code)
      WHERE exit_code IS NOT NULL AND exit_code != 0`;
    await db`ALTER TABLE live_events DROP COLUMN output`;
    const columnDrifted = await publicFingerprint(db);
    const columnChild = await startChild(privateUrl.toString());
    child = columnChild.child;
    const columnStats = await fetch(`http://127.0.0.1:${columnChild.port}/api/live-feed/stats`,
      { signal: AbortSignal.timeout(5000) });
    assert.equal(columnStats.status, 500);
    assert.deepEqual(await columnStats.json(),
      { error: "MC_TASK6A_RESTRICTED_LIVE_FEED_VERIFY_REFUSED" });
    assert.equal(await publicFingerprint(db), columnDrifted);
  } catch (error) {
    failure = error;
    process.stderr.write(`[mc-task6a-private-live-feed] failed at ${stage}\n`);
    throw error;
  } finally {
    const cleanupFailures: string[] = [];
    let childReaped = true;
    try { if (child) await stopChild(child); }
    catch { childReaped = false; cleanupFailures.push("child_not_reaped_fixture_retained"); }
    try { await db?.end({ timeout: 5 }); } catch { cleanupFailures.push("database_connection"); }
    try { if (childReaped && databaseCreated) await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}"`); }
    catch { cleanupFailures.push("fixture_database"); }
    try { if (childReaped && roleCreated) await admin.unsafe(`DROP ROLE IF EXISTS "${roleName}"`); }
    catch { cleanupFailures.push("fixture_role"); }
    try { await admin.end({ timeout: 5 }); } catch { cleanupFailures.push("admin_connection"); }
    if (cleanupFailures.length > 0) {
      const cleanup = new Error(`MC_TASK6A_PRIVATE_CLEANUP_FAILED:${cleanupFailures.join(",")}`);
      if (failure !== undefined) throw new AggregateError([failure, cleanup],
        "MC_TASK6A_PRIVATE_TEST_AND_CLEANUP_FAILED");
      throw cleanup;
    }
  }
});
