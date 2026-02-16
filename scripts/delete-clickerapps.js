
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function deleteSite(siteId) {
    console.log(`Deleting site: ${siteId}...`);
    const ref = db.collection('sites').doc(siteId);

    await db.recursiveDelete(ref);
    console.log(`Deleted site: ${siteId}`);
}

deleteSite('clickerapps.web.app');
