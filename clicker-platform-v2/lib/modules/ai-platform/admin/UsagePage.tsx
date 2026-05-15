'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { auth } from '@/lib/firebase';

interface DailyEntry {
  id: string;
  date: string;
  totalCost: number;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  byModule?: Record<string, { cost: number; calls: number }>;
}

interface SummaryData {
  balance: number;
  lifetimeUsed: number;
}

const MODULE_LABELS: Record<string, string> = {
  stocklens: 'Scan Produk',
  ai_sales_agent: 'AI Sales Agent',
  ai_marketing: 'AI Marketing',
};

export function UsagePage() {
  const { siteId } = useSite();
  const [days, setDays] = useState<DailyEntry[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!siteId) return;
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}`, 'x-site-id': siteId };
    const [usageRes, creditRes] = await Promise.all([
      fetch(`/api/admin/ai-usage?limit=30`, { headers }),
      fetch('/api/admin/ai-credits', { headers }),
    ]);
    const [usageData, creditData] = await Promise.all([usageRes.json(), creditRes.json()]);
    setDays(usageData.days ?? []);
    if (creditRes.ok) setSummary(creditData);
  }, [siteId]);

  useEffect(() => {
    Promise.resolve().then(() => {
      setLoading(true);
      fetchData().finally(() => setLoading(false));
    });
  }, [fetchData]);

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthCost = days
    .filter(d => d.date?.startsWith(thisMonth))
    .reduce((sum, d) => sum + (d.totalCost ?? 0), 0);

  const balance = summary?.balance ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black">AI Usage</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border-2 border-gray-200 dark:border-neutral-700 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Saldo</p>
          <p className={`text-2xl font-black ${balance <= 0 ? 'text-red-600' : balance < 0.10 ? 'text-orange-600' : balance < 0.50 ? 'text-amber-600' : 'text-green-600'}`}>
            ${balance.toFixed(4)}
          </p>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border-2 border-gray-200 dark:border-neutral-700 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Bulan Ini</p>
          <p className="text-2xl font-black">${monthCost.toFixed(4)}</p>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border-2 border-gray-200 dark:border-neutral-700 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Total</p>
          <p className="text-2xl font-black">${(summary?.lifetimeUsed ?? 0).toFixed(4)}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-2xl border-2 border-gray-200 dark:border-neutral-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-gray-400" />
          <span className="font-black">Riwayat Penggunaan</span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat...
          </div>
        ) : days.length === 0 ? (
          <div className="text-sm text-gray-400 py-8 text-center">Belum ada penggunaan AI</div>
        ) : (
          <div className="space-y-2">
            {days.map(day => (
              <div key={day.id} className="flex items-start justify-between py-3 border-b border-gray-50 dark:border-neutral-800 last:border-0">
                <div>
                  <p className="text-sm font-semibold">{day.date}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {day.byModule && Object.entries(day.byModule).map(([mod, v]) => (
                      <span key={mod} className="text-xs text-gray-400">
                        {MODULE_LABELS[mod] ?? mod} {v.calls}x
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-sm font-black">${(day.totalCost ?? 0).toFixed(4)}</p>
                  <p className="text-xs text-gray-400">{day.callCount ?? 0} panggilan</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
