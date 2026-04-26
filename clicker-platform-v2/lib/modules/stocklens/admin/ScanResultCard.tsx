'use client';

import { ScanResult } from '../types';
import { CATEGORY_LABELS } from '../constants';
import { Lock, Pencil } from 'lucide-react';

interface Props {
  result: ScanResult;
  marketPrice: number;
  onMarketPriceChange: (v: number) => void;
}

export function ScanResultCard({ result, marketPrice, onMarketPriceChange }: Props) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Detail Produk</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <Field label="Nama" value={result.name || '—'} span />
        <Field label="Brand" value={result.brand || '—'} />
        <Field label="Kategori" value={CATEGORY_LABELS[result.category] || result.category} />
        <Field label="SKU" value={result.sku || '—'} mono />
        {result.series && <Field label="Seri" value={result.series} />}
      </div>
      <div className="border-t pt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
            <Lock className="w-3 h-3" /> Harga Rilis
          </p>
          <p className="font-medium">Rp {result.releasePrice.toLocaleString('id-ID')}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
            <Pencil className="w-3 h-3" /> Harga Pasar
          </p>
          <input
            type="number"
            value={marketPrice}
            onChange={e => onMarketPriceChange(Number(e.target.value))}
            className="w-full rounded border bg-background px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      {result.aiAnalysis && (
        <p className="text-xs text-muted-foreground border-t pt-2">{result.aiAnalysis}</p>
      )}
    </div>
  );
}

function Field({ label, value, span, mono }: { label: string; value: string; span?: boolean; mono?: boolean }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-medium truncate ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  );
}
