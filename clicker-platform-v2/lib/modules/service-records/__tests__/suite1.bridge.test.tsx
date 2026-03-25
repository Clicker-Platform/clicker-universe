import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { BookingDetailPanel } from '@/lib/modules/reservation/admin/components/BookingDetailPanel';

// Mock dependencies
vi.mock('@/lib/site-context', () => ({
  useSite: () => ({ siteId: 'site_123' })
}));

// We'll mock the dynamically imported modules by mocking them at the top level,
// and since Vite supports this, we can intercept them.
vi.mock('@/lib/modules/registry', () => ({
  isModuleEnabled: vi.fn()
}));

vi.mock('@/lib/modules/membership/api', () => ({
  findMemberByPhone: vi.fn()
}));

vi.mock('@/lib/modules/service-records/api', () => ({
  createServiceRecord: vi.fn()
}));

vi.mock('@/lib/modules/reservation/api', () => ({
  updateBookingDetails: vi.fn()
}));

// Import the mocked modules to assert on them later
import { isModuleEnabled } from '@/lib/modules/registry';
import { createServiceRecord } from '@/lib/modules/service-records/api';
import { updateBookingDetails } from '@/lib/modules/reservation/api';

const mockBooking = {
  id: 'bk_001',
  serviceId: 'svc_001',
  serviceName: 'Nano Coating',
  customerName: 'Budi Santoso',
  customerEmail: 'budi@test.com',
  customerPhone: '+628123456789',
  status: 'confirmed' as const,
  totalPrice: 500000,
  startAt: { toDate: () => new Date() } as any,
  endAt: { toDate: () => new Date() } as any,
  staffName: 'John',
  notes: ''
};

describe('Suite 1 — Reservation Booking → Service Record Bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: both modules enabled
    (isModuleEnabled as Mock).mockImplementation((mod: string) => Promise.resolve(['service_records', 'membership'].includes(mod)));
    (createServiceRecord as Mock).mockResolvedValue('sr_new_123');
    
    // Mock window.location
    delete (window as any).location;
    window.location = { href: '' } as any;
    
    // Mock alert
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  const setup = (bookingOverrides = {}) => {
    const booking = { ...mockBooking, ...bookingOverrides };
    const onStatusUpdate = vi.fn();
    const onUpdateDetails = vi.fn();
    const onClose = vi.fn();
    
    render(
      <BookingDetailPanel 
        booking={booking} 
        onClose={onClose} 
        onStatusUpdate={onStatusUpdate} 
        onUpdateDetails={onUpdateDetails} 
      />
    );
    return { onStatusUpdate, onUpdateDetails, onClose };
  };

  it('Scenario 1.1 — Happy path: start service record from confirmed booking', async () => {
    setup();
    
    // Wait for the membership check to complete to show the buttons
    const startObjButton = await screen.findByText('Start Service Record');
    expect(startObjButton).toBeInTheDocument();
    
    // Click Start Service Record to open modal
    fireEvent.click(startObjButton);
    expect(screen.getByText('Enter the vehicle plate number to create a new service record pre-filled with booking data.')).toBeInTheDocument();
    
    // Enter plate B1234XYZ
    const plateInput = screen.getByPlaceholderText('e.g. B 1234 XYZ');
    await userEvent.type(plateInput, 'B1234XYZ');
    
    // Click Create Record
    const createButton = screen.getByRole('button', { name: /Create Record/i });
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(createServiceRecord).toHaveBeenCalledWith('site_123', expect.objectContaining({
        vehicleId: 'B1234XYZ',
        vehiclePlate: 'B1234XYZ',
        memberName: 'Budi Santoso',
        memberPhone: '+628123456789',
        serviceTypeId: 'svc_001',
        serviceTypeName: 'Nano Coating',
        totalAmount: 500000,
        bookingId: 'bk_001',
        bookingSource: 'reservation'
      }));
    });
    
    expect(updateBookingDetails).toHaveBeenCalledWith('site_123', 'bk_001', { serviceRecordId: 'sr_new_123' });
    expect(window.location.href).toBe('/admin/service-records/sr_new_123');
  });

  it('Scenario 1.2 — service_records module disabled', async () => {
    (isModuleEnabled as Mock).mockResolvedValue(false);
    setup();
    
    // Check missing button
    await waitFor(() => {
      expect(screen.queryByText('Start Service Record')).not.toBeInTheDocument();
    });
    // Mark Completed button is rendered
    expect(screen.getByText('Mark Completed')).toBeInTheDocument();
  });

  it('Scenario 1.3 — booking already has a linked service record', async () => {
    setup({ serviceRecordId: 'sr_abc123' });
    
    await waitFor(() => {
      expect(screen.queryByText('Start Service Record')).not.toBeInTheDocument();
      expect(screen.queryByText('Mark Completed')).not.toBeInTheDocument();
      expect(screen.getByText('Service in Progress')).toBeInTheDocument();
      
      const viewLink = screen.getByText('View Record');
      expect(viewLink.closest('a')).toHaveAttribute('href', '/admin/service-records/sr_abc123');
    });
  });

  it('Scenario 1.4 — plate input normalization', async () => {
    setup();
    
    const startObjButton = await screen.findByText('Start Service Record');
    fireEvent.click(startObjButton);
    
    const plateInput = screen.getByPlaceholderText('e.g. B 1234 XYZ');
    await userEvent.type(plateInput, 'b 1234 xyz');
    
    const createButton = screen.getByRole('button', { name: /Create Record/i });
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(createServiceRecord).toHaveBeenCalledWith('site_123', expect.objectContaining({
        vehiclePlate: 'B1234XYZ' // Normalized
      }));
    });
  });

  it('Scenario 1.5 — plate field is empty, Enter pressed', async () => {
    setup();
    
    const startObjButton = await screen.findByText('Start Service Record');
    fireEvent.click(startObjButton);
    
    const plateInput = screen.getByPlaceholderText('e.g. B 1234 XYZ');
    // Initially empty
    fireEvent.keyDown(plateInput, { key: 'Enter', code: 'Enter', charCode: 13 });
    
    // ensure createServiceRecord not called
    expect(createServiceRecord).not.toHaveBeenCalled();
    const createButton = screen.getByRole('button', { name: /Create Record/i });
    expect(createButton).toBeDisabled();
  });

  it('Scenario 1.6 — createServiceRecord fails (network error)', async () => {
    const error = new Error('Network error');
    (createServiceRecord as Mock).mockRejectedValueOnce(error);
    setup();
    
    const startObjButton = await screen.findByText('Start Service Record');
    fireEvent.click(startObjButton);
    
    const plateInput = screen.getByPlaceholderText('e.g. B 1234 XYZ');
    await userEvent.type(plateInput, 'B1234XYZ');
    
    const createButton = screen.getByRole('button', { name: /Create Record/i });
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Failed to create service record. Please try again.');
    });
    
    // modal stays open
    expect(screen.getByText('Enter the vehicle plate number to create a new service record pre-filled with booking data.')).toBeInTheDocument();
    
    // booking not updated
    expect(updateBookingDetails).not.toHaveBeenCalled();
  });
});
