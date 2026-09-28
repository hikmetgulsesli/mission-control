/**
 * PRD Database Service — PostgreSQL
 * Replaces the old SQLite CLI-based implementation.
 */
import { randomUUID } from 'crypto';
import sql from '../utils/pg.js';

// ── Schema ──────────────────────────────────────────────────────────

let schemaInitialized = false;
const restrictedPrdMode = process.env.MC_TASK6A_RESTRICTED_PRD_READS_VERIFY_V1;
let restrictedPrdReady: Promise<void> | null = null;

/** Private Task6A read-only rehearsal only; the live launcher does not select this mode. */
async function verifyRestrictedPrdReads(): Promise<void> {
  try {
    await sql.begin(async (transaction) => {
      const tx = transaction as unknown as typeof sql;
      await tx`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY`;
      await tx`SET LOCAL lock_timeout = '2s'`;
      await tx`SET LOCAL statement_timeout = '5s'`;
      const expected: ReadonlyArray<Readonly<{
        relation: string; primaryIndex: string;
        columns: ReadonlyArray<readonly [string, string, boolean, string | null]>;
      }>> = [
        { relation: 'public.prds', primaryIndex: 'prds_pkey', columns: [
          ['id', 'text', true, null], ['title', 'text', true, null],
          ['platform', 'text', false, "'web'::text"], ['urls', 'text', false, null],
          ['description', 'text', false, null], ['analysis', 'text', false, null],
          ['research', 'text', false, null], ['chat_history', 'text', false, null],
          ['prd_content', 'text', false, null], ['prd_version', 'integer', false, '1'],
          ['score', 'integer', false, null], ['score_details', 'text', false, null],
          ['mockup_screens', 'text', false, null], ['pages', 'text', false, null],
          ['cost_estimate', 'text', false, null], ['run_id', 'text', false, null],
          ['template_id', 'text', false, null], ['stitch_project_id', 'text', false, null],
          ['created_at', 'timestamp with time zone', false, 'now()'],
          ['updated_at', 'timestamp with time zone', false, 'now()'],
        ] },
        { relation: 'public.prd_templates', primaryIndex: 'prd_templates_pkey', columns: [
          ['id', 'text', true, null], ['name', 'text', true, null],
          ['category', 'text', false, null], ['platform', 'text', false, "'web'::text"],
          ['prd_content', 'text', false, null], ['description', 'text', false, null],
          ['created_at', 'timestamp with time zone', false, 'now()'],
        ] },
      ];
      for (const table of expected) {
        const role = await tx<Array<{ sessionLogin: string; login: string;
          canLogin: boolean; inherits: boolean; memberships: number;
          superuser: boolean; bypassRls: boolean; createRole: boolean;
          createDatabase: boolean; databaseCreate: boolean; schemaCreate: boolean;
          ownerMember: boolean; canSelect: boolean; extraTable: boolean;
          extraColumn: boolean; relationKind: string; persistence: string;
          rowSecurity: boolean; forceRowSecurity: boolean; isPartition: boolean;
          hasAncestors: boolean; hasDescendants: boolean }>>`
          SELECT session_user AS "sessionLogin", current_user AS login,
            r.rolcanlogin AS "canLogin", r.rolinherit AS inherits,
            (SELECT COUNT(*)::integer FROM pg_catalog.pg_auth_members m
              WHERE m.member = r.oid) AS memberships,
            r.rolsuper AS superuser, r.rolbypassrls AS "bypassRls",
            r.rolcreaterole AS "createRole", r.rolcreatedb AS "createDatabase",
            has_database_privilege(current_user, current_database(), 'CREATE') AS "databaseCreate",
            has_schema_privilege(current_user, 'public', 'CREATE') AS "schemaCreate",
            pg_catalog.pg_has_role(current_user, c.relowner, 'MEMBER') AS "ownerMember",
            has_table_privilege(current_user, c.oid, 'SELECT') AS "canSelect",
            has_table_privilege(current_user, c.oid,
              'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN') AS "extraTable",
            has_any_column_privilege(current_user, c.oid,
              'INSERT, UPDATE, REFERENCES') AS "extraColumn",
            c.relkind AS "relationKind", c.relpersistence AS persistence,
            c.relrowsecurity AS "rowSecurity", c.relforcerowsecurity AS "forceRowSecurity",
            c.relispartition AS "isPartition",
            EXISTS (SELECT 1 FROM pg_catalog.pg_inherits i WHERE i.inhrelid = c.oid)
              AS "hasAncestors",
            EXISTS (SELECT 1 FROM pg_catalog.pg_inherits i WHERE i.inhparent = c.oid)
              AS "hasDescendants"
          FROM pg_catalog.pg_roles r
          JOIN pg_catalog.pg_class c ON c.oid = pg_catalog.to_regclass(${table.relation})
          WHERE r.rolname = current_user`;
        const actual = role[0];
        if (role.length !== 1 || !actual || actual.sessionLogin !== actual.login
          || !actual.canLogin || actual.inherits || actual.memberships !== 0
          || actual.superuser || actual.bypassRls || actual.createRole
          || actual.createDatabase || actual.databaseCreate || actual.schemaCreate
          || actual.ownerMember || !actual.canSelect || actual.extraTable
          || actual.extraColumn || actual.relationKind !== 'r'
          || actual.persistence !== 'p' || actual.rowSecurity || actual.forceRowSecurity
          || actual.isPartition || actual.hasAncestors || actual.hasDescendants) {
          throw new Error('MC_TASK6A_RESTRICTED_PRD_ROLE_INVALID');
        }
        const effects = await tx<Array<{ triggers: boolean; rules: boolean;
          otherConstraints: boolean }>>`
          SELECT
            EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t
              WHERE t.tgrelid = pg_catalog.to_regclass(${table.relation})) AS triggers,
            EXISTS (SELECT 1 FROM pg_catalog.pg_rewrite w
              WHERE w.ev_class = pg_catalog.to_regclass(${table.relation})) AS rules,
            EXISTS (SELECT 1 FROM pg_catalog.pg_constraint k
              WHERE (k.conrelid = pg_catalog.to_regclass(${table.relation}) AND k.contype != 'p')
                OR (k.confrelid = pg_catalog.to_regclass(${table.relation}) AND k.contype = 'f'))
              AS "otherConstraints"`;
        if (effects.length !== 1 || effects[0].triggers || effects[0].rules
          || effects[0].otherConstraints) throw new Error('MC_TASK6A_RESTRICTED_PRD_EFFECTS_INVALID');
        const columns = await tx<Array<{ name: string; type: string;
          notNull: boolean; defaultValue: string | null;
          generated: string; identity: string }>>`
          SELECT a.attname AS name, a.atttypid::regtype::text AS type,
            a.attnotnull AS "notNull", a.attgenerated AS generated,
            a.attidentity AS identity,
            pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS "defaultValue"
          FROM pg_catalog.pg_attribute a
          LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
          WHERE a.attrelid = pg_catalog.to_regclass(${table.relation})
            AND a.attnum > 0 AND NOT a.attisdropped
          ORDER BY a.attnum`;
        if (columns.some((column) => column.generated !== '' || column.identity !== '')
          || JSON.stringify(columns.map((column) => [column.name, column.type,
            column.notNull, column.defaultValue])) !== JSON.stringify(table.columns)) {
          throw new Error('MC_TASK6A_RESTRICTED_PRD_COLUMNS_INVALID');
        }
        const indexes = await tx<Array<{ name: string; key: string;
          valid: boolean; ready: boolean; unique: boolean; primary: boolean;
          accessMethod: string; predicate: string | null; expression: string | null;
          keyCount: number; totalCount: number }>>`
          SELECT ic.relname AS name, pg_catalog.pg_get_indexdef(i.indexrelid, 1, true) AS key,
            i.indisvalid AS valid, i.indisready AS ready, i.indisunique AS unique,
            i.indisprimary AS primary, am.amname AS "accessMethod",
            pg_catalog.pg_get_expr(i.indpred, i.indrelid) AS predicate,
            pg_catalog.pg_get_expr(i.indexprs, i.indrelid) AS expression,
            i.indnkeyatts AS "keyCount", i.indnatts AS "totalCount"
          FROM pg_catalog.pg_index i
          JOIN pg_catalog.pg_class ic ON ic.oid = i.indexrelid
          JOIN pg_catalog.pg_am am ON am.oid = ic.relam
          WHERE i.indrelid = pg_catalog.to_regclass(${table.relation})`;
        const primary = indexes[0];
        if (indexes.length !== 1 || !primary || primary.name !== table.primaryIndex
          || primary.key !== 'id' || !primary.valid || !primary.ready
          || !primary.unique || !primary.primary || primary.accessMethod !== 'btree'
          || primary.predicate !== null || primary.expression !== null
          || primary.keyCount !== 1 || primary.totalCount !== 1) {
          throw new Error('MC_TASK6A_RESTRICTED_PRD_INDEX_INVALID');
        }
      }
      const templates = await tx<Array<{ count: number }>>`
        SELECT COUNT(*)::integer AS count FROM public.prd_templates`;
      if (templates.length !== 1 || templates[0].count < 1) {
        throw new Error('MC_TASK6A_RESTRICTED_PRD_TEMPLATES_EMPTY');
      }
    });
  } catch {
    throw new Error('MC_TASK6A_RESTRICTED_PRD_VERIFY_REFUSED');
  }
}

async function ensureSchema(): Promise<void> {
  if (restrictedPrdMode !== undefined) {
    if (restrictedPrdMode !== '1') throw new Error('MC_TASK6A_RESTRICTED_PRD_VERIFY_REFUSED');
    if (!restrictedPrdReady) restrictedPrdReady = verifyRestrictedPrdReads();
    return restrictedPrdReady;
  }
  if (schemaInitialized) return;

  await sql`
    CREATE TABLE IF NOT EXISTS public.prds (
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
    CREATE TABLE IF NOT EXISTS public.prd_templates (
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
  const [{ count }] = await sql`SELECT COUNT(*)::int as count FROM public.prd_templates`;
  if (count === 0) {
    await seedTemplates();
  }

  schemaInitialized = true;
}

async function seedTemplates(): Promise<void> {
  const { TEMPLATE_CONTENTS } = await import('./prd-templates.js');
  const templates = [
    { id: 'tpl-ecommerce', name: 'E-Commerce', category: 'ecommerce', platform: 'web', description: 'Full e-commerce site with product discovery, cart, checkout, and account flows' },
    { id: 'tpl-portfolio', name: 'Portfolio', category: 'portfolio', platform: 'web', description: 'Personal portfolio with projects, about, experience, and contact sections' },
    { id: 'tpl-saas', name: 'SaaS Landing', category: 'saas', platform: 'web', description: 'SaaS landing page with hero, features, pricing, testimonials, and CTA' },
    { id: 'tpl-blog', name: 'Blog', category: 'blog', platform: 'web', description: 'Blog site with article list, article details, categories, and search' },
    { id: 'tpl-dashboard', name: 'Dashboard', category: 'dashboard', platform: 'web', description: 'Analytics dashboard with charts, tables, metrics, filters, and reports' },
    { id: 'tpl-admin', name: 'Admin Panel', category: 'admin', platform: 'web', description: 'CRUD admin panel with users, content management, and settings' },
    { id: 'tpl-mobile', name: 'Mobile App', category: 'mobile', platform: 'mobile', description: 'React Native mobile app with tab navigation, lists, details, and profile' },
    { id: 'tpl-game', name: 'Game', category: 'game', platform: 'web', description: 'Canvas/WebGL game with menu, gameplay screen, settings, and score state' },
    { id: 'tpl-docs', name: 'Documentation', category: 'docs', platform: 'web', description: 'Documentation site with sidebar navigation, Markdown rendering, and search' },
  ];

  for (const t of templates) {
    const content = TEMPLATE_CONTENTS[t.id] || '';
    await sql`
      INSERT INTO public.prd_templates (id, name, category, platform, description, prd_content)
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
    INSERT INTO public.prds (id, title, platform, urls, description, template_id)
    VALUES (${id}, ${data.title}, ${data.platform || 'web'}, ${urls}, ${data.description || ''}, ${data.template_id || ''})
  `;
  return (await getPrd(id))!;
}

export async function getPrd(id: string): Promise<PrdRecord | null> {
  await ensureSchema();
  const rows = await sql`SELECT * FROM public.prds WHERE id = ${id}`;
  return rows.length > 0 ? deserializePrd(rows[0]) : null;
}

export async function listPrds(limit = 50): Promise<PrdRecord[]> {
  await ensureSchema();
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const rows = await sql`SELECT * FROM public.prds ORDER BY updated_at DESC LIMIT ${safeLimit}`;
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
  await sql.unsafe(`UPDATE public.prds SET ${sets.join(', ')} WHERE id = $${paramIdx}`, vals);
  return getPrd(id);
}

export async function deletePrd(id: string): Promise<boolean> {
  await ensureSchema();
  await sql`DELETE FROM public.prds WHERE id = ${id}`;
  return true;
}

// ── Templates ───────────────────────────────────────────────────────

export async function listTemplates(): Promise<any[]> {
  await ensureSchema();
  return sql`SELECT * FROM public.prd_templates ORDER BY name`;
}

export async function getTemplate(id: string): Promise<any> {
  await ensureSchema();
  const rows = await sql`SELECT * FROM public.prd_templates WHERE id = ${id}`;
  return rows[0] || null;
}
