const admin = require('firebase-admin');
const serviceAccount = require('../clicker-universe-firebase-adminsdk-fbsvc-cd9dacac7e.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// List of sites to delete
const SITES_TO_DELETE = [
    'kasisehat-bintaro',
    'kasisehat'
];

// List of subcollections to delete recursively
const SUBCOLLECTIONS = [
    'content',
    'pages',
    'products',
    'links',
    'assets',
    'customers',
    'orders'
];

async function deleteSites() {
    console.log(`🗑️  Starting deletion of sites: ${SITES_TO_DELETE.join(', ')}...`);

    for (const siteId of SITES_TO_DELETE) {
        console.log(`\nDeleting site: [${siteId}]...`);
        const siteRef = db.collection('sites').doc(siteId);

        // Check if exists
        const doc = await siteRef.get();
        if (!doc.exists) {
            console.log(`   - Site document not found (already deleted?).`);
        } else {
            // Delete subcollections first
            for (const colName of SUBCOLLECTIONS) {
                await deleteCollection(siteRef.collection(colName), colName);
            }

            // Delete main doc
            await siteRef.delete();
            console.log(`   ✅ Deleted main site document: ${siteId}`);
        }
    }

    console.log('\n✨ Cleanup complete! You can now create a fresh tenant.');
}

async function deleteCollection(collectionRef, name) {
    const snapshot = await collectionRef.limit(500).get();
    if (snapshot.empty) {
        return;
    }

    console.log(`   - Deleting ${snapshot.size} docs in ${name}...`);
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    // Recurse if there are more
    await deleteCollection(collectionRef, name);
}

deleteSites().catch(console.error);
