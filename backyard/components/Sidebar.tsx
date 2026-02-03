
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, Store, Settings, LogOut, ShieldAlert } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { toast } from 'sonner';

const menuItems = [
    { name: 'Overview', icon: LayoutDashboard, href: '/' },
    { name: 'Tenants', icon: Store, href: '/tenants' },
    { name: 'Identities', icon: Users, href: '/users' },
    { name: 'Monitoring', icon: ShieldAlert, href: '/monitoring' },
    { name: 'Settings', icon: Settings, href: '/settings' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            toast.success('Logged Out Successfully');
            router.push('/');
        } catch (error: any) {
            console.error('Logout failed', error);
            toast.error('Logout Failed', { description: error.message });
        }
    };

    return (
        <aside className="w-64 bg-white border-r border-gray-200 fixed inset-y-0 flex flex-col z-50">
            {/* Header */}
            <div className="h-20 flex items-center px-6 border-b border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-200">
                        <span className="text-white font-bold text-lg">B</span>
                    </div>
                    <span className="font-bold text-slate-800 tracking-tight text-lg">Backyard</span>
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
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all font-medium text-sm border border-transparent
                                ${isActive
                                    ? 'bg-blue-50 text-blue-700 border-blue-100'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                        >
                            <item.icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium text-sm"
                >
                    <LogOut className="w-5 h-5" />
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
