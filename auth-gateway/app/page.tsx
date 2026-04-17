'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '@/lib/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { clearSessionCookies } from '@/lib/session';
import { resolvePlatformUrl } from '@/lib/resolve-platform-url';

function AdminLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(true);
  const [status, setStatus] = useState('');

  // Guard: prevent double performHandoff from onAuthStateChanged + handleLogin racing
  const handoffInProgress = useRef(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectTo = searchParams.get('redirect');

  // Shared Handoff Logic — guarded against double-invocation
  const performHandoff = async () => {
    if (handoffInProgress.current) {
      return;
    }

    // Loop detection: if performHandoff is called too many times in one session,
    // it indicates a redirect loop (gateway → callback → middleware → gateway).
    const LOOP_KEY = 'handoff_loop_count';
    const loopCount = parseInt(sessionStorage.getItem(LOOP_KEY) || '0');
    if (loopCount >= 3) {
      console.error('[Auth Gateway] Loop detected after', loopCount, 'attempts. Breaking cycle.');
      sessionStorage.removeItem(LOOP_KEY);
      try {
        await auth.signOut();
      } catch { /* ignore */ }
      clearSessionCookies();
      setError('⚠️ Login loop terdeteksi. Session telah di-reset. Silakan login ulang dari awal.');
      setIsChecking(false);
      return;
    }
    sessionStorage.setItem(LOOP_KEY, String(loopCount + 1));

    handoffInProgress.current = true;

    try {
      setStatus('Generating secure access token...');
      const generateHandoffTokenFn = httpsCallable(functions, 'generateHandoffToken');

      // Wrap with 15s timeout — Cloud Function cold starts can cause indefinite hang
      const result = await Promise.race([
        generateHandoffTokenFn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Token generation timeout (15s). Cek koneksi internet dan coba lagi.')), 15000)
        )
      ]);

      const handoffData = result.data as { token?: string };
      if (!handoffData?.token) {
        throw new Error('No token received.');
      }
      const handoffToken = handoffData.token;

      setStatus('Redirecting to dashboard...');

      const platformUrl = await resolvePlatformUrl({ redirectTo, currentUser: auth.currentUser });

      const nextPath = (redirectTo && redirectTo !== '/')
        ? (redirectTo.startsWith('http') ? new URL(redirectTo).pathname : redirectTo)
        : '/admin';
      // Token in fragment (#) — never sent to server, not in logs, not in referrer headers
      const finalUrl = `${platformUrl}/admin/auth/callback?next=${encodeURIComponent(nextPath)}#token=${encodeURIComponent(handoffToken)}`;

      // Handoff successful — clear loop counter before redirecting
      sessionStorage.removeItem('handoff_loop_count');

      window.location.href = finalUrl;

    } catch (err: any) {
      console.error('Handoff Error:', err);
      sessionStorage.removeItem('handoff_loop_count');
      setError(`Gagal login otomatis: ${err.message}. Silakan login ulang.`);
      setIsChecking(false);
    } finally {
      handoffInProgress.current = false;
    }
  };

  // Auto-Login Check
  useEffect(() => {
    // Check if redirected back due to an error (e.g., no site membership)
    const errorParam = searchParams.get('error');
    if (errorParam) {
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('error');
        window.history.replaceState(null, '', url.toString());
      }
      // Clear stale auth session, then show error
      auth.signOut().then(() => {
        clearSessionCookies();
        const errorMessages: Record<string, string> = {
          'no_membership': '⚠️ Akun ini tidak memiliki akses ke situs manapun. Silakan login dengan akun lain.',
          'auth_failed': '⚠️ Autentikasi gagal. Silakan coba lagi.',
        };
        setError(errorMessages[errorParam] || `⚠️ Terjadi kesalahan: ${errorParam}`);
        setIsChecking(false);
      }).catch(() => {
        setError('⚠️ Akun tidak memiliki akses. Silakan login dengan akun lain.');
        setIsChecking(false);
      });
      return () => { };
    }

    // Check if user is already logged in — onAuthStateChanged handles handoff
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        await performHandoff();
      } else {
        setIsChecking(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatus('Authenticating...');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      setIsChecking(true);
      // onAuthStateChanged listener will fire and call performHandoff

    } catch (err: any) {
      let errorMessage = 'Email atau password salah.';
      if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Terlalu banyak percobaan gagal. Silakan coba lagi nanti.';
      } else if (err.code && err.code !== 'auth/invalid-credential' && err.code !== 'auth/user-not-found' && err.code !== 'auth/wrong-password') {
        errorMessage = err.message;
      }
      setError(`⚠️ Login Gagal: ${errorMessage}`);
      setStatus('');
      setIsChecking(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-dark border-t-transparent mb-4"></div>
          <p className="text-brand-dark font-bold animate-pulse">{status || 'Checking session...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full border-[3px] border-brand-dark">
        <div className="flex justify-center mb-6">
          <div className="relative w-20 h-20">
            <Image
              src="/clicker_brand_logo.png"
              alt="Clicker Logo"
              fill
              className="object-contain"
              priority
              unoptimized
            />
          </div>
        </div>

        <h1 className="text-xl font-black text-center text-brand-dark mb-6 uppercase">Admin Access</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-brand-dark font-bold text-sm mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border-[2px] border-gray-300 focus:border-brand-dark focus:ring-0 outline-none transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-brand-dark font-bold text-sm mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border-[2px] border-gray-300 focus:border-brand-dark focus:ring-0 outline-none transition-colors"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-brand-dark text-brand-green font-black uppercase py-3 rounded-xl border-[3px] border-brand-dark hover:bg-brand-green hover:text-brand-dark transition-all shadow-sticker hover:shadow-none translate-x-0 hover:translate-x-[2px] hover:translate-y-[2px]"
          >
            Enter Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLogin() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-100">Loading...</div>}>
      <AdminLoginForm />
    </Suspense>
  );
}
