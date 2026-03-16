'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { getUserSites } from '@/lib/admin-auth';

/**
 * Decode a JWT payload without verification (client-side only).
 * Used to read custom token claims (siteId) before signing in.
 */
function decodeJwtPayload(token: string): any {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        // Handle base64url encoding
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(base64));
        return payload;
    } catch {
        return null;
    }
}

function AuthCallbackHandler() {
    const [status, setStatus] = useState('Processing login...');
    const [error, setError] = useState('');
    const router = useRouter();
    const searchParams = useSearchParams();
    const processedRef = useRef(false);

    const rawNext = searchParams.get('next');
    // Safety Force: If next is '/' or empty, force it to '/admin'
    const safeNextPath = (rawNext && rawNext !== '/') ? rawNext : '/admin';

    useEffect(() => {
        const handleCallback = async () => {
            // Get token from URL params
            const token = searchParams.get('token');

            // If we have already processed a token, stop.
            if (processedRef.current) return;

            // If no token found, show error
            if (!token) {
                if (!processedRef.current) {
                    setError('No authentication token provided. Redirecting to login...');
                    setTimeout(() => {
                        window.location.href = process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL || 'https://auth.clicker.id';
                    }, 2000);
                }
                return;
            }

            // --- TOKEN FOUND ---

            // 1. Mark as processed immediately to lock other executions
            processedRef.current = true;

            const baseDomain = 'clicker.id';
            const isProduction = window.location.hostname.includes(baseDomain);

            // ============================================================
            // CROSS-ORIGIN RELAY: Firebase Auth IndexedDB is per-origin.
            // If we sign in at clicker.id, AdminGuard at hi-clicker.clicker.id
            // won't see the auth state. We must sign in at the TARGET origin.
            //
            // Strategy:
            // 1. Decode JWT to get siteId from custom claims
            // 2. If current origin != target origin, relay token there
            // 3. Only signInWithCustomToken at the correct origin
            // ============================================================
            if (isProduction) {
                const jwtPayload = decodeJwtPayload(token);
                const siteId = jwtPayload?.claims?.siteId;

                if (siteId) {
                    const targetHost = `${siteId}.${baseDomain}`;
                    const currentHost = window.location.hostname;

                    if (currentHost !== targetHost) {
                        // We're at the wrong origin (e.g., clicker.id).
                        // Relay the token to the target origin's callback.
                        // console.log(`[Auth Callback] Relaying token from ${currentHost} → ${targetHost}`);
                        setStatus('Redirecting to tenant...');

                        // Build relay URL with all params
                        const relayUrl = `https://${targetHost}/admin/auth/callback?token=${encodeURIComponent(token)}&next=${encodeURIComponent(safeNextPath)}`;
                        window.location.href = relayUrl;
                        return;
                    }
                }
            }

            // 2. Immediately clean URL for aesthetics and security
            if (typeof window !== 'undefined') {
                const newPath = window.location.pathname;
                window.history.replaceState(null, '', newPath);
            }

            try {
                setStatus('Authenticating...');

                // 3. Sign in with the custom token (now at the correct origin!)
                const userCredential = await signInWithCustomToken(auth, token);
                const user = userCredential.user;

                console.log('[Auth Callback] Signed in user:', user.uid, user.email);
                setStatus('Resolving tenant access...');

                // 4. Resolve user's site memberships (with timeout protection)
                console.log('[Auth Callback] Starting getUserSites...');
                let sites: any[] = [];
                try {
                    const sitesPromise = getUserSites(user.uid, user.email);
                    const timeoutPromise = new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('getUserSites timeout after 5s')), 5000)
                    );
                    sites = await Promise.race([sitesPromise, timeoutPromise]);
                } catch (siteErr: any) {
                    console.warn('[Auth Callback] getUserSites failed/timeout:', siteErr.message);
                    // Fallback: use siteId from custom token claims
                    const claims = (await user.getIdTokenResult()).claims;
                    if (claims.siteId) {
                        console.log('[Auth Callback] Using siteId from token claims:', claims.siteId);
                        sites = [{ siteId: claims.siteId as string, slug: claims.siteId as string, role: (claims.role as string) || 'owner', name: 'My Site' }];
                    }
                }
                console.log('[Auth Callback] Sites resolved:', JSON.stringify(sites));

                if (sites.length > 0) {
                    // 5. Set cookies with Wildcard Domain for Multi-tenant access
                    const targetSite = sites[0];

                    const domainAttribute = isProduction ? `; Domain=.${baseDomain}` : '';
                    const secureAttribute = isProduction ? '; Secure' : '';

                    const cookieValue = `__session=${targetSite.siteId}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax${secureAttribute}${domainAttribute}`;
                    document.cookie = cookieValue;

                    console.log('[Auth Callback] Cookie set:', cookieValue);
                    console.log('[Auth Callback] Site resolved:', targetSite.siteId);
                    setStatus('Verifikasi Berhasil! Mengalihkan...');

                    // 6. Redirect to dashboard (we're already at the correct origin!)
                    const finalRedirectUrl = `${window.location.origin}${safeNextPath}`;
                    console.log('[Auth Callback] Redirecting to:', finalRedirectUrl);

                    window.location.href = finalRedirectUrl;

                    // Fallback redirect
                    setTimeout(() => {
                        window.location.href = finalRedirectUrl;
                    }, 1500);

                } else {
                    setError('Tidak ditemukan keanggotaan situs. Hubungi administrator.');
                    await auth.signOut();
                    // Clear __session cookie to prevent middleware redirect loop
                    document.cookie = `__session=; path=/; max-age=0; SameSite=Lax${isProduction ? '; Secure' : ''}`;
                    if (isProduction) {
                        document.cookie = `__session=; path=/; max-age=0; Domain=.${baseDomain}; SameSite=Lax; Secure`;
                    }
                }

            } catch (err: any) {
                console.error('[Auth Callback] Error:', err);
                setError(`Gagal Masuk: ${err.message || 'Unknown error'}`);
                // Clear stale cookies to prevent loops on retry
                try { await auth.signOut(); } catch { }
                document.cookie = `__session=; path=/; max-age=0; SameSite=Lax${isProduction ? '; Secure' : ''}`;
                if (isProduction) {
                    document.cookie = `__session=; path=/; max-age=0; Domain=.${baseDomain}; SameSite=Lax; Secure`;
                }
            }
        };

        handleCallback();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run ONCE on mount only — avoid re-runs from URL changes



    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full border border-gray-200 text-center">
                {error ? (
                    <div className="text-red-600 font-bold">
                        <p className="text-4xl mb-4">⚠️</p>
                        <p className="mb-4">{error}</p>
                        <button
                            onClick={() => {
                                auth.signOut().then(() => {
                                    const isProd = window.location.hostname.includes('clicker.id');
                                    document.cookie = `__session=; path=/; max-age=0; SameSite=Lax${isProd ? '; Secure' : ''}`;
                                    if (isProd) {
                                        document.cookie = '__session=; path=/; max-age=0; Domain=.clicker.id; SameSite=Lax; Secure';
                                    }
                                    const gw = process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL || 'https://auth.clicker.id';
                                    window.location.href = `${gw}?error=no_membership`;
                                }).catch(() => {
                                    const gw = process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL || 'https://auth.clicker.id';
                                    window.location.href = `${gw}?error=no_membership`;
                                });
                            }}
                            className="mt-2 w-full bg-gray-800 text-white font-bold py-3 rounded-xl hover:bg-gray-700 transition-colors text-sm"
                        >
                            🔄 Login Dengan Akun Lain
                        </button>
                    </div>
                ) : (
                    <div className="text-brand-dark">
                        {status.includes('Berhasil') ? (
                            <>
                                <p className="text-4xl mb-4">✅</p>
                                <p className="font-bold mb-4">{status}</p>
                                <button
                                    onClick={() => window.location.href = `${window.location.origin}${safeNextPath}`}
                                    className="w-full bg-brand-green text-brand-dark font-black uppercase py-3 rounded-xl border border-gray-200 hover:scale-105 transition-transform"
                                >
                                    Buka Dashboard
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-transparent mx-auto mb-4"></div>
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
