# AI Credit Indicator — Design Spec

**Date:** 2026-05-23
**Status:** Approved (ready for implementation plan)
**Replaces:** [`components/admin/AICreditBanner.tsx`](../../clicker-platform-v2/components/admin/AICreditBanner.tsx) (to be deleted)

---

## Problem

The current implementation injects a full-width red/amber **banner** ([`AICreditBanner.tsx`](../../clicker-platform-v2/components/admin/AICreditBanner.tsx)) into every admin dashboard page via [`app/admin/(dashboard)/layout.tsx:24`](../../clicker-platform-v2/app/admin/(dashboard)/layout.tsx#L24) whenever the site's AI credit balance falls below 50%.

Three problems:

1. **Noisy.** Repeated on every admin route, every page load.
2. **Irrelevant for non-AI tenants.** Tenants who don't use AI Sales Agent, Stocklens scanner, or knowledge sync still see the banner — there is nothing they can act on.
3. **Unhelpful unit.** Displays raw USD to four decimals (`$0.0064 left`), which is meaningless to non-technical tenants.

## Goal

Replace the global banner with a **calm, persistent, glanceable AI-credit status indicator** that:

- Is **only rendered for tenants who actually have at least one AI-using module enabled.**
- Is **always visible without being loud** — color does the work, not copy.
- Uses a **friendly unit ("credits"), not raw USD,** for display.
- Surfaces detail on click, not on every page load.

Non-AI tenants must see nothing — no pill, no card, no banner.

---

## Surfaces

Two coordinated surfaces. Both render from the same underlying state hook.

### 1. Top-bar pill (always visible)

A compact pill in the admin top bar, left of the inbox / profile icons.

- Visual: pill with a small ring-progress icon + numeric value + label.
- Default state: `⚡ 642 credits` — neutral slate/blue.
- Click → opens detail popover (see §3 below).

### 2. Launcher-popover card

A card inside the app-launcher popover (the panel opened by the top-left 4-dot button), positioned **directly under the CLICKER brand row, above the "CORE" section.**

- Visual: rounded card with title row + progress bar + footer line.
- Same visual language as Claude's "Credits" card (reference image discussed in brainstorm).
- Click on card → routes to the AI Platform usage page (`/admin/ai-platform/usage`) if available, otherwise no-op.

### 3. Pill-click popover (detail)

When the pill is clicked, a small popover (anchored to the pill) opens containing:

- The same card design as §2 (re-used component).
- One muted line: *"Used by AI Sales Agent, Stocklens scanner, and knowledge sync. Resets on \<date\>."*
- A `Need more? Contact admin →` link.

---

## States

Four states driven by `balance` (in credits) relative to a per-tenant baseline.

| State    | Trigger                  | Pill                                    | Card                                                                       |
| -------- | ------------------------ | --------------------------------------- | -------------------------------------------------------------------------- |
| Healthy  | `pct ≥ 50%`              | Slate border, blue ring, neutral text   | Slate bg, blue progress bar                                                |
| Warn     | `10% ≤ pct < 50%`        | Amber tint                              | Amber bg, amber bar, footer: *"Running low — top up soon"*                 |
| Critical | `0 < pct < 10%`          | Red tint                                | Red bg, red bar, footer: *"Critical — top up now →"*, **pulsing dot**      |
| Out      | `balance ≤ 0`            | Red tint + small pulsing red dot        | Red bg, empty bar, footer: *"AI features paused — top up to resume →"*     |

Rules:

- **No animation in Healthy or Warn states.** Pulsing dot only fires in Critical and Out.
- **No dismiss button.** Calm by design.
- **No toast, modal, or notification** at any state transition. Color is the only signal.
- **The widget never blocks the page or shifts layout.** It lives in chrome that is always present.

### Percent reference for color thresholds

`pct = balance / max(monthlyBaseline, lastTopupAmount, balance)` — i.e. the largest known "expected full tank" the system has seen for this tenant. This avoids the case where a tenant who has never topped up sits permanently at 100% / 0% with no middle ground.

If no baseline is recoverable, fall back to absolute thresholds:
- Warn at `≤ 500 credits` ($5)
- Critical at `≤ 100 credits` ($1)
- Out at `≤ 0`

---

## Unit & display: credits

### The peg

```
1 credit = $0.01 USD
```

Stored as a single constant: `lib/ai/credits-display.ts → USD_PER_CREDIT`.

### Storage vs display

| Layer         | Unit                 | Precision                 |
| ------------- | -------------------- | ------------------------- |
| Firestore     | `balance: number`    | USD, 6 decimals (unchanged from today) |
| API response  | USD                  | unchanged                 |
| **Display**   | **credits (whole)**  | rounded to nearest int    |

Conversion is **purely a display concern**. The Firestore schema, [`lib/ai/credits.ts`](../../clicker-platform-v2/lib/ai/credits.ts), [`/api/admin/ai-credits`](../../clicker-platform-v2/app/api/admin/ai-credits/route.ts), and all deduct/refund/addCredits logic remain in raw USD with no changes.

### Why whole credits

A single Gemini Flash chatbot reply costs roughly `$0.0003–0.0008` → `0.03–0.08 credits`. If we displayed fractions, a fresh 1,000-credit top-up would immediately drift to `999.94` after one message — ugly. By rounding to whole credits in the UI, drift is invisible.

### Topup advertising

Topups are advertised in whole credits with an exact USD price:

- "1,000 credits — $10"
- "5,000 credits — $50"
- "10,000 credits — $100"

(Topup product table is out of scope for this spec — assumed to exist or to follow.)

### Why $0.01 and not smaller/larger

- `1 credit = $0.001` → numbers inflate (a $10 top-up = 10,000); still fractional in display.
- `1 credit = $0.0001` → "Robux" effect (a $10 top-up = 100,000); honest but feels arbitrary.
- `1 credit = $0.01` → topup figures are recognisable as money (1,000 ≈ $10); fractions are absorbed by rounding.

The peg is a single constant — easy to revisit later without schema migration.

### Helper API

```ts
// lib/ai/credits-display.ts
export const USD_PER_CREDIT = 0.01;

export function usdToCredits(usd: number): number {
  return Math.round(usd / USD_PER_CREDIT);
}

export function formatCredits(usd: number): string {
  return `${usdToCredits(usd).toLocaleString('en-US')} credits`;
}

export function formatCreditsShort(usd: number): string {
  // e.g. 12,400 → "12.4k"
  const n = usdToCredits(usd);
  if (n >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return n.toLocaleString('en-US');
}
```

The pill uses `formatCreditsShort`; the card uses `formatCredits`. The popover may additionally show `≈ $X.XX USD` in muted text for transparency / power users.

---

## Visibility rule (tenant gating)

The widget is rendered **only** when the tenant has at least one AI-using feature enabled. Concretely:

```
shouldRenderAICreditIndicator(siteId) =
     module(ai_sales_agent).enabled
  || module(stocklens).enabled
  || module(knowledge_sync).enabled        // when it lands
  || balance < 0                            // safety: never silently leave a tenant in debt
```

The first three are read from the existing per-site module flags (`sites/{id}.modules.{moduleId}`). If a fourth AI-consuming module is later added, it must be added to this list — call this out in the implementation plan.

A non-AI tenant therefore sees:
- No pill in the top bar.
- No card in the launcher popover.
- No banner anywhere (the old banner is deleted, not gated — gone for everyone).

---

## Components

### New

| File                                                            | Purpose                                                                                  |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `lib/ai/credits-display.ts`                                     | Pure helpers: `USD_PER_CREDIT`, `usdToCredits`, `formatCredits`, `formatCreditsShort`.   |
| `lib/hooks/use-ai-credit-status.ts`                             | Client hook: fetches balance, computes state (`healthy / warn / crit / out`), and `shouldRender`. Owns the polling/refresh story. |
| `components/admin/ai-credit/AICreditPill.tsx`                   | Top-bar pill. Renders nothing if `!shouldRender`.                                        |
| `components/admin/ai-credit/AICreditCard.tsx`                   | The reusable card (used in launcher popover **and** inside the pill-click popover).      |
| `components/admin/ai-credit/AICreditPopover.tsx`                | Popover anchored to the pill, contains `AICreditCard` + topup link.                      |

### Modified

| File                                                            | Change                                                                                   |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `app/admin/(dashboard)/layout.tsx`                              | **Delete** `<AICreditBanner />` line and the import.                                     |
| `components/admin/TopBar.tsx` (or whichever renders the top bar)| Mount `<AICreditPill />` left of the inbox icon.                                         |
| `components/admin/AppLauncher.tsx` (or whichever renders the launcher popover) | Mount `<AICreditCard variant="launcher" />` between brand row and "CORE" section. |

### Deleted

| File                                                            | Reason                                                                                   |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `components/admin/AICreditBanner.tsx`                           | Replaced by the indicator system.                                                        |

(Exact top-bar / launcher file names to be confirmed during planning.)

---

## Data flow

1. `useAICreditStatus()` hook (client) on mount:
   - Reads `siteId` from `useSite()`.
   - Reads enabled modules from the existing site-context / module subscription (no extra Firestore reads).
   - Computes `shouldRender` — if `false`, returns `{ shouldRender: false }` and **does not** hit `/api/admin/ai-credits`.
   - If `true`, fetches `/api/admin/ai-credits` with bearer token + `x-site-id` header (same contract as today).
   - Returns `{ shouldRender, state, balanceUSD, balanceCredits, pct, label }`.

2. `AICreditPill` and `AICreditCard` are pure consumers of the hook. They render nothing when `shouldRender === false`.

3. Refresh: the hook re-fetches on:
   - Mount (initial paint)
   - Window focus (`visibilitychange === 'visible'`)
   - Manual `refresh()` exposed from the hook (for future hooks-into-deduct flows; not used in v1)

   No polling. No realtime listener. The balance moves slowly relative to admin session length; a focus-refresh is enough.

---

## Accessibility

- Pill: `<button>` with `aria-label="AI credits: 642 remaining"`, opens popover with `aria-expanded`.
- Card: `<a>` if linking to usage page, otherwise `<div>` with no interactive role.
- Pulsing dot in Critical/Out: `aria-hidden="true"` — the color and label carry the meaning.
- Color is never the sole differentiator — every state has distinct text in the footer line of the card.

---

## Out of scope (deferred to future iterations)

1. **Per-module breakdown in the popover** ("AI Sales Agent: 412 credits this month") — useful but needs the daily ledger to be queryable from the client. Defer.
2. **Topup product table & purchase flow.** The popover links to "Contact admin →" today. Self-serve topup is a separate initiative.
3. **Email digest** when balance drops below Critical. Out of scope; can be added when the email infrastructure is reused.
4. **Per-user vs per-tenant quotas.** Single tenant-wide balance only.
5. **Auto-reset / monthly free tier.** The card footer mentions "Resets monthly" only if `monthlyResetDate` is known; otherwise the footer omits that line. Implementing automatic monthly resets is a separate ledger-side change.
6. **Currency localisation.** USD only. Display is in "credits" which sidesteps the question for now.
7. **Anti-double-click / debouncing on popover open.** Standard Radix/Headless behavior is fine.

---

## Future iteration notes

These are explicitly *not* in v1 but worth flagging so they're easy to layer on:

- The `USD_PER_CREDIT` peg may want re-tuning once we have real topup volume data. Because storage stays in USD, this is a one-line change.
- If `formatCreditsShort` proves confusing at very large numbers (e.g. `12.4k credits`), revisit. Easy to swap to full numbers with thousand separators.
- The `shouldRender` rule may want to be data-driven (e.g. a `lib/ai/consumer-modules.ts` registry that every AI-using module registers into) once we have 4+ AI modules. For 3 modules, a hardcoded list is fine.
- The popover's "Contact admin →" link could become a deep link into Backyard or a `mailto:`. To be decided when self-serve topup ships.

---

## Acceptance

A non-AI tenant logs in: sees no AI-credit chrome anywhere. Old banner is gone.

An AI tenant logs in:
- Sees a calm slate `⚡ 642 credits` pill in the top bar.
- Opens the app launcher: sees the credit card directly under the CLICKER brand row.
- As balance falls below 50%, both surfaces shift to amber. Below 10%, red with a pulsing dot. At zero, "AI features paused" message in the card footer.
- Clicks the pill: small popover with the same card + a topup link.
- No red banner ever appears.
