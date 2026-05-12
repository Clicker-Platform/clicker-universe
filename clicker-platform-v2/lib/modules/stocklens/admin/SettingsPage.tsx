'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle, Loader2, Settings as SettingsIcon, Zap } from 'lucide-react';
import Link from 'next/link';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';

export default function StocklensSettingsPage() {
  const { siteId } = useSite();
  const [testing, setTesting] = useState(false);

  async function handleTest() {
    setTesting(true);
    try {
      const res = await fetch('/api/stocklens/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test gagal');
      toast.success('Koneksi AI berhasil');
    } catch (e: unknown) {
      logger.error('stocklens.test.failed', { siteId, error: e });
      toast.error('Test gagal: ' + (e instanceof Error ? e.message : 'Unknown error'));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Settings</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Konfigurasi Stocklens AI scanning</p>
      </div>

      {/* AI powered by platform */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-500" />
            <div>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">AI Powered by Clicker Platform</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">OpenRouter — tidak perlu API Key sendiri</p>
            </div>
          </div>
          <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
            <CheckCircle className="w-3.5 h-3.5" /> Platform
          </span>
        </div>

        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Stocklens menggunakan AI vision dari Clicker Platform. Setiap scan menggunakan kredit AI dari akun Anda.
        </p>

        <button
          onClick={handleTest}
          disabled={testing}
          className="flex items-center gap-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 transition"
        >
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Test Koneksi AI
        </button>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/admin/stocklens/scanner" className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 hover:border-blue-500/50 hover:shadow-sm transition group">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">Scanner →</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Scan produk baru</p>
        </Link>
        <Link href="/admin/stocklens/vault" className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 hover:border-blue-500/50 hover:shadow-sm transition group">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">Vault →</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Lihat semua SKU</p>
        </Link>
      </div>
    </div>
  );
}
