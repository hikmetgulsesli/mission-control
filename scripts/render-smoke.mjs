#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const baseUrl = (process.env.MC_RENDER_BASE_URL || "http://127.0.0.1:3080").replace(/\/$/, "");
const screenshotDir = resolve(rootDir, process.env.MC_RENDER_SCREENSHOT_DIR || "artifacts/render-smoke");
const routes = (process.env.MC_RENDER_ROUTES || "/,/setfarm,/setfarm/active,/rules")
  .split(",")
  .map((route) => route.trim())
  .filter(Boolean);
const expectText = (process.env.MC_RENDER_EXPECT_TEXT || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function isReachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(url, timeoutMs = 15_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isReachable(url)) return;
    await sleep(300);
  }
  throw new Error(`Mission Control did not become reachable at ${url}`);
}

async function maybeStartServer() {
  if (await isReachable(baseUrl)) return null;
  const entry = resolve(rootDir, "dist-server/index.js");
  if (!existsSync(entry)) {
    throw new Error("dist-server/index.js is missing. Run `npm run build` before `npm run render:smoke`.");
  }
  const port = new URL(baseUrl).port || "3080";
  const child = spawn(process.execPath, [entry], {
    cwd: rootDir,
    env: { ...process.env, MC_PORT: port, MC_HOST: "127.0.0.1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[mc] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[mc] ${chunk}`));
  await waitForServer(baseUrl);
  return child;
}

function safeName(route) {
  return route.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root";
}

function assertNoFatalConsole(route, messages) {
  const fatal = messages.filter((msg) => {
    const text = msg.text;
    // Network failures are checked with their exact URL and typed response
    // below; Chromium's generic console line carries no request identity.
    if (/favicon|ResizeObserver loop limit exceeded|Failed to load resource/i.test(text)) return false;
    return msg.type === "error" || /uncaught|typeerror|referenceerror|react minified error/i.test(text);
  });
  if (fatal.length > 0) {
    throw new Error(`${route} emitted fatal browser console output:\n${fatal.map((msg) => `- ${msg.type}: ${msg.text}`).join("\n")}`);
  }
}

async function isExpectedTypedNotFound(response) {
  if (response.status() !== 404) return false;
  const url = new URL(response.url());
  if (!/^\/api\/setfarm\/runs\/[^/]+\/operational-snapshot$/.test(url.pathname)) return false;
  try {
    const body = await response.json();
    return body?.status === "unavailable"
      && body?.code === "SETFARM_OPERATIONAL_SNAPSHOT_NOT_FOUND"
      && body?.reason === "not_found";
  } catch {
    return false;
  }
}

function assertNoFailedRequests(route, failures) {
  if (failures.length > 0) {
    throw new Error(`${route} emitted failed browser requests:\n${failures.map((failure) => `- ${failure.status || failure.kind}: ${failure.url}`).join("\n")}`);
  }
}

async function assertRendered(page, route) {
  await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {});
  await page.waitForSelector("#root", { timeout: 8_000 });
  const state = await page.evaluate(() => {
    const root = document.querySelector("#root");
    const bodyText = document.body.innerText || "";
    const rect = root?.getBoundingClientRect();
    const visibleElements = Array.from(document.querySelectorAll("button,a,input,select,[role='button'],[data-testid]"))
      .filter((el) => {
        const style = window.getComputedStyle(el);
        const box = el.getBoundingClientRect();
        return style.visibility !== "hidden" && style.display !== "none" && box.width > 0 && box.height > 0;
      }).length;
    return {
      title: document.title,
      textLength: bodyText.trim().length,
      rootWidth: rect?.width || 0,
      rootHeight: rect?.height || 0,
      visibleElements,
      bodyText,
    };
  });

  if (state.rootWidth < 100 || state.rootHeight < 100) {
    throw new Error(`${route} rendered an undersized root: ${state.rootWidth}x${state.rootHeight}`);
  }
  if (state.textLength < 40) {
    throw new Error(`${route} rendered too little text (${state.textLength} chars)`);
  }
  if (state.visibleElements < 2) {
    throw new Error(`${route} rendered too few interactive elements (${state.visibleElements})`);
  }
  for (const expected of expectText) {
    if (!state.bodyText.includes(expected)) {
      throw new Error(`${route} did not include expected text: ${expected}`);
    }
  }
  return state;
}

async function main() {
  mkdirSync(screenshotDir, { recursive: true });
  const child = await maybeStartServer();
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const route of routes) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 1 });
      const messages = [];
      const failures = [];
      const responseChecks = [];
      page.on("console", (msg) => messages.push({ type: msg.type(), text: msg.text() }));
      page.on("pageerror", (err) => messages.push({ type: "error", text: err.message }));
      page.on("requestfailed", (request) => {
        const url = request.url();
        if (/favicon/i.test(url)) return;
        failures.push({ kind: request.failure()?.errorText || "requestfailed", url });
      });
      page.on("response", (response) => {
        const status = response.status();
        const url = response.url();
        if (status >= 400 && !/favicon/i.test(url)) {
          responseChecks.push((async () => {
            if (await isExpectedTypedNotFound(response)) return;
            failures.push({ status, url });
          })());
        }
      });
      const target = `${baseUrl}${route.startsWith("/") ? route : `/${route}`}`;
      await page.goto(target, { waitUntil: "domcontentloaded", timeout: 15_000 });
      const state = await assertRendered(page, route);
      await Promise.all(responseChecks);
      assertNoFailedRequests(route, failures);
      assertNoFatalConsole(route, messages);
      const screenshotPath = resolve(screenshotDir, `${safeName(route)}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      results.push({
        route,
        title: state.title,
        textLength: state.textLength,
        visibleElements: state.visibleElements,
        screenshot: screenshotPath,
      });
      await page.close();
    }
  } finally {
    await browser.close();
    if (child) child.kill("SIGTERM");
  }
  console.log(JSON.stringify({ ok: true, baseUrl, routes: results }, null, 2));
}

main().catch((err) => {
  console.error(`[render-smoke] ${err?.message || err}`);
  if (/Executable doesn't exist|browserType.launch/i.test(String(err?.message || err))) {
    console.error("[render-smoke] Install Chromium once with: npx playwright install chromium");
  }
  process.exit(1);
});
