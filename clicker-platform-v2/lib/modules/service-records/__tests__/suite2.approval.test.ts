import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { approveRecord } from '@/lib/modules/service-records/api';
import { getDoc, getDocs, writeBatch, doc, collection } from 'firebase/firestore';
import { isModuleEnabled } from '@/lib/modules/registry';
import { getMembershipSettings, awardPointsWithSpend } from '@/lib/modules/membership/api';
import { updateStock } from '@/lib/modules/inventory/api';
import { updateBookingStatus, updateBookingDetails } from '@/lib/modules/reservation/api';

vi.mock('@/lib/modules/registry', () => ({
  isModuleEnabled: vi.fn(),
}));

vi.mock('@/lib/modules/membership/api', () => ({
  getMembershipSettings: vi.fn(),
  awardPointsWithSpend: vi.fn(),
}));

vi.mock('@/lib/modules/inventory/api', () => ({
  updateStock: vi.fn(),
}));

vi.mock('@/lib/modules/reservation/api', () => ({
  updateBookingStatus: vi.fn(),
  updateBookingDetails: vi.fn(),
}));

describe('Suite 2 — Service Record Approval → Downstream integrations', () => {
  const mockSiteId = 'site_123';
  const mockRecordId = 'sr_001';
  let mockRecord: any;
  let mockConfig: any;
  let mockBatch: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockBatch = {
      set: vi.fn(),
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined)
    };
    (writeBatch as Mock).mockReturnValue(mockBatch);

    mockRecord = {
      id: mockRecordId,
      status: 'PENDING_APPROVAL',
      paymentStatus: 'PAID',
      hasWarranty: false,
      totalAmount: 500000,
      serviceTypeName: 'Nano Coating',
      vehiclePlate: 'B1234XYZ',
      memberName: 'Budi'
    };

    mockConfig = {
      warrantyPrefix: 'SVC',
      featuresEnabled: {
        warrantyCards: true,
        reminderEngine: false
      },
      reminders: {}
    };

    (getDoc as Mock).mockImplementation((ref: any) => {
      // Mock getServiceRecord vs getServiceConfig
      if (ref._path?.includes('serviceConfig')) {
        return Promise.resolve({
          exists: () => true,
          data: () => mockConfig
        });
      }
      return Promise.resolve({
        exists: () => true,
        id: mockRecord.id,
        data: () => mockRecord
      });
    });

    (doc as Mock).mockImplementation((...args) => {
      // If first arg is a collection ref, use it and add random id if none provided
      if (args[0]?._path) {
        return { _path: `${args[0]._path}/${args[1] || 'mock_auto_id'}` };
      }
      return { _path: args.slice(1).join('/') };
    });
    (collection as Mock).mockImplementation((...args) => ({ _path: args.slice(1).join('/') }));
    
    // Default mock returns
    (isModuleEnabled as Mock).mockResolvedValue(false);
    (getDocs as Mock).mockResolvedValue({ empty: true, docs: [] });
  });

  it('Scenario 2.1 — Approve without warranty, no optional modules', async () => {
    await approveRecord(mockSiteId, mockRecordId, 'admin@test.com');
    expect(mockBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({ _path: `sites/site_123/modules/service_records/serviceRecords/${mockRecordId}` }),
      expect.objectContaining({ status: 'COMPLETED' })
    );
    expect(mockBatch.commit).toHaveBeenCalled();
    // No downstream called
    expect(isModuleEnabled).toHaveBeenCalled();
  });

  it('Scenario 2.2 — Approve WITH warranty card', async () => {
    mockRecord.hasWarranty = true;
    mockRecord.warrantyMonths = 12;

    await approveRecord(mockSiteId, mockRecordId, 'admin@test.com');

    // Warranty card created (batch.set)
    expect(mockBatch.set).toHaveBeenCalledWith(
      expect.objectContaining({ _path: expect.stringContaining('sites/site_123/modules/service_records/warrantyCards') }),
      expect.objectContaining({
        warrantyCode: expect.stringMatching(/^SVC-\d{4}-.{4}$/),
        warrantyMonths: 12,
        status: 'ACTIVE'
      })
    );
  });

  it('Scenario 2.3 — Approve with warranty, warranty code collision on first attempt', async () => {
    mockRecord.hasWarranty = true;
    mockRecord.warrantyMonths = 12;

    // Simulate first getDocs returns empty: false (collision), second returns true
    (getDocs as Mock)
      .mockResolvedValueOnce({ empty: false })
      .mockResolvedValueOnce({ empty: true });

    await approveRecord(mockSiteId, mockRecordId, 'admin@test.com');
    expect(getDocs).toHaveBeenCalledTimes(2);
    expect(mockBatch.commit).toHaveBeenCalled();
  });

  it('Scenario 2.4 — Approve: all 3 retry attempts produce duplicate codes', async () => {
    mockRecord.hasWarranty = true;
    (getDocs as Mock).mockResolvedValue({ empty: false }); // Always collision

    await expect(approveRecord(mockSiteId, mockRecordId, 'admin@test.com'))
      .rejects.toThrow('Could not generate unique warranty code after retries');
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it('Scenario 2.5 — Approve with linked booking → auto-complete', async () => {
    mockRecord.bookingId = 'bk_001';
    mockRecord.bookingSource = 'reservation';

    await approveRecord(mockSiteId, mockRecordId, 'admin@test.com');
    
    // Auto-complete (not blocking, happens after commit)
    expect(updateBookingDetails).toHaveBeenCalledWith(mockSiteId, 'bk_001', { serviceRecordId: mockRecordId });
    expect(updateBookingStatus).toHaveBeenCalledWith(mockSiteId, 'bk_001', 'completed');
  });

  it('Scenario 2.6 — Approve with linked booking → booking auto-complete fails silently', async () => {
    mockRecord.bookingId = 'bk_001';
    mockRecord.bookingSource = 'reservation';
    (updateBookingStatus as Mock).mockRejectedValue(new Error('Network error'));

    // Should not throw
    await approveRecord(mockSiteId, mockRecordId, 'admin@test.com');
    expect(mockBatch.commit).toHaveBeenCalled(); // It still commits
  });

  it('Scenario 2.7 — Approve with inventoryItemId → stock deduction', async () => {
    mockRecord.inventoryItemId = 'inv_abc';
    mockRecord.inventoryDeducted = false;
    (isModuleEnabled as Mock).mockImplementation((mod) => Promise.resolve(mod === 'inventory'));

    await approveRecord(mockSiteId, mockRecordId, 'admin@test.com');
    
    expect(updateStock).toHaveBeenCalledWith(
      mockSiteId, 'inv_abc', -1, 'sale', mockRecordId, 'Nano Coating'
    );
  });

  it('Scenario 2.8 — Approve with inventoryItemId already deducted (idempotency)', async () => {
    mockRecord.inventoryItemId = 'inv_abc';
    mockRecord.inventoryDeducted = true; // Already deducted
    (isModuleEnabled as Mock).mockImplementation((mod) => Promise.resolve(mod === 'inventory'));

    await approveRecord(mockSiteId, mockRecordId, 'admin@test.com');
    expect(updateStock).not.toHaveBeenCalled();
  });

  it('Scenario 2.9 — Approve: inventory deduction fails silently', async () => {
    mockRecord.inventoryItemId = 'inv_abc';
    (isModuleEnabled as Mock).mockImplementation((mod) => Promise.resolve(mod === 'inventory'));
    (updateStock as Mock).mockRejectedValue(new Error('Network error'));

    await approveRecord(mockSiteId, mockRecordId, 'admin@test.com');
    expect(mockBatch.commit).toHaveBeenCalled(); // Still committed
  });

  it('Scenario 2.10 — Approve with membership points: member exists', async () => {
    mockRecord.memberId = 'member_001';
    mockRecord.totalAmount = 500000;
    
    (isModuleEnabled as Mock).mockImplementation((mod) => Promise.resolve(mod === 'membership'));
    (getMembershipSettings as Mock).mockResolvedValue({ enableLoyalty: true, earningRatio: 0.01 });

    await approveRecord(mockSiteId, mockRecordId, 'admin@test.com');
    
    expect(awardPointsWithSpend).toHaveBeenCalledWith(
      mockSiteId, 'member_001', 5000, 500000, 'SERVICE_RECORDS', mockRecordId, 'Nano Coating'
    );
  });

  it('Scenario 2.11 — Approve with membership points: loyalty disabled', async () => {
    mockRecord.memberId = 'member_001';
    (isModuleEnabled as Mock).mockImplementation((mod) => Promise.resolve(mod === 'membership'));
    (getMembershipSettings as Mock).mockResolvedValue({ enableLoyalty: false });

    await approveRecord(mockSiteId, mockRecordId, 'admin@test.com');
    expect(awardPointsWithSpend).not.toHaveBeenCalled();
  });

  it('Scenario 2.12 — Approve with membership points: points calc rounds down', async () => {
    mockRecord.memberId = 'member_001';
    mockRecord.totalAmount = 99; // 99 * 0.1 = 9.9 => 9
    
    (isModuleEnabled as Mock).mockImplementation((mod) => Promise.resolve(mod === 'membership'));
    (getMembershipSettings as Mock).mockResolvedValue({ enableLoyalty: true, earningRatio: 0.1 });

    await approveRecord(mockSiteId, mockRecordId, 'admin@test.com');
    
    expect(awardPointsWithSpend).toHaveBeenCalledWith(
      mockSiteId, 'member_001', 9, 99, 'SERVICE_RECORDS', mockRecordId, 'Nano Coating'
    );
  });

  it('Scenario 2.13 — Approve record that is NOT in PENDING_APPROVAL state', async () => {
    mockRecord.status = 'IN_PROGRESS';
    await expect(approveRecord(mockSiteId, mockRecordId, 'admin@test.com'))
      .rejects.toThrow('Only PENDING_APPROVAL records can be approved');
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it('Scenario 2.14 — Approve record with paymentStatus NOT PAID', async () => {
    mockRecord.paymentStatus = 'PARTIAL';
    await expect(approveRecord(mockSiteId, mockRecordId, 'admin@test.com'))
      .rejects.toThrow('Payment must be PAID before approval');
  });
});
