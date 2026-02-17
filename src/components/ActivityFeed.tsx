import { format, isValid } from 'date-fns';

const MAX_FEED_ITEMS = 15;

interface ActivityItem {
  agent?: string;
  message?: string;
  timestamp?: number;
  type?: string;
  [key: string]: any;
}

interface ActivityFeedProps {
  items: ActivityItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  if (!items.length) {
    return <div className="activity-feed activity-feed--empty">No recent activity</div>;
  }

  return (
    <div className="activity-feed">
      {items.slice(0, MAX_FEED_ITEMS).map((item, i) => (
        <div key={`${item.timestamp}-${item.agent}-${i}`} className="activity-feed__item">
          <span className="activity-feed__time">
            {item.timestamp && isValid(new Date(item.timestamp)) ? format(new Date(item.timestamp), 'HH:mm') : (item.icon || '•')}
          </span>
          <span className="activity-feed__text">
            {item.agent && <strong>{item.agent}: </strong>}
            {item.message || item.type || JSON.stringify(item).slice(0, 60)}
          </span>
        </div>
      ))}
    </div>
  );
}
