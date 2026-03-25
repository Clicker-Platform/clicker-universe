import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import {
  submitForApproval,
  cancelRecord,
  updateServiceRecord,
  moveToInProgress,
} from '@/lib/modules/service-records/api';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

// Mock getServiceRecord implementation using firebase mocks
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as any,
    doc: vi.fn(),
    getDoc: vi.fn(),
    updateDoc: vi.fn(),
    serverTimestamp: vi.fn(() => 'server_timestamp'),
  };
});

describe('Suite 4 — Service Record Status State Machine', () => {
  const mockSiteId = 'site_123';
  const mockRecordId = 'sr_001';
  let mockRecord: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRecord = {
      id: mockRecordId,
      status: 'DRAFT',
      paymentStatus: 'UNPAID',
    };

    (doc as Mock).mockReturnValue({}); // dummy ref
    (getDoc as Mock).mockImplementation(() =>
      Promise.resolve({
        exists: () => true,
        id: mockRecord.id,
        data: () => mockRecord,
      })
    );
    (updateDoc as Mock).mockResolvedValue(undefined);
  });

  describe('Scenario 4.1 — Valid transitions', () => {
    it('DRAFT → IN_PROGRESS', async () => {
      mockRecord.status = 'DRAFT';
      await moveToInProgress(mockSiteId, mockRecordId);
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'IN_PROGRESS' })
      );
    });

    it('DRAFT → CANCELLED', async () => {
      mockRecord.status = 'DRAFT';
      await cancelRecord(mockSiteId, mockRecordId, 'Customer cancelled');
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'CANCELLED', cancelReason: 'Customer cancelled' })
      );
    });

    it('IN_PROGRESS → PENDING_APPROVAL (when PAID)', async () => {
      mockRecord.status = 'IN_PROGRESS';
      mockRecord.paymentStatus = 'PAID';
      await submitForApproval(mockSiteId, mockRecordId);
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'PENDING_APPROVAL' })
      );
    });

    it('IN_PROGRESS → CANCELLED', async () => {
      mockRecord.status = 'IN_PROGRESS';
      await cancelRecord(mockSiteId, mockRecordId, 'Parts unavailable');
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'CANCELLED' })
      );
    });

    it('PENDING_APPROVAL → IN_PROGRESS', async () => {
      mockRecord.status = 'PENDING_APPROVAL';
      await moveToInProgress(mockSiteId, mockRecordId);
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'IN_PROGRESS' })
      );
    });

    it('PENDING_APPROVAL → CANCELLED', async () => {
      mockRecord.status = 'PENDING_APPROVAL';
      await cancelRecord(mockSiteId, mockRecordId, 'Manager rejected and cancelled');
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'CANCELLED' })
      );
    });
  });

  describe('Scenario 4.2 — submitForApproval: missing PAID payment', () => {
    it('throws when paymentStatus is PARTIAL', async () => {
      mockRecord.status = 'IN_PROGRESS';
      mockRecord.paymentStatus = 'PARTIAL';
      await expect(submitForApproval(mockSiteId, mockRecordId))
        .rejects.toThrow('Payment must be PAID before submitting for approval');
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('throws when paymentStatus is UNPAID', async () => {
      mockRecord.status = 'IN_PROGRESS';
      mockRecord.paymentStatus = 'UNPAID';
      await expect(submitForApproval(mockSiteId, mockRecordId))
        .rejects.toThrow('Payment must be PAID before submitting for approval');
      expect(updateDoc).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 4.3 & 4.4 — cancelRecord validation', () => {
    it('throws when cancel reason is empty string', async () => {
      mockRecord.status = 'IN_PROGRESS';
      await expect(cancelRecord(mockSiteId, mockRecordId, ''))
        .rejects.toThrow('Cancel reason is required');
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('throws when cancel reason is whitespace only', async () => {
      mockRecord.status = 'IN_PROGRESS';
      await expect(cancelRecord(mockSiteId, mockRecordId, '   '))
        .rejects.toThrow('Cancel reason is required');
      expect(updateDoc).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 4.5 — updateServiceRecord immutability', () => {
    it('throws when updating a COMPLETED record', async () => {
      mockRecord.status = 'COMPLETED';
      await expect(updateServiceRecord(mockSiteId, mockRecordId, { totalAmount: 500 }))
        .rejects.toThrow('COMPLETED records are immutable');
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('throws when cancelling a COMPLETED record', async () => {
      mockRecord.status = 'COMPLETED';
      await expect(cancelRecord(mockSiteId, mockRecordId, 'Try to cancel'))
        .rejects.toThrow('COMPLETED records cannot be cancelled');
      expect(updateDoc).not.toHaveBeenCalled();
    });
  });
});
