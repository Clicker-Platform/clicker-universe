'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { sendSignInLinkToEmail } from 'firebase/auth';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { logger } from '@/lib/logger-edge';
import { PUBLIC_ROUTES } from '@/lib/modules/digital_goods/constants';

export function LoginClient() {
  const searchParams = useSearchParams();
  const raw = searchParams.get('next') || PUBLIC_ROUTES.store;
  const next = (raw.startsWith('/') && !raw.startsWith('//')) ? raw : PUBLIC_ROUTES.store;

  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'INPUT' | 'SENT'>('INPUT');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { setError('Email diperlukan.'); return; }
    setSubmitting(true); setError(null);
    try {
      const verifyUrl = `${window.location.origin}${PUBLIC_ROUTES.loginVerify}?next=${encodeURIComponent(next)}`;
      await sendSignInLinkToEmail(auth, email, {
        url: verifyUrl,
        handleCodeInApp: true,
      });
      window.localStorage.setItem('digitalGoodsEmailForSignIn', email);
      setStep('SENT');
    } catch (e: any) {
      logger.error('digital_goods.login.send.failed', { error: e });
      setError(e?.message ?? 'Failed to send login link.');
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'SENT') {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto text-green-600 mb-3" size={32} />
        <h1 className="text-xl font-bold text-gray-900">Cek email Anda</h1>
        <p className="text-sm text-gray-600 mt-2">Kami sudah mengirim link login ke <strong>{email}</strong>. Klik link tersebut untuk masuk.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-6">
        <Mail className="mx-auto text-gray-400 mb-2" size={28} />
        <h1 className="text-2xl font-bold text-gray-900">Masuk</h1>
        <p className="text-sm text-gray-500 mt-1">Kami akan kirim link login ke email Anda.</p>
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
