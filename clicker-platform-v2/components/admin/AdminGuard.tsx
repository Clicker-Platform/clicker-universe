'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
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
        if (!siteId) return; // Wait for site context

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (!currentUser) {
                // Not logged in, redirect to Auth Gateway
                const gatewayUrl = process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL || 'http://localhost:3000';
                const returnPath = pathname || '/admin';
                window.location.href = `${gatewayUrl}?redirect=${encodeURIComponent(returnPath)}`;
                setLoading(false);
            } else {
                setUser(currentUser);

                // Verify RBAC for this Site
                try {
                    // Check if super admin (platform owner) - Optional/TODO
                    // For now, strict site check

                    // 1. Try to find user in members subcollection
                    const userDocRef = doc(db, 'sites', siteId, 'members', currentUser.uid);
                    const userSnap = await getDoc(userDocRef);

                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        setRole(userData.role as Role);
                        setUnauthorized(false);
                    } else {
                        // 2. If not found, check if user is the Owner of the site (via site metadata)
                        const siteDocRef = doc(db, 'sites', siteId);
                        const siteSnap = await getDoc(siteDocRef);

                        if (siteSnap.exists()) {
                            const siteData = siteSnap.data();
                            // Check ownerId OR ownerEmail (legacy seed data support)
                            const isOwner = siteData.ownerId === currentUser.uid || siteData.ownerEmail === currentUser.email;

                            if (isOwner) {
                                setRole('owner'); // Implicit owner role
                                setUnauthorized(false);
                            } else {
                                console.warn(`User ${currentUser.uid} is not a member or owner of site ${siteId}. Checking for pending access...`);

                                // Auto-Join Check
                                try {
                                    const res = await fetch('/api/auth/check-access', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            uid: currentUser.uid,
                                            email: currentUser.email,
                                            siteId: siteId
                                        })
                                    });
                                    const data = await res.json();

                                    if (data.status === 'joined') {
                                        console.log("Access granted automatically! Refreshing state...");
                                        // Quick refresh
                                        const newMemberSnap = await getDoc(userDocRef);
                                        if (newMemberSnap.exists()) {
                                            const newData = newMemberSnap.data();
                                            setRole(newData.role as Role);
                                            setUnauthorized(false);
                                            return; // Exit here, state updated
                                        }
                                    } else {
                                        console.warn("No pending access found.");
                                    }
                                } catch (accessError) {
                                    console.error("Error checking access:", accessError);
                                }

                                setUnauthorized(true);
                            }
                        } else {
                            console.warn(`Site ${siteId} not found`);
                            setUnauthorized(true);
                        }
                    }
                } catch (error) {
                    console.error("RBAC Check Failed:", error);
                    setUnauthorized(true);
                } finally {
                    setLoading(false);
                }
            }
        });

        return () => unsubscribe();
    }, [router, pathname, siteId]);

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
                            // Clear activeSite cookie
                            document.cookie = 'activeSite=; path=/; max-age=0';
                            auth.signOut();
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
