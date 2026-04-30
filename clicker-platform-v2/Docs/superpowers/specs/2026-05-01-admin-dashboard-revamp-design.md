# Admin Dashboard Revamp — Design Spec
**Date:** 2026-05-01  
**Status:** Approved for implementation

---

## Overview

Replace the legacy admin dashboard (`/admin`) with a **Command Center** — a launchpad-first home screen where quick actions are the primary focus and module summaries sit below as supporting context. The existing analytics widgets (links count, products count, page views, clicks) are removed entirely; a proper analytics system will be built separately.

---

## Page Structure (top to bottom)

### 1. Quick Actions Hero

A prominent banner at the top of the page. Contains:

- **Greeting + context line** — business name and today's date (e.g. "👋 Welcome back — Warung Kopi Senja · Thursday, 1 May")
- **Action buttons** — a grid of icon+label buttons, one per active module's primary CTA. "Create Page" (Canvas Studio) is always pinned first regardless of module state. Remaining buttons are derived from the tenant's active modules. Each button is a direct navigation link — no dropdowns.

**Button derivation rule:** Each module definition declares an optional `dashboardAction: { label, icon, href }`. The dashboard collects these from active modules only and renders them in definition order after the pinned Create Page button. Modules without a `dashboardAction` field are skipped silently.

Visual: flat dark blue card (`#1e3a5f`), white text, semi-transparent button tiles. No gradients.

---

### 2. Pages Grid

A grid of Canvas Studio pages the tenant has created. Shows up to 6 pages, with a "View all →" link when there are more.

**Each page card:**

- Flat color thumbnail (a solid color picked sequentially from a fixed palette — no gradients, no screenshot capture)
- Page name
- Published / Draft status badge
- "Edit →" link that navigates to Canvas Studio with that page preloaded

**Last card is always a "+ Create Page" CTA** (dashed border, blue) that opens Canvas Studio on a blank new page.

**Empty state:** If no pages exist, show only the "+ Create Page" card with a short prompt ("You haven't created any pages yet. Start building your site.").

Data source: `sites/{siteId}/pages` collection, ordered by `updatedAt` descending, limit 6.

---

### 3. Active Modules

A grid of summary cards, one per module the tenant has enabled. Cards are ordered by module definition order.

**Each module card:**
- Module icon + name (top-left)
- Primary inline action button (top-right) — same `dashboardAction` declared in module definition, rendered as a small colored button
- Key metric (large number) — one data point relevant to that module (see per-module spec below)
- Supporting line — secondary context for the metric (e.g. "today", "pending approval", "expiring this week")

Modules that declare no `dashboardWidget` field are shown as a minimal card (name + icon only, no metric).

**Per-module metrics (initial set):**

| Module | Key Metric | Supporting Line | Action Button |
|---|---|---|---|
| `byod_pos` | Revenue today (Rp) | N orders · today | Open Cashier |
| `reservation` | Bookings today (count) | N pending confirmation | New Booking |
| `membership` | Total members | +N new this week | View All |
| `inventory` | Total items | ⚠ N low stock (if any) | View Stock |
| `promo` | Active promos (count) | N expiring this week | New Promo |
| `service_records` | Open records (count) | N pending approval | New Record |
| `sales_pipeline` | Open leads (count) | N new this week | View Pipeline |
| `fintrack` | Balance (Rp) | N entries this month | View Entries |

Data fetching: each module card fetches its own data independently (parallel Firestore reads on mount). No shared analytics aggregation. Failures per-card are isolated — a card that fails to load shows a "-" placeholder rather than breaking the page.

---

### 4. Module Connections

A static topology map showing which active modules are wired together. Rendered as a simple horizontal flow with labeled arrows. No live data — purely informational.

**Connections defined (shown only when both connected modules are active):**

| From | To | Label |
|---|---|---|
| POS | Inventory | deducts stock |
| POS | Members | awards points |
| POS | Promo | applies discounts |
| Reservations | Members | linked to |
| Service Records | Members | linked to |
| Service Records | Inventory | deducts parts |

If no connections exist (e.g. tenant only has one module active), this section is hidden entirely.

Rendering: plain HTML/CSS flexbox flow — no SVG, no canvas, no external diagram library. Keep it simple and maintainable.

---

## Architecture

### File changes

| File | Change |
|---|---|
| `app/admin/(dashboard)/page.tsx` | Full rewrite — remove old analytics, render four new sections |
| `lib/modules/definitions.ts` | Add optional `dashboardAction` and `dashboardWidget` fields to `ModuleDefinition` type |
| `components/admin/dashboard/QuickActionsHero.tsx` | New component |
| `components/admin/dashboard/PagesGrid.tsx` | New component |
| `components/admin/dashboard/ModuleCards.tsx` | New component + per-module widget sub-components |
| `components/admin/dashboard/ModuleConnectionMap.tsx` | New component |

### Data access

- Pages list: client-side Firestore query, `onSnapshot` for real-time updates
- Module cards: each sub-component fetches its own slice independently
- Module connection map: pure static data derived from `definitions.ts` — no Firestore reads
- Quick Actions: derived from module definitions + `useSite()` active modules — no Firestore reads

### Module definition extension

```ts
// Addition to ModuleDefinition in lib/modules/definitions.ts
dashboardAction?: {
  label: string        // e.g. "Open Cashier"
  href: string         // relative path within the admin
}
dashboardWidget?: {
  component: string    // key referencing the widget registry
}
```

The `ModuleCards` component maintains a registry mapping `dashboardWidget.component` keys to the actual React sub-components. This keeps the module definition file free of React imports.

---

## What's removed

- Total Links count widget
- Products count widget
- Total Page Views counter (analytics shards)
- Total Clicks counter (analytics shards)
- Top 3 Links table
- Top 3 Products table
- `getSiteStatsTotals()` calls on the dashboard page (the utility itself stays — it's used elsewhere)

---

## Out of scope (deferred)

- Real page thumbnail screenshots (flat color placeholder is sufficient for now)
- Cross-module activity feed / event timeline
- User-pinned shortcuts / personalization
- Articles / publishing content section
- Analytics widgets (separate project)
