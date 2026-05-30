import 'server-only';
import { adminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

export interface TenantBrand {
  name: string;
  logoUrl: string | null;
}

// Reads the tenant brand from the business profile doc — the same source the
// public site header (NavLogo) uses: sites/{siteId}/content/profile.
// Logo field is `avatarUrl`; name is `name` (falls back to the root site doc
// name/businessName, then siteId).
export async function getTenantBrand(siteId: string): Promise<TenantBrand> {
  try {
    const [profileSnap, siteSnap] = await Promise.all([
      adminDb.doc(`sites/${siteId}/content/profile`).get(),
      adminDb.collection('sites').doc(siteId).get(),
    ]);
    const profile = profileSnap.data() ?? {};
    const site = siteSnap.data() ?? {};
    const name =
      (profile.name as string | undefined) ??
      (site.name as string | undefined) ??
      (site.businessName as string | undefined) ??
      siteId;
    const logoUrl = (profile.avatarUrl as string | undefined) ?? null;
    return { name, logoUrl };
  } catch (error) {
    logger.warn('account.brand.fetch.failed', { siteId, error });
    return { name: siteId, logoUrl: null };
  }
}
