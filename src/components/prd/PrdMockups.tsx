interface Screen {
  id: string;
  name: string;
  status: string;
  description?: string;
  screenshotUrl?: string;
  htmlUrl?: string;
  width?: number;
  height?: number;
  prompt?: string;
  parentScreenId?: string;
}

interface PrdMockupsProps {
  screens: Screen[];
  coverage?: { covered: string[]; missing: string[]; coverage: number } | null;
  onScreenClick: (screenId: string) => void;
  onClearAll?: () => void;
  onGenerateMissing?: (title: string) => void;
  onDeleteScreen?: (screenId: string) => void;
}

function getCoverageBadgeClass(coverage: number): string {
  if (coverage >= 80) return 'prd-mockups__coverage--good';
  if (coverage >= 50) return 'prd-mockups__coverage--fair';
  return 'prd-mockups__coverage--poor';
}

export function PrdMockups({ screens, coverage, onScreenClick, onClearAll, onGenerateMissing, onDeleteScreen }: PrdMockupsProps) {
  if (!screens || screens.length === 0) {
    return (
      <div className="prd-empty">
        <p>Henuz mockup uretilmedi.</p>
        <p className="prd-empty__hint">PRD olusturduktan sonra "Mockup Uret" butonuna basin.</p>
      </div>
    );
  }

  return (
    <div className="prd-mockups">
      {/* Header with count and coverage */}
      <div className="prd-mockups__header">
        <span className="prd-mockups__count">{screens.length} ekran</span>
        {screens.length > 0 && onClearAll && (
          <button className="btn btn--small btn--danger" onClick={onClearAll}>Tumunu Sil</button>
        )}
        {coverage && (
          <span className={`prd-mockups__coverage ${getCoverageBadgeClass(coverage.coverage)}`}>
            {coverage.covered.length}/{coverage.covered.length + coverage.missing.length} sayfa kapsaniyor ({coverage.coverage}%)
          </span>
        )}
      </div>

      {/* Missing pages warning */}
      {coverage && coverage.missing.length > 0 && (
        <div className="prd-mockups__missing">
          <span className="prd-mockups__missing-label">Eksik sayfalar:</span>
          {coverage.missing.map((m, i) => (
            <span key={i} className={`prd-mockups__missing-item ${onGenerateMissing ? 'prd-mockups__missing-item--clickable' : ''}`}
              onClick={() => onGenerateMissing?.(m)} title="Tikla: bu sayfa icin mockup uret">{m}</span>
          ))}
        </div>
      )}

      {/* Screen grid */}
      <div className="prd-mockups__grid">
        {screens.map((screen) => (
          <div
            key={screen.id}
            className={`prd-mockup-card ${screen.parentScreenId ? 'prd-mockup-card--variant' : ''}`}
            onClick={() => onScreenClick(screen.id)}
          >
            <div className="prd-mockup-card__preview">
              {screen.screenshotUrl ? (
                <img src={screen.screenshotUrl} alt={screen.name} />
              ) : (
                <div className="prd-mockup-card__placeholder">
                  <span className="prd-mockup-card__icon">
                    {screen.status === 'pending' ? '\u23F3' : screen.status === 'done' ? '\u2713' : '\u26A1'}
                  </span>
                </div>
              )}
            </div>
            <div className="prd-mockup-card__info">
              <h4 className="prd-mockup-card__name">{screen.name}</h4>
              <div className="prd-mockup-card__badges">
                <span className={`prd-mockup-card__status prd-mockup-card__status--${screen.status}`}>
                  {screen.status}
                </span>
                {screen.parentScreenId && (
                  <span className="prd-mockup-card__variant-tag">varyant</span>
                )}
              </div>
            </div>
            {screen.width && screen.height && (
              <div className="prd-mockup-card__size">{screen.width}x{screen.height}</div>
            )}
            {onDeleteScreen && (
              <button
                className="prd-mockup-card__delete"
                onClick={(e) => { e.stopPropagation(); onDeleteScreen(screen.id); }}
                title="Bu ekrani sil"
              >SIL</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
