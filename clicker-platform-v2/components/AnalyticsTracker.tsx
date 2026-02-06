'use client';

import { useAnalytics } from '@/hooks/useAnalytics';
import { useSite } from '@/lib/site-context';
import { useEffect, useRef } from 'react';

export const AnalyticsTracker = () => {
    const { track } = useAnalytics();
    const { siteId } = useSite();
    const trackedRef = useRef(false);

    useEffect(() => {
        if (!trackedRef.current && siteId && siteId !== 'pending' && siteId !== 'default') {
            track({ type: 'page_view', siteId });
            trackedRef.current = true;
        }
    }, [track, siteId]);

    return null;
};
