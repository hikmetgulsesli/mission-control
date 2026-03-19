import { Router } from "express";
import { config } from "../config.js";
const router = Router();
async function proxy(url, opts) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
        const res = await fetch(url, { ...opts, signal: ctrl.signal });
        if (url.includes('/export') && res.ok) {
            const data = await res.json();
            return data;
        }
        return res.json();
    }
    finally {
        clearTimeout(timer);
    }
}
// GET /api/rules
router.get("/rules", async (_req, res) => {
    try {
        const params = new URLSearchParams();
        if (_req.query.category)
            params.set("category", String(_req.query.category));
        if (_req.query.project_type)
            params.set("project_type", String(_req.query.project_type));
        if (_req.query.source)
            params.set("source", String(_req.query.source));
        if (_req.query.search)
            params.set("search", String(_req.query.search));
        const qs = params.toString();
        const data = await proxy(`${config.setfarmUrl}/api/rules${qs ? '?' + qs : ''}`);
        res.json(data);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/rules
router.post("/rules", async (req, res) => {
    try {
        const data = await proxy(`${config.setfarmUrl}/api/rules`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req.body),
        });
        res.json(data);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/rules/export
router.get("/rules/export", async (_req, res) => {
    try {
        const data = await proxy(`${config.setfarmUrl}/api/rules/export`);
        res.setHeader("Content-Disposition", 'attachment; filename="setfarm-rules.json"');
        res.json(data);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/rules/import
router.post("/rules/import", async (req, res) => {
    try {
        const data = await proxy(`${config.setfarmUrl}/api/rules/import`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req.body),
        });
        res.json(data);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// PUT /api/rules/:id/toggle
router.put("/rules/:id/toggle", async (req, res) => {
    try {
        const data = await proxy(`${config.setfarmUrl}/api/rules/${req.params.id}/toggle`, {
            method: "PUT",
        });
        res.json(data);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// PUT /api/rules/:id
router.put("/rules/:id", async (req, res) => {
    try {
        const data = await proxy(`${config.setfarmUrl}/api/rules/${req.params.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req.body),
        });
        res.json(data);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// DELETE /api/rules/:id
router.delete("/rules/:id", async (req, res) => {
    try {
        const data = await proxy(`${config.setfarmUrl}/api/rules/${req.params.id}`, {
            method: "DELETE",
        });
        res.json(data);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
export default router;
