import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { normalizeVisibleWorkflowStatus } from '../lib/status';

interface Story {
  id: string;
  title: string;
  status: string;
  acceptance_criteria?: string[];
  retry_count?: number;
}

export function StoryChecklist({ runId, onRetry }: { runId: string; onRetry?: (storyId: string) => void }) {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStories = useCallback(() => {
    api.runStories(runId)
      .then((data) => { setStories(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [runId]);

  useEffect(() => {
    fetchStories();
    const id = setInterval(fetchStories, 10_000);
    return () => clearInterval(id);
  }, [fetchStories]);

  if (loading) return <div className="story-checklist__loading">Loading stories...</div>;
  if (stories.length === 0) return <div className="story-checklist__empty">No stories found</div>;

  return (
    <div className="story-checklist">
      {stories.map((story) => {
        const storyStatus = normalizeVisibleWorkflowStatus(story.status);
        return (
          <div key={story.id} className={`story-checklist__item story-checklist__item--${storyStatus}`}>
            <div className="story-checklist__row">
              <span className="story-checklist__check">
                {storyStatus === 'done' ? '\u2713' : storyStatus === 'running' ? '\u25CB' : storyStatus === 'failed' ? '\u2717' : '\u25CB'}
              </span>
              <span className={`story-checklist__title story-checklist__title--${storyStatus}`}>
                {story.id}: {story.title}
              </span>
              {(story.retry_count || 0) > 0 && (
                <span className="story-checklist__retry-badge">R{story.retry_count}</span>
              )}
              {storyStatus === 'failed' && onRetry && (
                <button className="btn btn--small btn--danger story-checklist__retry-btn" onClick={() => onRetry(story.id)}>
                  RETRY
                </button>
              )}
            </div>
            {story.acceptance_criteria && Array.isArray(story.acceptance_criteria) && story.acceptance_criteria.length > 0 && (
              <ul className="story-checklist__criteria">
                {story.acceptance_criteria.map((ac, i) => (
                  <li key={`ac-${i}`}>{typeof ac === 'string' ? ac : JSON.stringify(ac)}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
