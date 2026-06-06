import { config } from '../config.js';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function queryPrometheus(promql: string): Promise<any> {
  const url = `${config.prometheusUrl}/api/v1/query?query=${encodeURIComponent(promql)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Prometheus ${res.status}`);
  const json = await res.json();
  if (json.status !== 'success') throw new Error(`Prometheus query failed: ${json.error}`);
  return json.data;
}

export function extractScalar(data: any): number {
  if (data?.resultType === 'vector' && data.result?.length > 0) {
    return parseFloat(data.result[0].value[1]);
  }
  return 0;
}

export async function getSystemMetrics() {
  const [memTotal, memAvail, cpuIdle, diskTotal, diskFree, loadAvg] = await Promise.allSettled([
    queryPrometheus('node_memory_MemTotal_bytes').then(extractScalar),
    queryPrometheus('node_memory_MemAvailable_bytes').then(extractScalar),
    queryPrometheus('100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)').then(extractScalar),
    queryPrometheus('node_filesystem_size_bytes{mountpoint="/"}').then(extractScalar),
    queryPrometheus('node_filesystem_avail_bytes{mountpoint="/"}').then(extractScalar),
    queryPrometheus('node_load1').then(extractScalar),
  ]);

  const val = (r: PromiseSettledResult<number>) => r.status === 'fulfilled' ? r.value : 0;
  if ([memTotal, memAvail, diskTotal].every(r => r.status === 'rejected' || val(r) === 0)) {
    return getLocalSystemMetrics();
  }
  const memTotalGB = val(memTotal) / 1073741824;
  const memUsedGB = memTotalGB - val(memAvail) / 1073741824;

  return {
    ram: {
      total: Math.round(memTotalGB * 10) / 10,
      used: Math.round(memUsedGB * 10) / 10,
      percent: memTotalGB > 0 ? Math.round((memUsedGB / memTotalGB) * 100) : 0,
    },
    cpu: {
      percent: Math.round(val(cpuIdle) * 10) / 10,
    },
    disk: {
      total: Math.round(val(diskTotal) / 1073741824 * 10) / 10,
      used: Math.round((val(diskTotal) - val(diskFree)) / 1073741824 * 10) / 10,
      percent: val(diskTotal) > 0 ? Math.round(((val(diskTotal) - val(diskFree)) / val(diskTotal)) * 100) : 0,
    },
    load: val(loadAvg),
  };
}

async function getLocalSystemMetrics() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  let diskTotal = 0;
  let diskUsed = 0;
  try {
    const { stdout } = await execFileAsync('df', ['-k', '/'], { timeout: 3000 });
    const line = stdout.trim().split(/\r?\n/).pop() || '';
    const parts = line.split(/\s+/);
    diskTotal = Number(parts[1] || 0) * 1024;
    diskUsed = Number(parts[2] || 0) * 1024;
  } catch {
    // Keep disk metrics at zero if df is unavailable.
  }

  return {
    ram: {
      total: Math.round((total / 1073741824) * 10) / 10,
      used: Math.round((used / 1073741824) * 10) / 10,
      percent: total > 0 ? Math.round((used / total) * 100) : 0,
    },
    cpu: {
      percent: 0,
    },
    disk: {
      total: Math.round((diskTotal / 1073741824) * 10) / 10,
      used: Math.round((diskUsed / 1073741824) * 10) / 10,
      percent: diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 100) : 0,
    },
    load: os.loadavg()[0] || 0,
  };
}
