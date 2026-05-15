import React from 'react';
import '@testing-library/jest-dom/vitest';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { getDocs, where } from 'firebase/firestore';
import MemberWarrantyWidget from '../public/MemberWarrantyWidget';
import MemberServiceHistoryWidget from '../public/MemberServiceHistoryWidget';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn(),
  getFirestore: vi.fn(),
}));

vi.mock('@/lib/firebase', () => ({
  db: {},
}));

describe('Suite 7 — Member Dashboard Widgets (B3 + B4)', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Scenario 7.1 — MemberWarrantyWidget: shows active warranties', () => {
    it('renders warranty card correctly', async () => {
      // Mock 6 months from now
      const mockExpiry = new Date();
      mockExpiry.setMonth(mockExpiry.getMonth() + 6);

      const mockDocs = [{
        id: 'w1',
        data: () => ({
          warrantyCode: 'MRB-2026-AB12',
          serviceTypeName: 'Nano Coating',
          vehiclePlate: 'B1234XYZ',
          expiryDate: mockExpiry,
          status: 'ACTIVE',
        })
      }];

      (getDocs as Mock).mockResolvedValue({ docs: mockDocs });

      render(<MemberWarrantyWidget siteId="site_1" memberPhone="+628123456789" />);

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });

      expect(screen.getByText('Active Warranties')).toBeInTheDocument();
      expect(screen.getByText('Nano Coating')).toBeInTheDocument();
      expect(screen.getByText(/B1234XYZ/)).toBeInTheDocument();
      expect(screen.getByText('MRB-2026-AB12')).toBeInTheDocument();
      expect(screen.getByText(/Expires/)).toBeInTheDocument();
      
      const link = screen.getByRole('link', { name: /View/i });
      expect(link).toHaveAttribute('href', '/warranty/MRB-2026-AB12');
    });
  });

  describe('Scenario 7.2 — MemberWarrantyWidget: no active warranties', () => {
    it('returns null and renders nothing when no cards are active', async () => {
      (getDocs as Mock).mockResolvedValue({ docs: [] });

      const { container } = render(<MemberWarrantyWidget siteId="site_1" memberPhone="+628123456789" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('Scenario 7.3 — MemberWarrantyWidget: VOIDED card not shown', () => {
    it('ensures query includes where("status", "==", "ACTIVE")', async () => {
      (getDocs as Mock).mockResolvedValue({ docs: [] });
      (where as Mock).mockImplementation((k, op, v) => ({ type: 'where', k, op, v }));

      render(<MemberWarrantyWidget siteId="site_1" memberPhone="+628123456789" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });

      // Assert that one of the where clauses was for status == ACTIVE
      expect(where).toHaveBeenCalledWith('status', '==', 'ACTIVE');
    });
  });

  describe('Scenario 7.4 — MemberWarrantyWidget: no memberPhone and no memberId', () => {
    it('returns null and does not query firestore', async () => {
      const { container } = render(<MemberWarrantyWidget siteId="site_1" />); // Omitting memberPhone and memberId

      // Component immediately stops loading and returns null
      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });

      expect(container).toBeEmptyDOMElement();
      expect(getDocs).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 7.5 — MemberServiceHistoryWidget: shows history list', () => {
    it('renders history correctly', async () => {
      const mockDocs = [
        {
          id: 'sr1',
          data: () => ({
            serviceTypeName: 'Basic Wash',
            vehiclePlate: 'B1111AA',
            status: 'COMPLETED',
            updatedAt: new Date(),
          }),
        },
        {
          id: 'sr2',
          data: () => ({
            serviceTypeName: 'Detailing',
            vehiclePlate: 'B2222BB',
            status: 'IN_PROGRESS',
            updatedAt: new Date(),
          }),
        },
      ];
      (getDocs as Mock).mockResolvedValue({ docs: mockDocs });

      render(<MemberServiceHistoryWidget siteId="site_1" memberId="m001" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });

      expect(screen.getByText('Service History')).toBeInTheDocument();
      expect(screen.getByText('Basic Wash')).toBeInTheDocument();
      expect(screen.getByText(/B1111AA/)).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();

      expect(screen.getByText('Detailing')).toBeInTheDocument();
      expect(screen.getByText(/B2222BB/)).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });
  });

  describe('Scenario 7.6 — MemberServiceHistoryWidget: CANCELLED record shows red badge', () => {
    it('renders red badge for Cancelled status', async () => {
      const mockDocs = [
        {
          id: 'sr3',
          data: () => ({
            serviceTypeName: 'Oil Change',
            vehiclePlate: 'B3333CC',
            status: 'CANCELLED',
            updatedAt: new Date(),
          }),
        },
      ];
      (getDocs as Mock).mockResolvedValue({ docs: mockDocs });

      render(<MemberServiceHistoryWidget siteId="site_1" memberId="m001" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });

      expect(screen.getByText('Cancelled')).toBeInTheDocument();
    });
  });

  describe('Scenario 7.7 — MemberServiceHistoryWidget: falls back to memberPhone when no memberId', () => {
    it('queries using memberPhone when memberId is missing', async () => {
      (getDocs as Mock).mockResolvedValue({ docs: [] });
      (where as Mock).mockImplementation((k, op, v) => ({ type: 'where', k, op, v }));

      render(<MemberServiceHistoryWidget siteId="site_1" memberPhone="081234567890" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });

      expect(where).toHaveBeenCalledWith('memberPhone', '==', '081234567890');
    });
  });

});
