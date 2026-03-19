/**
 * Agent feed service — scans agent session files and provides
 * a chat-style feed of recent agent messages.
 */
/**
 * Scan agent session directories for recent messages, insert into
 * the feed DB table, and return the latest entries.
 */
export declare function getAgentFeed(limit: number): Promise<any[]>;
