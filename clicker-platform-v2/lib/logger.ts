// Critical events that warrant a Firestore write to platform_logs (visible
// in Backyard Monitoring). Both server-direct writes (writeToFirestore in
// this file) and client beacons (/api/log/client-error) consult this list.
//
// Inclusion criteria:
// 1. User-facing failure (login broken, save lost, payment fail) — must alert
// 2. Cross-tenant / platform-level concern (auth, billing, integrations)
// 3. Silent failure that wouldn't otherwise be noticed (webhooks, schedulers)
//
// Exclusion (kept out by lib/logger-edge.ts NOISY_PREFIXES too):
// - analytics.*, fetch.*, *.dashboard.*, *.sidebar.*, *.unread.*, inbox.*
//   (high-volume listeners that auto-recover)
// - *.fetch.failed for read-only data with retry
const FIRESTORE_CRITICAL_EVENTS = new Set([
  // ─── Auth & access ──────────────────────────────────────────────────────
  'auth.callback.failed',
  'auth.check.failed',
  'auth.sites.fetch.failed',
  'admin.auth.logout.failed',

  // ─── Uploads ────────────────────────────────────────────────────────────
  'upload.image.failed',
  'upload.avatar.failed',
  'upload.invalid.type',
  'upload.size.exceeded',

  // ─── WhatsApp ───────────────────────────────────────────────────────────
  'wa.send.failed',
  'wa.connect.failed',
  'wa.disconnect.failed',
  'wa.test.failed',
  'wa.webhook.get.failed',
  'wa.webhook.post.failed',
  'wa.webhook.invalid.signature',
  'wa.webhook.site.not.found',
  'wa.webhook.process.failed',

  // ─── AI (chat, marketing, knowledge) ────────────────────────────────────
  'ai.chat.failed',
  'ai.agent.config.failed',
  'ai.agent.chat.send.failed',
  'ai.agent.settings.save.failed',
  'ai.marketing.generate.failed',
  'ai.marketing.analyze.failed',

  // ─── AI billing & model config ──────────────────────────────────────────
  'ai.billing.model_config_not_set',
  'ai.billing.model_config_incomplete',
  'ai.billing.deduct.failed',
  'ai.billing.insufficient',
  'ai.pricing.model_not_priced',

  // ─── Forms & submissions ────────────────────────────────────────────────
  'form.submit.failed',
  'form.create.failed',
  'form.update.failed',
  'form.delete.failed',
  'form.fetch.failed',
  'form.not.found',
  'form.email.notify.failed',
  'admin.form.save.failed',
  'admin.form.delete.failed',
  'crm.submission.update.failed',

  // ─── Team & permissions ─────────────────────────────────────────────────
  'team.add.failed',
  'team.add.auth.failed',
  'team.remove.failed',
  'team.remove.auth.failed',
  'admin.team.members.fetch.failed',

  // ─── Business config ────────────────────────────────────────────────────
  'admin.business.settings.update.failed',
  'admin.business.branch.save.failed',
  'admin.business.branch.delete.failed',

  // ─── Modules: stocklens ─────────────────────────────────────────────────
  'stocklens.scan.route.failed',
  'stocklens.scan.body.parse.failed',
  'stocklens.settings.get.failed',
  'stocklens.settings.post.failed',
  'stocklens.apikey.fetch.failed',
  'stocklens.scan.parse.failed',
  'stocklens.scanner.scan.failed',
  'stocklens.scanner.save.failed',
  'stocklens.vault.load.failed',
  'stocklens.detail.load.failed',
  'stocklens.settings.load.failed',

  // ─── Module catalog operations ──────────────────────────────────────────
  'admin.modules.seed.failed',
  'admin.products.save.failed',
  'admin.products.delete.failed',
  'admin.links.save.failed',
  'admin.links.delete.failed',
  'admin.services.save.failed',
  'admin.services.delete.failed',

  // ─── Templates ──────────────────────────────────────────────────────────
  'template.fetch.failed',
  'template.save.failed',
  'template.delete.failed',
  'template.assign.failed',
  'admin.template.save.failed',
  'admin.template.seed.failed',
  'admin.template.settings.fetch.failed',

  // ─── Canvas Studio / Pages / Blocks ─────────────────────────────────────
  'canvas.page.save.failed',
  'canvas.page.load.failed',
  'canvas.block.save.failed',
  'canvas.block.delete.failed',
  'canvas.publish.failed',
  'canvas.media.upload.failed',
  'admin.pages.save.failed',
  'admin.pages.delete.failed',
  'admin.pages.publish.failed',
  'admin.links.pages.fetch.failed',
  'fetch.page.failed',

  // ─── Bookings ───────────────────────────────────────────────────────────
  'admin.bookings.listener.failed',

  // ─── Cache & infra ──────────────────────────────────────────────────────
  'cache.purge.failed',
  'knowledge.sync.failed',
  'knowledge.sync.pdf.failed',

  // ─── Email (Resend) ─────────────────────────────────────────────────────
  'email.send.failed',
  'email.send.exception',
  'email.context.fetch.failed',
]);

export function isFirestoreCritical(event: string): boolean {
  return FIRESTORE_CRITICAL_EVENTS.has(event);
}

export function buildDedupeKey(siteId: string, event: string): string {
  const windowSlot = Math.floor(Date.now() / 300_000);
  const safeSiteId = siteId.replace(/\//g, '_');
  const safeEvent = event.replace(/\//g, '_');
  return `${safeSiteId}_${safeEvent}_${windowSlot}`;
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

    // Known limitation: quota check is not atomic — concurrent requests can both
    // pass this check during a spike. FieldValue.increment ensures count accuracy,
    // but writes may slightly exceed 500/day. Acceptable given the low cost impact.
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
