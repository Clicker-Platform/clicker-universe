// lib/modules/promo/api/evaluator.ts
import { Timestamp } from 'firebase/firestore';
import { findPromoByCode, listPromos } from './promos';
import { findVoucherByCode } from './vouchers';
import { getPromoSettings } from './settings';
import { calculateDiscount } from './discount';
import type { EvaluationResult, PromoSource, Promo, Voucher } from '../types';

export interface EvaluateInput {
  siteId: string;
  code: string;        // Either a promo code or voucher code
  subtotal: number;
  source: PromoSource;
  memberId?: string;   // undefined = guest
}

// Helper: check if a Timestamp is in the past
function isExpired(ts: Timestamp): boolean {
  return ts.toMillis() < Date.now();
}

// Helper: check if source is eligible (empty array = all eligible)
function sourceEligible(eligibleSources: PromoSource[], source: PromoSource): boolean {
  if (eligibleSources.length === 0) return true;
  return eligibleSources.includes(source);
}

// Helper: check audience match
function audienceMatches(promo: Promo, memberId?: string): boolean {
  const { audience, specificMemberIds } = promo.conditions;
  if (audience === 'public') return true;
  if (audience === 'members') return memberId !== undefined;
  if (audience === 'specific') {
    return memberId !== undefined && (specificMemberIds?.includes(memberId) ?? false);
  }
  return false;
}

// Main evaluation function
export async function evaluatePromo(input: EvaluateInput): Promise<EvaluationResult> {
  const { siteId, code, subtotal, source, memberId } = input;

  // 1. Try to find a Promo (by code field) first, then a Voucher
  const [promo, voucher] = await Promise.all([
    findPromoByCode(siteId, code),
    findVoucherByCode(siteId, code),
  ]);

  // 2. If neither found → not_found
  if (!promo && !voucher) {
    return { ok: false, reason: 'not_found', message: 'Promo or voucher code not found.' };
  }

  // 3. Promo path
  if (promo) {
    // Paused check
    if (promo.status === 'paused') {
      return { ok: false, reason: 'paused', message: 'This promo is currently paused.' };
    }

    // Window check
    if (promo.conditions.validUntil && isExpired(promo.conditions.validUntil)) {
      return { ok: false, reason: 'expired', message: 'This promo has expired.' };
    }
    if (promo.conditions.validFrom && !isExpired(promo.conditions.validFrom)) {
      return { ok: false, reason: 'expired', message: 'This promo is not yet active.' };
    }

    // Source check
    if (!sourceEligible(promo.conditions.eligibleSources, source)) {
      return { ok: false, reason: 'wrong_source', message: 'This promo is not valid for this order type.' };
    }

    // Audience check + guest allowance
    const settings = await getPromoSettings(siteId);
    if (!memberId && !settings.allowGuestCodes) {
      return { ok: false, reason: 'audience_mismatch', message: 'Guest checkouts are not eligible for promo codes.' };
    }
    if (!audienceMatches(promo, memberId)) {
      return { ok: false, reason: 'audience_mismatch', message: 'This promo is not available for your account type.' };
    }

    // Min subtotal check
    if (promo.conditions.minSubtotal !== undefined && subtotal < promo.conditions.minSubtotal) {
      return { ok: false, reason: 'min_subtotal_unmet', message: `Minimum order amount of ${promo.conditions.minSubtotal} required.` };
    }

    // Usage exhausted
    if (promo.maxUses !== undefined && promo.usageCount >= promo.maxUses) {
      return { ok: false, reason: 'usage_exhausted', message: 'This promo has reached its usage limit.' };
    }

    // Calculate discount
    const discount = calculateDiscount(
      { kind: promo.kind, value: promo.value, maxDiscount: promo.maxDiscount },
      subtotal,
    );

    return {
      ok: true,
      kind: 'promo',
      refId: promo.id,
      label: promo.name,
      discount,
      remainingSubtotal: subtotal - discount,
    };
  }

  // 4. Voucher path
  const v = voucher as Voucher;

  // Status check
  if (v.status === 'used') {
    return { ok: false, reason: 'already_used', message: 'This voucher has already been used.' };
  }
  if (v.status === 'expired') {
    return { ok: false, reason: 'expired', message: 'This voucher has expired.' };
  }

  // Owner check
  if (v.ownerMemberId !== memberId) {
    return { ok: false, reason: 'audience_mismatch', message: 'This voucher belongs to a different member.' };
  }

  // ExpiresAt check
  if (v.expiresAt && isExpired(v.expiresAt)) {
    return { ok: false, reason: 'expired', message: 'This voucher has expired.' };
  }

  // Calculate discount from snapshot fields
  const discount = calculateDiscount(
    { kind: v.snapshotKind, value: v.snapshotValue, maxDiscount: v.snapshotMaxDiscount },
    subtotal,
  );

  return {
    ok: true,
    kind: 'voucher',
    refId: v.id,
    label: v.code,
    discount,
    remainingSubtotal: subtotal - discount,
  };
}

export async function findAutoApplicable(
  siteId: string,
  subtotal: number,
  source: PromoSource,
  memberId?: string,
): Promise<EvaluationResult | null> {
  // 1. Fetch all active promos for the site
  const allPromos = await listPromos(siteId);

  // 2. Filter to only trigger='auto' and status='active' promos
  const candidates = allPromos.filter(p => p.trigger === 'auto' && p.status === 'active');

  if (candidates.length === 0) return null;

  // 3. Fetch settings once for audience/guest check
  const settings = await getPromoSettings(siteId);

  // 4. Run rule checks for each candidate and calculate discount
  let best: EvaluationResult | null = null;
  let bestDiscount = -1;

  for (const promo of candidates) {
    // Paused check (redundant given filter above, but defensive)
    if (promo.status === 'paused') continue;

    // Window check
    if (promo.conditions.validUntil && isExpired(promo.conditions.validUntil)) continue;
    if (promo.conditions.validFrom && !isExpired(promo.conditions.validFrom)) continue;

    // Source check
    if (!sourceEligible(promo.conditions.eligibleSources, source)) continue;

    // Audience/guest check
    if (!memberId && !settings.allowGuestCodes) continue;
    if (!audienceMatches(promo, memberId)) continue;

    // Min subtotal check
    if (promo.conditions.minSubtotal !== undefined && subtotal < promo.conditions.minSubtotal) continue;

    // Usage exhausted check
    if (promo.maxUses !== undefined && promo.usageCount >= promo.maxUses) continue;

    // Calculate discount
    const discount = calculateDiscount(
      { kind: promo.kind, value: promo.value, maxDiscount: promo.maxDiscount },
      subtotal,
    );

    // 5. Keep track of the highest discount
    if (discount > bestDiscount) {
      bestDiscount = discount;
      best = {
        ok: true,
        kind: 'promo',
        refId: promo.id,
        label: promo.name,
        discount,
        remainingSubtotal: subtotal - discount,
      };
    }
  }

  // 6. Return best or null
  return best;
}
