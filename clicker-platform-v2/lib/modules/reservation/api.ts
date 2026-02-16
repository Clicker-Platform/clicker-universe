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
import { Booking, Service, Staff, TimeSlot } from './types';
import { isModuleEnabled } from '../registry';
import { getStaffMembers } from './staff';
import { DaySchedule } from '@/lib/core/types';
import { fetchSiteSettings } from '@/lib/fetchData';
import { BusinessHours } from '@/data/mockData';
export { getStaffMembers };
// Helper to sanitize data for Firestore (replaces undefined with null or removes them)
const sanitize = (data: any) => {
    return Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, v === undefined ? null : v])
    );
};

// Collection References
const SERVICES_COLLECTION = 'modules/reservation/services';
const BOOKINGS_COLLECTION = 'modules/reservation/bookings';
const SLOTS_COLLECTION = 'modules/reservation/slots';

// --- Services API ---
export async function getServices(siteId: string): Promise<Service[]> {
    const q = query(collection(db, 'sites', siteId, SERVICES_COLLECTION), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
}

export async function getService(siteId: string, id: string): Promise<Service | null> {
    const docRef = doc(db, 'sites', siteId, SERVICES_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Service) : null;
}

export async function createService(siteId: string, service: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'sites', siteId, SERVICES_COLLECTION), {
        ...sanitize(service),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return docRef.id;
}

export async function updateService(siteId: string, id: string, updates: Partial<Omit<Service, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const docRef = doc(db, 'sites', siteId, SERVICES_COLLECTION, id);
    await updateDoc(docRef, {
        ...sanitize(updates),
        updatedAt: serverTimestamp()
    });
}

export async function deleteService(siteId: string, id: string): Promise<void> {
    await deleteDoc(doc(db, 'sites', siteId, SERVICES_COLLECTION, id));
}

// --- Bookings API ---

export async function getBookings(
    siteId: string,
    status?: Booking['status'] | Booking['status'][],
    limitCount: number = 20,
    lastDoc: QueryDocumentSnapshot | null = null
): Promise<{ bookings: Booking[], lastDoc: QueryDocumentSnapshot | null }> {
    // If we have a status filter, Firestore requires a composite index for orderBy.
    // To avoid this for now, we query without orderBy if status is present and sort in-memory,
    // or we just tell the user to add the index. 
    // Given the multi-tenant nature, it's better to keep it robust.

    let baseQuery = collection(db, 'sites', siteId, BOOKINGS_COLLECTION);
    let q;

    if (status) {
        // When filtering by status, we don't include orderBy in the Firestore query to avoid index requirement
        q = query(baseQuery);
        if (Array.isArray(status)) {
            q = query(q, where('status', 'in', status));
        } else {
            q = query(q, where('status', '==', status));
        }
        // Note: Without orderBy in query, pagination (lastDoc) might be inconsistent if results are many.
        // For MVP, we'll fetch and sort.
    } else {
        q = query(baseQuery, orderBy('createdAt', 'desc'));
    }

    if (lastDoc && !status) { // Only use startAfter if we have server-side ordering
        q = query(q, startAfter(lastDoc));
    }

    q = query(q, limit(limitCount));

    const snapshot = await getDocs(q);
    let bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));

    // In-memory sort if we couldn't do it on server
    if (status) {
        bookings.sort((a, b) => {
            const dateA = a.createdAt?.toDate?.()?.getTime() || a.startAt?.toDate?.()?.getTime() || 0;
            const dateB = b.createdAt?.toDate?.()?.getTime() || b.startAt?.toDate?.()?.getTime() || 0;
            return dateB - dateA; // Descending
        });
    }

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
        console.error("Error fetching counts:", error);
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
    return docRef.id;
}

export async function markBookingAsRead(siteId: string, id: string): Promise<void> {
    const docRef = doc(db, 'sites', siteId, BOOKINGS_COLLECTION, id);
    await updateDoc(docRef, { isRead: true });
}

export async function updateBookingStatus(siteId: string, bookingId: string, status: Booking['status']) {
    const docRef = doc(db, 'sites', siteId, BOOKINGS_COLLECTION, bookingId);

    // Fetch booking first to handle integrations
    const bookingSnap = await getDoc(docRef);
    if (!bookingSnap.exists()) return;
    const booking = bookingSnap.data() as Booking;

    await updateDoc(docRef, { status });

    // Integration: Award Points on Completion
    if (status === 'completed' && booking.status !== 'completed') {
        try {
            const { isModuleEnabled } = await import('../registry');
            const loyaltyEnabled = await isModuleEnabled('membership');
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
                        console.log(`[Loyalty] Awarded ${points} points (Spend: ${bookingTotal}) to ${booking.customerPhone}`);
                    }
                }
            }
        } catch (error) {
            console.error('[Loyalty] Failed to award points:', error);
            // Don't block the status update even if points fail
        }
    }
}

export async function updateBookingDetails(siteId: string, id: string, updates: Partial<Booking>): Promise<void> {
    const docRef = doc(db, 'sites', siteId, BOOKINGS_COLLECTION, id);
    await updateDoc(docRef, updates);
}

// --- Availability / Slots API ---

// This mimics a simple rigid slot system for now. 
// A full implementation would check specific dates against existing bookings.
export async function getWeeklySlots(siteId: string): Promise<TimeSlot[]> {
    const q = query(collection(db, 'sites', siteId, SLOTS_COLLECTION));
    const snapshot = await getDocs(q);
    const slots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeSlot));

    // Sort in memory to avoid Firestore composite index requirement
    return slots.sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
        return a.startTime.localeCompare(b.startTime);
    });
}

export async function saveWeeklySlots(siteId: string, slots: Omit<TimeSlot, 'id'>[]): Promise<void> {
    // 1. Delete existing slots (simple overwrite strategy for weekly template)
    // For a robust system, we might want to update individually, but for simple weekly schedule, overwrite is fine.
    const q = query(collection(db, 'sites', siteId, SLOTS_COLLECTION));
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // 2. Add new slots
    const addPromises = slots.map(slot => addDoc(collection(db, 'sites', siteId, SLOTS_COLLECTION), slot));
    await Promise.all(addPromises);
}

export async function checkAvailability(siteId: string, serviceId: string, startAt: Date, durationMinutes: number): Promise<boolean> {
    // 1. Calculate end time
    const endAt = new Date(startAt.getTime() + durationMinutes * 60000);
    const startTimestamp = Timestamp.fromDate(startAt);
    const endTimestamp = Timestamp.fromDate(endAt);

    // 2. Query overlapping bookings
    // Firestore cannot do comprehensive range intersection in one query easily without composite indexes or multiple queries.
    // For MVP, we'll fetch bookings for that day and filter in memory or use a simple overlap check if volume is low.

    // 1. Get Resource Limit
    const activeStaff = await getStaffMembers(siteId, true);
    const maxCapacity = activeStaff.length;

    if (maxCapacity === 0) return false; // No staff, no bookings possible

    // 2. Fetch bookings for the day to check overlaps
    const startOfDay = new Date(startAt);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startAt);
    endOfDay.setHours(23, 59, 59, 999);

    const q = query(
        collection(db, 'sites', siteId, BOOKINGS_COLLECTION),
        where('startAt', '>=', Timestamp.fromDate(startOfDay)),
        where('startAt', '<=', Timestamp.fromDate(endOfDay))
    );

    const snapshot = await getDocs(q);
    const dayBookings = snapshot.docs.map(d => d.data() as Booking);

    // 3. Count Overlaps
    const newStart = startAt.getTime();
    const newEnd = endAt.getTime(); // Calculated above

    const concurrentBookings = dayBookings.filter(booking => {
        if (booking.status === 'cancelled' || booking.status === 'completed') return false; // Count pending/confirmed

        const bStart = booking.startAt.toDate().getTime();
        const bEnd = booking.endAt.toDate().getTime();

        // Check Overlap: (StartA < EndB) and (EndA > StartB)
        return (bStart < newEnd) && (bEnd > newStart);
    });

    return concurrentBookings.length < maxCapacity;
}

// --- Settings API ---

const SETTINGS_DOC = 'modules/reservation/settings/config';

export interface ReservationSettings {
    allowStaffSelection: boolean;
    membershipEnabled?: boolean;
}

export async function getReservationSettings(siteId: string): Promise<ReservationSettings> {
    const docRef = doc(db, 'sites', siteId, SETTINGS_DOC);
    const docSnap = await getDoc(docRef);
    let settings: ReservationSettings = { allowStaffSelection: false };

    if (docSnap.exists()) {
        settings = docSnap.data() as ReservationSettings;
    }

    // Centrally inject module status to ensure strict modularity
    // This prop propagates to BookingForm via BookPage, ReservationWidgetServer, and ReservationWidget
    try {
        const membershipEnabled = await isModuleEnabled('membership');
        return {
            ...settings,
            membershipEnabled
        };
    } catch (error) {
        console.error("Failed to check membership module status:", error);
        return settings;
    }
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
        const data = snap.data() as BusinessHours; // or similar shape with schedule
        // @ts-ignore - casting or optional check
        return data.schedule || [];
    }
    return [];
}
