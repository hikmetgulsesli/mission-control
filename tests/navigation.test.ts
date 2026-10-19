import assert from 'node:assert/strict';
import { test } from 'node:test';

const navigation = () => import('../src/lib/navigation.js');
const preferences = () => import('../src/hooks/useNavigationPreferences.js');

test('registry retains technical destinations and search finds labels, paths and groups', async () => {
  const { NAVIGATION_ITEMS: items, NAVIGATION_GROUPS: groups, filterNavigationItems } = await navigation();
  assert.deepEqual(groups, ['Work', 'Projects', 'System', 'Tools', 'Usage']);
  for (const href of ['/', '/office', '/setfarm', '/setfarm/active', '/chat', '/ops', '/costs', '/performance', '/projects', '/files', '/prd', '/scrape', '/rules', '/live', '/agents', '/workflows', '/tasks', '/controls', '/changelog', 'http://127.0.0.1:3333']) {
    assert.ok(items.some(item => item.href === href), `missing ${href}`);
  }
  assert.equal(new Set(items.map(item => item.id)).size, items.length);
  assert.equal(items.find(item => item.action === 'shell')?.shortcut, '8');
  assert.equal(items.find(item => item.href === 'http://127.0.0.1:3333')?.external, true);
  assert.deepEqual(filterNavigationItems('  catalog  ').map(item => item.href), ['/agents']);
  assert.deepEqual(filterNavigationItems('/workflows').map(item => item.href), ['/workflows']);
  assert.ok(filterNavigationItems('usage').some(item => item.href === '/costs'));
  assert.deepEqual(filterNavigationItems('no such destination'), []);
});

test('active contexts distinguish Work from dynamic runs and preserve the performance alias', async () => {
  const { NAVIGATION_ITEMS: items, isNavigationItemActive: active } = await navigation();
  const item = (href: string) => items.find(candidate => candidate.href === href)!;
  assert.equal(active(item('/setfarm'), '/setfarm/runs/abc'), false);
  assert.equal(active(item('/setfarm/active'), '/setfarm/runs/abc'), true);
  assert.equal(active(item('/setfarm/active'), '/setfarm/active'), true);
  assert.equal(active(item('/setfarm/active'), '/setfarm/runs-other'), false);
  assert.equal(active(item('/performance'), '/perf'), true);
  assert.equal(active(item('/projects'), '/projects/saved'), true);
  assert.equal(active(item('/'), '/projects'), false);
  assert.equal(active(item('http://127.0.0.1:3333'), '/'), false);
  assert.equal(active(items.find(candidate => candidate.action === 'shell')!, '/'), false);
});

test('shortcuts resolve existing bindings and case-insensitive D/P/R/L through the registry', async () => {
  const { resolveNavigationShortcut: resolve } = await navigation();
  const bindings = { '0': '/office', '1': '/setfarm', '2': '/chat', '3': '/ops', '4': '/costs', '5': '/performance', '6': '/projects', '7': '/files', '9': '/scrape', d: '/setfarm/active', D: '/setfarm/active', p: '/prd', P: '/prd', r: '/rules', R: '/rules', l: '/live', L: '/live' };
  for (const [key, href] of Object.entries(bindings)) assert.deepEqual(resolve({ key, target: null } as KeyboardEvent), { type: 'navigate', href });
  assert.deepEqual(resolve({ key: '8', target: null } as KeyboardEvent), { type: 'shell' });
  assert.equal(resolve({ key: '?' } as KeyboardEvent), null);
});

test('shortcuts leave typing, selectors, nested editable content, composition and modifiers alone', async () => {
  const { resolveNavigationShortcut: resolve } = await navigation();
  for (const target of [
    { tagName: 'INPUT' }, { tagName: 'TEXTAREA' }, { tagName: 'SELECT' },
    { tagName: 'SPAN', isContentEditable: true },
    { tagName: 'SPAN', closest: () => ({ getAttribute: () => '' }) },
  ]) assert.equal(resolve({ key: 'D', target } as unknown as KeyboardEvent), null);
  for (const flags of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }, { keyCode: 229 }, { defaultPrevented: true }]) {
    assert.equal(resolve({ key: 'p', target: null, ...flags } as KeyboardEvent), null);
  }
});

test('versioned favorites filter unknown IDs, deduplicate and tolerate absent, corrupt or denied storage', async () => {
  const { readNavigationFavorites: read, writeNavigationFavorites: write, toggleNavigationFavorite: toggle } = await preferences();
  let value: string | null = JSON.stringify({ version: 1, favorites: ['agents', 'unknown', 'agents', 'shell', 7] });
  const storage = { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } };
  assert.deepEqual(read(storage), ['agents', 'shell']);
  assert.deepEqual(toggle(['agents'], 'shell'), ['agents', 'shell']);
  assert.deepEqual(toggle(['agents', 'shell'], 'agents'), ['shell']);
  assert.deepEqual(toggle(['agents'], 'unknown'), ['agents']);
  write(storage, ['agents', 'unknown', 'agents']);
  assert.deepEqual(JSON.parse(value!), { version: 1, favorites: ['agents'] });
  for (const raw of ['broken', 'null', '{}', '{"version":2,"favorites":["agents"]}', '{"version":1,"favorites":"agents"}']) {
    value = raw; assert.deepEqual(read(storage), []);
  }
  assert.deepEqual(read(), []);
  const denied = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  assert.deepEqual(read(denied), []);
  assert.doesNotThrow(() => write(denied, ['agents']));
});
