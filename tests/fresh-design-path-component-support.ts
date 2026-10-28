import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';

// Exact Source components plus owned-FS/DATA ports. No application import,
// operational-entry/SQL authority, external provider or child is admitted here.
export function source(relative: string, optional = false): string {
  const file = new URL('../' + relative, import.meta.url);
  if (optional && !fs.existsSync(file)) return '';
  assert.ok(fs.statSync(file).size <= 262144, 'bounded component source');
  return fs.readFileSync(file, 'utf8');
}
function tree(relative: string) {
  const text = source(relative);
  return ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true);
}
function declarations(relative: string, required: string[], optional: string[] = []): string {
  const parsed = tree(relative), found = new Set<string>();
  const body = parsed.statements.filter(node => {
    if (!ts.isFunctionDeclaration(node) || !node.name || ![...required, ...optional].includes(node.name.text)) return false;
    found.add(node.name.text); return true;
  }).map(node => node.getText(parsed)).join('\n');
  for (const name of required) assert.ok(found.has(name), `${relative}: exact top-level ${name}`);
  return body.replace(/\bexport\s+(?=(?:async\s+)?function\b)/g, '');
}
function compile(body: string, bindings: Record<string, unknown>, result: string): any {
  const js = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return new Function(...Object.keys(bindings), js + '\nreturn ' + result + ';')(...Object.values(bindings));
}
function callback(relative: string, method: string, route: string, optional = false): string {
  const parsed = tree(relative);
  const matches = parsed.statements.filter(ts.isExpressionStatement).map(node => node.expression)
    .filter(ts.isCallExpression).filter(node => ts.isPropertyAccessExpression(node.expression)
      && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'router'
      && node.expression.name.text === method && node.arguments[0] && ts.isStringLiteral(node.arguments[0])
      && node.arguments[0].text === route);
  if (optional && matches.length === 0) return 'undefined';
  assert.equal(matches.length, 1, 'one exact top-level router callback');
  const value = matches[0]!.arguments[1]!;
  assert.ok(ts.isArrowFunction(value) || ts.isFunctionExpression(value));
  return value.getText(parsed);
}

export function fixture() {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mc-private-design-')));
  fs.chmodSync(base, 0o700);
  const paths = { projectsDir: path.join(base, 'selected/projects'), setfarmDir: path.join(base, 'selected/runtime'),
    mobileDir: path.join(base, 'selected/mobile'), setfarmRepoDir: path.join(base, 'release'), scriptsDir: path.join(base, 'scripts') };
  for (const directory of [paths.projectsDir, paths.setfarmDir, paths.mobileDir]) fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  return { base, paths, repo: path.join(paths.projectsDir, 'app'),
    dispose: () => fs.rmSync(base, { recursive: true, force: true }) };
}
type Options = { selected?: boolean; refuse?: boolean; exists?: typeof fs.existsSync; runs?: any[]; projectId?: string; screenId?: string; refuseAfterNextPort?: 'fetch' | 'json'; command?: (args: string[]) => Buffer | string };
const helperNames = ['assertSelectedDesignIdsV1', 'selectedDesignCacheRootV1', 'selectedDesignCacheDirectoryV1',
  'selectedDesignRepositoryV1', 'selectedDesignRepositoryPathV1', 'selectedDesignArtifactFileV1'];
export function ports(base: string, options: Options = {}) {
  const paths = { projectsDir: path.join(base, 'selected/projects'), setfarmDir: path.join(base, 'selected/runtime'),
    mobileDir: path.join(base, 'selected/mobile'), setfarmRepoDir: path.join(base, 'release'), scriptsDir: path.join(base, 'scripts') };
  const env = { HOME: path.join(base, 'legacy-home'), SETFARM_PROJECTS_DIR: path.join(base, 'legacy-alias'), OPENCLAW_PROJECTS_DIR: path.join(base, 'openclaw-alias') };
  const freshMissionControlPathsV1 = () => { if (options.refuse) throw Error('selected context refused'); return options.selected === false ? null : paths; };
  const processPort = { env, cwd: () => base, getuid: () => process.getuid!() };
  const leaf = source('server/services/fresh-design-artifact-paths-v1.ts', true);
  const body = leaf ? leaf.replace(/^import .*;\s*$/gm, '').replace(/\bexport\s+(?=function\b)/g, '') : '';
  const helpers = leaf ? compile(body, { path, lstatSync: fs.lstatSync, realpathSync: fs.realpathSync,
    process: processPort, freshMissionControlPathsV1, Buffer }, '{' + helperNames.join(',') + '}') : {};
  // Missing new Source is deliberately NOT substituted on the RED baseline.
  const bindings = Object.fromEntries(helperNames.map(name => [name, helpers[name]]));
  return { paths, helpers, bindings, processPort, freshMissionControlPathsV1 };
}
const activityRequired = ['noStore', 'parseRunContext', 'safeJson', 'compactDisplay', 'formatListEntry', 'parseList',
  'contractStatus', 'normalizeVisibleStatus', 'countFiles', 'readRepoContract', 'buildFallbackContract', 'uniquePaths',
  'projectRootCandidates', 'stitchCacheDir', 'resolveRunStitchDirs', 'findRunStitchFile', 'designArtifactUrl',
  'resolveRunProjectId', 'createBuildingProject', 'syncProjectsFromRuns'];
export function activity(base: string, options: Options = {}) {
  const p = ports(base, options), calls: string[] = [], commands: string[][] = [], cacheWrites: string[] = [];
  const record = (name: string) => { calls.push(name); };
  const unexpected = () => { throw Error('unexpected V3 component path'); };
  const bindings: Record<string, unknown> = { ...p.bindings, PATHS: p.paths, process: p.processPort,
    freshMissionControlPathsV1: p.freshMissionControlPathsV1, join: path.join, basename: path.basename,
    existsSync: options.exists ?? fs.existsSync, readFileSync: fs.readFileSync, readdirSync: fs.readdirSync,
    mkdirSync: ((directory: fs.PathLike, settings: any) => { cacheWrites.push(String(directory)); return fs.mkdirSync(directory, settings); }), console: { log() {}, warn() {}, error() {} },
    config: { internalUrl: 'http://component.invalid' }, getRuns: async () => options.runs ?? [],
    // Unrelated business/transport DATA ports force the actual repo boundaries.
    extractProjectName: () => 'MeaningfulApp', isV3RunProtocol: () => false, isMobileProject: () => false,
    fetch: async () => { record('fetch');
      if (options.refuseAfterNextPort === 'fetch') options.refuse = true;
      return { json: async () => { if (options.refuseAfterNextPort === 'json') options.refuse = true; return { port: 9001 }; } }; },
    detectStack: () => { record('stack'); return []; }, detectBackend: () => { record('backend'); return null; },
    createProjectProgrammatic: () => { record('registry'); return { created: false, reason: 'deleted' }; },
    updateProjectById: () => record('registry-update'), autoDeployProject: () => { record('deploy'); return { deployed: false }; },
    syncIncrementalV3ProjectTransfers: unexpected, transferSelectedV3Run: unexpected,
    execFileSync: (_command: string, args: string[]) => { commands.push([...args]); record(args[1]!); if (options.command) return options.command(args);
      if (args[1] === 'populate-cache') return Buffer.from(JSON.stringify({ success: true, copied: 0 }));
      if (args[1] === 'download') { fs.writeFileSync(args[3]!, 'saved', { mode: 0o600 }); return Buffer.from(JSON.stringify({ path: args[3], size: 5 })); }
      return Buffer.from(JSON.stringify([
      { id: options.screenId ?? 'def456', screenshotUrl: 'https://component.invalid/image', htmlUrl: 'https://component.invalid/html' },
    ])); },
  };
  const body = declarations('server/routes/setfarm-activity.ts', activityRequired, ['designArtifactFilePathV1', 'respondRunDesign', 'retrieveRunDesignArtifacts']);
  const result = compile(body, bindings, '{roots:projectRootCandidates,cache:stitchCacheDir,find:findRunStitchFile,'
    + 'dirs:resolveRunStitchDirs,projectId:resolveRunProjectId,contract:readRepoContract,fallback:buildFallbackContract,'
    + 'create:createBuildingProject,sync:syncProjectsFromRuns}');
  const routeBody = body + '\nconst route = ' + callback('server/routes/setfarm-activity.ts', 'get', '/setfarm/runs/:id/design') + ';';
  const retrieveBody = body + '\nconst route = ' + callback('server/routes/setfarm-activity.ts', 'post', '/setfarm/runs/:id/design/retrieve', true) + ';';
  return { ...result, calls, commands, cacheWrites, design: compile(routeBody, bindings, 'route'),
    designRetrieve: compile(retrieveBody, bindings, 'route') };
}

export function service(base: string, options: Options = {}) {
  const p = ports(base, options), calls: string[] = [], parsed = tree('server/services/stitch-integration.ts');
  const constants = parsed.statements.filter(ts.isVariableStatement).filter(node => node.declarationList.declarations
    .some(declaration => ts.isIdentifier(declaration.name) && ['SAFE_ID_RE', 'STITCH_CACHE_DIR'].includes(declaration.name.text)))
    .map(node => node.getText(parsed)).join('\n');
  const names = ['validateStitchId', 'parseProjectId', 'ensureStitchProject', 'createStitchProject', 'generateScreen', 'listScreens',
    'downloadScreen', 'generateMockupsFromPrd', 'deleteScreenFromCache', 'regenerateScreen', 'prepareDesignFilesForRepo'];
  const body = constants + '\n' + declarations('server/services/stitch-integration.ts', names);
  const bindings = { ...p.bindings, PATHS: p.paths, join: path.join, existsSync: fs.existsSync, mkdirSync: fs.mkdirSync,
    freshMissionControlSelectedV1: () => p.freshMissionControlPathsV1() !== null,
    console: { error() {}, log() {} }, setTimeout: (fn: () => void) => { fn(); return 1; },
    runStitch: async (args: string[]) => {
      calls.push(args[0]!);
      if (args[0] === 'create-project' || args[0] === 'ensure-project') return JSON.stringify({ projectId: options.projectId ?? 'abc123' });
      if (args[0] === 'generate-screen-safe') return JSON.stringify({ screens: [{ screenId: options.screenId ?? 'def456', title: 'Home' }] });
      if (args[0] === 'extract-tokens') return JSON.stringify({ css: 'body { color: red; }' });
      if (args[0] === 'download-screen') {
        // Test-owned provider DATA sink only; no process/network is invoked.
        fs.writeFileSync(args[3]!, 'downloaded html', { mode: 0o600 });
        fs.writeFileSync(args[3]!.replace(/\.html$/, '.png'), 'downloaded png', { mode: 0o600 });
      }
      return '{}';
    } };
  return { ...compile(body, bindings, '{' + names.join(',') + '}'), calls };
}

export function prdRoute(base: string, route: string, options: Options = {}) {
  const p = ports(base, options), calls: string[] = [];
  const bindings = { ...p.bindings, PATHS: p.paths, join: path.join, mkdirSync: fs.mkdirSync,
    setInterval: () => 1, clearInterval: () => {}, setTimeout: (fn: () => void) => { fn(); return 1; },
    getPrd: async () => ({ title: 'App', platform: 'web', prd_content: '# Home\nContent', mockup_screens: [
      { id: 'source', name: 'Home', projectId: options.projectId ?? 'abc123' },
    ] }), updatePrd: async () => { calls.push('db:update'); },
    createStitchProject: async () => { calls.push('create'); return options.projectId ?? 'abc123'; },
    extractScreenPrompts: () => [{ title: 'Home', prompt: 'Home', device: 'DESKTOP' }],
    generateScreen: async () => { calls.push('generate'); return { screenId: 'def456', title: 'Home', status: 'done' }; },
    downloadScreen: async () => { calls.push('download'); return null; },
  };
  return { calls, run: compile('const route = ' + callback('server/routes/prd-generator.ts', route === '/prd/mockups/stream' ? 'get' : 'post', route) + ';', bindings, 'route') };
}
export function response() {
  const bodies: any[] = [], chunks: string[] = [];
  return { bodies, chunks, statusCode: 200, status(value: number) { this.statusCode = value; return this; },
    set() { return this; }, json(value: any) { bodies.push(value); return this; }, writeHead() {},
    write(value: string) { chunks.push(value); }, end() {} };
}
export function request(projectId: string) {
  return { params: { prdId: 'prd', id: 'run' }, query: { prdId: 'prd', projectId },
    body: { projectId, title: 'Home', sourceScreenId: 'source' },
    socket: { setTimeout() {}, setNoDelay() {}, setKeepAlive() {} } };
}
