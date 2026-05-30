// Platform primitive — resolve a tenant's public-facing base URL.
// Server-only (uses firebase-admin). Used by auth routes and billing modules.

import { adminDb } from '@/lib/firebase-admin';

// Resolve public-facing base URL for a tenant.
// Priority: customDomain → domain (from site doc) → fallback host (dev/preview only).
export async function resolveTenantBaseUrl(siteId: string, fallbackHost?: string): Promise<string> {
  const snap = await adminDb.doc(`sites/${siteId}`).get();
  const data = snap.data() ?? {};
  const tenantDomain =
    (data.customDomain as string | undefined) ||
    (data.domain as string | undefined);
  if (tenantDomain) return `https://${tenantDomain}`;
  if (fallbackHost) {
    const proto = fallbackHost.startsWith('localhost') ? 'http' : 'https';
    return `${proto}://${fallbackHost}`;
  }
  return 'https://clicker.id';
}
