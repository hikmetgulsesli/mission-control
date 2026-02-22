import { Router } from "express";
import { readFileSync, writeFileSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { createConnection } from "net";
import { execSync, execFileSync } from "child_process";
import { config } from "../config.js";
const router = Router();
const PROJECTS_FILE = config.projectsJson || join(import.meta.dirname, "../../projects.json");
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
function checkPort(port) {
    return new Promise((resolve) => {
        const sock = createConnection({ port, host: "127.0.0.1" }, () => {
            sock.destroy();
            resolve(true);
        });
        sock.on("error", () => resolve(false));
        sock.setTimeout(1000, () => { sock.destroy(); resolve(false); });
    });
}
function loadProjects() {
    if (!existsSync(PROJECTS_FILE))
        return [];
    return JSON.parse(readFileSync(PROJECTS_FILE, "utf-8"));
}
function saveProjects(projects) {
    writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}
async function enrichWithStatus(projects) {
    for (const p of projects) {
        const port = p.ports?.frontend || p.ports?.backend;
        if (port) {
            p.serviceStatus = (await checkPort(port)) ? "active" : "inactive";
        }
        else {
            p.serviceStatus = "unknown";
        }
    }
    return projects;
}
router.get("/projects", async (_req, res) => {
    try {
        const projects = await enrichWithStatus(loadProjects());
        res.json(projects);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get("/projects/next-port", async (_req, res) => {
    try {
        const projects = loadProjects();
        const usedPorts = new Set();
        for (const p of projects) {
            for (const v of Object.values(p.ports || {})) {
                if (typeof v === "number")
                    usedPorts.add(v);
            }
        }
        // Also scan system ports in use (no shell injection — execFileSync with array args)
        try {
            const ssOutput = execFileSync("ss", ["-tlnp"], { encoding: 'utf-8', timeout: 5000 });
            for (const line of ssOutput.split('\n')) {
                const portMatch = line.match(/:(\d+)\s/);
                if (portMatch) {
                    const p = parseInt(portMatch[1], 10);
                    if (p >= 3000 && p <= 9999)
                        usedPorts.add(p);
                }
            }
        }
        catch { }
        // Setfarm project port range starts at 3507
        let port = 3507;
        while (usedPorts.has(port))
            port++;
        res.json({ port });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get("/projects/:id", async (req, res) => {
    try {
        const projects = loadProjects();
        const project = projects.find((p) => p.id === req.params.id);
        if (!project) {
            res.status(404).json({ error: "Project not found" });
            return;
        }
        res.json(project);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post("/projects", async (req, res) => {
    try {
        const projects = loadProjects();
        const { name, description, emoji, ports, domain, repo, stack, service, github, category } = req.body;
        if (!name) {
            res.status(400).json({ error: "name required" });
            return;
        }
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        const normalizedId = normalizeProjectId(id);
        // Check exact match OR normalized match
        if (projects.find((p) => p.id === id || normalizeProjectId(p.id) === normalizedId)) {
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
            github: github || "",
            category: category || "own",
            checklist: DEFAULT_CHECKLIST.map(c => ({ ...c })),
        };
        projects.push(project);
        saveProjects(projects);
        res.json(project);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.patch("/projects/:id", async (req, res) => {
    try {
        const projects = loadProjects();
        const idx = projects.findIndex((p) => p.id === req.params.id);
        if (idx === -1) {
            res.status(404).json({ error: "Project not found" });
            return;
        }
        const updates = req.body;
        if (updates.checklistToggle) {
            const { itemId, completed } = updates.checklistToggle;
            if (!projects[idx].checklist) {
                projects[idx].checklist = DEFAULT_CHECKLIST.map(c => ({ ...c }));
            }
            const item = projects[idx].checklist.find((c) => c.id === itemId);
            if (item) {
                item.completed = completed;
                item.completedAt = completed ? new Date().toISOString() : undefined;
            }
            delete updates.checklistToggle;
        }
        for (const [key, val] of Object.entries(updates)) {
            if (key !== "id")
                projects[idx][key] = val;
        }
        projects[idx].updatedAt = new Date().toISOString();
        saveProjects(projects);
        res.json(projects[idx]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get("/projects/:id/export", async (req, res) => {
    try {
        const projects = loadProjects();
        const project = projects.find((p) => p.id === req.params.id);
        if (!project) {
            res.status(404).json({ error: "Project not found" });
            return;
        }
        let runs = [];
        if (project.setfarmRunIds?.length || project.workflowRunId) {
            try {
                const { getRuns } = await import("../utils/setfarm.js");
                const allRuns = (await getRuns());
                const runIds = [...(project.setfarmRunIds || [])];
                if (project.workflowRunId)
                    runIds.push(project.workflowRunId);
                runs = allRuns.filter((r) => runIds.includes(r.id));
            }
            catch { }
        }
        const filename = project.id + "-export.json";
        res.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");
        res.json({ version: "1.0", exportedAt: new Date().toISOString(), project, runs });
    }
    catch (err) {
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
        if (projects.find((p) => p.id === id)) {
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.delete("/projects/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { confirmName } = req.body || {};
        const projects = loadProjects();
        const project = projects.find((p) => p.id === id);
        if (!project) {
            res.status(404).json({ error: "Project not found" });
            return;
        }
        if (confirmName !== project.name) {
            res.status(400).json({ error: "Name confirmation does not match", expected: project.name });
            return;
        }
        if (id === "mission-control") {
            res.status(403).json({ error: "Cannot delete Mission Control" });
            return;
        }
        const log = [];
        if (project.service && !project.service.startsWith("docker:")) {
            try {
                execSync("sudo systemctl stop " + project.service + " 2>/dev/null || true", { timeout: 10000 });
                execSync("sudo systemctl disable " + project.service + " 2>/dev/null || true", { timeout: 10000 });
                log.push("Service " + project.service + " stopped and disabled");
            }
            catch {
                log.push("Service " + project.service + " stop failed");
            }
        }
        if (project.domain) {
            try {
                const cfgPath = "/etc/cloudflared/config.yml";
                const cfg = readFileSync(cfgPath, "utf-8");
                const lines = cfg.split("\n");
                const newLines = [];
                let skip = false;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes(project.domain)) {
                        skip = true;
                        continue;
                    }
                    if (skip && lines[i].trimStart().startsWith("service:")) {
                        skip = false;
                        continue;
                    }
                    skip = false;
                    newLines.push(lines[i]);
                }
                writeFileSync(cfgPath, newLines.join("\n"));
                execSync("sudo systemctl restart cloudflared", { timeout: 15000 });
                log.push("Tunnel entry " + project.domain + " removed");
            }
            catch (err) {
                log.push("Tunnel removal failed: " + err.message);
            }
        }
        if (project.repo && existsSync(project.repo)) {
            try {
                rmSync(project.repo, { recursive: true, force: true });
                log.push("Repo " + project.repo + " deleted");
            }
            catch (err) {
                log.push("Repo deletion failed: " + err.message);
            }
        }
        const updated = projects.filter((p) => p.id !== id);
        saveProjects(updated);
        log.push("Removed from projects.json");
        res.json({ success: true, deleted: project.name, log });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
export function updateProjectById(id, fields) {
    const projects = loadProjects();
    const idx = projects.findIndex((p) => p.id === id);
    if (idx === -1)
        return null;
    for (const [key, val] of Object.entries(fields)) {
        if (key !== "id")
            projects[idx][key] = val;
    }
    projects[idx].updatedAt = new Date().toISOString();
    saveProjects(projects);
    return projects[idx];
}
/** Normalize ID for duplicate detection: strip articles, common suffixes */
function normalizeProjectId(id) {
    return id.replace(/^(?:a-|an-|the-)/, '').replace(/-(app|project|service|tool|system)$/, '');
}
/** Check if newId is an extension of an existing project (prefix match).
 *  e.g. "recipe-book-finish-remaining" starts with existing "recipe-book" */
function findByPrefix(projects, newId) {
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
export function createProjectProgrammatic(data) {
    const projects = loadProjects();
    const id = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const normalizedId = normalizeProjectId(id);
    // CHECK 1 (PRIMARY): Repo path match — most reliable dedup signal
    if (data.repo) {
        const repoNorm = data.repo.replace(/\/+$/, '');
        const repoBase = repoNorm.split('/').pop() || '';
        const repoMatch = projects.find((p) => {
            if (!p.repo)
                return false;
            const pNorm = p.repo.replace(/\/+$/, '');
            if (pNorm === repoNorm)
                return true;
            const pBase = pNorm.split('/').pop() || '';
            return repoBase.length >= 3 && pBase.length >= 3 && repoBase === pBase;
        });
        if (repoMatch) {
            // Backfill repo path if empty on existing entry
            if (!repoMatch.repo && data.repo) {
                try {
                    const all = JSON.parse(readFileSync(PROJECTS_FILE, "utf-8"));
                    const idx = all.findIndex((p) => p.id === repoMatch.id);
                    if (idx >= 0) {
                        all[idx].repo = data.repo;
                        writeFileSync(PROJECTS_FILE, JSON.stringify(all, null, 2));
                    }
                }
                catch { }
            }
            return { created: false, project: repoMatch, reason: "exists" };
        }
    }
    // CHECK 2: Also match by repo when incoming has no repo but existing projects do
    // (catches building-project with empty repo being re-checked after context fills in)
    if (!data.repo) {
        const idBasedRepoMatch = projects.find((p) => {
            if (!p.repo)
                return false;
            const pBase = p.repo.replace(/\/+$/, '').split('/').pop() || '';
            return pBase.length >= 3 && (pBase === id || pBase === normalizedId);
        });
        if (idBasedRepoMatch) {
            return { created: false, project: idBasedRepoMatch, reason: "exists" };
        }
    }
    // CHECK 3: Normalized ID match (catches "an-expense-tracker" vs "expense-tracker")
    const existing = projects.find((p) => {
        if (p.id === id)
            return true;
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
    const project = {
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
    };
    projects.push(project);
    saveProjects(projects);
    return { created: true, project };
}
/** One-time cleanup: merge duplicate projects sharing the same repo path.
 *  Keeps the entry with the shortest ID (usually the correct one).
 *  Merges missing fields from duplicates into the winner. */
export function deduplicateProjects() {
    const projects = loadProjects();
    const repoMap = new Map();
    for (const p of projects) {
        if (!p.repo)
            continue;
        const key = p.repo.replace(/\/+$/, '');
        if (!repoMap.has(key))
            repoMap.set(key, []);
        repoMap.get(key).push(p);
    }
    const idsToRemove = new Set();
    for (const [, group] of repoMap) {
        if (group.length <= 1)
            continue;
        // Shortest ID wins (e.g. "autopress" beats "repo-home-setrox-autopress-branch-m")
        group.sort((a, b) => a.id.length - b.id.length);
        const winner = group[0];
        for (let i = 1; i < group.length; i++) {
            const loser = group[i];
            idsToRemove.add(loser.id);
            // Merge missing fields from loser into winner
            if (!winner.domain && loser.domain)
                winner.domain = loser.domain;
            if (!winner.service && loser.service)
                winner.service = loser.service;
            if (loser.stack?.length && !winner.stack?.length)
                winner.stack = loser.stack;
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
    if (idsToRemove.size > 0) {
        const cleaned = projects.filter((p) => !idsToRemove.has(p.id));
        saveProjects(cleaned);
        console.log('[dedup] Removed', idsToRemove.size, 'duplicate project(s):', [...idsToRemove].join(', '));
    }
    return idsToRemove.size;
}
// Run dedup on module load to clean up any existing duplicates
deduplicateProjects();
export default router;
