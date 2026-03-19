import React, { useState } from "react";

interface Story {
  id: string;
  title: string;
  description?: string;
  acceptanceCriteria?: string[];
}

export interface StoryListProps {
  stories: Story[];
}

export const StoryList = React.memo(function StoryList({ stories }: StoryListProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (stories.length === 0) {
    return <div className="rd-empty">No stories found</div>;
  }

  return (
    <div className="rd-stories">
      {stories.map(story => (
        <div key={story.id} className="rd-story">
          <div
            className="rd-story-header"
            onClick={() => setExpanded(expanded === story.id ? null : story.id)}
          >
            <span className="rd-story-id">{story.id}</span>
            <span className="rd-story-title">{story.title}</span>
            <span className="rd-story-chevron">{expanded === story.id ? "\u25B2" : "\u25BC"}</span>
          </div>
          {expanded === story.id && (
            <div className="rd-story-body">
              {story.description && <p className="rd-story-desc">{story.description}</p>}
              {story.acceptanceCriteria && story.acceptanceCriteria.length > 0 && (
                <ul className="rd-story-criteria">
                  {story.acceptanceCriteria.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
});
