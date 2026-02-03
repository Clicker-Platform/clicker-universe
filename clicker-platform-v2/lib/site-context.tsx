'use client';

import { createContext, useContext, ReactNode } from 'react';

interface SiteContextType {
    siteId: string;
    tenantSlug?: string;
}

const SiteContext = createContext<SiteContextType | undefined>(undefined);

export function SiteProvider({ siteId, tenantSlug, children }: { siteId: string, tenantSlug?: string, children: ReactNode }) {
    return (
        <SiteContext.Provider value={{ siteId, tenantSlug }}>
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
