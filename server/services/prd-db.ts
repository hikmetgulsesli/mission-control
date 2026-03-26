/**
 * PRD Database Service — PostgreSQL
 * Replaces the old SQLite CLI-based implementation.
 */
import { randomUUID } from 'crypto';
import sql from '../utils/pg.js';

// ── Schema ──────────────────────────────────────────────────────────

let schemaInitialized = false;

async function ensureSchema(): Promise<void> {
  if (schemaInitialized) return;

  await sql`
    CREATE TABLE IF NOT EXISTS prds (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      platform TEXT DEFAULT 'web',
      urls TEXT,
      description TEXT,
      analysis TEXT,
      research TEXT,
      chat_history TEXT,
      prd_content TEXT,
      prd_version INTEGER DEFAULT 1,
      score INTEGER,
      score_details TEXT,
      mockup_screens TEXT,
      pages TEXT,
      cost_estimate TEXT,
      run_id TEXT,
      template_id TEXT,
      stitch_project_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS prd_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      platform TEXT DEFAULT 'web',
      prd_content TEXT,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Seed templates if empty
  const [{ count }] = await sql`SELECT COUNT(*)::int as count FROM prd_templates`;
  if (count === 0) {
    await seedTemplates();
  }

  schemaInitialized = true;
}

async function seedTemplates(): Promise<void> {
  const { TEMPLATE_CONTENTS } = await import('./prd-templates.js');
  const templates = [
    { id: 'tpl-ecommerce', name: 'E-Ticaret', category: 'ecommerce', platform: 'web', description: 'Urun listeleme, sepet, odeme akisi ile tam kapsamli e-ticaret sitesi' },
    { id: 'tpl-portfolio', name: 'Portfolio', category: 'portfolio', platform: 'web', description: 'Kisisel portfolio sitesi — projeler, hakkinda, iletisim' },
    { id: 'tpl-saas', name: 'SaaS Landing', category: 'saas', platform: 'web', description: 'SaaS urun landing page — hero, ozellikler, fiyatlandirma, CTA' },
    { id: 'tpl-blog', name: 'Blog', category: 'blog', platform: 'web', description: 'Blog sitesi — yazi listesi, detay, kategoriler, arama' },
    { id: 'tpl-dashboard', name: 'Dashboard', category: 'dashboard', platform: 'web', description: 'Veri dashboardu — grafikler, tablolar, metrikler, filtreler' },
    { id: 'tpl-admin', name: 'Admin Panel', category: 'admin', platform: 'web', description: 'CRUD admin paneli — kullanicilar, icerik yonetimi, ayarlar' },
    { id: 'tpl-mobile', name: 'Mobil App', category: 'mobile', platform: 'mobile', description: 'React Native mobil uygulama — tab navigation, liste, detay' },
    { id: 'tpl-game', name: 'Oyun', category: 'game', platform: 'web', description: 'Canvas/WebGL tabanli basit oyun — menu, oyun ekrani, skor' },
    { id: 'tpl-docs', name: 'Dokumantasyon', category: 'docs', platform: 'web', description: 'Dokumantasyon sitesi — sidebar nav, markdown render, arama' },
  ];

  for (const t of templates) {
    const content = TEMPLATE_CONTENTS[t.id] || '';
    await sql`
      INSERT INTO prd_templates (id, name, category, platform, description, prd_content)
      VALUES (${t.id}, ${t.name}, ${t.category}, ${t.platform}, ${t.description}, ${content})
      ON CONFLICT (id) DO NOTHING
    `;
  }
}

// ── Types ───────────────────────────────────────────────────────────

export interface PrdRecord {
  id: string;
  title: string;
  platform: string;
  urls: string[];
  description: string;
  analysis: any;
  research: any;
  chat_history: any[];
  prd_content: string;
  prd_version: number;
  score: number | null;
  score_details: any;
  mockup_screens: any;
  pages: any;
  cost_estimate: any;
  stitch_project_id: string | null;
  run_id: string | null;
  template_id: string | null;
  created_at: string;
  updated_at: string;
}

function safeJsonParse(str: string | null | undefined, fallback: any): any {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

function deserializePrd(row: any): PrdRecord {
  return {
    ...row,
    urls: safeJsonParse(row.urls, []),
    analysis: safeJsonParse(row.analysis, null),
    research: safeJsonParse(row.research, null),
    chat_history: safeJsonParse(row.chat_history, []),
    score_details: safeJsonParse(row.score_details, null),
    mockup_screens: safeJsonParse(row.mockup_screens, null),
    pages: safeJsonParse(row.pages, null),
    cost_estimate: safeJsonParse(row.cost_estimate, null),
    stitch_project_id: row.stitch_project_id || null,
  };
}

// ── CRUD ────────────────────────────────────────────────────────────

export async function createPrd(data: {
  title: string;
  platform?: string;
  urls?: string[];
  description?: string;
  template_id?: string;
}): Promise<PrdRecord> {
  await ensureSchema();
  const id = `prd-${randomUUID().slice(0, 8)}`;
  const urls = JSON.stringify(data.urls || []);

  await sql`
    INSERT INTO prds (id, title, platform, urls, description, template_id)
    VALUES (${id}, ${data.title}, ${data.platform || 'web'}, ${urls}, ${data.description || ''}, ${data.template_id || ''})
  `;
  return (await getPrd(id))!;
}

export async function getPrd(id: string): Promise<PrdRecord | null> {
  await ensureSchema();
  const rows = await sql`SELECT * FROM prds WHERE id = ${id}`;
  return rows.length > 0 ? deserializePrd(rows[0]) : null;
}

export async function listPrds(limit = 50): Promise<PrdRecord[]> {
  await ensureSchema();
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const rows = await sql`SELECT * FROM prds ORDER BY updated_at DESC LIMIT ${safeLimit}`;
  return rows.map(deserializePrd);
}

export async function updatePrd(id: string, updates: Partial<{
  title: string;
  platform: string;
  urls: string[];
  description: string;
  analysis: any;
  research: any;
  chat_history: any[];
  prd_content: string;
  prd_version: number;
  score: number;
  score_details: any;
  mockup_screens: any;
  pages: any;
  cost_estimate: any;
  stitch_project_id: string;
  run_id: string;
}>): Promise<PrdRecord | null> {
  await ensureSchema();

  const jsonFields = new Set(['urls', 'analysis', 'research', 'chat_history', 'score_details', 'mockup_screens', 'pages', 'cost_estimate']);

  // Build dynamic update using unsafe (porsager/postgres doesn't support dynamic column names in tagged templates)
  const sets: string[] = [];
  const vals: any[] = [];
  let paramIdx = 1;

  for (const [key, val] of Object.entries(updates)) {
    if (val === undefined) continue;
    const serialized = jsonFields.has(key) ? JSON.stringify(val) : val;
    sets.push(`${key} = $${paramIdx++}`);
    vals.push(serialized);
  }

  if (sets.length === 0) return getPrd(id);

  sets.push(`updated_at = NOW()`);
  vals.push(id);
  await sql.unsafe(`UPDATE prds SET ${sets.join(', ')} WHERE id = $${paramIdx}`, vals);
  return getPrd(id);
}

export async function deletePrd(id: string): Promise<boolean> {
  await ensureSchema();
  await sql`DELETE FROM prds WHERE id = ${id}`;
  return true;
}

// ── Templates ───────────────────────────────────────────────────────

export async function listTemplates(): Promise<any[]> {
  await ensureSchema();
  return sql`SELECT * FROM prd_templates ORDER BY name`;
}

export async function getTemplate(id: string): Promise<any> {
  await ensureSchema();
  const rows = await sql`SELECT * FROM prd_templates WHERE id = ${id}`;
  return rows[0] || null;
}
