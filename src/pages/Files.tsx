import { useState, useCallback } from 'react';
import { api } from '../lib/api';
import { GlitchText } from '../components/GlitchText';
import { FileTree } from '../components/FileTree';
import { FileViewer } from '../components/FileViewer';
import { usePolling } from '../hooks/usePolling';

export function Files() {
  const [currentPath, setCurrentPath] = useState('/home/setrox/');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileData, setFileData] = useState<any>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const fetcher = useCallback(() => api.filesList(currentPath), [currentPath]);
  const { data: listing, error: listError, loading: listLoading, refresh } = usePolling(fetcher, 30000);

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    setSelectedFile(null);
    setFileData(null);
    setFileError(null);
  };

  const handleSelectFile = async (path: string) => {
    setSelectedFile(path);
    setFileLoading(true);
    setFileError(null);
    try {
      const data = await api.filesRead(path);
      setFileData(data);
    } catch (err: any) {
      setFileError(err.message || 'Failed to read file');
      setFileData(null);
    } finally {
      setFileLoading(false);
    }
  };

  // Build breadcrumb segments
  const pathParts = currentPath.split('/').filter(Boolean);
  const breadcrumbs = pathParts.map((part, i) => ({
    label: part,
    path: '/' + pathParts.slice(0, i + 1).join('/') + '/',
  }));

  return (
    <div className="files-page">
      <div className="files-page__top">
        <GlitchText text="FILES" tag="h2" />
        <button className="files-refresh-btn" onClick={refresh} title="Refresh">
          REFRESH
        </button>
      </div>
      <div className="files-breadcrumb">
        <button className="files-breadcrumb__seg" onClick={() => handleNavigate('/')}>
          /
        </button>
        {breadcrumbs.map((bc) => (
          <button
            key={bc.path}
            className={`files-breadcrumb__seg ${bc.path === currentPath ? 'files-breadcrumb__seg--active' : ''}`}
            onClick={() => handleNavigate(bc.path)}
          >
            {bc.label} /
          </button>
        ))}
      </div>
      <div className="files-page__panels">
        <div className="files-page__tree">
          {listLoading && !listing ? (
            <div className="file-tree__empty">Loading...</div>
          ) : listError ? (
            <div className="file-tree__empty file-tree__empty--error">{listError}</div>
          ) : (
            <FileTree
              entries={listing?.entries || []}
              currentPath={currentPath}
              selectedFile={selectedFile}
              onNavigate={handleNavigate}
              onSelectFile={handleSelectFile}
            />
          )}
        </div>
        <div className="files-page__viewer">
          <FileViewer file={fileData} loading={fileLoading} error={fileError} />
        </div>
      </div>
    </div>
  );
}
