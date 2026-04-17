import { User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export async function resolvePlatformUrl(options: {
  redirectTo: string | null;
  currentUser: User | null;
}): Promise<string> {
  const { redirectTo, currentUser } = options;
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'clicker.id';

  // 1. From ?redirect= param origin
  if (redirectTo && redirectTo.startsWith('http')) {
    try {
      return new URL(redirectTo).origin;
    } catch {
      // Invalid URL, fall through
    }
  }

  // 2. From __tenant cookie
  const tenantMatch = document.cookie.match(/__tenant=([^;]+)/);
  const tenantSlug = tenantMatch ? tenantMatch[1] : null;

  if (tenantSlug) {
    // 2a. Path-based for Firebase default domains (.web.app)
    if (baseDomain.includes('.web.app')) {
      return `https://${baseDomain}/${tenantSlug}`;
    }
    // 2b. Subdomain-based for custom domains
    return `https://${tenantSlug}.${baseDomain}`;
  }

  // 3. Localhost fallback for local development
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3000';
  }

  // 4. From Firebase Auth claims siteId
  const user = currentUser || auth.currentUser;
  if (user) {
    const idTokenResult = await user.getIdTokenResult();
    const claimedSiteId = idTokenResult.claims?.siteId as string | undefined;
    if (claimedSiteId) {
      document.cookie = `__tenant=${claimedSiteId}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
      return `https://${claimedSiteId}.${baseDomain}`;
    }
    throw new Error('Akun ini belum memiliki situs yang terhubung. Hubungi administrator untuk mengatur akses.');
  }

  throw new Error('Sesi login tidak ditemukan. Silakan login ulang.');
}
