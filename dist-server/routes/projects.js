import { Router } from "express";
import { readFileSync, writeFileSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { createConnection } from "net";
import { execSync } from "child_process";
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
        // Antfarm project port range starts at 3507
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
        if (projects.find((p) => p.id === id)) {
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
        if (project.antfarmRunIds?.length || project.workflowRunId) {
            try {
                const { getRuns } = await import("../utils/antfarm.js");
                const allRuns = (await getRuns());
                const runIds = [...(project.antfarmRunIds || [])];
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
export function createProjectProgrammatic(data) {
    const projects = loadProjects();
    const id = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    if (projects.find((p) => p.id === id)) {
        return { created: false, project: projects.find((p) => p.id === id), reason: "exists" };
    }
    const project = {
        id,
        name: data.name,
        emoji: data.emoji || "\u{1F527}",
        status: "active",
        description: data.task || "",
        ports: {},
        domain: "",
        repo: data.repo || "",
        stack: data.stack || [],
        service: "",
        serviceStatus: "unknown",
        createdBy: data.createdBy || "antfarm-workflow",
        createdAt: new Date().toISOString().split("T")[0],
        stories: { total: 0, done: 0 },
        features: [],
        tasks: [],
        github: "",
        category: "own",
        checklist: DEFAULT_CHECKLIST.map(c => ({ ...c })),
        antfarmRunIds: data.antfarmRunId ? [data.antfarmRunId] : [],
    };
    projects.push(project);
    saveProjects(projects);
    return { created: true, project };
}
export default router;
