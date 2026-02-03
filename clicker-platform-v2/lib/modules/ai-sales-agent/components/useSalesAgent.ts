'use client';

import { useCallback } from 'react';

// Simple event-based trigger to avoid complex Context wrapping if not strictly needed
// Since the Widget is a singleton at Layout level, events work well.

export function useSalesAgent() {
    const openChat = useCallback(() => {
        window.dispatchEvent(new CustomEvent('ai-sales-agent:open'));
    }, []);

    return { openChat };
}
