---
name: byod_pos
description: >
  Work with the byod_pos (Self Order POS) module in the Clicker Platform. Use this skill
  whenever adding screens, API functions, debugging order/payment/KDS issues, or auditing
  module registration for the POS system.
  Trigger on: "add pos screen", "add pos route", "debug pos", "pos order not showing",
  "payment not working", "kds not updating", "pos settings", "pos reports",
  "public order page", "customer ordering", "qr order",
  or any request touching lib/modules/byod_pos/.
---

> **Architecture Reference:** Always read [`docs/ARCHITECTURE.md`](../../../clicker-platform-v2/docs/ARCHITECTURE.md) before making any changes.


# /byod_pos — Clicker Platform Self Order POS Skill

You are helping work with the byod_pos module — the BYOD Self Order Point-of-Sale system for restaurant and retail tenants.

This skill is invoked as `/byod_pos [action]`

---

## Actions

| Action | Usage | Purpose |
|--------|-------|---------|
| `audit` | `/byod_pos audit` | Verify byod_pos is fully registered and Firestore is correctly set up |
| `add-screen` | `/byod_pos add-screen` | Add a new admin screen/route to the POS module |
| `add-api` | `/byod_pos add-api` | Add a new API function following module patterns |
| `debug` | `/byod_pos debug` | Diagnose common issues (orders, payments, settings, KDS, reports) |

---

## Action: `audit`

Read the following files and check each point. Report pass/fail with the exact file path for each item.

**Checklist:**

1. Directory `lib/modules/byod_pos/` exists with at least: `types.ts`, `api.ts`, `api-admin.ts`, `api-reports.ts`, `api-server.ts`, `constants.ts`, `utils.ts`, `admin/`, `components/`, `public/`, `hooks/`

2. Entry exists in `dev/clicker-platform-v2/lib/modules/definitions.ts` → `STATIC_MODULE_DEFINITIONS['byod_pos']` with all 6 routes:
   - `byod_pos:Cashier` → `/admin/pos/cashier`
   - `byod_pos:KDS` → `/admin/pos/kds`
   - `byod_pos:Transactions` → `/admin/pos/transactions`
   - `byod_pos:AdminMenu` → `/admin/pos/menu`
   - `byod_pos:AdminSettings` → `/admin/pos/settings`
   - `byod_pos:AdminOrders` → `/admin/pos/reports`

3. Entry exists in `dev/backyard/lib/modules/definitions.ts` with `displayName`, `description`, and `adminRoutes` (verify routes are in parity with platform — differences are intentional only if documented)

4. All 8 component keys registered in `lib/modules/components.tsx` → `MODULE_COMPONENTS`:
   - `byod_pos:OrderPage`
   - `byod_pos:AdminOrders`
   - `byod_pos:AdminMenu`
   - `byod_pos:AdminSettings`
   - `byod_pos:MenuGrid`
   - `byod_pos:KDS`
   - `byod_pos:Cashier`
   - `byod_pos:Transactions`

5. Every registered component has a matching `dynamic(() => import(...))` declaration at the top of `components.tsx`

6. `byod_pos:MenuGrid` is also registered in `lib/modules/client-registry.tsx` → `CLIENT_MODULE_COMPONENTS` as `POSBlockClient`

7. Static pages exist for Settings and Reports (these bypass ModuleLoader):
   - `app/admin/(dashboard)/pos/settings/page.tsx`
   - `app/admin/(dashboard)/pos/reports/page.tsx`

8. Entry exists in `scripts/seed-modules.ts` MODULES array for `byod_pos`

9. `constants.ts` exports path constants — verify they match:
   - Orders collection resolves to `modules/byod_pos/orders` under `sites/{siteId}`
   - Settings doc resolves to `modules/byod_pos/settings/config` under `sites/{siteId}`

10. No `firebase-admin` imports in `components.tsx` or `client-registry.tsx`

11. All admin screen components have `'use client'` at top: check `CashierClient.tsx`, `KDSClient.tsx`, `TransactionsClient.tsx`, `SettingsPage.tsx`, `POSMenuClient.tsx`, `POSClient.tsx`

12. `sites/{siteId}.modules.byod_pos` must be `true` in Firestore for the module to appear in sidebar — verify for a test site

---

## Action: `add-screen`

To add a new admin screen to the byod_pos module, collect from the user:

1. **Screen label** — display name in sidebar (e.g. `Floor Plan`)
2. **Route path** — must be `/admin/pos/{routeId}` (single-word final segment, e.g. `/admin/pos/floorplan`)
3. **Component name** — PascalCase (e.g. `FloorPlanClient`)
4. **Icon** — choose from: `monitor-dot`, `utensils`, `credit-card`, `clipboard-list`, `settings`, `file-text`, `users`, `calendar`, `shopping-bag`, `layout`
5. **Permission required?** — e.g. `settings`, `view_reports`, or omit for default access

### Step 1 — Create the Component

**`dev/clicker-platform-v2/lib/modules/byod_pos/admin/{ComponentName}.tsx`**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useSite } from '@/lib/site-context';
import { usePermission } from '@/components/admin/PermissionGuard';
// Import byod_pos API functions as needed
// import { subscribeToRecentOrders } from '@/lib/modules/byod_pos/api';

export default function {ComponentName}() {
    const { siteId } = useSite();
    const { isViewOnly } = usePermission();

    // Component logic here

    return (
        <div className="p-6">
            {/* Screen content */}
        </div>
    );
}
```

Key rules:

- MUST have `'use client'` at top — ModuleLoader renders in a client context
- ALWAYS get siteId from `useSite()` — never hardcode or pass as prop
- Use `usePermission()` to guard write operations when `isViewOnly` is true
- For live orders: `subscribeToRecentOrders(siteId, callback)` returns an unsubscribe fn — call it in `useEffect` cleanup
- Import only from `@/lib/modules/byod_pos/api` (client SDK) — NEVER import `api-admin.ts` or `api-server.ts` in a client component

### Step 2 — Register Dynamic Import in components.tsx

**`dev/clicker-platform-v2/lib/modules/components.tsx`**

Add at the top with other byod_pos imports:

```typescript
const {ComponentName} = dynamic(() => import('@/lib/modules/byod_pos/admin/{ComponentName}'));
```

Add to `MODULE_COMPONENTS`:

```typescript
'byod_pos:{ComponentName}': {ComponentName},
```

### Step 3 — Register Route in Both definitions.ts Files

**File A: `dev/clicker-platform-v2/lib/modules/definitions.ts`**

Add to `STATIC_MODULE_DEFINITIONS['byod_pos'].adminRoutes`:

```typescript
{
    label: '{Screen Label}',
    path: '/admin/pos/{routeId}',
    icon: '{iconKey}',
    // Only include permission if access-restricted:
    // permission: 'settings',
    componentKey: 'byod_pos:{ComponentName}'
},
```

**File B: `dev/backyard/lib/modules/definitions.ts`**

Add the identical route to `STATIC_MODULE_DEFINITIONS['byod_pos'].adminRoutes`.

### Step 4 — Verify

- Navigate to `/admin/pos/{routeId}` on a site with `byod_pos` enabled
- Confirm the sidebar entry appears and the component renders without errors
- Check browser console for any `firebase-admin` import warnings

---

## Action: `add-api`

Collect from the user:

1. **Function name** — camelCase (e.g. `getTopSellingItems`)
2. **Target file** — one of:
   - `api.ts` — client-side Firestore (real-time subscriptions, mutations, settings)
   - `api-reports.ts` — analytics and aggregation queries (date-range, stats)
   - `api-admin.ts` — Firebase Admin SDK only (server-side, SSR data fetching)
   - `api-server.ts` — SSR utilities combining Admin SDK + inventory map (used by POSBlockServer)
3. **Firestore path** — e.g. `sites/{siteId}/modules/byod_pos/orders`
4. **Input/output types** — reference `types.ts` first; add new interfaces there if needed

### Client API Pattern (api.ts)

```typescript
import {
    collection, query, where, getDocs, orderBy, limit,
    doc, updateDoc, Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { POSOrder } from './types';
import { ORDERS_COLLECTION } from './constants';

/**
 * Brief description of what this function does.
 */
export async function {functionName}(
    siteId: string,
    // additional params
): Promise<ReturnType> {
    if (!siteId || siteId === 'default' || siteId === 'pending') return /* safe default */;

    const q = query(
        collection(db, 'sites', siteId, ORDERS_COLLECTION),
        where('status', '==', 'completed'),
        orderBy('createdAt', 'desc'),
        limit(50)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as POSOrder));
}
```

Rules for `api.ts`:

- Import from `firebase/firestore` and `@/lib/firebase` only — NEVER `firebase-admin`
- Always guard against `siteId === 'default'` or `siteId === 'pending'`
- Use path constants from `./constants` — never inline Firestore path strings
- For settings writes: `JSON.parse(JSON.stringify(data))` before `setDoc` to strip `undefined` values (Firestore rejects them)
- For stock deduction: dynamically import `@/lib/modules/inventory/api` after checking `isModuleEnabled('inventory', siteId)`
- For loyalty points: dynamically import `@/lib/modules/membership/api` after checking `isModuleEnabled('membership', siteId)`

### Admin SDK Pattern (api-admin.ts)

```typescript
import { adminDb } from '@/lib/firebase-admin';
import { POSOrder } from './types';

export async function {functionName}(siteId: string): Promise<POSOrder[]> {
    const snapshot = await adminDb
        .collection('sites').doc(siteId)
        .collection('modules/byod_pos/orders')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as unknown as POSOrder));
}
```

Rules for `api-admin.ts`:

- Import `adminDb` from `@/lib/firebase-admin` only
- Only called from Next.js server components, API routes, or Cloud Functions — never from `'use client'` components
- Wrap in try/catch and return safe defaults — admin credentials may not be present in dev

### Reports / Aggregation Pattern (api-reports.ts)

```typescript
import {
    collection, query, where, getDocs,
    Timestamp, getAggregateFromServer, sum, count
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ORDERS_COLLECTION } from './constants';

export async function {functionName}(
    siteId: string,
    start: Date,
    end: Date
): Promise<number> {
    const q = query(
        collection(db, 'sites', siteId, ORDERS_COLLECTION),
        where('createdAt', '>=', Timestamp.fromDate(start)),
        where('createdAt', '<', Timestamp.fromDate(end)),
        where('status', '==', 'completed')
    );

    // Use Firestore Aggregation API — no document downloads needed
    const snap = await getAggregateFromServer(q, { total: sum('total') });
    return snap.data().total || 0;
}
```

Rules for `api-reports.ts`:

- Prefer `getAggregateFromServer` with `sum()` / `count()` over fetching all docs
- Always filter `where('status', '==', 'completed')` for revenue figures
- Use `getBusinessDayRange()` for day boundaries — never compute manually (respects `businessDayStartHour`)
- Composite index errors appear in console with a link to create the index in Firebase console — wait ~2 min after creation

### Adding New Types (types.ts)

If the new API introduces new data shapes, add interfaces to `types.ts`:

```typescript
export interface {NewType} {
    id: string;
    // fields...
}
```

---

## Action: `debug`

Ask the user which symptom they are seeing, then follow the matching diagnosis path.

---

### Symptom: Orders not appearing in KDS or Cashier Station

1. Check `siteId` is resolving correctly:
   - If `siteId` is `'default'` or `'pending'`, `subscribeToRecentOrders` returns early — verify `useSite()` is hydrating
   - Open DevTools → Network → confirm Firestore WebSocket connection is active

2. Check Firestore security rules allow reads on `sites/{siteId}/modules/byod_pos/orders`:
   - `permission-denied` errors from the subscription are caught and logged as warnings — check console

3. Check expected order `status` values:
   - KDS shows: `pending`, `preparing`, `ready` — filters applied client-side after the last-100 fetch
   - Cashier shows: orders grouped by table/member with `paymentStatus !== 'paid'`
   - `status === 'completed'` or `status === 'cancelled'` orders do NOT appear in KDS or Cashier — they are in Transactions

4. Verify `sites/{siteId}.modules.byod_pos === true` in Firestore

---

### Symptom: Payment confirmation not working

1. Trace the payment flow:

   ```
   Customer: requestPayment(siteId, orderId)
     → sets paymentStatus = 'pending_confirmation'
   Cashier: confirmPayment(siteId, orderId, method)
     → sets status = 'completed', paymentStatus = 'paid', paymentMethod = method
   ```

2. If `confirmPayment` fails silently:
   - Check `usePermission().isViewOnly` — view-only staff cannot confirm payments
   - Check Firestore rules allow `updateDoc` on the order document for the authenticated user

3. If loyalty points not awarded after completion:
   - `updateOrderStatus` checks `isModuleEnabled('membership')` first — if off, silently skipped
   - If membership IS enabled: `memberId` must be set on the order — anonymous orders (no `memberId`) skip the loyalty step

4. Open-bill vs fast-checkout tax differs:
   - **fast-checkout**: `taxBreakdown` stored on each order at creation time
   - **open-bill**: `taxBreakdown` is NOT stored on individual orders — computed at bill-close via `calculateBillTotals(orders)` in `utils.ts` and applied to the aggregated total before payment confirmation

---

### Symptom: POS Settings not saving or loading incorrectly

1. `getPOSSettings` merges from 3 sources — understand the priority:

   ```
   sites/{siteId}/modules/byod_pos/settings/config  ← mode, paymentMethods, tax, requireTableNumber, logo, businessDayStartHour
   sites/{siteId}/content/profile                    ← businessName (always wins over settings.businessName)
   sites/{siteId}/content/business                  ← businessAddress (always wins over settings.businessAddress)
   ```

   - `businessName` in the settings doc is ignored at read time — fix it in site profile

2. If `updatePOSSettings` throws `Unsupported field value: undefined`:
   - The fix is `JSON.parse(JSON.stringify(settings))` before `setDoc` — verify this is present in `api.ts`
   - Recheck for any new optional fields being passed as `undefined` to `updatePOSSettings`

3. If settings revert after save:
   - `updatePOSSettings` uses `setDoc` (full replace) — a concurrent `setDoc` from another listener would overwrite
   - Verify only `SettingsPage.tsx` writes to the settings doc

---

### Symptom: KDS not advancing order status / stock not deducting

1. Stock deduction triggers on `pending → preparing` transition only:
   - `processStockDeduction` called inside `updateOrderStatus` — checks `isModuleEnabled('inventory')` first
   - If inventory module is off for the site, deduction is silently skipped

2. If inventory IS enabled but deduction fails:
   - `item.inventoryId` must be set on each `CartItem` — missing `inventoryId` means that item is skipped
   - Check the menu item in Firestore: `sites/{siteId}/modules/byod_pos/menu_items/{id}` → verify `inventoryId` or per-variant `inventoryId`

3. On order cancel, stock is refunded only if `order.status` is `'preparing'` or `'ready'` at cancel time

4. If KDS button clicks do nothing:
   - `handleUpdateStatus` in `KDSClient` calls `updateOrderStatus` — check console for errors
   - Confirm the real-time Firestore listener is still active (no WebSocket disconnect)

---

### Symptom: Reports showing wrong totals or missing orders

1. Reports only include `status === 'completed'` orders — `pending`, `preparing`, `ready` are excluded

2. If totals are off by a time zone:
   - `api-reports.ts` uses `fromZonedTime(dateString, RESTAURANT_TIMEZONE)` to align date ranges
   - `businessDayStartHour` (default: `4`) means a "day" runs from 4:00 AM to 3:59 AM next calendar day
   - Wrong hour means orders near midnight fall into the wrong day

3. If `getReportStats` returns 0 or throws:
   - Firestore Aggregation API requires composite indexes for multi-field `where` queries
   - Console shows a link to create the missing index — after creating it, wait ~2 min then retry

4. If payment breakdown is empty:
   - `paymentMethod` is set during `confirmPayment` — orders completed without it (old data) won't appear in breakdown
   - Inspect a completed order directly in Firestore: `sites/{siteId}/modules/byod_pos/orders/{orderId}` → check `paymentMethod` field

---

## Critical File Paths

```
MODULE CORE (dev/clicker-platform-v2/lib/modules/byod_pos/):
  types.ts                              ← POSOrder, CartItem, POSItem, POSSettings, TaxBreakdown, TaxSettings
  constants.ts                          ← ORDERS_COLLECTION, SETTINGS_DOC (always use these — never inline paths)
  utils.ts                              ← calculateBillTotals(), createAggregatedOrder()
  api.ts                                ← Client Firestore: orders, menu, settings, payment
  api-admin.ts                          ← Firebase Admin SDK: server-side data fetching
  api-reports.ts                        ← Analytics: getDailyReport, getWeeklyReport, getMonthlyReport, getReportStats, getItemsSales
  api-server.ts                         ← SSR utility: getPOSDataServer() (Admin SDK + inventory map, used by POSBlockServer)
  cart-context.tsx                      ← CartProvider + useCart() for customer ordering flow
  order-tracker-context.tsx             ← OrderTrackerProvider + useOrderTracker() for live order status
  receipt-generator.ts                  ← generateReceiptHtml() for thermal printer receipts
  hooks/useReceiptPrinter.ts            ← printReceipt() hook, used in CashierClient

ADMIN SCREENS (lib/modules/byod_pos/admin/):
  CashierClient.tsx                     ← componentKey: byod_pos:Cashier, route: /admin/pos/cashier
  KDSClient.tsx                         ← componentKey: byod_pos:KDS, route: /admin/pos/kds
  TransactionsClient.tsx                ← componentKey: byod_pos:Transactions, route: /admin/pos/transactions
  menu/POSMenuClient.tsx                ← componentKey: byod_pos:AdminMenu, route: /admin/pos/menu
  SettingsPage.tsx                      ← componentKey: byod_pos:AdminSettings, route: /admin/pos/settings (also static page)
  POSClient.tsx                         ← componentKey: byod_pos:AdminOrders, route: /admin/pos/reports (also static page)
  components/BillCard.tsx               ← Open-bill aggregation card used in Cashier
  components/POSOrderCard.tsx           ← Single order card used in KDS
  components/PaymentConfirmationDialog.tsx  ← Payment method selection modal
  components/HistorySidebar.tsx         ← Transaction detail sidebar

PUBLIC + CUSTOMER COMPONENTS (lib/modules/byod_pos/):
  public/OrderPage.tsx                  ← componentKey: byod_pos:OrderPage, public customer ordering page
  components/POSWidget.tsx              ← Main ordering flow: menu grid + cart drawer + checkout
  components/MenuGrid.tsx               ← componentKey: byod_pos:MenuGrid (also in client-registry as POSBlockClient)
  components/POSMemberLookup.tsx        ← Member search for loyalty linking
  components/OrderTracker.tsx           ← Customer-side live order status (anonymous auth)

STATIC APP ROUTES (dev/clicker-platform-v2/app/admin/(dashboard)/pos/):
  settings/page.tsx                     ← Directly imports SettingsPage (bypasses ModuleLoader)
  reports/page.tsx                      ← Directly imports POSClient (bypasses ModuleLoader)

REGISTRATION FILES:
  lib/modules/definitions.ts            ← STATIC_MODULE_DEFINITIONS['byod_pos'] — platform routes
  lib/modules/components.tsx            ← MODULE_COMPONENTS — dynamic import registry
  lib/modules/client-registry.tsx       ← CLIENT_MODULE_COMPONENTS — POSBlockClient (byod_pos:MenuGrid)
  scripts/seed-modules.ts               ← Firestore module seed
  dev/backyard/lib/modules/definitions.ts  ← Must mirror platform (displayName + description required here)

REPORTING:
  lib/modules/pos-reporting/calculator.ts  ← calculateReportSummary(), calculateItemsSales(), formatCurrency()
```

---

## Architecture Rules (never violate)

- All admin screen components MUST have `'use client'` at top — they are loaded by ModuleLoader in a client context
- `siteId` MUST come from `useSite()` — never hardcode or accept it as a prop from a server component
- NEVER import `api-admin.ts` or `api-server.ts` in any `'use client'` component — they use `firebase-admin` which cannot run in the browser
- NEVER import `firebase-admin` in `components.tsx` or `client-registry.tsx`
- Always use path constants from `constants.ts` — never inline Firestore path strings
- `updatePOSSettings` MUST strip `undefined` before `setDoc`: `JSON.parse(JSON.stringify(settings))` — Firestore rejects undefined field values
- Tax for **open-bill** mode is computed once on aggregated totals via `calculateBillTotals()` in `utils.ts` — do NOT store `taxBreakdown` on individual open-bill orders (causes double-counting)
- Tax for **fast-checkout** mode is computed per order at creation time and stored in `taxBreakdown`
- Module integrations MUST be guarded by `isModuleEnabled(moduleId)` before dynamic import — never assume inventory or membership is active
- `componentKey` format is strictly `byod_pos:{ComponentName}` — must match exactly in both `definitions.ts` and `MODULE_COMPONENTS`
- Both `definitions.ts` files (platform + backyard) must be updated together when adding or removing routes
- `sites/{siteId}.modules.byod_pos` must be `true` in Firestore for the module to appear in sidebar — the global `modules/{moduleId}.enabled` flag alone is not sufficient
- Reports use `status === 'completed'` as the source of truth for revenue — intermediate statuses are excluded
- Use `getBusinessDayRange()` from `api-reports.ts` for all report date boundaries — never compute them manually (must respect `businessDayStartHour`)
