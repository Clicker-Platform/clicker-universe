# PostHog Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate PostHog into the Clicker Platform to track public website traffic and admin module usage across all tenants, using a single shared PostHog project with `siteId` as a discriminating property.

**Architecture:** A `PostHogProvider` client component wraps the root `app/layout.tsx`, initializing PostHog only in non-dev environments when `NEXT_PUBLIC_POSTHOG_KEY` is set. A `useAnalytics()` hook provides a thin `capture()` wrapper for modules. Identity (user + siteId) is set in `UserProvider` on auth state change.

**Tech Stack:** `posthog-js`, Next.js 16 App Router, React 19, Vitest + jsdom

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `lib/analytics/PostHogProvider.tsx` | Initialize PostHog, track pageviews on route change |
| Create | `lib/analytics/useAnalytics.ts` | `capture()` wrapper hook with auto-injected `siteId` |
| Create | `lib/analytics/__tests__/useAnalytics.test.ts` | Unit tests for the hook |
| Modify | `app/layout.tsx` | Wrap children with `<PostHogProvider>` |
| Modify | `lib/user-context.tsx` | Call `posthog.identify()` on login, `posthog.reset()` on logout |
| Modify | `lib/modules/byod_pos/api.ts` | Capture `pos.order_completed` in `confirmPayment` |
| Modify | `lib/modules/byod_pos/admin/CashierClient.tsx` | Capture `pos.cashier_opened` on mount |
| Modify | `lib/modules/reservation/api.ts` | Capture `reservation.booking_created` in `createBooking` |
| Modify | `lib/modules/membership` (member creation component) | Capture `membership.member_added` |
| Modify | `lib/modules/inventory` (stock adjustment component) | Capture `inventory.stock_updated` |
| Modify | `lib/modules/promo` (promo apply handler) | Capture `promo.code_applied` |
| Modify | `lib/modules/sales-pipeline` (deal move handler) | Capture `sales_pipeline.deal_moved` |

---

## Task 1: Install posthog-js

**Files:**
- Modify: `clicker-platform-v2/package.json` (via pnpm)

- [ ] **Step 1: Install the package**

```bash
cd clicker-platform-v2
pnpm add posthog-js
```

Expected output: `+ posthog-js@...` with no errors.

- [ ] **Step 2: Verify install**

```bash
node -e "require('./node_modules/posthog-js/dist/module.js'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: install posthog-js"
```

---

## Task 2: Add environment variables

**Files:**
- Modify: `clicker-platform-v2/.env.staging` (create if absent)
- Modify: `clicker-platform-v2/.env.production` (create if absent)
- Do NOT touch: `.env.development.local` — absence of the key is what disables PostHog in dev

- [ ] **Step 1: Add vars to staging env**

Open (or create) `clicker-platform-v2/.env.staging` and add:

```
NEXT_PUBLIC_POSTHOG_KEY=phc_YOUR_STAGING_KEY_HERE
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

Replace `phc_YOUR_STAGING_KEY_HERE` with the actual key from your PostHog staging project.

- [ ] **Step 2: Add vars to production env**

Open (or create) `clicker-platform-v2/.env.production` and add:

```
NEXT_PUBLIC_POSTHOG_KEY=phc_YOUR_PROD_KEY_HERE
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

Replace `phc_YOUR_PROD_KEY_HERE` with the actual key from your PostHog production project.

- [ ] **Step 3: Verify .env.development.local has NO posthog key**

```bash
grep -i posthog clicker-platform-v2/.env.development.local || echo "clean - no posthog key in dev"
```

Expected: `clean - no posthog key in dev`

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/.env.staging clicker-platform-v2/.env.production
git commit -m "chore: add PostHog env vars for staging and prod"
```

---

## Task 3: Create PostHogProvider

**Files:**
- Create: `clicker-platform-v2/lib/analytics/PostHogProvider.tsx`

- [ ] **Step 1: Create the file**

```tsx
// clicker-platform-v2/lib/analytics/PostHogProvider.tsx
'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, ReactNode } from 'react';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

function PostHogPageviewTracker() {
    const pathname = usePathname();
    const lastPathname = useRef<string | null>(null);

    useEffect(() => {
        if (!POSTHOG_KEY) return;
        if (pathname === lastPathname.current) return;
        lastPathname.current = pathname;
        posthog.capture('$pageview', { $current_url: window.location.href });
    }, [pathname]);

    return null;
}

export function PostHogProvider({ children }: { children: ReactNode }) {
    useEffect(() => {
        if (!POSTHOG_KEY || process.env.NODE_ENV === 'development') return;
        posthog.init(POSTHOG_KEY, {
            api_host: POSTHOG_HOST,
            capture_pageview: false,
            persistence: 'localStorage',
        });
    }, []);

    if (!POSTHOG_KEY || process.env.NODE_ENV === 'development') {
        return <>{children}</>;
    }

    return (
        <PHProvider client={posthog}>
            <PostHogPageviewTracker />
            {children}
        </PHProvider>
    );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd clicker-platform-v2
pnpm tsc --noEmit 2>&1 | grep -i "analytics\|posthog" || echo "no errors in analytics files"
```

Expected: `no errors in analytics files`

- [ ] **Step 3: Commit**

```bash
git add lib/analytics/PostHogProvider.tsx
git commit -m "feat: add PostHogProvider with pageview tracking"
```

---

## Task 4: Wire PostHogProvider into root layout

**Files:**
- Modify: `clicker-platform-v2/app/layout.tsx`

- [ ] **Step 1: Add import**

In `app/layout.tsx`, add this import after the existing imports:

```tsx
import { PostHogProvider } from '@/lib/analytics/PostHogProvider';
```

- [ ] **Step 2: Wrap children**

In the `return` of `RootLayout`, wrap the `<SiteProvider>` block with `<PostHogProvider>`:

Find this pattern:
```tsx
      <SiteProvider siteId={siteId} tenantSlug={tenantSlug} isSubdomain={isSubdomain}>
          <ThemeRegistry initialSettings={settings} />
<div className="flex-grow w-full">
            {children}
          </div>
          <Toaster position="top-right" richColors />
        </SiteProvider>
```

Replace with:
```tsx
      <PostHogProvider>
        <SiteProvider siteId={siteId} tenantSlug={tenantSlug} isSubdomain={isSubdomain}>
          <ThemeRegistry initialSettings={settings} />
          <div className="flex-grow w-full">
            {children}
          </div>
          <Toaster position="top-right" richColors />
        </SiteProvider>
      </PostHogProvider>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd clicker-platform-v2
pnpm tsc --noEmit 2>&1 | grep "app/layout" || echo "no errors in layout"
```

Expected: `no errors in layout`

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: wire PostHogProvider into root layout"
```

---

## Task 5: Create useAnalytics hook

**Files:**
- Create: `clicker-platform-v2/lib/analytics/useAnalytics.ts`
- Create: `clicker-platform-v2/lib/analytics/__tests__/useAnalytics.test.ts`

- [ ] **Step 1: Write the failing test**

Create `clicker-platform-v2/lib/analytics/__tests__/useAnalytics.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock posthog-js before importing the hook
vi.mock('posthog-js', () => ({
    default: {
        capture: vi.fn(),
        __loaded: true,
    },
}));

// Mock site context
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd clicker-platform-v2
pnpm test lib/analytics/__tests__/useAnalytics.test.ts
```

Expected: FAIL — `Cannot find module '../useAnalytics'`

- [ ] **Step 3: Create the hook**

Create `clicker-platform-v2/lib/analytics/useAnalytics.ts`:

```ts
import posthog from 'posthog-js';
import { useSite } from '@/lib/site-context';

export function useAnalytics() {
    const { siteId } = useSite();

    const capture = (event: string, properties?: Record<string, unknown>) => {
        posthog.capture(event, { siteId, ...properties });
    };

    return { capture };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd clicker-platform-v2
pnpm test lib/analytics/__tests__/useAnalytics.test.ts
```

Expected: PASS — 2 tests passing

- [ ] **Step 5: Commit**

```bash
git add lib/analytics/useAnalytics.ts lib/analytics/__tests__/useAnalytics.test.ts
git commit -m "feat: add useAnalytics hook with auto-injected siteId"
```

---

## Task 6: Wire identity in UserProvider

**Files:**
- Modify: `clicker-platform-v2/lib/user-context.tsx`

The `onAuthStateChanged` callback is at line ~107. When `currentUser` is null (logout path), we call `posthog.reset()`. When `currentUser` is set (login path, line ~126), we call `posthog.identify()`.

- [ ] **Step 1: Add posthog import**

In `lib/user-context.tsx`, add this import after the existing imports:

```ts
import posthog from 'posthog-js';
```

- [ ] **Step 2: Add identify call on login**

Find the line `setUser(currentUser);` (around line 126) and add the identify call after it:

```ts
setUser(currentUser);
posthog.identify(currentUser.uid, { siteId, email: currentUser.email ?? undefined });
```

- [ ] **Step 3: Add reset call on logout**

Find the null user branch (around line 117, the block that sets `setUser(null)`). Add `posthog.reset()` at the end of that block, before the `return`:

```ts
setUser(null);
setRole(null);
setPermissions([]);
setModuleAccess({});
setIsOwner(false);
setLoading(false);
posthog.reset();
return;
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd clicker-platform-v2
pnpm tsc --noEmit 2>&1 | grep "user-context" || echo "no errors in user-context"
```

Expected: `no errors in user-context`

- [ ] **Step 5: Commit**

```bash
git add lib/user-context.tsx
git commit -m "feat: identify/reset PostHog user on auth state change"
```

---

## Task 7: POS — capture order_completed and cashier_opened

**Files:**
- Modify: `clicker-platform-v2/lib/modules/byod_pos/api.ts`
- Modify: `clicker-platform-v2/lib/modules/byod_pos/admin/CashierClient.tsx`

Note: `api.ts` is a pure async function file (not a React component), so we call `posthog.capture()` directly — not via the hook.

- [ ] **Step 1: Add posthog import to api.ts**

In `lib/modules/byod_pos/api.ts`, add:

```ts
import posthog from 'posthog-js';
```

- [ ] **Step 2: Capture order_completed in confirmPayment**

In `confirmPayment` (around line 435), after the `updateDoc` call succeeds, add:

```ts
export async function confirmPayment(
    siteId: string,
    orderId: string,
    method: POSOrder['paymentMethod'],
    appliedPromo?: POSOrder['appliedPromo'],
): Promise<void> {
    const orderRef = doc(db, 'sites', siteId, ORDERS_COLLECTION, orderId);

    await updateDoc(orderRef, {
        paymentStatus: 'paid',
        paymentMethod: method,
        status: 'completed',
        ...(appliedPromo ? { appliedPromo } : {}),
    });

    posthog.capture('pos.order_completed', { siteId, orderId, paymentMethod: method });
}
```

- [ ] **Step 3: Capture cashier_opened in CashierClient**

Open `lib/modules/byod_pos/admin/CashierClient.tsx`. Find the component function and add a `useEffect` with `useAnalytics`:

Add import at the top:
```tsx
import { useAnalytics } from '@/lib/analytics/useAnalytics';
```

Add inside the component:
```tsx
const { capture } = useAnalytics();

useEffect(() => {
    capture('pos.cashier_opened');
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd clicker-platform-v2
pnpm tsc --noEmit 2>&1 | grep "byod_pos\|CashierClient\|api" | grep -v "node_modules" || echo "no errors in byod_pos"
```

Expected: `no errors in byod_pos`

- [ ] **Step 5: Commit**

```bash
git add lib/modules/byod_pos/api.ts lib/modules/byod_pos/admin/CashierClient.tsx
git commit -m "feat(pos): capture cashier_opened and order_completed events"
```

---

## Task 8: Reservation — capture booking_created

**Files:**
- Modify: `clicker-platform-v2/lib/modules/reservation/api.ts`

The `createBooking` function is at line ~183 of `reservation/api.ts`. It does an `addDoc` and returns the new doc ID.

- [ ] **Step 1: Add posthog import**

In `lib/modules/reservation/api.ts`, add:

```ts
import posthog from 'posthog-js';
```

- [ ] **Step 2: Capture after addDoc**

Find the `createBooking` function and add the capture after the `addDoc` resolves:

```ts
export async function createBooking(siteId: string, booking: Omit<Booking, 'id' | 'createdAt'>): Promise<string> {
    // ... existing code ...
    const docRef = await addDoc(collection(db, 'sites', siteId, BOOKINGS_COLLECTION), {
        // ... existing fields ...
    });

    posthog.capture('reservation.booking_created', { siteId, bookingId: docRef.id, serviceId: booking.serviceId });

    return docRef.id;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd clicker-platform-v2
pnpm tsc --noEmit 2>&1 | grep "reservation/api" | grep -v "node_modules" || echo "no errors in reservation/api"
```

Expected: `no errors in reservation/api`

- [ ] **Step 4: Commit**

```bash
git add lib/modules/reservation/api.ts
git commit -m "feat(reservation): capture booking_created event"
```

---

## Task 9: Remaining module events (membership, inventory, promo, sales_pipeline)

For these modules, find the component or API function where the key action's Firestore write happens, import `posthog` or `useAnalytics`, and add one `capture()` call after the write succeeds.

**Files:** Determined by grepping — see steps below.

- [ ] **Step 1: Find membership member creation point**

```bash
cd clicker-platform-v2
grep -rn "addDoc\|setDoc\|createMember\|handleSubmit" lib/modules/membership --include="*.tsx" --include="*.ts" | grep -v "node_modules" | head -10
```

Identify the file and line where a new member is written to Firestore.

- [ ] **Step 2: Add membership.member_added capture**

In the identified file, after the Firestore write succeeds:

If it's a React component, add:
```tsx
import { useAnalytics } from '@/lib/analytics/useAnalytics';
// inside component:
const { capture } = useAnalytics();
// after write:
capture('membership.member_added');
```

If it's a plain async function (api.ts), add:
```ts
import posthog from 'posthog-js';
// after write:
posthog.capture('membership.member_added', { siteId });
```

- [ ] **Step 3: Find inventory stock update point**

```bash
grep -rn "addDoc\|updateDoc\|adjustStock\|handleSubmit" lib/modules/inventory --include="*.tsx" --include="*.ts" | grep -v "node_modules" | head -10
```

- [ ] **Step 4: Add inventory.stock_updated capture**

In the identified file, after the Firestore write succeeds, add the appropriate capture call (same pattern as Step 2).

```ts
// React component:
capture('inventory.stock_updated');
// or plain function:
posthog.capture('inventory.stock_updated', { siteId });
```

- [ ] **Step 5: Find promo code apply point**

```bash
grep -rn "applyPromo\|appliedPromo\|updateDoc\|handleApply" lib/modules/promo --include="*.tsx" --include="*.ts" | grep -v "node_modules" | head -10
```

- [ ] **Step 6: Add promo.code_applied capture**

In the identified file, after the promo is successfully applied:

```ts
// React component:
capture('promo.code_applied', { promoCode });
// or plain function:
posthog.capture('promo.code_applied', { siteId, promoCode });
```

- [ ] **Step 7: Find sales pipeline deal move point**

```bash
grep -rn "moveDeal\|updateDoc\|handleDrop\|onDrop\|stage" lib/modules/sales-pipeline --include="*.tsx" --include="*.ts" | grep -v "node_modules" | head -10
```

- [ ] **Step 8: Add sales_pipeline.deal_moved capture**

In the identified file, after the stage change is written:

```ts
// React component:
capture('sales_pipeline.deal_moved', { fromStage, toStage });
// or plain function:
posthog.capture('sales_pipeline.deal_moved', { siteId, fromStage, toStage });
```

- [ ] **Step 9: Verify TypeScript compiles**

```bash
cd clicker-platform-v2
pnpm tsc --noEmit 2>&1 | grep -v "node_modules" | grep "error" || echo "no errors"
```

Expected: `no errors`

- [ ] **Step 10: Commit**

```bash
git add lib/modules/membership lib/modules/inventory lib/modules/promo lib/modules/sales-pipeline
git commit -m "feat: capture module events for membership, inventory, promo, sales_pipeline"
```

---

## Task 10: Smoke test in browser

- [ ] **Step 1: Start dev server**

```bash
cd clicker-platform-v2
pnpm dev
```

- [ ] **Step 2: Verify PostHog is silent in dev**

Open browser DevTools → Network tab. Filter by `posthog` or `app.posthog.com`. Navigate around the admin dashboard and public pages.

Expected: **zero** requests to PostHog — the key is absent from `.env.development.local`.

- [ ] **Step 3: Verify no console errors**

Check browser console for any PostHog-related errors.

Expected: No errors related to `posthog` or `analytics`.

- [ ] **Step 4: Run full test suite**

```bash
cd clicker-platform-v2
pnpm test
```

Expected: All tests pass including the new `useAnalytics` tests.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: PostHog integration complete — public pageviews + module events"
```
