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
    // Requires composite index: status (==) + createdAt (desc), and status (in) + createdAt (desc)
    // Firestore index can be created at: Firebase Console > Firestore > Indexes
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

export interface ReservationSettings {
    allowStaffSelection: boolean;
    membershipEnabled?: boolean;
}

export async function getReservationSettings(siteId: string): Promise<ReservationSettings> {
    const docRef = doc(db, 'sites', siteId, SETTINGS_DOC);

    // Fetch settings doc and module status check in parallel
    const [docSnap, membershipEnabled] = await Promise.all([
        getDoc(docRef),
        isModuleEnabled('membership').catch(() => false)
    ]);

    const settings: ReservationSettings = docSnap.exists()
        ? (docSnap.data() as ReservationSettings)
        : { allowStaffSelection: false };

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
        const data = snap.data() as BusinessHours; // or similar shape with schedule
        // @ts-ignore - casting or optional check
        return data.schedule || [];
    }
    return [];
}
