declare const router: import("express-serve-static-core").Router;
export declare function countRecentCalls(): Record<string, {
    calls: number;
    tokens: number;
}>;
export default router;
