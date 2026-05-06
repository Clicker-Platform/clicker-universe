'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LayoutDashboard, LogOut, Menu, X, Palette, Inbox, Box, Users, Sun, Moon, PanelLeftClose, PanelLeftOpen, User, Building2, ChevronUp, ChevronDown, Layers, MessageCircle } from 'lucide-react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { subscribeToEnabledModules, MODULE_ICONS, getRouteIdFromPath } from '@/lib/modules/registry';
import { logger } from '@/lib/logger-edge';
import { STATIC_MODULE_DEFINITIONS } from '@/lib/modules/definitions';
import { ModuleDefinition } from '@/lib/modules/types';
import { useSite } from '@/lib/site-context';
import { useUser } from '@/lib/user-context';
import { useAdminTheme } from '@/lib/use-admin-theme';
import { useIsMobile } from '@/hooks/useIsMobile';
import { MobileModuleTabBar } from '@/components/admin/MobileModuleTabBar';

interface NavItem {
    icon: any;
    label: string;
    href: string;
}

interface SidebarGroup {
    title: string;
    items: NavItem[];
    isModule?: boolean;
    moduleIcon?: any;
}

const CORE_GROUPS = ['Core'];

export function AdminSidebar() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [newBookingCount, setNewBookingCount] = useState(0);
    const [modules, setModules] = useState<ModuleDefinition[]>([]);
    const [hoveredItem, setHoveredItem] = useState<{ label: string, top: number } | null>(null);
    const [hoveredModule, setHoveredModule] = useState<{ group: SidebarGroup, top: number } | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const settingsRef = useRef<HTMLDivElement>(null);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const pathname = usePathname();
    const router = useRouter();
    const { siteId, tenantSlug, isSubdomain } = useSite();

    const handleLogout = async () => {
        try {
            const isSecure = window.location.protocol === 'https:';
            const secureFlag = isSecure ? '; Secure' : '';
            document.cookie = `__session=; path=/; max-age=0; SameSite=Lax${secureFlag}`;
            const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
            if (baseDomain && isSecure) {
                document.cookie = `__session=; path=/; max-age=0; Domain=.${baseDomain}; SameSite=Lax; Secure`;
            }
            await signOut(auth);
            const gatewayUrl = process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL;
            if (gatewayUrl) {
                window.location.href = `${gatewayUrl}/logout`;
            } else {
                router.push('/login');
            }
        } catch (error) {
            logger.error('admin.auth.logout.failed', { siteId: 'platform', error });
        }
    };

    // Sidebar is always collapsed on desktop — derived from mobile drawer state
    const isCollapsed = !sidebarOpen;

    const toggleGroup = (title: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(title)) {
                next.delete(title);
            } else {
                next.add(title);
            }
            return next;
        });
    };

    const isMobile = useIsMobile();
    const { permissions: userPermissions, isOwner, hasAccess } = useUser();
    const { isDark, toggle: toggleDark } = useAdminTheme();
    const [siteEnabledModules, setSiteEnabledModules] = useState<Record<string, boolean>>({});

    useEffect(() => {
        let unsubscribeSite: (() => void) | null = null;
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
            logger.error('admin.sidebar.modules.fetch.failed', { siteId, error: e });
        }

        const unsubscribeAuth = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
            if (unsubscribeBookingSnapshot) { unsubscribeBookingSnapshot(); unsubscribeBookingSnapshot = null; }

            if (user) {
                try {
                    const qBookings = query(collection(db, 'sites', siteId, 'modules/reservation/bookings'), where('status', '==', 'pending'));
                    unsubscribeBookingSnapshot = onSnapshot(qBookings, (snapshot) => {
                        setNewBookingCount(snapshot.size);
                    }, (error) => { logger.error('admin.sidebar.bookings.subscribe.failed', { siteId, error }); });
                } catch (e) {
                    logger.error('admin.sidebar.listeners.setup.failed', { siteId, error: e });
                }
            } else {
                setNewBookingCount(0);
            }
        });

        return () => {
            unsubscribeAuth();
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
            { icon: Box, label: 'Canvas Studio', href: `${baseUrl}/admin/canvas`, permission: 'biolink' },
            { icon: Palette, label: 'Template', href: `${baseUrl}/admin/template`, permission: 'biolink' },
            { icon: Layers, label: 'Services', href: `${baseUrl}/admin/services`, permission: null },
            ...(process.env.NEXT_PUBLIC_ENABLE_WHATSAPP === 'true' ? [{ icon: MessageCircle, label: 'WhatsApp', href: `${baseUrl}/admin/whatsapp`, permission: null }] : []),
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

            // Pick the module-level icon for the collapsed parent
            const moduleIcon = MODULE_ICONS[m.icon] || items[0]?.icon || Box;

            return { title: groupTitle, items, isModule: true, moduleIcon };
        }).filter(Boolean) as SidebarGroup[];

        const coreGroup: SidebarGroup = { title: 'Core', items: coreItems, isModule: false };

        const groups: SidebarGroup[] = [coreGroup, ...moduleGroups];
        return groups.filter(g => g.items.length > 0);
    }, [modules, siteEnabledModules, tenantSlug, userPermissions, isOwner, hasAccess, isSubdomain]);

    const activeRoute = useMemo(() => {
        const allItems = groupedNavItems.flatMap(g => g.items);
        return allItems.reduce((best, item) => {
            if (
                pathname === item.href ||
                (pathname?.startsWith(item.href) && item.href !== '/admin')
            ) {
                if (!best || item.href.length > best.href.length) return item;
            }
            return best;
        }, null as NavItem | null);
    }, [pathname, groupedNavItems]);

    // Map of hidden route path prefix -> group title, rebuilt when modules/groupedNavItems change
    const hiddenRouteGroupMap = useMemo(() => {
        const baseUrl = (tenantSlug && !isSubdomain) ? `/${tenantSlug}` : '';
        const map: Array<{ prefix: string; groupTitle: string }> = [];
        for (const m of modules) {
            const staticDef = STATIC_MODULE_DEFINITIONS[m.id];
            const routes = staticDef?.adminRoutes || m.adminRoutes || [];
            let groupTitle = m.displayName || m.id;
            if (groupTitle === 'Self Order' || groupTitle === 'BYOD POS') groupTitle = 'POS';
            for (const r of routes) {
                if (r.hidden) map.push({ prefix: `${baseUrl}${r.path}`, groupTitle });
            }
        }
        return map;
    }, [modules, tenantSlug, isSubdomain]);

    // Auto-expand the group that contains the active route (including hidden routes)
    useEffect(() => {
        if (!pathname) return;

        // First try visible routes
        const activeGroup = groupedNavItems.find(g => g.isModule && g.items.some(i =>
            pathname === i.href || (pathname.startsWith(i.href) && i.href !== '/admin')
        ));

        if (activeGroup) {
            setExpandedGroups(prev => {
                if (prev.has(activeGroup.title)) return prev;
                const next = new Set(prev);
                next.add(activeGroup.title);
                return next;
            });
            return;
        }

        // Fall back to hidden routes
        const match = hiddenRouteGroupMap.find(({ prefix }) =>
            pathname === prefix || pathname.startsWith(prefix)
        );
        if (match) {
            setExpandedGroups(prev => {
                if (prev.has(match.groupTitle)) return prev;
                const next = new Set(prev);
                next.add(match.groupTitle);
                return next;
            });
        }
    }, [pathname, groupedNavItems, hiddenRouteGroupMap]);

    // The module group the user is currently navigating within (for mobile tab bar)
    const activeModuleGroup = useMemo(() => {
        if (!isMobile) return null;
        return groupedNavItems.find(
            g => g.isModule && g.items.some(i => i.href === activeRoute?.href)
        ) ?? null;
    }, [isMobile, groupedNavItems, activeRoute]);

    const renderNavItem = (item: NavItem, inPopover = false) => {
        const isActive = activeRoute?.href === item.href;
        return (
            <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg font-semibold transition-colors text-sm relative ${
                    isActive
                        ? inPopover
                            ? 'bg-studio-blue text-white'
                            : 'bg-studio-blue/10 text-studio-blue dark:text-studio-blue-muted'
                        : inPopover
                            ? 'text-neutral-300 hover:bg-neutral-700 hover:text-white'
                            : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-neutral-100'
                }`}
            >
                <item.icon size={16} className="shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.label === 'Bookings' && newBookingCount > 0 && (
                    <span className={`ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full ${isActive ? 'bg-brand-green text-brand-dark' : 'bg-studio-blue text-white'}`}>
                        {newBookingCount}
                    </span>
                )}
            </Link>
        );
    };

    return (
        <>
            {/* Mobile module tab bar */}
            {isMobile && activeModuleGroup && (
                <MobileModuleTabBar
                    items={activeModuleGroup.items}
                    activeHref={activeRoute?.href ?? null}
                />
            )}

            {/* Mobile Header */}
            <div className="md:hidden bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 p-4 flex items-center justify-between sticky top-0 z-30">
                <span className="font-black text-lg text-brand-dark dark:text-neutral-100">
                    {activeRoute?.label ?? 'Clicker'}
                </span>
                <button onClick={() => setSidebarOpen(true)} className="p-2 text-brand-dark hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg">
                    <Menu size={24} />
                </button>
            </div>

            {/* Overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Sidebar — mobile drawer only, hidden on desktop */}
            <aside className={`
                fixed inset-y-0 left-0 z-[60] bg-white dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-800 flex flex-col transition-all duration-300 ease-in-out
                w-full md:hidden
                ${sidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full shadow-none'}
            `}>
                {/* Header — icon-only on desktop, full on mobile drawer */}
                <div className="py-3.5 px-4 flex items-center shrink-0">
                    {/* Logo — always visible */}
                    <div className="relative w-6 h-6 flex items-center justify-center shrink-0">
                        <Image
                            src="/clicker_brand_logo.png"
                            alt="Clicker Logo"
                            fill
                            className="object-contain rounded-full"
                        />
                    </div>

                    {/* Label + close — mobile drawer only */}
                    {sidebarOpen && (
                        <>
                            <span className="font-bold text-sm text-brand-dark dark:text-neutral-200 ml-2 flex-1">Clicker</span>
                            <button onClick={() => setSidebarOpen(false)} className="p-2 text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </>
                    )}
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-1 scrollbar-hide">
                    {groupedNavItems.map((group, index) => {
                        const isCore = !group.isModule;
                        const isExpanded = expandedGroups.has(group.title);
                        const hasActiveItem = group.items.some(i => i.href === activeRoute?.href);
                        const isFirstModule = group.isModule && groupedNavItems.findIndex(g => g.isModule) === index;

                        if (isCore) {
                            // Core groups: flat list, no accordion, section label when expanded
                            return (
                                <div key={group.title}>
                                    {(!isCollapsed || sidebarOpen) && (
                                        <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-gray-400 dark:text-neutral-600 uppercase tracking-wider truncate">
                                            {group.title}
                                        </p>
                                    )}
                                    {(isCollapsed && !sidebarOpen) && <div className="h-px bg-gray-100 dark:bg-neutral-800 my-2 mx-1" />}
                                    <div className="space-y-0.5">
                                        {group.items.map(item => {
                                            const isActive = activeRoute?.href === item.href;
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    onClick={() => setSidebarOpen(false)}
                                                    onMouseEnter={(e) => {
                                                        if (isCollapsed && !sidebarOpen) {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            setHoveredItem({ label: item.label, top: rect.top + rect.height / 2 });
                                                        }
                                                    }}
                                                    onMouseLeave={() => setHoveredItem(null)}
                                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-semibold transition-colors text-sm ${
                                                        isActive
                                                            ? 'bg-studio-blue text-white'
                                                            : 'text-gray-500 dark:text-neutral-400 hover:bg-studio-blue-muted/15 hover:text-studio-blue dark:hover:bg-studio-blue-muted/15 dark:hover:text-studio-blue-muted'
                                                    } ${(isCollapsed && !sidebarOpen) ? 'justify-center' : ''}`}
                                                >
                                                    <item.icon size={18} className="shrink-0" />
                                                    {(!isCollapsed || sidebarOpen) && <span className="truncate">{item.label}</span>}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        }

                        // Module groups: collapsible accordion
                        const ModuleIcon = group.moduleIcon || Box;

                        if (isCollapsed && !sidebarOpen) {
                            return (
                                <div key={group.title}>
                                    {isFirstModule && <div className="h-px bg-gray-100 dark:bg-neutral-800 my-2 mx-1" />}
                                    <div className="relative">
                                        <button
                                            className={`w-full cursor-pointer flex items-center justify-center p-2 rounded-lg transition-colors ${
                                                hasActiveItem
                                                    ? 'bg-studio-blue/10 text-studio-blue dark:text-studio-blue-muted'
                                                    : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-neutral-100'
                                            }`}
                                            onMouseEnter={(e) => {
                                                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                setHoveredModule({ group, top: rect.top });
                                            }}
                                            onMouseLeave={() => {
                                                hoverTimeoutRef.current = setTimeout(() => {
                                                    setHoveredModule(null);
                                                }, 150);
                                            }}
                                        >
                                            <ModuleIcon size={18} className="shrink-0" />
                                        </button>
                                    </div>
                                </div>
                            );
                        }

                        // Expanded sidebar: accordion
                        return (
                            <div key={group.title}>
                                {isFirstModule && (
                                    <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-gray-400 dark:text-neutral-600 uppercase tracking-wider truncate">
                                        Apps
                                    </p>
                                )}
                                <button
                                    onClick={() => !hasActiveItem && toggleGroup(group.title)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-semibold transition-colors text-sm ${
                                        hasActiveItem
                                            ? 'bg-studio-blue/10 text-studio-blue dark:text-studio-blue-muted cursor-default'
                                            : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-neutral-100'
                                    }`}
                                >
                                    <ModuleIcon size={18} className="shrink-0" />
                                    <span className="flex-1 text-left truncate">{group.title}</span>
                                    {!hasActiveItem && (
                                        <ChevronDown
                                            size={14}
                                            className={`shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                        />
                                    )}
                                </button>

                                {/* Sub-items only shown when module is not active — TopBar owns sub-nav when active */}
                                {isExpanded && !hasActiveItem && (
                                    <div className="ml-3 pl-3 border-l border-gray-200 dark:border-neutral-800 mt-0.5 mb-1 space-y-0.5">
                                        {group.items.map(item => renderNavItem(item))}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Collapsed: flat item tooltip */}
                    {(isCollapsed && !sidebarOpen) && hoveredItem && (
                        <div
                            className="fixed left-14 z-[60] bg-gray-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xl animate-in fade-in duration-150 pointer-events-none whitespace-nowrap -translate-y-1/2"
                            style={{ top: hoveredItem.top }}
                        >
                            {hoveredItem.label}
                            <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                        </div>
                    )}

                    {/* Collapsed: module popover */}
                    {(isCollapsed && !sidebarOpen) && hoveredModule && (
                        <div
                            className="fixed left-14 z-[60] bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl p-1.5 min-w-[160px] animate-in fade-in duration-150"
                            style={{ top: hoveredModule.top }}
                            onMouseEnter={() => {
                                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                            }}
                            onMouseLeave={() => {
                                hoverTimeoutRef.current = setTimeout(() => {
                                    setHoveredModule(null);
                                }, 150);
                            }}
                        >
                            <p className="px-3 py-1 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                                {hoveredModule.group.title}
                            </p>
                            {hoveredModule.group.items.map(item => renderNavItem(item, true))}
                        </div>
                    )}
                </nav>

                {/* Footer */}
                <div className="p-2 border-t border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 shrink-0">
                    <div className={`${(isCollapsed && !sidebarOpen) ? 'flex flex-col gap-1 items-center' : 'flex items-center gap-1'}`}>

                        {/* Settings button + popover */}
                        <div ref={settingsRef} className={`relative ${(isCollapsed && !sidebarOpen) ? 'w-full' : 'flex-1 min-w-0'}`}>
                            {settingsOpen && (
                                <div className={`absolute z-50 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-xl p-1.5 min-w-[200px] ${isCollapsed && !sidebarOpen ? 'left-full ml-2 bottom-0' : 'bottom-full mb-2 left-0'}`}>
                                    {[
                                        { icon: User, label: 'Account', href: '/admin/settings/account' },
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
                                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${isActive ? 'bg-studio-blue text-white' : 'text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700 hover:text-brand-dark dark:hover:text-neutral-100'}`}
                                            >
                                                <Icon size={15} className="shrink-0" />
                                                {label}
                                            </Link>
                                        );
                                    })}

                                    <div className="my-1 h-px bg-gray-100 dark:bg-neutral-700" />

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
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-semibold transition-colors text-sm relative ${settingsOpen ? 'bg-gray-100 dark:bg-neutral-800 text-brand-dark dark:text-neutral-100' : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 hover:text-brand-dark dark:hover:text-neutral-200'} ${(isCollapsed && !sidebarOpen) ? 'justify-center' : ''}`}
                            >
                                <User size={18} className="shrink-0" />
                                {(!isCollapsed || sidebarOpen) && (
                                    <>
                                        <span className="flex-1 text-left truncate">Settings</span>
                                        <ChevronUp size={14} className={`shrink-0 transition-transform duration-200 ${settingsOpen ? 'rotate-180' : ''}`} />
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Inbox moved to AdminTopBar */}
                    </div>
                </div>
            </aside>

            {/* Inbox panel */}
        </>
    );
}
