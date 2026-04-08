/**
 * Auto-deployment service — handles building, deploying, and managing
 * systemd services for projects completed by Setfarm workflows.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { execSync, execFileSync } from "child_process";
import { PATHS } from "../config.js";

// ── Port allocation ─────────────────────────────────────────────────

const PORT_REGISTRY = PATHS.portRegistry;
const PORT_RANGE_START = 3507;
const PORT_RANGE_END = 3599;

function getUsedPorts(): Set<number> {
  const used = new Set<number>();
  // From port-registry.md
  try {
    const reg = readFileSync(PORT_REGISTRY, "utf-8");
    for (const m of reg.matchAll(/\|\s*(\d{4})\s*\|/g)) {
      used.add(parseInt(m[1]));
    }
  } catch {
    /* port registry read failed */
  }
  // From projects.json
  try {
    const pFile = join(import.meta.dirname, "../../projects.json");
    const projects = JSON.parse(readFileSync(pFile, "utf-8"));
    for (const p of projects) {
      for (const v of Object.values(p.ports || {})) {
        if (typeof v === "number") used.add(v as number);
      }
    }
  } catch {
    /* projects.json read failed */
  }
  // From system (ss -tlnp) — controlled command, no user input
  try {
    // Keep execSync: uses shell redirect (2>/dev/null)
    const ss = execSync("ss -tlnp 2>/dev/null", { timeout: 3000 }).toString();
    for (const m of ss.matchAll(/:(\d+)\s/g)) {
      used.add(parseInt(m[1]));
    }
  } catch (e: any) {
    console.warn("ss port scan failed:", e?.message || e);
  }
  return used;
}

export function allocatePort(): number | null {
  const used = getUsedPorts();
  for (let p = PORT_RANGE_START; p <= PORT_RANGE_END; p++) {
    if (!used.has(p)) return p;
  }
  return null;
}

export function updatePortRegistry(port: number, name: string): void {
  try {
    let reg = readFileSync(PORT_REGISTRY, "utf-8");
    if (reg.includes("| " + port + " |")) return;
    const line = "| " + port + " | " + name + " | proje |\n";
    if (reg.includes("Sonraki bos port")) {
      reg = reg.replace(/(\nSonraki bos port)/s, "\n" + line + "$1");
    } else {
      reg = reg.trimEnd() + "\n" + line;
    }
    const used = getUsedPorts();
    used.add(port);
    let next = PORT_RANGE_START;
    while (used.has(next) && next <= PORT_RANGE_END) next++;
    reg = reg.replace(/Sonraki bos port:.*/, "Sonraki bos port: " + next);
    writeFileSync(PORT_REGISTRY, reg);
    console.log("[auto-deploy] Port registry updated: " + port + " -> " + name);
  } catch (err: any) {
    console.error("[auto-deploy] Port registry update failed:", err.message);
  }
}

// ── Detection helpers ───────────────────────────────────────────────

export function detectPort(repo: string, _task: string): number | null {
  // 1. Check server/.env for PORT (monorepo: server + client pattern)
  try {
    const serverEnv = join(repo, "server", ".env");
    if (existsSync(serverEnv)) {
      const env = readFileSync(serverEnv, "utf-8");
      const m = env.match(/^PORT\s*=\s*(\d+)/m);
      if (m) return parseInt(m[1]);
    }
  } catch {
    /* server .env read failed */
  }
  // 2. Check server/src/index.ts for PORT constant (monorepo fallback)
  try {
    const serverIndex = join(repo, "server", "src", "index.ts");
    if (existsSync(serverIndex)) {
      const src = readFileSync(serverIndex, "utf-8");
      const m = src.match(/PORT\s*(?:=|\|\|)\s*['"]?(\d{4})['"]?/);
      if (m) return parseInt(m[1]);
    }
  } catch {
    /* server index.ts read failed */
  }
  // 3. Check root .env for PORT
  try {
    const rootEnv = join(repo, ".env");
    if (existsSync(rootEnv)) {
      const env = readFileSync(rootEnv, "utf-8");
      const m = env.match(/^PORT\s*=\s*(\d+)/m);
      if (m) return parseInt(m[1]);
    }
  } catch {
    /* root .env read failed */
  }
  // 4. Check package.json start/dev script for explicit port
  try {
    const pkg = JSON.parse(readFileSync(join(repo, "package.json"), "utf-8"));
    const startScript =
      (pkg.scripts?.start || "") + " " + (pkg.scripts?.dev || "");
    const portMatch = startScript.match(/-p\s*(\d+)|--port\s*(\d+)|-l\s*(\d+)/);
    if (portMatch) return parseInt(portMatch[1] || portMatch[2] || portMatch[3]);
  } catch {
    /* package.json read failed */
  }
  // 5. Check vite.config for port (Vite dev port — only if no server port found above)
  try {
    for (const vp of ["vite.config.ts", "client/vite.config.ts"]) {
      const vitePath = join(repo, vp);
      if (existsSync(vitePath)) {
        const vite = readFileSync(vitePath, "utf-8");
        const m = vite.match(/port\s*:\s*(\d+)/);
        if (m) return parseInt(m[1]);
      }
    }
  } catch {
    /* vite config read failed */
  }
  // 6. Allocate from port registry
  return allocatePort();
}

export function detectStartCmd(repo: string, port: number): string | null {
  const SERVE_BIN = PATHS.serveBin;
  try {
    const pkg = JSON.parse(readFileSync(join(repo, "package.json"), "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    // Monorepo: server/ + client/dist/ pattern (Express serving React build)
    if (
      existsSync(join(repo, "server", "dist", "index.js")) &&
      existsSync(join(repo, "client", "dist", "index.html"))
    ) {
      ensureExpressStatic(repo);
      return `/usr/bin/node dist/index.js`;
    }
    // Static SPA (Vite/React/Vue) — use serve for zero node_modules dependency
    if (existsSync(join(repo, "dist", "index.html"))) {
      return `${SERVE_BIN} dist -l ${port} -s --no-port-switching`;
    }
    // Next.js
    if (deps["next"] && existsSync(join(repo, ".next"))) {
      return `/usr/bin/npx next start -p ${port}`;
    }
    // Express / generic Node with start script
    if (pkg.scripts?.start) return `/usr/bin/npm start`;
  } catch {
    /* package.json read failed */
  }
  return null;
}

/**
 * Detect if repo has a separate backend service (FastAPI, Express server dir, etc.)
 */
export function detectBackend(
  repo: string
): {
  hasBackend: boolean;
  backendDir: string;
  backendType: string;
  port: number | null;
} | null {
  // Pattern 1: backend/ directory with Python (FastAPI/Flask/Django)
  const backendDir = join(repo, "backend");
  if (existsSync(backendDir)) {
    const reqPath = join(backendDir, "requirements.txt");
    if (existsSync(reqPath)) {
      const reqs = readFileSync(reqPath, "utf-8").toLowerCase();
      let type = "python";
      if (reqs.includes("fastapi")) type = "fastapi";
      else if (reqs.includes("flask")) type = "flask";
      else if (reqs.includes("django")) type = "django";
      // Check if backend has its own .env with PORT
      let port: number | null = null;
      try {
        const envPath = join(backendDir, ".env");
        if (existsSync(envPath)) {
          const env = readFileSync(envPath, "utf-8");
          const m = env.match(/^PORT\s*=\s*(\d+)/m);
          if (m) port = parseInt(m[1]);
        }
      } catch {
        /* .env read failed */
      }
      // Check for existing systemd service
      if (!port) {
        try {
          const slug = repo.split("/").pop() || "";
          const svcPath = "/etc/systemd/system/" + slug + "-backend.service";
          if (existsSync(svcPath)) {
            const svc = readFileSync(svcPath, "utf-8");
            const m = svc.match(/--port\s+(\d+)|PORT=(\d+)/);
            if (m) port = parseInt(m[1] || m[2]);
          }
        } catch {
          /* systemd service read failed */
        }
      }
      return { hasBackend: true, backendDir, backendType: type, port };
    }
  }
  // Pattern 2: server/ directory with package.json (Node.js backend)
  const serverDir = join(repo, "server");
  if (existsSync(join(serverDir, "package.json"))) {
    let port: number | null = null;
    try {
      const env = readFileSync(join(serverDir, ".env"), "utf-8");
      const m = env.match(/^PORT\s*=\s*(\d+)/m);
      if (m) port = parseInt(m[1]);
    } catch {
      /* server .env read failed */
    }
    return { hasBackend: true, backendDir: serverDir, backendType: "node", port };
  }
  return null;
}

export function detectStack(repo: string): string[] {
  try {
    const pkgPath = join(repo, "package.json");
    if (!existsSync(pkgPath)) return [];
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const stack: string[] = [];
    if (deps["react"]) stack.push("React");
    if (deps["vue"]) stack.push("Vue");
    if (deps["next"]) stack.push("Next.js");
    if (deps["express"]) stack.push("Express");
    if (deps["vite"]) stack.push("Vite");
    if (deps["typescript"] || deps["ts-node"]) stack.push("TypeScript");
    if (deps["tailwindcss"]) stack.push("Tailwind CSS");
    // Detect Python backend frameworks in monorepo
    try {
      const reqPaths = [
        join(repo, "backend", "requirements.txt"),
        join(repo, "requirements.txt"),
      ];
      for (const reqPath of reqPaths) {
        if (existsSync(reqPath)) {
          const reqs = readFileSync(reqPath, "utf-8").toLowerCase();
          if (reqs.includes("fastapi") && !stack.includes("FastAPI"))
            stack.push("FastAPI");
          else if (reqs.includes("flask") && !stack.includes("Flask"))
            stack.push("Flask");
          else if (reqs.includes("django") && !stack.includes("Django"))
            stack.push("Django");
          if (
            (reqs.includes("fastapi") ||
              reqs.includes("flask") ||
              reqs.includes("django") ||
              reqs.includes("scrapy")) &&
            !stack.includes("Python")
          ) {
            stack.push("Python");
          }
          break;
        }
      }
    } catch {
      /* requirements.txt read failed */
    }
    return stack;
  } catch {
    /* package.json read failed */
    return [];
  }
}

// ── Build & service management ──────────────────────────────────────

export function runBuild(repo: string): { ok: boolean; error?: string } {
  try {
    const pkg = JSON.parse(readFileSync(join(repo, "package.json"), "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const hasPnpm = existsSync(join(repo, "pnpm-lock.yaml"));
    const pm = hasPnpm ? "pnpm" : "npm";

    // Install deps if node_modules missing
    if (!existsSync(join(repo, "node_modules"))) {
      console.log("[auto-deploy] Installing dependencies with " + pm);
      execFileSync(pm, ["install"], {
        cwd: repo,
        timeout: 120000,
        stdio: "pipe",
      });
    }

    // Next.js: check .next/BUILD_ID
    if (deps["next"] && !existsSync(join(repo, ".next", "BUILD_ID"))) {
      console.log("[auto-deploy] Running next build for " + repo);
      execFileSync(pm, ["run", "build"], {
        cwd: repo,
        timeout: 300000,
        stdio: "pipe",
      });
    }
    // Vite: check dist/index.html
    else if (deps["vite"] && !existsSync(join(repo, "dist", "index.html"))) {
      console.log("[auto-deploy] Running vite build for " + repo);
      execFileSync(pm, ["run", "build"], {
        cwd: repo,
        timeout: 120000,
        stdio: "pipe",
      });
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: (err.message || "").slice(0, 200) };
  }
}

export function healthCheck(
  port: number,
  retries = 3,
  delay = 3
): boolean {
  for (let i = 0; i < retries; i++) {
    try {
      // Keep execSync: uses shell quoting and redirect (2>/dev/null)
      const code = execSync(
        "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:" +
          port +
          "/ 2>/dev/null",
        { timeout: 10000 }
      )
        .toString()
        .trim();
      if (["200", "301", "302", "304"].includes(code)) return true;
    } catch {
      /* healthcheck request failed */
    }
    if (i < retries - 1) {
      Atomics.wait(
        new Int32Array(new SharedArrayBuffer(4)),
        0,
        0,
        delay * 1000
      );
    }
  }
  return false;
}

export function findExistingService(
  _port: number,
  slug: string,
  repo?: string
): string | null {
  try {
    // 1. Check by repo WorkingDirectory (most reliable — same dir = same project)
    if (repo && /^[a-zA-Z0-9/_.-]+$/.test(repo)) {
      const grepResult = execFileSync(
        "grep",
        ["-rl", `WorkingDirectory=${repo}`, "/etc/systemd/system/"],
        { timeout: 3000, encoding: "utf-8" }
      ).trim();
      if (grepResult) {
        const svcPath = grepResult.split("\n")[0];
        const svcName = svcPath.split("/").pop() || "";
        if (svcName) return svcName;
      }
    }
    // 2. Check by slug prefix (all services, not just running)
    const prefix = slug.split("-").slice(0, 2).join("-");
    const units = execFileSync(
      "systemctl",
      ["list-units", "--type=service", "--all", "--no-legend"],
      { timeout: 3000, encoding: "utf-8" }
    );
    for (const line of units.split("\n")) {
      const svc = line.trim().split(/\s+/)[0];
      if (svc && svc.endsWith(".service") && svc.includes(prefix)) {
        return svc;
      }
    }
  } catch (e: any) {
    console.warn("findExistingService failed:", e?.message || e);
  }
  return null;
}

/** For monorepo projects: ensure Express serves client/dist/ as static files */
function ensureExpressStatic(repo: string): void {
  const serverIndex = join(repo, "server", "src", "index.ts");
  if (!existsSync(serverIndex)) return;
  let src = readFileSync(serverIndex, "utf-8");
  if (src.includes("express.static") && src.includes("client/dist")) return; // already patched
  // Add path import if missing
  if (
    !src.includes("import path from") &&
    !src.includes("import * as path from")
  ) {
    src = "import path from 'path';\n" + src;
  }
  // Add static serving before error handler or before app.listen
  const staticBlock = `
// Serve client build (production) — auto-injected by setfarm deploy
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => { res.sendFile(path.join(clientDist, 'index.html')); });
`;
  if (src.includes("app.use(errorHandler")) {
    src = src.replace(
      "app.use(errorHandler",
      staticBlock + "\napp.use(errorHandler"
    );
  } else if (src.includes("app.listen")) {
    src = src.replace("app.listen", staticBlock + "\napp.listen");
  }
  writeFileSync(serverIndex, src);
  // Rebuild server after patching
  try {
    execFileSync("npm", ["run", "build"], {
      cwd: join(repo, "server"),
      timeout: 30000,
    });
  } catch (err: any) {
    console.error("[ensureExpressStatic] Rebuild failed:", err.message);
  }
}

function patchVitePreview(repo: string, port: number): void {
  const vitePath = join(repo, "vite.config.ts");
  if (!existsSync(vitePath)) return;
  let vite = readFileSync(vitePath, "utf-8");
  if (vite.includes("preview:") || vite.includes("allowedHosts")) return;
  // Add preview block before server block
  vite = vite.replace(
    /(\s+server\s*:\s*\{)/,
    `  preview: {\n    port: ${port},\n    host: true,\n    allowedHosts: true,\n  },\n$1`
  );
  writeFileSync(vitePath, vite);
}

// ── Slug / naming helpers ───────────────────────────────────────────

export function slugify(name: string, maxLen = 30): string {
  let slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (slug.length > maxLen) slug = slug.slice(0, maxLen).replace(/-$/, "");
  return slug;
}

// ── Main deploy function ────────────────────────────────────────────

const TUNNEL_ID = "92d8df83-3623-4850-ba41-29126106d020";

export function autoDeployProject(
  projectId: string,
  projectName: string,
  repo: string,
  task: string
): {
  deployed: boolean;
  port?: number;
  domain?: string;
  service?: string;
  error?: string;
} {
  if (!repo || !existsSync(repo)) return { deployed: false, error: "no repo" };

  const slug = slugify(projectName);
  const serviceName = slug + ".service";
  const domain = slug + ".setrox.com.tr";

  // 1. Check for existing service for this REPO (not just slug)
  const existing = findExistingService(0, slug, repo);
  if (existing) {
    try {
      const svcContent = readFileSync(
        "/etc/systemd/system/" + existing,
        "utf-8"
      );
      const portMatch = svcContent.match(/(?:PORT=|(?:-p|-l)\s+)(\d+)/);
      const existingPort = portMatch ? parseInt(portMatch[1]) : null;
      console.log(
        '[auto-deploy] Existing service "' +
          existing +
          '" for repo ' +
          repo +
          " \u2014 restarting"
      );
      try {
        execFileSync("sudo", ["systemctl", "restart", existing], {
          timeout: 15000,
        });
      } catch (e: any) {
        console.warn("systemctl restart failed:", e?.message || e);
      }
      return {
        deployed: true,
        port: existingPort || undefined,
        domain,
        service: existing,
      };
    } catch (e: any) {
      console.warn("existing service restart failed:", e?.message || e);
    }
  }

  // 2. Build if needed (before creating service!)
  const build = runBuild(repo);
  if (!build.ok) {
    console.error(
      "[auto-deploy] Build FAILED for " + repo + ": " + build.error
    );
    return {
      deployed: false,
      error: "build failed: " + (build.error || "unknown"),
    };
  }

  // 3. Detect port (package.json > vite.config > port registry)
  const port = detectPort(repo, task);
  if (!port)
    return { deployed: false, error: "no port \u2014 registry full?" };

  // 4. Detect start command (needs build artifacts)
  const startCmd = detectStartCmd(repo, port);
  if (!startCmd)
    return {
      deployed: false,
      error: "no start command (build artifacts missing?)",
    };

  try {
    const unit = [
      "[Unit]",
      `Description=${projectName} (Auto-deployed)`,
      "After=network.target",
      "StartLimitBurst=5",
      "StartLimitIntervalSec=60",
      "",
      "[Service]",
      "Type=simple",
      "User=setrox",
      `WorkingDirectory=${repo}`,
      `ExecStart=${startCmd}`,
      "Restart=on-failure",
      "RestartSec=5",
      "Environment=NODE_ENV=production",
      `Environment=PORT=${port}`,
      "",
      "[Install]",
      "WantedBy=multi-user.target",
    ].join("\n");

    writeFileSync("/tmp/" + serviceName, unit);
    execFileSync(
      "sudo",
      ["cp", `/tmp/${serviceName}`, `/etc/systemd/system/${serviceName}`],
      { timeout: 5000 }
    );
    execFileSync("sudo", ["systemctl", "daemon-reload"], { timeout: 5000 });
    // Kill any dev server (vite, webpack, etc.) in the repo directory or occupying the port
    try {
      execFileSync("pkill", ["-f", `vite.*${repo}`], {
        timeout: 5000,
        stdio: "pipe",
      });
    } catch {
      /* pkill returns non-zero when no process matched */
    }
    try {
      execFileSync("fuser", ["-k", `${port}/tcp`], {
        timeout: 5000,
        stdio: "pipe",
      });
    } catch {
      /* fuser returns non-zero when port not in use */
    }
    // Wait for port to free up
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
    execFileSync("sudo", ["systemctl", "enable", "--now", serviceName], {
      timeout: 10000,
    });

    // 5. Healthcheck
    const healthy = healthCheck(port);
    if (!healthy) {
      console.error(
        "[auto-deploy] Healthcheck FAILED: " +
          serviceName +
          " port " +
          port +
          " - rolling back"
      );
      // Rollback: stop the broken service so it doesn't run in a broken state
      try {
        execFileSync("sudo", ["systemctl", "stop", serviceName], {
          timeout: 10000,
        });
      } catch (e: any) {
        console.warn("systemctl stop failed:", e?.message || e);
      }
      try {
        execFileSync("sudo", ["systemctl", "disable", serviceName], {
          timeout: 5000,
        });
      } catch (e: any) {
        console.warn("systemctl disable failed:", e?.message || e);
      }
      // Send Discord notification about failed deploy
      try {
        const payload = JSON.stringify({
          channel: "setfarm-pipeline",
          message:
            "Auto-deploy FAILED: " +
            projectName +
            " (port " +
            port +
            ") - healthcheck failed, service rolled back",
        });
        writeFileSync("/tmp/deploy-notify.json", payload);
        execFileSync(
          "curl",
          [
            "-s",
            "-X",
            "POST",
            (process.env.MC_INTERNAL_URL || "http://127.0.0.1:3080") + "/api/discord-notify",
            "-H",
            "Content-Type: application/json",
            "-d",
            "@/tmp/deploy-notify.json",
          ],
          { timeout: 10000, stdio: "pipe" }
        );
      } catch (e: any) {
        console.warn("deploy notification failed:", e?.message || e);
      }
      return {
        deployed: false,
        error: "healthcheck failed - service stopped (rollback)",
      };
    }
    console.log(
      "[auto-deploy] Healthcheck OK: " + serviceName + " port " + port
    );

    // 6. Update port registry
    updatePortRegistry(port, projectName);

    // Add to Cloudflare tunnel
    try {
      const cfgPath = "/etc/cloudflared/config.yml";
      const cfg = readFileSync(cfgPath, "utf-8");
      if (!cfg.includes(domain)) {
        const entry = `- hostname: ${domain}\n  service: http://127.0.0.1:${port}\n`;
        // Match catch-all with any indent (or none)
        const updated = cfg.replace(
          /^(\s*)- service: http_status:404/m,
          entry + "$1- service: http_status:404"
        );
        writeFileSync("/tmp/cloudflared-config.yml", updated);
        execFileSync(
          "sudo",
          ["cp", "/tmp/cloudflared-config.yml", cfgPath],
          { timeout: 5000 }
        );
        execFileSync("sudo", ["systemctl", "restart", "cloudflared"], {
          timeout: 15000,
        });
        execFileSync(
          "sudo",
          ["cloudflared", "tunnel", "route", "dns", TUNNEL_ID, domain],
          { timeout: 15000 }
        );
      }
    } catch (err: any) {
      console.error("Tunnel setup warning:", err.message);
    }

    return { deployed: true, port, domain, service: serviceName };
  } catch (err: any) {
    return { deployed: false, error: err.message };
  }
}
