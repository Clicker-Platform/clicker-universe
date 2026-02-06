'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Role } from '@/lib/rbac';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<Role | null>(null);
    const [loading, setLoading] = useState(true);
    const [unauthorized, setUnauthorized] = useState(false);

    const router = useRouter();
    const pathname = usePathname();
    const { siteId } = useSite();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            // 1. AUTHENTICATION CHECK
            if (!currentUser) {
                const gatewayUrl = process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL || 'http://localhost:3000';
                window.location.href = `${gatewayUrl}?redirect=${encodeURIComponent(pathname || '/admin')}`;
                setLoading(false);
                return;
            }
            setUser(currentUser);

            // 2. SITE CONTEXT CHECK
            if (!siteId || siteId === 'default' || siteId === 'pending') {
                console.warn('[AdminGuard] Invalid Site ID. Render "Missing Context" screen.');
                setUnauthorized(true);
                setLoading(false);
                return;
            }

            // 3. AUTHORIZATION (RBAC) CHECK
            try {
                // Check Membership first (Optimized for most users)
                const userDocRef = doc(db, 'sites', siteId, 'members', currentUser.uid);
                const userSnap = await getDoc(userDocRef);

                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    setRole(userData.role as Role);
                    setUnauthorized(false);
                } else {
                    // Check Ownership (Fallback for Owners not in members list yet)
                    const siteDocRef = doc(db, 'sites', siteId);
                    const siteSnap = await getDoc(siteDocRef);

                    if (siteSnap.exists()) {
                        const siteData = siteSnap.data();
                        const isOwner = siteData.ownerId === currentUser.uid ||
                            siteData.ownerEmail === currentUser.email;

                        if (isOwner) {
                            setRole('owner');
                            setUnauthorized(false);
                        } else {
                            // 4. AUTO-JOIN / PENDING LOGIC (Wait for API?)
                            console.warn(`User ${currentUser.email} is not authorized for site ${siteId}`);
                            setUnauthorized(true);
                        }
                    } else {
                        console.error('Site document not found:', siteId);
                        setUnauthorized(true);
                    }
                }
            } catch (error) {
                console.error("AdminGuard Permission Check Error:", error);
                setUnauthorized(true);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [router, pathname, siteId]);

    // Specific Error for Default Site
    if ((siteId === 'default' || siteId === 'pending') && !loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
                <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-gray-100 text-center">
                    <ShieldAlert className="w-16 h-16 text-brand-orange mx-auto mb-6" />
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Missing Tenant Context</h2>
                    <p className="text-gray-500 mb-8">
                        The application could not determine which site you are trying to access.
                        This usually happens if you access <code>/admin</code> directly.
                    </p>

                    <div className="flex flex-col gap-3">
                        <a href="/quattro/admin" className="px-6 py-3 bg-brand-dark text-white rounded-xl font-bold hover:bg-black transition-colors">
                            Go to Demo Store (Quattro)
                        </a>
                        <p className="text-xs text-gray-400 mt-2">
                            Current Site ID: {siteId}<br />
                            User: {user?.email}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 size={48} className="text-brand-dark animate-spin" />
                    <p className="text-brand-dark font-bold animate-pulse">Verifying Access...</p>
                </div>
            </div>
        );
    }

    if (unauthorized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center border-2 border-red-100">
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-red-50 rounded-full">
                            <ShieldAlert size={48} className="text-red-500" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-black text-gray-800 mb-2">Access Denied</h1>
                    <p className="text-gray-500 mb-6 font-medium">
                        You do not have permission to access the admin dashboard for
                        <span className="block mt-1 font-bold text-brand-dark uppercase tracking-wide">{siteId}</span>
                    </p>
                    <button
                        onClick={() => {
                            // Clear __session cookie
                            document.cookie = '__session=; path=/; max-age=0';
                            auth.signOut().then(() => {
                                const gatewayUrl = process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL || 'https://clicker-auth-gateway.web.app';
                                window.location.href = `${gatewayUrl}/logout`;
                            });
                        }}
                        className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                    >
                        Sign Out
                    </button>
                    <div className="mt-4 text-xs text-gray-400">
                        UID: {user?.uid}
                    </div>
                </div>
            </div>
        );
    }

    if (!user) {
        return null; // Will redirect
    }

    return <>{children}</>;
}
