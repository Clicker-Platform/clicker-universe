import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import {
    createService,
    updateService,
    getServices,
    getService,
} from '@/lib/modules/reservation/api';
import {
    getServiceCatalog,
    getServiceCatalogItem,
    createServiceCatalogItem,
    updateServiceCatalogItem,
} from '@/lib/core/serviceCatalog/api';

vi.mock('@/lib/core/serviceCatalog/api', () => ({
    getServiceCatalog: vi.fn(),
    getServiceCatalogItem: vi.fn(),
    createServiceCatalogItem: vi.fn(),
    updateServiceCatalogItem: vi.fn(),
    deleteServiceCatalogItem: vi.fn(),
}));

describe('Suite 9 — Reservation Services API (catalog projection)', () => {
    const siteId = 'site_123';
    const serviceId = 'svc_001';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // --- catalogToService projection ---

    describe('getServices / getService — projection', () => {
        it('projects maxPrice from reservationConfig.maxPrice', async () => {
            (getServiceCatalogItem as Mock).mockResolvedValue({
                id: serviceId,
                name: 'Detailing',
                price: 200000,
                isActive: true,
                category: 'PREMIUM',
                reservationConfig: { bookingType: 'time_slot', maxPrice: 500000 },
            });

            const svc = await getService(siteId, serviceId);
            expect(svc?.maxPrice).toBe(500000);
            expect(svc?.bookingType).toBe('time_slot');
        });

        it('projects bookingType=request when reservationConfig says so', async () => {
            (getServiceCatalogItem as Mock).mockResolvedValue({
                id: serviceId,
                name: 'Custom Quote',
                price: 0,
                isActive: true,
                category: 'OTHER',
                reservationConfig: { bookingType: 'request' },
            });

            const svc = await getService(siteId, serviceId);
            expect(svc?.bookingType).toBe('request');
            expect(svc?.maxPrice).toBeUndefined();
        });

        it('getServices filters out catalog items without reservationConfig', async () => {
            (getServiceCatalog as Mock).mockResolvedValue([
                { id: 'a', name: 'Bookable', price: 1, isActive: true, category: 'X', reservationConfig: { bookingType: 'time_slot' } },
                { id: 'b', name: 'SR-only', price: 1, isActive: true, category: 'X', serviceRecordsConfig: { hasWarranty: false } },
                { id: 'c', name: 'Plain', price: 1, isActive: true, category: 'X' },
            ]);

            const svcs = await getServices(siteId);
            expect(svcs.map(s => s.id)).toEqual(['a']);
        });
    });

    // --- createService ---

    describe('createService', () => {
        it('honors bookingType=request instead of hardcoding time_slot', async () => {
            (createServiceCatalogItem as Mock).mockResolvedValue('new_id');

            await createService(siteId, {
                name: 'Custom Quote',
                price: 0,
                isActive: true,
                bookingType: 'request',
            } as any);

            const payload = (createServiceCatalogItem as Mock).mock.calls[0][1];
            expect(payload.reservationConfig.bookingType).toBe('request');
        });

        it('defaults bookingType to time_slot when omitted', async () => {
            (createServiceCatalogItem as Mock).mockResolvedValue('new_id');

            await createService(siteId, {
                name: 'Wash',
                price: 50000,
                isActive: true,
            } as any);

            const payload = (createServiceCatalogItem as Mock).mock.calls[0][1];
            expect(payload.reservationConfig.bookingType).toBe('time_slot');
        });

        it('writes maxPrice into reservationConfig when provided', async () => {
            (createServiceCatalogItem as Mock).mockResolvedValue('new_id');

            await createService(siteId, {
                name: 'Detailing',
                price: 200000,
                maxPrice: 500000,
                isActive: true,
                bookingType: 'time_slot',
            } as any);

            const payload = (createServiceCatalogItem as Mock).mock.calls[0][1];
            expect(payload.reservationConfig.maxPrice).toBe(500000);
        });

        it('omits maxPrice from reservationConfig when undefined', async () => {
            (createServiceCatalogItem as Mock).mockResolvedValue('new_id');

            await createService(siteId, {
                name: 'Wash',
                price: 50000,
                isActive: true,
            } as any);

            const payload = (createServiceCatalogItem as Mock).mock.calls[0][1];
            expect('maxPrice' in payload.reservationConfig).toBe(false);
        });
    });

    // --- updateService merge guard ---

    describe('updateService — reservationConfig merge guard', () => {
        it('changing only bookingType preserves existing maxPrice', async () => {
            (getServiceCatalogItem as Mock).mockResolvedValue({
                id: serviceId,
                name: 'Detailing',
                price: 200000,
                isActive: true,
                category: 'PREMIUM',
                reservationConfig: { bookingType: 'time_slot', maxPrice: 500000 },
            });

            await updateService(siteId, serviceId, { bookingType: 'request' });

            const patch = (updateServiceCatalogItem as Mock).mock.calls[0][2];
            expect(patch.reservationConfig).toEqual({
                bookingType: 'request',
                maxPrice: 500000,
            });
        });

        it('changing only maxPrice preserves existing bookingType', async () => {
            (getServiceCatalogItem as Mock).mockResolvedValue({
                id: serviceId,
                name: 'Detailing',
                price: 200000,
                isActive: true,
                category: 'PREMIUM',
                reservationConfig: { bookingType: 'request', maxPrice: 300000 },
            });

            await updateService(siteId, serviceId, { maxPrice: 600000 });

            const patch = (updateServiceCatalogItem as Mock).mock.calls[0][2];
            expect(patch.reservationConfig).toEqual({
                bookingType: 'request',
                maxPrice: 600000,
            });
        });

        it('skips the catalog read when neither bookingType nor maxPrice is in the patch', async () => {
            await updateService(siteId, serviceId, { name: 'Renamed', price: 999 });

            expect(getServiceCatalogItem).not.toHaveBeenCalled();
            const patch = (updateServiceCatalogItem as Mock).mock.calls[0][2];
            expect(patch.reservationConfig).toBeUndefined();
            expect(patch.name).toBe('Renamed');
            expect(patch.price).toBe(999);
        });

        it('falls back to time_slot default when current item has no reservationConfig', async () => {
            (getServiceCatalogItem as Mock).mockResolvedValue({
                id: serviceId,
                name: 'Orphan',
                price: 100,
                isActive: true,
                category: 'OTHER',
                // no reservationConfig
            });

            await updateService(siteId, serviceId, { maxPrice: 250 });

            const patch = (updateServiceCatalogItem as Mock).mock.calls[0][2];
            expect(patch.reservationConfig).toEqual({
                bookingType: 'time_slot',
                maxPrice: 250,
            });
        });
    });
});
