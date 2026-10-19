// Private, Source-bound Task4 lifecycle. Importing this module performs no effects.
import { createHash, randomUUID, randomBytes } from 'node:crypto';
import path from 'node:path';
import { tmpdir } from 'node:os';
import fs from 'node:fs';
import { spawnSync, spawn } from 'node:child_process';
import { createServer as createHttpServer, request as requestHttp } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { task4SeedV1, task4GrantsV1, task4OperationalSnapshotV1, task4OperationalModelV1 } from '../tests/fixtures/render-smoke-product-authority.mjs';
export { task4SeedV1, task4GrantsV1 };

const fail = (code = 'TASK4_SHAPE_INVALID') => { throw new Error(code); };
const requireValue = (value, code) => { if (!value) fail(code); };
const hash = value => createHash('sha256').update(value).digest('hex');
const freeze = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
};
export function task4CanonicalV1(value) {
    const visit = (v, depth) => {
        requireValue(depth <= 16);
        if (v === null || typeof v === 'boolean') return v;
        if (typeof v === 'number') { requireValue(Number.isSafeInteger(v)); return v; }
        if (typeof v === 'string') {
            requireValue(Buffer.byteLength(v) <= 16384 && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v));
            return v;
        }
        if (Array.isArray(v)) {
            requireValue(v.length <= 4096 && Object.keys(v).length === v.length);
            return v.map(child => visit(child, depth + 1));
        }
        requireValue(v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype);
        const keys = Object.keys(v).sort();
        requireValue(keys.length <= 32 && keys.every(key => /^[\x20-\x7e]+$/.test(key)));
        const output = {};
        for (const key of keys) {
            const descriptor = Object.getOwnPropertyDescriptor(v, key);
            requireValue(key !== '__proto__' && descriptor && Object.hasOwn(descriptor, 'value'));
            output[key] = visit(descriptor.value, depth + 1);
        }
        return output;
    };
    const result = JSON.stringify(visit(value, 0));
    requireValue(Buffer.byteLength(result) <= 1048576);
    return result;
}
const keys = (value, expected) => requireValue(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('|') === expected.split(' ').sort().join('|'));
const hex = (value, length = 64) => requireValue(typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(value));
const integer = (value, min = 1, max = 2147483647) => requireValue(Number.isSafeInteger(value) && value >= min && value <= max);
const absolutePath = value => requireValue(typeof value === 'string' && Buffer.byteLength(value) <= 1024
    && path.isAbsolute(value) && path.normalize(value) === value && !/[\u0000-\u001f\u007f]/.test(value)
    && !value.endsWith('/') && value.split('/').slice(1).every(part => part && part !== '.' && part !== '..'));
const date = (value, micros = false) => {
    requireValue(typeof value === 'string' && (micros ? /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/ : /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/).test(value));
    const millis = micros ? value.slice(0, 23) + 'Z' : value;
    requireValue(Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === millis);
};
function directory(value, privateMode = false) {
    keys(value, 'path uid dev ino mode'); absolutePath(value.path); integer(value.uid); integer(value.mode, 0, 511);
    for (const field of [value.dev, value.ino]) requireValue(typeof field === 'string' && /^[1-9][0-9]{0,19}$/.test(field));
    requireValue((value.mode & 0o022) === 0 && (!privateMode || value.mode === 0o700));
}
function processPin(value) {
    keys(value, 'pid ppid pgid uid startedAt executable executableHash commandHash');
    for (const field of ['pid', 'ppid', 'pgid', 'uid']) integer(value[field]);
    date(value.startedAt); absolutePath(value.executable); hex(value.executableHash); hex(value.commandHash);
}
function sourceSf(value) {
    keys(value, 'root sourceSha treeHash inputManifestHash'); absolutePath(value.root);
    hex(value.sourceSha, 40); hex(value.treeHash, 40); hex(value.inputManifestHash);
}
function sourceMc(value) {
    keys(value, 'root sourceSha treeHash buildIdentityHash buildHash harness'); absolutePath(value.root);
    hex(value.sourceSha, 40); hex(value.treeHash, 40); hex(value.buildIdentityHash); hex(value.buildHash);
    keys(value.harness, 'renderSmokeHash ownedFixtureHash productAuthorityFixtureHash'); Object.values(value.harness).forEach(value => hex(value));
}
function setup(value) {
    keys(value, 'schema executionId owner resourceRoot setfarm missionControl postgres');
    requireValue(value.schema === 'setfarm.mc-render-smoke-setup.v1'); hex(value.executionId, 32);
    processPin(value.owner); directory(value.resourceRoot, true);
    requireValue(path.basename(value.resourceRoot.path) === `task4-${value.executionId}`, 'TASK4_BINDING_REFUSED');
    keys(value.setfarm, 'source rootPin runnerHash fixtureHash migrationHash'); sourceSf(value.setfarm.source); directory(value.setfarm.rootPin);
    for (const key of ['runnerHash', 'fixtureHash', 'migrationHash']) hex(value.setfarm[key]);
    keys(value.missionControl, 'source rootPin'); sourceMc(value.missionControl.source); directory(value.missionControl.rootPin);
    requireValue(value.setfarm.source.root === value.setfarm.rootPin.path && value.missionControl.source.root === value.missionControl.rootPin.path, 'TASK4_BINDING_REFUSED');
    const pg = value.postgres;
    keys(pg, 'host port major versionNum process data socket serverStartedAt adminUrlHash');
    requireValue(pg.host === '127.0.0.1' && pg.major === 17 && pg.versionNum === 170010);
    integer(pg.port, 1024, 65535); requireValue(![3080, 3333, 5432, 13081, 18789].includes(pg.port));
    processPin(pg.process); directory(pg.data, true); directory(pg.socket, true); date(pg.serverStartedAt, true); hex(pg.adminUrlHash);
    requireValue(pg.process.ppid === value.owner.pid && pg.process.uid === value.owner.uid && value.resourceRoot.uid === value.owner.uid
        && pg.data.path === path.join(value.resourceRoot.path, 'postgres-data') && pg.socket.path === path.join(value.resourceRoot.path, 'postgres-socket')
        && pg.data.uid === value.owner.uid && pg.socket.uid === value.owner.uid
        && pg.process.executable === path.join(TASK4_PG_BIN, 'postgres')
        && pg.process.executableHash === '38c50336c63ae8b73b799a8c0ebc4f948e311eee882a633c8286d1ca4110b502', 'TASK4_BINDING_REFUSED');
}
function ready(value) {
    keys(value, 'schema executionId setup setupDescriptorHash fixtureOwner projection database fixture');
    requireValue(value.schema === 'mission-control.render-smoke-fixture-ready.v1'); hex(value.executionId, 32); setup(value.setup);
    hex(value.setupDescriptorHash); processPin(value.fixtureOwner);
    requireValue(value.executionId === value.setup.executionId && value.setupDescriptorHash === hash(task4CanonicalV1(value.setup) + '\n'), 'TASK4_BINDING_REFUSED');
    const projection = value.projection;
    keys(projection, 'root projectedHead inputManifestHash projectedManifestHash markerHash runDatabasePrefix');
    directory(projection.root, true); hex(projection.projectedHead, 40);
    for (const key of ['inputManifestHash', 'projectedManifestHash', 'markerHash']) hex(projection[key]);
    requireValue(typeof projection.runDatabasePrefix === 'string' && /^setfarm_p3_[a-f0-9]{24}$/.test(projection.runDatabasePrefix));
    const relative = path.relative(path.join(value.setup.resourceRoot.path, 'tmp'), projection.root.path);
    requireValue(/^setfarm-p3-projection-[A-Za-z0-9_-]+\/setfarm$/.test(relative)
        && projection.inputManifestHash === value.setup.setfarm.source.inputManifestHash
        && value.fixtureOwner.uid === value.setup.owner.uid && projection.root.uid === value.setup.owner.uid, 'TASK4_BINDING_REFUSED');
    const db = value.database;
    keys(db, 'name role restrictedUrl restrictedUrlHash'); hex(db.restrictedUrlHash);
    requireValue(typeof db.name === 'string' && new RegExp(`^${projection.runDatabasePrefix}_clone_[a-f0-9]{12}$`).test(db.name)
        && db.role === `mc_task4_${value.executionId}`, 'TASK4_BINDING_REFUSED');
    let url;
    try { url = new URL(db.restrictedUrl); } catch { fail('TASK4_BINDING_REFUSED'); }
    requireValue(url.toString() === db.restrictedUrl && url.protocol === 'postgres:' && url.hostname === '127.0.0.1'
        && url.port === String(value.setup.postgres.port) && url.pathname === '/' + db.name && !url.search && !url.hash
        && decodeURIComponent(url.username) === db.role && url.password.length > 0 && db.restrictedUrlHash === hash(db.restrictedUrl), 'TASK4_BINDING_REFUSED');
    keys(value.fixture, 'seedDigest privilegeDigest readinessDigest admissionReadyHash manifestActivationHash manifestHeadHash');
    Object.values(value.fixture).forEach(value => hex(value));
}
export function parseTask4FrameV1(bytes, kind) {
    requireValue(bytes instanceof Uint8Array, 'TASK4_FRAME_INVALID');
    requireValue(bytes.byteLength <= 16384, 'TASK4_FRAME_TOO_LARGE');
    let value;
    try {
        const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
        value = JSON.parse(text);
        requireValue(text === task4CanonicalV1(value) + '\n');
    } catch { fail('TASK4_FRAME_INVALID'); }
    const cap = (v, depth = 0) => {
        requireValue(depth <= 12);
        if (typeof v === 'string') requireValue(Buffer.byteLength(v) <= 2048);
        if (v && typeof v === 'object') {
            requireValue(Array.isArray(v) ? v.length <= 8 : Object.keys(v).length <= 16);
            Object.values(v).forEach(child => cap(child, depth + 1));
        }
    };
    cap(value);
    if (kind === 'launch') {
        keys(value, 'schema setfarm missionControl'); requireValue(value.schema === 'mission-control.render-smoke-launch.v1');
        sourceSf(value.setfarm); sourceMc(value.missionControl);
    } else if (kind === 'setup') setup(value);
    else if (kind === 'ready') ready(value);
    else fail();
    return freeze(value);
}
export function validateTask4SeedV1(value, sourceSha) {
    requireValue(task4CanonicalV1(value) === task4CanonicalV1(task4SeedV1(sourceSha)), 'TASK4_DATABASE_REFUSED');
}
export function validateTask4GrantsV1(value, database, role) {
    requireValue(task4CanonicalV1(value) === task4CanonicalV1(task4GrantsV1(database, role)), 'TASK4_DATABASE_REFUSED');
}

// The production caller supplies only its original fd4 ReadStream; this private
// stream seam lets component tests exercise completion without opening a process.
export function readTask4FrameV1(stream, kind) {
    return new Promise((resolve, reject) => {
        let ended = false, length = 0, failure = null;
        const chunks = [];
        const stop = code => { failure ??= code; stream.destroy(); };
        const timer = setTimeout(() => { stop('TASK4_FRAME_TIMEOUT'); reject(new Error('TASK4_FRAME_TIMEOUT')); }, 5000);
        stream.on('data', chunk => {
            if (failure || ended) return;
            if (!(chunk instanceof Uint8Array)) return stop('TASK4_FRAME_INVALID');
            length += chunk.length;
            if (length > 16384) return stop('TASK4_FRAME_TOO_LARGE');
            chunks.push(Buffer.from(chunk));
        });
        stream.once('end', () => { ended = true; stream.destroy(); });
        stream.on('error', () => stop('TASK4_FRAME_UNAVAILABLE'));
        stream.once('close', () => {
            clearTimeout(timer);
            if (failure || !ended) return reject(new Error(failure ?? 'TASK4_FRAME_UNAVAILABLE'));
            try { resolve(parseTask4FrameV1(Buffer.concat(chunks), kind)); }
            catch (error) { reject(error); }
        });
    });
}

export async function extractTask4AuxiliaryV1(source) {
    const refuse = () => fail('TASK4_AUXILIARY_SOURCE_REFUSED');
    try {
        requireValue(typeof source === 'string' && Buffer.byteLength(source) <= 131072);
        const ts = await import('typescript');
        const tree = ts.createSourceFile('fixed-auxiliary.ts', source, ts.ScriptTarget.Latest, true);
        requireValue(tree.parseDiagnostics.length === 0);
        const literal = node => {
            if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
            if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
            if (ts.isObjectLiteralExpression(node)) {
                const value = {};
                for (const property of node.properties) {
                    if (!ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.name)
                        || property.name.text === '__proto__' || Object.hasOwn(value, property.name.text)) return refuse();
                    value[property.name.text] = literal(property.initializer);
                }
                return value;
            }
            if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
                && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'Object'
                && node.expression.name.text === 'freeze' && node.arguments.length === 1
                && (ts.isArrayLiteralExpression(node.arguments[0]) || ts.isObjectLiteralExpression(node.arguments[0]))) return literal(node.arguments[0]);
            return refuse();
        };
        const get = name => {
            const found = tree.statements.flatMap(statement => ts.isVariableStatement(statement)
                ? statement.declarationList.declarations.filter(item => ts.isIdentifier(item.name) && item.name.text === name)
                    .map(item => ({ statement, item })) : []);
            if (found.length !== 1) return refuse();
            const { statement, item } = found[0];
            if (!(statement.declarationList.flags & ts.NodeFlags.Const) || !item.initializer || !ts.isCallExpression(item.initializer)) return refuse();
            return literal(item.initializer);
        };
        const tables = get('TABLES'), statements = get('SCHEMA_STATEMENTS');
        const contents = get('TEMPLATE_CONTENTS'), seeds = get('TEMPLATE_SEEDS');
        requireValue(task4CanonicalV1(tables) === task4CanonicalV1(['tasks', 'prds', 'prd_templates', 'agent_feed', 'live_events'])
            && Array.isArray(statements) && statements.length === 12 && statements.every(value => typeof value === 'string'));
        requireValue(hash(task4CanonicalV1(statements)) === '8d92f68a499be0da73ae8061acdf1a217fdfc7af138edcc9b9645abce83fbce0');
        requireValue(Array.isArray(seeds) && seeds.length === 9 && Object.keys(contents).length === 9);
        const templates = seeds.map(row => {
            keys(row, 'id name category platform description');
            requireValue(Object.values(row).every(value => typeof value === 'string') && typeof contents[row.id] === 'string');
            return { ...row, prd_content: contents[row.id], created_at: '2026-10-19T00:00:00.000Z' };
        }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
        requireValue(task4CanonicalV1(templates) === task4CanonicalV1(task4SeedV1('1'.repeat(40)).templateRows));
        return freeze({ tables, statements, templates });
    } catch { return refuse(); }
}

const SEED_EXAMPLE = task4SeedV1('1'.repeat(40));
const seedTables = ['runs', 'v3_release_admissions', 'prd_templates', ...SEED_EXAMPLE.emptyRelations.map(row => row.name)].sort();
const ordinarySchemas = "n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_'";
const tablePrivileges = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'];
const columnPrivileges = ['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'];
const privilegesSql = (fn, oid, names) => names.map(name => `${fn}(current_user,${oid},'${name}') AS "${name}"`).join(',');
const rowReadSql = (name, sample, order) => {
    const columns = Object.keys(sample).sort();
    const times = columns.filter(name => ['created_at', 'updated_at', 'expires_at'].includes(name));
    const fields = columns.map(name => `'${name}',${times.includes(name) ? `CASE WHEN "${name}" IS NULL THEN NULL ELSE to_char("${name}" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END` : `"${name}"`}`).join(',');
    return `SELECT jsonb_build_object(${fields}) AS row,(${times.map(name => `("${name}" IS NULL OR "${name}"=date_trunc('milliseconds',"${name}"))`).join(' AND ')}) AS precision_ok FROM public."${name}" ORDER BY "${order}" COLLATE "C" LIMIT 4097`;
};
const SQL_RECIPES = freeze([
    ['begin', 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'],
    ['statement_timeout', "SET LOCAL statement_timeout = '5s'"],
    ['identity', `SELECT current_database()::text AS database,current_user::text AS "currentUser",session_user::text AS "sessionUser",host(inet_server_addr()) AS host,inet_server_port() AS port,current_setting('server_version_num')::int AS "serverVersionNum",to_char(pg_postmaster_start_time() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "serverStartedAt",pg_backend_pid() AS "backendPid",to_char(a.backend_start AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "backendStartedAt",current_setting('application_name') AS "applicationName" FROM pg_catalog.pg_stat_activity a WHERE a.pid=pg_backend_pid()`],
    ['settings', `SELECT current_database()::text AS database,current_setting('default_transaction_read_only') AS "defaultTransactionReadOnly",current_setting('lo_compat_privileges')::boolean AS "loCompatPrivileges",pg_is_in_recovery() AS recovery LIMIT 4097`],
    ['current_pair', `SELECT (SELECT jsonb_agg(to_jsonb(t)) FROM (SELECT singleton_key,current_revision::text AS revision,phase,activation_ref,activation_hash,head_ref,head_hash FROM public.internal_production_owner_producer_manifest_set_current_v1 LIMIT 2) t) AS current,(SELECT jsonb_agg(to_jsonb(t)) FROM (SELECT * FROM public.internal_production_owner_producer_manifest_set_activations_v1 LIMIT 2) t) AS activations,(SELECT jsonb_agg(to_jsonb(t)) FROM (SELECT * FROM public.internal_production_owner_producer_manifest_activation_heads_v1 LIMIT 2) t) AS heads`],
    ['optional_step_metrics', "SELECT to_regclass('public.step_metrics')::text AS relation"],
    ['seed_catalog', `SELECT c.relname AS name,c.relkind AS kind,c.relrowsecurity AS rls,c.relforcerowsecurity AS "forceRls",jsonb_agg(jsonb_build_object('name',a.attname,'type',t.typname) ORDER BY a.attname COLLATE "C") AS columns FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped JOIN pg_catalog.pg_type t ON t.oid=a.atttypid WHERE n.nspname='public' AND c.relname IN (${seedTables.map(name => `'${name}'`).join(',')}) GROUP BY c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity ORDER BY c.relname COLLATE "C" LIMIT 4097`],
    ['seed_runs', rowReadSql('runs', SEED_EXAMPLE.runs[0], 'id')],
    ['seed_admissions', rowReadSql('v3_release_admissions', SEED_EXAMPLE.releaseAdmissions[0], 'admission_hash')],
    ['seed_templates', rowReadSql('prd_templates', SEED_EXAMPLE.templateRows[0], 'id')],
    ...SEED_EXAMPLE.emptyRelations.map(row => ['empty_' + row.name, `SELECT to_jsonb(t) AS row FROM public."${row.name}" t ORDER BY to_jsonb(t)::text COLLATE "C" LIMIT 4097`]),
    ['role', `SELECT rolname AS name,current_user::text AS "currentUser",session_user::text AS "sessionUser",rolcanlogin AS "canLogin",rolsuper AS superuser,rolcreatedb AS "createDatabase",rolcreaterole AS "createRole",rolinherit AS inherit,rolreplication AS replication,rolbypassrls AS "bypassRls" FROM pg_catalog.pg_roles WHERE rolname=current_user LIMIT 4097`],
    ['memberships', `SELECT parent.rolname AS role,m.admin_option AS "adminOption",m.inherit_option AS "inheritOption",m.set_option AS "setOption" FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles member ON member.oid=m.member JOIN pg_catalog.pg_roles parent ON parent.oid=m.roleid WHERE member.rolname=current_user ORDER BY parent.rolname COLLATE "C" LIMIT 4097`],
    ['owned', `SELECT * FROM (
SELECT 'database'::text AS kind,''::text AS schema,d.datname AS name,d.datname::text AS identity FROM pg_catalog.pg_database d JOIN pg_catalog.pg_roles r ON r.oid=d.datdba WHERE r.rolname=current_user
UNION ALL SELECT 'schema',n.nspname,n.nspname,n.nspname::text FROM pg_catalog.pg_namespace n JOIN pg_catalog.pg_roles r ON r.oid=n.nspowner WHERE r.rolname=current_user
UNION ALL SELECT 'relation',n.nspname,c.relname,n.nspname||'.'||c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_roles r ON r.oid=c.relowner WHERE r.rolname=current_user
UNION ALL SELECT 'routine',n.nspname,p.proname,n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_roles r ON r.oid=p.proowner WHERE r.rolname=current_user
UNION ALL SELECT 'type',n.nspname,t.typname,n.nspname||'.'||t.typname FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace JOIN pg_catalog.pg_roles r ON r.oid=t.typowner WHERE r.rolname=current_user
) owned ORDER BY kind COLLATE "C",schema COLLATE "C",name COLLATE "C",identity COLLATE "C" LIMIT 4097`],
    ['databases', `SELECT datname AS name,${privilegesSql('has_database_privilege', 'oid', ['CONNECT', 'CREATE', 'TEMPORARY'])} FROM pg_catalog.pg_database ORDER BY datname COLLATE "C" LIMIT 4097`],
    ['schemas', `SELECT n.nspname AS name,${privilegesSql('has_schema_privilege', 'n.oid', ['USAGE', 'CREATE'])} FROM pg_catalog.pg_namespace n WHERE ${ordinarySchemas} ORDER BY n.nspname COLLATE "C" LIMIT 4097`],
    ['relations', `SELECT n.nspname AS schema,c.relname AS name,c.relkind AS kind,${privilegesSql('has_table_privilege', 'c.oid', tablePrivileges)} FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE ${ordinarySchemas} AND c.relkind IN ('r','p','v','m','f') ORDER BY n.nspname COLLATE "C",c.relname COLLATE "C",c.relkind LIMIT 4097`],
    ['columns', `SELECT n.nspname AS schema,c.relname AS relation,a.attname AS column,${columnPrivileges.map(name => `has_column_privilege(current_user,c.oid,a.attnum,'${name}') AS "${name}",has_table_privilege(current_user,c.oid,'${name}') AS "table${name}"`).join(',')} FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid WHERE ${ordinarySchemas} AND c.relkind IN ('r','p','v','m','f') AND a.attnum>0 AND NOT a.attisdropped ORDER BY n.nspname COLLATE "C",c.relname COLLATE "C",a.attname COLLATE "C" LIMIT 65537`],
    ['sequences', `SELECT n.nspname AS schema,c.relname AS name,${privilegesSql('has_sequence_privilege', 'c.oid', ['USAGE', 'SELECT', 'UPDATE'])} FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE ${ordinarySchemas} AND c.relkind='S' ORDER BY n.nspname COLLATE "C",c.relname COLLATE "C" LIMIT 4097`],
    ['routines', `SELECT n.nspname AS schema,p.proname AS name,pg_get_function_identity_arguments(p.oid) AS identity,p.prokind AS kind,p.prosecdef AS "securityDefiner",has_function_privilege(current_user,p.oid,'EXECUTE') AS "EXECUTE" FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE ${ordinarySchemas} ORDER BY n.nspname COLLATE "C",p.proname COLLATE "C",pg_get_function_identity_arguments(p.oid) COLLATE "C",p.prokind LIMIT 4097`],
    ['commit', 'COMMIT'],
].map(([queryId, statement]) => ({ queryId, statement, parametersRule: [], requiredPhases: ['before', 'after'] })));
export function task4ObserverSqlRecipesV1() { return SQL_RECIPES; }
const queryRecipe = id => { const recipe = SQL_RECIPES.find(row => row.queryId === id); requireValue(recipe); return recipe; };
async function readRows(sql, id) {
    const rows = await sql.unsafe(queryRecipe(id).statement, []);
    requireValue(Array.isArray(rows) && rows.length <= (id === 'columns' ? 65536 : 4096), 'TASK4_DATABASE_REFUSED');
    return rows;
}
export async function observeTask4SeedV1(sql, sourceSha) {
    const expected = task4SeedV1(sourceSha);
    const samples = { runs: expected.runs[0], v3_release_admissions: expected.releaseAdmissions[0], prd_templates: expected.templateRows[0] };
    const catalog = await readRows(sql, 'seed_catalog');
    requireValue(catalog.length === seedTables.length, 'TASK4_DATABASE_REFUSED');
    for (const [index, row] of catalog.entries()) {
        requireValue(row.name === seedTables[index] && row.kind === 'r' && row.rls === false && row.forceRls === false
            && Array.isArray(row.columns) && row.columns.length > 0, 'TASK4_DATABASE_REFUSED');
        if (samples[row.name]) {
            const columns = Object.keys(samples[row.name]).sort().map(name => ({ name,
                type: ['created_at', 'updated_at', 'expires_at'].includes(name) ? 'timestamptz' : name === 'payload' ? 'jsonb' : ['run_number', 'protocol_version'].includes(name) ? 'int4' : 'text' }));
            requireValue(task4CanonicalV1(row.columns) === task4CanonicalV1(columns), 'TASK4_DATABASE_REFUSED');
        }
    }
    const fullRows = async id => {
        const rows = await readRows(sql, id);
        requireValue(rows.every(row => row.precision_ok === true), 'TASK4_DATABASE_REFUSED');
        return rows.map(row => row.row);
    };
    const runs = await fullRows('seed_runs'), releaseAdmissions = await fullRows('seed_admissions'), templateRows = await fullRows('seed_templates');
    const emptyRelations = [];
    for (const entry of expected.emptyRelations) {
        const rows = await readRows(sql, 'empty_' + entry.name);
        requireValue(rows.length === 0, 'TASK4_DATABASE_REFUSED');
        emptyRelations.push({ schema: 'public', name: entry.name, rows });
    }
    const observed = { schema: expected.schema, sourceSha, runs, releaseAdmissions, templateRows, emptyRelations, productResponse: expected.productResponse };
    validateTask4SeedV1(observed, sourceSha);
    return freeze(observed);
}
function uniqueTuples(rows, fields) {
    const seen = new Set();
    for (const row of rows) {
        for (const key of fields) requireValue(typeof row[key] === 'string' && /^[\x20-\x7e]*$/.test(row[key]) && Buffer.byteLength(row[key]) <= 2048, 'TASK4_DATABASE_REFUSED');
        const tuple = JSON.stringify(fields.map(key => row[key]));
        requireValue(!seen.has(tuple), 'TASK4_DATABASE_REFUSED'); seen.add(tuple);
    }
}
function positiveGrants(rows, fields, names) {
    uniqueTuples(rows, fields);
    const output = [];
    for (const row of rows) for (const name of names) {
        requireValue(typeof row[name] === 'boolean', 'TASK4_DATABASE_REFUSED');
        if (row[name]) output.push({ ...Object.fromEntries(fields.map(key => [key, row[key]])), privilege: name });
    }
    return output.sort((a, b) => { for (const key of [...fields, 'privilege']) { if (a[key] < b[key]) return -1; if (a[key] > b[key]) return 1; } return 0; });
}
export async function observeTask4GrantsV1(sql, database, role) {
    const roleRows = await readRows(sql, 'role'), settingRows = await readRows(sql, 'settings');
    requireValue(roleRows.length === 1 && settingRows.length === 1 && settingRows[0].database === database, 'TASK4_DATABASE_REFUSED');
    const memberships = await readRows(sql, 'memberships'), ownedDataObjects = await readRows(sql, 'owned');
    const databases = await readRows(sql, 'databases'), schemas = await readRows(sql, 'schemas'), relations = await readRows(sql, 'relations');
    const columns = await readRows(sql, 'columns'), sequences = await readRows(sql, 'sequences'), routines = await readRows(sql, 'routines');
    requireValue(relations.every(row => ['r', 'p', 'v', 'm', 'f'].includes(row.kind)), 'TASK4_DATABASE_REFUSED');
    uniqueTuples(columns, ['schema', 'relation', 'column']); uniqueTuples(routines, ['schema', 'name', 'identity', 'kind']);
    const additionalColumnGrants = [];
    for (const row of columns) for (const name of columnPrivileges) {
        requireValue(typeof row[name] === 'boolean' && typeof row['table' + name] === 'boolean', 'TASK4_DATABASE_REFUSED');
        if (row[name] && !row['table' + name]) additionalColumnGrants.push({ schema: row.schema, relation: row.relation, column: row.column, privilege: name });
    }
    const applicationRoutineGrants = [];
    for (const row of routines) {
        requireValue(typeof row.EXECUTE === 'boolean' && typeof row.securityDefiner === 'boolean' && ['f', 'p', 'a', 'w'].includes(row.kind), 'TASK4_DATABASE_REFUSED');
        if (row.EXECUTE) applicationRoutineGrants.push({ schema: row.schema, name: row.name, identity: row.identity, kind: row.kind, securityDefiner: row.securityDefiner });
    }
    const { database: ignored, ...settings } = settingRows[0];
    const observed = { schema: 'mission-control.task4-effective-data-read-grants.v1', database, role: roleRows[0], settings, memberships, ownedDataObjects,
        databaseGrants: positiveGrants(databases, ['name'], ['CONNECT', 'CREATE', 'TEMPORARY']), schemaGrants: positiveGrants(schemas, ['name'], ['USAGE', 'CREATE']),
        relationGrants: positiveGrants(relations, ['schema', 'name', 'kind'], tablePrivileges), additionalColumnGrants,
        sequenceGrants: positiveGrants(sequences, ['schema', 'name'], ['USAGE', 'SELECT', 'UPDATE']), applicationRoutineGrants };
    validateTask4GrantsV1(observed, database, role);
    return freeze(observed);
}

function currentPairFromRows(rows, descriptor) {
    const refuse = () => fail('TASK4_DATABASE_REFUSED');
    try {
        requireValue(rows.length === 1);
        const value = rows[0]; keys(value, 'current activations heads');
        for (const key of ['current', 'activations', 'heads']) requireValue(Array.isArray(value[key]) && value[key].length === 1);
        const current = value.current[0], activationRow = value.activations[0], headRow = value.heads[0];
        keys(current, 'singleton_key revision phase activation_ref activation_hash head_ref head_hash');
        requireValue(current.singleton_key === true && current.revision === '1' && current.phase === 'A');
        const canonicalBody = row => {
            requireValue(typeof row.canonical_body === 'string');
            const body = JSON.parse(row.canonical_body);
            requireValue(task4CanonicalV1(body) === row.canonical_body);
            return body;
        };
        const activation = canonicalBody(activationRow), head = canonicalBody(headRow);
        keys(activation, 'schema phase orderedPlans orderedManifestHashes orderedSourceBuildAuthorities manifestSetHash ownerCategoryRegistryHash ownerCategoryCensusMapHash predecessorActivationRef predecessorActivationHash predecessorHeadRef predecessorHeadHash activationRef activationHash');
        keys(head, 'schema phase activationRef activationHash predecessorHeadRef predecessorHeadHash headRef headHash');
        const { activationRef, activationHash, ...activationCore } = activation;
        const { headRef, headHash, ...headCore } = head;
        hex(activationHash); hex(headHash);
        requireValue(activation.schema === 'setfarm.internal-production-owner-producer-manifest-set-activation.v1' && activation.phase === 'A'
            && head.schema === 'setfarm.internal-production-owner-producer-manifest-set-activation-head.v1' && head.phase === 'A'
            && activationHash === hash(task4CanonicalV1(activationCore)) && headHash === hash(task4CanonicalV1(headCore))
            && activationRef === 'setfarm://internal-production/owner-producer-manifest-set-activation/sha256/' + activationHash
            && headRef === 'setfarm://internal-production/owner-producer-manifest-set-activation-head/sha256/' + headHash
            && head.activationRef === activationRef && head.activationHash === activationHash);
        for (const [raw, field] of [['activation_ref', 'activationRef'], ['activation_hash', 'activationHash'], ['phase', 'phase'], ['manifest_set_hash', 'manifestSetHash'],
            ['owner_category_registry_hash', 'ownerCategoryRegistryHash'], ['owner_category_census_map_hash', 'ownerCategoryCensusMapHash'],
            ['predecessor_activation_ref', 'predecessorActivationRef'], ['predecessor_activation_hash', 'predecessorActivationHash'],
            ['predecessor_head_ref', 'predecessorHeadRef'], ['predecessor_head_hash', 'predecessorHeadHash']]) requireValue(activationRow[raw] === activation[field]);
        for (const [raw, field] of [['head_ref', 'headRef'], ['head_hash', 'headHash'], ['phase', 'phase'], ['activation_ref', 'activationRef'],
            ['activation_hash', 'activationHash'], ['predecessor_head_ref', 'predecessorHeadRef'], ['predecessor_head_hash', 'predecessorHeadHash']]) requireValue(headRow[raw] === head[field]);
        requireValue(current.activation_ref === activationRef && current.activation_hash === activationHash && current.head_ref === headRef && current.head_hash === headHash);
        const admissionReadyHash = hash(JSON.stringify({ activationHash, activationRef, headHash, headRef, schema: 'setfarm.p3-projected-admission-ready.v1' }));
        requireValue(activationHash === descriptor.fixture.manifestActivationHash && headHash === descriptor.fixture.manifestHeadHash
            && admissionReadyHash === descriptor.fixture.admissionReadyHash);
        return freeze({ activationRef, activationHash, headRef, headHash, admissionReadyHash });
    } catch { return refuse(); }
}

// sql is an original reserved connection in production. The private component
// port returns raw query results; it cannot supply qualified booleans or ledgers.
export function createTask4ObserverV1(descriptor, sql) {
    ready(descriptor);
    const descriptorHash = hash(task4CanonicalV1(descriptor) + '\n');
    const records = [], phases = new Map();
    const commands = new Set(['begin', 'statement_timeout', 'commit']);
    let active = false;
    return Object.freeze({
        async observe(phase) {
            requireValue(['before', 'after'].includes(phase) && !phases.has(phase) && !active
                && (phase === 'before' || phases.get('before')?.complete), 'TASK4_DATABASE_REFUSED');
            active = true;
            const state = { complete: false, bound: false, identity: null }; phases.set(phase, state);
            const issued = new Set();
            const port = { unsafe: async (statement, parameters = []) => {
                const recipe = SQL_RECIPES.find(row => row.statement === statement);
                requireValue(recipe && !issued.has(recipe.queryId) && parameters.length === 0 && records.length < 256, 'TASK4_DATABASE_REFUSED');
                issued.add(recipe.queryId);
                const row = { seq: records.length + 1, queryId: recipe.queryId, phase, backendPid: state.identity?.backendPid ?? null,
                    backendStartedAt: state.identity?.backendStartedAt ?? null, applicationName: 'task4_observer_' + descriptor.executionId,
                    startedAt: new Date().toISOString(), finishedAt: null, statementHash: hash(statement), parametersHash: hash(task4CanonicalV1(parameters)),
                    outcome: 'pending', sqlstate: null, rowCount: null, resultHash: null, observation: null };
                records.push(row);
                try {
                    const raw = await sql.unsafe(statement, parameters);
                    requireValue(Array.isArray(raw), 'TASK4_DATABASE_REFUSED');
                    const actual = Array.from(raw);
                    row.finishedAt = new Date().toISOString();
                    if (commands.has(recipe.queryId)) row.outcome = 'command';
                    else {
                        row.rowCount = actual.length; requireValue(row.rowCount <= (recipe.queryId === 'columns' ? 65536 : 4096), 'TASK4_DATABASE_REFUSED');
                        row.resultHash = hash(task4CanonicalV1(actual)); row.outcome = 'rows';
                    }
                    return actual;
                } catch (error) {
                    row.finishedAt = new Date().toISOString(); row.outcome = 'error'; row.rowCount = null; row.resultHash = null;
                    row.sqlstate = typeof error?.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code) ? error.code : null;
                    throw error;
                }
            } };
            try {
                await port.unsafe(queryRecipe('begin').statement, []);
                await port.unsafe(queryRecipe('statement_timeout').statement, []);
                const identityRows = await readRows(port, 'identity');
                requireValue(identityRows.length === 1, 'TASK4_DATABASE_REFUSED');
                const identity = identityRows[0];
                keys(identity, 'database currentUser sessionUser host port serverVersionNum serverStartedAt backendPid backendStartedAt applicationName');
                requireValue(identity.database === descriptor.database.name && identity.currentUser === descriptor.database.role && identity.sessionUser === descriptor.database.role
                    && identity.host === '127.0.0.1' && identity.port === descriptor.setup.postgres.port && identity.serverVersionNum === 170010
                    && identity.serverStartedAt === descriptor.setup.postgres.serverStartedAt && identity.applicationName === 'task4_observer_' + descriptor.executionId, 'TASK4_DATABASE_REFUSED');
                integer(identity.backendPid); date(identity.backendStartedAt, true);
                state.identity = identity;
                for (const row of records.filter(row => row.phase === phase)) { row.backendPid = identity.backendPid; row.backendStartedAt = identity.backendStartedAt; }
                const currentPair = currentPairFromRows(await readRows(port, 'current_pair'), descriptor);
                const optional = await readRows(port, 'optional_step_metrics');
                requireValue(task4CanonicalV1(optional) === '[{"relation":null}]', 'TASK4_DATABASE_REFUSED');
                const seed = await observeTask4SeedV1(port, descriptor.setup.setfarm.source.sourceSha);
                const grants = await observeTask4GrantsV1(port, descriptor.database.name, descriptor.database.role);
                requireValue(hash(task4CanonicalV1(seed)) === descriptor.fixture.seedDigest && hash(task4CanonicalV1(grants)) === descriptor.fixture.privilegeDigest, 'TASK4_DATABASE_REFUSED');
                await port.unsafe(queryRecipe('commit').statement, []);
                requireValue(issued.size === SQL_RECIPES.length, 'TASK4_DATABASE_REFUSED');
                state.complete = true;
                const { backendPid: ignoredPid, backendStartedAt: ignoredStart, applicationName: ignoredName, ...databaseIdentity } = identity;
                return freeze({ databaseIdentity, seed, grants, currentPair });
            } finally { active = false; }
        },
        bindObservation(phase, ref) {
            const state = phases.get(phase);
            requireValue(state?.complete && !state.bound, 'TASK4_DATABASE_REFUSED');
            keys(ref, 'sha256 bytes'); hex(ref.sha256); integer(ref.bytes, 1, 1048576);
            for (const row of records.filter(row => row.phase === phase && row.outcome === 'rows')) row.observation = { ...ref };
            state.bound = true;
        },
        ledger() {
            return freeze({ schema: 'mission-control.task4-inner-query-ledger.v1', executionId: descriptor.executionId,
                setupDescriptorHash: descriptor.setupDescriptorHash, readyDescriptorHash: descriptorHash, scope: 'inner_observer',
                queries: structuredClone(records), complete: ['before', 'after'].every(phase => phases.get(phase)?.complete && phases.get(phase)?.bound)
                    && records.length === SQL_RECIPES.length * 2 && records.every(row => row.outcome === 'rows' || row.outcome === 'command') });
        },
    });
}

export function captureTask4FileV1(locator, cap = 16777216, kind = 'source') {
    let fd;
    const refuse = () => fail('TASK4_SOURCE_DRIFT');
    try {
        absolutePath(locator); requireValue(['source', 'installed'].includes(kind)); integer(cap, 1, 536870912);
        const parents = [];
        for (let parent = path.dirname(locator); ; parent = path.dirname(parent)) {
            const stat = fs.lstatSync(parent, { bigint: true });
            requireValue(stat.isDirectory() && !stat.isSymbolicLink() && fs.realpathSync(parent) === parent
                && (stat.uid === BigInt(process.getuid()) || stat.uid === 0n)
                && (!(stat.mode & 0o022n) || (stat.uid === 0n && (stat.mode & 0o1000n))));
            parents.push({ path: parent, stat });
            if (parent === path.dirname(parent)) break;
            requireValue(parents.length < 128);
        }
        const first = fs.lstatSync(locator, { bigint: true });
        const same = (a, b) => ['dev', 'ino', 'mode', 'uid', 'gid', 'size', 'nlink', 'mtimeNs', 'ctimeNs'].every(key => a[key] === b[key]);
        requireValue(first.isFile() && !first.isSymbolicLink() && first.nlink === 1n && first.size <= BigInt(cap)
            && !(first.mode & 0o022n) && (kind === 'installed' || first.uid === BigInt(process.getuid())) && fs.realpathSync(locator) === locator);
        fd = fs.openSync(locator, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
        const read = () => {
            requireValue(same(first, fs.fstatSync(fd, { bigint: true })));
            const bytes = Buffer.alloc(Number(first.size)); let offset = 0;
            while (offset < bytes.length) { const count = fs.readSync(fd, bytes, offset, bytes.length - offset, offset); requireValue(count > 0); offset += count; }
            requireValue(same(first, fs.fstatSync(fd, { bigint: true })) && same(first, fs.lstatSync(locator, { bigint: true })));
            return bytes;
        };
        const bytes = read(), digest = hash(bytes); let closed = false;
        const check = () => {
            try {
                requireValue(!closed && fs.realpathSync(locator) === locator);
                for (const parent of parents) {
                    const now = fs.lstatSync(parent.path, { bigint: true });
                    requireValue(now.isDirectory() && !now.isSymbolicLink() && now.dev === parent.stat.dev && now.ino === parent.stat.ino
                        && now.mode === parent.stat.mode && now.uid === parent.stat.uid);
                }
                requireValue(hash(read()) === digest);
            } catch { refuse(); }
        };
        check();
        return Object.freeze({ bytes, hash: digest, check, close() { if (!closed) { closed = true; fs.closeSync(fd); } } });
    } catch { if (fd !== undefined) try { fs.closeSync(fd); } catch {} return refuse(); }
}
export function task4InputManifestV1(index, members) {
    try {
        requireValue(typeof index === 'string' && Buffer.byteLength(index) <= 16777216 && index.endsWith('\0'));
        const rows = index.slice(0, -1).split('\0'); requireValue(rows.length > 0 && rows.length <= 4096 && members.length === rows.length);
        const observed = new Map(), paths = new Set();
        for (const member of members) {
            keys(member, 'path sha256'); hex(member.sha256); requireValue(!observed.has(member.path)); observed.set(member.path, member.sha256);
        }
        const entries = rows.map(row => {
            const match = /^(100644|100755) [a-f0-9]{40,64} 0\t([^\u0000-\u001f\u007f]+)$/.exec(row); requireValue(match);
            const name = match[2];
            requireValue(!path.isAbsolute(name) && path.normalize(name) === name && !name.split('/').some(part => !part || part === '.' || part === '..')
                && !paths.has(name) && observed.has(name)); paths.add(name);
            return { path: name, gitMode: match[1], sha256: observed.get(name) };
        }).sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
        return hash(task4CanonicalV1({ schema: 'setfarm.task4.source-input-manifest.v1', entries }));
    } catch { fail('TASK4_SOURCE_DRIFT'); }
}

const RUN_IDS = Object.freeze(['ac8cea43-7686-4d27-8092-1e3dd9207ca4', 'ad47fe65-4ec4-4fb5-89da-fff71eb4e79a']);
const RENDER_ROUTES = Object.freeze(['/', '/setfarm', '/setfarm/active', '/projects', ...RUN_IDS.map(id => '/setfarm/runs/' + id)]);
const requestRecipe = (pathId, target) => {
    const split = target.indexOf('?');
    return { pathId, method: 'GET', path: split < 0 ? target : target.slice(0, split), query: split < 0 ? '' : target.slice(split + 1) };
};
const NETWORK_RECIPES = freeze({
    browser: [
        ...RENDER_ROUTES.map((route, index) => requestRecipe('page_' + index, route)),
        ...[
            ['overview', '/api/overview'], ['system', '/api/system'], ['pipeline', '/api/setfarm/pipeline'], ['kimi_quota', '/api/kimi-quota'],
            ['model_limits', '/api/model-limits'], ['quota', '/api/quota'], ['agents', '/api/agents'], ['activity', '/api/setfarm/activity?limit=50'],
            ['workflow_agents', '/api/setfarm/agents'], ['alerts', '/api/setfarm/alerts'], ['workflows', '/api/workflows'], ['sessions', '/api/sessions'],
            ['agent_feed', '/api/setfarm/agent-feed?limit=100'], ['projects', '/api/projects'],
        ].map(([id, target]) => requestRecipe(id, target)),
        ...RUN_IDS.flatMap((id, index) => [requestRecipe('run_detail_' + index, `/api/runs/${id}/detail`),
            requestRecipe('operational_' + index, `/api/setfarm/runs/${id}/operational-snapshot`),
            requestRecipe('product_' + index, `/api/setfarm/runs/${id}/product-build-authority`)]),
    ],
    mock: RUN_IDS.flatMap((id, index) => [requestRecipe('operational_' + index, `/api/runs/${id}/operational-snapshot`),
        requestRecipe('model_' + index, `/api/runs/${id}/operational-model`), requestRecipe('product_' + index, `/api/runs/${id}/product-build-authority`),
        requestRecipe('supervisor_' + index, `/api/runs/${id}/supervisor`)]),
});
export function task4NetworkRecipesV1(measuredBuild) {
    try {
        requireValue(measuredBuild?.files instanceof Map);
        const read = name => {
            const file = measuredBuild.files.get(name);
            requireValue(file && Buffer.isBuffer(file.bytes) && file.bytes.length > 0 && file.bytes.length <= 16777216 && hash(file.bytes) === file.hash);
            return file.bytes;
        };
        const bytes = read('dist/index.html'), html = bytes.toString('utf8');
        requireValue(bytes.length <= 65536 && Buffer.from(html).equals(bytes));
        const scripts = [...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi)];
        const links = [...html.matchAll(/<link\b[^>]*>/gi)];
        requireValue(scripts.length === 1 && links.length === 1 && (html.match(/<script\b/gi) ?? []).length === 1
            && !/<(?:style|iframe|img|source|audio|video|object|embed|base)\b/i.test(html));
        const js = /^<script type="module" crossorigin src="(\/assets\/index-[A-Za-z0-9_-]{8,64}\.js)"><\/script>$/.exec(scripts[0][0]);
        const css = /^<link rel="stylesheet" crossorigin href="(\/assets\/index-[A-Za-z0-9_-]{8,64}\.css)">$/.exec(links[0][0]);
        requireValue(js && css); read('dist' + js[1]); read('dist' + css[1]);
        return freeze({ browser: [...NETWORK_RECIPES.browser.slice(0, RENDER_ROUTES.length),
            requestRecipe('asset_js', js[1]), requestRecipe('asset_css', css[1]), ...NETWORK_RECIPES.browser.slice(RENDER_ROUTES.length)],
            mock: [...NETWORK_RECIPES.mock] });
    } catch { fail('TASK4_SOURCE_DRIFT'); }
}
export function task4MockResponseV1(method, target, sourceSha) {
    const recipe = NETWORK_RECIPES.mock.find(row => row.method === method && row.path + (row.query ? '?' + row.query : '') === target);
    if (!recipe) return null;
    const index = Number(recipe.pathId.slice(-1)), runId = RUN_IDS[index];
    let body, status = 200;
    if (recipe.pathId.startsWith('supervisor_')) body = { available: false, runId, workdir: null, stateRoot: null, status: 'missing',
        activeWorkers: [], activeFixers: [], storyCount: 0, openBlockers: 0, warnings: 0, resolved: 0, pendingInterventions: 0, checklistItems: 0, checklistPassed: 0,
        visual: { available: false, status: 'missing', issueCount: 0, routesChecked: [], controlsChecked: 0, screenshots: [] },
        artifacts: {}, recentEvents: [], candidateWorkdirs: [] };
    else if (recipe.pathId.startsWith('operational_')) body = task4OperationalSnapshotV1(sourceSha, runId);
    else if (recipe.pathId.startsWith('model_')) body = task4OperationalModelV1(sourceSha, runId);
    else if (index === 0) { status = 409; body = { code: 'RUNTIME_PACKET_RUN_NOT_V3' }; }
    else body = task4SeedV1(sourceSha).productResponse;
    return freeze({ status, contentType: 'application/json; charset=utf-8', body: task4CanonicalV1(body) });
}

// Original outer requires private fd4 READY/EOF, then exact OS identity, before releasing fd3 START.
const TASK4_POLICY_PROBE_PROGRAM = "'use strict'; const fs=require('node:fs'),net=require('node:net'); const ports=process.argv.slice(1); const valid=ports.length===2&&ports.every(v=>/^[1-9][0-9]{3,4}$/.test(v)&&Number(v)<=65535)&&ports[0]!==ports[1]; const start=()=>new Promise((resolve,reject)=>{ const stream=fs.createReadStream(null,{fd:3,autoClose:true}); let body='',ended=false,failed=false; const timer=setTimeout(()=>{failed=true;stream.destroy();reject(Error('start'));},5000); stream.on('data',chunk=>{body+=chunk.toString('utf8');if(body.length>18){failed=true;stream.destroy();}}); stream.on('error',()=>{failed=true;}); stream.once('end',()=>{ended=true;}); stream.once('close',()=>{clearTimeout(timer);if(!failed&&ended&&body==='task4-probe-start\\n')resolve();else reject(Error('start'));}); try{const ready=Buffer.from('task4-probe-ready\\n');if(fs.writeSync(4,ready)!==18)throw Error('ready');fs.closeSync(4);}catch{failed=true;clearTimeout(timer);stream.destroy();reject(Error('start'));} }); const connect=port=>new Promise(resolve=>{ const startedAt=new Date().toISOString(); let connected=false,errno=null,timedOut=false; const socket=net.createConnection({host:'127.0.0.1',port:Number(port)}); const timer=setTimeout(()=>{timedOut=true;errno='ETIMEDOUT';socket.destroy();},3000); socket.once('connect',()=>{connected=true;socket.destroy();}); socket.on('error',error=>{errno=typeof error.code==='string'&&/^[A-Z0-9_]{1,32}$/.test(error.code)?error.code:'UNKNOWN';socket.destroy();}); socket.once('close',()=>{clearTimeout(timer);resolve({startedAt,finishedAt:new Date().toISOString(),outcome:!timedOut&&connected&&errno===null?'connected':!connected&&['EPERM','EACCES'].includes(errno)?'denied':'unknown',errno});}); }); (async()=>{if(!valid)throw Error('argv');await start();const allowed=await connect(ports[0]),denied=await connect(ports[1]);process.stdout.write(JSON.stringify({schema:'mission-control.task4-policy-probe-output.v1',allowed,denied})+'\\n');process.exitCode=allowed.outcome==='connected'&&denied.outcome==='denied'?0:1;})().catch(()=>{process.exitCode=1;});";

export function task4ScenarioV1(command, node, root) {
    absolutePath(node); absolutePath(root);
    const base = node + ' ' + path.join(root, 'scripts/render-smoke.mjs');
    if (command === base || command === base + ' --owned-fixture-v1') return 'pass';
    if (command === base + ' --owned-fixture-assertion-failure-v1') return 'assertion_failure';
    if (command === base + ' --owned-fixture-owned-cancel-v1') return 'owned_cancel';
    fail('TASK4_BINDING_REFUSED');
}
export function captureTask4DirectoryV1(locator, privateMode = false) {
    let fd;
    try {
        absolutePath(locator);
        const ancestors = []; let current = locator;
        for (;;) {
            const stat = fs.lstatSync(current, { bigint: true });
            requireValue(stat.isDirectory() && !stat.isSymbolicLink() && fs.realpathSync(current) === current
                && (stat.uid === BigInt(process.getuid()) || stat.uid === 0n)
                && (!(stat.mode & 0o022n) || (stat.uid === 0n && (stat.mode & 0o1000n))));
            ancestors.push({ path: current, stat });
            if (path.dirname(current) === current) break;
            requireValue(ancestors.length < 128); current = path.dirname(current);
        }
        const first = ancestors[0].stat;
        requireValue(first.uid === BigInt(process.getuid()) && (!privateMode || (first.mode & 0o777n) === 0o700n));
        fd = fs.openSync(locator, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_DIRECTORY);
        const same = (a, b) => ['dev', 'ino', 'uid', 'mode'].every(key => a[key] === b[key]);
        const descriptor = fd; let closed = false;
        const check = () => {
            try {
                requireValue(!closed && same(first, fs.fstatSync(descriptor, { bigint: true })));
                for (const ancestor of ancestors) {
                    const now = fs.lstatSync(ancestor.path, { bigint: true });
                    requireValue(now.isDirectory() && !now.isSymbolicLink() && same(ancestor.stat, now));
                }
            } catch { fail('TASK4_SOURCE_DRIFT'); }
        };
        const value = freeze({ path: locator, uid: Number(first.uid), dev: String(first.dev), ino: String(first.ino), mode: Number(first.mode & 0o777n) });
        check();
        return Object.freeze({ value, check, sync() { check(); fs.fsyncSync(descriptor); check(); }, close() { if (!closed) { closed = true; fs.closeSync(descriptor); } } });
    } catch { if (fd !== undefined) try { fs.closeSync(fd); } catch {} fail('TASK4_SOURCE_DRIFT'); }
}
export function publishTask4FixedV1(rootPin, name, value) {
    const names = ['inner-result.json', 'policy-probe-request.json', 'policy-probe-original.json', 'policy-probe-mock.json', 'policy-probe.json'];
    let fd;
    try {
        requireValue(names.includes(name)); rootPin.check();
        const bytes = Buffer.from(task4CanonicalV1(value) + '\n'); requireValue(bytes.length <= 16384);
        const locator = path.join(rootPin.value.path, name), pending = locator + '.pending';
        requireValue(!fs.existsSync(locator) && !fs.existsSync(pending));
        fd = fs.openSync(pending, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
        const first = fs.fstatSync(fd, { bigint: true });
        requireValue(first.isFile() && first.nlink === 1n && first.uid === BigInt(process.getuid()) && (first.mode & 0o777n) === 0o600n);
        fs.writeFileSync(fd, bytes); fs.fsyncSync(fd);
        const after = fs.fstatSync(fd, { bigint: true }), named = fs.lstatSync(pending, { bigint: true });
        requireValue(after.nlink === 1n && after.size === BigInt(bytes.length) && after.ino === first.ino && after.dev === first.dev
            && named.ino === first.ino && named.dev === first.dev && !named.isSymbolicLink() && named.nlink === 1n);
        fs.closeSync(fd); fd = undefined; rootPin.check();
        fs.linkSync(pending, locator);
        for (const name of [pending, locator]) {
            const linked = fs.lstatSync(name, { bigint: true });
            requireValue(linked.isFile() && !linked.isSymbolicLink() && linked.ino === first.ino && linked.dev === first.dev
                && linked.uid === first.uid && linked.nlink === 2n && linked.size === BigInt(bytes.length) && (linked.mode & 0o777n) === 0o600n);
        }
        fs.unlinkSync(pending); rootPin.sync();
        const pin = captureTask4FileV1(locator, 16384);
        try {
            const final = fs.lstatSync(locator, { bigint: true });
            requireValue(final.isFile() && !final.isSymbolicLink() && final.dev === first.dev && final.ino === first.ino && final.uid === first.uid
                && (final.mode & 0o777n) === 0o600n && final.nlink === 1n && final.size === BigInt(bytes.length)
                && pin.bytes.equals(bytes) && !fs.existsSync(pending)); pin.check(); rootPin.check();
        } finally { pin.close(); }
        return freeze({ sha256: hash(bytes), bytes: bytes.length });
    } catch { if (fd !== undefined) try { fs.closeSync(fd); } catch {} fail('TASK4_RESULT_PUBLICATION_FAILED'); }
}

function task4FileSnapshotV1(locator, cap = 16777216, kind = 'source') {
    const pin = captureTask4FileV1(locator, cap, kind);
    try {
        const stat = fs.lstatSync(locator, { bigint: true }); pin.check();
        const identity = Object.fromEntries(['dev', 'ino', 'uid', 'gid', 'mode', 'nlink', 'size', 'mtimeNs', 'ctimeNs'].map(key => [key, String(stat[key])]));
        return { bytes: pin.bytes, hash: pin.hash, identity };
    } finally { pin.close(); }
}
function task4SameFileV1(first, final) {
    return first.hash === final.hash && task4CanonicalV1(first.identity) === task4CanonicalV1(final.identity);
}
export function captureTask4BuildV1(root) {
    try {
        const snapshot = () => {
            absolutePath(root); const rootPin = captureTask4DirectoryV1(root);
            const directories = new Map(), files = new Map();
            const visit = locator => {
                requireValue(directories.size < 4096 && files.size < 4096);
                const pin = captureTask4DirectoryV1(locator);
                try {
                    directories.set(path.relative(root, locator), pin.value);
                    for (const name of fs.readdirSync(locator).sort()) {
                        requireValue(!/[\u0000-\u001f\u007f]/.test(name));
                        const file = path.join(locator, name), stat = fs.lstatSync(file);
                        if (stat.isDirectory() && !stat.isSymbolicLink()) visit(file);
                        else { requireValue(stat.isFile() && !stat.isSymbolicLink()); files.set(path.relative(root, file), task4FileSnapshotV1(file, 536870912)); }
                    }
                    pin.check();
                } finally { pin.close(); }
            };
            try { visit(path.join(root, 'dist')); visit(path.join(root, 'dist-server')); rootPin.check(); }
            finally { rootPin.close(); }
            return { directories, files };
        };
        const first = snapshot(), identityFile = first.files.get('dist-server/internal-production-build-identity.v1.json');
        requireValue(identityFile && identityFile.bytes.length <= 16384 && first.files.has('dist/index.html'));
        const identity = JSON.parse(identityFile.bytes.toString('utf8'));
        keys(identity, 'schema sourceSha treeHash buildHash'); requireValue(identity.schema === 'mission-control.internal-production-build-identity.v1');
        hex(identity.sourceSha, 40); hex(identity.treeHash, 40); hex(identity.buildHash);
        const digest = createHash('sha256').update('mission-control.internal-production-build-content.v1\0');
        for (const [name, file] of [...first.files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
            if (name === 'dist-server/internal-production-build-identity.v1.json') continue;
            digest.update(name).update('\0').update(String(file.bytes.length)).update('\0').update(file.bytes).update('\0');
        }
        requireValue(digest.digest('hex') === identity.buildHash);
        return Object.freeze({ identity: freeze(identity), identityHash: identityFile.hash, files: first.files,
            check() {
                try {
                    const final = snapshot(); requireValue(first.files.size === final.files.size && first.directories.size === final.directories.size);
                    for (const [name, file] of first.files) requireValue(final.files.has(name) && task4SameFileV1(file, final.files.get(name)));
                    for (const [name, directory] of first.directories) requireValue(final.directories.has(name)
                        && task4CanonicalV1(directory) === task4CanonicalV1(final.directories.get(name)));
                } catch { fail('TASK4_SOURCE_DRIFT'); }
            } });
    } catch { fail('TASK4_SOURCE_DRIFT'); }
}

export function parseTask4InvocationV1(argv, execArgv, environment) {
    requireValue(Array.isArray(argv) && argv.length <= 1 && Array.isArray(execArgv) && execArgv.length === 0, 'TASK4_BINDING_REFUSED');
    const modes = ['--owned-fixture-v1', '--owned-fixture-assertion-failure-v1', '--owned-fixture-owned-cancel-v1', '--owned-fixture-ready-v1'];
    requireValue(argv.length === 0 || modes.includes(argv[0]), 'TASK4_BINDING_REFUSED');
    for (const key of ['NODE_OPTIONS', 'NODE_PATH', 'LD_PRELOAD', 'DYLD_INSERT_LIBRARIES', 'DYLD_LIBRARY_PATH', 'MC_RENDER_BASE_URL', 'MC_RENDER_ROUTES', 'MC_RENDER_SCREENSHOT_DIR', 'MC_RENDER_EXPECT_TEXT'])
        requireValue(!Object.hasOwn(environment, key), 'TASK4_BINDING_REFUSED');
    return freeze({ inner: argv[0] === '--owned-fixture-ready-v1' });
}
export function assertTask4SourceObservationV1(source, observed, kind) {
    try {
        requireValue(kind === 'sf' || kind === 'mc'); if (kind === 'sf') sourceSf(source); else sourceMc(source);
        keys(observed, 'head tree status index members');
        requireValue(observed.head === source.sourceSha + '\n' && observed.tree === source.treeHash + '\n' && observed.status === '');
        const manifest = task4InputManifestV1(observed.index, observed.members);
        if (kind === 'sf') requireValue(manifest === source.inputManifestHash);
        else {
            const map = new Map(observed.members.map(member => [member.path, member.sha256]));
            for (const [name, key] of [['scripts/render-smoke.mjs', 'renderSmokeHash'], ['scripts/render-smoke-owned-fixture.mjs', 'ownedFixtureHash'], ['tests/fixtures/render-smoke-product-authority.mjs', 'productAuthorityFixtureHash']])
                requireValue(map.get(name) === source.harness[key]);
        }
    } catch { fail('TASK4_SOURCE_DRIFT'); }
}

export function bindTask4ProcessV1(observed, expected) {
    try {
        for (const key of ['pid', 'ppid', 'uid', 'executable', 'rawArgs']) requireValue(observed[key] === expected[key]);
        const result = { pid: observed.pid, ppid: observed.ppid, pgid: observed.pgid, uid: observed.uid, startedAt: observed.startedAt,
            executable: observed.executable, executableHash: expected.executableHash, commandHash: hash(observed.rawArgs) };
        processPin(result); return freeze(result);
    } catch { fail('TASK4_BINDING_REFUSED'); }
}

function task4GitV1(root, args) {
    const result = spawnSync('/usr/bin/git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', '-C', root, ...args], {
        encoding: 'utf8', timeout: 5000, maxBuffer: 16777216,
        env: { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_CONFIG_COUNT: '0', GIT_TERMINAL_PROMPT: '0' },
    });
    requireValue(!result.error && result.status === 0 && result.signal === null && result.stderr === '', 'TASK4_SOURCE_DRIFT');
    return result.stdout;
}
function captureTask4SourceInputsV1(source, kind) {
    const rootPin = captureTask4DirectoryV1(source.root); let closed = false;
    const snapshot = () => {
        rootPin.check(); requireValue(!closed, 'TASK4_SOURCE_DRIFT');
        const head = task4GitV1(source.root, ['rev-parse', 'HEAD']), tree = task4GitV1(source.root, ['rev-parse', 'HEAD^{tree}']);
        const status = task4GitV1(source.root, ['status', '--porcelain=v1', '--untracked-files=no']);
        requireValue(head === source.sourceSha + '\n' && tree === source.treeHash + '\n' && status === '', 'TASK4_SOURCE_DRIFT');
        const index = task4GitV1(source.root, ['ls-files', '--stage', '-z']);
        requireValue(index.endsWith('\0'), 'TASK4_SOURCE_DRIFT');
        const rows = index.slice(0, -1).split('\0'); requireValue(rows.length > 0 && rows.length <= 4096, 'TASK4_SOURCE_DRIFT');
        const files = new Map(), members = [];
        for (const row of rows) {
            const match = /^(100644|100755) [a-f0-9]{40,64} 0\t([^\u0000-\u001f\u007f]+)$/.exec(row); requireValue(match, 'TASK4_SOURCE_DRIFT');
            const name = match[2]; requireValue(!path.isAbsolute(name) && path.normalize(name) === name && !name.split('/').some(part => !part || part === '.' || part === '..') && !files.has(name), 'TASK4_SOURCE_DRIFT');
            const file = task4FileSnapshotV1(path.join(source.root, name));
            requireValue((Number(file.identity.mode) & 0o777) === (match[1] === '100755' ? 0o755 : 0o644), 'TASK4_SOURCE_DRIFT');
            files.set(name, file); members.push({ path: name, sha256: file.hash });
        }
        assertTask4SourceObservationV1(source, { head, tree, status, index, members }, kind);
        requireValue(task4GitV1(source.root, ['rev-parse', 'HEAD']) === head && task4GitV1(source.root, ['ls-files', '--stage', '-z']) === index, 'TASK4_SOURCE_DRIFT');
        rootPin.check(); return files;
    };
    try {
        const first = snapshot();
        return Object.freeze({ rootPin: rootPin.value, files: first,
            check() {
                try { const final = snapshot(); requireValue(final.size === first.size, 'TASK4_SOURCE_DRIFT');
                    for (const [name, file] of first) requireValue(final.has(name) && task4SameFileV1(file, final.get(name)), 'TASK4_SOURCE_DRIFT');
                } catch { fail('TASK4_SOURCE_DRIFT'); }
            }, close() { if (!closed) { closed = true; rootPin.close(); } } });
    } catch (error) { rootPin.close(); throw error; }
}

const TASK4_MC_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TASK4_TOOLCHAIN_ROOT = path.join(path.dirname(path.dirname(TASK4_MC_ROOT)), '.task4-toolchain-v1');
const TASK4_NODE = path.join(TASK4_TOOLCHAIN_ROOT, 'Cellar/node/26.4.0/bin/node');
const TASK4_PG_BIN = path.join(TASK4_TOOLCHAIN_ROOT, 'Cellar/postgresql@17/17.10/bin');
const TASK4_NODE_HASH = '59cd4fb59cf5bc239f43d5db8c0cd8c23c22db79419612b92da3b7cf34de8553';
async function task4RuntimeModulesV1(root) {
    // Call only after full Source and build measurement; these fixed compiled modules have no selected configuration imports.
    const native = await import(pathToFileURL(path.join(root, 'dist-server/scripts/ui-regression-lifecycle.mjs')).href);
    const protocol = await import(pathToFileURL(path.join(root, 'dist-server/services/control-ui-worker-protocol.js')).href);
    const loaded = await import(pathToFileURL(path.join(root, 'dist-server/services/product-build-authority-v2-delivery-evidence-v1.js')).href);
    return { native, protocol, loaded };
}
async function prepareTask4BootstrapV1(frame) {
    const invocation = parseTask4InvocationV1(process.argv.slice(2), process.execArgv, process.env);
    const validated = parseTask4FrameV1(Buffer.from(task4CanonicalV1(frame) + '\n'), invocation.inner ? 'ready' : 'launch');
    const ready = invocation.inner ? validated : null;
    const launch = ready ? { schema: 'mission-control.render-smoke-launch.v1', setfarm: ready.setup.setfarm.source, missionControl: ready.setup.missionControl.source } : validated;
    const root = TASK4_MC_ROOT, script = path.join(root, 'scripts/render-smoke.mjs');
    requireValue(launch.missionControl.root === root && process.argv[1] === script && fs.realpathSync(script) === script
        && process.execPath === TASK4_NODE && fs.realpathSync(process.execPath) === TASK4_NODE, 'TASK4_BINDING_REFUSED');
    for (const name of ['.env', '.env.local']) requireValue(!fs.existsSync(path.join(root, name)), 'TASK4_RESOURCE_REFUSED');
    let sf, mc;
    try {
        sf = captureTask4SourceInputsV1(launch.setfarm, 'sf'); mc = captureTask4SourceInputsV1(launch.missionControl, 'mc');
        const build = captureTask4BuildV1(root), expected = launch.missionControl;
        requireValue(build.identity.sourceSha === expected.sourceSha && build.identity.treeHash === expected.treeHash
            && build.identity.buildHash === expected.buildHash && build.identityHash === expected.buildIdentityHash, 'TASK4_SOURCE_DRIFT');
        const node = task4FileSnapshotV1(TASK4_NODE, 536870912, 'installed'); requireValue(node.hash === TASK4_NODE_HASH, 'TASK4_SOURCE_DRIFT');
        const check = () => {
            sf.check(); mc.check(); build.check();
            requireValue(task4SameFileV1(node, task4FileSnapshotV1(TASK4_NODE, 536870912, 'installed')), 'TASK4_SOURCE_DRIFT');
            for (const name of ['.env', '.env.local']) requireValue(!fs.existsSync(path.join(root, name)), 'TASK4_SOURCE_DRIFT');
        };
        check(); const modules = await task4RuntimeModulesV1(root); check();
        const loaded = modules.loaded.productBuildAuthorityV2LoadedBuildStartupStateV1();
        requireValue(loaded.status === 'available' && loaded.response.loadedBuild.buildIdentityHash === build.identityHash
            && task4CanonicalV1(loaded.response.loadedBuild.buildIdentity) === task4CanonicalV1(build.identity), 'TASK4_SOURCE_DRIFT');
        const observed = await modules.native.observeUiProcessV1(process.pid); check();
        const owner = bindTask4ProcessV1(observed, { pid: process.pid, ppid: process.ppid, uid: process.getuid(), executable: TASK4_NODE,
            executableHash: node.hash, rawArgs: [TASK4_NODE, script, ...process.argv.slice(2)].join(' ') });
        let outer = owner, scenario = ready ? null : task4ScenarioV1(observed.rawArgs, TASK4_NODE, root);
        if (ready) {
            for (const bound of [ready.setup.owner, ready.fixtureOwner]) requireValue(bound.executable === TASK4_NODE && bound.executableHash === node.hash && bound.uid === owner.uid, 'TASK4_BINDING_REFUSED');
            requireValue(owner.ppid === ready.fixtureOwner.pid, 'TASK4_BINDING_REFUSED');
            const original = await modules.native.observeUiProcessV1(ready.setup.owner.pid); check();
            outer = bindTask4ProcessV1(original, { ...ready.setup.owner, rawArgs: original.rawArgs });
            requireValue(task4CanonicalV1(outer) === task4CanonicalV1(ready.setup.owner), 'TASK4_BINDING_REFUSED');
            scenario = task4ScenarioV1(original.rawArgs, TASK4_NODE, root);
            const fixture = await modules.native.observeUiProcessV1(ready.fixtureOwner.pid); check();
            const fixtureCommand = [TASK4_NODE, '--import', 'tsx', '--test', '--test-concurrency=1', 'tests/fixtures/mission-control-render-smoke-owned-v1.ts'].join(' ');
            const fixturePin = bindTask4ProcessV1(fixture, { ...ready.fixtureOwner, rawArgs: fixtureCommand });
            requireValue(task4CanonicalV1(fixturePin) === task4CanonicalV1(ready.fixtureOwner), 'TASK4_BINDING_REFUSED');
            const runner = await modules.native.observeUiProcessV1(fixture.ppid); check();
            bindTask4ProcessV1(runner, { pid: fixture.ppid, ppid: outer.pid, uid: owner.uid, executable: TASK4_NODE, executableHash: node.hash,
                rawArgs: [TASK4_NODE, '--import', 'tsx', path.join(launch.setfarm.root, 'scripts/run-isolated-postgres-tests.ts'), '--', 'node', '--import', 'tsx', '--test', '--test-concurrency=1', 'tests/fixtures/mission-control-render-smoke-owned-v1.ts'].join(' ') });
        }
        return { ready, launch, root, script, node: TASK4_NODE, nodeHash: node.hash, owner, outer, scenario, modules, build, sf, mc, check,
            close() { sf.close(); mc.close(); } };
    } catch (error) { sf?.close(); mc?.close(); throw error; }
}

export function createTask4EvidenceV1(originalStore) {
    const root = originalStore.root, json = new Map(), png = new Map(), records = new Map();
    let integrity = true;
    const guard = action => {
        try { requireValue(integrity); originalStore.verify(); return action(); }
        catch { integrity = false; fail('TASK4_INTEGRITY_FAILED'); }
    };
    const ref = bytes => freeze({ sha256: hash(bytes), bytes: bytes.length });
    const put = value => guard(() => {
        const bytes = Buffer.from(task4CanonicalV1(value) + '\n'), result = ref(bytes);
        requireValue(bytes.length <= 1048576 && (json.has(result.sha256) || json.size < 64));
        requireValue(originalStore.json(value) === result.sha256); json.set(result.sha256, result); return result;
    });
    const screenshot = bytes => guard(() => {
        requireValue(Buffer.isBuffer(bytes) && bytes.length <= 16777216 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
        const result = ref(bytes); requireValue(png.has(result.sha256) || png.size < 6);
        requireValue(originalStore.png(bytes) === result.sha256); png.set(result.sha256, result); return result;
    });
    const store = Object.freeze({ root,
        json(value) { return put(value).sha256; }, png(bytes) { return screenshot(bytes).sha256; }, verify() { return guard(() => undefined); },
        record(name, value) { return guard(() => {
            const match = /^children\/([a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.(intent|observed|settled|closed|not-started)\.json$/.exec(name);
            requireValue(match && !records.has(name) && [...records.keys()].every(old => old.startsWith('children/' + match[1] + '.')));
            const bytes = Buffer.from(task4CanonicalV1(value) + '\n'); requireValue(bytes.length <= (match[2] === 'settled' ? 1048576 : 16384));
            const result = ref(bytes); requireValue(originalStore.record(name, value) === result.sha256); records.set(name, result); return result.sha256;
        }); },
    });
    const inventory = () => guard(() => {
        const expected = new Map(); for (const row of json.values()) expected.set('artifacts/' + row.sha256 + '.json', row);
        for (const row of png.values()) expected.set('artifacts/' + row.sha256 + '.png', row);
        for (const [name, row] of records) expected.set(name, row);
        const actual = ['artifacts', 'children'].flatMap(directory => fs.readdirSync(path.join(root, directory)).map(name => directory + '/' + name));
        requireValue(actual.length === expected.size);
        for (const name of actual) {
            const row = expected.get(name); requireValue(row);
            const file = task4FileSnapshotV1(path.join(root, name), name.endsWith('.png') ? 16777216 : 1048576);
            requireValue((Number(file.identity.mode) & 0o777) === 0o600 && file.hash === row.sha256 && file.bytes.length === row.bytes);
            if (name.endsWith('.json')) requireValue(Buffer.from(task4CanonicalV1(JSON.parse(file.bytes.toString('utf8'))) + '\n').equals(file.bytes));
        }
        const native = [];
        if (records.size) {
            const spawnId = [...records.keys()][0].slice(9, 45), chain = { spawnId, intent: null, observed: null, settled: null, closed: null, notStarted: null };
            for (const [suffix, key] of [['intent', 'intent'], ['observed', 'observed'], ['settled', 'settled'], ['closed', 'closed'], ['not-started', 'notStarted']])
                chain[key] = records.get('children/' + spawnId + '.' + suffix + '.json') ?? null;
            requireValue(chain.intent); native.push(chain);
        }
        const sorted = values => [...values].sort((a, b) => a.sha256.localeCompare(b.sha256));
        return freeze({ json: sorted(json.values()), png: sorted(png.values()), native, totalBytes: [...expected.values()].reduce((sum, row) => sum + row.bytes, 0) });
    });
    return Object.freeze({ store, put, png: screenshot, inventory });
}

/** Original ChildProcess component seam; production passes only the immediately returned spawn handle. */
export function retainTask4ChildV1(child, cap = 131072) {
    requireValue(child && typeof child.on === 'function' && Number.isSafeInteger(cap) && cap >= 1 && cap <= 1048576, 'TASK4_CHILD_UNKNOWN');
    let exit = null, close = null, fault = false, waiting = [];
    const buffers = { stdout: [], stderr: [] }, sizes = { stdout: 0, stderr: 0 }, hashes = { stdout: createHash('sha256'), stderr: createHash('sha256') };
    const validate = () => {
        requireValue(!fault && exit && close && exit.code === close.code && exit.signal === close.signal, 'TASK4_CHILD_UNKNOWN');
        return freeze({ code: exit.code, signal: exit.signal, exitObserved: true, closeObserved: true });
    };
    const complete = () => {
        if (!close) return;
        for (const pending of waiting.splice(0)) {
            clearTimeout(pending.timer);
            try { pending.resolve(validate()); } catch (error) { pending.reject(error); }
        }
    };
    for (const name of ['stdout', 'stderr']) if (child[name]) {
        child[name].on('data', value => {
            const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value); hashes[name].update(bytes); sizes[name] += bytes.length;
            if (close || sizes[name] > cap) fault = true;
            else buffers[name].push(Buffer.from(bytes));
        });
        child[name].on('error', () => { fault = true; });
    }
    child.on('error', () => { fault = true; });
    child.on('exit', (code, signal) => { if (exit || close) fault = true; else exit = { code, signal }; });
    child.on('close', (code, signal) => { if (close) fault = true; else close = { code, signal }; complete(); });
    return Object.freeze({
        wait(timeoutMs) {
            requireValue(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 1200000, 'TASK4_CHILD_UNKNOWN');
            if (close) { try { return Promise.resolve(validate()); } catch (error) { return Promise.reject(error); } }
            return new Promise((resolve, reject) => {
                const pending = { resolve, reject, timer: null };
                pending.timer = setTimeout(() => { fault = true; waiting = waiting.filter(row => row !== pending); reject(Error('TASK4_CHILD_UNKNOWN')); }, timeoutMs);
                waiting.push(pending);
            });
        },
        ended() { return close !== null; },
        snapshot() { return validate(); },
        originals() {
            const output = {};
            for (const name of ['stdout', 'stderr']) {
                const bytes = Buffer.concat(buffers[name]), text = bytes.toString('utf8');
                requireValue(Buffer.from(text).equals(bytes), 'TASK4_CHILD_UNKNOWN');
                output[name] = text; output[name + 'Hash'] = hashes[name].copy().digest('hex'); output[name + 'Bytes'] = sizes[name];
            }
            return freeze(output);
        },
    });
}

function task4ArtifactBindingV1(ready) {
    return { executionId: ready.executionId, setupDescriptorHash: ready.setupDescriptorHash, readyDescriptorHash: hash(task4CanonicalV1(ready) + '\n') };
}
export function createTask4FilesystemV1(ready, evidence) {
    const binding = task4ArtifactBindingV1(ready), inner = path.join(ready.setup.resourceRoot.path, 'inner');
    const roots = { server_home: 'server-home', server_runtime: 'server-runtime', native_home: 'home', native_profile: 'profile', native_tmp: 'tmp' };
    const snapshots = [], operations = [], first = new Map(), last = new Map(), pins = new Map(), checkpoints = [];
    let before = null, after = null, tmpAfter = 'unknown', failed = false, firstFailure = null;
    let observation = { operation: 'initial', rootId: null, relative: null, kind: null };
    const guarded = action => { try { requireValue(!failed); return action(); } catch { firstFailure ??= { ...observation }; failed = true; fail('TASK4_RESOURCE_REFUSED'); } };
    const readSync = () => {
        const file = path.join(inner, 'server-runtime/setfarm/mc-sync-state.json');
        if (!fs.existsSync(file)) return null;
        const pin = task4FileSnapshotV1(file, 16384), body = JSON.parse(pin.bytes.toString('utf8'));
        keys(body, 'finishedIds runningIds savedAt'); date(body.savedAt);
        requireValue(Array.isArray(body.finishedIds) && body.finishedIds.length === 0 && Array.isArray(body.runningIds)
            && task4CanonicalV1([...body.runningIds].sort()) === task4CanonicalV1([...RUN_IDS].sort())
            && Buffer.from(JSON.stringify({ finishedIds: body.finishedIds, runningIds: body.runningIds, savedAt: body.savedAt })).equals(pin.bytes));
        return { sha256: pin.hash, bytes: pin.bytes.length, ...body };
    };
    const capture = (rootId, phase) => guarded(() => {
        observation = { operation: 'capture', rootId: Object.hasOwn(roots, rootId) ? rootId : null, relative: null, kind: null };
        requireValue(Object.hasOwn(roots, rootId) && ['before_server', 'after_route', 'after_server_close'].includes(phase) && snapshots.length < 24
            && !last.has(rootId) && !(phase === 'before_server' && first.has(rootId)));
        const locator = path.join(inner, roots[rootId]), pin = captureTask4DirectoryV1(locator, true);
        try {
            if (pins.has(rootId)) requireValue(task4CanonicalV1(pins.get(rootId)) === task4CanonicalV1(pin.value)); else pins.set(rootId, pin.value);
            const entries = [];
            const walk = directory => {
                for (const name of fs.readdirSync(directory).sort()) {
                    requireValue(entries.length < 4096 && /^[\x21-\x7e ]+$/.test(name) && !name.includes('\\'));
                    const file = path.join(directory, name), relative = path.relative(locator, file);
                    observation = { operation: 'walk', rootId, relative: relative.slice(0, 256), kind: null };
                    const stat = fs.lstatSync(file, { bigint: true });
                    requireValue(stat.uid === BigInt(ready.setup.resourceRoot.uid));
                    const row = { relative, kind: stat.isSymbolicLink() ? 'symlink' : stat.isDirectory() ? 'directory' : 'file', uid: Number(stat.uid),
                        mode: Number(stat.mode & 0o777n), dev: String(stat.dev), ino: String(stat.ino), bytes: 0, sha256: null, linkHash: null };
                    if (row.kind === 'symlink') { const target = fs.readlinkSync(file); row.bytes = Buffer.byteLength(target); row.linkHash = hash(target);
                        const final = fs.lstatSync(file, { bigint: true }); requireValue(final.isSymbolicLink() && final.dev === stat.dev && final.ino === stat.ino && final.ctimeNs === stat.ctimeNs); }
                    else {
                        observation = { ...observation, kind: row.kind };
                        requireValue(!(stat.mode & 0o022n));
                        if (row.kind === 'file') { requireValue(stat.isFile()); const observed = task4FileSnapshotV1(file, 536870912); row.bytes = observed.bytes.length; row.sha256 = observed.hash; }
                    }
                    entries.push(row); if (row.kind === 'directory') walk(file);
                }
            };
            walk(locator); entries.sort((a, b) => a.relative < b.relative ? -1 : a.relative > b.relative ? 1 : 0); pin.check();
            if (['server_home', 'server_runtime'].includes(rootId) && phase !== 'before_server') {
                requireValue(first.has(rootId)); const baseline = first.get(rootId).entries;
                const mutable = name => rootId === 'server_runtime' && ['setfarm/mc-sync-state.json', 'setfarm/mc-sync-state.json.tmp'].includes(name);
                for (const entry of entries) {
                    observation = { operation: 'baseline_compare', rootId, relative: entry.relative.slice(0, 256), kind: entry.kind };
                    if (mutable(entry.relative)) { requireValue(entry.kind === 'file'); continue; }
                    if (rootId === 'server_runtime' && entry.relative === 'setfarm' && !baseline.some(row => row.relative === 'setfarm')) { requireValue(entry.kind === 'directory'); continue; }
                    const previous = baseline.find(row => row.relative === entry.relative); requireValue(previous && task4CanonicalV1(previous) === task4CanonicalV1(entry));
                }
                for (const entry of baseline) if (!mutable(entry.relative)) {
                    observation = { operation: 'baseline_compare', rootId, relative: entry.relative.slice(0, 256), kind: entry.kind };
                    requireValue(entries.some(row => task4CanonicalV1(row) === task4CanonicalV1(entry)));
                }
            }
            const at = new Date().toISOString(), value = { schema: 'mission-control.task4-filesystem-snapshot.v1', ...binding, rootId, rootPin: pin.value, at, entries };
            const ref = evidence.put(value); snapshots.push({ seq: snapshots.length + 1, phase, at, rootId, rootPin: pin.value, entries: ref });
            if (phase === 'before_server') { first.set(rootId, value); if (rootId === 'server_runtime') before = readSync(); }
            if (phase === 'after_server_close') { last.set(rootId, value); if (rootId === 'server_runtime') { after = readSync(); tmpAfter = fs.existsSync(path.join(locator, 'setfarm/mc-sync-state.json.tmp')) ? 'present' : 'absent'; requireValue(tmpAfter === 'absent'); } }
            return ref;
        } finally { pin.close(); }
    });
    return Object.freeze({ capture,
        diagnostics() { return freeze({ firstFailure: firstFailure ? { ...firstFailure } : null }); },
        checkpoint(route) { return guarded(() => {
            requireValue(RENDER_ROUTES.includes(route) && checkpoints.length < 24); const state = readSync(); requireValue(state);
            const at = new Date().toISOString(); requireValue(at >= state.savedAt); checkpoints.push({ ...state, at, route }); return freeze(state);
        }); },
        operation(operation, targetId) { return guarded(() => {
            requireValue(['create', 'write', 'publish', 'close'].includes(operation) && ['inner_root', 'server_home', 'server_runtime', 'mock', 'server', 'native', 'json_artifact', 'png_artifact', 'inner_result', 'sql_client', 'browser_context'].includes(targetId) && operations.length < 4096);
            operations.push({ seq: operations.length + 1, at: new Date().toISOString(), actor: 'inner', operation, targetId, outcome: 'ok', errno: null });
        }); },
        value() { return freeze({ schema: 'mission-control.task4-filesystem-ledger.v1', ...binding, scope: 'owned_private_roots_and_explicit_source_pins',
            snapshots: structuredClone(snapshots), syncState: { pathId: 'pipeline_sync_state', before, checkpoints: structuredClone(checkpoints), after, tmpAfter }, operations: structuredClone(operations),
            complete: !failed && first.has('server_home') && first.has('server_runtime') && Object.keys(roots).every(id => last.has(id)) && checkpoints.length > 0 && after !== null && tmpAfter === 'absent' }); },
    });
}

export function classifyTask4ListenerV1(original, port, ownerPid) {
    try {
        integer(port, 1024, 65535); if (ownerPid !== null) integer(ownerPid);
        keys(original, 'stdout stderr exit'); keys(original.exit, 'code signal exitObserved closeObserved');
        requireValue(original.exit.exitObserved && original.exit.closeObserved && original.exit.signal === null && original.stderr === '');
        if (original.exit.code === 1 && original.stdout === '') { requireValue(ownerPid === null); return 'absent'; }
        requireValue(original.exit.code === 0 && ownerPid !== null && typeof original.stdout === 'string' && Buffer.byteLength(original.stdout) <= 65536 && original.stdout.endsWith('\n'));
        const lines = original.stdout.slice(0, -1).split('\n');
        requireValue(lines.length === 4 && lines[0] === 'p' + ownerPid && /^c[a-zA-Z0-9_.-]{1,80}$/.test(lines[1]) && /^f[0-9]{1,8}$/.test(lines[2]) && lines[3] === 'n127.0.0.1:' + port);
        return 'listening';
    } catch { fail('TASK4_RESOURCE_REFUSED'); }
}

function task4BoundedV1(promise, milliseconds, code) {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(code)), milliseconds); })]).finally(() => clearTimeout(timer));
}
export function createTask4BrowserFenceV1(ready, parseProductBuildAuthorityV2, serverPort, recipes) {
    integer(serverPort, 1024, 65535); requireValue(![3080, 3333, 5432, 13081, 18789, ready.setup.postgres.port].includes(serverPort), 'TASK4_NETWORK_REFUSED');
    const rows = [], requests = new Map(), seen = new Set(), ended = new Set(), pending = new Set(), consoleErrors = [], legacyResponses = [], products = new Map();
    let failed = false, contexts = 0, installedAt = null, requestId = 0, version = 0;
    const waiters = new Set(), events = []; let firstFailure = null;
    const changed = () => { version++; for (const wake of [...waiters]) wake(); };
    const failure = (reason, request = null, status = null) => {
        failed = true;
        const row = request ? requests.get(request) : null;
        const event = { seq: events.length + 1, at: new Date().toISOString(), reason, requestId: row?.requestId ?? null, pathId: row?.pathId ?? null,
            status: Number.isSafeInteger(status) && status >= 100 && status <= 599 ? status : null };
        firstFailure ??= event; if (events.length < 128) events.push(event); changed();
    };
    const origin = 'http://127.0.0.1:' + serverPort;
    const legacyBody = JSON.stringify({ status: 'unavailable', code: 'SETFARM_PRODUCT_BUILD_AUTHORITY_NOT_READY', reason: 'not_ready', upstreamStatus: 409, upstreamCode: 'RUNTIME_PACKET_RUN_NOT_V3' });
    const append = value => { if (rows.length >= 4096) { failure('row_cap'); return; } rows.push({ seq: rows.length + 1, ...value }); changed(); };
    const routeRecipe = request => recipes.browser.find(row => row.method === request.method() && request.url() === origin + row.path + (row.query ? '?' + row.query : ''));
    const track = (response, action) => {
        const promise = Promise.resolve().then(action).catch(() => { failure('response_validation', response.request(), response.status()); }).finally(() => { pending.delete(promise); changed(); });
        pending.add(promise); changed();
    };
    return Object.freeze({
        async attach(context, page, route) {
            requireValue(!failed && RENDER_ROUTES.includes(route) && contexts < 6, 'TASK4_NETWORK_REFUSED'); const contextId = ++contexts;
            context.on('request', request => { if (seen.size >= 4096) failure('request_cap'); else seen.add(request); changed(); });
            context.on('requestfailed', request => {
                failure('request_failed', request); const row = requests.get(request); if (!row || ended.has(request)) return;
                ended.add(request); append({ ...row, at: new Date().toISOString(), stage: 'failed', decision: 'observe', status: null, bodyHash: null, failureCode: 'request_failed' });
            });
            context.on('response', response => track(response, async () => {
                const request = response.request(), row = requests.get(request);
                requireValue(row && !ended.has(request) && response.url() === request.url());
                const bytes = await response.body(); requireValue(Buffer.isBuffer(bytes) && bytes.length <= 16777216);
                const status = response.status(), bodyHash = hash(bytes);
                if (status === 409) {
                    requireValue(row.pathId === 'product_0' && row.route === RENDER_ROUTES[4] && bytes.toString('utf8') === legacyBody);
                    legacyResponses.push({ url: request.url(), route: row.route, requestId: row.requestId });
                } else requireValue(status === 200);
                if (row.pathId === 'product_1') {
                    const body = JSON.parse(bytes.toString('utf8')), parsed = parseProductBuildAuthorityV2(body, RUN_IDS[1]);
                    const expected = task4SeedV1(ready.setup.setfarm.source.sourceSha).productResponse;
                    requireValue(status === 200 && parsed === body && body.disposition === 'sealed_packet' && body.refusal === null
                        && task4CanonicalV1(body) === task4CanonicalV1(expected));
                    products.set(route, { status, bodyHash, parsedHash: hash(task4CanonicalV1(parsed)), authorityHash: body.authorityHash, packetHash: body.packetAuthority.packetHash });
                }
                ended.add(request); append({ ...row, at: new Date().toISOString(), stage: 'response', decision: 'observe', status, bodyHash, failureCode: null });
            }));
            page.on('pageerror', () => { failure('page_error'); });
            page.on('console', message => {
                if (message.type() !== 'error' && !/uncaught|typeerror|referenceerror|react minified error/i.test(message.text())) return;
                if (consoleErrors.length >= 128) { failure('console_cap'); return; }
                const expected = message.text() === 'Failed to load resource: the server responded with a status of 409 (Conflict)';
                consoleErrors.push({ route, expected, urlHash: hash(message.location().url) });
                if (!expected) failure('console_error'); else changed();
            });
            await context.route('**/*', async routeHandle => {
                const request = routeHandle.request(), recipe = routeRecipe(request);
                if (requests.has(request) || requestId >= 4096) { failure('duplicate_or_cap', request); await routeHandle.abort('blockedbyclient'); return; }
                const row = { requestId: ++requestId, contextId, route, at: new Date().toISOString(), stage: 'intercept', method: ['GET', 'HEAD'].includes(request.method()) ? request.method() : 'OTHER',
                    target: request.url().startsWith(origin + '/') ? 'mc' : 'other', pathId: recipe?.pathId ?? null, urlHash: hash(request.url()), decision: recipe ? 'continue' : 'abort', status: null, bodyHash: null, failureCode: recipe ? null : 'blocked_by_fixture' };
                requests.set(request, row); append(row);
                if (!recipe) { failure('request_denied', request); await routeHandle.abort('blockedbyclient'); return; }
                try { await routeHandle.continue(); } catch { failure('continue_failed', request); }
            });
            await context.routeWebSocket('**/*', socket => { failure('websocket'); socket.close(); });
            installedAt ??= new Date().toISOString();
        },
        async settle() {
            const deadline = Date.now() + 8000;
            try {
                for (;;) {
                    requireValue(!failed && Date.now() < deadline);
                    const observedVersion = version;
                    if (pending.size === 0 && requests.size > 0 && requests.size === seen.size
                        && [...seen].every(request => requests.has(request)) && requests.size === ended.size) break;
                    await new Promise((resolve, reject) => {
                        let timer;
                        const wake = () => { clearTimeout(timer); waiters.delete(wake); resolve(); };
                        waiters.add(wake);
                        timer = setTimeout(() => { waiters.delete(wake); failure('settlement_timeout'); reject(Error('TASK4_NETWORK_REFUSED')); }, Math.max(1, deadline - Date.now()));
                        if (version !== observedVersion || failed) wake();
                    });
                }
                const unused = [...legacyResponses];
                for (const error of consoleErrors) {
                    requireValue(error.expected);
                    const match = unused.findIndex(row => hash(row.url) === error.urlHash && row.route === error.route); requireValue(match >= 0); unused.splice(match, 1);
                }
                requireValue(!failed && Date.now() < deadline);
            } catch { if (!failed) failure('settlement_validation'); fail('TASK4_NETWORK_REFUSED'); }
        },
        diagnostics() {
            const open = [...requests].filter(([request]) => !ended.has(request));
            return freeze({ firstFailure: firstFailure ? { ...firstFailure } : null, events: events.map(event => ({ ...event })),
                counts: { seen: seen.size, intercepted: requests.size, ended: ended.size, pendingBodies: pending.size, open: open.length, eventsTruncated: events.length === 128 },
                openRequests: open.slice(0, 32).map(([request, row]) => ({ requestId: row.requestId, contextId: row.contextId, pathId: row.pathId,
                    method: row.method, urlHash: row.urlHash, url: row.pathId ? request.url().slice(0, 512) : null })) });
        },
        product(route) { return products.has(route) ? structuredClone(products.get(route)) : null; },
        value() { return freeze({ browserInstalledAt: installedAt, browser: structuredClone(rows), complete: !failed && installedAt !== null && pending.size === 0 && requests.size > 0 && requests.size === ended.size && requests.size === seen.size }); },
    });
}

export function task4ServerPolicyV1(value, mockPort, serverPort) {
    try {
        setup(value); integer(serverPort, 1024, 65535); requireValue(![value.postgres.port, mockPort, 3080, 3333, 5432, 13081, 18789].includes(serverPort)); integer(mockPort, 1024, 65535); requireValue(![value.postgres.port, 3080, 3333, 5432, 13081, 18789].includes(mockPort));
        const inner = path.join(value.resourceRoot.path, 'inner');
        return ['(version 1)', '(allow default)', '(deny network*)',
            '(allow network-outbound (remote ip "localhost:' + value.postgres.port + '") (remote ip "localhost:' + mockPort + '"))',
            '(allow network-bind (local ip "localhost:' + serverPort + '"))', '(allow network-inbound (local ip "localhost:' + serverPort + '"))',
            '(deny file-write*)', '(allow file-write* (subpath ' + JSON.stringify(path.join(inner, 'server-home')) + ') (subpath ' + JSON.stringify(path.join(inner, 'server-runtime')) + '))', ''].join('\n');
    } catch { fail('TASK4_RESOURCE_REFUSED'); }
}

export async function runTask4EntryV1() {
    const invocation = parseTask4InvocationV1(process.argv.slice(2), process.execArgv, process.env);
    let frame;
    try {
        const stat = fs.fstatSync(4); requireValue(stat.isFIFO() || stat.isSocket(), 'TASK4_FRAME_INVALID');
        frame = await readTask4FrameV1(fs.createReadStream(null, { fd: 4, autoClose: true }), invocation.inner ? 'ready' : 'launch');
    } catch (error) {
        // No bootstrap or owned resource exists here. A missing inherited fd may be an internal Node pipe.
        const code = ['TASK4_FRAME_INVALID', 'TASK4_FRAME_TIMEOUT', 'TASK4_FRAME_UNAVAILABLE', 'TASK4_FRAME_TOO_LARGE', 'TASK4_BINDING_REFUSED', 'TASK4_SHAPE_INVALID'].includes(error?.message) ? error.message : 'TASK4_FRAME_INVALID';
        fs.writeSync(2, '[render-smoke] ' + code + '\n'); process.exit(2);
    }
    const context = await prepareTask4BootstrapV1(frame);
    try { return await (invocation.inner ? runTask4InnerV1(context) : runTask4OuterV1(context)); }
    finally { context.close(); }
}

function task4ServerEnvironmentV1(context, mockPort, serverPort) {
    requireValue(Number.isSafeInteger(serverPort) && serverPort >= 1024 && serverPort <= 65535 && ![3080, 3333, 5432, 13081, 18789, mockPort, context.ready?.setup.postgres.port].includes(serverPort), 'TASK4_RESOURCE_REFUSED');
    requireValue(context.ready !== null && context.ready !== undefined, 'TASK4_BINDING_REFUSED');
    const ready = context.ready, inner = path.join(ready.setup.resourceRoot.path, 'inner'), home = path.join(inner, 'server-home'), runtime = path.join(inner, 'server-runtime');
    return { HOME: home, TMPDIR: path.join(runtime, 'tmp'), PATH: path.join(home, 'bin'), LANG: 'C', LC_ALL: 'C', TZ: 'UTC',
        MC_TASK6A_SELECTED_CLI_NO_SPAWN_V1: '1',
        MC_HOST: '127.0.0.1', MC_PORT: String(serverPort), SETFARM_URL: 'http://127.0.0.1:' + mockPort,
        SETFARM_PG_URL: ready.database.restrictedUrl, PGAPPNAME: 'task4_mc_' + ready.executionId,
        SETFARM_DIR: path.join(runtime, 'setfarm'), SETFARM_REPO_DIR: ready.projection.root.path,
        PROJECTS_DIR: path.join(runtime, 'projects'), PROJECTS_JSON: path.join(runtime, 'projects.json'),
        CLI_PATH: path.join(home, 'bin'), DATA_JSON: path.join(home, 'data.json'), JOBS_JSON: path.join(home, 'jobs.json'),
        CLAWTABS_CONFIG: path.join(home, 'clawtabs.json'), AVATARS_DIR: path.join(home, 'avatars'),
        EVENTS_JSONL: path.join(home, 'events.jsonl'), SESSIONS_DIR: path.join(home, 'sessions'),
        TRANSCRIPTS_DIR: path.join(home, 'transcripts'), AGENTS_DIR: path.join(home, 'agents'),
        SCRIPTS_DIR: path.join(home, 'bin'), PORT_REGISTRY: path.join(home, 'ports.json'), SERVE_BIN: path.join(home, 'bin/serve') };
}
async function task4ImportConfiguredV1(url) { return import(url); }
async function task4ConfiguredParserV1(context, mockPort, serverPort) {
    const environment = task4ServerEnvironmentV1(context, mockPort, serverPort);
    for (const name of ['.env', '.env.local']) requireValue(!fs.existsSync(path.join(context.root, name)), 'TASK4_RESOURCE_REFUSED');
    context.check();
    // This is the authenticated inner process only. No ambient HOME, credential or selected composition is inherited by config.
    for (const key of Object.keys(process.env)) delete process.env[key];
    for (const [key, value] of Object.entries(environment)) if (key !== 'SETFARM_PG_URL') process.env[key] = value;
    const imported = await task4ImportConfiguredV1(pathToFileURL(path.join(context.root, 'dist-server/services/setfarm-product-build-authority.js')).href);
    context.check(); requireValue(typeof imported.parseProductBuildAuthorityV2 === 'function', 'TASK4_INTEGRITY_FAILED');
    return imported.parseProductBuildAuthorityV2;
}

async function runTask4PagesV1(context, state) {
    for (const [index, route] of RENDER_ROUTES.entries()) {
        const row = state.render.routes[index]; let ownedContext = null, failure = null;
        try {
            context.check(); await state.native.census();
            ownedContext = await state.browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
            state.contexts.opened++; state.contexts.pending++;
            const page = await ownedContext.newPage(); page.setDefaultTimeout(8000);
            await state.fence.attach(ownedContext, page, route);
            const product = index === 5 ? page.waitForResponse(response => response.url() === 'http://127.0.0.1:' + state.serverPort + '/api' + route + '/product-build-authority') : null;
            // Attach rejection immediately, while preserving the actual awaited original response below.
            if (product) product.catch(() => {});
            const response = await page.goto('http://127.0.0.1:' + state.serverPort + route, { waitUntil: 'domcontentloaded', timeout: 8000 });
            requireValue(response && response.status() === 200, 'TASK4_ASSERTION_FAILED');
            await page.waitForFunction(({ index, runIds }) => {
                const visible = element => {
                    const box = element.getBoundingClientRect(), style = getComputedStyle(element);
                    return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
                };
                const unique = selector => { const rows = [...document.querySelectorAll(selector)].filter(visible); return rows.length === 1 ? rows[0] : null; };
                if ([...document.querySelectorAll('.page-loading, .page-error')].some(visible)) return false;
                if (index === 0) return Boolean(unique('.overview') && unique('.overview .stat-cards'));
                if (index === 1) return Boolean(unique('.af-page') && [...document.querySelectorAll('.af-pipeline__header')].filter(visible).length === 2);
                if (index === 3) {
                    const buttons = [...document.querySelectorAll('.projects-page__actions button')].filter(visible);
                    return Boolean(unique('.projects-page') && unique('.projects-grid') && buttons.length === 4 && buttons.every(button => !button.disabled));
                }
                const run = unique('.run-detail-page'), id = unique('.rd-meta > span:first-child');
                const expected = index === 2 ? runIds : [runIds[index - 4]];
                return Boolean(run && id && expected.some(value => id.textContent.trim() === '#' + value.slice(0, 8))
                    && [...document.querySelectorAll('.rd-tabs .rd-tab')].filter(visible).length === 8 && unique('.rd-content'));
            }, { index, runIds: RUN_IDS });
            if (product) { const observed = await product; requireValue(await observed.finished() === null, 'TASK4_NETWORK_REFUSED'); }
            row.dom = await task4BoundedV1(page.evaluate(() => {
                const root = document.querySelector('#root'), bounds = root?.getBoundingClientRect();
                const visible = [...document.querySelectorAll('a,button,input,select,textarea')].filter(element => {
                    const box = element.getBoundingClientRect(), style = getComputedStyle(element);
                    return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
                });
                return { rootWidth: Math.floor(bounds?.width ?? 0), rootHeight: Math.floor(bounds?.height ?? 0),
                    textLength: (document.body.innerText ?? '').trim().length, visibleElements: visible.length };
            }), 8000, 'TASK4_ASSERTION_FAILED');
            requireValue(row.dom.rootWidth >= 100 && row.dom.rootHeight >= 100 && row.dom.textLength >= 40 && row.dom.visibleElements >= 2, 'TASK4_ASSERTION_FAILED');
            await state.fence.settle();
            if (index === 5) { row.productResponse = state.fence.product(route); requireValue(row.productResponse !== null, 'TASK4_ASSERTION_FAILED'); }
            row.screenshot = state.evidence.png(await page.screenshot({ fullPage: true, timeout: 8000 }));
            state.filesystem.capture('server_runtime', 'after_route'); state.filesystem.checkpoint(route);
            context.check(); await state.native.census(); row.status = 'pass';
        } catch (error) {
            failure = error; row.status = 'fail'; row.code = /^TASK4_[A-Z_]+$/.test(error.message) ? error.message : 'TASK4_ASSERTION_FAILED';
            state.render.stop = { kind: 'failure', afterRoute: route };
            task4RecordFailureV1(state, error);
            retainTask4FailureDiagnosticsV1(context, state, 'network-failure-before-close');
        } finally {
            if (ownedContext) {
                try { await task4BoundedV1(ownedContext.close(), 8000, 'TASK4_CLEANUP_UNKNOWN'); state.contexts.closed++; state.contexts.pending--; }
                catch { failure = Error('TASK4_CLEANUP_UNKNOWN'); state.render.stop = { kind: 'unknown', afterRoute: route }; }
            }
            if (failure) retainTask4FailureDiagnosticsV1(context, state, 'network-failure-after-close');
        }
        if (failure) throw failure;
        state.render.stop = { kind: 'complete', afterRoute: route };
        if (index === 0 && context.scenario === 'assertion_failure') {
            state.render.stop.kind = 'failure'; fail('TASK4_QUALIFICATION_ASSERTION_FAILURE');
        }
        if (index === 0 && context.scenario === 'owned_cancel') {
            state.cancelled = true; state.render.stop.kind = 'cancelled'; fail('TASK4_CANCELLED');
        }
    }
}

function retainTask4FailureDiagnosticsV1(context, state, stage) {
    try {
        requireValue(['network-failure-before-close', 'network-failure-after-close', 'filesystem-failure'].includes(stage), 'TASK4_RESULT_PUBLICATION_FAILED');
        const observation = stage === 'filesystem-failure' ? state.filesystem.diagnostics() : state.fence.diagnostics();
        task4PrivateBytesV1(path.join(state.inner, 'originals'), stage + '.json', Buffer.from(task4CanonicalV1({
            schema: 'mission-control.task4-private-failure-diagnostic.v1', ...task4ArtifactBindingV1(context.ready),
            at: new Date().toISOString(), stage, observation }) + '\n'));
    } catch (error) { task4RecordFailureV1(state, Error('TASK4_RESULT_PUBLICATION_FAILED')); }
}

async function startTask4MockV1(context, evidence, ownerState) {
    const binding = task4ArtifactBindingV1(context.ready), sockets = new Map(), records = [];
    let port = null, accepted = 0, closed = 0, fault = false, callbackClosed = false, listenerAfter = null, listenRef = null;
    let closingResolve = null, probeWaiter = null;
    const settle = () => {
        if (callbackClosed && accepted === closed && closingResolve) closingResolve();
        if (probeWaiter && (fault || accepted > 1 || records.length > 0)) { probeWaiter.reject(Error('TASK4_NETWORK_REFUSED')); probeWaiter = null; }
        else if (probeWaiter && accepted === 1 && closed === 1) { probeWaiter.resolve(); probeWaiter = null; }
    };
    const listener = (state, owner) => evidence.put({ schema: 'mission-control.task4-listener.v1', ...binding,
        endpointRole: 'mock', host: '127.0.0.1', port, at: new Date().toISOString(), state, owner,
        original: { method: 'owned_http_server', observed: true } });
    const server = createHttpServer((request, response) => {
        const connection = sockets.get(request.socket), recipe = NETWORK_RECIPES.mock.find(row => row.method === request.method && row.path + (row.query ? '?' + row.query : '') === request.url);
        const fixed = task4MockResponseV1(request.method, request.url, context.ready.setup.setfarm.source.sourceSha);
        const allowed = connection && recipe && fixed && request.headers.host === '127.0.0.1:' + port && records.length < 4096;
        if (!allowed) fault = true;
        const body = allowed ? fixed.body : '{"code":"TASK4_NETWORK_REFUSED"}', status = allowed ? fixed.status : 403;
        const row = { seq: records.length + 1, connectionId: connection?.id ?? 0, requestId: records.length + 1,
            at: new Date().toISOString(), method: ['GET', 'HEAD'].includes(request.method) ? request.method : 'OTHER', pathId: recipe?.pathId ?? null,
            urlHash: hash('http://127.0.0.1:' + port + request.url), decision: allowed ? 'accepted' : 'denied', status, responseHash: hash(body), finished: false, closed: false };
        if (records.length < 4096) records.push(row); if (connection) connection.rows.push(row);
        response.once('finish', () => { row.finished = true; }); response.on('error', () => { fault = true; });
        response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) }); response.end(body);
    });
    server.on('connection', socket => {
        const connection = { id: ++accepted, rows: [], closed: false }; sockets.set(socket, connection);
        if (accepted > 4096) fault = true;
        socket.on('error', () => { fault = true; });
        socket.once('close', () => { connection.closed = true; closed++; for (const row of connection.rows) row.closed = true; settle(); });
    });
    server.on('clientError', () => { fault = true; }); server.on('error', () => { fault = true; });
    const controller = Object.freeze({ get port() { return port; }, get listenRef() { return listenRef; },
        rows() { return structuredClone(records); },
        complete() { return !fault && records.length > 0 && records.every(row => row.finished && row.closed && row.decision === 'accepted'); },
        waitProbeClose() {
            requireValue(probeWaiter === null && !fault && accepted <= 1 && records.length === 0, 'TASK4_NETWORK_REFUSED');
            return new Promise((resolve, reject) => { probeWaiter = { resolve, reject }; settle(); });
        },
        probeReceipt() {
            requireValue(!fault && server.listening && accepted === 1 && closed === 1 && records.length === 0, 'TASK4_NETWORK_REFUSED');
            return { schema: 'mission-control.task4-policy-probe-mock.v1', ...binding, owner: context.owner, before: listenRef,
                after: listener('listening', context.owner), acceptedConnections: accepted, sockets: { opened: accepted, closed, active: accepted - closed } };
        },
        async close() {
            requireValue(!callbackClosed && server.listening, 'TASK4_CLEANUP_UNKNOWN');
            await task4BoundedV1(new Promise((resolve, reject) => {
                closingResolve = resolve;
                server.close(error => { if (error) reject(error); else { callbackClosed = true; settle(); } });
            }), 8000, 'TASK4_CLEANUP_UNKNOWN');
            requireValue(!server.listening && server.address() === null && accepted === closed, 'TASK4_CLEANUP_UNKNOWN'); listenerAfter = listener('absent', null);
        },
        cleanup() { return { state: callbackClosed && listenerAfter !== null && accepted === closed ? 'closed' : 'unknown',
            listen: listenRef, closeCallback: callbackClosed, acceptedConnections: accepted, closedConnections: closed, listenerAfter }; },
    });
    ownerState.mock = controller;
    await task4BoundedV1(new Promise((resolve, reject) => {
        server.once('error', reject); server.listen({ host: '127.0.0.1', port: 0, exclusive: true }, resolve);
    }), 5000, 'TASK4_RESOURCE_REFUSED');
    const address = server.address(); requireValue(address && address.address === '127.0.0.1' && address.family === 'IPv4', 'TASK4_RESOURCE_REFUSED'); port = address.port;
    if ([3080, 3333, 5432, 13081, 18789, context.ready.setup.postgres.port].includes(port)) {
        await task4BoundedV1(new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())), 5000, 'TASK4_CLEANUP_UNKNOWN');
        fail('TASK4_RESOURCE_REFUSED');
    }
    listenRef = listener('listening', context.owner);
    return controller;
}

function watchTask4ServerStartupV1(child, original, port, deadline) {
    const stream = child.stdout, expected = 'Mission Control running on http://127.0.0.1:' + port;
    let pending = Buffer.alloc(0), size = 0, ready = false, failure = false, timer, resolveWait, rejectWait;
    const chunks = [], wait = new Promise((resolve, reject) => { resolveWait = resolve; rejectWait = reject; });
    const refuse = () => { failure = true; clearTimeout(timer); if (!ready) rejectWait(Error('TASK4_RESOURCE_REFUSED')); };
    const data = chunk => {
        if (failure) return;
        if (!Buffer.isBuffer(chunk)) return refuse();
        chunks.push(Buffer.from(chunk.subarray(0, Math.max(0, 131072 - size)))); size += chunk.length;
        if (size > 131072) return refuse();
        pending = Buffer.concat([pending, chunk]);
        let end;
        while ((end = pending.indexOf(10)) !== -1) {
            const line = pending.subarray(0, end).toString('utf8'); pending = pending.subarray(end + 1);
            if (line.startsWith('Mission Control running on ')) {
                if (line !== expected || ready || original.ended() || Date.now() >= deadline) return refuse();
                ready = true; clearTimeout(timer); resolveWait();
            }
        }
    };
    const ended = () => { if (!ready || pending.length > 0) refuse(); };
    const exited = () => { if (!ready) refuse(); };
    const closed = () => { exited(); dispose(); };
    const dispose = () => {
        clearTimeout(timer);
        if (stream) for (const [name, handler] of [['data', data], ['end', ended], ['error', refuse], ['close', ended]]) stream.removeListener(name, handler);
        child.removeListener('exit', exited); child.removeListener('close', closed);
    };
    if (!stream || original.ended() || Date.now() >= deadline) refuse();
    else {
        stream.on('data', data); stream.once('end', ended); stream.on('error', refuse); stream.once('close', ended);
        child.once('exit', exited); child.once('close', closed); timer = setTimeout(refuse, deadline - Date.now());
    }
    return { wait, check() { if (failure || !ready) throw Error('TASK4_RESOURCE_REFUSED'); }, failed: () => failure,
        bytes: () => Buffer.concat(chunks), dispose };
}

function createTask4ServerV1(context, evidence, environment, policyHash, launcherHash, entryHash, reservation) {
    const binding = task4ArtifactBindingV1(context.ready), entry = path.join(context.root, 'dist-server/index.js'), port = Number(environment.MC_PORT);
    requireValue(reservation && reservation.port === port && String(port) === environment.MC_PORT, 'TASK4_RESOURCE_REFUSED');
    let child = null, original = null, owner = null, intent = null, observed = null, settled = null, listen = null, unknown = false, startup = null;
    const sameOwner = async () => {
        const value = await context.modules.native.observeUiProcessV1(child.pid); context.check();
        const pin = bindTask4ProcessV1(value, { pid: child.pid, ppid: context.owner.pid, uid: context.owner.uid,
            executable: context.node, executableHash: context.nodeHash, rawArgs: context.node + ' ' + entry });
        if (owner) requireValue(task4CanonicalV1(pin) === task4CanonicalV1(owner), 'TASK4_BINDING_REFUSED');
        return pin;
    };
    context.check();
    intent = evidence.put({ schema: 'mission-control.task4-server-intent.v1', ...binding, parentOwner: context.owner,
        executable: context.node, executableHash: context.nodeHash, entry, entryHash, argvHash: hash(task4CanonicalV1([entry])),
        environmentHash: hash(task4CanonicalV1(environment)), policyHash, launcherHash });
    return Object.freeze({
        intent() { return intent; },
        async launch() {
            requireValue(child === null && intent !== null && !unknown, 'TASK4_RESOURCE_REFUSED'); context.check();
            reservation.snapshot(); await reservation.close(); requireValue(reservation.closed(), 'TASK4_CLEANUP_UNKNOWN'); context.check();
            const available = await task4ListenerCensusV1(context, evidence, port, null); requireValue(available.state === 'absent', 'TASK4_RESOURCE_REFUSED');
            const deadline = Date.now() + 8000;
            child = spawn('/usr/bin/sandbox-exec', ['-f', path.join(context.ready.setup.resourceRoot.path, 'server-launch-policy.sb'), context.node, entry],
                { cwd: context.root, env: environment, detached: false, stdio: ['ignore', 'pipe', 'pipe'] });
            original = retainTask4ChildV1(child); startup = watchTask4ServerStartupV1(child, original, port, deadline);
            try {
                requireValue(Number.isSafeInteger(child.pid), 'TASK4_RESOURCE_REFUSED');
                await startup.wait; context.check(); startup.check();
                requireValue(Date.now() < deadline && !original.ended(), 'TASK4_RESOURCE_REFUSED');
                owner = await sameOwner(); startup.check();
                requireValue(Date.now() < deadline && !original.ended(), 'TASK4_RESOURCE_REFUSED');
                const current = await task4ListenerCensusV1(context, evidence, port, owner); startup.check();
                requireValue(Date.now() < deadline && current.state === 'listening', 'TASK4_RESOURCE_REFUSED');
                listen = evidence.put(current.value);
                observed = evidence.put({ schema: 'mission-control.task4-server-observed.v1', ...binding, intent, owner, listener: listen });
                return { intent, observed, owner };
            } finally {
                task4PrivateBytesV1(path.join(context.ready.setup.resourceRoot.path, 'inner/originals'), 'server.startup-prefix.log', startup.bytes());
            }
        },
        async close() {
            requireValue(!unknown && child !== null && original !== null && owner !== null && observed !== null && settled === null, 'TASK4_CLEANUP_UNKNOWN');
            try {
                let stop = 'exited_before_stop';
                if (!original.ended()) {
                    await sameOwner();
                    const current = await task4ListenerCensusV1(context, evidence, port, owner); requireValue(current.state === 'listening', 'TASK4_CLEANUP_UNKNOWN');
                    stop = 'original_child_sigterm'; requireValue(child.kill('SIGTERM') === true, 'TASK4_CLEANUP_UNKNOWN');
                }
                const exit = await original.wait(8000);
                requireValue(stop === 'original_child_sigterm' ? (exit.code === null && exit.signal === 'SIGTERM') || (exit.code === 0 && exit.signal === null)
                    : Number.isSafeInteger(exit.code) && exit.signal === null, 'TASK4_CLEANUP_UNKNOWN');
                const after = await task4ListenerCensusV1(context, evidence, port, null); requireValue(after.state === 'absent', 'TASK4_CLEANUP_UNKNOWN');
                task4SaveOriginalV1(context, 'server', original.originals()); context.check(); startup.check();
                settled = evidence.put({ schema: 'mission-control.task4-server-settled.v1', ...binding, intent, observed, owner, exit, stop, listenerBefore: listen, listenerAfter: evidence.put(after.value) });
            } catch (error) { unknown = true; throw error; } finally { if (original.ended()) startup?.dispose(); }
        },
        snapshot() { return { state: settled !== null && !unknown && !startup?.failed() ? 'closed' : child === null && intent === null ? 'not_started' : 'unknown', intent, observed, settled }; },
        binding() { startup?.check(); requireValue(observed !== null && owner !== null && !unknown, 'TASK4_BINDING_REFUSED'); return { intent, observed, owner }; },
    });
}

const TASK4_HELPER_SEQUENCES = new WeakMap();
async function task4ListenerCensusV1(context, _evidence, port, expectedOwner) {
    requireValue(Number.isSafeInteger(port) && port >= 1024 && port <= 65535, 'TASK4_RESOURCE_REFUSED');
    const argv = ['-nP', '-iTCP:' + port, '-sTCP:LISTEN', '-Fpcfn'];
    const child = spawn('/usr/sbin/lsof', argv, { detached: false, stdio: ['ignore', 'pipe', 'pipe'],
        env: { HOME: path.join(context.ready.setup.resourceRoot.path, 'inner/server-home'), PATH: '/usr/bin:/bin:/usr/sbin:/sbin', LANG: 'C', LC_ALL: 'C', TZ: 'UTC' } });
    const original = retainTask4ChildV1(child, 16384), exit = await original.wait(5000), bytes = original.originals(); context.check();
    const state = classifyTask4ListenerV1({ stdout: bytes.stdout, stderr: bytes.stderr, exit }, port, exit.code === 1 && bytes.stdout === '' ? null : expectedOwner?.pid ?? null);
    const binding = task4ArtifactBindingV1(context.ready);
    const sequence = (TASK4_HELPER_SEQUENCES.get(context) ?? 0) + 1; requireValue(sequence <= 256, 'TASK4_RESOURCE_REFUSED'); TASK4_HELPER_SEQUENCES.set(context, sequence);
    task4PrivateBytesV1(path.join(context.ready.setup.resourceRoot.path, 'inner/originals'), 'lsof-' + String(sequence).padStart(4, '0') + '.json',
        Buffer.from(task4CanonicalV1({ schema: 'mission-control.task4-listener-original.v1', ...binding, port, expectedOwner,
            executable: '/usr/sbin/lsof', argv, exit, stdout: bytes.stdout, stderr: bytes.stderr, stdoutHash: bytes.stdoutHash, stderrHash: bytes.stderrHash, state }) + '\n'));
    const value = { schema: 'mission-control.task4-listener.v1', ...binding, endpointRole: 'mc', host: '127.0.0.1', port,
        at: new Date().toISOString(), state, owner: state === 'listening' ? expectedOwner : null, original: { method: 'owned_child_socket_census', observed: true } };
    return { state, value };
}
function task4WaitV1(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function runTask4InnerV1(context) {
    requireValue(context.ready !== null, 'TASK4_BINDING_REFUSED'); context.check();
    const state = await prepareTask4InnerResourcesV1(context);
    try {
        state.sql = await openTask4ObserverV1(context, state);
        state.observations.before = { observedAt: new Date().toISOString(), ...await state.sql.observer.observe('before') };
        state.mock = await startTask4MockV1(context, state.evidence, state);
        state.serverPortReservation = await createTask4PortGuardV1(context, state, 'serverPortReservation');
        state.serverPort = state.serverPortReservation.port;
        state.parser = await task4ConfiguredParserV1(context, state.mock.port, state.serverPort);
        state.server = prepareTask4ServerV1(context, state);
        await runTask4InnerProbeV1(context, state);
        await state.server.launch();
        await runTask4PreflightV1(context, state);
        state.native = prepareTask4NativeV1(context, state);
        state.browser = await state.native.launch();
        state.fence = createTask4BrowserFenceV1(context.ready, state.parser, state.serverPort, state.networkRecipes);
        await runTask4PagesV1(context, state);
    } catch (error) { task4RecordFailureV1(state, error); }
    finally {
        // Retain completed page/PNG facts before any cleanup observation can fail.
        try { retainTask4RenderCandidateV1(context, state); } catch (error) { task4RecordFailureV1(state, error); }
        // Each original resource is attempted independently; one failure cannot erase candidates or skip other owned closure.
        if (state.server) try { await state.server.close(); } catch (error) { task4RecordFailureV1(state, error, true); }
        if (state.native) try { state.nativeCleanup = await state.native.close(); } catch (error) { task4RecordFailureV1(state, error, true); }
        if (state.sql) {
            if (state.observations.before) try { state.observations.after = { observedAt: new Date().toISOString(), ...await state.sql.observer.observe('after') }; }
            catch (error) { task4RecordFailureV1(state, error); }
            try { await state.sql.close(); } catch (error) { task4RecordFailureV1(state, error, true); }
        }
        if (state.serverPortReservation && !state.serverPortReservation.closed()) try { await state.serverPortReservation.close(); } catch (error) { task4RecordFailureV1(state, error, true); }
        if (state.mock) try { await state.mock.close(); } catch (error) { task4RecordFailureV1(state, error, true); }
        try { context.check(); } catch (error) { task4RecordFailureV1(state, error); }
    }
    return finalizeTask4InnerV1(context, state);
}

function retainTask4RenderCandidateV1(context, state) {
    return task4PrivateBytesV1(path.join(context.ready.setup.resourceRoot.path, 'inner/originals'), 'render-candidate.json',
        Buffer.from(task4CanonicalV1({ ...task4ArtifactBindingV1(context.ready), schema: 'mission-control.task4-render-candidate.v1',
            at: new Date().toISOString(), render: state.render, diagnostics: state.errors }) + '\n'));
}

async function captureTask4InnerPinsV1(context) {
    const ready = context.ready, retained = [];
    try {
        for (const expected of [ready.setup.resourceRoot, ready.projection.root, ready.setup.postgres.data, ready.setup.postgres.socket]) {
            const pin = captureTask4DirectoryV1(expected.path, true); retained.push(pin);
            requireValue(task4CanonicalV1(pin.value) === task4CanonicalV1(expected), 'TASK4_BINDING_REFUSED');
        }
        requireValue(task4CanonicalV1(context.sf.rootPin) === task4CanonicalV1(ready.setup.setfarm.rootPin)
            && task4CanonicalV1(context.mc.rootPin) === task4CanonicalV1(ready.setup.missionControl.rootPin), 'TASK4_BINDING_REFUSED');
        const markerPin = captureTask4FileV1(path.join(ready.projection.root.path, '.setfarm-p3-projection-marker.json'), 16384); retained.push(markerPin);
        const marker = JSON.parse(markerPin.bytes.toString('utf8'));
        requireValue(markerPin.hash === ready.projection.markerHash && marker.schema === 'setfarm.p3-isolated-projection-marker.v1'
            && marker.projectionRoot === ready.projection.root.path && marker.projectedHead === ready.projection.projectedHead
            && marker.adminUrlSha256 === ready.setup.postgres.adminUrlHash && marker.runDatabasePrefix === ready.projection.runDatabasePrefix, 'TASK4_BINDING_REFUSED');
        const tree = task4GitV1(ready.projection.root.path, ['rev-parse', 'HEAD^{tree}']);
        requireValue(/^[a-f0-9]{40}\n$/.test(tree), 'TASK4_SOURCE_DRIFT');
        retained.push(captureTask4SourceInputsV1({ root: ready.projection.root.path, sourceSha: ready.projection.projectedHead,
            treeHash: tree.slice(0, -1), inputManifestHash: ready.projection.projectedManifestHash }, 'sf'));
        const observed = await context.modules.native.observeUiProcessV1(ready.setup.postgres.process.pid); context.check();
        const pg = ready.setup.postgres.process, pin = bindTask4ProcessV1(observed, { ...pg, rawArgs: observed.rawArgs });
        requireValue(task4CanonicalV1(pin) === task4CanonicalV1(pg)
            && task4FileSnapshotV1(pg.executable, 536870912, 'installed').hash === pg.executableHash, 'TASK4_BINDING_REFUSED');
        let closed = false;
        return Object.freeze({ check() { requireValue(!closed, 'TASK4_SOURCE_DRIFT'); context.check(); for (const pin of retained) pin.check(); },
            close() { if (!closed) { closed = true; for (const pin of retained.reverse()) pin.close(); } } });
    } catch (error) { for (const pin of retained.reverse()) pin.close(); throw error; }
}

function task4PrivateBytesV1(directory, name, bytes) {
    requireValue(/^[a-z0-9][a-z0-9.-]{0,100}$/.test(name) && !name.includes('..') && Buffer.isBuffer(bytes) && bytes.length <= 1048576, 'TASK4_RESULT_PUBLICATION_FAILED');
    const parent = captureTask4DirectoryV1(directory, true); let fd = null;
    try {
        const file = path.join(directory, name); parent.check();
        fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
        const stat = fs.fstatSync(fd); requireValue(stat.isFile() && stat.nlink === 1 && stat.uid === parent.value.uid && (stat.mode & 0o777) === 0o600, 'TASK4_RESULT_PUBLICATION_FAILED');
        let offset = 0; while (offset < bytes.length) { const written = fs.writeSync(fd, bytes, offset); requireValue(written > 0, 'TASK4_RESULT_PUBLICATION_FAILED'); offset += written; }
        fs.fsyncSync(fd); fs.closeSync(fd); fd = null; parent.sync();
        const captured = captureTask4FileV1(file, 1048576);
        try { requireValue(captured.bytes.equals(bytes), 'TASK4_RESULT_PUBLICATION_FAILED'); captured.check(); } finally { captured.close(); }
        parent.check(); return { sha256: hash(bytes), bytes: bytes.length };
    } finally { if (fd !== null) fs.closeSync(fd); parent.close(); }
}
function task4SaveOriginalV1(context, role, original) {
    requireValue(['server', 'initdb', 'runner', 'probe'].includes(role), 'TASK4_INTEGRITY_FAILED');
    const root = context.ready ? path.join(context.ready.setup.resourceRoot.path, 'inner/originals') : path.join(context.resourceRoot.path, 'outer/originals');
    for (const stream of ['stdout', 'stderr']) {
        const bytes = Buffer.from(original[stream]); requireValue(bytes.length === original[stream + 'Bytes'] && hash(bytes) === original[stream + 'Hash'], 'TASK4_INTEGRITY_FAILED');
        task4PrivateBytesV1(root, role + '.' + stream + '.log', bytes);
    }
}

async function prepareTask4InnerResourcesV1(context) {
    const authenticated = await captureTask4InnerPinsV1(context), ready = context.ready;
    const inner = path.join(ready.setup.resourceRoot.path, 'inner'); let rootPin = null;
    try {
        authenticated.check(); const space = fs.statfsSync(ready.setup.resourceRoot.path, { bigint: true });
        requireValue(space.bavail * space.bsize >= 8589934592n, 'TASK4_RESOURCE_REFUSED');
        fs.mkdirSync(inner, { mode: 0o700 }); rootPin = captureTask4DirectoryV1(inner, true);
        for (const relative of ['originals', 'server-home', 'server-home/bin', 'server-runtime', 'server-runtime/tmp', 'server-runtime/projects', 'server-runtime/setfarm'])
            fs.mkdirSync(path.join(inner, relative), { mode: 0o700 });
        task4PrivateBytesV1(path.join(inner, 'server-runtime'), 'projects.json', Buffer.from('[]\n'));
        const evidence = createTask4EvidenceV1(context.modules.native.createUiArtifactStoreV1(inner)), filesystem = createTask4FilesystemV1(ready, evidence);
        filesystem.operation('create', 'inner_root'); filesystem.operation('create', 'server_home'); filesystem.operation('create', 'server_runtime');
        filesystem.capture('server_home', 'before_server'); filesystem.capture('server_runtime', 'before_server');
        rootPin.sync(); authenticated.check();
        const pins = { check() { authenticated.check(); rootPin.check(); }, close() { rootPin.close(); authenticated.close(); } };
        return { inner, pins, evidence, filesystem, startedAt: new Date().toISOString(), jobId: randomUUID(), errors: [], integrity: 'verified', cleanupUnknown: false,
            networkRecipes: task4NetworkRecipesV1(context.build),
            contexts: { opened: 0, closed: 0, pending: 0 }, readers: { opened: 0, closed: 0, pending: 0 }, observations: {}, cancelled: false,
            sql: null, mock: null, server: null, native: null, browser: null, fence: null, parser: null, proxy: null,
            nativeCleanup: { browser: 'not_started', children: [] },
            render: { schema: 'mission-control.render-smoke-inner-render.v1', ...task4ArtifactBindingV1(ready), viewport: { width: 1440, height: 950 }, preflight: null,
                routes: RENDER_ROUTES.map(route => ({ route, status: 'not_started', code: null, screenshot: null, dom: null, productResponse: null })),
                network: null, filesystem: null, stop: { kind: 'unknown', afterRoute: null } } };
    } catch (error) { rootPin?.close(); authenticated.close(); throw error; }
}

async function task4PostgresV1() { return (await import('postgres')).default; }
async function openTask4ObserverV1(context, state) {
    const postgres = await task4PostgresV1(); context.check();
    const client = postgres(context.ready.database.restrictedUrl, { max: 1, prepare: false, connect_timeout: 5,
        idle_timeout: 0, max_lifetime: 0, ssl: false, onnotice() {}, connection: { application_name: 'task4_observer_' + context.ready.executionId, statement_timeout: 5000 } });
    state.readers.opened++; state.readers.pending++; state.filesystem.operation('create', 'sql_client');
    let original = null, observer = null, closing = false;
    const result = Object.freeze({ get observer() { requireValue(observer !== null, 'TASK4_DATABASE_REFUSED'); return observer; },
        async close() {
            requireValue(!closing, 'TASK4_CLEANUP_UNKNOWN'); closing = true;
            if (original) original.release();
            await task4BoundedV1(client.end(), 8000, 'TASK4_CLEANUP_UNKNOWN');
            state.readers.closed++; state.readers.pending--; state.filesystem.operation('close', 'sql_client');
        } });
    // Retain the original pool before reserve can fail or time out, so the caller's finally still owns its closure.
    state.sql = result; original = await task4BoundedV1(client.reserve(), 8000, 'TASK4_DATABASE_REFUSED'); context.check();
    observer = createTask4ObserverV1(context.ready, original); return result;
}

async function runTask4PreflightV1(context, state) {
    context.check(); const response = await task4PreflightHttpV1(state.serverPort); context.check();
    requireValue(response.status === 200, 'TASK4_ASSERTION_FAILED');
    const expected = task4SeedV1(context.ready.setup.setfarm.source.sourceSha).productResponse;
    requireValue(response.bytes.equals(Buffer.from(task4CanonicalV1(expected))), 'TASK4_ASSERTION_FAILED');
    const body = JSON.parse(response.bytes.toString('utf8')), parsed = state.parser(body, RUN_IDS[1]);
    requireValue(parsed === body && body.disposition === 'sealed_packet' && body.refusal === null
        && task4CanonicalV1(parsed) === task4CanonicalV1(expected), 'TASK4_ASSERTION_FAILED');
    const check = { status: 200, bodyHash: hash(response.bytes), parsedHash: hash(task4CanonicalV1(parsed)), authorityHash: body.authorityHash, packetHash: body.packetAuthority.packetHash };
    state.proxy = state.evidence.put({ schema: 'mission-control.task4-proxy-observation.v1', ...task4ArtifactBindingV1(context.ready),
        at: new Date().toISOString(), method: 'GET', pathId: 'product_1', ...check }); state.render.preflight = check;
}

function task4PreflightHttpV1(serverPort) {
    return new Promise((resolve, reject) => {
        let requestClosed = false, socketClosed = false, connected = false, complete = false, status = null, failed = false, settled = false, length = 0;
        const chunks = [];
        const finish = () => {
            if (settled || !requestClosed || !socketClosed) return;
            settled = true; clearTimeout(timer);
            if (failed || !connected || !complete) reject(Error('TASK4_NETWORK_REFUSED'));
            else resolve({ status, bytes: Buffer.concat(chunks) });
        };
        const request = requestHttp({ host: '127.0.0.1', port: serverPort, path: '/api/setfarm/runs/' + RUN_IDS[1] + '/product-build-authority', method: 'GET', agent: false }, response => {
            status = response.statusCode;
            if (response.headers['content-type'] !== 'application/json; charset=utf-8') failed = true;
            response.on('data', value => { const bytes = Buffer.from(value); length += bytes.length; if (length > 1048576) { failed = true; response.destroy(); } else chunks.push(bytes); });
            response.on('error', () => { failed = true; }); response.on('aborted', () => { failed = true; });
            response.once('end', () => { complete = response.complete === true; finish(); });
        });
        const timer = setTimeout(() => { if (!settled) { settled = true; request.destroy(); reject(Error('TASK4_CLEANUP_UNKNOWN')); } }, 8000);
        request.once('socket', socket => {
            socket.once('connect', () => { connected = socket.remoteAddress === '127.0.0.1' && socket.remotePort === serverPort; });
            socket.on('error', () => { failed = true; }); socket.once('close', () => { socketClosed = true; finish(); });
        });
        request.on('error', () => { failed = true; }); request.once('close', () => { requestClosed = true; finish(); }); request.end();
    });
}

function prepareTask4NativeV1(context, state) {
    const actual = context.owner;
    state.uiOwner = { pid: actual.pid, processStartedAt: actual.startedAt, processGroupId: actual.pgid, source: 'observed_os',
        executable: actual.executable, script: path.join(context.root, 'scripts/render-smoke.mjs'), commandHash: actual.commandHash };
    state.ownerHash = hash(task4CanonicalV1(state.uiOwner));
    return context.modules.native.createUiNativeLifecycleV1({ store: state.evidence.store, jobId: state.jobId,
        intentHash: task4ArtifactBindingV1(context.ready).readyDescriptorHash, ownerHash: state.ownerHash, owner: state.uiOwner,
        cancellationRequested: () => state.cancelled, recordSchema: context.modules.protocol.UiWorkerLifecycleRecordV1Schema });
}

function prepareTask4ServerV1(context, state) {
    context.check(); const launcher = task4FileSnapshotV1('/usr/bin/sandbox-exec', 1048576, 'installed');
    requireValue(launcher.hash === '8290e4be7387a0df83cd1559e86afd880464f269450573d012795761fe298f16', 'TASK4_SOURCE_DRIFT');
    const entry = context.build.files.get('dist-server/index.js'); requireValue(entry, 'TASK4_SOURCE_DRIFT');
    const policy = Buffer.from(task4ServerPolicyV1(context.ready.setup, state.mock.port, state.serverPort));
    const published = task4PrivateBytesV1(context.ready.setup.resourceRoot.path, 'server-launch-policy.sb', policy);
    state.policyHash = published.sha256; state.launcherHash = launcher.hash;
    return createTask4ServerV1(context, state.evidence, task4ServerEnvironmentV1(context, state.mock.port, state.serverPort), state.policyHash, state.launcherHash, entry.hash, state.serverPortReservation);
}

function task4RecordFailureV1(state, error, cleanup = false) {
    const allowed = ['TASK4_ASSERTION_FAILED', 'TASK4_DATABASE_REFUSED', 'TASK4_BINDING_REFUSED', 'TASK4_SOURCE_DRIFT', 'TASK4_NETWORK_REFUSED',
        'TASK4_RESOURCE_REFUSED', 'TASK4_CANCELLED', 'TASK4_QUALIFICATION_ASSERTION_FAILURE', 'TASK4_CLEANUP_UNKNOWN', 'TASK4_INTEGRITY_FAILED', 'TASK4_RESULT_PUBLICATION_FAILED',
        'TASK4_RUNNER_TIMEOUT', 'TASK4_PREPARATION_TIMEOUT', 'TASK4_RUNNER_CLOSED_BEFORE_REQUEST'];
    const code = allowed.includes(error?.message) ? error.message : cleanup ? 'TASK4_CLEANUP_UNKNOWN' : 'TASK4_INTEGRITY_FAILED';
    if (!state.errors.includes(code) && state.errors.length < 16) state.errors.push(code);
    if (cleanup || code === 'TASK4_CLEANUP_UNKNOWN') state.cleanupUnknown = true;
    if (['TASK4_SOURCE_DRIFT', 'TASK4_BINDING_REFUSED', 'TASK4_INTEGRITY_FAILED', 'TASK4_RESULT_PUBLICATION_FAILED'].includes(code)) state.integrity = 'failed';
}
async function finalizeTask4InnerV1(context, state) {
    const ready = context.ready, binding = task4ArtifactBindingV1(ready);
    try {
        try { state.pins.check(); } catch (error) { task4RecordFailureV1(state, error); }
        for (const rootId of ['server_home', 'server_runtime', 'native_home', 'native_profile', 'native_tmp']) {
            try { state.filesystem.capture(rootId, 'after_server_close'); } catch (error) { task4RecordFailureV1(state, error, true); }
        }
        if (state.filesystem.diagnostics().firstFailure) retainTask4FailureDiagnosticsV1(context, state, 'filesystem-failure');
        const filesystem = state.filesystem.value(), filesystemRef = state.evidence.put(filesystem); state.render.filesystem = filesystemRef;
        const network = buildTask4NetworkV1(context, state); state.render.network = state.evidence.put(network);
        const observations = { before: null, after: null };
        for (const phase of ['before', 'after']) if (state.observations[phase]) {
            const value = { schema: 'mission-control.render-smoke-inner-observation.v1', ...binding, phase, ...state.observations[phase],
                syncState: { beforeHash: filesystem.syncState.before?.sha256 ?? null, afterHash: filesystem.syncState.after?.sha256 ?? null, ledger: filesystemRef } };
            observations[phase] = state.evidence.put(value); state.sql.observer.bindObservation(phase, observations[phase]);
        }
        const queryLedger = state.sql ? state.sql.observer.ledger() : null;
        if (queryLedger) state.evidence.put(queryLedger);
        const actual = context.owner, uiOwner = state.uiOwner ?? { pid: actual.pid, processStartedAt: actual.startedAt, processGroupId: actual.pgid,
            source: 'observed_os', executable: actual.executable, script: path.join(context.root, 'scripts/render-smoke.mjs'), commandHash: actual.commandHash };
        const mock = state.mock?.cleanup() ?? { state: 'not_started', listen: null, closeCallback: false, acceptedConnections: 0, closedConnections: 0, listenerAfter: null };
        const server = state.server?.snapshot() ?? { state: 'not_started', intent: null, observed: null, settled: null };
        const complete = !state.cleanupUnknown && ['not_started', 'closed'].includes(state.nativeCleanup.browser)
            && ['not_started', 'closed'].includes(mock.state) && ['not_started', 'closed'].includes(server.state)
            && (!state.serverPortReservation || state.serverPortReservation.closed())
            && state.readers.pending === 0 && state.readers.opened === state.readers.closed
            && state.contexts.pending === 0 && state.contexts.opened === state.contexts.closed;
        if (!complete) task4RecordFailureV1(state, Error('TASK4_CLEANUP_UNKNOWN'), true);
        if (!filesystem.complete || !network.complete || !queryLedger?.complete || !observations.before || !observations.after)
            task4RecordFailureV1(state, Error('TASK4_INTEGRITY_FAILED'));
        if (!state.errors.length && (state.render.routes.length !== 6 || state.render.routes.some(row => row.status !== 'pass') || state.render.preflight === null))
            task4RecordFailureV1(state, Error('TASK4_ASSERTION_FAILED'));
        try { state.pins.check(); } catch (error) { task4RecordFailureV1(state, error); }
        const cleanup = complete && state.integrity === 'verified' ? state.evidence.put({ schema: 'mission-control.render-smoke-inner-cleanup.v1', ...binding,
            ownerHash: hash(task4CanonicalV1(uiOwner)), nativeAudit: { jobId: state.jobId, intentHash: binding.readyDescriptorHash, owner: uiOwner,
                state: state.nativeCleanup.browser, children: state.nativeCleanup.children }, mock, server, readers: { ...state.readers }, contexts: { ...state.contexts }, complete: true }) : null;
        const outcome = state.integrity !== 'verified' || !complete ? 'unknown' : state.errors.length === 0 ? 'pass'
            : state.errors[0] === 'TASK4_CANCELLED' && context.scenario === 'owned_cancel' ? 'cancelled' : 'fail';
        if (outcome === 'unknown') state.render.stop.kind = 'unknown';
        else if (outcome === 'fail') state.render.stop.kind = 'failure';
        const render = state.evidence.put(state.render), artifacts = state.evidence.inventory();
        const value = { schema: 'mission-control.render-smoke-inner-result.v1', executionId: ready.executionId,
            binding: { setupDescriptorHash: ready.setupDescriptorHash, readyDescriptorHash: binding.readyDescriptorHash, resourceRoot: ready.setup.resourceRoot,
                missionControl: ready.setup.missionControl.source, setfarm: ready.setup.setfarm.source, projection: ready.projection,
                database: { name: ready.database.name, role: ready.database.role, restrictedUrlHash: ready.database.restrictedUrlHash }, fixture: ready.fixture, fixtureOwner: ready.fixtureOwner },
            owner: context.owner, scenario: context.scenario, startedAt: state.startedAt, finishedAt: new Date().toISOString(), outcome,
            code: outcome === 'pass' ? null : outcome === 'unknown' ? state.cleanupUnknown ? 'TASK4_CLEANUP_UNKNOWN' : 'TASK4_INTEGRITY_FAILED' : state.errors[0],
            integrity: state.integrity, observations, render, cleanup, artifacts, diagnostics: [...state.errors] };
        const root = captureTask4DirectoryV1(ready.setup.resourceRoot.path, true);
        try { publishTask4FixedV1(root, 'inner-result.json', value); } finally { root.close(); }
        process.exitCode = { pass: 0, fail: 1, cancelled: 130, unknown: 2 }[outcome]; return value;
    } finally { state.pins.close(); }
}

function readTask4FixedV1(rootPin, name, live = false) {
    requireValue(['inner-result.json', 'parent-result.json', 'runner-result.json', 'policy-probe-request.json', 'policy-probe-original.json', 'policy-probe-mock.json', 'policy-probe.json'].includes(name), 'TASK4_INTEGRITY_FAILED');
    rootPin.check(); const file = path.join(rootPin.value.path, name), pending = file + '.pending';
    const present = locator => { try { fs.lstatSync(locator); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
    if (present(pending) || !present(file)) { requireValue(live, 'TASK4_INTEGRITY_FAILED'); return null; }
    const pin = captureTask4FileV1(file, 16384);
    try {
        const stat = fs.lstatSync(file); requireValue(stat.isFile() && stat.nlink === 1 && stat.uid === process.getuid() && (stat.mode & 0o777) === 0o600, 'TASK4_INTEGRITY_FAILED');
        const value = JSON.parse(pin.bytes.toString('utf8')); requireValue(pin.bytes.equals(Buffer.from(task4CanonicalV1(value) + '\n')), 'TASK4_INTEGRITY_FAILED');
        pin.check(); rootPin.check(); requireValue(!present(pending), 'TASK4_INTEGRITY_FAILED');
        return { value, ref: { sha256: hash(pin.bytes), bytes: pin.bytes.length } };
    } finally { pin.close(); }
}

function validateTask4ProbeOriginalV1(original, context, policyHash, launcherHash, mockPort, canaryPort) {
    keys(original, 'schema executionId setupDescriptorHash readyDescriptorHash owner parentOwner policyHash launcherHash executableHash commandHash exit allowed denied stdout stderr stdoutHash stderrHash canaryBefore canaryAfter canaryClosed');
    const binding = task4ArtifactBindingV1(context.ready);
    requireValue(original.schema === 'mission-control.task4-policy-probe-original.v1'
        && Object.entries(binding).every(([key, value]) => original[key] === value)
        && task4CanonicalV1(original.parentOwner) === task4CanonicalV1(context.ready.setup.owner)
        && original.policyHash === policyHash && original.launcherHash === launcherHash, 'TASK4_NETWORK_REFUSED');
    processPin(original.owner);
    requireValue(original.owner.ppid === context.ready.setup.owner.pid && original.owner.uid === context.ready.setup.owner.uid
        && original.owner.executable === context.node && original.owner.executableHash === context.nodeHash && original.executableHash === context.nodeHash
        && original.commandHash === original.owner.commandHash
        && original.commandHash === hash([context.node, '-e', TASK4_POLICY_PROBE_PROGRAM, String(mockPort), String(canaryPort)].join(' ')), 'TASK4_NETWORK_REFUSED');
    for (const key of ['allowed', 'denied']) {
        keys(original[key], 'startedAt finishedAt outcome errno'); date(original[key].startedAt); date(original[key].finishedAt);
        requireValue(original[key].finishedAt >= original[key].startedAt && Date.parse(original[key].finishedAt) - Date.parse(original[key].startedAt) <= 5000, 'TASK4_NETWORK_REFUSED');
    }
    requireValue(original.allowed.startedAt >= original.owner.startedAt && original.denied.startedAt >= original.allowed.finishedAt
        && original.allowed.outcome === 'connected' && original.allowed.errno === null && original.denied.outcome === 'denied' && ['EPERM', 'EACCES'].includes(original.denied.errno), 'TASK4_NETWORK_REFUSED');
    keys(original.exit, 'code signal exitObserved closeObserved');
    requireValue(original.exit.code === 0 && original.exit.signal === null && original.exit.exitObserved === true && original.exit.closeObserved === true, 'TASK4_NETWORK_REFUSED');
    const ordered = value => ({ startedAt: value.startedAt, finishedAt: value.finishedAt, outcome: value.outcome, errno: value.errno });
    requireValue(typeof original.stdout === 'string' && Buffer.byteLength(original.stdout) <= 1024 && original.stderr === ''
        && original.stdoutHash === hash(original.stdout) && original.stderrHash === hash('')
        && original.stdout === JSON.stringify({ schema: 'mission-control.task4-policy-probe-output.v1', allowed: ordered(original.allowed), denied: ordered(original.denied) }) + '\n', 'TASK4_NETWORK_REFUSED');
    for (const key of ['canaryBefore', 'canaryAfter', 'canaryClosed']) {
        keys(original[key], 'sha256 bytes'); requireValue(/^[a-f0-9]{64}$/.test(original[key].sha256) && Number.isSafeInteger(original[key].bytes)
            && original[key].bytes > 0 && original[key].bytes <= 65536, 'TASK4_NETWORK_REFUSED');
    }
}

function readTask4ArtifactV1(rootPin, area, ref) {
    requireValue(['outer', 'inner', 'parent'].includes(area), 'TASK4_INTEGRITY_FAILED'); keys(ref, 'sha256 bytes');
    requireValue(/^[a-f0-9]{64}$/.test(ref.sha256) && Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes <= 1048576, 'TASK4_INTEGRITY_FAILED');
    rootPin.check(); const locator = path.join(rootPin.value.path, area, 'artifacts', ref.sha256 + '.json'), pin = captureTask4FileV1(locator, 1048576);
    try {
        const stat = fs.lstatSync(locator); requireValue(stat.uid === process.getuid() && (stat.mode & 0o777) === 0o600
            && pin.hash === ref.sha256 && pin.bytes.length === ref.bytes, 'TASK4_INTEGRITY_FAILED');
        const value = JSON.parse(pin.bytes.toString('utf8')); requireValue(pin.bytes.equals(Buffer.from(task4CanonicalV1(value) + '\n')), 'TASK4_INTEGRITY_FAILED');
        pin.check(); rootPin.check(); return value;
    } finally { pin.close(); }
}

async function waitTask4FixedV1(context, rootPin, name, deadline) {
    while (true) {
        requireValue(Date.now() < deadline, 'TASK4_NETWORK_REFUSED'); context.check();
        requireValue(Date.now() < deadline, 'TASK4_NETWORK_REFUSED'); const value = readTask4FixedV1(rootPin, name, true);
        context.check(); requireValue(Date.now() < deadline, 'TASK4_NETWORK_REFUSED'); if (value) return value;
        await task4WaitV1(Math.min(25, deadline - Date.now()));
    }
}
async function runTask4InnerProbeV1(context, state) {
    const ready = context.ready, binding = task4ArtifactBindingV1(ready), root = captureTask4DirectoryV1(ready.setup.resourceRoot.path, true), deadline = Date.now() + 30000;
    try {
        publishTask4FixedV1(root, 'policy-probe-request.json', { schema: 'mission-control.task4-policy-probe-request.v1', ...binding,
            innerOwner: context.owner, mockListener: state.mock.listenRef, serverIntent: state.server.intent(), policyHash: state.policyHash, launcherHash: state.launcherHash });
        const observed = await waitTask4FixedV1(context, root, 'policy-probe-original.json', deadline), original = observed.value;
        const canary = (ref, status) => {
            const value = readTask4ArtifactV1(root, 'outer', ref);
            keys(value, 'schema executionId setupDescriptorHash readyDescriptorHash endpointRole host port at state owner acceptedConnections original');
            requireValue(value.schema === 'mission-control.task4-policy-probe-listener.v1' && Object.entries(binding).every(([k, v]) => value[k] === v)
                && value.endpointRole === 'owned_denied_canary' && value.host === '127.0.0.1' && value.state === status
                && task4CanonicalV1(value.owner) === task4CanonicalV1(ready.setup.owner) && value.acceptedConnections === 0
                && task4CanonicalV1(value.original) === task4CanonicalV1({ method: 'owned_http_server', observed: true })
                && Number.isSafeInteger(value.port) && value.port >= 1024 && value.port <= 65535
                && ![state.serverPort, state.mock.port, ready.setup.postgres.port, 3080, 3333, 5432, 13081, 18789].includes(value.port), 'TASK4_NETWORK_REFUSED');
            date(value.at); return value;
        };
        const before = canary(original.canaryBefore, 'listening'), after = canary(original.canaryAfter, 'listening'), closed = canary(original.canaryClosed, 'absent');
        requireValue(before.port === after.port && before.port === closed.port && after.at >= before.at && closed.at >= after.at, 'TASK4_NETWORK_REFUSED');
        validateTask4ProbeOriginalV1(original, context, state.policyHash, state.launcherHash, state.mock.port, before.port);
        requireValue(before.at <= original.denied.startedAt && after.at >= original.denied.finishedAt, 'TASK4_NETWORK_REFUSED');
        await task4BoundedV1(state.mock.waitProbeClose(), Math.max(1, deadline - Date.now()), 'TASK4_NETWORK_REFUSED');
        const receipt = state.mock.probeReceipt(); publishTask4FixedV1(root, 'policy-probe-mock.json', receipt);
        const final = await waitTask4FixedV1(context, root, 'policy-probe.json', deadline), value = final.value;
        keys(value, 'schema executionId setupDescriptorHash readyDescriptorHash policyHash launcherHash owner allowed denied exit closeObserved original');
        requireValue(value.schema === 'mission-control.task4-network-policy-probe.v1' && Object.entries(binding).every(([k, v]) => value[k] === v)
            && value.policyHash === state.policyHash && value.launcherHash === state.launcherHash
            && task4CanonicalV1(value.owner) === task4CanonicalV1(original.owner)
            && task4CanonicalV1(value.exit) === task4CanonicalV1({ code: 0, signal: null }) && value.closeObserved === true
            && task4CanonicalV1(value.original) === task4CanonicalV1(observed.ref)
            && task4CanonicalV1(readTask4ArtifactV1(root, 'outer', value.original)) === task4CanonicalV1(original), 'TASK4_NETWORK_REFUSED');
        for (const [key, endpointRole, first, last, count] of [['allowed', 'owned_allowed_mock', receipt.before, receipt.after, 1], ['denied', 'owned_denied_canary', original.canaryBefore, original.canaryAfter, 0]]) {
            keys(value[key], 'endpointRole startedAt finishedAt outcome errno listenerBefore listenerAfter acceptedConnections');
            requireValue(value[key].endpointRole === endpointRole && value[key].acceptedConnections === count
                && task4CanonicalV1(value[key].listenerBefore) === task4CanonicalV1(first) && task4CanonicalV1(value[key].listenerAfter) === task4CanonicalV1(last)
                && ['startedAt', 'finishedAt', 'outcome', 'errno'].every(field => value[key][field] === original[key][field]), 'TASK4_NETWORK_REFUSED');
        }
        for (const ref of [receipt.before, receipt.after]) requireValue(task4CanonicalV1(readTask4ArtifactV1(root, 'outer', ref)) === task4CanonicalV1(readTask4ArtifactV1(root, 'inner', ref)), 'TASK4_NETWORK_REFUSED');
        context.check(); state.probe = final.ref;
    } finally { root.close(); }
}

function buildTask4NetworkV1(context, state) {
    let server = null; try { server = state.server?.binding() ?? null; } catch { /* Missing original binding cannot qualify the ledger. */ }
    const browser = state.fence?.value() ?? { browserInstalledAt: null, browser: [], complete: false };
    return freeze({ schema: 'mission-control.task4-network-ledger.v1', ...task4ArtifactBindingV1(context.ready),
        policy: { recipeHash: hash(task4CanonicalV1(state.networkRecipes)), browserInstalledAt: browser.browserInstalledAt,
            serverPolicyHash: state.policyHash ?? null, serverLaunchRef: server?.observed ?? null },
        browser: browser.browser, mock: state.mock?.rows() ?? [],
        osFence: { coverage: 'server_launch_policy_bound_parent_probe_required', policyHash: state.policyHash ?? null, launcherHash: state.launcherHash ?? null,
            serverOwner: server?.owner ?? null, probe: 'parent_originals_required', actualAllowed: { proxy: state.proxy, sql: 'parent_originals_required' }, denialTelemetry: 'unavailable' },
        complete: Boolean(browser.complete && state.mock?.complete() && server && state.proxy && state.probe) });
}

async function runTask4OuterV1(context) {
    requireValue(context.ready === null, 'TASK4_BINDING_REFUSED'); context.check();
    const state = await prepareTask4OuterResourcesV1(context);
    try {
        await startTask4PostgresV1(context, state);
        await startTask4RunnerV1(context, state);
        await runTask4OuterProbeV1(context, state);
    } catch (error) { task4RecordFailureV1(state, error); }
    finally {
        if (state.runner) {
            try {
                await state.runner.wait();
                state.paired = await readTask4PairedResultsV1(context, state);
            } catch (error) { task4RecordFailureV1(state, error, true); }
        }
        // Only this original postmaster handle may be stopped, after independent child settlement.
        if (state.postgres && state.adminClosed !== false && (!state.runner || state.paired?.closed === true)) {
            try { await state.postgres.close(); } catch (error) { task4RecordFailureV1(state, error, true); }
        } else if (state.postgres) task4RecordFailureV1(state, Error('TASK4_CLEANUP_UNKNOWN'), true);
        for (const guard of [state.canary, state.portReservation]) if (guard && !guard.closed()) {
            try { await guard.close(); } catch (error) { task4RecordFailureV1(state, error, true); }
        }
        try { context.check(); } catch (error) { task4RecordFailureV1(state, error); }
    }
    return finalizeTask4OuterV1(context, state);
}

function task4PostgresRecipeV1(root, port) {
    requireValue(Number.isSafeInteger(port) && port >= 1024 && port <= 65535 && ![3080, 3333, 5432, 13081, 18789].includes(port), 'TASK4_RESOURCE_REFUSED');
    const data = path.join(root, 'postgres-data'), socket = path.join(root, 'postgres-socket');
    return { initdb: ['-D', data, '-U', 'task4_admin', '--pwfile=' + path.join(root, 'postgres-password'), '--encoding=UTF8', '--locale=C',
        '--auth-local=scram-sha-256', '--auth-host=scram-sha-256', '--no-instructions'],
        postgres: ['-D', data, '-p', String(port), '-k', socket, ...[
            'listen_addresses=127.0.0.1', 'unix_socket_permissions=0700', 'max_connections=24', 'shared_buffers=32MB',
            'log_destination=stderr', 'logging_collector=off', 'log_line_prefix=%m|%p|%c|%u|%d|%a|%e| ',
            'log_error_verbosity=terse', 'log_timezone=UTC', 'timezone=UTC', 'lc_messages=C', 'log_statement=none',
            'log_min_error_statement=panic', 'log_parameter_max_length=0', 'log_parameter_max_length_on_error=0',
        ].flatMap(value => ['-c', value])],
        env: { HOME: path.join(root, 'home'), TMPDIR: path.join(root, 'tmp'), PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', TZ: 'UTC' } };
}

async function prepareTask4OuterResourcesV1(context) {
    context.check();
    const parent = fs.realpathSync(tmpdir()), disk = fs.statfsSync(parent, { bigint: true });
    requireValue(disk.bavail * disk.bsize >= 8589934592n, 'TASK4_RESOURCE_REFUSED');
    const executionId = randomBytes(16).toString('hex'), locator = path.join(parent, 'task4-' + executionId);
    fs.mkdirSync(locator, { mode: 0o700 }); const root = captureTask4DirectoryV1(locator, true);
    context.resourceRoot = root.value;
    for (const name of ['home', 'tmp', 'postgres-data', 'postgres-socket', 'outer', 'outer/artifacts', 'outer/originals']) fs.mkdirSync(path.join(locator, name), { mode: 0o700 });
    root.check(); context.check();
    process.stdout.write(task4CanonicalV1({ schema: 'mission-control.render-smoke-outer-started.v1', executionId, resourceRoot: locator }) + '\n');
    return { executionId, root, startedAt: new Date().toISOString(), errors: [], integrity: 'verified', cleanupUnknown: false, postgres: null, runner: null, paired: null,
        initdb: null, setup: null, setupRef: null, probe: null, canary: null, probeOriginal: null };
}

async function createTask4PortGuardV1(context, state, role) {
    requireValue(['canary', 'portReservation', 'serverPortReservation'].includes(role) && !state[role], 'TASK4_RESOURCE_REFUSED');
    const server = createHttpServer(); let port = null, accepted = 0, closed = 0, callback = false, fault = false, before = null;
    server.on('connection', socket => { accepted++; socket.on('close', () => { closed++; }); });
    server.on('error', () => { fault = true; });
    const controller = Object.freeze({ get port() { return port; },
        snapshot() { requireValue(!fault && accepted === 0 && closed === 0, 'TASK4_NETWORK_REFUSED');
            return { at: new Date().toISOString(), state: server.listening ? 'listening' : callback && server.address() === null ? 'absent' : 'unknown', acceptedConnections: accepted }; },
        closed() { return callback && !server.listening && server.address() === null && accepted === closed && !fault; },
        async close() {
            requireValue(!callback && server.listening && accepted === 0, 'TASK4_CLEANUP_UNKNOWN');
            await task4BoundedV1(new Promise((resolve, reject) => server.close(error => { if (error) reject(error); else { callback = true; resolve(); } })), 5000, 'TASK4_CLEANUP_UNKNOWN');
            requireValue(controller.closed(), 'TASK4_CLEANUP_UNKNOWN'); context.check();
            if (role === 'serverPortReservation') task4PrivateBytesV1(path.join(context.ready.setup.resourceRoot.path, 'inner/originals'), 'server.reservation.json',
                Buffer.from(task4CanonicalV1({ ...task4ArtifactBindingV1(context.ready), owner: context.owner, port, before, after: controller.snapshot(), closed: true }) + '\n'));
        },
    });
    state[role] = controller;
    await task4BoundedV1(new Promise((resolve, reject) => { server.once('error', reject); server.listen({ host: '127.0.0.1', port: 0, exclusive: true }, resolve); }), 5000, 'TASK4_RESOURCE_REFUSED');
    const address = server.address(); requireValue(address?.address === '127.0.0.1' && address.family === 'IPv4', 'TASK4_RESOURCE_REFUSED');
    port = address.port; requireValue(port >= 1024 && ![3080, 3333, 5432, 13081, 18789, state.setup?.postgres.port, context.ready?.setup.postgres.port, state.mock?.port, state.serverPort].includes(port), 'TASK4_RESOURCE_REFUSED');
    before = controller.snapshot(); context.check(); return controller;
}

function createTask4PostmasterV1(context, state, recipe) {
    const executable = path.join(TASK4_PG_BIN, 'postgres');
    const logfile = path.join(state.root.value.path, 'postgres.stderr.log');
    const logfd = fs.openSync(logfile, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    let child = null, original = null, owner = null, settled = null, unknown = false;
    const controller = Object.freeze({
        async observe() {
            requireValue(!unknown && child && original, 'TASK4_CLEANUP_UNKNOWN');
            const current = await task4ObservePostmasterV1(context, child, recipe);
            if (owner) requireValue(task4CanonicalV1(current) === task4CanonicalV1(owner), 'TASK4_BINDING_REFUSED');
            owner = current; return current;
        },
        get owner() { return owner; }, get child() { return child; },
        async close() {
            try {
                requireValue(!unknown && !settled && owner && child && original, 'TASK4_CLEANUP_UNKNOWN');
                if (!original.ended()) {
                    await controller.observe(); await task4PostgresCensusV1(context, state, false);
                    requireValue(child.kill('SIGTERM') === true, 'TASK4_CLEANUP_UNKNOWN');
                }
                const exit = await original.wait(30000);
                requireValue(exit.code === 0 && exit.signal === null, 'TASK4_CLEANUP_UNKNOWN');
                await task4PostgresCensusV1(context, state, true);
                requireValue(await task4OuterListenerV1(context, state, state.pgPort, null) === 'absent', 'TASK4_CLEANUP_UNKNOWN');
                context.check(); state.root.check();
                const log = task4FileSnapshotV1(logfile, 67108864);
                settled = { owner, exit, logHash: log.hash, cohort: state.pgCohort, absence: state.pgAbsence };
            } catch (error) { unknown = true; throw error; }
        },
        settlement() { return settled; },
    });
    state.postgres = controller;
    try {
        context.check(); child = spawn(executable, recipe.postgres, { cwd: state.root.value.path, env: recipe.env, detached: false, stdio: ['ignore', 'ignore', logfd] });
        original = retainTask4ChildV1(child); requireValue(Number.isSafeInteger(child.pid), 'TASK4_RESOURCE_REFUSED');
    } finally { fs.closeSync(logfd); }
    return controller;
}

async function task4PostgresCensusV1(context, state, after) {
    const reader = context.modules.native.createUiPsReaderV1(), owner = state.postgres.owner;
    const snapshot = async suffix => {
        context.check(); state.root.check();
        const raw = await reader(['-ww', '-A', '-o', 'pid=', '-o', 'ppid=', '-o', 'pgid=', '-o', 'uid=', '-o', 'lstart=']);
        context.check(); const rows = context.modules.native.parseUiMetadataSnapshotV1(raw), observedAtMs = Date.now();
        const original = task4PrivateBytesV1(path.join(state.root.value.path, 'outer/originals'), 'postgres-census-' + suffix + '.log', Buffer.from(raw));
        task4PrivateBytesV1(path.join(state.root.value.path, 'outer/originals'), 'postgres-census-' + suffix + '.json',
            Buffer.from(task4CanonicalV1({ raw: original, metadataHash: hash(raw), observedAtMs }) + '\n'));
        return { rows, metadataHash: hash(raw), observedAtMs };
    };
    if (!after) {
        requireValue(!state.pgCohort, 'TASK4_CLEANUP_UNKNOWN');
        const fields = ['pid', 'ppid', 'pgid', 'uid', 'startedAt'];
        const select = rows => {
            const root = rows.find(row => row.pid === owner.pid);
            requireValue(root && fields.every(key => root[key] === owner[key]), 'TASK4_BINDING_REFUSED');
            const ids = new Set([owner.pid]); let changed = true;
            while (changed) { changed = false; for (const row of rows) if (ids.has(row.ppid) && !ids.has(row.pid)) { ids.add(row.pid); changed = true; } requireValue(ids.size <= 256, 'TASK4_CLEANUP_UNKNOWN'); }
            return rows.filter(row => ids.has(row.pid)).sort((a, b) => a.pid - b.pid);
        };
        const bind = async rows => {
            const retained = [];
            for (const row of rows) {
                requireValue(row.uid === context.owner.uid, 'TASK4_BINDING_REFUSED');
                const observed = await context.modules.native.observeUiProcessV1(row.pid); context.check();
                requireValue(fields.every(key => row[key] === observed[key]) && observed.executable === owner.executable, 'TASK4_BINDING_REFUSED');
                retained.push({ ...row, executable: observed.executable, commandHash: hash(observed.rawArgs) });
            }
            return retained;
        };
        const first = select((await snapshot('before-1')).rows);
        state.pgCohort = await bind(first);
        const second = select((await snapshot('before-2')).rows);
        requireValue(task4CanonicalV1(first) === task4CanonicalV1(second), 'TASK4_BINDING_REFUSED');
        await bind(second); return;
    }
    requireValue(Array.isArray(state.pgCohort) && state.pgCohort.length > 0 && state.pgCohort.some(row => row.pid === owner.pid), 'TASK4_CLEANUP_UNKNOWN');
    const absent = [];
    for (let i = 0; i < 2; i++) {
        if (i) await task4WaitV1(100);
        const value = await snapshot('after-' + (i + 1)), ids = new Set(state.pgCohort.map(row => row.pid));
        requireValue(value.rows.every(row => !ids.has(row.pid) && !ids.has(row.ppid)), 'TASK4_CLEANUP_UNKNOWN');
        absent.push({ observedAtMs: value.observedAtMs, metadataHash: value.metadataHash, rowCount: value.rows.length });
    }
    requireValue(absent[1].observedAtMs - absent[0].observedAtMs >= 100, 'TASK4_CLEANUP_UNKNOWN'); state.pgAbsence = absent;
}

async function startTask4PostgresV1(context, state) {
    context.check(); state.root.check(); const binaries = task4PinnedPgV1(), root = state.root.value.path;
    const reservation = await createTask4PortGuardV1(context, state, 'portReservation'), port = reservation.port;
    const recipe = task4PostgresRecipeV1(root, port), password = randomBytes(32).toString('hex');
    task4PrivateBytesV1(root, 'postgres-password', Buffer.from(password + '\n'));
    state.adminUrl = 'postgres://task4_admin:' + password + '@127.0.0.1:' + port + '/postgres'; state.pgPort = port; state.pgRecipe = recipe;
    const child = spawn(binaries.initdb, recipe.initdb, { cwd: root, env: recipe.env, detached: false, stdio: ['ignore', 'pipe', 'pipe'] });
    const original = retainTask4ChildV1(child); state.initdb = { child, original, exit: null };
    const exit = await original.wait(30000); state.initdb.exit = exit; task4SaveOriginalV1(context, 'initdb', original.originals());
    requireValue(exit.code === 0 && exit.signal === null, 'TASK4_DATABASE_REFUSED'); context.check(); task4PinnedPgV1();
    await reservation.close();
    const pg = createTask4PostmasterV1(context, state, recipe), owner = await pg.observe();
    const startedAt = await task4AwaitPostgresV1(context, state);
    const data = captureTask4DirectoryV1(path.join(root, 'postgres-data'), true), socket = captureTask4DirectoryV1(path.join(root, 'postgres-socket'), true);
    try {
        const value = { schema: 'setfarm.mc-render-smoke-setup.v1', executionId: state.executionId, owner: context.owner, resourceRoot: state.root.value,
            setfarm: { source: context.launch.setfarm, rootPin: context.sf.rootPin,
                runnerHash: task4FileSnapshotV1(path.join(context.launch.setfarm.root, 'scripts/run-isolated-postgres-tests.ts')).hash,
                fixtureHash: task4FileSnapshotV1(path.join(context.launch.setfarm.root, 'tests/fixtures/mission-control-render-smoke-owned-v1.ts')).hash,
                migrationHash: task4FileSnapshotV1(path.join(context.launch.setfarm.root, 'src/db/contract-spine-migrations.ts')).hash },
            missionControl: { source: context.launch.missionControl, rootPin: context.mc.rootPin },
            postgres: { host: '127.0.0.1', port, major: 17, versionNum: 170010, process: owner, data: data.value, socket: socket.value,
                serverStartedAt: startedAt, adminUrlHash: hash(state.adminUrl) } };
        state.setup = parseTask4FrameV1(Buffer.from(task4CanonicalV1(value) + '\n'), 'setup');
        state.setupRef = task4PrivateBytesV1(root, 'setup.json', Buffer.from(task4CanonicalV1(state.setup) + '\n'));
    } finally { data.close(); socket.close(); }
}

function task4PinnedPgV1() {
    const fixed = { initdb: '43f864de4746e096246a2a9f9784ccbd7364b35b2301b82aeeb6d2a12c1912c4', postgres: '38c50336c63ae8b73b799a8c0ebc4f948e311eee882a633c8286d1ca4110b502',
        pg_ctl: 'ba12d9fbe4492e3ab0e8bcedd53e3a0da8163fd8c2cef340dfaf619af0e132c5', psql: 'bb4ef660720948d242d8c4e32450ae5607241510dc8f06cf685048e4c493447d' };
    const result = {};
    for (const [name, expected] of Object.entries(fixed)) {
        const locator = path.join(TASK4_PG_BIN, name);
        requireValue(task4FileSnapshotV1(locator, 536870912, 'installed').hash === expected, 'TASK4_SOURCE_DRIFT'); result[name] = locator;
    }
    return result;
}
async function task4ObservePostmasterV1(context, child, recipe) {
    const binaries = task4PinnedPgV1(), observed = await context.modules.native.observeUiProcessV1(child.pid); context.check();
    return bindTask4ProcessV1(observed, { pid: child.pid, ppid: context.owner.pid, uid: context.owner.uid, executable: binaries.postgres,
        executableHash: '38c50336c63ae8b73b799a8c0ebc4f948e311eee882a633c8286d1ca4110b502', rawArgs: [binaries.postgres, ...recipe.postgres].join(' ') });
}

async function task4AwaitPostgresV1(context, state) {
    const deadline = Date.now() + 10000;
    while (true) {
        requireValue(Date.now() < deadline, 'TASK4_DATABASE_REFUSED'); const owner = await state.postgres.observe();
        if (await task4OuterListenerV1(context, state, state.pgPort, owner) === 'listening') break;
        await task4WaitV1(50);
    }
    const postgres = await task4PostgresV1();
    const sql = postgres(state.adminUrl, { max: 1, prepare: false, fetch_types: false, connect_timeout: 5, idle_timeout: 0, max_lifetime: 0,
        ssl: false, onnotice() {}, connection: { application_name: 'task4_outer_' + state.executionId, statement_timeout: 5000 } });
    state.adminClosed = false;
    try {
        const rows = await task4BoundedV1(sql.unsafe(`SELECT current_database() AS database, current_user AS role,
            current_setting('data_directory') AS data_directory, current_setting('port')::int AS port,
            current_setting('server_version_num')::int AS version,
            to_char(pg_postmaster_start_time() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS started_at`), 8000, 'TASK4_DATABASE_REFUSED');
        context.check(); requireValue(rows.length === 1 && rows[0].database === 'postgres' && rows[0].role === 'task4_admin'
            && rows[0].data_directory === path.join(state.root.value.path, 'postgres-data') && rows[0].port === state.pgPort
            && rows[0].version === 170010, 'TASK4_DATABASE_REFUSED'); date(rows[0].started_at, true); return rows[0].started_at;
    } finally { await task4BoundedV1(sql.end({ timeout: 5 }), 8000, 'TASK4_CLEANUP_UNKNOWN'); state.adminClosed = true; }
}

async function task4OuterListenerV1(context, state, port, owner) {
    requireValue(Number.isSafeInteger(port) && port >= 1024 && port <= 65535, 'TASK4_RESOURCE_REFUSED');
    const argv = ['-nP', '-iTCP:' + port, '-sTCP:LISTEN', '-Fpcfn'];
    const child = spawn('/usr/sbin/lsof', argv, { detached: false, stdio: ['ignore', 'pipe', 'pipe'],
        env: { HOME: path.join(state.root.value.path, 'home'), PATH: '/usr/bin:/bin:/usr/sbin:/sbin', LANG: 'C', LC_ALL: 'C', TZ: 'UTC' } });
    const original = retainTask4ChildV1(child, 16384), exit = await original.wait(5000), bytes = original.originals(); context.check();
    const sequence = (state.listenerSequence ?? 0) + 1; requireValue(sequence <= 256, 'TASK4_RESOURCE_REFUSED'); state.listenerSequence = sequence;
    task4PrivateBytesV1(path.join(state.root.value.path, 'outer/originals'), 'lsof-' + String(sequence).padStart(4, '0') + '.json',
        Buffer.from(task4CanonicalV1({ port, expectedOwner: owner, executable: '/usr/sbin/lsof', argv, exit,
            stdout: bytes.stdout, stderr: bytes.stderr, stdoutHash: hash(bytes.stdout), stderrHash: hash(bytes.stderr) }) + '\n'));
    return classifyTask4ListenerV1({ stdout: bytes.stdout, stderr: bytes.stderr, exit }, port, exit.code === 1 && bytes.stdout === '' ? null : owner?.pid ?? null);
}

async function startTask4RunnerV1(context, state) {
    context.check(); requireValue(state.setup, 'TASK4_BINDING_REFUSED');
    const root = state.root.value.path, argv = ['--import', 'tsx', path.join(context.launch.setfarm.root, 'scripts/run-isolated-postgres-tests.ts'), '--',
        'node', '--import', 'tsx', '--test', '--test-concurrency=1', 'tests/fixtures/mission-control-render-smoke-owned-v1.ts'];
    const startedAt = Date.now(), preparationDeadline = startedAt + 600000, attemptDeadline = startedAt + 1200000;
    const child = spawn(context.node, argv, { cwd: context.launch.setfarm.root, detached: false, stdio: ['ignore', 'pipe', 'pipe', 'ignore', 'pipe'],
        env: { HOME: path.join(root, 'home'), TMPDIR: path.join(root, 'tmp'), PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', TZ: 'UTC',
            TSX_DISABLE_CACHE: '1', SETFARM_TEST_PG_ADMIN_URL: state.adminUrl } });
    const original = retainTask4ChildV1(child, 1048576); let owner = null, delivered = false, exit = null, saved = false, completion = null;
    // Both budgets start once at this original spawn. Attach completion immediately and never restart it on polls/waits.
    const terminal = (async () => {
        const remaining = attemptDeadline - Date.now(); requireValue(remaining > 0, 'TASK4_RUNNER_TIMEOUT');
        return await original.wait(remaining);
    })().then(value => (completion = { value, error: null }), error => (completion = { value: null, error }));
    state.runner = Object.freeze({ child, preparationDeadline, attemptDeadline, get owner() { return owner; },
        deliveryFinished() { return delivered; }, exit() { return exit; }, completed() { return completion !== null; },
        async wait() {
            const completed = await terminal; exit = completed.value;
            if (!saved) {
                try { task4SaveOriginalV1(context, 'runner', original.originals()); saved = true; }
                catch (error) { if (!completed.error) throw error; }
            }
            if (completed.error) throw completed.error; context.check(); return exit;
        } });
    requireValue(Number.isSafeInteger(child.pid), 'TASK4_RESOURCE_REFUSED');
    const observed = await context.modules.native.observeUiProcessV1(child.pid); context.check();
    owner = bindTask4ProcessV1(observed, { pid: child.pid, ppid: context.owner.pid, uid: context.owner.uid,
        executable: context.node, executableHash: context.nodeHash, rawArgs: [context.node, ...argv].join(' ') });
    await task4WriteOriginalV1(child.stdio[4], Buffer.from(task4CanonicalV1(state.setup) + '\n')); delivered = true; context.check();
}

function task4WriteOriginalV1(stream, bytes) {
    requireValue(stream && typeof stream.end === 'function' && Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= 16384, 'TASK4_FRAME_INVALID');
    return new Promise((resolve, reject) => {
        let settled = false, timer;
        const finish = error => { if (settled) return; settled = true; clearTimeout(timer); if (error) reject(Error('TASK4_FRAME_UNAVAILABLE')); else resolve(); };
        stream.once('finish', () => finish(null)); stream.once('error', () => finish(true)); stream.once('close', () => finish(true));
        timer = setTimeout(() => finish(true), 5000);
        try { stream.end(bytes); } catch { finish(true); }
    });
}

async function authenticateTask4ProbeRequestV1(context, state, request) {
    keys(request, 'schema executionId setupDescriptorHash readyDescriptorHash innerOwner mockListener serverIntent policyHash launcherHash');
    requireValue(request.schema === 'mission-control.task4-policy-probe-request.v1' && request.executionId === state.setup.executionId
        && request.setupDescriptorHash === hash(task4CanonicalV1(state.setup) + '\n'), 'TASK4_BINDING_REFUSED');
    for (const key of ['readyDescriptorHash', 'policyHash', 'launcherHash']) hex(request[key]); processPin(request.innerOwner);
    const binding = { executionId: request.executionId, setupDescriptorHash: request.setupDescriptorHash, readyDescriptorHash: request.readyDescriptorHash };
    const observed = await context.modules.native.observeUiProcessV1(request.innerOwner.pid); context.check();
    const inner = bindTask4ProcessV1(observed, { ...request.innerOwner, uid: context.owner.uid, executable: context.node, executableHash: context.nodeHash,
        rawArgs: [context.node, path.join(context.root, 'scripts/render-smoke.mjs'), '--owned-fixture-ready-v1'].join(' ') });
    requireValue(task4CanonicalV1(inner) === task4CanonicalV1(request.innerOwner), 'TASK4_BINDING_REFUSED');
    const parent = await context.modules.native.observeUiProcessV1(inner.ppid); context.check();
    const fixture = bindTask4ProcessV1(parent, { pid: inner.ppid, ppid: state.runner.owner.pid, uid: context.owner.uid, executable: context.node, executableHash: context.nodeHash,
        rawArgs: [context.node, '--import', 'tsx', '--test', '--test-concurrency=1', 'tests/fixtures/mission-control-render-smoke-owned-v1.ts'].join(' ') });
    requireValue(fixture.ppid === state.runner.owner.pid, 'TASK4_BINDING_REFUSED');
    const mock = readTask4ArtifactV1(state.root, 'inner', request.mockListener);
    keys(mock, 'schema executionId setupDescriptorHash readyDescriptorHash endpointRole host port at state owner original');
    requireValue(mock.schema === 'mission-control.task4-listener.v1' && Object.entries(binding).every(([k, v]) => mock[k] === v)
        && mock.endpointRole === 'mock' && mock.host === '127.0.0.1' && mock.state === 'listening'
        && task4CanonicalV1(mock.owner) === task4CanonicalV1(inner)
        && task4CanonicalV1(mock.original) === task4CanonicalV1({ method: 'owned_http_server', observed: true }), 'TASK4_BINDING_REFUSED'); date(mock.at);
    const published = task4FileSnapshotV1(path.join(state.setup.resourceRoot.path, 'server-launch-policy.sb'), 16384);
    const ports = [...published.bytes.toString('utf8').matchAll(/^\(allow network-bind \(local ip "localhost:([1-9][0-9]{3,4})"\)\)$/gm)];
    requireValue(ports.length === 1, 'TASK4_SOURCE_DRIFT'); const serverPort = Number(ports[0][1]);
    const policy = task4ServerPolicyV1(state.setup, mock.port, serverPort);
    requireValue(published.bytes.equals(Buffer.from(policy)) && published.hash === request.policyHash
        && request.launcherHash === '8290e4be7387a0df83cd1559e86afd880464f269450573d012795761fe298f16'
        && task4FileSnapshotV1('/usr/bin/sandbox-exec', 16777216, 'installed').hash === request.launcherHash, 'TASK4_SOURCE_DRIFT');
    const intent = readTask4ArtifactV1(state.root, 'inner', request.serverIntent), entry = path.join(context.root, 'dist-server/index.js');
    keys(intent, 'schema executionId setupDescriptorHash readyDescriptorHash parentOwner executable executableHash entry entryHash argvHash environmentHash policyHash launcherHash');
    requireValue(intent.schema === 'mission-control.task4-server-intent.v1' && Object.entries(binding).every(([k, v]) => intent[k] === v)
        && task4CanonicalV1(intent.parentOwner) === task4CanonicalV1(inner) && intent.executable === context.node && intent.executableHash === context.nodeHash
        && intent.entry === entry && intent.entryHash === task4FileSnapshotV1(entry, 16777216).hash
        && intent.argvHash === hash(task4CanonicalV1([entry])) && intent.policyHash === request.policyHash && intent.launcherHash === request.launcherHash, 'TASK4_BINDING_REFUSED');
    hex(intent.environmentHash); context.check();
    requireValue(await task4OuterListenerV1(context, state, serverPort, inner) === 'listening', 'TASK4_BINDING_REFUSED');
    context.check(); return { request, binding, inner, fixture, mock, intent, serverPort };
}

function readTask4ProbeReadyV1(child, original, deadline) {
    const stream = child.stdio[4], chunks = []; let size = 0, ended = false, settled = false, timer;
    const wait = new Promise((resolve, reject) => {
        if (!stream) { settled = true; reject(Error('TASK4_NETWORK_REFUSED')); return; }
        const finish = success => {
            if (settled) return; settled = true; clearTimeout(timer);
            for (const [name, handler] of [['data', data], ['end', end], ['close', close], ['error', error]]) stream.removeListener(name, handler);
            child.removeListener('close', originalClose);
            if (success) resolve(); else { stream.destroy(); reject(Error('TASK4_NETWORK_REFUSED')); }
        };
        const data = chunk => {
            if (settled) return;
            if (ended || !Buffer.isBuffer(chunk)) return finish(false);
            const keep = Math.max(0, 19 - size); chunks.push(Buffer.from(chunk.subarray(0, keep))); size += chunk.length;
            if (size > 18) finish(false);
        };
        const end = () => { ended = true; stream.destroy(); };
        const close = () => finish(ended && Date.now() < deadline && !original.ended()
            && Buffer.concat(chunks).equals(Buffer.from('task4-probe-ready\n')));
        const error = () => finish(false), originalClose = () => finish(false);
        stream.on('data', data); stream.once('end', end); stream.once('close', close); stream.once('error', error); child.once('close', originalClose);
        if (original.ended() || Date.now() >= deadline) finish(false);
        else timer = setTimeout(() => finish(false), deadline - Date.now());
    });
    return { wait, bytes: () => Buffer.concat(chunks) };
}

async function executeTask4ProbeV1(context, state, authenticated) {
    const root = state.root.value.path, program = TASK4_POLICY_PROBE_PROGRAM, ports = [String(authenticated.mock.port), String(state.canary.port)];
    const startedAt = Date.now(), deadline = startedAt + 15000;
    const child = spawn('/usr/bin/sandbox-exec', ['-f', path.join(root, 'server-launch-policy.sb'), context.node, '-e', program, ...ports],
        { cwd: root, detached: false, stdio: ['ignore', 'pipe', 'pipe', 'pipe', 'pipe'], env: { HOME: path.join(root, 'home'), TMPDIR: path.join(root, 'tmp'),
            PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', TZ: 'UTC' } });
    const original = retainTask4ChildV1(child, 1024), terminal = original.wait(Math.max(1, deadline - Date.now())).then(value => ({ value, error: null }), error => ({ value: null, error }));
    state.probeOriginal = { child, original, owner: null, exit: null };
    const readiness = readTask4ProbeReadyV1(child, original, startedAt + 5000);
    let firstError = null;
    try {
        await readiness.wait; context.check();
        requireValue(Number.isSafeInteger(child.pid) && !original.ended() && Date.now() < startedAt + 5000, 'TASK4_NETWORK_REFUSED');
        const observed = await context.modules.native.observeUiProcessV1(child.pid); context.check();
        state.probeOriginal.owner = bindTask4ProcessV1(observed, { pid: child.pid, ppid: context.owner.pid, uid: context.owner.uid,
            executable: context.node, executableHash: context.nodeHash, rawArgs: [context.node, '-e', program, ...ports].join(' ') });
        requireValue(!original.ended() && Date.now() < deadline, 'TASK4_NETWORK_REFUSED');
        await task4WriteOriginalV1(child.stdio[3], Buffer.from('task4-probe-start\n'));
    } catch (error) { firstError = error; }
    const completed = await terminal; state.probeOriginal.exit = completed.value;
    const raw = original.originals();
    try { task4PrivateBytesV1(path.join(root, 'outer/originals'), 'probe.ready-prefix.log', readiness.bytes()); } catch (error) { firstError ??= error; }
    task4SaveOriginalV1(context, 'probe', raw); context.check();
    if (firstError) throw firstError; if (completed.error) throw completed.error;
    const exit = completed.value;
    requireValue(exit.code === 0 && exit.signal === null && exit.exitObserved && exit.closeObserved && raw.stderr === ''
        && Buffer.byteLength(raw.stdout) <= 1024, 'TASK4_NETWORK_REFUSED');
    const value = JSON.parse(raw.stdout); keys(value, 'schema allowed denied');
    requireValue(value.schema === 'mission-control.task4-policy-probe-output.v1', 'TASK4_NETWORK_REFUSED');
    for (const row of [value.allowed, value.denied]) {
        keys(row, 'startedAt finishedAt outcome errno'); date(row.startedAt); date(row.finishedAt);
        requireValue(row.finishedAt >= row.startedAt && Date.parse(row.finishedAt) - Date.parse(row.startedAt) <= 5000, 'TASK4_NETWORK_REFUSED');
    }
    requireValue(value.allowed.startedAt >= state.probeOriginal.owner.startedAt && value.denied.startedAt >= value.allowed.finishedAt
        && value.allowed.outcome === 'connected' && value.allowed.errno === null && value.denied.outcome === 'denied'
        && ['EPERM', 'EACCES'].includes(value.denied.errno), 'TASK4_NETWORK_REFUSED');
    const ordered = v => ({ startedAt: v.startedAt, finishedAt: v.finishedAt, outcome: v.outcome, errno: v.errno });
    requireValue(raw.stdout === JSON.stringify({ schema: value.schema, allowed: ordered(value.allowed), denied: ordered(value.denied) }) + '\n', 'TASK4_NETWORK_REFUSED');
    return { owner: state.probeOriginal.owner, exit, allowed: value.allowed, denied: value.denied,
        stdout: raw.stdout, stderr: raw.stderr, stdoutHash: raw.stdoutHash, stderrHash: raw.stderrHash };
}

async function waitTask4PreparationV1(context, state) {
    const runner = state.runner, deadline = runner.preparationDeadline;
    const check = () => {
        requireValue(Date.now() < deadline, 'TASK4_PREPARATION_TIMEOUT'); context.check();
        const completed = runner.completed(); requireValue(Date.now() < deadline, 'TASK4_PREPARATION_TIMEOUT'); return completed;
    };
    while (true) {
        if (check()) { await runner.wait(); fail('TASK4_RUNNER_CLOSED_BEFORE_REQUEST'); }
        const value = readTask4FixedV1(state.root, 'policy-probe-request.json', true);
        if (check()) { await runner.wait(); fail('TASK4_RUNNER_CLOSED_BEFORE_REQUEST'); }
        if (value) return value;
        await task4WaitV1(Math.min(25, deadline - Date.now()));
    }
}

async function runTask4OuterProbeV1(context, state) {
    const requestFile = await waitTask4PreparationV1(context, state);
    const authenticated = await authenticateTask4ProbeRequestV1(context, state, requestFile.value), { request, binding, inner, mock } = authenticated;
    state.probeRequest = authenticated;
    const deadline = Date.parse(mock.at) + 30000; requireValue(Date.now() < deadline, 'TASK4_NETWORK_REFUSED');
    const canary = await createTask4PortGuardV1(context, state, 'canary'); requireValue(canary.port !== mock.port && canary.port !== authenticated.serverPort, 'TASK4_NETWORK_REFUSED');
    const listener = () => ({ schema: 'mission-control.task4-policy-probe-listener.v1', ...binding, endpointRole: 'owned_denied_canary',
        host: '127.0.0.1', port: canary.port, ...canary.snapshot(), owner: context.owner, original: { method: 'owned_http_server', observed: true } });
    let original, before, after, closed;
    try {
        before = listener(); requireValue(before.state === 'listening', 'TASK4_NETWORK_REFUSED');
        const result = await executeTask4ProbeV1(context, state, authenticated);
        after = listener(); requireValue(after.state === 'listening' && before.at <= result.denied.startedAt && after.at >= result.denied.finishedAt, 'TASK4_NETWORK_REFUSED');
        await canary.close(); closed = listener(); requireValue(closed.state === 'absent', 'TASK4_NETWORK_REFUSED');
        original = { schema: 'mission-control.task4-policy-probe-original.v1', ...binding, ...result, parentOwner: context.owner,
            policyHash: request.policyHash, launcherHash: request.launcherHash, executableHash: result.owner.executableHash, commandHash: result.owner.commandHash,
            canaryBefore: task4OuterArtifactV1(state, before), canaryAfter: task4OuterArtifactV1(state, after), canaryClosed: task4OuterArtifactV1(state, closed) };
        requireValue(Date.now() < deadline, 'TASK4_NETWORK_REFUSED');
        const originalRef = task4OuterArtifactV1(state, original), fixedRef = publishTask4FixedV1(state.root, 'policy-probe-original.json', original);
        requireValue(task4CanonicalV1(originalRef) === task4CanonicalV1(fixedRef), 'TASK4_INTEGRITY_FAILED');
        const receipt = (await waitTask4FixedV1(context, state.root, 'policy-probe-mock.json', deadline)).value;
        keys(receipt, 'schema executionId setupDescriptorHash readyDescriptorHash owner before after acceptedConnections sockets');
        requireValue(receipt.schema === 'mission-control.task4-policy-probe-mock.v1' && Object.entries(binding).every(([k, v]) => receipt[k] === v)
            && task4CanonicalV1(receipt.owner) === task4CanonicalV1(inner) && task4CanonicalV1(receipt.before) === task4CanonicalV1(request.mockListener)
            && receipt.acceptedConnections === 1 && task4CanonicalV1(receipt.sockets) === task4CanonicalV1({ opened: 1, closed: 1, active: 0 }), 'TASK4_NETWORK_REFUSED');
        const mockBefore = readTask4ArtifactV1(state.root, 'inner', receipt.before), mockAfter = readTask4ArtifactV1(state.root, 'inner', receipt.after);
        for (const row of [mockBefore, mockAfter]) {
            keys(row, 'schema executionId setupDescriptorHash readyDescriptorHash endpointRole host port at state owner original');
            requireValue(Object.entries(binding).every(([k, v]) => row[k] === v) && row.schema === mock.schema && row.endpointRole === 'mock'
                && row.host === '127.0.0.1' && row.port === mock.port && row.state === 'listening'
                && task4CanonicalV1(row.owner) === task4CanonicalV1(inner) && task4CanonicalV1(row.original) === task4CanonicalV1(mock.original), 'TASK4_NETWORK_REFUSED'); date(row.at);
        }
        requireValue(mockBefore.at <= original.allowed.startedAt && mockAfter.at >= original.allowed.finishedAt, 'TASK4_NETWORK_REFUSED');
        for (const [row, ref] of [[mockBefore, receipt.before], [mockAfter, receipt.after]]) requireValue(task4CanonicalV1(task4OuterArtifactV1(state, row)) === task4CanonicalV1(ref), 'TASK4_INTEGRITY_FAILED');
        const final = { schema: 'mission-control.task4-network-policy-probe.v1', ...binding, policyHash: request.policyHash, launcherHash: request.launcherHash,
            owner: original.owner, allowed: { endpointRole: 'owned_allowed_mock', ...original.allowed, listenerBefore: receipt.before, listenerAfter: receipt.after, acceptedConnections: 1 },
            denied: { endpointRole: 'owned_denied_canary', ...original.denied, listenerBefore: original.canaryBefore, listenerAfter: original.canaryAfter, acceptedConnections: 0 },
            exit: { code: original.exit.code, signal: original.exit.signal }, closeObserved: original.exit.closeObserved, original: originalRef };
        context.check(); requireValue(Date.now() < deadline, 'TASK4_NETWORK_REFUSED'); state.probe = publishTask4FixedV1(state.root, 'policy-probe.json', final);
    } finally { if (!canary.closed()) await canary.close(); }
}

function task4OuterArtifactV1(state, value) {
    state.root.check(); const bytes = Buffer.from(task4CanonicalV1(value) + '\n'), ref = { sha256: hash(bytes), bytes: bytes.length };
    requireValue(bytes.length <= 1048576, 'TASK4_INTEGRITY_FAILED');
    state.outerArtifacts ??= new Map();
    const directory = path.join(state.root.value.path, 'outer/artifacts'), file = path.join(directory, ref.sha256 + '.json');
    if (state.outerArtifacts.has(ref.sha256)) {
        const pin = captureTask4FileV1(file, 1048576);
        try { const stat = fs.lstatSync(file); requireValue(pin.bytes.equals(bytes) && (stat.mode & 0o777) === 0o600, 'TASK4_INTEGRITY_FAILED'); pin.check(); }
        finally { pin.close(); }
    } else {
        requireValue(state.outerArtifacts.size < 64 && [...state.outerArtifacts.values()].reduce((sum, row) => sum + row.bytes, 0) + bytes.length <= 16777216, 'TASK4_INTEGRITY_FAILED');
        task4PrivateBytesV1(directory, ref.sha256 + '.json', bytes); state.outerArtifacts.set(ref.sha256, ref);
    }
    state.root.check(); return ref;
}

async function readTask4PairedResultsV1(context, state) {
    const same = (a, b) => task4CanonicalV1(a) === task4CanonicalV1(b), exit = state.runner.exit();
    const terminal = (v, code) => { keys(v, 'code signal exitObserved closeObserved'); requireValue(v.code === code && v.signal === null && v.exitObserved === true && v.closeObserved === true, 'TASK4_CLEANUP_UNKNOWN'); };
    requireValue(state.runner.deliveryFinished() && exit && state.probeRequest, 'TASK4_CLEANUP_UNKNOWN'); context.check();
    const r = readTask4FixedV1(state.root, 'runner-result.json'), p = readTask4FixedV1(state.root, 'parent-result.json'), i = readTask4FixedV1(state.root, 'inner-result.json');
    const runner = r.value, parent = p.value, inner = i.value, setup = state.setup, setupHash = hash(task4CanonicalV1(setup) + '\n');
    keys(runner, 'schema executionId setupDescriptorHash owner outcome code children parentResult projection cleanup');
    keys(parent, 'schema executionId setupDescriptorHash readyDescriptorHash fixtureOwner outcome code integrity projection database inner evidence cleanup');
    keys(inner, 'schema executionId binding owner scenario startedAt finishedAt outcome code integrity observations render cleanup artifacts diagnostics');
    requireValue(runner.schema === 'setfarm.task4-runner-result.v1' && parent.schema === 'setfarm.task4-parent-result.v1'
        && inner.schema === 'mission-control.render-smoke-inner-result.v1' && ['pass', 'fail', 'cancelled'].includes(inner.outcome)
        && runner.outcome === inner.outcome && parent.outcome === inner.outcome && inner.scenario === context.scenario
        && inner.integrity === 'verified' && parent.integrity === 'verified' && runner.code === parent.code && parent.code === inner.code, 'TASK4_INTEGRITY_FAILED');
    requireValue(inner.outcome === 'pass' ? inner.code === null : inner.outcome === 'cancelled' ? inner.code === 'TASK4_CANCELLED'
        : typeof inner.code === 'string' && /^TASK4_[A-Z_]+$/.test(inner.code), 'TASK4_INTEGRITY_FAILED');
    terminal(exit, inner.outcome === 'pass' ? 0 : 1);
    requireValue([runner, parent, inner].every(v => v.executionId === setup.executionId) && runner.setupDescriptorHash === setupHash
        && parent.setupDescriptorHash === setupHash && same(runner.owner, state.runner.owner) && same(runner.parentResult, p.ref)
        && same(parent.fixtureOwner, state.probeRequest.fixture) && parent.readyDescriptorHash === state.probeRequest.binding.readyDescriptorHash, 'TASK4_BINDING_REFUSED');
    processPin(runner.owner); processPin(parent.fixtureOwner); processPin(inner.owner);
    keys(parent.inner, 'owner exit result'); requireValue(same(parent.inner.owner, inner.owner) && same(inner.owner, state.probeRequest.inner)
        && inner.owner.ppid === parent.fixtureOwner.pid && same(parent.inner.result, i.ref), 'TASK4_BINDING_REFUSED');
    terminal(parent.inner.exit, { pass: 0, fail: 1, cancelled: 130 }[inner.outcome]);
    requireValue(Array.isArray(runner.children) && runner.children.length === 2, 'TASK4_CLEANUP_UNKNOWN');
    for (const [index, child] of runner.children.entries()) {
        keys(child, 'role owner exit fd3 fd4'); processPin(child.owner);
        requireValue(child.role === ['setup', 'test'][index] && child.owner.ppid === runner.owner.pid && child.owner.executable === runner.owner.executable
            && child.owner.executableHash === runner.owner.executableHash && child.fd3 === 'finished' && child.fd4 === (index ? 'finished' : 'not_applicable'), 'TASK4_CLEANUP_UNKNOWN');
        terminal(child.exit, index ? inner.outcome === 'pass' ? 0 : 1 : 0);
    }
    requireValue(same(runner.children[1].owner, parent.fixtureOwner), 'TASK4_BINDING_REFUSED');
    keys(runner.cleanup, 'databasesAbsent projectionAbsent'); keys(parent.cleanup, 'readers databaseAbsent roleAbsent'); keys(parent.cleanup.readers, 'opened closed pending');
    const readers = parent.cleanup.readers;
    requireValue(runner.cleanup.databasesAbsent === true && runner.cleanup.projectionAbsent === true && parent.cleanup.databaseAbsent === true
        && parent.cleanup.roleAbsent === true && Number.isSafeInteger(readers.opened) && readers.opened >= 0 && readers.opened <= 64
        && readers.closed === readers.opened && readers.pending === 0, 'TASK4_CLEANUP_UNKNOWN');
    keys(inner.binding, 'setupDescriptorHash readyDescriptorHash resourceRoot missionControl setfarm projection database fixture fixtureOwner');
    requireValue(inner.binding.setupDescriptorHash === setupHash && inner.binding.readyDescriptorHash === parent.readyDescriptorHash
        && same(inner.binding.resourceRoot, setup.resourceRoot) && same(inner.binding.missionControl, setup.missionControl.source)
        && same(inner.binding.setfarm, setup.setfarm.source) && same(inner.binding.fixtureOwner, parent.fixtureOwner)
        && same(inner.binding.projection, parent.projection) && same(runner.projection, { root: parent.projection.root, projectedHead: parent.projection.projectedHead }), 'TASK4_BINDING_REFUSED');
    keys(parent.database, 'name role'); keys(inner.binding.database, 'name role restrictedUrlHash');
    requireValue(parent.database.name === inner.binding.database.name && parent.database.role === inner.binding.database.role, 'TASK4_BINDING_REFUSED');
    hex(inner.binding.database.restrictedUrlHash); date(inner.startedAt); date(inner.finishedAt); requireValue(inner.finishedAt >= inner.startedAt, 'TASK4_INTEGRITY_FAILED');
    keys(parent.evidence, 'readinessBefore readinessAfter auditBefore auditAfter untouchedBefore untouchedAfter sqlLedger');
    requireValue(same(parent.evidence.readinessBefore, parent.evidence.readinessAfter) && same(parent.evidence.untouchedBefore, parent.evidence.untouchedAfter), 'TASK4_INTEGRITY_FAILED');
    for (const ref of Object.values(parent.evidence)) readTask4ArtifactV1(state.root, 'parent', ref);
    verifyTask4InnerArtifactsV1(context, state, inner);
    const databaseAbsence = await task4ProveDatabaseAbsenceV1(context, state, parent); context.check();
    return { closed: true, outcome: inner.outcome, code: inner.code, runner: r.ref, parent: p.ref, inner: i.ref, databaseAbsence };
}

function verifyTask4InnerArtifactsV1(context, state, inner) {
    const inventory = inner.artifacts, root = path.join(state.root.value.path, 'inner'), expected = new Map(), values = new Map();
    keys(inventory, 'json png native totalBytes');
    requireValue(Array.isArray(inventory.json) && inventory.json.length <= 64 && Array.isArray(inventory.png) && inventory.png.length <= 6
        && Array.isArray(inventory.native) && inventory.native.length <= 1, 'TASK4_INTEGRITY_FAILED');
    const add = (name, ref, cap) => {
        keys(ref, 'sha256 bytes'); requireValue(/^[a-f0-9]{64}$/.test(ref.sha256) && Number.isSafeInteger(ref.bytes) && ref.bytes > 0
            && ref.bytes <= cap && !expected.has(name), 'TASK4_INTEGRITY_FAILED'); expected.set(name, ref);
    };
    for (const [kind, cap] of [['json', 1048576], ['png', 16777216]]) {
        let previous = '';
        for (const ref of inventory[kind]) { requireValue(ref.sha256 > previous, 'TASK4_INTEGRITY_FAILED'); previous = ref.sha256; add('artifacts/' + ref.sha256 + '.' + kind, ref, cap); }
    }
    for (const chain of inventory.native) {
        keys(chain, 'spawnId intent observed settled closed notStarted'); requireValue(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(chain.spawnId), 'TASK4_INTEGRITY_FAILED');
        for (const [key, suffix] of [['intent', 'intent'], ['observed', 'observed'], ['settled', 'settled'], ['closed', 'closed'], ['notStarted', 'not-started']])
            if (chain[key] !== null) add('children/' + chain.spawnId + '.' + suffix + '.json', chain[key], key === 'settled' ? 1048576 : 16384);
    }
    const actual = ['artifacts', 'children'].flatMap(dir => fs.readdirSync(path.join(root, dir)).map(name => dir + '/' + name));
    requireValue(actual.length === expected.size && actual.every(name => expected.has(name))
        && [...expected.values()].reduce((n, r) => n + r.bytes, 0) === inventory.totalBytes, 'TASK4_INTEGRITY_FAILED');
    for (const [name, ref] of expected) {
        const file = task4FileSnapshotV1(path.join(root, name), name.endsWith('.png') ? 16777216 : 1048576);
        requireValue(file.hash === ref.sha256 && hash(file.bytes) === ref.sha256 && file.bytes.length === ref.bytes
            && (Number(file.identity.mode) & 0o777) === 0o600, 'TASK4_INTEGRITY_FAILED');
        if (name.endsWith('.png')) requireValue(file.bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'TASK4_INTEGRITY_FAILED');
        else { const value = JSON.parse(file.bytes.toString('utf8')); requireValue(Buffer.from(task4CanonicalV1(value) + '\n').equals(file.bytes), 'TASK4_INTEGRITY_FAILED');
            if (name.startsWith('children/')) context.modules.protocol.UiWorkerLifecycleRecordV1Schema.parse(value); values.set(ref.sha256, value); }
    }
    const read = ref => { keys(ref, 'sha256 bytes'); const value = values.get(ref.sha256); requireValue(value && Buffer.byteLength(task4CanonicalV1(value) + '\n') === ref.bytes, 'TASK4_INTEGRITY_FAILED'); return value; };
    const cleanup = read(inner.cleanup); read(inner.render); read(inner.observations.before); read(inner.observations.after);
    keys(cleanup, 'schema executionId setupDescriptorHash readyDescriptorHash ownerHash nativeAudit mock server readers contexts complete');
    const ui = { pid: inner.owner.pid, processStartedAt: inner.owner.startedAt, processGroupId: inner.owner.pgid, source: 'observed_os',
        executable: inner.owner.executable, script: path.join(context.root, 'scripts/render-smoke.mjs'), commandHash: inner.owner.commandHash };
    requireValue(cleanup.schema === 'mission-control.render-smoke-inner-cleanup.v1' && cleanup.complete === true && cleanup.executionId === inner.executionId
        && cleanup.setupDescriptorHash === inner.binding.setupDescriptorHash && cleanup.readyDescriptorHash === inner.binding.readyDescriptorHash
        && cleanup.ownerHash === hash(task4CanonicalV1(ui)), 'TASK4_CLEANUP_UNKNOWN');
    for (const kind of ['readers', 'contexts']) { keys(cleanup[kind], 'opened closed pending'); const v = cleanup[kind];
        requireValue(Number.isSafeInteger(v.opened) && v.opened >= 0 && v.opened <= 16 && v.closed === v.opened && v.pending === 0, 'TASK4_CLEANUP_UNKNOWN'); }
    const audit = cleanup.nativeAudit; keys(audit, 'jobId intentHash owner state children');
    requireValue(audit.intentHash === inner.binding.readyDescriptorHash && task4CanonicalV1(audit.owner) === task4CanonicalV1(ui)
        && ['closed', 'not_started'].includes(audit.state) && Array.isArray(audit.children) && audit.children.length === inventory.native.length, 'TASK4_CLEANUP_UNKNOWN');
    if (inner.outcome === 'pass') requireValue(audit.state === 'closed' && inventory.native.length === 1, 'TASK4_CLEANUP_UNKNOWN');
    for (const chain of inventory.native) {
        const child = audit.children.find(v => v.spawnId === chain.spawnId); requireValue(child, 'TASK4_CLEANUP_UNKNOWN');
        const leaf = (key, suffix) => { const v = read(chain[key]); requireValue(v.schema === 'mission-control.ui-worker-child-' + suffix + '.v1'
            && v.jobId === audit.jobId && v.intentHash === audit.intentHash && v.spawnId === chain.spawnId, 'TASK4_CLEANUP_UNKNOWN'); return v; };
        const intent = leaf('intent', 'intent'); requireValue(intent.ownerHash === cleanup.ownerHash, 'TASK4_CLEANUP_UNKNOWN');
        if (chain.notStarted !== null) {
            const never = leaf('notStarted', 'not-started'); requireValue(never.disposition === 'never_invoked' && never.launchIntentHash === chain.intent.sha256
                && chain.observed === null && chain.settled === null && chain.closed === null && child.owner === null && child.state === 'not_started' && audit.state === 'not_started', 'TASK4_CLEANUP_UNKNOWN');
        } else {
            const observed = leaf('observed', 'observed'), settled = leaf('settled', 'settled'), closed = leaf('closed', 'closed');
            requireValue(audit.state === 'closed' && child.state === 'closed' && task4CanonicalV1(child.owner) === task4CanonicalV1(observed.owner)
                && observed.parentPid === inner.owner.pid && observed.launchIntentHash === chain.intent.sha256 && settled.observedHash === chain.observed.sha256
                && closed.observedHash === chain.observed.sha256 && closed.settlementHash === chain.settled.sha256, 'TASK4_CLEANUP_UNKNOWN');
        }
    }
    for (const kind of ['mock', 'server']) requireValue(['closed', 'not_started'].includes(cleanup[kind].state), 'TASK4_CLEANUP_UNKNOWN');
    if (cleanup.mock.state === 'closed') requireValue(cleanup.mock.closeCallback === true && cleanup.mock.acceptedConnections === cleanup.mock.closedConnections
        && read(cleanup.mock.listenerAfter).state === 'absent', 'TASK4_CLEANUP_UNKNOWN');
    if (cleanup.server.state === 'closed') { const settled = read(cleanup.server.settled); requireValue(settled.exit.exitObserved === true && settled.exit.closeObserved === true
        && read(settled.listenerAfter).state === 'absent', 'TASK4_CLEANUP_UNKNOWN'); }
    context.check();
}

async function task4ProveDatabaseAbsenceV1(context, state, parent) {
    const setup = state.setup, projection = parent.projection, prefix = projection.runDatabasePrefix, role = parent.database.role;
    requireValue(/^setfarm_p3_[a-f0-9]{24}$/.test(prefix) && role === 'mc_task4_' + state.executionId
        && new RegExp('^' + prefix + '_clone_[a-f0-9]{12}$').test(parent.database.name)
        && /^setfarm-p3-projection-[A-Za-z0-9_-]+\/setfarm$/.test(path.relative(path.join(setup.resourceRoot.path, 'tmp'), projection.root.path)), 'TASK4_BINDING_REFUSED');
    const absent = () => {
        try { fs.lstatSync(path.dirname(projection.root.path)); }
        catch (error) { requireValue(error?.code === 'ENOENT', 'TASK4_CLEANUP_UNKNOWN'); return; }
        requireValue(false, 'TASK4_CLEANUP_UNKNOWN');
    };
    absent(); context.check(); const postgres = await task4PostgresV1();
    const sql = postgres(state.adminUrl, { max: 1, prepare: false, fetch_types: false, connect_timeout: 5, idle_timeout: 0, max_lifetime: 0,
        ssl: false, onnotice() {}, connection: { application_name: 'task4_outer_' + state.executionId, statement_timeout: 5000 } });
    state.adminClosed = false; let rows;
    try {
        rows = await task4BoundedV1(sql.unsafe(`SELECT current_database() AS database,current_setting('data_directory') AS data_directory,
            current_setting('port')::int AS port,current_setting('server_version_num')::int AS version,
            to_char(pg_postmaster_start_time() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS started_at,
            (SELECT count(*)::int FROM pg_database WHERE left(datname,length($1))=$1) AS databases,
            (SELECT count(*)::int FROM pg_roles WHERE rolname=$2) AS roles,
            (SELECT count(*)::int FROM pg_stat_activity WHERE usename=$2 OR left(datname,length($1))=$1) AS sessions`, [prefix, role]), 8000, 'TASK4_DATABASE_REFUSED');
        context.check(); const v = rows[0]; requireValue(rows.length === 1 && v.database === 'postgres' && v.data_directory === setup.postgres.data.path
            && v.port === setup.postgres.port && v.version === 170010 && v.started_at === setup.postgres.serverStartedAt
            && v.databases === 0 && v.roles === 0 && v.sessions === 0, 'TASK4_CLEANUP_UNKNOWN');
    } finally { await task4BoundedV1(sql.end({ timeout: 5 }), 8000, 'TASK4_CLEANUP_UNKNOWN'); state.adminClosed = true; }
    absent(); context.check();
    return task4OuterArtifactV1(state, { schema: 'mission-control.task4-database-absence.v1', executionId: state.executionId,
        at: new Date().toISOString(), prefix, role, observation: rows[0], databasesAbsent: true, roleAbsent: true, restrictedSessionsAbsent: true, projectionAbsent: true, adminClientClosed: true });
}

async function finalizeTask4OuterV1(context, state) {
    let result = null, outcome = 'unknown';
    try {
        try { context.check(); state.root.check(); } catch (error) { task4RecordFailureV1(state, error); }
        const ended = exit => exit && exit.exitObserved === true && exit.closeObserved === true && exit.signal === null && Number.isSafeInteger(exit.code);
        const postmaster = state.postgres?.settlement() ?? null;
        const cleanup = { initdb: !state.initdb ? 'not_started' : ended(state.initdb.exit) ? 'closed' : 'unknown',
            runner: !state.runner ? 'not_started' : ended(state.runner.exit()) && state.paired?.closed === true ? 'closed' : 'unknown',
            postgres: !state.postgres ? 'not_started' : postmaster ? 'closed' : 'unknown',
            probe: !state.probeOriginal ? 'not_started' : ended(state.probeOriginal.exit) ? 'closed' : 'unknown',
            canary: !state.canary ? 'not_started' : state.canary.closed() ? 'closed' : 'unknown',
            portReservation: !state.portReservation ? 'not_started' : state.portReservation.closed() ? 'closed' : 'unknown',
            adminClient: state.adminClosed === false ? 'unknown' : 'closed' };
        const complete = Object.values(cleanup).every(value => value !== 'unknown') && !state.cleanupUnknown;
        if (!complete) task4RecordFailureV1(state, Error('TASK4_CLEANUP_UNKNOWN'), true);
        if (complete && state.integrity === 'verified' && state.paired?.closed === true && state.probe)
            outcome = state.errors.length ? 'fail' : state.paired.outcome;
        const code = outcome === 'unknown' ? state.cleanupUnknown ? 'TASK4_CLEANUP_UNKNOWN' : 'TASK4_INTEGRITY_FAILED'
            : outcome === 'pass' ? null : state.errors[0] ?? state.paired.code;
        const value = { schema: 'mission-control.render-smoke-outer-result.v1', executionId: state.executionId,
            binding: { launchHash: hash(task4CanonicalV1(context.launch) + '\n'), setfarm: context.launch.setfarm, missionControl: context.launch.missionControl, resourceRoot: state.root.value },
            owner: context.owner, scenario: context.scenario, startedAt: state.startedAt, finishedAt: new Date().toISOString(), outcome, code, integrity: state.integrity,
            setup: state.setupRef ?? null, paired: state.paired,
            runner: state.runner ? { owner: state.runner.owner, exit: state.runner.exit(), fd4: state.runner.deliveryFinished() ? 'finished' : 'unknown' } : null,
            postgres: state.postgres ? { owner: state.postgres.owner, settlement: postmaster ? task4OuterArtifactV1(state, { schema: 'mission-control.task4-postgres-settled.v1', executionId: state.executionId, ...postmaster }) : null } : null,
            probe: state.probe, cleanup, diagnostics: [...state.errors], artifacts: [...(state.outerArtifacts?.values() ?? [])].sort((a, b) => a.sha256.localeCompare(b.sha256)) };
        context.check(); state.root.check(); const bytes = Buffer.from(task4CanonicalV1(value) + '\n'); requireValue(bytes.length <= 16384, 'TASK4_RESULT_PUBLICATION_FAILED');
        // Root consumes this once the original outer has exited AND closed; it is never a live hand-off frame.
        result = task4PrivateBytesV1(state.root.value.path, 'outer-result.json', bytes); return value;
    } catch (error) { outcome = 'unknown'; throw error; }
    finally {
        process.exitCode = { pass: 0, fail: 1, cancelled: 130, unknown: 2 }[outcome];
        process.stdout.write(task4CanonicalV1({ schema: 'mission-control.render-smoke-outer-receipt.v1', executionId: state.executionId,
            resourceRoot: state.root.value.path, outcome, result }) + '\n'); state.root.close();
    }
}
