'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { logger } from '@/lib/logger-edge';
import { publicRoutes } from '@/lib/modules/digital_goods/constants';

interface Props {
  tenant: string;
}

type Status = 'IDLE' | 'WORKING' | 'ERROR';

const ERROR_COPY: Record<string, string> = {
  invalid_token:      'Link tidak valid.',
  used:               'Link sudah dipakai. Kirim ulang link login.',
  expired:            'Link sudah expired. Kirim ulang link login.',
  mismatch:           'Link tidak valid untuk store ini.',
  user_create_failed: 'Gagal memproses akun. Coba lagi.',
  unknown:            'Terjadi kesalahan. Coba lagi.',
};

export function VerifyClient({ tenant }: Props) {
  const routes = publicRoutes(tenant);
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<Status>(token ? 'WORKING' : 'IDLE');
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [formFields, setFormFields] = useState<{ idToken: string; next: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const res = await fetch('/api/digital-goods/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-site-id': tenant },
          body: JSON.stringify({ token }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const code = (data?.error as string) ?? 'unknown';
          throw new Error(code);
        }

        const { customToken, redirectUrl } = data as { customToken: string; redirectUrl: string };

        const result = await signInWithCustomToken(auth, customToken);
        const idToken = await result.user.getIdToken();

        const next = (redirectUrl && redirectUrl.startsWith('/') && !redirectUrl.startsWith('//'))
          ? redirectUrl
          : routes.store;

        window.localStorage.removeItem('digitalGoodsEmailForSignIn');

        // Hand off to a native form POST so the browser applies Set-Cookie
        // and follows the server 302 redirect in one round-trip. Custom Tabs
        // and in-app browsers persist the cookie this way; the previous
        // fetch+Set-Cookie+window.assign pattern dropped the cookie on mobile.
        setFormFields({ idToken, next });
      } catch (e: unknown) {
        const code = e instanceof Error ? e.message : 'unknown';
        logger.error('digital_goods.login.verify.failed', { error: e });
        setError(ERROR_COPY[code] ?? ERROR_COPY.unknown);
        setStatus('ERROR');
      }
    })();
  }, [token, tenant, routes.store]);

  // Auto-submit the form once fields are populated.
  useEffect(() => {
    if (formFields && formRef.current) {
      formRef.current.submit();
    }
  }, [formFields]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-xl shadow border border-gray-200 p-8 text-center">
        {!token ? (
          <>
            <p className="text-sm text-red-600 mb-2">Link tidak valid atau sudah expired.</p>
            <a href={routes.login} className="text-sm text-studio-blue underline">Kirim ulang link login</a>
          </>
        ) : status === 'ERROR' ? (
          <>
            <p className="text-sm text-red-600 mb-2">{error}</p>
            <a href={routes.login} className="text-sm text-studio-blue underline">Kembali ke login</a>
          </>
        ) : (
          <>
            <Loader2 className="animate-spin mx-auto text-studio-blue mb-3" size={32} />
            <p className="text-sm text-gray-600">Memverifikasi...</p>
          </>
        )}
      </div>

      {/* Hidden form for native submission after client sign-in. */}
      {formFields && (
        <form
          ref={formRef}
          method="POST"
          action="/api/digital-goods/buyer/init"
          style={{ display: 'none' }}
        >
          <input type="hidden" name="siteId" value={tenant} />
          <input type="hidden" name="idToken" value={formFields.idToken} />
          <input type="hidden" name="next" value={formFields.next} />
        </form>
      )}
    </main>
  );
}
