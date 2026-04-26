import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger-edge';

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const ENABLED = Boolean(URL && TOKEN);

const redis = ENABLED
    ? new Redis({ url: URL!, token: TOKEN! })
    : null;

// In-process memory cache — eliminates Upstash HTTP round-trip (~150-200ms) for warm requests
const MEM_TTL_MS = 30_000; // 30s
const memCache = new Map<string, { value: unknown; exp: number }>();

export async function cached<T>(
    key: string,
    ttl: number,
    fetcher: () => Promise<T>
): Promise<T> {
    // 1. Memory cache hit — zero latency
    const mem = memCache.get(key);
    if (mem && mem.exp > Date.now()) return mem.value as T;

    if (!ENABLED || !redis) {
        const fresh = await fetcher();
        memCache.set(key, { value: fresh, exp: Date.now() + MEM_TTL_MS });
        return fresh;
    }

    // 2. Redis cache hit — saves Firestore round-trip
    try {
        const hit = await redis.get<T>(key);
        if (hit !== null) {
            memCache.set(key, { value: hit, exp: Date.now() + MEM_TTL_MS });
            return hit;
        }
    } catch (err) {
        logger.warn('cache.get.failed', { siteId: 'platform', error: err });
    }

    // 3. Firestore fetch
    const fresh = await fetcher();
    memCache.set(key, { value: fresh, exp: Date.now() + MEM_TTL_MS });

    try {
        await redis.set(key, fresh, { ex: ttl });
    } catch (err) {
        logger.warn('cache.set.failed', { siteId: 'platform', error: err });
    }

    return fresh;
}

export async function invalidate(pattern: string): Promise<number> {
    // Clear matching keys from memory cache
    for (const key of memCache.keys()) {
        if (key.includes(pattern.replace('*', ''))) memCache.delete(key);
    }

    if (!ENABLED || !redis) return 0;
    let deleted = 0;
    try {
        let cursor = 0;
        do {
            const [next, keys] = await redis.scan(cursor, {
                match: pattern,
                count: 100,
            });
            cursor = Number(next);
            if (keys.length > 0) {
                await redis.del(...(keys as [string, ...string[]]));
                deleted += keys.length;
            }
        } while (cursor !== 0);
    } catch (err) {
        logger.warn('cache.invalidate.failed', { siteId: 'platform', error: err });
    }
    return deleted;
}

export function siteKey(siteId: string, suffix: string): string {
    return `site:${siteId}:${suffix}`;
}
