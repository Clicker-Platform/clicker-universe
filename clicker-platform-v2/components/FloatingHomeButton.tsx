'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Home } from 'lucide-react';
import { useSite } from '@/lib/site-context';

export const FloatingHomeButton = () => {
    const pathname = usePathname();
    const router = useRouter();
    const { siteId } = useSite();

    // Don't render on server initially to avoid hydration mismatch on pathname
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;
    if (!siteId) return null;

    // Check if we are on the root tenant page
    // Pathname format: /tenantId or /tenantId/slug
    // We want to show this button if we are NOT on /tenantId (and not just /)

    // Normalize path logic
    const isRoot = pathname === `/${siteId}` || pathname === `/${siteId}/`;

    if (isRoot) return null;

    return (
        <button
            onClick={() => router.push(`/${siteId}`)}
            className="fixed bottom-6 left-6 z-50 bg-white border-[3px] border-brand-dark p-3 rounded-full shadow-sticker hover:scale-110 hover:-translate-y-1 transition-all duration-200 group"
            aria-label="Back to Home"
        >
            <Home size={24} className="text-brand-dark group-hover:text-brand-green relative z-10" />
            <div className="absolute inset-0 bg-brand-dark rounded-full scale-0 group-hover:scale-100 transition-transform origin-center duration-300 -z-0"></div>
            <Home size={24} className="text-brand-green absolute top-3 left-3 opacity-0 group-hover:opacity-100 z-20 transition-opacity duration-300" />
        </button>
    );
};
