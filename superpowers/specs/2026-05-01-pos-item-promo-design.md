# POS Item Promo — Design Spec

**Date:** 2026-05-01
**Status:** Approved
**Scope:** byod_pos module — item-level promo display, admin linking, customer widget, checkout anti-stacking

---

## Problem

The POS module has no way for tenants to mark specific menu items as discounted, and customers have no visibility into available promos during ordering. The cashier can apply an order-level promo at payment time, but this requires staff action and offers no self-serve customer experience.

---

## Goals

1. Admin can link a menu item to an existing Promo record (from the Promo module)
2. Customers see discounted items in the widget — both inline on the menu card and in a dedicated "Promo Items" section
3. Discount applies automatically at cart/checkout — no code required from customer
4. Promo usage is tracked via the existing promo engine (`commitPromoUsage`)
5. If promo limit is reached or expires mid-session, customer is notified prominently but checkout is not blocked
6. Cashier order-level promo is blocked when item-level promos are already applied (no stacking)

---

## Out of Scope

- Custom discount amounts on items (all discounts must come from a Promo record)
- Conditional promo rules per item (min quantity, member-only, etc.) — deferred
- Multiple promos per item
- Stacking item promo + order promo

---

## Data Model

### `POSItem` additions

```ts
linkedPromoId?: string            // FK to Promo record
linkedPromoSnapshot?: {           // cached at admin save time for fast display
  kind: 'percent' | 'fixed'
  value: number
  label: string
  maxUses?: number
  validUntil?: Timestamp
}
```

**Stale snapshot rule:** On item edit form open, fetch the live Promo and compare `value` to `linkedPromoSnapshot.value`. If they differ, show a warning: *"Promo updated since last save — save item to refresh."* Saving the item re-snapshots from the live record.

### `CartItem` additions

```ts
itemPromo?: {
  promoId: string
  kind: 'percent' | 'fixed'
  value: number
  label: string
  discountAmount: number          // computed and locked at add-to-cart time
  expired: boolean                // true = promo ran out before checkout
}
```

**No new Firestore collections.** `linkedPromoId` lives on the menu item doc (`modules/byod_pos/menu_items/{id}`). `itemPromo` lives inside each order's `items[]` array.

---

## Admin Flow

**Location:** Existing POS Menu editor (`POSMenuClient.tsx`) — new "Promo" section on the item edit form, below the price field.

**Form UI:**
```
[ Promo ]
○ No promo
○ Link to promo  →  [dropdown: active promos from listPromos()]
```

When a promo is selected, a read-only preview renders:
```
✓ 20% off  ·  "Weekend Special"  ·  Expires 31 May  ·  48 / 100 uses
```

**Data source:** `listPromos(siteId)` filtered to `status === 'active'` — existing API, no new functions.

**On save:** Write `linkedPromoId` and `linkedPromoSnapshot` (snapshotted from live Promo at save time) to the `POSItem` doc.

**Stale indicator:** If snapshot `value` differs from live promo on form open, show:
```
⚠ Promo updated since last save — save item to refresh
```

---

## Customer Widget Flow

### Menu Grid — item card

Items with `linkedPromoSnapshot` render with:
- Strikethrough original price
- Discounted price (bold)
- `PROMO` badge on card

Discounted price = original price minus computed discount (percent or fixed).

### Dedicated "Promo Items" section

A horizontal scroll section at the top of the menu (above category tabs), titled **"Promo Items"**. Shows only items with `linkedPromoSnapshot` set. Hidden entirely if no promo items exist.

### Add-to-cart evaluation

On tap, call `evaluatePromo({ siteId, promoId: item.linkedPromoId, source: 'POS', subtotal })`:

- **Valid** → snapshot `itemPromo` into `CartItem` with `expired: false`, `discountAmount` computed and locked
- **Invalid (limit/expired)** → add item at normal price, no `itemPromo` set, show toast: *"Promo no longer available — added at regular price"*

### Cart display

Each promo item shows:
```
Caramel Latte  ×1              Rp 28.000
  🏷 Weekend Special (-Rp 7.000)
```

### Mid-session expiry (prominent warning)

Re-validate all `CartItem.itemPromo` entries on cart open. For any item where the promo is now invalid:
- Set `expired: true` on the `CartItem`
- Revert price to normal
- Show prominent amber banner at top of cart:

```
┌──────────────────────────────────────────────────┐
│ ⚠  Some promo prices are no longer valid         │
│    Caramel Latte has been updated to             │
│    regular price (Rp 35.000).                    │
│    [Review Cart]                                 │
└──────────────────────────────────────────────────┘
```

Checkout is NOT blocked. Updated total is visible before customer confirms.

### Tax recalculation

Discounted `CartItem.price` values feed into the subtotal before tax — no special handling needed. `calculateBillTotals()` operates on item prices as-is.

---

## Checkout & Payment Flow

### Order creation

On order submit, each `CartItem` with valid `itemPromo` (`expired: false`) is written with the full `itemPromo` snapshot. `total` reflects discounted prices. No separate discount field on the order root.

### Cashier anti-stacking rule

In `PaymentConfirmationDialog`, check if any item in the bill has `itemPromo` set and `expired: false`:

- **Yes → promo input disabled**, message shown:
  ```
  Item discounts already applied — order-level promo unavailable
  ```
- **No → existing cashier promo flow unchanged**

This is a UI-only guard.

### `commitPromoUsage` after payment

After `confirmPayment()` succeeds, for each unique `promoId` across all items in the bill:

```ts
await commitPromoUsage({
  siteId,
  applied: { kind, promoId, refId: orderId, label },
  source: 'POS',
  memberId
})
```

If multiple items share the same `promoId`, commit once with `refId: orderId` and `quantity: count` (number of items using that promo). Usage count on the Promo record increments by `quantity`.

### Receipt

Each discounted item renders with original price + discount line. Existing receipt generator structure is unchanged — new line item rendering for `itemPromo` only.

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `lib/modules/byod_pos/types.ts` | Add `linkedPromoId`, `linkedPromoSnapshot` to `POSItem`; add `itemPromo` to `CartItem` |
| `lib/modules/byod_pos/api.ts` | Update order creation to include `itemPromo` snapshot; update `commitPromoUsage` call after payment |
| `lib/modules/byod_pos/admin/menu/POSMenuClient.tsx` | Add Promo section to item edit form |
| `lib/modules/byod_pos/components/MenuGrid.tsx` | Promo badge, strikethrough price, "Promo Items" section |
| `lib/modules/byod_pos/components/POSWidget.tsx` | `evaluatePromo` on add-to-cart, mid-session re-validation, expired banner, cart item promo display |
| `lib/modules/byod_pos/admin/components/PaymentConfirmationDialog.tsx` | Anti-stacking guard on promo input |
| `lib/modules/byod_pos/receipt-generator.ts` | Render `itemPromo` discount line on receipt |
| `lib/modules/byod_pos/cart-context.tsx` | Add `itemPromo` state management to cart |

---

## Key Constraints (never violate)

- Always re-evaluate `evaluatePromo()` at add-to-cart time — never trust `linkedPromoSnapshot` for discount validity
- `commitPromoUsage()` is called AFTER `confirmPayment()` succeeds — never before
- `itemPromo.discountAmount` is snapshotted at add-to-cart and never mutated — order history is immutable
- Anti-stacking is UI-only for now — backend enforcement deferred
- Tax always computed on post-discount subtotal via `calculateBillTotals()`
