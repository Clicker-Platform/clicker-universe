import 'server-only';
import { cookies } from 'next/headers';

// Firebase App Hosting CDN only forwards the `__session` cookie to the
// Next.js backend. All other cookies are stripped at the CDN layer.
// buyer/init sets BOTH __session and __buyer_session (same JWT value).
//
// Priority: __buyer_session (explicit buyer scope) → __session (Firebase CDN fallback).
// __session set by admin TokenBootstrap contains a short siteId string (e.g. "go"),
// which will never pass verifySessionCookie(), so no false-positive risk.
export async function getBuyerSessionCookie(): Promise<string | undefined> {
  const store = await cookies();
  return (
    store.get('__buyer_session')?.value ||
    store.get('__session')?.value ||
    undefined
  );
}
