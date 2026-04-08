/**
 * KimiQuotaBanner — header banner that surfaces Kimi Code billing state.
 *
 * Why this exists: during runs #338-#340 we lost hours diagnosing what looked
 * like an OpenClaw gateway stall. The actual cause was Kimi Code Allegretto
 * weekly quota exhaustion, returning 403 from every developer-agent call. The
 * gateway log made it obvious in retrospect, but the dashboard had zero signal.
 * This banner makes that state impossible to miss.
 *
 * Polls /api/kimi-quota every 60s, escalates color/severity, and lets the user
 * manually force a refresh by clicking it.
 *
 * Wave 7 (plan: reactive-frolicking-cupcake.md).
 */

import { useEffect, useState, useCallback } from 'react';

interface QuotaWindow {
  limit: number;
  used: number;
  remaining: number;
  resetTime: string;
  resetInMs: number;
  pctUsed: number;
}

interface RateWindow extends QuotaWindow {
  durationSeconds: number;
}

interface KimiQuotaSnapshot {
  available: boolean;
  fetchedAt: string;
  staleSince?: string;
  user?: { userId: string; region: string; membershipLevel: string };
  weekly?: QuotaWindow;
  rateWindow?: RateWindow;
  parallel?: { limit: number };
  error?: { code: string; detail: string };
}

interface QuotaResponse {
  snapshot: KimiQuotaSnapshot;
  severity: 'ok' | 'warn' | 'critical' | 'exhausted' | 'unknown';
  reason: string;
}

const POLL_INTERVAL_MS = 60_000;

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0m';
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin}dk`;
  const hours = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (hours < 24) return min === 0 ? `${hours}sa` : `${hours}sa${min}dk`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours === 0 ? `${days}g` : `${days}g${remHours}sa`;
}

function severityStyle(severity: QuotaResponse['severity']): {
  bg: string;
  fg: string;
  icon: string;
} {
  switch (severity) {
    case 'exhausted':
      return { bg: '#5a0010', fg: '#ffd6da', icon: '⛔' };
    case 'critical':
      return { bg: '#8a1a00', fg: '#ffe2cf', icon: '🚫' };
    case 'warn':
      return { bg: '#665200', fg: '#fff4b8', icon: '⚠️' };
    case 'ok':
      return { bg: '#0e3320', fg: '#9affb6', icon: '✓' };
    case 'unknown':
    default:
      return { bg: '#1a1a1f', fg: '#a0a0b0', icon: '?' };
  }
}

export function KimiQuotaBanner() {
  const [data, setData] = useState<QuotaResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force = false) => {
    try {
      const url = force ? '/api/kimi-quota/refresh' : '/api/kimi-quota';
      const opts: RequestInit = force ? { method: 'POST' } : {};
      const res = await fetch(url, opts);
      if (!res.ok) {
        setData({
          snapshot: { available: false, fetchedAt: new Date().toISOString(), error: { code: `HTTP_${res.status}`, detail: res.statusText } },
          severity: 'unknown',
          reason: `API error: HTTP ${res.status}`,
        });
        return;
      }
      const json = (await res.json()) as QuotaResponse;
      setData(json);
    } catch (err: any) {
      setData({
        snapshot: { available: false, fetchedAt: new Date().toISOString(), error: { code: 'FETCH_FAILED', detail: String(err?.message || err) } },
        severity: 'unknown',
        reason: 'Banner fetch failed',
      });
    }
  }, []);

  useEffect(() => {
    load(false);
    const interval = setInterval(() => load(false), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const handleClick = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load, refreshing]);

  // Hide entirely when state is healthy and we have a valid snapshot — banner
  // is only meant to surface problems, not occupy real estate full-time.
  if (!data) return null;
  if (data.severity === 'ok') return null;

  const { snapshot, severity, reason } = data;
  const style = severityStyle(severity);
  const weekly = snapshot.weekly;
  const rate = snapshot.rateWindow;

  const parts: string[] = [];
  if (weekly) {
    parts.push(`hafta ${weekly.used}/${weekly.limit} (${formatDuration(weekly.resetInMs)} sonra reset)`);
  }
  if (rate) {
    parts.push(`5sa pencere ${rate.used}/${rate.limit} (${formatDuration(rate.resetInMs)} sonra reset)`);
  }
  const detail = parts.length ? parts.join(' · ') : reason;

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
      style={{
        background: style.bg,
        color: style.fg,
        padding: '6px 12px',
        fontFamily: 'monospace',
        fontSize: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        cursor: 'pointer',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        userSelect: 'none',
      }}
      title={`Kimi Code quota — tıklayarak yenile. ${snapshot.staleSince ? `(stale snapshot, son taze veri ${snapshot.fetchedAt})` : ''}`}
    >
      <span style={{ fontSize: '14px' }}>{style.icon}</span>
      <strong>KIMI</strong>
      <span>{detail}</span>
      {snapshot.staleSince && <span style={{ opacity: 0.7 }}>(stale)</span>}
      {refreshing && <span style={{ opacity: 0.7 }}>… refreshing</span>}
      {snapshot.error && <span style={{ opacity: 0.7 }}>[{snapshot.error.code}]</span>}
    </div>
  );
}
