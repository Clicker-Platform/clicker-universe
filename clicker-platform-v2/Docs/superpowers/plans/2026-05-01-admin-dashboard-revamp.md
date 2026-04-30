# Admin Dashboard Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy `/admin` dashboard with a Command Center — Quick Actions hero, Pages grid with thumbnail cards, Active Module summary cards with inline actions, and a static Module Connection map.

**Architecture:** Four new components rendered by the dashboard page (`QuickActionsHero`, `PagesGrid`, `ModuleCards`, `ModuleConnectionMap`). Active modules are resolved from `sites/{siteId}` document (same pattern as `useAdminNavGroups`). Each module card fetches its own data independently. Module definitions get two new optional fields: `dashboardAction` (for Quick Actions + card button) and `adminDashboardWidget` (for the card metric component key).

**Tech Stack:** Next.js 14 App Router, React, Firebase client SDK (Firestore), Tailwind CSS, TypeScript, Vitest

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `lib/modules/types.ts` | Add `dashboardAction` and `adminDashboardWidget` optional fields to `ModuleDefinition` |
| Modify | `lib/modules/definitions.ts` | Add `dashboardAction` + `adminDashboardWidget` to each module entry |
| Create | `components/admin/dashboard/QuickActionsHero.tsx` | Hero banner with greeting + dynamic action buttons |
| Create | `components/admin/dashboard/PagesGrid.tsx` | Grid of Canvas Studio page cards + Create CTA |
| Create | `components/admin/dashboard/ModuleCards.tsx` | Grid of active module summary cards |
| Create | `components/admin/dashboard/widgets/PosWidget.tsx` | POS metric card (revenue today, order count) |
| Create | `components/admin/dashboard/widgets/ReservationWidget.tsx` | Reservation metric card |
| Create | `components/admin/dashboard/widgets/MembershipWidget.tsx` | Membership metric card |
| Create | `components/admin/dashboard/widgets/InventoryWidget.tsx` | Inventory metric card |
| Create | `components/admin/dashboard/widgets/PromoWidget.tsx` | Promo metric card |
| Create | `components/admin/dashboard/widgets/ServiceRecordsWidget.tsx` | Service Records metric card |
| Create | `components/admin/dashboard/widgets/SalesPipelineWidget.tsx` | Sales Pipeline metric card |
| Create | `components/admin/dashboard/widgets/FintrackWidget.tsx` | FinTrack metric card |
| Create | `components/admin/dashboard/ModuleConnectionMap.tsx` | Static topology map of inter-module connections |
| Create | `components/skeletons/DashboardSkeletonNew.tsx` | Updated skeleton matching new layout |
| Modify | `app/admin/(dashboard)/page.tsx` | Full rewrite to render four new sections |

---

## Task 1: Extend ModuleDefinition type

**Files:**
- Modify: `lib/modules/types.ts`

- [ ] **Step 1: Add new fields to ModuleDefinition**

Open `lib/modules/types.ts`. After the existing `settings?: Record<string, any>` line inside `ModuleDefinition`, add:

```ts
dashboardAction?: {
  label: string    // e.g. "Open Cashier"
  href: string     // admin-relative path e.g. "/admin/pos/cashier"
}
adminDashboardWidget?: {
  componentKey: string  // e.g. "byod_pos:DashboardWidget" — looked up in widget registry
}
```

Final shape of relevant section:

```ts
export interface ModuleDefinition {
  id: string;
  displayName: string;
  description?: string;
  icon: string;
  version: string;
  enabled: boolean;
  adminRoutes?: AdminRoute[];
  publicRoutes?: PublicRouteDefinition[];
  collections?: string[];
  requires?: string[];
  blocks?: ModuleBlockDefinition[];
  dashboardWidgets?: ModuleWidgetDefinition[];   // existing — member dashboard widgets, leave untouched
  settings?: Record<string, any>;
  dashboardAction?: {                             // new
    label: string;
    href: string;
  };
  adminDashboardWidget?: {                        // new
    componentKey: string;
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no new errors relating to `ModuleDefinition`.

- [ ] **Step 3: Commit**

```bash
git add lib/modules/types.ts
git commit -m "feat(dashboard): extend ModuleDefinition with dashboardAction and adminDashboardWidget"
```

---

## Task 2: Add dashboardAction + adminDashboardWidget to module definitions

**Files:**
- Modify: `lib/modules/definitions.ts`

- [ ] **Step 1: Add fields to each module**

In `lib/modules/definitions.ts`, add `dashboardAction` and `adminDashboardWidget` to each module entry. The full additions (merge into existing object — do not replace existing `adminRoutes`):

```ts
'byod_pos': {
  adminRoutes: [ /* existing, unchanged */ ],
  dashboardAction: { label: 'Open Cashier', href: '/admin/pos/cashier' },
  adminDashboardWidget: { componentKey: 'byod_pos:DashboardWidget' },
},
'membership': {
  adminRoutes: [ /* existing, unchanged */ ],
  dashboardAction: { label: 'View Members', href: '/admin/membership/list' },
  adminDashboardWidget: { componentKey: 'membership:DashboardWidget' },
},
'inventory': {
  adminRoutes: [ /* existing, unchanged */ ],
  dashboardAction: { label: 'View Stock', href: '/admin/inventory/items' },
  adminDashboardWidget: { componentKey: 'inventory:DashboardWidget' },
},
'reservation': {
  adminRoutes: [ /* existing, unchanged */ ],
  dashboardAction: { label: 'New Booking', href: '/admin/reservation/bookings' },
  adminDashboardWidget: { componentKey: 'reservation:DashboardWidget' },
},
'promo': {
  adminRoutes: [ /* existing, unchanged */ ],
  dashboardAction: { label: 'New Promo', href: '/admin/promo' },
  adminDashboardWidget: { componentKey: 'promo:DashboardWidget' },
},
'service_records': {
  adminRoutes: [ /* existing, unchanged */ ],
  dashboardAction: { label: 'New Record', href: '/admin/service-records/new' },
  adminDashboardWidget: { componentKey: 'service_records:DashboardWidget' },
},
'sales_pipeline': {
  adminRoutes: [ /* existing, unchanged */ ],
  dashboardAction: { label: 'View Pipeline', href: '/admin/sales-pipeline/board' },
  adminDashboardWidget: { componentKey: 'sales_pipeline:DashboardWidget' },
},
'fintrack': {
  adminRoutes: [ /* existing, unchanged */ ],
  dashboardAction: { label: 'View Entries', href: '/admin/fintrack/entries' },
  adminDashboardWidget: { componentKey: 'fintrack:DashboardWidget' },
},
// stocklens, ai_sales, ai_marketing — no dashboardAction (no primary CTA appropriate for home)
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/modules/definitions.ts
git commit -m "feat(dashboard): add dashboardAction and adminDashboardWidget to all module definitions"
```

---

## Task 3: QuickActionsHero component

**Files:**
- Create: `components/admin/dashboard/QuickActionsHero.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ModuleDefinition } from '@/lib/modules/types';

interface Props {
  businessName: string;
  activeModules: ModuleDefinition[];
  baseUrl: string;
}

const PAGE_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-rose-500', 'bg-amber-500', 'bg-cyan-500',
];

function today(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

export function QuickActionsHero({ businessName, activeModules, baseUrl }: Props) {
  const actions = activeModules
    .filter(m => m.dashboardAction)
    .map((m, i) => ({
      label: m.dashboardAction!.label,
      href: `${baseUrl}${m.dashboardAction!.href}`,
      color: PAGE_COLORS[i % PAGE_COLORS.length],
    }));

  return (
    <div className="bg-[#1e3a5f] rounded-xl p-5 text-white mb-6">
      <p className="text-base font-semibold mb-0.5">👋 Welcome back</p>
      <p className="text-sm text-blue-200 mb-4">
        {businessName} · {today()}
      </p>
      <div className="flex flex-wrap gap-2">
        {/* Create Page — always first */}
        <Link
          href={`${baseUrl}/admin/canvas`}
          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors rounded-lg px-3 py-2 text-sm font-medium"
        >
          <Plus size={14} />
          Create Page
        </Link>
        {actions.map(a => (
          <Link
            key={a.href}
            href={a.href}
            className="bg-white/10 hover:bg-white/20 transition-colors rounded-lg px-3 py-2 text-sm font-medium"
          >
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/dashboard/QuickActionsHero.tsx
git commit -m "feat(dashboard): add QuickActionsHero component"
```

---

## Task 4: PagesGrid component

**Files:**
- Create: `components/admin/dashboard/PagesGrid.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';

interface Page {
  id: string;
  title: string;
  status: 'published' | 'draft';
}

const THUMBNAIL_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-rose-500', 'bg-amber-500', 'bg-cyan-500',
];

interface Props {
  baseUrl: string;
}

export function PagesGrid({ baseUrl }: Props) {
  const { siteId } = useSite();
  const [pages, setPages] = useState<Page[]>([]);

  useEffect(() => {
    if (!siteId) return;
    const unsub = onSnapshot(
      query(collection(db, 'sites', siteId, 'pages'), orderBy('updatedAt', 'desc'), limit(6)),
      snap => {
        setPages(snap.docs.map(d => ({
          id: d.id,
          title: d.data().title ?? 'Untitled',
          status: d.data().published ? 'published' : 'draft',
        })));
      }
    );
    return () => unsub();
  }, [siteId]);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400 dark:text-neutral-500">Pages</h2>
        {pages.length > 0 && (
          <Link href={`${baseUrl}/admin/canvas`} className="text-xs text-blue-500 hover:underline">
            View all →
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {pages.map((page, i) => (
          <div
            key={page.id}
            className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden"
          >
            <div className={`h-14 ${THUMBNAIL_COLORS[i % THUMBNAIL_COLORS.length]}`} />
            <div className="p-2.5">
              <p className="font-semibold text-xs text-gray-800 dark:text-neutral-100 truncate mb-1.5">
                {page.title}
              </p>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  page.status === 'published'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                }`}>
                  {page.status === 'published' ? 'Published' : 'Draft'}
                </span>
                <Link
                  href={`${baseUrl}/admin/canvas?page=${page.id}`}
                  className="text-[10px] text-blue-500 hover:underline"
                >
                  Edit →
                </Link>
              </div>
            </div>
          </div>
        ))}

        {/* Create Page CTA */}
        <Link
          href={`${baseUrl}/admin/canvas`}
          className="border-2 border-dashed border-blue-300 dark:border-blue-800 rounded-lg flex flex-col items-center justify-center gap-1 min-h-[96px] hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
        >
          <span className="text-xl text-blue-400">+</span>
          <span className="text-xs font-semibold text-blue-500">Create Page</span>
        </Link>
      </div>

      {pages.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-neutral-500 mt-2">
          You haven&apos;t created any pages yet. Start building your site.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/dashboard/PagesGrid.tsx
git commit -m "feat(dashboard): add PagesGrid component"
```

---

## Task 5: Module widget components (all 8)

**Files:**
- Create: `components/admin/dashboard/widgets/PosWidget.tsx`
- Create: `components/admin/dashboard/widgets/ReservationWidget.tsx`
- Create: `components/admin/dashboard/widgets/MembershipWidget.tsx`
- Create: `components/admin/dashboard/widgets/InventoryWidget.tsx`
- Create: `components/admin/dashboard/widgets/PromoWidget.tsx`
- Create: `components/admin/dashboard/widgets/ServiceRecordsWidget.tsx`
- Create: `components/admin/dashboard/widgets/SalesPipelineWidget.tsx`
- Create: `components/admin/dashboard/widgets/FintrackWidget.tsx`

Each widget is a self-contained client component that fetches its own Firestore data. All widgets share the same props interface and card shell — only the data query and display differ.

- [ ] **Step 1: Create PosWidget**

```tsx
// components/admin/dashboard/widgets/PosWidget.tsx
'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';

interface Props { siteId: string }

export function PosWidget({ siteId }: Props) {
  const [revenue, setRevenue] = useState<number | null>(null);
  const [orders, setOrders] = useState<number | null>(null);

  useEffect(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    getDocs(query(
      collection(db, 'sites', siteId, 'pos_orders'),
      where('status', '==', 'completed'),
      where('createdAt', '>=', Timestamp.fromDate(startOfDay))
    )).then(snap => {
      let total = 0;
      snap.forEach(d => { total += d.data().total ?? 0; });
      setRevenue(total);
      setOrders(snap.size);
    }).catch(() => {});
  }, [siteId]);

  return (
    <>
      <p className="text-xl font-bold text-gray-800 dark:text-neutral-100">
        {revenue === null ? '—' : `Rp ${revenue.toLocaleString('id-ID')}`}
      </p>
      <p className="text-xs text-gray-500 dark:text-neutral-400">
        {orders === null ? '' : `${orders} orders · today`}
      </p>
    </>
  );
}
```

- [ ] **Step 2: Create ReservationWidget**

```tsx
// components/admin/dashboard/widgets/ReservationWidget.tsx
'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Props { siteId: string }

export function ReservationWidget({ siteId }: Props) {
  const [total, setTotal] = useState<number | null>(null);
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    getDocs(query(
      collection(db, 'sites', siteId, 'bookings'),
      where('date', '>=', Timestamp.fromDate(startOfDay))
    )).then(snap => {
      setTotal(snap.size);
      setPending(snap.docs.filter(d => d.data().status === 'pending').length);
    }).catch(() => {});
  }, [siteId]);

  return (
    <>
      <p className="text-xl font-bold text-gray-800 dark:text-neutral-100">
        {total === null ? '—' : `${total} bookings`}
      </p>
      <p className="text-xs text-gray-500 dark:text-neutral-400">
        {pending === null ? '' : `${pending} pending confirmation`}
      </p>
    </>
  );
}
```

- [ ] **Step 3: Create MembershipWidget**

```tsx
// components/admin/dashboard/widgets/MembershipWidget.tsx
'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getCountFromServer, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Props { siteId: string }

export function MembershipWidget({ siteId }: Props) {
  const [total, setTotal] = useState<number | null>(null);
  const [newThisWeek, setNewThisWeek] = useState<number | null>(null);

  useEffect(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const col = collection(db, 'sites', siteId, 'members');
    Promise.all([
      getCountFromServer(col),
      getCountFromServer(query(col, where('createdAt', '>=', Timestamp.fromDate(weekAgo)))),
    ]).then(([totalSnap, weekSnap]) => {
      setTotal(totalSnap.data().count);
      setNewThisWeek(weekSnap.data().count);
    }).catch(() => {});
  }, [siteId]);

  return (
    <>
      <p className="text-xl font-bold text-gray-800 dark:text-neutral-100">
        {total === null ? '—' : `${total} members`}
      </p>
      <p className="text-xs text-gray-500 dark:text-neutral-400">
        {newThisWeek === null ? '' : `+${newThisWeek} new this week`}
      </p>
    </>
  );
}
```

- [ ] **Step 4: Create InventoryWidget**

```tsx
// components/admin/dashboard/widgets/InventoryWidget.tsx
'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Props { siteId: string }

export function InventoryWidget({ siteId }: Props) {
  const [total, setTotal] = useState<number | null>(null);
  const [lowStock, setLowStock] = useState<number | null>(null);

  useEffect(() => {
    const col = collection(db, 'sites', siteId, 'inventory_items');
    Promise.all([
      getCountFromServer(col),
      getCountFromServer(query(col, where('lowStock', '==', true))),
    ]).then(([totalSnap, lowSnap]) => {
      setTotal(totalSnap.data().count);
      setLowStock(lowSnap.data().count);
    }).catch(() => {});
  }, [siteId]);

  return (
    <>
      <p className="text-xl font-bold text-gray-800 dark:text-neutral-100">
        {total === null ? '—' : `${total} items`}
      </p>
      <p className={`text-xs font-medium ${lowStock ? 'text-red-500' : 'text-gray-500 dark:text-neutral-400'}`}>
        {lowStock === null ? '' : lowStock > 0 ? `⚠ ${lowStock} low stock` : 'Stock OK'}
      </p>
    </>
  );
}
```

- [ ] **Step 5: Create PromoWidget**

```tsx
// components/admin/dashboard/widgets/PromoWidget.tsx
'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getCountFromServer, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Props { siteId: string }

export function PromoWidget({ siteId }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const [expiringSoon, setExpiringSoon] = useState<number | null>(null);

  useEffect(() => {
    const now = new Date();
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const col = collection(db, 'sites', siteId, 'promos');
    Promise.all([
      getCountFromServer(query(col, where('status', '==', 'active'))),
      getCountFromServer(query(col,
        where('status', '==', 'active'),
        where('endDate', '<=', Timestamp.fromDate(weekFromNow)),
        where('endDate', '>=', Timestamp.fromDate(now))
      )),
    ]).then(([activeSnap, expiringSnap]) => {
      setActive(activeSnap.data().count);
      setExpiringSoon(expiringSnap.data().count);
    }).catch(() => {});
  }, [siteId]);

  return (
    <>
      <p className="text-xl font-bold text-gray-800 dark:text-neutral-100">
        {active === null ? '—' : `${active} active`}
      </p>
      <p className="text-xs text-gray-500 dark:text-neutral-400">
        {expiringSoon === null ? '' : `${expiringSoon} expiring this week`}
      </p>
    </>
  );
}
```

- [ ] **Step 6: Create ServiceRecordsWidget**

```tsx
// components/admin/dashboard/widgets/ServiceRecordsWidget.tsx
'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Props { siteId: string }

export function ServiceRecordsWidget({ siteId }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const [pendingApproval, setPendingApproval] = useState<number | null>(null);

  useEffect(() => {
    const col = collection(db, 'sites', siteId, 'service_records');
    Promise.all([
      getCountFromServer(query(col, where('status', 'in', ['open', 'in_progress']))),
      getCountFromServer(query(col, where('status', '==', 'pending_approval'))),
    ]).then(([openSnap, pendingSnap]) => {
      setOpen(openSnap.data().count);
      setPendingApproval(pendingSnap.data().count);
    }).catch(() => {});
  }, [siteId]);

  return (
    <>
      <p className="text-xl font-bold text-gray-800 dark:text-neutral-100">
        {open === null ? '—' : `${open} open`}
      </p>
      <p className="text-xs text-gray-500 dark:text-neutral-400">
        {pendingApproval === null ? '' : `${pendingApproval} pending approval`}
      </p>
    </>
  );
}
```

- [ ] **Step 7: Create SalesPipelineWidget**

```tsx
// components/admin/dashboard/widgets/SalesPipelineWidget.tsx
'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getCountFromServer, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Props { siteId: string }

export function SalesPipelineWidget({ siteId }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const [newThisWeek, setNewThisWeek] = useState<number | null>(null);

  useEffect(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const col = collection(db, 'sites', siteId, 'pipeline_leads');
    Promise.all([
      getCountFromServer(query(col, where('status', '!=', 'won'), where('status', '!=', 'lost'))),
      getCountFromServer(query(col, where('createdAt', '>=', Timestamp.fromDate(weekAgo)))),
    ]).then(([openSnap, weekSnap]) => {
      setOpen(openSnap.data().count);
      setNewThisWeek(weekSnap.data().count);
    }).catch(() => {});
  }, [siteId]);

  return (
    <>
      <p className="text-xl font-bold text-gray-800 dark:text-neutral-100">
        {open === null ? '—' : `${open} open leads`}
      </p>
      <p className="text-xs text-gray-500 dark:text-neutral-400">
        {newThisWeek === null ? '' : `+${newThisWeek} new this week`}
      </p>
    </>
  );
}
```

- [ ] **Step 8: Create FintrackWidget**

```tsx
// components/admin/dashboard/widgets/FintrackWidget.tsx
'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Props { siteId: string }

export function FintrackWidget({ siteId }: Props) {
  const [balance, setBalance] = useState<number | null>(null);
  const [entries, setEntries] = useState<number | null>(null);

  useEffect(() => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    getDocs(query(
      collection(db, 'sites', siteId, 'fin_entries'),
      where('createdAt', '>=', Timestamp.fromDate(startOfMonth))
    )).then(snap => {
      let bal = 0;
      snap.forEach(d => {
        const amt = d.data().amount ?? 0;
        bal += d.data().type === 'income' ? amt : -amt;
      });
      setBalance(bal);
      setEntries(snap.size);
    }).catch(() => {});
  }, [siteId]);

  return (
    <>
      <p className="text-xl font-bold text-gray-800 dark:text-neutral-100">
        {balance === null ? '—' : `Rp ${balance.toLocaleString('id-ID')}`}
      </p>
      <p className="text-xs text-gray-500 dark:text-neutral-400">
        {entries === null ? '' : `${entries} entries this month`}
      </p>
    </>
  );
}
```

- [ ] **Step 9: Verify TypeScript**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add components/admin/dashboard/widgets/
git commit -m "feat(dashboard): add per-module widget components (8 modules)"
```

---

## Task 6: ModuleCards component

**Files:**
- Create: `components/admin/dashboard/ModuleCards.tsx`

- [ ] **Step 1: Create widget registry and ModuleCards**

```tsx
// components/admin/dashboard/ModuleCards.tsx
'use client';

import Link from 'next/link';
import { ModuleDefinition } from '@/lib/modules/types';
import { PosWidget } from './widgets/PosWidget';
import { ReservationWidget } from './widgets/ReservationWidget';
import { MembershipWidget } from './widgets/MembershipWidget';
import { InventoryWidget } from './widgets/InventoryWidget';
import { PromoWidget } from './widgets/PromoWidget';
import { ServiceRecordsWidget } from './widgets/ServiceRecordsWidget';
import { SalesPipelineWidget } from './widgets/SalesPipelineWidget';
import { FintrackWidget } from './widgets/FintrackWidget';

const WIDGET_REGISTRY: Record<string, React.ComponentType<{ siteId: string }>> = {
  'byod_pos:DashboardWidget': PosWidget,
  'reservation:DashboardWidget': ReservationWidget,
  'membership:DashboardWidget': MembershipWidget,
  'inventory:DashboardWidget': InventoryWidget,
  'promo:DashboardWidget': PromoWidget,
  'service_records:DashboardWidget': ServiceRecordsWidget,
  'sales_pipeline:DashboardWidget': SalesPipelineWidget,
  'fintrack:DashboardWidget': FintrackWidget,
};

const CARD_COLORS: Record<string, string> = {
  byod_pos: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
  reservation: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
  membership: 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800',
  inventory: 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800',
  promo: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
  service_records: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
  sales_pipeline: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800',
  fintrack: 'bg-teal-50 border-teal-200 dark:bg-teal-900/20 dark:border-teal-800',
};

const BUTTON_COLORS: Record<string, string> = {
  byod_pos: 'bg-green-600 hover:bg-green-700',
  reservation: 'bg-blue-600 hover:bg-blue-700',
  membership: 'bg-purple-600 hover:bg-purple-700',
  inventory: 'bg-orange-600 hover:bg-orange-700',
  promo: 'bg-green-600 hover:bg-green-700',
  service_records: 'bg-yellow-600 hover:bg-yellow-700',
  sales_pipeline: 'bg-indigo-600 hover:bg-indigo-700',
  fintrack: 'bg-teal-600 hover:bg-teal-700',
};

interface Props {
  activeModules: ModuleDefinition[];
  siteId: string;
  baseUrl: string;
}

export function ModuleCards({ activeModules, siteId, baseUrl }: Props) {
  const modulesWithWidgets = activeModules.filter(m => m.dashboardAction);

  if (modulesWithWidgets.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400 dark:text-neutral-500 mb-3">
        Active Modules
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {modulesWithWidgets.map(m => {
          const cardColor = CARD_COLORS[m.id] ?? 'bg-gray-50 border-gray-200 dark:bg-neutral-900 dark:border-neutral-800';
          const btnColor = BUTTON_COLORS[m.id] ?? 'bg-gray-600 hover:bg-gray-700';
          const WidgetComponent = m.adminDashboardWidget
            ? WIDGET_REGISTRY[m.adminDashboardWidget.componentKey]
            : null;

          return (
            <div
              key={m.id}
              className={`border rounded-lg p-3.5 ${cardColor}`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-sm font-semibold text-gray-700 dark:text-neutral-200">
                  {m.displayName}
                </span>
                {m.dashboardAction && (
                  <Link
                    href={`${baseUrl}${m.dashboardAction.href}`}
                    className={`${btnColor} text-white text-[10px] font-semibold px-2.5 py-1 rounded transition-colors`}
                  >
                    {m.dashboardAction.label}
                  </Link>
                )}
              </div>
              {WidgetComponent ? (
                <WidgetComponent siteId={siteId} />
              ) : (
                <p className="text-xs text-gray-400 dark:text-neutral-500">No data available</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/dashboard/ModuleCards.tsx
git commit -m "feat(dashboard): add ModuleCards component with widget registry"
```

---

## Task 7: ModuleConnectionMap component

**Files:**
- Create: `components/admin/dashboard/ModuleConnectionMap.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/admin/dashboard/ModuleConnectionMap.tsx

import { ModuleDefinition } from '@/lib/modules/types';

interface Connection {
  from: string;
  to: string;
  label: string;
}

const ALL_CONNECTIONS: Connection[] = [
  { from: 'byod_pos', to: 'inventory', label: 'deducts stock' },
  { from: 'byod_pos', to: 'membership', label: 'awards points' },
  { from: 'byod_pos', to: 'promo', label: 'applies discounts' },
  { from: 'reservation', to: 'membership', label: 'linked to' },
  { from: 'service_records', to: 'membership', label: 'linked to' },
  { from: 'service_records', to: 'inventory', label: 'deducts parts' },
];

interface Props {
  activeModules: ModuleDefinition[];
}

export function ModuleConnectionMap({ activeModules }: Props) {
  const activeIds = new Set(activeModules.map(m => m.id));
  const visibleConnections = ALL_CONNECTIONS.filter(
    c => activeIds.has(c.from) && activeIds.has(c.to)
  );

  if (visibleConnections.length === 0) return null;

  const nameFor = (id: string) =>
    activeModules.find(m => m.id === id)?.displayName ?? id;

  return (
    <div className="mb-6">
      <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400 dark:text-neutral-500 mb-3">
        Module Connections
      </h2>
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-4">
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          {visibleConnections.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 font-medium px-2.5 py-1 rounded-md text-xs">
                {nameFor(c.from)}
              </span>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-gray-400 dark:text-neutral-500 leading-none mb-0.5">
                  {c.label}
                </span>
                <span className="text-gray-300 dark:text-neutral-600">→</span>
              </div>
              <span className="bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 font-medium px-2.5 py-1 rounded-md text-xs">
                {nameFor(c.to)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/dashboard/ModuleConnectionMap.tsx
git commit -m "feat(dashboard): add ModuleConnectionMap component"
```

---

## Task 8: New dashboard skeleton

**Files:**
- Create: `components/skeletons/DashboardSkeletonNew.tsx`

- [ ] **Step 1: Create skeleton matching new layout**

```tsx
// components/skeletons/DashboardSkeletonNew.tsx
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeletonNew() {
  return (
    <div>
      {/* Hero skeleton */}
      <Skeleton className="h-28 rounded-xl mb-6" />

      {/* Pages grid skeleton */}
      <Skeleton className="h-4 w-16 mb-3" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>

      {/* Module cards skeleton */}
      <Skeleton className="h-4 w-28 mb-3" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>

      {/* Connection map skeleton */}
      <Skeleton className="h-4 w-40 mb-3" />
      <Skeleton className="h-16 rounded-lg" />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/skeletons/DashboardSkeletonNew.tsx
git commit -m "feat(dashboard): add DashboardSkeletonNew matching new layout"
```

---

## Task 9: Rewrite dashboard page

**Files:**
- Modify: `app/admin/(dashboard)/page.tsx`

- [ ] **Step 1: Rewrite the page component**

Replace the entire contents of `app/admin/(dashboard)/page.tsx` with:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';
import { useUser } from '@/lib/user-context';
import { subscribeToEnabledModules } from '@/lib/modules/registry';
import { STATIC_MODULE_DEFINITIONS } from '@/lib/modules/definitions';
import { ModuleDefinition } from '@/lib/modules/types';
import { QuickActionsHero } from '@/components/admin/dashboard/QuickActionsHero';
import { PagesGrid } from '@/components/admin/dashboard/PagesGrid';
import { ModuleCards } from '@/components/admin/dashboard/ModuleCards';
import { ModuleConnectionMap } from '@/components/admin/dashboard/ModuleConnectionMap';
import { DashboardSkeletonNew } from '@/components/skeletons/DashboardSkeletonNew';

export default function AdminDashboard() {
  const { siteId, tenantSlug, isSubdomain } = useSite();
  const [allModules, setAllModules] = useState<ModuleDefinition[]>([]);
  const [siteEnabledModules, setSiteEnabledModules] = useState<Record<string, boolean>>({});
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(true);

  const baseUrl = tenantSlug && !isSubdomain ? `/${tenantSlug}` : '';

  // Subscribe to global enabled modules list
  useEffect(() => {
    const unsub = subscribeToEnabledModules(fetched => {
      setAllModules(fetched);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Subscribe to site doc for enabled module flags and business name
  useEffect(() => {
    if (!siteId || siteId === 'default' || siteId === 'pending') return;
    const unsub = onSnapshot(doc(db, 'sites', siteId), snap => {
      if (snap.exists()) {
        const data = snap.data();
        const legacy = data.settings?.modules ?? {};
        const root = data.modules ?? {};
        setSiteEnabledModules({ ...legacy, ...root });
        setBusinessName(data.name ?? data.businessName ?? '');
      }
    });
    return () => unsub();
  }, [siteId]);

  // Filter to modules active for this tenant, merged with static definitions
  const activeModules: ModuleDefinition[] = allModules
    .filter(m => siteEnabledModules[m.id] === true)
    .map(m => ({
      ...m,
      ...(STATIC_MODULE_DEFINITIONS[m.id] ?? {}),
    }));

  if (loading) return <DashboardSkeletonNew />;

  return (
    <div>
      <QuickActionsHero
        businessName={businessName}
        activeModules={activeModules}
        baseUrl={baseUrl}
      />
      <PagesGrid baseUrl={baseUrl} />
      <ModuleCards
        activeModules={activeModules}
        siteId={siteId}
        baseUrl={baseUrl}
      />
      <ModuleConnectionMap activeModules={activeModules} />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Start dev server and verify visually**

```bash
pnpm dev
```

Open `http://localhost:3000/admin` and verify:
- Hero banner appears with business name and today's date
- Quick Action buttons match active modules
- Pages grid shows existing pages (or the Create Page CTA if none)
- Module cards appear for each active module
- Module connection map appears if ≥2 connected modules are active

- [ ] **Step 4: Commit**

```bash
git add app/admin/(dashboard)/page.tsx
git commit -m "feat(dashboard): rewrite admin home as Command Center

Replaces legacy analytics widgets with:
- Quick Actions hero (dynamic from active modules)
- Pages grid with flat-color thumbnails
- Active module summary cards with inline actions
- Static module connection map"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| Quick Actions hero — greeting + business name + date | Task 3 `QuickActionsHero` |
| Create Page always pinned first | Task 3 `QuickActionsHero` |
| Dynamic actions from active modules | Task 2 `dashboardAction` field + Task 3 filter |
| Pages grid — flat color thumbnail | Task 4 `PagesGrid` `THUMBNAIL_COLORS` (solid, no gradient) |
| Pages grid — published/draft badge | Task 4 `PagesGrid` |
| Pages grid — Edit link | Task 4 `PagesGrid` |
| Pages grid — + Create Page card | Task 4 `PagesGrid` |
| Pages grid — empty state | Task 4 `PagesGrid` |
| Module cards — key metric + action button | Task 5 (widgets) + Task 6 `ModuleCards` |
| Module cards — isolated failure (shows — on error) | Task 5, all widgets `.catch(() => {})` → state stays `null` → renders `—` |
| Module connection map — static topology | Task 7 `ModuleConnectionMap` |
| Connection map hidden if no connections | Task 7 `if (visibleConnections.length === 0) return null` |
| Old analytics widgets removed | Task 9 full page rewrite |
| Hero — flat dark blue, no gradient | Task 3 `bg-[#1e3a5f]` |
| Page thumbnails — flat color, no gradient | Task 4 solid Tailwind bg color classes |

**Placeholder scan:** No TBDs, no "implement later", all code blocks present.

**Type consistency:** `dashboardAction` and `adminDashboardWidget` defined in Task 1, used identically in Tasks 2, 3, 6. `ModuleDefinition` type flows through all tasks. `baseUrl` prop present in all three components that need it.
