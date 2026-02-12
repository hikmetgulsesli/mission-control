import { format } from 'date-fns';

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
      {items.slice(0, 15).map((item, i) => (
        <div key={i} className="activity-feed__item">
          <span className="activity-feed__time">
            {item.timestamp ? format(new Date(item.timestamp), 'HH:mm') : (item.icon || '•')}
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
