import { Router } from "express";
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { join, resolve } from "path";
import { randomUUID } from "crypto";
import express from "express";

const router = Router();
const ANTFARM = "http://localhost:3333";
const UPLOADS_DIR = resolve(import.meta.dirname || __dirname, "..", "..", "uploads");

async function proxy(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  return res.json();
}

router.get("/tasks", async (_req, res) => {
  try {
    const data = await proxy(`${ANTFARM}/api/tasks`);
    res.json(data);
  } catch (e: any) {
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
  } catch (e: any) {
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
  } catch (e: any) {
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
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.delete("/tasks/:id", async (req, res) => {
  try {
    const data = await proxy(`${ANTFARM}/api/tasks/${req.params.id}`, {
      method: "DELETE",
    });
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

    mkdirSync(UPLOADS_DIR, { recursive: true });
    const ext = filename.split(".").pop() || "png";
    const savedName = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
    const filePath = join(UPLOADS_DIR, savedName);
    writeFileSync(filePath, Buffer.from(base64, "base64"));

    // Update task images in antfarm
    const allTasks = await (await fetch(`${ANTFARM}/api/tasks`)).json();
    const task = allTasks.find((t: any) => t.id === req.params.id);
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
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Image delete
router.delete("/tasks/:id/images/:filename", async (req, res) => {
  try {
    const filePath = join(UPLOADS_DIR, req.params.filename);
    if (existsSync(filePath)) unlinkSync(filePath);

    // Update task images in antfarm
    const allTasks = await (await fetch(`${ANTFARM}/api/tasks`)).json();
    const task = allTasks.find((t: any) => t.id === req.params.id);
    if (task) {
      const images = (typeof task.images === "string" ? JSON.parse(task.images) : (task.images || [])).filter((i: string) => i !== req.params.filename);
      await proxy(`${ANTFARM}/api/tasks/${req.params.id}`, {
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
