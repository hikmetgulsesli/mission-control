interface FileEntry {
  name: string;
  type: 'directory' | 'file';
  size: number;
  mtime: string;
}

interface FileTreeProps {
  entries: FileEntry[];
  currentPath: string;
  selectedFile: string | null;
  onNavigate: (path: string) => void;
  onSelectFile: (path: string) => void;
  onContextMenu?: (x: number, y: number, target: { path: string; name: string; isDir: boolean } | null) => void;
  onNewFile?: () => void;
  onNewDir?: () => void;
  onUpload?: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hr = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mon}-${day} ${hr}:${min}`;
}

export function FileTree({ entries, currentPath, selectedFile, onNavigate, onSelectFile, onContextMenu, onNewFile, onNewDir, onUpload }: FileTreeProps) {
  const parentPath = currentPath.replace(/\/[^/]+\/?$/, '/') || '/';
  const canGoUp = currentPath !== '/' && currentPath !== parentPath;

  const handleEntryContext = (e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onContextMenu) return;
    const fullPath = currentPath.endsWith('/')
      ? currentPath + entry.name
      : currentPath + '/' + entry.name;
    onContextMenu(e.clientX, e.clientY, { path: fullPath, name: entry.name, isDir: entry.type === 'directory' });
  };

  const handleEmptyContext = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!onContextMenu) return;
    onContextMenu(e.clientX, e.clientY, null);
  };

  return (
    <div className="file-tree">
      <div className="file-tree__toolbar">
        {onNewFile && <button className="file-tree__toolbar-btn" onClick={onNewFile} title="Yeni Dosya">+ Dosya</button>}
        {onNewDir && <button className="file-tree__toolbar-btn" onClick={onNewDir} title="Yeni Dizin">+ Dizin</button>}
        {onUpload && <button className="file-tree__toolbar-btn" onClick={onUpload} title="Yukle">Yukle</button>}
      </div>
      <div className="file-tree__header">
        {canGoUp && (
          <button className="file-tree__entry file-tree__entry--up" onClick={() => onNavigate(parentPath)}>
            <span className="file-tree__icon">..</span>
            <span className="file-tree__name">(parent)</span>
          </button>
        )}
      </div>
      <div className="file-tree__list" onContextMenu={handleEmptyContext}>
        {entries.map((entry) => {
          const fullPath = currentPath.endsWith('/')
            ? currentPath + entry.name
            : currentPath + '/' + entry.name;
          const isDir = entry.type === 'directory';
          const isActive = selectedFile === fullPath;

          return (
            <button
              key={entry.name}
              className={`file-tree__entry ${isDir ? 'file-tree__entry--dir' : ''} ${isActive ? 'file-tree__entry--active' : ''}`}
              onClick={() => isDir ? onNavigate(fullPath + '/') : onSelectFile(fullPath)}
              onContextMenu={(e) => handleEntryContext(e, entry)}
            >
              <span className="file-tree__icon">{isDir ? '>' : ' '}</span>
              <span className="file-tree__name">{entry.name}{isDir ? '/' : ''}</span>
              <span className="file-tree__meta">
                {!isDir && <span className="file-tree__size">{formatSize(entry.size)}</span>}
                <span className="file-tree__date">{formatDate(entry.mtime)}</span>
              </span>
            </button>
          );
        })}
        {entries.length === 0 && (
          <div className="file-tree__empty">Empty directory</div>
        )}
      </div>
    </div>
  );
}
