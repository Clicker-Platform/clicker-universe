'use client';

import { useState, useEffect } from 'react';
import { Loader2, CreditCard } from 'lucide-react';
import { useAuthToken } from '@/lib/useAuthToken';

interface TopupEntry {
  id: string;
  siteId: string;
  siteName?: string;
  amount: number;
  balanceAfter: number;
  description?: string;
  performedBy?: string;
  createdAt: string | null;
}

export function UsageLog() {
  const [entries, setEntries] = useState<TopupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [siteFilter, setSiteFilter] = useState('');
  const token = useAuthToken();

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const url = siteFilter
      ? `/api/ai-settings/usage?siteId=${encodeURIComponent(siteFilter)}&limit=50`
      : '/api/ai-settings/usage?limit=50';
    fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then((data: { entries: TopupEntry[] }) => {
        if (!cancelled) { setEntries(data.entries ?? []); setLoading(false); }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, siteFilter]);

  return (
    <div className="bg-white rounded-2xl border-[3px] border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-gray-400" />
          <span className="font-black">Topup History</span>
        </div>
        <input
          type="text"
          value={siteFilter}
          onChange={e => setSiteFilter(e.target.value)}
          placeholder="Filter by site ID..."
          className="border-2 border-gray-200 rounded-lg px-3 py-1.5 text-xs w-48"
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : entries.length === 0 ? (
        <div className="text-sm text-gray-400">No topup records found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-gray-100">
                <th className="text-left py-2 pr-4 text-gray-400 font-semibold uppercase tracking-wide">Time</th>
                <th className="text-left py-2 pr-4 text-gray-400 font-semibold uppercase tracking-wide">Site</th>
                <th className="text-left py-2 pr-4 text-gray-400 font-semibold uppercase tracking-wide">Reason</th>
                <th className="text-left py-2 pr-4 text-gray-400 font-semibold uppercase tracking-wide">By</th>
                <th className="text-right py-2 pr-4 text-gray-400 font-semibold uppercase tracking-wide">Amount</th>
                <th className="text-right py-2 text-gray-400 font-semibold uppercase tracking-wide">Balance After</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 pr-4 text-gray-400 whitespace-nowrap">
                    {entry.createdAt ? new Date(entry.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                  </td>
                  <td className="py-2 pr-4 font-medium">{entry.siteName ?? entry.siteId}</td>
                  <td className="py-2 pr-4 text-gray-500">{entry.description ?? '—'}</td>
                  <td className="py-2 pr-4 text-gray-400">{entry.performedBy ?? '—'}</td>
                  <td className="py-2 pr-4 text-right font-mono font-bold text-green-600">
                    +${entry.amount.toFixed(4)}
                  </td>
                  <td className="py-2 text-right font-mono text-gray-500">
                    ${entry.balanceAfter.toFixed(4)}
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
