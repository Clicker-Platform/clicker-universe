import 'server-only';
import { adminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

export interface TenantBrand {
  name: string;
  logoUrl: string | null;
}

// Reads the tenant brand from the site doc. Same resolution as email/context.ts.
export async function getTenantBrand(siteId: string): Promise<TenantBrand> {
  try {
    const snap = await adminDb.collection('sites').doc(siteId).get();
    const data = snap.data() ?? {};
    const name =
      (data.name as string | undefined) ??
      (data.businessName as string | undefined) ??
      siteId;
    return { name, logoUrl: (data.logoUrl as string | undefined) ?? null };
  } catch (error) {
    logger.warn('account.brand.fetch.failed', { siteId, error });
    return { name: siteId, logoUrl: null };
  }
}
