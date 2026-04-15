import { useCallback } from 'react';

type AnalyticsEvent =
    | { type: 'page_view' }
    | { type: 'link_click'; id: string }
    | { type: 'product_click'; id: string }
    | { type: 'view_all_click'; id: string };

export const useAnalytics = () => {
    const track = useCallback(async (event: AnalyticsEvent & { siteId: string }) => {
        if (typeof window === 'undefined') return;
        if (!event.siteId || event.siteId === 'pending' || event.siteId === 'default') return;

        try {
            // Fire and forget - don't await to avoid blocking UI
            fetch('/api/analytics/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event),
                keepalive: true // Ensure request completes even if page navigates away
            });
        } catch (error) {
            console.error('Track Error:', error);
        }
    }, []);

    return { track };
};
