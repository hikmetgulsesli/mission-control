import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { createServer, request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createControlsRouterV1 } from './controls.js';
import { authMiddleware } from '../middleware/auth.js';
import { config } from '../config.js';
import type { ControlJobsV1 } from '../services/control-jobs.js';
const body = JSON.stringify({ kind: 'activation_preflight', idempotencyKey: 'launch-key-123456789012345', expectedSelectionHash: 'a'.repeat(64) });
test('real ephemeral route denies actual non3080 capability; injected contract snapshot isolates positive dispatch and global auth', async () => {
    let starts = 0, cancels = 0;
    const jobs = { async create() { starts++; return { receipt: { jobId: 'job' }, replay: false }; }, async cancel() { cancels++; return { receipt: {}, replay: false }; }, async list() { return []; }, async get() { return null; }, async evidence() { return {}; } } as unknown as ControlJobsV1;
    const app = express();
    app.use(authMiddleware);
    let contractSnapshot = false;
    const server = createServer(app);
    app.use(createControlsRouterV1({ jobs: () => jobs, actualAddress: () => { const a = server.address() as AddressInfo; return contractSnapshot ? { ...a, port: 3080 } : a; } }));
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as AddressInfo).port;
    const originalToken = config.authToken;
    async function call(options: {
        method?: string;
        url?: string;
        headers?: string[];
        body?: string;
    } = {}) {
        const payload = options.body ?? body;
        return new Promise<{
            status: number;
            body: string;
        }>((resolve, reject) => { const req = request({ host: '127.0.0.1', port, path: options.url ?? '/controls/jobs', method: options.method ?? 'POST', headers: options.headers ?? ['Host', '127.0.0.1:3080', 'Origin', 'http://127.0.0.1:3080', 'Content-Type', 'application/json', 'Content-Length', String(Buffer.byteLength(payload))] }, res => { let b = ''; res.on('data', c => b += c); res.on('end', () => resolve({ status: res.statusCode!, body: b })); }); req.on('error', reject); req.end(payload); });
    }
    try {
        config.authToken = '';
        assert.equal((await call()).status, 403);
        assert.equal(starts, 0);
        contractSnapshot = true;
        assert.equal((await call()).status, 202);
        assert.equal(starts, 1);
        starts = 0;
        for (const options of [{ url: '/controls/jobs?token=x' }, { method: 'OPTIONS' }, { method: 'GET' },
            { body: JSON.stringify({ ...JSON.parse(body), path: '/secret' }) }, { body: ' '.repeat(2049) },
            { headers: ['Host', '127.0.0.1:3080', 'Host', '127.0.0.1:3080', 'Origin', 'http://127.0.0.1:3080', 'Content-Type', 'application/json', 'Content-Length', String(body.length)] },
            { headers: ['Host', '127.0.0.1:3080', 'Origin', 'null', 'Content-Type', 'application/json', 'Content-Length', String(body.length)] },
            { headers: ['Host', '127.0.0.1:3080', 'Origin', 'http://127.0.0.1:3080', 'Content-Type', 'text/plain', 'Content-Length', String(body.length)] },
            { headers: ['Host', '127.0.0.1:3080', 'Origin', 'http://127.0.0.1:3080', 'Content-Type', 'application/json', 'Content-Length', String(body.length), 'X-Forwarded-Host', '127.0.0.1:3080'] },
        ]) {
            await call(options);
            assert.equal(starts, 0, JSON.stringify(options));
            assert.equal(cancels, 0);
        }
        config.authToken = 'fixture-auth-token';
        assert.equal((await call()).status, 401);
        const headers = ['Host', '127.0.0.1:3080', 'Origin', 'http://127.0.0.1:3080', 'Content-Type', 'application/json', 'Content-Length', String(body.length), 'X-MC-Token', 'wrong'];
        assert.equal((await call({ headers })).status, 401);
        headers[headers.length - 1] = 'fixture-auth-token';
        assert.equal((await call({ headers })).status, 202);
    }
    finally {
        config.authToken = originalToken;
        await new Promise<void>((r, j) => server.close(e => e ? j(e) : r()));
    }
});
