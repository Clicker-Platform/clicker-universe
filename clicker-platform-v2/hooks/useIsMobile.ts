'use client';

import { useEffect, useState } from 'react';

/**
 * Returns true when the viewport width is below the `md` breakpoint (768px).
 * Safe to use in SSR — defaults to false until the client hydrates.
 */
export function useIsMobile(breakpoint = 768): boolean {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < breakpoint);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, [breakpoint]);

    return isMobile;
}
