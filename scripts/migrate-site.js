
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function migrateSite(sourceId, targetId) {
    console.log(`Starting migration from ${sourceId} to ${targetId}...`);

    const sourceRef = db.collection('sites').doc(sourceId);
    const targetRef = db.collection('sites').doc(targetId);

    // 1. Check if source exists
    const sourceSnap = await sourceRef.get();
    if (!sourceSnap.exists) {
        console.error(`Source site ${sourceId} does not exist!`);
        return;
    }

    // 2. Copy main doc data (if any fields exist on the doc itself)
    await targetRef.set(sourceSnap.data());
    console.log(`Copied root document.`);

    // 3. Copy Subcollections
    const collections = await sourceRef.listCollections();
    for (const collection of collections) {
        const outputColl = targetRef.collection(collection.id);
        const snapshot = await collection.get();

        console.log(`Migrating collection: ${collection.id} (${snapshot.size} docs)`);

        const batchSize = 500;
        let batch = db.batch();
        let count = 0;

        for (const doc of snapshot.docs) {
            batch.set(outputColl.doc(doc.id), doc.data());
            count++;
            if (count % batchSize === 0) {
                await batch.commit();
                batch = db.batch();
                console.log(`  Committed batch of ${batchSize}`);
            }
        }

        if (count % batchSize !== 0) {
            await batch.commit();
            console.log(`  Committed final batch.`);
        }
    }

    console.log(`Migration complete! You can now access siteId: ${targetId}`);
}

async function run() {
    try {
        await migrateSite('hi-clicker', 'demo');
    } catch (e) {
        console.error(e);
    }
}

run();
