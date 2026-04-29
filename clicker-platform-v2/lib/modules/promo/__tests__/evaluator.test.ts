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
const PAST = new Date('2020-01-01T00:00:00Z');

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

function makeVoucher(v: Partial<Voucher> = {}): Voucher {
  return {
    id: 'v1',
    siteId: 's1',
    promoId: 'p1',
    code: 'VCH-ABCD',
    ownerMemberId: 'member-A',
    status: 'active',
    issuedAt: ts(NOW),
    issuedVia: 'admin_grant',
    snapshotKind: 'fixed',
    snapshotValue: 50_000,
    ...v,
  };
}

const DEFAULT_SETTINGS: PromoSettings = {
  voucherCodePrefix: 'VCH',
  defaultVoucherExpiryDays: 30,
  allowGuestCodes: true,
};

describe('evaluatePromo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (settingsApi.getPromoSettings as any).mockResolvedValue(DEFAULT_SETTINGS);
    (vouchersApi.findVoucherByCode as any).mockResolvedValue(null);
  });

  // Test 1: Happy path — active promo
  it('1. happy path: returns ok=true with correct discount for active promo', async () => {
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

  // Test 2: not_found — neither promo nor voucher found
  it('2. not_found: returns ok=false when both promo and voucher lookups return null', async () => {
    (promosApi.findPromoByCode as any).mockResolvedValue(null);
    (vouchersApi.findVoucherByCode as any).mockResolvedValue(null);

    const r = await evaluatePromo({
      siteId: 's1', source: 'POS', subtotal: 100_000, code: 'INVALID',
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('not_found');
    }
  });

  // Test 3: Guest blocked — allowGuestCodes = false
  it('3. audience_mismatch: blocks guest when allowGuestCodes=false', async () => {
    (promosApi.findPromoByCode as any).mockResolvedValue(
      makePromo({ conditions: { eligibleSources: [], audience: 'public' } })
    );
    (settingsApi.getPromoSettings as any).mockResolvedValue({
      ...DEFAULT_SETTINGS,
      allowGuestCodes: false,
    });

    const r = await evaluatePromo({
      siteId: 's1', source: 'POS', subtotal: 100_000, code: 'PROMO10',
      // no memberId = guest
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('audience_mismatch');
    }
  });

  // Test 4: Expired window
  it('4. expired: returns ok=false when validUntil is in the past', async () => {
    (promosApi.findPromoByCode as any).mockResolvedValue(
      makePromo({
        conditions: {
          eligibleSources: [],
          audience: 'public',
          validUntil: ts(PAST),
        },
      })
    );

    const r = await evaluatePromo({
      siteId: 's1', source: 'POS', subtotal: 100_000, code: 'OLDCODE',
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('expired');
    }
  });

  // Test 5: Wrong source
  it('5. wrong_source: returns ok=false when source not in eligibleSources', async () => {
    (promosApi.findPromoByCode as any).mockResolvedValue(
      makePromo({
        conditions: {
          eligibleSources: ['RESERVATION'],
          audience: 'public',
        },
      })
    );

    const r = await evaluatePromo({
      siteId: 's1', source: 'POS', subtotal: 100_000, code: 'RESCODE',
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('wrong_source');
    }
  });

  // Test 6: Min subtotal unmet
  it('6. min_subtotal_unmet: returns ok=false when subtotal < minSubtotal', async () => {
    (promosApi.findPromoByCode as any).mockResolvedValue(
      makePromo({
        conditions: {
          eligibleSources: [],
          audience: 'public',
          minSubtotal: 100,
        },
      })
    );

    const r = await evaluatePromo({
      siteId: 's1', source: 'POS', subtotal: 50, code: 'MINCODE',
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('min_subtotal_unmet');
    }
  });

  // Test 7: Usage exhausted
  it('7. usage_exhausted: returns ok=false when usageCount >= maxUses', async () => {
    (promosApi.findPromoByCode as any).mockResolvedValue(
      makePromo({ maxUses: 10, usageCount: 10 })
    );

    const r = await evaluatePromo({
      siteId: 's1', source: 'POS', subtotal: 100_000, code: 'FULLCODE',
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('usage_exhausted');
    }
  });

  // Test 8: Paused promo
  it('8. paused: returns ok=false when promo status is paused', async () => {
    (promosApi.findPromoByCode as any).mockResolvedValue(
      makePromo({ status: 'paused' })
    );

    const r = await evaluatePromo({
      siteId: 's1', source: 'POS', subtotal: 100_000, code: 'PAUSEDCODE',
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('paused');
    }
  });

  // Test 9: Voucher — wrong owner
  it('9. audience_mismatch: returns ok=false when voucher owner != memberId', async () => {
    (promosApi.findPromoByCode as any).mockResolvedValue(null);
    (vouchersApi.findVoucherByCode as any).mockResolvedValue(
      makeVoucher({ ownerMemberId: 'member-A' })
    );

    const r = await evaluatePromo({
      siteId: 's1', source: 'POS', subtotal: 100_000, code: 'VCH-ABCD',
      memberId: 'member-B',
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('audience_mismatch');
    }
  });

  // Test 10: Voucher — already used
  it('10. already_used: returns ok=false when voucher status is used', async () => {
    (promosApi.findPromoByCode as any).mockResolvedValue(null);
    (vouchersApi.findVoucherByCode as any).mockResolvedValue(
      makeVoucher({ status: 'used' })
    );

    const r = await evaluatePromo({
      siteId: 's1', source: 'POS', subtotal: 100_000, code: 'VCH-ABCD',
      memberId: 'member-A',
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('already_used');
    }
  });
});
