import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  // Clear __buyer_session cookie via raw Set-Cookie header.
  // Same delivery pattern as buyer/init — survives Firebase Hosting proxy.
  const isProd = process.env.NODE_ENV === 'production';
  const cookieParts = [
    '__buyer_session=',
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isProd) cookieParts.push('Secure');

  return new NextResponse(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store, max-age=0',
      'Set-Cookie': cookieParts.join('; '),
    },
  });
}
