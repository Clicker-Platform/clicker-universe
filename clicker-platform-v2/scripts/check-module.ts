import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

// 1. Initialize Admin (Bypasses Rules)
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

const adminDb = getFirestore(initializeAdmin());

async function check() {
    console.log("--- DIAGNOSTIC CHECK ---");

    // Check 1: Does it exist in Admin (Truth)
    const docRef = adminDb.collection('modules').doc('membership');
    const docSnap = await docRef.get();

    if (docSnap.exists) {
        const data = docSnap.data();
        console.log("✅ [Admin SDK] Module 'membership' FOUND.");
        console.log(`   - Enabled: ${data?.enabled}`);
        console.log(`   - Routes: ${data?.adminRoutes?.length || 0}`);
        console.log(`   - Public: ${data?.publicRoutes?.length || 0}`);
    } else {
        console.error("❌ [Admin SDK] Module 'membership' NOT FOUND in Firestore.");
        console.error("   This means the registration script failed to write.");
    }
}

check().catch(console.error);
