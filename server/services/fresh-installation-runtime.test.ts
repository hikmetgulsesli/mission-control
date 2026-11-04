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
test('compiled composition binds selected fixed recipes and refuses missing modules, suite/profile drift or selector drift', () => {
    const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'mc-controls-composition-'))), release = path.join(root, 'release'), runtime = path.join(root, 'runtime');
    mkdirSync(path.join(runtime, 'mission-control'), { recursive: true, mode: 0o700 });
    mkdirSync(release, { mode: 0o700 });
    for (const name of ['projects.json', 'deleted-projects.json'])
        writeFileSync(path.join(runtime, 'mission-control', name), '[]\n', { mode: 0o600 });
    const fixed = ['execution/schemas/manual-control-job-v1.js', 'execution/schemas/manual-control-worker-channel-v1.js', 'evals/control-evidence-reader-v1.js', 'evals/control-evidence-admission-reader-v1.js', 'evals/suite-schema-v2.js', 'cli/control-test-worker-v1.js', 'installation/selected-convergence-recipe-v1.js'];
    for (const name of fixed) {
        const file = path.join(release, 'dist', name);
        mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
        writeFileSync(file, '/* fixed test module bytes */\n', { mode: 0o600 });
    }
    mkdirSync(path.join(release, 'evals', 'suites'), { recursive: true, mode: 0o700 });
    for (const name of ['product-convergence-codex-v1.json', 'product-convergence-minimax-m31-flash-v1.json'])
        writeFileSync(path.join(release, 'evals', 'suites', name), '{}\n', { mode: 0o600 });
    const sf = new URL('../../../setfarm-dashboard-cutover-controller-20261007-v1/src/', import.meta.url).href;
    const script = `import assert from 'node:assert/strict';import {registerHooks,syncBuiltinESMExports} from 'node:module';import childProcess from 'node:child_process';import {unlinkSync,writeFileSync,existsSync} from 'node:fs';
 const root=${JSON.stringify(root)},release=${JSON.stringify(release)},runtime=${JSON.stringify(runtime)};
 globalThis.fixtureSuiteFile=release+'/evals/suites/product-convergence-'+(process.env.SETFARM_AGENT_RUNTIME==='subscription'?'minimax-m31-flash':'codex')+'-v1.json';
 globalThis.fixtureOwner=Object.assign(()=>{}, {begin:async(_mode,fn)=>{assert.equal(_mode,'isolation level repeatable read read only');return fn({unsafe:async(sql)=>sql.includes('pg_catalog')?['agent_feed','live_events','prd_templates','prds','tasks'].map(name=>({name,valid:true})):sql.includes('prd_templates ORDER')?['tpl-admin','tpl-blog','tpl-dashboard','tpl-docs','tpl-ecommerce','tpl-game','tpl-mobile','tpl-portfolio','tpl-saas'].map(id=>({id})):[]});}});
 let spawnAttempts=0;if(process.env.CAPTURE_UNAVAILABLE==='yes'||process.env.PROFILE_DRIFT==='yes'){childProcess.spawn=()=>{spawnAttempts++;throw Error('unexpected fixture worker launch')};syncBuiltinESMExports();}
 let reads=0;globalThis.fixtureRead=async(input,owner)=>{assert.equal(owner,globalThis.fixtureOwner);assert.equal(input.selectionHash.length,64);await owner.begin('isolation level repeatable read read only',async tx=>{await tx.unsafe('SELECT fixture only');});reads++;if(process.env.DRIFT==='yes')globalThis.fixtureDrift=true;if(process.env.PROFILE_DRIFT==='yes')process.env.SETFARM_AGENT_RUNTIME='codex';if(process.env.RECIPE_DRIFT==='yes')writeFileSync(release+'/dist/installation/selected-convergence-recipe-v1.js','/* changed fixed recipe bytes */\\n',{mode:0o600});return {activation:{availability:{state:'unconfigured',code:null},report:null},evaluation:{availability:{state:'unconfigured',code:null},report:null}};};
 const modules={
 'installation/fresh-installation-entry-v1.js':'export async function prepareFreshInstallationOperationalEntryV1(){};export function assertFreshInstallationOperationalEntryV1(){};',
 'db-pg.js':'export const getSql=()=>globalThis.fixtureOwner;export function assertSelectedFreshInstallationOperationalDatabaseV1(){};export async function pgClose(){};',
 'installation/fresh-installation-selection-v1.js':'export const freshInstallationSelectionV1={directory:'+JSON.stringify(root)+',paths:{root:'+JSON.stringify(runtime)+',repository:'+JSON.stringify(release)+',cli:'+JSON.stringify(release+'/dist/cli')+'},state:{origin:{sourceSha:"'+'a'.repeat(40)+'",installationId:"018d819f-0a78-7d38-bb1f-0195b029ddaf"}},catalogHash:"'+'b'.repeat(64)+'",activation:{acknowledged:true,preparedPin:{sha256:"'+'c'.repeat(64)+'"},activatedPin:{sha256:"'+'d'.repeat(64)+'"}},assertUnchanged(){if(globalThis.fixtureDrift)throw Error("drift")}};',
 'installation/selected-convergence-recipe-v1.js':'export async function captureSelectedConvergenceRecipeV1(){if(process.env.CAPTURE_UNAVAILABLE==="yes")throw Error("CONTROL_WORKER_UNAVAILABLE");const runtime=process.env.SETFARM_AGENT_RUNTIME,model=process.env.SETFARM_CODEX_MODEL,subscription=runtime==="subscription";return Object.freeze({fixedSuiteRelativePath:subscription?"evals/suites/product-convergence-minimax-m31-flash-v1.json":"evals/suites/product-convergence-codex-v1.json",executionProfile:Object.freeze({schema:"setfarm.model-execution-profile.v1",providerId:subscription?"minimax":"codex",modelId:subscription?"minimax/MiniMax-M3.1-Flash":"codex/"+model,selection:"primary"}),workerEnv:Object.freeze(subscription?{SETFARM_AGENT_RUNTIME:"subscription"}:{SETFARM_AGENT_RUNTIME:"codex",SETFARM_CODEX_MODEL:model}),assertUnchanged(){if(process.env.SETFARM_AGENT_RUNTIME!==runtime||process.env.SETFARM_CODEX_MODEL!==model)throw Error("profile drift")}})}',
 'evals/control-evidence-reader-v1.js':'export async function readSelectedControlEvidenceV1(){throw Error("FS reader must not qualify")} ',
 'evals/control-evidence-admission-reader-v1.js':'export const readSelectedControlEvidenceWithAdmissionV1=globalThis.fixtureRead;',
 'evals/suite-schema-v2.js':'export async function loadConvergenceSuiteVersioned(file){if(file!==globalThis.fixtureSuiteFile)throw Error("crossed selected suite");return {suiteHash:"'+'e'.repeat(64)+'",suite:{cases:Array.from({length:8},(_,i)=>({caseId:"case-"+i}))}}}',
 };
 registerHooks({resolve(specifier,context,next){if(specifier.startsWith('file://'+release+'/dist/')){const name=specifier.slice(('file://'+release+'/dist/').length);if(name.startsWith('execution/schemas/'))return next(${JSON.stringify(sf)}+name.replace(/\\.js$/,'.ts'),context);if(name in modules)return {url:'fixture:'+name,shortCircuit:true};}if(specifier==='./product-build-authority-v2-delivery-evidence-v1.js'&&context.parentURL?.endsWith('fresh-installation-runtime.ts'))return {url:'fixture:build',shortCircuit:true};return next(specifier,context);},load(url,context,next){if(url==='fixture:build')return {format:'module',source:'export const productBuildAuthorityV2LoadedBuildStartupStateV1=()=>({status:"available",response:{loadedBuild:{buildIdentity:{sourceSha:"'+'f'.repeat(40)+'",buildHash:"'+'1'.repeat(64)+'"}}}});',shortCircuit:true};if(url.startsWith('fixture:'))return {format:'module',source:modules[url.slice(8)],shortCircuit:true};return next(url,context);}});
 const api=await import(${JSON.stringify(new URL('./fresh-installation-runtime.ts', import.meta.url).href)});await api.prepareFreshMissionControlRuntimeV1();if(process.env.MISSING==='yes')unlinkSync(release+'/dist/evals/control-evidence-admission-reader-v1.js');if(process.env.MISSING_RECIPE==='yes')unlinkSync(release+'/dist/installation/selected-convergence-recipe-v1.js');await api.prepareFreshMissionControlControlsV1();
 const jobs=api.freshMissionControlControlsV1();if(process.env.MISSING==='yes'||process.env.MISSING_RECIPE==='yes'){assert.equal(jobs,null);assert.equal(reads,0);process.exit(0);}assert.ok(jobs);if(process.env.DRIFT==='yes'||process.env.RECIPE_DRIFT==='yes')await assert.rejects(()=>jobs.evidence());else assert.equal((await jobs.evidence()).selectionHash.length,64);assert.equal(reads,1);
 if(process.env.CAPTURE_UNAVAILABLE==='yes'||process.env.PROFILE_DRIFT==='yes'){const selectionHash=(await jobs.evidence()).selectionHash;await assert.rejects(()=>jobs.create({kind:'convergence_full8',idempotencyKey:'unavailable-profile-1234567890',expectedSelectionHash:selectionHash}),/CONTROL_WORKER_UNAVAILABLE/);assert.equal(spawnAttempts,0);assert.equal(existsSync(runtime+'/mission-control/controls'),false);}
 `;
    const env = { PATH: process.env.PATH!, HOME: process.env.HOME!, SETFARM_INSTALLATION_DIR: root, SETFARM_REPO_DIR: release, SETFARM_AGENT_RUNTIME: 'codex', SETFARM_CODEX_MODEL: 'gpt-6.1-sol' };
    for (const [name, flags] of [
        ['codex current recipe', {}], ['post-read selector drift', { DRIFT: 'yes' }],
        ['missing profile leaves evidence available and full8 unavailable', { SETFARM_AGENT_RUNTIME: undefined, SETFARM_CODEX_MODEL: undefined, CAPTURE_UNAVAILABLE: 'yes' }],
        ['unsupported profile leaves evidence available and full8 unavailable', { SETFARM_AGENT_RUNTIME: 'unsupported', SETFARM_CODEX_MODEL: undefined, CAPTURE_UNAVAILABLE: 'yes' }],
        ['annual MiniMax recipe', { SETFARM_AGENT_RUNTIME: 'subscription', SETFARM_CODEX_MODEL: undefined }],
        ['post-read annual profile drift', { SETFARM_AGENT_RUNTIME: 'subscription', SETFARM_CODEX_MODEL: undefined, PROFILE_DRIFT: 'yes' }],
        ['post-read recipe module drift', { SETFARM_AGENT_RUNTIME: 'subscription', SETFARM_CODEX_MODEL: undefined, RECIPE_DRIFT: 'yes' }],
        ['missing recipe module', { MISSING_RECIPE: 'yes' }], ['missing admission adapter', { MISSING: 'yes' }],
    ] as const) {
        for (const name of fixed) writeFileSync(path.join(release, 'dist', name), '/* fixed test module bytes */\n', { mode: 0o600 });
        try {
            execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { encoding: 'utf8', timeout: 15000, env: { ...env, ...flags }, stdio: 'pipe' });
        } catch (error) { throw new Error('compiled composition case: ' + name, { cause: error }); }
    }
});
