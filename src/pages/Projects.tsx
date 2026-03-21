import { useEffect, useState, useRef } from "react";
import { GlitchText } from "../components/GlitchText";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";
import { ProjectCard } from "../components/projects/ProjectCard";
import { ProjectDetailPanel } from "../components/projects/ProjectDetailPanel";
import { CreateProjectModal } from "../components/projects/CreateProjectModal";
import { DeleteProjectModal } from "../components/projects/DeleteProjectModal";


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
  const [sortBy, setSortBy] = useState<'date' | 'port' | 'name' | 'status' | 'run'>('run');
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
      case 'run': {
        return (b.latestRunNumber || 0) - (a.latestRunNumber || 0);
      }
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
        {(['run', 'date', 'port', 'name', 'status'] as const).map((s) => (
          <button key={s} className={`projects-sort__btn ${sortBy === s ? 'projects-sort__btn--active' : ''}`} onClick={() => setSortBy(s)}>
            {s === 'run' ? 'RUN' : s === 'date' ? 'TARIH' : s === 'port' ? 'PORT' : s === 'name' ? 'AD' : 'DURUM'}
          </button>
        ))}
      </div>

      {/* Own projects - full cards */}
      <div className="projects-grid">
        {ownProjects.map((p) => (
          <ProjectCard
            key={p.id}
            project={p}
            selected={selected === p.id}
            toggling={toggling === p.id}
            onSelect={() => setSelected(selected === p.id ? null : p.id)}
            onToggle={(e) => handleToggle(e, p)}
            onExport={() => handleExport(p.id)}
            onDelete={(e) => openDeleteModal(e, p)}
          />
        ))}
      </div>

      {/* Project detail panel */}
      {sel && (
        <ProjectDetailPanel
          project={sel}
          onClose={() => setSelected(null)}
          onChecklistUpdate={handleChecklistUpdate}
          formatDuration={formatDuration}
        />
      )}

      {/* Create project modal */}
      <CreateProjectModal
        open={showCreate}
        form={createForm}
        loading={createLoading}
        onFormChange={setCreateForm}
        onSubmit={handleCreate}
        onClose={() => setShowCreate(false)}
      />

      {/* Delete confirmation modal */}
      <DeleteProjectModal
        target={deleteTarget}
        confirmText={deleteConfirm}
        loading={deleteLoading}
        result={deleteResult}
        steps={deleteSteps}
        onConfirmTextChange={setDeleteConfirm}
        onDelete={handleDelete}
        onClose={() => { setDeleteTarget(null); setDeleteConfirm(""); setDeleteResult(null); setDeleteSteps([]); }}
      />
    </div>
  );
}
