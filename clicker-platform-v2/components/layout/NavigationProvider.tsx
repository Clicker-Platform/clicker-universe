'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { NavigationItem } from '@/data/mockData';
import { useNavigationConfig, TopNavActions } from '@/lib/hooks/useNavigationConfig';

interface NavigationContextType {
    topNav: NavigationItem[];
    topNavActions: TopNavActions | null;
    bottomNav: NavigationItem[];
    fab: NavigationItem | null;
    loading: boolean;
    error: Error | null;
    // Pre-fetched form data, keyed by formId — enables instant modal open on click
    formCache: Record<string, any>;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

export function NavigationProvider({ siteId, children }: { siteId: string; children: React.ReactNode }) {
    const config = useNavigationConfig(siteId);
    const [formCache, setFormCache] = useState<Record<string, any>>({});

    // Collect all form IDs referenced by nav items (top + bottom + CTA)
    const formIds = useMemo(() => {
        const ids = new Set<string>();
        const collect = (items: NavigationItem[]) => {
            items.forEach((item) => {
                if (item.type === 'form' && item.id) ids.add(item.id);
                // Also support formId field (used by some nav item shapes)
                const anyItem = item as any;
                if (anyItem.formId) ids.add(anyItem.formId);
            });
        };
        collect(config.topNav);
        collect(config.bottomNav);
        const cta = config.topNavActions?.cta;
        if (cta?.enabled && cta.linkType === 'form' && cta.formId) ids.add(cta.formId);
        return ids;
    }, [config.topNav, config.bottomNav, config.topNavActions]);

    // Pre-fetch all referenced forms
    const prefetchForms = useCallback(async () => {
        if (!siteId || formIds.size === 0) return;
        const missing = [...formIds].filter((id) => !formCache[id]);
        if (missing.length === 0) return;
        await Promise.allSettled(
            missing.map(async (formId) => {
                try {
                    const snap = await getDoc(doc(db, 'sites', siteId, 'forms', formId));
                    if (snap.exists() && snap.data().isPublished !== false) {
                        setFormCache((prev) => ({ ...prev, [formId]: { id: snap.id, ...snap.data() } }));
                    }
                } catch {
                    // Silent — on-click fallback handles misses
                }
            })
        );
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [siteId, formIds]);

    useEffect(() => {
        if (!config.loading) prefetchForms();
    }, [config.loading, prefetchForms]);

    const value = useMemo<NavigationContextType>(
        () => ({ ...config, formCache }),
        [config, formCache]
    );

    return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

const NAVIGATION_FALLBACK: NavigationContextType = {
    topNav: [],
    topNavActions: null,
    bottomNav: [],
    fab: null,
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
