
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin (Copied from seed-modules.ts for reliability)
function initializeAdmin() {
    if (getApps().length > 0) return getApps()[0];

    // Use the specific key provided by the user
    // Path: /Users/mac/Documents/AI Project/Clicker/clicker-platform-multi-tenant/clicker-universe-firebase-adminsdk-fbsvc-cd9dacac7e.json
    const serviceAccountKeyPath = '/Users/mac/Documents/AI Project/Clicker/clicker-platform-multi-tenant/clicker-universe-firebase-adminsdk-fbsvc-cd9dacac7e.json';
    if (serviceAccountKeyPath) {
        try {
            let credential;
            if (fs.existsSync(serviceAccountKeyPath)) {
                console.log(`Reading credentials from file: ${serviceAccountKeyPath}`);
                const fileContent = fs.readFileSync(serviceAccountKeyPath, 'utf8');
                credential = JSON.parse(fileContent);
            } else {
                console.log("Parsing credentials from env var...");
                credential = JSON.parse(serviceAccountKeyPath);
            }
            return initializeApp({ credential: cert(credential) });
        } catch (e: any) {
            console.error("Failed to initialize admin:", e.message);
        }
    } else {
        console.warn("GCP_SERVICE_ACCOUNT_KEY not found. Attempting default init...");
    }
    return initializeApp();
}

const db = getFirestore(initializeAdmin());

async function findAndEnableAi(targetEmail: string) {
    console.log(`🔍 Searching for sites associated with: ${targetEmail}`);

    try {
        // 1. Try to find the user in 'users' collection first (if it exists) to get some context?
        // In this architecture, it seems we rely on 'sites/{siteId}/members'.

        // We will scan sites. NOTE: In production with thousands of sites, this is bad. 
        // For this environment, it's likely fine.
        const sitesSnap = await db.collection('sites').get();
        console.log(`Found ${sitesSnap.size} total sites to scan.`);

        let updatedCount = 0;

        for (const siteDoc of sitesSnap.docs) {
            const siteId = siteDoc.id;
            const siteData = siteDoc.data();

            console.log(`Checking site: ${siteId} (${siteData.name || 'Unnamed'})`);

            let isMatch = false;

            // 1. Check Owner Email (Fastest & Safest)
            if (siteData.ownerEmail === targetEmail) {
                console.log(`   -> Match found via ownerEmail field.`);
                isMatch = true;
            }
            // 2. Only query members if NOT owner (and safeguard against errors)
            else {
                try {
                    console.log(`   -> Checking members subcollection...`);
                    // Use a simpler get w/o complex filters if possible, or just skip if dangerous
                    // For safety in this environment, let's catch the specific formatted error
                    const memberQuery = await db.collection(`sites/${siteId}/members`)
                        .where('email', '==', targetEmail)
                        .limit(1)
                        .get();

                    if (!memberQuery.empty) {
                        console.log(`   -> Match found in members list.`);
                        isMatch = true;
                    }
                } catch (idxError: any) {
                    console.warn(`   ⚠️ Could not query members for site ${siteId} (likely index missing or perm issue). Skipping member check.`);
                    // Continue to next site, don't crash
                }
            }

            if (isMatch) {
                console.log(`   ✅ Enabling 'ai_sales' module...`);

                // Update the module
                // Merge cleanly
                await db.collection('sites').doc(siteId).set({
                    modules: {
                        'ai_sales': true
                    }
                }, { merge: true });

                console.log(`   -> Done.`);
                updatedCount++;
            }
        }

        if (updatedCount === 0) {
            console.error(`❌ User ${targetEmail} not found in any site members list.`);
            console.log("Tip: Ensure the email matches exactly what is in the members collection.");
        } else {
            console.log(`\n✨ Success! Enabled AI Sales for ${updatedCount} site(s).`);
        }

    } catch (error: any) {
        console.error("Fatal error during execution:", error);
    }
}

const email = process.argv[2];
if (!email) {
    console.error("Please provide an email address. Usage: npx ts-node scripts/enable-ai-by-email.ts user@example.com");
    process.exit(1);
}

findAndEnableAi(email).then(() => process.exit(0));
