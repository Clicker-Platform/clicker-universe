
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

function initializeAdmin() {
    if (getApps().length > 0) return getApps()[0];
    const serviceAccountKeyPath = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKeyPath && fs.existsSync(serviceAccountKeyPath)) {
        const credential = JSON.parse(fs.readFileSync(serviceAccountKeyPath, 'utf8'));
        return initializeApp({ credential: cert(credential) });
    }
    return initializeApp();
}

import { getAuth } from 'firebase-admin/auth';

const auth = getAuth(initializeAdmin());
const db = getFirestore(initializeAdmin());

async function setAdmin() {
    console.log("Fetching all users...");
    const listUsersResult = await auth.listUsers(100);

    for (const userRecord of listUsersResult.users) {
        const uid = userRecord.uid;
        const email = userRecord.email || 'no-email';
        console.log(`Granting admin to ${uid} (${email})...`);

        await db.collection('modules').doc('byod_pos').collection('admins').doc(uid).set({
            role: 'owner',
            createdAt: new Date(),
            name: userRecord.displayName || 'Admin'
        });
    }

    console.log(`✅ Admin permissions granted to ${listUsersResult.users.length} users.`);
    process.exit(0);
}

setAdmin().catch(err => {
    console.error(err);
    process.exit(1);
});
