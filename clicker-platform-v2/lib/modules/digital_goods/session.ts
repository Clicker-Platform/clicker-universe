import 'server-only';
import { cookies } from 'next/headers';

// Firebase Hosting CDN only forwards the `__session` cookie to the Next.js
// backend. All other cookies (including `__buyer_session`) are stripped.
//
// Two different values can live in `__session`:
//   - Admin:  short siteId string e.g. "go", "quattro" (< 50 chars)
//   - Buyer:  Firebase session JWT                      (> 500 chars)
//
// Priority:
//   1. __buyer_session — explicit buyer scope (non-CDN / local dev)
//   2. __session       — CDN fallback, only accepted if it looks like a JWT
//                        (length > 100). Short siteId strings are ignored.
export async function getBuyerSessionCookie(): Promise<string | undefined> {
  const store = await cookies();

  const explicit = store.get('__buyer_session')?.value;
  if (explicit) return explicit;

  const session = store.get('__session')?.value;
  // Only treat __session as a buyer JWT if it is long enough to be one.
  // Admin sets __session to a short siteId (e.g. "go") — never a valid JWT.
  if (session && session.length > 100) return session;

  return undefined;
}
