const FIRESTORE_CRITICAL_EVENTS = new Set([
  'middleware.env.missing',
  'firebase.admin.init.failed',
  'auth.callback.failed',
  'upload.image.failed',
  'upload.avatar.failed',
  'wa.send.failed',
  'wa.webhook.site.not.found',
  'ai.chat.failed',
  'form.submit.failed',
  'pos.checkout.failed',
  'service.record.create.failed',
  'firestore.write.failed',
]);

export function isFirestoreCritical(event: string): boolean {
  return FIRESTORE_CRITICAL_EVENTS.has(event);
}

export function buildDedupeKey(siteId: string, event: string): string {
  const window = Math.floor(Date.now() / 300_000);
  return `${siteId}_${event}_${window}`;
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
  return {
    level,
    event,
    service: 'clicker-platform',
    siteId,
    ts: new Date().toISOString(),
    meta,
  };
}

export function formatDev(payload: LogPayload): string {
  const level = `[${payload.level.toUpperCase()}]`.padEnd(7);
  const metaEntries = Object.entries(payload.meta);
  const metaPart = metaEntries.length > 0
    ? ' | ' + metaEntries.map(([k, v]) => `${k}: ${String(v)}`).join(' | ')
    : '';
  return `${level} ${payload.event} | siteId: ${payload.siteId}${metaPart}`;
}

async function writeToFirestore(payload: LogPayload): Promise<void> {
  if (typeof window !== 'undefined') return;

  try {
    const { adminDb, Timestamp, FieldValue } = await import('@/lib/firebase-admin');

    const metaRef = adminDb.collection('platform_meta').doc('log_quota');
    const metaSnap = await metaRef.get();
    const today = new Date().toISOString().slice(0, 10);
    const meta = metaSnap.data() as { writesToday: number; resetDate: string } | undefined;

    let writesToday = 0;
    if (meta?.resetDate === today) {
      writesToday = meta.writesToday ?? 0;
    }

    if (writesToday >= 500) return;

    const dedupeKey = buildDedupeKey(payload.siteId, payload.event);
    const ttl = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const ts = Timestamp.fromDate(new Date());

    const logRef = adminDb.collection('platform_logs').doc(dedupeKey);
    await logRef.set(
      {
        level: payload.level,
        event: payload.event,
        service: payload.service,
        siteId: payload.siteId,
        meta: payload.meta,
        ts,
        ttl,
        count: FieldValue.increment(1),
      },
      { merge: true }
    );

    await metaRef.set(
      { writesToday: FieldValue.increment(1), resetDate: today },
      { merge: true }
    );
  } catch {
    // Firestore write errors must NOT re-throw — original error already logged to GCP
  }
}

function log(level: LogPayload['level'], event: string, ctx: LogContext = {}): void {
  const payload = buildPayload(level, event, ctx);
  const json = JSON.stringify(payload);

  const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
  const output = isDev ? formatDev(payload) : json;

  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);

  if (level === 'error' && isFirestoreCritical(event)) {
    void writeToFirestore(payload);
  }
}

export const logger = {
  error: (event: string, ctx?: LogContext) => log('error', event, ctx),
  warn: (event: string, ctx?: LogContext) => log('warn', event, ctx),
  info: (event: string, ctx?: LogContext) => log('info', event, ctx),
};
