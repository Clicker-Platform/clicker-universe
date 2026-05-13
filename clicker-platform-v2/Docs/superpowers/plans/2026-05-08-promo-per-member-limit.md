# Promo Per-Member Limit Enforcement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce `perMemberLimit` on promo codes so a single member cannot redeem the same promo more than the configured number of times.

**Architecture:** Add a `memberUsage` subcollection under each promo doc to track per-member redemption counts. The evaluator queries this before approving, and commit increments it atomically after payment. Guest users (no memberId) skip the check entirely since they cannot be tracked.

**Tech Stack:** Firebase Firestore (client SDK), TypeScript, Vitest

---

## File Map

| File | Action | What changes |
|---|---|---|
| `firestore.rules` | Modify | Add rule for `memberUsage` subcollection |
| `lib/modules/promo/api/evaluator.ts` | Modify | Query memberUsage and reject if over limit |
| `lib/modules/promo/api/commit.ts` | Modify | Increment memberUsage on commit, decrement on reverse |
| `lib/modules/promo/__tests__/evaluator.test.ts` | Modify | Add perMemberLimit test cases |
| `lib/modules/promo/__tests__/commit.test.ts` | Modify | Add memberUsage increment/decrement test cases |

---

## Task 1: Firestore Rules — Add `memberUsage` subcollection

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add rule after the promo engine section**

Open `firestore.rules`. Find the promo engine section (around line 347). Add the `memberUsage` subcollection rule inside `match /modules/promo/promos/{promoId}`:

```
// 6. PROMO ENGINE
match /modules/promo/promos/{promoId} {
  allow read: if true;
  allow write: if isValidUser(siteId) && hasRole(siteId, ['owner', 'staff']);

  // Per-member usage tracking — read by evaluator (public), write by commit (authenticated)
  match /memberUsage/{memberId} {
    allow read: if true;
    allow write: if isValidUser(siteId) || request.auth != null;
  }
}
```

- [ ] **Step 2: Deploy rules to staging**

```bash
firebase use clicker-universe-stagging
firebase deploy --only firestore:rules
```

Expected: `Deploy complete!`

- [ ] **Step 3: Deploy rules to prod**

```bash
firebase use clicker-universe
firebase deploy --only firestore:rules
```

Expected: `Deploy complete!`

---

## Task 2: Evaluator — Check perMemberLimit before approving

**Files:**
- Modify: `lib/modules/promo/api/evaluator.ts`

- [ ] **Step 1: Write failing test**

Open `lib/modules/promo/__tests__/evaluator.test.ts`. Add these test cases in the promo evaluation section:

```typescript
describe('perMemberLimit', () => {
  it('allows when perMemberLimit not set', async () => {
    const promo = makePromo({ perMemberLimit: undefined });
    mockFindPromoByCode.mockResolvedValue(promo);
    mockGetMemberUsageCount.mockResolvedValue(0);

    const result = await evaluatePromo({
      siteId: 'test',
      code: 'CODE',
      subtotal: 100000,
      source: 'RESERVATION',
      memberId: 'member-1',
    });

    expect(result.ok).toBe(true);
  });

  it('allows when member usage is below limit', async () => {
    const promo = makePromo({ perMemberLimit: 3 });
    mockFindPromoByCode.mockResolvedValue(promo);
    mockGetMemberUsageCount.mockResolvedValue(2);

    const result = await evaluatePromo({
      siteId: 'test',
      code: 'CODE',
      subtotal: 100000,
      source: 'RESERVATION',
      memberId: 'member-1',
    });

    expect(result.ok).toBe(true);
  });

  it('rejects when member usage is at limit', async () => {
    const promo = makePromo({ perMemberLimit: 1 });
    mockFindPromoByCode.mockResolvedValue(promo);
    mockGetMemberUsageCount.mockResolvedValue(1);

    const result = await evaluatePromo({
      siteId: 'test',
      code: 'CODE',
      subtotal: 100000,
      source: 'RESERVATION',
      memberId: 'member-1',
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('per_member_limit_reached');
  });

  it('skips perMemberLimit check for guest (no memberId)', async () => {
    const promo = makePromo({ perMemberLimit: 1 });
    mockFindPromoByCode.mockResolvedValue(promo);

    const result = await evaluatePromo({
      siteId: 'test',
      code: 'CODE',
      subtotal: 100000,
      source: 'RESERVATION',
      memberId: undefined,
    });

    // Guest skips limit check — only blocked by allowGuestCodes setting
    expect(result.ok).toBe(true);
    // getMemberUsageCount should NOT be called for guests
    expect(mockGetMemberUsageCount).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd dev/clicker-platform-v2
pnpm test lib/modules/promo/__tests__/evaluator.test.ts
```

Expected: FAIL — `mockGetMemberUsageCount is not defined`

- [ ] **Step 3: Add `getMemberUsageCount` to vouchers API**

Open `lib/modules/promo/api/vouchers.ts`. Add this function at the bottom:

```typescript
export async function getMemberUsageCount(
  siteId: string,
  promoId: string,
  memberId: string,
): Promise<number> {
  const ref = doc(db, 'sites', siteId, PROMOS_COLLECTION, promoId, 'memberUsage', memberId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return 0;
  return (snap.data().count as number) ?? 0;
}
```

Make sure `doc`, `getDoc` are already imported from `firebase/firestore` (they are). Also import `PROMOS_COLLECTION` from `../constants`.

- [ ] **Step 4: Export from api.ts**

Open `lib/modules/promo/api.ts`. Add `getMemberUsageCount` to the vouchers export:

```typescript
export {
  listAllVouchers,
  listMemberVouchers,
  findVoucherByCode,
  getVoucher,
  findVoucherByUsedRef,
  setVoucherStatus,
  revokeVoucher,
  getMemberUsageCount,
} from './api/vouchers';
```

- [ ] **Step 5: Add perMemberLimit check to evaluator**

Open `lib/modules/promo/api/evaluator.ts`. Add import at top:

```typescript
import { findVoucherByCode, getMemberUsageCount } from './vouchers';
```

Replace the existing import line for `findVoucherByCode`.

Then add the check inside the promo path, after the `usage_exhausted` check (after line `if (promo.maxUses !== undefined && promo.usageCount >= promo.maxUses)`):

```typescript
// Per-member limit check — only for identified members
if (promo.perMemberLimit !== undefined && memberId) {
  const memberCount = await getMemberUsageCount(siteId, promo.id, memberId);
  if (memberCount >= promo.perMemberLimit) {
    return {
      ok: false,
      reason: 'per_member_limit_reached',
      message: `You have already used this promo the maximum number of times (${promo.perMemberLimit}x).`,
    };
  }
}
```

- [ ] **Step 6: Add `per_member_limit_reached` to EvaluationFailure type**

Open `lib/modules/promo/types.ts`. Find `EvaluationFailure` type and add the new reason:

```typescript
export type EvaluationFailure = {
  ok: false;
  reason:
    | 'not_found'
    | 'expired'
    | 'paused'
    | 'wrong_source'
    | 'audience_mismatch'
    | 'min_subtotal_unmet'
    | 'usage_exhausted'
    | 'already_used'
    | 'per_member_limit_reached';
  message: string;
};
```

- [ ] **Step 7: Run test to verify it passes**

```bash
pnpm test lib/modules/promo/__tests__/evaluator.test.ts
```

Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add lib/modules/promo/api/evaluator.ts lib/modules/promo/api/vouchers.ts lib/modules/promo/api.ts lib/modules/promo/types.ts lib/modules/promo/__tests__/evaluator.test.ts
git commit -m "feat(promo): enforce perMemberLimit in evaluator"
```

---

## Task 3: Commit — Track per-member usage atomically

**Files:**
- Modify: `lib/modules/promo/api/commit.ts`

- [ ] **Step 1: Write failing test**

Open `lib/modules/promo/__tests__/commit.test.ts`. Add these test cases:

```typescript
describe('memberUsage tracking', () => {
  it('increments memberUsage when promo committed with memberId', async () => {
    await commitPromoUsage({
      siteId: 'test',
      applied: { refId: 'promo-1', kind: 'promo', label: 'TEST', discount: 10000 },
      source: 'RESERVATION',
      refId: 'booking-1',
      memberId: 'member-1',
    });

    const usageRef = doc(db, 'sites', 'test', 'modules/promo/promos', 'promo-1', 'memberUsage', 'member-1');
    const snap = await getDoc(usageRef);
    expect(snap.data()?.count).toBe(1);
  });

  it('does not create memberUsage when no memberId (guest)', async () => {
    await commitPromoUsage({
      siteId: 'test',
      applied: { refId: 'promo-1', kind: 'promo', label: 'TEST', discount: 10000 },
      source: 'RESERVATION',
      refId: 'booking-2',
      memberId: undefined,
    });

    const usageRef = doc(db, 'sites', 'test', 'modules/promo/promos', 'promo-1', 'memberUsage', 'undefined');
    const snap = await getDoc(usageRef);
    expect(snap.exists()).toBe(false);
  });

  it('decrements memberUsage on reversal', async () => {
    // First commit to set count to 1
    await commitPromoUsage({
      siteId: 'test',
      applied: { refId: 'promo-1', kind: 'promo', label: 'TEST', discount: 10000 },
      source: 'RESERVATION',
      refId: 'booking-3',
      memberId: 'member-1',
    });

    // Then reverse
    await reversePromoUsage({
      siteId: 'test',
      applied: { refId: 'promo-1', kind: 'promo', label: 'TEST', discount: 10000 },
      source: 'RESERVATION',
      refId: 'booking-3',
      memberId: 'member-1',
    });

    const usageRef = doc(db, 'sites', 'test', 'modules/promo/promos', 'promo-1', 'memberUsage', 'member-1');
    const snap = await getDoc(usageRef);
    expect(snap.data()?.count).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test lib/modules/promo/__tests__/commit.test.ts
```

Expected: FAIL — memberUsage not incremented

- [ ] **Step 3: Update commitPromoUsage to track per-member usage**

Open `lib/modules/promo/api/commit.ts`. Update the promo path inside `commitPromoUsage`:

```typescript
export async function commitPromoUsage(input: CommitInput): Promise<void> {
  const { siteId, applied, source, refId, memberId } = input;
  const db = getFirestore();

  if (applied.kind === 'promo') {
    const promoRef = doc(db, 'sites', siteId, PROMOS_COLLECTION, applied.refId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(promoRef);
      const current = (snap.data()?.usageCount ?? 0) as number;
      tx.update(promoRef, { usageCount: current + 1 });

      // Track per-member usage if member is identified
      if (memberId) {
        const memberUsageRef = doc(db, 'sites', siteId, PROMOS_COLLECTION, applied.refId, 'memberUsage', memberId);
        const memberSnap = await tx.get(memberUsageRef);
        const memberCount = (memberSnap.data()?.count ?? 0) as number;
        tx.set(memberUsageRef, { count: memberCount + 1 }, { merge: true });
      }
    });
  } else {
    // kind === 'voucher' — existing logic unchanged
    const voucherRef = doc(db, 'sites', siteId, VOUCHERS_COLLECTION, applied.refId);
    await runTransaction(db, async (tx) => {
      const voucherSnap = await tx.get(voucherRef);
      const promoId = voucherSnap.data()?.promoId as string;
      tx.update(voucherRef, {
        status: 'used',
        usedAt: Timestamp.now(),
        usedSource: source,
        usedRefId: refId,
        usedDiscount: applied.discount,
      });
      if (promoId) {
        const promoRef = doc(db, 'sites', siteId, PROMOS_COLLECTION, promoId);
        const promoSnap = await tx.get(promoRef);
        const currentCount = (promoSnap.data()?.usageCount ?? 0) as number;
        tx.update(promoRef, { usageCount: currentCount + 1 });
      }
    });
  }
}
```

- [ ] **Step 4: Update reversePromoUsage to decrement per-member usage**

In the same file, update the promo path inside `reversePromoUsage`:

```typescript
export async function reversePromoUsage(input: CommitInput): Promise<void> {
  const { siteId, applied, refId, memberId } = input;
  const db = getFirestore();

  if (applied.kind === 'promo') {
    const promoRef = doc(db, 'sites', siteId, PROMOS_COLLECTION, applied.refId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(promoRef);
      const current = (snap.data()?.usageCount ?? 0) as number;
      tx.update(promoRef, { usageCount: Math.max(0, current - 1) });

      // Decrement per-member usage if member is identified
      if (memberId) {
        const memberUsageRef = doc(db, 'sites', siteId, PROMOS_COLLECTION, applied.refId, 'memberUsage', memberId);
        const memberSnap = await tx.get(memberUsageRef);
        const memberCount = (memberSnap.data()?.count ?? 0) as number;
        tx.set(memberUsageRef, { count: Math.max(0, memberCount - 1) }, { merge: true });
      }
    });
  } else {
    // kind === 'voucher' — existing logic unchanged
    const ref = doc(db, 'sites', siteId, VOUCHERS_COLLECTION, applied.refId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data();
      if (data?.usedRefId !== refId) return;
      tx.update(ref, {
        status: 'active',
        usedAt: null,
        usedSource: null,
        usedRefId: null,
        usedDiscount: null,
      });
    });
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm test lib/modules/promo/__tests__/commit.test.ts
```

Expected: All tests PASS

- [ ] **Step 6: Run all promo tests**

```bash
pnpm test lib/modules/promo/__tests__/
```

Expected: All tests PASS — no regressions

- [ ] **Step 7: Commit**

```bash
git add lib/modules/promo/api/commit.ts lib/modules/promo/__tests__/commit.test.ts
git commit -m "feat(promo): track per-member usage in memberUsage subcollection"
```

---

## Task 4: Deploy & Verify

- [ ] **Step 1: Build check**

```bash
pnpm build
```

Expected: No TypeScript errors, build succeeds.

- [ ] **Step 2: Manual test — perMemberLimit enforced**

1. Buka staging site yang punya promo dengan `perMemberLimit: 1`
2. Login sebagai member
3. Apply promo code → berhasil (usage = 0, limit = 1)
4. Buat booking/order baru, apply promo code yang sama → **harus ditolak** dengan pesan "You have already used this promo the maximum number of times (1x)"

- [ ] **Step 3: Manual test — guest tidak kena limit**

1. Buka public booking form tanpa login
2. Apply promo code yang sama → **harus berhasil** (guest skip limit check)

- [ ] **Step 4: Manual test — unlimited promo tidak terpengaruh**

1. Apply promo tanpa `perMemberLimit` (misal `MORECLICK`) berkali-kali sebagai member
2. Harus tetap berhasil setiap kali (sampai `maxUses` habis)

- [ ] **Step 5: Final commit & push**

```bash
git push origin main
```
