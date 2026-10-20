import { AGENT_MAP } from './constants';
export interface ChatTarget {
  id: string;
  identityName?: string;
  name?: string;
  identityEmoji?: string;
}
export function chatTargetDisplay(id: string, target?: ChatTarget) {
  const meta = AGENT_MAP[id];
  return {
    name: target?.identityName || target?.name || meta?.name || id,
    emoji: target?.identityEmoji || meta?.emoji || '?',
  };
}
export function chatTimestamp(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const ms = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(ms) && Number.isFinite(new Date(ms).getTime()) ? ms : null;
}
export function newestKnownChatTime(a: {ts: number | null}, b: {ts: number | null}): number {
  if (a.ts === null) return b.ts === null ? 0 : 1;
  if (b.ts === null) return -1;
  return b.ts - a.ts;
}
