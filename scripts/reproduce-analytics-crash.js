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

async function reproduceCrash() {
    console.log(`💥 Attempting to reproduce analytics crash...`);
    console.log(`Targeting Site: ${SITE_ID}, Link: ${FAKE_LINK_ID}`);

    const batch = db.batch();

    // Simulate the exact logic in route.ts
    const linkRef = db.collection('sites').doc(SITE_ID).collection('links').doc(FAKE_LINK_ID);

    // This should fail at commit because the doc doesn't exist
    console.log('Queuing update for non-existent doc...');
    batch.update(linkRef, { clicks: FieldValue.increment(1) });

    try {
        await batch.commit();
        console.log('✅ Batch committed successfully (Unexpected!)');
    } catch (error) {
        console.log('❌ Caught expected error:', error.message);
        console.log('Code:', error.code);
        if (error.code === 5 || error.message.includes('NOT_FOUND') || error.message.includes('No document to update')) {
            console.log('✅ Reproduction SUCCESS: batch.update fails on missing doc.');
        } else {
            console.log('❓ Unexpected error code.');
        }
    }
}

reproduceCrash().catch(console.error);
