import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function clearCookie(name: string): string {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [`${name}=`, 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax'];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

export async function POST() {
  // Buyer init writes BOTH __session and __buyer_session (see buyer/init/route.ts).
  // Clearing only __buyer_session leaves the JWT in __session, and getBuyerSessionCookie
  // falls back to it — so the buyer appears still signed in. Clear both.
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'private, no-store, max-age=0',
  });
  headers.append('Set-Cookie', clearCookie('__buyer_session'));
  headers.append('Set-Cookie', clearCookie('__session'));

  return new NextResponse(JSON.stringify({ ok: true }), { status: 200, headers });
}
