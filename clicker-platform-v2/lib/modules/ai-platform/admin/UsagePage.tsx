'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import { useSite } from '@/lib/site-context';

interface UsageEntry {
  id: string;
  moduleId: string;
  skillId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  balanceAfter: number;
  createdAt: string | null;
}

interface SummaryData {
  balance: number;
  lifetimeUsed: number;
}

const SKILL_LABELS: Record<string, string> = {
  'ai_sales_agent/chat': 'AI Chat',
  'ai_sales_agent/chat_followup': 'AI Chat',
  'ai_sales_agent/pdf_extraction': 'Knowledge Sync (PDF)',
  'stocklens/scan_product': 'Scan Produk',
  'ai_marketing/generate_ad_copy': 'Buat Iklan',
  'ai_marketing/generate_caption': 'Buat Caption',
  'ai_marketing/generate_headline': 'Buat Headline',
  'ai_marketing/generate_hashtags': 'Buat Hashtag',
  'ai_marketing/generate_cta': 'Buat CTA',
  'ai_marketing/translate_content': 'Terjemahkan',
  'ai_marketing/adapt_tone': 'Ubah Tone',
  'ai_marketing/plan_campaign': 'Rencana Kampanye',
  'ai_marketing/define_target_audience': 'Target Audiens',
  'ai_marketing/create_content_calendar': 'Kalender Konten',
  'ai_marketing/analyze_model_photo': 'Analisis Foto',
  'ai_marketing/analyze_background': 'Analisis Background',
  'ai_marketing/analyze_product': 'Analisis Produk',
  'ai_marketing/analyze_performance': 'Analisis Performa',
  'ai_marketing/generate_report': 'Buat Laporan',
};

const MODEL_LABELS: Record<string, string> = {
  'google/gemini-2.0-flash': 'Gemini Flash',
  'google/gemini-2.0-flash:free': 'Gemini Flash (Free)',
  'google/gemini-2.5-pro': 'Gemini 2.5 Pro',
  'anthropic/claude-sonnet-4': 'Claude Sonnet',
  'anthropic/claude-haiku-4-5': 'Claude Haiku',
  'openai/gpt-4o-mini': 'GPT-4o Mini',
  'openai/gpt-4o': 'GPT-4o',
};

function featureLabel(moduleId: string, skillId: string): string {
  return SKILL_LABELS[`${moduleId}/${skillId}`] ?? `${moduleId}/${skillId}`;
}

function modelShort(model: string): string {
  return MODEL_LABELS[model] ?? model.split('/')[1] ?? model;
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Baru saja';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} menit lalu`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} jam lalu`;
  return `${Math.floor(diff / 86_400_000)} hari lalu`;
}

export function UsagePage() {
  const { siteId } = useSite();
  const [entries, setEntries] = useState<UsageEntry[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState('');

  const fetchEntries = useCallback(async (cursor?: string) => {
    if (!siteId) return;
    const params = new URLSearchParams({ limit: '20' });
    if (cursor) params.set('cursor', cursor);
    if (moduleFilter) params.set('moduleId', moduleFilter);

    const res = await fetch(`/api/admin/ai-usage?${params}`, {
      headers: { 'x-site-id': siteId },
    });
    const data = await res.json() as { entries: UsageEntry[]; nextCursor: string | null };
    return data;
  }, [siteId, moduleFilter]);

  const fetchSummary = useCallback(async () => {
    if (!siteId) return;
    const res = await fetch('/api/admin/ai-credits', { headers: { 'x-site-id': siteId } });
    if (res.ok) setSummary(await res.json());
  }, [siteId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchEntries(), fetchSummary()]).then(([data]) => {
      if (data) { setEntries(data.entries); setNextCursor(data.nextCursor); }
    }).finally(() => setLoading(false));
  }, [fetchEntries, fetchSummary]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await fetchEntries(nextCursor);
      if (data) { setEntries(prev => [...prev, ...data.entries]); setNextCursor(data.nextCursor); }
    } finally {
      setLoadingMore(false);
    }
  }

  const now = new Date();
  const monthSpend = entries
    .filter(e => e.createdAt && new Date(e.createdAt).getMonth() === now.getMonth() && new Date(e.createdAt).getFullYear() === now.getFullYear())
    .reduce((sum, e) => sum + (e.costUSD ?? 0), 0);

  const balance = summary?.balance ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black">AI Usage</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border-2 border-gray-200 dark:border-neutral-700 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Balance</p>
          <p className={`text-2xl font-black ${balance <= 0 ? 'text-red-600' : balance < 0.10 ? 'text-orange-600' : balance < 0.50 ? 'text-amber-600' : 'text-green-600'}`}>
            ${balance.toFixed(4)}
          </p>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border-2 border-gray-200 dark:border-neutral-700 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Bulan Ini</p>
          <p className="text-2xl font-black">${monthSpend.toFixed(4)}</p>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border-2 border-gray-200 dark:border-neutral-700 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Total</p>
          <p className="text-2xl font-black">${(summary?.lifetimeUsed ?? 0).toFixed(4)}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-2xl border-2 border-gray-200 dark:border-neutral-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-400" />
            <span className="font-black">Usage History</span>
          </div>
          <select
            value={moduleFilter}
            onChange={e => setModuleFilter(e.target.value)}
            className="border-2 border-gray-200 dark:border-neutral-600 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-neutral-800"
          >
            <option value="">Semua Fitur</option>
            <option value="ai_sales_agent">AI Sales Agent</option>
            <option value="stocklens">Stocklens</option>
            <option value="ai_marketing">AI Marketing</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat...
          </div>
        ) : entries.length === 0 ? (
          <div className="text-sm text-gray-400 py-8 text-center">Belum ada penggunaan AI</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-gray-100 dark:border-neutral-700">
                    <th className="text-left py-2 pr-3 text-gray-400 font-semibold uppercase tracking-wide">Waktu</th>
                    <th className="text-left py-2 pr-3 text-gray-400 font-semibold uppercase tracking-wide">Fitur</th>
                    <th className="text-left py-2 pr-3 text-gray-400 font-semibold uppercase tracking-wide">Model</th>
                    <th className="text-right py-2 pr-3 text-gray-400 font-semibold uppercase tracking-wide">Tokens</th>
                    <th className="text-right py-2 text-gray-400 font-semibold uppercase tracking-wide">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => (
                    <tr key={entry.id} className="border-b border-gray-50 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800">
                      <td className="py-2 pr-3 text-gray-400 whitespace-nowrap" title={entry.createdAt ?? ''}>
                        {relativeTime(entry.createdAt)}
                      </td>
                      <td className="py-2 pr-3 font-medium">
                        {featureLabel(entry.moduleId, entry.skillId)}
                      </td>
                      <td className="py-2 pr-3 text-gray-500">
                        {modelShort(entry.model)}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-400 font-mono">
                        {entry.inputTokens ?? 0}↑ {entry.outputTokens ?? 0}↓
                      </td>
                      <td className="py-2 text-right font-mono font-semibold">
                        ${(entry.costUSD ?? 0).toFixed(6)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {nextCursor && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 font-semibold disabled:opacity-50"
                >
                  {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
