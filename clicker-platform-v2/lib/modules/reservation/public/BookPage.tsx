import { getServices, getWeeklySlots, getReservationSettings } from '@/lib/modules/reservation/api';
import { getStaffMembers } from '@/lib/modules/reservation/staff';
import BookingForm from '@/lib/modules/reservation/public/BookingForm';

import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function generateMetadata() {
    const profileSnap = await getDoc(doc(db, "content", "profile"));
    const profile = profileSnap.exists() ? profileSnap.data() : null;
    const businessName = profile?.name || 'Clicker App'; // Fallback

    return {
        title: `Book an Appointment | ${businessName}`,
        description: 'Schedule your next appointment with us.'
    };
}

// Force dynamic rendering because we are fetching data that might change
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
        console.error("BookPage: siteId missing!");
        // Fallback or Error? 
        // For now, let it crash or handle gracefully? 
        // We'll trust the caller passes it, but type definition helps.
    }

    // Modular Check: Verify if module is enabled
    // Note: isModuleEnabled checks globally or by doc ID? 
    // It checks 'modules/reservation' doc. 
    // Usually modules docs are global or site-specific?
    // In registry.ts: doc(db, 'modules', moduleId). 
    // If modules are enabled per site, we might need a site-specific check.
    // For now, keeping existing check but usually we want site specific.
    // TODO: Verify isModuleEnabled implementation scope. 
    // Assuming global module toggle for now based on registry.ts read earlier.

    const enabled = await isModuleEnabled('reservation');
    if (!enabled) {
        notFound();
    }

    // Fetch all required data on the server with siteId
    const [services, weeklySlots, staffList, settings] = await Promise.all([
        getServices(siteId),
        getWeeklySlots(siteId),
        getStaffMembers(siteId, true),
        getReservationSettings(siteId)
    ]);

    // Filter active services and staff
    const activeServices = services.filter(s => s.isActive).map(s => JSON.parse(JSON.stringify(s)));
    const activeStaff = staffList.map(s => JSON.parse(JSON.stringify(s)));
    const safeSlots = weeklySlots.map(s => JSON.parse(JSON.stringify(s)));

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 text-gray-900">
            <div className="max-w-md mx-auto mb-8 text-center">
                <h1 className="text-3xl font-black text-gray-900 mb-2">Book Appointment</h1>
                <p className="text-gray-600">Choose a service and time that works for you.</p>
            </div>

            <BookingForm
                siteId={siteId}
                initialServices={activeServices}
                initialWeeklySlots={safeSlots}
                initialStaff={activeStaff}
                initialSettings={settings}
            />
        </div>
    );
}
