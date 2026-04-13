import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import { marked } from 'marked';

const execAsync = promisify(exec);
const router = Router();

const SETFARM_REPO = path.join(os.homedir(), '.openclaw', 'setfarm-repo');
const MC_REPO = path.join(os.homedir(), 'projects', 'mission-control');

// Standalone HTML page for changelog — no React, no CSS refresh issues
// Visit directly: https://ai.setrox.com.tr/changelog
router.get('/changelog', async (_req, res) => {
  try {
    let setfarmMd = '';
    let mcMd = '';
    try { setfarmMd = await readFile(path.join(SETFARM_REPO, 'CHANGELOG.md'), 'utf-8'); } catch {}
    try { mcMd = await readFile(path.join(MC_REPO, 'CHANGELOG.md'), 'utf-8'); } catch {}

    // Git log for both repos
    const getLog = async (repo: string, name: string) => {
      try {
        const { stdout } = await execAsync(
          `git log --format="%h|%aI|%an|%s" -30`,
          { cwd: repo, timeout: 5000 }
        );
        return stdout.trim().split('\n').filter(Boolean).map(line => {
          const [hash, date, author, ...rest] = line.split('|');
          return { hash, date, author, subject: rest.join('|'), repo: name };
        });
      } catch { return []; }
    };
    const [sfLog, mcLog] = await Promise.all([
      getLog(SETFARM_REPO, 'setfarm'),
      getLog(MC_REPO, 'mc'),
    ]);
    const allCommits = [...sfLog, ...mcLog].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ).slice(0, 40);

    // Build info
    let setfarmCommit = '?';
    let mcCommit = '?';
    let mcVersion = '?';
    try {
      const raw = JSON.parse(await readFile(path.join(SETFARM_REPO, 'dist/BUILD_INFO.json'), 'utf-8'));
      setfarmCommit = (raw.sha || raw.commit || '?').slice(0, 8);
    } catch {}
    try {
      const pkg = JSON.parse(await readFile(path.join(MC_REPO, 'package.json'), 'utf-8'));
      mcVersion = pkg.version || '?';
      const { stdout } = await execAsync('git rev-parse --short HEAD', { cwd: MC_REPO, timeout: 2000 });
      mcCommit = stdout.trim();
    } catch {}

    const setfarmHtml = setfarmMd ? marked.parse(setfarmMd) : '<p>CHANGELOG.md bulunamadı.</p>';
    const mcHtml = mcMd ? marked.parse(mcMd) : '<p>CHANGELOG.md bulunamadı.</p>';

    const commitsHtml = allCommits.map(c => `
      <div class="commit">
        <span class="badge badge-${c.repo}">${c.repo === 'setfarm' ? 'SF' : 'MC'}</span>
        <code class="hash">${c.hash}</code>
        <span class="subject">${escapeHtml(c.subject)}</span>
        <span class="meta">${escapeHtml(c.author)} · ${new Date(c.date).toLocaleString('tr-TR')}</span>
      </div>
    `).join('');

    const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>Changelog — Mission Control</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Inter', -apple-system, system-ui, sans-serif;
  background: #0a0b10;
  color: #c8d0e0;
  line-height: 1.65;
  padding: 40px 20px;
}
.container { max-width: 900px; margin: 0 auto; }
.header {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 20px; margin-bottom: 24px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.header h1 {
  font-size: 22px; font-weight: 700; color: #fff;
  display: flex; align-items: center; gap: 12px;
}
.header h1::before {
  content: ''; width: 10px; height: 10px; border-radius: 50%;
  background: #ff6b00; box-shadow: 0 0 10px rgba(255,107,0,0.6);
}
.versions {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
  margin-bottom: 24px;
}
.vcard {
  background: #161922;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  padding: 14px 18px;
}
.vcard .label { font-size: 10px; font-weight: 700; color: #00d9ff; text-transform: uppercase; letter-spacing: 1.5px; }
.vcard .val { font-family: 'JetBrains Mono', Menlo, monospace; font-size: 14px; color: #fff; margin-top: 4px; }
.vcard .sub { font-size: 11px; color: #666; margin-top: 2px; font-family: monospace; }
.tabs {
  display: flex; gap: 4px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  margin-bottom: 20px;
}
.tab {
  background: transparent; border: none;
  border-bottom: 2px solid transparent;
  color: #888; padding: 10px 16px;
  font-size: 13px; font-weight: 500;
  cursor: pointer;
  font-family: inherit;
}
.tab.active { color: #00d9ff; border-bottom-color: #00d9ff; }
.tab:hover { color: #fff; }
.section { display: none; }
.section.active { display: block; }
.repo-section { margin-bottom: 40px; }
.repo-title {
  font-size: 11px; font-weight: 700; color: #666;
  text-transform: uppercase; letter-spacing: 2px;
  margin-bottom: 14px; padding: 8px 12px;
  background: rgba(255,255,255,0.03);
  border-left: 3px solid #00d9ff; border-radius: 2px;
}
.md h1 { font-size: 18px; font-weight: 700; color: #fff; margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.md h1:first-child { margin-top: 0; }
.md h2 { font-size: 15px; font-weight: 600; color: #ff8c42; margin: 20px 0 10px; }
.md h3 { font-size: 13px; font-weight: 600; color: #00d9ff; margin: 16px 0 8px; }
.md h4, .md h5 { font-size: 12px; font-weight: 600; color: #c8d0e0; margin: 12px 0 6px; }
.md p { font-size: 13px; color: #c8d0e0; margin: 8px 0; }
.md ul, .md ol { padding-left: 22px; margin: 8px 0; }
.md li { font-size: 13px; color: #c8d0e0; margin: 4px 0; }
.md li::marker { color: #666; }
.md code {
  background: rgba(0,217,255,0.1);
  border: 1px solid rgba(0,217,255,0.15);
  padding: 1px 6px; border-radius: 4px;
  font-family: 'JetBrains Mono', Menlo, monospace;
  font-size: 11px; color: #00d9ff;
}
.md strong { color: #fff; font-weight: 600; }
.md hr { border: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent); margin: 28px 0; }
.md a { color: #00d9ff; text-decoration: none; }
.md a:hover { text-decoration: underline; }
.md blockquote { border-left: 3px solid #ff8c42; padding: 4px 12px; margin: 12px 0; background: rgba(255,140,66,0.05); border-radius: 4px; }

.commit {
  display: grid; grid-template-columns: auto auto 1fr auto;
  gap: 12px; align-items: center;
  padding: 10px 14px; margin-bottom: 6px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 8px;
}
.commit:hover { background: rgba(255,255,255,0.04); }
.badge {
  font-size: 9px; font-weight: 700;
  padding: 3px 8px; border-radius: 10px;
  letter-spacing: 0.5px;
}
.badge-setfarm { background: rgba(255,140,66,0.15); color: #ff8c42; border: 1px solid rgba(255,140,66,0.3); }
.badge-mc { background: rgba(0,217,255,0.15); color: #00d9ff; border: 1px solid rgba(0,217,255,0.3); }
.hash { font-family: 'JetBrains Mono', Menlo, monospace; font-size: 11px; color: #888; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; }
.subject { font-size: 13px; color: #e8ecf3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta { font-size: 11px; color: #666; white-space: nowrap; }
.footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 11px; color: #555; text-align: center; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>Sistem Sürümü &amp; Değişiklikler</h1>
    <a href="/" style="color: #888; text-decoration: none; font-size: 13px;">← Dashboard</a>
  </div>

  <div class="versions">
    <div class="vcard">
      <div class="label">Setfarm</div>
      <div class="val">${setfarmCommit}</div>
      <div class="sub">main</div>
    </div>
    <div class="vcard">
      <div class="label">Mission Control</div>
      <div class="val">v${mcVersion} · ${mcCommit}</div>
    </div>
  </div>

  <div class="tabs">
    <button class="tab active" data-tab="notes">Sürüm Notları</button>
    <button class="tab" data-tab="git">Git Tarihçesi (${allCommits.length})</button>
  </div>

  <div class="section active" id="notes">
    <div class="repo-section">
      <div class="repo-title">Setfarm</div>
      <div class="md">${setfarmHtml}</div>
    </div>
    <div class="repo-section">
      <div class="repo-title">Mission Control</div>
      <div class="md">${mcHtml}</div>
    </div>
  </div>

  <div class="section" id="git">
    ${commitsHtml}
  </div>

  <div class="footer">Auto-generated ${new Date().toLocaleString('tr-TR')}</div>
</div>
<script>
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});
</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err: any) {
    res.status(500).send(`<pre>Error: ${err.message}</pre>`);
  }
});

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default router;
