import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface PlanData {
  prd: string;
  stories: any[];
  rawOutput: string;
}

export function PlanViewer({ runId, onClose }: { runId: string; onClose: () => void }) {
  const [data, setData] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'prd' | 'stories' | 'raw'>('prd');

  useEffect(() => {
    api.runPlan(runId)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [runId]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal plan-viewer" onClick={(e) => e.stopPropagation()}>
        <div className="plan-viewer__header">
          <h3>PRD / Plan Document</h3>
          <button className="modal__close" onClick={onClose}>{"\u2715"}</button>
        </div>

        {loading ? (
          <div className="plan-viewer__loading">Loading plan...</div>
        ) : !data || (!data.prd && data.stories.length === 0) ? (
          <div className="plan-viewer__empty">No plan data available</div>
        ) : (
          <>
            <div className="plan-viewer__tabs">
              <button className={`plan-viewer__tab ${tab === 'prd' ? 'plan-viewer__tab--active' : ''}`} onClick={() => setTab('prd')}>PRD</button>
              <button className={`plan-viewer__tab ${tab === 'stories' ? 'plan-viewer__tab--active' : ''}`} onClick={() => setTab('stories')}>STORIES ({data.stories.length})</button>
              <button className={`plan-viewer__tab ${tab === 'raw' ? 'plan-viewer__tab--active' : ''}`} onClick={() => setTab('raw')}>RAW</button>
            </div>

            <div className="plan-viewer__body">
              {tab === 'prd' && (
                <div className="plan-viewer__prd">
                  {data.prd.split('\n').map((line, i) => {
                    if (line.match(/^#{1,3}\s/)) {
                      return <h4 key={i} className="plan-viewer__heading">{line.replace(/^#+\s*/, '')}</h4>;
                    }
                    if (line.match(/^[A-Z_]+:/)) {
                      const [key, ...val] = line.split(':');
                      return (
                        <div key={i} className="plan-viewer__field">
                          <span className="plan-viewer__key">{key}:</span>
                          <span className="plan-viewer__val">{val.join(':').trim()}</span>
                        </div>
                      );
                    }
                    if (line.trim() === '') return <br key={i} />;
                    return <p key={i} className="plan-viewer__text">{line}</p>;
                  })}
                </div>
              )}

              {tab === 'stories' && (
                <table className="plan-viewer__table">
                  <thead>
                    <tr><th>ID</th><th>Title</th><th>Status</th><th>Acceptance Criteria</th></tr>
                  </thead>
                  <tbody>
                    {data.stories.map((s: any) => (
                      <tr key={s.id}>
                        <td>{s.id}</td>
                        <td>{s.title}</td>
                        <td><span className={`plan-viewer__status plan-viewer__status--${s.status || 'pending'}`}>{(s.status || 'pending').toUpperCase()}</span></td>
                        <td>
                          {Array.isArray(s.acceptance_criteria) && s.acceptance_criteria.length > 0 ? (
                            <ul className="plan-viewer__ac">{s.acceptance_criteria.map((ac: any, i: number) => <li key={i}>{typeof ac === 'string' ? ac : JSON.stringify(ac)}</li>)}</ul>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === 'raw' && (
                <pre className="plan-viewer__raw">{data.rawOutput}</pre>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
