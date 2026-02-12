import { usePolling } from '../hooks/usePolling';
import { api } from '../lib/api';
import { GlitchText } from '../components/GlitchText';
import { AGENT_MAP } from '../lib/constants';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { formatDistanceToNow } from 'date-fns';

const COLORS = ['#00ff41', '#ff6600', '#00ffff', '#8844ff', '#ff0040', '#ffff00', '#00ff88', '#ff44aa', '#44aaff', '#ff8800'];

interface AgentStat {
  id: string;
  model: string;
  sessionCount: number;
  totalTokens: number;
  lastActive: number | null;
}

interface PerformanceData {
  agents: Record<string, AgentStat>;
  modelCosts: Record<string, number>;
  modelCostsToday: Record<string, number>;
  modelTokens: Record<string, { calls: number; totalTokens: string; cost: number }>;
  totalCostToday: number;
  totalCostAllTime: number;
}

function fetchPerformance() {
  return fetch('/api/performance').then(r => r.json());
}

export function Performance() {
  const { data, loading } = usePolling<PerformanceData>(fetchPerformance, 30000);

  if (loading || !data) return <div className="page-loading">Loading performance...</div>;

  const agentList = Object.values(data.agents).sort((a, b) => b.sessionCount - a.sessionCount);

  // Chart data: sessions per agent
  const sessionChartData = agentList.map((a, i) => ({
    name: AGENT_MAP[a.id]?.emoji + ' ' + (AGENT_MAP[a.id]?.name || a.id),
    sessions: a.sessionCount,
    tokens: a.totalTokens,
    color: COLORS[i % COLORS.length],
  }));

  // Chart data: cost per model
  const costChartData = Object.entries(data.modelCosts)
    .filter(([, cost]) => cost > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([model, cost], i) => ({
      name: model.split('/').pop() || model,
      cost: parseFloat(cost.toFixed(2)),
      color: COLORS[i % COLORS.length],
    }));

  return (
    <div className="performance-page">
      <GlitchText text="AGENT PERFORMANCE" tag="h2" />

      <div className="stat-cards">
        <div className="stat-card stat-card--green">
          <div className="stat-card__value">${data.totalCostToday.toFixed(2)}</div>
          <div className="stat-card__label">COST TODAY</div>
        </div>
        <div className="stat-card stat-card--orange">
          <div className="stat-card__value">${data.totalCostAllTime.toFixed(2)}</div>
          <div className="stat-card__label">COST ALL TIME</div>
        </div>
        <div className="stat-card stat-card--cyan">
          <div className="stat-card__value">{agentList.length}</div>
          <div className="stat-card__label">AGENTS</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{agentList.reduce((s, a) => s + a.sessionCount, 0)}</div>
          <div className="stat-card__label">TOTAL SESSIONS</div>
        </div>
      </div>

      <div className="perf-charts">
        <div className="panel">
          <h3 className="panel__title">SESSIONS PER AGENT</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sessionChartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
              <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fill: '#666680', fontSize: 10 }} />
              <YAxis tick={{ fill: '#666680', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#12121f', border: '1px solid #1e1e3a', borderRadius: 4, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                labelStyle={{ color: '#00ffff' }}
              />
              <Bar dataKey="sessions" radius={[4, 4, 0, 0]}>
                {sessionChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <h3 className="panel__title">COST PER MODEL</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={costChartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={110}
                dataKey="cost"
                nameKey="name"
                label={({ name, cost }) => `${name}: $${cost}`}
                labelLine={{ stroke: '#666680' }}
              >
                {costChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#12121f', border: '1px solid #1e1e3a', borderRadius: 4, fontSize: 11, fontFamily: 'JetBrains Mono' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <h3 className="section-title">AGENT DETAILS</h3>
      <div className="token-table-wrapper">
        <table className="token-table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Model</th>
              <th>Sessions</th>
              <th>Tokens</th>
              <th>Last Active</th>
            </tr>
          </thead>
          <tbody>
            {agentList.map(a => {
              const meta = AGENT_MAP[a.id];
              return (
                <tr key={a.id}>
                  <td className="token-table__model">{meta?.emoji} {meta?.name || a.id}</td>
                  <td>{a.model}</td>
                  <td>{a.sessionCount}</td>
                  <td>{a.totalTokens.toLocaleString()}</td>
                  <td style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                    {a.lastActive ? formatDistanceToNow(a.lastActive, { addSuffix: true }) : 'never'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
