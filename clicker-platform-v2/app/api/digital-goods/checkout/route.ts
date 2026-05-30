import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import {
  upsertBuyerAdmin, createOrderAdmin,
} from '@/lib/modules/digital_goods/server-api';
import {
  COLLECTION_PRODUCTS, DOC_SETTINGS,
} from '@/lib/modules/digital_goods/constants';
import { sendNewOrderTenantEmail } from '@/lib/modules/digital_goods/emails';
import type {
  DigitalProduct, DigitalGoodsSettings, ProductSnapshot, PaymentInstructions,
} from '@/lib/modules/digital_goods/types';
import { logger } from '@/lib/logger-edge';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const headersList = await headers();
  const siteId = headersList.get('x-site-id');
  if (!siteId) return NextResponse.json({ error: 'no_site' }, { status: 400 });

  const sessionCookie = req.cookies.get('__buyer_session')?.value;
  if (!sessionCookie) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let decoded;
  try {
    decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { productId, buyerNote, fullName } = body as { productId?: string; buyerNote?: string; fullName?: string };
  if (!productId) return NextResponse.json({ error: 'missing_product' }, { status: 400 });

  // Load product + settings
  const [productSnap, settingsSnap] = await Promise.all([
    adminDb.doc(`sites/${siteId}/${COLLECTION_PRODUCTS}/${productId}`).get(),
    adminDb.doc(`sites/${siteId}/${DOC_SETTINGS}`).get(),
  ]);
  if (!productSnap.exists) return NextResponse.json({ error: 'product_not_found' }, { status: 404 });
  if (!settingsSnap.exists) return NextResponse.json({ error: 'settings_not_configured' }, { status: 400 });

  const product = productSnap.data() as DigitalProduct;
  const settings = settingsSnap.data() as DigitalGoodsSettings;

  if (product.status !== 'published') {
    return NextResponse.json({ error: 'product_not_published' }, { status: 400 });
  }

  // Auto-provision buyer
  await upsertBuyerAdmin(siteId, decoded.uid, {
    email: decoded.email ?? '',
    fullName: fullName?.trim() || undefined,
  });

  const productSnapshot: ProductSnapshot = {
    title: product.title,
    coverImage: product.coverImage,
    price: product.price,
    currency: 'IDR',
    contentKind: product.contentKind,
    type: product.type,
  };

  const paymentInstructions: PaymentInstructions = {
    bankName: settings.bankName,
    accountNumber: settings.accountNumber,
    accountName: settings.accountName,
    qrisImageUrl: settings.qrisImageUrl,
  };

  const orderId = await createOrderAdmin(siteId, {
    buyerId: decoded.uid,
    buyerEmail: decoded.email ?? undefined,
    productId,
    productSnapshot,
    amount: product.price,
    paymentInstructions,
    buyerNote: buyerNote?.trim() || undefined,
  });

  // Fire-and-forget tenant email (non-blocking)
  sendNewOrderTenantEmail(siteId, {
    orderId,
    buyerEmail: decoded.email ?? '',
    productTitle: product.title,
    amount: product.price,
  }).catch(err => {
    logger.error('digital_goods.email.tenant.failed', { siteId, orderId, error: err });
  });

  return NextResponse.json({ orderId });
}
