'use client';

import { createContext, useContext, ReactNode } from 'react';

interface SiteContextType {
    siteId: string;
    tenantSlug?: string;
    isPending?: boolean;
}

const SiteContext = createContext<SiteContextType | undefined>(undefined);

export function SiteProvider({ siteId, tenantSlug, children }: { siteId: string, tenantSlug?: string, children: ReactNode }) {
    // Derived state for easier consumption
    // We treat 'default' as pending too, just in case legacy code passes it.
    const isPending = !siteId || siteId === 'pending' || siteId === 'default';

    return (
        <SiteContext.Provider value={{ siteId, tenantSlug, isPending }}>
            {children}
        </SiteContext.Provider>
    );
}

export function useSite() {
    const context = useContext(SiteContext);
    if (context === undefined) {
        throw new Error('useSite must be used within a SiteProvider');
    }
    return context;
}
