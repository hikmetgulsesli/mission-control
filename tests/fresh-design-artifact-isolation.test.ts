import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { activity, fixture } from './fresh-design-path-component-support.js';

// Exact route/shared-helper components; no operational authority is supplied.
const component = (base: string, selected: boolean, refuse = false, exists = fs.existsSync) =>
  activity(base, { selected, refuse, exists });

test('selected artifact candidates exclude HOME and both legacy aliases', () => {
  const f = fixture();
  try {
    const c = component(f.base, true);
    assert.deepEqual(c.roots(), [f.paths.projectsDir]);
    assert.equal(c.cache('project-123'), path.join(f.paths.setfarmDir, 'stitch-cache/project-123'));
  } finally { f.dispose(); }
});

test('actual owned filesystem lookup cannot fall through to same-named legacy project or cache', () => {
  const f = fixture(), base = f.base;
  try {
    const c = component(base, true), file = 'screen.html', repo = path.join(base, 'selected/projects/app');
    const run = { context: JSON.stringify({ repo }) };
    for (const directory of [path.join(base, 'legacy-home/projects/app/stitch'), path.join(base, 'legacy-alias/app/stitch'),
      path.join(base, 'openclaw-alias/app/stitch'), path.join(base, 'legacy-home/.openclaw/setfarm/stitch-cache/project-123')]) {
      fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(path.join(directory, file), 'legacy artifact');
    }
    assert.equal(c.find(run, 'project-123', file), null);
    fs.mkdirSync(c.cache('project-123'), { recursive: true });
    const cache = path.join(c.cache('project-123'), file); fs.writeFileSync(cache, 'selected cache');
    assert.equal(c.find(run, 'project-123', file), cache);
    fs.mkdirSync(path.join(repo, 'stitch'), { recursive: true });
    const local = path.join(repo, 'stitch', file); fs.writeFileSync(local, 'selected repo');
    assert.equal(c.find(run, 'project-123', file), local);
    assert.equal(c.find(run, 'project-123', '../screen.html'), null);
  } finally { f.dispose(); }
});

test('legacy roots and cache layout remain in their original order', () => {
  const c = component('/component', false);
  assert.deepEqual(c.roots(), ['/component/selected/projects', '/component/legacy-alias', '/component/openclaw-alias', '/component/legacy-home/projects']);
  assert.equal(c.cache('project-123'), '/component/legacy-home/.openclaw/setfarm/stitch-cache/project-123');
});

test('selected context refusal propagates before fallback candidates or cache access', () => {
  const c = component('/component', true, true);
  assert.throws(() => c.roots(), /selected context refused/);
  assert.throws(() => c.cache('project-123'), /selected context refused/);
});

test('selected cache rejects non-segment or oversized project IDs before artifact lookup', () => {
  const f = fixture();
  try {
    const c = component(f.base, true, false, () => { throw Error('unexpected artifact lookup'); });
    for (const id of ['', '.', '..', '../foreign', 'a/b', 'a\\b', 'a\0b', 'a\nb', 'a'.repeat(129), null, 1, {}]) {
      assert.throws(() => c.cache(id as string), /MC_FRESH_DESIGN_INPUT_INVALID/);
      if (id) assert.throws(() => c.find({ context: { repo: path.join(f.paths.projectsDir, 'app') } }, id as string, 'screen.html'),
        /MC_FRESH_DESIGN_INPUT_INVALID/);
    }
  } finally { f.dispose(); }
});
