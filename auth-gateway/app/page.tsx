'use client';

import { useEffect, useState, Suspense } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '@/lib/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

// ... (imports remain)

function AdminLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(true); // New loading state
  const [status, setStatus] = useState(''); // Status message during auto-handoff

  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectTo = searchParams.get('redirect');

  // Shared Handoff Logic
  const performHandoff = async () => {
    try {
      setStatus('Generating secure access token...');
      const generateHandoffToken = httpsCallable(functions, 'generateHandoffToken');
      const result = await generateHandoffToken();

      // @ts-ignore
      if (!result.data || !result.data.token) {
        throw new Error('No token received.');
      }

      // @ts-ignore
      const handoffToken = result.data.token;

      setStatus('Redirecting to dashboard...');

      // Determine the platform URL - prefer masked domains
      let platformUrl: string = '';

      // 1. Try to get domain from redirect param
      if (redirectTo && redirectTo.startsWith('http')) {
        try {
          platformUrl = new URL(redirectTo).origin;
        } catch {
          // Invalid URL in redirect param
        }
      }

      // 2. If no valid redirect domain, try to infer from tenant cookie
      if (!platformUrl) {
        // Check for tenant cookie set during login
        const tenantMatch = document.cookie.match(/__tenant=([^;]+)/);
        const tenantSlug = tenantMatch ? tenantMatch[1] : null;

        if (tenantSlug) {
          // Construct masked domain from tenant
          platformUrl = `https://${tenantSlug}.clicker.id`;
        } else if (window.location.hostname === 'localhost') {
          // Fallback for local development to main platform port
          platformUrl = 'http://localhost:3000';
        } else {
          // 3. Last resort fallback
          // Prefer generic masked domain over Firebase URL
          platformUrl = 'https://clicker.id';
        }
      }


      const nextPath = (redirectTo && redirectTo !== '/')
        ? (redirectTo.startsWith('http') ? new URL(redirectTo).pathname : redirectTo)
        : '/admin';
      const finalUrl = `${platformUrl}/admin/auth/callback?token=${handoffToken}&next=${encodeURIComponent(nextPath)}`;


      // console.log(`🚀 Handing off to: ${finalUrl}`); // SECURE: Don't log token
      window.location.href = finalUrl;

    } catch (err: any) {
      console.error('Handoff Error:', err);
      setError(`Auto-login failed: ${err.message}. Please login manually.`);
      setIsChecking(false); // Show form on error
    }
  };

  // Auto-Login Check
  useEffect(() => {
    // Check if redirected back due to an error (e.g., no site membership)
    const errorParam = searchParams.get('error');
    if (errorParam) {
      // User was redirected back with an error — clear stale auth session first
      auth.signOut().then(() => {
        // Clear any stale cookies
        document.cookie = '__session=; path=/; max-age=0; SameSite=Lax; Secure';
        document.cookie = '__session=; path=/; max-age=0; Domain=.clicker.id; SameSite=Lax; Secure';

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
      // Clean the error param from URL
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('error');
        window.history.replaceState(null, '', url.toString());
      }
      return () => { }; // No-op cleanup
    }

    // Check if user is already logged in
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        console.log("User found, attempting auto-handoff...");
        await performHandoff();
      } else {
        setIsChecking(false); // No user, show form
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
      // Auth state change will trigger useEffect? 
      // Actually, onAuthStateChanged might fire, but let's call handoff directly to be sure/faster
      // OR rely on the listener. 
      // Relying on listener is safer to avoid double-firing, but let's just wait for listener or call it if we want instant feedback.
      // Better: The listener handles it. But we need to ensure 'isChecking' puts us in a loading state.
      setIsChecking(true);

      // Manual trigger if listener implies we are already authed? 
      // signInWithEmailAndPassword authenticates the client. 
      // The listener WILL fire. Let's rely on the listener or manual call.
      // To prevent races, let's just call performHandoff() directly here too, but ensuring we don't double dip is tricky.
      // Actually, standard pattern: 
      // 1. signIn
      // 2. performHandoff
      await performHandoff();

    } catch (err: any) {
      console.error('Login Error:', err);
      // Error handling logic...
      let errorMessage = 'Unknown error occurred';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid email or password';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed login attempts. Please try again later.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(`⚠️ Login Failed: ${errorMessage}`);
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
