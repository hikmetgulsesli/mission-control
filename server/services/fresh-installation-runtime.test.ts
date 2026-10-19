import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareFreshMissionControlControlsV1, freshMissionControlControlsV1 } from './fresh-installation-runtime.js';
// Explicit source component: no selected release and no runtime preparation.
// No service or database is contacted by the unavailable branch.
test('unselected or unprepared composition cannot manufacture Controls or use source fallback', async () => {
    assert.equal(freshMissionControlControlsV1(), null);
    await prepareFreshMissionControlControlsV1();
    assert.equal(freshMissionControlControlsV1(), null);
});
import { mkdtempSync, realpathSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
test('compiled composition binds only captured SQL and refuses absent adapter or post-read selector drift', () => {
    const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'mc-controls-composition-'))), release = path.join(root, 'release'), runtime = path.join(root, 'runtime');
    mkdirSync(path.join(runtime, 'mission-control'), { recursive: true, mode: 0o700 });
    mkdirSync(release, { mode: 0o700 });
    for (const name of ['projects.json', 'deleted-projects.json'])
        writeFileSync(path.join(runtime, 'mission-control', name), '[]\n', { mode: 0o600 });
    const fixed = ['execution/schemas/manual-control-job-v1.js', 'execution/schemas/manual-control-worker-channel-v1.js', 'evals/control-evidence-reader-v1.js', 'evals/control-evidence-admission-reader-v1.js', 'evals/suite-schema-v2.js', 'cli/control-test-worker-v1.js'];
    for (const name of fixed) {
        const file = path.join(release, 'dist', name);
        mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
        writeFileSync(file, '/* fixed test module bytes */\n', { mode: 0o600 });
    }
    mkdirSync(path.join(release, 'evals', 'suites'), { recursive: true, mode: 0o700 });
    writeFileSync(path.join(release, 'evals', 'suites', 'product-convergence-codex-v1.json'), '{}\n', { mode: 0o600 });
    const sf = new URL('../../../setfarm-dashboard-cutover-controller-20261007-v1/src/', import.meta.url).href;
    const script = `import assert from 'node:assert/strict';import {registerHooks} from 'node:module';import {unlinkSync} from 'node:fs';
 const root=${JSON.stringify(root)},release=${JSON.stringify(release)},runtime=${JSON.stringify(runtime)};
 globalThis.fixtureOwner=Object.assign(()=>{}, {begin:async(_mode,fn)=>{assert.equal(_mode,'isolation level repeatable read read only');return fn({unsafe:async(sql)=>sql.includes('pg_catalog')?['agent_feed','live_events','prd_templates','prds','tasks'].map(name=>({name,valid:true})):sql.includes('prd_templates ORDER')?['tpl-admin','tpl-blog','tpl-dashboard','tpl-docs','tpl-ecommerce','tpl-game','tpl-mobile','tpl-portfolio','tpl-saas'].map(id=>({id})):[]});}});
 let reads=0;globalThis.fixtureRead=async(input,owner)=>{assert.equal(owner,globalThis.fixtureOwner);assert.equal(input.selectionHash.length,64);await owner.begin('isolation level repeatable read read only',async tx=>{await tx.unsafe('SELECT fixture only');});reads++;if(process.env.DRIFT==='yes')globalThis.fixtureDrift=true;return {activation:{availability:{state:'unconfigured',code:null},report:null},evaluation:{availability:{state:'unconfigured',code:null},report:null}};};
 const modules={
 'installation/fresh-installation-entry-v1.js':'export async function prepareFreshInstallationOperationalEntryV1(){};export function assertFreshInstallationOperationalEntryV1(){};',
 'db-pg.js':'export const getSql=()=>globalThis.fixtureOwner;export function assertSelectedFreshInstallationOperationalDatabaseV1(){};export async function pgClose(){};',
 'installation/fresh-installation-selection-v1.js':'export const freshInstallationSelectionV1={directory:'+JSON.stringify(root)+',paths:{root:'+JSON.stringify(runtime)+',repository:'+JSON.stringify(release)+',cli:'+JSON.stringify(release+'/dist/cli')+'},state:{origin:{sourceSha:"'+'a'.repeat(40)+'",installationId:"018d819f-0a78-7d38-bb1f-0195b029ddaf"}},catalogHash:"'+'b'.repeat(64)+'",activation:{acknowledged:true,preparedPin:{sha256:"'+'c'.repeat(64)+'"},activatedPin:{sha256:"'+'d'.repeat(64)+'"}},assertUnchanged(){if(globalThis.fixtureDrift)throw Error("drift")}};',
 'evals/control-evidence-reader-v1.js':'export async function readSelectedControlEvidenceV1(){throw Error("FS reader must not qualify")} ',
 'evals/control-evidence-admission-reader-v1.js':'export const readSelectedControlEvidenceWithAdmissionV1=globalThis.fixtureRead;',
 'evals/suite-schema-v2.js':'export async function loadConvergenceSuiteVersioned(){return {suiteHash:"'+'e'.repeat(64)+'",suite:{cases:Array.from({length:8},(_,i)=>({caseId:"case-"+i}))}}}',
 };
 registerHooks({resolve(specifier,context,next){if(specifier.startsWith('file://'+release+'/dist/')){const name=specifier.slice(('file://'+release+'/dist/').length);if(name.startsWith('execution/schemas/'))return next(${JSON.stringify(sf)}+name.replace(/\\.js$/,'.ts'),context);if(name in modules)return {url:'fixture:'+name,shortCircuit:true};}if(specifier==='./product-build-authority-v2-delivery-evidence-v1.js'&&context.parentURL?.endsWith('fresh-installation-runtime.ts'))return {url:'fixture:build',shortCircuit:true};return next(specifier,context);},load(url,context,next){if(url==='fixture:build')return {format:'module',source:'export const productBuildAuthorityV2LoadedBuildStartupStateV1=()=>({status:"available",response:{loadedBuild:{buildIdentity:{sourceSha:"'+'f'.repeat(40)+'",buildHash:"'+'1'.repeat(64)+'"}}}});',shortCircuit:true};if(url.startsWith('fixture:'))return {format:'module',source:modules[url.slice(8)],shortCircuit:true};return next(url,context);}});
 const api=await import(${JSON.stringify(new URL('./fresh-installation-runtime.ts', import.meta.url).href)});await api.prepareFreshMissionControlRuntimeV1();if(process.env.MISSING==='yes')unlinkSync(release+'/dist/evals/control-evidence-admission-reader-v1.js');await api.prepareFreshMissionControlControlsV1();
 const jobs=api.freshMissionControlControlsV1();if(process.env.MISSING==='yes'){assert.equal(jobs,null);assert.equal(reads,0);process.exit(0);}assert.ok(jobs);if(process.env.DRIFT==='yes')await assert.rejects(()=>jobs.evidence());else assert.equal((await jobs.evidence()).selectionHash.length,64);assert.equal(reads,1);
 `;
    const env = { PATH: process.env.PATH!, HOME: process.env.HOME!, SETFARM_INSTALLATION_DIR: root, SETFARM_REPO_DIR: release };
    for (const flags of [{ DRIFT: 'no', MISSING: 'no' }, { DRIFT: 'yes', MISSING: 'no' }, { DRIFT: 'no', MISSING: 'yes' }])
        execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { encoding: 'utf8', timeout: 15000, env: { ...env, ...flags }, stdio: 'pipe' });
});
