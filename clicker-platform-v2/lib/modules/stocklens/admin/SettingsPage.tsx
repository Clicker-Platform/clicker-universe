'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Key, Save, CheckCircle, Loader2, ExternalLink, Settings as SettingsIcon, Shield } from 'lucide-react';
import Link from 'next/link';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';

export default function StocklensSettingsPage() {
  const { siteId } = useSite();
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!siteId) return;
    fetch(`/api/stocklens/settings?siteId=${siteId}`)
      .then(r => r.json())
      .then(d => setHasKey(d.hasKey))
      .catch(e => logger.error('stocklens.settings.load.failed', { siteId, error: e }));
  }, [siteId]);

  async function handleSave() {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/stocklens/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, apiKey: apiKey.trim() }),
      });
      if (!res.ok) throw new Error('Gagal menyimpan');
      setHasKey(true);
      setApiKey('');
      toast.success('API Key berhasil disimpan');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const formData = new FormData();
      formData.append('siteId', siteId);
      const arr = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
      formData.append('image', new Blob([arr], { type: 'image/jpeg' }), 'test.jpg');
      const res = await fetch('/api/stocklens/scan', { method: 'POST', body: formData });
      if (res.status === 500) {
        const data = await res.json();
        if (data.error?.includes('API Key')) throw new Error(data.error);
      }
      toast.success('Koneksi Gemini berhasil');
    } catch (e: unknown) {
      toast.error('Test gagal: ' + (e instanceof Error ? e.message : 'Unknown error'));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Settings</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Konfigurasi Gemini AI untuk product scanning</p>
      </div>

      {/* API Key card */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
            <div>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Gemini API Key</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Required untuk fitur scan AI</p>
            </div>
          </div>
          {hasKey && (
            <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
              <CheckCircle className="w-3.5 h-3.5" /> Aktif
            </span>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">API Key</label>
          <input
            type="password"
            placeholder={hasKey ? '••••••••••••••••  (sudah tersimpan)' : 'AIzaSy...'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-mono"
          />
          <p className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
            Dapatkan API Key gratis dari
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5 font-medium">
              Google AI Studio <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={!apiKey.trim() || saving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan API Key
          </button>
          {hasKey && (
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 transition"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Test Koneksi
            </button>
          )}
        </div>
      </div>

      {/* Security info */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 p-5 flex gap-3">
        <Shield className="w-5 h-5 text-neutral-500 dark:text-neutral-400 shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Keamanan API Key</p>
          <ul className="text-xs text-neutral-600 dark:text-neutral-400 space-y-1 list-disc pl-4">
            <li>Key tersimpan terenkripsi di Firestore tenant ini</li>
            <li>Tidak terexpose ke browser — hanya digunakan server-side</li>
            <li>Setiap tenant punya API Key terpisah (tidak shared)</li>
            <li>Quota & billing dihitung di akun Google Cloud Anda sendiri</li>
          </ul>
        </div>
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
