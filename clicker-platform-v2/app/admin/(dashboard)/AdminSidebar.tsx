'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LayoutDashboard, LogOut, Menu, X, Palette, Inbox, Box, Users, Sun, Moon, PanelLeftClose, PanelLeftOpen, User, Fingerprint, Building2, ChevronUp, Layers } from 'lucide-react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { subscribeToEnabledModules, MODULE_ICONS, getRouteIdFromPath } from '@/lib/modules/registry';
import { STATIC_MODULE_DEFINITIONS } from '@/lib/modules/definitions';
import { ModuleDefinition } from '@/lib/modules/types';
import { useSite } from '@/lib/site-context';
import { useUser } from '@/lib/user-context';
import { useAdminTheme } from '@/lib/use-admin-theme';
import { InboxSlideOver } from '@/components/admin/InboxSlideOver';

interface NavItem {
    icon: any;
    label: string;
    href: string;
}

interface SidebarGroup {
    title: string;
    items: NavItem[];
}

export function AdminSidebar() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [newBookingCount, setNewBookingCount] = useState(0);
    const [modules, setModules] = useState<ModuleDefinition[]>([]);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [hoveredItem, setHoveredItem] = useState<{ label: string, top: number } | null>(null);
    const [logoHovered, setLogoHovered] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [inboxOpen, setInboxOpen] = useState(false);
    const settingsRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();
    const router = useRouter();
    const { siteId, tenantSlug, isSubdomain } = useSite();

    const handleLogout = async () => {
        try {
            document.cookie = '__session=; path=/; max-age=0';
            await signOut(auth);
            const gatewayUrl = process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL;
            if (gatewayUrl) {
                window.location.href = `${gatewayUrl}/logout`;
            } else {
                router.push('/login');
            }
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    useEffect(() => {
        const savedCollapsed = localStorage.getItem('sidebar_collapsed');
        if (savedCollapsed !== null) {
            setIsCollapsed(JSON.parse(savedCollapsed));
        }
    }, []);

    const toggleSidebarCollapse = () => {
        const newValue = !isCollapsed;
        setIsCollapsed(newValue);
        localStorage.setItem('sidebar_collapsed', JSON.stringify(newValue));
    };

    const { permissions: userPermissions, isOwner, hasAccess } = useUser();
    const { isDark, toggle: toggleDark } = useAdminTheme();
    const [siteEnabledModules, setSiteEnabledModules] = useState<Record<string, boolean>>({});

    useEffect(() => {
        let unsubscribeSite: (() => void) | null = null;
        let unsubscribeSnapshot: (() => void) | null = null;
        let unsubscribeBookingSnapshot: (() => void) | null = null;

        if (!siteId || siteId === 'default' || siteId === 'pending') return;

        try {
            unsubscribeSite = onSnapshot(doc(db, 'sites', siteId), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const legacy = data.settings?.modules || {};
                    const root = data.modules || {};
                    setSiteEnabledModules({ ...legacy, ...root });
                }
            });
        } catch (e) {
            console.error("Error fetching site modules", e);
        }

        const unsubscribeAuth = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
            }
            if (unsubscribeBookingSnapshot) {
                unsubscribeBookingSnapshot();
                unsubscribeBookingSnapshot = null;
            }

            if (user) {
                try {
                    const q = query(collection(db, 'sites', siteId, 'inbox'), where('status', '==', 'new'));
                    unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
                        setUnreadCount(snapshot.size);
                    }, (error) => {
                        console.error("Inbox listener error:", error);
                    });

                    const qBookings = query(collection(db, 'sites', siteId, 'modules/reservation/bookings'), where('status', '==', 'pending'));
                    unsubscribeBookingSnapshot = onSnapshot(qBookings, (snapshot) => {
                        setNewBookingCount(snapshot.size);
                    }, (error) => {
                        console.error("Bookings listener error:", error);
                    });
                } catch (e) {
                    console.error("Error setting up listeners:", e);
                }
            } else {
                setUnreadCount(0);
                setNewBookingCount(0);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeSnapshot) unsubscribeSnapshot();
            if (unsubscribeBookingSnapshot) unsubscribeBookingSnapshot();
            if (unsubscribeSite) unsubscribeSite();
        };
    }, [siteId]);

    useEffect(() => {
        const unsubscribe = subscribeToEnabledModules((fetchedModules) => {
            setModules(fetchedModules);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!settingsOpen) return;
        const handler = (e: MouseEvent) => {
            if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
                setSettingsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [settingsOpen]);

    const groupedNavItems = useMemo(() => {
        const baseUrl = (tenantSlug && !isSubdomain) ? `/${tenantSlug}` : '';

        const allCoreItems = [
            { icon: LayoutDashboard, label: 'Overview', href: `${baseUrl}/admin`, permission: null },
            { icon: Inbox, label: 'Inbox', href: `${baseUrl}/admin/inbox`, permission: 'biolink' },
            { icon: Box, label: 'Canvas Studio', href: `${baseUrl}/admin/canvas`, permission: 'biolink' },
            { icon: Palette, label: 'Template', href: `${baseUrl}/admin/template`, permission: 'biolink' },
            { icon: Layers, label: 'Services', href: `${baseUrl}/admin/services`, permission: null },
        ];

        const hasFullAccess = isOwner || userPermissions.includes('*');

        const coreItems = allCoreItems.filter(item => {
            if (hasFullAccess) return true;
            if (item.permission === null) return true;
            return userPermissions.includes(item.permission) || userPermissions.includes('biolink');
        });

        const moduleGroups: SidebarGroup[] = modules.map(m => {
            if (!siteEnabledModules[m.id]) return null;
            const staticDef = STATIC_MODULE_DEFINITIONS[m.id];
            const routes = staticDef?.adminRoutes || m.adminRoutes || [];

            const items = routes
                .filter(r => !r.hidden)
                .filter(r => {
                    if (r.permission) {
                        if (hasFullAccess) return true;
                        return userPermissions.includes(r.permission as any);
                    }
                    const routeId = getRouteIdFromPath(m.id, r.path);
                    return hasAccess(m.id, routeId);
                })
                .map(route => ({
                    icon: MODULE_ICONS[route.icon || ''] || MODULE_ICONS[m.icon] || Box,
                    label: route.label,
                    href: `${baseUrl}${route.path}`
                }));

            if (items.length === 0) return null;

            let groupTitle = m.displayName || m.id;
            if (groupTitle === 'Self Order' || groupTitle === 'BYOD POS') groupTitle = 'POS';

            return { title: groupTitle, items };
        }).filter(Boolean) as SidebarGroup[];

        const groupsDef = [
            {
                title: 'Customer Engagement',
                match: (item: NavItem) => ['Inbox'].includes(item.label)
            },
            {
                title: 'Workspace',
                match: (item: NavItem) => ['Overview', 'Template'].includes(item.label)
            },
            {
                title: 'Site & Content',
                match: (item: NavItem) => ['Canvas Studio', 'Services'].includes(item.label)
            },
        ];

        const groups: SidebarGroup[] = groupsDef.map(g => ({
            title: g.title,
            items: coreItems.filter(item => g.match(item))
        }));

        groups.push(...moduleGroups);
        return groups.filter(g => g.items.length > 0);
    }, [modules, siteEnabledModules, tenantSlug, userPermissions, isOwner, hasAccess, isSubdomain]);

    const activeRoute = useMemo(() => {
        const allItems = groupedNavItems.flatMap(g => g.items);
        return allItems.reduce((best, item) => {
            if (
                pathname === item.href ||
                (pathname?.startsWith(item.href) && item.href !== '/admin')
            ) {
                if (!best || item.href.length > best.href.length) {
                    return item;
                }
            }
            return best;
        }, null as NavItem | null);
    }, [pathname, groupedNavItems]);

    return (
        <>
            {/* Mobile Header */}
            <div className="md:hidden bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 p-4 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="relative w-8 h-8">
                        <Image
                            src="/clicker_brand_logo.png"
                            alt="Clicker Logo"
                            fill
                            className="object-contain"
                        />
                    </div>
                    <span className="font-black text-lg text-brand-dark">Clicker</span>
                </div>
                <button onClick={() => setSidebarOpen(true)} className="p-2 text-brand-dark hover:bg-gray-100 rounded-lg">
                    <Menu size={24} />
                </button>
            </div>

            {/* Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-40 bg-white dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-800 flex flex-col transition-all duration-300 ease-in-out
                w-full md:sticky md:top-0 md:h-screen
                ${sidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full shadow-none'}
                ${isCollapsed ? 'md:w-16' : 'md:w-64'}
                md:translate-x-0
            `}>
                {/* Header */}
                <div className={`py-4 flex items-center shrink-0 ${(!isCollapsed || sidebarOpen) ? 'px-6 justify-between' : 'px-6'}`}>
                    {/* Logo — doubles as expand button when collapsed */}
                    <button
                        onClick={isCollapsed ? toggleSidebarCollapse : undefined}
                        onMouseEnter={() => isCollapsed && setLogoHovered(true)}
                        onMouseLeave={() => setLogoHovered(false)}
                        className={`relative w-6 h-6 flex items-center justify-center shrink-0 rounded-full transition-colors duration-200 ${isCollapsed ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-800' : 'cursor-default'}`}
                        title={isCollapsed ? 'Expand sidebar' : undefined}
                        tabIndex={isCollapsed ? 0 : -1}
                    >
                        <Image
                            src="/clicker_brand_logo.png"
                            alt="Clicker Logo"
                            fill
                            className={`object-contain rounded-full transition-opacity duration-200 ${(isCollapsed && logoHovered) ? 'opacity-0' : 'opacity-100'}`}
                        />
                        {isCollapsed && (
                            <PanelLeftOpen
                                size={16}
                                className={`absolute transition-opacity duration-200 text-brand-dark dark:text-neutral-200 ${logoHovered ? 'opacity-100' : 'opacity-0'}`}
                            />
                        )}
                    </button>

                    {/* Title + collapse button row (expanded only) */}
                    {(!isCollapsed || sidebarOpen) && (
                        <>
                            <span className="font-bold text-sm text-brand-dark dark:text-neutral-200 ml-2 flex-1">Clicker</span>
                            <button
                                onClick={toggleSidebarCollapse}
                                title="Collapse sidebar"
                                className="hidden md:flex p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-brand-dark dark:hover:text-neutral-200 transition-colors"
                            >
                                <PanelLeftClose size={16} />
                            </button>
                            <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </>
                    )}
                </div>

                <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-6 scrollbar-hide">
                    {groupedNavItems.map((group) => (
                        <div key={group.title}>
                            {(!isCollapsed || sidebarOpen) && (
                                <h3 className="px-3 text-xs font-semibold text-gray-400 dark:text-neutral-600 uppercase tracking-wider mb-2 truncate">
                                    {group.title}
                                </h3>
                            )}
                            {(isCollapsed && !sidebarOpen) && (
                                <div className="h-px bg-gray-100 dark:bg-neutral-800 my-2 mx-2"></div>
                            )}
                            <div className="space-y-1">
                                {group.items.map((item) => {
                                    const isActive = activeRoute?.href === item.href;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={() => setSidebarOpen(false)}
                                            onMouseEnter={(e) => {
                                                if (isCollapsed && !sidebarOpen) {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setHoveredItem({ label: item.label, top: rect.top });
                                                }
                                            }}
                                            onMouseLeave={() => setHoveredItem(null)}
                                            className={`flex items-center gap-3 px-3 py-2 rounded-xl font-bold transition-colors text-sm group relative ${isActive
                                                ? 'bg-brand-dark text-brand-green shadow-sm'
                                                : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 hover:text-brand-dark dark:hover:text-neutral-200'
                                                } ${(!isCollapsed || sidebarOpen) ? 'justify-between' : ''}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <item.icon size={20} className={`shrink-0 ${isActive ? 'stroke-[2.5px]' : ''}`} />
                                                {(!isCollapsed || sidebarOpen) && <span className="truncate">{item.label}</span>}
                                            </div>
                                            {(!isCollapsed || sidebarOpen) && item.label === 'Inbox' && unreadCount > 0 && (
                                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${isActive ? 'bg-brand-green text-brand-dark' : 'bg-red-500 text-white'}`}>
                                                    {unreadCount}
                                                </span>
                                            )}
                                            {(isCollapsed && !sidebarOpen) && item.label === 'Inbox' && unreadCount > 0 && (
                                                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-neutral-900"></span>
                                            )}
                                            
                                            {(!isCollapsed || sidebarOpen) && item.label === 'Bookings' && newBookingCount > 0 && (
                                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${isActive ? 'bg-brand-green text-brand-dark' : 'bg-brand-blue text-white'}`}>
                                                    {newBookingCount}
                                                </span>
                                            )}
                                            {(isCollapsed && !sidebarOpen) && item.label === 'Bookings' && newBookingCount > 0 && (
                                                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-brand-blue rounded-full border-2 border-white dark:border-neutral-900"></span>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Tooltip for collapsed items */}
                    {(isCollapsed && !sidebarOpen) && hoveredItem && (
                        <div
                            className="fixed left-16 z-[60] bg-gray-900 text-white text-sm font-bold px-3 py-1.5 rounded-lg shadow-xl animate-in fade-in slide-in-from-left-2 duration-150 pointer-events-none whitespace-nowrap"
                            style={{ top: hoveredItem.top + 6 }}
                        >
                            {hoveredItem.label}
                            <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                        </div>
                    )}
                </nav>

                {/* Footer */}
                <div className="p-3 border-t border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 shrink-0">
                    {/* Collapsed: stacked icons. Expanded: row with Settings + Inbox */}
                    <div className={`${(isCollapsed && !sidebarOpen) ? 'flex flex-col gap-1 items-center' : 'flex items-center gap-1'}`}>

                        {/* Settings button + popover */}
                        <div ref={settingsRef} className={`relative ${(isCollapsed && !sidebarOpen) ? 'w-full' : 'flex-1 min-w-0'}`}>
                            {/* Settings popover */}
                            {settingsOpen && (
                                <div className={`absolute z-50 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-xl p-1.5 min-w-[200px] ${isCollapsed && !sidebarOpen ? 'left-full ml-2 bottom-0' : 'bottom-full mb-2 left-0'}`}>
                                    {/* Nav links */}
                                    {[
                                        { icon: User, label: 'Account', href: '/admin/settings/account' },
                                        { icon: Fingerprint, label: 'Identity', href: '/admin/settings/identity' },
                                        { icon: Building2, label: 'Business', href: '/admin/settings/business' },
                                        { icon: Users, label: 'Team', href: '/admin/settings/team' },
                                    ].map(({ icon: Icon, label, href }) => {
                                        const base = (tenantSlug && !isSubdomain) ? `/${tenantSlug}` : '';
                                        const fullHref = `${base}${href}`;
                                        const isActive = pathname?.startsWith(fullHref);
                                        return (
                                            <Link
                                                key={href}
                                                href={fullHref}
                                                onClick={() => { setSettingsOpen(false); setSidebarOpen(false); }}
                                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${isActive ? 'bg-brand-dark text-brand-green' : 'text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700 hover:text-brand-dark dark:hover:text-neutral-100'}`}
                                            >
                                                <Icon size={15} className="shrink-0" />
                                                {label}
                                            </Link>
                                        );
                                    })}

                                    <div className="my-1 h-px bg-gray-100 dark:bg-neutral-700" />

                                    {/* Utility actions */}
                                    <button
                                        onClick={() => { toggleDark(); }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-bold text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700 hover:text-brand-dark dark:hover:text-neutral-100 transition-colors"
                                    >
                                        {isDark ? <Sun size={15} className="shrink-0" /> : <Moon size={15} className="shrink-0" />}
                                        {isDark ? 'Light Mode' : 'Dark Mode'}
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-bold text-gray-600 dark:text-neutral-300 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 transition-colors"
                                    >
                                        <LogOut size={15} className="shrink-0" />
                                        Logout
                                    </button>
                                </div>
                            )}

                            <button
                                onClick={() => setSettingsOpen(prev => !prev)}
                                title="Settings"
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-bold transition-colors text-sm relative ${settingsOpen ? 'bg-gray-100 dark:bg-neutral-800 text-brand-dark dark:text-neutral-100' : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 hover:text-brand-dark dark:hover:text-neutral-200'} ${(isCollapsed && !sidebarOpen) ? 'justify-center' : ''}`}
                            >
                                <User size={20} className="shrink-0" />
                                {(!isCollapsed || sidebarOpen) && (
                                    <>
                                        <span className="flex-1 text-left truncate">Settings</span>
                                        <ChevronUp size={14} className={`shrink-0 transition-transform duration-200 ${settingsOpen ? 'rotate-180' : ''}`} />
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Inbox shortcut button */}
                        <button
                            onClick={() => setInboxOpen(true)}
                            title="Inbox"
                            className={`relative flex items-center justify-center px-3 py-2 rounded-xl font-bold text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 hover:text-brand-dark dark:hover:text-neutral-200 transition-colors shrink-0 ${(isCollapsed && !sidebarOpen) ? 'w-full' : ''}`}
                        >
                            <Inbox size={20} />
                            {unreadCount > 0 && (
                                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-neutral-900" />
                            )}
                        </button>
                    </div>
                </div>
            </aside>

            {/* Inbox slide-over */}
            {inboxOpen && (
                <InboxSlideOver
                    onClose={() => setInboxOpen(false)}
                    siteId={siteId}
                    baseUrl={(tenantSlug && !isSubdomain) ? `/${tenantSlug}` : ''}
                    sidebarCollapsed={isCollapsed}
                />
            )}
        </>
    );
}
