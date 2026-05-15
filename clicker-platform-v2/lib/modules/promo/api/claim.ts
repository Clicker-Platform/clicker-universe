// lib/modules/promo/api/claim.ts
import { getFirestore, collection, doc, setDoc, Timestamp } from 'firebase/firestore';
import { generateVoucherCode } from '../code-generator';
import { getPromo } from './promos';
import { getPromoSettings } from './settings';
import { VOUCHERS_COLLECTION } from '../constants';
import type { Voucher, VoucherIssuedVia } from '../types';
import { awardPoints } from '@/lib/modules/membership/api';

export interface ClaimVoucherInput {
  siteId: string;
  promoId: string;
  memberId: string;
  memberName?: string;
  issuedVia: VoucherIssuedVia;
}

// Mints a new voucher for a member.
// - Fetches the promo to get snapshot values + costInPoints/voucherExpiryDays
// - If promo.trigger !== 'claim' and issuedVia === 'points_redemption', throws Error('Promo is not claimable')
// - Generates a voucher code using generateVoucherCode(settings.voucherCodePrefix)
// - Sets expiresAt = now + (promo.voucherExpiryDays ?? settings.defaultVoucherExpiryDays) days
// - Writes the Voucher document to Firestore
// - Returns the created Voucher
export async function claimVoucher(input: ClaimVoucherInput): Promise<Voucher> {
  const { siteId, promoId, memberId, memberName, issuedVia } = input;

  const [promo, settings] = await Promise.all([
    getPromo(siteId, promoId),
    getPromoSettings(siteId),
  ]);

  if (!promo) {
    throw new Error('Promo not found');
  }

  if (promo.trigger !== 'claim' && issuedVia === 'points_redemption') {
    throw new Error('Promo is not claimable');
  }

  const code = generateVoucherCode(settings.voucherCodePrefix);

  const now = Timestamp.now();
  const nowDate = now.toDate();
  const expiryDays = promo.voucherExpiryDays ?? settings.defaultVoucherExpiryDays;
  const expiresDate = new Date(nowDate.getTime() + expiryDays * 24 * 60 * 60 * 1000);
  const expiresAt = Timestamp.fromDate(expiresDate);

  const db = getFirestore();
  const ref = doc(collection(db, 'sites', siteId, VOUCHERS_COLLECTION));

  const voucher: Voucher = {
    id: ref.id,
    siteId,
    promoId,
    code,
    ownerMemberId: memberId,
    ...(memberName !== undefined ? { ownerName: memberName } : {}),
    status: 'active',
    issuedAt: now,
    expiresAt,
    issuedVia,
    snapshotKind: promo.kind,
    snapshotValue: promo.value,
    ...(promo.maxDiscount !== undefined ? { snapshotMaxDiscount: promo.maxDiscount } : {}),
  };

  await setDoc(ref, voucher);

  // Deduct points after voucher is written — best-effort (non-fatal if loyalty disabled)
  if (issuedVia === 'points_redemption' && promo.costInPoints) {
    await awardPoints(
      siteId,
      memberId,
      -promo.costInPoints,
      'PROMO_CLAIM',
      ref.id,
      `Redeemed for voucher: ${voucher.code}`,
    );
  }

  return voucher;
}

// Admin grants a voucher directly (bypasses trigger check)
export async function grantVoucher(input: Omit<ClaimVoucherInput, 'issuedVia'>): Promise<Voucher> {
  return claimVoucher({ ...input, issuedVia: 'admin_grant' });
}
