---
name: promo_integration
description: >
  Step-by-step guide for integrating the Promo Engine into a new billing module.
  Use this skill when adding promo/discount support to a module that handles payments,
  bookings, or invoices. Trigger on: "add promo to", "integrate promo", "promo support",
  "wire promo into", "PromoApplicator".
---

# /promo_integration — Add Promo Support to a Billing Module

This skill walks through wiring `<PromoApplicator>` into any module that has a payment or billing step.

**Prerequisite:** The `/promo` skill covers the module architecture. Read it first if you need context.

---

## Step 1 — Add the source (if new)

If your module's source doesn't exist in `PromoSource` yet, add it:

**`lib/modules/promo/types.ts`:**
```ts
export type PromoSource = 'POS' | 'RESERVATION' | 'SERVICE' | 'YOUR_SOURCE' | 'OTHER';
```

**`lib/modules/promo/sources.ts`:**
```ts
YOUR_SOURCE: { label: 'Your Module', icon: 'icon-name', moduleKey: 'your_module_key' },
```

---

## Step 2 — Import in the payment component

```ts
import { PromoApplicator } from '@/lib/modules/promo/components/PromoApplicator';
import { commitPromoUsage, reversePromoUsage } from '@/lib/modules/promo/api';
import type { AppliedPromo } from '@/lib/modules/promo/api';
```

---

## Step 3 — Add state

```ts
const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
```

---

## Step 4 — Render PromoApplicator

Place this above the total display in your payment step:

```tsx
<PromoApplicator
  siteId={siteId}
  subtotal={subtotal}
  source="YOUR_SOURCE"
  memberId={memberId}      // pass undefined for guests
  applied={appliedPromo}
  onApply={setAppliedPromo}
  onRemove={() => setAppliedPromo(null)}
  disabled={isProcessing}
  autoCheck={false}        // set true to silently auto-apply on mount
/>
```

---

## Step 5 — Adjust total display

```tsx
const discount = appliedPromo?.discount ?? 0;
const total = Math.max(0, subtotal - discount);

// In your UI:
<div>Subtotal: {formatCurrency(subtotal)}</div>
{appliedPromo && (
  <div>Discount ({appliedPromo.label}): -{formatCurrency(discount)}</div>
)}
<div>Total: {formatCurrency(total)}</div>
```

---

## Step 6 — Commit after success

Call **after** the payment/booking write succeeds:

```ts
async function handleConfirm() {
  try {
    const result = await yourPaymentCall(total); // use discounted total
    
    // Commit promo usage AFTER payment succeeds
    if (appliedPromo) {
      await commitPromoUsage({
        siteId,
        applied: appliedPromo,
        source: 'YOUR_SOURCE',
        refId: result.id,   // order/booking/service record ID
        memberId,
      }).catch(err => console.error('promo commit failed (non-fatal):', err));
    }
    
    onSuccess(result);
  } catch (err) {
    // Payment failed — promo was never committed, nothing to reverse
    setError(err.message);
  }
}
```

> **Note on reversePromoUsage:** Only needed if you call `commitPromoUsage` before payment (unusual). In the pattern above, payment throws before commit, so no reversal is needed.

---

## Full Copy-Paste Template

```tsx
'use client';
import { useState } from 'react';
import { PromoApplicator } from '@/lib/modules/promo/components/PromoApplicator';
import { commitPromoUsage } from '@/lib/modules/promo/api';
import type { AppliedPromo } from '@/lib/modules/promo/api';

// Inside your payment component:
const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
const [isProcessing, setIsProcessing] = useState(false);

const discount = appliedPromo?.discount ?? 0;
const total = Math.max(0, subtotal - discount);

async function handleConfirm() {
  setIsProcessing(true);
  try {
    const result = await yourPaymentOrBookingCall({ total });
    if (appliedPromo) {
      await commitPromoUsage({
        siteId, applied: appliedPromo, source: 'YOUR_SOURCE',
        refId: result.id, memberId,
      }).catch(console.error);
    }
    onSuccess();
  } catch (err) {
    setError(String(err));
  } finally {
    setIsProcessing(false);
  }
}

// In JSX, above the total row:
<PromoApplicator
  siteId={siteId} subtotal={subtotal} source="YOUR_SOURCE"
  memberId={memberId} applied={appliedPromo}
  onApply={setAppliedPromo} onRemove={() => setAppliedPromo(null)}
  disabled={isProcessing}
/>

{appliedPromo && <div>Discount: -{discount}</div>}
<div>Total: {total}</div>
```

---

## Testing Checklist

- [ ] Valid code applies and shows discount
- [ ] Invalid/expired code shows error message
- [ ] Remove (×) button clears the promo
- [ ] Total updates correctly when promo is applied/removed
- [ ] `commitPromoUsage` is called after successful payment (check Firestore `usageCount` increments)
- [ ] Voucher status changes to `used` after redemption
- [ ] Guest checkout works when `memberId` is undefined
- [ ] `disabled` prop locks the input during processing
- [ ] Auto-apply fires on mount when `autoCheck=true`
