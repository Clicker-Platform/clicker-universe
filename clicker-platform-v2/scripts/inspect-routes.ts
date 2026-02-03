
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
            if (serviceAccountKey.endsWith('.json') || serviceAccountKey.startsWith('/') || serviceAccountKey.startsWith('./')) {
                const keyPath = path.resolve(process.cwd(), serviceAccountKey);
                if (fs.existsSync(keyPath)) return initializeApp({ credential: cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))) });
            } else {
                return initializeApp({ credential: cert(JSON.parse(serviceAccountKey)) });
            }
        } catch (e) { console.warn("Credential error:", e); }
    }
    const localKeyPath = path.join(process.cwd(), 'service-account.json');
    if (fs.existsSync(localKeyPath)) return initializeApp({ credential: cert(JSON.parse(fs.readFileSync(localKeyPath, 'utf8'))) });
    return initializeApp();
}

async function inspectRoutes() {
    const app = initializeAdmin();
    const db = getFirestore(app);
    const doc = await db.collection('modules').doc('membership').get();

    console.log("--- Project ID ---");
    console.log(app.options.credential ? (app.options.credential as any).projectId : 'Unknown');

    if (doc.exists) {
        const data = doc.data();
        console.log("\n--- Admin Routes ---");
        console.log(JSON.stringify(data?.adminRoutes, null, 2));
        console.log(`Array Length: ${data?.adminRoutes?.length}`);
    } else {
        console.log("Document does not exist!");
    }
}

inspectRoutes().catch(console.error);
