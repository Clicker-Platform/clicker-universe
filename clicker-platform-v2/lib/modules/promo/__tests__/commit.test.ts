// lib/modules/promo/__tests__/commit.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { runTransaction } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn((_db, ...path) => ({ path: path.join('/') })),
  runTransaction: vi.fn(),
  Timestamp: { now: vi.fn(() => ({ seconds: 1000, nanoseconds: 0 })) },
}));

import { commitPromoUsage, reversePromoUsage } from '../api/commit';
import type { CommitInput } from '../api/commit';

const mockGet = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(runTransaction).mockImplementation(async (_db, fn) => {
    await fn({ get: mockGet, update: mockUpdate, set: mockSet });
  });
});

const baseInput: CommitInput = {
  siteId: 'site-1',
  applied: { refId: 'promo-1', kind: 'promo', label: 'SUMMER20', discount: 40_000 },
  source: 'POS',
  refId: 'order-abc',
};

describe('commitPromoUsage', () => {
  // Test 1: promo kind — increments usageCount
  it('1. promo kind: calls runTransaction and increments usageCount', async () => {
    mockGet.mockResolvedValue({ data: () => ({ usageCount: 3 }) });

    await commitPromoUsage(baseInput);

    expect(runTransaction).toHaveBeenCalledOnce();
    expect(mockGet).toHaveBeenCalledOnce();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('promo-1') }),
      { usageCount: 4 }
    );
  });

  // Test 2: voucher kind — sets status='used' and usage metadata
  it('2. voucher kind: calls runTransaction and sets used status with metadata', async () => {
    const input: CommitInput = {
      siteId: 'site-1',
      applied: { refId: 'voucher-1', kind: 'voucher', label: 'VCH-ABCD', discount: 50_000 },
      source: 'RESERVATION',
      refId: 'booking-xyz',
      memberId: 'member-A',
    };

    // Voucher doc has no promoId — parent promo increment is skipped
    mockGet.mockResolvedValue({ data: () => ({}) });

    await commitPromoUsage(input);

    expect(runTransaction).toHaveBeenCalledOnce();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('voucher-1') }),
      expect.objectContaining({
        status: 'used',
        usedAt: { seconds: 1000, nanoseconds: 0 },
        usedSource: 'RESERVATION',
        usedRefId: 'booking-xyz',
        usedDiscount: 50_000,
      })
    );
  });

  // Test 2b: voucher kind with promoId — also increments parent promo usageCount
  it('2b. voucher kind with promoId: also increments parent promo usageCount atomically', async () => {
    const input: CommitInput = {
      siteId: 'site-1',
      applied: { refId: 'voucher-1', kind: 'voucher', label: 'VCH-ABCD', discount: 50_000 },
      source: 'RESERVATION',
      refId: 'booking-xyz',
      memberId: 'member-A',
    };

    // First get() = voucher doc (has promoId), second get() = promo doc (usageCount: 7)
    mockGet
      .mockResolvedValueOnce({ data: () => ({ promoId: 'promo-parent' }) })
      .mockResolvedValueOnce({ data: () => ({ usageCount: 7 }) });

    await commitPromoUsage(input);

    expect(runTransaction).toHaveBeenCalledOnce();
    // Voucher update
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('voucher-1') }),
      expect.objectContaining({ status: 'used', usedDiscount: 50_000 })
    );
    // Parent promo usageCount increment
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('promo-parent') }),
      { usageCount: 8 }
    );
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });
});

describe('reversePromoUsage', () => {
  // Test 3: promo kind — decrements usageCount (floored at 0)
  it('3. promo kind: decrements usageCount and floors at 0', async () => {
    mockGet.mockResolvedValue({ data: () => ({ usageCount: 5 }) });

    await reversePromoUsage(baseInput);

    expect(runTransaction).toHaveBeenCalledOnce();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('promo-1') }),
      { usageCount: 4 }
    );
  });

  it('3b. promo kind: floors usageCount at 0 if already 0', async () => {
    mockGet.mockResolvedValue({ data: () => ({ usageCount: 0 }) });

    await reversePromoUsage(baseInput);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.any(Object),
      { usageCount: 0 }
    );
  });

  // Test 4: voucher kind, matching refId — resets to active
  it('4. voucher kind, matching refId: resets voucher to active and clears used fields', async () => {
    const input: CommitInput = {
      siteId: 'site-1',
      applied: { refId: 'voucher-1', kind: 'voucher', label: 'VCH-ABCD', discount: 50_000 },
      source: 'POS',
      refId: 'order-abc',
    };

    mockGet.mockResolvedValue({
      data: () => ({ status: 'used', usedRefId: 'order-abc' }),
    });

    await reversePromoUsage(input);

    expect(runTransaction).toHaveBeenCalledOnce();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('voucher-1') }),
      {
        status: 'active',
        usedAt: null,
        usedSource: null,
        usedRefId: null,
        usedDiscount: null,
      }
    );
  });

  // Test 5: voucher kind, non-matching refId — does NOT update
  it('5. voucher kind, non-matching refId: does NOT reset voucher (already used by different order)', async () => {
    const input: CommitInput = {
      siteId: 'site-1',
      applied: { refId: 'voucher-1', kind: 'voucher', label: 'VCH-ABCD', discount: 50_000 },
      source: 'POS',
      refId: 'order-abc',
    };

    mockGet.mockResolvedValue({
      data: () => ({ status: 'used', usedRefId: 'order-different' }),
    });

    await reversePromoUsage(input);

    expect(runTransaction).toHaveBeenCalledOnce();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
