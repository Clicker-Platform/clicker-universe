/**
 * Edge-safe logger — no firebase-admin, no Node.js APIs.
 * Use this in middleware.ts. Full logger (with Firestore) is in logger.ts (server-only).
 */

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

function log(level: LogPayload['level'], event: string, ctx: LogContext = {}): void {
  const payload = buildPayload(level, event, ctx);
  const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
  const output = isDev ? formatDev(payload) : JSON.stringify(payload);

  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
}

export const logger = {
  error: (event: string, ctx?: LogContext) => log('error', event, ctx),
  warn: (event: string, ctx?: LogContext) => log('warn', event, ctx),
  info: (event: string, ctx?: LogContext) => log('info', event, ctx),
};
