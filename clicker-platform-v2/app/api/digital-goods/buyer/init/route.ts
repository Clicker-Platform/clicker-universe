import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { adminAuth } from '@/lib/firebase-admin';
import { upsertBuyerAdmin } from '@/lib/modules/digital_goods/server-api';
import { logger } from '@/lib/logger-edge';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const headersList = await headers();
  const siteId = headersList.get('x-site-id');
  if (!siteId) return NextResponse.json({ error: 'no_site' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const { idToken } = body as { idToken?: string };
  if (!idToken) return NextResponse.json({ error: 'missing_token' }, { status: 400 });

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken, true);
  } catch (e) {
    logger.error('digital_goods.buyer.init.verify.failed', { siteId, error: e });
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  let sessionCookie: string;
  try {
    // Auto-provision the buyer record
    await upsertBuyerAdmin(siteId, decoded.uid, {
      email: decoded.email ?? '',
    });

    // Mint a session cookie so subsequent server requests can verify
    sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: 60 * 60 * 24 * 7 * 1000, // 7 days in ms
    });
  } catch (e) {
    logger.error('digital_goods.buyer.init.failed', { siteId, uid: decoded.uid, error: e });
    return NextResponse.json({ error: 'init_failed' }, { status: 500 });
  }

  // Build Set-Cookie header manually — res.cookies.set() and cookies().set()
  // can be silently stripped by the Firebase Hosting frameworks proxy in front
  // of the Cloud Run SSR backend. Raw header survives the proxy.
  const maxAge = 60 * 60 * 24 * 7;
  const isProd = process.env.NODE_ENV === 'production';
  const cookieParts = [
    `__session=${sessionCookie}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isProd) cookieParts.push('Secure');
  const setCookie = cookieParts.join('; ');

  return new NextResponse(JSON.stringify({ ok: true, uid: decoded.uid }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store, max-age=0',
      'Set-Cookie': setCookie,
    },
  });
}
