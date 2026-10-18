import { Router } from "express";
import { randomUUID } from "crypto";
import { config } from "../config.js";
import { sql } from "../utils/pg.js";
import { freshMissionControlPathsV1 } from "../services/fresh-installation-runtime.js";

interface RuleCapabilities {
  create: boolean;
  update: boolean;
  delete: boolean;
  import: boolean;
  toggle: boolean;
  reason: string | null;
}

interface RulesRouterOptions {
  setfarmUrl?: string;
  fetch?: typeof fetch;
  selectedFresh?: () => boolean;
  timeoutMs?: number;
}

class RulesProxyError extends Error {
  constructor(public status: number, message: string, public code: string) { super(message); }
}

// Only public, bounded service messages cross the proxy. Raw HTML, stack traces,
// private paths, credential-bearing diagnostics and arbitrary JSON fields do not.
function publicRuleMessage(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim() || /[<>\r\n]|(?:\/\S+|[A-Za-z]:\\)|(?:token|password|secret|authorization)\s*[:=]|Bearer\s/i.test(value)) return fallback;
  return value.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 300);
}

export function createRulesRouter(options: RulesRouterOptions = {}) {
const router = Router();
const USE_PG = false; // Rules come from workflow fragments via :3333, not PG
const setfarmUrl = options.setfarmUrl ?? config.setfarmUrl;
const upstreamFetch = options.fetch ?? fetch;
const selectedFresh = options.selectedFresh ?? (() => freshMissionControlPathsV1() !== null);
const capabilities = (): RuleCapabilities => {
  const supported = !selectedFresh();
  return { create: supported, update: supported, delete: supported, import: supported, toggle: supported,
    reason: supported ? null : 'FRESH_RULES_NOT_WIRED' };
};

router.get('/rules/capabilities', (_req, res) => {
  try { res.json(capabilities()); }
  catch { res.status(503).json({ error: 'Rules capabilities unavailable', code: 'RULES_CAPABILITIES_UNAVAILABLE' }); }
});
router.use('/rules', (req, res, next) => {
  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) return next();
  try {
    const action = req.method === 'DELETE' ? 'delete' : req.method === 'POST'
      ? (req.path === '/import' ? 'import' : 'create') : req.path.endsWith('/toggle') ? 'toggle' : 'update';
    const current = capabilities();
    if (!current[action]) return res.status(503).json({ error: current.reason, code: 'NOT_WIRED' });
    next();
  } catch { res.status(503).json({ error: 'Rules capabilities unavailable', code: 'RULES_CAPABILITIES_UNAVAILABLE' }); }
});

async function proxy(url: string, opts?: RequestInit) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), options.timeoutMs ?? 10_000);
  try {
    const response = await upstreamFetch(url, { ...opts, signal: ctrl.signal });
    let data;
    try { data = await response.json(); }
    catch (error) {
      if (ctrl.signal.aborted) throw error;
      throw new RulesProxyError(response.ok ? 502 : response.status, 'Rules service returned an invalid response', 'RULES_INVALID_RESPONSE');
    }
    if (!response.ok) {
      throw new RulesProxyError(response.status,
        publicRuleMessage(data?.error ?? data?.message, `Rules service request failed (HTTP ${response.status})`),
        typeof data?.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(data.code) ? data.code : 'RULES_UPSTREAM_ERROR');
    }
    return { status: response.status, data };
  } catch (error) {
    if (ctrl.signal.aborted) throw new RulesProxyError(504, 'Rules service timed out', 'RULES_UPSTREAM_TIMEOUT');
    if (error instanceof RulesProxyError) throw error;
    throw new RulesProxyError(502, 'Rules service unavailable', 'RULES_UPSTREAM_UNAVAILABLE');
  } finally { clearTimeout(timer); }
}
function failure(res: import('express').Response, error: unknown) {
  if (error instanceof RulesProxyError) return res.status(error.status).json({ error: error.message, code: error.code });
  return res.status(500).json({ error: 'Rules request failed', code: 'RULES_REQUEST_FAILED' });
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
    if (_req.query.stack_pack_id) params.set("stack_pack_id", String(_req.query.stack_pack_id));
    if (_req.query.source) params.set("source", String(_req.query.source));
    if (_req.query.search) params.set("search", String(_req.query.search));
    const qs = params.toString();
    const { status, data } = await proxy(`${setfarmUrl}/api/rules${qs ? '?' + qs : ''}`);
    res.status(status).json(data);
  } catch (e: any) {
    failure(res, e);
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
    const { status, data } = await proxy(`${setfarmUrl}/api/rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    res.status(status).json(data);
  } catch (e: any) {
    failure(res, e);
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
    const { status, data } = await proxy(`${setfarmUrl}/api/rules/export`);
    res.setHeader("Content-Disposition", 'attachment; filename="setfarm-rules.json"');
    res.status(status).json(data);
  } catch (e: any) {
    failure(res, e);
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
    const { status, data } = await proxy(`${setfarmUrl}/api/rules/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    res.status(status).json(data);
  } catch (e: any) {
    failure(res, e);
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
    const { status, data } = await proxy(`${setfarmUrl}/api/rules/${req.params.id}/toggle`, { method: "PUT" });
    res.status(status).json(data);
  } catch (e: any) {
    failure(res, e);
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
    const { status, data } = await proxy(`${setfarmUrl}/api/rules/${req.params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    res.status(status).json(data);
  } catch (e: any) {
    failure(res, e);
  }
});

// DELETE /api/rules/:id
router.delete("/rules/:id", async (req, res) => {
  try {
    if (USE_PG) {
      await sql`DELETE FROM rules WHERE id = ${req.params.id}`;
      return res.json({ ok: true });
    }
    const { status, data } = await proxy(`${setfarmUrl}/api/rules/${req.params.id}`, { method: "DELETE" });
    res.status(status).json(data);
  } catch (e: any) {
    failure(res, e);
  }
});

return router;
}

export default createRulesRouter();
