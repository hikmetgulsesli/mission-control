import type { SystemMetrics as Metrics } from '../lib/types';

interface Props {
  metrics: Metrics;
}

function MetricBar({ label, value, max, unit, color, percent }: { label: string; value: number | null; max: number | null; percent?: number | null; unit: string; color: string }) {
  const known = value !== null && max !== null;
  const pct = percent !== undefined ? percent : known && max > 0 ? (value / max) * 100 : null;
  const barColor = pct !== null && pct > 90 ? '#ff0040' : pct !== null && pct > 70 ? '#ff6600' : color;

  return (
    <div className="metric-bar">
      <div className="metric-bar__header">
        <span className="metric-bar__label">{label}</span>
        <span className="metric-bar__value">{percent !== undefined ? percent === null ? 'Unknown' : `${percent}%` : known ? `${value}${unit} / ${max}${unit}` : 'Unknown'}</span>
      </div>
      <div className="metric-bar__track">
        {pct !== null && <div className="metric-bar__fill" style={{ width: `${pct}%`, background: barColor }} />}
      </div>
    </div>
  );
}

export function SystemMetricsPanel({ metrics }: Props) {
  return (
    <div className="system-metrics" title={`Observed: RAM ${metrics.ram.observedAt}; CPU ${metrics.cpu.source} ${metrics.cpu.observedAt}; disk ${metrics.disk.observedAt}`}>
      <MetricBar label="RAM used" value={metrics.ram.used} max={metrics.ram.total} unit="GB" color="#00ff41" />
      <div className="metric-bar__label">{metrics.ram.source} · total−os.freemem (used)</div>
      <MetricBar label="CPU" value={metrics.cpu.percent} max={100} unit="%" color="#00ffff" />
      <MetricBar label="DISK CAPACITY" percent={metrics.disk.percent} value={metrics.disk.used} max={metrics.disk.total} unit="GiB" color="#ff6600" />
      <div className="metric-bar__label">Used: {metrics.disk.used === null ? 'Unknown' : `${metrics.disk.used} GiB`} · Available: {metrics.disk.freeBytes === null ? 'Unknown' : `${Math.round(metrics.disk.freeBytes / 1073741824 * 10) / 10} GiB`} · Volume total: {metrics.disk.total === null ? 'Unknown' : `${metrics.disk.total} GiB`}</div>
      <div className="metric-bar__label">{metrics.disk.source} · {metrics.disk.mount ?? metrics.disk.path}</div>
      <div className="metric-bar">
        <div className="metric-bar__header">
          <span className="metric-bar__label">LOAD</span>
          <span className="metric-bar__value">{metrics.load === null ? 'Unknown' : metrics.load.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
