import React from 'react';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import RecordDetailPage from '../admin/RecordDetailPage';
import { useSite } from '@/lib/site-context';
import { useUser } from '@/lib/user-context';
import { subscribeToServiceRecord } from '../api';

// Mock contexts
vi.mock('@/lib/site-context', () => ({
  useSite: vi.fn(),
}));

vi.mock('@/lib/user-context', () => ({
  useUser: vi.fn(),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({
    get: () => 'rec_001'
  }),
}));

// Mock API
vi.mock('../api', () => ({
  subscribeToServiceRecord: vi.fn(),
  getWarrantyCard: vi.fn(),
}));

describe('Suite 8 — RecordDetailPage: Booking Source Card (B5)', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    (useSite as Mock).mockReturnValue({ siteId: 'site_1' });
    (useUser as Mock).mockReturnValue({ user: { email: 'admin@test.com' }, isOwner: true });
  });

  const baseRecord = {
    id: 'rec_001',
    vehiclePlate: 'B1234XYZ',
    status: 'IN_PROGRESS',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('Scenario 8.1 — SR from booking: shows source card', () => {
    it('renders the blue info card with view booking link', async () => {
      (subscribeToServiceRecord as Mock).mockImplementation((siteId, recordId, cb) => {
        cb({
          ...baseRecord,
          bookingId: 'bk_001',
          bookingSource: 'reservation',
        });
        return vi.fn(); // unsubscribe fn
      });

      render(<RecordDetailPage />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });

      expect(screen.getByText('Created from Reservation Booking')).toBeInTheDocument();
      
      const link = screen.getByRole('link', { name: /View Booking/i });
      expect(link).toHaveAttribute('href', '/admin/reservation/bookings?id=bk_001');
    });
  });

  describe('Scenario 8.2 — SR created manually (no bookingId): source card not shown', () => {
    it('does not render the blue source card', async () => {
      (subscribeToServiceRecord as Mock).mockImplementation((siteId, recordId, cb) => {
        cb(baseRecord); // no bookingId or bookingSource
        return vi.fn();
      });

      render(<RecordDetailPage />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });

      expect(screen.queryByText('Created from Reservation Booking')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /View Booking/i })).not.toBeInTheDocument();
    });
  });

  describe('Scenario 8.3 — SR has bookingId but bookingSource is not "reservation"', () => {
    it('does not render the blue source card (both conditions must be true)', async () => {
      (subscribeToServiceRecord as Mock).mockImplementation((siteId, recordId, cb) => {
        cb({
          ...baseRecord,
          bookingId: 'bk_001',
          bookingSource: undefined, // missing source
        });
        return vi.fn();
      });

      render(<RecordDetailPage />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });

      expect(screen.queryByText('Created from Reservation Booking')).not.toBeInTheDocument();
    });
  });

});
