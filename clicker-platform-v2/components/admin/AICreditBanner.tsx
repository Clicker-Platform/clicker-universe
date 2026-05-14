'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, XCircle, X } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { auth } from '@/lib/firebase';

interface CreditBalance {
  balance: number;
  lifetimeUsed: number;
}

const WARN_THRESHOLD = 0.50;
const CRITICAL_THRESHOLD = 0.10;

export function AICreditBanner() {
  const { siteId } = useSite();
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!siteId) return;
    auth.currentUser?.getIdToken().then(token => {
      fetch('/api/admin/ai-credits', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-site-id': siteId,
        }
      })
        .then(r => r.ok ? r.json() : null)
        .then((data: CreditBalance | null) => { if (data) setBalance(data); })
        .catch(() => {});
    });
  }, [siteId]);

  if (!balance || dismissed) return null;

  const { balance: credits } = balance;

  if (credits > WARN_THRESHOLD) return null;

  const isOut = credits <= 0;
  const isCritical = credits > 0 && credits <= CRITICAL_THRESHOLD;

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 text-sm font-semibold border-b ${
      isOut
        ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400'
        : isCritical
          ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900 text-orange-700 dark:text-orange-400'
          : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400'
    }`}>
      {isOut
        ? <XCircle size={15} className="shrink-0" />
        : <AlertTriangle size={15} className="shrink-0" />
      }
      <span className="flex-1">
        {isOut
          ? 'Kredit AI habis. Fitur AI (chatbot, scan produk, knowledge sync) tidak aktif untuk pengunjung. Hubungi admin platform untuk top-up.'
          : `Saldo AI tersisa $${credits.toFixed(4)} — segera hubungi admin platform untuk top-up agar fitur AI tetap aktif.`
        }
      </span>
      {!isOut && (
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          title="Tutup"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
