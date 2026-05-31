// Digital Goods Module — Server-only operations.
// Imports firebase-admin and MUST NEVER be imported by client components.
// All payment-state mutations live here; client only reads.

import 'server-only';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  COLLECTION_ORDERS, COLLECTION_LIBRARY, COLLECTION_PRODUCTS,
  SIGNED_URL_TTL_SECONDS,
} from './constants';
import { canTransition } from './orders';
import type {
  DigitalOrder, DigitalProduct, PdfFile,
  PaymentInstructions, ProductSnapshot,
} from './types';

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(stripUndefined) as unknown as T;
  }
  if (value && typeof value === 'object' && value.constructor === Object) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

// Relocated to platform lib/auth. Re-exported here so existing importers keep working.
export { resolveTenantBaseUrl } from '@/lib/auth/tenant-url';

// --- Create order (called from checkout server action) ---

export type CreateOrderInput = {
  buyerId: string;
  buyerEmail?: string;
  productId: string;
  productSnapshot: ProductSnapshot;
  amount: number;
  paymentInstructions: PaymentInstructions;
  buyerNote?: string;
};

export async function createOrderAdmin(siteId: string, input: CreateOrderInput): Promise<string> {
  const ref = adminDb.collection(`sites/${siteId}/${COLLECTION_ORDERS}`).doc();
  await ref.set({
    ...stripUndefined(input),
    currency: 'IDR',
    paymentMethod: 'manual_transfer',
    status: 'awaiting_confirmation',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

// --- Confirm payment (called from admin "Mark as paid" action) ---

export type ConfirmPaidInput = {
  orderId: string;
  confirmedBy: string;
  paymentRef?: string;
};

export async function confirmOrderPaidAdmin(
  siteId: string, input: ConfirmPaidInput,
): Promise<{ libraryEntryId: string; order: DigitalOrder }> {
  const orderRef = adminDb.doc(`sites/${siteId}/${COLLECTION_ORDERS}/${input.orderId}`);
  const libraryRef = adminDb.collection(`sites/${siteId}/${COLLECTION_LIBRARY}`).doc();

  const result = await adminDb.runTransaction(async tx => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new Error('Order not found.');
    const order = { id: orderSnap.id, ...orderSnap.data() } as DigitalOrder;

    if (!canTransition(order.status, 'paid')) {
      throw new Error(`Cannot transition order from ${order.status} to paid.`);
    }

    // Snapshot for library entry — derive from order.productSnapshot
    const librarySnapshot = stripUndefined({
      title: order.productSnapshot.title,
      coverImage: order.productSnapshot.coverImage,
      type: order.productSnapshot.type,
      contentKind: order.productSnapshot.contentKind,
    });

    tx.update(orderRef, {
      status: 'paid',
      confirmedBy: input.confirmedBy,
      confirmedAt: FieldValue.serverTimestamp(),
      paymentRef: input.paymentRef ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(libraryRef, {
      buyerId: order.buyerId,
      productId: order.productId,
      orderId: order.id,
      productSnapshot: librarySnapshot,
      purchasedAt: FieldValue.serverTimestamp(),
    });

    return { order: { ...order, status: 'paid' as const }, libraryEntryId: libraryRef.id };
  });

  return result;
}

// --- Cancel order ---

export async function cancelOrderAdmin(
  siteId: string, orderId: string,
): Promise<void> {
  const ref = adminDb.doc(`sites/${siteId}/${COLLECTION_ORDERS}/${orderId}`);
  await adminDb.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Order not found.');
    const order = snap.data() as DigitalOrder;
    if (!canTransition(order.status, 'cancelled')) {
      throw new Error(`Cannot cancel order in ${order.status} state.`);
    }
    tx.update(ref, {
      status: 'cancelled',
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

// --- Signed URL issuance ---
// Verifies the buyer owns the file (via library entry referencing the parent product)
// before issuing a short-lived URL.

export async function issueSignedUrlForFile(
  siteId: string, buyerUid: string, productId: string, storagePath: string,
): Promise<string> {
  // Verify buyer has a library entry for this product
  const librarySnap = await adminDb
    .collection(`sites/${siteId}/${COLLECTION_LIBRARY}`)
    .where('buyerId', '==', buyerUid)
    .where('productId', '==', productId)
    .limit(1)
    .get();

  if (librarySnap.empty) throw new Error('forbidden');

  // Verify the requested storagePath belongs to the product
  // (productSnapshot in library entry doesn't carry file paths;
  //  but we can defend by requiring the path matches the expected prefix)
  const expectedPrefix = `sites/${siteId}/modules/digital_goods/products/`;
  if (!storagePath.startsWith(expectedPrefix)) throw new Error('forbidden');

  // Verify the storagePath is one of this product's actual PDF files (IDOR fix)
  const productSnap = await adminDb
    .doc(`sites/${siteId}/${COLLECTION_PRODUCTS}/${productId}`)
    .get();
  if (!productSnap.exists) throw new Error('forbidden');
  const product = productSnap.data() as DigitalProduct;
  const fileMatch = (product.files ?? []).some(
    f => f.kind === 'pdf' && (f as { storagePath: string }).storagePath === storagePath,
  );
  if (!fileMatch) throw new Error('forbidden');

  const file = adminStorage.bucket().file(storagePath);
  const [exists] = await file.exists();
  if (!exists) throw new Error('not_found');

  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
  });
  return url;
}

// --- File streaming (Option A) ---
// Same entitlement checks as issueSignedUrlForFile, but returns the file bytes +
// metadata so the API route can stream them to the buyer directly. No signed URL
// ever leaves the server, so there is nothing for a buyer to re-share.

export interface StreamableFile {
  bytes: Buffer;
  contentType: string;
  filename: string;
  sizeBytes: number;
}

export async function getFileForBuyer(
  siteId: string, buyerUid: string, productId: string, storagePath: string,
): Promise<StreamableFile> {
  // Verify buyer has a library entry for this product
  const librarySnap = await adminDb
    .collection(`sites/${siteId}/${COLLECTION_LIBRARY}`)
    .where('buyerId', '==', buyerUid)
    .where('productId', '==', productId)
    .limit(1)
    .get();
  if (librarySnap.empty) throw new Error('forbidden');

  // Path must belong to this site's digital_goods products
  const expectedPrefix = `sites/${siteId}/modules/digital_goods/products/`;
  if (!storagePath.startsWith(expectedPrefix)) throw new Error('forbidden');

  // Path must be one of this product's actual PDF files (IDOR defense)
  const productSnap = await adminDb
    .doc(`sites/${siteId}/${COLLECTION_PRODUCTS}/${productId}`)
    .get();
  if (!productSnap.exists) throw new Error('forbidden');
  const product = productSnap.data() as DigitalProduct;
  const matched = (product.files ?? []).find(
    f => f.kind === 'pdf' && (f as PdfFile).storagePath === storagePath,
  ) as PdfFile | undefined;
  if (!matched) throw new Error('forbidden');

  const file = adminStorage.bucket().file(storagePath);
  const [exists] = await file.exists();
  if (!exists) throw new Error('not_found');

  const [bytes] = await file.download();
  return {
    bytes,
    contentType: matched.mimeType || 'application/octet-stream',
    filename: matched.name || 'download.pdf',
    sizeBytes: matched.sizeBytes || bytes.length,
  };
}
