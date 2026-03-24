import { Router } from "express";
import { randomUUID } from "crypto";
import { config } from "../config.js";
import { sql } from "../utils/pg.js";

const router = Router();
const USE_PG = false; // Rules come from workflow fragments via :3333, not PG

async function proxy(url: string, opts?: RequestInit) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    if (url.includes('/export') && res.ok) {
      const data = await res.json();
      return data;
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

// GET /api/rules
router.get("/rules", async (_req, res) => {
  try {
    if (USE_PG) {
      const { category, project_type, search } = _req.query;
      let rows;
      if (search) {
        const searchPattern = '%' + String(search) + '%';
        if (category && project_type) {
          rows = await sql`SELECT * FROM rules WHERE category = ${String(category)} AND project_type = ${String(project_type)} AND (title ILIKE ${searchPattern} OR content ILIKE ${searchPattern}) ORDER BY sort_order, created_at`;
        } else if (category) {
          rows = await sql`SELECT * FROM rules WHERE category = ${String(category)} AND (title ILIKE ${searchPattern} OR content ILIKE ${searchPattern}) ORDER BY sort_order, created_at`;
        } else if (project_type) {
          rows = await sql`SELECT * FROM rules WHERE project_type = ${String(project_type)} AND (title ILIKE ${searchPattern} OR content ILIKE ${searchPattern}) ORDER BY sort_order, created_at`;
        } else {
          rows = await sql`SELECT * FROM rules WHERE title ILIKE ${searchPattern} OR content ILIKE ${searchPattern} ORDER BY sort_order, created_at`;
        }
      } else {
        if (category && project_type) {
          rows = await sql`SELECT * FROM rules WHERE category = ${String(category)} AND project_type = ${String(project_type)} ORDER BY sort_order, created_at`;
        } else if (category) {
          rows = await sql`SELECT * FROM rules WHERE category = ${String(category)} ORDER BY sort_order, created_at`;
        } else if (project_type) {
          rows = await sql`SELECT * FROM rules WHERE project_type = ${String(project_type)} ORDER BY sort_order, created_at`;
        } else {
          rows = await sql`SELECT * FROM rules ORDER BY sort_order, created_at`;
        }
      }
      return res.json(rows);
    }
    const params = new URLSearchParams();
    if (_req.query.category) params.set("category", String(_req.query.category));
    if (_req.query.project_type) params.set("project_type", String(_req.query.project_type));
    if (_req.query.source) params.set("source", String(_req.query.source));
    if (_req.query.search) params.set("search", String(_req.query.search));
    const qs = params.toString();
    const data = await proxy(`${config.setfarmUrl}/api/rules${qs ? '?' + qs : ''}`);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/rules
router.post("/rules", async (req, res) => {
  try {
    if (USE_PG) {
      const { title, content, category, project_type, severity, applies_to, enabled, sort_order } = req.body;
      const id = randomUUID();
      const rows = await sql`INSERT INTO rules (id, title, content, category, project_type, severity, applies_to, enabled, sort_order, created_at, updated_at)
        VALUES (${id}, ${title || ''}, ${content || ''}, ${category || 'general'}, ${project_type || 'general'}, ${severity || 'mandatory'}, ${applies_to || 'implement'}, ${enabled !== false}, ${sort_order || 0}, now(), now())
        RETURNING *`;
      return res.json(rows[0]);
    }
    const data = await proxy(`${config.setfarmUrl}/api/rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/rules/export
router.get("/rules/export", async (_req, res) => {
  try {
    if (USE_PG) {
      const rows = await sql`SELECT * FROM rules ORDER BY sort_order, created_at`;
      res.setHeader("Content-Disposition", 'attachment; filename="setfarm-rules.json"');
      return res.json(rows);
    }
    const data = await proxy(`${config.setfarmUrl}/api/rules/export`);
    res.setHeader("Content-Disposition", 'attachment; filename="setfarm-rules.json"');
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/rules/import
router.post("/rules/import", async (req, res) => {
  try {
    if (USE_PG) {
      const rules = Array.isArray(req.body) ? req.body : (req.body.rules || []);
      let imported = 0;
      for (const rule of rules) {
        const id = rule.id || randomUUID();
        await sql`INSERT INTO rules (id, title, content, category, project_type, severity, applies_to, enabled, sort_order, created_at, updated_at)
          VALUES (${id}, ${rule.title || ''}, ${rule.content || ''}, ${rule.category || 'general'}, ${rule.project_type || 'general'}, ${rule.severity || 'mandatory'}, ${rule.applies_to || 'implement'}, ${rule.enabled !== false}, ${rule.sort_order || 0}, ${rule.created_at || new Date().toISOString()}, now())
          ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, content = EXCLUDED.content, category = EXCLUDED.category, project_type = EXCLUDED.project_type, severity = EXCLUDED.severity, applies_to = EXCLUDED.applies_to, enabled = EXCLUDED.enabled, sort_order = EXCLUDED.sort_order, updated_at = now()`;
        imported++;
      }
      return res.json({ imported });
    }
    const data = await proxy(`${config.setfarmUrl}/api/rules/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/rules/:id/toggle
router.put("/rules/:id/toggle", async (req, res) => {
  try {
    if (USE_PG) {
      const rows = await sql`UPDATE rules SET enabled = NOT enabled, updated_at = now() WHERE id = ${req.params.id} RETURNING *`;
      if (rows.length === 0) return res.status(404).json({ error: 'Rule not found' });
      return res.json(rows[0]);
    }
    const data = await proxy(`${config.setfarmUrl}/api/rules/${req.params.id}/toggle`, { method: "PUT" });
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/rules/:id
router.put("/rules/:id", async (req, res) => {
  try {
    if (USE_PG) {
      const { title, content, category, project_type, severity, applies_to, enabled, sort_order } = req.body;
      const rows = await sql`UPDATE rules SET
        title = COALESCE(${title ?? null}, title),
        content = COALESCE(${content ?? null}, content),
        category = COALESCE(${category ?? null}, category),
        project_type = COALESCE(${project_type ?? null}, project_type),
        severity = COALESCE(${severity ?? null}, severity),
        applies_to = COALESCE(${applies_to ?? null}, applies_to),
        enabled = COALESCE(${enabled ?? null}, enabled),
        sort_order = COALESCE(${sort_order ?? null}, sort_order),
        updated_at = now()
        WHERE id = ${req.params.id} RETURNING *`;
      if (rows.length === 0) return res.status(404).json({ error: 'Rule not found' });
      return res.json(rows[0]);
    }
    const data = await proxy(`${config.setfarmUrl}/api/rules/${req.params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/rules/:id
router.delete("/rules/:id", async (req, res) => {
  try {
    if (USE_PG) {
      await sql`DELETE FROM rules WHERE id = ${req.params.id}`;
      return res.json({ ok: true });
    }
    const data = await proxy(`${config.setfarmUrl}/api/rules/${req.params.id}`, { method: "DELETE" });
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
