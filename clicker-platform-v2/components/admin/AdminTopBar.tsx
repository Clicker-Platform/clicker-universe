'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Inbox, User, Building2, Users, Sun, Moon, LogOut, LayoutGrid, Box, Star, Activity } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';
import { useAdminTheme } from '@/lib/use-admin-theme';
import { useAdminNavGroups, NavGroup } from '@/lib/use-admin-nav-groups';
import { useTopBarSlots } from '@/lib/top-bar-slot-context';
import { useInboxPanel } from '@/lib/inbox-panel-context';
import { useAdminUnreadCounts } from '@/lib/use-admin-unread-counts';
import { AICreditPill } from '@/components/admin/ai-credit/AICreditPill';
import { AICreditStatusProvider } from '@/components/admin/ai-credit/AICreditStatusContext';

// ─── Helpers ────────────────────────────────────────────────────────────────

function resolveActiveGroup(groups: NavGroup[], pathname: string, baseUrl: string): NavGroup | null {
    return groups.find(g =>
        g.isModule && g.items.some(i =>
            pathname === i.href || (pathname?.startsWith(i.href) && i.href !== `${baseUrl}/admin`)
        )
    ) ?? null;
}

function resolvePageTitle(groups: NavGroup[], pathname: string, baseUrl: string): string {
    const adminRoot = `${baseUrl}/admin`;
    const allItems = groups.flatMap(g => g.items);
    const match = allItems.reduce((best, item) => {
        if (pathname === item.href || (pathname?.startsWith(item.href) && item.href !== adminRoot)) {
            if (!best || item.href.length > best.href.length) return item;
        }
        return best;
    }, null as { label: string; href: string } | null);

    if (match) return match.label;

    const activeGroup = groups.find(g =>
        g.isModule && g.items.some(i => pathname === i.href || pathname?.startsWith(i.href))
    );
    if (activeGroup) return activeGroup.title;
    return 'Dashboard';
}

function usePinnedModules(siteId: string) {
    const storageKey = `clicker_pinned_modules_${siteId}`;

    const [pinned, setPinned] = useState<Set<string>>(() => {
        if (typeof window === 'undefined') return new Set();
        try {
            const raw = localStorage.getItem(storageKey);
            return raw ? new Set(JSON.parse(raw)) : new Set();
        } catch {
            return new Set();
        }
    });

    const toggle = useCallback((title: string) => {
        setPinned(prev => {
            const next = new Set(prev);
            if (next.has(title)) {
                next.delete(title);
            } else {
                next.add(title);
            }
            try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch {}
            return next;
        });
    }, [storageKey]);

    return { pinned, toggle };
}

// ─── Module tile ─────────────────────────────────────────────────────────────

interface ModuleTileProps {
    group: NavGroup;
    isActive: boolean;
    isPinned: boolean;
    onPin: (title: string) => void;
    onClick: () => void;
}

function ModuleTile({ group, isActive, isPinned, onPin, onClick }: ModuleTileProps) {
    const [hovered, setHovered] = useState(false);
    const ModuleIcon = group.moduleIcon || Box;

    return (
        <div
            className="relative"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <Link
                href={group.items[0]?.href ?? '#'}
                onClick={onClick}
                className={`flex flex-col rounded-lg border transition-all overflow-hidden ${
                    isActive
                        ? 'bg-studio-blue/10 border-studio-blue/30 text-studio-blue dark:text-studio-blue-muted'
                        : 'bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-300 hover:border-gray-300 dark:hover:border-neutral-600'
                }`}
                style={{ width: 93 }}
            >
                {/* Icon area — fixed height */}
                <div className="h-16 flex items-center justify-center">
                    <ModuleIcon size={24} className="shrink-0" />
                </div>
                {/* Label area — fixed height fits 2 lines */}
                <div className={`h-9 flex items-center justify-center border-t px-1.5 ${isActive ? 'border-studio-blue/20 bg-studio-blue/5' : 'border-gray-100 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900'}`}>
                    <span className="text-[10px] font-semibold text-center leading-tight line-clamp-2 w-full">
                        {group.title}
                    </span>
                </div>
            </Link>

            {/* Pin star — shown on hover or when pinned */}
            {(hovered || isPinned) && (
                <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPin(group.title); }}
                    className={`absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full transition-colors shadow-sm ${
                        isPinned
                            ? 'bg-amber-400 text-white hover:bg-amber-500'
                            : 'bg-white dark:bg-neutral-700 text-gray-400 hover:text-amber-400 border border-gray-200 dark:border-neutral-600'
                    }`}
                    title={isPinned ? 'Unpin' : 'Pin to top'}
                >
                    <Star size={10} className={isPinned ? 'fill-white' : ''} />
                </button>
            )}
        </div>
    );
}

// ─── App Menu popover ────────────────────────────────────────────────────────

interface AppMenuProps {
    groups: NavGroup[];
    pathname: string;
    baseUrl: string;
    siteId: string;
    onClose: () => void;
}

function AppMenu({ groups, pathname, baseUrl, siteId, onClose }: AppMenuProps) {
    const coreGroup = groups.find(g => !g.isModule);
    const moduleGroups = groups.filter(g => g.isModule);
    const { pinned, toggle } = usePinnedModules(siteId);

    const pinnedGroups = moduleGroups.filter(g => pinned.has(g.title));
    const allGroups = moduleGroups;

    return (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-2xl animate-in fade-in duration-150 flex overflow-hidden"
            style={{ width: 652 }}
        >
            {/* Left — Core */}
            <div className="w-44 border-r border-gray-100 dark:border-neutral-800 p-4 flex flex-col gap-0.5 shrink-0">
                {/* Brand */}
                <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
                    <div className="relative w-5 h-5 flex-shrink-0">
                        <Image src="/clicker_brand_logo.png" alt="Clicker" fill sizes="20px" className="object-contain rounded-full" />
                    </div>
                    <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Clicker</span>
                </div>

                <p className="px-2 pt-1 pb-1 text-[10px] font-bold text-gray-400 dark:text-neutral-600 uppercase tracking-wider">
                    Core
                </p>

                {coreGroup?.items.map(item => {
                    const isActive = pathname === item.href ||
                        (pathname?.startsWith(item.href) && item.href !== `${baseUrl}/admin`);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={onClose}
                            className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                                isActive
                                    ? 'bg-studio-blue text-white'
                                    : 'text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-brand-dark dark:hover:text-neutral-100'
                            }`}
                        >
                            <item.icon size={15} className="shrink-0" />
                            {item.label}
                        </Link>
                    );
                })}
            </div>

            {/* Right — Apps */}
            <div className="w-[476px] p-4 overflow-y-auto max-h-[480px]">
                <p className="px-1 pb-3 text-[10px] font-bold text-gray-400 dark:text-neutral-600 uppercase tracking-wider">
                    Apps
                </p>

                {/* Pinned */}
                {pinnedGroups.length > 0 && (
                    <div className="mb-5">
                        <div className="flex items-center gap-1 mb-3">
                            <Star size={10} className="text-amber-400 fill-amber-400" />
                            <span className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Pinned</span>
                        </div>
                        <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 93px)', gap: '20px' }}>
                            {pinnedGroups.map(group => {
                                const isActive = group.items.some(i =>
                                    pathname === i.href || pathname?.startsWith(i.href)
                                );
                                return (
                                    <ModuleTile
                                        key={group.title}
                                        group={group}
                                        isActive={isActive}
                                        isPinned={true}
                                        onPin={toggle}
                                        onClick={onClose}
                                    />
                                );
                            })}
                        </div>
                        <div className="h-px bg-gray-100 dark:bg-neutral-800 mt-4 mb-1" />
                    </div>
                )}

                {/* All */}
                <div>
                    {pinnedGroups.length > 0 && (
                        <span className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-2 block">All</span>
                    )}
                    <div className="flex flex-wrap gap-2">
                        {allGroups.map(group => {
                            const isActive = group.items.some(i =>
                                pathname === i.href || pathname?.startsWith(i.href)
                            );
                            return (
                                <ModuleTile
                                    key={group.title}
                                    group={group}
                                    isActive={isActive}
                                    isPinned={pinned.has(group.title)}
                                    onPin={toggle}
                                    onClick={onClose}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── AdminTopBar ─────────────────────────────────────────────────────────────

// Desktop only — mobile keeps its own header + MobileModuleTabBar
export function AdminTopBar() {
    const pathname = usePathname();
    const router = useRouter();
    const { siteId, tenantSlug, isSubdomain } = useSite();
    const { isDark, toggle: toggleDark } = useAdminTheme();
    const groups = useAdminNavGroups();
    const { slots } = useTopBarSlots();
    const { open: openInboxPanel } = useInboxPanel();
    const { unreadInbox } = useAdminUnreadCounts();
    const [appMenuOpen, setAppMenuOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const appMenuRef = useRef<HTMLDivElement>(null);
    const settingsRef = useRef<HTMLDivElement>(null);

    const baseUrl = (tenantSlug && !isSubdomain) ? `/${tenantSlug}` : '';

    const activeGroup = useMemo(
        () => resolveActiveGroup(groups, pathname ?? '', baseUrl),
        [groups, pathname, baseUrl],
    );

    const pageTitle = useMemo(
        () => resolvePageTitle(groups, pathname ?? '', baseUrl),
        [groups, pathname, baseUrl],
    );

    useEffect(() => {
        if (!appMenuOpen && !settingsOpen) return;
        const handler = (e: MouseEvent) => {
            if (appMenuRef.current && !appMenuRef.current.contains(e.target as Node)) {
                setAppMenuOpen(false);
            }
            if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
                setSettingsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [appMenuOpen, settingsOpen]);

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
            console.error('Logout failed:', error);
        }
    };

    const settingsLinks = [
        { icon: User, label: 'Account', href: '/admin/settings/account' },
        { icon: Building2, label: 'Business', href: '/admin/settings/business' },
        { icon: Users, label: 'Team', href: '/admin/settings/team' },
        { icon: Activity, label: 'AI Usage', href: '/admin/ai-usage' },
    ];

    return (
      <AICreditStatusProvider>
        <div className="hidden md:flex items-center justify-between px-3 h-12 bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 flex-shrink-0">

            {/* Left — app menu trigger + page title */}
            <div className="flex-1 flex items-center gap-2 min-w-0">
                <div ref={appMenuRef} className="relative flex-shrink-0">
                    <button
                        onClick={() => { setAppMenuOpen(prev => !prev); setSettingsOpen(false); }}
                        title="App menu"
                        className={`flex items-center justify-center p-1.5 rounded-lg transition-colors ${
                            appMenuOpen
                                ? 'bg-gray-200 dark:bg-neutral-700 text-neutral-900 dark:text-white'
                                : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-brand-dark dark:hover:text-neutral-200'
                        }`}
                    >
                        <LayoutGrid size={17} />
                    </button>

                    {appMenuOpen && (
                        <AppMenu
                            groups={groups}
                            pathname={pathname ?? ''}
                            baseUrl={baseUrl}
                            siteId={siteId ?? ''}
                            onClose={() => setAppMenuOpen(false)}
                        />
                    )}
                </div>

                {/* Page / module title */}
                {slots.left ?? (
                    <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200 truncate">
                        {activeGroup ? activeGroup.title : pageTitle}
                    </span>
                )}
            </div>

            {/* Center — slot overrides module tabs */}
            {slots.center ?? (activeGroup && (
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-800 rounded-lg p-1">
                    {activeGroup.items.map(item => {
                        const isActive =
                            pathname === item.href ||
                            (pathname?.startsWith(item.href) && item.href !== `${baseUrl}/admin`);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                                    isActive
                                        ? 'bg-gray-200 dark:bg-neutral-700 text-neutral-900 dark:text-white'
                                        : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                                }`}
                            >
                                <item.icon size={13} />
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            ))}

            {/* Right — page action slot + persistent controls */}
            <div className="flex-1 flex items-center justify-end gap-1">
                {slots.right}

                <AICreditPill />

                {/* Inbox */}
                <button
                    onClick={() => openInboxPanel()}
                    title="Inbox"
                    className="relative flex items-center justify-center p-2 rounded-lg text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-brand-dark dark:hover:text-neutral-200 transition-colors"
                >
                    <Inbox size={18} />
                    {unreadInbox > 0 && (
                        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-gray-50 dark:border-neutral-900" />
                    )}
                </button>

                {/* Settings */}
                <div ref={settingsRef} className="relative">
                    {settingsOpen && (
                        <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-xl p-1.5 min-w-[200px]">
                            {settingsLinks.map(({ icon: Icon, label, href }) => {
                                const fullHref = `${baseUrl}${href}`;
                                const isActive = pathname?.startsWith(fullHref);
                                return (
                                    <Link
                                        key={href}
                                        href={fullHref}
                                        onClick={() => setSettingsOpen(false)}
                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                                            isActive
                                                ? 'bg-studio-blue text-white'
                                                : 'text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700 hover:text-brand-dark dark:hover:text-neutral-100'
                                        }`}
                                    >
                                        <Icon size={15} className="shrink-0" />
                                        {label}
                                    </Link>
                                );
                            })}

                            <div className="my-1 h-px bg-gray-100 dark:bg-neutral-700" />

                            <button
                                onClick={toggleDark}
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
                        onClick={() => { setSettingsOpen(prev => !prev); setAppMenuOpen(false); }}
                        title="Settings"
                        className={`flex items-center justify-center p-2 rounded-lg transition-colors ${
                            settingsOpen
                                ? 'bg-gray-100 dark:bg-neutral-800 text-brand-dark dark:text-neutral-100'
                                : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-brand-dark dark:hover:text-neutral-200'
                        }`}
                    >
                        <User size={18} />
                    </button>
                </div>
            </div>
        </div>
      </AICreditStatusProvider>
    );
}
