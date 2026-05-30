'use client';

// Registry for CLIENT-SIDE Only Components
// Used by Client Components like MemberDashboard.
// MUST NOT import any Server Components or libraries using 'child_process' (firebase-admin).

import POSBlockClient from '@/lib/modules/byod_pos/components/POSBlockClient';
import UpcomingReservationsWidget from '@/lib/modules/reservation/public/UpcomingReservationsWidget';
import ReservationWidget from '@/lib/modules/reservation/public/ReservationWidget';
import MemberRewardsWidget from '@/lib/modules/promo/components/MemberRewardsWidget';
import MyVouchersWidget from '@/lib/modules/promo/components/MyVouchersWidget';
import LibrarySurface from '@/lib/modules/digital_goods/components/LibrarySurface';

// Only include components specifically designed for Client usage
export const CLIENT_MODULE_COMPONENTS: Record<string, any> = {
    // POS Module
    'byod_pos:MenuGrid': POSBlockClient,

    // Reservation Module
    'reservation:BookNowWaitlist': ReservationWidget, // Client Version
    'reservation:UpcomingWidget': UpcomingReservationsWidget,

    // Promo Module
    'promo:MemberRewardsWidget': MemberRewardsWidget,
    'promo:MyVouchersWidget': MyVouchersWidget,

    // Digital Goods Module — account-dashboard surface
    'digital_goods:LibrarySurface': LibrarySurface,

    // Add others only if verified as Client Components
};
