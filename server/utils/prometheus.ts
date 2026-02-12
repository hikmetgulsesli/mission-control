import { config } from '../config.js';

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
