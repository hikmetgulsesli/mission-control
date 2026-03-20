import { useRef, useEffect } from 'react';

interface AnalysisLogProps {
  logs: string[];
}

export function AnalysisLog({ logs }: AnalysisLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (logs.length === 0) return null;

  return (
    <div className="prd-log">
      <label className="prd-label">Log</label>
      <div className="prd-log__content" ref={scrollRef}>
        {logs.map((log, i) => (
          <div key={i} className="prd-log__line">{log}</div>
        ))}
      </div>
    </div>
  );
}
