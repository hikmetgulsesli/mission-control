/**
 * Auto-deployment service — handles building, deploying, and managing
 * systemd services for projects completed by Setfarm workflows.
 */
export declare function allocatePort(): number | null;
export declare function updatePortRegistry(port: number, name: string): void;
export declare function detectPort(repo: string, _task: string): number | null;
export declare function detectStartCmd(repo: string, port: number): string | null;
/**
 * Detect if repo has a separate backend service (FastAPI, Express server dir, etc.)
 */
export declare function detectBackend(repo: string): {
    hasBackend: boolean;
    backendDir: string;
    backendType: string;
    port: number | null;
} | null;
export declare function detectStack(repo: string): string[];
export declare function runBuild(repo: string): {
    ok: boolean;
    error?: string;
};
export declare function healthCheck(port: number, retries?: number, delay?: number): boolean;
export declare function findExistingService(_port: number, slug: string, repo?: string): string | null;
export declare function slugify(name: string, maxLen?: number): string;
export declare function autoDeployProject(projectId: string, projectName: string, repo: string, task: string): {
    deployed: boolean;
    port?: number;
    domain?: string;
    service?: string;
    error?: string;
};
