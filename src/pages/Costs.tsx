import { usePolling } from '../hooks/usePolling';
import { api } from '../lib/api';
import { CostChart } from '../components/CostChart';
import { GlitchText } from '../components/GlitchText';

interface TokenRow {
  model: string;
  calls: number;
  input: string;
  output: string;
  cacheRead: string;
  totalTokens: string;
  cost: number | null;
}

interface CostDataRaw {
  costStatus: Record<string,'available'|'unknown'>;
  usageSource: string;
  totalToday: number | null;
  totalAllTime: number | null;
  projectedMonthly: number | null;
  subagentCostToday: number | null;
  subagentCostAllTime: number | null;
  breakdownAllTime: { model: string; cost: number }[];
  breakdownToday: { model: string; cost: number }[];
  tokenUsage: TokenRow[];
  tokenUsageToday: TokenRow[];
}

export function Costs() {
  const { data, loading, error } = usePolling<CostDataRaw>(() => api.costs() as Promise<any>, 60000);

  if (error && !data) return <div className="page-loading">Kullanılamıyor: {error}</div>;
  if (loading || !data) return <div className="page-loading">Loading costs...</div>;

  const tokenRows: TokenRow[] = Array.isArray(data.tokenUsage) ? data.tokenUsage : [];
  const tokenRowsToday: TokenRow[] = Array.isArray(data.tokenUsageToday) ? data.tokenUsageToday : [];

  const money = (value: number | null | undefined, status?: string, precision = 2) =>
    typeof value === 'number' && Number.isFinite(value) && status !== 'unknown' ? `$${value.toFixed(precision)}` : 'Kullanılamıyor';

  return (
    <div className="costs-page">
      <GlitchText text="COST CENTER" tag="h2" />

      <div className="stat-cards">
        <div className="stat-card stat-card--green">
          <div className="stat-card__value">{money(data.totalToday, data.costStatus?.totalToday, 2)}</div>
          <div className="stat-card__label">TODAY</div>
        </div>
        <div className="stat-card stat-card--orange">
          <div className="stat-card__value">{money(data.totalAllTime, data.costStatus?.totalAllTime, 2)}</div>
          <div className="stat-card__label">ALL TIME</div>
        </div>
        <div className="stat-card stat-card--cyan">
          <div className="stat-card__value">{money(data.projectedMonthly, data.costStatus?.projectedMonthly, 0)}</div>
          <div className="stat-card__label">PROJECTED/MO</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{money(data.subagentCostToday, data.costStatus?.subagentCostToday, 2)}</div>
          <div className="stat-card__label">SUBAGENT TODAY</div>
        </div>
      </div>

      <p>Kaynak: {data.usageSource} · Bugün / tüm zamanlar</p>
      {data.breakdownAllTime.length || data.breakdownToday.length ? <CostChart breakdownAllTime={data.breakdownAllTime} breakdownToday={data.breakdownToday} /> : <p>Henüz veri yok</p>}

      <h3 className="section-title">TOKEN USAGE (ALL TIME)</h3>
      <div className="token-table-wrapper">
        <table className="token-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Calls</th>
              <th>Input</th>
              <th>Output</th>
              <th>Cache Read</th>
              <th>Total Tokens</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {tokenRows.map((row, i) => (
              <tr key={row.model || i}>
                <td className="token-table__model">{row.model}</td>
                <td>{row.calls?.toLocaleString() ?? '-'}</td>
                <td>{row.input ?? '-'}</td>
                <td>{row.output ?? '-'}</td>
                <td>{row.cacheRead ?? '-'}</td>
                <td>{row.totalTokens ?? '-'}</td>
                <td className="token-table__cost">{money(row.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tokenRowsToday.length > 0 && (
        <>
          <h3 className="section-title">TOKEN USAGE (TODAY)</h3>
          <div className="token-table-wrapper">
            <table className="token-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Calls</th>
                  <th>Input</th>
                  <th>Output</th>
                  <th>Cache Read</th>
                  <th>Total Tokens</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {tokenRowsToday.map((row, i) => (
                  <tr key={row.model || i}>
                    <td className="token-table__model">{row.model}</td>
                    <td>{row.calls?.toLocaleString() ?? '-'}</td>
                    <td>{row.input ?? '-'}</td>
                    <td>{row.output ?? '-'}</td>
                    <td>{row.cacheRead ?? '-'}</td>
                    <td>{row.totalTokens ?? '-'}</td>
                    <td className="token-table__cost">{money(row.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
