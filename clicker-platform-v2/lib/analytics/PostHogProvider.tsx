'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, ReactNode } from 'react';
import { useSite } from '@/lib/site-context';

const PROD_PROJECT_ID = 'clicker-universe';
const IS_PROD = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === PROD_PROJECT_ID;
const POSTHOG_KEY = IS_PROD ? process.env.NEXT_PUBLIC_POSTHOG_KEY : undefined;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

function PostHogPageviewTracker() {
    const pathname = usePathname();
    const { siteId, isPending } = useSite();
    const lastPathname = useRef<string | null>(null);

    useEffect(() => {
        if (!POSTHOG_KEY) return;
        if (isPending || !siteId) return;
        if (pathname === lastPathname.current) return;
        lastPathname.current = pathname;
        posthog.capture('$pageview', { $current_url: window.location.href, siteId });
    }, [pathname, siteId, isPending]);

    return null;
}

export function PostHogProvider({ children }: { children: ReactNode }) {
    const { siteId, isPending } = useSite();

    useEffect(() => {
        if (!POSTHOG_KEY) return;
        posthog.init(POSTHOG_KEY, {
            api_host: POSTHOG_HOST,
            capture_pageview: false,
            persistence: 'localStorage',
        });
    }, []);

    useEffect(() => {
        if (!POSTHOG_KEY) return;
        if (isPending || !siteId) return;
        posthog.register({ siteId });
    }, [siteId, isPending]);

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
