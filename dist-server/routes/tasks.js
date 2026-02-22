import { Router } from "express";
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { join, resolve } from "path";
import { randomUUID } from "crypto";
import express from "express";
const router = Router();
const ANTFARM = "http://localhost:3333";
const UPLOADS_DIR = resolve(import.meta.dirname || __dirname, "..", "..", "uploads");
async function proxy(url, opts) {
    const res = await fetch(url, opts);
    return res.json();
}
// ── Auto-sync tasks with workflow story progress ──────────────────
// Task title keywords → story IDs mapping
const TASK_STORY_MAP = {
    "Frontend": ["US-004", "US-005", "US-010"],
    "Agent Kartları": ["US-006", "US-007", "US-008", "US-009"],
    "Tool Call": ["US-007"],
    "Systemd Service": ["US-011", "US-012", "US-013"],
    "WebSocket API": ["US-002"],
    "Session Log": ["US-003"],
    "Proje Setup": ["US-001"],
};
let lastSyncTime = 0;
const SYNC_INTERVAL = 60_000; // sync every 60s
async function syncTasksWithStories() {
    if (Date.now() - lastSyncTime < SYNC_INTERVAL)
        return;
    lastSyncTime = Date.now();
    try {
        // Get all runs
        const runs = await proxy(`${ANTFARM}/api/runs`);
        if (!Array.isArray(runs) || runs.length === 0)
            return;
        // Find the active/latest run
        const activeRun = runs.find((r) => r.status === "running") || runs[0];
        if (!activeRun?.id)
            return;
        // Get stories for this run
        const detail = await proxy(`${ANTFARM}/api/runs/${activeRun.id}`);
        const stories = detail?.stories || [];
        if (stories.length === 0)
            return;
        const storyStatus = new Map(stories.map((s) => [s.story_id, s.status]));
        // Get current tasks
        const tasks = await proxy(`${ANTFARM}/api/tasks`);
        if (!Array.isArray(tasks))
            return;
        for (const task of tasks) {
            if (task.status === "done")
                continue;
            // Find matching story IDs for this task
            let matchedStories = [];
            for (const [keyword, storyIds] of Object.entries(TASK_STORY_MAP)) {
                if (task.title?.includes(keyword)) {
                    matchedStories = storyIds;
                    break;
                }
            }
            if (matchedStories.length === 0)
                continue;
            const allDone = matchedStories.every(id => storyStatus.get(id) === "done");
            const anyActive = matchedStories.some(id => {
                const s = storyStatus.get(id);
                return s === "pending" || s === "in_progress";
            });
            let newStatus = null;
            if (allDone && task.status !== "done") {
                newStatus = "done";
            }
            else if (anyActive && task.status === "todo") {
                newStatus = "in_progress";
            }
            if (newStatus) {
                try {
                    await proxy(`${ANTFARM}/api/tasks/${task.id}/status`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: newStatus }),
                    });
                }
                catch { }
            }
        }
        // Refresh in_progress task timestamps so pulse animation works
        for (const task of tasks) {
            if (task.status === "in_progress") {
                try {
                    await proxy(`${ANTFARM}/api/tasks/${task.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ...task, updated_at: new Date().toISOString() }),
                    });
                }
                catch { }
            }
        }
    }
    catch { }
}
router.get("/tasks", async (_req, res) => {
    try {
        // Sync tasks with story progress (throttled to every 60s)
        syncTasksWithStories();
        const data = await proxy(`${ANTFARM}/api/tasks`);
        res.json(data);
    }
    catch (e) {
        res.status(502).json({ error: e.message });
    }
});
router.post("/tasks", async (req, res) => {
    try {
        const data = await proxy(`${ANTFARM}/api/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req.body),
        });
        res.status(201).json(data);
    }
    catch (e) {
        res.status(502).json({ error: e.message });
    }
});
router.put("/tasks/:id", async (req, res) => {
    try {
        const data = await proxy(`${ANTFARM}/api/tasks/${req.params.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req.body),
        });
        res.json(data);
    }
    catch (e) {
        res.status(502).json({ error: e.message });
    }
});
router.patch("/tasks/:id/status", async (req, res) => {
    try {
        const data = await proxy(`${ANTFARM}/api/tasks/${req.params.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req.body),
        });
        res.json(data);
    }
    catch (e) {
        res.status(502).json({ error: e.message });
    }
});
router.delete("/tasks/:id", async (req, res) => {
    try {
        const data = await proxy(`${ANTFARM}/api/tasks/${req.params.id}`, {
            method: "DELETE",
        });
        res.json(data);
    }
    catch (e) {
        res.status(502).json({ error: e.message });
    }
});
// Image upload - base64 in JSON body
router.post("/tasks/:id/images", express.json({ limit: "10mb" }), async (req, res) => {
    try {
        const { base64, filename } = req.body;
        if (!base64 || !filename)
            return res.status(400).json({ error: "base64 and filename required" });
        mkdirSync(UPLOADS_DIR, { recursive: true });
        const ext = filename.split(".").pop() || "png";
        const savedName = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
        const filePath = join(UPLOADS_DIR, savedName);
        writeFileSync(filePath, Buffer.from(base64, "base64"));
        // Update task images in setfarm
        const allTasks = await (await fetch(`${ANTFARM}/api/tasks`)).json();
        const task = allTasks.find((t) => t.id === req.params.id);
        if (task) {
            const images = typeof task.images === "string" ? JSON.parse(task.images) : (task.images || []);
            images.push(savedName);
            await proxy(`${ANTFARM}/api/tasks/${req.params.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...task, images }),
            });
        }
        res.json({ filename: savedName });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Image delete
router.delete("/tasks/:id/images/:filename", async (req, res) => {
    try {
        const filePath = join(UPLOADS_DIR, req.params.filename);
        if (existsSync(filePath))
            unlinkSync(filePath);
        // Update task images in setfarm
        const allTasks = await (await fetch(`${ANTFARM}/api/tasks`)).json();
        const task = allTasks.find((t) => t.id === req.params.id);
        if (task) {
            const images = (typeof task.images === "string" ? JSON.parse(task.images) : (task.images || [])).filter((i) => i !== req.params.filename);
            await proxy(`${ANTFARM}/api/tasks/${req.params.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...task, images }),
            });
        }
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
export default router;
