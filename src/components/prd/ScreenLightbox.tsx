import { useState, useEffect, useCallback } from 'react';

interface Screen {
  id: string;
  name: string;
  status: string;
  screenshotUrl?: string;
  htmlUrl?: string;
  localHtml?: string;
  width?: number;
  height?: number;
  prompt?: string;
  parentScreenId?: string;
}

interface ScreenLightboxProps {
  screen: Screen;
  screens: Screen[];
  onClose: () => void;
  onDelete: (screenId: string) => void;
  onRegenerate: (screenId: string) => void;
  onEditPrompt: (screenId: string, newPrompt: string) => void;
  onVariant: (screenId: string) => void;
  onNavigate: (screenId: string) => void;
  loading?: boolean;
}

export function ScreenLightbox({
  screen,
  screens,
  onClose,
  onDelete,
  onRegenerate,
  onEditPrompt,
  onVariant,
  onNavigate,
  loading,
}: ScreenLightboxProps) {
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptText, setPromptText] = useState(screen.prompt || '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const currentIndex = screens.findIndex(s => s.id === screen.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < screens.length - 1;

  // Reset state when screen changes
  useEffect(() => {
    setEditingPrompt(false);
    setPromptText(screen.prompt || '');
    setConfirmDelete(false);
  }, [screen.id, screen.prompt]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (editingPrompt) return;
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft' && hasPrev) onNavigate(screens[currentIndex - 1].id);
    if (e.key === 'ArrowRight' && hasNext) onNavigate(screens[currentIndex + 1].id);
  }, [editingPrompt, hasPrev, hasNext, currentIndex, screens, onClose, onNavigate]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handlePromptSubmit = () => {
    if (promptText.trim()) {
      onEditPrompt(screen.id, promptText.trim());
      setEditingPrompt(false);
    }
  };

  return (
    <div className="screen-lightbox" onClick={onClose}>
      <div className="screen-lightbox__container" onClick={e => e.stopPropagation()}>
        {/* Navigation arrows */}
        {hasPrev && (
          <button
            className="screen-lightbox__nav screen-lightbox__nav--prev"
            onClick={() => onNavigate(screens[currentIndex - 1].id)}
          >
            &lt;
          </button>
        )}
        {hasNext && (
          <button
            className="screen-lightbox__nav screen-lightbox__nav--next"
            onClick={() => onNavigate(screens[currentIndex + 1].id)}
          >
            &gt;
          </button>
        )}

        {/* Close button */}
        <button className="screen-lightbox__close" onClick={onClose}>x</button>

        {/* Preview — HTML iframe preferred over PNG thumbnail */}
        <div className="screen-lightbox__preview">
          {loading ? (
            <div className="screen-lightbox__loading">Yukleniyor...</div>
          ) : screen.htmlUrl ? (
            <iframe src={screen.htmlUrl} title={screen.name} sandbox="allow-scripts allow-same-origin" />
          ) : screen.screenshotUrl ? (
            <a href={screen.screenshotUrl} target="_blank" rel="noopener noreferrer">
              <img src={screen.screenshotUrl} alt={screen.name} />
            </a>
          ) : (
            <div className="screen-lightbox__placeholder">Onizleme mevcut degil</div>
          )}
        </div>

        {/* Info panel */}
        <div className="screen-lightbox__info">
          <div className="screen-lightbox__meta">
            <h3>{screen.name}</h3>
            <div className="screen-lightbox__meta-row">
              <span className={`prd-mockup-card__status prd-mockup-card__status--${screen.status}`}>
                {screen.status}
              </span>
              {screen.width && screen.height && (
                <span className="screen-lightbox__size">{screen.width}x{screen.height}</span>
              )}
              {screen.parentScreenId && (
                <span className="screen-lightbox__variant-badge">Varyant</span>
              )}
              <span className="screen-lightbox__counter">{currentIndex + 1}/{screens.length}</span>
            </div>
          </div>

          {/* Prompt edit area */}
          {editingPrompt ? (
            <div className="screen-lightbox__prompt-edit">
              <textarea
                className="prd-textarea"
                value={promptText}
                onChange={e => setPromptText(e.target.value)}
                rows={4}
                autoFocus
              />
              <div className="screen-lightbox__prompt-actions">
                <button className="btn btn--small btn--primary" onClick={handlePromptSubmit}>Uret</button>
                <button className="btn btn--small" onClick={() => setEditingPrompt(false)}>Iptal</button>
              </div>
            </div>
          ) : screen.prompt ? (
            <div className="screen-lightbox__prompt">
              <span className="prd-label">Prompt</span>
              <p>{screen.prompt.length > 200 ? screen.prompt.slice(0, 200) + '...' : screen.prompt}</p>
            </div>
          ) : null}

          {/* Action buttons */}
          <div className="screen-lightbox__actions">
            {confirmDelete ? (
              <>
                <span className="screen-lightbox__confirm-text">Silinsin mi?</span>
                <button className="btn btn--small btn--danger" onClick={() => onDelete(screen.id)}>Evet, Sil</button>
                <button className="btn btn--small" onClick={() => setConfirmDelete(false)}>Iptal</button>
              </>
            ) : (
              <>
                <button className="btn btn--small btn--danger" onClick={() => setConfirmDelete(true)} disabled={loading}>Sil</button>
                <button className="btn btn--small" onClick={() => onRegenerate(screen.id)} disabled={loading}>Degistir</button>
                <button className="btn btn--small" onClick={() => setEditingPrompt(true)} disabled={loading}>Duzenle & Uret</button>
                <button className="btn btn--small" onClick={() => onVariant(screen.id)} disabled={loading}>Varyant</button>
                {screen.htmlUrl && (
                  <a href={screen.htmlUrl} target="_blank" rel="noopener noreferrer" className="btn btn--small">Yeni Sekmede Ac</a>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
