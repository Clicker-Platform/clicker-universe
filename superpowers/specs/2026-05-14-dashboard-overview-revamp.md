# Dashboard Overview Revamp — Design Spec

**Date:** 2026-05-14
**Status:** Approved (pending user review of written spec)
**Path affected:** `clicker-platform-v2/app/admin/(dashboard)/page.tsx` and supporting components

---

## 1. Summary

Replace the current vertical-stack admin dashboard (Quick Actions hero, Pages grid, Module cards, Module connection map) with a **3-column overview**:

- **Inbox** column (widest): preview of latest form submissions with tabs (Inbox / New / Read)
- **Pages** column: compact grid of custom pages (cap 6) + "Canvas Studio" link
- **Modules** column: curated, per-site list of module overview widgets, admin-picked via a "+ Add module" popover

Each module declares an optional `overviewWidget` descriptor; only modules the admin opts in appear in the Modules column.

The existing AdminSidebar and global topbar are **not touched** — only the dashboard page content is rewritten.

---

## 2. Goals

- Surface the day-to-day signals (new submissions, key module metrics) at-a-glance on the overview page
- Let admins curate which module widgets appear, so the overview doesn't bloat as more modules ship
- Keep the dashboard a thin composition layer — each module owns its own widget

## 3. Non-Goals (v1)

- Drag-to-reorder widgets
- Filter dropdown in the content header (wireframe shows one; we explicitly skip it)
- Real page screenshots / custom thumbnails
- Overview widgets for every module (ship Membership, Self Order, Payments first; others incrementally)
- Embedded inbox detail view — clicks still route to `/admin/inbox`

---

## 4. Layout

### 4.1 Content header

In-page only. Existing AdminSidebar + global topbar untouched.

- Title: **"Overview"**
- No filter dropdown
- No user avatar / app-grid icon (those are global chrome)

### 4.2 Desktop (≥ lg)

3 columns, asymmetric widths reflecting content density:

| Column | Width | Purpose |
|---|---|---|
| Inbox | ~38% | Submission preview list (widest — content benefits from horizontal room) |
| Pages | ~30% | Page thumbnail grid (compact cards) |
| Modules | ~32% | Curated module widget stack |

### 4.3 Mobile (< lg)

Single stack. Order: **Inbox → Pages → Modules**. No tablet middle state in v1 — at `md`, still single stack.

---

## 5. Inbox Column

### 5.1 Data

Subscribes to the same Firestore collection `/admin/inbox` reads from (`sites/{siteId}/submissions` or equivalent — confirm exact path during implementation). Live subscription, latest 10 by `createdAt desc`.

### 5.2 UI

```
┌─ Inbox  (3) ─────────────────────────────┐
│ [ Inbox ] [ New ] [ Read ]               │
│ ──────────────────────────────────────── │
│ ● Jane Doe — Contact form                │
│   "Halo, saya tertarik dengan…"          │
│   2h ago                                  │
│ ────                                     │
│ ● Budi S. — Booking form                 │
│   "Untuk Sabtu, jam 10…"                 │
│   5h ago                                  │
│ ...                                       │
│ [ View all in Inbox → ]                  │
└──────────────────────────────────────────┘
```

- **Tabs:** Inbox (all), New (unread), Read. Default tab: Inbox.
- **Tab counts:** computed from the latest-10 fetched (cheap, no extra queries).
- **Row click:** routes to `/admin/inbox?submissionId=<id>` (or the current canonical detail route — verify during implementation).
- **Empty state per tab:** envelope icon + "No submissions yet" — matches the wireframe.
- **"View all in Inbox" link:** routes to `/admin/inbox`.

### 5.3 Component

New: `components/admin/dashboard/InboxColumn.tsx`. Reuses existing submission types and read-state logic from the inbox module — does not reimplement filtering or read-marking.

---

## 6. Pages Column

### 6.1 Data

Subscribes to `sites/{siteId}/pages` (existing Canvas Studio pages collection). Latest 6 by `updatedAt desc`.

### 6.2 UI

```
┌─ Pages              Canvas Studio → ─────┐
│ ┌──────────┐ ┌──────────┐                │
│ │ [bluish] │ │ [pinkish]│                │
│ │   📄     │ │    📄    │                │
│ │ Online   │ │ Design   │                │
│ │ Resume   │ │ System   │                │
│ └──────────┘ └──────────┘                │
│ ┌──────────┐ ┌─ + ──────┐                │
│ │ Affiliate│ │  dashed  │                │
│ └──────────┘ └──────────┘                │
└──────────────────────────────────────────┘
```

- **Card size (reduced from wireframe):** ~120×100px, tight aspect. Colored block on top with a generic page icon centered; page name on bottom in a single truncated line.
- **Thumbnail color:** deterministic hash of `pageId` mapped to a small pastel palette (~6 colors). No upload, no real screenshot in v1.
- **Card click:** `/admin/pages/{id}` (existing page editor).
- **"+" tile:** triggers the existing "new page" flow (matches whatever `/admin/pages` does today — verify during implementation; either inline create or navigate with `?new=1`).
- **"Canvas Studio" header link:** routes to `/admin/canvas`.
- **Cap at 6 cards.** If site has >6 pages, the 6th slot becomes a "View all (N) →" tile that routes to `/admin/pages`. The "+" tile is always present in slot 5 (or earlier if fewer pages); at exactly 5 pages, "+" sits in slot 6.
- **Empty state (0 pages):** show only the "+" tile, expanded width, with the label "Create your first page".

### 6.3 Component

New: `components/admin/dashboard/PagesColumn.tsx`. Replaces existing `PagesGrid` for the overview surface.

---

## 7. Modules Column

### 7.1 Data sources

Two:

1. **Static:** `ModuleDefinition.overviewWidget` (declared per module — see §8).
2. **Per-site state:** `sites/{siteId}.dashboardOverview.visibleWidgets: string[]` — ordered list of moduleIds chosen by the admin.

### 7.2 UI

```
┌─ Modules ────────────────────────────────┐
│ ┌────────────────────────────────────┐  │
│ │ 4 members  +0 new this week     [×]│  │
│ │ Membership & Loyalty               │  │
│ └────────────────────────────────────┘  │
│ ┌────────────────────────────────────┐  │
│ │ 5 active orders                 [×]│  │
│ │ Self Order                         │  │
│ └────────────────────────────────────┘  │
│ ┌────────────────────────────────────┐  │
│ │ 12 transactions this month      [×]│  │
│ │ Payments                           │  │
│ └────────────────────────────────────┘  │
│ ┌─ + Add module ─ (dashed) ─────────┐  │
│ └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

- Each widget is a **compact row** (~64px): primary stat line (bold) + secondary muted line + label line.
- Full row is a link to the widget's `defaultHref`.
- **[×]** appears on hover top-right; click removes the widget from `visibleWidgets` (with optional undo toast).
- **"+ Add module"** dashed tile opens the picker popover (§7.4).
- **Per-widget loading state:** skeleton row while that module's subscription hydrates. Widgets load independently — one slow module doesn't block others.
- **Empty state** (no visible widgets selected): just the "+ Add module" tile with helper text "Pick which modules to show here."

### 7.3 RBAC

If the user lacks edit permission (see existing `canEdit` checks in dashboard components):

- Hide the [×] on widgets
- Hide the "+ Add module" tile
- Column is read-only

### 7.4 Add Module Picker

Popover (not full modal) anchored to the "+ Add module" tile:

```
┌──────────────────────────────┐
│ Add to overview              │
│ ─────────────────────────── │
│ ☐ Sales Pipeline             │
│ ☑ Membership & Loyalty       │
│ ☑ Self Order                 │
│ ☐ Service Records            │
│ ☑ Payments                   │
│ ─────────────────────────── │
│        [Cancel]  [Save]      │
└──────────────────────────────┘
```

- Lists all modules that are **(a)** enabled for the site **and** **(b)** declare an `overviewWidget`.
- Pre-checks already-visible modules.
- **Save** writes the new `visibleWidgets` array. New picks are appended to the end of the existing order.
- **Cancel** discards changes.
- No reorder in v1.

### 7.5 Component

New: `components/admin/dashboard/ModulesColumn.tsx` + `components/admin/dashboard/AddModuleWidgetPicker.tsx`. Replaces existing `ModuleCards`.

---

## 8. Module Overview Widget Contract

Extend `ModuleDefinition` (in `lib/modules/types.ts`):

```ts
overviewWidget?: {
  // Component rendering the widget body. Receives runtime context.
  Component: ComponentType<{ siteId: string; baseUrl: string }>;
  // Static metadata used by the picker (no need to load the component to display the picker row):
  label: string;        // "Membership & Loyalty"
  defaultHref: string;  // Route the widget links to (may be templated with baseUrl)
};
```

### 8.1 Rendered shape (uniform)

Each `Component` returns a fragment matching the standard widget row:

```
{primary}   {secondary?}
{label}
```

- `primary` (required): the main number/phrase, bold — e.g. "4 members", "5 active orders"
- `secondary` (optional): muted context — e.g. "+0 new this week"
- `label`: comes from the static descriptor (not duplicated in the component output)

The dashboard provides the outer card chrome (border, hover state, [×], click-through). The module's component only renders the two text lines.

### 8.2 Data fetching

Each widget owns its own Firestore subscription (live), same pattern as today's `ModuleCards`. Colocated with the module: `lib/modules/{name}/OverviewWidget.tsx`.

### 8.3 v1 modules

Ship widgets for:

- **Membership** — member count, optional "+N new this week"
- **Self Order POS (byod_pos)** — active orders count
- **Payments** — transactions this month (or matching POS reporting metric)

Other modules (Promo, Service Records, Sales Pipeline, etc.) can add widgets later without touching the dashboard code.

---

## 9. Per-Site Visibility State

### 9.1 Storage

New field on the site document:

```ts
// sites/{siteId}
{
  dashboardOverview?: {
    visibleWidgets: string[];  // ordered list of moduleIds
  };
}
```

- Order in the array = render order.
- Missing field → defaults to the first ~3 enabled modules with an `overviewWidget` (deterministic by registry order).
- Read-time filter: drop any moduleId that isn't currently enabled or doesn't have a widget descriptor — keeps stale state safe.

### 9.2 Helper module

New: `lib/modules/dashboard-overview.ts` exports:

```ts
subscribeToVisibleWidgets(siteId): Subscription<string[]>
setVisibleWidgets(siteId, ids: string[]): Promise<void>
```

### 9.3 Firestore rules

Allow authenticated members with edit rights on the site to update `sites/{siteId}.dashboardOverview`. Use the same `canEdit` pattern existing module-settings writes use.

---

## 10. Files to Add / Modify / Remove

### Add

- `components/admin/dashboard/OverviewLayout.tsx` — 3-column shell + content header
- `components/admin/dashboard/InboxColumn.tsx`
- `components/admin/dashboard/PagesColumn.tsx`
- `components/admin/dashboard/ModulesColumn.tsx`
- `components/admin/dashboard/AddModuleWidgetPicker.tsx`
- `lib/modules/dashboard-overview.ts`
- `lib/modules/membership/OverviewWidget.tsx`
- `lib/modules/byod_pos/OverviewWidget.tsx`
- `lib/modules/payments/OverviewWidget.tsx` (or wherever payments lives — verify during implementation)

### Modify

- `app/admin/(dashboard)/page.tsx` — rewritten as a thin composition of `OverviewLayout` + the three columns
- `lib/modules/types.ts` — adds optional `overviewWidget` to `ModuleDefinition`
- `lib/modules/definitions.ts` — wire `overviewWidget` for Membership, Self Order, Payments
- `components/skeletons/DashboardSkeletonNew.tsx` — matches new 3-column layout
- Firestore rules — permit `dashboardOverview` writes by edit-capable members

### Remove

- `components/admin/dashboard/QuickActionsHero.tsx`
- `components/admin/dashboard/PagesGrid.tsx`
- `components/admin/dashboard/ModuleCards.tsx`
- `components/admin/dashboard/ModuleConnectionMap.tsx`

---

## 11. Edge Cases

- **0 enabled modules with widgets** → Modules column shows only the "+ Add module" tile (which opens an empty picker showing helper text "No modules with overview widgets yet").
- **All visible widgets later disabled** → filtered out at read time, column appears empty, "+ Add module" tile shown.
- **Slow widget** → its own skeleton; siblings render normally.
- **Site with 0 pages** → Pages column shows only the expanded "+" tile with "Create your first page".
- **Site with no submissions** → Inbox shows envelope + "No submissions yet".
- **Read-only user** → Modules column has no edit affordances; everything else read-only as today.

## 12. Testing Notes

- Unit-test `dashboard-overview.ts` read-time filtering (stale moduleIds dropped, missing field → default set).
- Component test the picker: pre-check state, save writes correct array, cancel discards.
- Component test each v1 `OverviewWidget` with a fixture site (membership count present, zero state, loading state).
- Verify RBAC: read-only user sees no [×] and no "+ Add module".
- Manual: resize to mobile, confirm single-stack order Inbox → Pages → Modules.
