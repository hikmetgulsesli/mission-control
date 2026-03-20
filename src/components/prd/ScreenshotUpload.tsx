import { useRef } from 'react';

interface ScreenshotUploadProps {
  onUpload: (base64: string, filename: string) => void;
  loading: boolean;
}

export function ScreenshotUpload({ onUpload, loading }: ScreenshotUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      onUpload(base64, file.name);
    };
    reader.readAsDataURL(file);

    // Reset input
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="prd-input-group">
      <label className="prd-label">Screenshot</label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        style={{ display: 'none' }}
      />
      <button
        className="btn btn--small"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
      >
        {loading ? 'Analiz ediliyor...' : 'Gorsel Yukle'}
      </button>
    </div>
  );
}
