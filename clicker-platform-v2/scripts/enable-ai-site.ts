
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
function initializeAdmin() {
    if (getApps().length > 0) return getApps()[0];

    // Use the specific key provided by the user
    const serviceAccountKeyPath = '/Users/mac/Documents/AI Project/Clicker/clicker-platform-multi-tenant/clicker-universe-firebase-adminsdk-fbsvc-cd9dacac7e.json';

    if (serviceAccountKeyPath && fs.existsSync(serviceAccountKeyPath)) {
        try {
            const credential = JSON.parse(fs.readFileSync(serviceAccountKeyPath, 'utf8'));
            return initializeApp({ credential: cert(credential) });
        } catch (e: any) {
            console.error("Failed to initialize admin:", e.message);
        }
    } else {
        console.error("❌ Service Account Key not found at: " + serviceAccountKeyPath);
        process.exit(1);
    }
    return initializeApp();
}

const db = getFirestore(initializeAdmin());

async function enableAiForSite(siteId: string) {
    console.log(`🔌 Enabling AI Sales Agent for site: ${siteId}...`);

    try {
        const siteRef = db.collection('sites').doc(siteId);
        const siteSnap = await siteRef.get();

        if (!siteSnap.exists) {
            console.error(`❌ Site '${siteId}' does not exist.`);
            process.exit(1);
        }

        await siteRef.set({
            modules: {
                'ai_sales': true
            }
        }, { merge: true });

        console.log(`✅ Success! Enabled 'ai_sales' for site: ${siteId}`);
        console.log(`   Owner: ${siteSnap.data()?.ownerEmail || 'Unknown'}`);

    } catch (error: any) {
        console.error("Fatal error:", error);
        process.exit(1);
    }
}

const targetSiteId = process.argv[2];
if (!targetSiteId) {
    console.error("Usage: npx ts-node scripts/enable-ai-site.ts <site-id>");
    process.exit(1);
}

enableAiForSite(targetSiteId).then(() => process.exit(0));
