// lib/modules/promo/api.ts
// Public API facade — the ONLY file other modules may import from.

// Settings
export { getPromoSettings, updatePromoSettings } from './api/settings';

// Promos
export {
  listPromos,
  getPromo,
  findPromoByCode,
  createPromo,
  updatePromo,
  setPromoStatus,
  deletePromo,
  listClaimablePromos,
} from './api/promos';

// Vouchers
export {
  listAllVouchers,
  listMemberVouchers,
  findVoucherByCode,
  getVoucher,
  findVoucherByUsedRef,
  setVoucherStatus,
  revokeVoucher,
} from './api/vouchers';

// Discount
export { calculateDiscount } from './api/discount';
export type { DiscountInput } from './api/discount';

// Evaluator
export { evaluatePromo, findAutoApplicable } from './api/evaluator';
export type { EvaluateInput } from './api/evaluator';

// Commit/reverse
export { commitPromoUsage, reversePromoUsage } from './api/commit';
export type { CommitInput } from './api/commit';

// Claim/grant
export { claimVoucher, grantVoucher } from './api/claim';
export type { ClaimVoucherInput } from './api/claim';

// Types (re-export all public types so consumers only need to import from 'api')
export type {
  Promo,
  Voucher,
  PromoSettings,
  PromoSource,
  PromoKind,
  PromoStatus,
  PromoTrigger,
  PromoAudience,
  PromoConditions,
  VoucherStatus,
  VoucherIssuedVia,
  EvaluationResult,
  EvaluationFailure,
  AppliedPromo,
} from './types';
