import { NextRequest, NextResponse } from 'next/server';
import { headers, cookies } from 'next/headers';
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

  // Auto-provision the buyer record
  await upsertBuyerAdmin(siteId, decoded.uid, {
    email: decoded.email ?? '',
  });

  // Mint a session cookie so subsequent server requests can verify
  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: 60 * 60 * 24 * 7 * 1000, // 7 days in ms
  });
  const cookieStore = await cookies();
  cookieStore.set('__session', sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({ ok: true, uid: decoded.uid });
}
