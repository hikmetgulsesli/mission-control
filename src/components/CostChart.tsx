import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#00ff41', '#ff6600', '#00ffff', '#ff0040', '#8844ff', '#ffaa00', '#44ff88', '#ff44ff'];

interface CostItem {
  model: string;
  cost: number;
}

interface Props {
  breakdownAllTime: CostItem[];
  breakdownToday: CostItem[];
}

function shortModel(name: string): string {
  // "Claude Sonnet" → "Sonnet", "Claude Opus 4.6" → "Opus"
  if (name.includes('Opus')) return 'Opus';
  if (name.includes('Sonnet')) return 'Sonnet';
  if (name.includes('Kimi')) return 'Kimi K2.5';
  if (name.includes('MiniMax')) return 'MiniMax';
  if (name.includes('glm')) return 'GLM-4.7';
  if (name.includes('DeepSeek')) return 'DeepSeek';
  if (name.includes('Grok')) return 'Grok';
  return name;
}

const CustomLabel = ({ cx, cy, midAngle, outerRadius, model, cost }: any) => {
  if (cost < 0.5) return null; // skip tiny slices
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 20;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#e0e0e0" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11}>
      {shortModel(model)} ${cost.toFixed(1)}
    </text>
  );
};

export function CostChart({ breakdownAllTime, breakdownToday }: Props) {
  // Filter out $0 entries for cleaner charts
  const pieData = breakdownAllTime.filter(d => d.cost > 0);
  const barData = breakdownToday.filter(d => d.cost > 0).map(d => ({
    ...d,
    shortName: shortModel(d.model),
  }));

  return (
    <div className="cost-charts">
      <div className="cost-chart">
        <h3 className="cost-chart__title">ALL TIME BY MODEL</h3>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="cost"
              nameKey="model"
              cx="50%"
              cy="50%"
              outerRadius={85}
              innerRadius={30}
              label={CustomLabel}
              labelLine={true}
              strokeWidth={0}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#12121f', border: '1px solid #1e1e3a', color: '#e0e0e0', borderRadius: 4, fontSize: 12 }}
              formatter={(val: number) => [`$${val.toFixed(2)}`, 'Cost']}
              labelFormatter={(name: string) => shortModel(name)}
            />
            <Legend
              formatter={(value: string) => <span style={{ color: '#c0c0c0', fontSize: 11 }}>{shortModel(value)}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="cost-chart">
        <h3 className="cost-chart__title">TODAY BY MODEL</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 20 }}>
            <XAxis
              type="number"
              tick={{ fill: '#666680', fontSize: 11 }}
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            />
            <YAxis
              type="category"
              dataKey="shortName"
              tick={{ fill: '#e0e0e0', fontSize: 11 }}
              width={80}
            />
            <Tooltip
              contentStyle={{ background: '#12121f', border: '1px solid #1e1e3a', color: '#e0e0e0', borderRadius: 4, fontSize: 12 }}
              formatter={(val: number) => [`$${val.toFixed(2)}`, 'Cost']}
              labelFormatter={(name: string) => name}
            />
            <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
              {barData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
