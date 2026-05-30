'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { logger } from '@/lib/logger-edge';

export function VerifyClient({ tenant }: { tenant: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setError('Link tidak valid atau sudah expired.');
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const res = await fetch('/api/account/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-site-id': tenant },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) throw new Error('verify_failed');
        const { customToken, redirectUrl } = (await res.json()) as {
          customToken: string;
          redirectUrl?: string;
        };

        const cred = await signInWithCustomToken(auth, customToken);
        const idToken = await cred.user.getIdToken();

        const sres = await fetch('/api/account/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-site-id': tenant },
          body: JSON.stringify({ idToken }),
        });
        if (!sres.ok) throw new Error('session_failed');

        window.localStorage.removeItem('accountEmailForSignIn');
        const dest =
          redirectUrl && redirectUrl.startsWith('/') && !redirectUrl.startsWith('//')
            ? redirectUrl
            : `/${tenant}/account`;
        router.replace(dest);
      } catch (e) {
        logger.error('account.verify.failed', { error: e });
        setError('Gagal masuk. Minta link baru.');
      }
    })();
  }, [token, tenant, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f4f4f6] p-6 font-[family-name:var(--font-outfit)]">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-gray-700 font-medium mb-2">{error}</p>
            <a href={`/${tenant}/account/login`} className="text-sm text-gray-500 underline">
              Kembali ke login
            </a>
          </>
        ) : (
          <>
            <Loader2 className="animate-spin mx-auto text-gray-400 mb-3" size={32} />
            <p className="text-sm text-gray-500">Memverifikasi link…</p>
          </>
        )}
      </div>
    </main>
  );
}
