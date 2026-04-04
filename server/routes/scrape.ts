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

/** GitHub adaptor — fetch repo metadata via `gh api` CLI */
async function scrapeGitHub(url: string): Promise<{ success: boolean; data?: any; error?: string }> {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
  if (!match) return { success: false, error: 'Could not parse owner/repo from GitHub URL' };
  const [, owner, rawRepo] = match;
  const repo = rawRepo.replace(/\.git$/, '');

  function ghApi(endpoint: string): any {
    try {
      const out = execFileSync('gh', ['api', endpoint, '--cache', '1h'], {
        timeout: 15_000,
        maxBuffer: 2 * 1024 * 1024,
        encoding: 'utf8',
      });
      return JSON.parse(out);
    } catch {
      return null;
    }
  }

  const repoData = ghApi(`repos/${owner}/${repo}`);
  if (!repoData) return { success: false, error: `GitHub repo ${owner}/${repo} not found or gh CLI not authenticated` };

  // README
  let readmeText = '';
  const readmeData = ghApi(`repos/${owner}/${repo}/readme`);
  if (readmeData?.content) {
    try { readmeText = Buffer.from(readmeData.content, 'base64').toString('utf8'); } catch {}
  }

  // package.json (optional)
  let dependencies: Record<string, string> = {};
  let devDependencies: Record<string, string> = {};
  const pkgData = ghApi(`repos/${owner}/${repo}/contents/package.json`);
  if (pkgData?.content) {
    try {
      const pkg = JSON.parse(Buffer.from(pkgData.content, 'base64').toString('utf8'));
      dependencies = pkg.dependencies || {};
      devDependencies = pkg.devDependencies || {};
    } catch {}
  }

  // Detect tech stack from dependencies
  const allDeps = { ...dependencies, ...devDependencies };
  const techStack: string[] = [];
  const stackMap: Record<string, string> = {
    react: 'React', next: 'Next.js', vue: 'Vue', nuxt: 'Nuxt', svelte: 'Svelte',
    express: 'Express', fastify: 'Fastify', 'hono': 'Hono', koa: 'Koa',
    tailwindcss: 'Tailwind CSS', typescript: 'TypeScript', prisma: 'Prisma',
    drizzle: 'Drizzle', mongoose: 'Mongoose', sequelize: 'Sequelize',
    'react-native': 'React Native', electron: 'Electron', vite: 'Vite',
    webpack: 'Webpack', jest: 'Jest', vitest: 'Vitest', playwright: 'Playwright',
  };
  for (const [dep, label] of Object.entries(stackMap)) {
    if (allDeps[dep]) techStack.push(label);
  }

  return {
    success: true,
    data: {
      name: repoData.full_name,
      description: repoData.description || '',
      language: repoData.language || '',
      topics: repoData.topics || [],
      stars: repoData.stargazers_count ?? 0,
      forks: repoData.forks_count ?? 0,
      openIssues: repoData.open_issues_count ?? 0,
      license: repoData.license?.spdx_id || '',
      homepage: repoData.homepage || '',
      defaultBranch: repoData.default_branch || 'main',
      readme: readmeText.slice(0, 3000),
      dependencies,
      devDependencies,
      techStack,
      url: repoData.html_url,
      adaptor: 'github',
      source: 'gh-api',
    },
  };
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
