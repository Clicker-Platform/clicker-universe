import { getServices, getReservationSettings } from '@/lib/modules/reservation/api';
import { getStaffMembers } from '@/lib/modules/reservation/staff';
import BookingForm from '@/lib/modules/reservation/public/BookingForm';
import { logger } from '@/lib/logger-edge';

import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function generateMetadata() {
    const profileSnap = await getDoc(doc(db, "content", "profile"));
    const profile = profileSnap.exists() ? profileSnap.data() : null;
    const businessName = profile?.name || 'Clicker App';

    return {
        title: `Book an Appointment | ${businessName}`,
        description: 'Schedule your next appointment with us.'
    };
}

export const dynamic = 'force-dynamic';

import { isModuleEnabled } from '@/lib/modules/registry';
import { notFound } from 'next/navigation';

interface BookPageProps {
    siteId: string;
    params?: any;
    searchParams?: any;
}

export default async function BookPage({ siteId }: BookPageProps) {
    if (!siteId) {
        logger.error('reservation.book-page.siteId.missing', { siteId: 'platform' });
    }

    const enabled = await isModuleEnabled('reservation');
    if (!enabled) {
        notFound();
    }

    const [services, staffList, settings] = await Promise.all([
        getServices(siteId),
        getStaffMembers(siteId, true),
        getReservationSettings(siteId)
    ]);

    const activeServices = services.filter(s => s.isActive).map(s => JSON.parse(JSON.stringify(s)));
    const activeStaff = staffList.map(s => JSON.parse(JSON.stringify(s)));

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 text-gray-900">
            <div className="max-w-md mx-auto mb-8 text-center">
                <h1 className="text-3xl font-black text-gray-900 mb-2">Book Appointment</h1>
                <p className="text-gray-600">Choose a service and time that works for you.</p>
            </div>

            <BookingForm
                siteId={siteId}
                initialServices={activeServices}
                initialStaff={activeStaff}
                initialSettings={settings}
            />
        </div>
    );
}
