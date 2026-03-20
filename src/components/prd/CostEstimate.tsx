interface CostEstimateProps {
  estimate: {
    storyCount: number;
    tokenCost: number;
    estimatedMinutes: number;
    successRate: number;
  } | null;
}

export function CostEstimate({ estimate }: CostEstimateProps) {
  if (!estimate) return null;

  return (
    <div className="prd-cost">
      <div className="prd-cost__item">
        <span className="prd-cost__value">{estimate.storyCount}</span>
        <span className="prd-cost__label">story</span>
      </div>
      <div className="prd-cost__divider" />
      <div className="prd-cost__item">
        <span className="prd-cost__value">${estimate.tokenCost}</span>
        <span className="prd-cost__label">maliyet</span>
      </div>
      <div className="prd-cost__divider" />
      <div className="prd-cost__item">
        <span className="prd-cost__value">~{estimate.estimatedMinutes}dk</span>
        <span className="prd-cost__label">sure</span>
      </div>
      <div className="prd-cost__divider" />
      <div className="prd-cost__item">
        <span className="prd-cost__value" style={{
          color: estimate.successRate >= 70 ? 'var(--neon-green)' : estimate.successRate >= 50 ? 'var(--neon-orange)' : 'var(--neon-red)',
        }}>
          %{estimate.successRate}
        </span>
        <span className="prd-cost__label">basari</span>
      </div>
    </div>
  );
}
