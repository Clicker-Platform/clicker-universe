'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger-edge';

interface Props {
  tenant: string;
  email: string;
  nextUrl: string;
}

export function OnboardingClient({ tenant, email, nextUrl }: Props) {
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = fullName.trim();
    if (trimmed.length === 0) {
      setError('Nama wajib diisi.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/digital-goods/buyer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-site-id': tenant },
        body: JSON.stringify({ fullName: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? 'Gagal menyimpan');
      }
      window.location.assign(nextUrl);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal menyimpan';
      logger.error('digital_goods.onboarding.failed', { error: msg });
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow border border-gray-200 p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={email}
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
          required
          maxLength={120}
          autoFocus
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          placeholder="Nama kamu"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-studio-blue text-white px-5 py-3 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting && <Loader2 className="animate-spin w-4 h-4" />}
        Lanjut
      </button>
    </form>
  );
}
