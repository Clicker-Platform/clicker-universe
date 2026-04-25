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
    isNew?: boolean;
}

const NAV_ITEMS: NavItem[] = [
    { label: 'Overview', href: '/' },
    { label: '—' as any, href: '' },
    { label: 'Tenants & Users', href: '/tenants' },
    { label: '—' as any, href: '' },
    { label: 'Claims & Roles', href: '/claims', isNew: true },
    { label: 'RBAC Settings', href: '/rbac', isNew: true },
    { label: '—' as any, href: '' },
    { label: 'Monitoring', href: '/monitoring' },
    { label: 'Sync Control', href: '/sync', isNew: true },
    { label: 'Seed Tools', href: '/seed', isNew: true },
    { label: '—' as any, href: '' },
    { label: 'WhatsApp', href: '/whatsapp', isNew: true },
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
        <aside className="w-64 bg-white border-r border-gray-200 fixed inset-y-0 flex flex-col z-50">
            {/* Header */}
            <div className="h-20 flex items-center px-6 border-b border-slate-200">
                <div className="flex flex-col gap-1">
                    <span className="font-black text-brand-dark tracking-tight text-lg">Backyard</span>
                    <span className="text-[10px] font-black uppercase tracking-widest bg-brand-green text-brand-dark px-2 py-0.5 rounded-full w-fit">God Mode</span>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 py-3 overflow-y-auto">
                {NAV_ITEMS.map((item, i) => {
                    if (item.label === '—') {
                        return <div key={i} className="h-px bg-gray-100 mx-4 my-1.5" />;
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
                                    ? 'border-brand-green bg-brand-green/5 text-brand-dark font-black'
                                    : 'border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            <span>{item.label}</span>
                            <span className="flex items-center gap-1.5">
                                {isMonitoring && unreadCount > 0 && (
                                    <span className="bg-red-500 text-white text-[10px] font-black rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                                {item.isNew && !isActive && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-brand-green" />
                                )}
                            </span>
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors font-semibold text-sm"
                >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
