const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 5;

type Entry = { count: number; windowStart: number };
const store = new Map<string, Entry>();

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    store.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= MAX_REQUESTS) return false;

  entry.count++;
  return true;
}
