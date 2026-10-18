import React from 'react';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SystemMetricsPanel } from '../src/components/SystemMetrics.js';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { format } from 'date-fns';

// Actual component render with a store data port: Zustand server snapshot is
// captured at store creation and cannot be replaced by setState for SSR.
function statusBar(metrics: SystemMetrics) {
  const source = readFileSync(new URL('../src/components/StatusBar.tsx', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('StatusBar.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const body = tree.statements.filter(node => !ts.isImportDeclaration(node)).map(node => node.getText(tree)).join('\n');
  const js = ts.transpileModule(body, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText.replace(/^export /gm, '');
  return new Function('React', 'useAppStore', 'useState', 'useEffect', 'format', js + ';return StatusBar;')(React, (selector: Function) => selector({system:metrics,overview:null}), React.useState, React.useEffect, format);
}
import type { SystemMetrics } from '../src/lib/types.js';

function fixture(): SystemMetrics { return {
  ram: {total:null,used:null,percent:null,source:'node:os',semantics:'total-os.freemem',status:'unknown',observedAt:'2026-10-19T00:00:00Z'},
  cpu:{percent:null,source:'node:os',status:'unknown',observedAt:'2026-10-19T00:00:00Z'},
  disk:{total:null,used:null,percent:null,freeBytes:null,totalBytes:null,usedBytes:null,path:'/work',mount:null,source:'df',status:'unknown',observedAt:'2026-10-19T00:00:00Z'},load:null,
}; }

test('real panel and status bar render unknown values without fake zero or NaN', () => {
  const metrics = fixture(); const StatusBar = statusBar(metrics);
  const html = renderToStaticMarkup(<><SystemMetricsPanel metrics={metrics}/><StatusBar/></>);
  assert.match(html,/Bilinmiyor|unknown/i); assert.doesNotMatch(html,/NaN|null|undefined|0%|0GB/);
  assert.match(html,/node:os/); assert.match(html,/total.*freemem/); assert.match(html,/kullanılan|used/i);
  assert.doesNotMatch(html,/pressure|basınç/i);
});

test('APFS capacity drives the visible disk percent and bar, preserving true CPU zero', () => {
  const metrics = fixture(); metrics.cpu.percent=0; metrics.cpu.status='available';
  Object.assign(metrics.disk, {total:100,used:40,percent:95,freeBytes:5*1073741824,mount:'/Data',status:'available'});
  const StatusBar = statusBar(metrics);
  const html = renderToStaticMarkup(<><SystemMetricsPanel metrics={metrics}/><StatusBar/></>);
  assert.match(html,/95%/); assert.match(html,/width:95%/); assert.match(html,/CPU 0%/); assert.match(html,/\/Data/); assert.match(html,/df/);
});


test('real changelog modal retains unavailable loaded identity and separately labels checkout version/SHA', () => {
  const source = readFileSync(new URL('../src/components/ChangelogModal.tsx', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('ChangelogModal.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const body = tree.statements.filter(node => !ts.isImportDeclaration(node)).map(node => node.getText(tree)).join('\n');
  const js = ts.transpileModule(body, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText.replace(/^export /gm, '');
  const data = {commits:[],setfarm:null,mc:{version:'7.8.9',commit:null,builtAt:null,checkout:{status:'available',commit:'abcdef01'.repeat(5)},loadedBuild:{status:'unavailable',sourceSha:null}},setfarmChangelog:null,mcChangelog:null,generatedAt:'2026-10-19T00:00:00Z'};
  // useState ordering only supplies captured HTTP/state data. All card logic
  // and HTML are the actual production component rendered by React SSR.
  let index = 0;
  const values = [data, false, null, 'notes', 'all'];
  const useState = (initial: unknown) => [index < values.length ? values[index++] : initial, () => {}];
  const Component = new Function('React','useEffect','useState','format','formatDistanceToNow','tr',js+';return ChangelogModal;')(React,React.useEffect,useState,format,()=>'',{});
  const html = renderToStaticMarkup(<Component open={true} onClose={() => {}}/>);
  assert.match(html,/MISSION CONTROL/); assert.match(html,/loaded build.*unavailable/i); assert.match(html,/checkout/i);
  assert.match(html,/7\.8\.9/); assert.match(html,/abcdef01/);
});
