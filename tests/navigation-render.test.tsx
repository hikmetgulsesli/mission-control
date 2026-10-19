import React from 'react';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { TabNav } from '../src/components/TabNav.js';

const render = (path: string, shellOpen = false) => renderToStaticMarkup(
  <MemoryRouter initialEntries={[path]}><TabNav shellOpen={shellOpen} onShellToggle={() => {}} /></MemoryRouter>,
);

test('real TabNav renders standalone Overview, grouped destinations, accessible search and favorite controls safely in SSR', () => {
  const html = render('/agents');
  assert.match(html, /aria-label="Primary navigation"/);
  for (const group of ['Work', 'Projects', 'System', 'Tools', 'Usage']) assert.ok(html.includes(`>${group}<`), group);
  for (const href of ['/agents', '/workflows', '/tasks', '/controls', '/changelog', 'http://127.0.0.1:3333']) assert.ok(html.includes(`href="${href}"`), href);
  assert.match(html, /aria-label="Search navigation"/);
  assert.match(html, /aria-label="Add Agent catalog to favorites"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-controls="navigation-panel/);
  assert.match(html, /No favorites yet/);
});

test('real TabNav marks dynamic run context and group active without marking Setfarm active', () => {
  const html = render('/setfarm/runs/abc');
  assert.match(html, /<a(?=[^>]*href="\/setfarm\/active")(?=[^>]*aria-current="page")[^>]*>/);
  assert.doesNotMatch(html, /<a(?=[^>]*href="\/setfarm")(?=[^>]*aria-current="page")[^>]*>/);
  assert.match(html, /aria-label="Work navigation"[^>]*data-active="true"/);
});

test('real TabNav preserves performance alias context and Shell action state', () => {
  const html = render('/perf', true);
  assert.match(html, /<a(?=[^>]*href="\/performance")(?=[^>]*aria-current="page")[^>]*>/);
  assert.match(html, /aria-label="Toggle Shell"[^>]*aria-pressed="true"/);
  assert.doesNotMatch(html, /href="#shell"/);
});


test('real TabNav filters persisted favorites before rendering and retains external anchor semantics', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  try {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
      getItem: () => JSON.stringify({ version: 1, favorites: ['agents', 'missing', 'agents', 'shell'] }),
      setItem: () => {},
    } } });
    const html = render('/agents');
    const favorites = html.match(/<section[^>]*aria-label="Favorites"[^>]*>([\s\S]*?)<\/section>/)?.[1] ?? '';
    assert.match(favorites, /href="\/agents"/);
    assert.match(favorites, /aria-label="Toggle Shell"/);
    assert.equal((favorites.match(/href="\/agents"/g) ?? []).length, 1);
    assert.doesNotMatch(favorites, /missing|No favorites yet/);
    assert.match(html, /href="\/changelog" target="_blank" rel="noopener noreferrer"/);
    assert.match(html, /href="http:\/\/127.0.0.1:3333" target="_blank" rel="noopener noreferrer"/);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('real TabNav exposes Tools context when the Shell action is open', () => {
  const html = render('/', true);
  assert.match(html, /aria-label="Tools navigation"[^>]*data-active="true"/);
});
