import { useEffect, useState, useRef } from "react";
import { GlitchText } from "../components/GlitchText";
import { ProjectChecklist } from "../components/ProjectChecklist";
import { api } from "../lib/api";


function formatDuration(createdAt?: string, completedAt?: string, buildStartedAt?: string, buildCompletedAt?: string): string | null {
  const startStr = buildStartedAt || createdAt;
  if (!startStr) return null;
  const start = new Date(startStr);
  if (isNaN(start.getTime())) return null;
  const endStr = buildCompletedAt || completedAt;
  const end = endStr ? new Date(endStr) : new Date();
  if (isNaN(end.getTime())) return null;
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return null;
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  const remM = minutes % 60;
  if (days > 0) return remH > 0 ? `${days}g ${remH}s` : `${days}g`;
  if (hours > 0) return remM > 0 ? `${hours}s ${remM}dk` : `${hours}s`;
  return `${minutes}dk`;
}

interface Project {
  id: string;
  name: string;
  emoji: string;
  status: string;
  description: string;
  ports: { frontend?: number; backend?: number };
  domain: string;
  repo: string;
  stack: string[];
  service: string;
  serviceStatus?: string;
  createdBy: string;
  workflowRunId?: string;
  createdAt: string;
  completedAt?: string;
  status?: string;
  stories?: { total: number; done: number };
  pr?: string;
  features: string[];
  tasks: string[];
  prd?: string;
  github?: string;
  category?: string;
  checklist?: any[];
  buildStartedAt?: string;
  buildCompletedAt?: string;
}

const TOOL_LOGOS: Record<string, string> = {
  "openclaw-dashboard": "https://cdn.simpleicons.org/openlayers/ff6600",
  "antfarm-dashboard": "https://cdn.simpleicons.org/apachekafka/00c853",
  "uptime-kuma": "https://cdn.simpleicons.org/uptimekuma/5cdd8b",
  "grafana": "https://cdn.simpleicons.org/grafana/f46800",
  "n8n": "https://cdn.simpleicons.org/n8n/ea4b71",
};

export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ success: boolean; log?: string[]; error?: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "", emoji: "", category: "own" });
  const [createLoading, setCreateLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'port' | 'name' | 'status'>('name');
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.projects()
      .then((d) => { setProjects(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget || deleteConfirm !== deleteTarget.name) return;
    setDeleteLoading(true);
    setDeleteResult(null);
    try {
      const result = await api.deleteProject(deleteTarget.id, deleteConfirm);
      setDeleteResult({ success: true, log: result.log });
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      if (selected === deleteTarget.id) setSelected(null);
      setTimeout(() => { setDeleteTarget(null); setDeleteConfirm(""); setDeleteResult(null); }, 3000);
    } catch (err: any) {
      setDeleteResult({ success: false, error: err.message });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    setCreateLoading(true);
    try {
      const project = await api.createProject(createForm);
      setProjects(prev => [...prev, project]);
      setShowCreate(false);
      setCreateForm({ name: "", description: "", emoji: "", category: "own" });
    } catch (err: any) {
      alert("Create failed: " + err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleExport = async (projectId: string) => {
    try {
      const data = await api.exportProject(projectId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectId}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Export failed: " + err.message);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const project = await api.importProject(data);
      setProjects(prev => [...prev, project]);
    } catch (err: any) {
      alert("Import failed: " + err.message);
    }
    if (importRef.current) importRef.current.value = "";
  };

  const handleChecklistUpdate = (projectId: string, checklist: any[]) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, checklist } : p));
  };

  const openDeleteModal = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setDeleteTarget(project);
    setDeleteConfirm("");
    setDeleteResult(null);
  };

  if (loading) return <div className="page-loading">Projeler yukleniyor...</div>;

  const ownProjectsRaw = projects.filter((p) => p.category === "own");
  const ownProjects = [...ownProjectsRaw].sort((a, b) => {
    switch (sortBy) {
      case 'date': return (b.createdAt || '').localeCompare(a.createdAt || '');
      case 'port': return (a.ports?.frontend || 9999) - (b.ports?.frontend || 9999);
      case 'name': return a.name.localeCompare(b.name);
      case 'status': {
        const order: Record<string, number> = { building: 0, active: 1, failed: 2 };
        return (order[a.status || 'active'] ?? 1) - (order[b.status || 'active'] ?? 1);
      }
      default: return 0;
    }
  });
  const extProjects = projects.filter((p) => p.category === "external");
  const sel = projects.find((p) => p.id === selected);

  return (
    <div className="projects-page">
      <div className="projects-page__header">
        <GlitchText text="PROJELER" tag="h2" />
        <div className="projects-page__actions">
          <button className="btn btn--small btn--primary" onClick={() => setShowCreate(true)}>+ YENI PROJE</button>
          <button className="btn btn--small" onClick={() => importRef.current?.click()}>IMPORT</button>
          <input ref={importRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleImport} />
        </div>
      </div>

      {/* External tools - link bar */}
      <div className="tools-bar">
        <span className="tools-bar__label">ARACLAR</span>
        <div className="tools-bar__links">
          {extProjects.map((p) => (
            <a
              key={p.id}
              className={`tools-bar__item tools-bar__item--${p.serviceStatus === "active" ? "online" : "offline"}`}
              href={`https://${p.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`${p.name} - ${p.domain}${p.serviceStatus === "active" ? " (Online)" : " (Offline)"}`}
            >
              {TOOL_LOGOS[p.id] ? (
                <img className="tools-bar__logo" src={TOOL_LOGOS[p.id]} alt={p.name} />
              ) : (
                <span className="tools-bar__emoji">{p.emoji}</span>
              )}
              <span className="tools-bar__name">{p.name}</span>
              <span className={`tools-bar__dot tools-bar__dot--${p.serviceStatus}`} />
            </a>
          ))}
        </div>
      </div>

      {/* Sort controls */}
      <div className="projects-sort">
        <span className="projects-sort__label">SIRALA:</span>
        {(['date', 'port', 'name', 'status'] as const).map((s) => (
          <button key={s} className={`projects-sort__btn ${sortBy === s ? 'projects-sort__btn--active' : ''}`} onClick={() => setSortBy(s)}>
            {s === 'date' ? 'TARIH' : s === 'port' ? 'PORT' : s === 'name' ? 'AD' : 'DURUM'}
          </button>
        ))}
      </div>

      {/* Own projects - full cards */}
      <div className="projects-grid">
        {ownProjects.map((p) => (
          <div
            key={p.id}
            className={`project-card ${selected === p.id ? "project-card--selected" : ""} ${p.status === "building" ? "project-card--building" : p.status === "failed" ? "project-card--failed" : ""} project-card--${p.serviceStatus === "active" ? "online" : "offline"}`}
            onClick={() => setSelected(selected === p.id ? null : p.id)}
          >
            <div className="project-card__header">
              <span className="project-card__emoji">{p.emoji}</span>
              <span className="project-card__name">{p.name}</span>
              <span className={`project-card__status project-card__status--${p.status === "building" ? "building" : p.status === "failed" ? "failed" : p.serviceStatus}`}>
                {p.status === "building" ? "BUILDING" : p.status === "failed" ? "FAILED" : p.serviceStatus === "active" ? "ONLINE" : "OFFLINE"}
              </span>
            </div>

            <p className="project-card__desc">{p.description}</p>

            <div className="project-card__meta">
              <div className="project-card__meta-row">
                <span className="project-card__label">PORT</span>
                <span className="project-card__value">
                  {p.ports.frontend}{p.ports.backend ? ` / ${p.ports.backend}` : ""}
                </span>
              </div>
              <div className="project-card__meta-row">
                <span className="project-card__label">DOMAIN</span>
                <a className="project-card__link" href={`https://${p.domain}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  {p.domain}
                </a>
              </div>
              <div className="project-card__meta-row">
                <span className="project-card__label">STACK</span>
                <div className="project-card__tags">
                  {p.stack.map((s) => <span key={s} className="project-card__tag">{s}</span>)}
                </div>
              </div>
              {p.github && (
                <div className="project-card__meta-row">
                  <span className="project-card__label">GITHUB</span>
                  <a className="project-card__link" href={p.github} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                    {p.github.replace("https://github.com/", "")}
                  </a>
                </div>
              )}
              {p.stories && p.stories.total > 0 && (
                <div className="project-card__meta-row">
                  <span className="project-card__label">STORIES</span>
                  <span className="project-card__value">{p.stories.done}/{p.stories.total}</span>
                </div>
              )}
              {(p.createdAt || p.completedAt) && (
                <div className="project-card__meta-row">
                  <span className="project-card__label">TARIH</span>
                  <span className="project-card__value project-card__dates">
                    {p.createdAt && <span>{p.createdAt.slice(0, 10)}</span>}
                    {p.createdAt && p.completedAt && <span> → </span>}
                    {p.completedAt && <span>{p.completedAt.slice(0, 10)}</span>}
                  </span>
                </div>
              )}
              {p.createdAt && (
                <div className="project-card__meta-row">
                  <span className="project-card__label">SÜRE</span>
                  <span className="project-card__value project-card__duration">
                    <span className="project-card__duration-value">{formatDuration(p.createdAt, p.completedAt, p.buildStartedAt, p.buildCompletedAt) ?? "-"}</span>
                    {!p.completedAt && !p.buildCompletedAt && <span className="project-card__duration-badge">devam ediyor</span>}
                    {(p.completedAt || p.buildCompletedAt) && <span className="project-card__duration-badge project-card__duration-badge--done">tamamlandi</span>}
                  </span>
                </div>
              )}
            </div>

            {/* Checklist progress mini */}
            {p.checklist && p.checklist.length > 0 && (
              <div className="project-card__checklist-mini">
                <div className="project-card__checklist-bar">
                  <div className="project-card__checklist-fill" style={{
                    width: `${Math.round((p.checklist.filter((c: any) => c.completed).length / p.checklist.length) * 100)}%`
                  }} />
                </div>
                <span className="project-card__checklist-text">
                  {p.checklist.filter((c: any) => c.completed).length}/{p.checklist.length}
                </span>
              </div>
            )}

            {/* Card actions */}
            <div className="project-card__actions" onClick={(e) => e.stopPropagation()}>
              <button className="btn btn--tiny" onClick={() => handleExport(p.id)} title="Export JSON">EXPORT</button>
              {p.id !== "mission-control" && (
                <button className="btn btn--tiny btn--danger" onClick={(e) => openDeleteModal(e, p)} title="Projeyi sil">SIL</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Project detail panel */}
      {sel && (
        <div className="project-detail">
          <div className="project-detail__header">
            <span className="project-detail__emoji">{sel.emoji}</span>
            <h3 className="project-detail__title">{sel.name}</h3>
            <button className="project-detail__close" onClick={() => setSelected(null)}>{"\u2715"}</button>
          </div>

          <div className="project-detail__grid">
            <div className="project-detail__section">
              <h4>Genel Bilgiler</h4>
              <table className="project-detail__table">
                <tbody>
                  <tr><td>Durum</td><td>{sel.serviceStatus === "active" ? "Calisiyor" : "Durmus"}</td></tr>
                  <tr><td>Servis</td><td><code>{sel.service}</code></td></tr>
                  <tr><td>Port</td><td>{sel.ports.frontend}{sel.ports.backend ? ` (frontend) / ${sel.ports.backend} (backend)` : ""}</td></tr>
                  <tr><td>Domain</td><td><a href={`https://${sel.domain}`} target="_blank" rel="noopener noreferrer">{sel.domain}</a></td></tr>
                  <tr><td>Repo</td><td><code>{sel.repo}</code></td></tr>
                  {sel.github && <tr><td>GitHub</td><td><a href={sel.github} target="_blank" rel="noopener noreferrer">{sel.github.replace("https://github.com/", "")}</a></td></tr>}
                  <tr><td>Olusturan</td><td>{sel.createdBy}</td></tr>
                  <tr><td>Tarih</td><td>{sel.createdAt}{sel.completedAt ? ` → ${sel.completedAt.slice(0, 10)}` : ""}</td></tr>
                  <tr><td>Süre</td><td>{formatDuration(sel.createdAt, sel.completedAt, sel.buildStartedAt, sel.buildCompletedAt) ?? "-"}{!sel.completedAt && !sel.buildCompletedAt ? " (devam ediyor)" : ""}</td></tr>
                  {sel.workflowRunId && <tr><td>Workflow Run</td><td><code>{sel.workflowRunId}</code></td></tr>}
                  {sel.pr && <tr><td>Pull Request</td><td><a href={sel.pr} target="_blank" rel="noopener noreferrer">PR #1</a></td></tr>}
                </tbody>
              </table>
            </div>

            {/* Project Checklist */}
            {sel.checklist && (
              <div className="project-detail__section">
                <ProjectChecklist
                  projectId={sel.id}
                  checklist={sel.checklist}
                  onUpdate={(updated) => handleChecklistUpdate(sel.id, updated)}
                />
              </div>
            )}

            {sel.prd && (
              <div className="project-detail__section">
                <h4>Urun Tanimi (PRD)</h4>
                <p className="project-detail__prd">{sel.prd}</p>
              </div>
            )}

            <div className="project-detail__section">
              <h4>Ozellikler</h4>
              <ul className="project-detail__list">
                {sel.features.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>

            {sel.tasks.length > 0 && (
              <div className="project-detail__section">
                <h4>Gorevler / User Stories</h4>
                <ul className="project-detail__list project-detail__list--tasks">
                  {sel.tasks.map((t, i) => (
                    <li key={i}>
                      <span className="project-detail__task-check">{"\u2713"}</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create project modal */}
      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleCreate}>
            <h3>Yeni Proje Olustur</h3>
            <label>
              Proje Adi
              <input type="text" value={createForm.name} onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="ornek-proje" autoFocus />
            </label>
            <label>
              Aciklama
              <textarea value={createForm.description} onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Proje aciklamasi..." />
            </label>
            <label>
              Emoji
              <input type="text" value={createForm.emoji} onChange={(e) => setCreateForm(f => ({ ...f, emoji: e.target.value }))} placeholder="\u{1F4E6}" maxLength={4} />
            </label>
            <div className="modal__actions">
              <button type="button" className="btn" onClick={() => setShowCreate(false)}>Vazgec</button>
              <button type="submit" className="btn btn--primary" disabled={createLoading || !createForm.name.trim()}>
                {createLoading ? "Olusturuluyor..." : "Olustur"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => !deleteLoading && setDeleteTarget(null)}>
          <div className="modal delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal__header">
              <h3>Projeyi Sil</h3>
              <button className="modal__close" onClick={() => !deleteLoading && setDeleteTarget(null)}>{"\u2715"}</button>
            </div>
            <div className="delete-modal__body">
              <div className="delete-modal__warning">
                <strong>{deleteTarget.emoji} {deleteTarget.name}</strong> projesi ve tum kaynaklari kalici olarak silinecek.
              </div>
              <ul className="delete-modal__list">
                <li>Proje dosyalari: <code>{deleteTarget.repo}</code></li>
                <li>Systemd servisi: <code>{deleteTarget.service}</code></li>
                <li>Cloudflare tunnel: <code>{deleteTarget.domain}</code></li>
              </ul>
              <div className="delete-modal__confirm">
                <label>Onaylamak icin proje adini yazin: <strong>{deleteTarget.name}</strong></label>
                <input type="text" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder={deleteTarget.name} disabled={deleteLoading} autoFocus />
              </div>
              {deleteResult && (
                <div className={`delete-modal__result delete-modal__result--${deleteResult.success ? "success" : "error"}`}>
                  {deleteResult.success ? (
                    <><strong>Silindi!</strong>{deleteResult.log?.map((l, i) => <div key={i}>{l}</div>)}</>
                  ) : (
                    <><strong>Hata:</strong> {deleteResult.error}</>
                  )}
                </div>
              )}
            </div>
            <div className="modal__actions">
              <button className="btn" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>Vazgec</button>
              <button className="btn btn--danger" onClick={handleDelete} disabled={deleteConfirm !== deleteTarget.name || deleteLoading}>
                {deleteLoading ? "Siliniyor..." : "Kalici Olarak Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
