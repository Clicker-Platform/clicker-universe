import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

function initializeAdmin() {
    if (getApps().length > 0) return getApps()[0];
    // ... (Compact verify/init logic similar to previous script)
    const serviceAccountKey = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
        try {
            const credential = JSON.parse(serviceAccountKey); // Simplified for inline
            return initializeApp({ credential: cert(credential) });
        } catch (e) { }
    }
    return initializeApp();
}

const db = getFirestore(initializeAdmin());

async function seed() {
    console.log("Seeding test member...");
    const membersRef = db.collection('modules/membership/members');

    // Check if exists
    const q = await membersRef.where('phoneNumber', '==', '+15550123').get();
    if (!q.empty) {
        console.log("Test member already exists.");
        return;
    }

    await membersRef.add({
        fullName: 'Alice Test',
        phoneNumber: '+15550123',
        email: 'alice@test.com',
        currentPoints: 100,
        createdAt: new Date(),
        updatedAt: new Date()
    });
    console.log("✅ Created member: Alice Test (+15550123)");
}

seed().catch(console.error);
