import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

interface PrdHistoryProps {
  onSelect: (prd: any) => void;
  onClose: () => void;
  templatesMode?: boolean;
}

export function PrdHistory({ onSelect, onClose, templatesMode }: PrdHistoryProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = templatesMode ? await api.prdTemplates() : await api.prdHistory();
        setItems(data);
      } catch (err) {
        console.error('Failed to load PRD history/templates:', err);
      }
      setLoading(false);
    })();
  }, [templatesMode]);

  return (
    <div className="prd-modal-overlay" onClick={onClose}>
      <div className="prd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="prd-modal__header">
          <h2>{templatesMode ? 'Sablonlar' : 'PRD Gecmisi'}</h2>
          <button className="prd-modal__close" onClick={onClose}>x</button>
        </div>
        <div className="prd-modal__body">
          {loading ? (
            <div className="prd-empty">Yukleniyor...</div>
          ) : items.length === 0 ? (
            <div className="prd-empty">
              {templatesMode ? 'Sablon bulunamadi.' : 'Gecmis PRD yok.'}
            </div>
          ) : (
            <div className="prd-history-list">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="prd-history-item"
                  onClick={() => onSelect(item)}
                >
                  <div className="prd-history-item__title">
                    {item.title || item.name}
                  </div>
                  <div className="prd-history-item__meta">
                    {item.platform && <span className="prd-history-item__tag">{item.platform}</span>}
                    {item.category && <span className="prd-history-item__tag">{item.category}</span>}
                    {item.score != null && <span className="prd-history-item__score">Skor: {item.score}</span>}
                    {item.prd_version && <span className="prd-history-item__version">v{item.prd_version}</span>}
                    {item.created_at && (
                      <span className="prd-history-item__date">
                        {new Date(item.created_at).toLocaleDateString('tr-TR')}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <div className="prd-history-item__desc">{item.description}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
