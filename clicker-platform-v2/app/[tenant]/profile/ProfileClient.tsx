'use client';

import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { Loader2, CheckCircle2, LogOut } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { logger } from '@/lib/logger-edge';
import { publicRoutes } from '@/lib/modules/digital_goods/constants';

interface Props {
  tenant: string;
  initialEmail: string;
  initialFullName: string;
}

export function ProfileClient({ tenant, initialEmail, initialFullName }: Props) {
  const routes = publicRoutes(tenant);
  const [fullName, setFullName] = useState(initialFullName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/digital-goods/buyer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-site-id': tenant },
        body: JSON.stringify({ fullName: fullName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? 'Gagal menyimpan');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal menyimpan';
      logger.error('digital_goods.profile.save.failed', { error: msg });
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/digital-goods/buyer/logout', {
        method: 'POST',
        headers: { 'x-site-id': tenant },
      });
      try { await signOut(auth); } catch { /* ignore Firebase signOut failure */ }
      window.location.assign(routes.store);
    } catch (e) {
      logger.error('digital_goods.logout.failed', { error: e });
      setLoggingOut(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow border border-gray-200 p-6 space-y-5">
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={initialEmail}
            readOnly
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nama lengkap</label>
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            maxLength={120}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Nama kamu"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-studio-blue text-white px-5 py-2 rounded-lg font-semibold disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="animate-spin w-4 h-4" />}
            Simpan
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-600 font-semibold">
              <CheckCircle2 className="w-4 h-4" /> Tersimpan
            </span>
          )}
        </div>
      </form>

      <div className="pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50 flex items-center gap-2"
        >
          {loggingOut ? <Loader2 className="animate-spin w-4 h-4" /> : <LogOut className="w-4 h-4" />}
          Keluar
        </button>
      </div>
    </div>
  );
}
