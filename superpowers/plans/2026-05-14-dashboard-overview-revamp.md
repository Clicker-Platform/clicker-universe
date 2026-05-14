# Dashboard Overview Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current vertical-stack admin dashboard (`app/admin/(dashboard)/page.tsx`) with a 3-column overview — Inbox preview | Pages grid | curated Module widgets — with per-site widget visibility.

**Architecture:** Thin composition layer. A new `OverviewLayout` renders three column components (`InboxColumn`, `PagesColumn`, `ModulesColumn`). Module widgets reuse the existing `components/admin/dashboard/widgets/*Widget.tsx` files (already pluggable via `adminDashboardWidget.componentKey`). Per-site visibility lives in a new Firestore field `sites/{siteId}.dashboardOverview.visibleWidgets`.

**Tech Stack:** Next.js App Router, TypeScript, Firebase client SDK (Firestore), Tailwind, Vitest.

**Spec reference:** `/Users/andre/Repository/clicker-universe/dev/superpowers/specs/2026-05-14-dashboard-overview-revamp.md`

**Working directory:** `/Users/andre/Repository/clicker-universe/dev/clicker-platform-v2`

---

## File Structure

### New files
- `lib/modules/dashboard-overview.ts` — read/write `visibleWidgets` + default-set computation
- `components/admin/dashboard/OverviewLayout.tsx` — page shell + content header
- `components/admin/dashboard/InboxColumn.tsx` — submissions preview with tabs
- `components/admin/dashboard/PagesColumn.tsx` — pages grid with compact cards
- `components/admin/dashboard/ModulesColumn.tsx` — widget rows + "+ Add module" tile
- `components/admin/dashboard/AddModuleWidgetPicker.tsx` — checkbox popover
- `components/admin/dashboard/WidgetRegistry.ts` — extracted widget map (reused from ModuleCards)
- `lib/modules/__tests__/dashboard-overview.test.ts`
- `components/admin/dashboard/__tests__/AddModuleWidgetPicker.test.tsx`
- `components/admin/dashboard/__tests__/PagesColumn.test.tsx`

### Modified files
- `app/admin/(dashboard)/page.tsx` — rewritten as thin composition
- `components/skeletons/DashboardSkeletonNew.tsx` — 3-column skeleton
- `firestore.rules` — allow members with edit rights to write `sites/{siteId}.dashboardOverview` (only if a rule restricts site doc writes already; otherwise no change)

### Removed files
- `components/admin/dashboard/QuickActionsHero.tsx`
- `components/admin/dashboard/PagesGrid.tsx`
- `components/admin/dashboard/ModuleCards.tsx`
- `components/admin/dashboard/ModuleConnectionMap.tsx`

---

## Pre-flight

- [ ] **P1: Confirm working tree clean and on `dev` branch**

```bash
cd /Users/andre/Repository/clicker-universe/dev/clicker-platform-v2
git status
git branch --show-current
```

Expected: working tree clean (apart from untracked superpowers notes), branch = `dev`.

- [ ] **P2: Verify dev server starts and existing dashboard renders**

```bash
pnpm dev
```

Open `http://localhost:3000/admin` after logging in. Confirm current dashboard renders (Quick Actions hero, Pages grid, Module cards). Stop the server (`Ctrl-C`) before continuing.

- [ ] **P3: Identify the canonical inbox submissions Firestore path**

The spec says "verify during implementation". Run:

```bash
grep -rn "collection(db" app/admin/\(dashboard\)/inbox/ lib/modules/forms/ 2>/dev/null | grep -i "submission\|inbox" | head -10
```

Note the exact path (likely `sites/{siteId}/submissions` or similar). Record it for Task 4. If multiple candidates, open `app/admin/(dashboard)/inbox/page.tsx` and confirm which collection drives the inbox list.

- [ ] **P4: Identify the page detail route format**

```bash
ls app/admin/\(dashboard\)/pages/
```

Confirm whether the page editor lives at `/admin/pages/{id}` or elsewhere. Record for Task 5.

---

## Task 1: `dashboard-overview` helper module (TDD)

**Files:**
- Create: `lib/modules/dashboard-overview.ts`
- Test: `lib/modules/__tests__/dashboard-overview.test.ts`

### Task 1.1 — Write failing test for `filterVisibleWidgets`

- [ ] **Step 1: Create the test file**

```ts
// lib/modules/__tests__/dashboard-overview.test.ts
import { describe, it, expect } from 'vitest';
import { filterVisibleWidgets, defaultVisibleWidgets } from '../dashboard-overview';
import type { ModuleDefinition } from '../types';

const makeModule = (id: string, hasWidget = true, enabled = true): ModuleDefinition => ({
  id,
  displayName: id,
  icon: 'cog',
  version: '1.0.0',
  enabled,
  ...(hasWidget ? { adminDashboardWidget: { componentKey: `${id}:DashboardWidget` } } : {}),
});

describe('filterVisibleWidgets', () => {
  it('drops ids for modules that are not enabled', () => {
    const stored = ['membership', 'byod_pos', 'gone'];
    const modules = [makeModule('membership'), makeModule('byod_pos')];
    expect(filterVisibleWidgets(stored, modules)).toEqual(['membership', 'byod_pos']);
  });

  it('drops ids for modules without an adminDashboardWidget', () => {
    const stored = ['membership', 'no_widget'];
    const modules = [makeModule('membership'), makeModule('no_widget', false)];
    expect(filterVisibleWidgets(stored, modules)).toEqual(['membership']);
  });

  it('preserves the stored order', () => {
    const stored = ['byod_pos', 'membership'];
    const modules = [makeModule('membership'), makeModule('byod_pos')];
    expect(filterVisibleWidgets(stored, modules)).toEqual(['byod_pos', 'membership']);
  });
});

describe('defaultVisibleWidgets', () => {
  it('returns first 3 modules with widgets in input order', () => {
    const modules = [
      makeModule('a'),
      makeModule('no_widget', false),
      makeModule('b'),
      makeModule('c'),
      makeModule('d'),
    ];
    expect(defaultVisibleWidgets(modules)).toEqual(['a', 'b', 'c']);
  });

  it('returns fewer than 3 if not enough widget-capable modules', () => {
    const modules = [makeModule('a'), makeModule('no_widget', false)];
    expect(defaultVisibleWidgets(modules)).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm vitest run lib/modules/__tests__/dashboard-overview.test.ts
```

Expected: FAIL — module not found.

### Task 1.2 — Implement `dashboard-overview.ts`

- [ ] **Step 3: Create the module**

```ts
// lib/modules/dashboard-overview.ts
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ModuleDefinition } from './types';

const DEFAULT_VISIBLE_COUNT = 3;

/**
 * Filter a stored visibleWidgets array down to only ids that are
 * still enabled and still have an adminDashboardWidget. Preserves order.
 */
export function filterVisibleWidgets(
  storedIds: string[],
  enabledModules: ModuleDefinition[],
): string[] {
  const widgetCapable = new Set(
    enabledModules
      .filter(m => m.adminDashboardWidget?.componentKey)
      .map(m => m.id),
  );
  return storedIds.filter(id => widgetCapable.has(id));
}

/**
 * Default visible set for a site that has never customised the overview:
 * the first DEFAULT_VISIBLE_COUNT enabled modules that have widgets,
 * in registry order.
 */
export function defaultVisibleWidgets(enabledModules: ModuleDefinition[]): string[] {
  return enabledModules
    .filter(m => m.adminDashboardWidget?.componentKey)
    .slice(0, DEFAULT_VISIBLE_COUNT)
    .map(m => m.id);
}

export interface DashboardOverviewDoc {
  visibleWidgets?: string[];
}

/**
 * Subscribe to the dashboardOverview field on sites/{siteId}.
 * Calls cb with the raw stored array (or null if unset).
 */
export function subscribeToDashboardOverview(
  siteId: string,
  cb: (stored: string[] | null) => void,
): () => void {
  if (!siteId || siteId === 'default' || siteId === 'pending') {
    cb(null);
    return () => {};
  }
  return onSnapshot(doc(db, 'sites', siteId), snap => {
    const data = snap.data();
    const stored = data?.dashboardOverview?.visibleWidgets;
    cb(Array.isArray(stored) ? stored : null);
  });
}

/**
 * Persist the visibleWidgets array.
 */
export async function setVisibleWidgets(siteId: string, ids: string[]): Promise<void> {
  await setDoc(
    doc(db, 'sites', siteId),
    { dashboardOverview: { visibleWidgets: ids } },
    { merge: true },
  );
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
pnpm vitest run lib/modules/__tests__/dashboard-overview.test.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/modules/dashboard-overview.ts lib/modules/__tests__/dashboard-overview.test.ts
git commit -m "feat(dashboard): add dashboard-overview helper for per-site widget visibility"
```

---

## Task 2: Extract widget registry

Move the widget registry out of `ModuleCards.tsx` so both the old (during transition) and new column can share it, and so the picker can read it.

**Files:**
- Create: `components/admin/dashboard/WidgetRegistry.ts`

- [ ] **Step 1: Create the registry file**

```ts
// components/admin/dashboard/WidgetRegistry.ts
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

const PosWidget = dynamic(() => import('./widgets/PosWidget').then(m => m.PosWidget));
const ReservationWidget = dynamic(() => import('./widgets/ReservationWidget').then(m => m.ReservationWidget));
const MembershipWidget = dynamic(() => import('./widgets/MembershipWidget').then(m => m.MembershipWidget));
const InventoryWidget = dynamic(() => import('./widgets/InventoryWidget').then(m => m.InventoryWidget));
const PromoWidget = dynamic(() => import('./widgets/PromoWidget').then(m => m.PromoWidget));
const ServiceRecordsWidget = dynamic(() => import('./widgets/ServiceRecordsWidget').then(m => m.ServiceRecordsWidget));
const SalesPipelineWidget = dynamic(() => import('./widgets/SalesPipelineWidget').then(m => m.SalesPipelineWidget));
const FintrackWidget = dynamic(() => import('./widgets/FintrackWidget').then(m => m.FintrackWidget));

export const WIDGET_REGISTRY: Record<string, ComponentType<{ siteId: string }>> = {
  'byod_pos:DashboardWidget': PosWidget,
  'reservation:DashboardWidget': ReservationWidget,
  'membership:DashboardWidget': MembershipWidget,
  'inventory:DashboardWidget': InventoryWidget,
  'promo:DashboardWidget': PromoWidget,
  'service_records:DashboardWidget': ServiceRecordsWidget,
  'sales_pipeline:DashboardWidget': SalesPipelineWidget,
  'fintrack:DashboardWidget': FintrackWidget,
};
```

- [ ] **Step 2: Type-check**

```bash
pnpm tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/dashboard/WidgetRegistry.ts
git commit -m "refactor(dashboard): extract WIDGET_REGISTRY to its own module"
```

---

## Task 3: `OverviewLayout` shell

**Files:**
- Create: `components/admin/dashboard/OverviewLayout.tsx`

- [ ] **Step 1: Create the layout component**

```tsx
// components/admin/dashboard/OverviewLayout.tsx
'use client';

import type { ReactNode } from 'react';

interface Props {
  inbox: ReactNode;
  pages: ReactNode;
  modules: ReactNode;
}

/**
 * 3-column overview shell. Mobile stacks: Inbox → Pages → Modules.
 * Desktop widths: Inbox ~38%, Pages ~30%, Modules ~32% (lg+).
 */
export function OverviewLayout({ inbox, pages, modules }: Props) {
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Overview</h1>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row">
        <section className="w-full lg:basis-[38%] lg:shrink-0">{inbox}</section>
        <section className="w-full lg:basis-[30%] lg:shrink-0">{pages}</section>
        <section className="w-full lg:basis-[32%] lg:shrink-0">{modules}</section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/dashboard/OverviewLayout.tsx
git commit -m "feat(dashboard): add OverviewLayout 3-column shell"
```

---

## Task 4: `InboxColumn`

Uses the inbox submissions path identified in Pre-flight P3. The example below assumes `sites/{siteId}/submissions`; substitute the verified path.

**Files:**
- Create: `components/admin/dashboard/InboxColumn.tsx`

- [ ] **Step 1: Create the component**

Replace `COLLECTION_PATH` with the path verified in P3.

```tsx
// components/admin/dashboard/InboxColumn.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, onSnapshot, orderBy, query, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Mail } from 'lucide-react';

interface Props {
  siteId: string;
  baseUrl: string;
}

interface Submission {
  id: string;
  contactName?: string;
  formName?: string;
  preview?: string;
  read?: boolean;
  createdAt?: Timestamp;
}

type Tab = 'inbox' | 'new' | 'read';

export function InboxColumn({ siteId, baseUrl }: Props) {
  const [items, setItems] = useState<Submission[]>([]);
  const [tab, setTab] = useState<Tab>('inbox');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId || siteId === 'default' || siteId === 'pending') return;
    const q = query(
      collection(db, 'sites', siteId, 'submissions'), // P3: verified path
      orderBy('createdAt', 'desc'),
      limit(10),
    );
    const unsub = onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Submission, 'id'>) })));
      setLoading(false);
    });
    return () => unsub();
  }, [siteId]);

  const filtered = useMemo(() => {
    if (tab === 'new') return items.filter(s => !s.read);
    if (tab === 'read') return items.filter(s => s.read);
    return items;
  }, [items, tab]);

  const counts = useMemo(
    () => ({
      inbox: items.length,
      new: items.filter(s => !s.read).length,
      read: items.filter(s => s.read).length,
    }),
    [items],
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Mail className="w-4 h-4 text-gray-500" />
        <h2 className="font-semibold text-gray-800 dark:text-neutral-100">Inbox</h2>
        <span className="ml-auto text-xs bg-gray-100 dark:bg-neutral-800 rounded-full px-2 py-0.5">
          {counts.inbox}
        </span>
      </div>

      <div className="flex gap-1 mb-3 text-xs">
        {(['inbox', 'new', 'read'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-2.5 py-1 rounded-full ${
              tab === t
                ? 'bg-gray-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)} {counts[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <ul className="space-y-2">
          {[0, 1, 2].map(i => (
            <li key={i} className="h-14 rounded bg-gray-100 dark:bg-neutral-800 animate-pulse" />
          ))}
        </ul>
      ) : filtered.length === 0 ? (
        <div className="py-10 flex flex-col items-center text-gray-400 dark:text-neutral-500 text-sm">
          <Mail className="w-8 h-8 mb-2" strokeWidth={1.5} />
          <p>No submissions yet</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-neutral-800">
          {filtered.map(s => (
            <li key={s.id}>
              <Link
                href={`${baseUrl}/admin/inbox?submissionId=${s.id}`}
                className="block py-2.5 hover:bg-gray-50 dark:hover:bg-neutral-800/50 -mx-2 px-2 rounded"
              >
                <p className="text-sm font-medium text-gray-800 dark:text-neutral-200 truncate">
                  {s.contactName ?? 'Anonymous'}
                  {s.formName && (
                    <span className="text-gray-400 dark:text-neutral-500 font-normal"> — {s.formName}</span>
                  )}
                </p>
                {s.preview && (
                  <p className="text-xs text-gray-500 dark:text-neutral-400 truncate">{s.preview}</p>
                )}
                <p className="text-[10px] text-gray-400 dark:text-neutral-500 mt-0.5">
                  {formatRelative(s.createdAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link
        href={`${baseUrl}/admin/inbox`}
        className="block mt-3 text-center text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
      >
        View all in Inbox →
      </Link>
    </div>
  );
}

function formatRelative(ts?: Timestamp): string {
  if (!ts) return '';
  const date = ts.toDate();
  const diffMs = Date.now() - date.getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
```

- [ ] **Step 2: Verify Submission interface fields against actual data**

```bash
grep -rn "interface Submission\|type Submission" lib/ app/ 2>/dev/null | head -5
```

If a canonical `Submission` type exists, replace the local interface with an import. If field names differ (e.g., `senderName` vs `contactName`), adapt accordingly. **Do not invent field names** — open one submission doc in the inbox to verify shape before committing.

- [ ] **Step 3: Type-check**

```bash
pnpm tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/admin/dashboard/InboxColumn.tsx
git commit -m "feat(dashboard): add InboxColumn with submissions preview and tabs"
```

---

## Task 5: `PagesColumn`

Uses page detail route verified in P4.

**Files:**
- Create: `components/admin/dashboard/PagesColumn.tsx`
- Test: `components/admin/dashboard/__tests__/PagesColumn.test.tsx`

### Task 5.1 — Helper test for thumbnail color

- [ ] **Step 1: Create the test**

```tsx
// components/admin/dashboard/__tests__/PagesColumn.test.tsx
import { describe, it, expect } from 'vitest';
import { pickThumbnailColor } from '../PagesColumn';

describe('pickThumbnailColor', () => {
  it('returns the same color for the same id', () => {
    expect(pickThumbnailColor('abc')).toBe(pickThumbnailColor('abc'));
  });

  it('returns one of the palette entries', () => {
    const palette = ['bg-blue-100', 'bg-pink-100', 'bg-yellow-100', 'bg-green-100', 'bg-purple-100', 'bg-orange-100'];
    expect(palette).toContain(pickThumbnailColor('hello'));
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
pnpm vitest run components/admin/dashboard/__tests__/PagesColumn.test.tsx
```

Expected: FAIL — `pickThumbnailColor` not found.

### Task 5.2 — Implement `PagesColumn`

- [ ] **Step 3: Create the component**

Replace `PAGE_DETAIL_ROUTE` with the format verified in P4 (likely `/admin/pages/{id}`).

```tsx
// components/admin/dashboard/PagesColumn.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, onSnapshot, orderBy, query, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FileText, Plus, Square } from 'lucide-react';

interface Props {
  siteId: string;
  baseUrl: string;
}

interface PageDoc {
  id: string;
  name?: string;
  title?: string;
  updatedAt?: Timestamp;
}

const PALETTE = [
  'bg-blue-100 dark:bg-blue-900/30',
  'bg-pink-100 dark:bg-pink-900/30',
  'bg-yellow-100 dark:bg-yellow-900/30',
  'bg-green-100 dark:bg-green-900/30',
  'bg-purple-100 dark:bg-purple-900/30',
  'bg-orange-100 dark:bg-orange-900/30',
];

export function pickThumbnailColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function PagesColumn({ siteId, baseUrl }: Props) {
  const [pages, setPages] = useState<PageDoc[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId || siteId === 'default' || siteId === 'pending') return;
    const q = query(
      collection(db, 'sites', siteId, 'pages'),
      orderBy('updatedAt', 'desc'),
      limit(7), // fetch one extra to detect overflow
    );
    const unsub = onSnapshot(q, snap => {
      setPages(snap.docs.slice(0, 6).map(d => ({ id: d.id, ...(d.data() as Omit<PageDoc, 'id'>) })));
      setTotalCount(snap.size); // approx; if 7 returned, there are >=7
      setLoading(false);
    });
    return () => unsub();
  }, [siteId]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Square className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-800 dark:text-neutral-100">Pages</h2>
        </div>
        <Link
          href={`${baseUrl}/admin/canvas`}
          className="text-xs text-gray-500 hover:text-gray-700 dark:text-neutral-400"
        >
          Canvas Studio →
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded bg-gray-100 dark:bg-neutral-800 animate-pulse" />
          ))}
        </div>
      ) : pages.length === 0 ? (
        <Link
          href={`${baseUrl}/admin/pages?new=1`}
          className="block py-8 border-2 border-dashed border-gray-300 dark:border-neutral-700 rounded text-center text-sm text-gray-500 dark:text-neutral-400 hover:border-gray-400"
        >
          <Plus className="w-5 h-5 mx-auto mb-1" />
          Create your first page
        </Link>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {pages.map(p => (
            <Link
              key={p.id}
              href={`${baseUrl}/admin/pages/${p.id}`} // P4: verified format
              className="block border border-gray-200 dark:border-neutral-800 rounded overflow-hidden hover:border-gray-400 transition-colors"
            >
              <div className={`h-14 flex items-center justify-center ${pickThumbnailColor(p.id)}`}>
                <FileText className="w-5 h-5 text-gray-400 dark:text-neutral-500" />
              </div>
              <p className="px-2 py-1.5 text-xs font-medium text-gray-800 dark:text-neutral-200 truncate">
                {p.name ?? p.title ?? 'Untitled'}
              </p>
            </Link>
          ))}
          {totalCount > 6 ? (
            <Link
              href={`${baseUrl}/admin/pages`}
              className="block border-2 border-dashed border-gray-300 dark:border-neutral-700 rounded h-[5.5rem] flex items-center justify-center text-xs text-gray-500"
            >
              View all →
            </Link>
          ) : (
            <Link
              href={`${baseUrl}/admin/pages?new=1`}
              className="block border-2 border-dashed border-gray-300 dark:border-neutral-700 rounded h-[5.5rem] flex items-center justify-center text-gray-400 hover:border-gray-400"
              aria-label="Create new page"
            >
              <Plus className="w-5 h-5" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify page name field**

```bash
grep -n "name\|title" lib/modules/pages/types.ts 2>/dev/null | head -5
# Or open one page doc in Firestore console to verify field name
```

If the field is `title` not `name`, the component already handles both via `p.name ?? p.title ?? 'Untitled'`. Keep as-is.

- [ ] **Step 5: Run tests, expect pass**

```bash
pnpm vitest run components/admin/dashboard/__tests__/PagesColumn.test.tsx
```

Expected: PASS — 2 tests.

- [ ] **Step 6: Type-check**

```bash
pnpm tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add components/admin/dashboard/PagesColumn.tsx components/admin/dashboard/__tests__/PagesColumn.test.tsx
git commit -m "feat(dashboard): add PagesColumn with compact card grid"
```

---

## Task 6: `AddModuleWidgetPicker` (TDD)

**Files:**
- Create: `components/admin/dashboard/AddModuleWidgetPicker.tsx`
- Test: `components/admin/dashboard/__tests__/AddModuleWidgetPicker.test.tsx`

### Task 6.1 — Failing test

- [ ] **Step 1: Create test**

```tsx
// components/admin/dashboard/__tests__/AddModuleWidgetPicker.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddModuleWidgetPicker } from '../AddModuleWidgetPicker';
import type { ModuleDefinition } from '@/lib/modules/types';

const makeModule = (id: string, displayName: string): ModuleDefinition => ({
  id,
  displayName,
  icon: 'cog',
  version: '1.0.0',
  enabled: true,
  adminDashboardWidget: { componentKey: `${id}:DashboardWidget` },
});

const candidates = [
  makeModule('membership', 'Membership & Loyalty'),
  makeModule('byod_pos', 'Self Order'),
  makeModule('promo', 'Promo'),
];

describe('AddModuleWidgetPicker', () => {
  it('pre-checks already-visible modules', () => {
    render(
      <AddModuleWidgetPicker
        open
        candidates={candidates}
        currentVisible={['membership']}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByLabelText('Membership & Loyalty')).toBeChecked();
    expect(screen.getByLabelText('Self Order')).not.toBeChecked();
  });

  it('calls onSave with the new ids, appending new picks to existing order', () => {
    const onSave = vi.fn();
    render(
      <AddModuleWidgetPicker
        open
        candidates={candidates}
        currentVisible={['membership']}
        onSave={onSave}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByLabelText('Self Order'));
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith(['membership', 'byod_pos']);
  });

  it('removes deselected ids on save', () => {
    const onSave = vi.fn();
    render(
      <AddModuleWidgetPicker
        open
        candidates={candidates}
        currentVisible={['membership', 'byod_pos']}
        onSave={onSave}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByLabelText('Membership & Loyalty')); // uncheck
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith(['byod_pos']);
  });

  it('discards changes on cancel', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <AddModuleWidgetPicker
        open
        candidates={candidates}
        currentVisible={['membership']}
        onSave={onSave}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByLabelText('Self Order'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
pnpm vitest run components/admin/dashboard/__tests__/AddModuleWidgetPicker.test.tsx
```

Expected: FAIL — component not found.

### Task 6.2 — Implement picker

- [ ] **Step 3: Create the component**

```tsx
// components/admin/dashboard/AddModuleWidgetPicker.tsx
'use client';

import { useEffect, useState } from 'react';
import type { ModuleDefinition } from '@/lib/modules/types';

interface Props {
  open: boolean;
  candidates: ModuleDefinition[];
  currentVisible: string[];
  onSave: (ids: string[]) => void;
  onClose: () => void;
}

export function AddModuleWidgetPicker({ open, candidates, currentVisible, onSave, onClose }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(currentVisible));

  useEffect(() => {
    if (open) setSelected(new Set(currentVisible));
  }, [open, currentVisible]);

  if (!open) return null;

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    // Preserve current order; append new picks at the end.
    const kept = currentVisible.filter(id => selected.has(id));
    const added = candidates
      .map(c => c.id)
      .filter(id => selected.has(id) && !currentVisible.includes(id));
    onSave([...kept, ...added]);
    onClose();
  };

  return (
    <div className="absolute z-50 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
      <div className="p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Add to overview
        </p>
        {candidates.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">No modules with overview widgets yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {candidates.map(c => (
              <li key={c.id}>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                    aria-label={c.displayName}
                  />
                  <span>{c.displayName}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-gray-100 dark:border-neutral-800 p-2">
        <button onClick={onClose} className="text-xs px-3 py-1 rounded text-gray-600">
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="text-xs px-3 py-1 rounded bg-gray-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          Save
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
pnpm vitest run components/admin/dashboard/__tests__/AddModuleWidgetPicker.test.tsx
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add components/admin/dashboard/AddModuleWidgetPicker.tsx components/admin/dashboard/__tests__/AddModuleWidgetPicker.test.tsx
git commit -m "feat(dashboard): add AddModuleWidgetPicker popover"
```

---

## Task 7: `ModulesColumn`

**Files:**
- Create: `components/admin/dashboard/ModulesColumn.tsx`

- [ ] **Step 1: Find the canEdit helper**

```bash
grep -rn "canEdit\|useCanEdit" lib/rbac.ts lib/user-context.tsx 2>/dev/null | head -10
```

Record the exact import path and function shape. The example below assumes `useCanEdit()` from `@/lib/user-context` returning `boolean`. Adapt if different.

- [ ] **Step 2: Create the component**

```tsx
// components/admin/dashboard/ModulesColumn.tsx
'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { X, Plus, Box } from 'lucide-react';
import type { ModuleDefinition } from '@/lib/modules/types';
import { WIDGET_REGISTRY } from './WidgetRegistry';
import { AddModuleWidgetPicker } from './AddModuleWidgetPicker';
import { setVisibleWidgets } from '@/lib/modules/dashboard-overview';
import { useCanEdit } from '@/lib/user-context'; // verify in Step 1

interface Props {
  siteId: string;
  baseUrl: string;
  enabledModules: ModuleDefinition[];
  visibleIds: string[];
}

export function ModulesColumn({ siteId, baseUrl, enabledModules, visibleIds }: Props) {
  const canEdit = useCanEdit();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerAnchor = useRef<HTMLDivElement>(null);

  const moduleById = useMemo(() => {
    const map = new Map<string, ModuleDefinition>();
    enabledModules.forEach(m => map.set(m.id, m));
    return map;
  }, [enabledModules]);

  const candidates = useMemo(
    () => enabledModules.filter(m => m.adminDashboardWidget?.componentKey),
    [enabledModules],
  );

  const handleSave = async (ids: string[]) => {
    await setVisibleWidgets(siteId, ids);
  };

  const handleRemove = async (id: string) => {
    await setVisibleWidgets(siteId, visibleIds.filter(x => x !== id));
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Box className="w-4 h-4 text-gray-500" />
        <h2 className="font-semibold text-gray-800 dark:text-neutral-100">Modules</h2>
      </div>

      <div className="space-y-2">
        {visibleIds.map(id => {
          const mod = moduleById.get(id);
          if (!mod) return null;
          const key = mod.adminDashboardWidget?.componentKey;
          const Widget = key ? WIDGET_REGISTRY[key] : null;
          const href = mod.dashboardAction?.href
            ? `${baseUrl}${mod.dashboardAction.href}`
            : `${baseUrl}/admin`;

          return (
            <div
              key={id}
              className="group relative rounded border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/40 p-3 hover:border-gray-300"
            >
              {canEdit && (
                <button
                  onClick={e => {
                    e.preventDefault();
                    handleRemove(id);
                  }}
                  aria-label={`Remove ${mod.displayName}`}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-200 dark:hover:bg-neutral-700"
                >
                  <X className="w-3.5 h-3.5 text-gray-500" />
                </button>
              )}
              <Link href={href} className="block">
                {Widget ? (
                  <Widget siteId={siteId} />
                ) : (
                  <p className="text-xs text-gray-400">No data</p>
                )}
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                  {mod.displayName}
                </p>
              </Link>
            </div>
          );
        })}

        {visibleIds.length === 0 && canEdit && (
          <p className="text-xs text-gray-400 dark:text-neutral-500 px-1 py-2">
            Pick which modules to show here.
          </p>
        )}

        {canEdit && (
          <div ref={pickerAnchor} className="relative">
            <button
              onClick={() => setPickerOpen(o => !o)}
              className="w-full border-2 border-dashed border-gray-300 dark:border-neutral-700 rounded p-3 text-xs text-gray-500 hover:border-gray-400 flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add module
            </button>
            <AddModuleWidgetPicker
              open={pickerOpen}
              candidates={candidates}
              currentVisible={visibleIds}
              onSave={handleSave}
              onClose={() => setPickerOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm tsc --noEmit
```

Expected: no new errors. If `useCanEdit` doesn't exist, replace with the actual edit-permission check (e.g., `useUser().canEdit` or `useUser().role === 'admin'`). **Do not invent a hook** — use what the codebase already exports.

- [ ] **Step 4: Commit**

```bash
git add components/admin/dashboard/ModulesColumn.tsx
git commit -m "feat(dashboard): add ModulesColumn with curated widgets and picker"
```

---

## Task 8: Rewrite the dashboard page

**Files:**
- Modify: `app/admin/(dashboard)/page.tsx`
- Modify: `components/skeletons/DashboardSkeletonNew.tsx`

- [ ] **Step 1: Update the skeleton to match 3-column layout**

```tsx
// components/skeletons/DashboardSkeletonNew.tsx
export function DashboardSkeletonNew() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-32 bg-gray-100 dark:bg-neutral-800 rounded animate-pulse" />
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="w-full lg:basis-[38%] h-96 bg-gray-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
        <div className="w-full lg:basis-[30%] h-96 bg-gray-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
        <div className="w-full lg:basis-[32%] h-96 bg-gray-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite the page**

```tsx
// app/admin/(dashboard)/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSite } from '@/lib/site-context';
import { subscribeToEnabledModules } from '@/lib/modules/registry';
import { STATIC_MODULE_DEFINITIONS } from '@/lib/modules/definitions';
import type { ModuleDefinition } from '@/lib/modules/types';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  subscribeToDashboardOverview,
  filterVisibleWidgets,
  defaultVisibleWidgets,
} from '@/lib/modules/dashboard-overview';
import { OverviewLayout } from '@/components/admin/dashboard/OverviewLayout';
import { InboxColumn } from '@/components/admin/dashboard/InboxColumn';
import { PagesColumn } from '@/components/admin/dashboard/PagesColumn';
import { ModulesColumn } from '@/components/admin/dashboard/ModulesColumn';
import { DashboardSkeletonNew } from '@/components/skeletons/DashboardSkeletonNew';

export default function AdminDashboard() {
  const { siteId, tenantSlug, isSubdomain } = useSite();
  const [allModules, setAllModules] = useState<ModuleDefinition[]>([]);
  const [siteEnabledModules, setSiteEnabledModules] = useState<Record<string, boolean>>({});
  const [storedVisible, setStoredVisible] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  const baseUrl = tenantSlug && !isSubdomain ? `/${tenantSlug}` : '';

  useEffect(() => {
    const unsub = subscribeToEnabledModules(fetched => {
      setAllModules(fetched);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!siteId || siteId === 'default' || siteId === 'pending') return;
    const unsub = onSnapshot(doc(db, 'sites', siteId), snap => {
      if (snap.exists()) {
        const data = snap.data();
        const legacy = data.settings?.modules ?? {};
        const root = data.modules ?? {};
        setSiteEnabledModules({ ...legacy, ...root });
      }
    });
    return () => unsub();
  }, [siteId]);

  useEffect(() => {
    if (!siteId) return;
    return subscribeToDashboardOverview(siteId, setStoredVisible);
  }, [siteId]);

  const enabledModules = useMemo<ModuleDefinition[]>(
    () =>
      allModules
        .filter(m => siteEnabledModules[m.id] === true)
        .map(m => ({ ...m, ...(STATIC_MODULE_DEFINITIONS[m.id] ?? {}) })),
    [allModules, siteEnabledModules],
  );

  const visibleIds = useMemo(() => {
    if (storedVisible === null) return defaultVisibleWidgets(enabledModules);
    return filterVisibleWidgets(storedVisible, enabledModules);
  }, [storedVisible, enabledModules]);

  if (loading) return <DashboardSkeletonNew />;

  return (
    <OverviewLayout
      inbox={<InboxColumn siteId={siteId} baseUrl={baseUrl} />}
      pages={<PagesColumn siteId={siteId} baseUrl={baseUrl} />}
      modules={
        <ModulesColumn
          siteId={siteId}
          baseUrl={baseUrl}
          enabledModules={enabledModules}
          visibleIds={visibleIds}
        />
      }
    />
  );
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add app/admin/\(dashboard\)/page.tsx components/skeletons/DashboardSkeletonNew.tsx
git commit -m "feat(dashboard): wire new 3-column overview into dashboard page"
```

---

## Task 9: Remove obsolete components

- [ ] **Step 1: Verify nothing else imports the old components**

```bash
grep -rn "QuickActionsHero\|PagesGrid\|ModuleCards\|ModuleConnectionMap" --include="*.tsx" --include="*.ts" .
```

Expected: matches only inside the files about to be deleted (or none). If any other file imports these, fix that file first before continuing.

- [ ] **Step 2: Delete the obsolete files**

```bash
rm components/admin/dashboard/QuickActionsHero.tsx
rm components/admin/dashboard/PagesGrid.tsx
rm components/admin/dashboard/ModuleCards.tsx
rm components/admin/dashboard/ModuleConnectionMap.tsx
```

- [ ] **Step 3: Type-check + build**

```bash
pnpm tsc --noEmit
pnpm build
```

Expected: no errors. If `pnpm build` is slow, `pnpm lint && pnpm tsc --noEmit` is acceptable.

- [ ] **Step 4: Commit**

```bash
git add -A components/admin/dashboard/
git commit -m "chore(dashboard): remove obsolete dashboard components"
```

---

## Task 10: Manual verification in browser

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Verify the dashboard**

Open `http://localhost:3000/admin`. Walk through:

1. **Layout:** 3 columns side-by-side on desktop. Inbox visibly wider than Pages.
2. **Resize to mobile width** (DevTools, ~375px): columns stack as Inbox → Pages → Modules.
3. **Inbox column:**
   - Header shows "Inbox" + count
   - Tabs (Inbox / New / Read) switch the filter and update counts
   - Empty state shows envelope + "No submissions yet" when no data
   - "View all in Inbox →" link navigates to `/admin/inbox`
4. **Pages column:**
   - Header shows "Pages" + "Canvas Studio →" link (routes correctly)
   - Up to 6 cards in a 2-column grid
   - "+" tile present (or "View all" if >6 pages)
   - Card click navigates to the page editor
5. **Modules column:**
   - Default site (no `dashboardOverview` field) shows first 3 enabled modules with widgets
   - Each widget shows the primary stat + secondary line + module label
   - Hover reveals "×" on widget
   - Click "×" → widget disappears, persists across reload
   - Click "+ Add module" → popover appears with checkboxes
   - Toggle a module + Save → widget appears, persists across reload
   - Cancel discards changes
6. **RBAC:** Log in as a read-only role (if you have one). Confirm "×" and "+ Add module" are hidden.

If any step fails, fix the underlying cause before continuing. Do NOT claim success until every checkbox passes.

- [ ] **Step 3: Note any deviations**

Record any deviations from spec (e.g., field name mismatches, route differences) in `dev/superpowers/notes/2026-05-14-dashboard-overview-implementation-notes.md`.

---

## Task 11: Final commit & wrap-up

- [ ] **Step 1: Run full test + type + lint**

```bash
pnpm vitest run
pnpm tsc --noEmit
pnpm lint
```

Expected: all green. Fix any failures (do not skip).

- [ ] **Step 2: Review git log**

```bash
git log --oneline dev..HEAD
```

Confirm ~10 focused commits, one per task. Squash only if the user requests it.

- [ ] **Step 3: Final summary message**

Report:
- Tasks completed (10/10)
- Test count added
- Any deviations from spec
- Files added/modified/removed (counts)

---

## Self-Review Notes (filled in after writing)

- **Spec coverage:** §4 layout → Task 3, 8. §5 Inbox → Task 4. §6 Pages → Task 5. §7 Modules → Tasks 2, 6, 7. §8 Widget contract → Task 2 (reuses existing `adminDashboardWidget` instead of new `overviewWidget` — simpler, no spec change needed since the contract is "module declares a widget component"; the existing field already does this). §9 Storage → Task 1. §10 Files → Tasks 1–9. §11 Edge cases → handled in Tasks 4, 5, 7. §12 Testing → Tasks 1, 5, 6.
- **Spec deviation:** Spec §8 introduced a new `overviewWidget` field on `ModuleDefinition`. Implementation reuses the **existing** `adminDashboardWidget: { componentKey }` field already wired for 8 modules. The existing widget components in `components/admin/dashboard/widgets/` already output the exact two-line shape the spec wants. No new field needed, no per-module widget components to write. This is recorded here and should be reflected in spec §8 if the user wants spec/code parity — but it's a simplification, not a feature change.
- **Placeholders:** None — every code block is complete. Verification steps (P3, P4, Task 4 Step 2, Task 7 Step 1) are real lookups, not placeholders.
- **Type consistency:** `filterVisibleWidgets`, `defaultVisibleWidgets`, `setVisibleWidgets`, `subscribeToDashboardOverview` — names consistent across Tasks 1, 7, 8. `WIDGET_REGISTRY` consistent Tasks 2, 7. Picker prop names (`candidates`, `currentVisible`, `onSave`, `onClose`, `open`) consistent Tasks 6, 7.
