interface ErrorCardProps {
  category: string;
  message: string;
  suggestion: string;
  severity: "error" | "warning" | "info";
  stepId: string;
  runId: string;
  onRetry?: () => void;
}

const SEVERITY_STYLES: Record<string, { bg: string; border: string; badge: string; badgeBg: string }> = {
  error: { bg: 'rgba(255, 0, 64, 0.06)', border: 'rgba(255, 0, 64, 0.3)', badge: '#ff0040', badgeBg: 'rgba(255, 0, 64, 0.15)' },
  warning: { bg: 'rgba(255, 152, 0, 0.06)', border: 'rgba(255, 152, 0, 0.3)', badge: '#ff9800', badgeBg: 'rgba(255, 152, 0, 0.15)' },
  info: { bg: 'rgba(0, 255, 255, 0.04)', border: 'rgba(0, 255, 255, 0.2)', badge: '#00ffff', badgeBg: 'rgba(0, 255, 255, 0.1)' },
};

export function ErrorCard({ category, message, suggestion, severity, stepId, runId, onRetry }: ErrorCardProps) {
  const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.error;
  const isLong = message.length > 200;

  return (
    <div
      className="error-card"
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: 8,
        padding: '12px 14px',
        marginBottom: 8,
      }}
    >
      {/* Top row: severity badge + category pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1,
            padding: '2px 8px',
            borderRadius: 4,
            background: style.badgeBg,
            color: style.badge,
            textTransform: 'uppercase',
          }}
        >
          {severity}
        </span>
        <span
          style={{
            fontSize: 10,
            padding: '2px 8px',
            borderRadius: 4,
            background: 'rgba(136, 136, 136, 0.15)',
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {category}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>
          {stepId}
        </span>
      </div>

      {/* Error message — truncated if long */}
      <details open={!isLong}>
        <summary
          style={{
            fontSize: 12,
            color: '#eee',
            cursor: isLong ? 'pointer' : 'default',
            lineHeight: 1.5,
            listStyle: isLong ? undefined : 'none',
          }}
        >
          {isLong ? message.slice(0, 200) + '...' : message}
        </summary>
        {isLong && (
          <pre style={{
            fontSize: 11,
            color: '#ccc',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            marginTop: 6,
            padding: 8,
            background: 'rgba(0,0,0,0.2)',
            borderRadius: 4,
            maxHeight: 300,
            overflow: 'auto',
          }}>
            {message}
          </pre>
        )}
      </details>

      {/* Suggestion */}
      {suggestion && (
        <div style={{
          fontSize: 11,
          color: 'var(--text-dim)',
          marginTop: 8,
          paddingLeft: 8,
          borderLeft: `2px solid ${style.border}`,
          lineHeight: 1.5,
        }}>
          {suggestion}
        </div>
      )}

      {/* Retry button */}
      {onRetry && (
        <div style={{ marginTop: 10 }}>
          <button
            onClick={onRetry}
            style={{
              fontSize: 11,
              padding: '4px 14px',
              borderRadius: 4,
              border: `1px solid ${style.badge}`,
              background: 'transparent',
              color: style.badge,
              cursor: 'pointer',
              fontWeight: 600,
              letterSpacing: 0.5,
            }}
          >
            RETRY
          </button>
        </div>
      )}
    </div>
  );
}
