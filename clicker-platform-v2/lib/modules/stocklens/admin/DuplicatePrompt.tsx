'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  sku: string;
  onDifferentiate: (year: string) => void;
  onMerge: () => void;
}

export function DuplicatePrompt({ sku, onDifferentiate, onMerge }: Props) {
  const [year, setYear] = useState('');
  const [showYear, setShowYear] = useState(false);

  return (
    <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium"><code className="text-xs bg-muted px-1 rounded">{sku}</code> sudah ada di Vault.</p>
          <p className="text-xs text-muted-foreground mt-0.5">Bedakan versi tahun, atau tambahkan unit ke SKU yang sama?</p>
        </div>
      </div>
      {showYear ? (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Tahun (e.g. 2023)"
            value={year}
            onChange={e => setYear(e.target.value)}
            maxLength={4}
            className="flex-1 rounded border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={() => year && onDifferentiate(year)}
            disabled={!year}
            className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Konfirmasi
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => setShowYear(true)}
            className="flex-1 rounded-lg border border-yellow-400/50 px-3 py-2 text-xs font-medium hover:bg-muted"
          >
            Ya, Bedakan
          </button>
          <button
            onClick={onMerge}
            className="flex-1 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted"
          >
            Sama Aja
          </button>
        </div>
      )}
    </div>
  );
}
