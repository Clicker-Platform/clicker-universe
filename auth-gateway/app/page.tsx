'use client';

import { useState, Suspense } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '@/lib/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

function AdminLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get redirect destination from URL params, default to core app dashboard or similar
  // Since this is key gateway, maybe default to redirecting to the tenant's site?
  // For now, let's keep it generic or direct to a success page.
  const redirectTo = searchParams.get('redirect') || '/';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // 1. Authenticate with Gateway
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Generate Handoff Token (Custom Token)
      // This token allows the user to sign in instantly on the other domain
      const generateHandoffToken = httpsCallable(functions, 'generateHandoffToken');
      const result = await generateHandoffToken();

      // @ts-ignore - Check if token exists in response
      if (!result.data || !result.data.token) {
        throw new Error('No token received from server. Please try again or contact support.');
      }

      // @ts-ignore
      const handoffToken = result.data.token;

      // 3. Redirect to Target Platform with Token
      // Always redirect to platform core, never back to auth gateway
      const platformUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:3010'
        : 'https://clickerapps.web.app';

      // Construct final URL with token AND next parameter for return path
      // Extract path from redirectTo - use it as the 'next' param, not part of URL
      const nextPath = redirectTo || '/admin';
      const finalUrl = `${platformUrl}/admin/auth/callback?token=${handoffToken}&next=${encodeURIComponent(nextPath)}`;

      console.log(`🎯 Platform URL: ${platformUrl}`);
      console.log(`📍 Return path: ${nextPath}`);
      console.log(`🚀 Handing off to: ${finalUrl}`);
      window.location.href = finalUrl;

    } catch (err: any) {
      console.error('Auth Handoff Error:', err);

      // Provide more specific error messages
      let errorMessage = 'Unknown error occurred';

      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed login attempts. Please try again later.';
      } else if (err.code === 'unauthenticated') {
        errorMessage = 'Authentication failed. Please try logging in again.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(`⚠️ Auth Handoff\n❌ Error: ${errorMessage}`);
    }
  };

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

        <h1 className="text-2xl font-black text-center text-brand-dark mb-6 uppercase">Admin Access</h1>

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
