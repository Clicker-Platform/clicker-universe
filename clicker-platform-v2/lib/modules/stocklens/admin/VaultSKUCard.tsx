'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { VaultSKU, VaultUnit } from '../types';
import { getVaultUnits } from '../api';
import { CONDITION_COLORS, CATEGORY_LABELS } from '../constants';
import { useSite } from '@/lib/site-context';

interface Props { sku: VaultSKU }

export function VaultSKUCard({ sku }: Props) {
  const { siteId } = useSite();
  const [open, setOpen] = useState(false);
  const [units, setUnits] = useState<VaultUnit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || units.length > 0) return;
    let cancelled = false;
    Promise.resolve()
      .then(() => { if (!cancelled) setLoading(true); })
      .then(() => getVaultUnits(siteId, sku.id))
      .then(data => { if (!cancelled) { setUnits(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, siteId, sku.id]);

  const byCondition = units.reduce((acc, u) => {
    acc[u.condition] = [...(acc[u.condition] || []), u];
    return acc;
  }, {} as Record<string, VaultUnit[]>);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50"
      >
        <div>
          <p className="font-medium text-sm">{sku.name}</p>
          <p className="text-xs text-muted-foreground font-mono">{sku.sku} · {CATEGORY_LABELS[sku.category] || sku.category}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t divide-y">
          {loading && <p className="text-xs text-muted-foreground px-4 py-3">Memuat...</p>}
          {Object.entries(byCondition).map(([cond, cunits]) => (
            <div key={cond} className="flex gap-3 px-4 py-3">
              <div className="flex gap-1">
                {cunits.slice(0, 3).map(u => (
                  <div key={u.id} className="relative w-14 h-14 rounded-md overflow-hidden bg-muted shrink-0">
                    {u.photoUrl && <Image src={u.photoUrl} alt={cond} fill className="object-cover" />}
                  </div>
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`inline-block text-xs font-bold border rounded px-1.5 py-0.5 ${CONDITION_COLORS[cond as keyof typeof CONDITION_COLORS]}`}>
                  {cond}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">×{cunits.length} unit</p>
                <p className="text-sm font-medium">Rp {cunits[0].marketPrice.toLocaleString('id-ID')}</p>
              </div>
            </div>
          ))}
          <div className="px-4 py-2">
            <Link href={`/admin/stocklens/vault/${sku.id}`} className="text-xs text-primary hover:underline">
              Lihat Detail →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
