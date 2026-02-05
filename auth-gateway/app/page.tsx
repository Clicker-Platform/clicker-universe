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
      const platformUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:3010'
        : 'https://clickerapps.web.app';

      const nextPath = (redirectTo && redirectTo !== '/') ? redirectTo : '/admin';
      const finalUrl = `${platformUrl}/admin/auth/callback?token=${handoffToken}&next=${encodeURIComponent(nextPath)}`;

      console.log(`🚀 Handing off to: ${finalUrl}`);
      window.location.href = finalUrl;

    } catch (err: any) {
      console.error('Handoff Error:', err);
      setError(`Auto-login failed: ${err.message}. Please login manually.`);
      setIsChecking(false); // Show form on error
    }
  };

  // Auto-Login Check
  useEffect(() => {
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
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
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
