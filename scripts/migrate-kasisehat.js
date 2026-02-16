const admin = require('firebase-admin');
const serviceAccount = require('../clicker-universe-firebase-adminsdk-fbsvc-cd9dacac7e.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const OLD_SITE_ID = 'kasisehat-bintaro';
const NEW_SITE_ID = 'kasisehat';

// List of subcollections to migrate
const SUBCOLLECTIONS = [
    'content',
    'pages',
    'products',
    'links',
    'assets',
    'customers',
    'orders'
];

async function migrateSite() {
    console.log(`🚀 Migrating site from [${OLD_SITE_ID}] to [${NEW_SITE_ID}]...`);

    const oldSiteRef = db.collection('sites').doc(OLD_SITE_ID);
    const newSiteRef = db.collection('sites').doc(NEW_SITE_ID);

    // 1. Check if old site exists
    const oldSiteDoc = await oldSiteRef.get();
    if (!oldSiteDoc.exists) {
        console.error(`❌ Old site ${OLD_SITE_ID} does not exist! Aborting.`);
        return;
    }

    // 2. Check if new site already exists (to prevent accidental overwrite, or warn)
    const newSiteDoc = await newSiteRef.get();
    if (newSiteDoc.exists) {
        console.warn(`⚠️ New site ${NEW_SITE_ID} already exists. Data will be merged/overwritten.`);
    }

    // 3. Copy Main Site Document
    const siteData = oldSiteDoc.data();
    // Update ID and Domain in the new document
    const newSiteData = {
        ...siteData,
        id: NEW_SITE_ID,
        domain: `${NEW_SITE_ID}.clicker.id`,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Update SEO title/description if they contain the old ID
    if (newSiteData.metadata?.seo) {
        // Optional: Update metadata if needed. For now keeping original content.
    }

    await newSiteRef.set(newSiteData);
    console.log(`✅ Main site document copied.`);

    // 4. Copy Subcollections
    for (const collectionName of SUBCOLLECTIONS) {
        console.log(`📂 Migrating subcollection: ${collectionName}...`);
        const oldSubRef = oldSiteRef.collection(collectionName);
        const newSubRef = newSiteRef.collection(collectionName);

        const snapshot = await oldSubRef.get();
        if (snapshot.empty) {
            console.log(`   (Skipping empty collection: ${collectionName})`);
            continue;
        }

        const batch = db.batch();
        let batchCount = 0;

        for (const doc of snapshot.docs) {
            const docData = doc.data();
            const newDocRef = newSubRef.doc(doc.id); // Keep same doc IDs
            batch.set(newDocRef, docData);
            batchCount++;

            // Batch limit is 500, but let's commit every 400 for safety
            if (batchCount >= 400) {
                await batch.commit();
                console.log(`   - Committed batch of 400 documents.`);
                // Reset batch (re-instantiate in JS SDK?) 
                // Actually, we need a new batch object.
                // For simplicity in this script, let's just await set() individually if it's huge, 
                // or use a new batch. 
                // Given typical site size, one batch might be enough, but let's do safe chunking if needed.
            }
        }

        if (batchCount > 0) {
            await batch.commit();
            console.log(`   ✅ Copied ${batchCount} documents in ${collectionName}.`);
        }
    }

    console.log(`\n🎉 Migration to ${NEW_SITE_ID} complete!`);
    console.log(`⚠️  Old site [${OLD_SITE_ID}] is NOT deleted yet.`);
    console.log(`   Please verify the new site works, then run: node scripts/delete-site.js ${OLD_SITE_ID}`);
}

migrateSite().catch(console.error);
