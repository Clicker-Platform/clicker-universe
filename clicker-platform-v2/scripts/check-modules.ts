
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

const db = getFirestore(initializeAdmin());

async function checkModules() {
    console.log("Checking modules...");
    const modulesToCheck = ['membership', 'reservation', 'inventory', 'byod_pos'];

    for (const modId of modulesToCheck) {
        const docSnap = await db.collection('modules').doc(modId).get();
        if (docSnap.exists) {
            console.log(`[${modId}] Enabled: ${docSnap.data()?.enabled}`);
        } else {
            console.log(`[${modId}] Document NOT FOUND`);
        }
    }
    process.exit(0);
}

checkModules().catch(console.error);
