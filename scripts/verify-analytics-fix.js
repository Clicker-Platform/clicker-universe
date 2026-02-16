const admin = require('firebase-admin');
const serviceAccount = require('../clicker-universe-firebase-adminsdk-fbsvc-cd9dacac7e.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const SITE_ID = 'demo';
const FAKE_LINK_ID = 'non-existent-link-' + Date.now();

async function verifyFix() {
    console.log(`🧪 Verifying fix for analytics crash...`);
    console.log(`Targeting Site: ${SITE_ID}, Link: ${FAKE_LINK_ID}`);

    const batch = db.batch();

    // Simulate the NEW logic in route.ts
    const linkRef = db.collection('sites').doc(SITE_ID).collection('links').doc(FAKE_LINK_ID);

    // This should SUCCEED now because we use set with merge
    console.log('Queuing set(merge: true) for non-existent doc...');
    batch.set(linkRef, { clicks: FieldValue.increment(1) }, { merge: true });

    try {
        await batch.commit();
        console.log('✅ Batch committed successfully!');

        // Verify doc creation
        const doc = await linkRef.get();
        if (doc.exists && doc.data().clicks === 1) {
            console.log('✅ Document created with clicks: 1');

            // Cleanup
            await linkRef.delete();
            console.log('🧹 Cleanup complete.');
        } else {
            console.log('❌ Document check failed.');
        }

    } catch (error) {
        console.log('❌ Caught UNEXPECTED error:', error.message);
        console.log('Code:', error.code);
    }
}

verifyFix().catch(console.error);
