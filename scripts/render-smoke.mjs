#!/usr/bin/env node
import { execFile, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const REQUIRED_BASE_URL = "http://127.0.0.1:13081";
const REQUIRED_HOST = "127.0.0.1";
const REQUIRED_PORT = 13081;
const LEGACY_RUN_ID = "ac8cea43-7686-4d27-8092-1e3dd9207ca4";
const V3_RUN_ID = "ad47fe65-4ec4-4fb5-89da-fff71eb4e79a";
const V3_PRODUCT_BUILD_AUTHORITY_PATH = `/api/setfarm/runs/${V3_RUN_ID}/product-build-authority`;
const baseUrl = process.env.MC_RENDER_BASE_URL || REQUIRED_BASE_URL;
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

function assertExactBaseUrl(value) {
  if (value !== REQUIRED_BASE_URL) {
    throw new Error(`MC_RENDER_BASE_URL must equal ${REQUIRED_BASE_URL}`);
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
}

async function isReachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

async function assertPortAvailable() {
  await new Promise((resolveProbe, rejectProbe) => {
    const probe = createServer();
    const timeout = setTimeout(() => {
      probe.close();
      rejectProbe(new Error(`indeterminate listener state on ${REQUIRED_HOST}:${REQUIRED_PORT}`));
    }, 2_000);
    probe.once("error", (error) => {
      clearTimeout(timeout);
      rejectProbe(new Error(`render port ${REQUIRED_HOST}:${REQUIRED_PORT} is preoccupied: ${error.message}`));
    });
    probe.listen({ host: REQUIRED_HOST, port: REQUIRED_PORT, exclusive: true }, () => {
      probe.close((error) => {
        clearTimeout(timeout);
        if (error) rejectProbe(error);
        else resolveProbe();
      });
    });
  });
}

const execFileAsync = promisify(execFile);

async function assertExactChildListener(child) {
  if (!child || !Number.isSafeInteger(child.pid) || child.pid <= 0 || child.exitCode !== null) {
    throw new Error("isolated Mission Control child is not live");
  }
  const { stdout, stderr } = await execFileAsync(
    "/usr/sbin/lsof",
    ["-nP", "-a", "-p", String(child.pid), `-iTCP:${REQUIRED_PORT}`, "-sTCP:LISTEN", "-F0pcfn"],
    { encoding: "utf8", timeout: 2_000, maxBuffer: 64 * 1024 },
  );
  if (stderr !== "") throw new Error("isolated Mission Control listener observation emitted diagnostics");
  const fields = stdout.split("\0").filter(Boolean);
  if (!fields.includes(`p${child.pid}`) || !fields.includes(`n${REQUIRED_HOST}:${REQUIRED_PORT}`)) {
    throw new Error("isolated Mission Control listener identity mismatch");
  }
}

async function waitForIsolatedServer(child, spawnFailure, timeoutMs = 15_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (spawnFailure.current) throw spawnFailure.current;
    if (child.exitCode !== null) throw new Error(`isolated Mission Control child exited with ${child.exitCode}`);
    try {
      await assertExactChildListener(child);
      if (await isReachable(baseUrl)) return;
    } catch (error) {
      if (error?.code !== 1 && !/listener identity mismatch/.test(String(error?.message || error))) throw error;
    }
    await sleep(200);
  }
  throw new Error(`isolated Mission Control did not become ready at ${baseUrl}`);
}

async function startIsolatedServer() {
  assertExactBaseUrl(baseUrl);
  await assertPortAvailable();
  const entry = resolve(rootDir, "dist-server/index.js");
  if (!existsSync(entry)) {
    throw new Error("dist-server/index.js is missing. Run `npm run build` before `npm run render:smoke`.");
  }
  const child = spawn(process.execPath, [entry], {
    cwd: rootDir,
    env: { ...process.env, MC_PORT: String(REQUIRED_PORT), MC_HOST: REQUIRED_HOST },
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
  const spawnFailure = { current: null };
  child.once("error", (error) => { spawnFailure.current = error; });
  child.stdout.on("data", (chunk) => process.stdout.write(`[mc] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[mc] ${chunk}`));
  try {
    await waitForIsolatedServer(child, spawnFailure);
    await assertExactChildListener(child);
    return child;
  } catch (error) {
    await terminateIsolatedServer(child).catch(() => {});
    throw error;
  }
}

async function waitForChildExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return await new Promise((resolveWait) => {
    const timeout = setTimeout(() => {
      child.off("exit", onExit);
      resolveWait(false);
    }, timeoutMs);
    const onExit = () => {
      clearTimeout(timeout);
      resolveWait(true);
    };
    child.once("exit", onExit);
  });
}

async function terminateIsolatedServer(child) {
  if (!child) return;
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    if (!(await waitForChildExit(child, 5_000))) {
      child.kill("SIGKILL");
      if (!(await waitForChildExit(child, 5_000))) {
        throw new Error("isolated Mission Control child did not terminate");
      }
    }
  }
  await assertPortAvailable();
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

export async function isExpectedTypedRenderResponse(response, expectedBaseUrl, renderedRoute) {
  if (response.request().method() !== "GET") return false;
  const url = new URL(response.url());
  const expectedOrigin = new URL(expectedBaseUrl).origin;
  if (url.origin !== expectedOrigin || url.search !== "" || url.hash !== "") return false;
  if (response.status() === 409) {
    const expectedPath = `/api/setfarm/runs/${LEGACY_RUN_ID}/product-build-authority`;
    if (url.pathname !== expectedPath || response.url() !== `${expectedOrigin}${expectedPath}`) return false;
    try {
      if (renderedRoute !== `/setfarm/runs/${LEGACY_RUN_ID}`) return false;
      const body = await response.json();
      return isPlainObject(body)
        && Object.keys(body).join("\0") === "status\0code\0reason\0upstreamStatus\0upstreamCode"
        && body.status === "unavailable"
        && body.code === "SETFARM_PRODUCT_BUILD_AUTHORITY_NOT_READY"
        && body.reason === "not_ready"
        && body.upstreamStatus === 409
        && body.upstreamCode === "RUNTIME_PACKET_RUN_NOT_V3";
    } catch {
      return false;
    }
  }
  if (response.status() !== 404) return false;
  const match = url.pathname.match(/^\/api\/setfarm\/runs\/([^/]+)\/operational-snapshot$/);
  if (!match || renderedRoute !== `/setfarm/runs/${decodeURIComponent(match[1])}`) return false;
  if (response.url() !== `${expectedOrigin}${url.pathname}`) return false;
  try {
    const body = await response.json();
    return isPlainObject(body)
      && Object.keys(body).join("\0") === "status\0code\0reason"
      && body.status === "unavailable"
      && body?.code === "SETFARM_OPERATIONAL_SNAPSHOT_NOT_FOUND"
      && body?.reason === "not_found";
  } catch {
    return false;
  }
}

async function isExactV3ProductBuildAuthorityResponse(response, expectedBaseUrl) {
  if (response.request().method() !== "GET" || response.status() !== 200) return false;
  if (response.url() !== `${expectedBaseUrl}${V3_PRODUCT_BUILD_AUTHORITY_PATH}`) return false;
  try {
    const body = await response.json();
    return isPlainObject(body)
      && body.schema === "setfarm.product-build-authority.v2"
      && body.runId === V3_RUN_ID
      && body.disposition === "sealed_packet"
      && isPlainObject(body.packetAuthority)
      && body.refusal === null
      && typeof body.authorityHash === "string"
      && /^[a-f0-9]{64}$/.test(body.authorityHash);
  } catch {
    return false;
  }
}

export function createRequiredV3ProductBuildAuthorityTracker(expectedBaseUrl) {
  let observed = false;
  return Object.freeze({
    async observe(response) {
      if (!(await isExactV3ProductBuildAuthorityResponse(response, expectedBaseUrl))) return false;
      observed = true;
      return true;
    },
    requireObserved() {
      if (!observed) throw new Error("required V3 Product Build Authority response was not observed");
    },
  });
}

async function preflightRequiredV3ProductBuildAuthority() {
  const response = await fetch(`${baseUrl}${V3_PRODUCT_BUILD_AUTHORITY_PATH}`, { signal: AbortSignal.timeout(5_000) });
  const body = await response.json().catch(() => null);
  const tracker = createRequiredV3ProductBuildAuthorityTracker(baseUrl);
  const accepted = await tracker.observe({
    status: () => response.status,
    url: () => response.url,
    request: () => ({ method: () => "GET" }),
    json: async () => body,
  });
  if (!accepted) throw new Error("required V3 Product Build Authority preflight failed");
  tracker.requireObserved();
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
  assertExactBaseUrl(baseUrl);
  mkdirSync(screenshotDir, { recursive: true });
  let child = null;
  let browser = null;
  const pages = new Set();
  const results = [];
  try {
    child = await startIsolatedServer();
    await assertExactChildListener(child);
    await preflightRequiredV3ProductBuildAuthority();
    browser = await chromium.launch({ headless: true });
    for (const route of routes) {
      await assertExactChildListener(child);
      const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 1 });
      pages.add(page);
      const messages = [];
      const failures = [];
      const responseChecks = [];
      const v3Tracker = route === `/setfarm/runs/${V3_RUN_ID}`
        ? createRequiredV3ProductBuildAuthorityTracker(baseUrl)
        : null;
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
        if (v3Tracker && url === `${baseUrl}${V3_PRODUCT_BUILD_AUTHORITY_PATH}`) {
          responseChecks.push((async () => {
            if (await v3Tracker.observe(response)) return;
            failures.push({ status, url });
          })());
        }
        if (status >= 400 && !/favicon/i.test(url)) {
          responseChecks.push((async () => {
            if (await isExpectedTypedRenderResponse(response, baseUrl, route)) return;
            failures.push({ status, url });
          })());
        }
      });
      const target = `${baseUrl}${route.startsWith("/") ? route : `/${route}`}`;
      await page.goto(target, { waitUntil: "domcontentloaded", timeout: 15_000 });
      const state = await assertRendered(page, route);
      await Promise.all(responseChecks);
      if (v3Tracker) v3Tracker.requireObserved();
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
      pages.delete(page);
    }
  } finally {
    for (const page of pages) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    await terminateIsolatedServer(child);
  }
  console.log(JSON.stringify({ ok: true, baseUrl, routes: results }, null, 2));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((err) => {
    console.error(`[render-smoke] ${err?.message || err}`);
    if (/Executable doesn't exist|browserType.launch/i.test(String(err?.message || err))) {
      console.error("[render-smoke] Install Chromium once with: npx playwright install chromium");
    }
    process.exit(1);
  });
}
