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
    const cronCard = (html) => html.slice(html.indexOf('class="stat-card stat-card--orange"'), html.indexOf('class="stat-card stat-card--green"'));

    for (const [count, displayed] of [[5, '5'], [0, '0'], [null, 'Unknown']]) {
      await context.test('configured cron count ' + count + ' renders as ' + displayed + ' enabled schedules', () => {
        overview = { ...empty(), cronCount: count };
        const html = cronCard(render());
        assert.ok(html.includes('class="stat-card__value">' + displayed + '</div>'));
        assert.match(html, /enabled schedules/);
        assert.doesNotMatch(html, />active</);
      });
    }

    const cronSystem = (html) => {
      const start = html.indexOf('>CRON STATUS</h3>');
      const end = html.indexOf('<div class="cron-list">', start);
      assert.ok(start >= 0 && end > start, 'nonempty cron panel must keep its system grid and cron list');
      return html.slice(start, end);
    };
    const oneCron = [{ id: 'fixture-cron', name: 'Fixture schedule', status: 'ok' }];

    await context.test('nonempty cron panel labels unmeasured systems as Unverified', () => {
      overview = { ...empty(), crons: oneCron };
      const grid = cronSystem(render());
      for (const label of ['Gateway', 'Database', 'Disk', 'Memory']) {
        assert.ok(grid.includes(label + ': Unverified'), label + ' must not imply verified health');
      }
    });
    await context.test('unverified system dots stay neutral and decorative', () => {
      overview = { ...empty(), crons: oneCron };
      const grid = cronSystem(render());
      assert.equal((grid.match(/background:var\(--text-dim\)/g) || []).length, 4);
      assert.equal((grid.match(/aria-hidden="true"/g) || []).length, 4);
      assert.doesNotMatch(grid, /var\(--neon-(?:green|cyan|red)\)/);
    });

    const observation = { source: 'inert-fixture', observedAt: '2026-10-28T00:00:00.000Z', status: 'available' };
    const measuredSystem = {
      ram: { ...observation, total: 16, used: 8, percent: 50, semantics: 'total-os.freemem' },
      cpu: { ...observation, percent: 12 },
      disk: { ...observation, total: 100, used: 25, percent: 25, path: '/fixture', mount: '/fixture', totalBytes: 100, usedBytes: 25, freeBytes: 75 },
      load: 0.2, loadObservation: observation,
    };
    for (const [name, fields] of [
      ['online gateway', { gateway: { status: 'online', pid: 1234, uptime: '1h', memory: '1MiB' } }],
      ['offline gateway', { gateway: { status: 'offline', pid: 0, uptime: '0', memory: '0' } }],
      ['available system measurements', { system: measuredSystem }],
    ]) {
      await context.test(name + ' cannot turn cron-panel decoration into verified health', () => {
        overview = { ...empty(), ...fields, crons: oneCron };
        const grid = cronSystem(render());
        for (const label of ['Gateway', 'Database', 'Disk', 'Memory']) {
          assert.ok(grid.includes(label + ': Unverified'), label + ' needs its own health assessment');
        }
      });
    }

    await context.test('cron rows retain supplied statuses, names, last-run formatting and durations', () => {
      overview = { ...empty(), crons: [
        { id: 'cron-ok', name: 'Successful schedule', status: 'ok', lastDuration: 250 },
        { id: 'cron-error', name: 'Failed schedule', status: 'error', lastRunAt: 946684800000, lastDuration: 1500 },
        { id: 'cron-idle', name: 'Idle schedule', status: 'idle' },
        { id: 'cron-running', name: 'Running schedule', status: 'running' },
      ] };
      const rows = [...render().matchAll(/<div class="cron-item">([\s\S]*?)<\/div>/g)].map(match => match[1]);
      assert.equal(rows.length, 4);
      for (const [index, status, name] of [
        [0, 'ok', 'Successful schedule'], [1, 'error', 'Failed schedule'],
        [2, 'idle', 'Idle schedule'], [3, 'running', 'Running schedule'],
      ]) {
        assert.ok(rows[index].includes('cron-item__dot--' + status));
        assert.ok(rows[index].includes('cron-item__name">' + name + '</span>'));
      }
      assert.match(rows[0], /cron-item__last">never<\/span>/);
      assert.match(rows[1], /cron-item__last">[^<]+ ago<\/span>/);
      assert.match(rows[0], /cron-item__duration">250ms<\/span>/);
      assert.match(rows[1], /cron-item__duration">1\.5s<\/span>/);
      assert.doesNotMatch(rows.join(''), /Unverified/);
    });

    for (const name of ['omitted', 'empty']) {
      await context.test(name + ' crons keep the panel hidden despite enabled configured schedules', () => {
        overview = { ...empty(), cronCount: 5 };
        if (name === 'omitted') delete overview.crons;
        const html = render();
        assert.doesNotMatch(html, /CRON STATUS|cron-list|Unverified/);
        assert.ok(cronCard(html).includes('stat-card__value">5</div>'));
        assert.match(cronCard(html), /enabled schedules/);
      });
    }

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
