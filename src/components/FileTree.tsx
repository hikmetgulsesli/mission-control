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

export function FileTree({ entries, currentPath, selectedFile, onNavigate, onSelectFile }: FileTreeProps) {
  const parentPath = currentPath.replace(/\/[^/]+\/?$/, '/') || '/';
  const canGoUp = currentPath !== '/' && currentPath !== parentPath;

  return (
    <div className="file-tree">
      <div className="file-tree__header">
        {canGoUp && (
          <button className="file-tree__entry file-tree__entry--up" onClick={() => onNavigate(parentPath)}>
            <span className="file-tree__icon">..</span>
            <span className="file-tree__name">(parent)</span>
          </button>
        )}
      </div>
      <div className="file-tree__list">
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
