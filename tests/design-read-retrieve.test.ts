import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { activity, fixture, request, response } from './fresh-design-path-component-support.js';

// Actual route callbacks and helpers, with only provider commands and owned FS
// ports modeled. No server import, live DB, provider or workflow execution.
const map = 'SCREEN_MAP:\n[\n {"screenId":"def456","name":"Home"}\n]\n';
const output = 'STITCH_PROJECT_ID: abc123\n' + map + 'DESIGN_SYSTEM:\n  primary: blue\nDESIGN_NOTES: Saved design\n';
const run = (repo?: string, text = output, status = 'done') => ({ id: 'run', context: repo ? { repo } : {},
  steps: [{ step_id: 'design', status, output: text }] });
function localRepo(f: ReturnType<typeof fixture>) {
  fs.mkdirSync(path.join(f.repo, 'stitch'), { recursive: true, mode: 0o755 });
  return path.join(f.repo, 'stitch');
}
function assertLocal(screen: any, screenshot = 'def456.png', html = 'def456.html') {
  assert.equal(screen.screenshotUrl, screenshot ? '/api/setfarm/runs/run/design-artifact/' + screenshot : null);
  assert.equal(screen.htmlUrl, html ? '/api/setfarm/runs/run/design-artifact/' + html : null);
}

test('GET with recorded screens and missing cache makes no provider calls or FS writes', async () => {
  const f = fixture();
  try {
    const c = activity(f.base, { runs: [run()] }), res = response();
    await c.design(request('abc123'), res);
    assert.deepEqual(c.commands, []); assert.deepEqual(c.cacheWrites, []);
    assert.equal(fs.existsSync(path.join(f.paths.setfarmDir, 'stitch-cache')), false);
    assert.equal(res.statusCode, 200); assertLocal(res.bodies[0].screens[0], '', '');
    assert.deepEqual(res.bodies[0].designSystem, { primary: 'blue' });
    assert.equal(res.bodies[0].designNotes, 'Saved design');
  } finally { f.dispose(); }
});

test('GET without screen map never lists provider screens', async () => {
  const f = fixture();
  try {
    const c = activity(f.base, { runs: [run(undefined, 'STITCH_PROJECT_ID: abc123\n')] }), res = response();
    await c.design(request('abc123'), res);
    assert.deepEqual(c.commands, []); assert.deepEqual(c.cacheWrites, []);
    assert.deepEqual(res.bodies[0].screens, []);
  } finally { f.dispose(); }
});

for (const kind of ['map', 'manifest', 'html'] as const) {
  test(`GET resolves guarded repo-local ${kind} artifacts without project ID or cache writes`, async () => {
    const f = fixture();
    try {
      const dir = localRepo(f);
      fs.writeFileSync(path.join(dir, 'def456.html'), '<main>Home</main>', { mode: 0o600 });
      if (kind !== 'html') fs.writeFileSync(path.join(dir, 'def456.png'), 'saved', { mode: 0o600 });
      if (kind === 'manifest') fs.writeFileSync(path.join(dir, 'DESIGN_MANIFEST.json'), JSON.stringify({ screens: [
        { id: 'def456', title: 'Home', htmlFile: 'def456.html', screenshot: 'def456.png' },
      ] }), { mode: 0o600 });
      const c = activity(f.base, { runs: [run(f.repo, kind === 'map' ? map : 'DESIGN_NOTES: saved\n')] }), res = response();
      await c.design(request(''), res);
      assert.equal(res.statusCode, 200); assert.equal(res.bodies[0].projectId, null);
      assert.equal(res.bodies[0].screens.length, 1);
      assertLocal(res.bodies[0].screens[0], kind === 'html' ? '' : 'def456.png');
      assert.deepEqual(c.commands, []); assert.deepEqual(c.cacheWrites, []);
      assert.equal(fs.existsSync(path.join(f.paths.setfarmDir, 'stitch-cache')), false);
    } finally { f.dispose(); }
  });
}

for (const method of ['design', 'designRetrieve'] as const) {
  test(`${method} preserves incomplete and no-output short circuits with no effects`, async () => {
    const f = fixture();
    try {
      for (const item of [run(undefined, output, 'running'), run(undefined, '')]) {
        const c = activity(f.base, { runs: [item] }), res = response();
        assert.equal(typeof c[method], 'function'); await c[method](request('abc123'), res);
        assert.deepEqual(res.bodies, [{ screens: [], projectId: null, designSystem: null }]);
        assert.deepEqual(c.commands, []); assert.deepEqual(c.cacheWrites, []);
      }
    } finally { f.dispose(); }
  });
}

test('POST retrieves provider artifacts once and GET then shows accepted files without effects', async () => {
  const f = fixture();
  try {
    const c = activity(f.base, { runs: [run(undefined, 'STITCH_PROJECT_ID: abc123\n')], command(args) {
      if (args[1] === 'list-screens') return JSON.stringify([{ id: 'def456', screenshotUrl: 'https://component.invalid/image', htmlUrl: 'https://component.invalid/html' }]);
      assert.equal(args[1], 'download'); fs.writeFileSync(args[3]!, 'saved', { mode: 0o600 }); return JSON.stringify({ path: args[3], size: 5 });
    } }), res = response();
    assert.equal(typeof c.designRetrieve, 'function'); await c.designRetrieve(request('abc123'), res);
    assert.equal(res.statusCode, 200); assertLocal(res.bodies[0].screens[0]);
    assert.deepEqual(c.calls, ['list-screens', 'download', 'download']);
    const count = c.commands.length, writes = c.cacheWrites.length, read = response();
    await c.design(request('abc123'), read); assertLocal(read.bodies[0].screens[0]);
    assert.equal(c.commands.length, count); assert.equal(c.cacheWrites.length, writes);
  } finally { f.dispose(); }
});

test('POST populates from guarded repo files and returns the compatible local response', async () => {
  const f = fixture();
  try {
    const dir = localRepo(f); fs.writeFileSync(path.join(dir, 'def456.png'), 'repo', { mode: 0o600 });
    const c = activity(f.base, { runs: [run(f.repo)], command(args) {
      if (args[1] === 'list-screens') return '[]';
      assert.equal(args[1], 'populate-cache'); assert.equal(args[2], dir);
      fs.copyFileSync(path.join(args[2]!, 'def456.png'), path.join(args[3]!, 'def456.png')); return JSON.stringify({ success: true, copied: 1 });
    } }), res = response();
    assert.equal(typeof c.designRetrieve, 'function'); await c.designRetrieve(request('abc123'), res);
    assert.equal(res.statusCode, 200); assertLocal(res.bodies[0].screens[0], 'def456.png', '');
    assert.deepEqual(c.calls, ['populate-cache', 'list-screens']);
  } finally { f.dispose(); }
});

for (const failure of ['list-throw', 'list-json', 'list-shape', 'screen-shape', 'url-shape', 'download', 'download-json', 'download-false', 'download-missing', 'populate', 'populate-json', 'populate-false', 'populate-missing'] as const) {
  test(`POST exposes safe non-success for ${failure} and preserves local/partial artifacts`, async () => {
    const f = fixture();
    try {
      const dir = localRepo(f); fs.writeFileSync(path.join(dir, 'def456.html'), 'existing', { mode: 0o600 });
      if (failure === 'populate-missing') fs.writeFileSync(path.join(dir, 'other.png'), 'copy required', { mode: 0o600 });
      const c = activity(f.base, { runs: [run(f.repo)], command(args) {
        if (args[1] === 'populate-cache') { if (failure === 'populate') throw Error('private /repo secret'); if (failure === 'populate-json') return 'bad json'; if (failure === 'populate-false') return '{"success":false,"copied":0}';
          const files = fs.readdirSync(args[2]!).filter(file => /\.(html|png)$/.test(file));
          if (failure !== 'populate-missing') for (const file of files) fs.copyFileSync(path.join(args[2]!, file), path.join(args[3]!, file));
          return JSON.stringify({ success: true, copied: files.length }); }
        if (args[1] === 'list-screens') {
          if (failure === 'list-throw') throw Error('private provider token');
          if (failure === 'list-json') return 'bad json';
          if (failure === 'list-shape') return '{}';
          if (failure === 'screen-shape') return '[null]';
          if (failure === 'url-shape') return '[{"id":"def456","screenshotUrl":123}]';
          return JSON.stringify([{ id: 'def456', screenshotUrl: 'https://component.invalid/image' }, { id: 'ghi789', htmlUrl: 'https://component.invalid/html' }]);
        }
        assert.equal(args[1], 'download');
        if (failure === 'download-json') return 'bad json';
        if (failure === 'download-false') { fs.writeFileSync(args[3]!, 'saved', { mode: 0o600 }); return JSON.stringify({ success: false, path: args[3], size: 5 }); }
        if (failure === 'download-missing') return JSON.stringify({ path: args[3], size: 5 });
        if (args[3]!.endsWith('.html')) throw Error('private download failure');
        fs.writeFileSync(args[3]!, 'partial success', { mode: 0o600 }); return JSON.stringify({ path: args[3], size: 15 });
      } }), res = response();
      assert.equal(typeof c.designRetrieve, 'function'); await c.designRetrieve(request('abc123'), res);
      assert.equal(res.statusCode, 502);
      assert.ok(c.calls.includes(failure.startsWith('populate') ? 'populate-cache' : failure.startsWith('download') ? 'download' : 'list-screens'), 'the failing effect boundary was reached');
      assert.equal(res.bodies[0].code, 'DESIGN_RETRIEVAL_FAILED');
      assert.equal(typeof res.bodies[0].error, 'string'); assert.doesNotMatch(JSON.stringify(res.bodies), /private|token|secret/);
      assert.equal(fs.readFileSync(path.join(dir, 'def456.html'), 'utf8'), 'existing');
      const count = c.commands.length, read = response(); await c.design(request('abc123'), read);
      assert.equal(read.statusCode, 200); assertLocal(read.bodies[0].screens[0], failure === 'download' || failure === 'download-false' ? 'def456.png' : '', 'def456.html');
      assert.equal(c.commands.length, count);
      if (failure === 'download') assert.equal(fs.readFileSync(path.join(f.paths.setfarmDir, 'stitch-cache/abc123/def456.png'), 'utf8'), 'partial success');
    } finally { f.dispose(); }
  });
}

test('POST accepts valid empty provider data and explicitly refuses missing project prerequisite', async () => {
  const f = fixture();
  try {
    const c = activity(f.base, { runs: [run(undefined, 'STITCH_PROJECT_ID: abc123\n')], command: () => '[]' }), res = response();
    assert.equal(typeof c.designRetrieve, 'function'); await c.designRetrieve(request('abc123'), res);
    assert.equal(res.statusCode, 200); assert.deepEqual(res.bodies[0].screens, []);
    const missing = activity(f.base, { runs: [run(undefined, map)] }), refusal = response();
    await missing.designRetrieve(request(''), refusal);
    assert.equal(refusal.statusCode, 409); assert.equal(refusal.bodies[0].code, 'DESIGN_RETRIEVAL_PREREQUISITE_MISSING');
    assert.deepEqual(missing.commands, []); assert.deepEqual(missing.cacheWrites, []);
  } finally { f.dispose(); }
});

for (const method of ['design', 'designRetrieve'] as const) {
  test(`${method} refuses a linked local manifest before any provider or cache effect`, async () => {
    const f = fixture();
    try {
      const dir = localRepo(f), foreign = path.join(f.base, 'foreign-manifest');
      fs.writeFileSync(foreign, JSON.stringify([{ id: 'def456' }]), { mode: 0o600 });
      fs.symlinkSync(foreign, path.join(dir, 'DESIGN_MANIFEST.json'));
      const c = activity(f.base, { runs: [run(f.repo)] }), res = response();
      await c[method](request('abc123'), res);
      assert.equal(res.statusCode, method === 'design' ? 500 : 502);
      assert.deepEqual(c.commands, []); assert.deepEqual(c.cacheWrites, []);
      assert.equal(fs.readFileSync(foreign, 'utf8'), '[{"id":"def456"}]');
    } finally { f.dispose(); }
  });
}

for (const change of ['context', 'cache', 'repository', 'metadata'] as const) {
  test(`POST rechecks ${change} replacement/refusal after listing and before download`, async () => {
    const f = fixture();
    try {
      localRepo(f);
      const foreign = path.join(f.base, 'foreign'); fs.mkdirSync(foreign, { mode: 0o700 });
      const original = path.join(f.base, 'original'); fs.writeFileSync(original, 'retain', { mode: 0o600 });
      const options = { refuse: false, runs: [run(f.repo)], command(args: string[]) {
        if (args[1] === 'populate-cache') return JSON.stringify({ success: true, copied: 0 });
        assert.equal(args[1], 'list-screens');
        if (change === 'context') options.refuse = true;
        if (change === 'cache') {
          const cache = path.join(f.paths.setfarmDir, 'stitch-cache/abc123');
          fs.renameSync(cache, cache + '.retained'); fs.symlinkSync(foreign, cache);
        }
        if (change === 'repository') { fs.renameSync(f.repo, f.repo + '.retained'); fs.symlinkSync(foreign, f.repo); }
        if (change === 'metadata') fs.linkSync(original, path.join(f.repo, '.stitch'));
        return JSON.stringify([{ id: 'def456', screenshotUrl: 'https://component.invalid/image' }]);
      } };
      const c = activity(f.base, options), res = response(); await c.designRetrieve(request('abc123'), res);
      assert.equal(res.statusCode, 502); assert.deepEqual(c.calls, ['populate-cache', 'list-screens']);
      assert.equal(fs.readFileSync(original, 'utf8'), 'retain'); assert.deepEqual(fs.readdirSync(foreign), []);
    } finally { f.dispose(); }
  });
}

test('POST preserves an accepted cache HTML file when a later download fails', async () => {
  const f = fixture();
  try {
    const cache = path.join(f.paths.setfarmDir, 'stitch-cache/abc123'); fs.mkdirSync(cache, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(cache, 'def456.html'), 'accepted html', { mode: 0o600 });
    const c = activity(f.base, { runs: [run()], command(args) {
      if (args[1] === 'list-screens') return JSON.stringify([
        { id: 'def456', screenshotUrl: 'https://component.invalid/image', htmlUrl: 'https://component.invalid/existing' },
        { id: 'ghi789', htmlUrl: 'https://component.invalid/failure' },
      ]);
      if (args[3]!.endsWith('ghi789.html')) throw Error('later download failed');
      assert.ok(!args[3]!.endsWith('def456.html'), 'accepted HTML must not be handed to the destructive download command');
      fs.writeFileSync(args[3]!, 'saved', { mode: 0o600 }); return JSON.stringify({ path: args[3], size: 5 });
    } }), res = response(); await c.designRetrieve(request('abc123'), res);
    assert.equal(res.statusCode, 502); assert.equal(fs.readFileSync(path.join(cache, 'def456.html'), 'utf8'), 'accepted html');
    const read = response(); await c.design(request('abc123'), read); assertLocal(read.bodies[0].screens[0]);
  } finally { f.dispose(); }
});

test('POST does not let repo population overwrite accepted cache files before a later failure', async () => {
  const f = fixture();
  try {
    const dir = localRepo(f), cache = path.join(f.paths.setfarmDir, 'stitch-cache/abc123');
    fs.writeFileSync(path.join(dir, 'def456.html'), 'repo version', { mode: 0o600 });
    fs.mkdirSync(cache, { recursive: true, mode: 0o700 }); fs.writeFileSync(path.join(cache, 'def456.html'), 'accepted cache', { mode: 0o600 });
    const c = activity(f.base, { runs: [run(f.repo)], command(args) {
      if (args[1] === 'populate-cache') {
        fs.copyFileSync(path.join(dir, 'def456.html'), path.join(cache, 'def456.html'));
        return JSON.stringify({ success: true, copied: 1 });
      }
      assert.equal(args[1], 'list-screens'); throw Error('later failure');
    } }), res = response(); await c.designRetrieve(request('abc123'), res);
    assert.equal(res.statusCode, 502); assert.equal(fs.readFileSync(path.join(cache, 'def456.html'), 'utf8'), 'accepted cache');
    assert.equal(fs.readFileSync(path.join(dir, 'def456.html'), 'utf8'), 'repo version');
  } finally { f.dispose(); }
});

for (const example of [
  { name: 'screenshot-only success', repo: false, artifact: 'png', fail: false },
  { name: 'screenshot-only partial failure', repo: false, artifact: 'png', fail: true },
  { name: 'empty repo before cached screenshot success', repo: true, artifact: 'png', fail: false },
  { name: 'empty repo before cached HTML partial failure', repo: true, artifact: 'html', fail: true },
]) {
  test(`no-map GET rediscovers ${example.name} without retrieval effects`, async () => {
    const f = fixture();
    try {
      if (example.repo) localRepo(f);
      const c = activity(f.base, { runs: [run(example.repo ? f.repo : undefined, 'STITCH_PROJECT_ID: abc123\n')], command(args) {
        if (args[1] === 'populate-cache') return JSON.stringify({ success: true, copied: 0 });
        if (args[1] === 'list-screens') return JSON.stringify([
          { id: 'def456', [example.artifact === 'png' ? 'screenshotUrl' : 'htmlUrl']: 'https://component.invalid/accepted' },
          ...(example.fail ? [{ id: 'ghi789', htmlUrl: 'https://component.invalid/failure' }] : []),
        ]);
        assert.equal(args[1], 'download');
        if (args[3]!.endsWith('ghi789.html')) throw Error('later download failed');
        fs.writeFileSync(args[3]!, 'accepted', { mode: 0o600 }); return JSON.stringify({ path: args[3], size: 8 });
      } }), retrieved = response();
      await c.designRetrieve(request('abc123'), retrieved);
      assert.equal(retrieved.statusCode, example.fail ? 502 : 200);
      assert.equal(fs.readFileSync(path.join(f.paths.setfarmDir, 'stitch-cache/abc123/def456.' + example.artifact), 'utf8'), 'accepted');
      const commands = c.commands.length, writes = c.cacheWrites.length, read = response();
      await c.design(request('abc123'), read);
      assert.equal(read.statusCode, 200); assert.equal(read.bodies[0].screens.length, 1);
      assert.equal(read.bodies[0].screens[0].screenId, 'def456');
      assertLocal(read.bodies[0].screens[0], example.artifact === 'png' ? 'def456.png' : '', example.artifact === 'html' ? 'def456.html' : '');
      assert.equal(c.commands.length, commands); assert.equal(c.cacheWrites.length, writes);
    } finally { f.dispose(); }
  });
}

test('no-map GET merges guarded local directories and deduplicates matching screen stems', async () => {
  const f = fixture();
  try {
    const dir = localRepo(f), cache = path.join(f.paths.setfarmDir, 'stitch-cache/abc123');
    fs.mkdirSync(cache, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(dir, 'def456.html'), 'repo html', { mode: 0o600 });
    fs.writeFileSync(path.join(cache, 'def456.html'), 'cache html', { mode: 0o600 });
    fs.writeFileSync(path.join(cache, 'def456.png'), 'cache png', { mode: 0o600 });
    fs.writeFileSync(path.join(cache, 'ghi789.png'), 'second png', { mode: 0o600 });
    const c = activity(f.base, { runs: [run(f.repo, 'STITCH_PROJECT_ID: abc123\n')] }), res = response();
    await c.design(request('abc123'), res);
    assert.equal(res.statusCode, 200); assert.equal(res.bodies[0].screens.length, 2);
    assertLocal(res.bodies[0].screens.find((screen: any) => screen.screenId === 'def456'));
    assertLocal(res.bodies[0].screens.find((screen: any) => screen.screenId === 'ghi789'), 'ghi789.png', '');
    assert.equal(c.find(run(f.repo), 'abc123', 'def456.html'), path.join(dir, 'def456.html'));
    assert.deepEqual(c.commands, []); assert.deepEqual(c.cacheWrites, []);
  } finally { f.dispose(); }
});

for (const link of ['symlink', 'hardlink'] as const) {
  test(`no-map GET refuses an unrecorded ${link} screenshot during local rediscovery`, async () => {
    const f = fixture();
    try {
      const cache = path.join(f.paths.setfarmDir, 'stitch-cache/abc123'), original = path.join(f.base, 'original');
      fs.mkdirSync(cache, { recursive: true, mode: 0o700 }); fs.writeFileSync(original, 'retain', { mode: 0o600 });
      if (link === 'symlink') fs.symlinkSync(original, path.join(cache, 'def456.png'));
      else fs.linkSync(original, path.join(cache, 'def456.png'));
      const c = activity(f.base, { runs: [run(undefined, 'STITCH_PROJECT_ID: abc123\n')] }), res = response();
      await c.design(request('abc123'), res);
      assert.equal(res.statusCode, 500); assert.match(res.bodies[0].error, /MC_FRESH_DESIGN_INPUT_INVALID/);
      assert.deepEqual(c.commands, []); assert.deepEqual(c.cacheWrites, []); assert.equal(fs.readFileSync(original, 'utf8'), 'retain');
    } finally { f.dispose(); }
  });
}

for (const withRepo of [false, true]) {
  test(`no-map explicit POST retries partial screenshots${withRepo ? ' behind an empty repo' : ''} and retains files on valid empty`, async () => {
    const f = fixture();
    try {
      if (withRepo) localRepo(f);
      let failLater = true, emptyProvider = false;
      const c = activity(f.base, { runs: [run(withRepo ? f.repo : undefined, 'STITCH_PROJECT_ID: abc123\n')], command(args) {
        if (args[1] === 'populate-cache') return JSON.stringify({ success: true, copied: 0 });
        if (args[1] === 'list-screens') return JSON.stringify(emptyProvider ? [] : [
          { id: 'def456', screenshotUrl: 'https://component.invalid/accepted' },
          { id: 'ghi789', htmlUrl: 'https://component.invalid/later' },
        ]);
        assert.equal(args[1], 'download');
        if (args[3]!.endsWith('ghi789.html') && failLater) throw Error('later download failed');
        fs.writeFileSync(args[3]!, 'accepted', { mode: 0o600 }); return JSON.stringify({ path: args[3], size: 8 });
      } });
      const first = response(); await c.designRetrieve(request('abc123'), first); assert.equal(first.statusCode, 502);
      const partial = response(); await c.design(request('abc123'), partial);
      assert.equal(partial.bodies[0].screens.length, 1); assertLocal(partial.bodies[0].screens[0], 'def456.png', '');
      const retry = response(); await c.designRetrieve(request('abc123'), retry);
      assert.equal(retry.statusCode, 502, 'explicit retry must attempt the still-missing second screen');
      assert.equal(c.commands.filter((args: string[]) => args[1] === 'list-screens').length, 2);
      failLater = false;
      const completed = response(); await c.designRetrieve(request('abc123'), completed);
      assert.equal(completed.statusCode, 200); assert.equal(completed.bodies[0].screens.length, 2);
      assertLocal(completed.bodies[0].screens.find((screen: any) => screen.screenId === 'def456'), 'def456.png', '');
      assertLocal(completed.bodies[0].screens.find((screen: any) => screen.screenId === 'ghi789'), '', 'ghi789.html');
      assert.equal(c.commands.filter((args: string[]) => args[1] === 'list-screens').length, 3);
      assert.equal(c.commands.filter((args: string[]) => args[1] === 'download' && args[3]!.endsWith('def456.png')).length, 1,
        'accepted first screenshot must survive every retry without another download');
      emptyProvider = true;
      const empty = response(); await c.designRetrieve(request('abc123'), empty);
      assert.equal(empty.statusCode, 200); assert.equal(empty.bodies[0].screens.length, 2);
      assertLocal(empty.bodies[0].screens.find((screen: any) => screen.screenId === 'def456'), 'def456.png', '');
      assertLocal(empty.bodies[0].screens.find((screen: any) => screen.screenId === 'ghi789'), '', 'ghi789.html');
      assert.equal(c.commands.filter((args: string[]) => args[1] === 'list-screens').length, 4);
      const commands = c.commands.length, writes = c.cacheWrites.length, finalRead = response();
      await c.design(request('abc123'), finalRead); assert.equal(finalRead.bodies[0].screens.length, 2);
      assert.equal(c.commands.length, commands); assert.equal(c.cacheWrites.length, writes);
    } finally { f.dispose(); }
  });
}

for (const provenance of ['recorded map', 'manifest'] as const) {
  test(`explicit POST retries missing artifacts with ${provenance} after a partial failure`, async () => {
    const f = fixture();
    try {
      const screenEntries = [
        { screenId: 'def456', name: 'Home', htmlFile: 'def456.html', screenshot: 'def456.png' },
        { screenId: 'ghi789', name: 'Details', htmlFile: 'ghi789.html', screenshot: 'ghi789.png' },
      ];
      if (provenance === 'manifest') {
        const dir = localRepo(f);
        fs.writeFileSync(path.join(dir, 'DESIGN_MANIFEST.json'), JSON.stringify(screenEntries), { mode: 0o600 });
      }
      const text = 'STITCH_PROJECT_ID: abc123\n' + (provenance === 'recorded map'
        ? 'SCREEN_MAP:\n' + JSON.stringify(screenEntries, null, 2) + '\n' : 'DESIGN_NOTES: Saved design\n');
      let failLater = true, emptyProvider = false;
      const c = activity(f.base, { runs: [run(provenance === 'manifest' ? f.repo : undefined, text)], command(args) {
        if (args[1] === 'populate-cache') return JSON.stringify({ success: true, copied: 0 });
        if (args[1] === 'list-screens') return JSON.stringify(emptyProvider ? [] : [
          { id: 'def456', screenshotUrl: 'https://component.invalid/accepted' },
          { id: 'ghi789', htmlUrl: 'https://component.invalid/later' },
        ]);
        assert.equal(args[1], 'download');
        if (args[3]!.endsWith('ghi789.html') && failLater) throw Error('later download failed');
        fs.writeFileSync(args[3]!, 'accepted', { mode: 0o600 }); return JSON.stringify({ path: args[3], size: 8 });
      } });
      const first = response(); await c.designRetrieve(request('abc123'), first);
      assert.equal(first.statusCode, 502);
      const commandsAfterFailure = c.commands.length, writesAfterFailure = c.cacheWrites.length, partial = response();
      await c.design(request('abc123'), partial);
      assert.equal(partial.statusCode, 200); assert.equal(partial.bodies[0].screens.length, 2);
      assertLocal(partial.bodies[0].screens.find((screen: any) => screen.screenId === 'def456'), 'def456.png', '');
      assertLocal(partial.bodies[0].screens.find((screen: any) => screen.screenId === 'ghi789'), '', '');
      assert.equal(c.commands.length, commandsAfterFailure); assert.equal(c.cacheWrites.length, writesAfterFailure);
      const retry = response(); await c.designRetrieve(request('abc123'), retry);
      assert.equal(retry.statusCode, 502, 'recorded metadata plus one PNG must not skip the still-failing later download');
      assert.equal(c.commands.filter((args: string[]) => args[1] === 'list-screens').length, 2);
      failLater = false;
      const completed = response(); await c.designRetrieve(request('abc123'), completed);
      assert.equal(completed.statusCode, 200); assert.equal(completed.bodies[0].screens.length, 2);
      assertLocal(completed.bodies[0].screens.find((screen: any) => screen.screenId === 'def456'), 'def456.png', '');
      assertLocal(completed.bodies[0].screens.find((screen: any) => screen.screenId === 'ghi789'), '', 'ghi789.html');
      assert.equal(c.commands.filter((args: string[]) => args[1] === 'list-screens').length, 3);
      assert.equal(c.commands.filter((args: string[]) => args[1] === 'download' && args[3]!.endsWith('def456.png')).length, 1);
      emptyProvider = true;
      const empty = response(); await c.designRetrieve(request('abc123'), empty);
      assert.equal(empty.statusCode, 200); assert.equal(empty.bodies[0].screens.length, 2);
      assertLocal(empty.bodies[0].screens.find((screen: any) => screen.screenId === 'def456'), 'def456.png', '');
      assertLocal(empty.bodies[0].screens.find((screen: any) => screen.screenId === 'ghi789'), '', 'ghi789.html');
      assert.equal(c.commands.filter((args: string[]) => args[1] === 'list-screens').length, 4);
      const commandsAfterEmpty = c.commands.length, writesAfterEmpty = c.cacheWrites.length, finalRead = response();
      await c.design(request('abc123'), finalRead); assert.equal(finalRead.bodies[0].screens.length, 2);
      assert.equal(c.commands.length, commandsAfterEmpty); assert.equal(c.cacheWrites.length, writesAfterEmpty);
      assert.equal(fs.readFileSync(path.join(f.paths.setfarmDir, 'stitch-cache/abc123/def456.png'), 'utf8'), 'accepted');
    } finally { f.dispose(); }
  });
}

for (const provenance of ['recorded map', 'manifest'] as const) {
  test(`partial retrieval exposes unrecorded saved screens with ${provenance}, including after retry and empty listing`, async () => {
    const f = fixture();
    try {
      const dir = localRepo(f), cache = path.join(f.paths.setfarmDir, 'stitch-cache/abc123');
      const entry = { screenId: 'def456', name: 'Recorded home', description: 'Keep this metadata',
        htmlFile: 'home-alias.html', screenshot: 'home-alias.png' };
      fs.writeFileSync(path.join(dir, 'home-alias.png'), 'recorded image', { mode: 0o600 });
      fs.writeFileSync(path.join(dir, 'home-alias.html'), 'recorded html', { mode: 0o600 });
      if (provenance === 'manifest') fs.writeFileSync(path.join(dir, 'DESIGN_MANIFEST.json'), JSON.stringify([entry]), { mode: 0o600 });
      const text = 'STITCH_PROJECT_ID: abc123\n' + (provenance === 'recorded map'
        ? 'SCREEN_MAP:\n' + JSON.stringify([entry], null, 2) + '\n' : 'DESIGN_NOTES: Saved design\n');
      // SCREEN_MAP enrichment supplies the explicit alias through the manifest.
      if (provenance === 'recorded map') fs.writeFileSync(path.join(dir, 'DESIGN_MANIFEST.json'), JSON.stringify([entry]), { mode: 0o600 });
      let failLater = true, emptyProvider = false;
      const c = activity(f.base, { runs: [run(f.repo, text)], command(args) {
        if (args[1] === 'populate-cache') {
          for (const file of ['home-alias.png', 'home-alias.html']) fs.copyFileSync(path.join(dir, file), path.join(args[3]!, file));
          return JSON.stringify({ success: true, copied: 2 });
        }
        if (args[1] === 'list-screens') return JSON.stringify(emptyProvider ? [] : [
          { id: 'def456' }, { id: 'ghi789', screenshotUrl: 'https://component.invalid/b' },
          { id: 'jkl012', htmlUrl: 'https://component.invalid/c' },
        ]);
        assert.equal(args[1], 'download');
        if (args[3]!.endsWith('jkl012.html') && failLater) throw Error('later download failed');
        fs.writeFileSync(args[3]!, 'accepted', { mode: 0o600 }); return JSON.stringify({ path: args[3], size: 8 });
      } });
      const first = response(); await c.designRetrieve(request('abc123'), first);
      assert.equal(first.statusCode, 502);
      assert.equal(fs.readFileSync(path.join(cache, 'ghi789.png'), 'utf8'), 'accepted');
      const commands = c.commands.length, writes = c.cacheWrites.length, partial = response();
      await c.design(request('abc123'), partial);
      assert.equal(partial.statusCode, 200); assert.equal(partial.bodies[0].screens.length, 2);
      const recorded = partial.bodies[0].screens.find((s: any) => s.screenId === 'def456');
      assert.equal(recorded.name, 'Recorded home'); assert.equal(recorded.description, 'Keep this metadata');
      assertLocal(recorded, 'home-alias.png', 'home-alias.html');
      assertLocal(partial.bodies[0].screens.find((s: any) => s.screenId === 'ghi789'), 'ghi789.png', '');
      assert.equal(c.commands.length, commands); assert.equal(c.cacheWrites.length, writes);
      failLater = false;
      const completed = response(); await c.designRetrieve(request('abc123'), completed);
      assert.equal(completed.statusCode, 200); assert.equal(completed.bodies[0].screens.length, 3);
      assertLocal(completed.bodies[0].screens.find((s: any) => s.screenId === 'jkl012'), '', 'jkl012.html');
      const read = response(); await c.design(request('abc123'), read);
      assert.deepEqual(read.bodies[0].screens, completed.bodies[0].screens);
      emptyProvider = true;
      const empty = response(); await c.designRetrieve(request('abc123'), empty);
      assert.equal(empty.statusCode, 200); assert.deepEqual(empty.bodies[0].screens, read.bodies[0].screens);
      assert.equal(c.commands.filter((args: string[]) => args[1] === 'list-screens').length, 3);
      assert.equal(c.commands.filter((args: string[]) => args[1] === 'download' && args[3]!.endsWith('ghi789.png')).length, 1);
      assert.equal(fs.readFileSync(path.join(cache, 'ghi789.png'), 'utf8'), 'accepted');
    } finally { f.dispose(); }
  });
}
