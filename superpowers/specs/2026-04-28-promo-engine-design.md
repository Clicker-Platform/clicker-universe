# Promo Engine & Redemption — Design Spec

**Date:** 2026-04-28
**Status:** Approved (brainstorming complete, ready for implementation plan)
**Owner:** TBD

---

## 1. Purpose & Scope

A new opt-in module that lets merchants run **discounts, auto-apply rules, and points-redemption rewards** across any billing surface (POS, Reservation, Service Records, and any future module). The Promo Engine is a platform contract: other modules integrate via a single universal applicator component.

### In scope (V1)

- **Discount codes** — manual entry by cashier or customer (% off, fixed amount off)
- **Auto-apply rules** — engine applies the highest-discount matching promo when conditions are met (e.g., min cart subtotal, eligible source)
- **Points-redemption** — member spends loyalty points to mint a Voucher
- **Vouchers** — admin-issued OR points-claimed, single-use, capped to bill, with expiry
- **Date windows + usage limits** — start/end, total cap, per-member cap
- **Audience targeting** — `public` / `members` / `specific member list`
- **Cross-module integration** — works with any billing module the merchant has enabled (POS, Reservation, Service, or any future module that follows the integration recipe)
- **Self-service AND cashier-assisted redemption** — merchant may not use POS at all
- **Refund/reversal support** — voucher restored, usage decremented, points refunded when parent doc is voided

### Out of scope (V1)

- BOGO / Buy X Get Y / bundle deals
- Stackable promos (one promo per transaction)
- Loyalty point earning multipliers
- Tier-based targeting (existing Bronze/Silver/Gold/Platinum is display-only; not used as a behavior trigger)
- Campaign analytics dashboard (basic usage counters in list view only)
- Multi-use voucher balances ("store credit" wallet pattern)

### Constraints

- Module-import policy: peer modules must not import each other directly. Promo (and Membership) are designated cross-cutting modules — others import via `api.ts` only.
- Merchants who don't need promo simply don't enable the module (e.g., exporter RFQ, manufacturing).
- Engine cannot assume any specific billing module exists.

---

## 2. Architecture Overview

```
┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐
│      byod_pos         │  │     reservation       │  │   service_records     │
│  (cashier bill UI)    │  │ (booking confirm UI)  │  │  (invoice/bill modal) │
│                       │  │                       │  │                       │
│  <PromoApplicator/>   │  │  <PromoApplicator/>   │  │  <PromoApplicator/>   │
└──────────┬────────────┘  └──────────┬────────────┘  └──────────┬────────────┘
           │                          │                          │
           │  { siteId, source,       │                          │
           │    subtotal, memberId,   │                          │
           │    refDocId }            │                          │
           ▼                          ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      lib/modules/promo  (NEW MODULE)                        │
│                                                                             │
│  Public API (api.ts)         Admin UI                Member UI              │
│  ─ evaluatePromo()           ─ /admin/promo/list     ─ MemberRewardsWidget  │
│  ─ findAutoApplicable()      ─ /admin/promo/         ─ MyVouchersWidget     │
│  ─ commitPromoUsage()           vouchers             (rendered via slot in  │
│  ─ reversePromoUsage()       ─ /admin/promo/            membership          │
│  ─ claimPromoForPoints()        settings                dashboard)          │
│  ─ grantVoucher()                                                           │
│  ─ listMemberVouchers()                                                     │
│  ─ listClaimablePromos()                                                    │
│                                                                             │
│  Engine internals: rule evaluation, voucher minting, expiry, usage counter  │
└────────────┬────────────────────────────────────────────┬───────────────────┘
             │                                            │
             ▼                                            ▼
┌─────────────────────────────────┐         ┌───────────────────────────────┐
│  membership (existing)          │         │   core (firebase, RBAC, site) │
│  ─ awardPoints (neg = spend)    │         │   sites/{siteId}/modules/     │
│  ─ findMember*                  │         │     promo/{promos,vouchers,   │
│                                 │         │     settings}                 │
└─────────────────────────────────┘         └───────────────────────────────┘
```

**Key properties:**

- `<PromoApplicator>` is the only integration point for consumer modules.
- Promo's public API (`api.ts`) is the only thing other modules may import. No reaching into internals.
- Promo depends on Membership for points operations; nothing depends on Promo.

---

## 3. Data Model

All collections under `sites/{siteId}/modules/promo/`.

### 3.1 `Promo` — the rule

```ts
interface Promo {
  id: string;
  siteId: string;
  name: string;
  description?: string;

  // Optional code for manual-entry promos. Null/empty for auto-apply or claim-only promos.
  code?: string;                  // e.g., "SUMMER20" — uppercase, unique per site

  // Discount mechanic
  kind: 'percent' | 'fixed';
  value: number;                  // 20 (=20%) or 50000 (=Rp 50K)
  maxDiscount?: number;           // optional cap when kind='percent'

  // Conditions / targeting
  conditions: {
    minSubtotal?: number;
    validFrom?: Timestamp;
    validUntil?: Timestamp;
    eligibleSources: PromoSource[];  // empty array = all sources eligible
    audience: 'public' | 'members' | 'specific';
    specificMemberIds?: string[];    // when audience='specific'
  };

  // Lifecycle / limits
  maxUses?: number;               // total uses across all members (null = unlimited)
  perMemberLimit?: number;        // null = unlimited
  usageCount: number;             // incremented atomically on each redeem

  // Trigger mode
  trigger: 'code' | 'auto' | 'claim';
  // 'code'  → user enters a code at checkout
  // 'auto'  → engine auto-applies if conditions met (highest-value wins)
  // 'claim' → member spends points or admin grants → mints a Voucher

  // For trigger='claim' only
  costInPoints?: number;          // e.g., 1500 pts to claim
  voucherExpiryDays?: number;     // e.g., voucher valid 30 days after claim

  status: 'active' | 'paused' | 'archived';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;             // staff uid
}

type PromoSource = 'POS' | 'RESERVATION' | 'SERVICE' | 'OTHER';
```

### 3.2 `Voucher` — an issuance/claim

```ts
interface Voucher {
  id: string;
  siteId: string;
  promoId: string;                // back-reference to the rule

  code: string;                   // unique per voucher, format VCH-XXXX-XXXX

  ownerMemberId: string;          // who claimed/received it (always required)
  ownerName?: string;             // denormalized snapshot

  status: 'active' | 'used' | 'expired';
  issuedAt: Timestamp;
  expiresAt?: Timestamp;          // copied from promo.voucherExpiryDays at issuance
  issuedVia: 'points_redemption' | 'admin_grant' | 'auto_grant';

  // Snapshot of redemption value at issuance time (protects vouchers if Promo edited later)
  snapshotKind: 'percent' | 'fixed';
  snapshotValue: number;
  snapshotMaxDiscount?: number;

  // Filled when consumed
  usedAt?: Timestamp;
  usedSource?: PromoSource;
  usedRefId?: string;             // POS order id, booking id, service record id
  usedDiscount?: number;          // actual discount applied (after capping)
}
```

### 3.3 Settings (`sites/{siteId}/modules/promo/settings/config`)

```ts
interface PromoSettings {
  voucherCodePrefix: string;      // default 'VCH'
  defaultVoucherExpiryDays: number;  // fallback when promo doesn't specify (default 30)
  allowGuestCodes: boolean;       // if false, all promos require memberId — overrides individual Promo.audience='public'
  updatedAt?: Timestamp;
}
```

**Settings precedence:** `allowGuestCodes=false` is a site-wide override. When false, `evaluatePromo` rejects any call without `memberId` regardless of the promo's individual `audience` setting.

### 3.4 Voucher consumption semantics

- **One-shot, capped to bill.** A voucher is single-use; status flips `active → used` on consumption.
- **Fixed-amount vouchers cap at bill total** — no negative remainder; remainder forfeited.
- **Percent vouchers cap at `snapshotMaxDiscount`** if set, else unlimited (still capped to bill).
- **Snapshot fields immutable** — once a voucher is issued, edits to the parent Promo do not retroactively affect it.

---

## 4. Public API (`lib/modules/promo/api.ts`)

### 4.1 Validation & Application

```ts
// Validate a code or voucher at checkout. Pure read; no state change.
async function evaluatePromo(input: {
  siteId: string;
  source: PromoSource;
  subtotal: number;
  memberId?: string;
  code?: string;                  // user-entered code OR voucher code
}): Promise<EvaluationResult>;

type EvaluationResult =
  | {
      ok: true;
      kind: 'promo' | 'voucher';
      refId: string;                // promoId or voucherId
      label: string;                // human display: "20% off (max Rp 100K)"
      discount: number;             // already capped to subtotal & maxDiscount
      remainingSubtotal: number;
    }
  | {
      ok: false;
      reason:
        | 'not_found'
        | 'expired'
        | 'wrong_source'
        | 'min_subtotal_unmet'
        | 'usage_exhausted'
        | 'per_member_limit'
        | 'audience_mismatch'
        | 'paused'
        | 'already_used';
      message: string;
    };

// Find auto-applicable promos. Returns sorted by discount desc; max 1 used at a time.
async function findAutoApplicable(input: {
  siteId: string;
  source: PromoSource;
  subtotal: number;
  memberId?: string;
}): Promise<EvaluationResult[]>;

// Commit consumption AFTER the bill is finalized. Atomic: increments usageCount,
// flips voucher status, updates per-member counters.
async function commitPromoUsage(input: {
  siteId: string;
  refId: string;                  // promoId or voucherId from EvaluationResult
  kind: 'promo' | 'voucher';
  source: PromoSource;
  refDocId: string;               // POS order id / booking id / service record id
  memberId?: string;
  discountApplied: number;
}): Promise<void>;

// Reverse on void/cancel of parent doc. Restores voucher to 'active', decrements usage,
// refunds points (if voucher was issued via points_redemption).
async function reversePromoUsage(input: {
  siteId: string;
  source: PromoSource;
  refDocId: string;
}): Promise<void>;
```

### 4.2 Voucher Lifecycle

```ts
// Member spends points to claim a 'claim'-trigger Promo. Atomic.
async function claimPromoForPoints(input: {
  siteId: string;
  promoId: string;
  memberId: string;
}): Promise<Voucher>;

// Admin manually grants a voucher.
async function grantVoucher(input: {
  siteId: string;
  promoId: string;
  memberId: string;
  expiryOverrideDays?: number;
}): Promise<Voucher>;

// Member dashboard wallet
async function listMemberVouchers(siteId: string, memberId: string): Promise<Voucher[]>;

// Member dashboard "redeem your points" feed
async function listClaimablePromos(siteId: string, memberId: string): Promise<Promo[]>;
```

### 4.3 Two-phase commit semantics

```
1. user/system picks promo → evaluatePromo() → returns {discount, refId}
2. UI shows discount; user reviews bill
3. parent module finalizes payment (creates POSOrder / Booking / ServiceRecord)
4. parent calls commitPromoUsage() with refDocId
5. Engine atomically: increments Promo.usageCount, marks Voucher used,
   updates per-member usage tracking
```

Between step 1 and step 4, if the user cancels, no state change occurs. This prevents "voucher consumed but order never paid" footguns.

### 4.4 React component

```tsx
<PromoApplicator
  siteId={siteId}
  source="POS"                    // 'POS' | 'RESERVATION' | 'SERVICE' | 'OTHER'
  subtotal={subtotal}
  memberId={member?.id}
  refDocId={pendingDocId}
  onApplied={(result) => { /* parent updates total */ }}
  onCleared={() => { /* parent removes discount */ }}
  showAutoApply={true}            // default true
  allowCodeEntry={true}           // default true
  allowVoucherPicker={true}       // default true (only useful when memberId provided)
/>
```

The component handles auto-apply lookup, code input + validate-on-blur, voucher picker (when memberId provided), applied-state with Remove button. It calls `evaluatePromo` for validation; the parent calls `commitPromoUsage` after finalize.

---

## 5. Cross-Module Integration

### 5.1 Integration recipe (every billing module follows this)

```tsx
// Step 1 — render applicator inside bill UI
<PromoApplicator
  siteId={siteId}
  source="POS"
  subtotal={subtotal}
  memberId={member?.id}
  refDocId={pendingOrderId}
  onApplied={(r) => setAppliedPromo(r)}
  onCleared={() => setAppliedPromo(null)}
/>

// Step 2 — subtract discount from displayed total
const finalTotal = subtotal - (appliedPromo?.discount ?? 0);

// Step 3 — after payment finalizes, commit usage
if (appliedPromo) {
  await commitPromoUsage({
    siteId,
    refId: appliedPromo.refId,
    kind: appliedPromo.kind,
    source: 'POS',
    refDocId: createdOrderId,
    memberId: member?.id,
    discountApplied: appliedPromo.discount,
  });
}

// Step 4 — persist promo on domain doc (for receipts & reports)
await updateOrder(createdOrderId, {
  promoApplied: {
    promoId: appliedPromo.refId,
    label: appliedPromo.label,
    discount: appliedPromo.discount,
  }
});

// Step 5 — on void/cancel, call reversePromoUsage
async function voidOrder(orderId: string) {
  await reversePromoUsage({ siteId, source: 'POS', refDocId: orderId });
  // ... rest of void logic
}
```

No discount math, no voucher state handling, no member balance tweaks live in the consumer module. The engine owns all of it.

### 5.2 Sources registry

```ts
// lib/modules/promo/sources.ts
export const PROMO_SOURCES = {
  POS:         { label: 'POS',         icon: 'shopping-bag', moduleKey: 'byod_pos' },
  RESERVATION: { label: 'Reservation', icon: 'calendar',     moduleKey: 'reservation' },
  SERVICE:     { label: 'Service',     icon: 'wrench',       moduleKey: 'service_records' },
  // future modules append here
} as const;

export type PromoSource = keyof typeof PROMO_SOURCES;
```

This registry feeds:
- The `eligibleSources` multi-select in the Promo form
- Mini-icons in the Promo list table and member voucher cards
- Filtering in `evaluatePromo` (only promos whose `eligibleSources` include the calling source can match)

Adding a new billing module = add one entry here + follow the recipe.

### 5.3 Module-import policy update (CLAUDE.md)

Update the existing rule:

> **Before:** "Modules cannot import from each other directly."
>
> **After:** "Modules cannot import from peer modules directly. Two designated modules expose public APIs for cross-module use: **Membership** (`lib/modules/membership/api.ts`) and **Promo** (`lib/modules/promo/api.ts`). Other modules must only import from these via their `api.ts` entry point — never reach into internals."

### 5.4 Skills (documentation deliverables)

| Skill | Path | Purpose |
|---|---|---|
| `/promo` | `.claude/commands/promo.md` | The module skill — internal architecture, data model, admin UX, voucher lifecycle, settings. Read when working **inside** Promo. Same pattern as `/membership`, `/byod_pos`. |
| `/promo_integration` | `.claude/commands/promo_integration.md` | The integration skill — recipe + do/don't list. Read when wiring Promo into another module's checkout flow. |

---

## 6. Admin UX

Module registration in `lib/modules/definitions.ts`:

```ts
'promo': {
  adminRoutes: [
    { label: 'Promos',   path: '/admin/promo/list',     icon: 'tag',      componentKey: 'promo:PromoListPage' },
    { label: 'Vouchers', path: '/admin/promo/vouchers', icon: 'ticket',   componentKey: 'promo:VouchersPage' },
    { label: 'Settings', path: '/admin/promo/settings', icon: 'settings', permission: 'settings', componentKey: 'promo:SettingsPage' }
  ]
}
```

### 6.1 Promo List (`/admin/promo/list`)

Table columns: Name + code, Trigger pill (`Code`/`Auto`/`Claim`), Value (with maxDiscount sublabel), Sources (icons), Audience, Window, Usage (count + progress bar), Status badge, Actions (`⋯` = Edit · Pause/Resume · Archive · Duplicate).

Top bar: search, filters (trigger / status / source), `[+ New Promo]`.

### 6.2 Promo Form (modal/sheet, three-step accordion)

1. **Basics** — name, description, code (optional), kind/value, max cap
2. **Conditions** — min subtotal, date window, eligible sources (multi-select), audience (Public/Members/Specific list)
3. **Trigger & Limits** — trigger type, max uses, per-member limit, and (if `claim`) cost in points + voucher expiry days

Live preview pane shows what the customer would see at checkout.

### 6.3 Vouchers (`/admin/promo/vouchers`)

Read-mostly table: voucher code, source promo, owner (name + phone), issuedAt + via, expiresAt, status badge, used-at info (source + ref id link).

Actions: `[+ Grant Voucher]` (admin manually issues), `Revoke` (cancel an active voucher).

### 6.4 Settings (`/admin/promo/settings`)

- Voucher code prefix (default `VCH`)
- Default voucher expiry days (default 30)
- Allow guest discount codes toggle

---

## 7. Member-side UX

The existing `MemberDashboard` (`lib/modules/membership/components/dashboard/MemberDashboard.tsx`) hosts two new widgets via a slot mechanism.

### 7.1 Slot mechanism

Membership exposes a dashboard slot (similar to the existing `client-registry.tsx` pattern). Promo registers its widgets into the slot. If Promo module is disabled, the slot renders nothing — no broken imports, no empty-state UI.

### 7.2 `<MemberRewardsWidget>` (claimable promos)

- Header: "Redeem your points" + current balance
- Card grid of claimable promos (`trigger='claim'`, audience matches, has `costInPoints`):
  - Reward name + value
  - Cost in points
  - Validity preview ("Voucher valid 30 days after claim")
  - Eligible at: source icons
  - `[Redeem]` button (disabled if `currentPoints < costInPoints`)
- Confirmation dialog → `claimPromoForPoints()` → success toast → voucher slides into wallet

### 7.3 `<MyVouchersWidget>` (active wallet)

- Tabs: `Active` · `Used` · `Expired`
- Voucher card:
  - Big value display ("Rp 50.000 OFF" or "20% OFF")
  - Code in monospace, tap-to-copy (`VCH-A8B2-XK91`)
  - Expiry countdown (red if < 3 days)
  - Eligible source icons
  - `[Show QR]` — fullscreen QR encoding the voucher code
- Empty state: "No vouchers yet — redeem your points or wait for a gift!"

### 7.4 Redemption flows

**Cashier-assisted:** Cashier identifies member at checkout → `<PromoApplicator>` lists member's active vouchers → cashier taps voucher → discount applied → bill finalized → `commitPromoUsage` flips voucher to `used`.

**Self-service:** Member taps `[Show QR]` on dashboard → cashier scans QR (or types code) into the applicator's "Enter code" field → same `evaluatePromo` validates → same `commitPromoUsage` finalizes.

Both paths converge on the universal applicator.

---

## 8. Refund / Reversal Behavior

When a parent doc is voided (POS order voided, booking cancelled, service record voided):

1. Consumer module calls `reversePromoUsage({ siteId, source, refDocId })`
2. Engine looks up the consumed promo/voucher by `refDocId`
3. Atomically:
   - Decrements `Promo.usageCount`
   - If voucher: status `used → active`, clears `usedAt/usedSource/usedRefId/usedDiscount`
   - If voucher was `issuedVia: 'points_redemption'`: refunds the original `costInPoints` to the member via `awardPoints` with positive delta
4. Idempotent: calling twice for the same `refDocId` is a no-op

---

## 9. Phasing & Build Sequence

| Phase | Scope | Why this order |
|---|---|---|
| **1. Foundation** | Module scaffold, types, Firestore paths, public API (`evaluatePromo`, `commitPromoUsage`, `reversePromoUsage`, voucher CRUD), sources registry skeleton, settings | Engine logic is hardest to get right; build & test in isolation |
| **2. Admin UX** | Promo List, New/Edit form, Vouchers page, Settings, Backyard registration | Admin must create promos before any consumer can test |
| **3. POS integration** | Add `POS` to sources, render `<PromoApplicator>` in cashier flow, wire `commitPromoUsage` + `reversePromoUsage`, persist `promoApplied` on `POSOrder` | Highest-traffic billing surface; proves the universal pattern |
| **4. Member-side UX** | `MemberDashboardSlot` mechanism, `<MemberRewardsWidget>`, `<MyVouchersWidget>`, `claimPromoForPoints` transactional logic, QR display | Self-service redemption; can run in parallel with Phase 3 if bandwidth |
| **5. Remaining integrations + docs** | Reservation, Service Records, write `/promo` and `/promo_integration` skills, update CLAUDE.md exception clause | Mechanical copies of POS recipe; skills codify Phase 3 learnings |

Each phase is independently shippable.

---

## 10. Open Questions / Future Work

Captured for later, **not in V1**:

- Stackable promos (one auto + one code)
- BOGO / Buy X Get Y / bundle deals
- Tier-based audience targeting (would require turning the existing display-only tier system into a stored, behavior-bearing field)
- Loyalty point earning multipliers
- Campaign analytics dashboard (revenue impact, redemption rate over time)
- Multi-use voucher balances ("store credit" pattern) — likely a separate module
- Voucher signed-URL QRs (V1 just encodes the code as text)
- Public-facing voucher claim links (e.g., "share to claim a friend's birthday voucher")

---

## 11. Deliverables Summary

| Output | Path |
|---|---|
| Design spec (this doc) | `dev/superpowers/specs/2026-04-28-promo-engine-design.md` |
| Module skill | `.claude/commands/promo.md` |
| Integration skill | `.claude/commands/promo_integration.md` |
| CLAUDE.md update | Module-import policy clause |
| Implementation plan | (Next step — written via `superpowers:writing-plans`) |
