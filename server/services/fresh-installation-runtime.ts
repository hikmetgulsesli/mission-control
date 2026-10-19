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

// Controls is an optional consumer of one captured, compiled selected release.
// Unsupported selections refuse this surface without changing the global runtime.
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createControlJobsV1, createFixedManualWorkerPortV1, type ControlJobsV1, type SelectedControlRuntimeV1, type ControlSchemasV1, type ControlChannelV1, type ControlEvidenceExpectedV1, type ControlEvidenceProjectionV1 } from './control-jobs.js';
let controls: ControlJobsV1 | null = null;
let controlsPreparation: Promise<void> | undefined;
function captureControlModuleFileV1(file: string): () => void {
    const before = lstatSync(file, { bigint: true }), bytes = readFileSync(file), digest = createHash('sha256').update(bytes).digest('hex');
    const check = () => {
        const now = lstatSync(file, { bigint: true });
        if (!now.isFile() || now.isSymbolicLink() || now.nlink !== 1n || now.uid !== BigInt(process.getuid!())
            || (now.mode & 18n) !== 0n || realpathSync(file) !== file || now.dev !== before.dev || now.ino !== before.ino || now.size !== before.size
            || now.mtimeNs !== before.mtimeNs || now.ctimeNs !== before.ctimeNs || createHash('sha256').update(readFileSync(file)).digest('hex') !== digest)
            throw new Error('CONTROL_MODULE_UNAVAILABLE');
    };
    check();
    return check;
}
/** Called once after existing runtime/build capture and before listener startup. */
export function prepareFreshMissionControlControlsV1(): Promise<void> {
    if (arguments.length !== 0)
        return Promise.reject(new Error('CONTROL_UNAVAILABLE'));
    return controlsPreparation ??= (async () => {
        try {
            if (locator === undefined || phase !== 'READY' || !context)
                return;
            const captured = context;
            assertFreshMissionControlRuntimeV1();
            const sfRoot = captured.paths.setfarmRepoDir;
            const fixed = ['execution/schemas/manual-control-job-v1.js', 'execution/schemas/manual-control-worker-channel-v1.js', 'evals/control-evidence-reader-v1.js', 'evals/suite-schema-v2.js', 'cli/control-test-worker-v1.js', 'evals/control-evidence-admission-reader-v1.js'];
            const checks = fixed.map(name => captureControlModuleFileV1(path.join(sfRoot, 'dist', name)));
            const module = (name: string) => import(pathToFileURL(path.join(sfRoot, 'dist', name)).href);
            const schemas = await module(fixed[0]) as ControlSchemasV1, channel = await module(fixed[1]) as ControlChannelV1;
            const reader = await module(fixed[2]) as {
                readSelectedControlEvidenceV1(input: ControlEvidenceExpectedV1): Promise<ControlEvidenceProjectionV1>;
            };
            const admissionReader = await module(fixed[5]) as {
                readSelectedControlEvidenceWithAdmissionV1(input: ControlEvidenceExpectedV1, owner: Sql): Promise<ControlEvidenceProjectionV1>;
            };
            const suiteModule = await module(fixed[3]) as {
                loadConvergenceSuiteVersioned(file: string): Promise<{
                    suiteHash: string;
                    suite: {
                        cases: readonly {
                            caseId: string;
                        }[];
                    };
                }>;
            };
            for (const name of ['ControlJobReceiptV1Schema', 'ControlPrivateIntentV1Schema', 'ControlWorkerCustodyV1Schema', 'ControlEvidenceProjectionV1Schema', 'ControlReportRefsV1Schema', 'ControlSelectionIdentityV1Schema'] as const)
                if (typeof schemas[name]?.parse !== 'function')
                    throw new Error('CONTROL_MODULE_UNAVAILABLE');
            if (typeof schemas.hashControlSelectionIdentityV1 !== 'function' || typeof reader.readSelectedControlEvidenceV1 !== 'function' || typeof admissionReader.readSelectedControlEvidenceWithAdmissionV1 !== 'function'
                || typeof channel.signWorkerChannelFrameV1 !== 'function' || typeof channel.verifyWorkerChannelFrameV1 !== 'function' || typeof channel.hashWorkerChannelFrameV1 !== 'function'
                || typeof channel.hashObservedControlWorkerOwnerV1 !== 'function' || typeof channel.ObservedControlWorkerOwnerV1Schema?.parse !== 'function')
                throw new Error('CONTROL_MODULE_UNAVAILABLE');
            const buildModule = await import('./product-build-authority-v2-delivery-evidence-v1.js');
            const build = buildModule.productBuildAuthorityV2LoadedBuildStartupStateV1();
            if (build.status !== 'available')
                throw new Error('CONTROL_BUILD_UNAVAILABLE');
            const buildIdentity = build.response.loadedBuild.buildIdentity;
            const selected = captured.selection as Selection & {
                catalogHash: string;
                state: {
                    origin: {
                        sourceSha: string;
                        installationId: string;
                    };
                };
                activation: {
                    acknowledged: boolean;
                    preparedPin: {
                        sha256: string;
                    };
                    activatedPin: {
                        sha256: string;
                    };
                };
            };
            const identity = schemas.ControlSelectionIdentityV1Schema.parse({ schema: 'setfarm.manual-control-selection.v1', installationId: selected.state.origin.installationId,
                sourceSha: selected.state.origin.sourceSha, installationDir: selected.directory, releaseDir: sfRoot, catalogHash: selected.catalogHash,
                activationPreparedHash: selected.activation.preparedPin.sha256, activationAcknowledgedHash: selected.activation.activatedPin.sha256 });
            const selectionHash = schemas.hashControlSelectionIdentityV1(identity);
            const suiteFile = path.join(sfRoot, 'evals', 'suites', 'product-convergence-codex-v1.json');
            checks.push(captureControlModuleFileV1(suiteFile));
            const suite = await suiteModule.loadConvergenceSuiteVersioned(suiteFile);
            if (!/^[a-f0-9]{64}$/.test(suite.suiteHash) || suite.suite.cases.length !== 8 || new Set(suite.suite.cases.map(c => c.caseId)).size !== 8 || suite.suite.cases.some(c => typeof c.caseId !== 'string' || !/^[a-z0-9-]{1,160}$/.test(c.caseId)))
                throw new Error('CONTROL_SUITE_UNAVAILABLE');
            let ui: SelectedControlRuntimeV1['ui'];
            try {
                const built = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
                if (path.basename(built) !== 'dist-server')
                    throw new Error('CONTROL_UI_UNAVAILABLE');
                const fixtureFile = path.join(built, 'scripts', 'ui-regression-fixtures.mjs'), workerPath = path.join(built, 'scripts', 'ui-regression.mjs');
                const uiChecks = [captureControlModuleFileV1(fixtureFile), captureControlModuleFileV1(workerPath)];
                const fixture = (await import(pathToFileURL(fixtureFile).href)).UI_REGRESSION_FIXTURE_V1 as {
                    fixtureVersion: string;
                    fixtureHash: string;
                    assertionIds: readonly string[];
                };
                if (!fixture || Object.keys(fixture).sort().join(',') !== 'assertionIds,fixtureHash,fixtureVersion' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(fixture.fixtureVersion)
                    || !/^[a-f0-9]{64}$/.test(fixture.fixtureHash) || !Array.isArray(fixture.assertionIds) || fixture.assertionIds.length < 1 || fixture.assertionIds.length > 2048
                    || new Set(fixture.assertionIds).size !== fixture.assertionIds.length || fixture.assertionIds.some(id => typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(id)))
                    throw new Error('CONTROL_UI_UNAVAILABLE');
                ui = Object.freeze({ workerPath, fixtureVersion: fixture.fixtureVersion, fixtureHash: fixture.fixtureHash, assertionIds: Object.freeze([...fixture.assertionIds]) });
                checks.push(...uiChecks);
            }
            catch { /* Absent or unsupported measured fixture assets disable only UI launch. */ }
            const assertUnchanged = () => { checkContext(); if (context !== captured)
                throw new Error('CONTROL_SELECTION_STALE'); selected.assertUnchanged(); for (const check of checks)
                check(); };
            assertUnchanged();
            const runtime: SelectedControlRuntimeV1 = Object.freeze({ installationDir: selected.directory, releaseDir: sfRoot, selectionHash, sourceSha: selected.state.origin.sourceSha,
                releaseSha: selected.state.origin.sourceSha, suiteHash: suite.suiteHash, caseIds: Object.freeze(suite.suite.cases.map(c => c.caseId)), mcSourceSha: buildIdentity.sourceSha, mcBuildHash: buildIdentity.buildHash,
                workerPath: path.join(sfRoot, 'dist', fixed[4]), controlsRoot: path.join(selected.paths.root, 'mission-control', 'controls'), schemas, channel, assertUnchanged,
                readEvidence: async (input: ControlEvidenceExpectedV1) => { assertUnchanged(); const result = await admissionReader.readSelectedControlEvidenceWithAdmissionV1(input, captured.owner); assertUnchanged(); return result; }, ...(ui ? { ui } : {}) });
            controls = createControlJobsV1({ root: runtime.controlsRoot, selected: runtime, worker: createFixedManualWorkerPortV1(runtime) });
        }
        catch {
            controls = null;
        }
    })();
}
/** Getter performs no preparation, import, mkdir or probe. */
export function freshMissionControlControlsV1(): ControlJobsV1 | null { return controls; }
