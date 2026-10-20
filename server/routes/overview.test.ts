import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

// External/config modules are replaced before importing the actual route. The
// parent must not import it: config otherwise reads private files at evaluation.
test('overview projects and observed roster through the actual HTTP producer', async (t) => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'mc-overview-'));
  t.after(() => rmSync(temporaryRoot, { recursive: true, force: true }));
  const dataPath = join(temporaryRoot, 'data.json');
  const jobsPath = join(temporaryRoot, 'jobs.json');
  writeFileSync(dataPath, '{}\n');
  writeFileSync(jobsPath, '{"jobs":[]}\n');

  const fixture = String.raw`
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { renameSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import express from 'express';

test('actual overview boundary', async (context) => {
  const cronCache = await import(process.env.MC_CACHE_MODULE);
  let roster = [{ id: 'main', name: 'Fallback', identityName: 'Rune', identityEmoji: '🛠' }];
  let rosterUnavailable = false;
  let runsUnavailable = false;
  let projectsUnavailable = false;
  let runs = [];
  let projected = [];
  let runReads = 0;
  context.beforeEach(() => {
    roster = [{ id: 'main', name: 'Fallback', identityName: 'Rune', identityEmoji: '🛠' }];
    rosterUnavailable = false;
    runsUnavailable = false;
    projectsUnavailable = false;
    runs = [];
    projected = [];
    runReads = 0;
    cronCache.invalidateCache('cron');
    writeFileSync(process.env.MC_DATA_PATH, '{}');
    writeFileSync(process.env.MC_JOBS_PATH, '{"jobs":[]}');
  });
  context.mock.module(process.env.MC_CONFIG_MODULE, { namedExports: { config: {
    dataJson: process.env.MC_DATA_PATH, jobsJson: process.env.MC_JOBS_PATH,
  } } });
  context.mock.module(process.env.MC_CACHE_MODULE, { namedExports: {
    cached: async (key, ttl, read) => key === 'cron' ? cronCache.cached(key, ttl, read) : read(),
    invalidateCache: cronCache.invalidateCache,
  } });
  context.mock.module(process.env.MC_PROJECTS_MODULE, { namedExports: { readProjectApiProjections: async () => {
    if (projectsUnavailable) throw new Error('fixture projections unavailable');
    return projected;
  } } });
  context.mock.module(process.env.MC_SETFARM_MODULE, { namedExports: { getRuns: async () => {
    runReads++;
    if (runsUnavailable) throw new Error('fixture runs unavailable');
    return runs;
  } } });
  context.mock.module(process.env.MC_CLI_MODULE, { namedExports: {
    runCliJson: async () => { if (rosterUnavailable) throw new Error('fixture roster unavailable'); return roster; },
    runCli: async () => '[]',
  } });
  context.mock.module(process.env.MC_METRICS_MODULE, { namedExports: { getSystemMetrics: async () => null } });

  const { default: router, selectOperationalActiveProjects, selectRecentRuntimeProjects } = await import(process.env.MC_OVERVIEW_MODULE);
  const { default: cronRouter } = await import(process.env.MC_CRON_MODULE);
  const execution = (state, runId, runStatus = state) => ({
    schema: 'mission-control.project-execution.v1', state,
    active: ['running', 'resuming', 'cancelling', 'failing'].includes(state),
    runId, runStatus, protocol: 'v3', source: 'setfarm_postgres_run', reasonCode: 'PROJECT_RUN_BOUND',
  });
  const project = (id, state = 'running', extra = {}) => ({
    id, name: id, status: state === 'terminal' ? 'completed' : 'building',
    createdAt: '2026-08-17T08:00:00.000Z', ports: {},
    execution: execution(state, 'run-' + id, state === 'terminal' ? 'completed' : state),
    runtime: { state: 'inactive', checkedAt: null, reasonCode: 'fixture' }, receipt: null, ...extra,
  });
  const app = express();
  app.use('/api', router);
  app.use('/api', cronRouter);
  const server = createServer(app);
  const runtimeServer = createServer((_request, response) => response.end('ok'));
  const close = (ownedServer, name) => new Promise((resolve, reject) => ownedServer.close((error) => {
    if (error) reject(error); else { console.log('OWNED_SERVER_CLOSED ' + name); resolve(); }
  }));
  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    await new Promise((resolve) => runtimeServer.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const runtimeAddress = runtimeServer.address();
    assert.ok(address && typeof address === 'object');
    assert.ok(runtimeAddress && typeof runtimeAddress === 'object');
    const read = async () => {
      const response = await fetch('http://127.0.0.1:' + address.port + '/api/overview');
      assert.equal(response.status, 200);
      return response.json();
    };
    const readCrons = async () => {
      const response = await fetch('http://127.0.0.1:' + address.port + '/api/cron');
      assert.equal(response.status, 200);
      return response.json();
    };
    const configuredJobs = [
      { id: 'configured-1', name: 'one', enabled: true },
      { id: 'configured-2', name: 'two', enabled: false },
      { id: 'configured-3', name: 'three', enabled: true },
      { id: 'configured-4', name: 'four', enabled: true },
      { id: 'configured-5', name: 'five', enabled: false },
      { id: 'configured-6', name: 'six', enabled: true },
      { id: 'configured-7', name: 'seven', enabled: false },
      { id: 'configured-8', name: 'eight', enabled: true },
    ];

    for (const dashboard of [{ crons: [{ enabled: true }] }, {}]) {
      await context.test('five enabled configured schedules win over ' + (dashboard.crons ? 'conflicting' : 'absent') + ' dashboard crons', async () => {
        writeFileSync(process.env.MC_DATA_PATH, JSON.stringify(dashboard));
        writeFileSync(process.env.MC_JOBS_PATH, JSON.stringify({ jobs: configuredJobs }));
        assert.deepEqual(await readCrons(), configuredJobs);
        assert.equal((await read()).cronCount, 5);
      });
    }
    await context.test('Overview and Operations share the configured display cache in either read order', async () => {
      writeFileSync(process.env.MC_JOBS_PATH, JSON.stringify({ jobs: configuredJobs }));
      assert.equal((await read()).cronCount, 5);
      writeFileSync(process.env.MC_JOBS_PATH, '{"jobs":[]}');
      assert.deepEqual(await readCrons(), configuredJobs);
      cronCache.invalidateCache('cron');
      assert.deepEqual(await readCrons(), []);
      writeFileSync(process.env.MC_JOBS_PATH, JSON.stringify({ jobs: configuredJobs }));
      assert.equal((await read()).cronCount, 0);
    });
    await context.test('valid empty configured jobs are zero despite enabled dashboard crons', async () => {
      writeFileSync(process.env.MC_DATA_PATH, '{"crons":[{"enabled":true}]}');
      assert.equal((await read()).cronCount, 0);
    });
    await context.test('configured jobs remain available when the independent dashboard snapshot is malformed', async () => {
      writeFileSync(process.env.MC_DATA_PATH, '{malformed');
      writeFileSync(process.env.MC_JOBS_PATH, JSON.stringify({ jobs: configuredJobs }));
      assert.equal((await read()).cronCount, 5);
    });
    for (const [name, raw] of [
      ['missing collection', '{}'], ['null collection', '{"jobs":null}'],
      ['object collection', '{"jobs":{}}'], ['invalid JSON', '{malformed'],
      ['null job', '{"jobs":[null]}'], ['missing enabled state', '{"jobs":[{}]}'],
      ['nonboolean enabled state', '{"jobs":[{"enabled":"false"}]}'],
    ]) {
      await context.test(name + ' configured jobs stay unknown despite dashboard crons', async () => {
        writeFileSync(process.env.MC_DATA_PATH, '{"crons":[{"enabled":true}]}');
        writeFileSync(process.env.MC_JOBS_PATH, raw);
        const body = await read();
        assert.equal(body.cronCount, null);
        assert.equal(body.agentCount, 1, 'cron availability does not suppress other observations');
      });
    }
    await context.test('missing configured file stays unknown without suppressing other observations', async () => {
      const retainedPath = process.env.MC_JOBS_PATH + '.retained';
      renameSync(process.env.MC_JOBS_PATH, retainedPath);
      try {
        const body = await read();
        assert.equal(body.cronCount, null);
        assert.equal(body.agentCount, 1);
      } finally {
        renameSync(retainedPath, process.env.MC_JOBS_PATH);
      }
    });

    await context.test('one observed Rune and zero runs cannot invent CEO work or catalog rows', async () => {
      const body = await read();
      assert.equal(body.agentCount, 1);
      assert.deepEqual(body.agentSummary, [{
        id: 'main', name: 'Fallback', identityName: 'Rune', identityEmoji: '🛠',
        status: 'unmapped', currentTask: '', lastActivity: null,
      }]);
    });
    await context.test('one overview observation gathers runs once', async () => {
      runReads = 0;
      await read();
      assert.equal(runReads, 1);
    });
    await context.test('successful empty roster differs from unavailable roster', async () => {
      roster = [];
      const empty = await read();
      assert.equal(empty.agentCount, 0);
      assert.deepEqual(empty.agentSummary, []);
      rosterUnavailable = true;
      const unavailable = await read();
      assert.equal(unavailable.agentCount, null);
      assert.equal(unavailable.agentSummary, null);
      rosterUnavailable = false;
    });
    await context.test('additional observed IDs and session history survive without implying work', async () => {
      roster = [{ id: 'visitor', name: 'Visitor' }, { id: 'id-only' }];
      writeFileSync(process.env.MC_DATA_PATH, JSON.stringify({ sessions: [
        { agent: 'visitor', updatedAt: 100 }, { key: 'agent:visitor:session', updatedAt: 200 },
      ] }));
      const body = await read();
      assert.deepEqual(body.agents.map((agent) => agent.id), ['visitor', 'id-only']);
      assert.equal(body.agentCount, 2);
      assert.deepEqual(body.agentSummary.map(({ id, status, lastActivity }) => ({ id, status, lastActivity })), [
        { id: 'visitor', status: 'unmapped', lastActivity: 200 },
        { id: 'id-only', status: 'unmapped', lastActivity: null },
      ]);
      writeFileSync(process.env.MC_DATA_PATH, '{}');
    });
    await context.test('only canonically active matching running steps produce an explicit mapping', async () => {
      roster = [{ id: 'main', identityName: 'Rune' }, { id: 'atlas' }];
      projected = [project('accepted', 'resuming'), project('raw-pending', 'resuming'), project('terminal', 'terminal'), project('mismatch', 'failing')];
      runs = [
        { id: 'run-accepted', status: 'resuming', workflow_id: 'feature-dev', steps: [{ id: 'plan', status: 'running' }] },
        { id: 'run-raw-pending', status: 'pending', workflow: 'feature-dev', steps: [{ step_id: 'setup-repo', status: 'running' }] },
        { id: 'run-terminal', status: 'completed', workflow: 'feature-dev', steps: [{ step_id: 'setup-repo', status: 'running' }] },
        { id: 'run-mismatch', status: 'cancelling', workflow: 'feature-dev', steps: [{ step_id: 'setup-repo', status: 'running' }] },
        { id: 'unbound', status: 'running', workflow: 'feature-dev', steps: [{ step_id: 'setup-repo', status: 'running' }] },
      ];
      const body = await read();
      assert.deepEqual(body.activeRuns.map((run) => run.id), ['run-accepted']);
      assert.equal(body.agentSummary[0].status, 'mapped');
      assert.equal(body.agentSummary[0].currentTask, 'Mapped running step: plan (feature-dev)');
      assert.equal(body.agentSummary[1].status, 'unmapped');
      assert.equal(body.agentSummary[1].currentTask, '');
      runs = [{ id: 'run-accepted', status: 'resuming', workflow: 'feature-dev', steps: [
        { step_id: 'plan', status: 'completed' }, { step_id: 'unknown-step', status: 'running' },
      ] }];
      assert.ok((await read()).agentSummary.every((agent) => agent.status === 'unmapped' && agent.currentTask === ''));
    });
    await context.test('unavailable run or canonical projection input leaves mappings unknown', async () => {
      runsUnavailable = true;
      assert.ok((await read()).agentSummary.every((agent) => agent.status === 'unknown' && agent.currentTask === ''));
      runsUnavailable = false;
      projectsUnavailable = true;
      assert.ok((await read()).agentSummary.every((agent) => agent.status === 'unknown' && agent.currentTask === ''));
      projectsUnavailable = false;
    });
    await context.test('operational project selection requires equality and distinct projected run identity', () => {
      const exact = ['running', 'resuming', 'cancelling', 'failing'].map((state) => project(state, state));
      const mismatch = project('mismatch', 'running', { execution: execution('resuming', 'run-mismatch', 'running') });
      const duplicate = project('duplicate', 'running', { execution: execution('running', 'run-running') });
      assert.deepEqual(selectOperationalActiveProjects([project('historical', 'unbound', { serviceStatus: 'active' }), project('pending', 'pending'), project('terminal', 'terminal'), mismatch, duplicate, ...exact])
        .map((candidate) => candidate.execution.runId), ['run-running', 'run-resuming', 'run-cancelling', 'run-failing']);
    });
    await context.test('recent terminal runtime candidates use valid declared ports and owned HTTP probe', async () => {
      const candidates = Array.from({ length: 8 }, (_, index) => project('candidate-' + index, 'terminal', {
        createdAt: '2026-08-' + String(index + 1).padStart(2, '0') + 'T08:00:00.000Z',
        ports: index % 2 === 0 ? { frontend: runtimeAddress.port } : { main: runtimeAddress.port },
      }));
      candidates.push(project('zero', 'running', { ports: { frontend: 0 } }), project('large', 'running', { ports: { main: 65536 } }), project('backend', 'running', { ports: { backend: 4200 } }));
      assert.deepEqual(selectRecentRuntimeProjects(candidates).map((candidate) => candidate.id), ['candidate-7', 'candidate-6', 'candidate-5', 'candidate-4', 'candidate-3', 'candidate-2']);
      projected = [project('accepted'), project('completed-live', 'terminal', { ports: { frontend: runtimeAddress.port } })];
      runs = [{ id: 'run-accepted', status: 'running', workflow: 'feature-dev' }, { id: 'run-unbound', status: 'running' }];
      const body = await read();
      assert.deepEqual(body.activeRuns.map((run) => run.id), ['run-accepted']);
      assert.equal(body.activeRunCount, 1);
      assert.deepEqual(body.recentDeploys, [{ id: 'completed-live', name: 'completed-live', port: runtimeAddress.port, subdomain: '', online: true, emoji: '' }]);
    });
  } finally {
    try {
      await Promise.all([close(server, 'overview'), close(runtimeServer, 'runtime')]);
    } finally {
      context.mock.restoreAll();
      console.log('MODULE_MOCKS_RESTORED');
    }
  }
});
`;
  const result = await new Promise<{ exitCode: number | null; closeCode: number | null; signal: string | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ['--experimental-test-module-mocks', '--import', 'tsx', '--input-type=module', '--eval', fixture], {
      env: {
        PATH: process.env.PATH,
        MC_DATA_PATH: dataPath,
        MC_JOBS_PATH: jobsPath,
        MC_OVERVIEW_MODULE: new URL('./overview.ts', import.meta.url).href,
        MC_CRON_MODULE: new URL('./cron.ts', import.meta.url).href,
        MC_CONFIG_MODULE: new URL('../config.ts', import.meta.url).href,
        MC_CACHE_MODULE: new URL('../utils/cache.ts', import.meta.url).href,
        MC_PROJECTS_MODULE: new URL('./projects.ts', import.meta.url).href,
        MC_SETFARM_MODULE: new URL('../utils/setfarm.ts', import.meta.url).href,
        MC_CLI_MODULE: new URL('../utils/cli.ts', import.meta.url).href,
        MC_METRICS_MODULE: new URL('../utils/prometheus.ts', import.meta.url).href,
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
  assert.match(result.stdout, /OWNED_SERVER_CLOSED overview/);
  assert.match(result.stdout, /OWNED_SERVER_CLOSED runtime/);
  assert.match(result.stdout, /MODULE_MOCKS_RESTORED/);
});
