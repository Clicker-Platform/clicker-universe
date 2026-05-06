'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, ReactNode } from 'react';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

function PostHogPageviewTracker() {
    const pathname = usePathname();
    const lastPathname = useRef<string | null>(null);

    useEffect(() => {
        if (!POSTHOG_KEY) return;
        if (pathname === lastPathname.current) return;
        lastPathname.current = pathname;
        posthog.capture('$pageview', { $current_url: window.location.href });
    }, [pathname]);

    return null;
}

export function PostHogProvider({ children }: { children: ReactNode }) {
    useEffect(() => {
        if (!POSTHOG_KEY) return;
        posthog.init(POSTHOG_KEY, {
            api_host: POSTHOG_HOST,
            capture_pageview: false,
            persistence: 'localStorage',
        });
    }, []);

    if (!POSTHOG_KEY) {
        return <>{children}</>;
    }

    return (
        <PHProvider client={posthog}>
            <PostHogPageviewTracker />
            {children}
        </PHProvider>
    );
}
