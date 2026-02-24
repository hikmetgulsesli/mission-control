import { Router } from "express";
import { config } from "../config.js";

const router = Router();

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

router.get("/approvals", async (_req, res) => {
  try {
    const data = await proxy(`${config.setfarmUrl}/api/approvals`);
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.post("/approvals/:id/approve", async (req, res) => {
  try {
    const data = await proxy(`${config.setfarmUrl}/api/approvals/${req.params.id}/approve`, { method: "POST" });
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.post("/approvals/:id/reject", async (req, res) => {
  try {
    const data = await proxy(`${config.setfarmUrl}/api/approvals/${req.params.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

export default router;
