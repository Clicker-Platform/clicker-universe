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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg">
            <VaultIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-neutral-900 dark:text-neutral-100">Vault Inventory</h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{skus.length} SKU · {categories.length} kategori</p>
          </div>
        </div>
        <Link href="/admin/stocklens" className="flex items-center justify-center gap-1.5 text-sm rounded-lg bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 px-4 py-2 text-white font-medium shadow-lg shadow-yellow-500/20 transition">
          <ScanLine className="w-4 h-4" /> Scan Produk Baru
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
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/30 focus:border-yellow-500"
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
                    ? 'bg-yellow-500 text-white border-yellow-500 shadow-sm shadow-yellow-500/20'
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
          <div className="inline-block w-8 h-8 border-2 border-neutral-300 dark:border-neutral-700 border-t-yellow-500 rounded-full animate-spin" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-3">Memuat vault...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && skus.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center mx-auto shadow-lg">
            <Package className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Vault masih kosong</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm mx-auto">
              Mulai bangun inventory dengan scan produk pertamamu. AI akan otomatis identifikasi nama, brand, kategori, dan harga.
            </p>
          </div>
          <Link href="/admin/stocklens" className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-500 to-yellow-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-yellow-500/20 hover:from-yellow-600 hover:to-yellow-700 transition">
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
