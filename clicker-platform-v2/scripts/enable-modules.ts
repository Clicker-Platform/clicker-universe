
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

async function enableModules() {
    console.log("Enabling all modules...");
    const modules = ['membership', 'reservation', 'inventory', 'byod_pos'];

    for (const modId of modules) {
        console.log(`Enabling ${modId}...`);
        await db.collection('modules').doc(modId).update({ enabled: true });
    }

    console.log("✅ All modules enabled.");
    process.exit(0);
}

enableModules().catch(async (err) => {
    // If update fails (e.g. doc doesn't exist), try set with merge
    if (err.code === 5) { // NOT_FOUND
        console.log("Some modules not found, running seed-modules logic equivalent...");
        // We won't re-seed everything here to avoid overwriting custom data, 
        // but we can try set({enabled: true}, {merge: true}) if needed.
        // For now, let's just log error.
        console.error("Error: One or more modules do not exist. Please run seed-modules first if this is a fresh install.");
    } else {
        console.error(err);
    }
    process.exit(1);
});
