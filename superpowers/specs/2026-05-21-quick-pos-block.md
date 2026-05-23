# Spec: Quick POS Block

**Date:** 2026-05-21
**Status:** Approved, ready for plan
**Related skill:** `/byod_pos`, `/canvas_studio`, `/create_block`

---

## Problem

The existing **POS Menu** block (`pos_menu_grid` → `byod_pos:MenuGrid`) drops the entire POS ordering surface (full menu grid, category tabs, search, cart drawer, checkout flow) into a page. It's the "full POS view" — correct for a dedicated ordering page, but heavy and non-composable.

There is no way to use POS as a **product-checkout touchpoint** elsewhere on a page — e.g. a hero with one featured drink + Add-to-Cart, or a 3-item upsell strip inside a column.

## Goals

- Add a **new, sibling block** called **Quick POS** that lets admins hand-pick 1..N specific POS menu items and place them anywhere (inside columns, grids, hero areas, etc.).
- Render the picked items as POS-styled cards with the same Add-to-Cart / checkout / payment flow as the full block.
- **Share the same cart** as the full POS Menu block on the same page (one `CartProvider` → one checkout).

## Non-goals

- **Do not modify the existing `pos_menu_grid` block.** It stays as-is, works as-is, ships as-is.
- No category filters, no search, no tag-based selection. Hand-pick only.
- No new payment flow, no new cart, no new checkout — reuse POS plumbing 1:1.
- No per-item style overrides in v1 (no custom colors per pick, no custom labels).

## Decisions (locked)

| # | Decision |
|---|----------|
| 1 | **Selection model:** hand-pick by item ID only. Admin opens a picker, ticks items from the POS menu. |
| 2 | **Capacity:** 1..N items per block instance. No hard cap in v1 (soft guidance: ~8). |
| 3 | **Cart:** shared with any other POS block on the same page via the existing `CartProvider`. |
| 4 | **Name:** **Quick POS** (block picker label). Block `type` = `pos_quick`. Component key = `byod_pos:QuickPOS`. |
| 5 | **Layout (auto):** 1 item → large single card; 2+ items → responsive grid (2 cols mobile, 3 cols tablet, 4 cols desktop). No layout knob in the form. |

## Block shape

```ts
{
  type: 'pos_quick',
  label: 'Quick POS',
  componentKey: 'byod_pos:QuickPOS',
  props: {
    itemIds: string[]  // ordered list of POS menu item IDs
  }
}
```

## UX

### Admin (Canvas Studio)
- Appears in the block picker as **Quick POS** with a cube icon (same family as existing module blocks).
- Block form (in the right rail / slide-over): a single field — **Items** — that opens an item picker modal.
  - Picker lists all `sites/{siteId}/modules/byod_pos/products` (same source as `getProducts`).
  - Multi-select with checkboxes. Reorderable list of chosen items below.
  - Search by name within the picker (client-side filter over the already-loaded products).
- Live canvas preview renders the same as public — uses the loaded products. Empty state when `itemIds` is empty: "Pick items to display."
- "Manage" deep-link: same special-case as `pos_menu_grid` → routes to `/admin/pos/menu`.

### Public render
- 1 item: large hero-style card (image, name, description, price, Add-to-Cart button).
- 2+ items: responsive grid (`grid-cols-2 md:grid-cols-3 lg:grid-cols-4`). Compact card.
- Each card's Add-to-Cart calls the existing cart context (`useCart`).
- The shared `CartProvider` must be in scope. If a Quick POS block is the **only** POS block on a page, it provides its own `CartProvider` (mirroring `POSBlock`'s wrapping).
- If a full `pos_menu_grid` is also on the page, both blocks share the cart (single `CartProvider` per page).
- Variants (if the picked item has them) trigger the same variant-selection modal used by the full POS — do not reimplement.

### Empty / error states
- No `itemIds` configured: render nothing on public site (silent); show a "Pick items" hint in canvas.
- An `itemId` no longer exists in the menu: skip silently; log a warning via `logger`.
- Loading: brief spinner (same `Loader2` pattern as `POSBlockClient`).

## Architecture

### Files to create

```
clicker-platform-v2/
├── lib/modules/byod_pos/components/
│   ├── QuickPOSBlock.tsx              ← Public component, fetches items + filters by itemIds + renders cards
│   ├── QuickPOSBlockClient.tsx        ← 'use client' wrapper that pulls siteId from useSite() and renders QuickPOSBlock
│   └── QuickPOSCard.tsx               ← Single item card (shared by 1-item and N-item layouts; layout chosen by parent)
└── components/admin/blocks/
    └── forms/QuickPOSForm.tsx         ← Block form: item picker modal + ordered list
```

### Files to modify

| File | Change |
|---|---|
| `scripts/seed-modules.ts` (and `app/admin/(dashboard)/seed-modules/page.tsx`) | Add `{ type: 'pos_quick', label: 'Quick POS', componentKey: 'byod_pos:QuickPOS' }` to the `byod_pos` module's `blocks` array. |
| `lib/modules/components.tsx` | Add `dynamic` import for `QuickPOSBlockClient`, register `'byod_pos:QuickPOS': QuickPOSBlock` in `MODULE_COMPONENTS`. |
| `lib/modules/client-registry.tsx` | Add `'byod_pos:QuickPOS': QuickPOSBlockClient` to `CLIENT_MODULE_COMPONENTS`. |
| `components/admin/blocks/BlockFormRenderer.tsx` | Add a branch for `block.type === 'pos_quick'` → render `QuickPOSForm`. |
| `components/admin/blocks/BlockEditor.tsx` | Extend the existing `if (block.type === 'pos_menu_grid')` deep-link branch to also cover `pos_quick` (both point to `/admin/pos/menu`). |
| `components/admin/blocks/blockDefinitions.ts` (if module-block defaults live there) | Add default `props: { itemIds: [] }` for `pos_quick`. |

### Data flow

```
QuickPOSBlockClient  ──useSite()──>  siteId
        │
        ├── getProducts(siteId)          (existing api.ts function, reused as-is)
        │
        └── filter products where itemIds.includes(p.id)
                │
                └── QuickPOSBlock decides layout (1 vs N) → renders QuickPOSCard[]
                        │
                        └── onAddToCart → useCart().addItem(...)
```

`CartProvider` wrapping: `QuickPOSBlockClient` checks if it's already inside a `CartProvider` (via a `useCartOptional` hook or try/catch on `useCart`). If not, it wraps itself. This avoids double-wrapping when a `pos_menu_grid` is on the same page.

> **Simpler alternative for v1:** always wrap in `CartProvider`. Two cart providers on one page = two separate carts, but the user explicitly chose "shared". So the optional-wrap pattern is required for the locked spec. Confirm during implementation that `CartProvider` exposes a safe way to detect existing context.

## Implementation order (suggested)

1. Create `QuickPOSCard.tsx` (pure presentational; takes a `POSItem` + `onAdd` callback).
2. Create `QuickPOSBlock.tsx` (takes `itemIds[]` + pre-fetched items, applies layout rule).
3. Create `QuickPOSBlockClient.tsx` (fetches via `getProducts`, conditionally wraps in `CartProvider`).
4. Wire registration: `components.tsx`, `client-registry.tsx`, seed scripts.
5. Create `QuickPOSForm.tsx` with item picker modal.
6. Wire `BlockFormRenderer.tsx` and extend deep-link in `BlockEditor.tsx`.
7. Verify in Canvas Studio: drag in, pick items, save, reload, verify on public page.
8. Verify shared-cart behavior with both blocks on the same page.

## Verification checklist

- [ ] Block appears in Canvas Studio picker as "Quick POS".
- [ ] Form opens picker, can multi-select POS items, can reorder, persists on save.
- [ ] Public render with 1 item shows large card; with 2+ shows responsive grid.
- [ ] Add-to-Cart from Quick POS updates the same cart as the full POS block on the same page.
- [ ] Variant modal triggers for items with variants (no regression vs full POS).
- [ ] Missing `itemId` (item deleted from menu) → skipped silently, warning logged.
- [ ] Empty `itemIds` → silent on public, hint in canvas.
- [ ] Existing `pos_menu_grid` block unchanged in behavior and appearance.
- [ ] Admin deep-link "Manage" on a Quick POS block routes to `/admin/pos/menu`.

## Out of scope (future)

- Per-item display overrides (custom label, custom CTA copy, hide price).
- Layout knob (force stack vs grid).
- Category-based auto-selection.
- Quick POS as a checkout-only widget (no cart drawer, instant single-item buy).
- Analytics on Quick POS conversion (which placements drive orders).
