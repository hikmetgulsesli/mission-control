import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { activity, fixture, ports, prdRoute, request, response, service } from './fresh-design-path-component-support.js';

// Source/owned-FS components only: these tests never qualify operational entry,
// owned SQL, a provider, HTTP server or genuine workflow execution.
const invalid = /MC_FRESH_DESIGN_INPUT_INVALID/;
function privateRepo(f: ReturnType<typeof fixture>) {
  fs.mkdirSync(path.join(f.repo, 'stitch'), { recursive: true, mode: 0o755 });
  fs.chmodSync(f.repo, 0o755); fs.chmodSync(path.join(f.repo, 'stitch'), 0o755);
  return f.repo;
}

test('shared actual Source accepts the existing selected ID domain and rejects non-segments', () => {
  const f = fixture();
  try {
    const { helpers: h } = ports(f.base);
    assert.equal(typeof h.assertSelectedDesignIdsV1, 'function');
    h.assertSelectedDesignIdsV1('project-123', ['screen_ABC', 'a'.repeat(128)]);
    for (const id of ['', '.', '..', '../escaped', 'a/b', 'a\\b', 'a\0b', 'a\nb', 'a'.repeat(129), null, 1, {}]) {
      assert.throws(() => h.assertSelectedDesignIdsV1(id), invalid);
      assert.throws(() => h.assertSelectedDesignIdsV1('project-123', [id]), invalid);
    }
  } finally { f.dispose(); }
});

test('private 0755 Git descendants work; foreign, alias, root and writable repositories refuse', () => {
  const f = fixture();
  try {
    const h = ports(f.base).helpers, repo = privateRepo(f);
    assert.equal(h.selectedDesignRepositoryV1(repo), repo);
    assert.equal(h.selectedDesignRepositoryPathV1(repo, 'stitch'), path.join(repo, 'stitch'));
    assert.equal(h.selectedDesignRepositoryV1(path.join(f.paths.projectsDir, 'not-created')), null);
    for (const value of [undefined, null, '']) assert.equal(h.selectedDesignRepositoryV1(value), null);
    for (const value of [f.paths.projectsDir, path.join(f.base, 'foreign'), 'relative', repo + '/',
      f.paths.projectsDir + '/app/../other', f.paths.projectsDir + '/../../foreign']) {
      assert.throws(() => h.selectedDesignRepositoryV1(value), invalid);
    }
    fs.chmodSync(repo, 0o775);
    assert.throws(() => h.selectedDesignRepositoryV1(repo), invalid);
    fs.chmodSync(repo, 0o755);
    const alias = path.join(f.paths.projectsDir, 'alias'); fs.symlinkSync(repo, alias);
    assert.throws(() => h.selectedDesignRepositoryV1(alias), invalid);
  } finally { f.dispose(); }
});

test('shared Source refuses symlink directories and hardlinked artifact/metadata leaves', () => {
  const f = fixture();
  try {
    const h = ports(f.base).helpers, repo = privateRepo(f), cache = h.selectedDesignCacheDirectoryV1('abc123');
    fs.mkdirSync(cache, { recursive: true, mode: 0o700 });
    const original = path.join(f.base, 'original'); fs.writeFileSync(original, 'retain', { mode: 0o600 });
    fs.linkSync(original, path.join(cache, 'def456.html'));
    fs.linkSync(original, path.join(repo, '.stitch'));
    assert.throws(() => h.selectedDesignArtifactFileV1(cache, 'def456.html'), invalid);
    assert.throws(() => h.selectedDesignRepositoryPathV1(repo, '.stitch'), invalid);
    assert.throws(() => h.selectedDesignArtifactFileV1(cache, '../original'), invalid);
    const cacheAlias = path.join(f.paths.setfarmDir, 'stitch-cache', 'alias'); fs.symlinkSync(cache, cacheAlias);
    assert.throws(() => h.selectedDesignCacheDirectoryV1('alias'), invalid);
    assert.equal(fs.readFileSync(original, 'utf8'), 'retain');
  } finally { f.dispose(); }
});

test('each shared public seam propagates selected-context refusal before input handling', () => {
  const f = fixture();
  try {
    const options = { refuse: false }, h = ports(f.base, options).helpers;
    options.refuse = true;
    for (const [name, args] of [
      ['assertSelectedDesignIdsV1', ['../bad']], ['selectedDesignCacheRootV1', []],
      ['selectedDesignCacheDirectoryV1', ['../bad']], ['selectedDesignRepositoryV1', ['foreign']],
      ['selectedDesignRepositoryPathV1', ['foreign', '../bad']], ['selectedDesignArtifactFileV1', ['foreign', '../bad']],
    ] as const) assert.throws(() => h[name](...args), /selected context refused/);
  } finally { f.dispose(); }
});

for (const route of ['/prd/mockups/stream', '/prd/screens/:prdId/variant', '/prd/screens/:prdId/generate-missing']) {
  test(`actual ${route} refuses raw project ID before cache mkdir, provider and PRD mutation`, async () => {
    const f = fixture();
    try {
      const c = prdRoute(f.base, route, { projectId: '../escaped' }), res = response();
      await c.run(request('../escaped'), res);
      assert.deepEqual(c.calls, []);
      assert.equal(fs.existsSync(path.join(f.paths.setfarmDir, 'escaped')), false);
      assert.match(JSON.stringify(res.bodies) + res.chunks.join(''), invalid);
    } finally { f.dispose(); }
  });
}

test('actual mockup service rejects a malformed provider project ID before follow-on generation/cache', async () => {
  const f = fixture();
  try {
    const c = service(f.base, { projectId: '../escaped' });
    await assert.rejects(c.generateMockupsFromPrd('# Home\nPage', 'App', 'web'), invalid);
    assert.deepEqual(c.calls, ['create-project']);
    assert.equal(fs.existsSync(path.join(f.paths.setfarmDir, 'escaped')), false);
  } finally { f.dispose(); }
});

test('actual download/regenerate/delete services confine output and leave foreign or linked data intact', async () => {
  const f = fixture();
  try {
    const c = service(f.base), h = ports(f.base).helpers, foreign = path.join(f.base, 'foreign');
    assert.equal(await c.downloadScreen('abc123', 'def456', foreign), null);
    assert.deepEqual(c.calls, []); assert.equal(fs.existsSync(foreign), false);
    await assert.rejects(c.regenerateScreen('../escaped', 'def456', 'prompt', 'Home'), invalid);
    const cache = h.selectedDesignCacheDirectoryV1('abc123'); fs.mkdirSync(cache, { recursive: true, mode: 0o700 });
    const original = path.join(f.base, 'original'); fs.writeFileSync(original, 'retain', { mode: 0o600 });
    fs.linkSync(original, path.join(cache, 'def456.html'));
    assert.equal(await c.downloadScreen('abc123', 'def456', cache), null);
    assert.deepEqual(c.calls, []);
    await c.deleteScreenFromCache('abc123', 'def456');
    assert.equal(fs.existsSync(path.join(cache, 'def456.html')), true);
    assert.equal(fs.readFileSync(original, 'utf8'), 'retain');
    fs.unlinkSync(path.join(cache, 'def456.html'));
    fs.writeFileSync(path.join(cache, 'def456.html'), 'private', { mode: 0o600 });
    assert.equal(await c.deleteScreenFromCache('abc123', 'def456'), true);
    assert.equal(fs.existsSync(path.join(cache, 'def456.html')), false);
  } finally { f.dispose(); }
});

test('actual prepareDesignFiles copies private cache into a 0755 Git repo and guards metadata writes', async () => {
  const f = fixture();
  try {
    const c = service(f.base), h = ports(f.base).helpers, repo = privateRepo(f), cache = h.selectedDesignCacheDirectoryV1('abc123');
    fs.mkdirSync(cache, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(cache, 'def456.html'), '<main>private</main>', { mode: 0o600 });
    fs.writeFileSync(path.join(cache, 'def456.png'), 'private png', { mode: 0o600 });
    const screens = [{ screenId: 'def456', title: 'Home Page', status: 'done' }];
    const result = await c.prepareDesignFilesForRepo('abc123', screens, repo);
    assert.deepEqual(result.screenMap, { 'Home Page': 'def456' });
    assert.equal(fs.readFileSync(path.join(repo, 'stitch/Home-Page.html'), 'utf8'), '<main>private</main>');
    assert.equal(fs.readFileSync(path.join(repo, 'stitch/Home-Page.png'), 'utf8'), 'private png');
    assert.equal(JSON.parse(fs.readFileSync(path.join(repo, '.stitch'), 'utf8')).projectId, 'abc123');
    assert.equal(JSON.parse(fs.readFileSync(path.join(repo, 'stitch/DESIGN_MANIFEST.json'), 'utf8')).screens[0].id, 'def456');
    assert.equal(fs.readFileSync(path.join(repo, 'stitch/design-tokens.css'), 'utf8'), 'body { color: red; }');
    const original = path.join(f.base, 'original'); fs.writeFileSync(original, 'retain', { mode: 0o600 });
    fs.unlinkSync(path.join(repo, '.stitch')); fs.linkSync(original, path.join(repo, '.stitch'));
    await assert.rejects(c.prepareDesignFilesForRepo('abc123', screens, repo), invalid);
    assert.equal(fs.readFileSync(original, 'utf8'), 'retain');
    await assert.rejects(c.prepareDesignFilesForRepo('abc123', screens, path.join(f.base, 'foreign')), invalid);
    assert.equal(fs.existsSync(path.join(f.base, 'foreign')), false);
  } finally { f.dispose(); }
});

test('actual ctx.repo readers and both project synchronization paths refuse foreign repos before effects', async () => {
  const f = fixture();
  try {
    const foreign = path.join(f.base, 'foreign'); fs.mkdirSync(foreign, { mode: 0o700 });
    fs.writeFileSync(path.join(foreign, '.stitch'), JSON.stringify({ projectId: 'abc123' }), { mode: 0o600 });
    const run = { id: 'run', workflow_id: 'feature-dev', status: 'completed', task: 'Build MeaningfulApp', context: { repo: foreign } };
    const c = activity(f.base, { runs: [run] });
    assert.throws(() => c.dirs(run, 'abc123'), invalid);
    assert.throws(() => c.find(run, 'abc123', 'screen.html'), invalid);
    assert.throws(() => c.projectId(run, 'STITCH_PROJECT_ID: abc123'), invalid);
    assert.throws(() => c.contract(run), invalid);
    assert.throws(() => c.fallback(run, []), invalid);
    await assert.rejects(c.create(run), invalid);
    await assert.rejects(c.sync({ excludeV3: true }), invalid);
    assert.deepEqual(c.calls, []);
    const route = activity(f.base, { runs: [{ ...run, steps: [{ step_id: 'design', status: 'done',
      output: 'STITCH_PROJECT_ID: abc123\nSCREEN_MAP:\n[\n {"screenId":"def456","name":"Home"}\n]\n' }] }] });
    const res = response(); await route.design(request('abc123'), res);
    assert.match(JSON.stringify(res.bodies), invalid); assert.deepEqual(route.calls, []);
    const failed = activity(f.base, { runs: [{ ...run, status: 'failed' }] });
    await assert.rejects(failed.sync({ excludeV3: true }), invalid);
    assert.deepEqual(failed.calls, []);
  } finally { f.dispose(); }
});

test('absent private repo is omitted without basename fallback or relative CWD contract reads', () => {
  const f = fixture();
  try {
    const lookups: string[] = [];
    const c = activity(f.base, { exists: ((value: fs.PathLike) => { lookups.push(String(value)); return fs.existsSync(value); }) as typeof fs.existsSync });
    const run = { id: 'run', context: { repo: path.join(f.paths.projectsDir, 'missing') }, steps: [] };
    assert.deepEqual(c.dirs(run, 'abc123'), [path.join(f.paths.setfarmDir, 'stitch-cache/abc123')]);
    assert.equal(c.projectId(run), null); assert.equal(c.contract(run), null);
    const result = c.fallback(run, []);
    assert.equal(result.project.repo, ''); assert.equal(result.artifacts.stitchDir, '');
    assert.ok(lookups.every(value => value === '' || path.isAbsolute(value)));
    assert.ok(!lookups.some(value => value === 'DESIGN_MANIFEST.json' || value === 'DESIGN_DOM.json' || value === 'UI_CONTRACT.json'));
  } finally { f.dispose(); }
});

test('actual design retrieval gives populate-cache only the validated private 0755 repo and private cache', async () => {
  const f = fixture();
  try {
    const repo = privateRepo(f), run = { id: 'run', context: { repo }, steps: [{ step_id: 'design', status: 'done',
      output: 'STITCH_PROJECT_ID: abc123\nSCREEN_MAP:\n[\n {"screenId":"def456","name":"Home"}\n]\n' }] };
    const c = activity(f.base, { runs: [run] }), res = response();
    await c.designRetrieve(request('abc123'), res);
    const populated = c.commands.filter((args: string[]) => args[1] === 'populate-cache');
    assert.equal(populated.length, 1);
    assert.equal(populated[0]![2], path.join(repo, 'stitch'));
    assert.equal(populated[0]![3], path.join(f.paths.setfarmDir, 'stitch-cache/abc123'));
    assert.ok(!JSON.stringify(res.bodies).includes('MC_FRESH_DESIGN_INPUT_INVALID'));
  } finally { f.dispose(); }
});

test('actual design retrieval rejects remote screen traversal before manual download filename writes', async () => {
  const f = fixture();
  try {
    const run = { id: 'run', context: {}, steps: [{ step_id: 'design', status: 'done',
      output: 'STITCH_PROJECT_ID: abc123\nSCREEN_MAP:\n[\n {"screenId":"def456","name":"Home"}\n]\n' }] };
    const c = activity(f.base, { runs: [run], screenId: '../../escaped' }), res = response();
    await c.designRetrieve(request('abc123'), res);
    assert.equal(c.calls.includes('download'), false);
    assert.equal(fs.existsSync(path.join(f.paths.setfarmDir, 'escaped.png')), false);
    assert.equal(fs.existsSync(path.join(f.paths.setfarmDir, 'escaped.html')), false);
    assert.ok(c.calls.includes('list-screens'), 'the real manual writer boundary was reached');
  } finally { f.dispose(); }
});

for (const phase of ['fetch', 'json'] as const) {
  test(`actual building projection rechecks selected refusal after next-port ${phase} before stack/registry`, async () => {
    const f = fixture();
    try {
      const repo = privateRepo(f), options = { refuse: false, refuseAfterNextPort: phase };
      const c = activity(f.base, options);
      const run = { id: 'run', workflow_id: 'feature-dev', task: 'Build MeaningfulApp', context: { repo } };
      await assert.rejects(c.create(run), /selected context refused/);
      assert.equal(options.refuse, true, 'the selected DATA lifecycle changed during the awaited port');
      assert.deepEqual(c.calls, ['fetch']);
    } finally { f.dispose(); }
  });
}
