'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { clearSessionCookies } from '@/lib/session';

export default function LogoutPage() {
    const router = useRouter();

    useEffect(() => {
        const performLogout = async () => {
            try {
                // Sign out of Firebase Auth on this domain
                await signOut(auth);

                clearSessionCookies();

                localStorage.removeItem('__auth_session');
                localStorage.removeItem('__tenant_cache');

                // Redirect to login page
                // We restart the flow, so 'page.tsx' will show the login form since auth is null
                router.push('/');
            } catch (error) {
                console.error('Logout error:', error);
                // Fallback direct reload
                window.location.href = '/';
            }
        };

        performLogout();
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-dark border-t-transparent mb-4"></div>
                <p className="text-brand-dark font-bold animate-pulse">Logging out securely...</p>
            </div>
        </div>
    );
}
