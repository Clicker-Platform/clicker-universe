'use client';

import { useState, useEffect } from 'react';
import { Loader2, Activity } from 'lucide-react';

interface LogEntry {
  id: string;
  siteId: string;
  siteName?: string;
  type: 'debit' | 'topup' | 'refund';
  amount: number;
  balanceAfter?: number;
  moduleId?: string;
  skillId?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUSD?: number;
  description?: string;
  performedBy?: string;
  createdAt: string | null;
}

const TYPE_STYLES: Record<string, string> = {
  debit:  'bg-red-50 text-red-700',
  topup:  'bg-green-50 text-green-700',
  refund: 'bg-blue-50 text-blue-700',
};

export function UsageLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [siteFilter, setSiteFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    const url = siteFilter
      ? `/api/ai-settings/usage?siteId=${encodeURIComponent(siteFilter)}&limit=50`
      : '/api/ai-settings/usage?limit=50';
    fetch(url)
      .then(r => r.json())
      .then((data: { entries: LogEntry[] }) => setEntries(data.entries ?? []))
      .finally(() => setLoading(false));
  }, [siteFilter]);

  return (
    <div className="bg-white rounded-2xl border-[3px] border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-gray-400" />
          <span className="font-black">Usage Log</span>
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
        <div className="text-sm text-gray-400">No usage records found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-gray-100">
                <th className="text-left py-2 pr-3 text-gray-400 font-semibold uppercase tracking-wide">Time</th>
                <th className="text-left py-2 pr-3 text-gray-400 font-semibold uppercase tracking-wide">Site</th>
                <th className="text-left py-2 pr-3 text-gray-400 font-semibold uppercase tracking-wide">Type</th>
                <th className="text-left py-2 pr-3 text-gray-400 font-semibold uppercase tracking-wide">Module / Skill</th>
                <th className="text-left py-2 pr-3 text-gray-400 font-semibold uppercase tracking-wide">Model</th>
                <th className="text-right py-2 pr-3 text-gray-400 font-semibold uppercase tracking-wide">Tokens</th>
                <th className="text-right py-2 pr-3 text-gray-400 font-semibold uppercase tracking-wide">Cost</th>
                <th className="text-right py-2 text-gray-400 font-semibold uppercase tracking-wide">Balance</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 pr-3 text-gray-400 whitespace-nowrap">
                    {entry.createdAt ? new Date(entry.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                  </td>
                  <td className="py-2 pr-3 font-medium">
                    {entry.siteName ?? entry.siteId}
                  </td>
                  <td className="py-2 pr-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_STYLES[entry.type] ?? 'bg-gray-50 text-gray-600'}`}>
                      {entry.type}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-gray-500 font-mono">
                    {entry.moduleId}/{entry.skillId}
                  </td>
                  <td className="py-2 pr-3 text-gray-400 font-mono">
                    {entry.model?.split('/')[1] ?? '—'}
                  </td>
                  <td className="py-2 pr-3 text-right text-gray-400">
                    {entry.inputTokens != null ? `${entry.inputTokens}/${entry.outputTokens}` : '—'}
                  </td>
                  <td className={`py-2 pr-3 text-right font-mono font-bold ${entry.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {entry.costUSD != null ? `$${entry.costUSD.toFixed(6)}` : `$${Math.abs(entry.amount).toFixed(6)}`}
                  </td>
                  <td className="py-2 text-right text-gray-500 font-mono">
                    {entry.balanceAfter != null ? `$${entry.balanceAfter.toFixed(4)}` : '—'}
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
