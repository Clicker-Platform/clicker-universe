'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Key, Save, CheckCircle, Loader2 } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger';

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
    <div className="max-w-lg space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Key className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Gemini API Key</h2>
        {hasKey && (
          <span className="ml-auto flex items-center gap-1 text-xs text-green-500">
            <CheckCircle className="w-3.5 h-3.5" /> Terkonfigurasi
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Masukkan Gemini API Key dari Google AI Studio. Key disimpan secara aman di server.
      </p>
      <input
        type="password"
        placeholder={hasKey ? '••••••••••••••••' : 'AIza...'}
        value={apiKey}
        onChange={e => setApiKey(e.target.value)}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!apiKey.trim() || saving}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Simpan
        </button>
        {hasKey && (
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Test Koneksi
          </button>
        )}
      </div>
    </div>
  );
}
