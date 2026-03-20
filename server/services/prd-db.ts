import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { homedir } from 'os';
import { join } from 'path';

const execFileAsync = promisify(execFileCb);

const DB_PATH = join(homedir(), '.openclaw', 'setfarm', 'prd-history.db');

const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;

function validateId(value: string, name: string): string {
  if (!value || !SAFE_ID_RE.test(value)) {
    throw new Error(`Invalid ${name}: must be alphanumeric/dash/underscore`);
  }
  return value;
}

function escapeStr(value: string): string {
  return value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').replace(/'/g, "''");
}

async function sqlite3(sql: string, json = true): Promise<any> {
  const args = [DB_PATH];
  if (json) args.push('-json');
  args.push(sql);

  const { stdout } = await execFileAsync('sqlite3', args, {
    timeout: 10000,
    maxBuffer: 2 * 1024 * 1024,
  });

  if (!json) return stdout.trim();
  const trimmed = stdout.trim();
  if (!trimmed) return [];
  return JSON.parse(trimmed);
}

async function query(sql: string): Promise<any[]> {
  return sqlite3(sql, true);
}

async function exec(sql: string): Promise<string> {
  return sqlite3(sql, false);
}

let schemaInitialized = false;

async function ensureSchema(): Promise<void> {
  if (schemaInitialized) return;

  await exec(`
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
      cost_estimate TEXT,
      run_id TEXT,
      template_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS prd_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      platform TEXT DEFAULT 'web',
      prd_content TEXT,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed templates if empty
  const rows = await query('SELECT COUNT(*) as c FROM prd_templates');
  if (rows[0]?.c === 0) {
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
    await exec(`INSERT OR IGNORE INTO prd_templates (id, name, category, platform, description, prd_content) VALUES ('${escapeStr(t.id)}', '${escapeStr(t.name)}', '${escapeStr(t.category)}', '${escapeStr(t.platform)}', '${escapeStr(t.description)}', '${escapeStr(content)}')`);
  }
}

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
  cost_estimate: any;
  run_id: string | null;
  template_id: string | null;
  created_at: string;
  updated_at: string;
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
    cost_estimate: safeJsonParse(row.cost_estimate, null),
  };
}

function safeJsonParse(str: string | null | undefined, fallback: any): any {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

export async function createPrd(data: {
  title: string;
  platform?: string;
  urls?: string[];
  description?: string;
  template_id?: string;
}): Promise<PrdRecord> {
  await ensureSchema();
  const id = `prd-${randomUUID().slice(0, 8)}`;
  const title = escapeStr(data.title);
  const platform = escapeStr(data.platform || 'web');
  const urls = escapeStr(JSON.stringify(data.urls || []));
  const description = escapeStr(data.description || '');
  const templateId = data.template_id ? escapeStr(data.template_id) : '';

  await exec(`INSERT INTO prds (id, title, platform, urls, description, template_id) VALUES ('${id}', '${title}', '${platform}', '${urls}', '${description}', '${templateId}')`);
  return (await getPrd(id))!;
}

export async function getPrd(id: string): Promise<PrdRecord | null> {
  await ensureSchema();
  validateId(id, 'prdId');
  const rows = await query(`SELECT * FROM prds WHERE id = '${id}'`);
  return rows.length > 0 ? deserializePrd(rows[0]) : null;
}

export async function listPrds(limit = 50): Promise<PrdRecord[]> {
  await ensureSchema();
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const rows = await query(`SELECT * FROM prds ORDER BY updated_at DESC LIMIT ${safeLimit}`);
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
  cost_estimate: any;
  run_id: string;
}>): Promise<PrdRecord | null> {
  await ensureSchema();
  validateId(id, 'prdId');

  const jsonFields = ['urls', 'analysis', 'research', 'chat_history', 'score_details', 'mockup_screens', 'cost_estimate'];
  const sets: string[] = [];

  for (const [key, val] of Object.entries(updates)) {
    if (val === undefined) continue;
    const serialized = jsonFields.includes(key) ? JSON.stringify(val) : String(val);
    sets.push(`${key} = '${escapeStr(serialized)}'`);
  }

  if (sets.length === 0) return getPrd(id);

  sets.push("updated_at = datetime('now')");
  await exec(`UPDATE prds SET ${sets.join(', ')} WHERE id = '${id}'`);
  return getPrd(id);
}

export async function deletePrd(id: string): Promise<boolean> {
  await ensureSchema();
  validateId(id, 'prdId');
  await exec(`DELETE FROM prds WHERE id = '${id}'`);
  return true;
}

export async function listTemplates(): Promise<any[]> {
  await ensureSchema();
  return query('SELECT * FROM prd_templates ORDER BY name');
}

export async function getTemplate(id: string): Promise<any> {
  await ensureSchema();
  validateId(id, 'templateId');
  const rows = await query(`SELECT * FROM prd_templates WHERE id = '${id}'`);
  return rows[0] || null;
}
