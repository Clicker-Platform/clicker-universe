'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { collection, getDocs, limit as fbLimit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';
import { COLLECTION_PRODUCTS } from '@/lib/modules/digital_goods/constants';
import type { DigitalProduct } from '@/lib/modules/digital_goods/types';

export interface ProductGridBlockData {
  title?: string;
  subtitle?: string;
  limit?: number;
  columns?: 2 | 3 | 4;
}

export default function ProductGridBlock({ data }: { data: ProductGridBlockData }) {
  const { siteId } = useSite();
  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const max = data.limit ?? 12;
  const columns = data.columns ?? 3;

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    (async () => {
      const q = query(
        collection(db, `sites/${siteId}/${COLLECTION_PRODUCTS}`),
        where('status', '==', 'published'),
        orderBy('publishedAt', 'desc'),
        fbLimit(max),
      );
      const snap = await getDocs(q);
      if (cancelled) return;
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as DigitalProduct)));
      setLoading(false);
    })().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [siteId, max]);

  const gridCols = columns === 2 ? 'sm:grid-cols-2' : columns === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <section className="py-12">
      <div className="max-w-5xl mx-auto px-4">
        {(data.title || data.subtitle) && (
          <header className="mb-8 text-center">
            {data.title && <h2 className="text-3xl font-bold">{data.title}</h2>}
            {data.subtitle && <p className="text-sm text-gray-500 mt-2">{data.subtitle}</p>}
          </header>
        )}
        {loading ? (
          <div className={`grid grid-cols-1 ${gridCols} gap-4`}>
            {[...Array(Math.min(max, 6))].map((_, i) => (
              <div key={i} className="aspect-video bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
            <ShoppingBag size={32} className="mx-auto mb-3 text-gray-400" />
            <p className="text-gray-600 font-medium">No products yet</p>
          </div>
        ) : (
          <div className={`grid grid-cols-1 ${gridCols} gap-4`}>
            {products.map(p => (
              <Link
                key={p.id}
                href={`/${siteId}/store/${p.slug}`}
                className="block rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition bg-white"
              >
                <div className="aspect-video bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                  {p.coverImage
                    ? <img src={p.coverImage} alt={p.title} className="w-full h-full object-cover" />
                    : 'No cover'}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 line-clamp-2">{p.title}</h3>
                  <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider">{p.contentKind}</p>
                  <p className="text-lg font-bold text-gray-900 mt-2">Rp {p.price.toLocaleString('id-ID')}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
