import { getServices, getReservationSettings } from '../api';
import { getStaffMembers } from '../staff';
import BookingForm from './BookingForm';
import { logger } from '@/lib/logger';

/**
 * Server Component Wrapper for Reservation Booking
 * Fetches data on the server to prevent layout shift and "Loading..." states on the client.
 */
export default async function ReservationWidgetServer({ siteId }: { siteId: string }) {
    if (!siteId) {
        logger.error('reservation.widget-server.siteId.missing', { siteId: 'platform' });
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
