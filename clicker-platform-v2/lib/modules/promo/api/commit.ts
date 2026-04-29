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
  const { siteId, applied, source, refId } = input;
  const db = getFirestore();

  if (applied.kind === 'promo') {
    const ref = doc(db, 'sites', siteId, PROMOS_COLLECTION, applied.refId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const current = (snap.data()?.usageCount ?? 0) as number;
      tx.update(ref, { usageCount: current + 1 });
    });
  } else {
    // kind === 'voucher'
    const ref = doc(db, 'sites', siteId, VOUCHERS_COLLECTION, applied.refId);
    await runTransaction(db, async (tx) => {
      tx.update(ref, {
        status: 'used',
        usedAt: Timestamp.now(),
        usedSource: source,
        usedRefId: refId,
        usedDiscount: applied.discount,
      });
    });
  }
}

// Called if payment fails after eval — reverses the usage record
// This is a best-effort reversal (if the commit never happened, this is a no-op)
export async function reversePromoUsage(input: CommitInput): Promise<void> {
  const { siteId, applied, refId } = input;
  const db = getFirestore();

  if (applied.kind === 'promo') {
    const ref = doc(db, 'sites', siteId, PROMOS_COLLECTION, applied.refId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const current = (snap.data()?.usageCount ?? 0) as number;
      tx.update(ref, { usageCount: Math.max(0, current - 1) });
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
