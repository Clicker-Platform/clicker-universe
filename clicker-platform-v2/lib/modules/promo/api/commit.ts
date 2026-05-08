// lib/modules/promo/api/commit.ts
import { getFirestore, doc, runTransaction, Timestamp } from 'firebase/firestore';
import { PROMOS_COLLECTION, VOUCHERS_COLLECTION } from '../constants';
import type { PromoSource, AppliedPromo } from '../types';

export interface CommitInput {
  siteId: string;
  applied: AppliedPromo;  // { refId, kind, label, discount }
  source: PromoSource;
  refId: string;          // The order/booking/service ID being paid
  memberId?: string;
}

// Called after payment succeeds — atomically records usage
export async function commitPromoUsage(input: CommitInput): Promise<void> {
  const { siteId, applied, source, refId, memberId } = input;
  const db = getFirestore();

  if (applied.kind === 'promo') {
    const ref = doc(db, 'sites', siteId, PROMOS_COLLECTION, applied.refId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const current = (snap.data()?.usageCount ?? 0) as number;
      tx.update(ref, { usageCount: current + 1 });

      if (memberId) {
        const memberUsageRef = doc(db, 'sites', siteId, PROMOS_COLLECTION, applied.refId, 'memberUsage', memberId);
        const memberSnap = await tx.get(memberUsageRef);
        const memberCount = (memberSnap.data()?.count ?? 0) as number;
        tx.set(memberUsageRef, { count: memberCount + 1 }, { merge: true });
      }
    });
  } else {
    // kind === 'voucher'
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

// Called if payment fails after eval — reverses the usage record
// This is a best-effort reversal (if the commit never happened, this is a no-op)
export async function reversePromoUsage(input: CommitInput): Promise<void> {
  const { siteId, applied, refId, memberId } = input;
  const db = getFirestore();

  if (applied.kind === 'promo') {
    const ref = doc(db, 'sites', siteId, PROMOS_COLLECTION, applied.refId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const current = (snap.data()?.usageCount ?? 0) as number;
      tx.update(ref, { usageCount: Math.max(0, current - 1) });

      if (memberId) {
        const memberUsageRef = doc(db, 'sites', siteId, PROMOS_COLLECTION, applied.refId, 'memberUsage', memberId);
        const memberSnap = await tx.get(memberUsageRef);
        const memberCount = (memberSnap.data()?.count ?? 0) as number;
        tx.set(memberUsageRef, { count: Math.max(0, memberCount - 1) }, { merge: true });
      }
    });
  } else {
    // kind === 'voucher'
    const ref = doc(db, 'sites', siteId, VOUCHERS_COLLECTION, applied.refId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data();
      // Only reset if this voucher was used by the same order being reversed
      if (data?.usedRefId !== refId) {
        return; // Already used by someone else — do nothing
      }
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
