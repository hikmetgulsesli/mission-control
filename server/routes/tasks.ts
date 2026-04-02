import { Router } from "express";
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { join, resolve } from "path";
import { randomUUID } from "crypto";
import express from "express";
import { config } from "../config.js";
import { sql } from "../utils/pg.js";

const router = Router();
const UPLOADS_DIR = resolve(import.meta.dirname || __dirname, "..", "..", "uploads");
const USE_PG = true; // Faz7: PG-only (SQLite removed)

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
  "Agent Kartları": ["US-006", "US-007", "US-008", "US-009"],
  "Tool Call": ["US-007"],
  "Systemd Service": ["US-011", "US-012", "US-013"],
  "WebSocket API": ["US-002"],
  "Session Log": ["US-003"],
  "Proje Setup": ["US-001"],
};

let lastSyncTime = 0;
const SYNC_INTERVAL = 60_000;

async function syncTasksWithStories() {
  if (Date.now() - lastSyncTime < SYNC_INTERVAL) return;
  lastSyncTime = Date.now();

  try {
    if (USE_PG) {
      const runs = await sql`SELECT id, status FROM runs WHERE status IN ('running','pending') ORDER BY created_at DESC LIMIT 1`;
      if (runs.length === 0) return;
      const activeRun = runs[0];

      const stories = await sql`SELECT story_id, status FROM stories WHERE run_id = ${activeRun.id}`;
      if (stories.length === 0) return;
      const storyStatus = new Map(stories.map((s: any) => [s.story_id, s.status]));

      const tasks = await sql`SELECT * FROM tasks WHERE status != 'done'`;
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
          await sql`UPDATE tasks SET status = ${newStatus}, updated_at = now() WHERE id = ${task.id}`;
        }
      }

      await sql`UPDATE tasks SET updated_at = now() WHERE status = 'in_progress'`;
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
    syncTasksWithStories();
    if (USE_PG) {
      const rows = await sql`SELECT * FROM tasks ORDER BY
        CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        created_at DESC`;
      const tasks = rows.map((r: any) => ({ ...r, images: typeof r.images === 'string' ? JSON.parse(r.images) : (r.images || []) }));
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
      const { title, description, assigned_agent, priority, status, images } = req.body;
      const id = randomUUID();
      const imagesJson = JSON.stringify(images || []);
      const rows = await sql`INSERT INTO tasks (id, title, description, assigned_agent, priority, status, images, created_at, updated_at)
        VALUES (${id}, ${title || ''}, ${description || ''}, ${assigned_agent || ''}, ${priority || 'medium'}, ${status || 'todo'}, ${imagesJson}, now(), now())
        RETURNING *`;
      const task = rows[0];
      task.images = JSON.parse(task.images);
      return res.status(201).json(task);
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
      const { title, description, assigned_agent, priority, status, images } = req.body;
      const imagesJson = images ? JSON.stringify(images) : undefined;
      const rows = await sql`UPDATE tasks SET
        title = COALESCE(${title ?? null}, title),
        description = COALESCE(${description ?? null}, description),
        assigned_agent = COALESCE(${assigned_agent ?? null}, assigned_agent),
        priority = COALESCE(${priority ?? null}, priority),
        status = COALESCE(${status ?? null}, status),
        images = COALESCE(${imagesJson ?? null}, images),
        updated_at = now()
        WHERE id = ${req.params.id} RETURNING *`;
      if (rows.length === 0) return res.status(404).json({ error: 'Task not found' });
      rows[0].images = typeof rows[0].images === 'string' ? JSON.parse(rows[0].images) : (rows[0].images || []);
      return res.json(rows[0]);
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
      const { status } = req.body;
      const rows = await sql`UPDATE tasks SET status = ${status}, updated_at = now() WHERE id = ${req.params.id} RETURNING *`;
      if (rows.length === 0) return res.status(404).json({ error: 'Task not found' });
      rows[0].images = typeof rows[0].images === 'string' ? JSON.parse(rows[0].images) : (rows[0].images || []);
      return res.json(rows[0]);
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
      await sql`DELETE FROM tasks WHERE id = ${req.params.id}`;
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
      const rows = await sql`SELECT images FROM tasks WHERE id = ${req.params.id}`;
      if (rows.length > 0) {
        const images = typeof rows[0].images === 'string' ? JSON.parse(rows[0].images) : (rows[0].images || []);
        images.push(savedName);
        await sql`UPDATE tasks SET images = ${JSON.stringify(images)}, updated_at = now() WHERE id = ${req.params.id}`;
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
      const rows = await sql`SELECT images FROM tasks WHERE id = ${req.params.id}`;
      if (rows.length > 0) {
        const images = (typeof rows[0].images === 'string' ? JSON.parse(rows[0].images) : (rows[0].images || [])).filter((i: string) => i !== req.params.filename);
        await sql`UPDATE tasks SET images = ${JSON.stringify(images)}, updated_at = now() WHERE id = ${req.params.id}`;
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
