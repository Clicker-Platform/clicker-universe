import posthog from 'posthog-js';
import { useCallback } from 'react';
import { useSite } from '@/lib/site-context';

export function useAnalytics() {
    const { siteId } = useSite();

    const capture = useCallback((event: string, properties?: Record<string, unknown>) => {
        posthog.capture(event, { siteId, ...properties });
    }, [siteId]);

    return { capture };
}
