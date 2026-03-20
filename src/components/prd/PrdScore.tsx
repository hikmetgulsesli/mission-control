interface PrdScoreProps {
  score: number;
  details: {
    pageDetail: number;
    designSystem: number;
    components: number;
    animations: number;
    responsive: number;
    dataModel: number;
    screenCount: number;
    missing: string[];
  } | null;
}

const categories = [
  { key: 'pageDetail', label: 'Sayfa Detayi', max: 20 },
  { key: 'designSystem', label: 'Tasarim Sistemi', max: 20 },
  { key: 'components', label: 'Komponentler', max: 15 },
  { key: 'animations', label: 'Animasyonlar', max: 10 },
  { key: 'responsive', label: 'Responsive', max: 10 },
  { key: 'dataModel', label: 'Veri Modeli', max: 10 },
  { key: 'screenCount', label: 'Ekran Sayisi', max: 15 },
];

function getScoreColor(score: number): string {
  if (score >= 80) return 'var(--neon-green)';
  if (score >= 60) return 'var(--neon-orange)';
  return 'var(--neon-red)';
}

export function PrdScore({ score, details }: PrdScoreProps) {
  const color = getScoreColor(score);
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="prd-score">
      <div className="prd-score__radial">
        <svg width="88" height="88" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r="36" fill="none" stroke="var(--border)" strokeWidth="6" />
          <circle
            cx="44" cy="44" r="36"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 44 44)"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
          <text x="44" y="44" textAnchor="middle" dominantBaseline="central" fill={color} fontSize="18" fontWeight="700" fontFamily="var(--font)">
            {score}
          </text>
        </svg>
      </div>
      {details && (
        <div className="prd-score__details">
          {categories.map(cat => {
            const val = (details as any)[cat.key] || 0;
            const pct = (val / cat.max) * 100;
            return (
              <div key={cat.key} className="prd-score__row">
                <span className="prd-score__label">{cat.label}</span>
                <div className="prd-score__bar">
                  <div
                    className="prd-score__bar-fill"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: pct >= 70 ? 'var(--neon-green)' : pct >= 40 ? 'var(--neon-orange)' : 'var(--neon-red)',
                    }}
                  />
                </div>
                <span className="prd-score__val">{val}/{cat.max}</span>
              </div>
            );
          })}
          {details.missing.length > 0 && (
            <div className="prd-score__missing">
              {details.missing.map((m, i) => (
                <div key={i} className="prd-score__missing-item">! {m}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
