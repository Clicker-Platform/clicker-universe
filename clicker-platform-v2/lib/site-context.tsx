'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface SiteContextType {
    siteId: string;
    tenantSlug: string;
    isPending: boolean;
    isSubdomain: boolean;
    setSiteId: (id: string) => void;
}

const SiteContext = createContext<SiteContextType | undefined>(undefined);

export function SiteProvider({ siteId: initialSiteId, tenantSlug = '', isSubdomain = false, children }: { siteId: string, tenantSlug?: string, isSubdomain?: boolean, children: ReactNode }) {
    const [siteId, setSiteId] = useState(initialSiteId);
    const isPending = !siteId || siteId === 'pending' || siteId === 'default';

    return (
        <SiteContext.Provider value={{ siteId, tenantSlug, isPending, isSubdomain, setSiteId }}>
            {children}
        </SiteContext.Provider>
    );
}

const SITE_FALLBACK: SiteContextType = { siteId: '', tenantSlug: '', isPending: true, isSubdomain: false };

export function useSite() {
    const context = useContext(SiteContext);
    // Return a safe fallback during HMR/SSR edge cases instead of crashing.
    // All callers already guard on isPending/siteId being empty.
    return context ?? SITE_FALLBACK;
}
