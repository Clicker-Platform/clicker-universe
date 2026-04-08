---
name: Plan 3 — Digital Vehicle Passport (DVP)
description: Updates Vehicle schema to use carCatalogId FK, and aligns both booking flows (reservation and walk-in) to enforce structured vehicle registration. Requires Plans 1 and 2 to be completed first.
---

# Scope and Context

This skill implements Plan 3 of the DVP roadmap. It is the final layer that ties together the agnostic booking inputs and multi-item deductions into a proper vehicle history tracking system.

**Prerequisites:**
- Plan 1 (Agnostic Booking) must be merged first.
- Plan 2 (Multi-Item Deduction) must be merged first.

See full spec: `TECH_SPEC.md` in `digital_vehicle_passport/`.

# Execution Steps

## 1. Update `Vehicle` Schema

- Target: `lib/modules/service-records/types.ts`
- Remove deprecated fields: `make?: string`, `model?: string`, `type?: VehicleType`.
- Add foreign key: `carCatalogId?: string` pointing to a `CarCatalogEntry` document.
- Keep `carCatalogId` optional to preserve backward compatibility for existing records.

## 2. Align Flow 1 — Reservation → Service Record

- Target: `BookingDetailPanel.tsx` (`handleStartServiceRecord` or equivalent).
- When admin starts a service record from a booking:
  1. Use `booking.assetId` to look up an existing `Vehicle` by `plateNumber`.
  2. If found: pre-fill the service record with the existing `Vehicle`.
  3. If not found: pre-fill `plateNumber` from `assetId`. Show a vehicle registration form that uses a `CarCatalogEntry` dropdown for `carCatalogId`. Do **not** accept free-text for make/model/type.

## 3. Align Flow 2 — Walk-In Dashboard

- Target: Walk-in "New Service Record" admin form.
- When admin types a new license plate (no match found):
  - Show vehicle registration form.
  - Make/model selection must use a `CarCatalogEntry` dropdown.
  - No free-text brand/model fields allowed on new registrations.

## 4. Verify

- Run `npx tsc --noEmit` to confirm no type errors.
- Verify new `Vehicle` records always include `carCatalogId`.
- Verify old `Vehicle` records without `carCatalogId` do not throw errors at runtime.
- Verify that `booking.assetId` correctly maps to a plate lookup before triggering new vehicle registration.
