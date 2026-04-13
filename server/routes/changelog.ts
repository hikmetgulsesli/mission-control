import { Router } from 'express';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';

const execAsync = promisify(exec);
const router = Router();

const SETFARM_REPO = path.join(os.homedir(), '.openclaw', 'setfarm-repo');
const MC_REPO = path.join(os.homedir(), 'projects', 'mission-control');

interface Commit {
  hash: string;
  date: string;
  author: string;
  subject: string;
  repo: 'setfarm' | 'mc';
}

async function getCommits(repoPath: string, repoName: 'setfarm' | 'mc', limit: number): Promise<Commit[]> {
  try {
    // Use unlikely separator to avoid collision with commit subjects
    const SEP = '\x1f'; // ASCII unit separator
    const format = `%H${SEP}%aI${SEP}%an${SEP}%s`;
    const { stdout } = await execAsync(
      `git log --format="${format}" -${limit}`,
      { cwd: repoPath, timeout: 5000 }
    );
    return stdout.trim().split('\n').filter(Boolean).map(line => {
      const parts = line.split(SEP);
      const hash = parts[0] || '';
      const date = parts[1] || '';
      const author = parts[2] || '';
      const subject = parts.slice(3).join(SEP);
      return {
        hash: hash.slice(0, 8),
        date,
        author,
        subject,
        repo: repoName,
      };
    }).filter(c => c.hash && c.date);
  } catch (err) {
    console.warn(`[changelog] Failed to read ${repoName}:`, err);
    return [];
  }
}

// Simple in-memory cache (30s TTL)
let _cache: { data: any; ts: number } | null = null;
const CACHE_TTL_MS = 30_000;

router.get('/changelog', async (_req, res) => {
  try {
    if (_cache && Date.now() - _cache.ts < CACHE_TTL_MS) {
      return res.json(_cache.data);
    }

    const [setfarmCommits, mcCommits] = await Promise.all([
      getCommits(SETFARM_REPO, 'setfarm', 30),
      getCommits(MC_REPO, 'mc', 20),
    ]);

    // Merge and sort by date desc
    const merged = [...setfarmCommits, ...mcCommits]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 50);

    // Read BUILD_INFO for current deployed versions
    let setfarmBuild: { commit: string; branch: string; builtAt: string } | null = null;
    let mcBuild: { version: string; commit: string; builtAt: string } | null = null;

    try {
      const fs = await import('node:fs/promises');
      const setfarmBuildRaw = await fs.readFile(path.join(SETFARM_REPO, 'dist/BUILD_INFO.json'), 'utf-8');
      const raw = JSON.parse(setfarmBuildRaw);
      // BUILD_INFO.json uses `sha` field, normalize to `commit` for consistency with mc
      setfarmBuild = {
        commit: raw.sha || raw.commit || 'unknown',
        branch: raw.branch || 'main',
        builtAt: raw.builtAt || new Date().toISOString(),
      };
    } catch { /* setfarm not built yet */ }

    try {
      const fs = await import('node:fs/promises');
      const mcPkgRaw = await fs.readFile(path.join(MC_REPO, 'package.json'), 'utf-8');
      const mcPkg = JSON.parse(mcPkgRaw);
      const { stdout: mcCommit } = await execAsync('git rev-parse --short HEAD', { cwd: MC_REPO, timeout: 2000 });
      mcBuild = {
        version: mcPkg.version || 'unknown',
        commit: mcCommit.trim(),
        builtAt: new Date().toISOString(),
      };
    } catch { /* skip */ }

    // Read CHANGELOG.md files (structured release notes)
    let setfarmChangelog: string | null = null;
    let mcChangelog: string | null = null;
    try {
      const fs = await import('node:fs/promises');
      setfarmChangelog = await fs.readFile(path.join(SETFARM_REPO, 'CHANGELOG.md'), 'utf-8');
    } catch { /* no changelog */ }
    try {
      const fs = await import('node:fs/promises');
      mcChangelog = await fs.readFile(path.join(MC_REPO, 'CHANGELOG.md'), 'utf-8');
    } catch { /* no changelog */ }

    const data = {
      commits: merged,
      setfarm: setfarmBuild,
      mc: mcBuild,
      setfarmChangelog,
      mcChangelog,
      generatedAt: new Date().toISOString(),
    };

    _cache = { data, ts: Date.now() };
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
