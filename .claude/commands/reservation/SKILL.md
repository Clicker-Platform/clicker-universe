---
name: reservation
description: >
  Work with the Clicker Platform Reservation & Booking Module.
  Use this skill whenever modifying services, booking flows, schedule availability,
  or staff assignment for appointments.
  Trigger on: "add a booking", "reservation system", "service availability",
  "appointment booking", "lib/modules/reservation".
---

# /reservation — Reservation & Booking Module

You are working on the **Clicker Platform Reservation Module**. This system allows tenants to offer bookable services, manage staff schedules, and handle customer appointments.

This skill is invoked as `/reservation [action]`.

---

## 1. Architecture Overview

- **Storage Location:** All data is stored under the tenant's document: `sites/{siteId}/modules/reservation/`.
- **Primary Collections:**
  - `services`: The bookable offerings (e.g., "Haircut", "Consultation", duration, price).
  - `bookings`: The actual appointments consisting of a customer, a service, start/end times, and status.
  - `slots`: The tenant's schedule configuration (e.g., open hours per day).

---

## 2. Booking Lifecycle and Integration

Bookings move through statuses: `pending` -> `confirmed` -> `completed` (or `cancelled`).

### Loyalty Integration

The Reservation system is tightly integrated with the **Membership / Loyalty** module.

- In `lib/modules/reservation/api.ts`, see `updateBookingStatus()`.
- When a booking is marked as `completed`, the system uses an injected dynamic import to check if the `membership` module is active.
- If active, it automatically awards points to the customer based on their `customerPhone` and the `totalPrice` of the booking.
- **Rule:** Never remove this dynamic import check. Always wrap cross-module calls in `try/catch` so a failure in loyalty doesn't prevent the booking from completing in the CRM.

---

## 3. Availability Checking

Before a booking can be placed, the system must check `checkAvailability()`.

### Capacity Logic

Current availability is based on **Staff Capacity** vs **Concurrent Bookings**.

1. It fetches all active staff members (`getStaffMembers`).
2. `maxCapacity` = number of active staff.
3. It fetches all bookings for that day.
4. It counts how many `pending` or `confirmed` bookings overlap with the requested `startAt` to `endAt` window.
5. If `concurrentBookings.length < maxCapacity`, the slot is available.

### Action: `modify-availability-logic`

If asked to change how availability works (e.g., implementing specific staff schedules instead of general pool capacity):

- You must deeply modify `checkAvailability` in `api.ts`.
- You will likely need to update the `Booking` type to strictly enforce `staffId` assignment at checkout rather than post-booking assignment.

---

## 4. Action: `add-service-field`

If requested to add a new configuration field to a Service (e.g., "Buffer Time"):

1. **Update Types:** Add the field to the `Service` interface in `lib/modules/reservation/types.ts`.
2. **Update Admin UI:** Locate the creation/edit modal (likely in `app/admin/(dashboard)/reservation/services/`) and add the input.
3. **Update API:** Ensure `createService` and `updateService` in `api.ts` handle the new field.

---

## Common Gotchas

- **Sanitization:** Firestore rejects `undefined` values. The `api.ts` file uses a custom `sanitize()` helper to convert `undefined` to `null` before writing to `services` and `bookings`. Make sure you use it or manually strip `undefined` when adding new fields.
- **Composite Indexes:** Fetching bookings by `status` AND sorting by `createdAt` desc requires a composite index. The current API does an in-memory sort if a status is passed to avoid forcing index creation on every tenant. Keep this in mind for large datasets where client-side sorting breaks pagination.
- **Timezones:** All `startAt` and `endAt` fields are stored as Firestore `Timestamp` objects (UTC). The UI is responsible for rendering them in the tenant's or user's local timezone.
