'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, ShoppingBag, Pencil, Trash2 } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { getProducts, deleteProduct } from '../api';
import type { DigitalProduct } from '../types';
import { ROUTES } from '../constants';

export default function ProductsListPage() {
  const { siteId } = useSite();
  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    setLoading(true);
    getProducts(siteId)
      .then(items => { if (!cancelled) setProducts(items); })
      .catch(e => {
        logger.error('digital_goods.products.load.failed', { siteId, error: e });
        if (!cancelled) setError('Failed to load products.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [siteId]);

  async function handleDelete(productId: string) {
    if (!siteId) return;
    try {
      await deleteProduct(siteId, productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
    } catch (e) {
      logger.error('digital_goods.product.delete.failed', { siteId, productId, error: e });
      setError('Failed to delete product.');
    }
  }

  if (!siteId) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Digital Goods</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-500">Sell PDFs, videos, and other digital products.</p>
        </div>
        <Link
          href={ROUTES.productNew}
          className="flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-lg hover:opacity-90"
        >
          <Plus size={16} /> New Product
        </Link>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400 rounded">{error}</div>
      )}

      {loading ? (
        <div className="text-gray-500 dark:text-neutral-500">Loading...</div>
      ) : products.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 dark:border-neutral-700 rounded-xl p-12 text-center">
          <ShoppingBag size={32} className="mx-auto mb-3 text-gray-400 dark:text-neutral-600" />
          <p className="text-gray-600 dark:text-neutral-400 font-medium mb-1">No products yet</p>
          <p className="text-sm text-gray-400 dark:text-neutral-600 mb-4">Create your first digital product to start selling.</p>
          <Link
            href={ROUTES.productNew}
            className="inline-flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-lg"
          >
            <Plus size={16} /> New Product
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-neutral-800 text-left text-sm text-gray-600 dark:text-neutral-400">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} className="border-t border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-neutral-100">{p.title}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-neutral-300">Rp {p.price.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-neutral-400">{p.contentKind.toUpperCase()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded ${
                      p.status === 'published'
                        ? 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`${ROUTES.productEdit}?id=${p.id}`}
                        className="p-2 text-gray-600 dark:text-neutral-400 hover:text-brand-dark rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                        aria-label="Edit"
                      >
                        <Pencil size={16} />
                      </Link>
                      <ConfirmButton
                        onConfirm={() => handleDelete(p.id)}
                        triggerIcon={<Trash2 size={16} />}
                        iconOnly
                        triggerTitle="Delete product"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
