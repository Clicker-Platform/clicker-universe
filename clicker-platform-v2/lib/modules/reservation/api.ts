import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    setDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    getCountFromServer,
    Timestamp,
    serverTimestamp,
    QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Booking, Service, ReservationSettings } from './types';
import { isModuleEnabled } from '../registry';
import { logger } from '@/lib/logger-edge';
import { getStaffMembers } from './staff';
import posthog from 'posthog-js';
import { DaySchedule } from '@/lib/core/types';
import {
    getServiceCatalog,
    getServiceCatalogItem,
    createServiceCatalogItem,
    updateServiceCatalogItem,
    deleteServiceCatalogItem,
} from '@/lib/core/serviceCatalog/api';
import type { ServiceCatalogItem } from '@/lib/core/serviceCatalog/types';
export { getStaffMembers };

// Helper to sanitize data for Firestore (replaces undefined with null or removes them)
const sanitize = (data: any) => {
    return Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, v === undefined ? null : v])
    );
};

// Collection References
const BOOKINGS_COLLECTION = 'modules/reservation/bookings';

// --- Services API (reads from shared serviceCatalog) ---

function catalogToService(item: ServiceCatalogItem): Service {
    return {
        id: item.id,
        name: item.name,
        description: item.description,
        durationMinutes: item.durationMinutes,
        bookingType: item.reservationConfig?.bookingType ?? 'time_slot',
        price: item.price,
        maxPrice: item.reservationConfig?.maxPrice,
        isActive: item.isActive,
        imageUrl: item.imageUrl,
        category: item.category,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
    };
}

// Returns all active bookable services (those with reservationConfig set)
export async function getServices(siteId: string): Promise<Service[]> {
    const items = await getServiceCatalog(siteId);
    return items
        .filter(i => i.reservationConfig !== undefined && i.reservationConfig !== null)
        .map(catalogToService);
}

export async function getService(siteId: string, id: string): Promise<Service | null> {
    const item = await getServiceCatalogItem(siteId, id);
    return item ? catalogToService(item) : null;
}

export async function createService(
    siteId: string,
    service: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
    return createServiceCatalogItem(siteId, {
        name: service.name,
        description: service.description,
        durationMinutes: service.durationMinutes,
        price: service.price,
        isActive: service.isActive ?? true,
        category: (service.category as any) || 'OTHER',
        imageUrl: service.imageUrl,
        reservationConfig: {
            bookingType: service.bookingType ?? 'time_slot',
            ...(service.maxPrice !== undefined ? { maxPrice: service.maxPrice } : {}),
        },
    });
}

export async function updateService(
    siteId: string,
    id: string,
    updates: Partial<Omit<Service, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
    const patch: Record<string, any> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.durationMinutes !== undefined) patch.durationMinutes = updates.durationMinutes;
    if (updates.price !== undefined) patch.price = updates.price;
    if (updates.isActive !== undefined) patch.isActive = updates.isActive;
    if (updates.category !== undefined) patch.category = updates.category;
    if (updates.imageUrl !== undefined) patch.imageUrl = updates.imageUrl;

    // bookingType and maxPrice live under reservationConfig — merge with current
    // value to avoid clobbering sibling fields when only one changes.
    if (updates.bookingType !== undefined || updates.maxPrice !== undefined) {
        const current = await getServiceCatalogItem(siteId, id);
        const currentConfig = current?.reservationConfig ?? { bookingType: 'time_slot' as const };
        patch.reservationConfig = {
            bookingType: updates.bookingType ?? currentConfig.bookingType,
            ...(updates.maxPrice !== undefined
                ? { maxPrice: updates.maxPrice }
                : currentConfig.maxPrice !== undefined ? { maxPrice: currentConfig.maxPrice } : {}),
        };
    }

    await updateServiceCatalogItem(siteId, id, patch);
}

export async function deleteService(siteId: string, id: string): Promise<void> {
    await deleteServiceCatalogItem(siteId, id);
}

// --- Bookings API ---

export async function getBookings(
    siteId: string,
    status?: Booking['status'] | Booking['status'][],
    limitCount: number = 20,
    lastDoc: QueryDocumentSnapshot | null = null
): Promise<{ bookings: Booking[], lastDoc: QueryDocumentSnapshot | null }> {
    // Requires composite index on bookings: (status ASC, createdAt DESC).
    // Declared in firestore.indexes.json — deploy via `firebase deploy --only firestore:indexes`.
    const coll = collection(db, 'sites', siteId, BOOKINGS_COLLECTION);

    let q = status
        ? Array.isArray(status)
            ? query(coll, where('status', 'in', status), orderBy('createdAt', 'desc'))
            : query(coll, where('status', '==', status), orderBy('createdAt', 'desc'))
        : query(coll, orderBy('createdAt', 'desc'));

    if (lastDoc) {
        q = query(q, startAfter(lastDoc));
    }

    q = query(q, limit(limitCount));

    const snapshot = await getDocs(q);
    const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
    const newLastDoc = snapshot.docs.length === limitCount ? snapshot.docs[snapshot.docs.length - 1] : null;

    return { bookings, lastDoc: newLastDoc };
}

export async function getBookingCounts(siteId: string): Promise<{ all: number; new: number; confirmed: number; done: number }> {
    const coll = collection(db, 'sites', siteId, BOOKINGS_COLLECTION);

    try {
        const [allSnap, newSnap, confirmedSnap, doneSnap] = await Promise.all([
            getCountFromServer(coll),
            getCountFromServer(query(coll, where('status', '==', 'pending'))),
            getCountFromServer(query(coll, where('status', '==', 'confirmed'))),
            getCountFromServer(query(coll, where('status', 'in', ['completed', 'cancelled'])))
        ]);

        return {
            all: allSnap.data().count,
            new: newSnap.data().count,
            confirmed: confirmedSnap.data().count,
            done: doneSnap.data().count
        };
    } catch (error) {
        logger.error('reservation.counts.failed', { siteId, error });
        return { all: 0, new: 0, confirmed: 0, done: 0 };
    }
}

export async function getBookingsForDay(siteId: string, date: Date): Promise<Booking[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const q = query(
        collection(db, 'sites', siteId, BOOKINGS_COLLECTION),
        where('startAt', '>=', Timestamp.fromDate(startOfDay)),
        where('startAt', '<=', Timestamp.fromDate(endOfDay))
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
}

export async function createBooking(siteId: string, booking: Omit<Booking, 'id' | 'createdAt'>): Promise<string> {
    // Sanitize: Firestore throws on 'undefined', wants null or omission
    const sanitizedBooking = Object.fromEntries(
        Object.entries(booking).map(([k, v]) => [k, v === undefined ? null : v])
    );

    const docRef = await addDoc(collection(db, 'sites', siteId, BOOKINGS_COLLECTION), {
        ...sanitizedBooking,
        createdAt: serverTimestamp(),
        isRead: false // Default to unread for new bookings
    });

    if (typeof window !== 'undefined') {
        posthog.capture('reservation.booking_created', { siteId, bookingId: docRef.id, serviceId: booking.serviceId });
    }

    return docRef.id;
}

export async function markBookingAsRead(siteId: string, id: string): Promise<void> {
    const docRef = doc(db, 'sites', siteId, BOOKINGS_COLLECTION, id);
    await updateDoc(docRef, { isRead: true });
}

export async function updateBookingStatus(siteId: string, bookingId: string, status: Booking['status'], cancellationReason?: string) {
    const docRef = doc(db, 'sites', siteId, BOOKINGS_COLLECTION, bookingId);

    // Fetch booking first to handle integrations
    const bookingSnap = await getDoc(docRef);
    if (!bookingSnap.exists()) return;
    const booking = bookingSnap.data() as Booking;

    const updateData: Record<string, any> = { status };
    if (cancellationReason) updateData.cancellationReason = cancellationReason;
    await updateDoc(docRef, updateData);

    // Integration: Award Points on Completion
    if (status === 'completed' && booking.status !== 'completed') {
        try {
            const { isModuleEnabled } = await import('../registry');

            // Guard: if service_records module is enabled AND this booking has a linked
            // service record, skip — points are awarded by the SR approval flow instead.
            const [loyaltyEnabled, srEnabled] = await Promise.all([
                isModuleEnabled('membership'),
                isModuleEnabled('service_records'),
            ]);
            if (srEnabled && booking.serviceRecordId) {
                return;
            }
            if (loyaltyEnabled && booking.customerPhone) {
                const { findMemberByPhone, awardPointsWithSpend, getMembershipSettings } = await import('../membership/api');
                const member = await findMemberByPhone(siteId, booking.customerPhone);
                if (member) {
                    // Use configured earning rule
                    const settings = await getMembershipSettings(siteId);
                    const bookingTotal = booking.totalPrice || 0;
                    const points = Math.floor(bookingTotal * settings.earningRatio);

                    if (points > 0) {
                        await awardPointsWithSpend(
                            siteId,
                            member.id,
                            points,
                            bookingTotal,
                            'RESERVATION',
                            bookingId,
                            booking.serviceName
                        );
                    }
                }
            }
        } catch (error) {
            logger.warn('reservation.loyalty.skipped', { siteId, error });
            // Don't block the status update even if points fail
        }
    }
}

export async function updateBookingDetails(siteId: string, id: string, updates: Partial<Booking>): Promise<void> {
    const docRef = doc(db, 'sites', siteId, BOOKINGS_COLLECTION, id);
    await updateDoc(docRef, updates);
}

// --- Availability API ---

export async function checkAvailability(siteId: string, _serviceId: string, startAt: Date, durationMinutes: number): Promise<boolean> {
    const endAt = new Date(startAt.getTime() + durationMinutes * 60000);

    const startOfDay = new Date(startAt);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startAt);
    endOfDay.setHours(23, 59, 59, 999);

    const dayQuery = query(
        collection(db, 'sites', siteId, BOOKINGS_COLLECTION),
        where('startAt', '>=', Timestamp.fromDate(startOfDay)),
        where('startAt', '<=', Timestamp.fromDate(endOfDay))
    );

    // Fetch staff and day bookings in parallel
    const [activeStaff, snapshot] = await Promise.all([
        getStaffMembers(siteId, true),
        getDocs(dayQuery)
    ]);

    const maxCapacity = activeStaff.length;
    if (maxCapacity === 0) return false;

    const newStart = startAt.getTime();
    const newEnd = endAt.getTime();

    const dayBookings = snapshot.docs.map(d => d.data() as Booking);
    const concurrentBookings = dayBookings.filter(booking => {
        if (booking.status === 'cancelled' || booking.status === 'completed') return false;
        const bStart = booking.startAt.toDate().getTime();
        const bEnd = booking.endAt.toDate().getTime();
        return (bStart < newEnd) && (bEnd > newStart);
    });

    return concurrentBookings.length < maxCapacity;
}

// --- Settings API ---

const SETTINGS_DOC = 'modules/reservation/settings/config';

export async function getReservationSettings(siteId: string): Promise<ReservationSettings> {
    const docRef = doc(db, 'sites', siteId, SETTINGS_DOC);

    // Fetch settings doc and module status check in parallel
    const [docSnap, membershipEnabled] = await Promise.all([
        getDoc(docRef),
        isModuleEnabled('membership').catch(() => false)
    ]);

    const defaults: ReservationSettings = { allowStaffSelection: false, staffLabel: 'Staff' };
    const settings: ReservationSettings = docSnap.exists()
        ? { ...defaults, ...(docSnap.data() as ReservationSettings) }
        : defaults;

    return { ...settings, membershipEnabled };
}

export async function updateReservationSettings(siteId: string, settings: Partial<ReservationSettings>): Promise<void> {
    const docRef = doc(db, 'sites', siteId, SETTINGS_DOC);
    // Use setDoc with merge to ensure document exists
    await setDoc(docRef, settings, { merge: true });
}

export async function getGlobalSchedule(siteId: string): Promise<DaySchedule[]> {
    const docRef = doc(db, 'sites', siteId, 'content', 'business');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        return (snap.data() as any).schedule || [];
    }
    return [];
}
