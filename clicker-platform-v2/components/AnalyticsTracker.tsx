'use client';

import { useAnalytics } from '@/hooks/useAnalytics';
import { useEffect, useRef } from 'react';

export const AnalyticsTracker = () => {
    const { track } = useAnalytics();
    const trackedRef = useRef(false);

    useEffect(() => {
        if (!trackedRef.current) {
            track({ type: 'page_view' });
            trackedRef.current = true;
        }
    }, [track]);

    return null;
};
