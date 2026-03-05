declare const router: import("express-serve-static-core").Router;
export declare function updateProjectById(id: string, fields: Record<string, any>): any | null;
export declare function createProjectProgrammatic(data: {
    name: string;
    repo?: string;
    stack?: string[];
    emoji?: string;
    createdBy?: string;
    setfarmRunId?: string;
    task?: string;
    status?: string;
    port?: number;
    type?: string;
}): {
    created: boolean;
    project: any;
    reason?: string;
};
/** One-time cleanup: merge duplicate projects sharing the same repo path.
 *  Keeps the entry with the shortest ID (usually the correct one).
 *  Merges missing fields from duplicates into the winner. */
export declare function deduplicateProjects(): number;
export default router;
