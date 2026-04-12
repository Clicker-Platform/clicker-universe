import React from 'react';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import RecordFormPage from '../admin/RecordFormPage';
import { getServiceTypes } from '../api';
import { isModuleEnabled } from '@/lib/modules/registry';
import { getInventory } from '@/lib/modules/inventory/api';

vi.mock('../api', () => ({
  getServiceTypes: vi.fn(),
  getServiceRecord: vi.fn(),
  createServiceRecord: vi.fn(),
  updateServiceRecord: vi.fn(),
  findVehicleByPlate: vi.fn(),
  createVehicle: vi.fn(),
  getCarCatalog: vi.fn().mockResolvedValue([]),
  addCarCatalogEntry: vi.fn(),
  ensureCarCatalogEntry: vi.fn(),
  getVehicles: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/site-context', () => ({
  useSite: () => ({ siteId: 'site_1' }),
}));

vi.mock('@/lib/user-context', () => ({
  useUser: () => ({ user: { uid: 'u1' } }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/modules/registry', () => ({
  isModuleEnabled: vi.fn(),
}));

vi.mock('@/lib/modules/inventory/api', () => ({
  getInventory: vi.fn(),
}));

vi.mock('@/lib/modules/membership/api', () => ({
  searchMembers: vi.fn(),
}));

describe('Suite 5 — RecordFormPage: Inventory Picker (B6)', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    (getServiceTypes as Mock).mockResolvedValue([{ id: 's1', name: 'Nano Ceramic', hasWarranty: true }]);
  });

  it('Scenario 5.1 — Inventory enabled: shows dropdown with item stock', async () => {
    (isModuleEnabled as Mock).mockImplementation(async (mod) => mod === 'inventory');
    (getInventory as Mock).mockResolvedValue([
      { id: 'i1', name: 'Nano Coat A', currentStock: 5, unit: 'bottle' }
    ]);

    render(<RecordFormPage />);

    // Wait for the dropdown option to appear
    const option = await screen.findByText('Nano Coat A (Stock: 5 bottle)');
    expect(option).toBeInTheDocument();

    // Free text input "Or type a free-text product name…" should be present initially because no item is selected
    expect(screen.getByPlaceholderText('Or type a free-text product name…')).toBeInTheDocument();
    
    // The placeholder "e.g. Ceramic Pro Gold 9H" should NOT be shown
    expect(screen.queryByPlaceholderText('e.g. Ceramic Pro Gold 9H')).not.toBeInTheDocument();
  });

  it('Scenario 5.2 — Select inventory item: sets implicit state & shows deduction text', async () => {
    (isModuleEnabled as Mock).mockImplementation(async (mod) => mod === 'inventory');
    (getInventory as Mock).mockResolvedValue([
      { id: 'i1', name: 'Nano Coat A', currentStock: 5, unit: 'bottle' }
    ]);

    render(<RecordFormPage />);

    // Find the select element
    // To find the select, we can find the default option and get its parent
    const defaultOption = await screen.findByText('— Select from inventory —');
    const selectEl = defaultOption.parentElement as HTMLSelectElement;

    // Simulate selecting the item
    fireEvent.change(selectEl, { target: { value: 'i1' } });

    // "1 unit will be deducted..." message should now be shown
    expect(await screen.findByText('1 unit will be deducted from inventory on approval.')).toBeInTheDocument();
    
    // The free text alternative input should disappear
    expect(screen.queryByPlaceholderText('Or type a free-text product name…')).not.toBeInTheDocument();
  });

  it('Scenario 5.3 — Clear inventory item: free-text input reappears', async () => {
    (isModuleEnabled as Mock).mockImplementation(async (mod) => mod === 'inventory');
    (getInventory as Mock).mockResolvedValue([
      { id: 'i1', name: 'Nano Coat A', currentStock: 5, unit: 'bottle' }
    ]);

    render(<RecordFormPage />);

    const defaultOption = await screen.findByText('— Select from inventory —');
    const selectEl = defaultOption.parentElement as HTMLSelectElement;

    // Select the item
    fireEvent.change(selectEl, { target: { value: 'i1' } });
    expect(await screen.findByText('1 unit will be deducted from inventory on approval.')).toBeInTheDocument();

    // Now clear it
    fireEvent.change(selectEl, { target: { value: '' } });

    // Deduction message gone
    await waitFor(() => {
      expect(screen.queryByText('1 unit will be deducted from inventory on approval.')).not.toBeInTheDocument();
    });

    // Free text input is back
    expect(screen.getByPlaceholderText('Or type a free-text product name…')).toBeInTheDocument();
  });

  it('Scenario 5.4 — Inventory disabled: shows free-text input only', async () => {
    (isModuleEnabled as Mock).mockImplementation(async () => false); // All modules disabled

    render(<RecordFormPage />);

    // Wait for form to load (service types fetch completes)
    const fallbackInput = await screen.findByPlaceholderText('e.g. Ceramic Pro Gold 9H');
    expect(fallbackInput).toBeInTheDocument();

    // No dropdown
    expect(screen.queryByText('— Select from inventory —')).not.toBeInTheDocument();
  });

  it('Scenario 5.5 — Inventory enabled but no items: shows free-text input only', async () => {
    (isModuleEnabled as Mock).mockImplementation(async (mod) => mod === 'inventory');
    (getInventory as Mock).mockResolvedValue([]); // Empty list

    render(<RecordFormPage />);

    // Falls back to standard input
    const fallbackInput = await screen.findByPlaceholderText('e.g. Ceramic Pro Gold 9H');
    expect(fallbackInput).toBeInTheDocument();

    // No dropdown
    expect(screen.queryByText('— Select from inventory —')).not.toBeInTheDocument();
  });
});
