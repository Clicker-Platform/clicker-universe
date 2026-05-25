import 'server-only';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const STORE_PAGE_ID = 'digital-goods-store';
const STORE_PAGE_SLUG = 'store';

/**
 * Idempotently create a Custom Page named "Store" with a ProductGrid block pre-placed.
 * Called when the digital_goods module is first enabled on a tenant.
 *
 * Schema matches PageStudioContext: { title, slug, content, blocks, createdAt, updatedAt }
 */
export async function ensureStorePageExists(siteId: string): Promise<void> {
  const pageRef = adminDb.doc(`sites/${siteId}/pages/${STORE_PAGE_ID}`);
  const snap = await pageRef.get();
  if (snap.exists) return;

  await pageRef.set({
    id: STORE_PAGE_ID,
    title: 'Store',
    slug: STORE_PAGE_SLUG,
    content: '',
    blocks: [
      {
        id: 'product-grid-default',
        type: 'digital_goods_product_grid',
        data: {
          title: 'Store',
          subtitle: 'Browse and buy digital products.',
          limit: 12,
          columns: 3,
        },
      },
    ],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}
