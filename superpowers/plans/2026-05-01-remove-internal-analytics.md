# Remove Internal Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete all internal Firestore-based analytics code and clean up every call site, leaving the third-party pixel infrastructure (PixelTracker, GA/Meta/TikTok) completely untouched.

**Architecture:** Four files are deleted outright (API route, counters lib, hook, tracker component). Five public-site components have their `useAnalytics` import + `track()` call stripped. The admin dashboard loses two stat tiles and the polling interval that read from the now-deleted counters library. No Firestore data is touched.

**Tech Stack:** Next.js 14 App Router, TypeScript, Vitest, pnpm

---

## File Map

| Action | File |
|--------|------|
| Delete | `app/api/analytics/track/route.ts` |
| Delete | `lib/analytics/counters.ts` |
| Delete | `hooks/useAnalytics.ts` |
| Delete | `components/AnalyticsTracker.tsx` |
| Modify | `app/layout.tsx` |
| Modify | `components/LinkCard.tsx` |
| Modify | `components/FeaturedProduct.tsx` |
| Modify | `components/ProductGallery.tsx` |
| Modify | `components/QuickActions.tsx` |
| Modify | `app/catalog/CatalogClient.tsx` |
| Modify | `app/admin/(dashboard)/page.tsx` |

---

### Task 1: Delete the four analytics-only files

These files have no consumers after this plan is complete. Delete them all at once and verify the build still resolves (it won't yet — that's expected until Task 2+).

**Files:**
- Delete: `app/api/analytics/track/route.ts`
- Delete: `lib/analytics/counters.ts`
- Delete: `hooks/useAnalytics.ts`
- Delete: `components/AnalyticsTracker.tsx`

- [ ] **Step 1: Delete all four files**

```bash
cd clicker-platform-v2
rm app/api/analytics/track/route.ts
rm lib/analytics/counters.ts
rm hooks/useAnalytics.ts
rm components/AnalyticsTracker.tsx
```

- [ ] **Step 2: Verify the files are gone**

```bash
ls app/api/analytics/track/route.ts lib/analytics/counters.ts hooks/useAnalytics.ts components/AnalyticsTracker.tsx 2>&1
```

Expected output: four "No such file or directory" errors — one per file.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete internal analytics files (track route, counters, hook, tracker component)"
```

---

### Task 2: Remove AnalyticsTracker from root layout

**Files:**
- Modify: `app/layout.tsx` (lines 22, 90)

- [ ] **Step 1: Remove the import on line 22**

Open `app/layout.tsx`. Delete this line:

```ts
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
```

- [ ] **Step 2: Remove the JSX usage on line 90**

In the same file, delete this line (inside the body JSX):

```tsx
<AnalyticsTracker />
```

- [ ] **Step 3: Verify TypeScript compiles for this file**

```bash
cd clicker-platform-v2
pnpm tsc --noEmit --project tsconfig.json 2>&1 | grep "layout.tsx"
```

Expected: no output (no errors in layout.tsx).

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "chore: remove AnalyticsTracker from root layout"
```

---

### Task 3: Clean up LinkCard.tsx

**Files:**
- Modify: `components/LinkCard.tsx` (lines 6, 30, 49, 66)

- [ ] **Step 1: Remove the import**

Delete line 6:

```ts
import { useAnalytics } from '@/hooks/useAnalytics';
```

- [ ] **Step 2: Remove the hook call**

Delete line 30 (now ~29 after import removal):

```ts
const { track } = useAnalytics();
```

- [ ] **Step 3: Remove the track() call**

There are two `track()` calls in this file — one for `link_click` (originally line 49) and one for `link_click` in QuickActions-style usage (originally line 66). Remove both. They look like:

```ts
track({ type: 'link_click', id: item.id, siteId: effectiveSiteId });
```

Remove the entire `track(...)` call from within the click handler. Keep the rest of the handler intact (e.g. `router.push`, `window.open`, etc.).

- [ ] **Step 4: Check for TypeScript errors in this file**

```bash
cd clicker-platform-v2
pnpm tsc --noEmit --project tsconfig.json 2>&1 | grep "LinkCard"
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add components/LinkCard.tsx
git commit -m "chore: remove useAnalytics from LinkCard"
```

---

### Task 4: Clean up FeaturedProduct.tsx

**Files:**
- Modify: `components/FeaturedProduct.tsx` (lines 7, 34, 42, 148)

- [ ] **Step 1: Remove the import**

Delete line 7:

```ts
import { useAnalytics } from '@/hooks/useAnalytics';
```

- [ ] **Step 2: Remove the hook call**

Delete line 34 (now ~33):

```ts
const { track } = useAnalytics();
```

- [ ] **Step 3: Remove all track() calls**

There are two in this file:

```ts
track({ type: 'product_click', id: product.id, siteId });
```

```ts
onClick={(e) => { e.stopPropagation(); track({ type: 'view_all_click', id: 'catalog', siteId }); setIsFullScreenOpen(true); }}
```

For the second one, keep the rest of the handler intact — only remove the `track(...)` call:

```tsx
onClick={(e) => { e.stopPropagation(); setIsFullScreenOpen(true); }}
```

- [ ] **Step 4: Check for TypeScript errors**

```bash
cd clicker-platform-v2
pnpm tsc --noEmit --project tsconfig.json 2>&1 | grep "FeaturedProduct"
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add components/FeaturedProduct.tsx
git commit -m "chore: remove useAnalytics from FeaturedProduct"
```

---

### Task 5: Clean up ProductGallery.tsx

**Files:**
- Modify: `components/ProductGallery.tsx` (lines 5, 21, 29, 103)

- [ ] **Step 1: Remove the import**

Delete line 5:

```ts
import { useAnalytics } from '@/hooks/useAnalytics';
```

- [ ] **Step 2: Remove the hook call**

Delete line 21 (now ~20):

```ts
const { track } = useAnalytics();
```

- [ ] **Step 3: Remove track() calls**

Two calls in this file:

```ts
track({ type: 'product_click', id: product.id, siteId });
```

```ts
onClick={() => track({ type: 'view_all_click', id: 'catalog', siteId })}
```

For the second, if `onClick` only contains the `track()` call, remove the entire `onClick` prop. If it wraps other logic, keep the rest.

- [ ] **Step 4: Check for TypeScript errors**

```bash
cd clicker-platform-v2
pnpm tsc --noEmit --project tsconfig.json 2>&1 | grep "ProductGallery"
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add components/ProductGallery.tsx
git commit -m "chore: remove useAnalytics from ProductGallery"
```

---

### Task 6: Clean up QuickActions.tsx

**Files:**
- Modify: `components/QuickActions.tsx` (lines 7, 30, 66)

- [ ] **Step 1: Remove the import**

Delete line 7:

```ts
import { useAnalytics } from '@/hooks/useAnalytics';
```

- [ ] **Step 2: Remove the hook call**

Delete line 30 (now ~29):

```ts
const { track } = useAnalytics();
```

- [ ] **Step 3: Remove the track() call**

```ts
track({ type: 'link_click', id: item.id, siteId: effectiveSiteId });
```

Remove this call from within the click handler. Keep all other handler logic.

- [ ] **Step 4: Check for TypeScript errors**

```bash
cd clicker-platform-v2
pnpm tsc --noEmit --project tsconfig.json 2>&1 | grep "QuickActions"
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add components/QuickActions.tsx
git commit -m "chore: remove useAnalytics from QuickActions"
```

---

### Task 7: Clean up CatalogClient.tsx

**Files:**
- Modify: `app/catalog/CatalogClient.tsx` (lines 9, 18, 43-45)

- [ ] **Step 1: Remove the import**

Delete line 9:

```ts
import { useAnalytics } from '@/hooks/useAnalytics';
```

- [ ] **Step 2: Remove the hook call**

Delete line 18 (now ~17):

```ts
const { track } = useAnalytics();
```

- [ ] **Step 3: Remove the track() call and its handler if now empty**

Lines 43-45:

```ts
track({ type: 'product_click', id: product.id, siteId });
```

Remove this line. If the surrounding callback is now empty, remove it too. Otherwise keep the remaining logic.

- [ ] **Step 4: Check for TypeScript errors**

```bash
cd clicker-platform-v2
pnpm tsc --noEmit --project tsconfig.json 2>&1 | grep "CatalogClient"
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add app/catalog/CatalogClient.tsx
git commit -m "chore: remove useAnalytics from CatalogClient"
```

---

### Task 8: Strip analytics from admin dashboard

Remove `getSiteStatsTotals`, the polling interval, `pageViews`/`totalClicks` state, and the two corresponding stat tiles. Keep Total Links, Products, Top Links, Top Products.

**Files:**
- Modify: `app/admin/(dashboard)/page.tsx`

- [ ] **Step 1: Remove the import**

Delete line 10:

```ts
import { getSiteStatsTotals } from '@/lib/analytics/counters';
```

- [ ] **Step 2: Remove pageViews and totalClicks from initial state**

Change the `useState` initial value (lines 31-36) from:

```ts
const [stats, setStats] = useState({
    linksCount: 0,
    productsCount: 0,
    pageViews: 0,
    totalClicks: 0
});
```

to:

```ts
const [stats, setStats] = useState({
    linksCount: 0,
    productsCount: 0,
});
```

- [ ] **Step 3: Remove the fetchTotals function and polling interval**

Delete these lines (originally 58-69):

```ts
// Aggregated totals from distributed counter shards — polled every 60s
const fetchTotals = async () => {
    try {
        const totals = await getSiteStatsTotals(siteId);
        setStats(prev => ({ ...prev, ...totals }));
    } catch (err) {
        logger.error('admin.dashboard.analytics.failed', { siteId, error: err });
    } finally {
        setLoading(false);
    }
};
fetchTotals();
const totalsIntervalId = setInterval(fetchTotals, 60_000);
```

- [ ] **Step 4: Move setLoading(false) to the Promise.all .then() block**

Since `fetchTotals` was responsible for calling `setLoading(false)`, move it into the `.then()` callback of the existing `Promise.all` (which fetches linksCount and productsCount). Change:

```ts
}).then(([linksCountSnap, productsCountSnap]) => {
    setStats(prev => ({
        ...prev,
        linksCount: linksCountSnap.data().count,
        productsCount: productsCountSnap.data().count,
    }));
}).catch(err => logger.error('admin.dashboard.counts.failed', { siteId, error: err }));
```

to:

```ts
}).then(([linksCountSnap, productsCountSnap]) => {
    setStats(prev => ({
        ...prev,
        linksCount: linksCountSnap.data().count,
        productsCount: productsCountSnap.data().count,
    }));
    setLoading(false);
}).catch(err => {
    logger.error('admin.dashboard.counts.failed', { siteId, error: err });
    setLoading(false);
});
```

- [ ] **Step 5: Remove totalsIntervalId from the cleanup**

In the `return () => { ... }` cleanup at the bottom of the `useEffect`, delete:

```ts
clearInterval(totalsIntervalId);
```

- [ ] **Step 6: Remove the two analytics stat tiles from JSX**

Delete the entire "Total Page Views" tile:

```tsx
<div className="bg-blue-50 dark:bg-blue-950/30 p-6 rounded-lg border border-gray-200 dark:border-neutral-800">
    <div className="flex items-center gap-3 mb-2 text-blue-600">
        <Eye size={20} /> <span className="font-bold">Total Page Views</span>
    </div>
    <p className="text-4xl font-bold text-gray-900 dark:text-neutral-100">{stats.pageViews}</p>
    <p className="text-xs text-gray-400 dark:text-neutral-600 mt-1">All time</p>
</div>
```

Delete the entire "Total Clicks" tile:

```tsx
<div className="bg-green-50 dark:bg-green-950/30 p-6 rounded-lg border border-gray-200 dark:border-neutral-800">
    <div className="flex items-center gap-3 mb-2 text-green-700 dark:text-neutral-300">
        <MousePointer2 size={20} /> <span className="font-bold">Total Clicks</span>
    </div>
    <p className="text-4xl font-bold text-gray-900 dark:text-neutral-100">{stats.totalClicks}</p>
    <p className="text-xs text-gray-400 dark:text-neutral-600 mt-1">All time</p>
</div>
```

- [ ] **Step 7: Remove now-unused icon imports**

If `Eye` and `MousePointer2` from `lucide-react` are no longer used after removing those tiles, delete them from the import:

```ts
import { TrendingUp, Link as LinkIcon, ShoppingBag } from 'lucide-react';
```

(Remove `Eye` and `MousePointer2` from the import list.)

- [ ] **Step 8: Check for TypeScript errors**

```bash
cd clicker-platform-v2
pnpm tsc --noEmit --project tsconfig.json 2>&1 | grep "dashboard"
```

Expected: no output.

- [ ] **Step 9: Commit**

```bash
git add "app/admin/(dashboard)/page.tsx"
git commit -m "chore: remove analytics stat tiles and polling from admin dashboard"
```

---

### Task 9: Full build and test verification

- [ ] **Step 1: Run the full TypeScript check**

```bash
cd clicker-platform-v2
pnpm tsc --noEmit 2>&1
```

Expected: no errors. If errors appear, they will name specific files — fix each one by removing any remaining `track`, `useAnalytics`, `getSiteStatsTotals`, `pageViews`, or `totalClicks` references.

- [ ] **Step 2: Run the test suite**

```bash
cd clicker-platform-v2
pnpm test 2>&1
```

Expected: all tests pass. No test directly tests the deleted analytics files, but confirm nothing unexpectedly imports them.

- [ ] **Step 3: Run the linter**

```bash
cd clicker-platform-v2
pnpm lint 2>&1
```

Expected: no errors related to unused imports or missing modules.

- [ ] **Step 4: Start dev server and verify public homepage loads without 500 error**

```bash
cd clicker-platform-v2
pnpm dev
```

Open the public homepage (e.g. `http://localhost:3000/[your-test-tenant]`). Open the browser DevTools Network tab. Confirm there is **no** `POST /api/analytics/track` request at all.

- [ ] **Step 5: Verify admin dashboard loads correctly**

Open `http://localhost:3000/admin`. Confirm:
- "Total Links" tile shows a number
- "Products" tile shows a number
- "Total Page Views" tile is **gone**
- "Total Clicks" tile is **gone**
- "Top Links" and "Top Products" sections still render (may show 0 clicks — that's correct)
- No console errors

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: verify analytics removal complete — no 500 on public site, dashboard loads cleanly"
```
