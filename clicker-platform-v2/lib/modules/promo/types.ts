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
