export declare function getCached<T>(key: string): T | null;
export declare function setCache<T>(key: string, data: T, ttlMs: number): void;
export declare function isStale(key: string): boolean;
export declare function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T>;
export declare function invalidateCache(key: string): void;
export declare function registerWarmup(fn: () => Promise<void>): void;
export declare function warmupAll(): Promise<void>;
