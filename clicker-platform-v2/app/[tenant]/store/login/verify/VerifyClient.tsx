'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { logger } from '@/lib/logger-edge';
import { publicRoutes } from '@/lib/modules/digital_goods/constants';

interface Props {
  tenant: string;
}

export function VerifyClient({ tenant }: Props) {
  const router = useRouter();
  const routes = publicRoutes(tenant);
  const searchParams = useSearchParams();
  const raw = searchParams.get('next') || routes.store;
  const next = (raw.startsWith('/') && !raw.startsWith('//')) ? raw : routes.store;
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

        const idToken = await result.user.getIdToken();
        const res = await fetch('/api/digital-goods/buyer/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-site-id': tenant },
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
  }, [next, router, tenant]);

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
