import { useMemo, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface PrdEditorProps {
  content: string;
  editMode: boolean;
  onChange: (content: string) => void;
  previousContent?: string;
}

// DOMPurify sanitizes all HTML output before rendering to prevent XSS
const SANITIZE_OPTS = { FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'] };

export function PrdEditor({ content, editMode, onChange, previousContent }: PrdEditorProps) {
  const [showDiff, setShowDiff] = useState(true);

  const renderedHtml = useMemo(() => {
    if (!content) return '';
    const raw = marked.parse(content) as string;
    return DOMPurify.sanitize(raw, SANITIZE_OPTS);
  }, [content]);

  // Diff view: highlight new lines with green border
  const diffHtml = useMemo(() => {
    if (!previousContent || !content || previousContent === content) return '';
    const oldLines = new Set(previousContent.split('\n').map(l => l.trim()).filter(Boolean));
    const newLines = content.split('\n');
    const parts: string[] = [];
    for (const line of newLines) {
      const trimmed = line.trim();
      if (trimmed && !oldLines.has(trimmed)) {
        const html = DOMPurify.sanitize(marked.parse(line) as string, SANITIZE_OPTS);
        parts.push('<div class="prd-diff-added">' + html + '</div>');
      } else {
        parts.push(DOMPurify.sanitize(marked.parse(line) as string, SANITIZE_OPTS));
      }
    }
    return parts.join('');
  }, [content, previousContent]);

  const hasDiff = !!previousContent && previousContent !== content;

  if (editMode) {
    return (
      <textarea
        className="prd-editor__textarea"
        value={content}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
    );
  }

  return (
    <div>
      {hasDiff && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
          <button
            className={"btn btn--tiny" + (showDiff ? " btn--primary" : "")}
            onClick={() => setShowDiff(!showDiff)}
          >{showDiff ? 'DIFF KAPAT' : 'DIFF GOSTER'}</button>
          <span style={{ fontSize: '10px', color: 'var(--neon-green)', fontFamily: 'var(--font)' }}>
            Yeni eklenen bolumler yesil ile isaretli
          </span>
        </div>
      )}
      <div
        className="prd-editor__preview"
        dangerouslySetInnerHTML={{ __html: showDiff && hasDiff ? diffHtml : renderedHtml }}
      />
    </div>
  );
}
