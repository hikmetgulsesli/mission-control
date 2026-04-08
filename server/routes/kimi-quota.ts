/**
 * /api/kimi-quota — REST surface for the Kimi Code billing snapshot.
 *
 * Routes:
 *   GET  /api/kimi-quota          — return cached snapshot (refresh if expired)
 *   POST /api/kimi-quota/refresh  — invalidate cache + force fetch
 *
 * The actual fetch + cache logic lives in services/kimi-quota.ts. This file
 * just wraps it in Express handlers and adds the standard error
 * classification used elsewhere in the MC server.
 *
 * Wave 7 (plan: reactive-frolicking-cupcake.md) — closes the observability
 * gap that masked Kimi quota exhaustion as gateway stalls in runs #338-#340.
 */

import { Router } from 'express';
import {
  getKimiQuota,
  invalidateKimiQuotaCache,
  classifyKimiQuota,
  type KimiQuotaSnapshot,
} from '../services/kimi-quota.js';

const router = Router();

interface KimiQuotaResponse {
  snapshot: KimiQuotaSnapshot;
  severity: ReturnType<typeof classifyKimiQuota>['severity'];
  reason: string;
}

function buildResponse(snapshot: KimiQuotaSnapshot): KimiQuotaResponse {
  const { severity, reason } = classifyKimiQuota(snapshot);
  return { snapshot, severity, reason };
}

router.get('/kimi-quota', async (_req, res) => {
  try {
    const snapshot = await getKimiQuota(false);
    res.json(buildResponse(snapshot));
  } catch (err: any) {
    console.error('[kimi-quota] GET failed:', err?.message || err);
    res.status(500).json({
      error: 'kimi_quota_handler_failed',
      detail: String(err?.message || err).slice(0, 300),
    });
  }
});

router.post('/kimi-quota/refresh', async (_req, res) => {
  try {
    invalidateKimiQuotaCache();
    const snapshot = await getKimiQuota(true);
    res.json(buildResponse(snapshot));
  } catch (err: any) {
    console.error('[kimi-quota] POST refresh failed:', err?.message || err);
    res.status(500).json({
      error: 'kimi_quota_refresh_failed',
      detail: String(err?.message || err).slice(0, 300),
    });
  }
});

export default router;
