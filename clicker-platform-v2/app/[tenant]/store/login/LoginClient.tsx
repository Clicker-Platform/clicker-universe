'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { logger } from '@/lib/logger-edge';
import { publicRoutes } from '@/lib/modules/digital_goods/constants';

interface Props {
  tenant: string;
}

export function LoginClient({ tenant }: Props) {
  const routes = publicRoutes(tenant);
  const searchParams = useSearchParams();
  const raw = searchParams.get('next') || routes.store;
  const next = (raw.startsWith('/') && !raw.startsWith('//')) ? raw : routes.store;

  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'INPUT' | 'SENT'>('INPUT');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { setError('Email diperlukan.'); return; }
    setSubmitting(true); setError(null);
    try {
      const res = await fetch('/api/digital-goods/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-site-id': tenant },
        body: JSON.stringify({ email, next }),
      });
      if (!res.ok) throw new Error('Gagal mengirim link login.');
      window.localStorage.setItem('digitalGoodsEmailForSignIn', email);
      setStep('SENT');
    } catch (e: unknown) {
      logger.error('digital_goods.login.send.failed', { error: e });
      setError(e instanceof Error ? e.message : 'Gagal mengirim link login.');
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'SENT') {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto text-green-600 mb-3" size={32} />
        <h1 className="text-xl font-bold text-gray-900">Cek email kamu</h1>
        <p className="text-sm text-gray-600 mt-2">
          Kami sudah mengirim link login ke <strong>{email}</strong>. Klik tombol di email untuk masuk.
        </p>
        <p className="text-xs text-gray-400 mt-3">
          Link berlaku 15 menit. Tidak ada email dalam 5 menit? Cek folder spam atau coba lagi.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-6">
        <Mail className="mx-auto text-gray-400 mb-2" size={28} />
        <h1 className="text-2xl font-bold text-gray-900">Masuk</h1>
        <p className="text-sm text-gray-500 mt-1">Kami akan kirim link login ke email kamu.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          placeholder="you@example.com"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-studio-blue text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting && <Loader2 className="animate-spin w-4 h-4" />}
        Kirim link login
      </button>
    </form>
  );
}
