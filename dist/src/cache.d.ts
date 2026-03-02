export declare class CacheManager {
    private cacheDir;
    constructor(baseDir?: string);
    private getFileName;
    /**
     * Retrieves cached data if it exists and is not expired.
     * @param key The cache key
     * @param maxAgeMs Maximum age in milliseconds (default 24h)
     */
    get(key: string, maxAgeMs?: number): any | null;
    /**
     * Saves data to cache.
     * @param key The cache key
     * @param data The data to save
     */
    set(key: string, data: any): void;
    /**
     * Clear cache entries older than a certain time.
     */
    prune(maxAgeMs: number): void;
}
export declare const cache: CacheManager;
