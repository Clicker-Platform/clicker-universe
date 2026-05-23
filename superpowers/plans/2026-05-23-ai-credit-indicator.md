# AI Credit Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the global red `AICreditBanner` with a calm, tenant-gated AI-credit status indicator: a small pill in the admin top bar and a card inside the app-launcher popover, both rendered only for tenants who have at least one AI-using module enabled, and displaying balance in friendly "credits" (rounded whole numbers) rather than raw USD.

**Architecture:**
- One pure helpers module for USD→credits display conversion (`lib/ai/credits-display.ts`).
- One client hook (`lib/hooks/use-ai-credit-status.ts`) that owns: gating (which tenants render the widget), fetching `/api/admin/ai-credits`, classifying the state, and refreshing on window focus.
- Two presentational components — `AICreditPill` (top-bar) and `AICreditCard` (launcher + popover-detail) — that consume the hook and render nothing when gating says no.
- One popover wrapper `AICreditPopover` that opens on pill click.
- Old `AICreditBanner` and its mount in `app/admin/(dashboard)/layout.tsx` are deleted.
- **No changes** to Firestore, `lib/ai/credits.ts`, or `/api/admin/ai-credits` route — storage and API stay in USD.

**Tech Stack:** Next.js (App Router) + React 18 client components, Tailwind (existing `studio-blue`, `brand-dark` tokens), `lucide-react` icons, Vitest for unit tests, Firebase Firestore via the existing `useSite` / `subscribeToEnabledModules` plumbing.

**Spec:** [`superpowers/specs/2026-05-23-ai-credit-indicator.md`](../specs/2026-05-23-ai-credit-indicator.md)

---

## File Structure

### New files

| File | Responsibility |
|------|----------------|
| `clicker-platform-v2/lib/ai/credits-display.ts` | Pure helpers + `USD_PER_CREDIT` constant. No React, no I/O. |
| `clicker-platform-v2/lib/ai/__tests__/credits-display.test.ts` | Unit tests for helpers. |
| `clicker-platform-v2/lib/hooks/use-ai-credit-status.ts` | Client hook: gating + fetch + classification + focus-refresh. |
| `clicker-platform-v2/lib/hooks/__tests__/use-ai-credit-status.test.tsx` | Hook tests. |
| `clicker-platform-v2/components/admin/ai-credit/AICreditPill.tsx` | Top-bar pill (button + ring + label). Returns `null` when gated out. |
| `clicker-platform-v2/components/admin/ai-credit/AICreditCard.tsx` | Reusable card (title row, progress bar, footer). Variants: `launcher` \| `popover`. |
| `clicker-platform-v2/components/admin/ai-credit/AICreditPopover.tsx` | Anchored popover containing `AICreditCard variant="popover"` + topup link. |
| `clicker-platform-v2/components/admin/ai-credit/constants.ts` | `AI_CONSUMER_MODULE_IDS` list + threshold constants. |

### Modified files

| File | Change |
|------|--------|
| `clicker-platform-v2/app/admin/(dashboard)/layout.tsx` | Remove `AICreditBanner` import + `<AICreditBanner />` line. |
| `clicker-platform-v2/components/admin/AdminTopBar.tsx` | Mount `<AICreditPill />` in the right-side controls cluster, immediately before the Inbox button. |
| `clicker-platform-v2/components/admin/AdminTopBar.tsx` (`AppMenu`) | Insert `<AICreditCard variant="launcher" />` inside the left "Core" column, directly under the brand row and before the `Core` section label. |

### Deleted files

| File | Reason |
|------|--------|
| `clicker-platform-v2/components/admin/AICreditBanner.tsx` | Replaced. No remaining consumers after layout change. |

---

## Task 1 — Display helpers + tests

**Files:**
- Create: `clicker-platform-v2/lib/ai/credits-display.ts`
- Test: `clicker-platform-v2/lib/ai/__tests__/credits-display.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `clicker-platform-v2/lib/ai/__tests__/credits-display.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  USD_PER_CREDIT,
  usdToCredits,
  formatCredits,
  formatCreditsShort,
} from '@/lib/ai/credits-display';

describe('credits-display', () => {
  it('exposes the peg as 0.01', () => {
    expect(USD_PER_CREDIT).toBe(0.01);
  });

  it('converts USD to whole credits via rounding', () => {
    expect(usdToCredits(6.42)).toBe(642);
    expect(usdToCredits(0)).toBe(0);
    expect(usdToCredits(0.004)).toBe(0);    // rounds down
    expect(usdToCredits(0.005)).toBe(1);    // rounds up at .5
    expect(usdToCredits(9.999)).toBe(1000); // 999.9 → 1000
  });

  it('clamps negative balances to 0 credits', () => {
    expect(usdToCredits(-1)).toBe(0);
    expect(usdToCredits(-0.0001)).toBe(0);
  });

  it('formatCredits returns full thousand-separated string with "credits"', () => {
    expect(formatCredits(6.42)).toBe('642 credits');
    expect(formatCredits(124)).toBe('12,400 credits');
    expect(formatCredits(0)).toBe('0 credits');
  });

  it('formatCreditsShort abbreviates >= 10,000 credits with k', () => {
    expect(formatCreditsShort(6.42)).toBe('642');
    expect(formatCreditsShort(99.99)).toBe('9,999');
    expect(formatCreditsShort(100)).toBe('10k');
    expect(formatCreditsShort(124)).toBe('12.4k');
    expect(formatCreditsShort(1000)).toBe('100k');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/ai/__tests__/credits-display.test.ts`
Expected: FAIL — module `@/lib/ai/credits-display` does not resolve.

- [ ] **Step 3: Implement the helpers**

Create `clicker-platform-v2/lib/ai/credits-display.ts`:

```ts
/**
 * AI credit display helpers.
 *
 * Storage is in raw USD (see lib/ai/credits.ts). Display is in whole "credits"
 * via a single peg below. To re-tune the peg later, change ONLY this constant —
 * no schema migration required.
 *
 * See spec: superpowers/specs/2026-05-23-ai-credit-indicator.md
 */

export const USD_PER_CREDIT = 0.01;

export function usdToCredits(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0;
  return Math.round(usd / USD_PER_CREDIT);
}

export function formatCredits(usd: number): string {
  return `${usdToCredits(usd).toLocaleString('en-US')} credits`;
}

export function formatCreditsShort(usd: number): string {
  const n = usdToCredits(usd);
  if (n >= 10_000) {
    const k = n / 1_000;
    // 1 decimal, strip trailing ".0"
    return `${k.toFixed(1).replace(/\.0$/, '')}k`;
  }
  return n.toLocaleString('en-US');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/ai/__tests__/credits-display.test.ts`
Expected: PASS — 5/5 tests green.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/ai/credits-display.ts clicker-platform-v2/lib/ai/__tests__/credits-display.test.ts
git commit -m "feat(ai-credits): add USD→credits display helpers with peg constant"
```

---

## Task 2 — Constants module

**Files:**
- Create: `clicker-platform-v2/components/admin/ai-credit/constants.ts`

- [ ] **Step 1: Create the constants file**

Create `clicker-platform-v2/components/admin/ai-credit/constants.ts`:

```ts
/**
 * Constants for the AI credit indicator system.
 *
 * AI_CONSUMER_MODULE_IDS: any tenant with ≥1 of these modules enabled will see
 * the credit indicator. When a new AI-consuming module is added (knowledge sync,
 * future modules), append its ID here.
 *
 * Thresholds are absolute-fallback values, used when no per-tenant baseline
 * (last topup or monthly grant) is recoverable. See spec §States.
 */

export const AI_CONSUMER_MODULE_IDS = [
  'ai_sales_agent',
  'stocklens',
  // 'knowledge_sync', // add when shipped
] as const;

// Percent thresholds (of recovered baseline) for color states.
export const PCT_WARN = 0.50;
export const PCT_CRITICAL = 0.10;

// Absolute-USD fallback thresholds, used when no baseline is available.
export const USD_WARN_FALLBACK = 5.0;    // 500 credits
export const USD_CRITICAL_FALLBACK = 1.0; // 100 credits
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/components/admin/ai-credit/constants.ts
git commit -m "feat(ai-credits): add indicator constants (consumer module list, thresholds)"
```

---

## Task 3 — `useAICreditStatus` hook + tests

**Files:**
- Create: `clicker-platform-v2/lib/hooks/use-ai-credit-status.ts`
- Test: `clicker-platform-v2/lib/hooks/__tests__/use-ai-credit-status.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `clicker-platform-v2/lib/hooks/__tests__/use-ai-credit-status.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAICreditStatus } from '@/lib/hooks/use-ai-credit-status';

// Mock site context
vi.mock('@/lib/site-context', () => ({
  useSite: () => ({ siteId: 'site-a' }),
}));

// Mock module-enabled subscription (returns whatever we set on this var)
let mockEnabledModuleIds: string[] = [];
vi.mock('@/lib/modules/registry', () => ({
  subscribeToEnabledModules: (cb: (mods: Array<{ id: string }>) => void) => {
    cb(mockEnabledModuleIds.map(id => ({ id })));
    return () => {};
  },
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
});
afterEach(() => { mockSiteModules = {}; mockEnabledModuleIds = []; });

describe('useAICreditStatus', () => {
  it('returns shouldRender=false and skips fetch when no AI module enabled', async () => {
    mockEnabledModuleIds = ['pos', 'reservation'];
    mockSiteModules = { pos: true, reservation: true };

    const { result } = renderHook(() => useAICreditStatus());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.shouldRender).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches and classifies as healthy when balance is ≥50% of baseline', async () => {
    mockEnabledModuleIds = ['ai_sales_agent', 'pos'];
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
    mockEnabledModuleIds = ['stocklens'];
    mockSiteModules = { stocklens: true };
    fetchMock.mockResolvedValueOnce({
      ok: true, json: async () => ({ balance: 1.8, lifetimeUsed: 8.2 }),
    });

    const { result } = renderHook(() => useAICreditStatus());
    await waitFor(() => expect(result.current.shouldRender).toBe(true));
    expect(result.current.state).toBe('warn');
  });

  it('classifies as critical below 10%', async () => {
    mockEnabledModuleIds = ['stocklens'];
    mockSiteModules = { stocklens: true };
    fetchMock.mockResolvedValueOnce({
      ok: true, json: async () => ({ balance: 0.6, lifetimeUsed: 9.4 }),
    });
    const { result } = renderHook(() => useAICreditStatus());
    await waitFor(() => expect(result.current.shouldRender).toBe(true));
    expect(result.current.state).toBe('critical');
  });

  it('classifies as out at zero', async () => {
    mockEnabledModuleIds = ['stocklens'];
    mockSiteModules = { stocklens: true };
    fetchMock.mockResolvedValueOnce({
      ok: true, json: async () => ({ balance: 0, lifetimeUsed: 10 }),
    });
    const { result } = renderHook(() => useAICreditStatus());
    await waitFor(() => expect(result.current.shouldRender).toBe(true));
    expect(result.current.state).toBe('out');
  });

  it('refetches on window focus', async () => {
    mockEnabledModuleIds = ['stocklens'];
    mockSiteModules = { stocklens: true };
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ balance: 5, lifetimeUsed: 5 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ balance: 4, lifetimeUsed: 6 }) });

    const { result } = renderHook(() => useAICreditStatus());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.balanceUSD).toBe(4));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/hooks/__tests__/use-ai-credit-status.test.tsx`
Expected: FAIL — module `@/lib/hooks/use-ai-credit-status` does not resolve.

- [ ] **Step 3: Implement the hook**

Create `clicker-platform-v2/lib/hooks/use-ai-credit-status.ts`:

```ts
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';
import { subscribeToEnabledModules } from '@/lib/modules/registry';
import { usdToCredits } from '@/lib/ai/credits-display';
import {
  AI_CONSUMER_MODULE_IDS,
  PCT_WARN,
  PCT_CRITICAL,
  USD_WARN_FALLBACK,
  USD_CRITICAL_FALLBACK,
} from '@/components/admin/ai-credit/constants';

export type CreditState = 'healthy' | 'warn' | 'critical' | 'out';

export interface AICreditStatus {
  loading: boolean;
  shouldRender: boolean;
  state: CreditState;
  balanceUSD: number;
  balanceCredits: number;
  /** 0–1, undefined if no baseline known */
  pct: number | undefined;
  refresh: () => void;
}

interface ApiResponse { balance: number; lifetimeUsed: number; }

function classify(balanceUSD: number, lifetimeUsedUSD: number): { state: CreditState; pct: number | undefined } {
  if (balanceUSD <= 0) return { state: 'out', pct: 0 };

  // Baseline = highest "full tank" we've seen for this tenant.
  // lifetimeUsed + balance is a decent proxy for "everything ever granted".
  const baseline = lifetimeUsedUSD + balanceUSD;
  if (baseline > 0) {
    const pct = balanceUSD / baseline;
    if (pct < PCT_CRITICAL) return { state: 'critical', pct };
    if (pct < PCT_WARN) return { state: 'warn', pct };
    return { state: 'healthy', pct };
  }

  // Fallback when no usage history yet
  if (balanceUSD <= USD_CRITICAL_FALLBACK) return { state: 'critical', pct: undefined };
  if (balanceUSD <= USD_WARN_FALLBACK) return { state: 'warn', pct: undefined };
  return { state: 'healthy', pct: undefined };
}

export function useAICreditStatus(): AICreditStatus {
  const { siteId } = useSite();
  const [registeredModules, setRegisteredModules] = useState<Set<string>>(new Set());
  const [siteEnabled, setSiteEnabled] = useState<Record<string, boolean>>({});
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0); // bumped by refresh() / focus

  // Subscribe to globally-registered modules
  useEffect(() => {
    const unsub = subscribeToEnabledModules((mods) => {
      setRegisteredModules(new Set(mods.map(m => m.id)));
    });
    return () => unsub();
  }, []);

  // Subscribe to per-site module flags
  useEffect(() => {
    if (!siteId || siteId === 'default' || siteId === 'pending') return;
    const unsub = onSnapshot(doc(db, 'sites', siteId), (snap) => {
      if (!snap.exists()) { setSiteEnabled({}); return; }
      const d = snap.data() as { modules?: Record<string, boolean>; settings?: { modules?: Record<string, boolean> } };
      setSiteEnabled({ ...(d.settings?.modules ?? {}), ...(d.modules ?? {}) });
    });
    return () => unsub();
  }, [siteId]);

  const shouldRender = useMemo(() => {
    for (const id of AI_CONSUMER_MODULE_IDS) {
      if (registeredModules.has(id) && siteEnabled[id]) return true;
    }
    // Safety: a tenant with debt should still see the indicator even if they
    // disabled the AI module after the balance went negative.
    if (data && data.balance < 0) return true;
    return false;
  }, [registeredModules, siteEnabled, data]);

  // Fetch when gating allows
  useEffect(() => {
    if (!shouldRender || !siteId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) { setLoading(false); return; }
        const res = await fetch('/api/admin/ai-credits', {
          headers: { Authorization: `Bearer ${token}`, 'x-site-id': siteId },
        });
        if (!res.ok) { setLoading(false); return; }
        const json = (await res.json()) as ApiResponse;
        if (!cancelled) { setData(json); setLoading(false); }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [shouldRender, siteId, tick]);

  // Refresh on tab becoming visible
  useEffect(() => {
    if (!shouldRender) return;
    const onVis = () => {
      if (document.visibilityState === 'visible') setTick(t => t + 1);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [shouldRender]);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  const balanceUSD = data?.balance ?? 0;
  const lifetimeUsedUSD = data?.lifetimeUsed ?? 0;
  const { state, pct } = classify(balanceUSD, lifetimeUsedUSD);

  return {
    loading,
    shouldRender,
    state,
    balanceUSD,
    balanceCredits: usdToCredits(balanceUSD),
    pct,
    refresh,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/hooks/__tests__/use-ai-credit-status.test.tsx`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/hooks/use-ai-credit-status.ts \
        clicker-platform-v2/lib/hooks/__tests__/use-ai-credit-status.test.tsx
git commit -m "feat(ai-credits): add useAICreditStatus hook with tenant gating + focus refresh"
```

---

## Task 4 — `AICreditCard` component

**Files:**
- Create: `clicker-platform-v2/components/admin/ai-credit/AICreditCard.tsx`

- [ ] **Step 1: Implement the card**

Create `clicker-platform-v2/components/admin/ai-credit/AICreditCard.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { Zap } from 'lucide-react';
import { useAICreditStatus, type CreditState } from '@/lib/hooks/use-ai-credit-status';
import { formatCredits } from '@/lib/ai/credits-display';
import { useSite } from '@/lib/site-context';

interface Props {
  variant: 'launcher' | 'popover';
  onNavigate?: () => void;
}

const STATE_CLASSES: Record<CreditState, { card: string; bar: string; foot: string; dot: string }> = {
  healthy: {
    card: 'bg-gray-50 dark:bg-neutral-800/50 border-gray-200 dark:border-neutral-700',
    bar: 'bg-studio-blue',
    foot: 'text-gray-400 dark:text-neutral-500',
    dot: 'bg-gray-400 dark:bg-neutral-500',
  },
  warn: {
    card: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60',
    bar: 'bg-amber-500',
    foot: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  critical: {
    card: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/60',
    bar: 'bg-red-500',
    foot: 'text-red-700 dark:text-red-400 font-semibold',
    dot: 'bg-red-500 animate-pulse',
  },
  out: {
    card: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/60',
    bar: 'bg-red-500',
    foot: 'text-red-700 dark:text-red-400 font-semibold',
    dot: 'bg-red-500 animate-pulse',
  },
};

function footerText(state: CreditState): string {
  switch (state) {
    case 'healthy': return 'AI credits available';
    case 'warn':    return 'Running low — top up soon';
    case 'critical':return 'Critical — top up now';
    case 'out':     return 'AI features paused — top up to resume';
  }
}

export function AICreditCard({ variant, onNavigate }: Props) {
  const status = useAICreditStatus();
  const { tenantSlug, isSubdomain } = useSite();
  if (!status.shouldRender || status.loading) return null;

  const { state, balanceUSD, balanceCredits, pct } = status;
  const cls = STATE_CLASSES[state];

  // Bar fill: pct when known, else min 100% (healthy) / 0% (out) / proportional fallback
  const barPct = pct !== undefined
    ? Math.max(0, Math.min(1, pct)) * 100
    : (state === 'out' ? 0 : state === 'critical' ? 5 : state === 'warn' ? 25 : 100);

  const baseUrl = (tenantSlug && !isSubdomain) ? `/${tenantSlug}` : '';
  const usageHref = `${baseUrl}/admin/ai-usage`;

  const inner = (
    <div className={`block w-full rounded-lg border px-3 py-2.5 transition-colors hover:brightness-[.98] ${cls.card}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
          <Zap size={11} className="text-studio-blue" />
          AI Credits
        </div>
        <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-100 tabular-nums">
          {formatCredits(balanceUSD)}
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-gray-200 dark:bg-neutral-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${cls.bar}`}
          style={{ width: `${barPct}%` }}
        />
      </div>
      <div className={`mt-1.5 flex items-center gap-1.5 text-[11px] ${cls.foot}`}>
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${cls.dot}`} aria-hidden="true" />
        {footerText(state)}
        {variant === 'popover' && state !== 'healthy' && (
          <span className="ml-auto opacity-75">{balanceCredits.toLocaleString('en-US')} credits</span>
        )}
      </div>
    </div>
  );

  return (
    <Link
      href={usageHref}
      onClick={onNavigate}
      className="block"
      aria-label={`AI credits: ${balanceCredits} remaining, status ${state}`}
    >
      {inner}
    </Link>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit`
Expected: PASS — no errors. (If `tsc --noEmit` is slow, run `pnpm lint` instead, which Next.js wires to type-check changed files.)

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/components/admin/ai-credit/AICreditCard.tsx
git commit -m "feat(ai-credits): add AICreditCard component (launcher + popover variants)"
```

---

## Task 5 — `AICreditPopover` component

**Files:**
- Create: `clicker-platform-v2/components/admin/ai-credit/AICreditPopover.tsx`

- [ ] **Step 1: Implement the popover**

Create `clicker-platform-v2/components/admin/ai-credit/AICreditPopover.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { AICreditCard } from './AICreditCard';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AICreditPopover({ open, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="AI credit details"
      className="absolute right-0 top-full mt-1 z-50 w-72 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-2xl p-3 animate-in fade-in duration-150"
    >
      <AICreditCard variant="popover" onNavigate={onClose} />

      <p className="mt-2.5 text-[11px] leading-relaxed text-gray-500 dark:text-neutral-400">
        Used by AI Sales Agent, Stocklens scanner, and other AI features.
      </p>

      <div className="mt-2.5 flex items-center justify-between text-xs">
        <span className="text-gray-500 dark:text-neutral-400">Need more?</span>
        <a
          href="mailto:support@clicker.id?subject=AI%20Credit%20Top-up"
          className="font-semibold text-studio-blue hover:underline"
        >
          Contact admin →
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/components/admin/ai-credit/AICreditPopover.tsx
git commit -m "feat(ai-credits): add AICreditPopover anchored to pill"
```

---

## Task 6 — `AICreditPill` component

**Files:**
- Create: `clicker-platform-v2/components/admin/ai-credit/AICreditPill.tsx`

- [ ] **Step 1: Implement the pill**

Create `clicker-platform-v2/components/admin/ai-credit/AICreditPill.tsx`:

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { useAICreditStatus, type CreditState } from '@/lib/hooks/use-ai-credit-status';
import { formatCreditsShort } from '@/lib/ai/credits-display';
import { AICreditPopover } from './AICreditPopover';

const PILL_CLASSES: Record<CreditState, string> = {
  healthy:  'border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-700',
  warn:     'border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/50',
  critical: 'border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50',
  out:      'border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50',
};

const RING_CLASSES: Record<CreditState, string> = {
  healthy: 'text-studio-blue',
  warn: 'text-amber-500',
  critical: 'text-red-500',
  out: 'text-red-500',
};

export function AICreditPill() {
  const status = useAICreditStatus();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Defensive: close popover if gating flips to false mid-session
  useEffect(() => { if (!status.shouldRender) setOpen(false); }, [status.shouldRender]);

  if (!status.shouldRender || status.loading) return null;

  const { state, balanceUSD, balanceCredits } = status;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={`AI credits: ${balanceCredits} remaining`}
        aria-expanded={open}
        title={`AI credits: ${balanceCredits.toLocaleString('en-US')} remaining`}
        className={`flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-xs font-semibold tabular-nums transition-colors ${PILL_CLASSES[state]}`}
      >
        <Zap size={12} className={RING_CLASSES[state]} />
        <span>{formatCreditsShort(balanceUSD)}</span>
        {state === 'out' && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse ml-0.5" aria-hidden="true" />
        )}
      </button>

      <AICreditPopover open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/components/admin/ai-credit/AICreditPill.tsx
git commit -m "feat(ai-credits): add AICreditPill top-bar component"
```

---

## Task 7 — Wire pill into `AdminTopBar`

**Files:**
- Modify: `clicker-platform-v2/components/admin/AdminTopBar.tsx`

- [ ] **Step 1: Add the import**

In `clicker-platform-v2/components/admin/AdminTopBar.tsx`, find the import block (around line 1–15) and add after the existing relative imports:

```tsx
import { AICreditPill } from '@/components/admin/ai-credit/AICreditPill';
import { AICreditCard } from '@/components/admin/ai-credit/AICreditCard';
```

- [ ] **Step 2: Mount the pill in the right-side cluster**

In the same file, find the right-side controls block. It currently begins around line 389:

```tsx
{/* Right — page action slot + persistent controls */}
<div className="flex-1 flex items-center justify-end gap-1">
    {slots.right}

    {/* Inbox */}
    <button
        onClick={() => openInboxPanel()}
```

Insert `<AICreditPill />` immediately before the Inbox button (after the `{slots.right}` line):

```tsx
{/* Right — page action slot + persistent controls */}
<div className="flex-1 flex items-center justify-end gap-1">
    {slots.right}

    <AICreditPill />

    {/* Inbox */}
    <button
        onClick={() => openInboxPanel()}
```

- [ ] **Step 3: Mount the card in the launcher's Core column**

In the same file, find the `AppMenu` component (around line 146). Locate the "Brand" block:

```tsx
{/* Brand */}
<div className="flex items-center gap-2 px-2 py-1.5 mb-2">
    <div className="relative w-5 h-5 flex-shrink-0">
        <Image src="/clicker_brand_logo.png" alt="Clicker" fill sizes="20px" className="object-contain rounded-full" />
    </div>
    <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Clicker</span>
</div>

<p className="px-2 pt-1 pb-1 text-[10px] font-bold text-gray-400 dark:text-neutral-600 uppercase tracking-wider">
    Core
</p>
```

Insert the card between the Brand div and the "Core" `<p>`:

```tsx
{/* Brand */}
<div className="flex items-center gap-2 px-2 py-1.5 mb-2">
    <div className="relative w-5 h-5 flex-shrink-0">
        <Image src="/clicker_brand_logo.png" alt="Clicker" fill sizes="20px" className="object-contain rounded-full" />
    </div>
    <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Clicker</span>
</div>

{/* AI credit card — renders null for tenants without AI modules */}
<div className="px-1 mb-2">
    <AICreditCard variant="launcher" onNavigate={onClose} />
</div>

<p className="px-2 pt-1 pb-1 text-[10px] font-bold text-gray-400 dark:text-neutral-600 uppercase tracking-wider">
    Core
</p>
```

- [ ] **Step 4: Type-check**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit`
Expected: PASS — no errors.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/components/admin/AdminTopBar.tsx
git commit -m "feat(ai-credits): mount pill in top bar and card in launcher popover"
```

---

## Task 8 — Remove the old banner

**Files:**
- Modify: `clicker-platform-v2/app/admin/(dashboard)/layout.tsx`
- Delete: `clicker-platform-v2/components/admin/AICreditBanner.tsx`

- [ ] **Step 1: Remove the import line**

In `clicker-platform-v2/app/admin/(dashboard)/layout.tsx`, delete this line (currently line 13):

```tsx
import { AICreditBanner } from '@/components/admin/AICreditBanner';
```

- [ ] **Step 2: Remove the `<AICreditBanner />` render**

In the same file, delete this line inside `AdminContentWrapper` (currently line 24):

```tsx
<AICreditBanner />
```

The block should now read:

```tsx
<div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
    <AdminTopBar />
    <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 text-neutral-900 dark:text-neutral-100">
        {children}
    </main>
</div>
```

- [ ] **Step 3: Verify nothing else imports the banner**

Run: `cd clicker-platform-v2 && grep -rn "AICreditBanner" --include="*.tsx" --include="*.ts" .`
Expected: NO results (after the layout edit above). If anything else still imports it, fix that consumer first.

- [ ] **Step 4: Delete the file**

```bash
rm clicker-platform-v2/components/admin/AICreditBanner.tsx
```

- [ ] **Step 5: Type-check + lint**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit && pnpm lint`
Expected: PASS — no errors.

- [ ] **Step 6: Commit**

```bash
git add clicker-platform-v2/app/admin/(dashboard)/layout.tsx clicker-platform-v2/components/admin/AICreditBanner.tsx
git commit -m "feat(ai-credits): remove legacy AICreditBanner (replaced by indicator system)"
```

---

## Task 9 — Manual verification in the browser

This task is not coverable by unit tests — it confirms the UI actually behaves correctly across tenants and states.

**Files:** none.

- [ ] **Step 1: Start the dev server**

```bash
cd clicker-platform-v2 && pnpm dev
```

Open http://localhost:3000 and log into a tenant.

- [ ] **Step 2: Verify a non-AI tenant sees nothing**

Pick a tenant with `ai_sales_agent`, `stocklens`, etc. all disabled. (Toggle via Backyard if needed.)

- [ ] Confirm: no red banner anywhere (the old global banner is gone for everyone).
- [ ] Confirm: no pill in the top bar.
- [ ] Confirm: open the app launcher (top-left grid icon) — no AI credit card between the brand row and "CORE" section.

- [ ] **Step 3: Verify an AI tenant sees the indicator**

Switch to a tenant with `ai_sales_agent` or `stocklens` enabled and `balance > 0` in Firestore at `sites/{id}/platform/aiCredits`.

- [ ] Confirm: pill renders left of the Inbox icon, e.g. `⚡ 642`.
- [ ] Confirm: open launcher — card renders directly below the brand row.
- [ ] Confirm: click the pill — popover opens with the card + contact-admin link.
- [ ] Confirm: clicking the card (in either surface) navigates to `/admin/ai-usage` (or the tenant's equivalent base-url variant).

- [ ] **Step 4: Verify the four states by editing Firestore**

For the AI tenant above, edit `sites/{siteId}/platform/aiCredits.balance` in Firestore:

| Set `balance` to | Expected state |
|------------------|----------------|
| `9.5` (with `lifetimeUsed: 0.5`) | Healthy — slate/blue pill, neutral card |
| `3.0` (with `lifetimeUsed: 7.0`) | Warn — amber tint, no animation |
| `0.5` (with `lifetimeUsed: 9.5`) | Critical — red tint, pulsing dot in card footer |
| `0` | Out — red pill with pulsing red dot, "AI features paused" footer |

After each edit, switch back to the browser tab (this triggers the visibility-change refresh) and confirm the pill + card colors update.

- [ ] **Step 5: Verify dark mode**

Toggle dark mode from the user menu. Confirm pill, card, and popover all have legible dark-mode styling at each state.

- [ ] **Step 6: Verify no console errors**

Open browser devtools. Navigate around 3–4 admin pages. Confirm no errors mentioning `AICredit*` or `ai-credits`.

- [ ] **Step 7: Commit the manual-verification artifact (optional)**

No code changes — nothing to commit. If you took screenshots, drop them in `superpowers/notes/2026-05-23-ai-credit-indicator-verification.md` and commit.

---

## Task 10 — Final sweep

- [ ] **Step 1: Re-run full test suite**

```bash
cd clicker-platform-v2 && pnpm test
```

Expected: PASS — all existing tests + the 2 new test files (`credits-display.test.ts`, `use-ai-credit-status.test.tsx`) green.

- [ ] **Step 2: Lint**

```bash
cd clicker-platform-v2 && pnpm lint
```

Expected: PASS — no errors.

- [ ] **Step 3: Confirm no `AICreditBanner` references remain anywhere**

```bash
grep -rn "AICreditBanner" /Users/andre/Repository/clicker-universe/dev --include="*.tsx" --include="*.ts" --include="*.md"
```

Expected: only matches inside `superpowers/specs/` and `superpowers/plans/` (historical docs are fine). No code matches.

- [ ] **Step 4: Confirm no raw-USD banner copy remains**

```bash
grep -rn "Kredit AI habis\|Saldo AI tersisa" /Users/andre/Repository/clicker-universe/dev/clicker-platform-v2
```

Expected: NO matches.

- [ ] **Step 5: Done — open a PR**

```bash
git push -u origin $(git branch --show-current)
gh pr create --title "feat(ai-credits): replace banner with tenant-gated indicator (pill + launcher card)" --body "$(cat <<'EOF'
## Summary
- Replaces the global red `AICreditBanner` (rendered on every admin page) with a calm, tenant-gated indicator
- Top-bar pill (always visible) + launcher-popover card, both render only when the tenant has ≥1 AI-using module enabled
- Displays balance in friendly "credits" (1 credit = $0.01) instead of raw fractional USD
- Storage / API / `lib/ai/credits.ts` unchanged — display conversion only

## Test plan
- [ ] `pnpm test` passes (2 new test files)
- [ ] Non-AI tenant: no pill, no card, no banner
- [ ] AI tenant: pill + card render in slate; warn at <50%, critical at <10%, out at 0
- [ ] Dark mode legible at all states
- [ ] Visibility-change refresh updates the indicator without reload
EOF
)"
```

---

## Self-review

**Spec coverage (against [`superpowers/specs/2026-05-23-ai-credit-indicator.md`](../specs/2026-05-23-ai-credit-indicator.md)):**

| Spec section | Covered by |
|--------------|------------|
| Top-bar pill | Task 6 + Task 7 step 2 |
| Launcher-popover card | Task 4 + Task 7 step 3 |
| Pill-click popover | Task 5 |
| 4 states (healthy/warn/critical/out) | Task 4 (STATE_CLASSES) + Task 6 (PILL_CLASSES) + Task 3 (classify) |
| Color-only signal, no banner, pulsing dot only in crit/out | Task 4 (dot uses `animate-pulse` only on crit/out) |
| `USD_PER_CREDIT = 0.01` peg + helpers | Task 1 |
| Storage stays in USD, display in credits | Task 1 + Task 3 (`balanceCredits` derived) |
| Whole-credit display, no fractions | Task 1 (`Math.round`) + tests |
| `shouldRender` rule with AI consumer modules | Task 2 (constants) + Task 3 (hook) |
| Non-AI tenants see nothing | Task 3 (`shouldRender=false` → no fetch) + Task 4/6 (return `null`) |
| Old banner deleted, not gated | Task 8 |
| Refresh on focus, no polling | Task 3 (visibility-change listener) |
| Accessibility (aria-label, aria-expanded, aria-hidden) | Tasks 4, 5, 6 |
| Out-of-scope items (per-module breakdown, topup flow, email digest, etc.) | Explicitly not in plan — correct |

**Placeholder scan:** No `TBD`, `TODO`, "add appropriate error handling", or "similar to Task N" language. Every code step has the full code.

**Type consistency:** `CreditState` exported from the hook and re-imported by Card + Pill. `useAICreditStatus` return shape used identically in all three consumers. `formatCredits` vs `formatCreditsShort` used per spec (card = full, pill = short).

**Scope:** ~9 files touched, all in one feature area. Single PR. Right-sized.
