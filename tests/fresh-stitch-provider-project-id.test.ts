import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import { fixture, ports } from './fresh-design-path-component-support.js';

// Actual parser/public Source functions with owned-FS and provider-return/mode
// DATA ports. No application import, provider child/network, DB or readiness.
function component(base: string, selected = true) {
  const mode = { selected, refuse: false };
  const p = ports(base, mode);
  const text = fs.readFileSync(new URL('../server/services/stitch-integration.ts', import.meta.url), 'utf8');
  assert.ok(Buffer.byteLength(text) < 32768);
  const tree = ts.createSourceFile('stitch.ts', text, ts.ScriptTarget.Latest, true);
  const names = ['parseProjectId', 'ensureStitchProject', 'createStitchProject', 'validateStitchId'];
  const declarations = tree.statements.filter(ts.isFunctionDeclaration)
    .filter(node => node.name && names.includes(node.name.text));
  assert.equal(declarations.length, names.length);
  for (const name of names) assert.equal(declarations.filter(node => node.name!.text === name).length, 1);
  const constants = tree.statements.filter(ts.isVariableStatement).filter(node => node.declarationList.declarations
    .some(item => ts.isIdentifier(item.name) && item.name.text === 'SAFE_ID_RE'));
  assert.equal(constants.length, 1);
  const body = [...constants, ...declarations].map(node => node.getText(tree)).join('\n')
    .replace(/\bexport\s+(?=(?:async\s+)?function\b)/g, '');
  const js = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const calls: string[][] = [], state = { output: '', refuseAfterProvider: false };
  const bindings = { ...p.bindings,
    // The actual fixed selector's captured-mode refusal is an explicit DATA port.
    freshMissionControlSelectedV1: () => p.freshMissionControlPathsV1() !== null,
    runStitch: async (args: string[]) => {
      calls.push([...args]);
      if (state.refuseAfterProvider) mode.refuse = true;
      return state.output;
    } };
  const api = new Function(...Object.keys(bindings), js + '\nreturn {parseProjectId,ensureStitchProject,createStitchProject};')(...Object.values(bindings));
  const run = async (kind: 'ensure' | 'create', output: string) => {
    state.output = output;
    return kind === 'ensure' ? api.ensureStitchProject('Component Project') : api.createStitchProject('Component Project');
  };
  return { ...api, run, calls, state, mode };
}
const kinds = ['ensure', 'create'] as const;
const invalidIds: unknown[] = ['../escape', 'abc123/..', 'xyz', 'valid_name', '', 'a'.repeat(129), null, 0, 123, {}, [], true];
function assertResult(kind: typeof kinds[number], result: unknown, projectId: string) {
  assert.deepEqual(result, kind === 'ensure' ? { projectId, name: 'Component Project' } : projectId);
}

for (const kind of kinds) test(kind + ' selected creation rejects complete unsupported or nonstring JSON IDs instead of coercing provider identity', async () => {
  const f = fixture();
  try {
    const c = component(f.base);
    for (const key of ['projectId', 'project_id']) for (const id of invalidIds) {
      await assert.rejects(c.run(kind, JSON.stringify({ [key]: id })), /MC_FRESH_DESIGN_INPUT_INVALID|Invalid projectId/,
        kind + ':' + key + ':' + JSON.stringify(id));
    }
    assert.equal(c.calls.length, 2 * invalidIds.length);
    assert.ok(c.calls.every(args => args.length === 2 && args[1] === 'Component Project'));
    assert.ok(c.calls.every(args => args[0] === (kind === 'ensure' ? 'ensure-project' : 'create-project')));
  } finally { f.dispose(); }
});

for (const kind of kinds) test(kind + ' valid JSON missing or invalid project fields cannot be rescued by note text or converted object text', async () => {
  const f = fixture();
  try {
    const c = component(f.base);
    for (const payload of [
      { projectId: '../escape', note: 'project id: abc123' },
      { projectId: 'xyz', note: 'project id: abc123' },
      { project_id: {}, note: 'project id: abc123' },
      { note: 'project id: abc123' }, {}, [], null, 'project id: abc123',
      { projectId: 123, project_id: 'abc123' },
    ]) await assert.rejects(c.run(kind, JSON.stringify(payload)), /MC_FRESH_DESIGN_INPUT_INVALID|Invalid projectId/, kind + ':' + JSON.stringify(payload));
  } finally { f.dispose(); }
});

for (const kind of kinds) test(kind + ' selected creation rejects entire malformed fallback tokens rather than return a hex prefix', async () => {
  const f = fixture();
  try {
    const c = component(f.base);
    for (const output of [
      'project id: abc123/..', 'project id: abc-123/..', 'project id: abc123_xyz', 'project id: xyz',
      'project id: abc123"junk', "project id: abc123'junk", 'project id: "abc123"junk', "project id: 'abc123'junk",
      'project id: "abc def"', "project id: 'abc def'", 'project id: "abc123', "project id: 'abc123",
      'project id: "abc123/.."', "project id: 'abc123/..'", 'project id: ' + 'a'.repeat(129),
      '{broken JSON; project id: abc123/..', 'no ID present',
    ]) await assert.rejects(c.run(kind, output), /MC_FRESH_DESIGN_INPUT_INVALID|Invalid projectId/, kind + ':' + output);
  } finally { f.dispose(); }
});

test('both selected creation APIs preserve exact valid JSON alias priority and complete bounded fallback identity', async () => {
  const f = fixture();
  try {
    const c = component(f.base);
    for (const kind of kinds) for (const projectId of ['123', 'abc-123', 'ABCDEF', 'a'.repeat(128)]) {
      for (const output of [JSON.stringify({ projectId }), JSON.stringify({ project_id: projectId }),
        'project id: ' + projectId, 'project_id: "' + projectId + '"', "projectId: '" + projectId + "' ",
        '{broken JSON; project id: ' + projectId]) assertResult(kind, await c.run(kind, output), projectId);
    }
    for (const kind of kinds) {
      assertResult(kind, await c.run(kind, JSON.stringify({ projectId: 'abc123', project_id: 'def456' })), 'abc123');
      assertResult(kind, await c.run(kind, JSON.stringify({ projectId: '', project_id: 'def456' })), 'def456');
    }
  } finally { f.dispose(); }
});

test('actual selected parser captures mode before touching input', () => {
  const f = fixture();
  try {
    const c = component(f.base); c.mode.refuse = true; let touched = 0;
    const data = { toString() { touched++; return 'project id: abc123'; } };
    assert.throws(() => c.parseProjectId(data), /selected context refused/);
    assert.equal(touched, 0);
  } finally { f.dispose(); }
});

test('both actual creation APIs propagate post-provider captured selection refusal without returning an ID', async () => {
  const f = fixture();
  try {
    for (const kind of kinds) {
      const c = component(f.base); c.state.refuseAfterProvider = true;
      await assert.rejects(c.run(kind, JSON.stringify({ projectId: 'abc123' })), /selected context refused/);
      assert.deepEqual(c.calls, [[kind === 'ensure' ? 'ensure-project' : 'create-project', 'Component Project']]);
    }
  } finally { f.dispose(); }
});

test('legacy creation APIs retain exact JSON coercion priority and old literal fallback behavior', async () => {
  const f = fixture();
  try {
    const c = component(f.base, false);
    for (const kind of kinds) for (const [output, expected] of [
      [JSON.stringify({ projectId: 123 }), '123'], [JSON.stringify({ projectId: '../escape' }), '../escape'],
      [JSON.stringify({ projectId: 'xyz' }), 'xyz'], [JSON.stringify({ projectId: {} }), '[object Object]'],
      [JSON.stringify({ projectId: 'abc123', project_id: 'def456' }), 'abc123'],
      [JSON.stringify({ projectId: '', project_id: 'def456' }), 'def456'],
      ['project id: abc123/..', 'abc123'], ['project id: abc-123', 'abc'],
      ['project id: "abc def"', 'abc'], ['project id: "abc123', 'abc123'], ['no ID present', ''],
    ]) assertResult(kind, await c.run(kind, output!), expected!);
  } finally { f.dispose(); }
});
