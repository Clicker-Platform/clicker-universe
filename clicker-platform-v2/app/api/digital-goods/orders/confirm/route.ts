import { NextRequest, NextResponse } from 'next/server';
import { requireAuthedMember } from '@/lib/api-auth';
import { confirmOrderPaidAdmin, resolveTenantBaseUrl } from '@/lib/modules/digital_goods/server-api';
import { sendOrderPaidBuyerEmail } from '@/lib/modules/digital_goods/emails';
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

    // Fire confirmation email to the buyer. The email is denormalized on the order
    // at checkout (order.buyerEmail), so no separate identity lookup is needed.
    const buyerEmail = order.buyerEmail;
    if (buyerEmail) {
      const fallbackHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || undefined;
      const baseUrl = await resolveTenantBaseUrl(siteId, fallbackHost);
      const libraryUrl = `${baseUrl}/${siteId}/account/library/${libraryEntryId}`;
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
