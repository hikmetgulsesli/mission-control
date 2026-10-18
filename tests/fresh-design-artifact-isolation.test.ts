import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

// Actual route helper bodies with filesystem and selected-path DATA ports.
// These components do not qualify operational entry, SQL or a live HTTP route.
function component(base: string, selected: boolean, refuse = false, exists = fs.existsSync) {
  const text = fs.readFileSync(new URL('../server/routes/setfarm-activity.ts', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('activity.ts', text, ts.ScriptTarget.Latest, true);
  const names = ['parseRunContext', 'uniquePaths', 'projectRootCandidates', 'stitchCacheDir', 'resolveRunStitchDirs', 'findRunStitchFile'];
  const body = tree.statements.filter(node => ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text))
    .map(node => node.getText(tree)).join('\n');
  assert.equal(tree.statements.filter(node => ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)).length, names.length);
  const js = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const paths = { projectsDir: path.join(base, 'selected/projects'), setfarmDir: path.join(base, 'selected/runtime') };
  const env = { HOME: path.join(base, 'legacy-home'), SETFARM_PROJECTS_DIR: path.join(base, 'legacy-alias'), OPENCLAW_PROJECTS_DIR: path.join(base, 'openclaw-alias') };
  return new Function('PATHS', 'process', 'freshMissionControlPathsV1', 'join', 'basename', 'existsSync', js
    + ';return {roots:projectRootCandidates,cache:stitchCacheDir,find:findRunStitchFile};')(
    paths, { env, cwd: () => base }, () => { if (refuse) throw Error('selected context refused'); return selected ? paths : null; },
    path.join, path.basename, exists) as { roots(): string[]; cache(id: string): string; find(run: unknown, id: string, file: string): string | null };
}

test('selected artifact candidates exclude HOME and both legacy aliases', () => {
  const c = component('/component', true);
  assert.deepEqual(c.roots(), ['/component/selected/projects']);
  assert.equal(c.cache('project-123'), '/component/selected/runtime/stitch-cache/project-123');
});

test('actual owned filesystem lookup cannot fall through to same-named legacy project or cache', () => {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mc-design-isolation-')));
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
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
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

test('selected cache rejects non-segment or oversized project IDs before any filesystem lookup', () => {
  const c = component('/component', true, false, () => { throw Error('unexpected filesystem lookup'); });
  for (const id of ['', '.', '..', '../foreign', 'a/b', 'a\\b', 'a\0b', 'a\nb', 'a'.repeat(129), null, 1, {}]) {
    assert.throws(() => c.cache(id as string), /MC_FRESH_DESIGN_INPUT_INVALID/);
    if (id) assert.throws(() => c.find({ context: { repo: '/component/selected/projects/app' } }, id as string, 'screen.html'),
      /MC_FRESH_DESIGN_INPUT_INVALID/);
  }
});
