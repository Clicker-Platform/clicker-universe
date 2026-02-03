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

async function updateReservationModule() {
    console.log("Updating Reservation Module with Dashboard Widget...");
    const docRef = db.collection('modules').doc('reservation');

    await docRef.update({
        dashboardWidgets: [
            {
                location: 'member_dashboard',
                componentKey: 'reservation:UpcomingWidget',
                priority: 10
            }
        ]
    });
    console.log("✅ Reservation Module updated.");
}

updateReservationModule().catch(console.error);
