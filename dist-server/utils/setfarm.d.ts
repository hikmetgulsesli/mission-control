export declare function getWorkflows(): Promise<any>;
export declare function getRuns(): Promise<any>;
export declare function getStories(): Promise<any>;
export declare function getRunStories(runId: string): Promise<any>;
export declare function getEvents(runId?: string): Promise<any>;
export declare function getSetfarmActivity(limit?: number): Promise<any[]>;
export declare function getSetfarmAgentStats(): Promise<{
    name: string;
    runs: any;
    successRate: number;
    failed: any;
    timeout: any;
    avgDuration: number;
    lastActive: any;
}[]>;
export declare function getSetfarmAlerts(): Promise<{
    counts: {
        abandoned: number;
        timeout: number;
        failed: number;
    };
    recent: any[];
}>;
