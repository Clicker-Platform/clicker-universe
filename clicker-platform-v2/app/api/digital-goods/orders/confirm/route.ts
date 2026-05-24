import { NextRequest, NextResponse } from 'next/server';
import { requireAuthedMember } from '@/lib/api-auth';
import { confirmOrderPaidAdmin } from '@/lib/modules/digital_goods/server-api';
import { sendOrderPaidBuyerEmail } from '@/lib/modules/digital_goods/emails';
import { adminDb } from '@/lib/firebase-admin';
import { publicRoutes, COLLECTION_BUYERS } from '@/lib/modules/digital_goods/constants';
import { logger } from '@/lib/logger-edge';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;
  const { siteId, uid } = auth.session;

  const body = await req.json().catch(() => ({}));
  const { orderId, paymentRef } = body as { orderId?: string; paymentRef?: string };
  if (!orderId) return NextResponse.json({ error: 'missing_order' }, { status: 400 });

  try {
    const { order, libraryEntryId } = await confirmOrderPaidAdmin(siteId, {
      orderId,
      confirmedBy: uid,
      paymentRef: paymentRef?.trim() || undefined,
    });

    // Look up buyer email and fire confirmation email
    const buyerSnap = await adminDb.doc(`sites/${siteId}/${COLLECTION_BUYERS}/${order.buyerId}`).get();
    const buyerEmail = buyerSnap.exists ? (buyerSnap.data()?.email as string | undefined) : undefined;
    if (buyerEmail) {
      const proto = req.headers.get('x-forwarded-proto') || 'https';
      const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
      const libraryUrl = `${proto}://${host}${publicRoutes(siteId).libraryEntry(libraryEntryId)}`;
      sendOrderPaidBuyerEmail(siteId, {
        buyerEmail,
        productTitle: order.productSnapshot.title,
        libraryUrl,
      }).catch(err => logger.error('digital_goods.email.buyer.failed', { siteId, orderId, error: err }));
    }

    return NextResponse.json({ ok: true, libraryEntryId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'server_error' }, { status: 400 });
  }
}
