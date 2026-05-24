import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { adminAuth } from '@/lib/firebase-admin';
import { cancelOrderAdmin } from '@/lib/modules/digital_goods/server-api';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const headersList = await headers();
  const siteId = headersList.get('x-site-id');
  if (!siteId) return NextResponse.json({ error: 'no_site' }, { status: 400 });

  const sessionCookie = req.cookies.get('__session')?.value;
  if (!sessionCookie) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try { await adminAuth.verifySessionCookie(sessionCookie, true); }
  catch { return NextResponse.json({ error: 'unauthorized' }, { status: 401 }); }

  const body = await req.json().catch(() => ({}));
  const { orderId } = body as { orderId?: string };
  if (!orderId) return NextResponse.json({ error: 'missing_order' }, { status: 400 });

  try {
    await cancelOrderAdmin(siteId, orderId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'server_error' }, { status: 400 });
  }
}
