---
name: membership
description: >
  Work with the Clicker Platform Membership Module.
  Use this skill whenever modifying member profiles, loyalty programs,
  points accumulation, spend tracking, or module-level staff permissions.
  Trigger on: "add members", "loyalty points", "membership system",
  "member history", "lib/modules/membership".
---

> **Architecture Reference:** Always read [`docs/ARCHITECTURE.md`](../../../clicker-platform-v2/docs/ARCHITECTURE.md) before making any changes.


# /membership — Membership & Loyalty Module

You are working on the **Clicker Platform Membership Module**. This system allows tenants to build a customer database, track spending, and run a points-based loyalty program.

This skill is invoked as `/membership [action]`.

---

## 1. Architecture Overview

- **Storage Location:** Members are stored in `sites/{siteId}/modules/membership/members`.
- **Transactions Location:** Loyalty/spend history is stored in `sites/{siteId}/modules/membership/transactions`.
- **Identity Matching:** Members are identified globally by `phoneNumber` or `email`. `normalizePhoneNumber(phone)` MUST be used before any database lookup to ensure consistency (e.g., standardizing +62, 62, 08 prefixing).

### Rule: Member Creation vs. Linking

When a user interacts with the system (e.g., placing a POS order or logging in via the Auth Gateway), the system attempts to match them to an existing Member document via Phone or Email.

- If a match is found, that Member ID is attached to the transaction.
- If no match is found, a new Member document is created via `createMember()`.

---

## 2. Action: `award-points`

When integrating the Membership system into another flow (e.g., a completed POS order), you use `awardPointsWithSpend`.

```typescript
import { awardPointsWithSpend } from '@/lib/modules/membership/api';

// Example: Order completes for $50
await awardPointsWithSpend(
    siteId,
    memberId,
    50, // Points to award (based on settings ratio)
    50, // Spend Amount
    'POS', // Source
    orderId, // Source Ref ID
    'Earned from in-store purchase' // Description
);
```

### Safety & Consistency

- `awardPointsWithSpend` runs a **Firestore Transaction**. It atomically updates the member's `currentPoints`, `totalSpent`, and `totalTransactions`, AND writes an immutable `LoyaltyTransaction` record to the ledger.
- It automatically checks if the Loyalty program is actually enabled via `getMembershipSettings()`. If disabled, it fails gracefully (no-op).

---

## 3. Action: `add-member-field`

If requested to add a new demographic field (e.g., "Birthdate"):

1. **Update Types:** Add the field to the `Member` interface in `lib/modules/membership/types.ts`.
2. **Update Admin UI:** Locate the creation/edit modal (likely in `app/admin/(dashboard)/membership/components/`) and add the input.
3. **Update API:** Ensure `createMember` and `updateMemberProfile` in `api.ts` handle the new field.

---

## Common Gotchas

- **Pagination:** Exploring members uses standard cursor-based pagination (`getPaginatedMembers`). Ensure UI components pass the `lastVisible` document snapshot correctly to load the next page.
- **Search:** The `searchMembers` API performs concurrent queries against `fullName` and `phoneNumber` (using prefix bounds `\uf8ff`). It is not full-text search, but suitable for exact or prefix matches.
- **Role Permissions:** While the `core_auth_rbac` system handles global roles, the Membership module historically has a legacy `getMembershipStaff` function. When dealing with staff authorization inside the membership tools, rely on the global `moduleAccess` checks unless explicitly asked to modify legacy staff assignments.
- **Loyalty Settings:** Earnings ratios and currency symbols are defined per-tenant in `sites/{siteId}/modules/membership/settings/config`.
