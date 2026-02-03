import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load Environment Variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin (Hybrid Strategy)
function initializeAdmin() {
    if (getApps().length > 0) return getApps()[0];

    const serviceAccountKey = process.env.GCP_SERVICE_ACCOUNT_KEY;

    if (serviceAccountKey) {
        let credential;
        try {
            if (serviceAccountKey.endsWith('.json') || serviceAccountKey.startsWith('/') || serviceAccountKey.startsWith('./')) {
                const keyPath = path.resolve(process.cwd(), serviceAccountKey);
                if (fs.existsSync(keyPath)) {
                    credential = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
                }
            } else {
                credential = JSON.parse(serviceAccountKey);
            }
        } catch (e) { console.warn("Failed to parse GCP_SERVICE_ACCOUNT_KEY:", e); }

        if (credential) {
            return initializeApp({
                credential: cert(credential)
            });
        }
    }

    // Fallback to ADC or service-account.json
    const localKeyPath = path.join(process.cwd(), 'service-account.json');
    if (fs.existsSync(localKeyPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(localKeyPath, 'utf8'));
        return initializeApp({
            credential: cert(serviceAccount)
        });
    }

    return initializeApp();
}

const app = initializeAdmin();
const db = getFirestore(app);

async function checkModule() {
    console.log("Reading modules/reservation...");
    const doc = await db.collection('modules').doc('reservation').get();
    if (!doc.exists) {
        console.log("Document does NOT exist!");
    } else {
        const data = doc.data();
        console.log("Document exists. Writing to reservation-config.json");
        fs.writeFileSync('reservation-config.json', JSON.stringify(data, null, 2));
    }
}

checkModule().catch(console.error);
