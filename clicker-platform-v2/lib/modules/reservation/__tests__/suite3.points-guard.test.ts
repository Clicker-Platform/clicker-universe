import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { updateBookingStatus } from '@/lib/modules/reservation/api';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { isModuleEnabled } from '@/lib/modules/registry';
import { findMemberByPhone, awardPointsWithSpend, getMembershipSettings } from '@/lib/modules/membership/api';

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as any,
    doc: vi.fn(),
    getDoc: vi.fn(),
    updateDoc: vi.fn(),
  };
});

vi.mock('@/lib/modules/registry', () => ({
  isModuleEnabled: vi.fn(),
}));

vi.mock('@/lib/modules/membership/api', () => ({
  findMemberByPhone: vi.fn(),
  awardPointsWithSpend: vi.fn(),
  getMembershipSettings: vi.fn(),
}));

describe('Suite 3 — Reservation: Double Points Guard', () => {
  const siteId = 'site_123';
  const bookingId = 'bk_001';

  let mockBooking: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockBooking = {
      id: bookingId,
      status: 'pending',
      customerPhone: '08123456789',
      totalPrice: 100000,
      serviceName: 'Car Wash',
    };

    (doc as Mock).mockReturnValue({}); // dummy doc ref
    (getDoc as Mock).mockImplementation(() =>
      Promise.resolve({
        exists: () => true,
        data: () => mockBooking,
      })
    );
    (updateDoc as Mock).mockResolvedValue(undefined);

    (isModuleEnabled as Mock).mockImplementation((mod) => Promise.resolve(true)); // both enabled by default

    (getMembershipSettings as Mock).mockResolvedValue({
      enableLoyalty: true,
      earningRatio: 0.1,
    });

    (findMemberByPhone as Mock).mockResolvedValue({
      id: 'member_001',
      phone: '08123456789',
    });
  });

  it('Scenario 3.1 — Complete booking WITH service record: guard prevents double points', async () => {
    mockBooking.serviceRecordId = 'sr_001';

    await updateBookingStatus(siteId, bookingId, 'completed');

    expect(updateDoc).toHaveBeenCalled();
    expect(findMemberByPhone).not.toHaveBeenCalled();
    expect(awardPointsWithSpend).not.toHaveBeenCalled();
  });

  it('Scenario 3.2 — Complete booking WITHOUT service record: points act normally', async () => {
    mockBooking.serviceRecordId = undefined; // No SR

    await updateBookingStatus(siteId, bookingId, 'completed');

    expect(updateDoc).toHaveBeenCalled();
    expect(findMemberByPhone).toHaveBeenCalledWith(siteId, '08123456789');
    expect(awardPointsWithSpend).toHaveBeenCalledWith(
      siteId,
      'member_001',
      10000, // 100000 * 0.1
      100000,
      'RESERVATION',
      bookingId,
      'Car Wash'
    );
  });

  it('Scenario 3.3 — Complete booking: service_records disabled, membership enabled', async () => {
    mockBooking.serviceRecordId = 'sr_001'; // Should ignore this because SR is disabled
    (isModuleEnabled as Mock).mockImplementation((mod) => Promise.resolve(mod === 'membership'));

    await updateBookingStatus(siteId, bookingId, 'completed');

    expect(awardPointsWithSpend).toHaveBeenCalled();
  });

  it('Scenario 3.4 — Complete booking: both modules disabled', async () => {
    (isModuleEnabled as Mock).mockResolvedValue(false);

    await updateBookingStatus(siteId, bookingId, 'completed');

    expect(updateDoc).toHaveBeenCalled(); // booking status updates
    expect(findMemberByPhone).not.toHaveBeenCalled();
    expect(awardPointsWithSpend).not.toHaveBeenCalled();
  });

  it('Scenario 3.5 — Complete booking: customer has no matching member record', async () => {
    (findMemberByPhone as Mock).mockResolvedValue(null);

    await updateBookingStatus(siteId, bookingId, 'completed');

    expect(updateDoc).toHaveBeenCalled();
    expect(awardPointsWithSpend).not.toHaveBeenCalled();
  });

  it('Scenario 3.6 — Re-completing an already-completed booking (idempotency)', async () => {
    mockBooking.status = 'completed'; // Already complete

    await updateBookingStatus(siteId, bookingId, 'completed');

    expect(updateDoc).toHaveBeenCalled(); // updateDoc is called anyway for status sync logic
    // but points logic shouldn't run again!
    expect(findMemberByPhone).not.toHaveBeenCalled();
    expect(awardPointsWithSpend).not.toHaveBeenCalled();
  });
});
