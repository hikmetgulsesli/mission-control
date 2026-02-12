import { Router } from "express";

const router = Router();
const ANTFARM = "http://localhost:3333";

async function proxy(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  return res.json();
}

router.get("/approvals", async (_req, res) => {
  try {
    const data = await proxy(`${ANTFARM}/api/approvals`);
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.post("/approvals/:id/approve", async (req, res) => {
  try {
    const data = await proxy(`${ANTFARM}/api/approvals/${req.params.id}/approve`, { method: "POST" });
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.post("/approvals/:id/reject", async (req, res) => {
  try {
    const data = await proxy(`${ANTFARM}/api/approvals/${req.params.id}/reject`, {
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
