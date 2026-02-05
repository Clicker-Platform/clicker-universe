'use client';

import { useEffect, useState, Suspense } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { getUserSites } from '@/lib/admin-auth';

function AuthCallbackHandler() {
    const [status, setStatus] = useState('Processing login...');
    const [error, setError] = useState('');
    const router = useRouter();
    const searchParams = useSearchParams();

    const rawNext = searchParams.get('next');
    // Safety Force: If next is '/' or empty, force it to '/admin'
    const safeNextPath = (rawNext && rawNext !== '/') ? rawNext : '/admin';

    useEffect(() => {
        const handleCallback = async () => {
            const token = searchParams.get('token');
            // Use consistent safe path
            const next = safeNextPath;

            if (!token) {
                setError('No authentication token provided. Redirecting to login...');
                setTimeout(() => {
                    window.location.href = process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL || 'http://localhost:3000';
                }, 2000);
                return;
            }

            try {
                setStatus('Authenticating...');

                // 1. Sign in with the custom token from Gateway
                const userCredential = await signInWithCustomToken(auth, token);
                const user = userCredential.user;

                console.log('[Auth Callback] Signed in user:', user.uid, user.email);
                setStatus('Resolving tenant access...');

                // 2. Resolve user's site memberships
                const sites = await getUserSites(user.uid, user.email);

                if (sites.length > 0) {
                    // 3. Set the activeSite cookie for middleware
                    const targetSite = sites[0];
                    // 3. Set the __session cookie for middleware (Required by Firebase Hosting)
                    // Ensure Secure flag is set for production
                    document.cookie = `__session=${targetSite.siteId}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax; Secure`;

                    console.log('[Auth Callback] Site resolved:', targetSite.siteId, 'Redirecting to:', next);
                    setStatus('Authentication successful!');

                    // Stop auto-redirect loop for debugging/safety
                    // Provide manual button
                } else {
                    // User has no site membership
                    setError('No site membership found. Please contact your administrator.');
                    await auth.signOut();
                }

            } catch (err: any) {
                console.error('[Auth Callback] Error:', err);
                setError(`Authentication failed: ${err.message || 'Unknown error'}`);
            }
        };

        handleCallback();
    }, [searchParams, router]);



    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full border-[3px] border-brand-dark text-center">
                {error ? (
                    <div className="text-red-600 font-bold">
                        <p className="text-4xl mb-4">⚠️</p>
                        <p>{error}</p>
                    </div>
                ) : (
                    <div className="text-brand-dark">
                        {status === 'Authentication successful!' ? (
                            <>
                                <p className="text-4xl mb-4">✅</p>
                                <p className="font-bold mb-4">Login Verified</p>
                                <button
                                    onClick={() => window.location.href = safeNextPath}
                                    className="w-full bg-brand-green text-brand-dark font-black uppercase py-3 rounded-xl border-[3px] border-brand-dark hover:scale-105 transition-transform"
                                >
                                    Enter Dashboard
                                </button>
                                <p className="mt-4 text-xs text-gray-400">
                                    Cookie Set: {typeof document !== 'undefined' && document.cookie.includes('__session') ? 'Yes' : 'No'}
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-dark border-t-transparent mx-auto mb-4"></div>
                                <p className="font-bold">{status}</p>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function AuthCallback() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-brand-dark font-bold">Loading...</div>
            </div>
        }>
            <AuthCallbackHandler />
        </Suspense>
    );
}
