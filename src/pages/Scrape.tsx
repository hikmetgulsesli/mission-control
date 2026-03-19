import { useState, useEffect, useCallback } from 'react';

interface ScrapeResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: { url: string; status: number; elapsed_seconds: number; encoding: string };
}

interface HistoryItem {
  url: string;
  adaptor: string;
  status: 'success' | 'error';
  elapsed: number;
  timestamp: string;
  preview?: string;
}

export function Scrape() {
  const [url, setUrl] = useState('');
  const [adaptor, setAdaptor] = useState('auto');
  const [format, setFormat] = useState('json');
  const [selector, setSelector] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/scrape/history');
      const data = await res.json();
      setHistory(data);
    } catch {}
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function doScrape() {
    if (loading || !url.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), adaptor, format, selector: selector.trim() }),
      });
      const data: ScrapeResult = await res.json();
      setResult(data);
    } catch (e: any) {
      setResult({ success: false, error: e.message });
    }
    setLoading(false);
    loadHistory();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') doScrape();
  }

  return (
    <div className="scrape-page">
      <h2 className="glitch" data-text="SCRAPE">SCRAPE</h2>

      <div className="scrape-page__layout">
        <div className="scrape-page__main">
          {/* Form */}
          <div className="scrape-form">
            <div className="scrape-form__url-row">
              <input
                type="text"
                className="scrape-form__input"
                placeholder="https://example.com"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                aria-label="URL to scrape"
              />
              <button
                className="scrape-form__btn"
                onClick={doScrape}
                disabled={loading || !url.trim()}
              >
                {loading ? 'Scraping...' : 'Scrape'}
              </button>
            </div>
            <div className="scrape-form__options">
              <label className="scrape-form__field">
                <span>Adaptor</span>
                <select value={adaptor} onChange={e => setAdaptor(e.target.value)} aria-label="Scrape adaptor">
                  <option value="auto">Auto Detect</option>
                  <option value="amazon">Amazon</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="twitter">Twitter/X</option>
                  <option value="generic">Generic</option>
                </select>
              </label>
              <label className="scrape-form__field">
                <span>Format</span>
                <select value={format} onChange={e => setFormat(e.target.value)} aria-label="Output format">
                  <option value="json">JSON</option>
                  <option value="text">Text</option>
                  <option value="markdown">Markdown</option>
                </select>
              </label>
              <label className="scrape-form__field scrape-form__field--grow">
                <span>CSS Selector (optional)</span>
                <input
                  type="text"
                  placeholder="h1, .product-title, #content"
                  value={selector}
                  onChange={e => setSelector(e.target.value)}
                  spellCheck={false}
                />
              </label>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="scrape-loading">
              <div className="scrape-loading__spinner" />
              <span>Scraping {url}...</span>
            </div>
          )}

          {/* Result */}
          {result && !loading && (
            result.success ? (
              <div className="scrape-result">
                <div className="scrape-result__header">
                  <span className="scrape-result__title">
                    {result.data?.title || result.data?.adaptor || 'Result'}
                  </span>
                  <div className="scrape-result__meta">
                    <span className="scrape-result__badge scrape-result__badge--ok">
                      {result.metadata?.status || '?'}
                    </span>
                    <span>{result.metadata?.elapsed_seconds}s</span>
                    <span className="scrape-result__url">{result.metadata?.url}</span>
                  </div>
                </div>
                <pre className="scrape-result__body">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="scrape-error">
                <span className="scrape-error__icon">!</span>
                <span>{result.error || 'Unknown error'}</span>
              </div>
            )
          )}
        </div>

        {/* History sidebar */}
        <div className="scrape-history">
          <h3 className="scrape-history__title">HISTORY</h3>
          <div className="scrape-history__list">
            {history.length === 0 ? (
              <div className="scrape-history__empty">No scrapes yet</div>
            ) : (
              history.map((h, i) => {
                const time = new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const shortUrl = h.url.length > 35 ? h.url.slice(0, 32) + '...' : h.url;
                return (
                  <div
                    key={i}
                    className={`scrape-history__item scrape-history__item--${h.status}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setUrl(h.url)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setUrl(h.url); } }}
                    title={h.url}
                  >
                    <div className="scrape-history__item-url">{shortUrl}</div>
                    <div className="scrape-history__item-meta">
                      <span className={`scrape-history__dot scrape-history__dot--${h.status}`} />
                      <span>{h.elapsed}s</span>
                      <span>{time}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
