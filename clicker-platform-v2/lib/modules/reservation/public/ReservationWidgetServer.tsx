import { getServices, getReservationSettings } from '../api';
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
        return null;
    }

    const [services, staff, settings] = await Promise.all([
        getServices(siteId),
        getStaffMembers(siteId, true),
        getReservationSettings(siteId)
    ]);

    const serializedServices = JSON.parse(JSON.stringify(services));
    const serializedStaff = JSON.parse(JSON.stringify(staff));
    const serializedSettings = JSON.parse(JSON.stringify(settings));

    return (
        <div className="py-8">
            <BookingForm
                initialServices={serializedServices}
                initialStaff={serializedStaff}
                initialSettings={serializedSettings}
                siteId={siteId}
            />
        </div>
    );
}
