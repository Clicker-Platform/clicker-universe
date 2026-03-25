---
name: service-records
description: >
  Use this skill whenever building, designing, or modifying anything related to
  the Service Records module of the Clicker.id platform. This includes: service
  record creation and lifecycle management, vehicle profile management, payment
  entry, manager approval flow, digital warranty card generation (URL + PDF),
  post-service reminder engine (R0–R3), reminder template configuration,
  Members module integration (loyalty point accrual), and service type catalog
  management. Trigger on any mention of: service record, vehicle, plat nomor,
  plate number, warranty card, nano coating, PPF, paint protection, detailing,
  automotive service, workshop, reminder, feedback survey, maintenance reminder,
  warranty expiry, warranty code, service completion, approval, loyaltyPoints,
  addPoints, reminderQueue, serviceConfig, warrantyCards, serviceTypes, or
  featuresEnabled.
---

# Service Records Module — Skill

## Context

Part of the **Clicker.id** platform (PT. Clicker AI). Built with **Next.js 15
(App Router)**, **TypeScript**, **Tailwind CSS v4**, and **Firebase (Firestore)**.

This module is a **standalone service job management system** — it does not
depend on the POS module. It is the primary transaction entry point for
service-based businesses where a physical job is performed on a customer asset
(a vehicle) and a warranty may be issued.

```
Members module ─────────────────────────────────────────────┐
  (member lookup, addPoints contract)                        ↓
                                             Service Records
                                             (record + lifecycle + payment)
                                                            ↓
Notification Service ──────────────────────────────────────→ reminderQueue
  (Email v1.0 / WhatsApp future)                            ↓
Reporting Module ──────────────────────────────────────────→ reads serviceRecords
```

**Primary use case:** Mr. Brightside Nano Ceramic Coating (auto detailing +
paint protection film). The module is **industry-agnostic** — business type
differentiation is handled entirely through the `serviceTypes` catalog, not
a mode field. A workshop configures workshop service types; a detailing shop
configures coating and PPF types. Features like warranty cards can be suppressed
per tenant via `featuresEnabled` flags in `serviceConfig`.

Before building anything, read the **Non-Negotiable Rules** section.

---

## Module Boundaries

**Service Records OWNS:**
- `serviceRecords`, `vehicles`, `serviceTypes`, `warrantyCards`,
  `reminderQueue`, `serviceConfig` collections
- Service record lifecycle (DRAFT → COMPLETED)
- Payment entry and payment status tracking
- Warranty card generation and public page
- Reminder scheduling (writes to `reminderQueue`)

**Service Records does NOT:**
- Write to Members-owned collections — all membership actions via contract
- Import Members module code directly — all cross-module calls guarded with
  `isModuleEnabled('membership')` per platform architecture rule
- Send notifications directly — writes to `reminderQueue` only; a Cloud
  Function dispatches
- Integrate with POS — these are independent transaction flows
- Calculate loyalty point accrual rules — Members module owns the formula
- Manage inventory of coating products — belongs to Inventory module if used

---

## Non-Negotiable Rules

These are hard constraints. Violations are bugs, not preferences.

1. **Warranty activates ONLY on manager/owner approval.** Front desk cannot
   trigger warranty activation. No automatic transitions to COMPLETED.

2. **Warranty card delivery (R0) fires atomically with approval.** The
   PENDING_APPROVAL → COMPLETED transition, warrantyCard creation, and R0
   queue entry must be a single Firestore batched write. UI must show the
   consequence (warranty will be sent to customer) before manager confirms.

3. **Warranty issued only for hasWarranty = true service types.** In the
   default Mr. Brightside config: Nano Ceramic Coating and PPF only.
   Detailing and custom types do not generate warranty cards.

4. **Payment must be PAID before PENDING_APPROVAL.** The "Submit for Approval"
   button is disabled if `paymentStatus ≠ PAID`. This is enforced in UI and
   Firestore Security Rules.

5. **Service Records never writes to Members collections directly.** All
   membership actions use `membershipModule.addPoints()`. addPoints() failure
   must NOT roll back the COMPLETED status — log and surface to manager.

6. **All reminder templates are tenant-configurable.** No hardcoded message
   copy anywhere in the codebase. All copy reads from
   `serviceConfig.reminderTemplates` at dispatch time.

7. **Warranty codes are globally unique, immutable, and never recycled.**
   Format: `{PREFIX}-{YEAR}-{4-char alphanumeric}`. Checked for uniqueness
   before write with up to 3 retries.

8. **COMPLETED records are immutable.** No field edits after COMPLETED.
   Corrections via amendment notes subcollection only.

9. **Vehicle plate number is the dedup key.** Warn (do not block) when a
   plate already exists under a different memberId. Staff must confirm intent.

10. **outletId is required and never null on every document.** In v1.0 it is
    always the single configured outlet. All list queries include
    `where outletId == currentOutletId`.

---

## Record Lifecycle State Machine

```
DRAFT
  ↓  (front desk or manager — requires vehicleId, serviceTypeId, totalAmount)
IN_PROGRESS
  ↓  (front desk or manager — requires paymentStatus = PAID)
PENDING_APPROVAL
  ↓  (manager/owner only — atomic: warrantyCard + reminders + addPoints)
COMPLETED  ← terminal, immutable

Any non-COMPLETED state → CANCELLED (manager/owner only, cancelReason required)
```

**Completion is atomic (Firestore batch):**
1. `serviceRecords/{id}`: status = COMPLETED, approvedBy, approvedAt
2. `warrantyCards/{newId}`: full card document (if hasWarranty = true)
3. `serviceRecords/{id}`: warrantyCardId = new card ID
4. `reminderQueue`: R0 entry (if hasWarranty + r0Enabled)
5. `reminderQueue`: R1 entry (if r1Enabled)
6. `reminderQueue`: R2 entry (if r2Enabled)
7. `reminderQueue`: R3 entry (if hasWarranty + r3Enabled)
8. After batch commits: call `membershipModule.addPoints()`

---

## Data Model (Firestore)

Key collections (all under `sites/{siteId}/modules/service_records/`):

| Collection | Purpose |
|---|---|
| `serviceRecords` | Central job document — lifecycle, payment, links |
| `vehicles` | Vehicle profiles — plate, make, model, type, member link |
| `serviceTypes` | Tenant-configurable service catalog — warranty rules, defaults |
| `warrantyCards` | Issued warranty cards — snapshotted, publicly accessible |
| `reminderQueue` | Scheduled notification queue — written at completion |
| `serviceConfig/{outletId}` | Tenant config — reminders, templates, branding, featuresEnabled |

**Key relationships:**
```
members (1) ──→ vehicles (N) ──→ serviceRecords (N) ──→ warrantyCards (1:1)
```

**Denormalisation rule:** All warranty card fields (plate, owner name, service
type, product, dates) are **snapshotted at card creation time**. Never reference
live records from the warranty card — edits to source records must not affect
issued warranties.

---

## Service Types — Business Type Differentiation

The module is industry-agnostic. Business type is expressed through the
`serviceTypes` catalog — there is no `businessMode` field.

| Field | Purpose |
|---|---|
| `hasWarranty` | true = warranty card generated on completion |
| `defaultWarrantyMonths` | Pre-fills warranty duration on new records |
| `category` | COATING \| PPF \| DETAILING \| WASH \| OTHER |
| `isActive` | Soft-delete — hides from form, preserves history |

**Mr. Brightside seed data:**

| name | hasWarranty | defaultWarrantyMonths |
|---|---|---|
| Nano Ceramic Coating | true | 12 |
| PPF (Paint Protection Film) | true | 24 |
| Full Detail / Detailing | false | — |
| Custom | false | — |

---

## featuresEnabled Flags (serviceConfig)

```typescript
featuresEnabled: {
  warrantyCards: boolean      // suppress warranty card UI for non-coating tenants
  reminderEngine: boolean     // disable all reminders if not needed
}
```

Default: `{ warrantyCards: true, reminderEngine: false }`

---

## Reminder Engine

Four reminder types, all written to `reminderQueue` at COMPLETED time:

| Type | Trigger timing | Applicable | One-shot? |
|---|---|---|---|
| R0 — WARRANTY_DELIVERY | Immediate (approvedAt) | hasWarranty only | Yes |
| R1 — FEEDBACK_SURVEY | Day 10 post-completion (config: 7–15) | All types | Yes (v1.0) |
| R2 — MAINTENANCE | 6 months post-completion (configurable) | All types | No — repeating |
| R3 — WARRANTY_EXPIRY | 30 days before expiry (configurable) | hasWarranty only | Yes |

**Walk-in (null memberId) with no contact info:** All reminder entries are
written with `status = SKIPPED` immediately at queue time.

**Template variables available in all templates:**
`{{ownerName}}`, `{{vehiclePlate}}`, `{{vehicleMakeModel}}`,
`{{serviceTypeName}}`, `{{productUsed}}`, `{{serviceDate}}`,
`{{warrantyCode}}`, `{{warrantyExpiry}}`, `{{warrantyUrl}}`,
`{{businessName}}`

---

## Warranty Card

**warrantyCode format:** `{PREFIX}-{YEAR}-{4-char alphanumeric}`
e.g. `MRB-2026-A4F9` (PREFIX configured in serviceConfig)

**Public URL:** `clicker.id/warranty/{warrantyCode}` — no auth required,
shareable by customer.

**Formats:** URL page (Next.js public route) + PDF on demand via
`GET /api/warranty/{warrantyCode}/pdf`

**Status lifecycle:** ACTIVE → EXPIRED (via daily Cloud Function) | VOIDED
(manager action)

**QR code** links to the same public URL (self-referential verification).

---

## Integration Contracts

### → Members Module (upstream)

```typescript
// Guard required before any Members module call
if (await isModuleEnabled('membership')) {

  membershipModule.getMemberByPhone(phone: string)
    → { memberId, fullName, email, phone, tier, pointsBalance } | null

  membershipModule.addPoints(
    memberId: string,
    transactionTotal: number,
    sourceModule: 'SERVICE_RECORDS',
    sourceRefId: string
  ) → { success: true, ... } | { success: false, reason: string }

  // On failure: log, surface to manager — do NOT roll back COMPLETED
}
```

---

## Roles & Access

| Action | staff | owner |
|---|---|---|
| Create / edit DRAFT, IN_PROGRESS | full | ✓ |
| Edit PENDING_APPROVAL | ✗ | ✓ |
| Move to PENDING_APPROVAL | full | ✓ |
| Approve → COMPLETED | ✗ | ✓ |
| Cancel any record | ✗ | ✓ |
| Void warranty card | ✗ | ✓ |
| Configure serviceTypes | ✗ | ✓ |
| Configure reminders + templates | ✗ | ✓ |
| Configure serviceConfig / branding | ✗ | ✓ |
| Create / edit vehicles | full | ✓ |
| View all records + warranty cards | view | ✓ |

---

## Cloud Functions (not yet deployed — v1.0 client-side fallback in api.ts)

| Function | Trigger | Description |
|---|---|---|
| `onServiceRecordCompleted` | Firestore write: status → COMPLETED | Creates warrantyCard, writes reminder queue entries, calls addPoints() |
| `processReminderQueue` | Scheduled every 15 min | Dispatches PENDING items, updates status, reschedules R2 |
| `expireWarrantyCards` | Scheduled daily 02:00 WIB | Sets ACTIVE cards past expiryDate to EXPIRED |

---

## Key Query Patterns

```typescript
// Service record list
serviceRecords.where('outletId', '==', X).orderBy('updatedAt', 'desc').limit(50)

// Pending approvals (manager priority)
serviceRecords.where('outletId', '==', X).where('status', '==', 'PENDING_APPROVAL')

// Warranty lookup (public page — collectionGroup, requires index)
collectionGroup('warrantyCards').where('warrantyCode', '==', X).limit(1)

// Plate dedup check
vehicles.where('plateNumber', '==', normalise(plate)).limit(1)
```

**Required composite indexes:**
`(outletId, status, updatedAt)`, `(outletId, status, createdAt)`,
`(vehicleId, createdAt)`, `(memberId, createdAt)`,
`(status, scheduledAt)` on reminderQueue,
collectionGroup index: `warrantyCards / warrantyCode ASC` (for public page)

---

## Open Decisions

| ID | Topic | Status |
|---|---|---|
| OD-01 | R1 survey response tracking (retry logic) | Deferred to v1.1 |
| OD-02 | Walk-in email capture at record creation | Implemented (optional fields) |
| OD-03 | Warranty code brand prefix | Tenant-configurable via serviceConfig.warrantyPrefix (default 'SVC') |
| OD-04 | Amendment notes subcollection schema for COMPLETED records | Deferred |
| OD-05 | PDF generation: Puppeteer vs React PDF vs Chromium Cloud Function | v1.0 stub (302 redirect) |
| OD-06 | Warranty QR content | URL (/warranty/{warrantyCode}) |
| OD-07 | Cross-outlet vehicle deduplication when multi-outlet activates | Deferred |
| OD-08 | WhatsApp API provider (Fonnte / Wablas / Twilio) | Deferred |
| OD-09 | featuresEnabled flags | { warrantyCards: true, reminderEngine: false } |

---

## File Reference

**Module core:**
- [lib/modules/service-records/constants.ts](clicker-platform-v2/lib/modules/service-records/constants.ts) — Firestore path constants, warranty code constants, status transitions
- [lib/modules/service-records/types.ts](clicker-platform-v2/lib/modules/service-records/types.ts) — All TypeScript interfaces
- [lib/modules/service-records/api.ts](clicker-platform-v2/lib/modules/service-records/api.ts) — Full client-side Firestore API

**Admin pages:**
- [lib/modules/service-records/admin/RecordsListPage.tsx](clicker-platform-v2/lib/modules/service-records/admin/RecordsListPage.tsx) — Records list with status tabs and search
- [lib/modules/service-records/admin/RecordFormPage.tsx](clicker-platform-v2/lib/modules/service-records/admin/RecordFormPage.tsx) — Create/edit record form (4-section)
- [lib/modules/service-records/admin/RecordDetailPage.tsx](clicker-platform-v2/lib/modules/service-records/admin/RecordDetailPage.tsx) — Record detail with status actions
- [lib/modules/service-records/admin/VehiclesPage.tsx](clicker-platform-v2/lib/modules/service-records/admin/VehiclesPage.tsx) — Vehicle catalog management
- [lib/modules/service-records/admin/ServiceTypesPage.tsx](clicker-platform-v2/lib/modules/service-records/admin/ServiceTypesPage.tsx) — Service type catalog (owner only)
- [lib/modules/service-records/admin/RemindersPage.tsx](clicker-platform-v2/lib/modules/service-records/admin/RemindersPage.tsx) — Reminder engine config + template editor
- [lib/modules/service-records/admin/SettingsPage.tsx](clicker-platform-v2/lib/modules/service-records/admin/SettingsPage.tsx) — Warranty prefix, feature flags (owner only)

**Shared components:**
- [lib/modules/service-records/admin/components/RecordStatusBadge.tsx](clicker-platform-v2/lib/modules/service-records/admin/components/RecordStatusBadge.tsx)
- [lib/modules/service-records/admin/components/PaymentStatusBadge.tsx](clicker-platform-v2/lib/modules/service-records/admin/components/PaymentStatusBadge.tsx)

**Public pages:**
- [lib/modules/service-records/public/WarrantyCardView.tsx](clicker-platform-v2/lib/modules/service-records/public/WarrantyCardView.tsx) — Public warranty card client component
- [app/warranty/[warrantyCode]/page.tsx](clicker-platform-v2/app/warranty/%5BwarrantyCode%5D/page.tsx) — Server Component — collectionGroup lookup + serialization
- [app/api/warranty/[warrantyCode]/pdf/route.ts](clicker-platform-v2/app/api/warranty/%5BwarrantyCode%5D/pdf/route.ts) — PDF stub (302 redirect, v1.0)

**Registration files modified:**
- [middleware.ts](clicker-platform-v2/middleware.ts) — `'warranty'` added to specialRoutes
- [lib/modules/definitions.ts](clicker-platform-v2/lib/modules/definitions.ts) — service_records adminRoutes
- [lib/modules/components.tsx](clicker-platform-v2/lib/modules/components.tsx) — 7 dynamic imports
- [lib/modules/registry.ts](clicker-platform-v2/lib/modules/registry.ts) — Car, Wrench, Bell, Users, Plus icons added
- [scripts/seed-modules.ts](clicker-platform-v2/scripts/seed-modules.ts) — service_records seed entry
- [backyard/lib/modules/definitions.ts](backyard/lib/modules/definitions.ts) — backyard parity

---

## Output Checklist

When completing any Service Records task, verify:

- [ ] `outletId` present and non-null on all documents
- [ ] Warranty card created only for `hasWarranty = true` service types
- [ ] All warranty card fields are snapshotted at creation — not referenced live
- [ ] COMPLETED transition is a single atomic Firestore batch write
- [ ] `addPoints()` failure does not roll back COMPLETED status
- [ ] Only manager/owner role can trigger COMPLETED (UI + Security Rules)
- [ ] Payment must be PAID before PENDING_APPROVAL transition
- [ ] Approval UI shows explicit consequence before confirmation (two-tap)
- [ ] Warranty codes checked for uniqueness before write
- [ ] All reminder templates read from serviceConfig — no hardcoded copy
- [ ] Walk-in records with no contact: reminder entries written as SKIPPED
- [ ] Public warranty URL accessible without authentication
- [ ] Duplicate plate: warn modal shown, not blocked
- [ ] PENDING_APPROVAL records visually elevated for manager attention
- [ ] `featuresEnabled.warrantyCards` suppresses warranty UI when false
- [ ] All collection paths defined in `constants.ts` — never hardcoded inline
- [ ] `siteId` from `useSite()` used as tenant key — never hardcoded
- [ ] All write handlers guarded with `canEdit('service_records', routeId)`
- [ ] `isModuleEnabled('membership')` checked before any Members module call
- [ ] No `firebase-admin` imports in client components or `components.tsx`
- [ ] Module registered in definitions.ts, components.tsx, seed-modules.ts, backyard/definitions.ts
