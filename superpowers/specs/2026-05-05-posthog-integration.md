# PostHog Integration — Spec

**Date:** 2026-05-05  
**Scope:** Platform-level analytics using PostHog. Covers public website traffic and admin module usage.

---

## Goals

- Track public tenant page views to understand platform traffic
- Track admin module usage (page views + key actions) to understand which features are being used
- All data goes into a single shared PostHog project; tenants are identified by `siteId` property
- Silent in local dev — no data captured unless `NEXT_PUBLIC_POSTHOG_KEY` is set and `NODE_ENV !== 'development'`

---

## Out of Scope

- Per-tenant PostHog projects
- Tenant-facing analytics dashboard in the admin
- Server-side event capture (posthog-node)
- Session recording

---

## SSR Safety Rule

`posthog-js` is browser-only. Any `posthog.capture()` call in a non-React file (e.g. `api.ts`) must be guarded:

```ts
if (typeof window !== 'undefined') {
  posthog.capture('event.name', { siteId });
}
```

React components do not need this guard — they only run in the browser.

---

## Packages

```
posthog-js
```

---

## Environment Variables

Added to `.env.staging` and `.env.production` only. Absent from `.env.development.local`.

```
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

PostHog initializes only when both conditions are true:
1. `NEXT_PUBLIC_POSTHOG_KEY` is present
2. `NODE_ENV !== 'development'`

If either condition fails, the provider renders children without initializing PostHog. All `capture()` calls become no-ops.

---

## Architecture

### Files to Create

| File | Purpose |
|---|---|
| `lib/analytics/PostHogProvider.tsx` | Client component — initializes PostHog, handles pageview tracking |
| `lib/analytics/useAnalytics.ts` | Hook — thin wrapper for `posthog.capture()` used by modules |

### Files to Modify

| File | Change |
|---|---|
| `app/layout.tsx` | Wrap children with `<PostHogProvider>` |
| `lib/user-context.tsx` | Call `posthog.identify()` on login, `posthog.reset()` on logout |
| Module components (see below) | Add `capture()` calls at key action points |

---

## PostHogProvider

Location: `lib/analytics/PostHogProvider.tsx`

- `'use client'` component
- On mount: checks env vars, initializes `posthog-js` with:
  - `api_host`: `NEXT_PUBLIC_POSTHOG_HOST`
  - `capture_pageview: false` — manual pageview control
  - `persistence: 'localStorage'`
- Listens to Next.js `usePathname()` changes via `useEffect` — fires `posthog.capture('$pageview')` on each navigation
- Wraps children in PostHog's `<PHProvider>` from `posthog-js/react`

---

## Identity & Tenant Context

Every event automatically carries `siteId` as a PostHog property, set during initialization by reading from `SiteContext`.

In `lib/user-context.tsx`, when `onAuthStateChanged` resolves with a user:
```ts
posthog.identify(user.uid, { siteId, email: user.email })
```

On logout:
```ts
posthog.reset()
```

This means every admin event is linked to a person with a known `siteId`, enabling PostHog filters like "show all POS events for site X".

---

## useAnalytics Hook

Location: `lib/analytics/useAnalytics.ts`

```ts
export function useAnalytics() {
  const { siteId } = useSite();
  const capture = useCallback((event: string, properties?: Record<string, unknown>) => {
    posthog.capture(event, { siteId, ...properties });
  }, [siteId]);
  return { capture };
}
```

- Modules import `useAnalytics`, never `posthog` directly
- `capture` is wrapped in `useCallback` — safe to use as `useEffect` dependency without triggering infinite loops
- If PostHog is uninitialized, `posthog.capture()` is already a no-op
- No error handling needed — posthog-js guards itself internally

### Event Naming Convention

`{module}.{action}` in snake_case. Examples: `pos.order_completed`, `reservation.booking_created`.

---

## Module Events — Initial Set

| Module | Event | Trigger point | Status |
|---|---|---|---|
| `byod_pos` | `pos.cashier_opened` | Cashier page mount | sprint 1 |
| `byod_pos` | `pos.order_completed` | After successful order Firestore write | sprint 1 |
| `byod_pos` | `pos.order_cancelled` | After order cancellation | deferred |
| `reservation` | `reservation.booking_created` | After booking Firestore write | sprint 1 |
| `reservation` | `reservation.booking_cancelled` | After cancellation | deferred |
| `membership` | `membership.member_added` | After member creation | sprint 1 |
| `inventory` | `inventory.stock_updated` | After stock adjustment write | sprint 1 |
| `promo` | `promo.code_applied` | After promo code applied to order | sprint 1 |
| `sales_pipeline` | `sales_pipeline.deal_moved` | After deal stage change | sprint 1 |

### Event Properties

Each event should include relevant context. Minimum:

- `siteId` — passed explicitly on every `capture()` call (enables event-level filtering without joining on person data)
- Module-specific: e.g. `{ siteId, total, itemCount }` for `pos.order_completed`, `{ siteId, serviceId }` for `reservation.booking_created`

The `useAnalytics` hook reads `siteId` from `useSite()` and injects it automatically into every `capture()` call — callers don't need to pass it manually.

Page views are captured automatically — no `capture()` call needed for navigation.

---

## Dev/Staging/Prod Behavior

| Environment | Captures? |
|---|---|
| `localhost` (dev) | No — key absent from `.env.development.local` |
| Staging | Yes — separate PostHog key, keeps staging data separate |
| Production | Yes |

Recommended: create two PostHog projects — one for staging, one for prod — so staging noise doesn't pollute production funnels.

---

## Implementation Order

1. Install `posthog-js`
2. Add env vars to staging/prod env files
3. Create `PostHogProvider` + wire into `app/layout.tsx`
4. Create `useAnalytics` hook
5. Wire identity in `UserProvider`
6. Add module events one module at a time, starting with `byod_pos`
