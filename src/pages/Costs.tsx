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
  cost: number;
}

interface CostDataRaw {
  totalToday: number;
  totalAllTime: number;
  projectedMonthly: number;
  subagentCostToday: number;
  subagentCostAllTime: number;
  breakdownAllTime: { model: string; cost: number }[];
  breakdownToday: { model: string; cost: number }[];
  tokenUsage: TokenRow[];
  tokenUsageToday: TokenRow[];
}

export function Costs() {
  const { data, loading } = usePolling<CostDataRaw>(api.costs, 60000);

  if (loading || !data) return <div className="page-loading">Loading costs...</div>;

  const tokenRows: TokenRow[] = Array.isArray(data.tokenUsage) ? data.tokenUsage : [];
  const tokenRowsToday: TokenRow[] = Array.isArray(data.tokenUsageToday) ? data.tokenUsageToday : [];

  return (
    <div className="costs-page">
      <GlitchText text="COST CENTER" tag="h2" />

      <div className="stat-cards">
        <div className="stat-card stat-card--green">
          <div className="stat-card__value">${data.totalToday.toFixed(2)}</div>
          <div className="stat-card__label">TODAY</div>
        </div>
        <div className="stat-card stat-card--orange">
          <div className="stat-card__value">${data.totalAllTime.toFixed(2)}</div>
          <div className="stat-card__label">ALL TIME</div>
        </div>
        <div className="stat-card stat-card--cyan">
          <div className="stat-card__value">${data.projectedMonthly.toFixed(0)}</div>
          <div className="stat-card__label">PROJECTED/MO</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">${data.subagentCostToday.toFixed(2)}</div>
          <div className="stat-card__label">SUBAGENT TODAY</div>
        </div>
      </div>

      <CostChart breakdownAllTime={data.breakdownAllTime} breakdownToday={data.breakdownToday} />

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
              <tr key={i}>
                <td className="token-table__model">{row.model}</td>
                <td>{row.calls?.toLocaleString() ?? '-'}</td>
                <td>{row.input ?? '-'}</td>
                <td>{row.output ?? '-'}</td>
                <td>{row.cacheRead ?? '-'}</td>
                <td>{row.totalTokens ?? '-'}</td>
                <td className="token-table__cost">${row.cost?.toFixed(2) ?? '0'}</td>
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
                  <tr key={i}>
                    <td className="token-table__model">{row.model}</td>
                    <td>{row.calls?.toLocaleString() ?? '-'}</td>
                    <td>{row.input ?? '-'}</td>
                    <td>{row.output ?? '-'}</td>
                    <td>{row.cacheRead ?? '-'}</td>
                    <td>{row.totalTokens ?? '-'}</td>
                    <td className="token-table__cost">${row.cost?.toFixed(2) ?? '0'}</td>
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
