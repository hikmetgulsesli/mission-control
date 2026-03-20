import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface PrdEditorProps {
  content: string;
  editMode: boolean;
  onChange: (content: string) => void;
}

export function PrdEditor({ content, editMode, onChange }: PrdEditorProps) {
  // Content is sanitized via DOMPurify before rendering
  const renderedHtml = useMemo(() => {
    if (!content) return '';
    const raw = marked.parse(content) as string;
    return DOMPurify.sanitize(raw, { FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'] });
  }, [content]);

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
    <div
      className="prd-editor__preview"
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}
