'use client';

import { useState, useEffect, useMemo } from 'react';
import { NavigationItem } from '@/data/mockData';
import { logger } from '@/lib/logger-edge';

export interface TopNavActions {
    showSearch?: boolean;
    cta?: {
        enabled: boolean;
        label: string;
        linkType: 'url' | 'page' | 'form';
        linkValue: string;
        formId?: string | null;
        pageId?: string | null;
    };
}

export interface NavBarStyle {
    bgColor?: string;
    showBorder?: boolean;
}

export interface NavigationConfig {
    topNav: NavigationItem[];
    topNavActions: TopNavActions | null;
    bottomNav: NavigationItem[];
    fab: NavigationItem | null;
    headerStyle: NavBarStyle;
    bottomNavStyle: NavBarStyle;
    loading: boolean;
    error: Error | null;
}

export interface InitialNavData {
    topNav?: NavigationItem[];
    topNavActions?: TopNavActions | null;
    bottomNav?: NavigationItem[];
    fab?: NavigationItem | null;
    headerStyle?: NavBarStyle;
    bottomNavStyle?: NavBarStyle;
}

export function useNavigationConfig(siteId: string, initialData?: InitialNavData): NavigationConfig {
    const hasInitial = Boolean(initialData);

    const [topNav, setTopNav] = useState<NavigationItem[]>(initialData?.topNav ?? []);
    const [topNavActions, setTopNavActions] = useState<TopNavActions | null>(initialData?.topNavActions ?? null);
    const [bottomNav, setBottomNav] = useState<NavigationItem[]>(initialData?.bottomNav ?? []);
    const [fab, setFab] = useState<NavigationItem | null>(initialData?.fab ?? null);
    const [headerStyle, setHeaderStyle] = useState<NavBarStyle>(initialData?.headerStyle ?? {});
    const [bottomNavStyle, setBottomNavStyle] = useState<NavBarStyle>(initialData?.bottomNavStyle ?? {});
    const [loading, setLoading] = useState(!hasInitial);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        // If SSR data provided, skip Firestore listener — public page path
        if (hasInitial || !siteId) {
            setLoading(false);
            return;
        }

        // Admin/Canvas Studio path — keep realtime listener
        const loadFirestore = async () => {
            const { db } = await import('@/lib/firebase');
            const { doc, onSnapshot } = await import('firebase/firestore');

            const unsub = onSnapshot(
                doc(db, 'sites', siteId, 'content', 'siteSettings'),
                (snap) => {
                    if (snap.exists()) {
                        const nav = snap.data().navigation ?? {};
                        setTopNav(nav.topNav ?? []);
                        setTopNavActions(nav.topNavActions ?? null);
                        setBottomNav(nav.bottomNav ?? []);
                        setFab(nav.fab ?? null);
                        setHeaderStyle(nav.headerStyle ?? {});
                        setBottomNavStyle(nav.bottomNavStyle ?? {});
                    } else {
                        setTopNav([]);
                        setTopNavActions(null);
                        setBottomNav([]);
                        setFab(null);
                        setHeaderStyle({});
                        setBottomNavStyle({});
                    }
                    setLoading(false);
                },
                (err: unknown) => {
                    if ((err as { code?: string })?.code === 'unavailable') {
                        setLoading(false);
                        return;
                    }
                    logger.error('nav.config.fetch.failed', { siteId: siteId ?? 'platform', error: err });
                    setError(err as Error);
                    setLoading(false);
                }
            );

            return unsub;
        };

        let cleanup: (() => void) | undefined;
        loadFirestore().then((unsub) => { cleanup = unsub; });
        return () => { cleanup?.(); };
    }, [siteId, hasInitial]);

    return useMemo(
        () => ({ topNav, topNavActions, bottomNav, fab, headerStyle, bottomNavStyle, loading, error }),
        [topNav, topNavActions, bottomNav, fab, headerStyle, bottomNavStyle, loading, error]
    );
}
