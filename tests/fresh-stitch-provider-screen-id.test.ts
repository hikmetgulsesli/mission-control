import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import { fixture, ports, request, response } from './fresh-design-path-component-support.js';

// Exact provider/route Source components with provider-return and mode DATA.
// No application import, provider child/network, DB or operational positive.
function component(base: string, output: string, selected = true) {
  const p = ports(base, { selected });
  const text = fs.readFileSync(new URL('../server/services/stitch-integration.ts', import.meta.url), 'utf8');
  assert.ok(Buffer.byteLength(text) < 32768);
  const tree = ts.createSourceFile('stitch.ts', text, ts.ScriptTarget.Latest, true);
  const names = ['generateScreen', 'listScreens', 'downloadScreen', 'validateStitchId'];
  const declarations = tree.statements.filter(ts.isFunctionDeclaration)
    .filter(node => node.name && names.includes(node.name.text));
  assert.equal(declarations.length, names.length);
  const constants = tree.statements.filter(ts.isVariableStatement).filter(node => node.declarationList.declarations
    .some(item => ts.isIdentifier(item.name) && item.name.text === 'SAFE_ID_RE'));
  assert.equal(constants.length, 1);
  const body = [...constants, ...declarations].map(node => node.getText(tree)).join('\n')
    .replace(/\bexport\s+(?=(?:async\s+)?function\b)/g, '');
  const js = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const calls: string[][] = [];
  const bindings = { ...p.bindings, freshMissionControlSelectedV1: () => selected, join: path.join,
    mkdirSync: fs.mkdirSync, console: { error() {} }, runStitch: async (args: string[]) => { calls.push(args); return output; } };
  const api = new Function(...Object.keys(bindings), js + '\nreturn {generateScreen,listScreens,downloadScreen};')(...Object.values(bindings));
  return { ...api, calls, p };
}
async function generated(output: string, selected = true) {
  const f = fixture();
  try { return await component(f.base, output, selected).generateScreen('abc123', 'prompt', 'Home'); }
  finally { f.dispose(); }
}
async function listed(output: string, selected = true) {
  const f = fixture();
  try { return await component(f.base, output, selected).listScreens('abc123'); }
  finally { f.dispose(); }
}
const invalidIds: unknown[] = ['../escape', 'abc123/..', '', 'xyz', 'valid_name', 'a'.repeat(129), null, 0, 123, {}, []];

test('selected generateScreen rejects every malformed/missing/nonstr/unsupported JSON screen ID before returning a DTO', async () => {
  for (const screenId of invalidIds) {
    assert.equal(await generated(JSON.stringify({ screens: [{ screenId }] })), null, JSON.stringify(screenId));
  }
  assert.equal(await generated(JSON.stringify({ screens: [{}] })), null);
  assert.equal(await generated(JSON.stringify({ screens: [{ id: '../escape' }] })), null);
});

test('selected skipped existing IDs obey both current domains and cannot return contaminated skipped DTOs', async () => {
  for (const existingScreenId of invalidIds) {
    assert.equal(await generated(JSON.stringify({ skipped: true, existingScreenId })), null, JSON.stringify(existingScreenId));
  }
  assert.equal(await generated(JSON.stringify({ skipped: true })), null);
  const value = await generated(JSON.stringify({ skipped: true, existingScreenId: 'abc-123' }));
  assert.equal(value.screenId, 'abc-123'); assert.equal(value.status, 'skipped');
});

test('valid JSON refusal cannot be rescued by a valid-looking regex string elsewhere in the response', async () => {
  for (const payload of [
    { screens: [{ screenId: '../escape' }], note: 'screen id: abc123' },
    { screens: [{ screenId: 'xyz' }], note: 'screen id: abc123' },
    { skipped: true, existingScreenId: '../escape', note: 'screen id: abc123' },
  ]) assert.equal(await generated(JSON.stringify(payload)), null);
});

test('selected fallback validates the whole quoted/unquoted token rather than any valid hex prefix', async () => {
  for (const output of [
    'screen id: abc123/..', 'screen id: abc123_xyz', 'screen id: xyz',
    'screen id: abc123"junk', "screen id: abc123'junk", 'screen id: "abc123"junk', "screen id: 'abc123'junk",
    'screen id: "abc def"', "screen id: 'abc def'", 'screen id: "abc123', "screen id: 'abc123",
    'screen id: "abc123/.."', "screen id: 'abc123/..'", 'screen id: ' + 'a'.repeat(129),
    '{broken JSON; screen id: abc123/..',
  ]) assert.equal(await generated(output), null, output);
});

test('selected valid JSON/skipped/fallback retain hex digit dash IDs and the128 limit', async () => {
  for (const screenId of ['123', 'abc-123', 'ABCDEF', 'a'.repeat(128)]) {
    const value = await generated(JSON.stringify({ screens: [{ screenId, title: 'Provider Title', width: 640, height: 480 }] }));
    assert.equal(value.screenId, screenId); assert.equal(value.title, 'Provider Title'); assert.equal(value.width, 640);
    assert.equal((await generated(JSON.stringify({ screens: [{ id: screenId }] }))).screenId, screenId);
    assert.equal((await generated(JSON.stringify({ skipped: true, existingScreenId: screenId }))).screenId, screenId);
    assert.equal((await generated('screen id: ' + screenId)).screenId, screenId);
    assert.equal((await generated('screen id: "' + screenId + '"')).screenId, screenId);
    assert.equal((await generated("screen id: '" + screenId + "' ")).screenId, screenId);
  }
  assert.equal((await generated('{broken JSON; screen id: abc123')).screenId, 'abc123');
  assert.equal(await generated('no ID is present'), null);
  assert.equal(await generated(JSON.stringify({ screens: [] })), null);
});

test('selected list rejects an entire batch with one invalid ID for every existing field alias', async () => {
  for (const key of ['id', 'screenId', 'screen_id']) {
    for (const id of invalidIds) {
      assert.deepEqual(await listed(JSON.stringify([{ id: 'abc123' }, { [key]: id }])), [], key + ':' + JSON.stringify(id));
    }
    const screens = await listed(JSON.stringify({ screens: [{ [key]: 'abc-123' }] }));
    assert.equal(screens.length, 1); assert.equal(screens[0].screenId, 'abc-123');
  }
  assert.deepEqual(await listed(JSON.stringify([{}])), []);
  assert.deepEqual(await listed('{invalid JSON'), []);
  assert.equal((await listed(JSON.stringify([{ id: 'a'.repeat(128) }])))[0].screenId.length, 128);
});

test('legacy provider JSON, skipped, field-priority and literal regex behavior remain exact', async () => {
  assert.equal((await generated(JSON.stringify({ screens: [{ screenId: '../escape' }] }), false)).screenId, '../escape');
  assert.equal((await generated(JSON.stringify({ screens: [{ screenId: 'xyz' }] }), false)).screenId, 'xyz');
  assert.equal((await generated(JSON.stringify({ skipped: true }), false)).screenId, '');
  assert.equal((await generated(JSON.stringify({ screens: [{ id: 'abc' }], skipped: true, existingScreenId: 'def' }), false)).screenId, 'abc');
  assert.equal((await generated('screen id: abc123/..', false)).screenId, 'abc123');
  assert.equal((await generated('screen id: "abc def"', false)).screenId, 'abc');
  assert.equal((await generated('screen id: "abc123', false)).screenId, 'abc123');
  assert.equal((await generated('no ID is present', false)), null);
  const values = await listed(JSON.stringify([{ id: '../escape' }, { screenId: 'xyz' }, {}]), false);
  assert.deepEqual(values.map((value: any) => value.screenId), ['../escape', 'xyz', '']);
});

function variant(c: ReturnType<typeof component>) {
  const text = fs.readFileSync(new URL('../server/routes/prd-generator.ts', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('prd.ts', text, ts.ScriptTarget.Latest, true);
  const matches = tree.statements.filter(ts.isExpressionStatement).map(node => node.expression).filter(ts.isCallExpression)
    .filter(node => ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression)
      && node.expression.expression.text === 'router' && node.expression.name.text === 'post'
      && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === '/prd/screens/:prdId/variant');
  assert.equal(matches.length, 1);
  const callback = matches[0]!.arguments[1]!; assert.ok(ts.isArrowFunction(callback));
  const js = ts.transpileModule('const route = ' + callback.getText(tree) + ';', {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const persisted: any[] = [];
  const bindings = { ...c.p.bindings, PATHS: c.p.paths, join: path.join, mkdirSync: fs.mkdirSync,
    generateScreen: c.generateScreen, downloadScreen: c.downloadScreen,
    getPrd: async () => ({ platform: 'web', mockup_screens: [{ id: 'source', name: 'Home', projectId: 'abc123' }] }),
    updatePrd: async (_id: string, value: any) => { persisted.push(value); } };
  return { persisted, run: new Function(...Object.keys(bindings), js + '\nreturn route;')(...Object.values(bindings)) };
}

test('actual variant caller cannot persist an invalid provider ID after actual download refusal', async () => {
  const f = fixture();
  try {
    const c = component(f.base, JSON.stringify({ screens: [{ screenId: '../escape' }] })), route = variant(c), res = response();
    await route.run(request('abc123'), res);
    assert.deepEqual(route.persisted, []);
    assert.equal(res.statusCode, 500); assert.match(JSON.stringify(res.bodies), /Variant generation failed/);
    assert.equal(fs.existsSync(path.join(f.paths.setfarmDir, 'stitch-cache')), false);
    assert.deepEqual(c.calls.map((args: string[]) => args[0]), ['generate-screen-safe']);
  } finally { f.dispose(); }
});
