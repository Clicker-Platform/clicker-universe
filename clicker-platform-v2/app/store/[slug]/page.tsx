import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import { COLLECTION_PRODUCTS } from '@/lib/modules/digital_goods/constants';
import type { DigitalProduct } from '@/lib/modules/digital_goods/types';
import { StoreProductClient } from './StoreProductClient';

export const revalidate = 0;

async function fetchProductBySlug(siteId: string, slug: string): Promise<DigitalProduct | null> {
  const snap = await adminDb
    .collection(`sites/${siteId}/${COLLECTION_PRODUCTS}`)
    .where('slug', '==', slug)
    .where('status', '==', 'published')
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as DigitalProduct;
}

export default async function StoreItemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const headersList = await headers();
  const siteId = headersList.get('x-site-id');
  if (!siteId) notFound();

  const product = await fetchProductBySlug(siteId, slug);
  if (!product) notFound();

  // Serialize Timestamps to ISO strings for client component
  const serialized = {
    ...product,
    createdAt: product.createdAt?.toDate().toISOString(),
    updatedAt: product.updatedAt?.toDate().toISOString(),
    publishedAt: product.publishedAt?.toDate().toISOString() ?? null,
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-xl border border-gray-200 overflow-hidden">
        {product.coverImage && (
          <div className="aspect-video bg-gray-100">
            <img src={`/api/storage-image?path=${encodeURIComponent(product.coverImage)}`} alt={product.title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6">
          <p className="text-xs uppercase tracking-wider text-gray-500">{product.contentKind}</p>
          <h1 className="text-3xl font-bold text-gray-900 mt-1">{product.title}</h1>
          <p className="text-2xl font-bold text-gray-900 mt-3">Rp {product.price.toLocaleString('id-ID')}</p>
          {product.description && (
            <p className="text-gray-700 mt-4 whitespace-pre-wrap">{product.description}</p>
          )}
          <StoreProductClient siteId={siteId} product={serialized as any} />
        </div>
      </div>
    </main>
  );
}
