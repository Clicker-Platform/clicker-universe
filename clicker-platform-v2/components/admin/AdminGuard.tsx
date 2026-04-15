'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';
import { useUser } from '@/lib/user-context';
import { ShieldAlert } from 'lucide-react';

// AdminGuard reads from UserProvider (mounted above it in the layout).
// No duplicate Firebase/Firestore calls here — UserProvider owns auth state.
export default function AdminGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { siteId } = useSite();
    const { user, role, loading } = useUser();
    // Track whether the user was ever authenticated in this session.
    // Prevents the guard from racing with an intentional sign-out redirect.
    const wasAuthenticated = useRef(false);

    useEffect(() => {
        if (user) wasAuthenticated.current = true;
    }, [user]);

    useEffect(() => {
        if (loading) return;
        if (!user) {
            // If user was never authenticated this session, they arrived without
            // a session — redirect to login. If they were authenticated and then
            // became null, they signed out deliberately; let the sign-out handler
            // manage the redirect so we don't race and send them back to login.
            if (wasAuthenticated.current) return;

            const gatewayUrl = process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL;
            if (!gatewayUrl) {
                console.error('[AdminGuard] NEXT_PUBLIC_AUTH_GATEWAY_URL is not defined');
                return;
            }
            window.location.href = `${gatewayUrl}?redirect=${encodeURIComponent(pathname || '/admin')}`;
        }
    }, [loading, user, pathname]);

    // Missing tenant context
    if (!loading && (siteId === 'default' || siteId === 'pending')) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 p-6">
                <div className="max-w-md w-full bg-white dark:bg-neutral-900 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-neutral-800 text-center">
                    <ShieldAlert className="w-16 h-16 text-brand-orange mx-auto mb-6" />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mb-2">Missing Tenant Context</h2>
                    <p className="text-gray-500 dark:text-neutral-400 mb-8">
                        The application could not determine which site you are trying to access.
                        This usually happens if you access <code>/admin</code> directly.
                    </p>
                    <div className="flex flex-col gap-3">
                        <a href="/demo/admin" className="px-6 py-3 bg-brand-dark dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-xl font-bold hover:bg-black dark:hover:bg-white transition-colors">
                            Go to Demo Store
                        </a>
                        <p className="text-xs text-gray-400 dark:text-neutral-500 mt-2">
                            Current Site ID: {siteId}<br />
                            User: {user?.email}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Show skeleton shell while auth resolves — no jarring full-screen spinner
    if (loading) {
        return (
            <div className="admin-layout min-h-screen flex flex-col md:flex-row bg-gray-100 dark:bg-neutral-950 animate-pulse">
                {/* Sidebar skeleton */}
                <div className="hidden md:flex flex-col w-64 min-h-screen bg-white dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-800 p-4 gap-4 shrink-0">
                    {/* Logo */}
                    <div className="h-10 w-32 bg-gray-200 dark:bg-neutral-800 rounded-lg mb-4" />
                    {/* Nav items */}
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-9 w-full bg-gray-100 dark:bg-neutral-800 rounded-lg" />
                    ))}
                </div>
                {/* Mobile top bar skeleton */}
                <div className="flex md:hidden h-14 w-full bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 px-4 items-center gap-3 shrink-0">
                    <div className="h-8 w-8 bg-gray-200 dark:bg-neutral-800 rounded-lg" />
                    <div className="h-6 w-32 bg-gray-200 dark:bg-neutral-800 rounded-lg" />
                </div>
                {/* Main content skeleton */}
                <main className="flex-1 p-4 md:p-8 flex flex-col gap-6">
                    <div className="h-8 w-48 bg-gray-200 dark:bg-neutral-800 rounded-lg" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-28 bg-white dark:bg-neutral-900 rounded-2xl" />
                        ))}
                    </div>
                    <div className="h-64 bg-white dark:bg-neutral-900 rounded-2xl" />
                </main>
            </div>
        );
    }

    // Unauthorized — user is logged in but has no role for this site
    if (!loading && user && !role) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-neutral-950 p-4">
                <div className="bg-white dark:bg-neutral-900 p-8 rounded-2xl shadow-xl max-w-md text-center border-2 border-red-100 dark:border-red-900/30">
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full">
                            <ShieldAlert size={48} className="text-red-500 dark:text-red-400" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-black text-gray-800 dark:text-neutral-100 mb-2">Access Denied</h1>
                    <p className="text-gray-500 dark:text-neutral-400 mb-6 font-medium">
                        You do not have permission to access the admin dashboard for
                        <span className="block mt-1 font-bold text-brand-dark dark:text-neutral-200 uppercase tracking-wide">{siteId}</span>
                    </p>
                    <button
                        onClick={() => {
                            document.cookie = '__session=; path=/; max-age=0';
                            auth.signOut().then(() => {
                                const gatewayUrl = process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL;
                                if (gatewayUrl) {
                                    window.location.href = `${gatewayUrl}/logout`;
                                } else {
                                    router.push('/login');
                                }
                            });
                        }}
                        className="w-full py-3 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-700 dark:text-neutral-200 font-bold rounded-xl transition-colors"
                    >
                        Sign Out
                    </button>
                    <div className="mt-4 text-xs text-gray-400 dark:text-neutral-500">
                        UID: {user?.uid}
                    </div>
                </div>
            </div>
        );
    }

    if (!user) return null; // redirect in flight

    return <>{children}</>;
}
