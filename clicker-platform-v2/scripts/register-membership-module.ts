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

    // Last resort: ADC
    return initializeApp();
}

const app = initializeAdmin();
const db = getFirestore(app);

const MODULE_DEF = {
    id: 'membership',
    displayName: 'Membership & Loyalty',
    description: 'Customer loyalty program, points, and member management.',
    icon: 'user', // Maps to User icon
    version: '1.0.0',
    enabled: true,

    // Admin Routes (Sidebar)
    adminRoutes: [
        {
            path: '/admin/membership',
            label: 'Members',
            icon: 'user',
            componentKey: 'membership:MemberListPage'
        },
        // Hidden detail page
        {
            label: 'Member Details',
            hidden: true,
            componentKey: 'membership:MemberDetailsPage'
        },
        {
            path: '/admin/membership/settings',
            label: 'Settings',
            icon: 'settings',
            componentKey: 'membership:Settings'
        }
    ],

    // Public Routes (Next.js handles these via app/member structure, but we can track them here)
    publicRoutes: [
        {
            path: '/member/login',
            componentKey: 'membership:LoginPage' // Informational
        }
    ],

    // Capabilities
    collections: ['modules/membership/members', 'modules/membership/transactions'],

    // Configuration
    settings: {
        enableLoyalty: true,
        pointsName: 'Points',
        earningRatio: 1
    }
};

async function registerModule() {
    console.log(`Registering module: ${MODULE_DEF.id}...`);
    try {
        console.log("Writing module definition with keys:", Object.keys(MODULE_DEF));
        await db.collection('modules').doc(MODULE_DEF.id).set(MODULE_DEF, { merge: false });
        console.log("✅ Module registered successfully!");

        // Double check immediately
        const doc = await db.collection('modules').doc(MODULE_DEF.id).get();
        console.log("Verification Read - adminRoutes present:", !!doc.data()?.adminRoutes);
    } catch (error) {
        console.error("❌ Error registering module:", error);
    }
}

registerModule().catch(console.error);
