'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { NavigationItem } from '@/data/mockData';

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

export function useNavigationConfig(siteId: string): NavigationConfig {
    const [topNav, setTopNav] = useState<NavigationItem[]>([]);
    const [topNavActions, setTopNavActions] = useState<TopNavActions | null>(null);
    const [bottomNav, setBottomNav] = useState<NavigationItem[]>([]);
    const [fab, setFab] = useState<NavigationItem | null>(null);
    const [headerStyle, setHeaderStyle] = useState<NavBarStyle>({});
    const [bottomNavStyle, setBottomNavStyle] = useState<NavBarStyle>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!siteId) {
            setLoading(false);
            return;
        }

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
            (err: any) => {
                if (err?.code === 'unavailable') {
                    setLoading(false);
                    return;
                }
                console.error('useNavigationConfig: Firestore error', err);
                setError(err as Error);
                setLoading(false);
            }
        );

        return () => unsub();
    }, [siteId]);

    return useMemo(
        () => ({ topNav, topNavActions, bottomNav, fab, headerStyle, bottomNavStyle, loading, error }),
        [topNav, topNavActions, bottomNav, fab, headerStyle, bottomNavStyle, loading, error]
    );
}
