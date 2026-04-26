/**
 * Edge-safe logger — no firebase-admin, no Node.js APIs.
 * Use this in middleware.ts and client components. Full logger (with direct
 * Firestore writes) is in logger.ts (server-only).
 *
 * Critical errors (events in CLIENT_BEACON_EVENTS) are fire-and-forget POSTed
 * to /api/log/client-error so they reach Backyard Monitoring like server
 * errors do. The endpoint re-validates the event against the canonical
 * whitelist in logger.ts before writing to Firestore.
 */

// Client-side beacon filter. Only error-level logs whose event name passes
// this filter are forwarded to /api/log/client-error. The server endpoint
// re-validates against the canonical critical-event policy in logger.ts —
// this client-side filter is just to avoid network calls for noise.
//
// Strategy: events tend to be namespaced with dots (e.g. 'admin.form.save.failed').
// Drop common noisy categories outright; forward everything else and let the
// server's quota + dedupe + per-event policy decide.
const NOISY_PREFIXES = [
  'analytics.',          // high-volume tracking
  'fetch.',              // client read failures auto-recover via retry
  'admin.dashboard.',    // dashboard listeners, very noisy on disconnect
  'admin.sidebar.',      // sidebar listeners
  'admin.unread.',       // unread badge listeners
  'inbox.',              // inbox listeners
];

function shouldBeacon(event: string, level: string): boolean {
  if (level !== 'error') return false;
  if (!event) return false;
  for (const prefix of NOISY_PREFIXES) {
    if (event.startsWith(prefix)) return false;
  }
  return true;
}

interface LogContext {
  siteId?: string;
  error?: string | unknown;
  [key: string]: unknown;
}

interface LogPayload {
  level: 'error' | 'warn' | 'info';
  event: string;
  service: string;
  siteId: string;
  ts: string;
  meta: Record<string, unknown>;
}

function buildPayload(level: LogPayload['level'], event: string, ctx: LogContext): LogPayload {
  const { siteId = 'platform', error, ...rest } = ctx;
  const meta: Record<string, unknown> = { ...rest };
  if (error !== undefined) {
    meta.error = error instanceof Error ? error.message : String(error);
  }
  return { level, event, service: 'clicker-platform', siteId, ts: new Date().toISOString(), meta };
}

function formatDev(payload: LogPayload): string {
  const level = `[${payload.level.toUpperCase()}]`.padEnd(7);
  const metaEntries = Object.entries(payload.meta);
  const metaPart = metaEntries.length > 0
    ? ' | ' + metaEntries.map(([k, v]) => `${k}: ${String(v)}`).join(' | ')
    : '';
  return `${level} ${payload.event} | siteId: ${payload.siteId}${metaPart}`;
}

function beacon(payload: LogPayload): void {
  // Only run in the browser; never from Edge runtime or SSR.
  if (typeof window === 'undefined') return;
  if (!shouldBeacon(payload.event, payload.level)) return;

  // Fire-and-forget. Failures must not affect UX or re-throw.
  const body = JSON.stringify({
    event: payload.event,
    level: payload.level,
    siteId: payload.siteId,
    meta: payload.meta,
  });

  try {
    // Prefer sendBeacon — survives page unload, doesn't block. Falls back to
    // fetch with keepalive for browsers that lack it.
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/log/client-error', blob);
    } else {
      void fetch('/api/log/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Swallow — beacon is best-effort.
  }
}

function log(level: LogPayload['level'], event: string, ctx: LogContext = {}): void {
  const payload = buildPayload(level, event, ctx);
  const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
  const output = isDev ? formatDev(payload) : JSON.stringify(payload);

  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);

  beacon(payload);
}

export const logger = {
  error: (event: string, ctx?: LogContext) => log('error', event, ctx),
  warn: (event: string, ctx?: LogContext) => log('warn', event, ctx),
  info: (event: string, ctx?: LogContext) => log('info', event, ctx),
};
