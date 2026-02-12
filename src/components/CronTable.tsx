import { format } from 'date-fns';
import type { CronJob } from '../lib/types';

interface Props {
  jobs: CronJob[];
  onToggle: (id: string) => void;
}

export function CronTable({ jobs, onToggle }: Props) {
  return (
    <div className="cron-table">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Schedule</th>
            <th>Channel</th>
            <th>Last Run</th>
            <th>Status</th>
            <th>Enabled</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map(job => (
            <tr key={job.id} className={job.state?.lastStatus === 'error' ? 'cron-table__row--error' : ''}>
              <td className="cron-table__name">{job.name}</td>
              <td className="cron-table__schedule">{job.schedule?.expr}</td>
              <td>{job.delivery?.channel || '-'}</td>
              <td>
                {job.state?.lastRunAtMs
                  ? format(new Date(job.state.lastRunAtMs), 'MMM d HH:mm')
                  : '-'}
              </td>
              <td>
                <span className={`cron-status cron-status--${job.state?.lastStatus || 'unknown'}`}>
                  {job.state?.lastStatus || 'pending'}
                </span>
                {job.state?.consecutiveErrors ? (
                  <span className="cron-errors"> ({job.state.consecutiveErrors}x)</span>
                ) : null}
              </td>
              <td>
                <button
                  className={`toggle-switch ${job.enabled ? 'toggle-switch--on' : 'toggle-switch--off'}`}
                  onClick={() => onToggle(job.id)}
                  aria-label={`Toggle ${job.name}`}
                >
                  <span className="toggle-switch__knob" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
