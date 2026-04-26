'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, ScanLine } from 'lucide-react';
import Link from 'next/link';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger';
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
    <div className="max-w-2xl mx-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Vault Inventory</h1>
        <Link href="/admin/stocklens" className="flex items-center gap-1.5 text-sm rounded-lg bg-primary px-3 py-2 text-primary-foreground font-medium">
          <ScanLine className="w-4 h-4" /> Scan
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Cari nama atau SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {['ALL', ...categories].map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition
              ${categoryFilter === cat ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
          >
            {cat === 'ALL' ? 'Semua' : CATEGORY_LABELS[cat] || cat}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Memuat vault...</p>}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Vault kosong.</p>
          <Link href="/admin/stocklens" className="text-xs text-primary hover:underline mt-1 inline-block">Scan produk pertama →</Link>
        </div>
      )}
      <div className="space-y-3">
        {filtered.map(sku => <VaultSKUCard key={sku.id} sku={sku} />)}
      </div>
    </div>
  );
}
