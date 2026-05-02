# Promo Engine — Critical Test Scenarios

Manual test scenarios to verify the 4 critical fixes. Run these in the browser against a real site.

**Prerequisites:**
- Promo module enabled
- At least one active member with loyalty points
- POS module enabled with at least one product

---

## Scenario 1 — Promo code creates successfully (no Firestore error)

**Tests:** `undefined` field rejection fix in `createPromo`

**Steps:**
1. Go to Promotions → New Promo
2. Fill in only the required fields:
   - Name: `Test Promo`
   - Kind: Percent
   - Value: `10`
   - Trigger: Code
   - Code: `TEST10`
   - Audience: Public
3. Leave all optional fields blank (Max Discount, Description, Min Subtotal, Valid From, Valid Until, Max Uses, Per Member Limit)
4. Click **Create Promo**

**Expected:** Promo is created successfully, appears in the list. No error shown.

**Failure sign:** Red error banner — `Function setDoc() called with invalid data. Unsupported field value: undefined`

---

## Scenario 2 — Promo code usage count increments on redemption

**Tests:** Critical #1 — `usageCount` increments correctly for both promo and voucher paths

### 2a — Direct promo code

**Steps:**
1. Create a promo: `COUNTER10`, 10% off, trigger=Code, Max Uses: `5`
2. Note the current usage count (should be 0)
3. Go to POS → open an order → click Pay
4. Enter code `COUNTER10` → Apply → Confirm Payment
5. Go back to Promotions list

**Expected:** Promo shows `1 / 5 uses`

### 2b — Voucher code (parent promo also increments)

**Steps:**
1. Create a promo: `VOUCHTEST`, 20% off, trigger=Code, Max Uses: `3`
2. Go to Promotions → Vouchers → Grant Voucher
3. Select `VOUCHTEST`, enter a member ID → Grant
4. Note the voucher code (e.g. `VCH-XXXX-XXXX`)
5. Note `VOUCHTEST` usage count (should be 0)
6. Go to POS → open an order → click Pay
7. Enter the voucher code → Apply → Confirm Payment
8. Check both the Vouchers list AND the Promotions list

**Expected:**
- Voucher status = `Used`
- `VOUCHTEST` usage count = `1 / 3` (parent promo incremented)

**Failure sign:** Voucher is marked used but parent promo still shows `0 uses`

---

## Scenario 3 — Applied promo is persisted on the order

**Tests:** Critical #3 — `appliedPromo` saved to Firestore order document

**Steps:**
1. Create promo `PERSIST20`, 20% off, trigger=Code
2. Go to POS → open an order → click Pay
3. Enter `PERSIST20` → Apply → Confirm Payment
4. Open Firebase Console → `sites/{siteId}/modules/pos/orders/{orderId}`
5. Inspect the order document

**Expected:** Order document has an `appliedPromo` field:
```
appliedPromo: {
  refId: "...",
  kind: "promo",
  label: "PERSIST20",
  discount: ...
}
```

**Failure sign:** `appliedPromo` field is absent from the order document

---

## Scenario 4 — Promo usage reverses when order is cancelled

**Tests:** Critical #2 — `reversePromoUsage` called on POS order cancel

**Steps:**
1. Create promo `CANCEL10`, 10% off, trigger=Code, Max Uses: `5`
2. Note usage count = 0
3. Go to POS → open an order → click Pay
4. Enter `CANCEL10` → Apply → Confirm Payment
5. Verify usage count = 1 (from Scenario 2)
6. Find the paid order in POS history
7. Cancel the order

**Expected:** `CANCEL10` usage count goes back to `0`

**Failure sign:** Usage count stays at `1` after cancellation

> **Note:** Cancel after payment may not be available depending on POS settings. If orders are deleted on cancel, check that the reversal logic fires — add a console.log temporarily if needed.

---

## Scenario 5 — Points are deducted when member claims a voucher

**Tests:** Critical #4 — `claimVoucher` deducts loyalty points

**Steps:**
1. Create a claimable promo: `REWARD`, 50% off, trigger=Claim, Cost in Points: `100`
2. Find a member with at least 100 points — note their current points balance
3. Log in as that member (or use admin grant as proxy)
4. Go to member dashboard → My Rewards → click **Redeem** on `REWARD`
5. Check the member's points balance in the admin Membership panel

**Expected:** Member's points balance decreased by 100

**Failure sign:** Voucher is issued but points balance is unchanged

---

## Scenario 6 — Voucher is personal (wrong member cannot use it)

**Tests:** Evaluator audience_mismatch for vouchers

**Steps:**
1. Grant a voucher to Member A (note the voucher code)
2. Go to POS — do NOT identify a member, or identify as Member B
3. Enter the voucher code → Apply

**Expected:** Error — "This voucher belongs to another member" (or similar `audience_mismatch` message)

**Failure sign:** Discount applies even though wrong member

---

## Scenario 7 — Promo respects Max Uses cap

**Tests:** `usage_exhausted` evaluation failure

**Steps:**
1. Create promo `CAPPED`, 10% off, trigger=Code, Max Uses: `2`
2. Redeem it twice (two separate POS payments)
3. Try to redeem a third time

**Expected:** Error — "This promo has reached its usage limit" (or similar)

**Failure sign:** Third redemption succeeds

---

## Pass Criteria Summary

| # | Scenario | Pass condition |
|---|---|---|
| 1 | Create promo with optional fields blank | No Firestore error |
| 2a | Promo code redeemed | `usageCount` increments |
| 2b | Voucher redeemed | Parent promo `usageCount` also increments |
| 3 | Order paid with promo | `appliedPromo` field saved on order doc |
| 4 | Order cancelled after promo applied | `usageCount` decrements back |
| 5 | Member redeems points for voucher | Points balance decreases |
| 6 | Wrong member uses voucher | Rejected with error |
| 7 | Promo exceeds max uses | Rejected with error |
