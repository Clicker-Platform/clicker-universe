import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('posthog-js', () => ({
    default: {
        capture: vi.fn(),
        __loaded: true,
    },
}));

vi.mock('@/lib/site-context', () => ({
    useSite: () => ({ siteId: 'test-site-123' }),
}));

import posthog from 'posthog-js';
import { useAnalytics } from '../useAnalytics';

describe('useAnalytics', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls posthog.capture with event name and siteId', () => {
        const { result } = renderHook(() => useAnalytics());
        act(() => {
            result.current.capture('pos.order_completed', { total: 50000 });
        });
        expect(posthog.capture).toHaveBeenCalledWith('pos.order_completed', {
            siteId: 'test-site-123',
            total: 50000,
        });
    });

    it('injects siteId even when no extra properties are passed', () => {
        const { result } = renderHook(() => useAnalytics());
        act(() => {
            result.current.capture('pos.cashier_opened');
        });
        expect(posthog.capture).toHaveBeenCalledWith('pos.cashier_opened', {
            siteId: 'test-site-123',
        });
    });
});
