import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';

// Only existing store/polling/API boundaries are replaced; Overview and its
// children are really imported and rendered. SSR cannot start browser effects.
test('actual Overview renders observed identities and local model provenance', async (t) => {
  const fixture = String.raw`
import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('Overview truth at the render boundary', async (context) => {
  let overview;
  let quota = null;
  const models = [{
    id: 'fixture-provider', name: 'Fixture provider', plan: 'Configured plan', cost: '$123 configured',
    color: '#123456', agents: ['main', 'visitor'], limits: { promptsPer5h: 25 },
    usage: { today: { cost: 3 } }, models: [{ id: 'fixture-model', name: 'Configured model', status: 'active' }],
  }];
  context.mock.module(process.env.MC_STORE_MODULE, { namedExports: { useAppStore: (selector) => selector({ overview, sync: {} }) } });
  context.mock.module(process.env.MC_POLLING_MODULE, { namedExports: { usePolling: (read) => ({ data: read(), loading: false, error: null }) } });
  context.mock.module(process.env.MC_API_MODULE, { namedExports: { api: { modelLimits: () => models, quota: () => quota } } });
  try {
    const { Overview } = await import(process.env.MC_OVERVIEW_MODULE);
    const empty = () => ({ agents: [], agentCount: 0, activeRuns: [], activeRunCount: 0, cronCount: 0,
      costToday: 0, costAllTime: 0, system: null, gateway: null, sessions: [], alerts: [],
      crons: [], openPRs: [], recentDeploys: [], agentSummary: [],
    });
    const render = () => renderToStaticMarkup(React.createElement(Overview));
    const hub = (html) => html.slice(html.indexOf('class="command-center"'), html.indexOf('class="agent-grid"'));

    await context.test('observed Rune replaces static main identity and uses the observed denominator', () => {
      overview = { ...empty(), agentCount: 1, agents: [{ id: 'main', name: 'Fallback', identityName: 'Rune' }],
        agentSummary: [{ id: 'main', name: 'Fallback', identityName: 'Rune', status: 'unmapped', currentTask: '', lastActivity: null }] };
      const html = render();
      assert.match(hub(html), />Rune</);
      assert.match(hub(html), /0\/1 running-step mappings/);
      assert.match(hub(html), /No mapped running step/);
      assert.doesNotMatch(hub(html), /Arya|CEO|\/14|active|idle/i);
      assert.match(html, /class="stat-card__value">1</);
    });
    await context.test('observed names and IDs are safely escaped with neutral icon fallback', () => {
      overview = { ...empty(), agentCount: 3, agentSummary: [
        { id: 'visitor', name: 'Ignored', identityName: '<Rune & visitor>', identityEmoji: '🛠', status: 'unmapped' },
        { id: 'named', name: '<Fallback>', status: 'unmapped' },
        { id: '<id-only>', status: 'unmapped' },
      ] };
      const html = hub(render());
      assert.match(html, /&lt;Rune &amp; visitor&gt;/);
      assert.match(html, /&lt;Fallback&gt;/);
      assert.match(html, /&lt;id-only&gt;/);
      assert.match(html, /🛠/);
      assert.match(html, /hub-agent__emoji">◉</);
      assert.doesNotMatch(html, /<Rune|<Fallback>|<id-only>|Ignored/);
    });
    await context.test('successful empty roster differs visibly from unavailable roster and count', () => {
      overview = empty();
      assert.match(hub(render()), /No observed agents/);
      overview = { ...empty(), agentCount: null, agentSummary: null };
      const html = render();
      assert.match(hub(html), /Agent roster unavailable/);
      assert.match(html, /class="stat-card__value">Unknown</);
      assert.doesNotMatch(hub(html), /0\/0|No observed agents/);
    });
    await context.test('mapping wording never claims actual ownership, unknown never becomes idle', () => {
      overview = { ...empty(), agentCount: 1, agentSummary: [
        { id: 'main', identityName: 'Rune', status: 'mapped', currentTask: 'Mapped running step: plan (feature-dev)' },
      ] };
      const mapped = hub(render());
      assert.match(mapped, /1\/1 running-step mappings/);
      assert.match(mapped, /Mapped running step: plan \(feature-dev\)/);
      assert.doesNotMatch(mapped.replace(/<[^>]*>/g, ''), /active|working|CEO/i);
      overview.agentSummary[0] = { id: 'main', identityName: 'Rune', status: 'unknown', lastActivity: 100 };
      const unknown = hub(render());
      assert.match(unknown, /Running-step mappings unavailable/);
      assert.match(unknown, /Mapping unavailable/);
      assert.doesNotMatch(unknown, /0\/1|No mapped running step|idle/i);
    });
    await context.test('local configuration preserves technical values and missing quota stays unavailable', () => {
      overview = empty();
      quota = null;
      const html = render();
      assert.match(html, /LOCAL MODEL CONFIGURATION/);
      assert.match(html, /Plans, prices and agent assignments are configured defaults; account billing is not verified\./);
      for (const value of ['Fixture provider', 'Configured plan', '$123 configured', 'Main, Visitor', 'Configured model', '$3']) assert.ok(html.includes(value));
      assert.match(html, /Usage unavailable/);
      assert.match(html, /Configured limit: 25 calls \/ 5h/);
      assert.doesNotMatch(html, /0 calls|0\/25|quota-bar__fill/);
      quota = {};
      assert.match(render(), /Usage unavailable/);
    });
    await context.test('explicit observed zero usage remains zero with its real quota progress', () => {
      overview = empty();
      quota = { 'fixture-provider': { limit: 25, used: 0, tokens: 0, windowHours: 5 } };
      const html = render();
      assert.match(html, /0 calls \/ 5h/);
      assert.match(html, /0\/25/);
      assert.match(html, /quota-bar__fill/);
      assert.doesNotMatch(html, /Usage unavailable/);
    });
  } finally {
    context.mock.restoreAll();
    console.log('MODULE_MOCKS_RESTORED');
  }
});
`;
  const result = await new Promise<{ exitCode: number | null; closeCode: number | null; signal: string | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ['--experimental-test-module-mocks', '--import', 'tsx', '--input-type=module', '--eval', fixture], {
      env: {
        PATH: process.env.PATH,
        MC_OVERVIEW_MODULE: new URL('../src/pages/Overview.tsx', import.meta.url).href,
        MC_STORE_MODULE: new URL('../src/store/appStore.ts', import.meta.url).href,
        MC_POLLING_MODULE: new URL('../src/hooks/usePolling.ts', import.meta.url).href,
        MC_API_MODULE: new URL('../src/lib/api.ts', import.meta.url).href,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    let exitCode: number | null = null;
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => { exitCode = code; });
    child.once('close', (closeCode, signal) => resolve({ exitCode, closeCode, signal, stdout, stderr }));
  });
  t.diagnostic(JSON.stringify(result));
  assert.equal(result.signal, null);
  assert.equal(result.exitCode, 0, `${result.stdout}${result.stderr}`);
  assert.equal(result.closeCode, 0);
  assert.match(result.stdout, /MODULE_MOCKS_RESTORED/);
});
