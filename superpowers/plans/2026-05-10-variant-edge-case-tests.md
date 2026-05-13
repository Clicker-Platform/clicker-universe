# Variant Order Flow — Edge Case Test Pass

**Date:** 2026-05-10
**Priority:** Low (verification, not new code)
**Estimated effort:** 30–45 min manual testing on staging

## Goal

The happy path (1 Small + 1 Large of one item) works in production. Before declaring variants production-ready, run a focused test pass against the edge cases the audit didn't cover.

## Test cases

For each, record: did it work, did it crash, was the data correct?

### Cart manipulation
1. **Add same variant twice** → cart shows quantity 2, not two separate lines
2. **Add Small, then add Large of same item** → cart shows 2 separate lines (deduped by `(productId, variantId)`)
3. **Increment quantity of one variant** → only that variant qty changes
4. **Remove one variant from a multi-variant cart** → other variant lines unaffected
5. **Clear cart** → all variant lines removed

### Order lifecycle
6. **Variant order through KDS pending → preparing → ready → completed** → ticket retains variant name at every stage
7. **Cancel a variant order at "preparing"** → stock refunded to correct variant inventory item (if linked)
8. **Cancel at "pending"** → no stock movement (it never deducted)
9. **Variant order with member attached** → loyalty points awarded based on actual paid total, including correct variant prices

### Tax calculation
10. **Fast-checkout variant order with PB1 tax enabled** → `taxBreakdown` stored on order, math correct (subtotal uses variant prices)
11. **Open-bill: order Small, then later add Large to same bill** → bill aggregation sums correctly, single tax calculation at close

### Inventory edge cases
12. **Variant linked to inventory** → stock deducts from variant's `inventoryId`, NOT the base item's
13. **Variant with NO inventory link** → no stock movement, no error to user (current behavior — this is the audit gap; document what actually happens)
14. **Two different variants linked to the same inventory item** (e.g. both sizes share one stock pool) → both deductions hit the same item

### Reporting (the known gap)
15. **Run report after variant orders** — confirm Product Performance collapses variants under one row (audit confirms this)
16. **Detailed Orders** — confirm variant name is missing from line item display (audit gap; will be fixed alongside reporting work)

## Output

Write findings inline in this doc as you test. Bug findings go to a `notes/` file or get filed as new plans.

## What to do with surprises

- Crash → file as a bug plan immediately
- Wrong data → file as a bug plan immediately
- Confusing UX but functional → note it, don't fix mid-test
