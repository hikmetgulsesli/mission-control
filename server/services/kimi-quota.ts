/**
 * Kimi Code Quota Service
 *
 * Fetches real-time quota state from the Kimi Code billing API:
 *   GET https://api.kimi.com/coding/v1/usages
 *   Authorization: Bearer <KIMI_API_KEY>
 *
 * The endpoint is undocumented but stable; it returns weekly + 5-hour rate
 * limit windows plus the parallel-request cap. We cache results for 2 minutes
 * (configurable via KIMI_QUOTA_TTL_MS env var) and persist the latest snapshot
 * to disk so a gateway/MC restart can serve last-known state immediately.
 *
 * Token discovery order:
 *   1. process.env.KIMI_API_KEY
 *   2. ~/.openclaw/agents/koda/agent/auth-profiles.json -> profiles["kimi-coding:manual"].token
 *   3. ~/.openclaw/agents/main/agent/auth-profiles.json -> same
 *
 * The fetch is best-effort; on network/auth/server errors we return the
 * cached snapshot if any, otherwise an `available: false` payload that the
 * UI surfaces as "Quota status unavailable".
 *
 * Wave 7 (plan: reactive-frolicking-cupcake.md) — closes the observability
 * gap that masked Kimi quota exhaustion as "OpenClaw gateway stall" during
 * runs #338-#340.
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

// ── Types ───────────────────────────────────────────────────────────

/**
 * Normalized quota snapshot. We hide the raw upstream shape so callers
 * (REST endpoint, banner, run guard) all consume the same structure.
 */
export interface KimiQuotaSnapshot {
  available: boolean;
  fetchedAt: string; // ISO timestamp of the last successful fetch
  staleSince?: string; // ISO timestamp; set when serving from cache after a failed refresh
  user?: {
    userId: string;
    region: string;
    membershipLevel: string;
  };
  weekly?: {
    limit: number;
    used: number;
    remaining: number;
    resetTime: string;
    resetInMs: number;
    pctUsed: number;
  };
  rateWindow?: {
    durationSeconds: number; // window length (e.g. 18000 for 5h)
    limit: number;
    remaining: number;
    used: number;
    resetTime: string;
    resetInMs: number;
    pctUsed: number;
  };
  parallel?: {
    limit: number;
  };
  error?: {
    code: string;
    detail: string;
  };
}

interface RawKimiUsageResponse {
  user?: {
    userId?: string;
    region?: string;
    membership?: { level?: string };
  };
  usage?: {
    limit?: string | number;
    used?: string | number;
    resetTime?: string;
  };
  limits?: Array<{
    window?: { duration?: number; timeUnit?: string };
    detail?: {
      limit?: string | number;
      used?: string | number;
      remaining?: string | number;
      resetTime?: string;
    };
  }>;
  parallel?: { limit?: string | number };
}

// ── Configuration ──────────────────────────────────────────────────

const KIMI_USAGES_URL = 'https://api.kimi.com/coding/v1/usages';
const SNAPSHOT_PATH = join(homedir(), '.openclaw', 'setfarm', 'kimi-quota-snapshot.json');
const DEFAULT_TTL_MS = 2 * 60 * 1000; // 2 minutes
const FETCH_TIMEOUT_MS = 5000;

const TTL_MS = (() => {
  const raw = process.env.KIMI_QUOTA_TTL_MS;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_MS;
})();

// ── In-memory cache ────────────────────────────────────────────────

let cached: { snapshot: KimiQuotaSnapshot; expiresAt: number } | null = null;
let inFlight: Promise<KimiQuotaSnapshot> | null = null;

// ── Token discovery ────────────────────────────────────────────────

let cachedToken: string | null | undefined; // undefined = not yet looked up

function readTokenFromAuthProfiles(agentId: string): string | null {
  const path = join(homedir(), '.openclaw', 'agents', agentId, 'agent', 'auth-profiles.json');
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw);
    const profile = parsed?.profiles?.['kimi-coding:manual'];
    const token = typeof profile?.token === 'string' ? profile.token.trim() : '';
    return token || null;
  } catch {
    return null;
  }
}

export function discoverKimiToken(): string | null {
  if (cachedToken !== undefined) return cachedToken;
  const fromEnv = (process.env.KIMI_API_KEY || '').trim();
  if (fromEnv) {
    cachedToken = fromEnv;
    return cachedToken;
  }
  for (const agent of ['koda', 'main', 'flux', 'cipher']) {
    const t = readTokenFromAuthProfiles(agent);
    if (t) {
      cachedToken = t;
      return cachedToken;
    }
  }
  cachedToken = null;
  return null;
}

// ── Snapshot persistence ───────────────────────────────────────────

function loadSnapshotFromDisk(): KimiQuotaSnapshot | null {
  if (!existsSync(SNAPSHOT_PATH)) return null;
  try {
    const raw = readFileSync(SNAPSHOT_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed && parsed.fetchedAt) {
      return parsed as KimiQuotaSnapshot;
    }
  } catch {
    // ignore
  }
  return null;
}

function saveSnapshotToDisk(snapshot: KimiQuotaSnapshot): void {
  try {
    mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true });
    writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), 'utf-8');
  } catch {
    // disk write is best-effort; in-memory cache still works
  }
}

// ── Normalization ──────────────────────────────────────────────────

function asInt(v: string | number | undefined): number {
  if (typeof v === 'number') return Math.trunc(v);
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function clampPct(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
}

function resetInMs(resetTime: string): number {
  try {
    const t = Date.parse(resetTime);
    if (Number.isFinite(t)) return Math.max(0, t - Date.now());
  } catch {
    // fall through
  }
  return 0;
}

function normalize(raw: RawKimiUsageResponse): KimiQuotaSnapshot {
  const fetchedAt = new Date().toISOString();
  const usage = raw.usage || {};
  const limit = asInt(usage.limit);
  const used = asInt(usage.used);
  const resetTime = usage.resetTime || '';

  const rateRaw = (raw.limits && raw.limits[0]) || undefined;
  const rateDetail = rateRaw?.detail || {};
  const rateLimit = asInt(rateDetail.limit);
  // The Kimi response uses `remaining` for the rate window (no `used` field).
  // Derive used from limit - remaining when remaining is present.
  const rateRemainingRaw = rateDetail.remaining;
  const rateRemaining = rateRemainingRaw !== undefined ? asInt(rateRemainingRaw) : rateLimit;
  const rateUsed = Math.max(0, rateLimit - rateRemaining);

  // window.duration is in minutes per the timeUnit field; convert to seconds
  // for a more conventional unit. Most responses report TIME_UNIT_MINUTE.
  const rawDuration = rateRaw?.window?.duration ?? 0;
  const rawUnit = rateRaw?.window?.timeUnit || '';
  let durationSeconds = 0;
  if (rawDuration > 0) {
    if (rawUnit === 'TIME_UNIT_HOUR') durationSeconds = rawDuration * 3600;
    else if (rawUnit === 'TIME_UNIT_MINUTE') durationSeconds = rawDuration * 60;
    else if (rawUnit === 'TIME_UNIT_SECOND') durationSeconds = rawDuration;
    else durationSeconds = rawDuration * 60; // unknown unit -> assume minutes
  }

  return {
    available: true,
    fetchedAt,
    user: raw.user
      ? {
          userId: raw.user.userId || '',
          region: raw.user.region || '',
          membershipLevel: raw.user.membership?.level || '',
        }
      : undefined,
    weekly:
      limit > 0
        ? {
            limit,
            used,
            remaining: Math.max(0, limit - used),
            resetTime,
            resetInMs: resetInMs(resetTime),
            pctUsed: clampPct(used, limit),
          }
        : undefined,
    rateWindow:
      rateLimit > 0
        ? {
            durationSeconds,
            limit: rateLimit,
            remaining: rateRemaining,
            used: rateUsed,
            resetTime: rateDetail.resetTime || '',
            resetInMs: resetInMs(rateDetail.resetTime || ''),
            pctUsed: clampPct(rateUsed, rateLimit),
          }
        : undefined,
    parallel: raw.parallel?.limit !== undefined ? { limit: asInt(raw.parallel.limit) } : undefined,
  };
}

// ── Network ────────────────────────────────────────────────────────

async function fetchOnce(token: string): Promise<KimiQuotaSnapshot> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(KIMI_USAGES_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'mission-control/kimi-quota',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        available: false,
        fetchedAt: new Date().toISOString(),
        error: {
          code: `HTTP_${res.status}`,
          detail: body.slice(0, 300) || res.statusText || 'Upstream error',
        },
      };
    }
    const raw = (await res.json()) as RawKimiUsageResponse;
    const snapshot = normalize(raw);
    saveSnapshotToDisk(snapshot);
    return snapshot;
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    let code = 'FETCH_FAILED';
    if (err?.name === 'AbortError' || /abort|timeout/i.test(msg)) code = 'TIMEOUT';
    else if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ENETUNREACH/i.test(msg)) code = 'NETWORK_UNREACHABLE';
    return {
      available: false,
      fetchedAt: new Date().toISOString(),
      error: { code, detail: msg.slice(0, 300) || 'Unknown fetch error' },
    };
  } finally {
    clearTimeout(timer);
  }
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Fetch the latest quota snapshot, honoring the in-memory TTL cache.
 * Concurrent callers share a single in-flight request to avoid quota
 * fetch storms.
 */
export async function getKimiQuota(force = false): Promise<KimiQuotaSnapshot> {
  const now = Date.now();
  if (!force && cached && cached.expiresAt > now) {
    return cached.snapshot;
  }
  if (inFlight) return inFlight;

  const token = discoverKimiToken();
  if (!token) {
    const snapshot: KimiQuotaSnapshot = {
      available: false,
      fetchedAt: new Date().toISOString(),
      error: {
        code: 'NO_TOKEN',
        detail: 'No Kimi API token found in env or auth-profiles.json. Set KIMI_API_KEY or sign in via openclaw.',
      },
    };
    cached = { snapshot, expiresAt: now + TTL_MS };
    return snapshot;
  }

  inFlight = (async () => {
    const fresh = await fetchOnce(token);
    if (fresh.available) {
      cached = { snapshot: fresh, expiresAt: Date.now() + TTL_MS };
      return fresh;
    }
    // Fresh fetch failed — fall back to disk snapshot or last cache, marked stale
    const fallback = cached?.snapshot || loadSnapshotFromDisk();
    if (fallback && fallback.available) {
      const stale: KimiQuotaSnapshot = {
        ...fallback,
        staleSince: fresh.fetchedAt,
        error: fresh.error,
      };
      cached = { snapshot: stale, expiresAt: Date.now() + Math.min(TTL_MS, 30_000) };
      return stale;
    }
    cached = { snapshot: fresh, expiresAt: Date.now() + Math.min(TTL_MS, 30_000) };
    return fresh;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/**
 * Synchronous read of the last cached snapshot. Useful for guards that must
 * not block the request path. Returns null if nothing is cached yet.
 */
export function peekKimiQuota(): KimiQuotaSnapshot | null {
  if (cached) return cached.snapshot;
  return loadSnapshotFromDisk();
}

/** Reset the in-memory cache. Intended for the manual /refresh endpoint. */
export function invalidateKimiQuotaCache(): void {
  cached = null;
}

// ── Severity classification (used by banner + guard) ──────────────

export type KimiQuotaSeverity = 'ok' | 'warn' | 'critical' | 'exhausted' | 'unknown';

/**
 * Classify a snapshot into a severity bucket the UI can render directly.
 *
 * Thresholds are PERCENTAGE-based, not absolute, because the Allegretto plan
 * exposes a 100-call weekly bucket while higher tiers may show 2048+. The
 * original (run #344 calibration) thresholds used absolute counts and tagged
 * a 6/100 used ('warn') even when 94 calls remained — false alarm noise.
 *
 * Severity ladder (whichever bucket trips first wins):
 *   exhausted — remaining == 0 in weekly OR rate window
 *   critical  — pctUsed >= 90 (≤10% remaining)
 *   warn      — pctUsed >= 70 (≤30% remaining)
 *   ok        — everything else
 *
 * The CLI guard only blocks at 'exhausted'; 'critical' and 'warn' are
 * informational and let the run start.
 */
export function classifyKimiQuota(snapshot: KimiQuotaSnapshot | null): {
  severity: KimiQuotaSeverity;
  reason: string;
} {
  if (!snapshot || !snapshot.available) {
    return { severity: 'unknown', reason: snapshot?.error?.detail || 'No snapshot available' };
  }
  const w = snapshot.weekly;
  const r = snapshot.rateWindow;
  if (w && w.remaining === 0) {
    return { severity: 'exhausted', reason: `Weekly quota exhausted (resets in ${Math.round(w.resetInMs / 60000)} min)` };
  }
  if (r && r.remaining === 0) {
    return { severity: 'exhausted', reason: `Rate window exhausted (resets in ${Math.round(r.resetInMs / 60000)} min)` };
  }
  const wPct = w?.pctUsed ?? 0;
  const rPct = r?.pctUsed ?? 0;
  if (wPct >= 90 || rPct >= 90) {
    return {
      severity: 'critical',
      reason: `Quota critically low — weekly ${w?.remaining ?? '?'}/${w?.limit ?? '?'} (${wPct}% used) · rate ${r?.remaining ?? '?'}/${r?.limit ?? '?'} (${rPct}% used)`,
    };
  }
  if (wPct >= 70 || rPct >= 70) {
    return {
      severity: 'warn',
      reason: `Quota running low — weekly ${w?.remaining ?? '?'}/${w?.limit ?? '?'} (${wPct}% used) · rate ${r?.remaining ?? '?'}/${r?.limit ?? '?'} (${rPct}% used)`,
    };
  }
  return { severity: 'ok', reason: 'Within safe quota range' };
}
