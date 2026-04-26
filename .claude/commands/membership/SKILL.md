---
name: membership
description: >
  Work with the Clicker Platform Membership Module.
  Use this skill whenever modifying member profiles, loyalty programs,
  points accumulation, spend tracking, tier system, member codes, or module-level staff permissions.
  Trigger on: "add members", "loyalty points", "membership system",
  "member history", "tiers", "member code", "lib/modules/membership".
---

> **Architecture Reference:** Always read [`docs/ARCHITECTURE.md`](../../../clicker-platform-v2/docs/ARCHITECTURE.md) before making any changes.


# /membership — Membership & Loyalty Module

You are working on the **Clicker Platform Membership Module**. This system allows tenants to build a customer database, track spending, and run a points-based loyalty program with tiers.

This skill is invoked as `/membership [action]`.

---

## 1. Architecture Overview

- **Members:** `sites/{siteId}/modules/membership/members`
- **Transactions:** `sites/{siteId}/modules/membership/transactions`
- **Settings:** `sites/{siteId}/modules/membership/settings/config`
- **Member code counter:** `sites/{siteId}/modules/membership/settings/counter` (atomic, do not write directly)

**Identity Matching:** Members are identified by `phoneNumber` or `email`. Always call `normalizePhoneNumber(phone)` before any lookup — it converts `+6281…` / `6281…` to Indonesian local format `081…`. Do NOT assume it normalizes to E.164; it goes the other direction.

### Member Creation vs. Linking

When a user interacts with the system (e.g., placing a POS order), the system matches them to an existing Member via phone or email.

- Match found → attach that Member ID to the transaction.
- No match → create a new Member via `createMember()`. This atomically assigns a `memberCode` (e.g., `CLK-001`) using the counter doc.

---

## 2. Key Types (`lib/modules/membership/types.ts`)

### `Member`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | Firestore doc ID |
| `uid` | `string?` | Firebase Auth UID (linked after magic-link login) |
| `phoneNumber` | `string` | Normalized; unique identifier for POS/loyalty |
| `email` | `string` | Unique identifier for magic-link login |
| `fullName` | `string` | |
| `currentPoints` | `number` | Live points balance |
| `totalSpent` | `number` | Cumulative spend |
| `totalTransactions` | `number` | |
| `memberCode` | `string?` | Auto-generated, e.g., `CLK-001` |
| `role` | `'owner' \| 'staff' \| 'member'?` | RBAC role on the member doc |
| `pinHash` | `string?` | Legacy/dev PIN — do not use for new features |
| `templateConfig` | `object?` | Unlocked templates and active template config |
| `createdAt` / `updatedAt` | `Timestamp` | |

### `LoyaltyTransaction`

| Field | Type | Notes |
| --- | --- | --- |
| `memberId` | `string` | |
| `source` | `string` | `'POS'`, `'RESERVATION'`, `'MANUAL'`, `'EVENTS'` |
| `sourceRefId` | `string` | Order ID, booking ID, etc. |
| `pointsDelta` | `number` | Positive = earn, negative = redeem |
| `spendAmount` | `number?` | Only set when spend is tracked |
| `description` | `string` | |

### `MembershipSettings`

| Field | Notes |
| --- | --- |
| `enableLoyalty` | Toggle for the whole loyalty program |
| `pointsName` | Custom currency label, e.g., `'Stars'`, `'Coins'` |
| `currency` | Symbol, e.g., `'IDR'`, `'$'` |
| `earningRatio` | Points per 1 currency unit |
| `spendBlock` | UI helper: X points per Y spent |
| `memberCodePrefix` | Prefix for auto-generated codes, e.g., `'CLK'` (defaults to `'MBR'`) |
| `tierThresholds` | `TierThreshold[]` — per-tenant tier config |

### Tier System

Tiers are computed client-side via `getTier(points, thresholds?)`. The four tiers are `Bronze | Silver | Gold | Platinum`. Default thresholds are in `DEFAULT_TIER_THRESHOLDS`. Colors are in `TIER_COLORS`.

---

## 3. API Reference (`lib/modules/membership/api.ts`)

### Identity & Lookup

```typescript
normalizePhoneNumber(phone: string): string
findMemberByPhone(siteId, phoneNumber): Promise<Member | null>
findMemberByEmail(siteId, email): Promise<Member | null>
findMemberByAuthId(siteId, uid): Promise<Member | null>
```

### Member Management

```typescript
createMember(siteId, data: Omit<Member, 'id'|'createdAt'|'updatedAt'|'currentPoints'>, memberCodePrefix?): Promise<Member>
updateMemberProfile(siteId, memberId, data: { fullName, phoneNumber, email }): Promise<void>
updateMemberAuth(siteId, memberId, uid, email): Promise<void>  // links Firebase Auth UID
backfillMemberCodes(siteId, prefix, onProgress?): Promise<{ backfilled, skipped }>
```

> **`updateMemberProfile` has a fixed signature** — `{ fullName, phoneNumber, email }` only. Adding a new field requires changing the function signature explicitly.

### Listing & Search

```typescript
getPaginatedMembers(siteId, lastDoc: QueryDocumentSnapshot | null, pageSize?: number): Promise<{ members, lastVisible }>
searchMembers(siteId, term): Promise<Member[]>
```

> **Search requires `term.length >= 3`** — returns `[]` silently for shorter terms. Searches `fullName` and `phoneNumber` fields via prefix range (``). Returns max 5 results per field, deduped.

### Loyalty / Points

```typescript
// With spend tracking (preferred for POS/commerce integrations)
awardPointsWithSpend(siteId, memberId, points, spendAmount, source, sourceRefId, description?): Promise<void>

// Points only (manual awards, no spend amount)
awardPoints(siteId, memberId, amount, source, sourceRefId, description?): Promise<void>

getMemberHistory(siteId, memberId, pageSize?): Promise<LoyaltyTransaction[]>
```

Both award functions run a **Firestore Transaction** — atomically update `currentPoints`, `totalSpent`, `totalTransactions`, and write a `LoyaltyTransaction` record. Both check `getMembershipSettings()` first and no-op if `enableLoyalty` is false.

### Settings

```typescript
getMembershipSettings(siteId): Promise<MembershipSettings>   // returns defaults if doc missing
updateMembershipSettings(siteId, settings: Partial<MembershipSettings>): Promise<void>
```

### Staff / Permissions

```typescript
getMembershipStaff(siteId): Promise<MembershipStaffMember[]>  // active — queries global members collection
getMembershipRole(siteId, userId): Promise<string | null>

// DEPRECATED — do not use for new features:
assignMembershipRole(siteId, email, role)
removeMembershipRole(siteId, userId)
```

> `getMembershipStaff` is **active, not legacy**. It queries `sites/{siteId}/members` for records with `permissions` array-contains `'membership'` or `role === 'owner'`. Rely on global `moduleAccess` checks for new authorization work, but don't dismiss this function as deprecated.

---

## 4. Action: `award-points`

Use `awardPointsWithSpend` for commerce flows (POS, reservations), `awardPoints` for manual or non-spend awards.

```typescript
import { awardPointsWithSpend } from '@/lib/modules/membership/api';

await awardPointsWithSpend(
    siteId,
    memberId,
    50,          // points to award
    50000,       // spend amount (in tenant currency)
    'POS',       // source
    orderId,     // sourceRefId
    'Earned from in-store purchase'
);
```

---

## 5. Action: `add-member-field`

1. **Update Types:** Add the field to `Member` in `lib/modules/membership/types.ts`.
2. **Update API:** Add the field to `updateMemberProfile`'s `data` parameter signature in `api.ts`. Also update `createMember` if it should be set on creation.
3. **Update Admin UI:** Edit `lib/modules/membership/admin/MemberListPage.tsx` and/or `lib/modules/membership/admin/components/MemberDetailsPanel.tsx`.

> Admin UI lives at `lib/modules/membership/admin/` — **not** `app/admin/(dashboard)/membership/`. The module uses the shared `/admin/[...slug]/page.tsx` catch-all route with `MODULE_COMPONENTS` registry keys `membership:MemberListPage` and `membership:Settings`.

---

## Common Gotchas

- **Phone normalization direction:** `normalizePhoneNumber` converts TO Indonesian local format (`081…`), not to E.164. Always normalize before lookup and before storage.
- **Search term minimum:** `searchMembers` silently returns `[]` for terms shorter than 3 characters. Guard the call site.
- **`updateMemberProfile` is narrow:** Only updates `fullName`, `phoneNumber`, `email`. New fields require changing the function.
- **Member codes use an atomic counter:** `createMember` handles this automatically. Never write to `COUNTER_DOC` directly.
- **Pagination:** Pass the `lastVisible` `QueryDocumentSnapshot` (not just an ID) to `getPaginatedMembers` for the next page.
- **Loyalty Settings:** Per-tenant config at `sites/{siteId}/modules/membership/settings/config`. Call `getMembershipSettings()` — it returns safe defaults if the doc is missing.
- **Deprecated staff functions:** `assignMembershipRole` and `removeMembershipRole` exist but are deprecated. `getMembershipStaff` and `getMembershipRole` are active.
