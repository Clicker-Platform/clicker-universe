---
name: Plan 1 — Agnostic Booking Engine
description: Adds formConfig to ReservationSettings and generic assetId/assetModel fields to Booking. Standalone, no dependencies.
---

# Scope and Context

This skill implements Plan 1 of the DVP roadmap. It makes the reservation form configurable per business type so that vehicle-specific inputs (like license plate) are not hardcoded into the core booking schema.

See full spec: `TECH_SPEC.md` in `digital_vehicle_passport/`.

# Execution Steps

## 1. Update `ReservationSettings`

- Target: `lib/modules/reservation/types.ts`
- Add the `formConfig` optional object to `ReservationSettings`:
  - `requireAsset: boolean`
  - `assetLabel: string`
  - `assetPlaceholder: string`
  - `requireAssetModel: boolean`
  - `assetModelLabel: string`

## 2. Update `Booking`

- Target: `lib/modules/reservation/types.ts`
- Add two optional fields to `Booking`:
  - `assetId?: string`
  - `assetModel?: string`

## 3. Verify

- Run `npx tsc --noEmit` to confirm no type errors.
- Confirm existing booking documents and flows are unaffected (fields are additive and optional).
