import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAICreditStatus } from '@/lib/hooks/use-ai-credit-status';

// Mock site context
vi.mock('@/lib/site-context', () => ({
  useSite: () => ({ siteId: 'site-a' }),
}));

// Mock the site doc snapshot (which modules are enabled for THIS site)
let mockSiteModules: Record<string, boolean> = {};
vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<any>('firebase/firestore');
  return {
    ...actual,
    onSnapshot: (_ref: unknown, cb: (snap: any) => void) => {
      cb({
        exists: () => true,
        data: () => ({ modules: mockSiteModules }),
      });
      return () => {};
    },
    doc: () => ({}),
  };
});

vi.mock('@/lib/firebase', () => ({
  db: {},
  auth: { currentUser: { getIdToken: async () => 'tok' } },
}));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  sessionStorage.clear();
});
afterEach(() => { mockSiteModules = {}; });

describe('useAICreditStatus', () => {
  it('returns shouldRender=false and skips fetch when no AI module enabled', async () => {
    mockSiteModules = { pos: true, reservation: true };

    const { result } = renderHook(() => useAICreditStatus());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.shouldRender).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches and classifies as healthy when balance is ≥50% of baseline', async () => {
    mockSiteModules = { ai_sales_agent: true, pos: true };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ balance: 6.42, lifetimeUsed: 3.58 }),
    });

    const { result } = renderHook(() => useAICreditStatus());

    await waitFor(() => expect(result.current.shouldRender).toBe(true));
    expect(result.current.state).toBe('healthy');
    expect(result.current.balanceUSD).toBe(6.42);
    expect(result.current.balanceCredits).toBe(642);
  });

  it('classifies as warn between 10% and 50%', async () => {
    mockSiteModules = { stocklens: true };
    fetchMock.mockResolvedValueOnce({
      ok: true, json: async () => ({ balance: 1.8, lifetimeUsed: 8.2 }),
    });

    const { result } = renderHook(() => useAICreditStatus());
    await waitFor(() => expect(result.current.shouldRender).toBe(true));
    expect(result.current.state).toBe('warn');
  });

  it('classifies as critical below 10%', async () => {
    mockSiteModules = { stocklens: true };
    fetchMock.mockResolvedValueOnce({
      ok: true, json: async () => ({ balance: 0.6, lifetimeUsed: 9.4 }),
    });
    const { result } = renderHook(() => useAICreditStatus());
    await waitFor(() => expect(result.current.shouldRender).toBe(true));
    expect(result.current.state).toBe('critical');
  });

  it('classifies as out at zero', async () => {
    mockSiteModules = { stocklens: true };
    fetchMock.mockResolvedValueOnce({
      ok: true, json: async () => ({ balance: 0, lifetimeUsed: 10 }),
    });
    const { result } = renderHook(() => useAICreditStatus());
    await waitFor(() => expect(result.current.shouldRender).toBe(true));
    expect(result.current.state).toBe('out');
  });

  it('refetches on window focus', async () => {
    mockSiteModules = { stocklens: true };
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ balance: 5, lifetimeUsed: 5 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ balance: 4, lifetimeUsed: 6 }) });

    const { result } = renderHook(() => useAICreditStatus());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.balanceUSD).toBe(4));
  });

  it('hydrates from sessionStorage instantly and overwrites with fresh fetch', async () => {
    mockSiteModules = { stocklens: true };
    sessionStorage.setItem(
      'clicker_ai_credit_status_site-a',
      JSON.stringify({ balance: 9, lifetimeUsed: 1 }),
    );
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ balance: 7, lifetimeUsed: 3 }),
    });

    const { result } = renderHook(() => useAICreditStatus());

    // shouldRender flips true from the cached value before fetch resolves
    await waitFor(() => expect(result.current.shouldRender).toBe(true));
    // Eventually replaced by the fresh fetched value
    await waitFor(() => expect(result.current.balanceUSD).toBe(7));
    expect(JSON.parse(sessionStorage.getItem('clicker_ai_credit_status_site-a')!))
      .toEqual({ balance: 7, lifetimeUsed: 3 });
  });
});
