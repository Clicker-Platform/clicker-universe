import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase-admin';
import { getBuyerAdmin, updateBuyerProfileAdmin } from '@/lib/modules/digital_goods/server-api';
import { logger } from '@/lib/logger-edge';

export const runtime = 'nodejs';

async function getAuth(req: NextRequest): Promise<{ siteId: string; uid: string } | { error: string; status: number }> {
  const siteId = req.headers.get('x-site-id');
  if (!siteId) return { error: 'no_site', status: 400 };

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__buyer_session')?.value;
  if (!sessionCookie) return { error: 'no_session', status: 401 };

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return { siteId, uid: decoded.uid };
  } catch {
    return { error: 'invalid_session', status: 401 };
  }
}

export async function GET(req: NextRequest) {
  const auth = await getAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const buyer = await getBuyerAdmin(auth.siteId, auth.uid);
    if (!buyer) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({
      email: buyer.email ?? '',
      fullName: buyer.fullName ?? '',
    });
  } catch (e) {
    logger.error('digital_goods.profile.get.failed', { siteId: auth.siteId, uid: auth.uid, error: e });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : undefined;
  if (fullName !== undefined && (fullName.length === 0 || fullName.length > 120)) {
    return NextResponse.json({ error: 'invalid_full_name' }, { status: 400 });
  }

  try {
    await updateBuyerProfileAdmin(auth.siteId, auth.uid, { fullName });
    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error('digital_goods.profile.patch.failed', { siteId: auth.siteId, uid: auth.uid, error: e });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
