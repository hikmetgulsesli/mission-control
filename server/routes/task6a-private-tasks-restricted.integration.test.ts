import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
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

async function startChild(privateUrl: string, restricted: boolean | string = true): Promise<Readonly<{ child: ChildProcess; port: number }>> {
  const mode = typeof restricted === "string" ? restricted : restricted ? "1" : undefined;
  const child = spawn(process.execPath,
    ["--import", "tsx", "server/routes/task6a-private-tasks-child.ts"], {
      cwd: process.cwd(),
      env: {
        PATH: "/opt/homebrew/bin:/usr/bin:/bin",
        LANG: "C", LC_ALL: "C",
        SETFARM_PG_URL: privateUrl,
        GATEWAY_TOKEN: "private-fixture-no-live-read",
        ...(mode !== undefined ? { MC_TASK6A_RESTRICTED_TASKS_VERIFY_V1: mode } : {}),
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

async function request(base: string, route: string, method = "GET", body?: object): Promise<Response> {
  return fetch(`${base}${route}`, {
    method,
    ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(5000),
  });
}

test("private restricted MC tasks perform scoped CRUD without DDL or story sync", {
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
  const databaseName = `mc_task6a_tasks_${randomBytes(8).toString("hex")}`;
  const roleName = `mc_task6a_tasks_role_${randomBytes(8).toString("hex")}`;
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
    await db`CREATE TABLE public.runs (id text PRIMARY KEY, status text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now())`;
    await db`CREATE TABLE public.stories (run_id text NOT NULL, story_id text NOT NULL,
      status text NOT NULL)`;
    await db`INSERT INTO public.runs (id, status) VALUES ('private-run', 'running')`;
    for (const story of ["US-004", "US-005", "US-010"]) {
      await db`INSERT INTO public.stories (run_id, story_id, status)
        VALUES ('private-run', ${story}, 'completed')`;
    }
    await db`CREATE TABLE public.tasks (
      id text PRIMARY KEY, title text NOT NULL DEFAULT '',
      description text NOT NULL DEFAULT '', assigned_agent text NOT NULL DEFAULT '',
      priority text NOT NULL DEFAULT 'medium', status text NOT NULL DEFAULT 'todo',
      images text NOT NULL DEFAULT '[]',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now())`;
    const before = await publicFingerprint(db);

    stage = "private-role";
    await admin.unsafe(`CREATE ROLE "${roleName}" LOGIN PASSWORD '${password}'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    roleCreated = true;
    await admin.unsafe(`GRANT CONNECT ON DATABASE "${databaseName}" TO "${roleName}"`);
    await db.unsafe(`GRANT USAGE ON SCHEMA public TO "${roleName}"`);
    await db.unsafe(`GRANT SELECT ON public.runs, public.stories TO "${roleName}"`);
    await db.unsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO "${roleName}"`);
    const privateUrl = new URL(dbUrl);
    privateUrl.username = roleName;
    privateUrl.password = password;
    const probe = postgres(privateUrl.toString(), { max: 1 });
    try {
      const rights = await probe<Array<{ login: string; superuser: boolean;
        bypass: boolean; createRole: boolean; createDb: boolean;
        databaseCreate: boolean; schemaCreate: boolean; taskDml: boolean[];
        taskOwner: boolean }>>`
        SELECT session_user AS login, r.rolsuper AS superuser,
          r.rolbypassrls AS bypass, r.rolcreaterole AS "createRole",
          r.rolcreatedb AS "createDb",
          has_database_privilege(current_user, current_database(), 'CREATE') AS "databaseCreate",
          has_schema_privilege(current_user, 'public', 'CREATE') AS "schemaCreate",
          ARRAY(SELECT has_table_privilege(current_user, 'public.tasks', privilege)
            FROM unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) AS p(privilege)) AS "taskDml",
          pg_catalog.pg_has_role(current_user, c.relowner, 'MEMBER') AS "taskOwner"
        FROM pg_catalog.pg_roles r
        JOIN pg_catalog.pg_class c ON c.oid = pg_catalog.to_regclass('public.tasks')
        WHERE r.rolname = session_user`;
      assert.deepEqual(rights[0], { login: roleName, superuser: false, bypass: false,
        createRole: false, createDb: false, databaseCreate: false,
        schemaCreate: false, taskDml: [true, true, true, true], taskOwner: false });
    } finally { await probe.end({ timeout: 5 }); }

    stage = "restricted-route-red-green";
    const started = await startChild(privateUrl.toString());
    child = started.child;
    const base = `http://127.0.0.1:${started.port}`;
    const health = await request(base, "/api/health");
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { database: "up", runs: 1 });
    const empty = await request(base, "/api/tasks");
    assert.equal(empty.status, 200);
    assert.deepEqual(await empty.json(), []);
    const sentinel = await request(base, "/api/task6a-after-tasks");
    assert.equal(sentinel.status, 200);
    assert.deepEqual(await sentinel.json(), { reachable: true });
    const images = await request(base, "/api/tasks/missing/images", "POST", {});
    assert.equal(images.status, 503);
    assert.deepEqual(await images.json(), { error: "MC_TASK6A_RESTRICTED_TASKS_IMAGES_UNVERIFIED" });

    stage = "scoped-task-crud";
    const created = await request(base, "/api/tasks", "POST", { title: "Frontend", status: "todo" });
    assert.equal(created.status, 201);
    const createdTask = await created.json() as { id: string; title: string; status: string };
    assert.match(createdTask.id, /^[0-9a-f-]{36}$/);
    assert.equal(createdTask.title, "Frontend");
    const listed = await request(base, "/api/tasks");
    assert.equal(listed.status, 200);
    const listedTasks = await listed.json() as Array<{ id: string; status: string }>;
    assert.deepEqual(listedTasks.map((task) => task.id), [createdTask.id]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const unsynced = await db<Array<{ status: string }>>`
      SELECT status FROM public.tasks WHERE id = ${createdTask.id}`;
    assert.equal(unsynced[0]?.status, "todo");
    const updated = await request(base, `/api/tasks/${createdTask.id}`, "PUT",
      { description: "private task" });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json() as { description: string }).description, "private task");
    const patched = await request(base, `/api/tasks/${createdTask.id}/status`, "PATCH",
      { status: "done" });
    assert.equal(patched.status, 200);
    assert.equal((await patched.json() as { status: string }).status, "done");
    const deleted = await request(base, `/api/tasks/${createdTask.id}`, "DELETE");
    assert.equal(deleted.status, 200);
    assert.deepEqual(await deleted.json(), { ok: true });
    assert.deepEqual(await (await request(base, "/api/tasks")).json(), []);
    assert.equal(await publicFingerprint(db), before);

    stage = "invalid-mode-pre-effect-refusal";
    await stopChild(child);
    child = undefined;
    const invalid = await startChild(privateUrl.toString(), "0");
    child = invalid.child;
    const invalidBase = `http://127.0.0.1:${invalid.port}`;
    const invalidImage = await request(invalidBase, "/api/tasks/missing/images", "POST", {});
    assert.equal(invalidImage.status, 503);
    assert.deepEqual(await invalidImage.json(),
      { error: "MC_TASK6A_RESTRICTED_TASKS_IMAGES_UNVERIFIED" });
    const invalidTasks = await request(invalidBase, "/api/tasks");
    assert.equal(invalidTasks.status, 502);
    assert.deepEqual(await invalidTasks.json(),
      { error: "MC_TASK6A_RESTRICTED_TASKS_MODE_INVALID" });
    const invalidSentinel = await request(invalidBase, "/api/task6a-after-tasks");
    assert.equal(invalidSentinel.status, 200);
    assert.equal(await publicFingerprint(db), before);

    stage = "shadow-search-path-binding";
    await stopChild(child);
    child = undefined;
    await db`CREATE SCHEMA shadow`;
    await db`CREATE TABLE shadow.tasks (
      id text, title text, priority text, status text, images text, created_at timestamptz)`;
    await db`INSERT INTO shadow.tasks (id, title, priority, status, images, created_at)
      VALUES ('shadow-task', 'shadow', 'high', 'todo', '[]', now())`;
    await db.unsafe(`GRANT USAGE ON SCHEMA shadow TO "${roleName}"`);
    await db.unsafe(`GRANT SELECT ON shadow.tasks TO "${roleName}"`);
    await db.unsafe(`ALTER ROLE "${roleName}" IN DATABASE "${databaseName}"
      SET search_path = shadow, public`);
    const shadowed = await startChild(privateUrl.toString());
    child = shadowed.child;
    const shadowBase = `http://127.0.0.1:${shadowed.port}`;
    const shadowTasks = await request(shadowBase, "/api/tasks");
    assert.equal(shadowTasks.status, 200);
    assert.deepEqual(await shadowTasks.json(), []);
    assert.equal(await publicFingerprint(db), before);

    stage = "trigger-side-effect-refusal";
    await stopChild(child);
    child = undefined;
    await db`CREATE TABLE public.task_effects (id text)`;
    await db.unsafe(`CREATE FUNCTION public.task6a_task_effect() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER AS $$
      BEGIN INSERT INTO public.task_effects(id) VALUES (NEW.id); RETURN NEW; END $$`);
    await db`CREATE TRIGGER task6a_task_effect AFTER INSERT ON public.tasks
      FOR EACH ROW EXECUTE FUNCTION public.task6a_task_effect()`;
    const triggered = await startChild(privateUrl.toString());
    child = triggered.child;
    const triggeredResponse = await request(`http://127.0.0.1:${triggered.port}`, "/api/tasks");
    assert.equal(triggeredResponse.status, 502);
    assert.deepEqual(await triggeredResponse.json(),
      { error: "MC_TASK6A_RESTRICTED_TASKS_VERIFY_REFUSED" });
    await stopChild(child);
    child = undefined;
    await db`DROP TRIGGER task6a_task_effect ON public.tasks`;
    await db`DROP FUNCTION public.task6a_task_effect()`;

    stage = "rewrite-rule-refusal";
    await db`CREATE RULE task6a_tasks_delete_effect AS ON DELETE TO public.tasks
      DO ALSO DELETE FROM public.task_effects WHERE id = OLD.id`;
    const rewritten = await startChild(privateUrl.toString());
    child = rewritten.child;
    const rewrittenResponse = await request(`http://127.0.0.1:${rewritten.port}`, "/api/tasks");
    assert.equal(rewrittenResponse.status, 502);
    assert.deepEqual(await rewrittenResponse.json(),
      { error: "MC_TASK6A_RESTRICTED_TASKS_VERIFY_REFUSED" });
    await stopChild(child);
    child = undefined;
    await db`DROP RULE task6a_tasks_delete_effect ON public.tasks`;
    await db`DROP TABLE public.task_effects`;

    stage = "foreign-key-cascade-refusal";
    await db`CREATE TABLE public.task_dependents (
      id text PRIMARY KEY, task_id text REFERENCES public.tasks(id) ON DELETE CASCADE)`;
    const cascaded = await startChild(privateUrl.toString());
    child = cascaded.child;
    const cascadedResponse = await request(`http://127.0.0.1:${cascaded.port}`, "/api/tasks");
    assert.equal(cascadedResponse.status, 502);
    assert.deepEqual(await cascadedResponse.json(),
      { error: "MC_TASK6A_RESTRICTED_TASKS_VERIFY_REFUSED" });
    await stopChild(child);
    child = undefined;
    await db`DROP TABLE public.task_dependents`;
    assert.equal(await publicFingerprint(db), before);

    stage = "inherited-parent-refusal";
    await db`CREATE TABLE public.task_parent (id text)`;
    await db`ALTER TABLE public.tasks INHERIT public.task_parent`;
    const parented = await startChild(privateUrl.toString());
    child = parented.child;
    const parentedResponse = await request(`http://127.0.0.1:${parented.port}`, "/api/tasks");
    assert.equal(parentedResponse.status, 502);
    assert.deepEqual(await parentedResponse.json(),
      { error: "MC_TASK6A_RESTRICTED_TASKS_VERIFY_REFUSED" });
    await stopChild(child);
    child = undefined;
    await db`ALTER TABLE public.tasks NO INHERIT public.task_parent`;
    await db`DROP TABLE public.task_parent`;
    assert.equal(await publicFingerprint(db), before);

    stage = "inherited-child-refusal";
    await db`CREATE TABLE shadow.tasks_child () INHERITS (public.tasks)`;
    await db`INSERT INTO shadow.tasks_child (id, title)
      VALUES ('inherited-task', 'inherited')`;
    const inherited = await startChild(privateUrl.toString());
    child = inherited.child;
    const inheritedResponse = await request(`http://127.0.0.1:${inherited.port}`, "/api/tasks");
    assert.equal(inheritedResponse.status, 502);
    assert.deepEqual(await inheritedResponse.json(),
      { error: "MC_TASK6A_RESTRICTED_TASKS_VERIFY_REFUSED" });
    await stopChild(child);
    child = undefined;
    await db`DROP TABLE shadow.tasks_child`;

    stage = "excess-task-privilege-refusal";
    await db.unsafe(`GRANT TRUNCATE ON public.tasks TO "${roleName}"`);
    const excess = await startChild(privateUrl.toString());
    child = excess.child;
    const excessResponse = await request(`http://127.0.0.1:${excess.port}`, "/api/tasks");
    assert.equal(excessResponse.status, 502);
    assert.deepEqual(await excessResponse.json(),
      { error: "MC_TASK6A_RESTRICTED_TASKS_VERIFY_REFUSED" });
    await stopChild(child);
    child = undefined;
    await db.unsafe(`REVOKE TRUNCATE ON public.tasks FROM "${roleName}"`);

    stage = "schema-create-refusal";
    await db.unsafe(`GRANT CREATE ON SCHEMA public TO "${roleName}"`);
    const creator = await startChild(privateUrl.toString());
    child = creator.child;
    const creatorResponse = await request(`http://127.0.0.1:${creator.port}`, "/api/tasks");
    assert.equal(creatorResponse.status, 502);
    assert.deepEqual(await creatorResponse.json(),
      { error: "MC_TASK6A_RESTRICTED_TASKS_VERIFY_REFUSED" });
    await stopChild(child);
    child = undefined;
    await db.unsafe(`REVOKE CREATE ON SCHEMA public FROM "${roleName}"`);

    stage = "column-drift-refusal";
    await db`ALTER TABLE public.tasks DROP COLUMN images`;
    const drifted = await publicFingerprint(db);
    const drift = await startChild(privateUrl.toString());
    child = drift.child;
    const driftResponse = await request(`http://127.0.0.1:${drift.port}`, "/api/tasks");
    assert.equal(driftResponse.status, 502);
    assert.deepEqual(await driftResponse.json(),
      { error: "MC_TASK6A_RESTRICTED_TASKS_VERIFY_REFUSED" });
    assert.equal(await publicFingerprint(db), drifted);

    stage = "ordinary-mode-preserved";
    await stopChild(child);
    child = undefined;
    await db`DROP TABLE public.tasks`;
    const ordinary = await startChild(dbUrl.toString(), false);
    child = ordinary.child;
    const ordinaryResponse = await request(`http://127.0.0.1:${ordinary.port}`, "/api/tasks");
    assert.equal(ordinaryResponse.status, 200);
    assert.deepEqual(await ordinaryResponse.json(), []);
    assert.equal(await publicFingerprint(db), before);
  } catch (error) {
    failure = error;
    process.stderr.write(`[mc-task6a-private-tasks] failed at ${stage}\n`);
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
