import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { checkAvailability } from '@/lib/modules/reservation/api';
import { getDocs, Timestamp } from 'firebase/firestore';
import { getStaffMembers } from '@/lib/modules/reservation/staff';

vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...(actual as any),
        collection: vi.fn(() => ({})),
        query: vi.fn((...args) => args),
        where: vi.fn(),
        getDocs: vi.fn(),
    };
});

vi.mock('@/lib/modules/reservation/staff', () => ({
    getStaffMembers: vi.fn(),
}));

// Build a minimal booking-shaped doc snapshot.
const bookingDoc = (startMs: number, endMs: number, status = 'confirmed') => ({
    data: () => ({
        startAt: Timestamp.fromMillis(startMs),
        endAt: Timestamp.fromMillis(endMs),
        status,
    }),
});

describe('Suite 10 — Reservation: checkAvailability', () => {
    const siteId = 'site_123';
    const serviceId = 'svc_001';
    // Requested slot: 10:00–11:00 on a fixed day
    const requestStart = new Date('2026-06-01T10:00:00Z');
    const duration = 60;
    const slotStartMs = requestStart.getTime();
    const slotEndMs = slotStartMs + 60 * 60_000;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns false when there are no active staff', async () => {
        (getStaffMembers as Mock).mockResolvedValue([]);
        (getDocs as Mock).mockResolvedValue({ docs: [] });

        const result = await checkAvailability(siteId, serviceId, requestStart, duration);
        expect(result).toBe(false);
    });

    it('returns true when concurrent bookings < staff capacity', async () => {
        (getStaffMembers as Mock).mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
        (getDocs as Mock).mockResolvedValue({
            docs: [bookingDoc(slotStartMs, slotEndMs)], // 1 overlap, capacity 2
        });

        const result = await checkAvailability(siteId, serviceId, requestStart, duration);
        expect(result).toBe(true);
    });

    it('returns false when concurrent bookings === staff capacity', async () => {
        (getStaffMembers as Mock).mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
        (getDocs as Mock).mockResolvedValue({
            docs: [
                bookingDoc(slotStartMs, slotEndMs),
                bookingDoc(slotStartMs + 10 * 60_000, slotEndMs + 10 * 60_000),
            ],
        });

        const result = await checkAvailability(siteId, serviceId, requestStart, duration);
        expect(result).toBe(false);
    });

    it('ignores cancelled and completed bookings when counting overlap', async () => {
        (getStaffMembers as Mock).mockResolvedValue([{ id: 's1' }]);
        (getDocs as Mock).mockResolvedValue({
            docs: [
                bookingDoc(slotStartMs, slotEndMs, 'cancelled'),
                bookingDoc(slotStartMs, slotEndMs, 'completed'),
            ],
        });

        const result = await checkAvailability(siteId, serviceId, requestStart, duration);
        expect(result).toBe(true); // both excluded → 0 concurrent < 1 capacity
    });

    it('treats a booking ending exactly at requested start as non-overlapping', async () => {
        (getStaffMembers as Mock).mockResolvedValue([{ id: 's1' }]);
        // Prior booking 09:00–10:00; requested 10:00–11:00
        (getDocs as Mock).mockResolvedValue({
            docs: [bookingDoc(slotStartMs - 60 * 60_000, slotStartMs)],
        });

        const result = await checkAvailability(siteId, serviceId, requestStart, duration);
        expect(result).toBe(true);
    });

    it('treats a booking starting exactly at requested end as non-overlapping', async () => {
        (getStaffMembers as Mock).mockResolvedValue([{ id: 's1' }]);
        // Following booking 11:00–12:00; requested 10:00–11:00
        (getDocs as Mock).mockResolvedValue({
            docs: [bookingDoc(slotEndMs, slotEndMs + 60 * 60_000)],
        });

        const result = await checkAvailability(siteId, serviceId, requestStart, duration);
        expect(result).toBe(true);
    });

    it('counts a partially overlapping pending booking', async () => {
        (getStaffMembers as Mock).mockResolvedValue([{ id: 's1' }]);
        // Booking 10:30–11:30 overlaps requested 10:00–11:00
        (getDocs as Mock).mockResolvedValue({
            docs: [bookingDoc(slotStartMs + 30 * 60_000, slotEndMs + 30 * 60_000, 'pending')],
        });

        const result = await checkAvailability(siteId, serviceId, requestStart, duration);
        expect(result).toBe(false);
    });
});
