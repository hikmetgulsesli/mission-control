/** Selected MC composition only. No SQL/build/verification callback input. */
import type postgres from 'postgres';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

type Sql = postgres.Sql;
type Selection = Readonly<{
  directory: string; paths: Readonly<{ root: string; repository: string; cli: string }>;
  activation: Readonly<{ acknowledged: boolean }> | null;
  state: Readonly<{ origin: Readonly<{ sourceSha: string }> }>;
  assertUnchanged(): void;
}>;
type Entry = Readonly<{
  prepareFreshInstallationOperationalEntryV1(): Promise<void>;
  assertFreshInstallationOperationalEntryV1(): void;
}>;
type Database = Readonly<{
  getSql(): Sql; assertSelectedFreshInstallationOperationalDatabaseV1(): void; pgClose(): Promise<void>;
}>;
export type FreshMissionControlPathsV1 = Readonly<{
  setfarmDir: string; setfarmRepoDir: string; setfarmDb: string; projectsDir: string;
  projectsJson: string; deletedProjectsJson: string; uploadsDir: string; dataJson: string;
  avatarsDir: string; mobileDir: string; eventsJsonl: string; sessionsDir: string;
  transcriptsDir: string; scriptsDir: string; agentsDir: string; portRegistry: string; cliPath: string;
}>;
const locator = process.env.SETFARM_INSTALLATION_DIR;
const release = process.env.SETFARM_REPO_DIR;
type PhaseV1 = 'UNPREPARED' | 'PREPARING' | 'READY' | 'REFUSED' | 'CLOSED';
let phase: PhaseV1 = 'UNPREPARED';
let preparation: Promise<void> | undefined;
let closure: Promise<void> | undefined;
let context: Readonly<{ selection: Selection; entry: Entry; database: Database; owner: Sql; paths: FreshMissionControlPathsV1;
  checks: readonly (() => void)[] }> | undefined;
let facade: Sql | undefined;
const CODE = 'MC_FRESH_INSTALLATION_RUNTIME_UNAVAILABLE';
function refuse(): never { phase = phase === 'CLOSED' ? 'CLOSED' : 'REFUSED'; throw new Error(CODE); }
function unchangedEnvironment(): void {
  if (phase === 'REFUSED' || phase === 'CLOSED') refuse();
  if (process.env.SETFARM_INSTALLATION_DIR !== locator) refuse();
  if (locator !== undefined && (process.env.SETFARM_REPO_DIR !== release
    || Object.keys(process.env).some(key => key.startsWith('MC_TASK6A_')))) refuse();
}
export function freshMissionControlSelectedV1(): boolean { unchangedEnvironment(); return locator !== undefined; }
function absolute(value: string | undefined): string {
  if (!value || value !== value.trim() || !path.isAbsolute(value) || value.includes('\0') || path.normalize(value) !== value) refuse();
  return value;
}
function privateDirectory(directory: string): () => void {
  const before = lstatSync(directory, { bigint: true });
  const check = (): void => {
    const now = lstatSync(directory, { bigint: true });
    if (!now.isDirectory() || now.isSymbolicLink() || now.uid !== BigInt(process.getuid!())
      || (now.mode & 0o7777n) !== 0o700n || realpathSync(directory) !== directory
      || now.dev !== before.dev || now.ino !== before.ino || now.mode !== before.mode || now.uid !== before.uid) refuse();
  };
  check(); return check;
}
function registryMetadata(file: string) {
  const before = lstatSync(file, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink() || before.uid !== BigInt(process.getuid!())
    || before.nlink !== 1n || (before.mode & 0o7777n) !== 0o600n || before.size > 4n * 1024n ** 2n
    || realpathSync(file) !== file) refuse();
  return before;
}
function requireRegistry(file: string): void {
  const before = registryMetadata(file);
  const bytes = readFileSync(file), after = lstatSync(file, { bigint: true });
  for (const key of ['dev','ino','mode','nlink','uid','gid','size','mtimeNs','ctimeNs'] as const) if (after[key] !== before[key]) refuse();
  if (BigInt(bytes.length) !== before.size || !Array.isArray(JSON.parse(bytes.toString('utf8')))) refuse();
  // Registry bytes are ordinary mutable business state. Do not freeze their
  // original inode/content after legitimate repository atomic replacements.
}
function checkContext(): void {
  unchangedEnvironment();
  if (phase !== 'READY' || !context) refuse();
  context.selection.assertUnchanged();
  context.database.assertSelectedFreshInstallationOperationalDatabaseV1();
  if (context.database.getSql() !== context.owner) refuse();
  for (const check of context.checks) check();
  const p = context.paths;
  registryMetadata(p.projectsJson); registryMetadata(p.deletedProjectsJson);
  const expected: Readonly<Record<string,string>> = { PROJECTS_JSON:p.projectsJson, DATA_JSON:p.dataJson,
    AVATARS_DIR:p.avatarsDir, MOBILE_DIR:p.mobileDir, EVENTS_JSONL:p.eventsJsonl, SETFARM_EVENTS_JSONL:p.eventsJsonl,
    SESSIONS_DIR:p.sessionsDir, TRANSCRIPTS_DIR:p.transcriptsDir, AGENTS_DIR:p.agentsDir, PORT_REGISTRY:p.portRegistry,
    SETFARM_PROJECTS_DIR:p.projectsDir, OPENCLAW_PROJECTS_DIR:p.projectsDir };
  for (const [key,value] of Object.entries(expected)) if (process.env[key] !== undefined && process.env[key] !== value) refuse();
}
/** First startup operation, before importing config/pg/routes/app. Legacy is a no-op. */
export function prepareFreshMissionControlRuntimeV1(): Promise<void> {
  if (arguments.length !== 0) return Promise.reject(new Error(CODE));
  try { unchangedEnvironment(); } catch { return Promise.reject(new Error(CODE)); }
  if (locator === undefined) return Promise.resolve();
  if (phase === 'PREPARING' || phase === 'READY') return preparation!;
  if (phase !== 'UNPREPARED') return Promise.reject(new Error(CODE));
  phase = 'PREPARING';
  preparation = (async () => {
    let database: Database | undefined;
    try {
      const directory = absolute(locator), repository = absolute(release);
      if (realpathSync(repository) !== repository) refuse();
      const moduleUrl = (relative: string) => pathToFileURL(path.join(repository,'dist',relative)).href;
      // This operator-selected executable release is a trusted deployment input,
      // not a URL accepted from a request or a caller-provided observer port.
      const entry = await import(moduleUrl('installation/fresh-installation-entry-v1.js')) as Entry;
      database = await import(moduleUrl('db-pg.js')) as Database;
      const leaf = await import(moduleUrl('installation/fresh-installation-selection-v1.js')) as { freshInstallationSelectionV1: Selection | null };
      unchangedEnvironment();
      const selection = leaf.freshInstallationSelectionV1;
      if (!selection || selection.directory !== realpathSync(directory) || selection.paths.repository !== repository
        || selection.activation?.acknowledged !== true) refuse();
      await entry.prepareFreshInstallationOperationalEntryV1();
      unchangedEnvironment(); selection.assertUnchanged(); entry.assertFreshInstallationOperationalEntryV1();
      database.assertSelectedFreshInstallationOperationalDatabaseV1();
      const owner = database.getSql(), root = selection.paths.root, mcRoot = path.join(root,'mission-control');
      const paths: FreshMissionControlPathsV1 = Object.freeze({ setfarmDir:root, setfarmRepoDir:repository,
        setfarmDb:path.join(root,'setfarm.db'), projectsDir:path.join(root,'projects'),
        projectsJson:path.join(mcRoot,'projects.json'), deletedProjectsJson:path.join(mcRoot,'deleted-projects.json'),
        uploadsDir:path.join(mcRoot,'uploads'), dataJson:path.join(mcRoot,'data.json'), avatarsDir:path.join(mcRoot,'avatars'),
        mobileDir:path.join(root,'mobile'), eventsJsonl:path.join(root,'events.jsonl'), sessionsDir:path.join(root,'sessions'),
        transcriptsDir:path.join(root,'transcripts'), scriptsDir:path.join(repository,'scripts'), agentsDir:path.join(root,'agents'),
        portRegistry:path.join(root,'port-registry.json'), cliPath:selection.paths.cli });
      const checks = [privateDirectory(root), privateDirectory(mcRoot)];
      // Initial registry assets are source-provisioned only while the directory
      // is newly owned. Missing-on-reopen never becomes an empty registry here.
      requireRegistry(paths.projectsJson); requireRegistry(paths.deletedProjectsJson);
      await owner.begin('isolation level repeatable read read only', async tx => {
        await tx.unsafe("SELECT set_config('lock_timeout','1000ms',true),set_config('statement_timeout','5000ms',true),set_config('search_path','public',true)");
        const rows = await tx.unsafe<Array<{ name:string; valid:boolean }>>(`SELECT c.relname AS name,
          (c.relkind='r' AND c.relpersistence='p' AND NOT c.relispartition AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity) AS valid
          FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relname IN ('tasks','prds','prd_templates','agent_feed','live_events')
          ORDER BY c.relname LIMIT 6`);
        if (rows.length !== 5 || rows.some(row => row.valid !== true)
          || rows.map(row => row.name).join(',') !== 'agent_feed,live_events,prd_templates,prds,tasks') refuse();
        const templates = await tx.unsafe<Array<{ id:string }>>('SELECT id FROM public.prd_templates ORDER BY id LIMIT 10');
        if (templates.map(row => row.id).join(',') !== 'tpl-admin,tpl-blog,tpl-dashboard,tpl-docs,tpl-ecommerce,tpl-game,tpl-mobile,tpl-portfolio,tpl-saas') refuse();
      });
      unchangedEnvironment();
      context = Object.freeze({ selection, entry, database, owner, paths, checks:Object.freeze(checks) });
      phase = 'READY'; checkContext();
    } catch {
      phase = (phase as PhaseV1) === 'CLOSED' ? 'CLOSED' : 'REFUSED'; context = undefined;
      try { await database?.pgClose(); } catch { /* Refusal remains sticky. */ }
      throw new Error(CODE);
    }
  })();
  return preparation;
}
/** Full entry/source check at request, CLI spawn and background-batch boundaries. */
export function assertFreshMissionControlRuntimeV1(): void {
  try {
    unchangedEnvironment();
    if (locator !== undefined) {
      checkContext(); context!.entry.assertFreshInstallationOperationalEntryV1(); checkContext();
    }
  } catch { return refuse(); }
}
export function freshMissionControlPathsV1(): FreshMissionControlPathsV1 | null {
  assertFreshMissionControlRuntimeV1(); return locator === undefined ? null : context!.paths;
}
/** Full activated catalog was verified before imports; this never provisions. */
export function assertPreprovisionedFreshMissionControlStoreV1(): void { checkContext(); }
function guardedQuery(query: unknown, check: () => void): Promise<unknown> {
  check();
  if (!query || typeof (query as {then?:unknown}).then !== 'function') refuse();
  // Enter the real pending query now, with the guard checked, then recheck its
  // result. Previously issued reads are not represented as magically revoked.
  return (query as Promise<unknown>).then(value => { check(); return value; });
}
function wrapSql(target: Sql | postgres.TransactionSql, check: () => void, transaction: boolean): Sql {
  const call = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    check();
    if (!Array.isArray(strings) || !Array.isArray(strings.raw) || typeof target !== 'function') refuse();
    return guardedQuery(Reflect.apply(target,target,[strings,...values]),check);
  }) as unknown as Sql;
  Object.defineProperties(call, {
    unsafe:{ value:(statement:string,args?:readonly unknown[]) => {
      check(); return guardedQuery(Reflect.apply(target.unsafe,target,[statement,args]),check);
    }},
    begin:{ value:(operation:unknown) => {
      check(); if (transaction || typeof operation !== 'function') refuse();
      return guardedQuery((target as Sql).begin(async tx => {
        let active = true;
        const scoped = () => { check(); if (!active) refuse(); };
        try { return await (operation as (sql:Sql)=>unknown)(wrapSql(tx,scoped,true)); }
        finally { active = false; }
      }),check);
    }},
    end:{ value:async () => {
      if (transaction) refuse();
      await closeFreshMissionControlRuntimeV1();
    }},
  });
  return call;
}
/** Only the owned selected pool is closed; legacy lifecycle remains unchanged. */
export async function closeFreshMissionControlRuntimeV1(): Promise<void> {
  if (locator === undefined) return;
  if (closure) return closure;
  // Cleanup uses only the captured owned module. Refusal/retarget must never
  // prevent closing that old pool or redirect cleanup to an ambient endpoint.
  const owned = context?.database, pending = preparation;
  phase = 'CLOSED';
  closure = (async () => {
    try { if (owned) await owned.pgClose(); }
    finally {
      // In-flight preparation rechecks CLOSED after each awaited boundary and
      // closes its captured module on refusal. Never report that cleanup done
      // while that already-started preparation can still acquire an owned pool.
      if (pending) await pending.catch(() => {});
    }
  })();
  return closure;
}

/** Exact pool owner/state checks per query/transaction; source checked per entry/batch. */
export function freshMissionControlSqlV1(): Sql | null {
  assertFreshMissionControlRuntimeV1();
  if (locator === undefined) return null;
  return facade ??= wrapSql(context!.owner,checkContext,false);
}
/** Setfarm only; OpenClaw and other tools retain their existing contracts. */
export function freshSetfarmCliInvocationV1(command:string,args:readonly string[],environment:NodeJS.ProcessEnv)
  : Readonly<{ file:string; args:readonly string[]; env:NodeJS.ProcessEnv }> | null {
  assertFreshMissionControlRuntimeV1();
  if (locator === undefined || command !== 'setfarm') return null;
  return Object.freeze({ file:process.execPath, args:Object.freeze([path.join(context!.paths.setfarmRepoDir,'dist','cli','cli.js'),...args]),
    env:{...environment,SETFARM_INSTALLATION_DIR:locator,SETFARM_REPO_DIR:release} });
}

/** Actual captured origin only; never accepts a request-supplied Source hash. */
export function freshMissionControlSourceShaV1(): string {
  assertFreshMissionControlRuntimeV1();
  if(locator===undefined||!context)refuse();
  const sourceSha=context.selection.state.origin.sourceSha;
  if(!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(sourceSha))refuse();
  return sourceSha;
}
/** Fixed compiled asset DATA lookup before selected project/task effects. */
export async function assertFreshMissionControlWorkflowAssetsV1(workflowId:string): Promise<void> {
  assertFreshMissionControlRuntimeV1();
  if(locator===undefined||!context)refuse();
  const captured=context;
  const module=await import(pathToFileURL(path.join(captured.paths.setfarmRepoDir,'dist','installation','fresh-installation-private-assets-v1.js')).href) as {readFreshInstallationPrivateWorkflowAssetsV1(root:string,sourceSha:string,workflowId:string):unknown};
  assertFreshMissionControlRuntimeV1();if(context!==captured)refuse();
  module.readFreshInstallationPrivateWorkflowAssetsV1(captured.selection.paths.root,captured.selection.state.origin.sourceSha,workflowId);
  assertFreshMissionControlRuntimeV1();
}
