import { adminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { resolveDefaultSender, getSystemDefaults } from './config';
import type { EmailContext } from './types';

const CACHE_TTL_MS = 5 * 60 * 1000;
type CacheEntry = { value: EmailContext; expiresAt: number };
const cache = new Map<string, CacheEntry>();

const SYSTEM_KEY = '__system__';

export function _resetEmailContextCache() {
  cache.clear();
}

async function buildSystemContext(): Promise<EmailContext> {
  const defaults = await getSystemDefaults();
  const sender = await resolveDefaultSender();
  return {
    fromName: defaults.fromName,
    fromAddress: `${sender.localPart}@${sender.domain}`,
    replyTo: null,
    brand: {
      businessName: defaults.fromName,
      logoUrl: defaults.logoUrl,
      primaryColor: null,
      siteUrl: defaults.platformUrl,
    },
  };
}

async function buildTenantContext(
  siteId: string,
  data: Record<string, unknown>
): Promise<EmailContext> {
  const sender = await resolveDefaultSender();
  const businessName =
    (data.name as string | undefined) ??
    (data.businessName as string | undefined) ??
    'Clicker Platform';
  const slug = (data.slug as string | undefined) ?? siteId;
  const { platformUrl } = await getSystemDefaults();
  const siteUrl = `https://${slug}.${platformUrl.replace(/^https?:\/\//, '')}`;
  return {
    fromName: businessName,
    fromAddress: `${sender.localPart}@${sender.domain}`,
    replyTo: (data.ownerEmail as string | undefined) ?? null,
    brand: {
      businessName,
      logoUrl: (data.logoUrl as string | undefined) ?? null,
      primaryColor: (data.primaryColor as string | undefined) ?? null,
      siteUrl,
    },
  };
}

export async function getEmailContext(
  siteId: string | null
): Promise<EmailContext> {
  const key = siteId ?? SYSTEM_KEY;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let value: EmailContext;
  if (siteId === null) {
    value = await buildSystemContext();
  } else {
    try {
      const snap = await adminDb.collection('sites').doc(siteId).get();
      if (!snap.exists) {
        logger.warn('email.context.site.missing', { siteId });
        value = await buildSystemContext();
      } else {
        value = await buildTenantContext(siteId, snap.data() ?? {});
      }
    } catch (error) {
      logger.warn('email.context.fetch.failed', { siteId, error });
      value = await buildSystemContext();
    }
  }

  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}
