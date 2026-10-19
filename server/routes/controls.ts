import express from 'express';
import { unavailableControlEvidenceEnvelopeV1 } from '../services/control-evidence.js';
import type { ControlJobsV1, ControlJobKindV1 } from '../services/control-jobs.js';
import { validateControlsLocalMutationV1 } from '../services/controls-local-request.js';
const publicCodes = new Set(['CONTROL_REQUEST_INVALID', 'CONTROL_SELECTION_STALE', 'CONTROL_IDEMPOTENCY_CONFLICT', 'CONTROL_BUSY', 'CONTROL_OWNERSHIP_UNKNOWN', 'CONTROL_REVISION_CONFLICT', 'CONTROL_JOB_NOT_FOUND', 'CONTROL_JOB_FINISHED', 'CONTROL_SCREENSHOT_NOT_FOUND', 'CONTROL_UI_UNAVAILABLE']);
/** Mount under the existing /api auth + source-integrity middleware. */
export function createControlsRouterV1(input: {
    jobs: () => ControlJobsV1 | null;
    actualAddress: () => {
        address: string;
        family: string;
        port: number;
    } | null;
}) {
    const router = express.Router();
    router.use('/controls', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
    const error = (res: express.Response, e: unknown) => {
        const candidate = e instanceof Error ? e.message : '';
        const code = publicCodes.has(candidate) ? candidate : 'CONTROL_UNAVAILABLE';
        const status = code.endsWith('NOT_FOUND') ? 404 : code === 'CONTROL_REQUEST_INVALID' ? 400 : ['CONTROL_SELECTION_STALE', 'CONTROL_IDEMPOTENCY_CONFLICT', 'CONTROL_BUSY', 'CONTROL_REVISION_CONFLICT', 'CONTROL_JOB_FINISHED'].includes(code) ? 409 : 503;
        res.status(status).json({ error: code });
    };
    const broker = () => { const jobs = input.jobs(); if (!jobs)
        throw new Error('CONTROL_UNAVAILABLE'); return jobs; };
    const mutation: express.RequestHandler = (req, res, next) => {
        const offset = req.originalUrl.indexOf('?');
        const length = req.headers['content-length'];
        if (!validateControlsLocalMutationV1({ actualAddress: input.actualAddress(), peerAddress: req.socket.remoteAddress, localAddress: req.socket.localAddress, rawHeaders: req.rawHeaders, method: req.method,
            secFetchSite: typeof req.headers['sec-fetch-site'] === 'string' ? req.headers['sec-fetch-site'] : undefined, query: offset < 0 ? '' : req.originalUrl.slice(offset), contentLength: typeof length === 'string' && /^\d+$/.test(length) ? Number(length) : null })) {
            res.status(403).json({ error: 'CONTROL_LOCAL_REQUEST_REQUIRED' });
            return;
        }
        next();
    };
    const json = express.json({ limit: 2048, strict: true, type: 'application/json' });
    function exact(body: unknown, keys: string[]) { return body !== null && typeof body === 'object' && !Array.isArray(body) && Object.keys(body).sort().join('|') === keys.sort().join('|'); }
    router.get('/controls/evidence', async (req, res) => { try {
        if (Object.keys(req.query).length)
            throw new Error('CONTROL_REQUEST_INVALID');
        const jobs = input.jobs();
        res.json(jobs ? await jobs.evidence() : unavailableControlEvidenceEnvelopeV1());
    }
    catch (e) {
        error(res, e);
    } });
    router.get('/controls/jobs', async (req, res) => { try {
        if (Object.keys(req.query).some(k => k !== 'limit'))
            throw new Error('CONTROL_REQUEST_INVALID');
        const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50)
            throw new Error('CONTROL_REQUEST_INVALID');
        res.json({ jobs: await broker().list(limit) });
    }
    catch (e) {
        error(res, e);
    } });
    router.get('/controls/jobs/:jobId', async (req, res) => { try {
        if (Object.keys(req.query).length)
            throw new Error('CONTROL_REQUEST_INVALID');
        const receipt = await broker().get(String(req.params.jobId));
        if (!receipt)
            throw new Error('CONTROL_JOB_NOT_FOUND');
        res.json({ receipt });
    }
    catch (e) {
        error(res, e);
    } });
    router.get('/controls/jobs/:jobId/evidence', async (req, res) => { try {
        if (Object.keys(req.query).length)
            throw new Error('CONTROL_REQUEST_INVALID');
        res.json(await broker().evidence(String(req.params.jobId)));
    }
    catch (e) {
        error(res, e);
    } });
    router.get('/controls/jobs/:jobId/screenshots/:captureId', async (req, res) => { try {
        if (Object.keys(req.query).length)
            throw new Error('CONTROL_REQUEST_INVALID');
        res.type('png').send(await broker().screenshot(String(req.params.jobId), String(req.params.captureId)));
    }
    catch (e) {
        error(res, e);
    } });
    router.post('/controls/jobs', mutation, json, async (req, res) => {
        try {
            if (!exact(req.body, ['kind', 'idempotencyKey', 'expectedSelectionHash']) || !['activation_preflight', 'convergence_full8', 'ui_regression'].includes(req.body.kind)
                || typeof req.body.idempotencyKey !== 'string' || typeof req.body.expectedSelectionHash !== 'string')
                throw new Error('CONTROL_REQUEST_INVALID');
            const result = await broker().create(req.body as {
                kind: ControlJobKindV1;
                idempotencyKey: string;
                expectedSelectionHash: string;
            });
            res.status(result.replay ? 200 : 202).json(result);
        }
        catch (e) {
            error(res, e);
        }
    });
    router.post('/controls/jobs/:jobId/cancel', mutation, json, async (req, res) => {
        try {
            if (!exact(req.body, ['idempotencyKey', 'expectedRevision']) || typeof req.body.idempotencyKey !== 'string' || !Number.isSafeInteger(req.body.expectedRevision))
                throw new Error('CONTROL_REQUEST_INVALID');
            const result = await broker().cancel(String(req.params.jobId), req.body);
            res.status(result.replay ? 200 : 202).json(result);
        }
        catch (e) {
            error(res, e);
        }
    });
    router.use('/controls', (_req, res) => { res.status(405).json({ error: 'CONTROL_METHOD_NOT_ALLOWED' }); });
    router.use('/controls', (_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(400).json({ error: 'CONTROL_REQUEST_INVALID' }); });
    return router;
}
