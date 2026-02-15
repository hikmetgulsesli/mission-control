import { useEffect, useState } from 'react';
import { api } from '../lib/api';

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

  useEffect(() => {
    api.runStories(runId)
      .then((data) => { setStories(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [runId]);

  if (loading) return <div className="story-checklist__loading">Loading stories...</div>;
  if (stories.length === 0) return <div className="story-checklist__empty">No stories found</div>;

  return (
    <div className="story-checklist">
      {stories.map((story) => (
        <div key={story.id} className={`story-checklist__item story-checklist__item--${story.status}`}>
          <div className="story-checklist__row">
            <span className="story-checklist__check">
              {story.status === 'done' ? '\u2713' : story.status === 'running' ? '\u25CB' : story.status === 'failed' ? '\u2717' : '\u25CB'}
            </span>
            <span className={`story-checklist__title story-checklist__title--${story.status}`}>
              {story.id}: {story.title}
            </span>
            {(story.retry_count || 0) > 0 && (
              <span className="story-checklist__retry-badge">R{story.retry_count}</span>
            )}
            {story.status === 'failed' && onRetry && (
              <button className="btn btn--small btn--danger story-checklist__retry-btn" onClick={() => onRetry(story.id)}>
                RETRY
              </button>
            )}
          </div>
          {story.acceptance_criteria && Array.isArray(story.acceptance_criteria) && story.acceptance_criteria.length > 0 && (
            <ul className="story-checklist__criteria">
              {story.acceptance_criteria.map((ac, i) => (
                <li key={i}>{typeof ac === 'string' ? ac : JSON.stringify(ac)}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
