/**
 * Agent feed service — scans agent session files and provides
 * a chat-style feed of recent agent messages.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { basename, join } from "path";
import { PATHS } from "../config.js";
import {
  ensureAgentFeedTable,
  insertFeedEntry,
  getAgentFeed as getAgentFeedFromDb,
  pruneAgentFeed,
} from "../utils/setfarm-db.js";
import { getSetfarmActivity } from "../utils/setfarm.js";

type FeedEntry = {
  id: number;
  agent_id: string;
  agent_name: string;
  message: string;
  session_id: string | null;
  created_at: string;
};

function formatEventMessage(event: any): string {
  const label = String(event.event || event.action || "event").replace(".", " ").toUpperCase();
  const detail = event.detail || event.storyTitle || event.storyId || event.stepId || "";
  return detail ? `${label}: ${detail}` : label;
}

function compactAgentText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function shouldSkipAgentText(text: string): boolean {
  return !text || text.length < 5 || /HEARTBEAT|\[idle\]|polling|no.?tasks?/i.test(text);
}

async function recordAgentText(
  dbAvailable: boolean,
  agentId: string,
  text: string,
  sessionId?: string,
): Promise<FeedEntry | null> {
  const compact = compactAgentText(text);
  if (shouldSkipAgentText(compact)) return null;
  const truncated = compact.length > 500 ? compact.slice(0, 500) + "..." : compact;
  if (dbAvailable) await insertFeedEntry(agentId, agentId, truncated, sessionId);
  return {
    id: 0,
    agent_id: agentId,
    agent_name: agentId,
    message: truncated,
    session_id: sessionId || null,
    created_at: new Date().toISOString(),
  };
}

async function fallbackAgentFeed(limit: number): Promise<any[]> {
  const events = await getSetfarmActivity(limit);
  return events.map((event: any, index: number) => {
    const agentId = event.agentId || event.agent || `${event.workflowId || "setfarm"}_${event.stepId || "event"}`;
    return {
      id: index + 1,
      agent_id: agentId,
      agent_name: agentId,
      message: formatEventMessage(event),
      session_id: event.runId || null,
      created_at: event.ts || new Date().toISOString(),
    };
  });
}

/**
 * Scan agent session directories for recent messages, insert into
 * the feed DB table, and return the latest entries.
 */
export async function getAgentFeed(limit: number): Promise<any[]> {
  let dbAvailable = true;
  const memoryRows: FeedEntry[] = [];
  const seenMemoryRows = new Set<string>();
  const remember = (row: FeedEntry | null) => {
    if (!row) return;
    const key = `${row.agent_id}|${row.session_id || ""}|${row.message}`;
    if (seenMemoryRows.has(key)) return;
    seenMemoryRows.add(key);
    memoryRows.push({ ...row, id: memoryRows.length + 1 });
  };

  try {
    await ensureAgentFeedTable();
  } catch {
    dbAvailable = false;
  }
  const agentsDir = PATHS.agentsDir;

  if (existsSync(agentsDir)) {
    const agentDirs = readdirSync(agentsDir).filter((d: string) => {
      try {
        return statSync(join(agentsDir, d)).isDirectory();
      } catch {
        return false;
      }
    });

    for (const agentId of agentDirs) {
      const sessionsDir = join(agentsDir, agentId, "sessions");
      if (!existsSync(sessionsDir)) continue;

      const files = readdirSync(sessionsDir)
        .filter((f: string) => f.endsWith(".jsonl"))
        .map((f: string) => ({
          name: f,
          path: join(sessionsDir, f),
          mtime: statSync(join(sessionsDir, f)).mtimeMs,
        }))
        .sort((a: any, b: any) => b.mtime - a.mtime);

      if (files.length === 0) continue;
      const latest = files[0];
      const sessionId = latest.name.replace(".jsonl", "");

      try {
        const raw = readFileSync(latest.path, "utf-8");
        const lines = raw.trim().split("\n");
        const tail = lines.slice(-60);

        for (const line of tail) {
          try {
            const entry = JSON.parse(line);
            const msg = entry.message || entry;
            if (msg.role !== "assistant") continue;
            const contentArr = Array.isArray(msg.content) ? msg.content : [];
            const textParts = contentArr
              .filter((c: any) => c.type === "text")
              .map((c: any) => c.text || "");
            const text = textParts.join(" ").trim();
            remember(await recordAgentText(dbAvailable, agentId, text, sessionId));
          } catch {
            /* malformed JSONL entry */
          }
        }
      } catch (e: any) {
        console.warn("session file read failed:", e?.message || e);
      }
    }
  }

  const transcriptsDir = PATHS.transcriptsDir;
  if (existsSync(transcriptsDir)) {
    const transcriptFiles: Array<{ path: string; name: string; mtime: number }> = [];
    for (const workflowDir of readdirSync(transcriptsDir)) {
      const fullWorkflowDir = join(transcriptsDir, workflowDir);
      try {
        if (!statSync(fullWorkflowDir).isDirectory()) continue;
      } catch {
        continue;
      }
      for (const file of readdirSync(fullWorkflowDir)) {
        if (!file.endsWith(".log")) continue;
        const fullPath = join(fullWorkflowDir, file);
        try {
          transcriptFiles.push({ path: fullPath, name: file, mtime: statSync(fullPath).mtimeMs });
        } catch {
          /* ignore disappearing files */
        }
      }
    }

    for (const file of transcriptFiles.sort((a, b) => b.mtime - a.mtime).slice(0, Math.max(limit, 30))) {
      const sessionId = basename(file.name, ".log");
      const agentMatch = sessionId.match(/^(.+?)-\d{4}-\d{2}-\d{2}T/);
      const agentId = agentMatch?.[1] || sessionId;
      try {
        const raw = readFileSync(file.path, "utf-8").slice(-256_000);
        const lines = raw.trim().split("\n").slice(-120);
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (entry?.type !== "item.completed") continue;
            const item = entry.item || {};
            if (item.type !== "agent_message" || typeof item.text !== "string") continue;
            remember(await recordAgentText(dbAvailable, agentId, item.text, sessionId));
          } catch {
            /* non-json transcript line */
          }
        }
      } catch (e: any) {
        console.warn("transcript file read failed:", e?.message || e);
      }
    }
  }

  // Prune old entries periodically (1 in 20 chance)
  if (dbAvailable && Math.random() < 0.05) pruneAgentFeed(5000).catch(() => {});

  if (dbAvailable) {
    try {
      const rows = await getAgentFeedFromDb(limit);
      if (rows.length > 0) return rows;
    } catch {
      dbAvailable = false;
    }
  }

  if (memoryRows.length > 0) return memoryRows.slice(0, limit);

  return fallbackAgentFeed(limit);
}
