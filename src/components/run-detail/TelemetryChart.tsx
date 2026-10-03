import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api, type TelemetryResult as TelemetryResultData } from '../../lib/api';

function statusColor(status: string, isBottleneck: boolean): string {
  if (isBottleneck) return '#f59e0b'; // orange for bottleneck
  switch (status) {
    case 'done': return '#00ff41';
    case 'failed': return '#ff0040';
    case 'running': return '#3b82f6';
    default: return '#555555';
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

const STEP_SHORT: Record<string, string> = {
  plan: 'PLAN', design: 'DESIGN', stories: 'STORIES',
  'setup-repo': 'SETUP', 'setup-build': 'BUILD', implement: 'IMPL',
  verify: 'VERIFY', 'security-gate': 'SEC', 'qa-test': 'QA',
  'final-test': 'FINAL', deploy: 'DEPLOY',
};

export function TelemetryChart({ runId }: { runId: string }) {
  const [data, setData] = useState<TelemetryResultData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    api.telemetry(runId)
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData({ status: 'unavailable', runId, reason: 'network' }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [runId]);

  if (loading || data && data.runId !== null && data.runId !== runId) return <div style={{ padding: 16, color: 'var(--text-dim)', fontSize: 13 }}>Loading telemetry...</div>;
  return <TelemetryResult result={data ?? { status: 'unavailable', runId, reason: 'invalid_response' }} />;
}

export function TelemetryResult({ result }: { result: TelemetryResultData }) {
  if (result.status === 'unavailable') {
    return <div role="status" style={{ padding: 16, color: '#ff4444', fontSize: 13 }}>Telemetry unavailable ({result.reason})</div>;
  }
  const notice = <p role="status" style={{ color: 'var(--text-dim)', fontSize: 12 }}>Precise transition history unavailable. Analysis covers historical execution duration only.</p>;
  const steps = result.steps;
  if (steps.length === 0) return <div style={{ padding: 16 }}>{notice}<div style={{ color: 'var(--text-dim)', fontSize: 13 }}>No telemetry data</div></div>;

  const chartData = steps
    .filter(s => s.duration_ms !== null)
    .map(s => ({
      name: Object.hasOwn(STEP_SHORT, s.step_id) ? STEP_SHORT[s.step_id] : s.step_id.toUpperCase(),
      stepId: s.step_id,
      duration: s.duration_ms!,
      status: s.status,
      isBottleneck: s.isBottleneck,
      agent: s.agent_id?.split('/').pop() || '',
    }));

  if (chartData.length === 0) {
    return <div style={{ padding: 16 }}>{notice}<div style={{ color: 'var(--text-dim)', fontSize: 13 }}>No completed steps yet</div></div>;
  }

  const totalMs = chartData.reduce((sum, d) => sum + d.duration, 0);
  if (!Number.isFinite(totalMs)) return <TelemetryResult result={{ status: 'unavailable', runId: result.runId, reason: 'invalid_response' }} />;
  const bottlenecks = chartData.filter(d => d.isBottleneck);

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: 16,
    }}>
      {notice}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--neon-cyan)', letterSpacing: 1 }}>
          PIPELINE TELEMETRY
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          Total: {formatDuration(totalMs)}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <XAxis
            dataKey="name"
            tick={{ fill: 'var(--text-dim)', fontSize: 10 }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--text-dim)', fontSize: 10 }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
            tickFormatter={(v: number) => v < 1000 ? `${v}ms` : `${(v / 1000).toFixed(0)}s`}
          />
          <Tooltip
            contentStyle={{
              background: '#1a1a2e',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 12,
            }}
            formatter={(value: number, _name: string, props: any) => {
              const entry = props.payload;
              return [
                `${formatDuration(value)}${entry.isBottleneck ? ' (BOTTLENECK)' : ''}`,
                `${entry.name}${entry.agent ? ` (${entry.agent})` : ''}`,
              ];
            }}
            labelStyle={{ color: 'var(--neon-cyan)' }}
          />
          <Bar dataKey="duration" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={statusColor(entry.status, entry.isBottleneck)}
                stroke={entry.isBottleneck ? '#f59e0b' : 'transparent'}
                strokeWidth={entry.isBottleneck ? 2 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#00ff41', marginRight: 4 }} />Done</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#ff0040', marginRight: 4 }} />Failed</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#3b82f6', marginRight: 4 }} />Running</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#f59e0b', marginRight: 4 }} />Bottleneck</span>
      </div>

      {/* Bottleneck alerts */}
      {bottlenecks.length > 0 && (
        <div style={{
          marginTop: 10,
          padding: '8px 12px',
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 6,
          fontSize: 12,
        }}>
          <span style={{ color: '#f59e0b', fontWeight: 600 }}>Bottleneck:</span>{' '}
          <span style={{ color: 'var(--text-dim)' }}>
            {bottlenecks.map(b => `${b.name} (${formatDuration(b.duration)})`).join(', ')}
            {' '}&mdash; 2x+ slower than average
          </span>
        </div>
      )}
    </div>
  );
}
