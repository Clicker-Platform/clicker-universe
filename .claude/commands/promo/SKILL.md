---
name: promo
description: >
  Work with the Clicker Platform Promo Engine module.
  Use this skill whenever modifying discount codes, vouchers, auto-apply rules, promo evaluation,
  promo settings, or points-redemption vouchers.
  Trigger on: "promo", "discount code", "voucher", "auto-apply", "coupon",
  "lib/modules/promo", "evaluatePromo", "commitPromoUsage".
---

# /promo — Promo Engine & Voucher Module

The Promo Engine is an **opt-in module** at `lib/modules/promo/`. It handles discount codes, fixed/percent discounts, auto-apply rules, and voucher issuance. Other modules integrate via `<PromoApplicator>` and the public `api.ts` facade.

---

## 1. Architecture Overview

### Firestore paths (always via constants, never raw strings)

| Constant | Path |
|---|---|
| `PROMOS_COLLECTION` | `modules/promo/promos` |
| `VOUCHERS_COLLECTION` | `modules/promo/vouchers` |
| `SETTINGS_DOC` | `modules/promo/settings/config` |

Full Firestore path: `sites/{siteId}/{COLLECTION}/{docId}`

### Two core concepts

**Promo** — the rule. Created by admin. Defines discount kind, value, conditions, trigger.

**Voucher** — the claim. Issued to a specific member. Snapshots the promo's values at issuance time so later edits to the Promo don't change existing vouchers.

---

## 2. Key Types (`lib/modules/promo/types.ts`)

### `Promo`

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Firestore doc ID |
| `siteId` | `string` | Tenant ID |
| `name` | `string` | Display name |
| `code` | `string?` | Code for trigger='code' promos |
| `kind` | `'percent' \| 'fixed'` | Discount calculation type |
| `value` | `number` | Percent (0-100) or fixed amount |
| `maxDiscount` | `number?` | Cap for percent discounts |
| `trigger` | `'code' \| 'auto' \| 'claim'` | How promo is activated |
| `costInPoints` | `number?` | Points needed for trigger='claim' |
| `voucherExpiryDays` | `number?` | Days until issued voucher expires |
| `conditions` | `PromoConditions` | Eligibility rules |
| `maxUses` | `number?` | Total usage cap |
| `usageCount` | `number` | Current total uses |
| `status` | `'active' \| 'paused' \| 'archived'` | |

### `PromoConditions`

| Field | Notes |
|---|---|
| `minSubtotal` | Optional minimum order value |
| `validFrom` / `validUntil` | Optional date window (Firestore Timestamp) |
| `eligibleSources` | `PromoSource[]` — empty = all sources eligible |
| `audience` | `'public' \| 'members' \| 'specific'` |
| `specificMemberIds` | Only when audience='specific' |

### `Voucher`

| Field | Notes |
|---|---|
| `code` | Auto-generated, format `PREFIX-XXXX-XXXX` |
| `ownerMemberId` | Member this voucher belongs to |
| `status` | `'active' \| 'used' \| 'expired'` |
| `snapshotKind/Value/MaxDiscount` | Frozen copy of promo values at issuance |
| `expiresAt` | Optional expiry timestamp |
| `usedAt/Source/RefId/Discount` | Set when voucher is redeemed |

### `EvaluationResult`

```ts
type EvaluationResult =
  | { ok: true; kind: 'promo' | 'voucher'; refId: string; label: string; discount: number; remainingSubtotal: number }
  | { ok: false; reason: EvaluationFailure; message: string };
```

### `AppliedPromo`

```ts
interface AppliedPromo { refId: string; kind: 'promo' | 'voucher'; label: string; discount: number; }
```

---

## 3. Public API (`lib/modules/promo/api.ts`)

**Only import from `api.ts`** — never from internal files.

### Settings
- `getPromoSettings(siteId)` → `PromoSettings`
- `updatePromoSettings(siteId, patch)` → void

### Promo CRUD
- `listPromos(siteId)` → `Promo[]`
- `listClaimablePromos(siteId)` → `Promo[]` (trigger='claim', status='active')
- `getPromo(siteId, promoId)` → `Promo | null`
- `findPromoByCode(siteId, code)` → `Promo | null`
- `createPromo(siteId, data)` → `Promo`
- `updatePromo(siteId, promoId, patch)` → void
- `setPromoStatus(siteId, promoId, status)` → void
- `deletePromo(siteId, promoId)` → void (only for archived promos)

### Voucher CRUD
- `listAllVouchers(siteId)` → `Voucher[]`
- `listMemberVouchers(siteId, memberId)` → `Voucher[]`
- `findVoucherByCode(siteId, code)` → `Voucher | null`
- `getVoucher(siteId, voucherId)` → `Voucher | null`
- `revokeVoucher(siteId, voucherId)` → void

### Evaluation
- `evaluatePromo(input: EvaluateInput)` → `EvaluationResult`
- `findAutoApplicable(siteId, subtotal, source, memberId?)` → `EvaluationResult | null`

```ts
interface EvaluateInput {
  siteId: string; code: string; subtotal: number;
  source: PromoSource; memberId?: string;
}
```

### Commit / Reverse (two-phase)
- `commitPromoUsage(input: CommitInput)` → void — call **after** payment succeeds
- `reversePromoUsage(input: CommitInput)` → void — call if payment fails after commit

```ts
interface CommitInput {
  siteId: string; applied: AppliedPromo; source: PromoSource;
  refId: string; memberId?: string;
}
```

### Voucher Minting
- `claimVoucher(input: ClaimVoucherInput)` → `Voucher` — member redeems points
- `grantVoucher(input)` → `Voucher` — admin grants directly (bypasses trigger check)

---

## 4. Evaluation Flow

```
1. User enters code
2. Call evaluatePromo({ siteId, code, subtotal, source, memberId })
3. If ok: true → show discount to user, store AppliedPromo in local state
4. If ok: false → show result.message inline
5. Parent module finalizes payment / booking
6. On success → commitPromoUsage({ siteId, applied, source, refId, memberId })
7. On failure → reversePromoUsage(...) [best-effort]
```

**Evaluation rule order** (promo path): paused → expired window → wrong source → audience mismatch → min subtotal → usage exhausted → calculate discount.

**Auto-apply:** `findAutoApplicable()` fetches all active promos, filters to trigger='auto', runs the same checks, returns the highest-discount result or null.

---

## 5. Admin UX

| Route | Component | Purpose |
|---|---|---|
| `/admin/promo` | `PromoListPage` | Create, edit, archive promos |
| `/admin/promo/vouchers` | `VouchersPage` + `GrantVoucherDialog` | View vouchers, grant to members |
| `/admin/promo/settings` | `PromoSettingsPage` | Code prefix, expiry defaults, guest settings |

---

## 6. Universal `<PromoApplicator>` Component

Located at `lib/modules/promo/components/PromoApplicator.tsx`. Used by any billing module.

```tsx
<PromoApplicator
  siteId={siteId}
  subtotal={subtotal}
  source="POS"           // 'POS' | 'RESERVATION' | 'SERVICE' | 'OTHER'
  memberId={memberId}    // optional
  applied={appliedPromo} // AppliedPromo | null (controlled)
  onApply={setAppliedPromo}
  onRemove={() => setAppliedPromo(null)}
  disabled={isProcessing}
  autoCheck={true}       // silently auto-applies on mount if eligible
/>
```

---

## 7. Voucher Code Format

Format: `PREFIX-XXXX-XXXX` (e.g. `VCH-A3KP-7MNQ`)

Alphabet excludes ambiguous chars: no `0`, `O`, `1`, `I`, `L`. Prefix max 5 chars, uppercase, defaults to `VCH`.

---

## 8. Architecture Rules

- **Cross-module imports:** Other modules may only import from `@/lib/modules/promo/api`. Never import from internal files like `api/evaluator`, `api/commit`, etc.
- **Opt-in module:** Not all sites use promo. Wrap promo functionality in `isModuleEnabled('promo')` checks in client-facing flows if needed.
- **No stacking:** Only one promo can be applied per transaction. `PromoApplicator` enforces this.
- **Snapshot immutability:** Voucher snapshot fields (`snapshotKind`, `snapshotValue`, `snapshotMaxDiscount`) are set at issuance and must never be updated later.
