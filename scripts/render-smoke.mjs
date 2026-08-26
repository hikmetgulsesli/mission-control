#!/usr/bin/env node
import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, rmdir } from "node:fs/promises";
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
const EXACT_ROUTES = Object.freeze([
  "/",
  "/setfarm",
  "/setfarm/active",
  "/projects",
  `/setfarm/runs/${LEGACY_RUN_ID}`,
  `/setfarm/runs/${V3_RUN_ID}`,
]);
const baseUrl = process.env.MC_RENDER_BASE_URL ?? REQUIRED_BASE_URL;
const screenshotParent = resolve(rootDir, process.env.MC_RENDER_SCREENSHOT_DIR || "artifacts/render-smoke");
const routes = (process.env.MC_RENDER_ROUTES ?? EXACT_ROUTES.join(",")).split(",");
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

export function assertExactRenderRoutes(candidate) {
  if (!Array.isArray(candidate)
    || candidate.length !== EXACT_ROUTES.length
    || candidate.some((route, index) => route !== EXACT_ROUTES[index])) {
    throw new Error("MC_RENDER_ROUTES must equal the exact ordered six-route inventory");
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
}

export async function createRenderScreenshotWorkspace(parentDirectory) {
  const parentExisted = existsSync(parentDirectory);
  await mkdir(parentDirectory, { recursive: true });
  const directory = await mkdtemp(resolve(parentDirectory, ".render-smoke-"));
  let closed = false;
  return Object.freeze({
    directory,
    async close() {
      if (closed) return;
      closed = true;
      await rm(directory, { recursive: true, force: true });
      if (!parentExisted) {
        await rmdir(parentDirectory).catch((error) => {
          if (error?.code !== "ENOENT" && error?.code !== "ENOTEMPTY") throw error;
        });
      }
    },
  });
}

export function createIsolatedChildEnvironment(sourceEnvironment) {
  const environment = { ...sourceEnvironment };
  for (const key of Object.keys(environment)) {
    if (key === "NODE_OPTIONS" || key === "NODE_PATH" || key === "LD_PRELOAD" || key.startsWith("DYLD_")) {
      delete environment[key];
    }
  }
  environment.MC_HOST = REQUIRED_HOST;
  environment.MC_PORT = String(REQUIRED_PORT);
  return environment;
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
  if (!child || !Number.isSafeInteger(child.pid) || child.pid <= 0 || child.exitCode !== null || child.signalCode !== null) {
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
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`isolated Mission Control child exited with ${child.exitCode ?? child.signalCode}`);
    }
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

async function startIsolatedServer(registerChild) {
  assertExactBaseUrl(baseUrl);
  await assertPortAvailable();
  const entry = resolve(rootDir, "dist-server/index.js");
  if (!existsSync(entry)) {
    throw new Error("dist-server/index.js is missing. Run `npm run build` before `npm run render:smoke`.");
  }
  const child = spawn(process.execPath, [entry], {
    cwd: rootDir,
    env: createIsolatedChildEnvironment(process.env),
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
  registerChild(child);
  const spawnFailure = { current: null };
  child.once("error", (error) => { spawnFailure.current = error; });
  child.stdout.on("data", (chunk) => process.stdout.write(`[mc] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[mc] ${chunk}`));
  await waitForIsolatedServer(child, spawnFailure);
  await assertExactChildListener(child);
  return child;
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

async function terminateIsolatedServer(child, verifyPortReleased = assertPortAvailable) {
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
  await verifyPortReleased();
}

async function settleWithin(action, timeoutMs) {
  let timeout;
  try {
    return await Promise.race([
      Promise.resolve().then(action).then(() => true),
      new Promise((resolveTimeout) => {
        timeout = setTimeout(() => resolveTimeout(false), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

export function createRenderCleanupOwner({ workspace, timeoutMs = 5_000, verifyPortReleased = assertPortAvailable }) {
  let child = null;
  let browserServer = null;
  const pages = new Set();
  let closePromise = null;
  return Object.freeze({
    setChild(value) { child = value; },
    setBrowserServer(value) { browserServer = value; },
    addPage(value) { pages.add(value); },
    removePage(value) { pages.delete(value); },
    close() {
      if (closePromise) return closePromise;
      closePromise = (async () => {
        const errors = [];
        try {
          await terminateIsolatedServer(child, verifyPortReleased);
        } catch (error) {
          errors.push(error);
        }
        for (const page of pages) {
          try {
            if (!(await settleWithin(() => page.close(), timeoutMs))) errors.push(new Error("page close timed out"));
          } catch (error) {
            errors.push(error);
          }
        }
        if (browserServer) {
          let closed = false;
          try {
            closed = await settleWithin(() => browserServer.close(), timeoutMs);
          } catch (error) {
            errors.push(error);
          }
          if (!closed) {
            try {
              if (!(await settleWithin(() => browserServer.kill(), timeoutMs))) {
                browserServer.process?.().kill("SIGKILL");
              }
            } catch (error) {
              errors.push(error);
              browserServer.process?.().kill("SIGKILL");
            }
          }
        }
        try {
          await workspace.close();
        } catch (error) {
          errors.push(error);
        }
        if (errors.length > 0) throw new AggregateError(errors, "render smoke cleanup failed");
      })();
      return closePromise;
    },
  });
}

function installCleanupSignalHandlers(owner) {
  let handling = false;
  const handlers = new Map();
  for (const [signal, exitCode] of [["SIGINT", 130], ["SIGTERM", 143]]) {
    const handler = () => {
      if (handling) return;
      handling = true;
      owner.close().finally(() => process.exit(exitCode));
    };
    handlers.set(signal, handler);
    process.once(signal, handler);
  }
  return () => {
    for (const [signal, handler] of handlers) process.off(signal, handler);
  };
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

async function isExactV3ProductBuildAuthorityResponse(response, expectedBaseUrl, parseProductBuildAuthorityV2) {
  if (response.request().method() !== "GET" || response.status() !== 200) return false;
  if (response.url() !== `${expectedBaseUrl}${V3_PRODUCT_BUILD_AUTHORITY_PATH}`) return false;
  try {
    const body = await response.json();
    if (!isPlainObject(body)
      || Object.keys(body).join("\0") !== "schema\0runId\0disposition\0packetAuthority\0refusal\0authorityHash") return false;
    const parsed = parseProductBuildAuthorityV2(body, V3_RUN_ID);
    return parsed === body
      && parsed.disposition === "sealed_packet"
      && isPlainObject(parsed.packetAuthority)
      && parsed.refusal === null;
  } catch {
    return false;
  }
}

export function createRequiredV3ProductBuildAuthorityTracker(expectedBaseUrl, parseProductBuildAuthorityV2) {
  if (typeof parseProductBuildAuthorityV2 !== "function") {
    throw new Error("strict Product Build Authority V2 parser is required");
  }
  let observed = false;
  return Object.freeze({
    async observe(response) {
      if (!(await isExactV3ProductBuildAuthorityResponse(response, expectedBaseUrl, parseProductBuildAuthorityV2))) return false;
      observed = true;
      return true;
    },
    requireObserved() {
      if (!observed) throw new Error("required V3 Product Build Authority response was not observed");
    },
  });
}

async function preflightRequiredV3ProductBuildAuthority(parseProductBuildAuthorityV2) {
  const response = await fetch(`${baseUrl}${V3_PRODUCT_BUILD_AUTHORITY_PATH}`, { signal: AbortSignal.timeout(5_000) });
  const body = await response.json().catch(() => null);
  const tracker = createRequiredV3ProductBuildAuthorityTracker(baseUrl, parseProductBuildAuthorityV2);
  const accepted = await tracker.observe({
    status: () => response.status,
    url: () => response.url,
    request: () => ({ method: () => "GET" }),
    json: async () => body,
  });
  if (!accepted) throw new Error("required V3 Product Build Authority preflight failed");
  tracker.requireObserved();
}

async function loadStrictProductBuildAuthorityV2Parser() {
  const modulePath = resolve(rootDir, "dist-server/services/setfarm-product-build-authority.js");
  if (!existsSync(modulePath)) throw new Error("compiled strict Product Build Authority parser is missing");
  const module = await import(pathToFileURL(modulePath).href);
  if (typeof module.parseProductBuildAuthorityV2 !== "function") {
    throw new Error("compiled strict Product Build Authority V2 parser is unavailable");
  }
  return module.parseProductBuildAuthorityV2;
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
  assertExactRenderRoutes(routes);
  const screenshotWorkspace = await createRenderScreenshotWorkspace(screenshotParent);
  const screenshotDir = screenshotWorkspace.directory;
  const cleanupOwner = createRenderCleanupOwner({ workspace: screenshotWorkspace });
  const removeSignalHandlers = installCleanupSignalHandlers(cleanupOwner);
  const results = [];
  try {
    const child = await startIsolatedServer((value) => cleanupOwner.setChild(value));
    await assertExactChildListener(child);
    const parseProductBuildAuthorityV2 = await loadStrictProductBuildAuthorityV2Parser();
    await preflightRequiredV3ProductBuildAuthority(parseProductBuildAuthorityV2);
    const browserServer = await chromium.launchServer({
      headless: true,
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
    });
    cleanupOwner.setBrowserServer(browserServer);
    const browser = await chromium.connect(browserServer.wsEndpoint());
    for (const route of routes) {
      await assertExactChildListener(child);
      const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 1 });
      cleanupOwner.addPage(page);
      const messages = [];
      const failures = [];
      const responseChecks = [];
      const v3Tracker = route === `/setfarm/runs/${V3_RUN_ID}`
        ? createRequiredV3ProductBuildAuthorityTracker(baseUrl, parseProductBuildAuthorityV2)
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
      if (!(await settleWithin(() => page.close(), 5_000))) throw new Error(`${route} page close timed out`);
      cleanupOwner.removePage(page);
    }
  } finally {
    try {
      await cleanupOwner.close();
    } finally {
      removeSignalHandlers();
    }
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
