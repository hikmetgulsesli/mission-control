import { Router } from 'express';
import { execFile, execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { checkSsrf } from '../utils/ssrf.js';

const router = Router();

const HOME = process.env.HOME ?? '/home/setrox';
const SCRAPE_PYTHON = join(HOME, 'libs', 'scrapling', '.venv', 'bin', 'python');
const SCRAPE_SCRIPT = join(HOME, 'libs', 'scrapling', 'scrape-api.py');
const SCRAPE_CWD = join(HOME, 'libs', 'scrapling');

interface ScrapeHistoryEntry {
  url: string;
  adaptor: string;
  status: 'success' | 'error';
  elapsed: number;
  timestamp: string;
  preview?: string;
}

const scrapeHistory: ScrapeHistoryEntry[] = [];
const SCRAPE_HISTORY_MAX = 50;

const SCRAPE_ADAPTORS = [
  { id: 'auto', name: 'Auto Detect' },
  { id: 'amazon', name: 'Amazon' },
  { id: 'linkedin', name: 'LinkedIn' },
  { id: 'twitter', name: 'Twitter/X' },
  { id: 'github', name: 'GitHub' },
  { id: 'generic', name: 'Generic' },
];

/** GitHub adaptor — uses shared async service */
async function scrapeGitHub(url: string): Promise<{ success: boolean; data?: any; error?: string }> {
  const { scrapeGitHubRepo } = await import('../services/github-scraper.js');
  const data = await scrapeGitHubRepo(url);
  if (!data) return { success: false, error: 'GitHub repo not found or gh CLI not authenticated' };
  return { success: true, data: { ...data, adaptor: 'github', source: 'gh-api' } };
}

function runScrape(input: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      SCRAPE_PYTHON,
      [SCRAPE_SCRIPT],
      {
        cwd: SCRAPE_CWD,
        env: { ...process.env, PYTHONPATH: SCRAPE_CWD },
        timeout: 30_000,
        maxBuffer: 5 * 1024 * 1024,
      },
      (err, stdout, stderr) => {
        if (err) {
          if (stdout) return resolve({ stdout, stderr });
          return reject(err);
        }
        resolve({ stdout, stderr });
      },
    );
    child.stdin?.write(input);
    child.stdin?.end();
  });
}

router.post('/scrape', async (req, res) => {
  try {
    const { url, adaptor, selector, format } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    // SSRF protection: block internal/private URLs, bad schemes, IPv6 loopback
    const ssrfError = checkSsrf(url);
    if (ssrfError) {
      return res.status(400).json({ success: false, error: ssrfError });
    }

    // GitHub adaptor: use gh API instead of HTML scraping
    const resolvedAdaptor = adaptor ?? 'auto';
    const isGitHub = resolvedAdaptor === 'github' || (resolvedAdaptor === 'auto' && /github\.com\/[^\/]+\/[^\/]/.test(url));
    if (isGitHub) {
      const ghResult = await scrapeGitHub(url);
      const entry: ScrapeHistoryEntry = {
        url,
        adaptor: 'github',
        status: ghResult.success ? 'success' : 'error',
        elapsed: 0,
        timestamp: new Date().toISOString(),
        preview: ghResult.success ? (ghResult.data?.name || url).slice(0, 80) : (ghResult.error || 'Unknown error').slice(0, 80),
      };
      scrapeHistory.unshift(entry);
      if (scrapeHistory.length > SCRAPE_HISTORY_MAX) scrapeHistory.length = SCRAPE_HISTORY_MAX;
      return res.json(ghResult);
    }

    const input = JSON.stringify({
      url,
      adaptor: adaptor ?? 'auto',
      selector: selector ?? '',
      format: format ?? 'json',
    });
    const { stdout } = await runScrape(input);
    const result = JSON.parse(stdout);

    const entry: ScrapeHistoryEntry = {
      url,
      adaptor: adaptor ?? 'auto',
      status: result.success ? 'success' : 'error',
      elapsed: result.metadata?.elapsed_seconds ?? 0,
      timestamp: new Date().toISOString(),
      preview: result.success
        ? (result.data?.title || result.data?.product?.title || url).slice(0, 80)
        : (result.error || 'Unknown error').slice(0, 80),
    };
    scrapeHistory.unshift(entry);
    if (scrapeHistory.length > SCRAPE_HISTORY_MAX) scrapeHistory.length = SCRAPE_HISTORY_MAX;

    res.json(result);
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message ?? 'Scrape failed' });
  }
});

router.get('/scrape/adaptors', (_req, res) => {
  res.json(SCRAPE_ADAPTORS);
});

router.get('/scrape/history', (_req, res) => {
  res.json(scrapeHistory);
});

export default router;
