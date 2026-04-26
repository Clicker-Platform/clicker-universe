'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, ScanLine, Vault as VaultIcon, Box, Package } from 'lucide-react';
import Link from 'next/link';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';
import { VaultSKU } from '../types';
import { getVaultSKUs } from '../api';
import { VaultSKUCard } from './VaultSKUCard';
import { CATEGORY_LABELS } from '../constants';

export default function VaultPage() {
  const { siteId } = useSite();
  const [skus, setSkus] = useState<VaultSKU[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  useEffect(() => {
    if (!siteId) return;
    getVaultSKUs(siteId)
      .then(setSkus)
      .catch(e => logger.error('stocklens.vault.load.failed', { siteId, error: e }))
      .finally(() => setLoading(false));
  }, [siteId]);

  const categories = useMemo(() => {
    const seen = new Set(skus.map(s => s.category));
    return Array.from(seen);
  }, [skus]);

  const filtered = useMemo(() => skus.filter(s => {
    const matchCat = categoryFilter === 'ALL' || s.category === categoryFilter;
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.sku.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  }), [skus, categoryFilter, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Vault</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{skus.length} SKU · {categories.length} kategori tersimpan</p>
        </div>
        <Link href="/admin/stocklens" className="shrink-0 inline-flex items-center gap-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-white font-medium transition">
          <ScanLine className="w-4 h-4" /> Scan Produk
        </Link>
      </div>

      {/* Filters card */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Cari nama produk atau SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {['ALL', ...categories].map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition
                  ${categoryFilter === cat
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  }`}
              >
                {cat === 'ALL' ? `Semua (${skus.length})` : `${CATEGORY_LABELS[cat] || cat}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-12 text-center">
          <div className="inline-block w-8 h-8 border-2 border-neutral-300 dark:border-neutral-700 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-3">Memuat vault...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && skus.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto">
            <Package className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Vault masih kosong</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm mx-auto">
              Mulai bangun inventory dengan scan produk pertamamu. AI akan otomatis identifikasi nama, brand, kategori, dan harga.
            </p>
          </div>
          <Link href="/admin/stocklens" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition">
            <ScanLine className="w-4 h-4" /> Scan Produk Pertama
          </Link>
        </div>
      )}

      {/* No results from filter */}
      {!loading && skus.length > 0 && filtered.length === 0 && (
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8 text-center">
          <Box className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mx-auto" />
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mt-2">Tidak ada hasil</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Coba ubah pencarian atau filter kategori</p>
        </div>
      )}

      {/* SKU list */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(sku => <VaultSKUCard key={sku.id} sku={sku} />)}
        </div>
      )}
    </div>
  );
}
