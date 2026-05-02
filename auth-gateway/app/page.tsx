'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { clearSessionCookies } from '@/lib/session';
import { getUserSites } from '@/lib/get-user-sites';

function AdminLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(true);

  // Guard: prevent double performHandoff from onAuthStateChanged + handleLogin racing
  const handoffInProgress = useRef(false);

  const searchParams = useSearchParams();

  const redirectTo = searchParams.get('redirect');

  // Shared Handoff Logic — guarded against double-invocation
  const performHandoff = async () => {
    if (handoffInProgress.current) return;
    handoffInProgress.current = true;

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Sesi tidak ditemukan.');

      // 1+2. Resolve tenant & generate token in parallel
      const [sites, tokenRes] = await Promise.all([
        Promise.race([
          getUserSites(currentUser.uid, currentUser.email),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout resolving tenant (5s).')), 5000)
          ),
        ]),
        Promise.race([
          fetch('/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: currentUser.uid }),
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Token timeout (10s).')), 10000)
          ),
        ]),
      ]);

      if (!sites || sites.length === 0) {
        await auth.signOut();
        window.location.href = `${window.location.origin}?error=no_membership`;
        return;
      }

      if (!tokenRes.ok) throw new Error('Gagal membuat token.');
      const { token } = await tokenRes.json();
      if (!token) throw new Error('Token tidak diterima.');

      const site = sites[0];

      // 3. Set __session cookie — terbaca di semua *.clicker.id
      const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'clicker.id';
      const isSecure = window.location.protocol === 'https:';
      const domainAttr = isSecure ? `; Domain=.${baseDomain}` : '';
      const secureAttr = isSecure ? '; Secure' : '';
      document.cookie = `__session=${site.siteId}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax${secureAttr}${domainAttr}`;

      // 4. Redirect langsung ke /admin — token di fragment (tidak masuk server log)
      const isFirebaseDefaultDomain = baseDomain.includes('.web.app');
      const targetOrigin = isFirebaseDefaultDomain
        ? `https://${baseDomain}/${site.slug}`
        : isSecure
          ? `https://${site.slug}.${baseDomain}`
          : `http://${window.location.hostname}:3000`;

      const nextPath = redirectTo && redirectTo !== '/'
        ? (redirectTo.startsWith('http') ? new URL(redirectTo).pathname : redirectTo)
        : '/admin';

      window.location.href = `${targetOrigin}${nextPath}#token=${encodeURIComponent(token)}&siteId=${encodeURIComponent(site.siteId)}`;

    } catch (err: any) {
      setError(`Gagal login: ${err.message}`);
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
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      window.history.replaceState(null, '', url.toString());
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
      setIsChecking(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-dark border-t-transparent mb-4"></div>
          <p className="text-brand-dark font-bold animate-pulse">Mempersiapkan dashboard...</p>
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
              className="w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:border-brand-dark focus:ring-0 outline-none transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-brand-dark font-bold text-sm mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:border-brand-dark focus:ring-0 outline-none transition-colors"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-brand-dark text-brand-green font-black uppercase py-3 rounded-xl border-[3px] border-brand-dark hover:bg-brand-green hover:text-brand-dark transition-all shadow-sticker hover:shadow-none translate-x-0 hover:translate-x-0.5 hover:translate-y-0.5"
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
