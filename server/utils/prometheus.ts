import { config } from '../config.js';
import os from 'node:os';
import { readWorkingVolumeObservation } from './disk-health.js';

export async function queryPrometheus(promql: string): Promise<any> {
  const url = `${config.prometheusUrl}/api/v1/query?query=${encodeURIComponent(promql)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Prometheus ${res.status}`);
  const json = await res.json();
  if (json.status !== 'success') throw new Error('Prometheus query failed');
  return json.data;
}

export function extractScalar(data: any): number | null {
  const value = data?.resultType === 'vector' && data.result?.length === 1 ? data.result[0]?.value?.[1] : null;
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

let lastCpu: { at: number; counters: number[][] } | undefined;
function localCpuPercent(): number | null {
  try {
    const at = performance.now();
    const counters = os.cpus().map(cpu => [cpu.times.idle, cpu.times.user, cpu.times.nice, cpu.times.sys, cpu.times.irq]);
    if (!Number.isFinite(at) || !counters.length || counters.some(times => times.some(value => !Number.isSafeInteger(value) || value < 0))) {
      lastCpu = undefined; return null;
    }
    const previous = lastCpu;
    lastCpu = { at, counters };
    if (!previous || at <= previous.at || !counters.length || counters.length !== previous.counters.length) return null;
    let total = 0; let idle = 0;
    for (let i = 0; i < counters.length; i++) {
      for (let j = 0; j < 5; j++) {
        const delta = counters[i]![j]! - previous.counters[i]![j]!;
        if (!Number.isFinite(delta) || delta < 0) return null;
        total += delta;
        if (j === 0) idle += delta;
      }
    }
    return Number.isFinite(total) && total > 0 ? Math.round((1 - idle / total) * 1000) / 10 : null;
  } catch { lastCpu = undefined; return null; }
}

const gb = (bytes: number | null) => bytes === null ? null : Math.round(bytes / 1073741824 * 10) / 10;
export async function getSystemMetrics() {
  const localCpu = localCpuPercent();
  const [cpuResult, loadResult, volume] = await Promise.all([
    queryPrometheus('100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)').then(extractScalar).catch(() => null),
    queryPrometheus('node_load1').then(extractScalar).catch(() => null),
    readWorkingVolumeObservation(),
  ]);
  const observedAt = new Date().toISOString();
  const total = os.totalmem(); const free = os.freemem();
  const validRam = Number.isFinite(total) && total > 0 && Number.isFinite(free) && free >= 0 && free <= total;
  const cpuFromPrometheus = cpuResult !== null && cpuResult >= 0 && cpuResult <= 100;
  const cpu = cpuFromPrometheus ? Math.round(cpuResult * 10) / 10 : localCpu;
  const localLoad = os.loadavg()[0];
  const loadFromPrometheus = loadResult !== null && loadResult >= 0;
  const load = loadFromPrometheus ? loadResult : Number.isFinite(localLoad) && localLoad! >= 0 ? localLoad! : null;
  return {
    ram: { total: validRam ? gb(total) : null, used: validRam ? gb(total - free) : null,
      percent: validRam ? Math.round((total - free) / total * 100) : null,
      source: 'node:os', semantics: 'total-os.freemem', status: validRam ? 'available' : 'unknown', observedAt },
    cpu: { percent: cpu, source: cpuFromPrometheus ? 'prometheus' : 'node:os', status: cpu === null ? 'unknown' : 'available', observedAt },
    disk: { ...volume, total: gb(volume.totalBytes), used: gb(volume.usedBytes) },
    load,
    loadObservation: { source: loadFromPrometheus ? 'prometheus' : 'node:os', status: load === null ? 'unknown' : 'available', observedAt },
  };
}
