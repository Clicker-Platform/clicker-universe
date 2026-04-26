'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Lock, ScanLine, Trash2 } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { usePermission } from '@/components/admin/PermissionGuard';
import { logger } from '@/lib/logger-edge';
import { VaultSKU, VaultUnit } from '../types';
import { getVaultSKU, getVaultUnits, deleteVaultSKU, deleteVaultUnit } from '../api';
import { CONDITION_COLORS, CATEGORY_LABELS } from '../constants';

export default function DetailPage() {
  const { siteId } = useSite();
  const { isViewOnly } = usePermission();
  const params = useParams<{ slug: string[] }>();
  const router = useRouter();

  // Catch-all route: slug = ['stocklens', 'vault', '<skuId>']
  const skuId = Array.isArray(params.slug) ? params.slug[2] : undefined;

  const [sku, setSku] = useState<VaultSKU | null>(null);
  const [units, setUnits] = useState<VaultUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    if (!siteId || !skuId) return;
    Promise.all([getVaultSKU(siteId, skuId), getVaultUnits(siteId, skuId)])
      .then(([s, u]) => { setSku(s); setUnits(u); })
      .catch(e => logger.error('stocklens.detail.load.failed', { siteId, error: e }))
      .finally(() => setLoading(false));
  }, [siteId, skuId]);

  async function handleDeleteSKU() {
    if (!sku || isViewOnly) return;
    try {
      await deleteVaultSKU(siteId, sku.id);
      toast.success('SKU dihapus');
      router.push('/admin/stocklens/vault');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan');
    }
  }

  async function handleDeleteUnit(unitId: string) {
    if (!sku || isViewOnly) return;
    try {
      await deleteVaultUnit(siteId, sku.id, unitId);
      setUnits(u => u.filter(x => x.id !== unitId));
      toast.success('Unit dihapus');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan');
    }
  }

  const byCondition = units.reduce((acc, u) => {
    acc[u.condition] = [...(acc[u.condition] || []), u];
    return acc;
  }, {} as Record<string, VaultUnit[]>);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Memuat...</div>;
  if (!sku) return <div className="p-6 text-sm text-muted-foreground">SKU tidak ditemukan.</div>;

  return (
    <div className="max-w-lg mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/stocklens/vault" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{sku.name}</p>
          <p className="text-xs font-mono text-muted-foreground">{sku.sku} · {CATEGORY_LABELS[sku.category] || sku.category}</p>
        </div>
      </div>

      {units.length > 0 && (
        <div className="space-y-2">
          <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-muted">
            <Image src={units[activePhoto]?.photoUrl || ''} alt={sku.name} fill className="object-contain" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {units.map((u, i) => (
              <button
                key={u.id}
                onClick={() => setActivePhoto(i)}
                className={`shrink-0 relative w-12 h-12 rounded-md overflow-hidden border-2 transition
                  ${activePhoto === i ? 'border-primary' : 'border-transparent'}`}
              >
                <Image src={u.photoUrl} alt="" fill className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {sku.aiAnalysis && (
        <p className="text-sm text-muted-foreground">{sku.aiAnalysis}</p>
      )}

      <div className="flex items-center gap-2 text-sm">
        <Lock className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Harga Rilis:</span>
        <span className="font-medium">Rp {sku.releasePrice.toLocaleString('id-ID')}</span>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">Stok per Kondisi</p>
        {Object.entries(byCondition).map(([cond, cunits]) => (
          <div key={cond} className="flex items-center justify-between rounded-lg border px-3 py-2">
            <span className={`text-xs font-bold border rounded px-1.5 py-0.5 ${CONDITION_COLORS[cond as keyof typeof CONDITION_COLORS]}`}>
              {cond}
            </span>
            <span className="text-sm">×{cunits.length}</span>
            <span className="text-sm font-medium">Rp {cunits[0].marketPrice.toLocaleString('id-ID')}</span>
          </div>
        ))}
        <p className="text-xs text-muted-foreground text-right">Total ×{units.length} unit</p>
      </div>

      {!isViewOnly && units.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Semua Unit</p>
          {units.map(u => (
            <div key={u.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
              <div className="relative w-10 h-10 rounded overflow-hidden bg-muted shrink-0">
                <Image src={u.photoUrl} alt="" fill className="object-cover" />
              </div>
              <span className={`text-xs font-bold border rounded px-1 ${CONDITION_COLORS[u.condition]}`}>{u.condition}</span>
              <span className="text-sm flex-1">Rp {u.marketPrice.toLocaleString('id-ID')}</span>
              <button onClick={() => handleDeleteUnit(u.id)} className="text-muted-foreground hover:text-red-400">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Link
          href={`/admin/stocklens?sku=${sku.sku}`}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted"
        >
          <ScanLine className="w-4 h-4" /> Scan Tambah Unit
        </Link>
        {!isViewOnly && (
          <button
            onClick={handleDeleteSKU}
            className="flex items-center gap-1.5 rounded-lg border border-red-400/30 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-400/10"
          >
            <Trash2 className="w-4 h-4" /> Hapus SKU
          </button>
        )}
      </div>
    </div>
  );
}
