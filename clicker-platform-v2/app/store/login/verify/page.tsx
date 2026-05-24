'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { logger } from '@/lib/logger-edge';
import { PUBLIC_ROUTES } from '@/lib/modules/digital_goods/constants';

export default function StoreLoginVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || PUBLIC_ROUTES.store;
  const [status, setStatus] = useState<'WORKING' | 'ERROR'>('WORKING');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!isSignInWithEmailLink(auth, window.location.href)) {
          throw new Error('Invalid or expired link.');
        }
        let email = window.localStorage.getItem('digitalGoodsEmailForSignIn');
        if (!email) {
          email = window.prompt('Confirm your email to complete sign-in:');
          if (!email) throw new Error('Email required.');
        }
        const result = await signInWithEmailLink(auth, email, window.location.href);
        window.localStorage.removeItem('digitalGoodsEmailForSignIn');

        // Tell the server to create the buyer record + set the session cookie
        const idToken = await result.user.getIdToken();
        const res = await fetch('/api/digital-goods/buyer/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        if (!res.ok) throw new Error('Failed to initialize buyer session.');

        router.replace(next);
      } catch (e: any) {
        logger.error('digital_goods.login.verify.failed', { error: e });
        setError(e?.message ?? 'Failed to complete sign-in.');
        setStatus('ERROR');
      }
    })();
  }, [next, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-xl shadow border border-gray-200 p-8 text-center">
        {status === 'WORKING' ? (
          <>
            <Loader2 className="animate-spin mx-auto text-studio-blue mb-3" size={32} />
            <p className="text-sm text-gray-600">Memverifikasi...</p>
          </>
        ) : (
          <>
            <p className="text-sm text-red-600 mb-2">{error}</p>
            <a href={PUBLIC_ROUTES.login} className="text-sm text-studio-blue underline">Kembali ke login</a>
          </>
        )}
      </div>
    </main>
  );
}
