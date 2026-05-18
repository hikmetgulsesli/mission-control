import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { config } from "../config.js";
import { sql } from "./pg.js";

export interface SupervisorSummary {
  available: boolean;
  runId: string;
  workdir: string | null;
  stateRoot: string | null;
  status: string;
  scope?: string;
  provider?: string;
  fallbackProviders?: string[];
  supervisorSessionId?: string;
  activeWorkers: string[];
  activeFixers: string[];
  updatedAt?: string;
  storyCount: number;
  openBlockers: number;
  warnings: number;
  resolved: number;
  pendingInterventions: number;
  checklistItems: number;
  checklistPassed: number;
  visual: {
    available: boolean;
    ok?: boolean;
    skipped?: boolean;
    status: "pass" | "fail" | "skipped" | "missing";
    issueCount: number;
    routesChecked: string[];
    controlsChecked: number;
    screenshots: string[];
    reportPath?: string;
  };
  fixerPlan?: unknown;
  artifacts: Record<string, string | undefined>;
  recentEvents: unknown[];
  interventionText?: string;
  visualReportText?: string;
  candidateWorkdirs: string[];
  source?: "setfarm-api" | "local-ledger" | "missing";
}

interface RunLike {
  id: string;
  context?: string | Record<string, unknown> | null;
  task?: string | null;
}

const SETFARM_TIMEOUT_MS = Number(process.env.MC_SUPERVISOR_SETFARM_TIMEOUT_MS || 800);
const SETFARM_CIRCUIT_MS = Number(process.env.MC_SUPERVISOR_SETFARM_CIRCUIT_MS || 10_000);
const SUMMARY_CACHE_MS = Number(process.env.MC_SUPERVISOR_CACHE_MS || 5_000);

let setfarmCircuitOpenUntil = 0;
const supervisorCache = new Map<string, { expiresAt: number; summary: SupervisorSummary | null }>();

function emptySummary(runId: string, candidates: string[] = []): SupervisorSummary {
  return {
    available: false,
    runId,
    workdir: null,
    stateRoot: null,
    status: "missing",
    activeWorkers: [],
    activeFixers: [],
    storyCount: 0,
    openBlockers: 0,
    warnings: 0,
    resolved: 0,
    pendingInterventions: 0,
    checklistItems: 0,
    checklistPassed: 0,
    visual: {
      available: false,
      status: "missing",
      issueCount: 0,
      routesChecked: [],
      controlsChecked: 0,
      screenshots: [],
    },
    artifacts: {},
    recentEvents: [],
    candidateWorkdirs: candidates,
    source: "missing",
  };
}

function expandTilde(value: string): string {
  return value.startsWith("~/") ? join(homedir(), value.slice(2)) : value;
}

function parseContext(input: RunLike["context"]): Record<string, unknown> {
  if (!input) return {};
  if (typeof input === "object") return input;
  try {
    const parsed = JSON.parse(input);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function addCandidate(candidates: string[], value: unknown): void {
  if (typeof value !== "string") return;
  const expanded = expandTilde(value.trim());
  if (!expanded || candidates.includes(expanded)) return;
  candidates.push(expanded);
}

function workdirCandidates(run: RunLike): string[] {
  const context = parseContext(run.context);
  const candidates: string[] = [];
  addCandidate(candidates, context.story_workdir);
  addCandidate(candidates, context.verify_workdir);
  addCandidate(candidates, context.repo);
  addCandidate(candidates, context.REPO);

  const task = String(run.task || "");
  for (const match of task.matchAll(/(?:^|\s)(?:--repo|REPO:?)\s+([^\s]+)/gi)) {
    addCandidate(candidates, match[1]);
  }
  for (const match of task.matchAll(/(?:\/Users|\/home)\/[^\s'"]+/g)) {
    addCandidate(candidates, match[0]);
  }
  return candidates;
}

function readJson<T>(file: string): T | null {
  try {
    if (!existsSync(file)) return null;
    return JSON.parse(readFileSync(file, "utf-8")) as T;
  } catch {
    return null;
  }
}

function readText(file: string, maxChars: number): string | undefined {
  try {
    if (!existsSync(file)) return undefined;
    const text = readFileSync(file, "utf-8");
    return text.length > maxChars ? text.slice(0, maxChars) : text;
  } catch {
    return undefined;
  }
}

function readJsonlTail(file: string, limit: number): unknown[] {
  try {
    if (!existsSync(file)) return [];
    return readFileSync(file, "utf-8")
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-limit)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { raw: line };
        }
      });
  } catch {
    return [];
  }
}

function supervisorCacheKey(runId: string): string {
  return `${config.setfarmUrl}|${runId}`;
}

async function fetchSetfarmSupervisor(runId: string): Promise<SupervisorSummary | null> {
  const now = Date.now();
  const cacheKey = supervisorCacheKey(runId);
  const cached = supervisorCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.summary;
  if (now < setfarmCircuitOpenUntil) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SETFARM_TIMEOUT_MS);
  try {
    const res = await fetch(`${config.setfarmUrl}/api/runs/${encodeURIComponent(runId)}/supervisor`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      if (res.status >= 500) setfarmCircuitOpenUntil = Date.now() + SETFARM_CIRCUIT_MS;
      supervisorCache.set(cacheKey, { expiresAt: Date.now() + 1_000, summary: null });
      return null;
    }
    const data = await res.json() as SupervisorSummary;
    const summary = { ...data, source: "setfarm-api" } satisfies SupervisorSummary;
    supervisorCache.set(cacheKey, { expiresAt: Date.now() + SUMMARY_CACHE_MS, summary });
    return summary;
  } catch {
    setfarmCircuitOpenUntil = Date.now() + SETFARM_CIRCUIT_MS;
    supervisorCache.set(cacheKey, { expiresAt: Date.now() + 1_000, summary: null });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function localStatus(metadata: any, state: any, visualResult: any, fixerPlan: unknown | null): string {
  if (fixerPlan) return "fixing";
  if (metadata?.status) return metadata.status;
  if (state?.projectStatus === "blocked") return "blocked";
  if (visualResult?.skipped) return "warning";
  if (visualResult) return visualResult.ok ? "passed" : "blocked";
  return "unknown";
}

function localSupervisorSummary(run: RunLike): SupervisorSummary {
  const candidates = workdirCandidates(run);
  for (const workdir of candidates.filter((candidate) => existsSync(candidate))) {
    const stateRoot = join(workdir, ".setfarm", "supervisor", run.id);
    if (!existsSync(stateRoot)) continue;

    const runPath = join(stateRoot, "SUPERVISOR_RUN.json");
    const statePath = join(stateRoot, "SUPERVISOR_STATE.json");
    const checklistPath = join(stateRoot, "SUPERVISOR_CHECKLIST.json");
    const eventsPath = join(stateRoot, "SUPERVISOR_EVENTS.jsonl");
    const interventionsPath = join(stateRoot, "SUPERVISOR_INTERVENTIONS.md");
    const fixerPlanPath = join(stateRoot, "SUPERVISOR_FIXER_PLAN.json");
    const visualResultPath = join(stateRoot, "visual", "VISUAL_QA_RESULT.json");
    const visualReportPath = join(stateRoot, "visual", "VISUAL_QA_REPORT.md");

    const metadata = readJson<any>(runPath);
    const state = readJson<any>(statePath);
    const checklist = readJson<any>(checklistPath);
    const visualResult = readJson<any>(visualResultPath);
    const fixerPlan = readJson<unknown>(fixerPlanPath);
    const stories = Object.values((state?.stories || {}) as Record<string, any>);

    return {
      available: true,
      runId: run.id,
      workdir,
      stateRoot,
      status: localStatus(metadata, state, visualResult, fixerPlan),
      scope: metadata?.scope,
      provider: metadata?.provider,
      fallbackProviders: metadata?.fallbackProviders,
      supervisorSessionId: metadata?.supervisorSessionId,
      activeWorkers: metadata?.activeWorkers || [],
      activeFixers: metadata?.activeFixers || [],
      updatedAt: metadata?.updatedAt || state?.updatedAt || visualResult?.createdAt,
      storyCount: stories.length,
      openBlockers: stories.reduce((sum, story: any) => sum + (story.openBlockers?.length || 0), 0),
      warnings: stories.reduce((sum, story: any) => sum + (story.warnings?.length || 0), 0),
      resolved: stories.reduce((sum, story: any) => sum + (story.resolved?.length || 0), 0),
      pendingInterventions: (state?.interventions || []).filter((item: any) => item.result !== "resolved").length,
      checklistItems: checklist?.items?.length || 0,
      checklistPassed: (checklist?.items || []).filter((item: any) => state?.evidence?.[item.id]?.status === "passed").length,
      visual: {
        available: !!visualResult,
        ok: visualResult?.ok,
        skipped: visualResult?.skipped,
        status: visualResult ? (visualResult.skipped ? "skipped" : visualResult.ok ? "pass" : "fail") : "missing",
        issueCount: visualResult?.issues?.length || 0,
        routesChecked: visualResult?.routesChecked || [],
        controlsChecked: visualResult?.controlsChecked || 0,
        screenshots: visualResult?.screenshots || [],
        reportPath: existsSync(visualReportPath) ? visualReportPath : undefined,
      },
      fixerPlan: fixerPlan || undefined,
      artifacts: {
        run: existsSync(runPath) ? runPath : undefined,
        state: existsSync(statePath) ? statePath : undefined,
        checklist: existsSync(checklistPath) ? checklistPath : undefined,
        events: existsSync(eventsPath) ? eventsPath : undefined,
        interventions: existsSync(interventionsPath) ? interventionsPath : undefined,
        fixerPlan: existsSync(fixerPlanPath) ? fixerPlanPath : undefined,
        visualResult: existsSync(visualResultPath) ? visualResultPath : undefined,
        visualReport: existsSync(visualReportPath) ? visualReportPath : undefined,
      },
      recentEvents: readJsonlTail(eventsPath, 25),
      interventionText: readText(interventionsPath, 12000),
      visualReportText: readText(visualReportPath, 12000),
      candidateWorkdirs: candidates,
      source: "local-ledger",
    };
  }
  return emptySummary(run.id, candidates);
}

export async function getSupervisorSummaryForRun(run: RunLike): Promise<SupervisorSummary> {
  return (await fetchSetfarmSupervisor(run.id)) || localSupervisorSummary(run);
}

export async function getSupervisorSummaryByRunId(runId: string): Promise<SupervisorSummary | null> {
  const runs = await sql`SELECT * FROM runs WHERE id = ${runId} LIMIT 1`;
  const run = runs[0] as RunLike | undefined;
  if (!run) return null;
  return getSupervisorSummaryForRun(run);
}
