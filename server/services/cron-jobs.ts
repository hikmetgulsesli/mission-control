import { readFileSync } from 'fs';
import { config } from '../config.js';
import { cached } from '../utils/cache.js';

interface ConfiguredCronJob {
  enabled: boolean;
  [key: string]: unknown;
}

// Both display consumers retain the existing last-good/TTL cache policy.
// Toggle authority is intentionally read separately and never uses this cache.
export function readConfiguredCronJobs(
  readJobs: () => unknown = () => JSON.parse(readFileSync(config.jobsJson, 'utf-8')).jobs,
): Promise<ConfiguredCronJob[]> {
  return cached('cron', 30000, async () => {
    const jobs = readJobs();
    if (!Array.isArray(jobs) || jobs.some(job => !job || typeof job !== 'object'
      || Array.isArray(job) || typeof job.enabled !== 'boolean')) {
      throw new Error('Invalid cron jobs');
    }
    return jobs;
  });
}
