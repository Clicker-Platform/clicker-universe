import { getServices, getWeeklySlots, getReservationSettings } from '../api';
import { getStaffMembers } from '../staff';
import BookingForm from './BookingForm';

/**
 * Server Component Wrapper for Reservation Booking
 * Fetches data on the server to prevent layout shift and "Loading..." states on the client.
 */
export default async function ReservationWidgetServer({ siteId }: { siteId: string }) {
    console.log('[ReservationWidgetServer] Rendering for siteId:', siteId);

    if (!siteId) {
        console.error('[ReservationWidgetServer] Missing siteId!');
        return null; // Guard against missing siteId
    }

    console.log('[ReservationWidgetServer] Fetching data from Firestore...');
    // Parallel data fetching on the server
    const [services, staff, slots, settings] = await Promise.all([
        getServices(siteId),
        getStaffMembers(siteId, true), // active only
        getWeeklySlots(siteId),
        getReservationSettings(siteId)
    ]);
    console.log('[ReservationWidgetServer] Data fetch complete. Services:', services.length, 'Staff:', staff.length);

    // Force date serialization for Client Components
    // (Firestore Dates/Timestamps are not directly serializable to Client Components without conversion)
    const serializedServices = JSON.parse(JSON.stringify(services));
    const serializedStaff = JSON.parse(JSON.stringify(staff));
    const serializedSlots = JSON.parse(JSON.stringify(slots));
    const serializedSettings = JSON.parse(JSON.stringify(settings));

    return (
        <div className="py-8">
            <BookingForm
                initialServices={serializedServices}
                initialStaff={serializedStaff}
                initialWeeklySlots={serializedSlots}
                initialSettings={serializedSettings}
                siteId={siteId} // Pass siteId to Client Form if needed
            />
        </div>
    );
}
