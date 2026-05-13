# Variant-Aware Item Creation Flow

**Date:** 2026-05-10
**Priority:** Medium (UX clarity)
**Estimated effort:** 1–2 hours

## Problem

Currently in [POSMenuItemDialog.tsx](../../clicker-platform-v2/lib/modules/byod_pos/admin/menu/components/POSMenuItemDialog.tsx), an item always has a top-level `price` and `inventoryId`, plus an optional "Product Variants" section tacked on below. This creates ambiguous configurations:

- An item with variants AND a base `price` set — which one wins? (Currently: variants override.)
- A user adds variants but forgets to clear the base inventory link — silent misconfiguration.
- The "Inventory Linking — Optional" hint says *"Link this main item to stock if it has no variants"*, expecting the user to read and obey that rule. Easy to miss.

## Goal

Force the user to declare item shape **up-front**, then show only the relevant fields. Eliminate the ambiguous "both" state.

## Proposed UX

When opening the New Item dialog, first prompt:

```
What type of item is this?
  ○ Standard product   (one price, one inventory link)
  ○ Has variants       (e.g. sizes, flavors — each with its own price + inventory link)
```

Based on selection:
- **Standard:** show `price` and `inventoryId` fields. Hide variants section entirely.
- **Has variants:** hide top-level `price` and `inventoryId`. Show variants section with at least one row required. Each variant must have name, price, and inventoryId.

For edit mode: derive the type from existing data (`variants.length > 0` → "Has variants"). Allow switching, with a confirmation: *"Switching to standard product will delete N variant(s). Continue?"*

## Implementation steps

1. Add a `productType: 'standard' | 'variant'` state in `POSMenuItemDialog`
2. In edit mode, initialize from `initialData.variants?.length > 0`
3. Conditional render: gate `<input name="price">` + inventory picker behind `productType === 'standard'`; gate variant section behind `productType === 'variant'`
4. Add the type selector UI at the top of the form (radio buttons or two cards)
5. On `handleSubmit`:
   - If standard: clear `variants` array on submit, ensure top-level price/inventoryId are valid
   - If variant: clear top-level price/inventoryId, ensure all variants have name + price + inventoryId
6. Add confirmation dialog when switching from "variant" → "standard" with existing variants
7. Update zod-style validation (or whatever validation pattern this dialog uses)

## Edge cases

- Switching variant → standard: warn about variant data loss
- Switching standard → variant: pre-populate first variant row from current price (e.g. variant name "Default", price = current price)
- Saving "variant" type with zero variants: block submit with error "Add at least one variant"

## Schema impact

None. The existing `POSItem` schema already supports both shapes (`price?` + `variants?: ProductVariant[]`). This is purely a UX gate to prevent invalid combinations.

## Test

- Create a new standard product → verify only top-level fields visible, saves correctly
- Create a new variant product → verify variants section, top-level price hidden, save with 2 variants
- Edit existing standard product → no variant section
- Edit existing variant product → no top-level price, variant rows pre-filled
- Switch types both directions → warning fires, data clears correctly

## Out of scope

- Migrating existing ambiguous items (those with both base price AND variants). Add a one-shot script later if any exist.
- Variant templates (e.g. "Add S/M/L sizes" preset). Future enhancement.
