import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { createServiceRecord, approveRecord } from '../api';
import { getReservationSettings } from '@/lib/modules/reservation/api';
import { updateStock } from '@/lib/modules/inventory/api';
import { db } from '@/lib/firebase';
import { getDoc, getDocs, addDoc, writeBatch, doc } from 'firebase/firestore';

vi.mock('@/lib/modules/registry', () => ({
  isModuleEnabled: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/modules/inventory/api', () => ({
  updateStock: vi.fn(),
  checkStockAvailability: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/modules/membership/api', () => ({
  findMemberByPhone: vi.fn(),
  awardPointsWithSpend: vi.fn(),
  getMembershipSettings: vi.fn().mockResolvedValue({ earningRatio: 1 }),
}));

describe('Suite 9 — Edge Cases & Error Boundaries', () => {

  let mockBatch: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBatch = {
      set: vi.fn(),
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined)
    };
    (writeBatch as Mock).mockReturnValue(mockBatch);

    (doc as Mock).mockImplementation((_, ...args) => ({ path: args.join('/') }));
    (getDocs as Mock).mockResolvedValue({ empty: true });
  });

  describe('Scenario 9.2 — createServiceRecord with empty strings for phone', () => {
    it('creates record successfully even if memberPhone is empty', async () => {
      (addDoc as Mock).mockResolvedValueOnce({ id: 'mock-id' });
      const srId = await createServiceRecord('site_1', {
        vehicleId: 'V1',
        vehiclePlate: 'B1234',
        memberName: 'No Phone',
        memberPhone: '',
        serviceTypeId: 'svc_1',
        serviceTypeName: 'Wash',
        hasWarranty: false,
        warrantyMonths: 0,
        paymentStatus: 'UNPAID',
        totalAmount: 100000,
        amountPaid: 0,
        createdBy: 'admin',
      });
      expect(srId).toBe('mock-id');
    });
  });

  describe('Scenario 9.3 — createServiceRecord with totalPrice = 0', () => {
    it('creates record successfully with totalAmount=0', async () => {
      (addDoc as Mock).mockResolvedValueOnce({ id: 'mock-id' });
      const srId = await createServiceRecord('site_1', {
        vehicleId: 'V1',
        vehiclePlate: 'B1234',
        memberName: 'Free Wash',
        memberPhone: '081234',
        serviceTypeId: 'svc_1',
        serviceTypeName: 'Wash',
        hasWarranty: false,
        warrantyMonths: 0,
        paymentStatus: 'UNPAID',
        totalAmount: 0,
        amountPaid: 0,
        createdBy: 'admin',
      });
      expect(srId).toBe('mock-id');
    });
  });

  describe('Scenario 9.4 — approveRecord: memberId is null, award skipped', () => {
    it('does not call awardPointsWithSpend if memberId is missing', async () => {
      (getDoc as Mock).mockImplementation((ref: any) => {
        const path = ref.path || '';
        if (path.includes('serviceRecords')) {
          return Promise.resolve({
            exists: () => true,
            id: 'sr1',
            ref,
            data: () => ({
              status: 'PENDING_APPROVAL',
              paymentStatus: 'PAID',
              totalAmount: 100000,
              memberId: undefined, // Missing
            }),
          });
        }
        if (path.includes('config')) {
          return Promise.resolve({
            exists: () => true,
            data: () => ({
              featuresEnabled: { warrantyCards: true, reminderEngine: false },
              warrantyPrefix: 'SVC',
            })
          });
        }
        return Promise.resolve({ exists: () => false });
      });

      const { awardPointsWithSpend } = await import('@/lib/modules/membership/api');
      await approveRecord('site_1', 'sr1', 'admin@test.com');
      
      expect(awardPointsWithSpend).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 9.6 — updateStock: item does not exist', () => {
    it('catches error and still completes the record', async () => {
      (getDoc as Mock).mockImplementation((ref: any) => {
        const path = ref.path || '';
        if (path.includes('serviceRecords')) {
          return Promise.resolve({
            exists: () => true,
            id: 'sr2',
            ref,
            data: () => ({
              status: 'PENDING_APPROVAL',
              paymentStatus: 'PAID',
              inventoryItemId: 'missing_item',
              inventoryQuantity: 1,
              memberId: 'm1',
              totalAmount: 100000,
            }),
          });
        }
        if (path.includes('config')) {
          return Promise.resolve({
            exists: () => true,
            data: () => ({
              featuresEnabled: { warrantyCards: true, reminderEngine: false },
              warrantyPrefix: 'SVC',
            })
          });
        }
        return Promise.resolve({ exists: () => false });
      });

      (updateStock as Mock).mockRejectedValueOnce(new Error('Item does not exist!'));

      await approveRecord('site_1', 'sr2', 'admin@test.com');

      expect(mockBatch.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'COMPLETED' })
      );
    });
  });

  describe('Scenario 9.7 — Warranty card creation: warrantyMonths=0 fallback', () => {
    it('defaults to 12 months when warrantyMonths is 0', async () => {
      (getDoc as Mock).mockImplementation((ref: any) => {
        const path = ref.path || '';
        if (path.includes('serviceRecords')) {
          return Promise.resolve({
            exists: () => true,
            id: 'sr3',
            ref,
            data: () => ({
              status: 'PENDING_APPROVAL',
              paymentStatus: 'PAID',
              hasWarranty: true,
              warrantyMonths: 0, // Fallback trigger
            }),
          });
        }
        if (path.includes('config')) {
          return Promise.resolve({
            exists: () => true,
            data: () => ({
              featuresEnabled: { warrantyCards: true, reminderEngine: false },
              warrantyPrefix: 'SVC',
            })
          });
        }
        return Promise.resolve({ exists: () => false });
      });

      await approveRecord('site_1', 'sr3', 'admin@test.com');

      const setCall = mockBatch.set.mock.calls.find((call: any) => 
        call[1] && call[1].warrantyCode
      );
      
      expect(setCall).toBeDefined();
      if (!setCall) throw new Error('setCall is expected');

      const cardData = setCall[1];

      // api.ts uses exactly 30 days per month for its expiry calculation:
      // Math.floor(...) + warrantyMonths * 30 * 24 * 60 * 60
      const expectedExpiryMs = Date.now() + 12 * 30 * 24 * 60 * 60 * 1000;
      
      const expiryMs = cardData.expiryDate.toMillis ? cardData.expiryDate.toMillis() : cardData.expiryDate.getTime();
      const diff = Math.abs(expiryMs - expectedExpiryMs);
      expect(diff).toBeLessThan(10000); // Allow up to 10 seconds of diff for slow runs
    });
  });

  describe('Scenario 9.9 — getReservationSettings: missing staffLabel defaults to "Staff"', () => {
    it('returns Staff as default', async () => {
      (getDoc as Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({}), // Empty settings doc
      });

      const settings = await getReservationSettings('site_1');
      expect(settings.staffLabel).toBe('Staff');
    });
  });

});
