import { useEffect, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

interface Commit {
  hash: string;
  date: string;
  author: string;
  subject: string;
  repo: 'setfarm' | 'mc';
}

interface ChangelogData {
  commits: Commit[];
  setfarm: { commit: string; branch: string; builtAt: string } | null;
  mc: { version: string; commit: string; builtAt: string } | null;
  setfarmChangelog: string | null;
  mcChangelog: string | null;
  generatedAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

// Minimal markdown → React renderer
function renderMarkdown(md: string): JSX.Element[] {
  const lines = md.split('\n');
  const nodes: JSX.Element[] = [];
  let key = 0;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '---') { nodes.push(<hr key={key++} />); i++; continue; }
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      const level = Math.min(h[1].length, 6);
      const content = h[2];
      if (level === 1) nodes.push(<h1 key={key++}>{inline(content)}</h1>);
      else if (level === 2) nodes.push(<h2 key={key++}>{inline(content)}</h2>);
      else if (level === 3) nodes.push(<h3 key={key++}>{inline(content)}</h3>);
      else if (level === 4) nodes.push(<h4 key={key++}>{inline(content)}</h4>);
      else nodes.push(<h5 key={key++}>{inline(content)}</h5>);
      i++; continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''));
        i++;
      }
      nodes.push(<ul key={key++}>{items.map((it, idx) => <li key={idx}>{inline(it)}</li>)}</ul>);
      continue;
    }
    if (line.trim()) nodes.push(<p key={key++}>{inline(line)}</p>);
    i++;
  }
  return nodes;
}

function inline(s: string): JSX.Element[] {
  const parts: JSX.Element[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIdx = 0;
  let key = 0;
  let m;
  while ((m = regex.exec(s)) !== null) {
    if (m.index > lastIdx) parts.push(<span key={key++}>{s.slice(lastIdx, m.index)}</span>);
    const tok = m[0];
    if (tok.startsWith('**')) parts.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    else parts.push(<code key={key++}>{tok.slice(1, -1)}</code>);
    lastIdx = m.index + tok.length;
  }
  if (lastIdx < s.length) parts.push(<span key={key++}>{s.slice(lastIdx)}</span>);
  return parts;
}

export function ChangelogModal({ open, onClose }: Props) {
  const [data, setData] = useState<ChangelogData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'notes' | 'git'>('notes');
  const [filter, setFilter] = useState<'all' | 'setfarm' | 'mc'>('all');

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch('/api/changelog')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const commits = data?.commits.filter(c => filter === 'all' || c.repo === filter) || [];

  return (
    <div className="changelog-backdrop" onClick={onClose}>
      <div className="changelog-modal" onClick={e => e.stopPropagation()}>
        <div className="changelog-header">
          <h2>Sistem Sürümü & Değişiklikler</h2>
          <button className="changelog-close" onClick={onClose}>×</button>
        </div>

        {data && (data.setfarm || data.mc) && (
          <div className="changelog-versions">
            {data.setfarm?.commit && (
              <div className="version-card">
                <div className="version-card__title">SETFARM</div>
                <div className="version-card__commit">{String(data.setfarm.commit).slice(0, 8)}</div>
                <div className="version-card__branch">{data.setfarm.branch || 'main'}</div>
              </div>
            )}
            {data.mc?.commit && (
              <div className="version-card">
                <div className="version-card__title">MISSION CONTROL</div>
                <div className="version-card__commit">v{data.mc.version || '?'} · {String(data.mc.commit).slice(0, 8)}</div>
              </div>
            )}
          </div>
        )}

        <div className="changelog-tabs">
          <button className={tab === 'notes' ? 'active' : ''} onClick={() => setTab('notes')}>
            Sürüm Notları
          </button>
          <button className={tab === 'git' ? 'active' : ''} onClick={() => setTab('git')}>
            Git Tarihçesi ({data?.commits.length || 0})
          </button>
        </div>

        {tab === 'notes' && (
          <div className="changelog-body changelog-notes">
            {loading && <div className="changelog-loading">Yükleniyor…</div>}
            {error && <div className="changelog-error">Hata: {error}</div>}
            {data?.setfarmChangelog && (
              <section className="changelog-section">
                <h3 className="changelog-section-title">Setfarm</h3>
                <div className="markdown">{renderMarkdown(data.setfarmChangelog)}</div>
              </section>
            )}
            {data?.mcChangelog && (
              <section className="changelog-section">
                <h3 className="changelog-section-title">Mission Control</h3>
                <div className="markdown">{renderMarkdown(data.mcChangelog)}</div>
              </section>
            )}
            {!loading && !data?.setfarmChangelog && !data?.mcChangelog && (
              <div className="changelog-empty">CHANGELOG.md bulunamadı.</div>
            )}
          </div>
        )}

        {tab === 'git' && (
          <>
            <div className="changelog-filter">
              <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Tümü</button>
              <button className={filter === 'setfarm' ? 'active' : ''} onClick={() => setFilter('setfarm')}>Setfarm</button>
              <button className={filter === 'mc' ? 'active' : ''} onClick={() => setFilter('mc')}>MC</button>
            </div>
            <div className="changelog-body">
              {loading && <div className="changelog-loading">Yükleniyor…</div>}
              {error && <div className="changelog-error">Hata: {error}</div>}
              {!loading && !error && commits.length === 0 && <div className="changelog-empty">Commit yok.</div>}
              {commits.map(commit => (
                <div key={`${commit.repo}-${commit.hash}`} className={`commit-row commit-row--${commit.repo}`}>
                  <div className="commit-row__badges">
                    <span className={`commit-badge commit-badge--${commit.repo}`}>
                      {commit.repo === 'setfarm' ? 'SF' : 'MC'}
                    </span>
                    <span className="commit-hash">{commit.hash}</span>
                  </div>
                  <div className="commit-row__content">
                    <div className="commit-subject">{commit.subject}</div>
                    <div className="commit-meta">
                      <span>{commit.author}</span>
                      <span className="commit-sep">·</span>
                      <span title={format(new Date(commit.date), 'yyyy-MM-dd HH:mm')}>
                        {formatDistanceToNow(new Date(commit.date), { addSuffix: true, locale: tr })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
