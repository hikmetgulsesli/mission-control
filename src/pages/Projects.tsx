import { useEffect, useState, useRef } from "react";
import { GlitchText } from "../components/GlitchText";
import { ProjectChecklist } from "../components/ProjectChecklist";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";


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
  type?: "web" | "mobile";
  description: string;
  ports: { frontend?: number; backend?: number };
  domain: string;
  repo: string;
  stack: string[];
  service: string;
  serviceStatus?: string;
  createdBy: string;
  workflowRunId?: string;
  runNumber?: number;
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
  "setfarm-dashboard": "https://cdn.simpleicons.org/apachekafka/00c853",
  "uptime-kuma": "https://cdn.simpleicons.org/uptimekuma/5cdd8b",
  "grafana": "https://cdn.simpleicons.org/grafana/f46800",
  "n8n": "https://cdn.simpleicons.org/n8n/ea4b71",
};

export function Projects() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ success: boolean; log?: string[]; error?: string } | null>(null);
  const [deleteSteps, setDeleteSteps] = useState<Array<{ id: string; label: string; detail: string; status: "waiting" | "done" | "fail" | "skip" }>>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "", emoji: "", category: "own", type: "web" as string });
  const [createLoading, setCreateLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'port' | 'name' | 'status'>('name');
  const importRef = useRef<HTMLInputElement>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<string | null>(null);

  const fetchProjects = () => api.projects().then((d) => { setProjects(d as any); setLoading(false); }).catch(() => setLoading(false));

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget || deleteConfirm.trim() !== deleteTarget.name.trim()) return;
    setDeleteLoading(true);
    setDeleteResult(null);
    const steps = [
      { id: 'service', label: 'Systemd servisi', detail: deleteTarget.service || '-', status: 'waiting' as const },
      { id: 'tunnel', label: 'Cloudflare tunnel', detail: deleteTarget.domain || '-', status: 'waiting' as const },
      { id: 'files', label: 'Yerel dosyalar', detail: deleteTarget.repo || '~/projects/' + deleteTarget.id, status: 'waiting' as const },
      { id: 'github', label: 'GitHub repo', detail: (deleteTarget as any).github?.replace('https://github.com/', '') || '-', status: 'waiting' as const },
      { id: 'json', label: 'projects.json', detail: deleteTarget.id, status: 'waiting' as const },
      { id: 'db', label: 'Pipeline kayitlari', detail: 'runs, steps, stories', status: 'waiting' as const },
    ];
    setDeleteSteps(steps);
    try {
      const result = await api.deleteProject(deleteTarget.id, deleteConfirm);
      const log = result.log || [];
      const logStr = log.join(' ');
      const updated = steps.map(s => {
        if (s.id === 'service') return { ...s, status: logStr.includes('stopped') ? 'done' as const : logStr.includes('Service') ? 'fail' as const : 'skip' as const };
        if (s.id === 'tunnel') return { ...s, status: logStr.includes('Tunnel entry') || logStr.includes('Tunnel:') ? 'done' as const : logStr.includes('Tunnel') && logStr.includes('failed') ? 'fail' as const : 'skip' as const };
        if (s.id === 'files') return { ...s, status: logStr.includes('deleted') && logStr.includes('Repo') ? 'done' as const : logStr.includes('deletion failed') ? 'fail' as const : 'skip' as const };
        if (s.id === 'github') return { ...s, status: logStr.includes('GitHub repo deleted') ? 'done' as const : logStr.includes('GitHub delete failed') ? 'fail' as const : 'skip' as const };
        if (s.id === 'json') return { ...s, status: logStr.includes('Removed from projects.json') ? 'done' as const : 'skip' as const };
        if (s.id === 'db') return { ...s, status: logStr.includes('Setfarm') ? 'done' as const : 'skip' as const };
        return s;
      });
      // Animate steps one by one
      for (let i = 0; i < updated.length; i++) {
        await new Promise(r => setTimeout(r, 200));
        setDeleteSteps(prev => prev.map((s, idx) => idx <= i ? updated[idx] : s));
      }
      setDeleteResult({ success: true, log });
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      if (selected === deleteTarget.id) setSelected(null);
    } catch (err: any) {
      setDeleteResult({ success: false, error: err.message });
      setDeleteSteps(prev => prev.map(s => s.status === 'waiting' ? { ...s, status: 'fail' as const } : s));
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
      setCreateForm({ name: "", description: "", emoji: "", category: "own", type: "web" as string });
    } catch (err: any) {
      toast("Create failed: " + err.message, 'error');
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
      toast("Export failed: " + err.message, 'error');
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
      toast("Import failed: " + err.message, 'error');
    }
    if (importRef.current) importRef.current.value = "";
  };

  const handleChecklistUpdate = (projectId: string, checklist: any[]) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, checklist } : p));
  };

  const handleToggle = async (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    if (p.id === "mission-control" || p.type === "mobile") return;
    const action = p.serviceStatus === "active" ? "stop" : "start";
    setToggling(p.id);
    try {
      const result = await api.toggleProject(p.id, action);
      setProjects(prev => prev.map(pr =>
        pr.id === p.id ? { ...pr, serviceStatus: result.serviceStatus ?? (action === "start" ? "active" : "inactive"), manuallyDisabled: action === "stop" } : pr
      ));
      toast(p.name + " " + (action === "start" ? "baslatildi" : "durduruldu"), "success");
    } catch (err: any) {
      toast("Toggle failed: " + err.message, "error");
    } finally {
      setToggling(null);
    }
  };

  const handleBulkToggle = async (action: "start" | "stop") => {
    const targets = ownProjects.filter(p =>
      p.id !== "mission-control" && p.type !== "mobile" && p.service &&
      (action === "start" ? p.serviceStatus !== "active" : p.serviceStatus === "active")
    );
    if (targets.length === 0) { toast("Degistirilecek servis yok", "error"); return; }
    setBulkAction(action);
    let ok = 0, fail = 0;
    for (const p of targets) {
      try {
        await api.toggleProject(p.id, action);
        setProjects(prev => prev.map(pr =>
          pr.id === p.id ? { ...pr, serviceStatus: action === "start" ? "active" : "inactive" } : pr
        ));
        ok++;
      } catch { fail++; }
    }
    toast(ok + " servis " + (action === "start" ? "baslatildi" : "durduruldu") + (fail ? ", " + fail + " basarisiz" : ""), ok > 0 ? "success" : "error");
    setBulkAction(null);
  };

  const openDeleteModal = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setDeleteTarget(project);
    setDeleteConfirm("");
    setDeleteResult(null);
  };

  if (loading) return <div className="page-loading">Projeler yukleniyor...</div>;

  const ownProjectsRaw = projects.filter((p) => p.category === "own" && p.id !== "mission-control");
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
          <button className="btn btn--small btn--success" onClick={() => handleBulkToggle("start")} disabled={!!bulkAction}>
            {bulkAction === "start" ? "BASLATILIYOR..." : "TUMUNU BASLAT"}
          </button>
          <button className="btn btn--small btn--danger" onClick={() => handleBulkToggle("stop")} disabled={!!bulkAction}>
            {bulkAction === "stop" ? "DURDURULUYOR..." : "TUMUNU DURDUR"}
          </button>
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
            className={`project-card ${selected === p.id ? "project-card--selected" : ""} ${p.status === "building" ? "project-card--building" : p.status === "failed" ? "project-card--failed" : ""} ${p.type === "mobile" ? "project-card--mobile" : `project-card--${p.serviceStatus === "active" ? "online" : "offline"}`}`}
            onClick={() => setSelected(selected === p.id ? null : p.id)}
          >
            <div className="project-card__header">
              <span className="project-card__emoji">{p.emoji}</span>
              <span className="project-card__name">{p.name}</span>
              {p.type === "mobile" ? (
                <span className="project-card__status project-card__status--mobile">MOBILE</span>
              ) : p.status === "building" ? (
                <span className="project-card__status project-card__status--building">BUILDING</span>
              ) : (
                <button
                  className={"project-card__toggle " + (p.serviceStatus === "active" ? "project-card__toggle--on" : "project-card__toggle--off")}
                  onClick={(e) => handleToggle(e, p)}
                  disabled={toggling === p.id || p.id === "mission-control"}
                  title={p.serviceStatus === "active" ? "Durdur" : "Baslat"}
                >
                  <span className="project-card__toggle-knob" />
                  <span className="project-card__toggle-label">
                    {toggling === p.id ? "..." : p.serviceStatus === "active" ? "ON" : "OFF"}
                  </span>
                </button>
              )}
            </div>

            <p className="project-card__desc" title={p.description}>{p.description}</p>

            <div className="project-card__meta">
              {p.type !== "mobile" && (
                <div className="project-card__meta-row">
                  <span className="project-card__label">PORT</span>
                  <span className="project-card__value">
                    {p.ports.frontend}{p.ports.backend ? ` / ${p.ports.backend}` : ""}
                  </span>
                </div>
              )}
              {p.type !== "mobile" && p.domain && (
                <div className="project-card__meta-row">
                  <span className="project-card__label">DOMAIN</span>
                  <a className="project-card__link" href={`https://${p.domain}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                    {p.domain}
                  </a>
                </div>
              )}
              {p.type === "mobile" && p.repo && (
                <div className="project-card__meta-row">
                  <span className="project-card__label">REPO</span>
                  <span className="project-card__value">{p.repo.split("/").pop()}</span>
                </div>
              )}
              <div className="project-card__meta-row">
                <span className="project-card__label">STACK</span>
                <div className="project-card__tags">
                  {(p.stack || []).map((s) => <span key={s} className="project-card__tag">{s}</span>)}
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
              {p.runNumber && (
                <div className="project-card__meta-row">
                  <span className="project-card__label">RUN</span>
                  <span className="project-card__value">#{p.runNumber}</span>
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
                  {sel.type !== "mobile" && <tr><td>Port</td><td>{sel.ports.frontend}{sel.ports.backend ? ` (frontend) / ${sel.ports.backend} (backend)` : ""}</td></tr>}
                  {sel.type !== "mobile" && sel.domain && <tr><td>Domain</td><td><a href={`https://${sel.domain}`} target="_blank" rel="noopener noreferrer">{sel.domain}</a></td></tr>}
                  {sel.type === "mobile" && <tr><td>Platform</td><td>React Native / Expo</td></tr>}
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
              Tur
              <select value={createForm.type} onChange={(e) => setCreateForm(f => ({ ...f, type: e.target.value }))}>
                <option value="web">Web Uygulamasi</option>
                <option value="mobile">Mobil Uygulama</option>
              </select>
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
              <h3 style={{ color: '#f85149', margin: 0 }}>Projeyi Sil</h3>
              <button className="modal__close" onClick={() => !deleteLoading && setDeleteTarget(null)}>{"✕"}</button>
            </div>
            <div className="delete-modal__body">
              <div className="delete-modal__warning">
                <strong>{deleteTarget.emoji} {deleteTarget.name}</strong> projesi ve tum kaynaklari kalici olarak silinecek.
              </div>

              {/* Checklist — only visible during/after deletion */}
              {(deleteLoading || deleteResult || deleteSteps.some(s => s.status !== 'waiting')) && <div style={{ margin: '12px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(deleteSteps.length > 0 ? deleteSteps : [
                  { id: 'service', label: 'Systemd servisi', detail: deleteTarget.service || '-', status: 'waiting' as const },
                  { id: 'tunnel', label: 'Cloudflare tunnel', detail: deleteTarget.domain || '-', status: 'waiting' as const },
                  { id: 'files', label: 'Yerel dosyalar', detail: deleteTarget.repo || '~/projects/' + deleteTarget.id, status: 'waiting' as const },
                  { id: 'github', label: 'GitHub repo', detail: deleteTarget.github?.replace('https://github.com/', '') || '-', status: 'waiting' as const },
                  { id: 'json', label: 'projects.json', detail: deleteTarget.id, status: 'waiting' as const },
                  { id: 'db', label: 'Pipeline kayitlari', detail: 'runs, steps, stories', status: 'waiting' as const },
                ]).map((step) => (
                  <div key={step.id} style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px',
                    background: step.status === 'done' ? 'rgba(63, 185, 80, 0.08)' : step.status === 'fail' ? 'rgba(248, 81, 73, 0.08)' : 'rgba(255,255,255,0.03)',
                    borderRadius: '6px', fontSize: '13px', transition: 'all 0.3s ease',
                    borderLeft: `3px solid ${step.status === 'done' ? '#3fb950' : step.status === 'fail' ? '#f85149' : step.status === 'skip' ? '#484f58' : '#30363d'}`
                  }}>
                    <span style={{ fontSize: '16px', width: '20px', textAlign: 'center', flexShrink: 0 }}>
                      {step.status === 'done' ? '✅' : step.status === 'fail' ? '❌' : step.status === 'skip' ? '➖' : '⏳'}
                    </span>
                    <span style={{ color: step.status === 'skip' ? '#484f58' : '#e6edf3', fontWeight: 500 }}>{step.label}</span>
                    <span style={{ color: '#484f58', fontSize: '11px', marginLeft: 'auto', fontFamily: 'monospace' }}>{step.detail}</span>
                  </div>
                ))}
              </div>
}

              {!deleteLoading && !deleteResult && (
                <div style={{ margin: '12px 0', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '13px', color: '#8b949e' }}>
                  Silinecekler: servis, tunnel, dosyalar, GitHub repo, DB kayitlari
                </div>
              )}

              {!deleteResult && (
                <div className="delete-modal__confirm">
                  <label>Onaylamak icin proje adini yazin: <strong style={{ color: '#f85149' }}>{deleteTarget.name}</strong></label>
                  <input type="text" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder={deleteTarget.name} disabled={deleteLoading} autoFocus />
                </div>
              )}
              {deleteResult && !deleteResult.success && (
                <div className="delete-modal__result delete-modal__result--error">
                  <strong>Hata:</strong> {deleteResult.error}
                </div>
              )}
            </div>
            <div className="modal__actions">
              {deleteResult?.success ? (
                <button className="btn" onClick={() => { setDeleteTarget(null); setDeleteConfirm(""); setDeleteResult(null); setDeleteSteps([]); }}>Kapat</button>
              ) : (
                <>
                  <button className="btn" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>Vazgec</button>
                  <button className="btn btn--danger" onClick={handleDelete} disabled={deleteConfirm.trim() !== deleteTarget.name.trim() || deleteLoading}>
                    {deleteLoading ? "Siliniyor..." : "Kalici Olarak Sil"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
