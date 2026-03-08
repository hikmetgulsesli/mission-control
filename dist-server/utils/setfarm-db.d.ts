declare const STUCK_DETECTION_MS: number;
declare const STUCK_THRESHOLD_MS: number;
declare const MAX_AUTO_UNSTICK = 3;
export { STUCK_DETECTION_MS, STUCK_THRESHOLD_MS, MAX_AUTO_UNSTICK };
export declare function querySetfarmDb(sql: string): Promise<any[]>;
export declare function execSetfarmDb(sql: string): Promise<string>;
export declare function getStuckRuns(thresholdMs?: number): Promise<any[]>;
/**
 * Find runs stuck in limbo: run is "running" but has no "running" steps
 * (all remaining steps are "failed" or "cancelled"). This happens after
 * gateway restarts or cancel+resume operations.
 */
export declare function getLimboRuns(): Promise<any[]>;
/**
 * Auto-resume a limbo run: set run status to failed, then resume via CLI
 */
export declare function resumeLimboRun(runId: string): Promise<{
    success: boolean;
    message: any;
}>;
export declare function unstickRun(runId: string, stepId?: string): Promise<{
    success: boolean;
    message: string;
    unstuckedSteps: {
        id: any;
        name: any;
    }[];
} | {
    success: boolean;
    unstuckedSteps: {
        id: any;
        name: any;
    }[];
    message?: undefined;
}>;
export declare function getRunDetail(runId: string): Promise<{
    run: any;
    steps: any[];
    stories: any[];
}>;
export declare function diagnoseStuckStep(runId: string, stepId?: string): Promise<{
    stepId: string;
    cause: string;
    fixable: boolean;
    description: string;
    excerpt: string;
    suggestedFix: any;
    storyId?: undefined;
} | {
    stepId: any;
    storyId: any;
    cause: string;
    fixable: boolean;
    description: string;
    excerpt: string;
    suggestedFix: string;
}>;
interface AutoFixResult {
    success: boolean;
    message: string;
}
export declare function tryAutoFix(runId: string, cause: string, storyId?: string | null): Promise<AutoFixResult>;
export declare function skipStory(runId: string, storyId: string, reason: string): Promise<{
    success: boolean;
    message: string;
}>;
export declare function detectInfiniteLoop(runId: string): Promise<{
    isLooping: boolean;
    stepId?: undefined;
    stepName?: undefined;
    claimCount?: undefined;
    reason?: undefined;
} | {
    isLooping: boolean;
    stepId: any;
    stepName: any;
    claimCount: any;
    reason: string;
}>;
export declare function checkMissingInput(runId: string): Promise<{
    hasMissing: boolean;
    stepId: any;
    stepName: any;
    missingVar: any;
    reason: string;
} | {
    hasMissing: boolean;
    stepId?: undefined;
    stepName?: undefined;
    missingVar?: undefined;
    reason?: undefined;
}>;
export declare function failEntireRun(runId: string, reason: string): Promise<{
    success: boolean;
    message: string;
}>;
export declare function ensureAgentFeedTable(): Promise<void>;
export declare function insertFeedEntry(agentId: string, agentName: string, message: string, sessionId?: string): Promise<boolean>;
export declare function getAgentFeed(limit?: number): Promise<any[]>;
export declare function pruneAgentFeed(keep?: number): Promise<void>;
export declare function clearAgentFeed(): Promise<void>;
export declare function deleteRun(runId: string, cleanupProject?: boolean): Promise<{
    deleted: boolean;
    runId: string;
    log: string[];
}>;
