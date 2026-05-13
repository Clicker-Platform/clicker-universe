interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimiter {
  check(key: string): boolean;
}

export interface RateLimiterConfig {
  max: number;
  windowMs: number;
}

export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  const buckets = new Map<string, Bucket>();

  return {
    check(key: string): boolean {
      const now = Date.now();
      const bucket = buckets.get(key);

      if (!bucket || now >= bucket.resetAt) {
        buckets.set(key, { count: 1, resetAt: now + config.windowMs });
        return true;
      }

      if (bucket.count >= config.max) {
        return false;
      }

      bucket.count += 1;
      return true;
    },
  };
}

export const submitLimiter = createRateLimiter({ max: 5, windowMs: 60 * 60 * 1000 });
export const validatePromoLimiter = createRateLimiter({ max: 30, windowMs: 60 * 60 * 1000 });
