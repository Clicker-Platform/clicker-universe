import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger-edge';
import { getSecret } from '@/lib/secrets';

const URL = process.env.UPSTASH_REDIS_REST_URL;
let redisInstance: Redis | null = null;
let initAttempted = false;

async function getRedis(): Promise<Redis | null> {
  if (initAttempted) return redisInstance;
  initAttempted = true;
  if (!URL) return null;
  try {
    const token = await getSecret('UPSTASH_REDIS_REST_TOKEN');
    redisInstance = new Redis({ url: URL, token });
  } catch {
    redisInstance = null;
  }
  return redisInstance;
}

export async function cached<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const redis = await getRedis();
  if (!redis) return fetcher();

  try {
    const hit = await redis.get<T>(key);
    if (hit !== null) return hit;
  } catch (err) {
    logger.warn('cache.get.failed', { siteId: 'platform', error: err });
  }

  const fresh = await fetcher();

  try {
    await redis.set(key, fresh, { ex: ttl });
  } catch (err) {
    logger.warn('cache.set.failed', { siteId: 'platform', error: err });
  }

  return fresh;
}

export async function invalidate(pattern: string): Promise<number> {
  const redis = await getRedis();
  if (!redis) return 0;
  let deleted = 0;
  try {
    let cursor = 0;
    do {
      const [next, keys] = await redis.scan(cursor, { match: pattern, count: 100 });
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
