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

    useEffect(() => {
        const handleCallback = async () => {
            const token = searchParams.get('token');
            const next = searchParams.get('next') || '/admin';

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
                    document.cookie = `activeSite=${targetSite.siteId}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;

                    console.log('[Auth Callback] Site resolved:', targetSite.siteId, 'Redirecting to:', next);
                    setStatus('Success! Redirecting...');

                    // 4. Redirect to the intended destination (hard redirect to re-run middleware)
                    window.location.href = next;
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
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-dark border-t-transparent mx-auto mb-4"></div>
                        <p className="font-bold">{status}</p>
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
