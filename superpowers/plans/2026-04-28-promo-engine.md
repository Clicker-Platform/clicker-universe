# Promo Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new opt-in `promo` module that lets merchants run discounts, auto-apply rules, and points-redemption vouchers across any billing surface (POS, Reservation, Service Records, future modules), with both cashier-assisted and member self-service redemption.

**Architecture:** Standalone module under `lib/modules/promo/` exposing a public API (`api.ts`) and a single `<PromoApplicator>` React component. Consumer modules render the component and call two functions (`commitPromoUsage`, `reversePromoUsage`) on lifecycle events. Two Firestore collections (`promos`, `vouchers`) under `sites/{siteId}/modules/promo/`. Member-side widgets plug into the existing `dashboardWidgets` slot mechanism.

**Tech Stack:** TypeScript, Next.js 14 (App Router), Firebase Firestore (client SDK), Tailwind, lucide-react, vitest, @testing-library/react.

**Spec reference:** `dev/superpowers/specs/2026-04-28-promo-engine-design.md`

---

## File Structure

### New files (Phase 1 — Foundation)

```
clicker-platform-v2/lib/modules/promo/
├── types.ts                # Promo, Voucher, PromoSource, EvaluationResult, PromoSettings
├── constants.ts            # Collection paths, default settings
├── sources.ts              # PROMO_SOURCES registry
├── code-generator.ts       # generateVoucherCode() — VCH-XXXX-XXXX format
├── api.ts                  # Public API (re-exports + facade)
├── api/
│   ├── promos.ts           # CRUD for Promo (admin)
│   ├── vouchers.ts         # CRUD for Voucher (admin + member)
│   ├── settings.ts         # PromoSettings get/update
│   ├── evaluator.ts        # evaluatePromo, findAutoApplicable (rule engine)
│   ├── commit.ts           # commitPromoUsage, reversePromoUsage (transactional)
│   └── claim.ts            # claimPromoForPoints, grantVoucher
└── __tests__/
    ├── evaluator.test.ts
    ├── commit.test.ts
    ├── claim.test.ts
    └── code-generator.test.ts
```

### New files (Phase 2 — Admin UX)

```
clicker-platform-v2/lib/modules/promo/admin/
├── PromoListPage.tsx
├── PromoFormSheet.tsx
├── VouchersPage.tsx
├── GrantVoucherDialog.tsx
└── SettingsPage.tsx
```

### New files (Phase 3 — POS integration)

```
clicker-platform-v2/lib/modules/promo/components/
└── PromoApplicator.tsx
```

(POS edits modify `CashierClient.tsx`, `PaymentConfirmationDialog.tsx`, and `byod_pos/types.ts` — see Phase 3 tasks.)

### New files (Phase 4 — Member-side UX)

```
clicker-platform-v2/lib/modules/promo/public/
├── MemberRewardsWidget.tsx
└── MyVouchersWidget.tsx
```

### New files (Phase 5 — Remaining integrations + docs)

```
.claude/commands/
├── promo.md                 # Module skill
└── promo_integration.md     # Integration recipe skill
```

(Reservation and Service Records edits modify their existing booking/bill UIs — see Phase 5 tasks.)

### Modified files

| File | When | Why |
|---|---|---|
| `lib/modules/definitions.ts` | Phase 2 | Register `promo` module + admin routes |
| `lib/modules/components.tsx` | Phase 2, 4 | Register dynamic component map keys |
| `lib/modules/client-registry.tsx` | Phase 4 | Register member widgets for client-side rendering |
| `lib/modules/registry.ts` | Phase 2 | Add new module icons (`tag`, `ticket`) to MODULE_ICONS |
| `scripts/seed-modules.ts` | Phase 2 | Seed the `promo` module document with `dashboardWidgets` |
| `byod_pos/admin/CashierClient.tsx` | Phase 3 | Pipe applied promo through payment confirmation |
| `byod_pos/admin/components/PaymentConfirmationDialog.tsx` | Phase 3 | Render `<PromoApplicator>` |
| `byod_pos/types.ts` | Phase 3 | Add `promoApplied` field to `POSOrder` |
| `byod_pos/api.ts` | Phase 3 | `confirmPayment` accepts and persists `promoApplied`, calls `commitPromoUsage` |
| `reservation/admin/components/AdminBookingWizard.tsx` | Phase 5 | Render `<PromoApplicator>` at confirmation step |
| `reservation/types.ts` | Phase 5 | Add `promoApplied` field to Booking |
| `reservation/api.ts` | Phase 5 | Persist + commit on booking creation |
| `service-records/admin/components/BillModal.tsx` | Phase 5 | Render `<PromoApplicator>` |
| `service-records/types.ts` | Phase 5 | Add `promoApplied` field |
| `service-records/api.ts` | Phase 5 | Persist + commit on bill finalize |
| `CLAUDE.md` | Phase 5 | Update peer-module exception clause |

---

## Conventions

- **Working directory:** `/Users/andre/Repository/clicker-universe/dev/clicker-platform-v2` for almost all tasks. Tests run from this dir via `pnpm test`.
- **Never use raw collection paths** — always import from `lib/modules/promo/constants.ts`.
- **Always normalize through transactions** for any write that touches usage counters or voucher status.
- **Test framework:** vitest + @testing-library/react. Mock Firestore at the module boundary by mocking `firebase/firestore` exports the file under test imports (see existing tests in `lib/modules/reservation/__tests__/suite3.points-guard.test.ts` for the pattern).
- **Commit messages:** Conventional Commits (`feat(promo): ...`, `test(promo): ...`, `docs(promo): ...`).

---

# Phase 1 — Foundation

Builds engine and tests in isolation. No UI. No consumer integration.

---

### Task 1: Module scaffolding — types

**Files:**
- Create: `lib/modules/promo/types.ts`

- [ ] **Step 1: Create the types file**

```ts
// lib/modules/promo/types.ts
import { Timestamp } from 'firebase/firestore';

export type PromoSource = 'POS' | 'RESERVATION' | 'SERVICE' | 'OTHER';

export type PromoTrigger = 'code' | 'auto' | 'claim';
export type PromoStatus = 'active' | 'paused' | 'archived';
export type PromoKind = 'percent' | 'fixed';
export type PromoAudience = 'public' | 'members' | 'specific';

export interface PromoConditions {
  minSubtotal?: number;
  validFrom?: Timestamp;
  validUntil?: Timestamp;
  eligibleSources: PromoSource[]; // empty array = all sources eligible
  audience: PromoAudience;
  specificMemberIds?: string[];
}

export interface Promo {
  id: string;
  siteId: string;
  name: string;
  description?: string;
  code?: string;

  kind: PromoKind;
  value: number;
  maxDiscount?: number;

  conditions: PromoConditions;

  maxUses?: number;
  perMemberLimit?: number;
  usageCount: number;

  trigger: PromoTrigger;
  costInPoints?: number;
  voucherExpiryDays?: number;

  status: PromoStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
}

export type VoucherStatus = 'active' | 'used' | 'expired';
export type VoucherIssuedVia = 'points_redemption' | 'admin_grant' | 'auto_grant';

export interface Voucher {
  id: string;
  siteId: string;
  promoId: string;
  code: string;

  ownerMemberId: string;
  ownerName?: string;

  status: VoucherStatus;
  issuedAt: Timestamp;
  expiresAt?: Timestamp;
  issuedVia: VoucherIssuedVia;

  snapshotKind: PromoKind;
  snapshotValue: number;
  snapshotMaxDiscount?: number;

  usedAt?: Timestamp;
  usedSource?: PromoSource;
  usedRefId?: string;
  usedDiscount?: number;
}

export interface PromoSettings {
  voucherCodePrefix: string;
  defaultVoucherExpiryDays: number;
  allowGuestCodes: boolean;
  updatedAt?: Timestamp;
}

export type EvaluationFailure =
  | 'not_found'
  | 'expired'
  | 'wrong_source'
  | 'min_subtotal_unmet'
  | 'usage_exhausted'
  | 'per_member_limit'
  | 'audience_mismatch'
  | 'paused'
  | 'already_used';

export type EvaluationResult =
  | {
      ok: true;
      kind: 'promo' | 'voucher';
      refId: string;
      label: string;
      discount: number;
      remainingSubtotal: number;
    }
  | {
      ok: false;
      reason: EvaluationFailure;
      message: string;
    };

export interface AppliedPromo {
  refId: string;
  kind: 'promo' | 'voucher';
  label: string;
  discount: number;
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm exec tsc --noEmit -p . 2>&1 | grep -E "promo/types" || echo "OK"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add lib/modules/promo/types.ts
git commit -m "feat(promo): add core types"
```

---

### Task 2: Constants & default settings

**Files:**
- Create: `lib/modules/promo/constants.ts`

- [ ] **Step 1: Create constants file**

```ts
// lib/modules/promo/constants.ts
import { PromoSettings } from './types';

export const PROMOS_COLLECTION = 'modules/promo/promos';
export const VOUCHERS_COLLECTION = 'modules/promo/vouchers';
export const SETTINGS_DOC = 'modules/promo/settings/config';

export const DEFAULT_PROMO_SETTINGS: Omit<PromoSettings, 'updatedAt'> = {
  voucherCodePrefix: 'VCH',
  defaultVoucherExpiryDays: 30,
  allowGuestCodes: true,
};

export const VOUCHER_CODE_BLOCK_LENGTH = 4; // 4 alphanumeric chars per block
```

- [ ] **Step 2: Commit**

```bash
git add lib/modules/promo/constants.ts
git commit -m "feat(promo): add constants and default settings"
```

---

### Task 3: Voucher code generator + tests

**Files:**
- Create: `lib/modules/promo/code-generator.ts`
- Create: `lib/modules/promo/__tests__/code-generator.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// lib/modules/promo/__tests__/code-generator.test.ts
import { describe, it, expect } from 'vitest';
import { generateVoucherCode } from '../code-generator';

describe('generateVoucherCode', () => {
  it('produces format PREFIX-XXXX-XXXX with default prefix', () => {
    const code = generateVoucherCode('VCH');
    expect(code).toMatch(/^VCH-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it('respects custom prefix (uppercased, max 5 chars)', () => {
    expect(generateVoucherCode('shop')).toMatch(/^SHOP-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(generateVoucherCode('verylongprefix')).toMatch(/^VERYL-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it('falls back to VCH when prefix is empty', () => {
    expect(generateVoucherCode('')).toMatch(/^VCH-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it('avoids ambiguous chars (no 0/O/1/I/L)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateVoucherCode('VCH');
      expect(code).not.toMatch(/[0O1IL]/);
    }
  });

  it('produces unique codes across many calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateVoucherCode('VCH'));
    expect(seen.size).toBe(1000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/modules/promo/__tests__/code-generator.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement generator**

```ts
// lib/modules/promo/code-generator.ts
import { VOUCHER_CODE_BLOCK_LENGTH } from './constants';

// Excludes ambiguous chars: 0/O/1/I/L
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomBlock(len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function generateVoucherCode(prefix: string): string {
  const cleanPrefix = (prefix || 'VCH').toUpperCase().slice(0, 5);
  const a = randomBlock(VOUCHER_CODE_BLOCK_LENGTH);
  const b = randomBlock(VOUCHER_CODE_BLOCK_LENGTH);
  return `${cleanPrefix}-${a}-${b}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test lib/modules/promo/__tests__/code-generator.test.ts`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add lib/modules/promo/code-generator.ts lib/modules/promo/__tests__/code-generator.test.ts
git commit -m "feat(promo): voucher code generator with TDD"
```

---

### Task 4: Sources registry

**Files:**
- Create: `lib/modules/promo/sources.ts`

- [ ] **Step 1: Create sources registry**

```ts
// lib/modules/promo/sources.ts
import { PromoSource } from './types';

export const PROMO_SOURCES: Record<PromoSource, { label: string; icon: string; moduleKey: string }> = {
  POS:         { label: 'POS',         icon: 'shopping-bag', moduleKey: 'byod_pos' },
  RESERVATION: { label: 'Reservation', icon: 'calendar',     moduleKey: 'reservation' },
  SERVICE:     { label: 'Service',     icon: 'wrench',       moduleKey: 'service_records' },
  OTHER:       { label: 'Other',       icon: 'tag',          moduleKey: 'other' },
};

export const PROMO_SOURCE_KEYS = Object.keys(PROMO_SOURCES) as PromoSource[];
```

- [ ] **Step 2: Commit**

```bash
git add lib/modules/promo/sources.ts
git commit -m "feat(promo): sources registry"
```

---

### Task 5: Settings API

**Files:**
- Create: `lib/modules/promo/api/settings.ts`

- [ ] **Step 1: Create settings API**

```ts
// lib/modules/promo/api/settings.ts
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PromoSettings } from '../types';
import { SETTINGS_DOC, DEFAULT_PROMO_SETTINGS } from '../constants';

export async function getPromoSettings(siteId: string): Promise<PromoSettings> {
  const ref = doc(db, 'sites', siteId, SETTINGS_DOC);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as PromoSettings;
  return DEFAULT_PROMO_SETTINGS as PromoSettings;
}

export async function updatePromoSettings(siteId: string, patch: Partial<PromoSettings>): Promise<void> {
  const ref = doc(db, 'sites', siteId, SETTINGS_DOC);
  await setDoc(ref, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/modules/promo/api/settings.ts
git commit -m "feat(promo): settings get/update API"
```

---

### Task 6: Promo CRUD API

**Files:**
- Create: `lib/modules/promo/api/promos.ts`

- [ ] **Step 1: Create promo CRUD**

```ts
// lib/modules/promo/api/promos.ts
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit,
  setDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Promo, PromoStatus } from '../types';
import { PROMOS_COLLECTION } from '../constants';

export async function listPromos(siteId: string): Promise<Promo[]> {
  const q = query(
    collection(db, 'sites', siteId, PROMOS_COLLECTION),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Promo));
}

export async function getPromo(siteId: string, promoId: string): Promise<Promo | null> {
  const ref = doc(db, 'sites', siteId, PROMOS_COLLECTION, promoId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Promo;
}

export async function findPromoByCode(siteId: string, code: string): Promise<Promo | null> {
  const upper = code.trim().toUpperCase();
  const q = query(
    collection(db, 'sites', siteId, PROMOS_COLLECTION),
    where('code', '==', upper),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Promo;
}

export async function createPromo(
  siteId: string,
  data: Omit<Promo, 'id' | 'siteId' | 'createdAt' | 'updatedAt' | 'usageCount'>
): Promise<Promo> {
  const ref = doc(collection(db, 'sites', siteId, PROMOS_COLLECTION));
  const payload: any = {
    ...data,
    siteId,
    code: data.code ? data.code.trim().toUpperCase() : null,
    usageCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  return { id: ref.id, ...payload, createdAt: Timestamp.now(), updatedAt: Timestamp.now() } as Promo;
}

export async function updatePromo(siteId: string, promoId: string, patch: Partial<Promo>): Promise<void> {
  const ref = doc(db, 'sites', siteId, PROMOS_COLLECTION, promoId);
  const cleaned: any = { ...patch, updatedAt: serverTimestamp() };
  if (patch.code !== undefined) cleaned.code = patch.code ? patch.code.trim().toUpperCase() : null;
  delete cleaned.id;
  delete cleaned.siteId;
  delete cleaned.createdAt;
  await updateDoc(ref, cleaned);
}

export async function setPromoStatus(siteId: string, promoId: string, status: PromoStatus): Promise<void> {
  await updatePromo(siteId, promoId, { status });
}

export async function deletePromo(siteId: string, promoId: string): Promise<void> {
  const ref = doc(db, 'sites', siteId, PROMOS_COLLECTION, promoId);
  await deleteDoc(ref);
}

export async function listClaimablePromos(siteId: string, memberId: string): Promise<Promo[]> {
  const q = query(
    collection(db, 'sites', siteId, PROMOS_COLLECTION),
    where('trigger', '==', 'claim'),
    where('status', '==', 'active')
  );
  const snap = await getDocs(q);
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Promo));
  return all.filter(p => {
    if (typeof p.costInPoints !== 'number' || p.costInPoints <= 0) return false;
    const aud = p.conditions.audience;
    if (aud === 'specific' && !p.conditions.specificMemberIds?.includes(memberId)) return false;
    return true;
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/modules/promo/api/promos.ts
git commit -m "feat(promo): promo CRUD API"
```

---

### Task 7: Voucher CRUD API

**Files:**
- Create: `lib/modules/promo/api/vouchers.ts`

- [ ] **Step 1: Create voucher CRUD**

```ts
// lib/modules/promo/api/vouchers.ts
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit,
  setDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Voucher, VoucherStatus } from '../types';
import { VOUCHERS_COLLECTION } from '../constants';

export async function listAllVouchers(siteId: string): Promise<Voucher[]> {
  const q = query(
    collection(db, 'sites', siteId, VOUCHERS_COLLECTION),
    orderBy('issuedAt', 'desc'),
    limit(500)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Voucher));
}

export async function listMemberVouchers(siteId: string, memberId: string): Promise<Voucher[]> {
  const q = query(
    collection(db, 'sites', siteId, VOUCHERS_COLLECTION),
    where('ownerMemberId', '==', memberId),
    orderBy('issuedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Voucher));
}

export async function findVoucherByCode(siteId: string, code: string): Promise<Voucher | null> {
  const upper = code.trim().toUpperCase();
  const q = query(
    collection(db, 'sites', siteId, VOUCHERS_COLLECTION),
    where('code', '==', upper),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Voucher;
}

export async function getVoucher(siteId: string, voucherId: string): Promise<Voucher | null> {
  const ref = doc(db, 'sites', siteId, VOUCHERS_COLLECTION, voucherId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Voucher;
}

export async function findVoucherByUsedRef(
  siteId: string,
  source: string,
  refDocId: string
): Promise<Voucher | null> {
  const q = query(
    collection(db, 'sites', siteId, VOUCHERS_COLLECTION),
    where('usedSource', '==', source),
    where('usedRefId', '==', refDocId),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Voucher;
}

export async function setVoucherStatus(siteId: string, voucherId: string, status: VoucherStatus): Promise<void> {
  const ref = doc(db, 'sites', siteId, VOUCHERS_COLLECTION, voucherId);
  await updateDoc(ref, { status });
}

export async function revokeVoucher(siteId: string, voucherId: string): Promise<void> {
  const ref = doc(db, 'sites', siteId, VOUCHERS_COLLECTION, voucherId);
  await deleteDoc(ref);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/modules/promo/api/vouchers.ts
git commit -m "feat(promo): voucher CRUD API"
```

---

### Task 8: Discount calculator (pure helper)

**Files:**
- Create: `lib/modules/promo/api/discount.ts`
- Create: `lib/modules/promo/__tests__/discount.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// lib/modules/promo/__tests__/discount.test.ts
import { describe, it, expect } from 'vitest';
import { calculateDiscount } from '../api/discount';

describe('calculateDiscount', () => {
  it('percent: applies value, capped to subtotal', () => {
    expect(calculateDiscount({ kind: 'percent', value: 20 }, 100_000)).toBe(20_000);
    expect(calculateDiscount({ kind: 'percent', value: 200 }, 100_000)).toBe(100_000); // > 100% caps at subtotal
  });

  it('percent: respects maxDiscount cap', () => {
    expect(calculateDiscount({ kind: 'percent', value: 50, maxDiscount: 30_000 }, 100_000)).toBe(30_000);
    expect(calculateDiscount({ kind: 'percent', value: 10, maxDiscount: 30_000 }, 100_000)).toBe(10_000); // under cap
  });

  it('fixed: applies value, capped to subtotal', () => {
    expect(calculateDiscount({ kind: 'fixed', value: 50_000 }, 100_000)).toBe(50_000);
    expect(calculateDiscount({ kind: 'fixed', value: 200_000 }, 100_000)).toBe(100_000); // capped
  });

  it('returns 0 for non-positive subtotal', () => {
    expect(calculateDiscount({ kind: 'percent', value: 20 }, 0)).toBe(0);
    expect(calculateDiscount({ kind: 'fixed', value: 50_000 }, -10)).toBe(0);
  });

  it('rounds to integer (no fractional currency)', () => {
    expect(calculateDiscount({ kind: 'percent', value: 33 }, 100)).toBe(33);
    expect(calculateDiscount({ kind: 'percent', value: 33.333 }, 100)).toBe(33);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/modules/promo/__tests__/discount.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement calculator**

```ts
// lib/modules/promo/api/discount.ts
import { PromoKind } from '../types';

export interface DiscountInput {
  kind: PromoKind;
  value: number;
  maxDiscount?: number;
}

export function calculateDiscount(input: DiscountInput, subtotal: number): number {
  if (subtotal <= 0) return 0;
  let raw = input.kind === 'percent'
    ? (subtotal * input.value) / 100
    : input.value;
  if (input.maxDiscount !== undefined && raw > input.maxDiscount) raw = input.maxDiscount;
  if (raw > subtotal) raw = subtotal;
  return Math.floor(raw);
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test lib/modules/promo/__tests__/discount.test.ts`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add lib/modules/promo/api/discount.ts lib/modules/promo/__tests__/discount.test.ts
git commit -m "feat(promo): discount calculator with TDD"
```

---

### Task 9: Evaluator — evaluatePromo with full rule matrix (TDD)

**Files:**
- Create: `lib/modules/promo/api/evaluator.ts`
- Create: `lib/modules/promo/__tests__/evaluator.test.ts`

- [ ] **Step 1: Write failing tests for happy paths**

```ts
// lib/modules/promo/__tests__/evaluator.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { evaluatePromo } from '../api/evaluator';
import { Promo, Voucher, PromoSettings } from '../types';

vi.mock('../api/promos', () => ({
  findPromoByCode: vi.fn(),
  getPromo: vi.fn(),
}));
vi.mock('../api/vouchers', () => ({
  findVoucherByCode: vi.fn(),
}));
vi.mock('../api/settings', () => ({
  getPromoSettings: vi.fn(),
}));

import * as promosApi from '../api/promos';
import * as vouchersApi from '../api/vouchers';
import * as settingsApi from '../api/settings';

const ts = (date: Date) => Timestamp.fromDate(date);
const NOW = new Date('2026-04-28T10:00:00Z');

function makePromo(p: Partial<Promo> = {}): Promo {
  return {
    id: 'p1',
    siteId: 's1',
    name: 'Test Promo',
    kind: 'percent',
    value: 20,
    conditions: {
      eligibleSources: [],
      audience: 'public',
    },
    usageCount: 0,
    trigger: 'code',
    status: 'active',
    createdAt: ts(NOW),
    updatedAt: ts(NOW),
    ...p,
  };
}

const DEFAULT_SETTINGS: PromoSettings = {
  voucherCodePrefix: 'VCH',
  defaultVoucherExpiryDays: 30,
  allowGuestCodes: true,
};

describe('evaluatePromo — happy path code lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (settingsApi.getPromoSettings as any).mockResolvedValue(DEFAULT_SETTINGS);
  });

  it('matches an active code promo and returns capped discount', async () => {
    (promosApi.findPromoByCode as any).mockResolvedValue(
      makePromo({ code: 'SUMMER20', kind: 'percent', value: 20, maxDiscount: 100_000 })
    );

    const r = await evaluatePromo({
      siteId: 's1', source: 'POS', subtotal: 200_000, code: 'summer20',
    });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.kind).toBe('promo');
      expect(r.discount).toBe(40_000);
      expect(r.remainingSubtotal).toBe(160_000);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/modules/promo/__tests__/evaluator.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement evaluator (initial)**

```ts
// lib/modules/promo/api/evaluator.ts
import { Timestamp } from 'firebase/firestore';
import { Promo, Voucher, EvaluationResult, PromoSource, EvaluationFailure } from '../types';
import { findPromoByCode, getPromo } from './promos';
import { findVoucherByCode } from './vouchers';
import { getPromoSettings } from './settings';
import { calculateDiscount } from './discount';

interface EvaluateInput {
  siteId: string;
  source: PromoSource;
  subtotal: number;
  memberId?: string;
  code?: string;
  promoIdOverride?: string; // for direct promoId application (internal)
}

function fail(reason: EvaluationFailure, message: string): EvaluationResult {
  return { ok: false, reason, message };
}

function isWithinWindow(p: Promo, now: Date): boolean {
  if (p.conditions.validFrom && p.conditions.validFrom.toDate() > now) return false;
  if (p.conditions.validUntil && p.conditions.validUntil.toDate() < now) return false;
  return true;
}

function sourceEligible(p: Promo, source: PromoSource): boolean {
  const list = p.conditions.eligibleSources || [];
  if (list.length === 0) return true;
  return list.includes(source);
}

function audienceMatches(p: Promo, memberId: string | undefined, allowGuest: boolean): boolean {
  if (!allowGuest && !memberId) return false;
  const aud = p.conditions.audience;
  if (aud === 'public') return true;
  if (aud === 'members') return Boolean(memberId);
  if (aud === 'specific') return Boolean(memberId && p.conditions.specificMemberIds?.includes(memberId));
  return false;
}

function describeLabel(p: Pick<Promo, 'kind' | 'value' | 'maxDiscount' | 'name'>): string {
  if (p.kind === 'percent') {
    const cap = p.maxDiscount ? ` (max ${p.maxDiscount.toLocaleString('id-ID')})` : '';
    return `${p.value}% off${cap}`;
  }
  return `${p.value.toLocaleString('id-ID')} off`;
}

async function evaluatePromoRule(
  promo: Promo,
  input: EvaluateInput,
  allowGuest: boolean
): Promise<EvaluationResult> {
  const now = new Date();

  if (promo.status !== 'active') return fail('paused', 'This promo is not active.');
  if (!isWithinWindow(promo, now)) return fail('expired', 'This promo is outside its valid window.');
  if (!sourceEligible(promo, input.source)) return fail('wrong_source', 'This promo cannot be used here.');
  if (!audienceMatches(promo, input.memberId, allowGuest))
    return fail('audience_mismatch', 'You are not eligible for this promo.');
  if (promo.conditions.minSubtotal && input.subtotal < promo.conditions.minSubtotal)
    return fail('min_subtotal_unmet',
      `Minimum spend ${promo.conditions.minSubtotal.toLocaleString('id-ID')} required.`);
  if (promo.maxUses !== undefined && promo.maxUses !== null && promo.usageCount >= promo.maxUses)
    return fail('usage_exhausted', 'This promo has reached its usage limit.');

  const discount = calculateDiscount(
    { kind: promo.kind, value: promo.value, maxDiscount: promo.maxDiscount },
    input.subtotal
  );
  if (discount <= 0) return fail('min_subtotal_unmet', 'No discount applicable.');

  return {
    ok: true,
    kind: 'promo',
    refId: promo.id,
    label: describeLabel(promo),
    discount,
    remainingSubtotal: input.subtotal - discount,
  };
}

async function evaluateVoucher(voucher: Voucher, input: EvaluateInput): Promise<EvaluationResult> {
  const now = new Date();

  if (voucher.status === 'used') return fail('already_used', 'This voucher has already been used.');
  if (voucher.status === 'expired') return fail('expired', 'This voucher has expired.');
  if (voucher.expiresAt && voucher.expiresAt.toDate() < now) return fail('expired', 'This voucher has expired.');
  if (!input.memberId || voucher.ownerMemberId !== input.memberId)
    return fail('audience_mismatch', 'This voucher belongs to another member.');

  // Voucher's underlying promo controls source eligibility.
  const promo = await getPromo(input.siteId, voucher.promoId);
  if (!promo) return fail('not_found', 'Promo for this voucher is missing.');
  if (!sourceEligible(promo, input.source)) return fail('wrong_source', 'This voucher cannot be used here.');
  if (promo.conditions.minSubtotal && input.subtotal < promo.conditions.minSubtotal)
    return fail('min_subtotal_unmet',
      `Minimum spend ${promo.conditions.minSubtotal.toLocaleString('id-ID')} required.`);

  const discount = calculateDiscount(
    { kind: voucher.snapshotKind, value: voucher.snapshotValue, maxDiscount: voucher.snapshotMaxDiscount },
    input.subtotal
  );
  if (discount <= 0) return fail('min_subtotal_unmet', 'No discount applicable.');

  return {
    ok: true,
    kind: 'voucher',
    refId: voucher.id,
    label: describeLabel({
      kind: voucher.snapshotKind,
      value: voucher.snapshotValue,
      maxDiscount: voucher.snapshotMaxDiscount,
      name: 'voucher',
    }),
    discount,
    remainingSubtotal: input.subtotal - discount,
  };
}

export async function evaluatePromo(input: EvaluateInput): Promise<EvaluationResult> {
  const settings = await getPromoSettings(input.siteId);
  const allowGuest = settings.allowGuestCodes;

  if (input.promoIdOverride) {
    const promo = await getPromo(input.siteId, input.promoIdOverride);
    if (!promo) return fail('not_found', 'Promo not found.');
    return evaluatePromoRule(promo, input, allowGuest);
  }

  const code = input.code?.trim();
  if (!code) return fail('not_found', 'No code provided.');

  // Try voucher first (member-bound, single-use); fall back to public promo code.
  const voucher = await findVoucherByCode(input.siteId, code);
  if (voucher) return evaluateVoucher(voucher, input);

  const promo = await findPromoByCode(input.siteId, code);
  if (promo) return evaluatePromoRule(promo, input, allowGuest);

  return fail('not_found', 'Code not recognized.');
}

export async function findAutoApplicable(input: Omit<EvaluateInput, 'code' | 'promoIdOverride'>): Promise<EvaluationResult[]> {
  // Implementation in Task 10
  return [];
}
```

- [ ] **Step 4: Run test — should now pass for happy path**

Run: `pnpm test lib/modules/promo/__tests__/evaluator.test.ts`
Expected: PASS (1/1)

- [ ] **Step 5: Add failure-path tests**

Append to `lib/modules/promo/__tests__/evaluator.test.ts`:

```ts
describe('evaluatePromo — failure paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (settingsApi.getPromoSettings as any).mockResolvedValue(DEFAULT_SETTINGS);
  });

  it('rejects unknown code', async () => {
    (vouchersApi.findVoucherByCode as any).mockResolvedValue(null);
    (promosApi.findPromoByCode as any).mockResolvedValue(null);
    const r = await evaluatePromo({ siteId: 's1', source: 'POS', subtotal: 100_000, code: 'BAD' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });

  it('rejects when allowGuestCodes=false and no memberId', async () => {
    (settingsApi.getPromoSettings as any).mockResolvedValue({ ...DEFAULT_SETTINGS, allowGuestCodes: false });
    (promosApi.findPromoByCode as any).mockResolvedValue(makePromo({ code: 'PUB' }));
    (vouchersApi.findVoucherByCode as any).mockResolvedValue(null);
    const r = await evaluatePromo({ siteId: 's1', source: 'POS', subtotal: 100_000, code: 'PUB' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('audience_mismatch');
  });

  it('rejects expired window', async () => {
    (vouchersApi.findVoucherByCode as any).mockResolvedValue(null);
    (promosApi.findPromoByCode as any).mockResolvedValue(makePromo({
      code: 'PAST',
      conditions: {
        eligibleSources: [],
        audience: 'public',
        validUntil: ts(new Date('2026-01-01T00:00:00Z')),
      },
    }));
    const r = await evaluatePromo({ siteId: 's1', source: 'POS', subtotal: 100_000, code: 'PAST' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('expired');
  });

  it('rejects wrong source', async () => {
    (vouchersApi.findVoucherByCode as any).mockResolvedValue(null);
    (promosApi.findPromoByCode as any).mockResolvedValue(makePromo({
      code: 'POS_ONLY',
      conditions: { eligibleSources: ['POS'], audience: 'public' },
    }));
    const r = await evaluatePromo({ siteId: 's1', source: 'RESERVATION', subtotal: 100_000, code: 'POS_ONLY' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('wrong_source');
  });

  it('rejects under-min subtotal', async () => {
    (vouchersApi.findVoucherByCode as any).mockResolvedValue(null);
    (promosApi.findPromoByCode as any).mockResolvedValue(makePromo({
      code: 'BIG',
      conditions: { eligibleSources: [], audience: 'public', minSubtotal: 200_000 },
    }));
    const r = await evaluatePromo({ siteId: 's1', source: 'POS', subtotal: 50_000, code: 'BIG' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('min_subtotal_unmet');
  });

  it('rejects when usage exhausted', async () => {
    (vouchersApi.findVoucherByCode as any).mockResolvedValue(null);
    (promosApi.findPromoByCode as any).mockResolvedValue(makePromo({
      code: 'CAP', maxUses: 5, usageCount: 5,
    }));
    const r = await evaluatePromo({ siteId: 's1', source: 'POS', subtotal: 100_000, code: 'CAP' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('usage_exhausted');
  });

  it('rejects paused promo', async () => {
    (vouchersApi.findVoucherByCode as any).mockResolvedValue(null);
    (promosApi.findPromoByCode as any).mockResolvedValue(makePromo({ code: 'OFF', status: 'paused' }));
    const r = await evaluatePromo({ siteId: 's1', source: 'POS', subtotal: 100_000, code: 'OFF' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('paused');
  });
});

describe('evaluatePromo — voucher path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (settingsApi.getPromoSettings as any).mockResolvedValue(DEFAULT_SETTINGS);
  });

  it('rejects voucher belonging to another member', async () => {
    (vouchersApi.findVoucherByCode as any).mockResolvedValue({
      id: 'v1', siteId: 's1', promoId: 'p1', code: 'VCH-AAAA-BBBB',
      ownerMemberId: 'other', status: 'active', issuedAt: ts(NOW),
      issuedVia: 'admin_grant', snapshotKind: 'fixed', snapshotValue: 50_000,
    });
    const r = await evaluatePromo({ siteId: 's1', source: 'POS', subtotal: 100_000, memberId: 'me', code: 'VCH-AAAA-BBBB' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('audience_mismatch');
  });

  it('rejects already-used voucher', async () => {
    (vouchersApi.findVoucherByCode as any).mockResolvedValue({
      id: 'v1', siteId: 's1', promoId: 'p1', code: 'VCH-AAAA-BBBB',
      ownerMemberId: 'me', status: 'used', issuedAt: ts(NOW),
      issuedVia: 'admin_grant', snapshotKind: 'fixed', snapshotValue: 50_000,
    });
    const r = await evaluatePromo({ siteId: 's1', source: 'POS', subtotal: 100_000, memberId: 'me', code: 'VCH-AAAA-BBBB' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('already_used');
  });
});
```

- [ ] **Step 6: Run all evaluator tests**

Run: `pnpm test lib/modules/promo/__tests__/evaluator.test.ts`
Expected: PASS (10/10)

- [ ] **Step 7: Commit**

```bash
git add lib/modules/promo/api/evaluator.ts lib/modules/promo/__tests__/evaluator.test.ts
git commit -m "feat(promo): rule evaluator with TDD coverage"
```

---

### Task 10: Auto-applicable finder

**Files:**
- Modify: `lib/modules/promo/api/evaluator.ts`
- Create: `lib/modules/promo/__tests__/auto-apply.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// lib/modules/promo/__tests__/auto-apply.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { findAutoApplicable } from '../api/evaluator';
import { Promo } from '../types';

vi.mock('../api/promos', () => ({
  listPromos: vi.fn(),
  getPromo: vi.fn(),
  findPromoByCode: vi.fn(),
}));
vi.mock('../api/vouchers', () => ({ findVoucherByCode: vi.fn() }));
vi.mock('../api/settings', () => ({
  getPromoSettings: vi.fn().mockResolvedValue({
    voucherCodePrefix: 'VCH', defaultVoucherExpiryDays: 30, allowGuestCodes: true,
  }),
}));

import * as promosApi from '../api/promos';

const ts = (d: Date) => Timestamp.fromDate(d);
function p(over: Partial<Promo>): Promo {
  return {
    id: over.id ?? 'p1',
    siteId: 's1',
    name: over.name ?? 'Auto',
    kind: 'percent',
    value: 10,
    conditions: { eligibleSources: [], audience: 'public' },
    usageCount: 0,
    trigger: 'auto',
    status: 'active',
    createdAt: ts(new Date()),
    updatedAt: ts(new Date()),
    ...over,
  };
}

describe('findAutoApplicable', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns only auto-trigger active promos that match', async () => {
    (promosApi.listPromos as any).mockResolvedValue([
      p({ id: 'a', trigger: 'auto', value: 10 }),                        // matches
      p({ id: 'b', trigger: 'code', value: 50 }),                        // wrong trigger
      p({ id: 'c', trigger: 'auto', status: 'paused' }),                 // paused
      p({ id: 'd', trigger: 'auto', conditions: { eligibleSources: [], audience: 'public', minSubtotal: 500_000 } }), // under-min
    ]);

    const r = await findAutoApplicable({ siteId: 's1', source: 'POS', subtotal: 100_000 });
    expect(r.length).toBe(1);
    if (r[0].ok) expect(r[0].refId).toBe('a');
  });

  it('sorts by discount value descending', async () => {
    (promosApi.listPromos as any).mockResolvedValue([
      p({ id: 'small', trigger: 'auto', kind: 'percent', value: 5 }),    // 5K off 100K
      p({ id: 'big',   trigger: 'auto', kind: 'percent', value: 20 }),   // 20K off 100K
    ]);
    const r = await findAutoApplicable({ siteId: 's1', source: 'POS', subtotal: 100_000 });
    expect(r.length).toBe(2);
    expect(r[0].ok && r[0].refId).toBe('big');
    expect(r[1].ok && r[1].refId).toBe('small');
  });
});
```

- [ ] **Step 2: Run test — fails because findAutoApplicable returns []**

Run: `pnpm test lib/modules/promo/__tests__/auto-apply.test.ts`
Expected: FAIL

- [ ] **Step 3: Replace stub in `evaluator.ts`**

Update `lib/modules/promo/api/evaluator.ts`. Add import at top:

```ts
import { listPromos } from './promos';
```

Replace the `findAutoApplicable` stub with:

```ts
export async function findAutoApplicable(
  input: Omit<EvaluateInput, 'code' | 'promoIdOverride'>
): Promise<EvaluationResult[]> {
  const settings = await getPromoSettings(input.siteId);
  const allowGuest = settings.allowGuestCodes;
  const all = await listPromos(input.siteId);
  const autos = all.filter(p => p.trigger === 'auto');
  const results: EvaluationResult[] = [];
  for (const promo of autos) {
    const r = await evaluatePromoRule(promo, { ...input, code: undefined, promoIdOverride: undefined } as any, allowGuest);
    if (r.ok) results.push(r);
  }
  return results.sort((a, b) => (a.ok && b.ok ? b.discount - a.discount : 0));
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test lib/modules/promo/__tests__/auto-apply.test.ts`
Expected: PASS (2/2)

- [ ] **Step 5: Commit**

```bash
git add lib/modules/promo/api/evaluator.ts lib/modules/promo/__tests__/auto-apply.test.ts
git commit -m "feat(promo): auto-applicable finder, highest-discount-first"
```

---

### Task 11: Commit and reverse usage (transactional)

**Files:**
- Create: `lib/modules/promo/api/commit.ts`
- Create: `lib/modules/promo/__tests__/commit.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// lib/modules/promo/__tests__/commit.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { Voucher, Promo } from '../types';

// Fake transaction recorder
const recorded: Array<{ op: string; ref: string; data?: any }> = [];

vi.mock('firebase/firestore', async (orig) => {
  const actual = await orig<typeof import('firebase/firestore')>();
  return {
    ...actual,
    runTransaction: vi.fn(async (_db: any, fn: any) => {
      const tx = {
        get: vi.fn(async (ref: any) => ref.__snap),
        update: vi.fn((ref: any, data: any) => recorded.push({ op: 'update', ref: ref.__path, data })),
        set: vi.fn((ref: any, data: any) => recorded.push({ op: 'set', ref: ref.__path, data })),
      };
      return fn(tx);
    }),
    doc: vi.fn((_db: any, ...path: string[]) => ({ __path: path.join('/'), __snap: undefined })),
    serverTimestamp: () => 'SERVER_TS',
    Timestamp: actual.Timestamp,
  };
});

vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('../api/vouchers', () => ({
  findVoucherByUsedRef: vi.fn(),
  getVoucher: vi.fn(),
}));
vi.mock('../api/promos', () => ({ getPromo: vi.fn() }));
vi.mock('@/lib/modules/membership/api', () => ({ awardPoints: vi.fn() }));

import { commitPromoUsage, reversePromoUsage } from '../api/commit';
import * as vouchersApi from '../api/vouchers';
import * as promosApi from '../api/promos';
import * as membershipApi from '@/lib/modules/membership/api';
import * as fs from 'firebase/firestore';

beforeEach(() => {
  recorded.length = 0;
  vi.clearAllMocks();
});

describe('commitPromoUsage', () => {
  it('promo: increments usageCount only', async () => {
    // Set the mock doc snapshot for the promo
    (fs.doc as any).mockImplementation((_db: any, ...p: string[]) => {
      const path = p.join('/');
      return {
        __path: path,
        __snap: { exists: () => true, data: () => ({ usageCount: 3 }) },
      };
    });

    await commitPromoUsage({
      siteId: 's1', refId: 'p1', kind: 'promo', source: 'POS',
      refDocId: 'order-9', discountApplied: 20_000,
    });

    const updates = recorded.filter(r => r.op === 'update');
    expect(updates.length).toBeGreaterThanOrEqual(1);
    expect(updates[0].ref).toContain('promos/p1');
    expect(updates[0].data.usageCount).toBe(4);
  });

  it('voucher: marks used + increments parent promo usage', async () => {
    (fs.doc as any).mockImplementation((_db: any, ...p: string[]) => {
      const path = p.join('/');
      const isVoucher = path.includes('/vouchers/');
      return {
        __path: path,
        __snap: {
          exists: () => true,
          data: () => isVoucher
            ? { promoId: 'p1', status: 'active', usedAt: null }
            : { usageCount: 0 },
        },
      };
    });

    await commitPromoUsage({
      siteId: 's1', refId: 'v1', kind: 'voucher', source: 'POS',
      refDocId: 'order-9', discountApplied: 50_000, memberId: 'me',
    });

    const updates = recorded.filter(r => r.op === 'update');
    const voucherUpdate = updates.find(u => u.ref.includes('/vouchers/v1'));
    expect(voucherUpdate?.data.status).toBe('used');
    expect(voucherUpdate?.data.usedSource).toBe('POS');
    expect(voucherUpdate?.data.usedRefId).toBe('order-9');
    expect(voucherUpdate?.data.usedDiscount).toBe(50_000);
    const promoUpdate = updates.find(u => u.ref.includes('/promos/p1'));
    expect(promoUpdate?.data.usageCount).toBe(1);
  });
});

describe('reversePromoUsage', () => {
  it('idempotent when no voucher matches refDocId and no promo to reverse', async () => {
    (vouchersApi.findVoucherByUsedRef as any).mockResolvedValue(null);
    await expect(reversePromoUsage({ siteId: 's1', source: 'POS', refDocId: 'unknown' })).resolves.toBeUndefined();
  });

  it('voucher: restores to active and refunds points if points_redemption', async () => {
    (vouchersApi.findVoucherByUsedRef as any).mockResolvedValue({
      id: 'v1', siteId: 's1', promoId: 'p1',
      ownerMemberId: 'me', status: 'used', issuedVia: 'points_redemption',
      issuedAt: Timestamp.now(), code: 'VCH-AAAA-BBBB',
      snapshotKind: 'fixed', snapshotValue: 50_000,
    });
    (promosApi.getPromo as any).mockResolvedValue({
      id: 'p1', costInPoints: 1500, usageCount: 1,
    });
    (fs.doc as any).mockImplementation((_db: any, ...p: string[]) => ({
      __path: p.join('/'),
      __snap: { exists: () => true, data: () => ({ usageCount: 1 }) },
    }));

    await reversePromoUsage({ siteId: 's1', source: 'POS', refDocId: 'order-9' });

    const updates = recorded.filter(r => r.op === 'update');
    const voucherUpdate = updates.find(u => u.ref.includes('/vouchers/v1'));
    expect(voucherUpdate?.data.status).toBe('active');
    expect(membershipApi.awardPoints).toHaveBeenCalledWith(
      's1', 'me', 1500, 'PROMO_REVERSAL', 'order-9', expect.any(String)
    );
  });
});
```

- [ ] **Step 2: Implement commit.ts**

```ts
// lib/modules/promo/api/commit.ts
import { doc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PROMOS_COLLECTION, VOUCHERS_COLLECTION } from '../constants';
import { PromoSource } from '../types';
import { findVoucherByUsedRef } from './vouchers';
import { getPromo } from './promos';
import { awardPoints } from '@/lib/modules/membership/api';

interface CommitInput {
  siteId: string;
  refId: string;
  kind: 'promo' | 'voucher';
  source: PromoSource;
  refDocId: string;
  memberId?: string;
  discountApplied: number;
}

export async function commitPromoUsage(input: CommitInput): Promise<void> {
  const { siteId, refId, kind, source, refDocId, discountApplied } = input;

  await runTransaction(db, async (tx) => {
    if (kind === 'voucher') {
      const voucherRef = doc(db, 'sites', siteId, VOUCHERS_COLLECTION, refId);
      const vSnap = await tx.get(voucherRef);
      if (!vSnap.exists()) return;
      const v = vSnap.data() as any;
      if (v.status === 'used') return; // idempotent

      tx.update(voucherRef, {
        status: 'used',
        usedAt: serverTimestamp(),
        usedSource: source,
        usedRefId: refDocId,
        usedDiscount: discountApplied,
      });

      // Bump parent promo's usageCount
      const promoRef = doc(db, 'sites', siteId, PROMOS_COLLECTION, v.promoId);
      const pSnap = await tx.get(promoRef);
      if (pSnap.exists()) {
        const cur = pSnap.data().usageCount || 0;
        tx.update(promoRef, { usageCount: cur + 1, updatedAt: serverTimestamp() });
      }
    } else {
      const promoRef = doc(db, 'sites', siteId, PROMOS_COLLECTION, refId);
      const pSnap = await tx.get(promoRef);
      if (!pSnap.exists()) return;
      const cur = pSnap.data().usageCount || 0;
      tx.update(promoRef, { usageCount: cur + 1, updatedAt: serverTimestamp() });
    }
  });
}

interface ReverseInput {
  siteId: string;
  source: PromoSource;
  refDocId: string;
}

export async function reversePromoUsage(input: ReverseInput): Promise<void> {
  const { siteId, source, refDocId } = input;

  const voucher = await findVoucherByUsedRef(siteId, source, refDocId);

  await runTransaction(db, async (tx) => {
    if (voucher) {
      const voucherRef = doc(db, 'sites', siteId, VOUCHERS_COLLECTION, voucher.id);
      const vSnap = await tx.get(voucherRef);
      if (!vSnap.exists()) return;
      const v = vSnap.data() as any;
      if (v.status !== 'used') return; // idempotent

      tx.update(voucherRef, {
        status: 'active',
        usedAt: null,
        usedSource: null,
        usedRefId: null,
        usedDiscount: null,
      });

      const promoRef = doc(db, 'sites', siteId, PROMOS_COLLECTION, v.promoId);
      const pSnap = await tx.get(promoRef);
      if (pSnap.exists()) {
        const cur = pSnap.data().usageCount || 0;
        if (cur > 0) tx.update(promoRef, { usageCount: cur - 1, updatedAt: serverTimestamp() });
      }
    }
  });

  // Refund points outside the promo transaction (membership handles its own tx)
  if (voucher && voucher.issuedVia === 'points_redemption') {
    const promo = await getPromo(siteId, voucher.promoId);
    if (promo?.costInPoints && promo.costInPoints > 0 && voucher.ownerMemberId) {
      await awardPoints(
        siteId,
        voucher.ownerMemberId,
        promo.costInPoints,
        'PROMO_REVERSAL',
        refDocId,
        `Refund for reversed promo ${promo.name}`
      );
    }
  }
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm test lib/modules/promo/__tests__/commit.test.ts`
Expected: PASS (4/4)

- [ ] **Step 4: Commit**

```bash
git add lib/modules/promo/api/commit.ts lib/modules/promo/__tests__/commit.test.ts
git commit -m "feat(promo): commit/reverse usage transactions with TDD"
```

---

### Task 12: Claim & grant (mint vouchers)

**Files:**
- Create: `lib/modules/promo/api/claim.ts`
- Create: `lib/modules/promo/__tests__/claim.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// lib/modules/promo/__tests__/claim.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Timestamp } from 'firebase/firestore';

const recorded: any[] = [];

vi.mock('firebase/firestore', async (orig) => {
  const actual = await orig<typeof import('firebase/firestore')>();
  return {
    ...actual,
    runTransaction: vi.fn(async (_db: any, fn: any) => {
      const tx = {
        get: vi.fn(async (ref: any) => ref.__snap),
        set: vi.fn((ref: any, data: any) => recorded.push({ op: 'set', ref: ref.__path, data })),
        update: vi.fn((ref: any, data: any) => recorded.push({ op: 'update', ref: ref.__path, data })),
      };
      return fn(tx);
    }),
    doc: vi.fn((_db: any, ...p: string[]) => ({ __path: p.join('/'), __snap: undefined })),
    collection: vi.fn(() => ({ id: 'auto-id' })),
    serverTimestamp: () => 'SERVER_TS',
    Timestamp: actual.Timestamp,
  };
});

vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('../api/promos', () => ({ getPromo: vi.fn() }));
vi.mock('../api/settings', () => ({
  getPromoSettings: vi.fn().mockResolvedValue({
    voucherCodePrefix: 'VCH', defaultVoucherExpiryDays: 30, allowGuestCodes: true,
  }),
}));
vi.mock('@/lib/modules/membership/api', () => ({
  awardPoints: vi.fn(),
  findMemberByAuthId: vi.fn(),
}));

import { claimPromoForPoints, grantVoucher } from '../api/claim';
import * as promosApi from '../api/promos';
import * as membershipApi from '@/lib/modules/membership/api';
import * as fs from 'firebase/firestore';

beforeEach(() => {
  recorded.length = 0;
  vi.clearAllMocks();
});

describe('claimPromoForPoints', () => {
  it('rejects when promo is not claim-trigger', async () => {
    (promosApi.getPromo as any).mockResolvedValue({
      id: 'p1', trigger: 'code', costInPoints: 1500, status: 'active',
      kind: 'fixed', value: 50_000, conditions: { eligibleSources: [], audience: 'members' },
    });
    await expect(
      claimPromoForPoints({ siteId: 's1', promoId: 'p1', memberId: 'me' })
    ).rejects.toThrow(/not claimable/i);
  });

  it('rejects when costInPoints is missing', async () => {
    (promosApi.getPromo as any).mockResolvedValue({
      id: 'p1', trigger: 'claim', costInPoints: 0, status: 'active',
      kind: 'fixed', value: 50_000, conditions: { eligibleSources: [], audience: 'members' },
    });
    await expect(
      claimPromoForPoints({ siteId: 's1', promoId: 'p1', memberId: 'me' })
    ).rejects.toThrow(/cost in points/i);
  });

  it('mints voucher with snapshot and deducts points', async () => {
    (promosApi.getPromo as any).mockResolvedValue({
      id: 'p1', name: 'Reward', trigger: 'claim', costInPoints: 1500,
      status: 'active', kind: 'fixed', value: 50_000,
      voucherExpiryDays: 30,
      conditions: { eligibleSources: [], audience: 'members' },
    });

    (fs.doc as any).mockImplementation((_db: any, ...p: string[]) => ({
      __path: p.join('/'),
      __snap: { exists: () => true, data: () => ({ currentPoints: 5000 }) },
    }));

    const v = await claimPromoForPoints({ siteId: 's1', promoId: 'p1', memberId: 'me' });

    expect(v.status).toBe('active');
    expect(v.snapshotKind).toBe('fixed');
    expect(v.snapshotValue).toBe(50_000);
    expect(v.issuedVia).toBe('points_redemption');
    expect(v.code).toMatch(/^VCH-/);

    // points were deducted via membership.awardPoints with negative delta
    expect(membershipApi.awardPoints).toHaveBeenCalledWith(
      's1', 'me', -1500, 'PROMO_CLAIM', expect.any(String), expect.any(String)
    );
  });
});

describe('grantVoucher', () => {
  it('mints voucher via admin_grant', async () => {
    (promosApi.getPromo as any).mockResolvedValue({
      id: 'p1', name: 'Birthday', trigger: 'claim',
      status: 'active', kind: 'fixed', value: 25_000,
      voucherExpiryDays: 60,
      conditions: { eligibleSources: [], audience: 'members' },
    });
    const v = await grantVoucher({ siteId: 's1', promoId: 'p1', memberId: 'me' });
    expect(v.issuedVia).toBe('admin_grant');
    expect(v.snapshotValue).toBe(25_000);
  });
});
```

- [ ] **Step 2: Implement claim.ts**

```ts
// lib/modules/promo/api/claim.ts
import { collection, doc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Voucher } from '../types';
import { VOUCHERS_COLLECTION } from '../constants';
import { getPromo } from './promos';
import { getPromoSettings } from './settings';
import { generateVoucherCode } from '../code-generator';
import { awardPoints } from '@/lib/modules/membership/api';

interface ClaimInput {
  siteId: string;
  promoId: string;
  memberId: string;
}

interface GrantInput extends ClaimInput {
  expiryOverrideDays?: number;
}

function computeExpiry(days: number | undefined, fallbackDays: number): Timestamp | undefined {
  const d = days ?? fallbackDays;
  if (!d || d <= 0) return undefined;
  const exp = new Date();
  exp.setDate(exp.getDate() + d);
  return Timestamp.fromDate(exp);
}

async function buildVoucher(
  input: ClaimInput,
  issuedVia: Voucher['issuedVia'],
  expiryDaysOverride?: number
): Promise<Voucher> {
  const promo = await getPromo(input.siteId, input.promoId);
  if (!promo) throw new Error('Promo not found.');
  if (promo.trigger !== 'claim') throw new Error('Promo is not claimable.');
  if (promo.status !== 'active') throw new Error('Promo is not active.');

  const settings = await getPromoSettings(input.siteId);
  const code = generateVoucherCode(settings.voucherCodePrefix);

  const newRef = doc(collection(db, 'sites', input.siteId, VOUCHERS_COLLECTION));
  const expiresAt = computeExpiry(expiryDaysOverride ?? promo.voucherExpiryDays, settings.defaultVoucherExpiryDays);

  const voucher: Voucher = {
    id: newRef.id,
    siteId: input.siteId,
    promoId: promo.id,
    code,
    ownerMemberId: input.memberId,
    status: 'active',
    issuedAt: Timestamp.now(),
    expiresAt,
    issuedVia,
    snapshotKind: promo.kind,
    snapshotValue: promo.value,
    snapshotMaxDiscount: promo.maxDiscount,
  };

  await runTransaction(db, async (tx) => {
    tx.set(newRef, {
      ...voucher,
      issuedAt: serverTimestamp(),
    });
  });

  return voucher;
}

export async function claimPromoForPoints(input: ClaimInput): Promise<Voucher> {
  const promo = await getPromo(input.siteId, input.promoId);
  if (!promo) throw new Error('Promo not found.');
  if (promo.trigger !== 'claim') throw new Error('Promo is not claimable.');
  if (!promo.costInPoints || promo.costInPoints <= 0) throw new Error('Promo has no cost in points.');

  const voucher = await buildVoucher(input, 'points_redemption');

  // Deduct points (negative delta) — membership records its own transaction
  await awardPoints(
    input.siteId,
    input.memberId,
    -promo.costInPoints,
    'PROMO_CLAIM',
    voucher.id,
    `Redeemed ${promo.costInPoints} pts for ${promo.name}`
  );

  return voucher;
}

export async function grantVoucher(input: GrantInput): Promise<Voucher> {
  return buildVoucher(input, 'admin_grant', input.expiryOverrideDays);
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm test lib/modules/promo/__tests__/claim.test.ts`
Expected: PASS (4/4)

- [ ] **Step 4: Commit**

```bash
git add lib/modules/promo/api/claim.ts lib/modules/promo/__tests__/claim.test.ts
git commit -m "feat(promo): claim and grant voucher minting with TDD"
```

---

### Task 13: Public API facade

**Files:**
- Create: `lib/modules/promo/api.ts`

- [ ] **Step 1: Create the facade re-export**

```ts
// lib/modules/promo/api.ts
// Public API surface — other modules MUST import from this file only.
export { evaluatePromo, findAutoApplicable } from './api/evaluator';
export { commitPromoUsage, reversePromoUsage } from './api/commit';
export { claimPromoForPoints, grantVoucher } from './api/claim';
export {
  listPromos, getPromo, findPromoByCode, createPromo,
  updatePromo, setPromoStatus, deletePromo, listClaimablePromos,
} from './api/promos';
export {
  listAllVouchers, listMemberVouchers, findVoucherByCode, getVoucher,
  setVoucherStatus, revokeVoucher,
} from './api/vouchers';
export { getPromoSettings, updatePromoSettings } from './api/settings';
export { PROMO_SOURCES, PROMO_SOURCE_KEYS } from './sources';
export type {
  Promo, Voucher, PromoSource, PromoTrigger, PromoStatus, PromoKind,
  PromoAudience, PromoConditions, PromoSettings,
  EvaluationResult, EvaluationFailure, AppliedPromo,
  VoucherStatus, VoucherIssuedVia,
} from './types';
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm exec tsc --noEmit -p . 2>&1 | grep -E "promo/api" || echo "OK"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add lib/modules/promo/api.ts
git commit -m "feat(promo): public API facade"
```

---

### Phase 1 checkpoint

- [ ] **Run all promo tests; ensure no test imports from outside `api/` files in a way that breaks the boundary**

Run: `pnpm test lib/modules/promo`
Expected: ALL PASS

---

# Phase 2 — Admin UX

Builds the admin pages so merchants can create promos before any consumer integration.

---

### Task 14: Register icons + module definition

**Files:**
- Modify: `lib/modules/registry.ts`
- Modify: `lib/modules/definitions.ts`
- Modify: `scripts/seed-modules.ts`

- [ ] **Step 1: Add `tag` and `ticket` icons to MODULE_ICONS**

In `lib/modules/registry.ts`, add to the imports:

```ts
import { /* existing... */ Tag, Ticket } from 'lucide-react';
```

And to the `MODULE_ICONS` object:

```ts
'tag': Tag,
'ticket': Ticket,
```

- [ ] **Step 2: Add `promo` to STATIC_MODULE_DEFINITIONS**

In `lib/modules/definitions.ts`, add a new entry:

```ts
'promo': {
    adminRoutes: [
        { label: 'Promos',   path: '/admin/promo/list',     icon: 'tag',      componentKey: 'promo:PromoListPage' },
        { label: 'Vouchers', path: '/admin/promo/vouchers', icon: 'ticket',   componentKey: 'promo:VouchersPage' },
        { label: 'Settings', path: '/admin/promo/settings', icon: 'settings', permission: 'settings', componentKey: 'promo:SettingsPage' }
    ]
},
```

- [ ] **Step 3: Add `promo` module record to seed script**

In `scripts/seed-modules.ts`, add to the `MODULES` array:

```ts
{
    id: 'promo',
    displayName: 'Promo Engine',
    description: 'Discounts, auto-apply rules, and points-redemption vouchers',
    icon: 'tag',
    version: '1.0.0',
    enabled: false,
    adminRoutes: [
        { label: 'Promos',   path: '/admin/promo/list',     icon: 'tag',      componentKey: 'promo:PromoListPage' },
        { label: 'Vouchers', path: '/admin/promo/vouchers', icon: 'ticket',   componentKey: 'promo:VouchersPage' },
        { label: 'Settings', path: '/admin/promo/settings', icon: 'settings', componentKey: 'promo:SettingsPage', permission: 'settings' },
    ],
    dashboardWidgets: [
        { location: 'member_dashboard', componentKey: 'promo:MemberRewardsWidget', priority: 30 },
        { location: 'member_dashboard', componentKey: 'promo:MyVouchersWidget',    priority: 25 },
    ],
},
```

(Note: `dashboardWidgets` will be wired in Phase 4. Default `enabled: false` so existing tenants don't see it until they explicitly turn it on.)

- [ ] **Step 4: Commit**

```bash
git add lib/modules/registry.ts lib/modules/definitions.ts scripts/seed-modules.ts
git commit -m "feat(promo): register module + admin routes + icons"
```

---

### Task 15: Settings page

**Files:**
- Create: `lib/modules/promo/admin/SettingsPage.tsx`

- [ ] **Step 1: Create settings page**

```tsx
// lib/modules/promo/admin/SettingsPage.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useSite } from '@/lib/site-context';
import { usePermission } from '@/lib/hooks/use-permission';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { getPromoSettings, updatePromoSettings } from '../api';
import { PromoSettings } from '../types';
import { DEFAULT_PROMO_SETTINGS } from '../constants';
import { logger } from '@/lib/logger-edge';

export default function PromoSettingsPage() {
  const { siteId } = useSite();
  const { canEdit } = usePermission();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PromoSettings>(DEFAULT_PROMO_SETTINGS as PromoSettings);

  useEffect(() => {
    if (!siteId) return;
    getPromoSettings(siteId).then(s => { setSettings(s); setLoading(false); });
  }, [siteId]);

  const handleSave = async () => {
    if (!siteId || !canEdit) return;
    setSaving(true);
    try {
      await updatePromoSettings(siteId, settings);
      toast.success('Settings saved');
    } catch (e) {
      logger.error('promo.settings.save.failed', { siteId, error: e });
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 flex items-center gap-2 text-gray-500"><Loader2 className="animate-spin" /> Loading…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Promo Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Defaults applied across all promos and vouchers.</p>
      </header>

      <div className="space-y-4 bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-lg p-6">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Voucher code prefix</label>
          <input
            type="text" maxLength={5} disabled={!canEdit}
            value={settings.voucherCodePrefix}
            onChange={(e) => setSettings({ ...settings, voucherCodePrefix: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-800 font-mono"
          />
          <p className="text-xs text-gray-500 mt-1">Up to 5 uppercase characters. Example: <code>VCH-AB12-CD34</code></p>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Default voucher expiry (days)</label>
          <input
            type="number" min={1} max={3650} disabled={!canEdit}
            value={settings.defaultVoucherExpiryDays}
            onChange={(e) => setSettings({ ...settings, defaultVoucherExpiryDays: Number(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-200 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-800"
          />
          <p className="text-xs text-gray-500 mt-1">Used when a promo doesn't specify its own expiry.</p>
        </div>

        <label className="flex items-center gap-3 cursor-pointer pt-2">
          <input
            type="checkbox" disabled={!canEdit}
            checked={settings.allowGuestCodes}
            onChange={(e) => setSettings({ ...settings, allowGuestCodes: e.target.checked })}
            className="w-4 h-4"
          />
          <div>
            <div className="text-sm font-medium">Allow guest discount codes</div>
            <div className="text-xs text-gray-500">If off, all promos require a logged-in member, even public-audience promos.</div>
          </div>
        </label>
      </div>

      <div className="flex justify-end">
        <button
          disabled={!canEdit || saving}
          onClick={handleSave}
          className="inline-flex items-center gap-2 px-5 py-2 bg-pink-600 text-white font-bold rounded-md hover:bg-pink-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          Save settings
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register in `components.tsx`**

Add to `lib/modules/components.tsx`:

```tsx
// Admin Pages (Promo)
const PromoSettingsPage = dynamic(() => import('@/lib/modules/promo/admin/SettingsPage'));
```

And in `MODULE_COMPONENTS`:
```tsx
'promo:SettingsPage': PromoSettingsPage,
```

- [ ] **Step 3: Commit**

```bash
git add lib/modules/promo/admin/SettingsPage.tsx lib/modules/components.tsx
git commit -m "feat(promo): admin settings page"
```

---

### Task 16: Promo form sheet

**Files:**
- Create: `lib/modules/promo/admin/PromoFormSheet.tsx`

- [ ] **Step 1: Create the form**

```tsx
// lib/modules/promo/admin/PromoFormSheet.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Promo, PromoSource, PromoTrigger, PromoKind, PromoAudience } from '../types';
import { PROMO_SOURCE_KEYS, PROMO_SOURCES } from '../sources';
import { createPromo, updatePromo } from '../api/promos';
import { toast } from 'sonner';
import { X, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger-edge';

interface Props {
  isOpen: boolean;
  siteId: string;
  promo?: Promo | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  name: string;
  description: string;
  code: string;
  kind: PromoKind;
  value: number;
  maxDiscount: number | '';
  minSubtotal: number | '';
  validFrom: string; // ISO date string
  validUntil: string;
  eligibleSources: PromoSource[];
  audience: PromoAudience;
  trigger: PromoTrigger;
  maxUses: number | '';
  perMemberLimit: number | '';
  costInPoints: number | '';
  voucherExpiryDays: number | '';
}

const empty: FormState = {
  name: '', description: '', code: '',
  kind: 'percent', value: 10, maxDiscount: '',
  minSubtotal: '', validFrom: '', validUntil: '',
  eligibleSources: [], audience: 'public', trigger: 'code',
  maxUses: '', perMemberLimit: '', costInPoints: '', voucherExpiryDays: '',
};

function fromPromo(p: Promo): FormState {
  return {
    name: p.name, description: p.description || '',
    code: p.code || '',
    kind: p.kind, value: p.value, maxDiscount: p.maxDiscount ?? '',
    minSubtotal: p.conditions.minSubtotal ?? '',
    validFrom: p.conditions.validFrom ? p.conditions.validFrom.toDate().toISOString().slice(0, 10) : '',
    validUntil: p.conditions.validUntil ? p.conditions.validUntil.toDate().toISOString().slice(0, 10) : '',
    eligibleSources: p.conditions.eligibleSources,
    audience: p.conditions.audience,
    trigger: p.trigger,
    maxUses: p.maxUses ?? '',
    perMemberLimit: p.perMemberLimit ?? '',
    costInPoints: p.costInPoints ?? '',
    voucherExpiryDays: p.voucherExpiryDays ?? '',
  };
}

export default function PromoFormSheet({ isOpen, siteId, promo, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(promo ? fromPromo(promo) : empty); }, [promo, isOpen]);

  if (!isOpen) return null;

  const isClaim = form.trigger === 'claim';
  const isCode = form.trigger === 'code';

  const toggleSource = (s: PromoSource) => {
    const has = form.eligibleSources.includes(s);
    setForm({
      ...form,
      eligibleSources: has ? form.eligibleSources.filter(x => x !== s) : [...form.eligibleSources, s],
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (form.value <= 0) { toast.error('Value must be > 0'); return; }
    if (isCode && !form.code.trim()) { toast.error('Code is required for code-trigger promos'); return; }
    if (isClaim && (!form.costInPoints || Number(form.costInPoints) <= 0)) {
      toast.error('Claim promos need a points cost'); return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        code: isCode ? form.code.trim() : undefined,
        kind: form.kind, value: Number(form.value),
        maxDiscount: form.maxDiscount === '' ? undefined : Number(form.maxDiscount),
        conditions: {
          minSubtotal: form.minSubtotal === '' ? undefined : Number(form.minSubtotal),
          validFrom: form.validFrom ? Timestamp.fromDate(new Date(form.validFrom)) : undefined,
          validUntil: form.validUntil ? Timestamp.fromDate(new Date(form.validUntil + 'T23:59:59')) : undefined,
          eligibleSources: form.eligibleSources,
          audience: form.audience,
        },
        trigger: form.trigger,
        maxUses: form.maxUses === '' ? undefined : Number(form.maxUses),
        perMemberLimit: form.perMemberLimit === '' ? undefined : Number(form.perMemberLimit),
        costInPoints: isClaim ? Number(form.costInPoints) : undefined,
        voucherExpiryDays: isClaim && form.voucherExpiryDays !== '' ? Number(form.voucherExpiryDays) : undefined,
        status: 'active' as const,
      };

      if (promo) {
        await updatePromo(siteId, promo.id, payload as any);
        toast.success('Promo updated');
      } else {
        await createPromo(siteId, payload as any);
        toast.success('Promo created');
      }
      onSaved();
      onClose();
    } catch (e) {
      logger.error('promo.form.save.failed', { siteId, error: e });
      toast.error('Failed to save promo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-xl bg-white dark:bg-neutral-900 h-full overflow-y-auto p-6 space-y-6">
        <div className="flex items-start justify-between">
          <h2 className="text-xl font-bold">{promo ? 'Edit Promo' : 'New Promo'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase text-gray-500">1. Basics</h3>
          <input className="w-full px-3 py-2 border rounded" placeholder="Name *"
            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <textarea className="w-full px-3 py-2 border rounded" rows={2} placeholder="Description"
            value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div className="flex gap-3">
            <select className="px-3 py-2 border rounded" value={form.kind}
              onChange={e => setForm({ ...form, kind: e.target.value as PromoKind })}>
              <option value="percent">% off</option>
              <option value="fixed">Fixed amount off</option>
            </select>
            <input className="flex-1 px-3 py-2 border rounded" type="number" placeholder="Value *"
              value={form.value} onChange={e => setForm({ ...form, value: Number(e.target.value) })} />
          </div>
          {form.kind === 'percent' && (
            <input className="w-full px-3 py-2 border rounded" type="number" placeholder="Max discount cap (optional)"
              value={form.maxDiscount} onChange={e => setForm({ ...form, maxDiscount: e.target.value === '' ? '' : Number(e.target.value) })} />
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase text-gray-500">2. Conditions</h3>
          <input className="w-full px-3 py-2 border rounded" type="number" placeholder="Minimum subtotal (optional)"
            value={form.minSubtotal} onChange={e => setForm({ ...form, minSubtotal: e.target.value === '' ? '' : Number(e.target.value) })} />
          <div className="flex gap-3">
            <input className="flex-1 px-3 py-2 border rounded" type="date" placeholder="Valid from"
              value={form.validFrom} onChange={e => setForm({ ...form, validFrom: e.target.value })} />
            <input className="flex-1 px-3 py-2 border rounded" type="date" placeholder="Valid until"
              value={form.validUntil} onChange={e => setForm({ ...form, validUntil: e.target.value })} />
          </div>
          <div>
            <div className="text-xs font-bold uppercase text-gray-500 mb-1">Eligible sources (empty = all)</div>
            <div className="flex flex-wrap gap-2">
              {PROMO_SOURCE_KEYS.filter(k => k !== 'OTHER').map(s => (
                <button key={s} type="button" onClick={() => toggleSource(s)}
                  className={`px-3 py-1 rounded-full text-xs border ${
                    form.eligibleSources.includes(s)
                      ? 'bg-pink-100 border-pink-400 text-pink-800'
                      : 'bg-white border-gray-200 text-gray-600'
                  }`}>
                  {PROMO_SOURCES[s].label}
                </button>
              ))}
            </div>
          </div>
          <select className="w-full px-3 py-2 border rounded" value={form.audience}
            onChange={e => setForm({ ...form, audience: e.target.value as PromoAudience })}>
            <option value="public">Public (anyone)</option>
            <option value="members">Members only</option>
            <option value="specific">Specific members (use Vouchers page to grant)</option>
          </select>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase text-gray-500">3. Trigger & Limits</h3>
          <select className="w-full px-3 py-2 border rounded" value={form.trigger}
            onChange={e => setForm({ ...form, trigger: e.target.value as PromoTrigger })}>
            <option value="code">Code (customer enters code)</option>
            <option value="auto">Auto (engine applies if conditions met)</option>
            <option value="claim">Claim (member spends points or admin grants)</option>
          </select>
          {isCode && (
            <input className="w-full px-3 py-2 border rounded font-mono uppercase" placeholder="Code, e.g. SUMMER20"
              value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          )}
          {isClaim && (
            <>
              <input className="w-full px-3 py-2 border rounded" type="number" placeholder="Cost in points *"
                value={form.costInPoints} onChange={e => setForm({ ...form, costInPoints: e.target.value === '' ? '' : Number(e.target.value) })} />
              <input className="w-full px-3 py-2 border rounded" type="number" placeholder="Voucher expiry (days, optional)"
                value={form.voucherExpiryDays} onChange={e => setForm({ ...form, voucherExpiryDays: e.target.value === '' ? '' : Number(e.target.value) })} />
            </>
          )}
          <div className="flex gap-3">
            <input className="flex-1 px-3 py-2 border rounded" type="number" placeholder="Max uses (total)"
              value={form.maxUses} onChange={e => setForm({ ...form, maxUses: e.target.value === '' ? '' : Number(e.target.value) })} />
            <input className="flex-1 px-3 py-2 border rounded" type="number" placeholder="Per-member limit"
              value={form.perMemberLimit} onChange={e => setForm({ ...form, perMemberLimit: e.target.value === '' ? '' : Number(e.target.value) })} />
          </div>
        </section>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-900">Cancel</button>
          <button disabled={saving} onClick={handleSave}
            className="inline-flex items-center gap-2 px-5 py-2 bg-pink-600 text-white font-bold rounded-md hover:bg-pink-700 disabled:opacity-50">
            {saving ? <Loader2 className="animate-spin" size={16} /> : null}
            {promo ? 'Save changes' : 'Create promo'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/modules/promo/admin/PromoFormSheet.tsx
git commit -m "feat(promo): admin promo form sheet"
```

---

### Task 17: Promo list page

**Files:**
- Create: `lib/modules/promo/admin/PromoListPage.tsx`

- [ ] **Step 1: Create the list page**

```tsx
// lib/modules/promo/admin/PromoListPage.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useSite } from '@/lib/site-context';
import { usePermission } from '@/lib/hooks/use-permission';
import { Loader2, Plus, Tag, Search, Pause, Play, Archive, Edit2 } from 'lucide-react';
import { Promo } from '../types';
import { listPromos, setPromoStatus } from '../api/promos';
import { PROMO_SOURCES } from '../sources';
import PromoFormSheet from './PromoFormSheet';
import { toast } from 'sonner';
import { logger } from '@/lib/logger-edge';

function TriggerPill({ t }: { t: Promo['trigger'] }) {
  const map = {
    code:  'bg-blue-100 text-blue-800',
    auto:  'bg-violet-100 text-violet-800',
    claim: 'bg-pink-100 text-pink-800',
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${map[t]}`}>{t}</span>;
}

function StatusBadge({ s }: { s: Promo['status'] }) {
  const map = {
    active:   { cls: 'bg-emerald-100 text-emerald-800', label: '● Active' },
    paused:   { cls: 'bg-amber-100 text-amber-800',     label: '⏸ Paused' },
    archived: { cls: 'bg-gray-100 text-gray-700',       label: '◇ Archived' },
  };
  const v = map[s];
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${v.cls}`}>{v.label}</span>;
}

function formatValue(p: Promo) {
  if (p.kind === 'percent') {
    return p.maxDiscount
      ? <><span className="font-bold">{p.value}%</span><div className="text-[10px] text-gray-500">max {p.maxDiscount.toLocaleString('id-ID')}</div></>
      : <span className="font-bold">{p.value}%</span>;
  }
  return <span className="font-bold">Rp {p.value.toLocaleString('id-ID')}</span>;
}

function formatWindow(p: Promo) {
  const f = p.conditions.validFrom?.toDate();
  const u = p.conditions.validUntil?.toDate();
  if (!f && !u) return 'Always';
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (f && u) return `${fmt(f)} – ${fmt(u)}`;
  if (f) return `from ${fmt(f)}`;
  return `until ${fmt(u!)}`;
}

export default function PromoListPage() {
  const { siteId } = useSite();
  const { canEdit } = usePermission();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState<Promo | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const reload = async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const list = await listPromos(siteId);
      setPromos(list);
    } catch (e) {
      logger.error('promo.list.failed', { siteId, error: e });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [siteId]);

  const filtered = promos.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code?.toLowerCase().includes(search.toLowerCase())
  );

  const togglePause = async (p: Promo) => {
    if (!canEdit || !siteId) return;
    try {
      await setPromoStatus(siteId, p.id, p.status === 'paused' ? 'active' : 'paused');
      toast.success(`Promo ${p.status === 'paused' ? 'resumed' : 'paused'}`);
      reload();
    } catch (e) {
      logger.error('promo.toggle.failed', { siteId, error: e });
      toast.error('Failed to update status');
    }
  };

  const archive = async (p: Promo) => {
    if (!canEdit || !siteId) return;
    if (!confirm(`Archive "${p.name}"?`)) return;
    try {
      await setPromoStatus(siteId, p.id, 'archived');
      toast.success('Promo archived');
      reload();
    } catch (e) {
      logger.error('promo.archive.failed', { siteId, error: e });
      toast.error('Failed to archive');
    }
  };

  return (
    <div className="p-6 space-y-4">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Tag size={22} /> Promos</h1>
          <p className="text-sm text-gray-500 mt-1">Discounts, auto-apply rules, and points-redemption rewards</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="pl-9 pr-3 py-2 border rounded text-sm w-64" placeholder="Search name or code…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button disabled={!canEdit} onClick={() => { setEditTarget(null); setSheetOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-pink-600 text-white font-bold rounded-md hover:bg-pink-700 disabled:opacity-50">
            <Plus size={16} /> New Promo
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 p-8"><Loader2 className="animate-spin" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-gray-500 border-2 border-dashed rounded-lg">No promos yet. Click <strong>New Promo</strong> to create one.</div>
      ) : (
        <table className="w-full bg-white dark:bg-neutral-900 border rounded-lg overflow-hidden text-sm">
          <thead className="bg-gray-50 dark:bg-neutral-800 text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Trigger</th>
              <th className="text-left p-3">Value</th>
              <th className="text-left p-3">Sources</th>
              <th className="text-left p-3">Window</th>
              <th className="text-left p-3">Usage</th>
              <th className="text-left p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, idx) => (
              <tr key={p.id} className={idx % 2 ? 'bg-gray-50/50 dark:bg-neutral-900/50' : ''}>
                <td className="p-3">
                  <div className="font-semibold">{p.name}</div>
                  {p.code && <span className="inline-block mt-1 text-[10px] font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded">{p.code}</span>}
                </td>
                <td className="p-3"><TriggerPill t={p.trigger} /></td>
                <td className="p-3">{formatValue(p)}</td>
                <td className="p-3 text-xs text-gray-600">
                  {p.conditions.eligibleSources.length === 0
                    ? 'All'
                    : p.conditions.eligibleSources.map(s => PROMO_SOURCES[s].label).join(' · ')}
                </td>
                <td className="p-3 text-xs">{formatWindow(p)}</td>
                <td className="p-3 text-xs">
                  {p.usageCount} / {p.maxUses ?? '∞'}
                </td>
                <td className="p-3"><StatusBadge s={p.status} /></td>
                <td className="p-3 flex gap-1 text-gray-500">
                  <button title="Edit" onClick={() => { setEditTarget(p); setSheetOpen(true); }} className="hover:text-pink-600 p-1"><Edit2 size={14} /></button>
                  <button title={p.status === 'paused' ? 'Resume' : 'Pause'} onClick={() => togglePause(p)} className="hover:text-amber-600 p-1">
                    {p.status === 'paused' ? <Play size={14} /> : <Pause size={14} />}
                  </button>
                  <button title="Archive" onClick={() => archive(p)} className="hover:text-red-600 p-1"><Archive size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {siteId && (
        <PromoFormSheet
          isOpen={sheetOpen}
          siteId={siteId}
          promo={editTarget}
          onClose={() => setSheetOpen(false)}
          onSaved={reload}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Register the page**

In `lib/modules/components.tsx`:
```tsx
const PromoListPage = dynamic(() => import('@/lib/modules/promo/admin/PromoListPage'));
```
And in `MODULE_COMPONENTS`:
```tsx
'promo:PromoListPage': PromoListPage,
```

- [ ] **Step 3: Commit**

```bash
git add lib/modules/promo/admin/PromoListPage.tsx lib/modules/components.tsx
git commit -m "feat(promo): admin promo list page"
```

---

### Task 18: Vouchers page + grant dialog

**Files:**
- Create: `lib/modules/promo/admin/GrantVoucherDialog.tsx`
- Create: `lib/modules/promo/admin/VouchersPage.tsx`

- [ ] **Step 1: Create grant dialog**

```tsx
// lib/modules/promo/admin/GrantVoucherDialog.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Promo } from '../types';
import { Member } from '@/lib/modules/membership/types';
import { listPromos } from '../api/promos';
import { searchMembers } from '@/lib/modules/membership/api';
import { grantVoucher } from '../api/claim';
import { logger } from '@/lib/logger-edge';

interface Props {
  isOpen: boolean;
  siteId: string;
  onClose: () => void;
  onGranted: () => void;
}

export default function GrantVoucherDialog({ isOpen, siteId, onClose, onGranted }: Props) {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [promoId, setPromoId] = useState<string>('');
  const [memberSearch, setMemberSearch] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [memberId, setMemberId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      listPromos(siteId).then(list => setPromos(list.filter(p => p.trigger === 'claim' && p.status === 'active')));
    } else {
      setPromoId(''); setMemberId(''); setMemberSearch(''); setMembers([]);
    }
  }, [isOpen, siteId]);

  useEffect(() => {
    if (memberSearch.length < 3) { setMembers([]); return; }
    const t = setTimeout(() => searchMembers(siteId, memberSearch).then(setMembers), 300);
    return () => clearTimeout(t);
  }, [memberSearch, siteId]);

  if (!isOpen) return null;

  const handleGrant = async () => {
    if (!promoId || !memberId) { toast.error('Select promo and member'); return; }
    setSaving(true);
    try {
      await grantVoucher({ siteId, promoId, memberId });
      toast.success('Voucher granted');
      onGranted();
      onClose();
    } catch (e: any) {
      logger.error('promo.grant.failed', { siteId, error: e });
      toast.error(e.message || 'Failed to grant voucher');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex justify-between items-start">
          <h2 className="text-lg font-bold">Grant Voucher</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Claim promo</label>
          <select className="w-full px-3 py-2 border rounded" value={promoId} onChange={e => setPromoId(e.target.value)}>
            <option value="">Select…</option>
            {promos.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Member (search by name or phone)</label>
          <input className="w-full px-3 py-2 border rounded" value={memberSearch}
            onChange={e => setMemberSearch(e.target.value)} placeholder="Min 3 chars…" />
          {members.length > 0 && (
            <div className="border rounded mt-2 max-h-40 overflow-y-auto">
              {members.map(m => (
                <button key={m.id} onClick={() => { setMemberId(m.id); setMemberSearch(m.fullName); setMembers([]); }}
                  className={`w-full text-left p-2 text-sm hover:bg-gray-100 ${memberId === m.id ? 'bg-pink-50' : ''}`}>
                  <div className="font-medium">{m.fullName}</div>
                  <div className="text-xs text-gray-500">{m.phoneNumber}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button onClick={onClose} className="px-4 py-2 text-gray-600">Cancel</button>
          <button disabled={saving} onClick={handleGrant}
            className="inline-flex items-center gap-2 px-4 py-2 bg-pink-600 text-white font-bold rounded-md disabled:opacity-50">
            {saving ? <Loader2 className="animate-spin" size={14} /> : null} Grant
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create vouchers page**

```tsx
// lib/modules/promo/admin/VouchersPage.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useSite } from '@/lib/site-context';
import { usePermission } from '@/lib/hooks/use-permission';
import { Loader2, Plus, Ticket, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Voucher } from '../types';
import { listAllVouchers, revokeVoucher } from '../api/vouchers';
import GrantVoucherDialog from './GrantVoucherDialog';
import { logger } from '@/lib/logger-edge';

function StatusBadge({ s }: { s: Voucher['status'] }) {
  const map = {
    active:  'bg-emerald-100 text-emerald-800',
    used:    'bg-gray-200 text-gray-700',
    expired: 'bg-red-100 text-red-700',
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${map[s]}`}>{s}</span>;
}

export default function VouchersPage() {
  const { siteId } = useSite();
  const { canEdit } = usePermission();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [grantOpen, setGrantOpen] = useState(false);

  const reload = async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const list = await listAllVouchers(siteId);
      setVouchers(list);
    } catch (e) {
      logger.error('promo.vouchers.list.failed', { siteId, error: e });
    } finally { setLoading(false); }
  };

  useEffect(() => { reload(); }, [siteId]);

  const handleRevoke = async (v: Voucher) => {
    if (!canEdit || !siteId) return;
    if (v.status !== 'active') { toast.error('Only active vouchers can be revoked'); return; }
    if (!confirm(`Revoke voucher ${v.code}?`)) return;
    try {
      await revokeVoucher(siteId, v.id);
      toast.success('Voucher revoked');
      reload();
    } catch (e) {
      logger.error('promo.voucher.revoke.failed', { siteId, error: e });
      toast.error('Failed to revoke');
    }
  };

  return (
    <div className="p-6 space-y-4">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Ticket size={22} /> Vouchers</h1>
          <p className="text-sm text-gray-500 mt-1">All issued vouchers across this site</p>
        </div>
        <button disabled={!canEdit} onClick={() => setGrantOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-pink-600 text-white font-bold rounded-md hover:bg-pink-700 disabled:opacity-50">
          <Plus size={16} /> Grant Voucher
        </button>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 p-8"><Loader2 className="animate-spin" /> Loading…</div>
      ) : vouchers.length === 0 ? (
        <div className="p-12 text-center text-gray-500 border-2 border-dashed rounded-lg">No vouchers issued yet.</div>
      ) : (
        <table className="w-full bg-white dark:bg-neutral-900 border rounded-lg overflow-hidden text-sm">
          <thead className="bg-gray-50 dark:bg-neutral-800 text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left p-3">Code</th>
              <th className="text-left p-3">Owner</th>
              <th className="text-left p-3">Issued</th>
              <th className="text-left p-3">Via</th>
              <th className="text-left p-3">Expires</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Used at</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {vouchers.map((v, idx) => (
              <tr key={v.id} className={idx % 2 ? 'bg-gray-50/50 dark:bg-neutral-900/50' : ''}>
                <td className="p-3 font-mono text-xs">{v.code}</td>
                <td className="p-3">{v.ownerName || v.ownerMemberId.slice(0, 8)}</td>
                <td className="p-3 text-xs">{v.issuedAt.toDate().toLocaleDateString()}</td>
                <td className="p-3 text-xs">{v.issuedVia.replace('_', ' ')}</td>
                <td className="p-3 text-xs">{v.expiresAt ? v.expiresAt.toDate().toLocaleDateString() : '—'}</td>
                <td className="p-3"><StatusBadge s={v.status} /></td>
                <td className="p-3 text-xs">{v.usedSource ? `${v.usedSource} #${v.usedRefId?.slice(-4)}` : '—'}</td>
                <td className="p-3">
                  {v.status === 'active' && (
                    <button title="Revoke" onClick={() => handleRevoke(v)} className="text-gray-400 hover:text-red-600 p-1">
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {siteId && (
        <GrantVoucherDialog isOpen={grantOpen} siteId={siteId}
          onClose={() => setGrantOpen(false)} onGranted={reload} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Register the page**

In `lib/modules/components.tsx`:
```tsx
const PromoVouchersPage = dynamic(() => import('@/lib/modules/promo/admin/VouchersPage'));
```
And in `MODULE_COMPONENTS`:
```tsx
'promo:VouchersPage': PromoVouchersPage,
```

- [ ] **Step 4: Commit**

```bash
git add lib/modules/promo/admin/GrantVoucherDialog.tsx lib/modules/promo/admin/VouchersPage.tsx lib/modules/components.tsx
git commit -m "feat(promo): admin vouchers page + grant dialog"
```

---

### Task 19: Phase 2 manual smoke test

- [ ] **Step 1: Run the seed script (only on dev/staging)**

Run: `pnpm exec tsx scripts/seed-modules.ts`
Expected: Adds the `promo` module document. (If it already existed without `promo`, it gets added now.)

- [ ] **Step 2: Enable the module in Backyard for a test site**

(Manual step — flip `enabled: true` for `promo` on the test site via Backyard's seed-modules page.)

- [ ] **Step 3: Visit `/admin/promo/list` and walk through:**
  - Create a code promo (`TEST10`, 10% off, POS only)
  - Pause it, resume it, archive it
  - Visit `/admin/promo/vouchers` (empty)
  - Visit `/admin/promo/settings`, change prefix to `TEST`, save, reload — confirms persistence
  - Restore prefix to `VCH`

- [ ] **Step 4: Run typecheck and lint**

Run: `pnpm exec tsc --noEmit -p . && pnpm lint`
Expected: no errors related to promo files

(No commit; this task is a checkpoint only.)

---

# Phase 3 — POS Integration

Implements `<PromoApplicator>`, wires it into POS cashier, and proves the universal pattern works end-to-end.

---

### Task 20: PromoApplicator component

**Files:**
- Create: `lib/modules/promo/components/PromoApplicator.tsx`

- [ ] **Step 1: Create the applicator**

```tsx
// lib/modules/promo/components/PromoApplicator.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { Tag, X, Loader2, Ticket, Sparkles } from 'lucide-react';
import { evaluatePromo, findAutoApplicable } from '../api/evaluator';
import { listMemberVouchers } from '../api/vouchers';
import { AppliedPromo, EvaluationResult, PromoSource, Voucher } from '../types';
import { toast } from 'sonner';
import { logger } from '@/lib/logger-edge';

interface Props {
  siteId: string;
  source: PromoSource;
  subtotal: number;
  memberId?: string;
  refDocId?: string; // not used here directly; parent uses for commit
  onApplied: (result: AppliedPromo) => void;
  onCleared: () => void;
  showAutoApply?: boolean;
  allowCodeEntry?: boolean;
  allowVoucherPicker?: boolean;
}

export default function PromoApplicator({
  siteId, source, subtotal, memberId,
  onApplied, onCleared,
  showAutoApply = true, allowCodeEntry = true, allowVoucherPicker = true,
}: Props) {
  const [applied, setApplied] = useState<AppliedPromo | null>(null);
  const [code, setCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [memberVouchers, setMemberVouchers] = useState<Voucher[]>([]);
  const [showVouchers, setShowVouchers] = useState(false);

  // Auto-apply highest-value match on mount / subtotal / member change
  useEffect(() => {
    let cancelled = false;
    if (!showAutoApply || subtotal <= 0 || applied) return;
    findAutoApplicable({ siteId, source, subtotal, memberId }).then(results => {
      if (cancelled || results.length === 0 || !results[0].ok) return;
      const r = results[0];
      const a: AppliedPromo = { refId: r.refId, kind: r.kind, label: `Auto: ${r.label}`, discount: r.discount };
      setApplied(a);
      onApplied(a);
    }).catch(e => logger.error('promo.applicator.auto.failed', { siteId, error: e }));
    return () => { cancelled = true; };
  }, [siteId, source, subtotal, memberId, showAutoApply]);

  // Load member vouchers when picker opens
  useEffect(() => {
    if (!showVouchers || !memberId) return;
    listMemberVouchers(siteId, memberId)
      .then(list => setMemberVouchers(list.filter(v => v.status === 'active')))
      .catch(e => logger.error('promo.applicator.vouchers.failed', { siteId, error: e }));
  }, [showVouchers, memberId, siteId]);

  const apply = (r: EvaluationResult) => {
    if (!r.ok) { toast.error(r.message); return; }
    const a: AppliedPromo = { refId: r.refId, kind: r.kind, label: r.label, discount: r.discount };
    setApplied(a);
    onApplied(a);
  };

  const handleCodeSubmit = async () => {
    if (!code.trim()) return;
    setValidating(true);
    try {
      const r = await evaluatePromo({ siteId, source, subtotal, memberId, code: code.trim() });
      apply(r);
      if (r.ok) setCode('');
    } catch (e) {
      logger.error('promo.applicator.code.failed', { siteId, error: e });
      toast.error('Failed to validate code');
    } finally { setValidating(false); }
  };

  const handleVoucherPick = async (v: Voucher) => {
    setValidating(true);
    try {
      const r = await evaluatePromo({ siteId, source, subtotal, memberId, code: v.code });
      apply(r);
      if (r.ok) setShowVouchers(false);
    } catch (e) {
      logger.error('promo.applicator.voucher.failed', { siteId, error: e });
    } finally { setValidating(false); }
  };

  const clear = () => {
    setApplied(null);
    onCleared();
  };

  if (applied) {
    return (
      <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-md p-3">
        <div className="flex items-center gap-2">
          <Tag size={16} className="text-emerald-700" />
          <div>
            <div className="text-sm font-bold text-emerald-900 dark:text-emerald-200">{applied.label}</div>
            <div className="text-xs text-emerald-700 dark:text-emerald-300">−Rp {applied.discount.toLocaleString('id-ID')}</div>
          </div>
        </div>
        <button onClick={clear} className="text-emerald-700 hover:text-emerald-900 p-1" aria-label="Remove promo">
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {allowCodeEntry && (
        <div className="flex gap-2">
          <input className="flex-1 px-3 py-2 border rounded text-sm font-mono uppercase"
            placeholder="Enter promo or voucher code"
            value={code} onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter') handleCodeSubmit(); }} />
          <button disabled={validating || !code.trim()} onClick={handleCodeSubmit}
            className="px-4 py-2 bg-pink-600 text-white text-sm font-bold rounded disabled:opacity-50">
            {validating ? <Loader2 className="animate-spin" size={14} /> : 'Apply'}
          </button>
        </div>
      )}

      {allowVoucherPicker && memberId && (
        <button onClick={() => setShowVouchers(s => !s)}
          className="w-full text-left text-xs text-pink-700 hover:text-pink-900 inline-flex items-center gap-1">
          <Ticket size={12} /> {showVouchers ? 'Hide' : 'Use'} member's vouchers
        </button>
      )}

      {showVouchers && memberId && memberVouchers.length > 0 && (
        <div className="border rounded max-h-40 overflow-y-auto">
          {memberVouchers.map(v => (
            <button key={v.id} onClick={() => handleVoucherPick(v)}
              className="w-full text-left p-2 text-sm hover:bg-pink-50 border-b last:border-b-0">
              <div className="font-mono text-xs">{v.code}</div>
              <div className="text-xs text-gray-600">
                {v.snapshotKind === 'percent' ? `${v.snapshotValue}% off` : `Rp ${v.snapshotValue.toLocaleString('id-ID')} off`}
                {v.expiresAt ? ` · expires ${v.expiresAt.toDate().toLocaleDateString()}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}

      {showVouchers && memberId && memberVouchers.length === 0 && (
        <div className="text-xs text-gray-500 italic">No active vouchers for this member.</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/modules/promo/components/PromoApplicator.tsx
git commit -m "feat(promo): PromoApplicator component"
```

---

### Task 21: Add `promoApplied` field to POSOrder

**Files:**
- Modify: `lib/modules/byod_pos/types.ts`

- [ ] **Step 1: Extend the POSOrder interface**

In `lib/modules/byod_pos/types.ts`, add to `POSOrder` (after existing fields, before closing `}`):

```ts
    // Promo (when a promo or voucher was applied at checkout)
    promoApplied?: {
        refId: string;
        kind: 'promo' | 'voucher';
        label: string;
        discount: number;
    };
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm exec tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add lib/modules/byod_pos/types.ts
git commit -m "feat(byod_pos): add promoApplied to POSOrder type"
```

---

### Task 22: Wire applicator into POS PaymentConfirmationDialog

**Files:**
- Modify: `lib/modules/byod_pos/admin/components/PaymentConfirmationDialog.tsx`
- Modify: `lib/modules/byod_pos/admin/CashierClient.tsx`
- Modify: `lib/modules/byod_pos/api.ts`

- [ ] **Step 1: Update dialog props to surface applied promo to parent**

In `lib/modules/byod_pos/admin/components/PaymentConfirmationDialog.tsx`, update the props interface:

```ts
import PromoApplicator from '@/lib/modules/promo/components/PromoApplicator';
import { AppliedPromo } from '@/lib/modules/promo/types';
import { useSite } from '@/lib/site-context';

interface PaymentConfirmationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (method: POSOrder['paymentMethod'], applied: AppliedPromo | null) => void;
    order: POSOrder | null;
}

export function PaymentConfirmationDialog({ isOpen, onClose, onConfirm, order }: PaymentConfirmationDialogProps) {
    const [method, setMethod] = useState<POSOrder['paymentMethod']>('cash');
    const [applied, setApplied] = useState<AppliedPromo | null>(null);
    const { siteId } = useSite();

    if (!order) return null;

    const total = (order.total || 0) - (applied?.discount || 0);
```

Then add the `<PromoApplicator>` block inside the dialog content (right after the total display, before the payment method picker):

```tsx
{siteId && (
    <div className="space-y-2 border-t border-b border-gray-200 dark:border-neutral-800 py-3">
        <label className="text-xs font-bold text-gray-500 uppercase">Promo / Voucher</label>
        <PromoApplicator
            siteId={siteId}
            source="POS"
            subtotal={order.total || 0}
            memberId={order.memberId}
            onApplied={setApplied}
            onCleared={() => setApplied(null)}
        />
    </div>
)}
```

Update the displayed total to use `total` (subtotal − applied):

Replace:
```ts
{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(order.total)}
```
with:
```ts
{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(total)}
```

Update the confirm button to pass `applied`:
```ts
onClick={() => onConfirm(method, applied)}
```

- [ ] **Step 2: Update `confirmPaymentProcess` in CashierClient**

In `lib/modules/byod_pos/admin/CashierClient.tsx`, update the signature and pass through:

```ts
const confirmPaymentProcess = async (method: POSOrder['paymentMethod'], applied: AppliedPromo | null) => {
    if (isViewOnly) { toast.error('You do not have permission to confirm payments.'); return; }
    if (paymentConfig.orders.length === 0) return;

    try {
        if (!siteId) return;
        // For consolidated bills, apply the promo to the FIRST order's commit (single source of truth)
        await Promise.all(paymentConfig.orders.map((o, idx) =>
            confirmPayment(siteId, o.id, method, idx === 0 ? applied : null)
        ));
        // ...rest of body unchanged
```

Add the import at the top:
```ts
import { AppliedPromo } from '@/lib/modules/promo/types';
```

- [ ] **Step 3: Update confirmPayment in byod_pos/api.ts**

Find `confirmPayment` in `lib/modules/byod_pos/api.ts`. It currently has this rough shape:

```ts
export async function confirmPayment(siteId: string, orderId: string, method: ...): Promise<void>
```

Update it to accept `applied` and to call promo commit:

```ts
import { commitPromoUsage } from '@/lib/modules/promo/api';
import { AppliedPromo } from '@/lib/modules/promo/types';

export async function confirmPayment(
    siteId: string,
    orderId: string,
    method: POSOrder['paymentMethod'],
    applied?: AppliedPromo | null
): Promise<void> {
    // ... existing logic that updates the order doc ...

    // Persist promoApplied on the order
    if (applied) {
        const orderRef = doc(db, 'sites', siteId, ORDERS_COLLECTION, orderId);
        await updateDoc(orderRef, {
            promoApplied: applied,
            total: (existingTotal - applied.discount), // reduce stored total
        });
        // Commit to promo engine
        await commitPromoUsage({
            siteId,
            refId: applied.refId,
            kind: applied.kind,
            source: 'POS',
            refDocId: orderId,
            discountApplied: applied.discount,
        });
    }
}
```

(Adapt the surrounding existing code in `confirmPayment` to integrate this. The exact existing implementation determines where the new lines go — look for the section that flips `paymentStatus` to `'paid'`. Add the promo commit right after that flip, in the same async flow but outside the same Firestore transaction.)

- [ ] **Step 4: Add reverse on order void**

Find the void/cancel function in `byod_pos/api.ts` (likely `voidOrder` or `cancelOrder`). After the cancellation logic, add:

```ts
import { reversePromoUsage } from '@/lib/modules/promo/api';

// inside voidOrder/cancelOrder, after the order is marked cancelled:
await reversePromoUsage({ siteId, source: 'POS', refDocId: orderId });
```

If no void function exists yet, add this comment in `byod_pos/api.ts` near the top of the cancel-related code:

```ts
// NOTE: When implementing order void, call reversePromoUsage({siteId, source:'POS', refDocId})
//       to restore voucher status and refund redeemed points.
```

- [ ] **Step 5: Manual smoke test**

```
1. With promo `TEST10` (10% off, POS) created in Phase 2
2. Open Cashier, create an order, click pay → dialog shows
3. Type TEST10 → discount applies → total drops 10%
4. Confirm → check Firestore: order has promoApplied + reduced total
5. Visit /admin/promo/list → usageCount = 1
```

- [ ] **Step 6: Commit**

```bash
git add lib/modules/byod_pos/admin/components/PaymentConfirmationDialog.tsx lib/modules/byod_pos/admin/CashierClient.tsx lib/modules/byod_pos/api.ts
git commit -m "feat(byod_pos): integrate Promo Engine via PromoApplicator"
```

---

# Phase 4 — Member-side UX

Adds the dashboard widgets so members can see their points-redeemable rewards and active vouchers.

---

### Task 23: MemberRewardsWidget

**Files:**
- Create: `lib/modules/promo/public/MemberRewardsWidget.tsx`

- [ ] **Step 1: Create the widget**

```tsx
// lib/modules/promo/public/MemberRewardsWidget.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useSite } from '@/lib/site-context';
import { Sparkles, Loader2, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { Promo } from '../types';
import { Member } from '@/lib/modules/membership/types';
import { listClaimablePromos } from '../api/promos';
import { claimPromoForPoints } from '../api/claim';
import { findMemberByAuthId } from '@/lib/modules/membership/api';
import { auth } from '@/lib/firebase';
import { PROMO_SOURCES } from '../sources';
import { logger } from '@/lib/logger-edge';

interface Props { memberPhone?: string; memberId?: string; }

export default function MemberRewardsWidget({ memberId }: Props) {
  const { siteId } = useSite();
  const [member, setMember] = useState<Member | null>(null);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const reload = async () => {
    if (!siteId || !memberId) return;
    setLoading(true);
    try {
      const uid = auth.currentUser?.uid;
      const m = uid ? await findMemberByAuthId(siteId, uid) : null;
      setMember(m);
      const list = await listClaimablePromos(siteId, memberId);
      setPromos(list);
    } catch (e) {
      logger.error('promo.rewards.load.failed', { siteId, error: e });
    } finally { setLoading(false); }
  };

  useEffect(() => { reload(); }, [siteId, memberId]);

  const handleClaim = async (p: Promo) => {
    if (!siteId || !memberId || !p.costInPoints) return;
    if ((member?.currentPoints || 0) < p.costInPoints) {
      toast.error('Not enough points'); return;
    }
    setClaimingId(p.id);
    try {
      await claimPromoForPoints({ siteId, promoId: p.id, memberId });
      toast.success('Voucher claimed!');
      reload();
    } catch (e: any) {
      logger.error('promo.rewards.claim.failed', { siteId, error: e });
      toast.error(e.message || 'Failed to claim');
    } finally { setClaimingId(null); }
  };

  if (loading) return <div className="bg-white rounded-lg p-6"><Loader2 className="animate-spin text-gray-400" /></div>;
  if (promos.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-pink-50 to-amber-50 dark:from-pink-900/20 dark:to-amber-900/20 border border-pink-200 dark:border-pink-800 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-pink-600" />
          <h3 className="font-bold text-pink-900 dark:text-pink-200">Redeem your points</h3>
        </div>
        <div className="text-xs text-pink-700 dark:text-pink-300">
          You have <strong>{(member?.currentPoints || 0).toLocaleString()}</strong> pts
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {promos.map(p => {
          const enough = (member?.currentPoints || 0) >= (p.costInPoints || 0);
          const valueLabel = p.kind === 'percent'
            ? `${p.value}% OFF` : `Rp ${p.value.toLocaleString('id-ID')} OFF`;
          return (
            <div key={p.id} className="bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-lg p-3 flex flex-col">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-base font-black text-gray-900 dark:text-neutral-100">{valueLabel}</div>
                  <div className="text-xs text-gray-600 dark:text-neutral-400 mt-0.5">{p.name}</div>
                </div>
                <Tag size={14} className="text-gray-300" />
              </div>
              <div className="text-[10px] text-gray-500 mt-2">
                {p.conditions.eligibleSources.length === 0 ? 'All channels' :
                  p.conditions.eligibleSources.map(s => PROMO_SOURCES[s].label).join(' · ')}
                {p.voucherExpiryDays ? ` · valid ${p.voucherExpiryDays}d after claim` : ''}
              </div>
              <button disabled={!enough || claimingId === p.id}
                onClick={() => handleClaim(p)}
                className="mt-3 px-3 py-1.5 bg-pink-600 text-white text-xs font-bold rounded disabled:opacity-50">
                {claimingId === p.id ? 'Claiming…' : `Redeem · ${p.costInPoints?.toLocaleString()} pts`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/modules/promo/public/MemberRewardsWidget.tsx
git commit -m "feat(promo): MemberRewardsWidget for points redemption"
```

---

### Task 24: MyVouchersWidget

**Files:**
- Create: `lib/modules/promo/public/MyVouchersWidget.tsx`

- [ ] **Step 1: Install QR code dependency check**

Run: `pnpm list qrcode.react 2>&1 | head -5`
Expected: Either it's installed (then skip step 2) or `not found`.

- [ ] **Step 2 (only if not installed): install qrcode.react**

Run: `pnpm add qrcode.react`

- [ ] **Step 3: Create the widget**

```tsx
// lib/modules/promo/public/MyVouchersWidget.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useSite } from '@/lib/site-context';
import { Loader2, Ticket, X, Copy, QrCode as QrIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { Voucher } from '../types';
import { listMemberVouchers } from '../api/vouchers';
import { logger } from '@/lib/logger-edge';

interface Props { memberPhone?: string; memberId?: string; }

type Tab = 'active' | 'used' | 'expired';

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function MyVouchersWidget({ memberId }: Props) {
  const { siteId } = useSite();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('active');
  const [qrVoucher, setQrVoucher] = useState<Voucher | null>(null);

  useEffect(() => {
    if (!siteId || !memberId) return;
    setLoading(true);
    listMemberVouchers(siteId, memberId)
      .then(setVouchers)
      .catch(e => logger.error('promo.vouchers.member.failed', { siteId, error: e }))
      .finally(() => setLoading(false));
  }, [siteId, memberId]);

  const filtered = vouchers.filter(v => {
    if (tab === 'active')  return v.status === 'active';
    if (tab === 'used')    return v.status === 'used';
    return v.status === 'expired' || (v.expiresAt && v.expiresAt.toDate() < new Date());
  });

  if (loading) return <div className="bg-white rounded-lg p-6"><Loader2 className="animate-spin text-gray-400" /></div>;
  if (vouchers.length === 0) return null;

  const counts = {
    active:  vouchers.filter(v => v.status === 'active').length,
    used:    vouchers.filter(v => v.status === 'used').length,
    expired: vouchers.filter(v => v.status === 'expired').length,
  };

  return (
    <div className="bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Ticket size={18} className="text-pink-600" />
        <h3 className="font-bold text-gray-900 dark:text-neutral-100">My Vouchers</h3>
      </div>

      <div className="flex gap-2 text-xs">
        {(['active', 'used', 'expired'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1 rounded-full font-medium ${
              tab === t ? 'bg-pink-100 text-pink-800' : 'text-gray-500 hover:bg-gray-100'
            }`}>
            {t.charAt(0).toUpperCase() + t.slice(1)} ({counts[t]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-xs text-gray-500 italic py-4 text-center">No {tab} vouchers.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(v => {
            const expiresIn = v.expiresAt ? daysUntil(v.expiresAt.toDate()) : null;
            const expiringSoon = expiresIn !== null && expiresIn >= 0 && expiresIn <= 3;
            const valueLabel = v.snapshotKind === 'percent'
              ? `${v.snapshotValue}% OFF`
              : `Rp ${v.snapshotValue.toLocaleString('id-ID')} OFF`;
            return (
              <div key={v.id} className="border border-gray-100 dark:border-neutral-800 rounded-lg p-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-lg font-black text-pink-700 dark:text-pink-400">{valueLabel}</div>
                  <button onClick={() => { navigator.clipboard.writeText(v.code); toast.success('Code copied'); }}
                    className="text-xs font-mono text-gray-700 dark:text-neutral-300 hover:text-pink-600 inline-flex items-center gap-1 mt-1">
                    {v.code} <Copy size={10} />
                  </button>
                  {expiresIn !== null && (
                    <div className={`text-[10px] mt-1 ${expiringSoon ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                      {v.status === 'used' ? 'Used' : v.status === 'expired' || expiresIn < 0 ? 'Expired' : `Expires in ${expiresIn}d`}
                    </div>
                  )}
                </div>
                {v.status === 'active' && (
                  <button onClick={() => setQrVoucher(v)} className="p-2 bg-pink-50 dark:bg-pink-900/30 rounded text-pink-700 hover:bg-pink-100" aria-label="Show QR">
                    <QrIcon size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {qrVoucher && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setQrVoucher(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl p-6 space-y-4 max-w-xs w-full text-center">
            <div className="flex justify-end"><button onClick={() => setQrVoucher(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button></div>
            <QRCodeSVG value={qrVoucher.code} size={200} className="mx-auto" />
            <div className="font-mono text-sm font-bold">{qrVoucher.code}</div>
            <p className="text-xs text-gray-500">Show this code to the cashier or staff.</p>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/modules/promo/public/MyVouchersWidget.tsx
git commit -m "feat(promo): MyVouchersWidget with QR display"
```

---

### Task 25: Register member widgets

**Files:**
- Modify: `lib/modules/components.tsx`
- Modify: `lib/modules/client-registry.tsx`

- [ ] **Step 1: Add to MODULE_COMPONENTS (server-safe registry)**

In `lib/modules/components.tsx`, add:

```tsx
// Promo — Member Dashboard Widgets
const PromoMemberRewardsWidget = dynamic(() => import('@/lib/modules/promo/public/MemberRewardsWidget'));
const PromoMyVouchersWidget    = dynamic(() => import('@/lib/modules/promo/public/MyVouchersWidget'));
```

And in `MODULE_COMPONENTS`:
```tsx
'promo:MemberRewardsWidget': PromoMemberRewardsWidget,
'promo:MyVouchersWidget':    PromoMyVouchersWidget,
```

- [ ] **Step 2: Add to CLIENT_MODULE_COMPONENTS (client-only registry)**

In `lib/modules/client-registry.tsx`, add direct imports (not dynamic, since this registry is client-only):

```tsx
import PromoMemberRewardsWidget from '@/lib/modules/promo/public/MemberRewardsWidget';
import PromoMyVouchersWidget from '@/lib/modules/promo/public/MyVouchersWidget';
```

And in the export object:
```tsx
'promo:MemberRewardsWidget': PromoMemberRewardsWidget,
'promo:MyVouchersWidget':    PromoMyVouchersWidget,
```

- [ ] **Step 3: Manual smoke test**

```
1. Member dashboard requires login. Make sure a test member has points.
2. Create a 'claim' promo (e.g. "Rp 10K Reward — 100 pts").
3. Visit member dashboard:
   - MemberRewardsWidget shows with 'Redeem' button
   - Click Redeem → toast success, voucher minted
   - MyVouchersWidget now shows the voucher under Active tab
   - Click QR → fullscreen QR shown
   - Copy code → toast success
4. Use the voucher code in POS cashier → discount applies
5. After payment → voucher moves to Used tab
```

- [ ] **Step 4: Commit**

```bash
git add lib/modules/components.tsx lib/modules/client-registry.tsx
git commit -m "feat(promo): register member dashboard widgets"
```

---

# Phase 5 — Remaining Integrations + Skill Docs

Replicates the POS pattern for Reservation and Service Records, then writes the skill documentation that codifies the integration recipe.

---

### Task 26: Reservation integration

**Files:**
- Modify: `lib/modules/reservation/types.ts`
- Modify: `lib/modules/reservation/admin/components/AdminBookingWizard.tsx`
- Modify: `lib/modules/reservation/api.ts`

- [ ] **Step 1: Add `promoApplied` to Booking interface**

In `lib/modules/reservation/types.ts`, add to the main Booking interface (find the field set including `customerName`, `total`, `points` etc.):

```ts
    promoApplied?: {
        refId: string;
        kind: 'promo' | 'voucher';
        label: string;
        discount: number;
    };
```

- [ ] **Step 2: Render PromoApplicator at confirmation step**

In `lib/modules/reservation/admin/components/AdminBookingWizard.tsx`, locate the confirmation/summary step (where total is displayed before submit).

Add imports:
```tsx
import PromoApplicator from '@/lib/modules/promo/components/PromoApplicator';
import { AppliedPromo } from '@/lib/modules/promo/types';
```

Add state at the top of the component:
```tsx
const [applied, setApplied] = useState<AppliedPromo | null>(null);
```

Add inside the confirmation step JSX (right after total display, before submit button):
```tsx
{siteId && subtotal > 0 && (
    <div className="space-y-2 border-t border-b py-3">
        <label className="text-xs font-bold text-gray-500 uppercase">Promo / Voucher</label>
        <PromoApplicator
            siteId={siteId}
            source="RESERVATION"
            subtotal={subtotal}
            memberId={selectedMemberId /* whatever the wizard already tracks */}
            onApplied={setApplied}
            onCleared={() => setApplied(null)}
        />
    </div>
)}
```

When showing the final total, subtract `applied?.discount`:
```tsx
const finalTotal = subtotal - (applied?.discount ?? 0);
```

When submitting, pass `applied` to the booking creation function (next step).

- [ ] **Step 3: Update reservation booking create to commit + persist**

In `lib/modules/reservation/api.ts`, find the booking-create function (e.g. `createBooking`). Update its signature to accept optional `applied: AppliedPromo | null`, persist it on the booking doc, and call the promo engine after success:

```ts
import { commitPromoUsage, reversePromoUsage } from '@/lib/modules/promo/api';
import { AppliedPromo } from '@/lib/modules/promo/types';

export async function createBooking(
    siteId: string,
    bookingData: ...,
    applied?: AppliedPromo | null
): Promise<Booking> {
    // ... existing creation logic ...
    const booking = ... ; // newly created booking with id

    if (applied) {
        // Persist on booking
        await updateDoc(doc(db, 'sites', siteId, BOOKINGS_COLLECTION, booking.id), {
            promoApplied: applied,
            total: (booking.total ?? 0) - applied.discount,
        });
        // Commit to engine
        await commitPromoUsage({
            siteId,
            refId: applied.refId,
            kind: applied.kind,
            source: 'RESERVATION',
            refDocId: booking.id,
            memberId: bookingData.memberId,
            discountApplied: applied.discount,
        });
    }
    return booking;
}
```

Find the booking-cancel function and add a reverse call:
```ts
// Inside cancelBooking or equivalent, after status flip:
await reversePromoUsage({ siteId, source: 'RESERVATION', refDocId: bookingId });
```

- [ ] **Step 4: Manual smoke test**

```
1. Create a promo eligible for RESERVATION
2. Open admin booking wizard, fill it through, reach confirmation step
3. Apply the promo via PromoApplicator → total drops
4. Submit → booking has promoApplied field, promo usageCount +1
5. Cancel the booking → reversePromoUsage runs, usageCount -1
```

- [ ] **Step 5: Commit**

```bash
git add lib/modules/reservation/types.ts lib/modules/reservation/admin/components/AdminBookingWizard.tsx lib/modules/reservation/api.ts
git commit -m "feat(reservation): integrate Promo Engine via PromoApplicator"
```

---

### Task 27: Service Records integration

**Files:**
- Modify: `lib/modules/service-records/types.ts`
- Modify: `lib/modules/service-records/admin/components/BillModal.tsx`
- Modify: `lib/modules/service-records/api.ts`

- [ ] **Step 1: Add `promoApplied` to ServiceRecord interface**

In `lib/modules/service-records/types.ts`, add the same field to the main ServiceRecord interface:

```ts
    promoApplied?: {
        refId: string;
        kind: 'promo' | 'voucher';
        label: string;
        discount: number;
    };
```

- [ ] **Step 2: Render PromoApplicator inside BillModal**

In `lib/modules/service-records/admin/components/BillModal.tsx`, add imports:
```tsx
import PromoApplicator from '@/lib/modules/promo/components/PromoApplicator';
import { AppliedPromo } from '@/lib/modules/promo/types';
```

Add state:
```tsx
const [applied, setApplied] = useState<AppliedPromo | null>(null);
```

Render the applicator in the modal's body (typically after total breakdown):
```tsx
{siteId && record.total > 0 && (
    <div className="space-y-2 border-t border-b py-3">
        <label className="text-xs font-bold text-gray-500 uppercase">Promo / Voucher</label>
        <PromoApplicator
            siteId={siteId}
            source="SERVICE"
            subtotal={record.total}
            memberId={record.memberId}
            onApplied={setApplied}
            onCleared={() => setApplied(null)}
        />
    </div>
)}
```

Pass `applied` into the bill-finalize handler.

- [ ] **Step 3: Update service-records api with persist + commit + reverse**

In `lib/modules/service-records/api.ts`:

```ts
import { commitPromoUsage, reversePromoUsage } from '@/lib/modules/promo/api';
import { AppliedPromo } from '@/lib/modules/promo/types';

export async function finalizeServiceBill(
    siteId: string,
    recordId: string,
    /* existing args */,
    applied?: AppliedPromo | null
): Promise<void> {
    // ... existing finalize logic ...

    if (applied) {
        await updateDoc(doc(db, 'sites', siteId, RECORDS_COLLECTION, recordId), {
            promoApplied: applied,
            // adjust total field name to match existing schema
            total: existingTotal - applied.discount,
        });
        await commitPromoUsage({
            siteId,
            refId: applied.refId,
            kind: applied.kind,
            source: 'SERVICE',
            refDocId: recordId,
            memberId: record.memberId,
            discountApplied: applied.discount,
        });
    }
}
```

Find the void/cancel function for service records and call:
```ts
await reversePromoUsage({ siteId, source: 'SERVICE', refDocId: recordId });
```

- [ ] **Step 4: Manual smoke test**

```
1. Create a SERVICE-eligible promo
2. Open a service record bill modal → apply promo → finalize
3. Confirm: record has promoApplied, promo usageCount +1
4. Void the record → usageCount -1
```

- [ ] **Step 5: Commit**

```bash
git add lib/modules/service-records/types.ts lib/modules/service-records/admin/components/BillModal.tsx lib/modules/service-records/api.ts
git commit -m "feat(service_records): integrate Promo Engine via PromoApplicator"
```

---

### Task 28: Module skill — `/promo`

**Files:**
- Create: `.claude/commands/promo.md`

- [ ] **Step 1: Write the skill**

```markdown
---
name: promo
description: Work with the Clicker Platform Promo Engine module — discounts, vouchers, points-redemption, auto-apply rules. Use this skill whenever building, designing, or modifying anything inside lib/modules/promo/.
---

# Promo Engine Module

The Promo Engine is an opt-in module that powers discounts, auto-apply rules, and points-redemption vouchers across all billing surfaces (POS, Reservation, Service Records, future modules).

## Architecture

- Standalone module at `lib/modules/promo/`
- Public API: only `lib/modules/promo/api.ts` (facade re-export). Other modules MUST import from here.
- Two collections: `sites/{siteId}/modules/promo/promos` and `sites/{siteId}/modules/promo/vouchers`
- Settings doc: `sites/{siteId}/modules/promo/settings/config`
- Sources registry: `lib/modules/promo/sources.ts` — single line per consumer module

## Core Concepts

- **Promo** — the rule (kind, value, conditions, trigger, status). One Promo can have many Vouchers.
- **Voucher** — an issuance/claim of a Promo, tied to a member, single-use, with snapshot fields locking value at issuance time.
- **Trigger** — `code` (manual entry), `auto` (engine applies), `claim` (member spends points or admin grants).
- **Source** — `POS | RESERVATION | SERVICE | OTHER` — which billing module is calling.
- **Audience** — `public | members | specific`.

## Rule Evaluation

`evaluatePromo()` runs the rule matrix in this order; first failure wins:
1. Promo status (must be `active`)
2. Date window (`validFrom`/`validUntil`)
3. Source eligibility (`eligibleSources`)
4. Audience (with `allowGuestCodes` site-wide override)
5. Min subtotal
6. Usage limits
7. Discount calculation (capped to subtotal & maxDiscount)

Voucher path additionally checks: voucher status, expiry, and member ownership.

## Two-phase Commit

```
evaluatePromo() → returns {refId, discount, label}      // pure read
   ↓
parent finalizes payment (creates POSOrder/Booking/etc)
   ↓
commitPromoUsage({refId, kind, source, refDocId, ...})  // atomic state change
```

Never call `commitPromoUsage` before the parent doc is created — if the user cancels, voucher state stays clean.

## Refund / Reversal

`reversePromoUsage({siteId, source, refDocId})` undoes a commit:
- Voucher status → `active`
- Promo `usageCount` decremented
- If voucher was `points_redemption`, refunds points via `membership.awardPoints(+delta)`
- Idempotent

## Snapshot Fields

When a voucher is issued, copy `kind/value/maxDiscount` into snapshot fields. Editing the parent Promo later does NOT retroactively change already-issued vouchers. Always read voucher discount from snapshot fields, never via `voucher.promoId → promo.value`.

## Voucher Code Format

`PREFIX-XXXX-XXXX` where PREFIX is up to 5 uppercase chars from settings (default `VCH`). Alphabet excludes ambiguous chars (no `0/O/1/I/L`). Generated by `generateVoucherCode(prefix)`.

## Files

| File | Responsibility |
|---|---|
| `types.ts` | All shared types (Promo, Voucher, EvaluationResult, …) |
| `constants.ts` | Collection paths, default settings |
| `sources.ts` | PROMO_SOURCES registry |
| `code-generator.ts` | Voucher code generation |
| `api.ts` | Public facade — only export point |
| `api/promos.ts` | Promo CRUD |
| `api/vouchers.ts` | Voucher CRUD |
| `api/settings.ts` | Settings get/update |
| `api/discount.ts` | Pure discount math |
| `api/evaluator.ts` | Rule eval, auto-apply finder |
| `api/commit.ts` | Two-phase commit + reverse, transactional |
| `api/claim.ts` | Voucher minting (claim/grant) |
| `admin/PromoListPage.tsx` | List + actions (pause, archive, edit) |
| `admin/PromoFormSheet.tsx` | 3-section form |
| `admin/VouchersPage.tsx` | Read-mostly admin view + grant |
| `admin/SettingsPage.tsx` | Code prefix, expiry default, guest toggle |
| `components/PromoApplicator.tsx` | Universal checkout component |
| `public/MemberRewardsWidget.tsx` | Member dashboard claim grid |
| `public/MyVouchersWidget.tsx` | Member voucher wallet + QR |

## Testing

- Use `vitest` + mock `firebase/firestore` at module boundary
- See `__tests__/evaluator.test.ts` for the rule-matrix coverage pattern
- Transactional code (`commit.ts`, `claim.ts`) mocks `runTransaction` and records ops to verify ordering

## What NOT to do inside this module

- Don't import from any peer module's internals (POS, Reservation, etc.) — only from their `api.ts`
- Don't add discount math anywhere except `api/discount.ts` — keep the engine the only place it lives
- Don't bypass `commitPromoUsage` and write directly to `usageCount` or voucher status
- Don't mutate snapshot fields after voucher issuance
- Don't add new sources without updating `sources.ts` first
```

- [ ] **Step 2: Commit**

```bash
git add .claude/commands/promo.md
git commit -m "docs(promo): module skill"
```

---

### Task 29: Integration skill — `/promo_integration`

**Files:**
- Create: `.claude/commands/promo_integration.md`

- [ ] **Step 1: Write the skill**

```markdown
---
name: promo_integration
description: Wire the Promo Engine into a new or existing billing module. Use this skill when a module has a checkout/billing flow that should accept Promo Engine discounts.
---

# Promo Integration Recipe

This skill is for integrating Promo Engine into a CONSUMER module's checkout flow. For working inside the Promo module itself, use `/promo`.

## When to use

- The module has a "checkout", "confirm payment", "finalize bill" step
- The merchant should be able to apply discounts/vouchers at that step
- The module is opt-in (merchant may disable it)

Examples: byod_pos cashier, reservation booking wizard, service-records bill modal, future RFQ checkout, future invoicing module.

## The 4-step recipe

### Step 1 — Add your source to the registry

In `lib/modules/promo/sources.ts`, add one entry:

```ts
MY_MODULE: { label: 'My Module', icon: 'lucide-icon-name', moduleKey: 'my_module' },
```

The PromoSource type updates automatically from the keys.

### Step 2 — Render `<PromoApplicator>` in the bill UI

```tsx
import PromoApplicator from '@/lib/modules/promo/components/PromoApplicator';
import { AppliedPromo } from '@/lib/modules/promo/types';

const [applied, setApplied] = useState<AppliedPromo | null>(null);

<PromoApplicator
    siteId={siteId}
    source="MY_MODULE"           // your registry key
    subtotal={subtotal}
    memberId={member?.id}        // optional — only when member is identified
    onApplied={setApplied}
    onCleared={() => setApplied(null)}
/>
```

Subtract from displayed total:
```tsx
const finalTotal = subtotal - (applied?.discount ?? 0);
```

### Step 3 — Commit usage AFTER payment finalizes

```ts
import { commitPromoUsage } from '@/lib/modules/promo/api';

const createdDoc = await createMyDomainDoc(...); // your existing creation
if (applied) {
    await commitPromoUsage({
        siteId,
        refId: applied.refId,
        kind: applied.kind,
        source: 'MY_MODULE',
        refDocId: createdDoc.id,
        memberId: member?.id,
        discountApplied: applied.discount,
    });
}
```

### Step 4 — Persist + add reverse hook on void/cancel

Persist on your domain doc (for receipts, reports):
```ts
await updateMyDomainDoc(createdDoc.id, {
    promoApplied: applied,
    total: subtotal - applied.discount,  // adapt field name
});
```

When the user voids/cancels the parent doc:
```ts
import { reversePromoUsage } from '@/lib/modules/promo/api';

await reversePromoUsage({ siteId, source: 'MY_MODULE', refDocId: docId });
```

## What NOT to do

- Don't import from `lib/modules/promo/` internals — ONLY `lib/modules/promo/api.ts` (or the component path for `<PromoApplicator>`).
- Don't reimplement discount math — let the engine return the discount; you just subtract.
- Don't call `commitPromoUsage` before the parent doc is created — voucher state must reflect actual paid commerce.
- Don't skip `reversePromoUsage` on void/cancel — vouchers will stay marked-used and points won't refund.
- Don't bypass `evaluatePromo` for "simple" cases — always validate via the engine; it handles all the conditions.

## Two-phase commit, illustrated

```
[user picks promo]
   ↓
evaluatePromo() → {refId, discount, label}    // pure read, no state change
   ↓
[user reviews bill, may cancel]
   ↓                     ↓
[confirms]          [cancels]
   ↓                     ↓
createParentDoc()   (no state change in promo)
   ↓
commitPromoUsage()  // single atomic op: usageCount++, voucher.status='used'
```

If you call `commitPromoUsage` before `createParentDoc()` and the doc creation fails, you've consumed a voucher with no order. Always commit AFTER.

## Reference implementation

`lib/modules/byod_pos/admin/components/PaymentConfirmationDialog.tsx` is the canonical example. Pattern your integration on it.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/commands/promo_integration.md
git commit -m "docs(promo): integration recipe skill"
```

---

### Task 30: Update CLAUDE.md peer-module exception

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the rule**

In `CLAUDE.md`, find this line in the Critical Rules section:

```
1. **Core vs Module boundary** — modules cannot import from each other directly.
```

Replace with:

```
1. **Core vs Module boundary** — modules cannot import from peer modules directly. Two designated modules expose public APIs for cross-module use: **Membership** (`lib/modules/membership/api.ts`) and **Promo** (`lib/modules/promo/api.ts`). Other modules must only import via these `api.ts` entry points — never reach into internals.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: clarify cross-module import policy with Membership/Promo exception"
```

---

### Task 31: Final integration test pass

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`
Expected: ALL PASS — no regressions in any other module's tests.

- [ ] **Step 2: Run typecheck**

Run: `pnpm exec tsc --noEmit -p .`
Expected: 0 errors.

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: 0 errors (warnings tolerable if pre-existing).

- [ ] **Step 4: Run dev server and walk every flow**

Run: `pnpm dev` (background)

```
Manual end-to-end flow:
1. Backyard → enable `promo` module on test site
2. /admin/promo/list → create one of each trigger:
   - Code: "TEST10" 10% off, all sources
   - Auto: 5K off if cart > 100K, POS only
   - Claim: "Reward 25K" for 500 pts, all sources
3. /admin/promo/vouchers → grant the Reward to test member
4. Member dashboard → see claimable rewards, see granted voucher
5. POS Cashier → start order, pay → applicator shows auto promo applied,
   try TEST10, try the granted voucher (via code or QR scan)
6. Reservation booking wizard → repeat
7. Service Records bill → repeat
8. Void POS order → reverse should restore voucher, refund points
```

- [ ] **Step 5: Final commit (only if any small fixups discovered)**

If any minor fixes needed: `git add -A && git commit -m "chore(promo): final integration fixes"`

If clean: no final commit needed.

---

# Done

Phase artifacts:
- ✅ `dev/superpowers/specs/2026-04-28-promo-engine-design.md`
- ✅ `lib/modules/promo/` (full module)
- ✅ `.claude/commands/promo.md`
- ✅ `.claude/commands/promo_integration.md`
- ✅ Updated CLAUDE.md
- ✅ POS / Reservation / Service Records integrated
- ✅ Member dashboard widgets live
