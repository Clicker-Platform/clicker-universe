'use client';

import { useEffect, useRef, useState } from 'react';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { logger } from '@/lib/logger-edge';
import { publicRoutes } from '@/lib/modules/digital_goods/constants';

interface Props {
  tenant: string;
}

export function VerifyClient({ tenant }: Props) {
  const routes = publicRoutes(tenant);
  const [status, setStatus] = useState<'WORKING' | 'ERROR'>('WORKING');
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
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

        const storedNext = window.localStorage.getItem('digitalGoodsNextForSignIn');
        window.localStorage.removeItem('digitalGoodsNextForSignIn');
        const next = (storedNext && storedNext.startsWith('/') && !storedNext.startsWith('//'))
          ? storedNext
          : routes.store;

        const idToken = await result.user.getIdToken();
        const res = await fetch('/api/digital-goods/buyer/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-site-id': tenant },
          body: JSON.stringify({ idToken }),
        });
        if (!res.ok) throw new Error('Failed to initialize buyer session.');

        // Force full navigation so the new __session cookie is sent on the
        // next request. router.replace is SPA-only and the server-rendered
        // target page would otherwise read cookies from the request that
        // preceded the Set-Cookie response and bounce back to login.
        window.location.assign(next);
      } catch (e: any) {
        logger.error('digital_goods.login.verify.failed', { error: e });
        setError(e?.message ?? 'Failed to complete sign-in.');
        setStatus('ERROR');
      }
    })();
  }, [routes.store, tenant]);

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
            <a href={routes.login} className="text-sm text-studio-blue underline">Kembali ke login</a>
          </>
        )}
      </div>
    </main>
  );
}
