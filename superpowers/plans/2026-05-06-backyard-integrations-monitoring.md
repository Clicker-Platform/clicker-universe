# Backyard Integrations Monitoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PostHog & Resend monitoring tabs to the Backyard `/monitoring` page (per-tenant health, summary, failure feed) plus a daily Firestore retention cleanup function.

**Architecture:**
- New tabs `PostHog` and `Resend` rendered inside existing `backyard/app/monitoring/page.tsx` (alongside `System Health` and `Event Logs`).
- PostHog data fetched via a new callable Cloud Function `getPosthogStats` (key in Secret Manager). Resend data read directly from Firestore `emailLog` collection group via Backyard client SDK.
- Daily scheduled Cloud Function `retentionCleanup` deletes `platform_logs` >7d and `emailLog` >30d.

**Tech Stack:**
- Next.js 14 App Router (Backyard, all-client)
- Firebase: Functions v2 (`onCall`, `onSchedule`), Firestore client + admin SDK, Secret Manager
- Vitest for tests; React Testing Library for components
- PostHog HogQL Query API (`POST https://us.i.posthog.com/api/projects/<id>/query/`)

**Spec:** `dev/superpowers/specs/2026-05-06-backyard-integrations-monitoring-design.md`

---

## File Structure

**Backyard (`dev/backyard/`):**
- Modify `app/monitoring/page.tsx` — add `posthog` and `resend` tab values and renderers
- Create `components/monitoring/PostHogTab.tsx` — health + per-tenant table
- Create `components/monitoring/ResendTab.tsx` — summary + tenant table + failure feed
- Create `components/monitoring/EmailFailureDrawer.tsx` — slide-in payload viewer
- Create `components/monitoring/LiveModeToggle.tsx` — shared toggle with visibility/error guards
- Create `lib/monitoring/usePosthogStats.ts` — calls callable, caches, handles Live mode
- Create `lib/monitoring/useResendStats.ts` — Firestore collection-group query + aggregation
- Create `lib/monitoring/types.ts` — shared types `PosthogStats`, `ResendStats`, `EmailFailure`
- Tests: `lib/monitoring/__tests__/usePosthogStats.test.ts`, `lib/monitoring/__tests__/useResendStats.test.ts`, `components/monitoring/__tests__/LiveModeToggle.test.tsx`

**Cloud Functions (`dev/functions/src/`):**
- Create `monitoring/getPosthogStats.ts` — callable, queries PostHog HogQL API
- Create `monitoring/__tests__/getPosthogStats.test.ts`
- Create `scheduled/retentionCleanup.ts` — daily cleanup
- Create `scheduled/__tests__/retentionCleanup.test.ts`
- Modify `index.ts` — re-export the two new functions

**Config:**
- `dev/functions/.runtimeconfig.json` (or Secret Manager) — `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`, `POSTHOG_HOST`

---

## Task 1: Shared monitoring types in Backyard

**Files:**
- Create: `dev/backyard/lib/monitoring/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// dev/backyard/lib/monitoring/types.ts

export type PosthogTenantStatus = 'active' | 'idle' | 'silent';

export interface PosthogTenantRow {
  siteId: string;
  siteName: string | null;
  events24h: number;
  events7d: number;
  lastEventAt: string | null; // ISO timestamp
  status: PosthogTenantStatus;
}

export interface PosthogStats {
  health: {
    reachable: boolean;
    totalEvents24h: number;
    lastEventAt: string | null;
    errorCode?: 'auth' | 'rate_limit' | 'network' | 'unknown';
    errorMessage?: string;
    retryAfterSec?: number;
  };
  perTenant: PosthogTenantRow[];
}

export interface ResendTenantRow {
  siteId: string;
  siteName: string | null;
  sent24h: number;
  failed24h: number;
  failRate: number; // 0..1
  lastSentAt: string | null;
}

export interface EmailFailure {
  logId: string;
  siteId: string;
  siteName: string | null;
  to: string[];
  cc: string[] | null;
  bcc: string[] | null;
  subject: string;
  fromName: string;
  fromAddress: string;
  templateAlias: string;
  error: string | null;
  errorCode: string | null;
  resendId: string | null;
  tags: { name: string; value: string }[];
  createdAt: string; // ISO
  sentAt: string | null;
}

export interface ResendStats {
  summary: {
    sent24h: number;
    failed24h: number;
    failRate: number;
  };
  perTenant: ResendTenantRow[];
  recentFailures: EmailFailure[];
}

export type StatsWindow = '1h' | '24h' | '7d';
```

- [ ] **Step 2: Commit**

```bash
git add dev/backyard/lib/monitoring/types.ts
git commit -m "feat(monitoring): add shared types for PostHog and Resend stats"
```

---

## Task 2: LiveModeToggle component

**Files:**
- Create: `dev/backyard/components/monitoring/LiveModeToggle.tsx`
- Test: `dev/backyard/components/monitoring/__tests__/LiveModeToggle.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// dev/backyard/components/monitoring/__tests__/LiveModeToggle.test.tsx
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LiveModeToggle } from '../LiveModeToggle';

describe('LiveModeToggle', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('does not call onTick when off', () => {
    const onTick = vi.fn();
    render(<LiveModeToggle onTick={onTick} intervalMs={30_000} paused={false} />);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(onTick).not.toHaveBeenCalled();
  });

  it('calls onTick at interval when on', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onTick = vi.fn();
    render(<LiveModeToggle onTick={onTick} intervalMs={30_000} paused={false} />);
    await user.click(screen.getByRole('switch', { name: /live mode/i }));
    act(() => { vi.advanceTimersByTime(90_000); });
    expect(onTick).toHaveBeenCalledTimes(3);
  });

  it('pauses ticks when paused prop is true', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onTick = vi.fn();
    const { rerender } = render(
      <LiveModeToggle onTick={onTick} intervalMs={30_000} paused={false} />
    );
    await user.click(screen.getByRole('switch', { name: /live mode/i }));
    rerender(<LiveModeToggle onTick={onTick} intervalMs={30_000} paused={true} />);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(onTick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL — module not found)**

```bash
cd dev && pnpm --filter backyard vitest run components/monitoring/__tests__/LiveModeToggle.test.tsx
```

Expected: FAIL with "Cannot find module '../LiveModeToggle'".

- [ ] **Step 3: Implement the component**

```typescript
// dev/backyard/components/monitoring/LiveModeToggle.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  onTick: () => void;
  intervalMs: number;
  paused: boolean;
}

export function LiveModeToggle({ onTick, intervalMs, paused }: Props) {
  const [enabled, setEnabled] = useState(false);
  const tickRef = useRef(onTick);
  tickRef.current = onTick;

  useEffect(() => {
    if (!enabled || paused) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    const id = setInterval(() => tickRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [enabled, paused, intervalMs]);

  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => {
      // re-render to re-evaluate the polling effect
      setEnabled((v) => v);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled]);

  return (
    <label className="inline-flex items-center gap-2 text-sm text-gray-600">
      <span>Live mode</span>
      <button
        role="switch"
        aria-checked={enabled}
        aria-label="Live mode"
        onClick={() => setEnabled((v) => !v)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          enabled ? 'bg-brand-dark' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  );
}
```

- [ ] **Step 4: Run the test (expect PASS)**

```bash
cd dev && pnpm --filter backyard vitest run components/monitoring/__tests__/LiveModeToggle.test.tsx
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add dev/backyard/components/monitoring/LiveModeToggle.tsx dev/backyard/components/monitoring/__tests__/LiveModeToggle.test.tsx
git commit -m "feat(monitoring): add LiveModeToggle with visibility/pause guards"
```

---

## Task 3: useResendStats hook (Firestore aggregation)

**Files:**
- Create: `dev/backyard/lib/monitoring/useResendStats.ts`
- Test: `dev/backyard/lib/monitoring/__tests__/useResendStats.test.ts`

The hook reads `emailLog` collection group (existing path `sites/{siteId}/emailLog/{logId}` per `dev/clicker-platform-v2/lib/email/log.ts`), aggregates per-site, and produces `ResendStats`.

- [ ] **Step 1: Write the failing test**

```typescript
// dev/backyard/lib/monitoring/__tests__/useResendStats.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDocs = vi.fn();
const mockSiteName = vi.fn();
vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
  return {
    ...actual,
    collectionGroup: vi.fn(() => ({})),
    query: vi.fn(() => ({})),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    Timestamp: actual.Timestamp,
    getDocs: (...a: unknown[]) => mockGetDocs(...a),
  };
});
vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('../siteNameLookup', () => ({ lookupSiteNames: (ids: string[]) => mockSiteName(ids) }));

import { useResendStats } from '../useResendStats';

const tsToISO = (d: Date) => ({ toDate: () => d });

beforeEach(() => {
  mockGetDocs.mockReset();
  mockSiteName.mockReset();
});

describe('useResendStats', () => {
  it('aggregates sent/failed per site and computes fail rate', async () => {
    const now = new Date('2026-05-06T10:00:00Z');
    mockGetDocs
      .mockResolvedValueOnce({
        docs: [
          { id: 'a1', ref: { parent: { parent: { id: 'site-a' } } }, data: () => ({ status: 'sent', siteId: 'site-a', createdAt: tsToISO(now), sentAt: tsToISO(now) }) },
          { id: 'a2', ref: { parent: { parent: { id: 'site-a' } } }, data: () => ({ status: 'failed', siteId: 'site-a', createdAt: tsToISO(now), sentAt: null }) },
          { id: 'b1', ref: { parent: { parent: { id: 'site-b' } } }, data: () => ({ status: 'sent', siteId: 'site-b', createdAt: tsToISO(now), sentAt: tsToISO(now) }) },
        ],
      })
      .mockResolvedValueOnce({ docs: [] }); // recent failures query
    mockSiteName.mockResolvedValue({ 'site-a': 'Acme', 'site-b': 'Beta' });

    const { result } = renderHook(() => useResendStats({ window: '24h' }));
    await waitFor(() => expect(result.current.data).toBeTruthy());

    expect(result.current.data!.summary).toEqual({ sent24h: 2, failed24h: 1, failRate: 1 / 3 });
    const siteA = result.current.data!.perTenant.find((t) => t.siteId === 'site-a')!;
    expect(siteA).toMatchObject({ siteName: 'Acme', sent24h: 1, failed24h: 1, failRate: 0.5 });
  });

  it('returns recentFailures sorted by createdAt desc', async () => {
    const t1 = new Date('2026-05-06T09:00:00Z');
    const t2 = new Date('2026-05-06T10:00:00Z');
    mockGetDocs
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({
        docs: [
          { id: 'f2', ref: { parent: { parent: { id: 'site-a' } } }, data: () => ({ status: 'failed', siteId: 'site-a', to: ['x@y'], cc: null, bcc: null, subject: 'tpl', fromName: 'F', fromAddress: 'f@x', templateAlias: 'tpl', error: 'boom', errorCode: 'E', resendId: null, tags: [], createdAt: tsToISO(t2), sentAt: null }) },
          { id: 'f1', ref: { parent: { parent: { id: 'site-a' } } }, data: () => ({ status: 'failed', siteId: 'site-a', to: ['z@y'], cc: null, bcc: null, subject: 'tpl', fromName: 'F', fromAddress: 'f@x', templateAlias: 'tpl', error: 'kaput', errorCode: 'E', resendId: null, tags: [], createdAt: tsToISO(t1), sentAt: null }) },
        ],
      });
    mockSiteName.mockResolvedValue({ 'site-a': 'Acme' });

    const { result } = renderHook(() => useResendStats({ window: '24h' }));
    await waitFor(() => expect(result.current.data?.recentFailures.length).toBe(2));
    expect(result.current.data!.recentFailures[0].logId).toBe('f2');
    expect(result.current.data!.recentFailures[1].logId).toBe('f1');
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL — module not found)**

```bash
cd dev && pnpm --filter backyard vitest run lib/monitoring/__tests__/useResendStats.test.ts
```

Expected: FAIL with "Cannot find module '../useResendStats'".

- [ ] **Step 3: Implement siteNameLookup helper**

Create `dev/backyard/lib/monitoring/siteNameLookup.ts`:

```typescript
import { collection, doc, getDocs, query, where, documentId } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const cache = new Map<string, string>();

export async function lookupSiteNames(siteIds: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const missing: string[] = [];
  for (const id of siteIds) {
    if (cache.has(id)) {
      result[id] = cache.get(id)!;
    } else {
      missing.push(id);
    }
  }
  // Firestore `in` queries cap at 30 ids; chunk
  const chunks: string[][] = [];
  for (let i = 0; i < missing.length; i += 30) {
    chunks.push(missing.slice(i, i + 30));
  }
  for (const chunk of chunks) {
    if (chunk.length === 0) continue;
    const q = query(collection(db, 'sites'), where(documentId(), 'in', chunk));
    const snap = await getDocs(q);
    snap.docs.forEach((d) => {
      const name = (d.data() as { name?: string; businessName?: string }).name
        ?? (d.data() as { businessName?: string }).businessName
        ?? null;
      if (name) {
        cache.set(d.id, name);
        result[d.id] = name;
      }
    });
  }
  return result;
}
```

- [ ] **Step 4: Implement the hook**

Create `dev/backyard/lib/monitoring/useResendStats.ts`:

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  collectionGroup, query, where, orderBy, limit, getDocs, Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { lookupSiteNames } from './siteNameLookup';
import type { ResendStats, StatsWindow, EmailFailure } from './types';

const WINDOW_MS: Record<StatsWindow, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

interface Options { window: StatsWindow }

export function useResendStats({ window }: Options) {
  const [data, setData] = useState<ResendStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cutoff = Timestamp.fromMillis(Date.now() - WINDOW_MS[window]);

      const aggSnap = await getDocs(query(
        collectionGroup(db, 'emailLog'),
        where('createdAt', '>=', cutoff),
      ));

      const failuresSnap = await getDocs(query(
        collectionGroup(db, 'emailLog'),
        where('status', '==', 'failed'),
        orderBy('createdAt', 'desc'),
        limit(50),
      ));

      const perSite = new Map<string, { sent: number; failed: number; lastSentAt: Date | null }>();
      aggSnap.docs.forEach((d) => {
        const data = d.data() as { status: 'sent' | 'failed'; siteId?: string; sentAt?: { toDate: () => Date } | null };
        const siteId = data.siteId ?? d.ref.parent.parent?.id ?? '(unknown)';
        const row = perSite.get(siteId) ?? { sent: 0, failed: 0, lastSentAt: null };
        if (data.status === 'sent') {
          row.sent += 1;
          const sentAt = data.sentAt?.toDate?.() ?? null;
          if (sentAt && (!row.lastSentAt || sentAt > row.lastSentAt)) row.lastSentAt = sentAt;
        } else {
          row.failed += 1;
        }
        perSite.set(siteId, row);
      });

      const siteIds = Array.from(perSite.keys()).filter((id) => id !== '(unknown)');
      const names = await lookupSiteNames(siteIds);

      const perTenant = Array.from(perSite.entries()).map(([siteId, r]) => {
        const total = r.sent + r.failed;
        return {
          siteId,
          siteName: names[siteId] ?? null,
          sent24h: r.sent,
          failed24h: r.failed,
          failRate: total === 0 ? 0 : r.failed / total,
          lastSentAt: r.lastSentAt?.toISOString() ?? null,
        };
      }).sort((a, b) => b.failed24h - a.failed24h);

      let totalSent = 0;
      let totalFailed = 0;
      perTenant.forEach((t) => { totalSent += t.sent24h; totalFailed += t.failed24h; });

      const failureSiteIds = Array.from(new Set(failuresSnap.docs.map((d) => {
        const data = d.data() as { siteId?: string };
        return data.siteId ?? d.ref.parent.parent?.id ?? '(unknown)';
      })));
      const failureNames = { ...names, ...(await lookupSiteNames(failureSiteIds.filter((id) => !(id in names) && id !== '(unknown)'))) };

      const recentFailures: EmailFailure[] = failuresSnap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        const siteId = (data.siteId as string | undefined) ?? d.ref.parent.parent?.id ?? '(unknown)';
        return {
          logId: d.id,
          siteId,
          siteName: failureNames[siteId] ?? null,
          to: (data.to as string[] | undefined) ?? [],
          cc: (data.cc as string[] | null | undefined) ?? null,
          bcc: (data.bcc as string[] | null | undefined) ?? null,
          subject: (data.subject as string | undefined) ?? '',
          fromName: (data.fromName as string | undefined) ?? '',
          fromAddress: (data.fromAddress as string | undefined) ?? '',
          templateAlias: (data.templateAlias as string | undefined) ?? (data.subject as string | undefined) ?? '',
          error: (data.error as string | null | undefined) ?? null,
          errorCode: (data.errorCode as string | null | undefined) ?? null,
          resendId: (data.resendId as string | null | undefined) ?? null,
          tags: (data.tags as { name: string; value: string }[] | undefined) ?? [],
          createdAt: ((data.createdAt as { toDate?: () => Date } | undefined)?.toDate?.() ?? new Date()).toISOString(),
          sentAt: (data.sentAt as { toDate?: () => Date } | null | undefined)?.toDate?.()?.toISOString() ?? null,
        };
      });

      setData({
        summary: { sent24h: totalSent, failed24h: totalFailed, failRate: (totalSent + totalFailed) === 0 ? 0 : totalFailed / (totalSent + totalFailed) },
        perTenant,
        recentFailures,
      });
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [window]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, error, loading, updatedAt, refresh };
}
```

- [ ] **Step 5: Run the test (expect PASS)**

```bash
cd dev && pnpm --filter backyard vitest run lib/monitoring/__tests__/useResendStats.test.ts
```

Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add dev/backyard/lib/monitoring/types.ts dev/backyard/lib/monitoring/useResendStats.ts dev/backyard/lib/monitoring/siteNameLookup.ts dev/backyard/lib/monitoring/__tests__/useResendStats.test.ts
git commit -m "feat(monitoring): add useResendStats hook with collection-group aggregation"
```

---

## Task 4: getPosthogStats Cloud Function

**Files:**
- Create: `dev/functions/src/monitoring/getPosthogStats.ts`
- Test: `dev/functions/src/monitoring/__tests__/getPosthogStats.test.ts`
- Modify: `dev/functions/src/index.ts` (add `export`)

The function uses HogQL via `POST https://<host>/api/projects/<projectId>/query/`. Auth header `Bearer <POSTHOG_PERSONAL_API_KEY>`. Three queries (total/last + per-tenant 24h + per-tenant 7d) run in parallel; results joined with `sites/` collection for names.

- [ ] **Step 1: Write the failing test**

```typescript
// dev/functions/src/monitoring/__tests__/getPosthogStats.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

vi.mock('firebase-admin', () => ({
  default: {
    firestore: () => ({
      collection: () => ({
        where: () => ({ get: async () => ({ docs: [{ id: 'site-a', data: () => ({ name: 'Acme' }) }] }) }),
      }),
    }),
  },
  firestore: () => ({}),
}));

process.env.POSTHOG_PERSONAL_API_KEY = 'phx_test';
process.env.POSTHOG_PROJECT_ID = '999';
process.env.POSTHOG_HOST = 'https://us.i.posthog.com';

import { runPosthogStats } from '../getPosthogStats';

beforeEach(() => fetchMock.mockReset());

describe('runPosthogStats', () => {
  it('returns reachable=true and aggregated data on success', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ results: [[100, '2026-05-06T10:00:00Z']] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ results: [['site-a', 60, '2026-05-06T10:00:00Z']] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ results: [['site-a', 200]] }) });

    const out = await runPosthogStats();
    expect(out.health.reachable).toBe(true);
    expect(out.health.totalEvents24h).toBe(100);
    expect(out.perTenant[0]).toMatchObject({ siteId: 'site-a', siteName: 'Acme', events24h: 60, events7d: 200, status: 'active' });
  });

  it('classifies tenant with 0 events 24h but >0 7d as idle', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ results: [[0, null]] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ results: [['site-a', 5]] }) });

    const out = await runPosthogStats();
    const row = out.perTenant.find((t) => t.siteId === 'site-a')!;
    expect(row.status).toBe('idle');
    expect(row.events24h).toBe(0);
    expect(row.events7d).toBe(5);
  });

  it('returns reachable=false with errorCode=auth on 401', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ detail: 'Invalid key' }) });
    const out = await runPosthogStats();
    expect(out.health.reachable).toBe(false);
    expect(out.health.errorCode).toBe('auth');
  });

  it('returns errorCode=rate_limit with retryAfterSec on 429', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: { get: (h: string) => (h === 'Retry-After' ? '30' : null) },
      json: async () => ({}),
    });
    const out = await runPosthogStats();
    expect(out.health.errorCode).toBe('rate_limit');
    expect(out.health.retryAfterSec).toBe(30);
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL — module not found)**

```bash
cd dev && pnpm --filter functions vitest run src/monitoring/__tests__/getPosthogStats.test.ts
```

Expected: FAIL with "Cannot find module '../getPosthogStats'".

- [ ] **Step 3: Implement the function**

Create `dev/functions/src/monitoring/getPosthogStats.ts`:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

type Status = 'active' | 'idle' | 'silent';
interface TenantRow {
  siteId: string;
  siteName: string | null;
  events24h: number;
  events7d: number;
  lastEventAt: string | null;
  status: Status;
}

interface StatsResult {
  health: {
    reachable: boolean;
    totalEvents24h: number;
    lastEventAt: string | null;
    errorCode?: 'auth' | 'rate_limit' | 'network' | 'unknown';
    errorMessage?: string;
    retryAfterSec?: number;
  };
  perTenant: TenantRow[];
}

const HOST = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';

async function hogql(query: string): Promise<unknown[][]> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!apiKey || !projectId) {
    throw Object.assign(new Error('POSTHOG_PERSONAL_API_KEY/POSTHOG_PROJECT_ID not set'), { code: 'config' });
  }
  const resp = await fetch(`${HOST}/api/projects/${projectId}/query/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  });
  if (!resp.ok) {
    const retryAfter = (resp as { headers?: { get?: (h: string) => string | null } }).headers?.get?.('Retry-After');
    const err = Object.assign(new Error(`PostHog ${resp.status}`), {
      status: resp.status,
      retryAfterSec: retryAfter ? Number(retryAfter) : undefined,
    }) as Error & { status: number; retryAfterSec?: number };
    throw err;
  }
  const json = await resp.json() as { results?: unknown[][] };
  return json.results ?? [];
}

function classify(events24h: number, events7d: number): Status {
  if (events24h > 0) return 'active';
  if (events7d > 0) return 'idle';
  return 'silent';
}

export async function runPosthogStats(): Promise<StatsResult> {
  try {
    const Q_HEALTH = `SELECT count() AS c, max(timestamp) AS last FROM events WHERE timestamp > now() - INTERVAL 24 HOUR`;
    const Q_24H = `SELECT properties.siteId AS siteId, count() AS c, max(timestamp) AS last FROM events WHERE timestamp > now() - INTERVAL 24 HOUR AND properties.siteId IS NOT NULL GROUP BY properties.siteId`;
    const Q_7D = `SELECT properties.siteId AS siteId, count() AS c FROM events WHERE timestamp > now() - INTERVAL 7 DAY AND properties.siteId IS NOT NULL GROUP BY properties.siteId`;

    const [healthRows, rows24h, rows7d] = await Promise.all([hogql(Q_HEALTH), hogql(Q_24H), hogql(Q_7D)]);

    const health = {
      reachable: true,
      totalEvents24h: Number(healthRows[0]?.[0] ?? 0),
      lastEventAt: (healthRows[0]?.[1] as string | null | undefined) ?? null,
    };

    const map = new Map<string, { events24h: number; events7d: number; lastEventAt: string | null }>();
    for (const r of rows24h) {
      const siteId = String(r[0]);
      map.set(siteId, { events24h: Number(r[1]), events7d: 0, lastEventAt: (r[2] as string | null) ?? null });
    }
    for (const r of rows7d) {
      const siteId = String(r[0]);
      const cur = map.get(siteId) ?? { events24h: 0, events7d: 0, lastEventAt: null };
      cur.events7d = Number(r[1]);
      map.set(siteId, cur);
    }

    const siteIds = Array.from(map.keys());
    const namesById: Record<string, string> = {};
    if (siteIds.length > 0) {
      // Firestore `in` caps at 30
      const chunks: string[][] = [];
      for (let i = 0; i < siteIds.length; i += 30) chunks.push(siteIds.slice(i, i + 30));
      for (const chunk of chunks) {
        const snap = await admin.firestore().collection('sites')
          .where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
        snap.docs.forEach((d) => {
          const data = d.data() as { name?: string; businessName?: string };
          const name = data.name ?? data.businessName ?? null;
          if (name) namesById[d.id] = name;
        });
      }
    }

    const perTenant: TenantRow[] = Array.from(map.entries()).map(([siteId, v]) => ({
      siteId,
      siteName: namesById[siteId] ?? null,
      events24h: v.events24h,
      events7d: v.events7d,
      lastEventAt: v.lastEventAt,
      status: classify(v.events24h, v.events7d),
    })).sort((a, b) => b.events24h - a.events24h);

    return { health, perTenant };
  } catch (err) {
    const e = err as { status?: number; message?: string; retryAfterSec?: number; code?: string };
    let errorCode: 'auth' | 'rate_limit' | 'network' | 'unknown' = 'unknown';
    if (e.status === 401 || e.status === 403) errorCode = 'auth';
    else if (e.status === 429) errorCode = 'rate_limit';
    else if (e.code === 'config' || e.status === undefined) errorCode = 'network';
    return {
      health: {
        reachable: false,
        totalEvents24h: 0,
        lastEventAt: null,
        errorCode,
        errorMessage: e.message ?? 'unknown error',
        retryAfterSec: e.retryAfterSec,
      },
      perTenant: [],
    };
  }
}

export const getPosthogStats = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  }
  return runPosthogStats();
});
```

- [ ] **Step 4: Wire export in `index.ts`**

Modify `dev/functions/src/index.ts` (add at end of file):

```typescript
export { getPosthogStats } from './monitoring/getPosthogStats';
```

- [ ] **Step 5: Run the test (expect PASS)**

```bash
cd dev && pnpm --filter functions vitest run src/monitoring/__tests__/getPosthogStats.test.ts
```

Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add dev/functions/src/monitoring/ dev/functions/src/index.ts
git commit -m "feat(monitoring): add getPosthogStats callable function with HogQL queries"
```

---

## Task 5: usePosthogStats hook

**Files:**
- Create: `dev/backyard/lib/monitoring/usePosthogStats.ts`
- Test: `dev/backyard/lib/monitoring/__tests__/usePosthogStats.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// dev/backyard/lib/monitoring/__tests__/usePosthogStats.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const callableMock = vi.fn();
vi.mock('firebase/functions', () => ({
  httpsCallable: () => callableMock,
}));
vi.mock('@/lib/firebase', () => ({ functions: {} }));

import { usePosthogStats } from '../usePosthogStats';

describe('usePosthogStats', () => {
  it('returns data from callable', async () => {
    callableMock.mockResolvedValueOnce({ data: {
      health: { reachable: true, totalEvents24h: 100, lastEventAt: '2026-05-06T10:00:00Z' },
      perTenant: [],
    } });
    const { result } = renderHook(() => usePosthogStats());
    await waitFor(() => expect(result.current.data?.health.totalEvents24h).toBe(100));
  });

  it('captures error message on rejection', async () => {
    callableMock.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => usePosthogStats());
    await waitFor(() => expect(result.current.error).toBe('boom'));
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL — module not found)**

```bash
cd dev && pnpm --filter backyard vitest run lib/monitoring/__tests__/usePosthogStats.test.ts
```

Expected: FAIL with "Cannot find module '../usePosthogStats'".

- [ ] **Step 3: Implement the hook**

```typescript
// dev/backyard/lib/monitoring/usePosthogStats.ts
'use client';

import { useEffect, useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import type { PosthogStats } from './types';

export function usePosthogStats() {
  const [data, setData] = useState<PosthogStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const callable = httpsCallable<unknown, PosthogStats>(functions, 'getPosthogStats');
      const resp = await callable({});
      setData(resp.data);
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, error, loading, updatedAt, refresh };
}
```

- [ ] **Step 4: Run the test (expect PASS)**

```bash
cd dev && pnpm --filter backyard vitest run lib/monitoring/__tests__/usePosthogStats.test.ts
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add dev/backyard/lib/monitoring/usePosthogStats.ts dev/backyard/lib/monitoring/__tests__/usePosthogStats.test.ts
git commit -m "feat(monitoring): add usePosthogStats hook calling getPosthogStats callable"
```

---

## Task 6: PostHogTab component

**Files:**
- Create: `dev/backyard/components/monitoring/PostHogTab.tsx`

- [ ] **Step 1: Implement the tab component**

```typescript
// dev/backyard/components/monitoring/PostHogTab.tsx
'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { usePosthogStats } from '@/lib/monitoring/usePosthogStats';
import { LiveModeToggle } from './LiveModeToggle';
import type { PosthogTenantStatus } from '@/lib/monitoring/types';

const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

const STATUS_STYLES: Record<PosthogTenantStatus, string> = {
  active: 'bg-green-100 text-green-700',
  idle: 'bg-yellow-100 text-yellow-700',
  silent: 'bg-red-100 text-red-700',
};

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function PostHogTab() {
  const { data, error, loading, updatedAt, refresh } = usePosthogStats();
  const [drawerPaused] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <span className="text-xs text-gray-500">
            Last updated: {updatedAt ? updatedAt.toLocaleTimeString() : '—'}
          </span>
          <LiveModeToggle onTick={refresh} intervalMs={30_000} paused={drawerPaused} />
        </div>
        <a
          href={POSTHOG_HOST}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-brand-dark hover:underline"
        >
          Open in PostHog <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {error && (
        <div className="mb-4 p-3 border border-red-200 bg-red-50 text-red-700 text-sm rounded-md">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-4 border rounded-md bg-white">
              <div className="text-xs text-gray-500 mb-1">Status</div>
              <div className="flex items-center gap-1.5">
                {data.health.reachable ? (
                  <><CheckCircle2 className="w-4 h-4 text-green-600" /><span className="font-bold">Reachable</span></>
                ) : (
                  <><XCircle className="w-4 h-4 text-red-600" /><span className="font-bold">{data.health.errorCode ?? 'error'}</span></>
                )}
              </div>
              {data.health.errorMessage && <div className="text-xs text-red-600 mt-1">{data.health.errorMessage}</div>}
            </div>
            <div className="p-4 border rounded-md bg-white">
              <div className="text-xs text-gray-500 mb-1">Events 24h</div>
              <div className="text-xl font-bold">{data.health.totalEvents24h.toLocaleString()}</div>
            </div>
            <div className="p-4 border rounded-md bg-white">
              <div className="text-xs text-gray-500 mb-1">Last event</div>
              <div className="text-xl font-bold">{formatRelative(data.health.lastEventAt)}</div>
            </div>
          </div>

          <div className="border rounded-md overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2">Site</th>
                  <th className="px-4 py-2 text-right">Events 24h</th>
                  <th className="px-4 py-2">Last event</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.perTenant.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No tenant activity</td></tr>
                )}
                {data.perTenant.map((row) => (
                  <tr key={row.siteId} className="border-t">
                    <td className="px-4 py-2">
                      <div className="font-medium">{row.siteName ?? '(deleted)'}</div>
                      <div className="text-xs text-gray-400">{row.siteId}</div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{row.events24h.toLocaleString()}</td>
                    <td className="px-4 py-2 text-gray-600">{formatRelative(row.lastEventAt)}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_STYLES[row.status]}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manual smoke test**

```bash
cd dev/backyard && pnpm dev
```

Open `http://localhost:3013/monitoring` (Backyard). The tab won't be wired yet (Task 8). Verify component compiles via TypeScript:

```bash
cd dev/backyard && pnpm tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add dev/backyard/components/monitoring/PostHogTab.tsx
git commit -m "feat(monitoring): add PostHogTab with health cards and per-tenant table"
```

---

## Task 7: ResendTab + EmailFailureDrawer

**Files:**
- Create: `dev/backyard/components/monitoring/EmailFailureDrawer.tsx`
- Create: `dev/backyard/components/monitoring/ResendTab.tsx`

- [ ] **Step 1: Implement the drawer**

```typescript
// dev/backyard/components/monitoring/EmailFailureDrawer.tsx
'use client';

import { X, ExternalLink } from 'lucide-react';
import type { EmailFailure } from '@/lib/monitoring/types';

interface Props {
  failure: EmailFailure | null;
  onClose: () => void;
}

const RESEND_DASHBOARD = 'https://resend.com/emails';

export function EmailFailureDrawer({ failure, onClose }: Props) {
  if (!failure) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-[480px] bg-white h-full overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold">Email failure detail</h3>
          <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <dl className="p-4 space-y-3 text-sm">
          <Row label="Site">{failure.siteName ?? '(deleted)'} <span className="text-xs text-gray-400">({failure.siteId})</span></Row>
          <Row label="To">{failure.to.join(', ')}</Row>
          {failure.cc && failure.cc.length > 0 && <Row label="Cc">{failure.cc.join(', ')}</Row>}
          {failure.bcc && failure.bcc.length > 0 && <Row label="Bcc">{failure.bcc.join(', ')}</Row>}
          <Row label="From">{failure.fromName} &lt;{failure.fromAddress}&gt;</Row>
          <Row label="Template">{failure.templateAlias}</Row>
          <Row label="Error">
            <div className="text-red-700">{failure.error ?? '—'}</div>
            {failure.errorCode && <div className="text-xs text-gray-400 mt-1">code: {failure.errorCode}</div>}
          </Row>
          <Row label="Created">{new Date(failure.createdAt).toLocaleString()}</Row>
          {failure.tags.length > 0 && (
            <Row label="Tags">
              {failure.tags.map((t, i) => (
                <span key={i} className="inline-block mr-1 mb-1 px-2 py-0.5 bg-gray-100 rounded text-xs">{t.name}={t.value}</span>
              ))}
            </Row>
          )}
          {failure.resendId && (
            <Row label="Resend">
              <a
                href={`${RESEND_DASHBOARD}/${failure.resendId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-brand-dark hover:underline"
              >
                Open in Resend <ExternalLink className="w-3 h-3" />
              </a>
            </Row>
          )}
        </dl>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-bold text-gray-500 uppercase">{label}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  );
}
```

- [ ] **Step 2: Implement the tab**

```typescript
// dev/backyard/components/monitoring/ResendTab.tsx
'use client';

import { useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { useResendStats } from '@/lib/monitoring/useResendStats';
import { LiveModeToggle } from './LiveModeToggle';
import { EmailFailureDrawer } from './EmailFailureDrawer';
import type { EmailFailure } from '@/lib/monitoring/types';

export function ResendTab() {
  const { data, error, loading, updatedAt, refresh } = useResendStats({ window: '24h' });
  const [selected, setSelected] = useState<EmailFailure | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <span className="text-xs text-gray-500">
            Last updated: {updatedAt ? updatedAt.toLocaleTimeString() : '—'}
          </span>
          <LiveModeToggle onTick={refresh} intervalMs={30_000} paused={!!selected} />
        </div>
        <a
          href="https://resend.com/emails"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-brand-dark hover:underline"
        >
          Open in Resend <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {error && (
        <div className="mb-4 p-3 border border-red-200 bg-red-50 text-red-700 text-sm rounded-md">{error}</div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Card label="Sent 24h" value={data.summary.sent24h.toLocaleString()} />
            <Card label="Failed 24h" value={data.summary.failed24h.toLocaleString()} />
            <Card label="Fail rate" value={`${(data.summary.failRate * 100).toFixed(1)}%`} />
          </div>

          <h4 className="text-sm font-bold mb-2">Per-tenant</h4>
          <div className="border rounded-md overflow-hidden bg-white mb-6">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2">Site</th>
                  <th className="px-4 py-2 text-right">Sent</th>
                  <th className="px-4 py-2 text-right">Failed</th>
                  <th className="px-4 py-2 text-right">Rate</th>
                  <th className="px-4 py-2">Last sent</th>
                </tr>
              </thead>
              <tbody>
                {data.perTenant.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No emails sent yet</td></tr>
                )}
                {data.perTenant.map((row) => (
                  <tr key={row.siteId} className="border-t">
                    <td className="px-4 py-2">
                      <div className="font-medium">{row.siteName ?? '(deleted)'}</div>
                      <div className="text-xs text-gray-400">{row.siteId}</div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{row.sent24h.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{row.failed24h.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{(row.failRate * 100).toFixed(1)}%</td>
                    <td className="px-4 py-2 text-gray-600">{row.lastSentAt ? new Date(row.lastSentAt).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 className="text-sm font-bold mb-2">Recent failures</h4>
          <div className="border rounded-md overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Site</th>
                  <th className="px-4 py-2">To</th>
                  <th className="px-4 py-2">Template</th>
                  <th className="px-4 py-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {data.recentFailures.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No recent failures</td></tr>
                )}
                {data.recentFailures.map((f) => (
                  <tr key={f.logId} className="border-t cursor-pointer hover:bg-gray-50" onClick={() => setSelected(f)}>
                    <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{new Date(f.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2">{f.siteName ?? f.siteId}</td>
                    <td className="px-4 py-2">{f.to.join(', ')}</td>
                    <td className="px-4 py-2">{f.templateAlias}</td>
                    <td className="px-4 py-2 text-red-700 truncate max-w-[200px]">{f.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <EmailFailureDrawer failure={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 border rounded-md bg-white">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd dev/backyard && pnpm tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add dev/backyard/components/monitoring/EmailFailureDrawer.tsx dev/backyard/components/monitoring/ResendTab.tsx
git commit -m "feat(monitoring): add ResendTab with summary, tenant table, and failure drawer"
```

---

## Task 8: Wire new tabs into `/monitoring` page

**Files:**
- Modify: `dev/backyard/app/monitoring/page.tsx`

- [ ] **Step 1: Update tab type and renderer**

Replace the entire content of `dev/backyard/app/monitoring/page.tsx`:

```typescript
'use client';

import { Suspense, useState } from 'react';
import PageShell from '@/components/PageShell';
import HealthTab from '@/components/monitoring/HealthTab';
import LogsTab from '@/components/monitoring/LogsTab';
import { PostHogTab } from '@/components/monitoring/PostHogTab';
import { ResendTab } from '@/components/monitoring/ResendTab';

type Tab = 'health' | 'logs' | 'posthog' | 'resend';

const TAB_LABELS: Record<Tab, string> = {
    health: 'System Health',
    logs: 'Event Logs',
    posthog: 'PostHog',
    resend: 'Resend',
};

const TAB_SUBTITLES: Record<Tab, string> = {
    health: 'Service health checks across the platform',
    logs: 'Live event logs from platform_logs',
    posthog: 'PostHog analytics health and per-tenant activity',
    resend: 'Resend email delivery, failures, and per-tenant volume',
};

export default function MonitoringPage() {
    const [activeTab, setActiveTab] = useState<Tab>('health');
    const [logsInitialEvent, setLogsInitialEvent] = useState('');

    const handleSelectService = (eventPrefix: string) => {
        setLogsInitialEvent(eventPrefix);
        setActiveTab('logs');
    };

    return (
        <PageShell title="Monitoring" subtitle={TAB_SUBTITLES[activeTab]}>
            <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
                {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2.5 text-sm font-bold transition-colors border-b-2 -mb-[2px] ${
                            activeTab === tab
                                ? 'border-brand-dark text-brand-dark'
                                : 'border-transparent text-gray-400 hover:text-gray-700'
                        }`}
                    >
                        {TAB_LABELS[tab]}
                    </button>
                ))}
            </div>

            {activeTab === 'health' && <HealthTab onSelectService={handleSelectService} />}
            {activeTab === 'logs' && (
                <Suspense fallback={<div className="text-center py-12 text-gray-400">Loading...</div>}>
                    <LogsTab initialEvent={logsInitialEvent} />
                </Suspense>
            )}
            {activeTab === 'posthog' && <PostHogTab />}
            {activeTab === 'resend' && <ResendTab />}
        </PageShell>
    );
}
```

- [ ] **Step 2: Manual smoke test**

```bash
cd dev/backyard && pnpm dev
```

Open `http://localhost:3013/monitoring`. Verify:
- 4 tabs visible in this order: System Health | Event Logs | PostHog | Resend
- Click PostHog → renders without console errors (data may show error if API key not set yet — expected)
- Click Resend → renders summary cards and tenant table
- Click on any failure row in Resend → drawer slides in

- [ ] **Step 3: Commit**

```bash
git add dev/backyard/app/monitoring/page.tsx
git commit -m "feat(monitoring): wire PostHog and Resend tabs into monitoring page"
```

---

## Task 9: Retention cleanup scheduled function

**Files:**
- Create: `dev/functions/src/scheduled/retentionCleanup.ts`
- Test: `dev/functions/src/scheduled/__tests__/retentionCleanup.test.ts`
- Modify: `dev/functions/src/index.ts` (add `export`)

- [ ] **Step 1: Write the failing test**

```typescript
// dev/functions/src/scheduled/__tests__/retentionCleanup.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const deleteMock = vi.fn();
const getMock = vi.fn();
const limitMock = vi.fn();
const whereMock = vi.fn();
const collectionGroupMock = vi.fn();
const collectionMock = vi.fn();
const setMock = vi.fn();
const docMock = vi.fn();
const batchCommit = vi.fn();
const batchDelete = vi.fn();
const batch = vi.fn(() => ({ delete: batchDelete, commit: batchCommit }));

vi.mock('firebase-admin', () => ({
  default: {
    firestore: () => ({
      collection: collectionMock,
      collectionGroup: collectionGroupMock,
      batch,
    }),
    firestore: {
      Timestamp: { fromMillis: (n: number) => ({ _ms: n }) },
      FieldValue: { serverTimestamp: () => '__ts__' },
    },
  },
}));

import { runRetentionCleanup } from '../retentionCleanup';

beforeEach(() => {
  deleteMock.mockReset(); getMock.mockReset(); limitMock.mockReset(); whereMock.mockReset();
  collectionGroupMock.mockReset(); collectionMock.mockReset(); setMock.mockReset(); docMock.mockReset();
  batchCommit.mockReset(); batchDelete.mockReset();
});

function makeQuery(docs: { ref: object }[]) {
  const q: Record<string, unknown> = {
    where: () => q,
    limit: () => q,
    get: async () => ({ size: docs.length, docs, empty: docs.length === 0 }),
  };
  return q;
}

describe('runRetentionCleanup', () => {
  it('deletes platform_logs older than 7 days and emailLog older than 30 days', async () => {
    const platformDocs = [{ ref: 'p1' }, { ref: 'p2' }];
    const emailDocs = [{ ref: 'e1' }];
    const platformQuery = makeQuery(platformDocs);
    const emptyPlatformQuery = makeQuery([]);
    const emailQuery = makeQuery(emailDocs);
    const emptyEmailQuery = makeQuery([]);
    collectionMock
      .mockImplementationOnce(() => platformQuery) // platform_logs
      .mockImplementationOnce(() => ({ doc: () => ({ set: setMock }) })); // platform_logs write log
    collectionGroupMock.mockReturnValueOnce(emailQuery);

    // sequence: platform first batch returns 2 docs, second returns 0; email first 1, second 0
    let pCall = 0;
    platformQuery.get = async () => ({ size: pCall++ === 0 ? 2 : 0, docs: pCall === 1 ? platformDocs : [], empty: pCall > 1 });
    let eCall = 0;
    emailQuery.get = async () => ({ size: eCall++ === 0 ? 1 : 0, docs: eCall === 1 ? emailDocs : [], empty: eCall > 1 });

    const result = await runRetentionCleanup();
    expect(result.deletedPlatformLogs).toBe(2);
    expect(result.deletedEmailLogs).toBe(1);
    expect(batchDelete).toHaveBeenCalledTimes(3);
    expect(batchCommit).toHaveBeenCalledTimes(2);
  });

  it('caps batches at 20 iterations to avoid timeout', async () => {
    const fakeDoc = { ref: 'x' };
    const fakeDocs = Array.from({ length: 500 }, () => fakeDoc);
    const platformQuery = {
      where: () => platformQuery,
      limit: () => platformQuery,
      get: async () => ({ size: 500, docs: fakeDocs, empty: false }),
    };
    const emptyEmail = makeQuery([]);
    collectionMock
      .mockImplementationOnce(() => platformQuery)
      .mockImplementationOnce(() => ({ doc: () => ({ set: setMock }) }));
    collectionGroupMock.mockReturnValueOnce(emptyEmail);

    const result = await runRetentionCleanup();
    expect(result.deletedPlatformLogs).toBe(500 * 20);
    expect(batchCommit).toHaveBeenCalledTimes(20);
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL — module not found)**

```bash
cd dev && pnpm --filter functions vitest run src/scheduled/__tests__/retentionCleanup.test.ts
```

Expected: FAIL with "Cannot find module '../retentionCleanup'".

- [ ] **Step 3: Implement the function**

```typescript
// dev/functions/src/scheduled/retentionCleanup.ts
import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

const PLATFORM_LOGS_RETENTION_DAYS = 7;
const EMAIL_LOG_RETENTION_DAYS = 30;
const BATCH_SIZE = 500;
const MAX_BATCHES = 20;

interface CleanupResult {
  deletedPlatformLogs: number;
  deletedEmailLogs: number;
  durationMs: number;
}

async function deleteOlderThan(
  queryFactory: () => FirebaseFirestore.Query,
): Promise<number> {
  let total = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const snap = await queryFactory().limit(BATCH_SIZE).get();
    if (snap.size === 0) break;
    const batch = admin.firestore().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < BATCH_SIZE) break;
  }
  return total;
}

export async function runRetentionCleanup(): Promise<CleanupResult> {
  const start = Date.now();
  const now = Date.now();

  let deletedPlatformLogs = 0;
  let deletedEmailLogs = 0;
  let failed: string | null = null;

  try {
    const platformCutoff = admin.firestore.Timestamp.fromMillis(now - PLATFORM_LOGS_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    deletedPlatformLogs = await deleteOlderThan(() =>
      admin.firestore().collection('platform_logs').where('createdAt', '<', platformCutoff)
    );

    const emailCutoff = admin.firestore.Timestamp.fromMillis(now - EMAIL_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    deletedEmailLogs = await deleteOlderThan(() =>
      admin.firestore().collectionGroup('emailLog').where('createdAt', '<', emailCutoff)
    );
  } catch (err) {
    failed = err instanceof Error ? err.message : String(err);
  }

  const durationMs = Date.now() - start;

  // Emit log to platform_logs (best effort; never throw)
  try {
    await admin.firestore().collection('platform_logs').doc().set({
      event: failed ? 'retention.cleanup.failed' : 'retention.cleanup.done',
      level: failed ? 'error' : 'info',
      data: { deletedPlatformLogs, deletedEmailLogs, durationMs, error: failed },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch {
    // swallow; cleanup must never throw
  }

  return { deletedPlatformLogs, deletedEmailLogs, durationMs };
}

export const retentionCleanup = onSchedule(
  { schedule: 'every day 02:00', timeZone: 'Asia/Jakarta', region: 'asia-southeast1' },
  async () => {
    await runRetentionCleanup();
  }
);
```

- [ ] **Step 4: Wire export in `index.ts`**

Modify `dev/functions/src/index.ts` (append):

```typescript
export { retentionCleanup } from './scheduled/retentionCleanup';
```

- [ ] **Step 5: Run the test (expect PASS)**

```bash
cd dev && pnpm --filter functions vitest run src/scheduled/__tests__/retentionCleanup.test.ts
```

Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add dev/functions/src/scheduled/ dev/functions/src/index.ts
git commit -m "feat(monitoring): add retentionCleanup scheduled function (7d platform_logs, 30d emailLog)"
```

---

## Task 10: Configuration & deploy notes

**Files:**
- Create: `dev/functions/src/monitoring/README.md`

- [ ] **Step 1: Document setup steps**

```markdown
# Monitoring Functions — Setup

## getPosthogStats

Requires environment variables (set via Secret Manager / `firebase functions:secrets:set`):

- `POSTHOG_PERSONAL_API_KEY` — PostHog Personal API Key (Settings → Personal API Keys, scope `query:read`)
- `POSTHOG_PROJECT_ID` — PostHog project ID (numeric, found in project settings)
- `POSTHOG_HOST` — optional, defaults to `https://us.i.posthog.com` (use `https://eu.i.posthog.com` for EU)

Set:

```bash
firebase functions:secrets:set POSTHOG_PERSONAL_API_KEY
firebase functions:secrets:set POSTHOG_PROJECT_ID
```

Bind the secret to the function in deploy config (`firebase.json` runtime, or via `runWith({ secrets: [...] })` if migrating to v2 callable).

## retentionCleanup

No secrets required. Runs daily at 02:00 WIB (`Asia/Jakarta`).

**Initial deploy: dry-run safety**

Before flipping retention to 7d/30d on prod, deploy once with conservative cutoffs (e.g., 365 days for both) to confirm scheduling and permissions, then lower the constants `PLATFORM_LOGS_RETENTION_DAYS` and `EMAIL_LOG_RETENTION_DAYS`.

Manual trigger for verification:

```bash
gcloud scheduler jobs run firebase-schedule-retentionCleanup-asia-southeast1 --location asia-southeast1
```

Verify the `retention.cleanup.done` event appears in `platform_logs` after the run.
```

- [ ] **Step 2: Commit**

```bash
git add dev/functions/src/monitoring/README.md
git commit -m "docs(monitoring): add setup and deploy notes for monitoring functions"
```

---

## Task 11: Full test pass + manual QA

- [ ] **Step 1: Run all relevant tests**

```bash
cd dev && pnpm --filter backyard vitest run lib/monitoring components/monitoring
cd dev && pnpm --filter functions vitest run src/monitoring src/scheduled
```

Expected: all green.

- [ ] **Step 2: Lint and typecheck**

```bash
cd dev/backyard && pnpm lint && pnpm tsc --noEmit
cd dev/functions && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual QA checklist**

Run Backyard locally:

```bash
cd dev/backyard && pnpm dev
```

Walk through the QA checklist in the spec (`dev/superpowers/specs/2026-05-06-backyard-integrations-monitoring-design.md`, section 5):

- [ ] `/monitoring` shows 4 tabs.
- [ ] PostHog with invalid `POSTHOG_PERSONAL_API_KEY` → "auth" error displayed.
- [ ] PostHog with valid key → tenants listed; tenant with no events 7d shown as `silent`.
- [ ] Resend with brand-new tenant → "No emails sent yet" empty state.
- [ ] Click failure row in Resend → `EmailFailureDrawer` opens with payload.
- [ ] Live mode ON → switch tab away → polling pauses (verify in DevTools Network).
- [ ] Open drawer → polling pauses (verify Network); close drawer → resumes.
- [ ] Trigger `retentionCleanup` manually → `retention.cleanup.done` event appears in `platform_logs`.

- [ ] **Step 4: Final commit (if QA fixes were needed)**

```bash
git status
# If any fixes:
git add -A
git commit -m "fix(monitoring): address manual QA issues"
```

---

## Plan Self-Review

**Spec coverage:**
- ✅ §1 Goal & Scope — covered by tasks 1–11.
- ✅ §2 Architecture (4 tabs, file layout, data sources, retention cleanup) — Tasks 6, 7, 8, 9.
- ✅ §3 Components & Data Flow (PostHog + Resend layouts, drawer, status logic) — Tasks 4 (status logic in `classify`), 6, 7.
- ✅ §4 Error Handling (PostHog 401/429, Firestore empty/error, Live mode pause, cleanup never throws) — Tasks 4, 6, 7, 9.
- ✅ §5 Testing (unit, integration, manual QA) — Tasks 2, 3, 4, 5, 9, 11.
- ✅ §6 Open Questions (PostHog key provisioning, cleanup dry-run, site name lookup) — Task 10 docs + Task 3 lookup helper.

**Placeholder scan:** No "TBD"/"TODO"/"add appropriate error handling"/etc. Code blocks present in every code step.

**Type consistency:** `PosthogStats`/`ResendStats`/`EmailFailure` defined in Task 1, used consistently in Tasks 3, 5, 6, 7. `runPosthogStats` (Task 4) returns the same shape. Hook return shapes (`{ data, error, loading, updatedAt, refresh }`) consistent across `usePosthogStats` and `useResendStats`.
