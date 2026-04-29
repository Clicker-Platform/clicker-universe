// lib/modules/promo/__tests__/claim.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getFirestore, collection, doc, setDoc, Timestamp } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  runTransaction: vi.fn(),
  increment: vi.fn((n: number) => ({ increment: n })),
  Timestamp: {
    now: vi.fn(),
    fromDate: vi.fn(),
  },
}));

vi.mock('@/lib/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
}));

vi.mock('../api/promos');
vi.mock('../api/settings');
vi.mock('../code-generator');

import { claimVoucher, grantVoucher } from '../api/claim';
import { getPromo } from '../api/promos';
import { getPromoSettings } from '../api/settings';
import { generateVoucherCode } from '../code-generator';
import type { Promo, PromoSettings } from '../types';

const mockSetDoc = vi.fn();
const mockDoc = vi.fn(() => ({ id: 'generated-voucher-id' }));
const mockCollection = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(setDoc).mockImplementation(mockSetDoc);
  vi.mocked(doc).mockImplementation(mockDoc);
  vi.mocked(collection).mockImplementation(mockCollection);
  vi.mocked(getFirestore).mockReturnValue({} as any);
  vi.mocked(Timestamp.now).mockReturnValue({ seconds: 1000, nanoseconds: 0, toDate: () => new Date(1000000) } as any);
  vi.mocked(Timestamp.fromDate).mockImplementation((d: Date) => ({ seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 } as any));

  vi.mocked(generateVoucherCode).mockReturnValue('VCH-ABCD-EFGH');

  vi.mocked(getPromoSettings).mockResolvedValue({
    voucherCodePrefix: 'VCH',
    defaultVoucherExpiryDays: 30,
    allowGuestCodes: true,
  } as PromoSettings);
});

const basePromo: Promo = {
  id: 'promo-1',
  siteId: 'site-1',
  name: '10% Off',
  kind: 'percent',
  value: 10,
  maxDiscount: 50000,
  conditions: {
    eligibleSources: [],
    audience: 'public',
  },
  usageCount: 0,
  trigger: 'claim',
  costInPoints: 100,
  voucherExpiryDays: 14,
  status: 'active',
  createdAt: { seconds: 900, nanoseconds: 0 } as any,
  updatedAt: { seconds: 900, nanoseconds: 0 } as any,
};

describe('claimVoucher', () => {
  // Test 1: points redemption — creates voucher with correct fields
  it('1. points redemption: creates voucher with correct snapshot fields, issuedVia, and expiresAt', async () => {
    vi.mocked(getPromo).mockResolvedValue(basePromo);

    const result = await claimVoucher({
      siteId: 'site-1',
      promoId: 'promo-1',
      memberId: 'member-A',
      memberName: 'Alice',
      issuedVia: 'points_redemption',
    });

    expect(getPromo).toHaveBeenCalledWith('site-1', 'promo-1');
    expect(generateVoucherCode).toHaveBeenCalledWith('VCH');
    expect(mockSetDoc).toHaveBeenCalledOnce();

    expect(result.id).toBe('generated-voucher-id');
    expect(result.siteId).toBe('site-1');
    expect(result.promoId).toBe('promo-1');
    expect(result.code).toBe('VCH-ABCD-EFGH');
    expect(result.ownerMemberId).toBe('member-A');
    expect(result.ownerName).toBe('Alice');
    expect(result.status).toBe('active');
    expect(result.issuedVia).toBe('points_redemption');
    expect(result.snapshotKind).toBe('percent');
    expect(result.snapshotValue).toBe(10);
    expect(result.snapshotMaxDiscount).toBe(50000);
    expect(result.expiresAt).toBeDefined();
  });

  // Test 2: admin grant bypasses trigger check
  it('2. admin grant: succeeds even when promo trigger is "code"', async () => {
    vi.mocked(getPromo).mockResolvedValue({ ...basePromo, trigger: 'code' });

    await expect(
      claimVoucher({
        siteId: 'site-1',
        promoId: 'promo-1',
        memberId: 'member-B',
        issuedVia: 'admin_grant',
      })
    ).resolves.not.toThrow();

    expect(mockSetDoc).toHaveBeenCalledOnce();
  });

  // Test 3: throws for non-claimable promo via points_redemption
  it('3. throws Error("Promo is not claimable") when trigger="code" and issuedVia="points_redemption"', async () => {
    vi.mocked(getPromo).mockResolvedValue({ ...basePromo, trigger: 'code' });

    await expect(
      claimVoucher({
        siteId: 'site-1',
        promoId: 'promo-1',
        memberId: 'member-C',
        issuedVia: 'points_redemption',
      })
    ).rejects.toThrow('Promo is not claimable');

    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  // Test 4: expiresAt uses promo.voucherExpiryDays
  it('4. expiresAt is computed from promo.voucherExpiryDays (7 days)', async () => {
    vi.mocked(getPromo).mockResolvedValue({ ...basePromo, voucherExpiryDays: 7 });
    // Timestamp.now returns { toDate: () => new Date(1000000) } — 1000000ms epoch
    // 7 days later = new Date(1000000 + 7 * 24 * 3600 * 1000)
    const expectedSeconds = Math.floor((1000000 + 7 * 24 * 3600 * 1000) / 1000);

    const result = await claimVoucher({
      siteId: 'site-1',
      promoId: 'promo-1',
      memberId: 'member-D',
      issuedVia: 'points_redemption',
    });

    expect(result.expiresAt).toEqual({ seconds: expectedSeconds, nanoseconds: 0 });
  });

  // Test 5: grantVoucher is a convenience wrapper for admin_grant
  it('5. grantVoucher calls claimVoucher with issuedVia="admin_grant"', async () => {
    vi.mocked(getPromo).mockResolvedValue({ ...basePromo, trigger: 'code' });

    const result = await grantVoucher({
      siteId: 'site-1',
      promoId: 'promo-1',
      memberId: 'member-E',
    });

    expect(result.issuedVia).toBe('admin_grant');
    expect(mockSetDoc).toHaveBeenCalledOnce();
  });
});
