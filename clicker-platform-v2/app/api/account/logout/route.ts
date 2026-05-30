import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Clears the account session cookie. The account tier uses ONLY __account_session
// (deliberately separate from the admin __session) — see app/api/account/session.
export async function POST(): Promise<Response> {
  const res = NextResponse.json(
    { ok: true },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
  );
  res.cookies.set('__account_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
