import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { adminDb } from '@/lib/firebase-admin';
import { createOrderAdmin } from '@/lib/modules/digital_goods/server-api';
import {
  COLLECTION_PRODUCTS, DOC_SETTINGS,
} from '@/lib/modules/digital_goods/constants';
import { sendNewOrderTenantEmail } from '@/lib/modules/digital_goods/emails';
import type {
  DigitalProduct, DigitalGoodsSettings, ProductSnapshot, PaymentInstructions,
} from '@/lib/modules/digital_goods/types';
import { getAccountSession } from '@/lib/account/session';
import { ensureAccount } from '@/lib/account/server-api';
import { getOrCreateFirebaseUser } from '@/lib/auth/magic-link/verify';
import { logger } from '@/lib/logger-edge';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const headersList = await headers();
  const siteId = headersList.get('x-site-id');
  if (!siteId) return NextResponse.json({ error: 'no_site' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const { productId, buyerNote, fullName, email: bodyEmail } = body as {
    productId?: string; buyerNote?: string; fullName?: string; email?: string;
  };
  if (!productId) return NextResponse.json({ error: 'missing_product' }, { status: 400 });

  // Resolve account identity from EITHER a logged-in account session OR a posted email.
  let uid: string;
  let email: string;
  const session = await getAccountSession();
  if (session) {
    uid = session.uid;
    email = session.email;
  } else {
    const trimmedEmail = bodyEmail?.trim();
    if (!trimmedEmail) return NextResponse.json({ error: 'email_required' }, { status: 400 });
    email = trimmedEmail;
    try {
      uid = await getOrCreateFirebaseUser(trimmedEmail);
    } catch (err) {
      logger.error('digital_goods.checkout.user_resolve_failed', { siteId, error: err });
      return NextResponse.json({ error: 'user_resolve_failed' }, { status: 500 });
    }
  }

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

  // Auto-provision platform account (account tier)
  await ensureAccount(siteId, uid, {
    email,
    fullName: fullName?.trim() || undefined,
    createdVia: 'purchase',
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
    buyerId: uid,
    buyerEmail: email,
    productId,
    productSnapshot,
    amount: product.price,
    paymentInstructions,
    buyerNote: buyerNote?.trim() || undefined,
  });

  // Fire-and-forget tenant email (non-blocking)
  sendNewOrderTenantEmail(siteId, {
    orderId,
    buyerEmail: email,
    productTitle: product.title,
    amount: product.price,
  }).catch(err => {
    logger.error('digital_goods.email.tenant.failed', { siteId, orderId, error: err });
  });

  return NextResponse.json({ orderId });
}
