import { Redis } from '@upstash/redis';

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const ENABLED = Boolean(URL && TOKEN);

const redis = ENABLED
    ? new Redis({ url: URL!, token: TOKEN! })
    : null;

export async function cached<T>(
    key: string,
    ttl: number,
    fetcher: () => Promise<T>
): Promise<T> {
    if (!ENABLED || !redis) return fetcher();

    const start = Date.now();
    try {
        const hit = await redis.get<T>(key);
        if (hit !== null) {
            console.log(`[cache HIT] ${key} (${Date.now() - start}ms)`);
            return hit;
        }
    } catch (err) {
        console.warn(`[cache] Redis GET error for ${key}:`, err);
    }

    const fresh = await fetcher();

    try {
        await redis!.set(key, fresh, { ex: ttl });
        console.log(`[cache MISS→SET] ${key}`);
    } catch (err) {
        console.warn(`[cache] Redis SET error for ${key}:`, err);
    }

    return fresh;
}

export async function invalidate(pattern: string): Promise<number> {
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
        console.warn(`[cache] Redis invalidate error for ${pattern}:`, err);
    }
    return deleted;
}

export function siteKey(siteId: string, suffix: string): string {
    return `site:${siteId}:${suffix}`;
}
