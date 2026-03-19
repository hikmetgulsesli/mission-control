/**
 * Agent feed service — scans agent session files and provides
 * a chat-style feed of recent agent messages.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { PATHS } from "../config.js";
import { ensureAgentFeedTable, insertFeedEntry, getAgentFeed as getAgentFeedFromDb, pruneAgentFeed, } from "../utils/setfarm-db.js";
/**
 * Scan agent session directories for recent messages, insert into
 * the feed DB table, and return the latest entries.
 */
export async function getAgentFeed(limit) {
    await ensureAgentFeedTable();
    const agentsDir = PATHS.agentsDir;
    if (existsSync(agentsDir)) {
        const agentDirs = readdirSync(agentsDir).filter((d) => {
            try {
                return statSync(join(agentsDir, d)).isDirectory();
            }
            catch {
                return false;
            }
        });
        for (const agentId of agentDirs) {
            const sessionsDir = join(agentsDir, agentId, "sessions");
            if (!existsSync(sessionsDir))
                continue;
            const files = readdirSync(sessionsDir)
                .filter((f) => f.endsWith(".jsonl"))
                .map((f) => ({
                name: f,
                path: join(sessionsDir, f),
                mtime: statSync(join(sessionsDir, f)).mtimeMs,
            }))
                .sort((a, b) => b.mtime - a.mtime);
            if (files.length === 0)
                continue;
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
                        if (msg.role !== "assistant")
                            continue;
                        const contentArr = Array.isArray(msg.content) ? msg.content : [];
                        const textParts = contentArr
                            .filter((c) => c.type === "text")
                            .map((c) => c.text || "");
                        const text = textParts.join(" ").trim();
                        if (!text || text.length < 5)
                            continue;
                        if (/HEARTBEAT|\[idle\]|polling|no.?tasks?/i.test(text))
                            continue;
                        const truncated = text.length > 200 ? text.slice(0, 200) + "..." : text;
                        await insertFeedEntry(agentId, agentId, truncated, sessionId);
                    }
                    catch {
                        /* malformed JSONL entry */
                    }
                }
            }
            catch (e) {
                console.warn("session file read failed:", e?.message || e);
            }
        }
    }
    // Prune old entries periodically (1 in 20 chance)
    if (Math.random() < 0.05)
        pruneAgentFeed(5000).catch(() => { });
    return getAgentFeedFromDb(limit);
}
