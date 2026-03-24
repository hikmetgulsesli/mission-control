import { Router } from "express";
import { config } from "../config.js";
import { sql } from "../utils/pg.js";

const router = Router();
const USE_PG = process.env.DB_BACKEND === 'postgres';

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
    if (USE_PG) {
      const rows = await sql`SELECT * FROM approvals ORDER BY created_at DESC`;
      return res.json(rows);
    }
    const data = await proxy(`${config.setfarmUrl}/api/approvals`);
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.post("/approvals/:id/approve", async (req, res) => {
  try {
    if (USE_PG) {
      const rows = await sql`UPDATE approvals SET status = 'approved', updated_at = now() WHERE id = ${req.params.id} RETURNING *`;
      if (rows.length === 0) return res.status(404).json({ error: 'Approval not found' });
      return res.json(rows[0]);
    }
    const data = await proxy(`${config.setfarmUrl}/api/approvals/${req.params.id}/approve`, { method: "POST" });
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.post("/approvals/:id/reject", async (req, res) => {
  try {
    if (USE_PG) {
      const { reason } = req.body || {};
      const rows = await sql`UPDATE approvals SET status = 'rejected', reason = ${reason || null}, updated_at = now() WHERE id = ${req.params.id} RETURNING *`;
      if (rows.length === 0) return res.status(404).json({ error: 'Approval not found' });
      return res.json(rows[0]);
    }
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
