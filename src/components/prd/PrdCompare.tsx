import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface PrdCompareProps {
  data: {
    prdA: { content: string; score: any; cost: any };
    prdB: { content: string; score: any; cost: any };
  } | null;
}

export function PrdCompare({ data }: PrdCompareProps) {
  // All HTML is sanitized via DOMPurify before rendering
  const htmlA = useMemo(() => {
    if (!data?.prdA?.content) return '';
    return DOMPurify.sanitize(marked.parse(data.prdA.content) as string, { FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'] });
  }, [data?.prdA?.content]);

  const htmlB = useMemo(() => {
    if (!data?.prdB?.content) return '';
    return DOMPurify.sanitize(marked.parse(data.prdB.content) as string, { FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'] });
  }, [data?.prdB?.content]);

  if (!data) {
    return (
      <div className="prd-empty">
        <p>Henuz A/B karsilastirma yapilmadi.</p>
        <p className="prd-empty__hint">"A/B" butonuna basarak iki farkli PRD yaklasimi olusturun.</p>
      </div>
    );
  }

  return (
    <div className="prd-compare">
      <div className="prd-compare__side">
        <div className="prd-compare__header">
          <h3>PRD-A: Minimal</h3>
          <div className="prd-compare__meta">
            <span className="prd-compare__score">Skor: {data.prdA.score?.total || '?'}</span>
            <span className="prd-compare__cost">{data.prdA.cost?.storyCount || '?'} story</span>
            <span className="prd-compare__cost">${data.prdA.cost?.tokenCost || '?'}</span>
            <span className="prd-compare__cost">{data.prdA.cost?.estimatedMinutes || '?'}dk</span>
          </div>
        </div>
        <div
          className="prd-editor__preview prd-compare__content"
          dangerouslySetInnerHTML={{ __html: htmlA }}
        />
      </div>
      <div className="prd-compare__side">
        <div className="prd-compare__header">
          <h3>PRD-B: Detayli</h3>
          <div className="prd-compare__meta">
            <span className="prd-compare__score">Skor: {data.prdB.score?.total || '?'}</span>
            <span className="prd-compare__cost">{data.prdB.cost?.storyCount || '?'} story</span>
            <span className="prd-compare__cost">${data.prdB.cost?.tokenCost || '?'}</span>
            <span className="prd-compare__cost">{data.prdB.cost?.estimatedMinutes || '?'}dk</span>
          </div>
        </div>
        <div
          className="prd-editor__preview prd-compare__content"
          dangerouslySetInnerHTML={{ __html: htmlB }}
        />
      </div>
    </div>
  );
}
