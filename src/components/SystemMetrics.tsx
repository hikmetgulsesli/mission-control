import type { SystemMetrics as Metrics } from '../lib/types';

interface Props {
  metrics: Metrics;
}

function MetricBar({ label, value, max, unit, color }: { label: string; value: number; max: number; unit: string; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const barColor = pct > 90 ? '#ff0040' : pct > 70 ? '#ff6600' : color;

  return (
    <div className="metric-bar">
      <div className="metric-bar__header">
        <span className="metric-bar__label">{label}</span>
        <span className="metric-bar__value">{value}{unit} / {max}{unit}</span>
      </div>
      <div className="metric-bar__track">
        <div className="metric-bar__fill" style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </div>
  );
}

export function SystemMetricsPanel({ metrics }: Props) {
  return (
    <div className="system-metrics">
      <MetricBar label="RAM" value={metrics.ram.used} max={metrics.ram.total} unit="GB" color="#00ff41" />
      <MetricBar label="CPU" value={metrics.cpu.percent} max={100} unit="%" color="#00ffff" />
      <MetricBar label="DISK" value={metrics.disk.used} max={metrics.disk.total} unit="GB" color="#ff6600" />
      <div className="metric-bar">
        <div className="metric-bar__header">
          <span className="metric-bar__label">LOAD</span>
          <span className="metric-bar__value">{metrics.load.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
