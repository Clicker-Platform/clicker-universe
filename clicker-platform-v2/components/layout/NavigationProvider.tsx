'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { NavigationItem, HeaderNavigationConfig } from '@/data/mockData';
import { useNavigationConfig, TopNavActions, NavBarStyle, InitialNavData } from '@/lib/hooks/useNavigationConfig';

interface NavigationContextType {
    topNav: NavigationItem[];
    topNavActions: TopNavActions | null;
    bottomNav: NavigationItem[];
    fab: NavigationItem | null;
    headerStyle: NavBarStyle;
    bottomNavStyle: NavBarStyle;
    header: HeaderNavigationConfig;
    loading: boolean;
    error: Error | null;
    formCache: Record<string, any>;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

interface NavigationProviderProps {
    siteId: string;
    children: React.ReactNode;
    initialFormCache?: Record<string, any>;
    initialNavData?: InitialNavData;
}

export function NavigationProvider({ siteId, children, initialFormCache = {}, initialNavData }: NavigationProviderProps) {
    const config = useNavigationConfig(siteId, initialNavData);

    const value = useMemo<NavigationContextType>(
        () => ({ ...config, formCache: initialFormCache }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [config]
    );

    return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

const NAVIGATION_FALLBACK: NavigationContextType = {
    topNav: [],
    topNavActions: null,
    bottomNav: [],
    fab: null,
    headerStyle: {},
    bottomNavStyle: {},
    header: {
        variant: 'logo-left',
        width: 'constrained',
        scrollBehavior: 'fixed',
        items: [],
        cta: { enabled: false, label: '', linkType: 'url', linkValue: '' },
        typography: { preset: 'default' },
        scrolledAppearance: { enabled: false },
    },
    loading: false,
    error: null,
    formCache: {},
};

export function useNavigation(): NavigationContextType {
    const ctx = useContext(NavigationContext);
    if (!ctx) {
        if (process.env.NODE_ENV === 'development') {
            console.warn('useNavigation: called outside NavigationProvider, using fallback');
        }
        return NAVIGATION_FALLBACK;
    }
    return ctx;
}
