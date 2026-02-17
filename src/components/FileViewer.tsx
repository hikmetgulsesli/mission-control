import { useRef, useCallback } from 'react';

interface FileData {
  path: string;
  name: string;
  dir: string;
  size: number;
  mtime: string;
  lines: number;
  content: string;
}

interface FileViewerProps {
  file: FileData | null;
  loading: boolean;
  error: string | null;
  editMode?: boolean;
  editContent?: string;
  onEditChange?: (content: string) => void;
  onSave?: () => void;
  onCancel?: () => void;
  onUndo?: () => void;
  onStartEdit?: () => void;
  onDownload?: () => void;
  saving?: boolean;
  hasChanges?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function FileViewer({ file, loading, error, editMode, editContent, onEditChange, onSave, onCancel, onUndo, onStartEdit, onDownload, saving, hasChanges }: FileViewerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const val = ta.value;
      const newVal = val.substring(0, start) + '  ' + val.substring(end);
      if (onEditChange) onEditChange(newVal);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (onSave && hasChanges) onSave();
    }
  }, [onEditChange, onSave, hasChanges]);

  if (loading) {
    return (
      <div className="file-viewer">
        <div className="file-viewer__empty">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="file-viewer">
        <div className="file-viewer__empty file-viewer__empty--error">ERROR: {error}</div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="file-viewer">
        <div className="file-viewer__empty">FILE:// Select a file to view</div>
      </div>
    );
  }

  const lines = file.content.split('\n');
  const lineNumWidth = String(lines.length).length;

  return (
    <div className="file-viewer">
      <div className="file-viewer__header">
        <span className="file-viewer__filename">{file.name}</span>
        <span className="file-viewer__info">
          {formatSize(file.size)} | {file.lines} lines | {new Date(file.mtime).toLocaleString()}
        </span>
        <span className="file-viewer__actions">
          {!editMode && onStartEdit && (
            <button className="file-viewer__action-btn" onClick={onStartEdit}>Duzenle</button>
          )}
          {onDownload && (
            <button className="file-viewer__action-btn" onClick={onDownload}>Indir</button>
          )}
        </span>
      </div>
      {editMode ? (
        <>
          <div className="file-viewer__toolbar">
            <button
              className={`file-viewer__toolbar-btn file-viewer__toolbar-btn--save ${hasChanges ? 'file-viewer__toolbar-btn--active' : ''}`}
              onClick={onSave}
              disabled={saving || !hasChanges}
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
            <button className="file-viewer__toolbar-btn" onClick={onUndo} disabled={!hasChanges}>
              Geri Al
            </button>
            <button className="file-viewer__toolbar-btn" onClick={onCancel}>
              Iptal
            </button>
          </div>
          <textarea
            ref={textareaRef}
            className="file-viewer__editor"
            value={editContent ?? ''}
            onChange={(e) => onEditChange?.(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoFocus
          />
        </>
      ) : (
        <div className="file-viewer__content">
          <div className="file-viewer__lines">
            {lines.map((_, i) => (
              <span key={i} className="file-viewer__line-num">
                {String(i + 1).padStart(lineNumWidth, ' ')}
              </span>
            ))}
          </div>
          <pre className="file-viewer__code">
            {lines.map((line, i) => (
              <span key={i} className="file-viewer__code-line">{line}{'\n'}</span>
            ))}
          </pre>
        </div>
      )}
    </div>
  );
}
