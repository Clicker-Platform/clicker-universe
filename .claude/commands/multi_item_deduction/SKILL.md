---
name: Plan 2 — Multi-Item Inventory Deduction
description: Adds ConsumedItem interface and consumedItems array to ServiceRecord. Refactors approveRecord to loop and deduct per-item quantities. Standalone, no dependencies.
---

# Scope and Context

This skill implements Plan 2 of the DVP roadmap. It allows a service record to track multiple consumed inventory products with individual quantities, replacing the legacy single `inventoryItemId` field.

> **UI Rule:** The consumed items UI must be simple — add, remove, quantity only. No POS screen.

See full spec: `TECH_SPEC.md` in `digital_vehicle_passport/`.

# Execution Steps

## 1. Add `ConsumedItem` Interface

- Target: `lib/modules/service-records/types.ts`
- Add the interface above the `ServiceRecord` declaration:
  - `inventoryItemId: string`
  - `name: string` (denormalized)
  - `quantity: number`

## 2. Update `ServiceRecord`

- Target: `lib/modules/service-records/types.ts`
- Add `consumedItems?: ConsumedItem[]` to `ServiceRecord`.
- **Do NOT remove** `productUsed?: string` — it is a legacy escape hatch.
- `inventoryItemId` on `ServiceRecord` is deprecated but leave it in place (backward compat).

## 3. Refactor `approveRecord`

- Target: `lib/modules/service-records/api.ts`
- Find the inventory deduction block (search for `inventoryItemId` or `Step 6`).
- Replace the single `updateStock` call with a loop over `record.consumedItems`.
- Use `-Math.abs(item.quantity)` as the deduction amount per item.
- Keep the try/catch — inventory errors must not roll back record approval.
- Set `inventoryDeducted: true` only after all items in the loop are processed.

## 4. Verify

- Run `npx tsc --noEmit` to confirm no type errors.
- Confirm `approveRecord` skips deduction gracefully if `consumedItems` is empty or undefined.
