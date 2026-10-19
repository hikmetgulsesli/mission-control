/** Fixed local fixture API and the one executable browser assertion catalog. */
import { createServer } from 'node:http';
import { readdirSync, realpathSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createUiArtifactStoreV1, pinUiFileV1, uiHashV1, uiCanonicalV1 } from './ui-regression-lifecycle.mjs';
const ORIGIN = 'http://127.0.0.1:13082';
const AT = '2026-10-19T10:00:00.000Z';
const LEGACY = 'ac8cea43-7686-4d27-8092-1e3dd9207ca4', V3 = 'ad47fe65-4ec4-4fb5-89da-fff71eb4e79a';
const JOB_A = '018d819f-0a78-7d38-bb1f-0195b029ddaf', JOB_B = '018d819f-0a78-7d38-bb1f-0195b029ddae';
const SOURCE = 'a'.repeat(40), BUILD = 'b'.repeat(64), SELECTION = 'c'.repeat(64);
const VIEWPORTS = [390, 768, 1440].map(width => ({ width, height: 900 }));
const ROUTES = ['/', '/office', '/setfarm', '/setfarm/active', `/setfarm/runs/${LEGACY}`, `/setfarm/runs/${V3}`, '/agents', '/chat', '/ops', '/costs', '/performance', '/projects', '/files', '/scrape', '/rules', '/live', '/workflows', '/tasks', '/prd', '/controls'];
const TABS = ['Execution', 'Pipeline', 'Run Contract', 'Supervisor', 'Telemetry', 'Agent Chat', 'Files', 'Stories'];
const BEHAVIORS = ['office.persist', 'navigation.perf-redirect', 'navigation.d-p', 'navigation.input-guard', 'navigation.textarea-guard', 'navigation.select-guard', 'navigation.contenteditable-guard', 'navigation.ime-guard', 'navigation.modifier-guard', 'navigation.search-favorite', 'navigation.mobile-focus', 'agents.grid-panel', 'prd.clone-a101', 'prd.delayed-history-edit', 'prd.stale-history-preserves-draft', 'prd.new-history-race', 'prd.navigation-history-race', 'rules.draft-503', 'rules.delete-confirmation-503', 'metrics.zero-unknown', 'controls.distinct-check-groups', 'controls.provenance', 'controls.kind-confirmation', 'controls.hash-confirmation', 'controls.lost-response-reload-idempotency', 'controls.cancel-owned-settlement', 'controls.crossmount-delayed-a-new-b', 'controls.unknown-retention'];
const routeId = r => r === '/' ? 'home' : r.slice(1).replaceAll('/', '-');
const ASSERTIONS = VIEWPORTS.flatMap(v => ROUTES.flatMap(r => ['loaded', 'overflow', 'fonts', 'console-network'].map(s => `page.${routeId(r)}.${v.width}.${s}`))).concat(VIEWPORTS.flatMap(v => [LEGACY, V3].flatMap(id => TABS.map(tab => `run.${id}.${v.width}.${tab.toLowerCase().replaceAll(' ', '-')}`))), BEHAVIORS);
const AGENTS = Array.from({ length: 14 }, (_, i) => ({ id: 'fixture-agent-' + (i + 1), name: 'Fixture agent ' + (i + 1), identityName: 'Fixture agent ' + (i + 1), identityEmoji: '🤖', model: 'fixture-local', workspace: '/fixture', bindings: 0, isDefault: i === 0 }));
const METRICS = { ram: { source: 'fixture', observedAt: AT, status: 'available', total: 16, used: 0, percent: 0, semantics: 'total-os.freemem' }, cpu: { source: 'fixture', observedAt: AT, status: 'unknown', percent: null }, disk: { source: 'fixture', observedAt: AT, status: 'available', total: 100, used: 0, percent: 0, path: '/fixture', mount: '/fixture', totalBytes: 100000000000, usedBytes: 0, freeBytes: 100000000000 }, load: 0 };
const RUNS = [{ id: LEGACY, runNumber: 1, workflow: 'fixture-legacy', task: 'Legacy fixture', status: 'completed', updatedAt: AT, steps: [], storyCount: 1, storiesDone: 1 }, { id: V3, runNumber: 2, workflow: 'fixture-v3', task: 'V3 fixture', status: 'completed', updatedAt: AT, steps: [], storyCount: 1, storiesDone: 1 }];
const RULE = { id: 'fixture-rule', title: 'Fixture rule', content: 'Keep failure evidence.', category: 'general', project_type: 'general', severity: 'mandatory', applies_to: 'all', readonly: false, enabled: true, stack_pack_ids: [] };
const HISTORY = [{ id: 'fixture-prd', title: 'Old history title', description: 'Old history description', prd_content: '# Old saved project', prd_version: 1, platform: 'web', urls: [], mockup_screens: [], chat_history: [], run_id: null, created_at: AT }];
// Exact IDs/codes from the Source-owned SF activation and convergence preflight runners.
// These are local simulated projection rows; no activation or provider check is executed here.
const ACTIVATION_CHECKS = [
    ['migration_shape', 'MIGRATION_SHAPE_VERIFIED'],
    ['migration_attestation', 'MIGRATION_RELEASE_ATTESTED'],
    ['database', 'DATABASE_REACHABLE'],
    ['artifact_capacity', 'ARTIFACT_CAPACITY_READY'],
    ['activity', 'ACTIVATION_ACTIVITY_IDLE'],
    ['protocol_activation', 'SHADOW_PROTOCOL_ENABLED'],
].map(([id, code]) => ({ id, status: 'pass', blocking: false, code }));
const CONVERGENCE_PREFLIGHT_CHECKS = [
    ['release_identity', 'EVAL_RELEASE_IDENTITY_EXACT'],
    ['release_cleanliness', 'EVAL_RELEASE_WORKTREE_CLEAN'],
    ['migration_attestation', 'EVAL_MIGRATIONS_RELEASE_ATTESTED'],
    ['database_ownership', 'EVAL_DATABASE_OWNERSHIP_IDLE'],
    ['setfarm_health', 'EVAL_SETFARM_HEALTHY'],
    ['mission_control_health', 'EVAL_MISSION_CONTROL_HEALTHY'],
    ['execution_profile', 'EVAL_EXECUTION_PROFILE_PINNED'],
    ['result_store', 'EVAL_RESULT_STORES_READY'],
].map(([id, code]) => ({ id, status: 'pass', code }));
const DATA = { controls: { activationChecks: ACTIVATION_CHECKS, convergencePreflightChecks: CONVERGENCE_PREFLIGHT_CHECKS }, agents: AGENTS, metrics: METRICS, runs: RUNS, rule: RULE, history: HISTORY, trending: [{ name: 'A101', description: 'A101 shopping application', developer: 'Fixture', category: 'Shopping' }] };
export const UI_REGRESSION_FIXTURE_V1 = Object.freeze({ fixtureVersion: 'ui-regression-owned-v1', fixtureHash: uiHashV1(uiCanonicalV1({ data: DATA, routes: ROUTES, viewports: VIEWPORTS, tabs: TABS, assertionIds: ASSERTIONS })), assertionIds: Object.freeze(ASSERTIONS) });
const assert = (condition, code = 'UI_ASSERTION_FAILED') => {
    if (!condition)
        throw Error(code);
};
/** Private matcher: production inputs are captured browser events and fixed, actually executed fixture faults. */
export function reconcileUiFixtureDiagnosticsV1({ assertionId, errors, requestFailures, faults }) {
    const remainingErrors = [...errors], remainingRequests = [...requestFailures], expected = [];
    assert(faults.length <= 1, 'UI_BROWSER_ERRORS');
    for (const fault of faults) {
        assert(fault.assertionId === assertionId && typeof fault.requestIdentity === 'string' && /^request-[1-9][0-9]*$/.test(fault.requestIdentity) && /^[a-f0-9]{64}$/.test(fault.bodyHash), 'UI_BROWSER_ERRORS');
        const lost = fault.kind === 'lost_response';
        if (lost)
            assert(assertionId === 'controls.lost-response-reload-idempotency' && fault.method === 'POST' && fault.url === ORIGIN + '/api/controls/jobs' && /^[a-f0-9-]{36}$/.test(fault.idempotencyKey) && [JOB_A, JOB_B].includes(fault.acceptedJobId), 'UI_BROWSER_ERRORS');
        else
            assert(fault.kind === 'rules_503' && ((assertionId === 'rules.draft-503' && fault.method === 'POST' && fault.url === ORIGIN + '/api/rules') || (assertionId === 'rules.delete-confirmation-503' && fault.method === 'DELETE' && fault.url === ORIGIN + '/api/rules/fixture-rule')), 'UI_BROWSER_ERRORS');
        const matches = remainingRequests.filter(event => ['assertionId', 'requestIdentity', 'method', 'url', 'bodyHash'].every(key => event[key] === fault[key]) && (lost ? event.kind === 'requestfailed' && event.errorText === 'net::ERR_EMPTY_RESPONSE' : event.kind === 'response' && event.status === 503));
        const text = lost ? 'Failed to load resource: net::ERR_EMPTY_RESPONSE' : 'Failed to load resource: the server responded with a status of 503 (Service Unavailable)';
        const consoles = remainingErrors.filter(error => error.kind === 'console' && error.assertionId === assertionId && error.url === fault.url && error.text === text);
        assert(matches.length === 1 && consoles.length === 1, 'UI_BROWSER_ERRORS');
        remainingRequests.splice(remainingRequests.indexOf(matches[0]), 1);
        remainingErrors.splice(remainingErrors.indexOf(consoles[0]), 1);
        expected.push({ fault, request: matches[0], console: consoles[0] });
    }
    assert(!remainingErrors.length && !remainingRequests.length, 'UI_BROWSER_ERRORS');
    return expected;
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function closeFixtureContext(context) {
    let timer;
    try {
        await Promise.race([context.close(), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('UI_CONTEXT_CLOSE_UNKNOWN')), 5000); })]);
    }
    finally {
        clearTimeout(timer);
    }
}
/** Same stock identity algorithm; source SHA is loaded from the measured build, never HEAD. */
export function measureUiBuildV1(buildDir) {
    assert(path.isAbsolute(buildDir) && realpathSync(buildDir) === buildDir, 'UI_BUILD_IDENTITY_INVALID');
    const entries = new Map(), dirs = [];
    const visit = directory => {
        const initial = lstatSync(directory);
        assert(initial.isDirectory() && !initial.isSymbolicLink() && !(initial.mode & 0o022), 'UI_BUILD_IDENTITY_INVALID');
        dirs.push({ directory, dev: initial.dev, ino: initial.ino });
        for (const item of readdirSync(directory, { withFileTypes: true })) {
            const file = path.join(directory, item.name);
            if (item.isDirectory())
                visit(file);
            else if (item.isFile()) {
                const name = path.relative(buildDir, file).split(path.sep).join('/');
                if (name !== 'dist-server/internal-production-build-identity.v1.json')
                    entries.set(name, pinUiFileV1(file, 536870912));
            }
            else
                throw Error('UI_BUILD_IDENTITY_INVALID');
        }
    };
    visit(path.join(buildDir, 'dist'));
    visit(path.join(buildDir, 'dist-server'));
    const identityPin = pinUiFileV1(path.join(buildDir, 'dist-server/internal-production-build-identity.v1.json'), 16384);
    const identity = JSON.parse(identityPin.bytes);
    assert(Object.keys(identity).sort().join('|') === 'buildHash|schema|sourceSha|treeHash' && identity.schema === 'mission-control.internal-production-build-identity.v1' && /^[a-f0-9]{40}$/.test(identity.sourceSha) && /^[a-f0-9]{40}$/.test(identity.treeHash) && /^[a-f0-9]{64}$/.test(identity.buildHash), 'UI_BUILD_IDENTITY_INVALID');
    const h = createHash('sha256').update('mission-control.internal-production-build-content.v1\0');
    for (const [name, pin] of [...entries].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
        h.update(name).update('\0').update(String(pin.bytes.length)).update('\0').update(pin.bytes).update('\0');
    }
    assert(h.digest('hex') === identity.buildHash && entries.has('dist/index.html'), 'UI_BUILD_IDENTITY_INVALID');
    return Object.freeze({ identity, entries, check() {
            identityPin.check();
            for (const pin of entries.values())
                pin.check();
            for (const d of dirs) {
                const now = lstatSync(d.directory);
                assert(now.dev === d.dev && now.ino === d.ino && now.isDirectory() && !now.isSymbolicLink(), 'UI_BUILD_IDENTITY_INVALID');
            }
        } });
}
function evidence(variant = 'planned') {
    const absent = { availability: { state: 'unconfigured', code: 'FIXTURE_UNCONFIGURED' }, report: null };
    const cases = Array.from({ length: 8 }, (_, i) => ({ caseId: 'fixture-case-' + (i + 1), repetition: 1, evidenceState: 'not_started', disposition: null, passed: null, runId: null, resultHash: null }));
    const report = { resultHash: 'd'.repeat(64), gateHash: null, compatibility: 'current', executionMode: 'preflight', resultStatus: 'planned', gateDecision: null, qualification: 'unqualified', preflightChecks: CONVERGENCE_PREFLIGHT_CHECKS, cases, completedCases: 0, plannedCases: 8, blockerCodes: [] };
    if (variant === 'unqualified')
        Object.assign(report, { executionMode: 'execute', resultStatus: 'pass', gateDecision: 'go', gateHash: 'e'.repeat(64), completedCases: 8, cases: cases.map((c, i) => ({ ...c, evidenceState: 'recorded', disposition: 'completed', passed: true, runId: 'fixture-run-' + i, resultHash: 'f'.repeat(64) })) });
    const activation = { availability: { state: 'available', code: null }, report: { hash: '3'.repeat(64), status: 'pass', protocol: 'shadow', compatibility: 'current', observedAt: null, checks: ACTIVATION_CHECKS } };
    const current = { activation, evaluation: { availability: { state: 'available', code: variant === 'unqualified' ? 'CONTROL_RELEASE_ADMISSION_UNOBSERVED' : null }, report }, ui: absent };
    return { schema: 'mission-control.controls-evidence-envelope.v1', selectionHash: SELECTION, evidence: current, history: [{ id: '1'.repeat(64), sourceSha: '2'.repeat(40), evidence: { activation: { ...activation, report: { ...activation.report, compatibility: 'historical' } }, evaluation: { availability: { state: 'available', code: null }, report: { ...report, compatibility: 'historical', qualification: 'historical' } } } }] };
}
function receipt(id, body) { return { schema: 'mission-control.control-job.v1', jobId: id, kind: body.kind, revision: 1, selectionHash: body.expectedSelectionHash, sourceSha: SOURCE, mcSourceSha: SOURCE, mcBuildHash: BUILD, suiteHash: body.kind === 'convergence_full8' ? 'f'.repeat(64) : null, state: 'running', requestedAt: AT, startedAt: AT, updatedAt: AT, finishedAt: null, phase: 'running', code: null, currentCaseId: null, ownedRunId: null, completedCases: 1, plannedCases: body.kind === 'convergence_full8' ? 8 : body.kind === 'ui_regression' ? ASSERTIONS.length : 6, reportRefs: {}, cancelRequested: false }; }
function createFixtureState() { return { unexpected: [], activeAssertion: null, browserRequests: [], requestFailures: [], intentionalFaults: [], jobs: new Map(), launches: new Map(), launchBodies: [], evidence: evidence(), history: HISTORY, holdHistory: null, holdLaunch: null, loseNextLaunch: false, cancelSettled: false, requests: [], pendingResponses: new Set() }; }
async function fixtureResponse(state, method, url, body) {
    const p = url.pathname;
    state.requests.push({ method, path: p });
    if (method === 'GET') {
        if (p === '/api/controls/evidence')
            return state.evidence;
        if (p === '/api/controls/jobs')
            return { jobs: [...state.jobs.values()] };
        if (p.startsWith('/api/controls/jobs/'))
            return { receipt: state.jobs.get(p.split('/').at(-1)) };
        if (p === '/api/prd/history') {
            const hold = state.holdHistory;
            if (hold)
                await hold.promise;
            return state.history;
        }
        if (p === '/api/agents')
            return AGENTS;
        if (/^\/api\/agents\/fixture-agent-\d+\/stats$/.test(p))
            return { agentId: p.split('/')[3], storiesCompleted: 0, storiesFailed: 0, successRate: 0, avgDurationMs: 0, errorCount: 0, totalSteps: 0 };
        if (/^\/api\/agents\/fixture-agent-\d+\/live$/.test(p))
            return { status: 'idle', currentSession: null, totalSessions: 0 };
        if (/^\/api\/agents\/fixture-agent-\d+\/history$/.test(p))
            return { messages: [] };
        if (p === '/api/system')
            return METRICS;
        if (p === '/api/overview')
            return { agents: AGENTS, agentCount: 14, activeRuns: [], activeRunCount: 0, cronCount: 0, costToday: 0, costAllTime: 0, system: METRICS, gateway: null, sessions: [], alerts: [], crons: [], agentLastActive: {}, openPRs: [], recentDeploys: [], agentSummary: [] };
        if (p === '/api/office/status')
            return { agents: AGENTS.map(a => ({ id: a.id, status: 'idle', activity: '' })) };
        if (p === '/api/runs' || p === '/api/setfarm/pipeline')
            return RUNS;
        if (p === '/api/runs/stuck')
            return { runs: [] };
        if (p === '/api/kimi-quota')
            return { snapshot: { available: false, fetchedAt: AT, error: { code: 'FIXTURE_PROVIDER_DISABLED', detail: 'Local fixture has no provider access' } }, severity: 'unknown', reason: 'Local fixture only' };
        if (p === '/api/telemetry' && [LEGACY, V3].includes(url.searchParams.get('runId')))
            return { schema: 'mission-control.pipeline-telemetry.v1', status: 'available_limited', runId: url.searchParams.get('runId'), history: { state: 'unavailable', reasonCode: 'PRECISE_TRANSITION_HISTORY_UNAVAILABLE' }, analysis: { coverage: ['historical_execution_duration'] }, steps: [], transitions: [], bottlenecks: [] };
        if (p === '/api/setfarm/alerts')
            return { alerts: [], summary: { total: 0, critical: 0, warning: 0 } };
        if (p === '/api/quota')
            return { providers: [], available: true };
        if (p === '/api/costs')
            return { totalToday: 0, totalAllTime: 0, projectedMonthly: 0, breakdownAllTime: [], breakdownToday: [], subagentCostAllTime: 0, subagentCostToday: 0, tokenUsage: [], tokenUsageToday: [], costStatus: { totalToday: 'available', totalAllTime: 'available', projectedMonthly: 'available', subagentCostAllTime: 'available', subagentCostToday: 'available' }, usageSource: 'dashboard_data' };
        if (p === '/api/performance')
            return { agents: {}, modelCosts: {}, modelCostsToday: {}, modelTokens: {}, totalCostToday: null, totalCostAllTime: 0, sessionsStatus: 'available', costStatus: { today: 'unknown', allTime: 'available' }, usageSource: 'dashboard_data' };
        if (p === '/api/rules')
            return [RULE];
        if (p === '/api/rules/capabilities')
            return { create: true, update: true, delete: true, import: true, toggle: true, reason: null };
        if (p === '/api/files/list')
            return { path: '/fixture', parent: null, entries: [], files: [] };
        if (p === '/api/scrape/trending')
            return DATA.trending;
        if (['/api/sessions', '/api/cron', '/api/workflows', '/api/projects', '/api/tasks', '/api/approvals', '/api/setfarm/activity', '/api/setfarm/agents', '/api/setfarm/agent-feed', '/api/system/docker', '/api/model-limits', '/api/live-feed', '/api/scrape/history', '/api/prd/templates'].includes(p))
            return [];
        const run = /^\/api\/(?:setfarm\/)?runs\/([^/]+)\/(.+)$/.exec(p);
        if (run && [LEGACY, V3].includes(run[1])) {
            const id = run[1], tail = run[2];
            if (tail === 'detail')
                return { ...RUNS.find(r => r.id === id), fullSteps: [{ id: 'fixture-step', agent: 'fixture-agent-1', status: 'done', output: 'Fixture step complete', retryCount: 0 }], stories: [{ id: 'story-1', title: 'Fixture story', description: 'Retained fixture story', acceptanceCriteria: ['Fixture acceptance'] }], gitLog: [{ hash: 'abcd123', message: 'Fixture commit', date: AT, author: 'Fixture' }], diffStats: [], fileTree: ['README.md'], agentChats: [{ agent: 'fixture-agent-1', sessionId: 'fixture-session', messages: [{ role: 'assistant', text: 'Fixture conversation', timestamp: AT }] }], progressLog: 'Fixture progress', supervisor: null };
            if (tail === 'stories' || tail === 'events' || tail === 'errors')
                return [];
            if (tail === 'supervisor')
                return { available: false };
            if (tail === 'plan')
                return { plan: null, stories: [] };
            if (tail === 'design')
                return { design: null };
            if (tail === 'contract')
                return { available: false, contract: null };
            if (tail === 'operations')
                return { available: false };
            if (tail === 'operational-snapshot')
                return { status: 'unavailable', code: 'SETFARM_OPERATIONAL_SNAPSHOT_NOT_FOUND', reason: 'not_found' };
            if (tail === 'product-build-authority')
                return { status: 'unavailable', code: 'SETFARM_PRODUCT_BUILD_AUTHORITY_NOT_READY', reason: 'not_ready', upstreamStatus: 409, upstreamCode: id === LEGACY ? 'RUNTIME_PACKET_RUN_NOT_V3' : 'RUNTIME_PACKET_NOT_READY' };
            if (tail === 'telemetry')
                return { status: 'unavailable', code: 'SETFARM_TELEMETRY_UNAVAILABLE', reason: 'not_found' };
        }
    }
    if (method === 'POST' && p === '/api/controls/jobs') {
        assert(body && Object.keys(body).sort().join('|') === 'expectedSelectionHash|idempotencyKey|kind' && ['activation_preflight', 'convergence_full8', 'ui_regression'].includes(body.kind) && /^[a-f0-9-]{36}$/.test(body.idempotencyKey) && body.expectedSelectionHash === state.evidence.selectionHash, 'UI_FIXTURE_MUTATION_DENIED');
        state.launchBodies.push({ ...body });
        const old = state.launches.get(body.idempotencyKey);
        if (old) {
            assert(uiCanonicalV1(old.body) === uiCanonicalV1(body), 'UI_FIXTURE_IDEMPOTENCY_CONFLICT');
            return { receipt: state.jobs.get(old.id), replay: true };
        }
        assert(state.jobs.size < 2, 'UI_FIXTURE_JOB_LIMIT');
        const id = state.jobs.size ? JOB_B : JOB_A;
        const r = receipt(id, body);
        state.jobs.set(id, r);
        state.launches.set(body.idempotencyKey, { id, body });
        if (state.holdLaunch)
            await state.holdLaunch.promise;
        if (state.loseNextLaunch) {
            state.loseNextLaunch = false;
            return { __fixtureDisconnect: true, acceptedJobId: id, idempotencyKey: body.idempotencyKey };
        }
        return { receipt: r, replay: false };
    }
    if (method === 'POST' && /^\/api\/controls\/jobs\/[a-f0-9-]{36}\/cancel$/.test(p)) {
        const id = p.split('/')[4], old = state.jobs.get(id);
        assert(old && body && Object.keys(body).sort().join('|') === 'expectedRevision|idempotencyKey' && body.expectedRevision === old.revision, 'UI_FIXTURE_CANCEL_INVALID');
        const next = { ...old, revision: old.revision + 1, state: 'cancelling', phase: 'cleanup', cancelRequested: true };
        state.jobs.set(id, next);
        return { receipt: next, replay: false };
    }
    if ((method === 'POST' && p === '/api/rules') || (method === 'DELETE' && p === '/api/rules/fixture-rule'))
        return { __fixtureStatus: 503, error: 'FIXTURE_RULES_UNAVAILABLE' };
    state.unexpected.push({ method, path: p });
    return { __fixtureStatus: 403, error: 'UI_FIXTURE_REQUEST_DENIED' };
}
const mime = name => ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon' }[path.extname(name)] ?? 'application/octet-stream');
function deferred() { let resolve; return { promise: new Promise(r => { resolve = r; }), release: () => resolve() }; }
export async function createUiRegressionFixtureSessionV1({ buildDir, tempRoot, control, schemas }) {
    const measured = measureUiBuildV1(buildDir), store = createUiArtifactStoreV1(tempRoot), state = createFixtureState();
    const sockets = new Set();
    let closed = false, running = false, closePromise;
    const server = createServer(async (req, res) => {
        try {
            if (req.headers.host !== '127.0.0.1:13082' || req.socket.localAddress !== '127.0.0.1' || !['127.0.0.1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) {
                state.unexpected.push({ method: req.method, path: 'invalid-socket' });
                res.writeHead(403).end();
                return;
            }
            const url = new URL(req.url, ORIGIN);
            if (url.origin !== ORIGIN)
                throw Error('UI_FIXTURE_REQUEST_DENIED');
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'self'; worker-src 'none'; frame-src 'none'; object-src 'none'");
            if (url.pathname.startsWith('/api/')) {
                let bytes = 0, parts = [];
                for await (const part of req) {
                    bytes += part.length;
                    if (bytes > 16384)
                        throw Error('UI_FIXTURE_BODY_OVERFLOW');
                    parts.push(part);
                }
                const body = bytes ? JSON.parse(Buffer.concat(parts)) : null;
                const value = await fixtureResponse(state, req.method, url, body);
                const intentionalFault = value?.__fixtureDisconnect ? 'lost_response' : value?.__fixtureStatus === 503 && ((req.method === 'POST' && url.pathname === '/api/rules' && state.activeAssertion === 'rules.draft-503' && body?.title === 'Keep draft' && body?.content === 'Keep complete content') || (req.method === 'DELETE' && url.pathname === '/api/rules/fixture-rule' && state.activeAssertion === 'rules.delete-confirmation-503')) ? 'rules_503' : null;
                if (intentionalFault) {
                    const bodyHash = uiHashV1(Buffer.concat(parts));
                    const candidates = state.browserRequests.filter(event => event.assertionId === state.activeAssertion && event.method === req.method && event.url === url.href && event.bodyHash === bodyHash);
                    assert(candidates.length === 1, 'UI_FIXTURE_FAULT_REQUEST_UNKNOWN');
                    state.intentionalFaults.push({ ...candidates[0], kind: intentionalFault, ...(intentionalFault === 'lost_response' ? { acceptedJobId: value.acceptedJobId, idempotencyKey: value.idempotencyKey } : {}) });
                }
                if (value?.__fixtureDisconnect) {
                    res.destroy();
                    return;
                }
                const status = value?.__fixtureStatus ?? 200;
                const output = value && '__fixtureStatus' in value ? Object.fromEntries(Object.entries(value).filter(([k]) => k !== '__fixtureStatus')) : value;
                res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(output));
                return;
            }
            const name = 'dist' + url.pathname, asset = measured.entries.get(name) ?? ((ROUTES.includes(url.pathname) || url.pathname === '/perf') ? measured.entries.get('dist/index.html') : null);
            if (req.method !== 'GET' || !asset) {
                state.unexpected.push({ method: req.method, path: url.pathname });
                res.writeHead(403).end();
                return;
            }
            asset.check();
            res.writeHead(200, { 'Content-Type': mime(measured.entries.has(name) ? name : 'index.html') }).end(asset.bytes);
        }
        catch {
            state.unexpected.push({ method: req.method, path: 'request-invalid' });
            if (!res.destroyed)
                res.writeHead(403).end();
        }
    });
    server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
    server.on('upgrade', (req, socket) => { state.unexpected.push({ method: 'WS', path: req.url }); socket.destroy(); });
    await new Promise((resolve, reject) => { server.once('error', error => reject(new Error(error.code === 'EADDRINUSE' ? 'UI_FIXTURE_PORT_OCCUPIED' : 'UI_FIXTURE_BIND_UNKNOWN'))); server.listen({ host: '127.0.0.1', port: 13082, exclusive: true }, resolve); });
    const address = server.address();
    assert(address?.address === '127.0.0.1' && address.port === 13082, 'UI_FIXTURE_BIND_UNKNOWN');
    const session = { unexpectedRequests: state.unexpected, identity: measured.identity, store,
        async run(browser) { assert(!running && !closed, 'UI_FIXTURE_SESSION_REUSED'); running = true; return runCatalog({ browser, state, store, measured, control, schemas }); },
        close() {
            if (closePromise)
                return closePromise;
            closed = true;
            const socketClosures = [...sockets].map(socket => new Promise(resolve => socket.once('close', resolve)));
            const serverClosure = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
            for (const socket of sockets)
                socket.destroy();
            closePromise = (async () => {
                let timeout;
                try {
                    await Promise.race([Promise.all([serverClosure, ...socketClosures]), new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('UI_FIXTURE_CLOSE_UNKNOWN')), 30000); })]);
                    assert(sockets.size === 0, 'UI_FIXTURE_CONNECTIONS_UNKNOWN');
                }
                finally {
                    clearTimeout(timeout);
                }
            })();
            return closePromise;
        },
    };
    return Object.freeze(session);
}
export async function runUiRegressionV1(input) {
    const session = await createUiRegressionFixtureSessionV1(input);
    try {
        return await session.run(input.browser);
    }
    finally {
        await session.close();
    }
}
async function installFences(context, state, measured, errors) {
    const requests = new WeakMap();
    context.on('request', request => {
        const observation = { assertionId: state.activeAssertion, requestIdentity: 'request-' + (state.browserRequests.length + 1), method: request.method(), url: request.url(), bodyHash: uiHashV1(request.postDataBuffer() ?? Buffer.alloc(0)) };
        requests.set(request, observation);
        state.browserRequests.push(observation);
    });
    context.on('requestfailed', request => state.requestFailures.push({ ...requests.get(request), kind: 'requestfailed', errorText: request.failure()?.errorText }));
    context.on('response', response => {
        if (response.status() >= 400)
            state.requestFailures.push({ ...requests.get(response.request()), kind: 'response', status: response.status() });
    });
    await context.route('**/*', async (route) => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin !== ORIGIN || !['http:'].includes(url.protocol) || (!url.pathname.startsWith('/api/') && !measured.entries.has('dist' + url.pathname) && !ROUTES.includes(url.pathname) && url.pathname !== '/perf')) {
            state.unexpected.push({ method: request.method(), path: 'denied-origin-or-route' });
            await route.abort('blockedbyclient');
        }
        else
            await route.continue();
    });
    await context.routeWebSocket('**/*', socket => {
        if (socket.url() !== 'ws://127.0.0.1:13082/ws') {
            state.unexpected.push({ method: 'WS', path: 'denied-websocket' });
            socket.close();
            return;
        }
        socket.onMessage(() => { state.unexpected.push({ method: 'WS', path: 'unexpected-message' }); socket.close(); });
    });
    context.on('serviceworker', () => state.unexpected.push({ method: 'WORKER', path: 'service-worker' }));
    await context.addInitScript(() => {
        if (navigator.serviceWorker) {
            const original = navigator.serviceWorker.register.bind(navigator.serviceWorker);
            navigator.serviceWorker.register = (...args) => { window.__uiUnexpectedServiceWorker = true; return Promise.reject(new Error('UI_SERVICE_WORKER_DENIED')); };
            void original;
        }
    });
}
async function runCatalog({ browser, state, store, measured, control, schemas }) {
    const report = { schema: 'mission-control.ui-regression.v1', mcSourceSha: measured.identity.sourceSha, mcBuildHash: measured.identity.buildHash, fixtureVersion: UI_REGRESSION_FIXTURE_V1.fixtureVersion, fixtureHash: UI_REGRESSION_FIXTURE_V1.fixtureHash, startedAt: new Date().toISOString(), finishedAt: null, outcome: 'incomplete', assertions: [], screenshots: [] };
    const diagnostics = [];
    let context, page, candidate, currentRoute = '/', viewport = VIEWPORTS[0], errors = [], stopped = false, integrity = 'verified';
    const cancellation = () => control?.cancellationRequested?.() ?? false;
    const retainCandidate = () => {
        try {
            const snapshot = { ...report, finishedAt: new Date().toISOString() };
            const parsed = schemas ? schemas.UiRegressionReportV1Schema.parse(snapshot) : structuredClone(snapshot);
            const reportHash = store.json(parsed);
            candidate = { report: parsed, reportHash };
        }
        catch (error) {
            integrity = 'failed';
            throw error;
        }
    };
    const capture = async (id, route = currentRoute) => {
        if (cancellation() || report.screenshots.some(s => s.captureId === id))
            return;
        const bytes = await page.screenshot({ fullPage: true, animations: 'disabled', timeout: 10000 });
        report.screenshots.push({ captureId: id, route, viewport: { ...viewport }, sha256: store.png(bytes) });
    };
    const check = async (id, action, captureId) => {
        if (stopped || cancellation()) {
            stopped = true;
            return false;
        }
        let failure;
        state.activeAssertion = id;
        try {
            await control?.onAssertionBoundary?.({ id, edge: 'before' });
            await action();
            if (captureId)
                await capture(captureId);
        }
        catch (error) {
            failure = error;
            if (captureId && !report.screenshots.some(s => s.captureId === captureId))
                try {
                    await capture(captureId);
                }
                catch { }
        }
        finally {
            try {
                await control?.onAssertionBoundary?.({ id, edge: 'after' });
            }
            catch (error) {
                failure ??= error;
            }
        }
        state.activeAssertion = null;
        report.assertions.push({ id, status: failure ? 'fail' : 'pass', code: failure ? 'UI_ASSERTION_FAILED' : null });
        if (failure) {
            diagnostics.push(store.json({ schema: 'mission-control.ui-assertion-diagnostic.v1', assertionId: id, message: String(failure?.message ?? failure).slice(0, 4096), console: errors.slice(-50), requests: state.unexpected.slice(-50), requestFailures: state.requestFailures.slice(-50), intentionalFaults: state.intentionalFaults.slice(-5) }));
            report.outcome = 'fail';
            stopped = true;
        }
        else
            try {
                await control?.onProgress?.({ completedAssertions: report.assertions.length, plannedAssertions: ASSERTIONS.length });
            }
            catch {
                report.assertions.at(-1).status = 'fail';
                report.assertions.at(-1).code = 'UI_PROGRESS_FAILED';
                report.outcome = 'fail';
                stopped = true;
            }
        return !stopped;
    };
    const open = async (width) => {
        if (context) {
            retainCandidate();
            await closeFixtureContext(context);
        }
        viewport = { width, height: 900 };
        errors = [];
        state.browserRequests = [];
        state.requestFailures = [];
        state.intentionalFaults = [];
        context = await browser.newContext({ viewport, serviceWorkers: 'block', acceptDownloads: false });
        await installFences(context, state, measured, errors);
        page = await context.newPage();
        page.setDefaultTimeout(8000);
        page.on('pageerror', error => errors.push({ kind: 'pageerror', message: String(error) }));
        page.on('console', message => {
            if (message.type() === 'error')
                errors.push({ kind: 'console', text: message.text(), url: message.location().url, assertionId: state.activeAssertion });
        });
    };
    const noErrors = async () => {
        assert(!await page.evaluate(() => window.__uiUnexpectedServiceWorker), 'UI_SERVICE_WORKER_DENIED');
        assert(!state.unexpected.length, 'UI_BROWSER_ERRORS');
        const expected = reconcileUiFixtureDiagnosticsV1({ assertionId: state.activeAssertion, errors, requestFailures: state.requestFailures, faults: state.intentionalFaults });
        for (const diagnostic of expected)
            diagnostics.push(store.json({ schema: 'mission-control.ui-intentional-fault-diagnostic.v1', ...diagnostic }));
        errors.length = 0;
        state.requestFailures.length = 0;
        state.intentionalFaults.length = 0;
    };
    const loaded = async (route) => { await page.goto(ORIGIN + route, { waitUntil: 'networkidle', timeout: 15000 }); await page.locator('#root').waitFor({ state: 'visible' }); await page.locator('.page-loading').waitFor({ state: 'hidden' }); assert(new URL(page.url()).pathname === route, 'UI_UNEXPECTED_REDIRECT'); assert((await page.locator('body').innerText()).trim().length > 50, 'UI_EMPTY_PAGE'); };
    try {
        for (const v of VIEWPORTS) {
            if (stopped || cancellation())
                break;
            await open(v.width);
            for (const route of ROUTES) {
                if (stopped || cancellation())
                    break;
                currentRoute = route;
                const prefix = `page.${routeId(route)}.${v.width}`;
                await check(prefix + '.loaded', () => loaded(route), `${routeId(route)}-${v.width}`);
                await check(prefix + '.overflow', async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'UI_HORIZONTAL_OVERFLOW'));
                await check(prefix + '.fonts', async () => assert(await page.evaluate(() => Array.from(document.querySelectorAll('p,button,input,select,textarea,li,td,dd,label')).filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }).every(e => parseFloat(getComputedStyle(e).fontSize) >= 12)), 'UI_UNREADABLE_FONT'));
                await check(prefix + '.console-network', async () => { await noErrors(); assert(!await page.evaluate(() => window.__uiUnexpectedServiceWorker), 'UI_SERVICE_WORKER_DENIED'); });
            }
        }
        for (const v of VIEWPORTS) {
            if (stopped || cancellation())
                break;
            await open(v.width);
            for (const id of [LEGACY, V3]) {
                currentRoute = `/setfarm/runs/${id}`;
                if (!stopped)
                    await loaded(currentRoute);
                for (const tab of TABS)
                    await check(`run.${id}.${v.width}.${tab.toLowerCase().replaceAll(' ', '-')}`, async () => { await page.locator('.rd-tab').filter({ hasText: new RegExp('^' + tab + '(?:\\d+)?$') }).click(); assert((await page.locator('.rd-tab--active').innerText()).startsWith(tab), 'UI_RUN_TAB_NOT_ACTIVE'); await noErrors(); }, `run-${id}-${v.width}-${tab.toLowerCase().replaceAll(' ', '-')}`);
            }
        }
        if (!stopped && !cancellation()) {
            await open(1440);
            for (const id of BEHAVIORS) {
                currentRoute = '/';
                await check(id, async () => { await behavior(id, { page, context, state, loaded, open, getPage: () => page, capture: () => capture('behavior-' + id, new URL(page.url()).pathname) }); await noErrors(); await capture('behavior-' + id, new URL(page.url()).pathname); });
            }
        }
        if (!stopped && !cancellation()) {
            assert(report.assertions.length === ASSERTIONS.length, 'UI_CATALOG_INCOMPLETE');
            report.outcome = 'pass';
        }
    }
    catch {
        if (report.outcome !== 'fail')
            report.outcome = 'incomplete';
    }
    finally {
        if (cancellation())
            report.outcome = 'incomplete';
        let publicationError, closeFailed = false;
        // Preserve the actual accumulated assertion/PNG manifest before late pins or cleanup.
        try {
            retainCandidate();
        }
        catch (error) {
            integrity = 'failed';
            publicationError = error;
        }
        try {
            measured.check();
        }
        catch {
            integrity = 'failed';
        }
        if (context)
            try {
                await closeFixtureContext(context);
            }
            catch {
                closeFailed = true;
            }
        try {
            measured.check();
        }
        catch {
            integrity = 'failed';
        }
        if (integrity === 'failed' || closeFailed || cancellation()) {
            report.outcome = 'incomplete';
            if (integrity === 'failed' || closeFailed)
                try {
                    diagnostics.push(store.json({ schema: 'mission-control.ui-finalization-diagnostic.v1', code: integrity === 'failed' ? 'UI_REPORT_INTEGRITY_FAILED' : 'UI_CONTEXT_CLOSE_UNKNOWN', candidateReportHash: candidate?.reportHash ?? null }));
                }
                catch {
                    integrity = 'failed';
                }
            try {
                retainCandidate();
            }
            catch (error) {
                integrity = 'failed';
                publicationError = error;
            }
        }
        if (!candidate)
            throw publicationError ?? Error('UI_CANDIDATE_UNAVAILABLE');
    }
    return { ...candidate, integrity, diagnosticHashes: diagnostics };
}
async function navigate(page, href) {
    await page.getByRole('button', { name: 'Search & favorites', exact: true }).click();
    const search = page.getByRole('searchbox', { name: 'Search navigation' });
    await search.fill(href === '/' ? 'Overview' : href);
    await page.locator(`.tab-nav__panel a[href="${href}"]`).first().click();
    await page.waitForURL(url => url.pathname === href);
}
async function controlReady(page) { await page.getByRole('heading', { name: 'Controls', exact: true }).waitFor(); await page.getByRole('button', { name: 'Refresh evidence', exact: true }).waitFor({ state: 'visible' }); await page.waitForFunction(() => !document.querySelector('button')?.textContent?.includes('Loading selected')); }
async function confirmLaunch(page) { await page.getByLabel('I confirm this check, the selected installation, and the visible budget.').check(); await page.getByRole('button', { name: /^(Start manual check|Retry same request)$/ }).click(); }
async function until(predicate, code) {
    const deadline = Date.now() + 8000;
    while (!predicate()) {
        if (Date.now() >= deadline)
            throw Error(code);
        await delay(10);
    }
}
async function behavior(id, { page, context, state, loaded, capture }) {
    if (id === 'office.persist') {
        await loaded('/office');
        const canvas = page.locator('.pixel-office__canvas');
        await canvas.waitFor({ state: 'visible' });
        await canvas.evaluate(el => { el.dataset.fixtureRetained = 'same-canvas'; });
        await navigate(page, '/agents');
        await navigate(page, '/office');
        assert(await canvas.getAttribute('data-fixture-retained') === 'same-canvas');
        assert(new URL(page.url()).pathname === '/office');
        return;
    }
    if (id === 'navigation.perf-redirect') {
        await page.goto(ORIGIN + '/perf');
        await page.waitForURL(ORIGIN + '/performance');
        return;
    }
    if (id === 'navigation.d-p') {
        await loaded('/');
        await page.locator('body').click({ position: { x: 5, y: 5 } });
        await page.keyboard.press('d');
        await page.waitForURL(ORIGIN + '/setfarm/active');
        await page.keyboard.press('p');
        await page.waitForURL(ORIGIN + '/prd');
        return;
    }
    if (id.startsWith('navigation.') && id.endsWith('-guard')) {
        await loaded('/scrape');
        const kind = id.split('.')[1];
        if (kind === 'input-guard') {
            const input = page.getByLabel('URL to scrape');
            await input.fill('');
            await input.press('d');
            await input.press('p');
            assert(await input.inputValue() === 'dp');
        }
        if (kind === 'textarea-guard') {
            await loaded('/prd');
            const textarea = page.getByPlaceholder('Project description, requests, details...');
            await textarea.fill('');
            await textarea.press('d');
            await textarea.press('p');
            assert(await textarea.inputValue() === 'dp');
            assert(new URL(page.url()).pathname === '/prd');
            return;
        }
        if (kind === 'select-guard') {
            await page.getByLabel('Scrape adaptor').focus();
            await page.keyboard.press('d');
            await page.keyboard.press('p');
        }
        if (kind === 'contenteditable-guard') {
            // Insert an ordinary editable control to exercise the mounted global keyboard handler.
            await page.evaluate(() => { const el = document.createElement('div'); el.contentEditable = 'true'; el.id = 'fixture-editable'; el.textContent = 'editable'; document.body.append(el); el.focus(); });
            await page.keyboard.press('d');
            await page.keyboard.press('p');
            await page.locator('#fixture-editable').evaluate(el => el.remove());
        }
        if (kind === 'ime-guard')
            await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', isComposing: true, bubbles: true })));
        if (kind === 'modifier-guard')
            for (const modifiers of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }])
                await page.evaluate(mod => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true, ...mod })), modifiers);
        assert(new URL(page.url()).pathname === '/scrape');
        return;
    }
    if (id === 'navigation.search-favorite') {
        await loaded('/');
        await page.getByRole('button', { name: 'Search & favorites', exact: true }).click();
        await page.getByRole('searchbox', { name: 'Search navigation' }).fill('Controls');
        await page.getByRole('button', { name: 'Add Controls to favorites', exact: true }).click();
        await page.getByRole('searchbox', { name: 'Search navigation' }).fill('');
        assert(await page.getByRole('region', { name: 'Favorites', exact: true }).locator('a[href="/controls"]').count() === 1);
        await page.reload();
        await page.getByRole('button', { name: 'Search & favorites', exact: true }).click();
        assert(await page.getByRole('region', { name: 'Favorites', exact: true }).locator('a[href="/controls"]').count() === 1);
        await page.keyboard.press('Escape');
        return;
    }
    if (id === 'navigation.mobile-focus') {
        await page.setViewportSize({ width: 390, height: 900 });
        await loaded('/');
        const toggle = page.getByRole('button', { name: 'Toggle navigation', exact: true });
        await toggle.click();
        assert(await page.getByRole('searchbox', { name: 'Search navigation' }).evaluate(el => document.activeElement === el));
        await page.keyboard.press('Escape');
        assert(await toggle.evaluate(el => document.activeElement === el));
        await page.setViewportSize({ width: 1440, height: 900 });
        return;
    }
    if (id === 'agents.grid-panel') {
        await loaded('/agents');
        assert(await page.locator('.agent-card-wrap').count() === 14);
        await page.getByTitle('Live view', { exact: true }).first().click();
        await page.locator('.live-panel').waitFor({ state: 'visible' });
        assert((await page.locator('.live-panel').innerText()).includes('idle'));
        await capture();
        await page.keyboard.press('Escape');
        await page.locator('.live-panel').waitFor({ state: 'hidden' });
        return;
    }
    if (id === 'prd.clone-a101') {
        await loaded('/scrape');
        await page.getByRole('button', { name: 'Clone This', exact: true }).click();
        await page.waitForURL(url => url.pathname === '/prd' && url.searchParams.get('title') === 'A101');
        assert(await page.getByPlaceholder('Project description, requests, details...').inputValue() === 'A101 shopping application');
        await page.getByRole('button', { name: 'History', exact: true }).click();
        await page.locator('.prd-history-item').first().waitFor();
        await capture();
        await page.locator('.prd-modal__close').click();
        assert(await page.getByPlaceholder('Project description, requests, details...').inputValue() === 'A101 shopping application');
        return;
    }
    if (id === 'prd.stale-history-preserves-draft') {
        await loaded('/prd');
        await page.getByPlaceholder('Project description, requests, details...').fill('Retained unsaved draft');
        await navigate(page, '/scrape');
        await navigate(page, '/prd');
        assert(await page.getByPlaceholder('Project description, requests, details...').inputValue() === 'Retained unsaved draft');
        return;
    }
    if (id.startsWith('prd.') && id.endsWith('history-race') || id === 'prd.delayed-history-edit') {
        await page.goto(ORIGIN + '/');
        await page.evaluate(() => sessionStorage.clear());
        state.holdHistory = deferred();
        const requested = state.requests.filter(r => r.path === '/api/prd/history').length;
        await page.goto(ORIGIN + '/prd', { waitUntil: 'domcontentloaded' });
        await until(() => state.requests.filter(r => r.path === '/api/prd/history').length > requested, 'UI_HISTORY_NOT_REQUESTED');
        if (id === 'prd.delayed-history-edit')
            await page.getByPlaceholder('Project description, requests, details...').fill('Unsaved current draft');
        if (id === 'prd.new-history-race')
            await page.getByRole('button', { name: 'New', exact: true }).click();
        if (id === 'prd.navigation-history-race') {
            await navigate(page, '/scrape');
            await page.getByRole('button', { name: 'Clone This', exact: true }).click();
        }
        state.holdHistory.release();
        state.holdHistory = null;
        await delay(150);
        assert(await page.getByPlaceholder('Project description, requests, details...').inputValue() === (id === 'prd.delayed-history-edit' ? 'Unsaved current draft' : id === 'prd.new-history-race' ? '' : 'A101 shopping application'));
        return;
    }
    if (id === 'rules.draft-503') {
        await loaded('/rules');
        await page.getByRole('button', { name: '+ NEW RULE', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'New Rule' });
        await dialog.getByPlaceholder('Rule title...').fill('Keep draft');
        await dialog.getByPlaceholder('Rule content...').fill('Keep complete content');
        await dialog.getByRole('button', { name: 'SAVE', exact: true }).click();
        await dialog.getByRole('alert').waitFor();
        assert(await dialog.getByPlaceholder('Rule title...').inputValue() === 'Keep draft');
        assert(await dialog.getByPlaceholder('Rule content...').inputValue() === 'Keep complete content');
        await capture();
        await dialog.getByRole('button', { name: 'CANCEL', exact: true }).click();
        return;
    }
    if (id === 'rules.delete-confirmation-503') {
        await loaded('/rules');
        await page.getByRole('button', { name: 'DEL', exact: true }).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.textContent?.includes('FIXTURE_RULES_UNAVAILABLE'));
        assert(await dialog.isVisible());
        assert((await page.locator('body').innerText()).includes('Fixture rule'));
        await capture();
        await page.locator('.modal-backdrop').click({ position: { x: 2, y: 2 } });
        return;
    }
    if (id === 'metrics.zero-unknown') {
        await loaded('/ops');
        const text = await page.locator('.system-metrics').innerText();
        assert(text.includes('0GB / 16GB') && text.includes('Unknown') && text.includes('0.00'));
        await loaded('/costs');
        assert((await page.locator('body').innerText()).includes('$0'));
        await loaded('/performance');
        assert((await page.locator('body').innerText()).includes('Unknown'));
        return;
    }
    if (id.startsWith('controls.')) {
        if (id === 'controls.distinct-check-groups') {
            state.evidence = evidence();
            await loaded('/controls');
            const activation = page.locator('main.controls > .controls__top').getByRole('region', { name: 'Activation health', exact: true });
            const evaluation = page.locator('main.controls > .controls__evidence').getByRole('region', { name: 'Evaluation evidence', exact: true });
            const healthRows = activation.locator('ul.controls__rows > li');
            const preflightRows = evaluation.locator('ul.controls__rows > li');
            const caseRows = evaluation.locator('ol.controls__rows > li');
            assert(await healthRows.count() === 6 && await preflightRows.count() === 8 && await caseRows.count() === 8, 'UI_CONTROLS_CHECK_GROUP_COUNTS');
            const title = value => value.replaceAll('_', ' ').replace(/\b\w/g, x => x.toUpperCase());
            assert(uiCanonicalV1(await healthRows.locator('strong').allTextContents()) === uiCanonicalV1(ACTIVATION_CHECKS.map(row => title(row.id))), 'UI_CONTROLS_ACTIVATION_IDS');
            assert(uiCanonicalV1(await preflightRows.locator('strong').allTextContents()) === uiCanonicalV1(CONVERGENCE_PREFLIGHT_CHECKS.map(row => title(row.id))), 'UI_CONTROLS_PREFLIGHT_IDS');
            assert(uiCanonicalV1(await healthRows.locator('code').allTextContents()) === uiCanonicalV1(ACTIVATION_CHECKS.map(row => row.code)), 'UI_CONTROLS_ACTIVATION_CODES');
            assert(uiCanonicalV1(await preflightRows.locator('code').allTextContents()) === uiCanonicalV1(CONVERGENCE_PREFLIGHT_CHECKS.map(row => row.code)), 'UI_CONTROLS_PREFLIGHT_CODES');
            assert((await healthRows.locator('span').allTextContents()).every(status => status === 'Pass') && (await preflightRows.locator('span').allTextContents()).every(status => status === 'Pass'), 'UI_CONTROLS_CHECK_STATUSES');
            assert(uiCanonicalV1(await caseRows.locator('strong').allTextContents()) === uiCanonicalV1(state.evidence.evidence.evaluation.report.cases.map(row => title(row.caseId))), 'UI_CONTROLS_CASE_IDS');
            assert((await caseRows.locator('span').allTextContents()).every(status => status === 'Not started'), 'UI_CONTROLS_PLANNED_CASES');
            assert((await activation.innerText()).includes('Current report') && (await evaluation.innerText()).includes('0 of 8 cases recorded'), 'UI_CONTROLS_CURRENT_PROJECTION');
            assert(await page.evaluate(() => {
                const selectors = ['main.controls > .controls__top [aria-label="Activation health"] ul.controls__rows > li', 'main.controls > .controls__evidence [aria-label="Evaluation evidence"] ul.controls__rows > li', 'main.controls > .controls__evidence [aria-label="Evaluation evidence"] ol.controls__rows > li'];
                const groups = selectors.map(selector => Array.from(document.querySelectorAll(selector)));
                return groups[0].length === 6 && groups[1].length === 8 && groups[2].length === 8 && new Set(groups.flat()).size === 22;
            }), 'UI_CONTROLS_CHECK_GROUPS_OVERLAP');
            return;
        }
        if (id === 'controls.provenance') {
            state.evidence = evidence();
            await loaded('/controls');
            assert(await page.locator('[data-testid="control-case-row"]').count() === 16);
            assert((await page.locator('body').innerText()).includes('Planned'));
            await page.getByText(/Historical source/).click();
            assert((await page.getByRole('region', { name: 'Historical evidence' }).innerText()).includes('2'.repeat(40)));
            state.evidence = evidence('unqualified');
            await page.getByRole('button', { name: 'Refresh evidence', exact: true }).click();
            await page.getByText('CONTROL_RELEASE_ADMISSION_UNOBSERVED', { exact: true }).waitFor();
            assert(await page.getByText('Qualified release', { exact: true }).count() === 0);
            return;
        }
        if (id === 'controls.kind-confirmation') {
            await loaded('/controls');
            const confirm = page.getByLabel('I confirm this check, the selected installation, and the visible budget.');
            await confirm.check();
            await page.getByLabel('Check', { exact: true }).selectOption('ui_regression');
            assert(!await confirm.isChecked());
            assert(await page.getByRole('button', { name: 'Start manual check', exact: true }).isDisabled());
            return;
        }
        if (id === 'controls.hash-confirmation') {
            await loaded('/controls');
            const confirm = page.getByLabel('I confirm this check, the selected installation, and the visible budget.');
            await confirm.check();
            state.evidence = { ...state.evidence, selectionHash: '9'.repeat(64) };
            await page.getByRole('button', { name: 'Refresh evidence', exact: true }).click();
            await page.getByText('9'.repeat(64), { exact: true }).first().waitFor();
            assert(!await confirm.isChecked());
            state.evidence = evidence('unqualified');
            return;
        }
        if (id === 'controls.lost-response-reload-idempotency') {
            state.jobs.clear();
            state.launches.clear();
            state.launchBodies.length = 0;
            await loaded('/');
            await page.evaluate(() => localStorage.clear());
            await loaded('/controls');
            await page.getByLabel('Check', { exact: true }).selectOption('ui_regression');
            state.loseNextLaunch = true;
            await confirmLaunch(page);
            await page.getByRole('alert').waitFor();
            assert(state.jobs.size === 1);
            const first = state.launchBodies[0];
            await page.reload();
            await controlReady(page);
            await confirmLaunch(page);
            await page.getByText('Existing request reconnected.', { exact: true }).waitFor();
            assert(state.jobs.size === 1 && state.launchBodies.length === 2 && uiCanonicalV1(first) === uiCanonicalV1(state.launchBodies[1]));
            assert((await page.getByRole('region', { name: 'Owned progress' }).innerText()).includes(JOB_A));
            return;
        }
        if (id === 'controls.cancel-owned-settlement') {
            await page.getByRole('button', { name: 'Request cancellation', exact: true }).click();
            await page.getByText('Cancellation requested; awaiting terminal evidence.', { exact: true }).waitFor();
            assert(state.jobs.get(JOB_A).state === 'cancelling');
            assert((await page.getByRole('region', { name: 'Owned progress' }).innerText()).includes('Cancelling'));
            await page.reload();
            await page.getByText(/Cancellation requested · Cancelling/).waitFor();
            const old = state.jobs.get(JOB_A);
            state.jobs.set(JOB_A, { ...old, state: 'cancelled', phase: 'terminal', revision: old.revision + 1, finishedAt: AT });
            await page.getByRole('button', { name: 'Refresh evidence', exact: true }).click();
            await page.getByText('Cancelled · Terminal', { exact: true }).waitFor();
            return;
        }
        if (id === 'controls.crossmount-delayed-a-new-b') {
            state.jobs.clear();
            state.launches.clear();
            state.launchBodies.length = 0;
            await loaded('/');
            await page.evaluate(() => localStorage.clear());
            await loaded('/controls');
            state.holdLaunch = deferred();
            const holdA = state.holdLaunch;
            await page.getByLabel('Check', { exact: true }).selectOption('ui_regression');
            await confirmLaunch(page);
            await until(() => state.jobs.size === 1, 'UI_LAUNCH_A_NOT_ACCEPTED');
            await navigate(page, '/agents');
            await navigate(page, '/controls');
            await page.getByRole('button', { name: 'Prepare a new check', exact: true }).click();
            state.holdLaunch = null;
            await confirmLaunch(page);
            await until(() => state.jobs.size === 2, 'UI_LAUNCH_B_NOT_ACCEPTED');
            await page.getByRole('region', { name: 'Owned progress' }).getByText(JOB_B, { exact: true }).waitFor();
            holdA.release();
            await delay(150);
            assert((await page.getByRole('region', { name: 'Owned progress' }).innerText()).includes(JOB_B));
            await page.reload();
            await page.getByRole('region', { name: 'Owned progress' }).getByText(JOB_B, { exact: true }).waitFor();
            assert(state.jobs.size === 2);
            assert(await page.evaluate(() => localStorage.getItem('mission-control.controls.selected-job.v1')) === JOB_B);
            return;
        }
        if (id === 'controls.unknown-retention') {
            const old = state.jobs.get(JOB_B);
            assert(old);
            state.jobs.set(JOB_B, { ...old, revision: old.revision + 1, state: 'ownership_unknown', phase: 'ownership_unknown', code: 'CONTROL_CUSTODY_UNCERTAIN' });
            await page.getByRole('button', { name: 'Refresh evidence', exact: true }).click();
            await page.getByText('CONTROL_CUSTODY_UNCERTAIN', { exact: true }).waitFor();
            await page.reload();
            await page.getByText('CONTROL_CUSTODY_UNCERTAIN', { exact: true }).waitFor();
            assert((await page.getByRole('region', { name: 'Owned progress' }).innerText()).includes(JOB_B));
            return;
        }
    }
    throw Error('UI_ASSERTION_NOT_IMPLEMENTED');
}
