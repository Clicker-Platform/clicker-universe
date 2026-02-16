'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LayoutDashboard, Link as LinkIcon, ShoppingBag, User, LogOut, Menu, X, Settings, Map as MapIcon, Palette, FileText, Inbox, Box, Zap, Calendar, List, Users, Globe } from 'lucide-react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { subscribeToEnabledModules, MODULE_ICONS, getRouteIdFromPath } from '@/lib/modules/registry';
import { STATIC_MODULE_DEFINITIONS } from '@/lib/modules/definitions';
import { ModuleDefinition } from '@/lib/modules/types';
import { useSite } from '@/lib/site-context';
import { useUser } from '@/lib/user-context';

interface NavItem {
    icon: any;
    label: string;
    href: string;
}

interface SidebarGroup {
    title: string;
    items: NavItem[];
}

// interface AdminSidebarProps {
//    isSubdomain?: boolean;
// }

export function AdminSidebar() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [modules, setModules] = useState<ModuleDefinition[]>([]);
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [hoveredItem, setHoveredItem] = useState<{ label: string, top: number } | null>(null);
    const pathname = usePathname();
    const router = useRouter();
    const { siteId, tenantSlug, isSubdomain } = useSite();

    const handleLogout = async () => {
        try {
            document.cookie = '__session=; path=/; max-age=0';
            await signOut(auth);
            // HARDCODED: Ensure strict redirect to masked auth domain
            const gatewayUrl = 'https://auth.clicker.id';
            window.location.href = `${gatewayUrl}/logout`;
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    useEffect(() => {
        const savedFocus = localStorage.getItem('admin_focus_mode');
        if (savedFocus !== null) {
            setIsFocusMode(JSON.parse(savedFocus));
        }

        const savedCollapsed = localStorage.getItem('sidebar_collapsed');
        if (savedCollapsed !== null) {
            setIsCollapsed(JSON.parse(savedCollapsed));
        }
    }, []);



    const toggleFocusMode = () => {
        const newValue = !isFocusMode;
        setIsFocusMode(newValue);
        localStorage.setItem('admin_focus_mode', JSON.stringify(newValue));
    };

    const toggleSidebarCollapse = () => {
        const newValue = !isCollapsed;
        setIsCollapsed(newValue);
        localStorage.setItem('sidebar_collapsed', JSON.stringify(newValue));
    };


    const { permissions: userPermissions, isOwner, hasAccess } = useUser();
    const [siteEnabledModules, setSiteEnabledModules] = useState<Record<string, boolean>>({});

    useEffect(() => {
        let unsubscribeSite: (() => void) | null = null;
        let unsubscribeSnapshot: (() => void) | null = null;

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

            if (user) {
                try {
                    const q = query(collection(db, 'sites', siteId, 'inbox'), where('status', '==', 'new'));
                    unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
                        setUnreadCount(snapshot.size);
                    }, (error) => {
                        console.error("Inbox listener error:", error);
                    });
                } catch (e) {
                    console.error("Error setting up inbox listener:", e);
                }
            } else {
                setUnreadCount(0);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeSnapshot) unsubscribeSnapshot();
            if (unsubscribeSite) unsubscribeSite();
        };
    }, [siteId]);

    useEffect(() => {
        const unsubscribe = subscribeToEnabledModules((fetchedModules) => {
            setModules(fetchedModules);
        });
        return () => unsubscribe();
    }, []);

    const groupedNavItems = useMemo(() => {
        // If on subdomain, URL is root-relative (/admin).
        // If on root domain, URL is tenant-prefixed (/hi-clicker/admin).
        const baseUrl = (tenantSlug && !isSubdomain) ? `/${tenantSlug}` : '';

        const allCoreItems = [
            { icon: LayoutDashboard, label: 'Overview', href: `${baseUrl}/admin`, permission: null },
            { icon: Inbox, label: 'Inbox', href: `${baseUrl}/admin/inbox`, permission: 'biolink' },
            { icon: LinkIcon, label: 'Links', href: `${baseUrl}/admin/links`, permission: 'biolink' },
            { icon: FileText, label: 'Pages', href: `${baseUrl}/admin/pages`, permission: 'biolink' },
            { icon: FileText, label: 'Forms Builder', href: `${baseUrl}/admin/forms`, permission: 'biolink' },
            { icon: ShoppingBag, label: 'Products', href: `${baseUrl}/admin/products`, permission: 'biolink' },
            { icon: MapIcon, label: 'Business', href: `${baseUrl}/admin/business`, permission: 'biolink' },
            { icon: Palette, label: 'Appearance', href: `${baseUrl}/admin/appearance`, permission: 'biolink' },
            { icon: User, label: 'Profile', href: `${baseUrl}/admin/profile`, permission: null },
            { icon: Users, label: 'Team', href: `${baseUrl}/admin/settings/team`, permission: 'manage_team' },
            { icon: Settings, label: 'Settings', href: `${baseUrl}/admin/settings`, permission: 'settings' },
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
                .map(route => {
                    let label = route.label;
                    if (label === 'POS Menu') label = 'Catalog';
                    if (label === 'Kitchen View' || label === 'POS Orders' || label === 'Orders') label = 'POS Orders';

                    return {
                        icon: MODULE_ICONS[route.icon || ''] || MODULE_ICONS[m.icon] || Box,
                        label: label,
                        href: `${baseUrl}${route.path}`
                    };
                });

            if (items.length === 0) return null;

            let groupTitle = m.displayName || m.id;
            if (groupTitle === 'Self Order' || groupTitle === 'BYOD POS') groupTitle = 'POS';

            return {
                title: groupTitle,
                items: items
            };
        }).filter(Boolean) as SidebarGroup[];

        if (isFocusMode && moduleGroups.length > 0) {
            return moduleGroups;
        }

        const groupsDef = [
            {
                title: 'Customer Engagement',
                match: (item: NavItem) => ['Inbox'].includes(item.label)
            },
            {
                title: 'Workspace',
                match: (item: NavItem) => {
                    const label = item.label === 'Settings' ? 'Website' : (item.label === 'Profile' ? 'My Account' : item.label);
                    return ['Overview', 'Business', 'My Account', 'Appearance', 'Website'].includes(label);
                }
            },
            {
                title: 'Site & Content',
                match: (item: NavItem) => ['Pages', 'Forms Builder', 'Products', 'Links'].includes(item.label)
            },
            {
                title: 'Organization',
                match: (item: NavItem) => ['Users', 'Team'].includes(item.label)
            }
        ];

        const groups: SidebarGroup[] = groupsDef.map(g => ({
            title: g.title,
            items: coreItems.filter(item => g.match(item)).map(item => {
                if (item.label === 'Settings') return { ...item, label: 'Website', icon: Globe };
                if (item.label === 'Profile') return { ...item, label: 'My Account' };
                if (item.label === 'Team') return { ...item, label: 'Users', icon: Users };
                return item;
            })
        }));

        groups.push(...moduleGroups);
        return groups.filter(g => g.items.length > 0);
    }, [modules, isFocusMode, siteEnabledModules, tenantSlug, userPermissions, isOwner, hasAccess, isSubdomain]);

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
            <div className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-20">
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
                fixed inset-y-0 left-0 z-40 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out
                w-full md:sticky md:top-0 md:h-screen
                ${sidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full shadow-none'}
                ${isCollapsed ? 'md:w-24' : 'md:w-64'}
                md:translate-x-0
            `}>
                <div className={`p-6 pb-2 flex items-center ${(isCollapsed && !sidebarOpen) ? 'justify-center' : 'justify-between'}`}>
                    <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                            <Image
                                src="/clicker_brand_logo.png"
                                alt="Clicker Logo"
                                fill
                                className="object-contain"
                            />
                        </div>
                        {(!isCollapsed || sidebarOpen) && (
                            <div>
                                <span className="font-black text-xl text-brand-dark block leading-none">Clicker</span>
                                {modules.length > 0 && (
                                    <button
                                        onClick={toggleFocusMode}
                                        className="text-[10px] font-bold text-gray-400 hover:text-brand-green uppercase tracking-wider flex items-center gap-1 mt-1"
                                    >
                                        {isFocusMode ? 'Focus On' : 'Focus Mode'}
                                        <Zap size={10} className={isFocusMode ? 'fill-brand-green text-brand-green' : ''} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-6 scrollbar-hide">
                    {groupedNavItems.map((group) => (
                        <div key={group.title} className={(isCollapsed && !sidebarOpen) ? 'text-center' : ''}>
                            {(!isCollapsed || sidebarOpen) && (
                                <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 truncate">
                                    {group.title}
                                </h3>
                            )}
                            {(isCollapsed && !sidebarOpen) && (
                                <div className="h-px bg-gray-100 my-2 mx-2"></div>
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
                                                    setHoveredItem({
                                                        label: item.label,
                                                        top: rect.top
                                                    });
                                                }
                                            }}
                                            onMouseLeave={() => setHoveredItem(null)}
                                            className={`flex items-center gap-3 px-3 py-2 rounded-xl font-bold transition-all text-sm group relative ${isActive
                                                ? 'bg-brand-dark text-brand-green shadow-sm'
                                                : 'text-gray-500 hover:bg-gray-50 hover:text-brand-dark'
                                                } ${(isCollapsed && !sidebarOpen) ? 'justify-center' : 'justify-between'}`}
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
                                                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Custom Tooltip Portal */}
                    {(isCollapsed && !sidebarOpen) && hoveredItem && (
                        <div
                            className="fixed left-24 z-[60] bg-gray-900 text-white text-sm font-bold px-3 py-1.5 rounded-lg shadow-xl animate-in fade-in slide-in-from-left-2 duration-150 pointer-events-none whitespace-nowrap"
                            style={{ top: hoveredItem.top + 6 }}
                        >
                            {hoveredItem.label}
                            <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                        </div>
                    )}
                </nav>

                {/* Footer Area - FIXED BOTTOM */}
                <div className="p-3 border-t border-gray-100 bg-white shrink-0">
                    <button
                        onClick={handleLogout}
                        title="Logout"
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-bold text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors text-sm mb-2 ${(isCollapsed && !sidebarOpen) ? 'justify-center' : ''}`}
                    >
                        <LogOut size={20} className="shrink-0" />
                        {(!isCollapsed || sidebarOpen) && <span>Logout</span>}
                    </button>

                    <button
                        onClick={toggleSidebarCollapse}
                        className="hidden md:flex w-full items-center justify-center p-2 text-gray-400 hover:bg-gray-50 rounded-lg transition-colors border-t border-dashed border-gray-200 mt-1"
                    >
                        {isCollapsed ? <Menu size={18} /> : (
                            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
                                <Menu size={16} /> <span className="truncate">Collapse Sidebar</span>
                            </div>
                        )}
                    </button>

                    {!isCollapsed && !sidebarOpen && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-[10px] text-gray-400 font-mono break-all text-center">
                            Site: {siteId} | [tenant]: {tenantSlug}
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
}
