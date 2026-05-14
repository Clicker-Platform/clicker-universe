'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, CreditCard, Plus } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useAuthToken } from '@/lib/useAuthToken';

interface SiteCredit {
  siteId: string;
  name: string;
  balance: number;
  lifetimeUsed: number;
}

export function CreditOverview() {
  const [sites, setSites] = useState<SiteCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [topupTarget, setTopupTarget] = useState<string | null>(null);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupReason, setTopupReason] = useState('');
  const [topping, setTopping] = useState(false);

  const token = useAuthToken();

  const fetchCredits = useCallback(async (idToken: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai-settings/credits', {
        headers: { 'Authorization': `Bearer ${idToken}` },
      });
      const data = await res.json() as { sites: SiteCredit[]; error?: string };
      setSites(data.sites ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (token) fetchCredits(token); }, [token, fetchCredits]);

  async function handleTopup(siteId: string) {
    const amount = Number(topupAmount);
    if (!amount || amount <= 0) return;
    setTopping(true);
    try {
      const idToken = token ?? await auth.currentUser?.getIdToken() ?? '';
      await fetch('/api/ai-settings/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ siteId, amount, reason: topupReason || 'Manual top-up' }),
      });
      setTopupTarget(null);
      setTopupAmount('');
      setTopupReason('');
      if (idToken) await fetchCredits(idToken);
    } finally {
      setTopping(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border-[3px] border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-gray-400" />
          <span className="font-black">Credit Overview</span>
        </div>
        <button
          onClick={() => token && fetchCredits(token)}
          disabled={loading}
          className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading...</div>
      ) : sites.length === 0 ? (
        <div className="text-sm text-gray-400">No sites found.</div>
      ) : (
        <div className="space-y-2">
          {sites.map(site => (
            <div key={site.siteId}>
              <div className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-gray-50">
                <div>
                  <p className="text-sm font-semibold">{site.name}</p>
                  <p className="text-xs text-gray-400">{site.siteId}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={`text-sm font-black ${site.balance < 0.10 ? 'text-red-600' : site.balance < 0.50 ? 'text-amber-600' : 'text-green-600'}`}>
                      ${site.balance.toFixed(4)}
                    </p>
                    <p className="text-xs text-gray-400">${site.lifetimeUsed.toFixed(4)} used</p>
                  </div>
                  <button
                    onClick={() => setTopupTarget(topupTarget === site.siteId ? null : site.siteId)}
                    className="p-1.5 rounded-lg border-2 border-gray-200 hover:border-blue-400 text-gray-400 hover:text-blue-600 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {topupTarget === site.siteId && (
                <div className="mx-3 mb-2 p-3 bg-blue-50 rounded-xl border-2 border-blue-100 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={topupAmount}
                      onChange={e => setTopupAmount(e.target.value)}
                      placeholder="USD amount (e.g. 5.00)"
                      step="0.01"
                      min={0.01}
                      className="w-24 border-2 border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={topupReason}
                      onChange={e => setTopupReason(e.target.value)}
                      placeholder="Reason (optional)"
                      className="flex-1 border-2 border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                    />
                    <button
                      onClick={() => handleTopup(site.siteId)}
                      disabled={topping || !topupAmount}
                      className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold disabled:opacity-50 flex items-center gap-1"
                    >
                      {topping ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Top Up'}
                    </button>
                    <button
                      onClick={() => setTopupTarget(null)}
                      className="px-2 py-1.5 text-sm text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
