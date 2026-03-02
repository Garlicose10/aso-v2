import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
export class CacheManager {
    cacheDir;
    constructor(baseDir = 'data/cache') {
        this.cacheDir = path.resolve(baseDir);
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }
    getFileName(key) {
        const hash = crypto.createHash('md5').update(key).digest('hex');
        // We include the key in the filename for easier debugging if it's short, 
        // but full hash is safer.
        return path.join(this.cacheDir, `${hash}.json`);
    }
    /**
     * Retrieves cached data if it exists and is not expired.
     * @param key The cache key
     * @param maxAgeMs Maximum age in milliseconds (default 24h)
     */
    get(key, maxAgeMs = 24 * 60 * 60 * 1000) {
        const filePath = this.getFileName(key);
        if (!fs.existsSync(filePath))
            return null;
        try {
            const stats = fs.statSync(filePath);
            const age = Date.now() - stats.mtimeMs;
            if (age > maxAgeMs) {
                // Option to delete expired cache
                // fs.unlinkSync(filePath);
                return null;
            }
            const data = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(data);
        }
        catch (e) {
            return null;
        }
    }
    /**
     * Saves data to cache.
     * @param key The cache key
     * @param data The data to save
     */
    set(key, data) {
        const filePath = this.getFileName(key);
        try {
            // Ensure directory exists (might have been deleted)
            if (!fs.existsSync(this.cacheDir)) {
                fs.mkdirSync(this.cacheDir, { recursive: true });
            }
            fs.writeFileSync(filePath, JSON.stringify({
                key,
                timestamp: new Date().toISOString(),
                data
            }, null, 2), 'utf-8');
        }
        catch (e) {
            console.error('Cache write error:', e);
        }
    }
    /**
     * Clear cache entries older than a certain time.
     */
    prune(maxAgeMs) {
        if (!fs.existsSync(this.cacheDir))
            return;
        const files = fs.readdirSync(this.cacheDir);
        for (const file of files) {
            const filePath = path.join(this.cacheDir, file);
            const stats = fs.statSync(filePath);
            if (Date.now() - stats.mtimeMs > maxAgeMs) {
                fs.unlinkSync(filePath);
            }
        }
    }
}
export const cache = new CacheManager();
//# sourceMappingURL=cache.js.map