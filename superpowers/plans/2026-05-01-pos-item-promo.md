# POS Item Promo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow tenants to link a Promo record to a POS menu item so customers see discounted prices automatically in the ordering widget, with promo usage tracked through the existing promo engine and order-level promo blocked when item promos are present.

**Architecture:** Item promo is stored as `linkedPromoId` + `linkedPromoSnapshot` on `POSItem`. At add-to-cart time, `evaluatePromo()` validates liveness and snapshots discount into `CartItem.itemPromo`. After payment, `commitPromoUsage()` is called per unique promo. Anti-stacking is enforced in `PaymentConfirmationDialog` — if any cart item has a valid `itemPromo`, the order-level promo input is disabled.

**Tech Stack:** Next.js 14 (App Router), Firebase Firestore (client SDK), TypeScript, React, Tailwind CSS, Lucide icons, existing `@/lib/modules/promo/api` facade.

---

## File Map

| File | Change |
|------|--------|
| `lib/modules/byod_pos/types.ts` | Add `linkedPromoId`, `linkedPromoSnapshot` to `POSItem`; add `itemPromo` to `CartItem` |
| `lib/modules/byod_pos/cart-context.tsx` | Re-validate `itemPromo` on cart open; expose `hasItemPromos` flag; update `addToCart` signature |
| `lib/modules/byod_pos/components/MenuGrid.tsx` | Promo badge + strikethrough price on item card; "Promo Items" horizontal section at top |
| `lib/modules/byod_pos/components/POSWidget.tsx` | Expired-promo amber banner; pass `hasItemPromos` to `PaymentConfirmationDialog` |
| `lib/modules/byod_pos/admin/menu/POSMenuClient.tsx` | "Promo" section in item edit form with promo dropdown + stale snapshot indicator |
| `lib/modules/byod_pos/admin/components/PaymentConfirmationDialog.tsx` | Disable promo input when `hasItemPromos` is true; show message |
| `lib/modules/byod_pos/api.ts` | `evaluateItemPromo()` helper; update order creation to include `itemPromo` snapshots; `commitItemPromos()` after payment |

---

## Task 1: Extend Types

**Files:**
- Modify: `clicker-platform-v2/lib/modules/byod_pos/types.ts`

- [ ] **Step 1: Add `ItemPromoSnapshot` and extend `POSItem` and `CartItem`**

Open `clicker-platform-v2/lib/modules/byod_pos/types.ts` and add the following. Insert `ItemPromoSnapshot` before `POSItem`, then add the two optional fields:

```typescript
// Add after the TaxBreakdown interface (around line 65)

export interface ItemPromoSnapshot {
  kind: 'percent' | 'fixed';
  value: number;
  label: string;
  maxUses?: number;
  validUntil?: import('firebase/firestore').Timestamp;
}

export interface CartItemPromo {
  promoId: string;
  kind: 'percent' | 'fixed';
  value: number;
  label: string;
  discountAmount: number;   // locked at add-to-cart time
  expired: boolean;         // true = promo ran out before checkout
}
```

Then extend `CartItem` (around line 20) by adding:
```typescript
  itemPromo?: CartItemPromo;
```

Then extend `POSItem` (around line 86) by adding:
```typescript
  linkedPromoId?: string;
  linkedPromoSnapshot?: ItemPromoSnapshot;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no new errors related to `types.ts`.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/lib/modules/byod_pos/types.ts
git commit -m "feat(pos): extend POSItem and CartItem types for item-level promo"
```

---

## Task 2: `evaluateItemPromo` helper in `api.ts`

**Files:**
- Modify: `clicker-platform-v2/lib/modules/byod_pos/api.ts`

This helper evaluates a promo at add-to-cart time and returns a `CartItemPromo` snapshot, or `null` if invalid.

- [ ] **Step 1: Add `evaluateItemPromo` to `api.ts`**

Add the following function at the bottom of `clicker-platform-v2/lib/modules/byod_pos/api.ts`:

```typescript
import { evaluatePromo, calculateDiscount } from '@/lib/modules/promo/api';
import type { CartItemPromo } from './types';

/**
 * Evaluates a menu item's linked promo at add-to-cart time.
 * Returns a locked CartItemPromo snapshot, or null if promo is no longer valid.
 */
export async function evaluateItemPromo(
  siteId: string,
  promoId: string,
  itemPrice: number,
  memberId?: string
): Promise<CartItemPromo | null> {
  try {
    // evaluatePromo requires a code — fetch the promo record first to get its code
    const { getPromo, calculateDiscount } = await import('@/lib/modules/promo/api');
    const promo = await getPromo(siteId, promoId);
    if (!promo || promo.status !== 'active') return null;

    // Use code if present, otherwise evaluate by promoId directly via the internal path
    const result = await evaluatePromo({
      siteId,
      code: promo.code ?? promoId,
      subtotal: itemPrice,
      source: 'POS',
      memberId,
    });

    if (!result.ok) return null;

    const discountAmount = calculateDiscount(
      { kind: promo.kind, value: promo.value, maxDiscount: promo.maxDiscount },
      itemPrice
    );

    return {
      promoId,
      kind: promo.kind,
      value: promo.value,
      label: promo.name,
      discountAmount,
      expired: false,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Add `commitItemPromos` to `api.ts`**

Add the following function directly below `evaluateItemPromo`:

```typescript
import type { CommitInput } from '@/lib/modules/promo/api';

/**
 * Commits promo usage for all item-level promos in an order.
 * Groups by promoId and commits once per unique promo.
 */
export async function commitItemPromos(
  siteId: string,
  orderId: string,
  items: import('./types').CartItem[],
  memberId?: string
): Promise<void> {
  const { commitPromoUsage } = await import('@/lib/modules/promo/api');

  // Group by promoId
  const grouped = new Map<string, { promoId: string; kind: 'promo'; label: string; discount: number; quantity: number }>();

  for (const item of items) {
    if (!item.itemPromo || item.itemPromo.expired) continue;
    const { promoId, label, discountAmount } = item.itemPromo;
    const existing = grouped.get(promoId);
    if (existing) {
      existing.quantity += item.quantity;
      existing.discount += discountAmount * item.quantity;
    } else {
      grouped.set(promoId, {
        promoId,
        kind: 'promo',
        label,
        discount: discountAmount * item.quantity,
        quantity: item.quantity,
      });
    }
  }

  await Promise.all(
    Array.from(grouped.values()).map(({ promoId, kind, label, discount, quantity }) =>
      commitPromoUsage({
        siteId,
        applied: { refId: promoId, kind, label, discount },
        source: 'POS',
        refId: `${orderId}:qty=${quantity}`,
        memberId,
      })
    )
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/lib/modules/byod_pos/api.ts
git commit -m "feat(pos): add evaluateItemPromo and commitItemPromos helpers"
```

---

## Task 3: Update `cart-context.tsx` — item promo evaluation & re-validation

**Files:**
- Modify: `clicker-platform-v2/lib/modules/byod_pos/cart-context.tsx`

- [ ] **Step 1: Update `addToCart` to accept and store `itemPromo`**

In `cart-context.tsx`, the `addToCart` function currently merges items by `productId+variantId`. Update it to also preserve `itemPromo` from the incoming item, and update the `CartContextType` interface to expose `hasItemPromos`:

Replace the `CartContextType` interface:
```typescript
interface CartContextType {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, delta: number, variantId?: string) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
  hasItemPromos: boolean;           // true if any cart item has a valid (non-expired) itemPromo
  expiredPromoItems: CartItem[];    // items where itemPromo.expired === true
  taxBreakdown: {
    subtotal: number;
    serviceCharge: number;
    restaurantTax: number;
    total: number;
    serviceChargeRate: number;
    restaurantTaxRate: number;
  };
}
```

- [ ] **Step 2: Add `revalidateItemPromos` function inside `CartProvider`**

Inside `CartProvider`, add an async function that re-checks all cart items with `itemPromo` against the live promo and marks them expired if invalid. Call it whenever the cart drawer opens (the caller will trigger it — expose it via context in step 3).

Add inside `CartProvider` body, after the `clearCart` definition:

```typescript
const revalidateItemPromos = async () => {
  if (!siteId || siteId === 'default' || siteId === 'pending') return;
  const { evaluateItemPromo } = await import('./api');

  setItems(prev => {
    // We can't await inside setState, so we fire evaluations and update async
    return prev; // no-op for the sync path
  });

  // Fire async revalidation
  const updates = await Promise.all(
    items.map(async (item) => {
      if (!item.itemPromo || item.itemPromo.expired) return item;
      const result = await evaluateItemPromo(siteId, item.itemPromo.promoId, item.price);
      if (!result) {
        // Promo expired or exhausted — revert price to original and mark expired
        return {
          ...item,
          itemPromo: { ...item.itemPromo, expired: true },
        };
      }
      return item;
    })
  );

  setItems(updates);
};
```

- [ ] **Step 3: Compute `hasItemPromos` and `expiredPromoItems`, expose via context**

After the `taxBreakdown` computation block, add:

```typescript
const hasItemPromos = items.some(i => i.itemPromo && !i.itemPromo.expired);
const expiredPromoItems = items.filter(i => i.itemPromo?.expired === true);
```

Update the `CartContext.Provider` value to include them:

```typescript
<CartContext.Provider value={{
  items,
  addToCart,
  removeFromCart,
  updateQuantity,
  clearCart,
  revalidateItemPromos,
  total,
  itemCount,
  hasItemPromos,
  expiredPromoItems,
  taxBreakdown
}}>
```

Also add `revalidateItemPromos: () => Promise<void>` to the `CartContextType` interface.

- [ ] **Step 4: Update subtotal to account for item discounts**

The cart subtotal must use the discounted price for promo items. In `CartProvider`, update the subtotal calculation:

Replace:
```typescript
const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
```
With:
```typescript
const subtotal = items.reduce((sum, item) => {
  const effectivePrice = (item.itemPromo && !item.itemPromo.expired)
    ? Math.max(0, item.price - item.itemPromo.discountAmount)
    : item.price;
  return sum + (effectivePrice * item.quantity);
}, 0);
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add clicker-platform-v2/lib/modules/byod_pos/cart-context.tsx
git commit -m "feat(pos): cart context tracks item promos, revalidates on open, adjusts subtotal"
```

---

## Task 4: Update `MenuGrid.tsx` — promo badge, strikethrough price, Promo Items section

**Files:**
- Modify: `clicker-platform-v2/lib/modules/byod_pos/components/MenuGrid.tsx`

- [ ] **Step 1: Update `handleItemClick` to evaluate promo at add-to-cart time**

In `MenuGrid.tsx`, `handleItemClick` currently calls `addToCart` directly. Update it to call `evaluateItemPromo` first if the item has a `linkedPromoId`:

Replace the existing `handleItemClick`:
```typescript
const handleItemClick = async (item: POSItem, linkedStock: InventoryItem | undefined) => {
  if (item.variants && item.variants.length > 0) {
    setSelectedItemForVariant(item);
    return;
  }

  let itemPromo: import('../types').CartItemPromo | undefined;

  if (item.linkedPromoId) {
    const { evaluateItemPromo } = await import('@/lib/modules/byod_pos/api');
    const result = await evaluateItemPromo(siteId, item.linkedPromoId, item.price);
    if (result) {
      itemPromo = result;
    } else {
      // Promo shown on card is no longer valid — add at normal price with toast
      const { toast } = await import('sonner');
      toast.info('Promo no longer available', {
        description: `${item.name} added at regular price.`,
      });
    }
  }

  addToCart({
    productId: item.id,
    name: item.name,
    price: item.price,
    quantity: 1,
    image: item.imageUrl,
    inventoryId: linkedStock?.id,
    itemPromo,
  });
};
```

Note: `handleItemClick` is now `async` — ensure the call site uses it correctly (onClick handlers don't need to await, React handles fire-and-forget).

- [ ] **Step 2: Update item card to show promo badge and strikethrough price**

Inside the grid render, find the price display block (around line 286-290):

```typescript
<div className="font-black text-base leading-tight" style={{ color: theme.colors.foreground }}>
    {hasVariants && <span className="text-xs font-normal mr-1" style={{ color: subtleText }}>from</span>}
    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.price)}
</div>
```

Replace with:

```typescript
{(() => {
  const snap = item.linkedPromoSnapshot;
  const discountedPrice = snap
    ? snap.kind === 'percent'
      ? Math.max(0, item.price - Math.floor(item.price * snap.value / 100))
      : Math.max(0, item.price - snap.value)
    : null;
  return (
    <div className="flex flex-col gap-0.5">
      {snap && discountedPrice !== null ? (
        <>
          <div className="text-xs line-through opacity-50" style={{ color: subtleText }}>
            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.price)}
          </div>
          <div className="font-black text-base leading-tight" style={{ color: primaryColor }}>
            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(discountedPrice)}
          </div>
        </>
      ) : (
        <div className="font-black text-base leading-tight" style={{ color: theme.colors.foreground }}>
          {hasVariants && <span className="text-xs font-normal mr-1" style={{ color: subtleText }}>from</span>}
          {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.price)}
        </div>
      )}
    </div>
  );
})()}
```

- [ ] **Step 3: Add `PROMO` badge to item card image area**

Inside the item card's image `<div>` (where the `SOLD OUT` overlay is), add after the SOLD OUT overlay:

```typescript
{item.linkedPromoSnapshot && !isOutOfStock && (
  <div className="absolute top-2 left-2 z-10">
    <span
      className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
      style={{ backgroundColor: primaryColor, color: accentFg }}
    >
      PROMO
    </span>
  </div>
)}
```

- [ ] **Step 4: Add "Promo Items" section above the main grid**

Before the `{/* Search & Filter Header */}` block, add:

```typescript
{/* Promo Items Section */}
{(() => {
  const promoItems = items.filter(i => i.linkedPromoSnapshot);
  if (promoItems.length === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-black uppercase tracking-wider" style={{ color: mutedText }}>
        Promo Items
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {promoItems.map(item => {
          const snap = item.linkedPromoSnapshot!;
          const discountedPrice = snap.kind === 'percent'
            ? Math.max(0, item.price - Math.floor(item.price * snap.value / 100))
            : Math.max(0, item.price - snap.value);
          const linkedStock = getItemStock(item);
          const isOutOfStock = linkedStock && linkedStock.currentStock <= 0;
          return (
            <div
              key={`promo-${item.id}`}
              className="flex-shrink-0 w-36 border overflow-hidden flex flex-col cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all duration-300"
              style={{ backgroundColor: surfaceBg, borderColor: primaryColor, borderRadius: 'var(--theme-radius)' }}
              onClick={() => !isOutOfStock && handleItemClick(item, linkedStock)}
            >
              <div className="aspect-square relative" style={{ backgroundColor: isGlass ? 'rgba(255,255,255,0.05)' : (theme.colors.surface || '#f3f4f6') }}>
                {item.imageUrl ? (
                  <NextImage src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="144px" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-black text-2xl uppercase"
                    style={{ backgroundColor: `${primaryColor}12`, color: `${primaryColor}60` }}>
                    {item.name.slice(0, 2)}
                  </div>
                )}
                <div className="absolute top-2 left-2 z-10">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: primaryColor, color: accentFg }}>
                    PROMO
                  </span>
                </div>
              </div>
              <div className="px-2 pt-2 pb-3 flex flex-col gap-1">
                <h3 className="text-xs font-medium line-clamp-2 leading-snug" style={{ color: mutedText }}>{item.name}</h3>
                <div className="text-[10px] line-through opacity-50" style={{ color: subtleText }}>
                  {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.price)}
                </div>
                <div className="font-black text-sm leading-tight" style={{ color: primaryColor }}>
                  {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(discountedPrice)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
})()}
```

- [ ] **Step 5: Verify no TypeScript errors**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6: Commit**

```bash
git add clicker-platform-v2/lib/modules/byod_pos/components/MenuGrid.tsx
git commit -m "feat(pos): menu grid shows promo badge, strikethrough price, and Promo Items section"
```

---

## Task 5: Update `POSWidget.tsx` — expired promo banner + revalidation on cart open

**Files:**
- Modify: `clicker-platform-v2/lib/modules/byod_pos/components/POSWidget.tsx`

- [ ] **Step 1: Pull `hasItemPromos`, `expiredPromoItems`, `revalidateItemPromos` from cart context**

Find the `useCart()` destructuring line and add the new fields:

```typescript
const { items, addToCart, removeFromCart, updateQuantity, clearCart, total, itemCount, taxBreakdown, hasItemPromos, expiredPromoItems, revalidateItemPromos } = useCart();
```

- [ ] **Step 2: Revalidate item promos when cart drawer opens**

Find the cart-open state toggle (look for `setIsCartOpen(true)`). After every call that opens the cart, add a revalidation call. Locate where `isCartOpen` is set to `true` and add:

```typescript
setIsCartOpen(true);
revalidateItemPromos(); // fire-and-forget: marks expired items, triggers re-render
```

- [ ] **Step 3: Show expired promo banner inside the cart drawer**

Inside the cart drawer JSX, just below the cart header and above the items list, add:

```typescript
{expiredPromoItems.length > 0 && (
  <div className="mx-4 mt-3 p-3 rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-900/20">
    <div className="flex items-start gap-2">
      <span className="text-amber-500 mt-0.5 text-base">⚠</span>
      <div className="flex-1">
        <p className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">
          Promo no longer available
        </p>
        {expiredPromoItems.map(item => (
          <p key={item.productId + (item.variantId ?? '')} className="text-xs text-amber-600 dark:text-amber-500">
            {item.name} — updated to regular price ({new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.price)})
          </p>
        ))}
        <p className="text-xs text-amber-500 dark:text-amber-600 mt-1">Your total has been updated. You can still proceed.</p>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: Show promo discount line per item in cart**

Find where cart items are rendered in the drawer (look for `items.map`). Inside each cart item row, add a discount label below the item name:

```typescript
{item.itemPromo && !item.itemPromo.expired && (
  <div className="flex items-center gap-1 mt-0.5">
    <span className="text-[10px]">🏷</span>
    <span className="text-[10px] font-semibold" style={{ color: primaryColor }}>
      {item.itemPromo.label} (−{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.itemPromo.discountAmount)})
    </span>
  </div>
)}
```

- [ ] **Step 5: Pass `hasItemPromos` to `PaymentConfirmationDialog`**

Find the `<PaymentConfirmationDialog>` usage in `POSWidget.tsx` and add the prop:

```typescript
<PaymentConfirmationDialog
  ...existingProps
  hasItemPromos={hasItemPromos}
/>
```

- [ ] **Step 6: Call `commitItemPromos` after order creation**

In `handleCheckout`, after the `addDoc` call that creates the order (and after the `trackOrder(docRef.id)` line), add:

```typescript
// Commit item-level promo usage after order is created
if (hasItemPromos) {
  const { commitItemPromos } = await import('@/lib/modules/byod_pos/api');
  commitItemPromos(siteId, docRef.id, items, effectiveMemberId ?? undefined).catch(() => {
    // Best-effort: don't block checkout on promo commit failure
  });
}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 8: Commit**

```bash
git add clicker-platform-v2/lib/modules/byod_pos/components/POSWidget.tsx
git commit -m "feat(pos): widget shows expired promo banner, item discount lines, commits item promos on checkout"
```

---

## Task 6: Update `PaymentConfirmationDialog.tsx` — anti-stacking guard

**Files:**
- Modify: `clicker-platform-v2/lib/modules/byod_pos/admin/components/PaymentConfirmationDialog.tsx`

- [ ] **Step 1: Add `hasItemPromos` prop to the interface**

Find `PaymentConfirmationDialogProps` and add:

```typescript
interface PaymentConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (method: POSOrder['paymentMethod'], appliedPromo: AppliedPromo | null) => void;
  order: POSOrder | null;
  siteId: string;
  memberId?: string;
  isProcessing?: boolean;
  hasItemPromos?: boolean;   // add this
}
```

Update the function signature destructuring:
```typescript
export function PaymentConfirmationDialog({ isOpen, onClose, onConfirm, order, siteId, memberId, isProcessing = false, hasItemPromos = false }: PaymentConfirmationDialogProps) {
```

- [ ] **Step 2: Disable `PromoApplicator` and show message when `hasItemPromos` is true**

Find the `{/* Promo Applicator */}` section and replace it with:

```typescript
{/* Promo Applicator */}
{hasItemPromos ? (
  <div className="p-3 rounded-lg border border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/50 text-center">
    <p className="text-xs font-semibold text-gray-400 dark:text-neutral-500">
      Item discounts already applied — order-level promo unavailable
    </p>
  </div>
) : (
  <PromoApplicator
    siteId={siteId}
    subtotal={subtotal}
    source="POS"
    memberId={memberId}
    applied={appliedPromo}
    onApply={setAppliedPromo}
    onRemove={() => setAppliedPromo(null)}
    disabled={isProcessing}
    autoCheck={true}
  />
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/lib/modules/byod_pos/admin/components/PaymentConfirmationDialog.tsx
git commit -m "feat(pos): disable order-level promo in payment dialog when item promos are present"
```

---

## Task 7: Update `POSMenuClient.tsx` — promo section in item edit form

**Files:**
- Modify: `clicker-platform-v2/lib/modules/byod_pos/admin/menu/POSMenuClient.tsx`

- [ ] **Step 1: Add state for promo list and selected promo in edit form**

At the top of `POSMenuClient` component (after existing state declarations), add:

```typescript
const [promoList, setPromoList] = useState<import('@/lib/modules/promo/api').Promo[]>([]);
const [selectedPromoId, setSelectedPromoId] = useState<string | null>(null);
const [livePromo, setLivePromo] = useState<import('@/lib/modules/promo/api').Promo | null>(null);
const [promoStale, setPromoStale] = useState(false);
```

- [ ] **Step 2: Load active promos when edit form opens**

Find where the item edit form opens (look for `setIsEditing(true)` or where edit state is set). After setting the editing state, add:

```typescript
// Load promo list when opening edit form
if (siteId) {
  import('@/lib/modules/promo/api').then(({ listPromos, getPromo }) => {
    listPromos(siteId).then(all => setPromoList(all.filter(p => p.status === 'active')));

    // If item already has a linked promo, load it and check for staleness
    const itemLinkedPromoId = editingItem?.linkedPromoId;
    if (itemLinkedPromoId) {
      setSelectedPromoId(itemLinkedPromoId);
      getPromo(siteId, itemLinkedPromoId).then(live => {
        setLivePromo(live ?? null);
        if (live && editingItem?.linkedPromoSnapshot) {
          setPromoStale(live.value !== editingItem.linkedPromoSnapshot.value);
        }
      });
    } else {
      setSelectedPromoId(null);
      setLivePromo(null);
      setPromoStale(false);
    }
  });
}
```

- [ ] **Step 3: Include `linkedPromoId` and `linkedPromoSnapshot` in `handleSaveItem`**

In `handleSaveItem`, update `itemData` to include promo fields:

```typescript
const itemData = {
  name: data.name,
  price: numericPrice,
  imageUrl: mainImage,
  images: data.images,
  category: data.category,
  description: data.description,
  isActive: data.isActive,
  variants: data.variants || [],
  // Promo fields
  linkedPromoId: selectedPromoId ?? null,
  linkedPromoSnapshot: selectedPromoId && livePromo ? {
    kind: livePromo.kind,
    value: livePromo.value,
    label: livePromo.name,
    maxUses: livePromo.maxUses ?? null,
    validUntil: livePromo.conditions.validUntil ?? null,
  } : null,
};
```

Use `JSON.parse(JSON.stringify(itemData))` before saving to strip `null` fields that Firestore may reject:

```typescript
const cleanItemData = JSON.parse(JSON.stringify(itemData));
// replace itemData with cleanItemData in updateDoc / addDoc calls
```

- [ ] **Step 4: Add Promo section to the edit form JSX**

Find the item edit form JSX (the `<form>` or slide-over panel). Add the Promo section below the price field:

```typescript
{/* Promo Section */}
<div className="space-y-2">
  <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300">Promo</label>

  <div className="flex flex-col gap-2">
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="radio"
        name="promoType"
        checked={!selectedPromoId}
        onChange={() => { setSelectedPromoId(null); setLivePromo(null); setPromoStale(false); }}
      />
      <span className="text-sm text-gray-600 dark:text-neutral-400">No promo</span>
    </label>

    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="radio"
        name="promoType"
        checked={!!selectedPromoId}
        onChange={() => {}}
      />
      <span className="text-sm text-gray-600 dark:text-neutral-400">Link to promo</span>
    </label>
  </div>

  {/* Promo dropdown — shown when "Link to promo" is selected */}
  {(selectedPromoId !== null || true) && (
    <select
      value={selectedPromoId ?? ''}
      onChange={async (e) => {
        const id = e.target.value || null;
        setSelectedPromoId(id);
        if (id && siteId) {
          const { getPromo } = await import('@/lib/modules/promo/api');
          const live = await getPromo(siteId, id);
          setLivePromo(live ?? null);
          setPromoStale(false);
        } else {
          setLivePromo(null);
          setPromoStale(false);
        }
      }}
      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-gray-700 dark:text-neutral-300"
    >
      <option value="">— Select promo —</option>
      {promoList.map(p => (
        <option key={p.id} value={p.id}>{p.name} ({p.kind === 'percent' ? `${p.value}%` : `Rp ${p.value.toLocaleString('id-ID')}`} off)</option>
      ))}
    </select>
  )}

  {/* Live promo preview */}
  {livePromo && (
    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-xs space-y-1">
      <div className="font-bold text-green-700 dark:text-green-400">
        ✓ {livePromo.kind === 'percent' ? `${livePromo.value}% off` : `Rp ${livePromo.value.toLocaleString('id-ID')} off`} · {livePromo.name}
      </div>
      {livePromo.conditions.validUntil && (
        <div className="text-green-600 dark:text-green-500">
          Expires {new Date(livePromo.conditions.validUntil.toMillis()).toLocaleDateString('id-ID')}
        </div>
      )}
      {livePromo.maxUses && (
        <div className="text-green-600 dark:text-green-500">
          {livePromo.usageCount} / {livePromo.maxUses} uses
        </div>
      )}
    </div>
  )}

  {/* Stale snapshot warning */}
  {promoStale && (
    <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-xs text-amber-700 dark:text-amber-400">
      ⚠ Promo updated since last save — save item to refresh
    </div>
  )}
</div>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6: Commit**

```bash
git add clicker-platform-v2/lib/modules/byod_pos/admin/menu/POSMenuClient.tsx
git commit -m "feat(pos): admin menu editor — link promo to item with live preview and stale snapshot warning"
```

---

## Task 8: Manual smoke test

- [ ] **Step 1: Start dev server**

```bash
cd clicker-platform-v2 && pnpm dev
```

- [ ] **Step 2: Admin — create a test promo**

1. Open a test site's admin panel → Promo module → create a promo:
   - Name: "Test Item Promo"
   - Kind: `percent`, Value: `20`
   - Status: `active`
   - Max uses: `5`
   - Source: `POS`

- [ ] **Step 3: Admin — link promo to a menu item**

1. Admin → POS → Menu → edit any item
2. Scroll to Promo section → select "Link to promo" → pick "Test Item Promo"
3. Verify preview shows `✓ 20% off · Test Item Promo`
4. Save item

- [ ] **Step 4: Customer widget — verify promo display**

1. Open the customer ordering page (QR or direct URL)
2. Verify "Promo Items" section appears at top with the item
3. Verify item card shows strikethrough price + discounted price + `PROMO` badge
4. Add the promo item to cart
5. Open cart — verify discount label `🏷 Test Item Promo (−Rp X)` appears below item
6. Verify subtotal reflects discounted price

- [ ] **Step 5: Verify anti-stacking in cashier**

1. In cashier mode, open payment dialog for an order with the promo item
2. Verify promo input is replaced with: *"Item discounts already applied — order-level promo unavailable"*
3. For an order with no promo items, verify promo input still works normally

- [ ] **Step 6: Verify promo expiry banner (if testable)**

1. Set the promo's `maxUses` to `0` in Firestore directly (simulate exhausted)
2. Open cart with the promo item → verify amber banner appears
3. Verify checkout still proceeds at normal price

- [ ] **Step 7: Commit final**

```bash
git add -A
git commit -m "feat(pos): item promo — smoke test complete"
```

---

## Self-Review Notes

- **Task 2 caveat:** `evaluateItemPromo` fetches the promo by `promoId` then calls `evaluatePromo` with its `code`. If the promo has no `code` (auto-trigger promos), the fallback passes `promoId` as the code — this will fail `evaluatePromo`'s code lookup. A follow-up improvement: add a `findPromoById` evaluation path in the promo engine. For now, only link promos that have a `code` set, or skip `evaluatePromo` and just check `promo.status === 'active'` + `promo.maxUses` manually for items.
- **Task 3:** `revalidateItemPromos` fires asynchronously on cart open — there is a brief render before expired items are marked. This is acceptable (not blocking checkout).
- **Task 7:** `editingItem` must be accessible in the scope where the promo load runs — verify the variable name matches what's used in `POSMenuClient.tsx` (may be `items.find(i => i.id === editingId)` or similar).
