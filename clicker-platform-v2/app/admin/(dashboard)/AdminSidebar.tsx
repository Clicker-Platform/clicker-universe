'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link'; // Keep existing import usually
import Image from 'next/image';
import { LayoutDashboard, Link as LinkIcon, ShoppingBag, User, LogOut, Menu, X, Settings, Map as MapIcon, Palette, FileText, Inbox, Box, Zap, Calendar, List, Users } from 'lucide-react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { subscribeToEnabledModules, MODULE_ICONS, getRouteIdFromPath } from '@/lib/modules/registry';
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

export function AdminSidebar() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [modules, setModules] = useState<ModuleDefinition[]>([]);
    const [isFocusMode, setIsFocusMode] = useState(false);
    const pathname = usePathname();
    const router = useRouter();


    const handleLogout = async () => {
        try {
            // Clear __session cookie
            document.cookie = '__session=; path=/; max-age=0';
            await signOut(auth);

            // Cross-Domain Logout: Redirect to Gateway Logout
            const gatewayUrl = process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL || 'https://clicker-auth-gateway.web.app';
            window.location.href = `${gatewayUrl}/logout`;
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    // Load focus mode preference
    useEffect(() => {
        const savedFocus = localStorage.getItem('admin_focus_mode');
        if (savedFocus !== null) {
            setIsFocusMode(JSON.parse(savedFocus));
        }
    }, []);

    // Save focus mode preference
    const toggleFocusMode = () => {
        const newValue = !isFocusMode;
        setIsFocusMode(newValue);
        localStorage.setItem('admin_focus_mode', JSON.stringify(newValue));
    };

    // Get Site Context
    const { siteId, tenantSlug } = useSite();
    const { permissions: userPermissions, isOwner, hasAccess } = useUser();
    const [siteEnabledModules, setSiteEnabledModules] = useState<Record<string, boolean>>({});

    useEffect(() => {
        let unsubscribeSite: (() => void) | null = null;
        let unsubscribeSnapshot: (() => void) | null = null;

        if (!siteId) return;

        // 1. Subscribe to Site Config for enabled modules
        try {
            unsubscribeSite = onSnapshot(doc(db, 'sites', siteId), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    // Merge legacy settings.modules and root modules
                    const legacy = data.settings?.modules || {};
                    const root = data.modules || {};
                    setSiteEnabledModules({ ...legacy, ...root });
                }
            });
        } catch (e) {
            console.error("Error fetching site modules", e);
        }

        // 2. Subscribe to auth state changes to ensure we have a user before listening to DB
        const unsubscribeAuth = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
            // ... (existing inbox logic) ...
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
        // Subscribe to enabled modules (Global Definitions)
        const unsubscribe = subscribeToEnabledModules((fetchedModules) => {
            setModules(fetchedModules);
        });
        return () => unsubscribe();
    }, []);

    const groupedNavItems = useMemo(() => {
        const baseUrl = tenantSlug ? `/${tenantSlug}` : '';

        // Define core items with permission requirements
        // permission: null = always visible, string = requires that permission
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

        // Check if user has full access (owner or '*' permission)
        const hasFullAccess = isOwner || userPermissions.includes('*');

        // Filter core items based on permissions
        const coreItems = allCoreItems.filter(item => {
            if (hasFullAccess) return true;
            if (item.permission === null) return true; // Always visible
            return userPermissions.includes(item.permission) || userPermissions.includes('biolink');
        });

        // Create a group for EACH module
        const moduleGroups: SidebarGroup[] = modules.map(m => {
            // FILTER: Only show modules enabled for this site and globally
            if (!siteEnabledModules[m.id] && !siteEnabledModules[m.id as any]) return null;

            const items = (m.adminRoutes || [])
                .filter(r => !r.hidden)
                .filter(r => {
                    const routeId = getRouteIdFromPath(m.id, r.path);
                    return hasAccess(m.id, routeId);
                })
                .map(route => {
                    // Universal POS Label Overrides
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

        // RESTORE FOCUS MODE: If Focus Mode is active, return ONLY module groups
        if (isFocusMode && moduleGroups.length > 0) {
            return moduleGroups;
        }

        // --- Standard Grouping for Core Items ---

        // Define groups and their matchers for Core Items
        // Staff only sees module groups, not Workspace/Site&Content sections
        const groupsDef = hasFullAccess ? [
            {
                title: 'Customer Engagement',
                match: (item: NavItem) => ['Inbox'].includes(item.label)
            },
            {
                title: 'Workspace',
                match: (item: NavItem) => ['Overview', 'Business', 'Profile', 'Appearance', 'Settings', 'Team'].includes(item.label)
            },
            {
                title: 'Site & Content',
                match: (item: NavItem) => ['Pages', 'Links', 'Forms Builder', 'Products'].includes(item.label)
            },
            {
                title: 'Sales & Ops',
                match: (item: NavItem) => false // Deprecated: POS/Bookings are now in Modules
            }
        ] : [
            // Staff: Only show Overview if they have it (from coreItems filter)
            // No group headers for staff - just their permitted modules
        ];

        // Assign core items to groups
        const groups: SidebarGroup[] = groupsDef.map(g => ({
            title: g.title,
            items: coreItems.filter(g.match) // Only filter from coreItems
        }));

        // Find matched items to handle "Other" if necessary (optional safeguard)
        const matchedHrefs = new Set(groups.flatMap(g => g.items.map(i => i.href)));
        const unmatchedCoreItems = coreItems.filter(i => !matchedHrefs.has(i.href));

        if (unmatchedCoreItems.length > 0) {
            // Add unmatched core items to 'Workspace' or new group
            const workspace = groups.find(g => g.title === 'Workspace');
            if (workspace) workspace.items.push(...unmatchedCoreItems);
        }

        // Add Module Groups BEFORE Settings/Workspace if desired, or at the top. 
        // Logic: Core Site Content > Modules > Workspace/Settings

        // Let's Insert Module Groups at the top, or after "Site & Content"
        // Based on user request "Cluster menus... for easy navigation", usually strictly separating them is best.
        // Let's prepend them to be prominent if they are the main business apps.
        // Or append them. The previous code appended them. Let's prepend them for prominence as "Business Apps".

        // Actually, typical Admin dashboards: Overview > Apps (Modules) > Configuration.
        // Let's insert Module Groups after the first group (if it exists) or at the beginning?
        // Let's just append them to the list like before, but as distinct groups.
        groups.push(...moduleGroups); // Put modules AFTER core items

        // Filter out empty groups
        return groups.filter(g => g.items.length > 0);
    }, [modules, isFocusMode, siteEnabledModules, tenantSlug, userPermissions, isOwner]);


    // Find the best matching route for active state
    // We need to look across all groups
    const activeRoute = useMemo(() => {
        const allItems = groupedNavItems.flatMap(g => g.items);
        return allItems.reduce((best, item) => {
            if (
                pathname === item.href ||
                (pathname?.startsWith(item.href) && item.href !== '/admin') // Avoid /admin matching everything
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
                fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out
                md:relative md:translate-x-0
                ${sidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full shadow-none'}
            `}>
                <div className="p-6 pb-2">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="relative w-10 h-10 flex items-center justify-center">
                                <Image
                                    src="/clicker_brand_logo.png"
                                    alt="Clicker Logo"
                                    width={40}
                                    height={40}
                                    className="object-contain"
                                />
                            </div>
                            <div>
                                <span className="font-black text-xl text-brand-dark block leading-none">Clicker</span>
                                {modules.length > 0 && (
                                    <button
                                        onClick={toggleFocusMode}
                                        className="text-[10px] font-bold text-gray-400 hover:text-brand-green uppercase tracking-wider flex items-center gap-1 mt-1"
                                    >
                                        {isFocusMode ? 'Focus Mode On' : 'Switch to Focus'}
                                        <Zap size={10} className={isFocusMode ? 'fill-brand-green text-brand-green' : ''} />
                                    </button>
                                )}
                            </div>
                        </div>
                        {/* Close button for mobile */}
                        <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 text-gray-400 hover:text-gray-600">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
                    {groupedNavItems.map((group) => (
                        <div key={group.title}>
                            <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                {group.title}
                            </h3>
                            <div className="space-y-1">
                                {group.items.map((item) => {
                                    const isActive = activeRoute?.href === item.href;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={() => setSidebarOpen(false)}
                                            className={`flex items-center gap-3 px-4 py-2 rounded-xl font-bold transition-all justify-between text-sm ${isActive
                                                ? 'bg-brand-dark text-brand-green shadow-sm'
                                                : 'text-gray-500 hover:bg-gray-50 hover:text-brand-dark'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <item.icon size={18} className={isActive ? 'stroke-[2.5px]' : ''} />
                                                {item.label}
                                            </div>
                                            {item.label === 'Inbox' && unreadCount > 0 && (
                                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${isActive ? 'bg-brand-green text-brand-dark' : 'bg-red-500 text-white'}`}>
                                                    {unreadCount}
                                                </span>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Account Group */}
                    <div>
                        <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            Account
                        </h3>
                        <div className="space-y-1">
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-2 rounded-xl font-bold text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors text-sm"
                            >
                                <LogOut size={18} />
                                Logout
                            </button>
                        </div>
                    </div>
                </nav>
            </aside>
        </>
    );
}
