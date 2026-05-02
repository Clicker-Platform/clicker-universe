# Remove Internal Analytics — Design Spec

**Date:** 2026-05-01  
**Status:** Approved for implementation

## Context

The platform has a legacy in-house analytics system that:
- Writes a Firestore document on every public page view and click event
- Causes a 500 error on the public homepage (`POST /api/analytics/track`)
- Adds Firestore write cost and latency on every page load
- Is being replaced by a third-party solution (Umami, TBD in a separate spec)

This spec covers the clean removal of all internal analytics code. It does **not** touch the third-party pixel infrastructure (`PixelTracker.tsx`, GA/Meta/TikTok settings).

---

## Scope

### Files to delete

| File | Reason |
|---|---|
| `app/api/analytics/track/route.ts` | The broken API endpoint — source of the 500 error |
| `lib/analytics/counters.ts` | Shard counter helpers — no longer needed |
| `hooks/useAnalytics.ts` | Client hook that calls the deleted endpoint |
| `components/AnalyticsTracker.tsx` | Page-view tracker mounted in root layout |

### Files to modify — remove tracking calls only

| File | Change |
|---|---|
| `app/layout.tsx` | Remove `<AnalyticsTracker />` and its import |
| `components/LinkCard.tsx` | Remove `useAnalytics` import and `track()` call on link click |
| `components/FeaturedProduct.tsx` | Same |
| `components/ProductGallery.tsx` | Same |
| `components/QuickActions.tsx` | Same |
| `app/catalog/CatalogClient.tsx` | Same |

### Files to modify — admin dashboard

`app/admin/(dashboard)/page.tsx`:
- Remove `getSiteStatsTotals` import
- Remove `pageViews` and `totalClicks` from state
- Remove the 60s polling interval for totals
- Remove the "Total Page Views" and "Total Clicks" stat tiles from the UI
- **Keep:** "Total Links" and "Products" tiles (read from `getCountFromServer`, unaffected)
- **Keep:** "Top Links" and "Top Products" sections (read from Firestore `clicks` field directly, unaffected)

### Files explicitly NOT changed

| File | Reason |
|---|---|
| `components/PixelTracker.tsx` | Third-party pixel injection — keep intact |
| `app/[tenant]/page.tsx` | Mounts PixelTracker — no change needed |
| Any pixel/GA/Meta/TikTok admin settings | Unrelated to internal analytics |

---

## Data

- **No Firestore migration.** The `analytics_shards` subcollection and `clicks` fields on links/products documents are left in place. They are orphaned but harmless. They can be cleaned up later or reused when the Umami integration lands.
- **No schema changes** to any Firestore security rules.

---

## What tenants lose

- "Total Page Views" and "Total Clicks" tiles on the admin dashboard home.
- "Top Links by clicks" and "Top Products by clicks" will still show, but the click counts will stop incrementing (existing counts remain visible).

These will be restored with proper data when the Umami integration is built.

---

## Out of scope

- Umami integration (separate spec)
- Firestore `analytics_shards` cleanup script
- Any changes to pixel/GA/Meta/TikTok tracking
- Admin settings for pixel configuration
