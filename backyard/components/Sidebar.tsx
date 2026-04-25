
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, Store, Settings, LogOut, ShieldAlert } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { toast } from 'sonner';

const menuItems = [
    { name: 'Overview', icon: LayoutDashboard, href: '/' },
    { name: 'Tenants', icon: Store, href: '/tenants' },
    { name: 'Users', icon: Users, href: '/users' },
    { name: 'Monitoring', icon: ShieldAlert, href: '/monitoring' },
    { name: 'Settings', icon: Settings, href: '/settings' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const [unreadCount, setUnreadCount] = useState(0);
    const [lastSeenAt] = useState<Date>(() => {
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
            if (err.code === 'failed-precondition') return; // index still building
            console.error('[Sidebar] platform_logs snapshot error:', err.message);
        });
        return unsub;
    }, [lastSeenAt]);

    const handleMonitoringClick = () => {
        localStorage.setItem('monitoring_last_seen', new Date().toISOString());
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
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand-dark rounded-lg flex items-center justify-center">
                        <span className="text-brand-green font-bold text-lg">C</span>
                    </div>
                    <span className="font-bold text-brand-dark tracking-tight text-lg">Backyard</span>
                </div>
            </div>

            {/* Menu */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={item.href === '/monitoring' ? handleMonitoringClick : undefined}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all font-medium text-sm border border-transparent
                                ${isActive
                                    ? 'bg-brand-green/10 text-brand-dark border-brand-dark/10'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                        >
                            <item.icon className={`w-5 h-5 ${isActive ? 'text-brand-dark' : 'text-slate-400'}`} />
                            <span className="flex-1">{item.name}</span>
                            {item.href === '/monitoring' && unreadCount > 0 && (
                                <span className="bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium text-sm"
                >
                    <LogOut className="w-5 h-5" />
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
