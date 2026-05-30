import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase-admin';

// Reads the platform account-tier session (sites/{siteId}/accounts). Distinct from
// the admin __session cookie by design. Returns null when no/invalid session.
export async function getAccountSession(): Promise<{ uid: string; email: string } | null> {
  const store = await cookies();
  const idToken = store.get('__account_session')?.value;
  if (!idToken) return null;
  try {
    const d = await adminAuth.verifyIdToken(idToken);
    return d.email ? { uid: d.uid, email: d.email } : null;
  } catch { return null; }
}
