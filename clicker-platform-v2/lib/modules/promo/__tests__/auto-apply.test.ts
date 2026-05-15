import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { findAutoApplicable } from '../api/evaluator';
import { Promo, PromoSettings } from '../types';

vi.mock('../api/promos');
vi.mock('../api/settings');

import * as promosApi from '../api/promos';
import * as settingsApi from '../api/settings';

const ts = (date: Date) => Timestamp.fromDate(date);
const NOW = new Date('2026-04-28T10:00:00Z');

function makePromo(p: Partial<Promo> = {}): Promo {
  return {
    id: 'p1',
    siteId: 's1',
    name: 'Test Promo',
    kind: 'percent',
    value: 10,
    conditions: {
      eligibleSources: [],
      audience: 'public',
    },
    usageCount: 0,
    trigger: 'auto',
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

describe('findAutoApplicable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(settingsApi.getPromoSettings).mockResolvedValue(DEFAULT_SETTINGS);
  });

  // Test 1: Returns the promo with the highest discount when multiple eligible auto promos exist
  it('1. returns best promo: picks the one with highest discount', async () => {
    const promoA = makePromo({ id: 'p1', name: 'Promo A', kind: 'percent', value: 10 }); // 10% of 100_000 = 10_000
    const promoB = makePromo({ id: 'p2', name: 'Promo B', kind: 'fixed', value: 30_000 }); // fixed 30_000
    vi.mocked(promosApi.listPromos).mockResolvedValue([promoA, promoB]);

    const result = await findAutoApplicable('s1', 100_000, 'POS');

    expect(result).not.toBeNull();
    expect(result!.ok).toBe(true);
    if (result && result.ok) {
      expect(result.refId).toBe('p2');
      expect(result.discount).toBe(30_000);
    }
  });

  // Test 2: Returns null when all candidates fail rule checks
  it('2. returns null when none qualify: all fail rule checks', async () => {
    const pausedPromo = makePromo({ id: 'p1', status: 'paused' });
    const exhaustedPromo = makePromo({ id: 'p2', maxUses: 5, usageCount: 5 });
    vi.mocked(promosApi.listPromos).mockResolvedValue([pausedPromo, exhaustedPromo]);

    const result = await findAutoApplicable('s1', 100_000, 'POS');

    expect(result).toBeNull();
  });

  // Test 3: Returns null when listPromos returns empty array
  it('3. returns null for empty list', async () => {
    vi.mocked(promosApi.listPromos).mockResolvedValue([]);

    const result = await findAutoApplicable('s1', 100_000, 'POS');

    expect(result).toBeNull();
  });

  // Test 4: Filters out non-auto trigger promos, only considers trigger='auto'
  it('4. filters non-auto trigger: ignores code and claim promos', async () => {
    const codePromo = makePromo({ id: 'p1', trigger: 'code', kind: 'fixed', value: 50_000 });
    const claimPromo = makePromo({ id: 'p2', trigger: 'claim', kind: 'fixed', value: 40_000 });
    const autoPromo = makePromo({ id: 'p3', trigger: 'auto', kind: 'fixed', value: 20_000 });
    vi.mocked(promosApi.listPromos).mockResolvedValue([codePromo, claimPromo, autoPromo]);

    const result = await findAutoApplicable('s1', 100_000, 'POS');

    expect(result).not.toBeNull();
    expect(result!.ok).toBe(true);
    if (result && result.ok) {
      expect(result.refId).toBe('p3');
      expect(result.discount).toBe(20_000);
    }
  });

  // Test 5: Skips promo with wrong source, returns matching one
  it('5. skips ineligible source: returns the promo that matches source', async () => {
    const wrongSource = makePromo({
      id: 'p1',
      kind: 'fixed',
      value: 50_000,
      conditions: { eligibleSources: ['RESERVATION'], audience: 'public' },
    });
    const rightSource = makePromo({
      id: 'p2',
      kind: 'fixed',
      value: 20_000,
      conditions: { eligibleSources: ['POS'], audience: 'public' },
    });
    vi.mocked(promosApi.listPromos).mockResolvedValue([wrongSource, rightSource]);

    const result = await findAutoApplicable('s1', 100_000, 'POS');

    expect(result).not.toBeNull();
    expect(result!.ok).toBe(true);
    if (result && result.ok) {
      expect(result.refId).toBe('p2');
      expect(result.discount).toBe(20_000);
    }
  });
});
