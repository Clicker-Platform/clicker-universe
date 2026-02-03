
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

// Initialize basic Firebase Admin for the registry function to work?
// Wait, registry.ts imports 'firebase/firestore' (Client SDK) not Admin SDK.
// This script runs in Node. We need to mock the client SDK or rewrite the logic for Admin SDK to test it.
// Since registry.ts uses 'firebase/firestore' (Web SDK), it might not run easily in a plain Node script without polyfills.
// Instead, let's just query Firestore directly using Admin SDK with the SAME logic as the registry to verify the DATA match.

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

async function debugRoute() {
    const app = initializeAdmin();
    const db = getFirestore(app);
    const targetPath = '/admin/membership/settings';

    console.log(`Searching for route: ${targetPath}`);

    const modulesSnap = await db.collection('modules').where('enabled', '==', true).get();

    let found = false;
    modulesSnap.forEach(doc => {
        const mod = doc.data();
        console.log(`Checking module: ${doc.id}`);
        if (mod.adminRoutes) {
            mod.adminRoutes.forEach((r: any) => {
                console.log(`  - Route: ${r.path}`);
                if (r.path === targetPath) {
                    console.log(`  ✅ MATCH FOUND! Component: ${r.componentKey}`);
                    found = true;
                }
            });
        }
    });

    if (!found) console.log("❌ No matching route found in Firestore.");
}

debugRoute().catch(console.error);
