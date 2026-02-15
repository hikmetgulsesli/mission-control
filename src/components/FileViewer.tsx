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
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function FileViewer({ file, loading, error }: FileViewerProps) {
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
      </div>
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
    </div>
  );
}
