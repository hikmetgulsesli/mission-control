import { useRef, useState, useCallback } from 'react';

interface VisionAnalysis {
  colors?: Record<string, string>;
  typography?: { headingFont?: string; bodyFont?: string; sizes?: string };
  components?: string[];
  layout?: string;
  spacing?: string;
  suggestedTitle?: string;
  style?: string;
  sections?: string[];
  suggestions?: string[];
}

interface ScreenshotUploadProps {
  onUpload: (base64: string, filename: string) => void;
  loading: boolean;
  visionAnalysis?: VisionAnalysis | null;
}

export function ScreenshotUpload({ onUpload, loading, visionAnalysis }: ScreenshotUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      const base64 = dataUrl.split(',')[1];
      onUpload(base64, file.name);
    };
    reader.readAsDataURL(file);
  }, [onUpload]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const colorEntries = visionAnalysis?.colors
    ? Object.entries(visionAnalysis.colors).filter(([, v]) => typeof v === 'string' && v.startsWith('#'))
    : [];

  return (
    <div className="prd-input-group">
      <label className="prd-label">Screenshot</label>

      {/* Dropzone */}
      <div
        className="ss-dropzone"
        style={{
          border: `2px dashed ${isDragOver ? 'var(--neon-cyan)' : 'var(--border)'}`,
          borderRadius: 8,
          padding: preview ? '8px' : '24px 16px',
          textAlign: 'center',
          background: isDragOver ? 'rgba(0, 255, 255, 0.05)' : 'var(--bg-card)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          marginBottom: 8,
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !loading && inputRef.current?.click()}
      >
        {loading ? (
          <span style={{ color: 'var(--neon-cyan)', fontSize: 13 }}>Analiz ediliyor...</span>
        ) : preview ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img
              src={preview}
              alt="Preview"
              style={{
                maxWidth: 120,
                maxHeight: 80,
                borderRadius: 6,
                border: '1px solid var(--border)',
                objectFit: 'cover',
              }}
            />
            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
              Yeni gorsel yuklemek icin tikla veya birak
            </span>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 28, marginBottom: 6, opacity: 0.5 }}>&#128247;</div>
            <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              Gorseli buraya birakin veya tiklayin
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 4, opacity: 0.6 }}>
              PNG, JPG, WebP
            </div>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        style={{ display: 'none' }}
      />

      {/* Vision Analysis Summary */}
      {visionAnalysis && !loading && (
        <div
          className="ss-vision-summary"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '12px 14px',
            marginTop: 4,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--neon-cyan)', marginBottom: 8, letterSpacing: 1 }}>
            VISION ANALYSIS
          </div>

          {/* Color swatches */}
          {colorEntries.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Renkler</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {colorEntries.map(([name, hex]) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        background: hex,
                        border: '1px solid var(--border)',
                      }}
                      title={`${name}: ${hex}`}
                    />
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{hex}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Typography */}
          {visionAnalysis.typography && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2 }}>Tipografi</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary, #ccc)' }}>
                {visionAnalysis.typography.headingFont && <span>Heading: {visionAnalysis.typography.headingFont} </span>}
                {visionAnalysis.typography.bodyFont && <span>| Body: {visionAnalysis.typography.bodyFont}</span>}
              </div>
            </div>
          )}

          {/* Components */}
          {visionAnalysis.components && visionAnalysis.components.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Komponentler</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {visionAnalysis.components.slice(0, 12).map((c, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'rgba(0, 255, 255, 0.08)',
                      border: '1px solid rgba(0, 255, 255, 0.2)',
                      color: 'var(--neon-cyan)',
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Layout & Style */}
          {(visionAnalysis.layout || visionAnalysis.style || visionAnalysis.spacing) && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              {visionAnalysis.layout && <div>Layout: {visionAnalysis.layout}</div>}
              {visionAnalysis.style && <div>Stil: {visionAnalysis.style}</div>}
              {visionAnalysis.spacing && <div>Spacing: {visionAnalysis.spacing}</div>}
            </div>
          )}

          {/* Suggested Title */}
          {visionAnalysis.suggestedTitle && (
            <div style={{ fontSize: 11, color: 'var(--neon-green, #00ff41)', marginTop: 6 }}>
              Onerilen baslik: {visionAnalysis.suggestedTitle}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
