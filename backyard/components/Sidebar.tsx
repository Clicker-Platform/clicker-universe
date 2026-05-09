'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { toast } from 'sonner';

interface NavItem {
    label: string;
    href: string;
}

const NAV_ITEMS: NavItem[] = [
    { label: 'Overview', href: '/' },
    { label: '—' as any, href: '' },
    { label: 'Tenants', href: '/tenants' },
    { label: 'Registrations', href: '/registrations' },
    { label: 'WhatsApp', href: '/whatsapp' },
    { label: '—' as any, href: '' },
    { label: 'Audit & Roles', href: '/access' },
    { label: '—' as any, href: '' },
    { label: 'Monitoring', href: '/monitoring' },
    { label: 'Sync Control', href: '/sync' },
    { label: 'Seed Tools', href: '/seed' },
    { label: '—' as any, href: '' },
    { label: 'Settings', href: '/settings' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [unreadCount, setUnreadCount] = useState(0);
    const [lastSeenAt, setLastSeenAt] = useState<Date>(() => {
        if (typeof window === 'undefined') return new Date(0);
        const stored = localStorage.getItem('monitoring_last_seen');
        return stored ? new Date(stored) : new Date(0);
    });

    useEffect(() => {
        const col = collection(db, 'platform_logs');
        const q = query(col, where('level', '==', 'error'), orderBy('ts', 'desc'), limit(50));
        const unsub = onSnapshot(q, (snap) => {
            const newCount = snap.docs.filter((d) => {
                const ts = d.data().ts?.toDate?.();
                return ts && ts > lastSeenAt;
            }).length;
            setUnreadCount(newCount);
        }, (err) => {
            if (err.code === 'failed-precondition') return;
        });
        return unsub;
    }, [lastSeenAt]);

    const handleMonitoringClick = () => {
        const now = new Date();
        localStorage.setItem('monitoring_last_seen', now.toISOString());
        setLastSeenAt(now);
        setUnreadCount(0);
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            toast.success('Logged Out Successfully');
            router.push('/');
        } catch (error: any) {
            console.error('[backyard] logout.failed', { error: error instanceof Error ? error.message : String(error) });
            toast.error('Logout Failed', { description: error.message });
        }
    };

    return (
        <aside className="w-64 bg-brand-dark fixed inset-y-0 flex flex-col z-50">
            {/* Header */}
            <div className="h-20 flex items-center px-6 border-b border-white/5">
                <div className="flex flex-col gap-1">
                    <span className="font-black text-white tracking-tight text-lg">Backyard</span>
                    <span className="text-[10px] font-black uppercase tracking-widest bg-brand-green text-brand-dark px-2 py-0.5 rounded-full w-fit">God Mode</span>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 py-3 overflow-y-auto">
                {NAV_ITEMS.map((item, i) => {
                    if (item.label === '—') {
                        return <div key={i} className="h-px bg-white/5 mx-4 my-1.5" />;
                    }
                    const isActive = item.href === '/'
                        ? pathname === '/'
                        : pathname.startsWith(item.href);
                    const isMonitoring = item.href === '/monitoring';

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={isMonitoring ? handleMonitoringClick : undefined}
                            className={`flex items-center justify-between px-6 py-2.5 text-sm font-semibold transition-all border-l-[3px] ${
                                isActive
                                    ? 'border-brand-green bg-brand-green/10 text-brand-green font-black'
                                    : 'border-transparent text-white/50 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <span>{item.label}</span>
                            {isMonitoring && unreadCount > 0 && (
                                <span className="bg-red-500 text-white text-[10px] font-black rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-white/5">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-3 text-red-300 hover:bg-red-500/10 hover:text-red-200 rounded-lg transition-colors font-semibold text-sm"
                >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
