'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { findMemberByAuthId, findMemberByEmail, updateMemberAuth } from '../../api';
import { Member } from '../../types';
import MemberIdCard from './MemberIdCard';
import MemberHistoryList from './MemberHistoryList';
import { findWidgetsForLocation } from '@/lib/modules/registry';
import { CLIENT_MODULE_COMPONENTS } from '@/lib/modules/client-registry';
import { Loader2, LogOut } from 'lucide-react';

import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger';

export default function MemberDashboard() {
    const { siteId } = useSite();
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [member, setMember] = useState<Member | null>(null);
    const [widgets, setWidgets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [authChecking, setAuthChecking] = useState(true);

    // 1. Monitor Auth State
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
            setUser(currentUser);
            setAuthChecking(false);

            if (currentUser && siteId) {
                await loadMember(currentUser, siteId);
            } else if (!currentUser) {
                setLoading(false);
                router.replace('/member/login');
            }
        });
        return () => unsubscribe();
    }, [siteId]);

    // 2. Fetch Member Data
    const loadMember = async (authUser: User, currentSiteId: string) => {
        try {
            // A. Try finding by Linked UID
            let foundMember = await findMemberByAuthId(currentSiteId, authUser.uid);

            // B. If not found, try finding by Email and Link
            if (!foundMember && authUser.email) {
                foundMember = await findMemberByEmail(currentSiteId, authUser.email);
                if (foundMember) {
                    // Link it!
                    await updateMemberAuth(currentSiteId, foundMember.id, authUser.uid, authUser.email);
                }
            }

            setMember(foundMember);

            // C. Load Widgets
            const foundWidgets = await findWidgetsForLocation('member_dashboard');
            setWidgets(foundWidgets);

        } catch (error) {
            logger.error('membership.load.failed', { siteId, error });
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await auth.signOut();
        router.replace('/member/login');
    };

    if (authChecking || loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <Loader2 className="animate-spin text-indigo-600 mb-2" />
                <p className="text-gray-500 text-sm">Loading your dashboard...</p>
            </div>
        );
    }

    if (!user) return null; // Should redirect

    if (!member) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
                <h2 className="text-xl font-bold text-gray-800 mb-2">Membership Not Found</h2>
                <p className="text-gray-600 mb-6 max-w-xs mx-auto">
                    We couldn't find a membership linked to <strong>{user.email}</strong>.
                </p>
                <div className="space-y-3 w-full max-w-xs">
                    <button className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg opacity-50 cursor-not-allowed">
                        Create New Membership (Coming Soon)
                    </button>
                    <button onClick={handleLogout} className="w-full text-indigo-600 font-medium py-3 rounded-lg hover:bg-gray-100">
                        Sign Out
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-50 min-h-full pb-20 relative">
            {/* Header / ID Card */}
            <MemberIdCard member={member} />

            {/* Content Area */}
            <div className="p-6 space-y-8">

                {/* Dynamic Widgets Area */}
                <div className="space-y-6">
                    {widgets.map((w, idx) => {
                        const WidgetComponent = CLIENT_MODULE_COMPONENTS[w.componentKey];
                        if (!WidgetComponent) return null;

                        return (
                            <div key={idx}>
                                <WidgetComponent memberPhone={member.phoneNumber} memberId={member.id} />
                            </div>
                        );
                    })}
                </div>

                {/* History Section */}
                <div>
                    <MemberHistoryList memberId={member.id} />
                </div>

                {/* Logout Hook */}
                <div className="text-center pt-8">
                    <button onClick={handleLogout} className="flex items-center justify-center gap-2 text-gray-400 hover:text-red-500 text-sm mx-auto transition">
                        <LogOut size={16} /> Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}
