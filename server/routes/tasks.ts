import { Router } from "express";
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { join, resolve } from "path";
import { randomUUID } from "crypto";
import express from "express";
import { config } from "../config.js";
import { sql } from "../utils/pg.js";

const router = Router();
const UPLOADS_DIR = resolve(import.meta.dirname || __dirname, "..", "..", "uploads");
const USE_PG = true; // Phase 7: PG-only (SQLite removed)
const restrictedTasksMode = process.env.MC_TASK6A_RESTRICTED_TASKS_VERIFY_V1;
const restrictedTasks = restrictedTasksMode === "1";
const nonordinaryTasks = restrictedTasksMode !== undefined;
let tasksTableReady: Promise<void> | null = null;

// File upload/delete effects are outside the private table-only rehearsal.
router.use("/tasks/:id/images", (_req, res, next) => {
  if (nonordinaryTasks) {
    res.status(503).json({ error: "MC_TASK6A_RESTRICTED_TASKS_IMAGES_UNVERIFIED" });
    return;
  }
  next();
});

function safeImages(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string' || value.length === 0) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function mapTaskRow(row: any) {
  return { ...row, images: safeImages(row.images) };
}

/** Private Task6A rehearsal only; no live MC launcher selects this mode. */
async function verifyRestrictedTasksTable(): Promise<void> {
  try {
    await sql.begin(async (transaction) => {
      const tx = transaction as unknown as typeof sql;
      await tx`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY`;
      await tx`SET LOCAL lock_timeout = '2s'`;
      await tx`SET LOCAL statement_timeout = '5s'`;
      const role = await tx<Array<{ sessionLogin: string; login: string;
        defaultReadOnly: string; recovering: boolean;
        canLogin: boolean; inherits: boolean; membershipCount: number;
        bypassRls: boolean; superuser: boolean; createRole: boolean; createDatabase: boolean;
        databaseCreate: boolean; schemaCreate: boolean; tableOwnerMember: boolean;
        tableSelect: boolean; tableInsert: boolean; tableUpdate: boolean; tableDelete: boolean;
        tableExtra: boolean; columnReferences: boolean; relationKind: string;
        persistence: string;
        rowSecurity: boolean; forceRowSecurity: boolean; hasDescendants: boolean;
        hasAncestors: boolean; isPartition: boolean }>>`
        SELECT session_user AS "sessionLogin", current_user AS login,
          pg_catalog.current_setting('default_transaction_read_only') AS "defaultReadOnly",
          pg_catalog.pg_is_in_recovery() AS recovering,
          r.rolcanlogin AS "canLogin", r.rolinherit AS inherits,
          (SELECT COUNT(*)::integer FROM pg_catalog.pg_auth_members m
            WHERE m.member = r.oid) AS "membershipCount",
          r.rolsuper AS superuser, r.rolbypassrls AS "bypassRls",
          r.rolcreaterole AS "createRole", r.rolcreatedb AS "createDatabase",
          has_database_privilege(current_user, current_database(), 'CREATE') AS "databaseCreate",
          has_schema_privilege(current_user, 'public', 'CREATE') AS "schemaCreate",
          pg_catalog.pg_has_role(current_user, c.relowner, 'MEMBER') AS "tableOwnerMember",
          has_table_privilege(current_user, c.oid, 'SELECT') AS "tableSelect",
          has_table_privilege(current_user, c.oid, 'INSERT') AS "tableInsert",
          has_table_privilege(current_user, c.oid, 'UPDATE') AS "tableUpdate",
          has_table_privilege(current_user, c.oid, 'DELETE') AS "tableDelete",
          has_table_privilege(current_user, c.oid,
            'TRUNCATE, REFERENCES, TRIGGER, MAINTAIN') AS "tableExtra",
          has_any_column_privilege(current_user, c.oid, 'REFERENCES') AS "columnReferences",
          c.relkind AS "relationKind", c.relpersistence AS persistence,
          c.relispartition AS "isPartition",
          c.relrowsecurity AS "rowSecurity",
          c.relforcerowsecurity AS "forceRowSecurity",
          EXISTS (SELECT 1 FROM pg_catalog.pg_inherits inh
            WHERE inh.inhparent = c.oid) AS "hasDescendants",
          EXISTS (SELECT 1 FROM pg_catalog.pg_inherits inh
            WHERE inh.inhrelid = c.oid) AS "hasAncestors"
        FROM pg_catalog.pg_roles r
        JOIN pg_catalog.pg_class c ON c.oid = pg_catalog.to_regclass('public.tasks')
        WHERE r.rolname = current_user`;
      const actualRole = role[0];
      if (role.length !== 1 || !actualRole
        || actualRole.defaultReadOnly !== 'off' || actualRole.recovering
        || actualRole.sessionLogin !== actualRole.login || !actualRole.canLogin
        || actualRole.inherits || actualRole.membershipCount !== 0
        || actualRole.superuser || actualRole.bypassRls || actualRole.createRole
        || actualRole.createDatabase || actualRole.databaseCreate || actualRole.schemaCreate
        || actualRole.tableOwnerMember || !actualRole.tableSelect || !actualRole.tableInsert
        || !actualRole.tableUpdate || !actualRole.tableDelete || actualRole.tableExtra
        || actualRole.columnReferences || actualRole.relationKind !== 'r'
        || actualRole.persistence !== 'p'
        || actualRole.rowSecurity || actualRole.forceRowSecurity
        || actualRole.hasDescendants || actualRole.hasAncestors || actualRole.isPartition) {
        throw new Error('MC_TASK6A_RESTRICTED_TASKS_ROLE_INVALID');
      }
      const effects = await tx<Array<{ triggers: boolean; rules: boolean;
        otherConstraints: boolean }>>`
        SELECT
          EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t
            WHERE t.tgrelid = pg_catalog.to_regclass('public.tasks')) AS triggers,
          EXISTS (SELECT 1 FROM pg_catalog.pg_rewrite w
            WHERE w.ev_class = pg_catalog.to_regclass('public.tasks')) AS rules,
          EXISTS (SELECT 1 FROM pg_catalog.pg_constraint k
            WHERE (k.conrelid = pg_catalog.to_regclass('public.tasks') AND k.contype != 'p')
              OR (k.confrelid = pg_catalog.to_regclass('public.tasks') AND k.contype = 'f'))
            AS "otherConstraints"`;
      if (effects.length !== 1 || effects[0].triggers || effects[0].rules
        || effects[0].otherConstraints) {
        throw new Error('MC_TASK6A_RESTRICTED_TASKS_EFFECTS_INVALID');
      }
      const columns = await tx<Array<{ name: string; type: string;
        notNull: boolean; defaultValue: string | null;
        generated: string; identity: string }>>`
        SELECT a.attname AS name, a.atttypid::regtype::text AS type,
          a.attnotnull AS "notNull", a.attgenerated AS generated,
          a.attidentity AS identity,
          pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS "defaultValue"
        FROM pg_catalog.pg_attribute a
        LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attrelid = pg_catalog.to_regclass('public.tasks')
          AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY a.attnum`;
      const expectedColumns: ReadonlyArray<readonly [string, string, boolean, string | null]> = [
        ['id', 'text', true, null], ['title', 'text', true, "''::text"],
        ['description', 'text', true, "''::text"],
        ['assigned_agent', 'text', true, "''::text"],
        ['priority', 'text', true, "'medium'::text"],
        ['status', 'text', true, "'todo'::text"],
        ['images', 'text', true, "'[]'::text"],
        ['created_at', 'timestamp with time zone', true, 'now()'],
        ['updated_at', 'timestamp with time zone', true, 'now()'],
      ];
      if (columns.some((column) => column.generated !== '' || column.identity !== '')
        || JSON.stringify(columns.map((column) => [column.name, column.type,
          column.notNull, column.defaultValue])) !== JSON.stringify(expectedColumns)) {
        throw new Error('MC_TASK6A_RESTRICTED_TASKS_COLUMNS_INVALID');
      }
      const indexes = await tx<Array<{ name: string; key: string;
        valid: boolean; ready: boolean; unique: boolean; primary: boolean;
        accessMethod: string; predicate: string | null; expression: string | null;
        keyCount: number; totalCount: number }>>`
        SELECT ic.relname AS name, pg_catalog.pg_get_indexdef(i.indexrelid, 1, true) AS key,
          i.indisvalid AS valid, i.indisready AS ready, i.indisunique AS unique,
          i.indisprimary AS primary, am.amname AS "accessMethod",
          pg_catalog.pg_get_expr(i.indpred, i.indrelid) AS predicate,
          pg_catalog.pg_get_expr(i.indexprs, i.indrelid) AS expression,
          i.indnkeyatts AS "keyCount", i.indnatts AS "totalCount"
        FROM pg_catalog.pg_index i
        JOIN pg_catalog.pg_class ic ON ic.oid = i.indexrelid
        JOIN pg_catalog.pg_am am ON am.oid = ic.relam
        WHERE i.indrelid = pg_catalog.to_regclass('public.tasks')`;
      const primary = indexes.filter((index) => index.primary);
      if (indexes.length !== 1 || primary.length !== 1 || primary[0].name !== 'tasks_pkey'
        || primary[0].key !== 'id' || !primary[0].valid || !primary[0].ready
        || !primary[0].unique || primary[0].accessMethod !== 'btree'
        || primary[0].predicate !== null || primary[0].expression !== null
        || primary[0].keyCount !== 1 || primary[0].totalCount !== 1) {
        throw new Error('MC_TASK6A_RESTRICTED_TASKS_INDEX_INVALID');
      }
    });
  } catch {
    throw new Error('MC_TASK6A_RESTRICTED_TASKS_VERIFY_REFUSED');
  }
}

function ensureTasksTable(): Promise<void> {
  if (!tasksTableReady) {
    if (restrictedTasks) tasksTableReady = verifyRestrictedTasksTable();
    else if (restrictedTasksMode !== undefined) {
      tasksTableReady = Promise.reject(new Error('MC_TASK6A_RESTRICTED_TASKS_MODE_INVALID'));
    } else tasksTableReady = sql`
      CREATE TABLE IF NOT EXISTS public.tasks (
        id text PRIMARY KEY,
        title text NOT NULL DEFAULT '',
        description text NOT NULL DEFAULT '',
        assigned_agent text NOT NULL DEFAULT '',
        priority text NOT NULL DEFAULT 'medium',
        status text NOT NULL DEFAULT 'todo',
        images text NOT NULL DEFAULT '[]',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `.then(() => undefined);
  }
  return tasksTableReady;
}

async function proxy(url: string, opts?: RequestInit) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ── Auto-sync tasks with workflow story progress ──────────────────
const TASK_STORY_MAP: Record<string, string[]> = {
  "Frontend": ["US-004", "US-005", "US-010"],
  "Agent Cards": ["US-006", "US-007", "US-008", "US-009"],
  "Tool Call": ["US-007"],
  "Systemd Service": ["US-011", "US-012", "US-013"],
  "WebSocket API": ["US-002"],
  "Session Log": ["US-003"],
  "Project Setup": ["US-001"],
};

let lastSyncTime = 0;
const SYNC_INTERVAL = 60_000;

async function syncTasksWithStories() {
  if (Date.now() - lastSyncTime < SYNC_INTERVAL) return;
  lastSyncTime = Date.now();

  try {
    if (USE_PG) {
      await ensureTasksTable();
      const runs = await sql`SELECT id, status FROM runs WHERE status IN ('running','pending') ORDER BY created_at DESC LIMIT 1`;
      if (runs.length === 0) return;
      const activeRun = runs[0];

      const stories = await sql`SELECT story_id, status FROM stories WHERE run_id = ${activeRun.id}`;
      if (stories.length === 0) return;
      const storyStatus = new Map(stories.map((s: any) => [s.story_id, s.status]));

      const tasks = await sql`SELECT * FROM public.tasks WHERE status != 'done'`;
      for (const task of tasks) {
        let matchedStories: string[] = [];
        for (const [keyword, storyIds] of Object.entries(TASK_STORY_MAP)) {
          if (task.title?.includes(keyword)) { matchedStories = storyIds; break; }
        }
        if (matchedStories.length === 0) continue;

        const allDone = matchedStories.every(id => storyStatus.get(id) === "done");
        const anyActive = matchedStories.some(id => {
          const s = storyStatus.get(id);
          return s === "pending" || s === "in_progress";
        });

        let newStatus: string | null = null;
        if (allDone && task.status !== "done") newStatus = "done";
        else if (anyActive && task.status === "todo") newStatus = "in_progress";

        if (newStatus) {
          await sql`UPDATE public.tasks SET status = ${newStatus}, updated_at = now() WHERE id = ${task.id}`;
        }
      }

      await sql`UPDATE public.tasks SET updated_at = now() WHERE status = 'in_progress'`;
      return;
    }

    // HTTP fallback
    const runs = await proxy(`${config.setfarmUrl}/api/runs`);
    if (!Array.isArray(runs) || runs.length === 0) return;
    const activeRun = runs.find((r: any) => r.status === "running") || runs[0];
    if (!activeRun?.id) return;

    const detail = await proxy(`${config.setfarmUrl}/api/runs/${activeRun.id}`);
    const stories: Array<{ story_id: string; status: string }> = detail?.stories || [];
    if (stories.length === 0) return;
    const storyStatus = new Map(stories.map((s: any) => [s.story_id, s.status]));

    const tasks = await proxy(`${config.setfarmUrl}/api/tasks`);
    if (!Array.isArray(tasks)) return;

    for (const task of tasks) {
      if (task.status === "done") continue;
      let matchedStories: string[] = [];
      for (const [keyword, storyIds] of Object.entries(TASK_STORY_MAP)) {
        if (task.title?.includes(keyword)) { matchedStories = storyIds; break; }
      }
      if (matchedStories.length === 0) continue;

      const allDone = matchedStories.every(id => storyStatus.get(id) === "done");
      const anyActive = matchedStories.some(id => {
        const s = storyStatus.get(id);
        return s === "pending" || s === "in_progress";
      });

      let newStatus: string | null = null;
      if (allDone && task.status !== "done") newStatus = "done";
      else if (anyActive && task.status === "todo") newStatus = "in_progress";

      if (newStatus) {
        try {
          await proxy(`${config.setfarmUrl}/api/tasks/${task.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
          });
        } catch { /* proxy request failed */ }
      }
    }

    for (const task of tasks) {
      if (task.status === "in_progress") {
        try {
          await proxy(`${config.setfarmUrl}/api/tasks/${task.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...task, updated_at: new Date().toISOString() }),
          });
        } catch { /* proxy request failed */ }
      }
    }
  } catch { /* sync failed */ }
}

router.get("/tasks", async (_req, res) => {
  try {
    if (!nonordinaryTasks) void syncTasksWithStories();
    if (USE_PG) {
      await ensureTasksTable();
      const rows = await sql`SELECT * FROM public.tasks ORDER BY
        CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        created_at DESC`;
      const tasks = rows.map(mapTaskRow);
      return res.json(tasks);
    }
    const data = await proxy(`${config.setfarmUrl}/api/tasks`);
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.post("/tasks", async (req, res) => {
  try {
    if (USE_PG) {
      await ensureTasksTable();
      const { title, description, assigned_agent, priority, status, images } = req.body;
      const id = randomUUID();
      const imagesJson = JSON.stringify(images || []);
      const rows = await sql`INSERT INTO public.tasks (id, title, description, assigned_agent, priority, status, images, created_at, updated_at)
        VALUES (${id}, ${title || ''}, ${description || ''}, ${assigned_agent || ''}, ${priority || 'medium'}, ${status || 'todo'}, ${imagesJson}, now(), now())
        RETURNING *`;
      return res.status(201).json(mapTaskRow(rows[0]));
    }
    const data = await proxy(`${config.setfarmUrl}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    res.status(201).json(data);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.put("/tasks/:id", async (req, res) => {
  try {
    if (USE_PG) {
      await ensureTasksTable();
      const { title, description, assigned_agent, priority, status, images } = req.body;
      const imagesJson = images ? JSON.stringify(images) : undefined;
      const rows = await sql`UPDATE public.tasks SET
        title = COALESCE(${title ?? null}, title),
        description = COALESCE(${description ?? null}, description),
        assigned_agent = COALESCE(${assigned_agent ?? null}, assigned_agent),
        priority = COALESCE(${priority ?? null}, priority),
        status = COALESCE(${status ?? null}, status),
        images = COALESCE(${imagesJson ?? null}, images),
        updated_at = now()
        WHERE id = ${req.params.id} RETURNING *`;
      if (rows.length === 0) return res.status(404).json({ error: 'Task not found' });
      return res.json(mapTaskRow(rows[0]));
    }
    const data = await proxy(`${config.setfarmUrl}/api/tasks/${req.params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.patch("/tasks/:id/status", async (req, res) => {
  try {
    if (USE_PG) {
      await ensureTasksTable();
      const { status } = req.body;
      const rows = await sql`UPDATE public.tasks SET status = ${status}, updated_at = now() WHERE id = ${req.params.id} RETURNING *`;
      if (rows.length === 0) return res.status(404).json({ error: 'Task not found' });
      return res.json(mapTaskRow(rows[0]));
    }
    const data = await proxy(`${config.setfarmUrl}/api/tasks/${req.params.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.delete("/tasks/:id", async (req, res) => {
  try {
    if (USE_PG) {
      await ensureTasksTable();
      await sql`DELETE FROM public.tasks WHERE id = ${req.params.id}`;
      return res.json({ ok: true });
    }
    const data = await proxy(`${config.setfarmUrl}/api/tasks/${req.params.id}`, { method: "DELETE" });
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

// Image upload - base64 in JSON body
router.post("/tasks/:id/images", express.json({ limit: "10mb" }), async (req, res) => {
  try {
    const { base64, filename } = req.body;
    if (!base64 || !filename) return res.status(400).json({ error: "base64 and filename required" });

    const ALLOWED_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXT.has(ext)) return res.status(400).json({ error: "Invalid file type. Allowed: " + [...ALLOWED_EXT].join(", ") });

    mkdirSync(UPLOADS_DIR, { recursive: true });
    const savedName = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
    const filePath = join(UPLOADS_DIR, savedName);
    writeFileSync(filePath, Buffer.from(base64, "base64"));

    if (USE_PG) {
      await ensureTasksTable();
      const rows = await sql`SELECT images FROM public.tasks WHERE id = ${req.params.id}`;
      if (rows.length > 0) {
        const images = safeImages(rows[0].images);
        images.push(savedName);
        await sql`UPDATE public.tasks SET images = ${JSON.stringify(images)}, updated_at = now() WHERE id = ${req.params.id}`;
      }
      return res.json({ filename: savedName });
    }

    // HTTP fallback
    const allTasks = await (await fetch(`${config.setfarmUrl}/api/tasks`)).json();
    const task = allTasks.find((t: any) => t.id === req.params.id);
    if (task) {
      const images = typeof task.images === "string" ? JSON.parse(task.images) : (task.images || []);
      images.push(savedName);
      await proxy(`${config.setfarmUrl}/api/tasks/${req.params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...task, images }),
      });
    }

    res.json({ filename: savedName });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Image delete
router.delete("/tasks/:id/images/:filename", async (req, res) => {
  try {
    const filePath = join(UPLOADS_DIR, req.params.filename);
    if (existsSync(filePath)) unlinkSync(filePath);

    if (USE_PG) {
      await ensureTasksTable();
      const rows = await sql`SELECT images FROM public.tasks WHERE id = ${req.params.id}`;
      if (rows.length > 0) {
        const images = safeImages(rows[0].images).filter((i: string) => i !== req.params.filename);
        await sql`UPDATE public.tasks SET images = ${JSON.stringify(images)}, updated_at = now() WHERE id = ${req.params.id}`;
      }
      return res.json({ ok: true });
    }

    // HTTP fallback
    const allTasks = await (await fetch(`${config.setfarmUrl}/api/tasks`)).json();
    const task = allTasks.find((t: any) => t.id === req.params.id);
    if (task) {
      const images = (typeof task.images === "string" ? JSON.parse(task.images) : (task.images || [])).filter((i: string) => i !== req.params.filename);
      await proxy(`${config.setfarmUrl}/api/tasks/${req.params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...task, images }),
      });
    }

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
