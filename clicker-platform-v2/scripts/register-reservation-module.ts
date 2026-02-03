import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

function initializeAdmin() {
    if (getApps().length > 0) return getApps()[0];
    const serviceAccountKey = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
        try {
            const credential = JSON.parse(serviceAccountKey);
            return initializeApp({ credential: cert(credential) });
        } catch (e) { }
    }
    return initializeApp();
}

const db = getFirestore(initializeAdmin());

async function registerReservationModule() {
    console.log("Registering Reservation Module...");

    const reservationModule = {
        id: 'reservation',
        name: 'Reservation',
        description: 'Manage bookings, services, and staff resources.',
        enabled: true,
        adminRoutes: [
            {
                path: '/admin/reservation',
                label: 'Reservation',
                icon: 'calendar-check',
                order: 10
            },
            {
                path: '/admin/reservation/calendar',
                label: 'Calendar',
                icon: 'calendar',
                order: 20
            },
            {
                path: '/admin/reservation/services',
                label: 'Services',
                icon: 'list',
                order: 30
            },
            {
                path: '/admin/reservation/staff',
                label: 'Staff / Resources',
                icon: 'users',
                order: 40
            },

        ],
        publicRoutes: [
            {
                path: '/book',
                componentKey: 'reservation:BookPage',
                label: 'Book Appointment'
            }
        ],
        dashboardWidgets: [
            {
                location: 'member_dashboard',
                componentKey: 'reservation:UpcomingWidget',
                priority: 10
            }
        ]
    };

    await db.collection('modules').doc('reservation').set(reservationModule, { merge: true });
    console.log("✅ Reservation module registered successfully.");
}

registerReservationModule().catch(console.error);
