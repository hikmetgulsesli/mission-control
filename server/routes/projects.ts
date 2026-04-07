import { Router } from "express";
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { createConnection } from "net";
import { execSync, execFileSync } from "child_process";
import { config } from "../config.js";
import { deleteRunsByProject } from "../utils/setfarm-db.js";

const router = Router();
const PROJECTS_FILE = (config as any).projectsJson || join(import.meta.dirname, "../../projects.json");
const DISABLED_DIR = join(process.env.HOME || "/home/setrox", ".openclaw/disabled-services");
const DELETED_FILE = join(import.meta.dirname || __dirname, "../../deleted-projects.json");

function loadDeletedIds(): Set<string> {
  try { return new Set(JSON.parse(readFileSync(DELETED_FILE, "utf-8"))); } catch { return new Set(); }
}
function addDeletedId(id: string) {
  const ids = loadDeletedIds();
  ids.add(id);
  writeFileSync(DELETED_FILE, JSON.stringify([...ids], null, 2));
}

const DEFAULT_CHECKLIST = [
  { id: "task-received", label: "Gorev iletildi", completed: false },
  { id: "github-repo", label: "GitHub repo olusturuldu", completed: false },
  { id: "dns-setup", label: "Cloudflare DNS ve subdomain olusturuldu", completed: false },
  { id: "added-to-projects", label: "Projeler bolumune eklendi", completed: false },
  { id: "ports-assigned", label: "Portlar belirlendi", completed: false },
  { id: "setup-run", label: "Setup calistirildi", completed: false },
  { id: "dev-started", label: "Gelistirici calismaya basladi", completed: false },
  { id: "test-review", label: "Test ve review tamamlandi", completed: false },
];

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection({ port, host: "127.0.0.1" }, () => {
      sock.destroy();
      resolve(true);
    });
    sock.on("error", () => resolve(false));
    sock.setTimeout(1000, () => { sock.destroy(); resolve(false); });
  });
}

function loadProjects(): any[] {
  if (!existsSync(PROJECTS_FILE)) return [];
  return JSON.parse(readFileSync(PROJECTS_FILE, "utf-8"));
}

function saveProjects(projects: any[]) {
  writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

async function enrichWithStatus(projects: any[]) {
  // Enrich with latest run number from setfarm DB
  try {
    const { getRuns } = await import('../utils/setfarm.js');
    const allRuns = (await getRuns()) as any[];
    // Word-boundary match to avoid "not-defteri" matching "not-defteri-v2" tasks
    const wordBoundaryMatch = (haystack: string, needle: string): boolean => {
      if (!haystack || !needle) return false;
      // Match needle as whole word: not preceded/followed by alphanumeric or - or _
      const re = new RegExp(`(^|[^\\w-])${needle.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}([^\\w-]|$)`);
      return re.test(haystack);
    };
    for (const p of projects) {
      const repoPath = p.repoPath || p.repo || '';
      const matching = allRuns
        .filter((r: any) => {
          // Exact word match — substring would match "foo" against "foo-v2"
          const matchRepo = repoPath && wordBoundaryMatch(r.task || '', repoPath);
          const matchId = p.id && p.id.length > 2 && wordBoundaryMatch(r.task || '', p.id);
          return matchRepo || matchId;
        })
        .sort((a: any, b: any) => (b.run_number || 0) - (a.run_number || 0));
      if (matching.length > 0) {
        p.latestRunNumber = matching[0].run_number || 0;
        p.latestRunId = matching[0].id;
        p.latestRunStatus = matching[0].status;
      }
    }
  } catch {}

  for (const p of projects) {
    // Respect manually disabled state — don't override with port check
    if (p.manuallyDisabled) {
      p.serviceStatus = "inactive";
      continue;
    }
    const port = p.ports?.frontend || p.ports?.backend;
    if (port) {
      p.serviceStatus = (await checkPort(port)) ? "active" : "inactive";
    } else {
      p.serviceStatus = "unknown";
    }
  }
  return projects;
}

router.get("/projects", async (_req, res) => {
  try {
    const projects = await enrichWithStatus(loadProjects());
    // Sort by createdAt descending — newest first
    projects.sort((a: any, b: any) => {
      const da = a.createdAt || '1970-01-01';
      const db = b.createdAt || '1970-01-01';
      return db.localeCompare(da);
    });
    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


router.get("/projects/next-port", async (_req, res) => {
  try {
    const projects = loadProjects();
    const usedPorts = new Set<number>();
    for (const p of projects) {
      for (const v of Object.values(p.ports || {})) {
        if (typeof v === "number") usedPorts.add(v);
      }
    }
    // Also scan system ports in use (no shell injection — execFileSync with array args)
    try {
      const ssOutput = execFileSync("ss", ["-tlnp"], { encoding: 'utf-8', timeout: 5000 });
      for (const line of ssOutput.split('\n')) {
        const portMatch = line.match(/:(\d+)\s/);
        if (portMatch) {
          const p = parseInt(portMatch[1], 10);
          if (p >= 3000 && p <= 9999) usedPorts.add(p);
        }
      }
    } catch (e: any) { console.warn("exec failed:", e?.message || e); }
    // Setfarm project port range starts at 3507
    let port = 3507;
    while (usedPorts.has(port)) port++;
    res.json({ port });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/projects/:id", async (req, res) => {
  try {
    const projects = loadProjects();
    const project = findProjectByIdOrRepo(projects, req.params.id);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    res.json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/projects", async (req, res) => {
  try {
    const projects = loadProjects();
    const { name: rawName, description, emoji, ports, domain: rawDomain, repo, stack, service, github, category } = req.body;
    if (!rawName) { res.status(400).json({ error: "name required" }); return; }

    // Derive clean project name from repo path (basename) when available
    const repoBasename = repo ? String(repo).split("/").filter(Boolean).pop() || "" : "";
    const name = repoBasename || rawName;
    const domain = repoBasename ? repoBasename + ".setrox.com.tr" : (rawDomain || "");

    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const normalizedId = normalizeProjectId(id);
    // Check exact match OR normalized match
    if (projects.find((p: any) => p.id === id || normalizeProjectId(p.id) === normalizedId)) {
      res.status(409).json({ error: "Project already exists" });
      return;
    }

    const project = {
      id, name,
      emoji: emoji || "\u{1F4E6}",
      status: "active",
      description: description || "",
      ports: ports || {},
      domain: domain || "",
      repo: repo || "",
      stack: stack || [],
      service: service || "",
      serviceStatus: "unknown",
      createdBy: "dashboard",
      createdAt: new Date().toISOString().split("T")[0],
      stories: { total: 0, done: 0 },
      features: [],
      tasks: [],
      github: normalizeGithub(github),
      category: category || "own",
      checklist: DEFAULT_CHECKLIST.map(c => ({ ...c })),
    };

    projects.push(project);
    saveProjects(projects);
    res.json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/projects/:id", async (req, res) => {
  try {
    const projects = loadProjects();
    const _match = findProjectByIdOrRepo(projects, req.params.id); const idx = _match ? projects.findIndex((p: any) => p.id === _match.id) : -1;
    if (idx === -1) { res.status(404).json({ error: "Project not found" }); return; }

    const updates = req.body;

    if (updates.checklistToggle) {
      const { itemId, completed } = updates.checklistToggle;
      if (!projects[idx].checklist) {
        projects[idx].checklist = DEFAULT_CHECKLIST.map(c => ({ ...c }));
      }
      const item = projects[idx].checklist.find((c: any) => c.id === itemId);
      if (item) {
        item.completed = completed;
        item.completedAt = completed ? new Date().toISOString() : undefined;
      }
      delete updates.checklistToggle;
    }

    for (const [key, val] of Object.entries(updates)) {
      if (key !== "id") projects[idx][key] = key === "github" ? normalizeGithub(val) : val;
    }

    projects[idx].updatedAt = new Date().toISOString();
    saveProjects(projects);
    res.json(projects[idx]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/projects/:id/export", async (req, res) => {
  try {
    const projects = loadProjects();
    const project = findProjectByIdOrRepo(projects, req.params.id);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }

    let runs: any[] = [];
    if (project.setfarmRunIds?.length || project.workflowRunId) {
      try {
        const { getRuns } = await import("../utils/setfarm.js");
        const allRuns = (await getRuns()) as any[];
        const runIds = [...(project.setfarmRunIds || [])];
        if (project.workflowRunId) runIds.push(project.workflowRunId);
        runs = allRuns.filter((r: any) => runIds.includes(r.id));
      } catch { /* fetch failed */ }
    }

    const filename = project.id + "-export.json";
    res.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");
    res.json({ version: "1.0", exportedAt: new Date().toISOString(), project, runs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/projects/import", async (req, res) => {
  try {
    const { project } = req.body;
    if (!project || !project.name) {
      res.status(400).json({ error: "Invalid import data" });
      return;
    }

    const projects = loadProjects();
    const id = project.id || project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    if (projects.find((p: any) => p.id === id)) {
      res.status(409).json({ error: "Project already exists" });
      return;
    }

    project.id = id;
    project.importedAt = new Date().toISOString();
    if (!project.checklist) {
      project.checklist = DEFAULT_CHECKLIST.map(c => ({ ...c }));
    }

    projects.push(project);
    saveProjects(projects);
    res.json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function systemctlAction(action: string, service: string) {
  if (!/^[a-zA-Z0-9_@.-]+$/.test(service)) {
    throw new Error("Invalid service name: " + service);
  }
  // "start" → use "restart" to handle stale processes
  const cmd = action === "start" ? "restart" : action;
  // Try user-level first, then system-level
  try {
    execFileSync("systemctl", ["--user", cmd, service], { timeout: 10000, stdio: 'pipe' });
    return;
  } catch (e: any) { console.warn("exec failed:", e?.message || e); }
  execFileSync("sudo", ["systemctl", cmd, service], { timeout: 10000, stdio: 'pipe' });
}

router.post("/projects/:id/toggle", async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    if (action !== "start" && action !== "stop") {
      res.status(400).json({ error: "action must be 'start' or 'stop'" });
      return;
    }
    if (id === "mission-control") {
      res.status(403).json({ error: "Cannot toggle Mission Control" });
      return;
    }
    const projects = loadProjects();
    const project = projects.find((p: any) => p.id === id);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }

    const service = project.service;
    if (!service || !(/^[a-zA-Z0-9_.-]+$/).test(service)) {
      res.status(400).json({ error: "Invalid or missing service name" });
      return;
    }

    if (action === "stop") {
      // Kill orphan processes on the port first
      const port = project.ports?.frontend || project.ports?.backend;
      if (port) {
        try {
          execFileSync("fuser", ["-k", `${port}/tcp`], { timeout: 5000, stdio: 'pipe' });
        } catch (e: any) { console.warn("exec failed:", e?.message || e); }
      }
      try { systemctlAction("stop", service); } catch (e: any) { console.warn("exec failed:", e?.message || e); }
      // Disable so systemd won't auto-restart
      try { execFileSync("systemctl", ["--user", "disable", service], { timeout: 5000, stdio: 'pipe' }); } catch (e: any) { console.warn("exec failed:", e?.message || e); }
      // Marker file for medic guard
      try { mkdirSync(DISABLED_DIR, { recursive: true }); writeFileSync(join(DISABLED_DIR, service), new Date().toISOString()); } catch (e: any) { /* cleanup */ }
      // Persist state
      project.manuallyDisabled = true;
      saveProjects(projects);
    } else {
      // Re-enable + start
      try { execFileSync("systemctl", ["--user", "enable", service], { timeout: 5000, stdio: 'pipe' }); } catch (e: any) { /* cleanup */ }
      try {
        systemctlAction("start", service);
      } catch (err: any) {
        res.status(500).json({ error: "Failed to start service: " + err.message });
        return;
      }
      // Remove marker file
      try { unlinkSync(join(DISABLED_DIR, service)); } catch (e: any) { /* cleanup */ }
      project.manuallyDisabled = false;
      saveProjects(projects);
    }

    // Return expected status immediately — port may not be ready yet
    const serviceStatus = action === "start" ? "active" : "inactive";

    res.json({ success: true, serviceStatus });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/projects/stop-all", async (_req, res) => {
  try {
    const projects = loadProjects();
    const results: { id: string; name: string; stopped: boolean; error?: string }[] = [];

    for (const project of projects) {
      if (project.id === "mission-control") continue;
      if (project.category === "external") continue;

      const service = project.service;
      if (!service || !(/^[a-zA-Z0-9_.-]+$/).test(service)) continue;

      const port = project.ports?.frontend || project.ports?.backend;
      if (!port) continue;

      const isOnline = await checkPort(port);
      if (!isOnline) continue;

      try {
        try { execFileSync("fuser", ["-k", `${port}/tcp`], { timeout: 5000, stdio: 'pipe' }); } catch (e: any) { console.warn("exec failed:", e?.message || e); }
        systemctlAction("stop", service);
        try { execFileSync("systemctl", ["--user", "disable", service], { timeout: 5000, stdio: 'pipe' }); } catch (e: any) { console.warn("exec failed:", e?.message || e); }
        try { mkdirSync(DISABLED_DIR, { recursive: true }); writeFileSync(join(DISABLED_DIR, service), new Date().toISOString()); } catch (e: any) { /* cleanup */ }
        project.manuallyDisabled = true;
        results.push({ id: project.id, name: project.name, stopped: true });
      } catch (err: any) {
        results.push({ id: project.id, name: project.name, stopped: false, error: err.message });
      }
    }

    saveProjects(projects);
    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/projects/start-all", async (_req, res) => {
  try {
    const projects = loadProjects();
    const results: { id: string; name: string; started: boolean; error?: string }[] = [];

    for (const project of projects) {
      if (project.id === "mission-control") continue;
      if (project.category === "external") continue;
      // Skip individually disabled projects — respect user intent
      if (project.manuallyDisabled) continue;

      const service = project.service;
      if (!service || !(/^[a-zA-Z0-9_.-]+$/).test(service)) continue;

      const port = project.ports?.frontend || project.ports?.backend;
      if (!port) continue;

      const isOnline = await checkPort(port);
      if (isOnline) continue;

      try {
        try { execFileSync("systemctl", ["--user", "enable", service], { timeout: 5000, stdio: 'pipe' }); } catch (e: any) { console.warn("exec failed:", e?.message || e); }
        systemctlAction("start", service);
        try { unlinkSync(join(DISABLED_DIR, service)); } catch (e: any) { /* cleanup */ }
        results.push({ id: project.id, name: project.name, started: true });
      } catch (err: any) {
        results.push({ id: project.id, name: project.name, started: false, error: err.message });
      }
    }

    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { confirmName } = req.body || {};
    const projects = loadProjects();
    const project = projects.find((p: any) => p.id === id);

    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    if (confirmName?.trim() !== project.name?.trim()) {
      res.status(400).json({ error: "Name confirmation does not match", expected: project.name });
      return;
    }
    if (id === "mission-control") {
      res.status(403).json({ error: "Cannot delete Mission Control" });
      return;
    }

    const log: string[] = [];

    if (project.service && !project.service.startsWith("docker:") && /^[a-zA-Z0-9_.-]+$/.test(project.service)) {
      try {
        // Try user-level first (most services are user-level)
        try {
          execFileSync("systemctl", ["--user", "stop", project.service], { timeout: 10000, stdio: 'pipe' });
          execFileSync("systemctl", ["--user", "disable", project.service], { timeout: 10000, stdio: 'pipe' });
        } catch {
          // Fallback to system-level
          execFileSync("sudo", ["systemctl", "stop", project.service], { timeout: 10000, stdio: 'pipe' });
          execFileSync("sudo", ["systemctl", "disable", project.service], { timeout: 10000, stdio: 'pipe' });
        }
        // Clean up marker file
        try { unlinkSync(join(DISABLED_DIR, project.service)); } catch (e: any) { /* cleanup */ }
        log.push("Service " + project.service + " stopped and disabled");
      } catch { log.push("Service " + project.service + " stop failed"); }
    }

    if (project.domain) {
      try {
        // Domain from projects.json — sanitize for sed pattern safety
        const safeDomain = project.domain.replace(/[^a-zA-Z0-9._-]/g, "");
        execFileSync("sudo", ["sed", "-i", "/" + safeDomain + "/{N;d;}", "/etc/cloudflared/config.yml"], { timeout: 10000 });
        // cloudflared restart skipped — kills all tunnels including MC. Config change takes effect on next natural restart.
        log.push("Tunnel: " + project.domain + " removed");
      } catch (err: any) { log.push("Tunnel removal failed: " + err.message); }
    }

    if (project.repo && existsSync(project.repo)) {
      try {
        rmSync(project.repo, { recursive: true, force: true });
        log.push("Repo " + project.repo + " deleted");
      } catch (err: any) { log.push("Repo deletion failed: " + err.message); }
    }

    // Delete GitHub repo if exists
    if (project.github) {
      try {
        const repoSlug = project.github.replace("https://github.com/", "");
        if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repoSlug)) {
          execFileSync("gh", ["repo", "delete", repoSlug, "--yes"], { timeout: 15000, stdio: "pipe" });
          log.push("GitHub repo deleted: " + repoSlug);
        }
      } catch (err: any) { log.push("GitHub delete failed: " + (err.stderr?.toString() || err.message)); }
    }

    const updated = projects.filter((p: any) => p.id !== id);
    saveProjects(updated);
    addDeletedId(id);
    log.push("Removed from projects.json");

    // Clean setfarm DB records (runs, steps, stories, claim_log) for this project
    try {
      const dbResult = await deleteRunsByProject(id);
      if (dbResult.deleted > 0) {
        log.push(...dbResult.log);
        log.push(`Setfarm: ${dbResult.deleted} run(s) cleaned`);
      }
    } catch (err: any) {
      log.push('Setfarm DB cleanup failed: ' + err.message);
    }

    res.json({ success: true, deleted: project.name, log });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


/** Normalize github field: ensure full URL or empty string */
function normalizeGithub(val: any): string {
  if (!val || typeof val !== "string") return "";
  const trimmed = val.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("https://github.com/")) return trimmed;
  // Looks like a slug (user/repo)
  if (/^[\w.-]+\/[\w.-]+$/.test(trimmed)) return "https://github.com/" + trimmed;
  return trimmed;
}

export function updateProjectById(id: string, fields: Record<string, any>): any | null {
  const deletedIds = loadDeletedIds();
  if (deletedIds.has(id)) return null;
  const projects = loadProjects();
  const idx = projects.findIndex((p: any) => p.id === id);
  if (idx === -1) return null;
  for (const [key, val] of Object.entries(fields)) {
    if (key !== "id") projects[idx][key] = key === "github" ? normalizeGithub(val) : val;
  }
  projects[idx].updatedAt = new Date().toISOString();
  saveProjects(projects);
  return projects[idx];
}

/** Normalize ID for duplicate detection: strip articles, common suffixes */
function normalizeProjectId(id: string): string {
  return id.replace(/^(?:a-|an-|the-)/, '').replace(/-(app|project|service|tool|system)$/, '');
}


/** Find project by ID, repo basename, or repo path fallback */
function findProjectByIdOrRepo(projects: any[], id: string): any | undefined {
  // 1. Exact ID match
  let p = projects.find((p: any) => p.id === id);
  if (p) return p;
  // 2. Repo basename match (e.g. 'nakliye-crm' matches repo '/home/setrox/projects/nakliye-crm')
  p = projects.find((p: any) => {
    if (!p.repo) return false;
    const basename = p.repo.replace(/\/+$/, '').split('/').pop();
    return basename === id;
  });
  if (p) return p;
  // 3. Normalized ID match
  const normalizedId = normalizeProjectId(id);
  p = projects.find((p: any) => normalizeProjectId(p.id) === normalizedId);
  return p;
}

/** Check if newId is an extension of an existing project (prefix match).
 *  e.g. "recipe-book-finish-remaining" starts with existing "recipe-book" */
function findByPrefix(projects: any[], newId: string): any | null {
  // Check if any existing project id is a prefix of newId (min 3 chars to avoid false matches)
  for (const p of projects) {
    const pid = p.id;
    if (pid.length >= 3 && newId.startsWith(pid + '-') && newId.length > pid.length + 1) {
      return p;
    }
  }
  // Also check reverse: newId is prefix of existing (shouldn't happen often but be safe)
  for (const p of projects) {
    if (newId.length >= 3 && p.id.startsWith(newId + '-')) {
      return p;
    }
  }
  return null;
}

export function createProjectProgrammatic(data: {
  name: string;
  repo?: string;
  stack?: string[];
  emoji?: string;
  createdBy?: string;
  setfarmRunId?: string;
  runNumber?: number;
  task?: string;
  status?: string;
  port?: number;
  type?: string;
}): { created: boolean; project: any; reason?: string } {
  const projects = loadProjects();
  const id = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const normalizedId = normalizeProjectId(id);

  // CHECK 0: Was this project manually deleted? Never re-create it.
  const deletedIds = loadDeletedIds();
  if (deletedIds.has(id) || deletedIds.has(normalizedId)) {
    return { created: false, project: { id, name: data.name }, reason: "deleted" };
  }

  // CHECK 1 (PRIMARY): Repo path match — most reliable dedup signal
  if (data.repo) {
    const repoNorm = data.repo.replace(/\/+$/, '');
    const repoBase = repoNorm.split('/').pop() || '';
    const repoMatch = projects.find((p: any) => {
      if (!p.repo) return false;
      const pNorm = p.repo.replace(/\/+$/, '');
      if (pNorm === repoNorm) return true;
      const pBase = pNorm.split('/').pop() || '';
      return repoBase.length >= 3 && pBase.length >= 3 && repoBase === pBase;
    });
    if (repoMatch) {
      // Backfill repo path if empty on existing entry
      if (!repoMatch.repo && data.repo) {
        try {
          const all = JSON.parse(readFileSync(PROJECTS_FILE, "utf-8"));
          const idx = all.findIndex((p: any) => p.id === repoMatch.id);
          if (idx >= 0) { all[idx].repo = data.repo; writeFileSync(PROJECTS_FILE, JSON.stringify(all, null, 2)); }
        } catch { /* JSON parse failed */ }
      }
      return { created: false, project: repoMatch, reason: "exists" };
    }
  }

  // CHECK 2: Also match by repo when incoming has no repo but existing projects do
  // (catches building-project with empty repo being re-checked after context fills in)
  if (!data.repo) {
    const idBasedRepoMatch = projects.find((p: any) => {
      if (!p.repo) return false;
      const pBase = p.repo.replace(/\/+$/, '').split('/').pop() || '';
      return pBase.length >= 3 && (pBase === id || pBase === normalizedId);
    });
    if (idBasedRepoMatch) {
      return { created: false, project: idBasedRepoMatch, reason: "exists" };
    }
  }

  // CHECK 3: Normalized ID match (catches "an-expense-tracker" vs "expense-tracker")
  const existing = projects.find((p: any) => {
    if (p.id === id) return true;
    const pNorm = normalizeProjectId(p.id);
    return pNorm === normalizedId || pNorm === id || p.id === normalizedId;
  });
  if (existing) {
    return { created: false, project: existing, reason: "exists" };
  }

  // CHECK 4: Prefix match (catches "recipe-book-finish-remaining" matching existing "recipe-book")
  const prefixMatch = findByPrefix(projects, id);
  if (prefixMatch) {
    return { created: false, project: prefixMatch, reason: "exists" };
  }

  const project: any = {
    id,
    name: data.name,
    emoji: data.emoji || "\u{1F527}",
    status: "active",
    description: data.task || "",
    ports: data.port ? { frontend: data.port } : {},
    domain: "",
    repo: data.repo || "",
    stack: data.stack || [],
    service: "",
    serviceStatus: "unknown",
    createdBy: data.createdBy || "setfarm-workflow",
    createdAt: new Date().toISOString().split("T")[0],
    stories: { total: 0, done: 0 },
    features: [],
    tasks: [],
    github: "",
    category: "own",
    checklist: DEFAULT_CHECKLIST.map(c => ({ ...c })),
    setfarmRunIds: data.setfarmRunId ? [data.setfarmRunId] : [],
    runNumber: data.runNumber || undefined,
  };

  projects.push(project);
  saveProjects(projects);
  return { created: true, project };
}


/** One-time cleanup: merge duplicate projects sharing the same repo path.
 *  Keeps the entry with the shortest ID (usually the correct one).
 *  Merges missing fields from duplicates into the winner. */
export function deduplicateProjects(): number {
  const projects = loadProjects();
  const repoMap = new Map<string, any[]>();
  for (const p of projects) {
    if (!p.repo) continue;
    const key = p.repo.replace(/\/+$/, '');
    if (!repoMap.has(key)) repoMap.set(key, []);
    repoMap.get(key)!.push(p);
  }
  const idsToRemove = new Set<string>();
  for (const [, group] of repoMap) {
    if (group.length <= 1) continue;
    // Shortest ID wins (e.g. "autopress" beats "repo-home-setrox-autopress-branch-m")
    group.sort((a: any, b: any) => a.id.length - b.id.length);
    const winner = group[0];
    for (let i = 1; i < group.length; i++) {
      const loser = group[i];
      idsToRemove.add(loser.id);
      // Merge missing fields from loser into winner
      if (!winner.domain && loser.domain) winner.domain = loser.domain;
      if (!winner.service && loser.service) winner.service = loser.service;
      if (loser.stack?.length && !winner.stack?.length) winner.stack = loser.stack;
      if (loser.description?.length > (winner.description || '').length
          && !loser.description.includes('REPO:'))
        winner.description = loser.description;
      // Merge setfarm run IDs
      const runIds = new Set([
        ...(winner.setfarmRunIds || []), ...(loser.setfarmRunIds || [])
      ]);
      winner.setfarmRunIds = [...runIds];
      // Merge ports
      if (loser.ports) {
        winner.ports = { ...(loser.ports || {}), ...(winner.ports || {}) };
      }
    }
  }
  // Also filter out any projects that were manually deleted
  const deletedIds = loadDeletedIds();
  for (const p of projects) {
    if (deletedIds.has(p.id)) idsToRemove.add(p.id);
  }
  if (idsToRemove.size > 0) {
    const cleaned = projects.filter((p: any) => !idsToRemove.has(p.id));
    saveProjects(cleaned);
    console.log('[dedup] Removed', idsToRemove.size, 'duplicate project(s):', [...idsToRemove].join(', '));
  }
  return idsToRemove.size;
}

// Run dedup on module load to clean up any existing duplicates
deduplicateProjects();


export default router;
